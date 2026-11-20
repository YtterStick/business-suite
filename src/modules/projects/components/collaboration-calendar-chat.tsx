"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flag,
  FolderKanban,
  Hash,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { TactiqMark } from "@/components/brand/tactiq-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const TOPIC_REGEX = /^\[TOPIC:([^\]]+)\]\s*/;

interface SyncedChatMessage {
  id: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  projectId?: string;
  projectName?: string;
  projectLabel?: string;
  topic?: string | null;
}

interface ChatConversationItem {
  key: string;
  title: string;
  projectId: string;
  projectName: string;
  messages: SyncedChatMessage[];
  lastMessageAt: string | null;
}

const AVATAR_TONES = [
  "bg-cyan-500 text-white",
  "bg-violet-500 text-white",
  "bg-indigo-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
];

const CHAT_EMOJIS = ["👍", "🎉", "🚀", "✅", "❤️", "🔥", "👀", "🙌"];

function getConversationTone(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function parseTopicBody(raw: string): { topic: string | null; cleanBody: string } {
  const match = raw.match(TOPIC_REGEX);
  if (!match) return { topic: null, cleanBody: raw };
  return {
    topic: match[1]?.trim() || null,
    cleanBody: raw.slice(match[0].length),
  };
}

function isHiddenStructuredComment(body: string): boolean {
  return (
    body.startsWith("[WIKI]|") ||
    body.startsWith("[FORUM]|") ||
    body.startsWith("[REPLY]|") ||
    body.startsWith("[FDOC]|") ||
    body.startsWith("[FEED_REPLY]|") ||
    body.startsWith("[DOC]") ||
    body.startsWith("[SUBTASK]|") ||
    body.startsWith("[DEP]|") ||
    body.startsWith("[ATTACH]|")
  );
}

function formatMessageTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(11, 16) + " UTC";
}

function formatDateSeparator(iso: string): string {
  if (!iso) return "";
  return formatDateTimeUtc(iso).split(",")[0] ?? iso.slice(0, 10);
}

export function CollaborationChatTab({
  orgSlug,
  comments,
  projects,
  members,
  currentUserName = "You",
  canWrite,
}: {
  orgSlug: string;
  comments: CommentDTO[];
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string; email: string }>;
  currentUserName?: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const projectMap = React.useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const initialMessages = React.useMemo<SyncedChatMessage[]>(() => {
    return comments
      .filter((c) => !isHiddenStructuredComment(c.body))
      .map((c) => {
        const isProj = c.entityType === "Project" && projectMap.has(c.entityId);
        const projId = isProj ? c.entityId : "workspace";
        const projName = isProj
          ? (projectMap.get(c.entityId) ?? c.entityLabel ?? "Project")
          : "General Workspace";
        const parsed = parseTopicBody(c.body);
        return {
          id: c.id,
          authorName: c.author?.name ?? "Team Member",
          authorAvatarUrl: c.author?.avatarUrl ?? null,
          body: parsed.cleanBody,
          createdAt: c.createdAt,
          projectId: projId,
          projectName: projName,
          projectLabel: projName,
          topic: parsed.topic,
        };
      });
  }, [comments, projectMap]);

  const [messages, setMessages] = React.useState<SyncedChatMessage[]>(initialMessages);
  const [customConversations, setCustomConversations] = React.useState<
    Array<{ key: string; title: string; projectId: string }>
  >([]);
  const [activeKey, setActiveKey] = React.useState<string>(() =>
    projects[0] ? `${projects[0].id}::${projects[0].name}` : "workspace::General Workspace",
  );
  const [composerProjectId, setComposerProjectId] = React.useState<string>("workspace");
  const [projectFilter, setProjectFilter] = React.useState<string>("ALL");
  const [channelScope, setChannelScope] = React.useState<"all" | "projects" | "workspace">("all");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [bannerVisible, setBannerVisible] = React.useState(true);
  const [newChatOpen, setNewChatOpen] = React.useState(false);
  const [newChatTitle, setNewChatTitle] = React.useState("");
  const [newChatProjectId, setNewChatProjectId] = React.useState(
    projects[0]?.id ?? "workspace",
  );
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [attachLabel, setAttachLabel] = React.useState("");
  const [attachUrl, setAttachUrl] = React.useState("");
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [appOrigin, setAppOrigin] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const threadBottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setAppOrigin(window.location.origin);
    try {
      const saved = window.localStorage.getItem(`tq_chat_rooms_${orgSlug}`);
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{
          key: string;
          title: string;
          projectId: string;
        }>;
        if (Array.isArray(parsed)) setCustomConversations(parsed);
      }
    } catch {
      // Ignore storage errors
    }
  }, [orgSlug]);

  React.useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  React.useEffect(() => {
    const onChatSync = (event: Event) => {
      const msg = (event as CustomEvent<SyncedChatMessage>).detail;
      if (!msg) return;
      const parsed = parseTopicBody(msg.body);
      const pid = msg.projectId && projectMap.has(msg.projectId) ? msg.projectId : "workspace";
      const pname =
        msg.projectName ??
        msg.projectLabel ??
        (pid === "workspace" ? "General Workspace" : projectMap.get(pid) ?? "Project");
      const normalized: SyncedChatMessage = {
        ...msg,
        body: parsed.cleanBody,
        projectId: pid,
        projectName: pname,
        projectLabel: pname,
        topic: msg.topic ?? parsed.topic,
      };
      setMessages((prev) => (prev.some((m) => m.id === normalized.id) ? prev : [normalized, ...prev]));
    };
    window.addEventListener("bs-chat-sync", onChatSync);
    return () => window.removeEventListener("bs-chat-sync", onChatSync);
  }, [projectMap]);

  const conversations = React.useMemo<ChatConversationItem[]>(() => {
    const map = new Map<string, ChatConversationItem>();

    // Built-in General Workspace channel
    map.set("workspace::General Workspace", {
      key: "workspace::General Workspace",
      title: "General Workspace",
      projectId: "workspace",
      projectName: "Workspace",
      messages: [],
      lastMessageAt: null,
    });

    // Built-in channel per project
    for (const proj of projects) {
      const key = `${proj.id}::${proj.name}`;
      map.set(key, {
        key,
        title: proj.name,
        projectId: proj.id,
        projectName: proj.name,
        messages: [],
        lastMessageAt: null,
      });
    }

    // User-created custom topic rooms
    for (const custom of customConversations) {
      const projName =
        custom.projectId === "workspace"
          ? "Workspace"
          : (projectMap.get(custom.projectId) ?? "Project");
      if (!map.has(custom.key)) {
        map.set(custom.key, {
          key: custom.key,
          title: custom.title,
          projectId: custom.projectId,
          projectName: projName,
          messages: [],
          lastMessageAt: null,
        });
      }
    }

    // Bucket incoming comments into their conversation
    for (const msg of messages) {
      const pid = msg.projectId && projectMap.has(msg.projectId) ? msg.projectId : "workspace";
      const pname =
        pid === "workspace" ? "General Workspace" : (projectMap.get(pid) ?? "Project");
      const convTitle = msg.topic || pname;
      const key = `${pid}::${convTitle}`;
      let conv = map.get(key);
      if (!conv) {
        conv = {
          key,
          title: convTitle,
          projectId: pid,
          projectName: pid === "workspace" ? "Workspace" : pname,
          messages: [],
          lastMessageAt: null,
        };
        map.set(key, conv);
      }
      conv.messages.push(msg);
      if (!conv.lastMessageAt || msg.createdAt > conv.lastMessageAt) {
        conv.lastMessageAt = msg.createdAt;
      }
    }

    // Sort messages chronologically inside each conversation (oldest -> newest)
    const list = Array.from(map.values()).map((conv) => ({
      ...conv,
      messages: [...conv.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }));

    return list.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) {
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      }
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [projects, projectMap, customConversations, messages]);

  const filteredConversations = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (channelScope === "projects" && conv.projectId === "workspace") return false;
      if (channelScope === "workspace" && conv.projectId !== "workspace") return false;
      if (projectFilter !== "ALL" && conv.projectId !== projectFilter) return false;
      if (!q) return true;
      return (
        conv.title.toLowerCase().includes(q) ||
        conv.projectName.toLowerCase().includes(q) ||
        conv.messages.some((m) => m.body.toLowerCase().includes(q))
      );
    });
  }, [conversations, channelScope, projectFilter, searchQuery]);

  const activeConversation =
    conversations.find((c) => c.key === activeKey) ??
    filteredConversations[0] ??
    conversations[0] ?? {
      key: "workspace::General Workspace",
      title: "General Workspace",
      projectId: "workspace",
      projectName: "Workspace",
      messages: [],
      lastMessageAt: null,
    };

  React.useEffect(() => {
    setComposerProjectId(activeConversation.projectId);
    setBannerVisible(true);
  }, [activeConversation.key, activeConversation.projectId]);

  React.useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation.key, activeConversation.messages.length]);

  const handleCreateConversation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = newChatTitle.replace(/[\[\]]/g, "").trim();
    if (!cleanTitle) return;
    const pid = newChatProjectId || "workspace";
    const key = `${pid}::${cleanTitle}`;
    const nextRooms = [
      { key, title: cleanTitle, projectId: pid },
      ...customConversations.filter((r) => r.key !== key),
    ];
    setCustomConversations(nextRooms);
    try {
      window.localStorage.setItem(`tq_chat_rooms_${orgSlug}`, JSON.stringify(nextRooms));
    } catch {
      // Ignore storage errors
    }
    setActiveKey(key);
    setNewChatTitle("");
    setNewChatOpen(false);
    toast.success(`Started conversation "${cleanTitle}"`);
  };

  const handleInsertAttachment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUrl = attachUrl.trim();
    if (!cleanUrl) return;
    const cleanLabel = attachLabel.trim() || cleanUrl;
    const snippet = `📎 ${cleanLabel} — ${cleanUrl}`;
    setDraft((prev) => (prev.trim() ? `${prev.trim()} ${snippet}` : snippet));
    setAttachLabel("");
    setAttachUrl("");
    setAttachOpen(false);
  };

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanBody = draft.trim();
    if (!cleanBody) return;

    const targetProjectId = composerProjectId || activeConversation.projectId || "workspace";
    const isWorkspace = targetProjectId === "workspace";
    const targetProjectName = isWorkspace
      ? "General Workspace"
      : (projectMap.get(targetProjectId) ?? "Project");

    // Preserve custom topic tag unless posting cleanly to the default channel name of the target project
    const defaultChannelTitle = isWorkspace ? "General Workspace" : targetProjectName;
    const isCustomTopic = activeConversation.title !== defaultChannelTitle;
    const storedBody = isCustomTopic
      ? `[TOPIC:${activeConversation.title}] ${cleanBody}`
      : cleanBody;

    const destinationKey = isCustomTopic
      ? `${targetProjectId}::${activeConversation.title}`
      : `${targetProjectId}::${defaultChannelTitle}`;

    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: isWorkspace ? "Workspace" : "Project",
        entityId: targetProjectId,
        body: storedBody,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      const newMsg: SyncedChatMessage = {
        id: `live-chat-${Date.now()}`,
        authorName: currentUserName || "You",
        body: cleanBody,
        createdAt: new Date().toISOString(),
        projectId: targetProjectId,
        projectName: targetProjectName,
        projectLabel: targetProjectName,
        topic: isCustomTopic ? activeConversation.title : null,
      };
      setMessages((prev) => [...prev, newMsg]);
      if (destinationKey !== activeConversation.key) {
        setActiveKey(destinationKey);
      }
      window.dispatchEvent(new CustomEvent("bs-chat-sync", { detail: newMsg }));

      if (cleanBody.includes("@")) {
        emitWorkspaceNotification({
          kind: "mention",
          actorName: currentUserName || "You",
          title: "New @mention in Team Chat",
          description: cleanBody,
          entityKey: "CHAT",
          projectName: isWorkspace ? null : targetProjectName,
          href: `/${orgSlug}/projects/collaboration`,
          badgeLabel: "@Mention",
        });
      }
      setDraft("");
      router.refresh();
    });
  };

  const targetBannerProjectId =
    composerProjectId !== "workspace"
      ? composerProjectId
      : activeConversation.projectId !== "workspace"
        ? activeConversation.projectId
        : null;
  const targetBannerProjectName = targetBannerProjectId
    ? (projectMap.get(targetBannerProjectId) ?? activeConversation.projectName)
    : "General Workspace";
  const dashboardPath = targetBannerProjectId
    ? `/${orgSlug}/projects/${targetBannerProjectId}#dashboard`
    : `/${orgSlug}/projects#dashboard`;
  const displayDashboardUrl = appOrigin ? `${appOrigin}${dashboardPath}` : dashboardPath;

  return (
    <>
      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border bg-card shadow-xs lg:h-[calc(100dvh-16rem)] lg:flex-row dark:border-zinc-800 dark:bg-zinc-900/80">
        {/* Left Conversation Rail (Zoho Chat Sidebar) */}
        <aside className="flex w-full shrink-0 flex-col border-b bg-muted/15 lg:w-72 lg:border-r lg:border-b-0 dark:border-zinc-800">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold tracking-tight">Chat</h2>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Search conversations"
                onClick={() => setSearchOpen((v) => !v)}
                className={cn(searchOpen && "bg-accent text-foreground")}
              >
                <Search className="size-3.5" />
              </Button>
              {canWrite && (
                <Button
                  type="button"
                  size="icon-xs"
                  aria-label="New conversation"
                  title="New conversation with project"
                  onClick={() => {
                    setNewChatProjectId(
                      activeConversation.projectId !== "workspace"
                        ? activeConversation.projectId
                        : (projects[0]?.id ?? "workspace"),
                    );
                    setNewChatOpen(true);
                  }}
                  className="size-6 rounded-full"
                >
                  <Plus className="size-3.5" />
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Chat options">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs">Show Channels</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setChannelScope("all")} className="text-xs">
                    <Check
                      className={cn(
                        "size-3.5",
                        channelScope === "all" ? "opacity-100" : "opacity-0",
                      )}
                    />
                    All Conversations
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setChannelScope("projects")} className="text-xs">
                    <Check
                      className={cn(
                        "size-3.5",
                        channelScope === "projects" ? "opacity-100" : "opacity-0",
                      )}
                    />
                    Project Channels
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setChannelScope("workspace")}
                    className="text-xs"
                  >
                    <Check
                      className={cn(
                        "size-3.5",
                        channelScope === "workspace" ? "opacity-100" : "opacity-0",
                      )}
                    />
                    General Workspace
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {searchOpen && (
            <div className="border-b px-3 py-2 dark:border-zinc-800">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversation or project..."
                className="h-8 text-xs"
                autoFocus
              />
            </div>
          )}

          {/* Conversation Sub-header + Project Filter */}
          <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2 dark:border-zinc-800">
            <span className="text-xs font-medium text-muted-foreground">Conversation</span>
            <select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="max-w-[140px] truncate rounded-md border border-input bg-background px-2 py-0.5 text-[11px] font-medium"
            >
              <option value="ALL">All Projects</option>
              <option value="workspace">General Workspace</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Conversations List */}
          <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
            {filteredConversations.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No conversations match your filter.
              </p>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.key === activeConversation.key;
                const lastMsg = conv.messages[conv.messages.length - 1];
                const showProjectSub =
                  conv.projectId !== "workspace" && conv.title !== conv.projectName;
                return (
                  <button
                    key={conv.key}
                    type="button"
                    onClick={() => setActiveKey(conv.key)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                      isSelected
                        ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "text-foreground/85 hover:bg-muted/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase shadow-2xs",
                        getConversationTone(conv.key),
                      )}
                    >
                      {conv.title.charAt(0) || "C"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-semibold">{conv.title}</p>
                        {lastMsg && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatMessageTime(lastMsg.createdAt).replace(" UTC", "")}
                          </span>
                        )}
                      </div>
                      {showProjectSub && (
                        <p className="flex items-center gap-1 truncate text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                          <FolderKanban className="size-2.5 shrink-0" />
                          <span className="truncate">{conv.projectName}</span>
                        </p>
                      )}
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {lastMsg
                          ? `${lastMsg.authorName.split(" ")[0]}: ${lastMsg.body}`
                          : conv.projectId === "workspace"
                            ? "Workspace channel"
                            : "Project conversation"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Active Members Footer */}
          <div className="hidden border-t px-3.5 py-2 lg:flex lg:items-center lg:justify-between dark:border-zinc-800">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              {members.length} team member{members.length === 1 ? "" : "s"}
            </span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
              Synced with Dock
            </Badge>
          </div>
        </aside>

        {/* Right Conversation Thread Pane */}
        <section className="flex min-w-0 flex-1 flex-col bg-background">
          {/* Zoho-Style Linked Project Context Banner */}
          {bannerVisible ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-50/75 px-4 py-2.5 dark:border-zinc-800 dark:bg-amber-950/20">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-white shadow-2xs dark:bg-zinc-900">
                  <TactiqMark className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {activeConversation.title}
                    </p>
                    {targetBannerProjectId && (
                      <Badge variant="outline" className="hidden px-1.5 py-0 text-[10px] sm:inline-flex">
                        {targetBannerProjectName}
                      </Badge>
                    )}
                  </div>
                  <Link
                    href={dashboardPath}
                    className="flex items-center gap-1 truncate text-[11px] text-muted-foreground hover:text-primary hover:underline"
                  >
                    <span className="truncate">{displayDashboardUrl}</span>
                    <ExternalLink className="size-2.5 shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
                  <FolderKanban className="size-3.5 shrink-0 text-violet-600" />
                  <select
                    aria-label="Conversation project"
                    value={composerProjectId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setComposerProjectId(nextId);
                      if (
                        activeConversation.projectId === "workspace" ||
                        activeConversation.title === activeConversation.projectName
                      ) {
                        const nextName =
                          nextId === "workspace"
                            ? "General Workspace"
                            : (projectMap.get(nextId) ?? "Project");
                        setActiveKey(`${nextId}::${nextName}`);
                      }
                    }}
                    className="max-w-[160px] truncate bg-transparent text-xs font-medium outline-none"
                  >
                    <option value="workspace">General Workspace</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Hide banner"
                  onClick={() => setBannerVisible(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b px-4 py-2 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Hash className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">{activeConversation.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Select project"
                  value={composerProjectId}
                  onChange={(e) => setComposerProjectId(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value="workspace">General Workspace</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setBannerVisible(true)}
                  className="text-[11px]"
                >
                  Show Info
                </Button>
              </div>
            </div>
          )}

          {/* Chronological Conversation Stream */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {activeConversation.messages.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                  <MessageSquare className="size-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">
                  No messages in {activeConversation.title} yet
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Start the conversation below — every message stays linked to{" "}
                  <span className="font-medium text-foreground">{targetBannerProjectName}</span> and
                  syncs with Dock Chats.
                </p>
              </div>
            ) : (
              activeConversation.messages.map((msg, idx) => {
                const isOwn = msg.authorName === currentUserName || msg.authorName === "You";
                const prev = idx > 0 ? activeConversation.messages[idx - 1] : null;
                const currentDay = formatDateSeparator(msg.createdAt);
                const prevDay = prev ? formatDateSeparator(prev.createdAt) : null;
                const showDateHeader = currentDay !== prevDay;
                const sameSenderAsPrev =
                  !showDateHeader && prev?.authorName === msg.authorName;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateHeader && currentDay && (
                      <div className="my-2 flex items-center justify-center">
                        <span className="rounded-full border bg-muted/50 px-3 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {currentDay}
                        </span>
                      </div>
                    )}

                    <div
                      className={cn(
                        "flex items-end gap-2",
                        isOwn ? "justify-end" : "justify-start",
                        sameSenderAsPrev ? "mt-0.5" : "mt-3",
                      )}
                    >
                      {!isOwn &&
                        (sameSenderAsPrev ? (
                          <div className="w-7 shrink-0" />
                        ) : (
                          <Avatar className="size-7 shrink-0">
                            {msg.authorAvatarUrl && (
                              <AvatarImage src={msg.authorAvatarUrl} alt={msg.authorName} />
                            )}
                            <AvatarFallback className="text-[10px]">
                              {initials(msg.authorName)}
                            </AvatarFallback>
                          </Avatar>
                        ))}

                      <div
                        className={cn(
                          "flex max-w-[78%] flex-col gap-1",
                          isOwn ? "items-end" : "items-start",
                        )}
                      >
                        {!sameSenderAsPrev && (
                          <div className="flex items-center gap-1.5 px-1 text-[11px]">
                            <span className="font-semibold text-foreground">
                              {isOwn ? "You" : msg.authorName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs",
                            isOwn
                              ? "rounded-br-sm bg-indigo-600 text-white"
                              : "rounded-bl-sm border bg-muted/60 text-foreground dark:border-zinc-800 dark:bg-zinc-900",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={threadBottomRef} />
          </div>

          {/* Zoho-Style Rounded Composer Bar */}
          {canWrite && (
            <div className="border-t bg-background px-4 py-3 dark:border-zinc-800">
              <form
                onSubmit={handleSend}
                className="flex items-center gap-1.5 rounded-xl border border-input bg-muted/20 px-2 py-1.5 shadow-2xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40 dark:bg-zinc-950/60"
              >
                <Popover open={attachOpen} onOpenChange={setAttachOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Attach link"
                      title="Attach file or link"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Paperclip className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-3">
                    <form onSubmit={handleInsertAttachment} className="space-y-2.5">
                      <p className="text-xs font-semibold">Attach Link / Deliverable</p>
                      <Input
                        value={attachLabel}
                        onChange={(e) => setAttachLabel(e.target.value)}
                        placeholder="File or link title (optional)"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="url"
                        value={attachUrl}
                        onChange={(e) => setAttachUrl(e.target.value)}
                        placeholder="https://..."
                        className="h-8 text-xs"
                        required
                      />
                      <div className="flex justify-end">
                        <Button type="submit" size="xs">
                          Insert Link
                        </Button>
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>

                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message in ${activeConversation.title}...`}
                  required
                  className="min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground"
                />

                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Insert emoji"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Smile className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-2">
                    <div className="flex items-center gap-1">
                      {CHAT_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setDraft((prev) => `${prev}${emoji}`);
                            setEmojiOpen(false);
                          }}
                          className="rounded-md p-1.5 text-base transition hover:bg-muted"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !draft.trim()}
                  className="h-7 gap-1 px-3 text-xs"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </form>
            </div>
          )}
        </section>
      </div>

      {/* New Project Conversation Dialog */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              New Conversation
            </DialogTitle>
            <DialogDescription>
              Create a dedicated chat channel and link it to a Project.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateConversation} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-chat-project">Project</Label>
              <select
                id="new-chat-project"
                value={newChatProjectId}
                onChange={(e) => setNewChatProjectId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="workspace">General Workspace</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-chat-title">Conversation Name</Label>
              <Input
                id="new-chat-title"
                value={newChatTitle}
                onChange={(e) => setNewChatTitle(e.target.value)}
                placeholder="e.g. Design Review, Sprint 4 QA, Client Updates"
                required
                minLength={2}
                maxLength={60}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewChatOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Start Conversation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
