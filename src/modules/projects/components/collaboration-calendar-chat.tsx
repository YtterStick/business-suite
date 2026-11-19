"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Flag,
  FolderKanban,
  Loader2,
  MessageSquare,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTimeUtc, initials } from "@/lib/format";
import { emitWorkspaceNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { postCommentAction } from "@/modules/projects/projects.actions";
import type { CommentDTO } from "@/modules/projects/projects.types";

export interface CollaborationCalendarEvent {
  id: string;
  title: string;
  dateIso: string;
  kind: "task" | "phase" | "project";
  projectId: string;
  projectName: string;
  status: string;
  assigneeName?: string | null;
  href: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CollaborationCalendarTab({
  todayIso,
  events,
  projects,
}: {
  todayIso: string;
  events: CollaborationCalendarEvent[];
  projects: Array<{ id: string; name: string }>;
}) {
  const initialDate = todayIso ? new Date(`${todayIso}T00:00:00Z`) : new Date();
  const [year, setYear] = React.useState(initialDate.getUTCFullYear());
  const [month, setMonth] = React.useState(initialDate.getUTCMonth()); // 0-11
  const [projectFilter, setProjectFilter] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState<"ALL" | "task" | "phase" | "project">("ALL");
  const [selectedDayIso, setSelectedDayIso] = React.useState<string>(todayIso);

  const monthLabel = React.useMemo(() => {
    return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [year, month]);

  const filteredEvents = React.useMemo(() => {
    return events.filter((ev) => {
      if (projectFilter && ev.projectId !== projectFilter) return false;
      if (kindFilter !== "ALL" && ev.kind !== kindFilter) return false;
      return true;
    });
  }, [events, projectFilter, kindFilter]);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CollaborationCalendarEvent[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.dateIso) ?? [];
      list.push(ev);
      map.set(ev.dateIso, list);
    }
    return map;
  }, [filteredEvents]);

  const calendarCells = React.useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const startWeekday = firstDay.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: Array<{ day: number | null; dateIso: string | null }> = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateIso: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, dateIso });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateIso: null });
    }
    return cells;
  }, [year, month]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  };

  const jumpToday = () => {
    const d = todayIso ? new Date(`${todayIso}T00:00:00Z`) : new Date();
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
    setSelectedDayIso(todayIso);
  };

  const selectedDayEvents = eventsByDate.get(selectedDayIso) ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Card className="lg:col-span-9 dark:border-zinc-800 dark:bg-zinc-900/70">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary" />
            <CardTitle className="text-base">{monthLabel}</CardTitle>
            <div className="ml-2 inline-flex items-center rounded-md border bg-background p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
              <Button size="icon-xs" variant="ghost" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button size="xs" variant="ghost" onClick={jumpToday} className="px-2 text-xs">
                Today
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={() => shiftMonth(1)}>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={kindFilter}
              onChange={(e) =>
                setKindFilter(e.target.value as "ALL" | "task" | "phase" | "project")
              }
              className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="ALL">All Items</option>
              <option value="task">Tasks</option>
              <option value="phase">Phases / Milestones</option>
              <option value="project">Project Deadlines</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-semibold uppercase text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950/60">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y dark:divide-zinc-800">
            {calendarCells.map((cell, idx) => {
              if (!cell.day || !cell.dateIso) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[92px] bg-muted/15 dark:bg-zinc-950/30"
                  />
                );
              }
              const dayEvents = eventsByDate.get(cell.dateIso) ?? [];
              const isToday = cell.dateIso === todayIso;
              const isSelected = cell.dateIso === selectedDayIso;
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => setSelectedDayIso(cell.dateIso!)}
                  className={cn(
                    "flex min-h-[96px] flex-col items-stretch justify-start p-1.5 text-left transition hover:bg-muted/40 dark:hover:bg-zinc-800/40",
                    isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {cell.day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
                          ev.kind === "phase"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : ev.kind === "project"
                              ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                              : "bg-sky-500/15 text-sky-700 dark:text-sky-300",
                        )}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="px-1 text-[9px] font-medium text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Agenda */}
      <Card className="h-fit lg:col-span-3 dark:border-zinc-800 dark:bg-zinc-900/70">
        <CardHeader className="border-b py-3 dark:border-zinc-800">
          <CardTitle className="text-sm font-semibold">
            Schedule · {selectedDayIso || "Select a day"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 p-3">
          {selectedDayEvents.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No tasks or milestones scheduled on this date.
            </p>
          ) : (
            selectedDayEvents.map((ev) => (
              <Link
                key={ev.id}
                href={ev.href}
                className="block rounded-lg border p-2.5 text-xs transition hover:border-primary/40 hover:bg-muted/40 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[9px] uppercase">
                    {ev.kind === "phase" ? (
                      <Flag className="size-2.5 text-amber-500" />
                    ) : ev.kind === "project" ? (
                      <FolderKanban className="size-2.5 text-violet-500" />
                    ) : (
                      <CheckSquare className="size-2.5 text-sky-500" />
                    )}
                    {ev.kind}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{ev.status}</span>
                </div>
                <p className="mt-1 font-semibold text-foreground">{ev.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {ev.projectName}
                  {ev.assigneeName ? ` · ${ev.assigneeName}` : ""}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SyncedChatMessage {
  id: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  projectLabel?: string;
}

export function CollaborationChatTab({
  orgSlug,
  comments,
  projects,
  members,
  canWrite,
}: {
  orgSlug: string;
  comments: CommentDTO[];
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string; email: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [channelProjectId, setChannelProjectId] = React.useState("workspace");
  const [draft, setDraft] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const initialMessages = React.useMemo<SyncedChatMessage[]>(() => {
    return comments
      .filter(
        (c) =>
          !c.body.startsWith("[WIKI]|") &&
          !c.body.startsWith("[FORUM]|") &&
          !c.body.startsWith("[REPLY]|") &&
          !c.body.startsWith("[FDOC]|") &&
          !c.body.startsWith("[FEED_REPLY]|") &&
          !c.body.startsWith("[SUBTASK]|") &&
          !c.body.startsWith("[DEP]|") &&
          !c.body.startsWith("[ATTACH]|"),
      )
      .map((c) => ({
        id: c.id,
        authorName: c.author?.name ?? "Team Member",
        authorAvatarUrl: c.author?.avatarUrl ?? null,
        body: c.body,
        createdAt: c.createdAt,
        projectLabel: c.entityType === "Project" ? c.entityLabel : "General Channel",
      }));
  }, [comments]);

  const [messages, setMessages] = React.useState<SyncedChatMessage[]>(initialMessages);

  React.useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  React.useEffect(() => {
    const onChatSync = (event: Event) => {
      const msg = (event as CustomEvent<SyncedChatMessage>).detail;
      if (!msg) return;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id)
          ? prev
          : [{ ...msg, projectLabel: msg.projectLabel ?? "General Channel" }, ...prev],
      );
    };
    window.addEventListener("bs-chat-sync", onChatSync);
    return () => window.removeEventListener("bs-chat-sync", onChatSync);
  }, []);

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanBody = draft.trim();
    if (!cleanBody) return;
    startTransition(async () => {
      const isWorkspace = channelProjectId === "workspace";
      const res = await postCommentAction({
        orgSlug,
        entityType: isWorkspace ? "Workspace" : "Project",
        entityId: channelProjectId,
        body: cleanBody,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const projName = projects.find((p) => p.id === channelProjectId)?.name ?? "General Channel";
      const newMsg: SyncedChatMessage = {
        id: `live-chat-${Date.now()}`,
        authorName: "You",
        body: cleanBody,
        createdAt: new Date().toISOString(),
        projectLabel: isWorkspace ? "General Channel" : projName,
      };
      setMessages((prev) => [newMsg, ...prev]);
      window.dispatchEvent(new CustomEvent("bs-chat-sync", { detail: newMsg }));
      if (cleanBody.includes("@")) {
        emitWorkspaceNotification({
          kind: "mention",
          actorName: "You",
          title: "New @mention in Team Chat",
          description: cleanBody,
          entityKey: "CHAT",
          projectName: isWorkspace ? null : projName,
          href: `/${orgSlug}/projects/collaboration`,
          badgeLabel: "@Mention",
        });
      }
      setDraft("");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Channels & Participants */}
      <Card className="h-fit lg:col-span-3 dark:border-zinc-800 dark:bg-zinc-900/70">
        <CardHeader className="border-b py-3 dark:border-zinc-800">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-primary" />
            Channels & Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-3">
          <div className="space-y-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Channels
            </p>
            <button
              type="button"
              onClick={() => setChannelProjectId("workspace")}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                channelProjectId === "workspace"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span># general-workspace</span>
            </button>
            {projects.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setChannelProjectId(p.id)}
                className={cn(
                  "flex w-full items-center truncate rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition",
                  channelProjectId === p.id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <span className="truncate"># {p.name}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5 border-t pt-3 dark:border-zinc-800">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Team ({members.length})
            </p>
            {members.slice(0, 8).map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-1 py-1 text-xs">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="truncate font-medium">{m.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Synchronized Chat Feed */}
      <Card className="flex flex-col lg:col-span-9 dark:border-zinc-800 dark:bg-zinc-900/70">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-violet-500" />
            <CardTitle className="text-sm font-semibold">
              {channelProjectId === "workspace"
                ? "# general-workspace"
                : `# ${projects.find((p) => p.id === channelProjectId)?.name ?? "Project"}`}
            </CardTitle>
            <Badge className="bg-emerald-600 text-[10px] text-white">Synced with Dock Chats</Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4 p-4">
          {canWrite && (
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message this channel (synced with bottom utility dock Chats)..."
                className="flex-1"
                required
              />
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Send
              </Button>
            </form>
          )}

          <div className="max-h-[460px] space-y-2.5 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                No chat messages yet. Say hello to your team above.
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <Avatar className="size-7 shrink-0">
                    {msg.authorAvatarUrl && (
                      <AvatarImage src={msg.authorAvatarUrl} alt={msg.authorName} />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {initials(msg.authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{msg.authorName}</span>
                        {msg.projectLabel && (
                          <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
                            {msg.projectLabel}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTimeUtc(msg.createdAt)} UTC
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-foreground/90">{msg.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
