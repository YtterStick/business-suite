"use client";

import * as React from "react";
import {
  Activity,
  BellRing,
  Briefcase,
  Bug,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Flag,
  FolderKanban,
  HelpCircle,
  History,
  Keyboard,
  Laptop,
  Loader2,
  MessageCircle,
  MessageSquare,
  Moon,
  Pause,
  Pin,
  PinOff,
  Play,
  Plus,
  Receipt,
  Send,
  Square,
  StickyNote,
  Sun,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTimeUtc, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createTimeLogAction, postCommentAction } from "@/modules/projects/projects.actions";

export interface BottomBarProjectOption {
  id: string;
  name: string;
}

export interface BottomBarContactItem {
  id: string;
  fullName: string;
  email: string | null;
  companyName: string | null;
  lifecycleStage: string;
}

export interface BottomBarChatItem {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

interface PinnedRoute {
  label: string;
  href: string;
}

interface RecentRouteEntry {
  label: string;
  href: string;
  visitedAt: string;
}

interface ReminderEntry {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
}

interface BackgroundTaskItem {
  id: string;
  label: string;
  progress: number;
  status: "running" | "completed" | "failed";
  updatedAt: string;
}

interface StickyNoteEntry {
  id: string;
  text: string;
  color: "amber" | "violet" | "emerald" | "sky";
  updatedAt: string;
}

type UtilityPanel = "pins" | "chats" | "live-chat" | "contacts" | "timer" | null;

function formatElapsed(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

export function SuiteBottomBar({
  orgSlug,
  todayIso,
  projects,
  contacts,
  recentChats,
  canWriteProjects,
  canLogTime,
  canViewContacts = true,
}: {
  orgSlug: string;
  todayIso: string;
  projects: BottomBarProjectOption[];
  contacts: BottomBarContactItem[];
  recentChats: BottomBarChatItem[];
  canWriteProjects: boolean;
  canLogTime?: boolean;
  canViewContacts?: boolean;
}) {
  const allowTimer = canLogTime ?? canWriteProjects;
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [activePanel, setActivePanel] = React.useState<UtilityPanel>(null);
  const [bgTasks, setBgTasks] = React.useState<BackgroundTaskItem[]>([]);
  const [stickyNotes, setStickyNotes] = React.useState<StickyNoteEntry[]>([]);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [noteColor, setNoteColor] = React.useState<StickyNoteEntry["color"]>("amber");
  const [timerTaskId, setTimerTaskId] = React.useState<string | null>(null);
  const [timerTaskKey, setTimerTaskKey] = React.useState<string | null>(null);
  const [timerTaskLabel, setTimerTaskLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const savedNotes = window.localStorage.getItem(`bs_sticky_notes_${orgSlug}`);
      if (savedNotes) {
        const parsed = JSON.parse(savedNotes) as StickyNoteEntry[];
        if (Array.isArray(parsed)) setStickyNotes(parsed);
      }
      const savedTimer = window.localStorage.getItem(`bs_timer_${orgSlug}`);
      if (savedTimer) {
        const t = JSON.parse(savedTimer) as {
          running?: boolean;
          startedAtMs?: number;
          elapsed?: number;
          projectId?: string;
          taskId?: string | null;
          taskKey?: string | null;
          taskLabel?: string | null;
          notes?: string;
        };
        if (t.projectId) setTimerProjectId(t.projectId);
        if (t.taskId !== undefined) setTimerTaskId(t.taskId);
        if (t.taskKey !== undefined) setTimerTaskKey(t.taskKey);
        if (t.taskLabel !== undefined) setTimerTaskLabel(t.taskLabel);
        if (t.notes) setTimerNotes(t.notes);
        const extraSec =
          t.running && t.startedAtMs
            ? Math.max(0, Math.floor((Date.now() - t.startedAtMs) / 1000))
            : 0;
        setElapsedSeconds((t.elapsed ?? 0) + extraSec);
        if (t.running) setTimerRunning(true);
      }
    } catch {
      // Ignore
    }
  }, [orgSlug]);

  const persistStickyNotes = (next: StickyNoteEntry[]) => {
    setStickyNotes(next);
    try {
      window.localStorage.setItem(`bs_sticky_notes_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const handleAddStickyNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = noteDraft.trim();
    if (!clean) return;
    persistStickyNotes([
      {
        id: `${Date.now()}`,
        text: clean,
        color: noteColor,
        updatedAt: todayIso,
      },
      ...stickyNotes,
    ]);
    setNoteDraft("");
    toast.success("Sticky note saved");
  };

  React.useEffect(() => {
    const onBgTask = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id: string;
          label: string;
          progress: number;
          status: "running" | "completed" | "failed";
        }>
      ).detail;
      if (!detail?.id) return;
      const nowTime = new Date().toISOString().slice(11, 16) + " UTC";
      setBgTasks((prev) => {
        const exists = prev.some((t) => t.id === detail.id);
        if (exists) {
          return prev.map((t) =>
            t.id === detail.id
              ? {
                  ...t,
                  label: detail.label,
                  progress: detail.progress,
                  status: detail.status,
                  updatedAt: nowTime,
                }
              : t,
          );
        }
        return [
          {
            id: detail.id,
            label: detail.label,
            progress: detail.progress,
            status: detail.status,
            updatedAt: nowTime,
          },
          ...prev,
        ].slice(0, 10);
      });
    };
    window.addEventListener("bs-bg-task", onBgTask);
    return () => window.removeEventListener("bs-bg-task", onBgTask);
  }, []);

  const activeRunningTask = bgTasks.find((t) => t.status === "running") ?? null;
  const dockProgressPercent = activeRunningTask ? activeRunningTask.progress : 0;

  const triggerDockQuickAdd = (href: string, quickEventKey?: string) => {
    if (quickEventKey) {
      window.dispatchEvent(new CustomEvent("bs-quick-add", { detail: quickEventKey }));
    }
    router.push(href);
  };

  // My Pins (persisted in localStorage per org)
  const defaultPins = React.useMemo<PinnedRoute[]>(
    () =>
      canViewContacts
        ? [
            { label: "CRM Deal Pipeline", href: `/${orgSlug}/crm/deals` },
            { label: "Finance Invoices", href: `/${orgSlug}/finance/invoices` },
            { label: "Projects", href: `/${orgSlug}/projects` },
            { label: "Weekly Timesheets", href: `/${orgSlug}/projects/timesheets` },
          ]
        : [
            { label: "Projects", href: `/${orgSlug}/projects` },
            { label: "Task Board", href: `/${orgSlug}/projects/tasks` },
            { label: "Issues & Bugs", href: `/${orgSlug}/projects/issues` },
            { label: "Collaboration", href: `/${orgSlug}/projects/collaboration` },
          ],
    [orgSlug, canViewContacts],
  );
  const [pins, setPins] = React.useState<PinnedRoute[]>(defaultPins);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`bs_pins_${orgSlug}`);
      if (stored) {
        const parsed = JSON.parse(stored) as PinnedRoute[];
        if (Array.isArray(parsed) && parsed.length > 0) setPins(parsed);
      }
    } catch {
      // Ignore storage read errors
    }
  }, [orgSlug]);

  const updatePins = (next: PinnedRoute[]) => {
    setPins(next);
    try {
      window.localStorage.setItem(`bs_pins_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore storage write errors
    }
  };

  const isCurrentPinned = pins.some((p) => p.href === pathname);

  const togglePinCurrent = () => {
    if (isCurrentPinned) {
      updatePins(pins.filter((p) => p.href !== pathname));
      toast.success("Unpinned current page");
    } else {
      const label = pathname.split("/").slice(-2).join(" / ") || "Page";
      updatePins([...pins, { label, href: pathname }]);
      toast.success("Pinned current page to My Pins");
    }
  };

  // Contacts search
  const [contactSearch, setContactSearch] = React.useState("");
  const filteredContacts = React.useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.companyName?.toLowerCase().includes(q) ?? false),
    );
  }, [contacts, contactSearch]);

  // Quick Chats (synchronized with Collaboration Chat tab)
  const [chatMessage, setChatMessage] = React.useState("");
  const [localChats, setLocalChats] = React.useState<BottomBarChatItem[]>(recentChats);
  const [isSendingChat, startChatTransition] = React.useTransition();

  React.useEffect(() => {
    setLocalChats(recentChats);
  }, [recentChats]);

  React.useEffect(() => {
    const onChatSync = (event: Event) => {
      const msg = (event as CustomEvent<BottomBarChatItem>).detail;
      if (!msg) return;
      setLocalChats((prev) =>
        prev.some((c) => c.id === msg.id) ? prev : [msg, ...prev],
      );
    };
    window.addEventListener("bs-chat-sync", onChatSync);
    return () => window.removeEventListener("bs-chat-sync", onChatSync);
  }, []);

  const handleSendChat = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanBody = chatMessage.trim();
    if (!cleanBody) return;
    startChatTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: "Workspace",
        entityId: "workspace",
        body: cleanBody,
      });
      if (!res.ok) toast.error(res.error.message);
      else {
        const synced: BottomBarChatItem = {
          id: `live-chat-${Date.now()}`,
          authorName: "You",
          body: cleanBody,
          createdAt: new Date().toISOString(),
        };
        setLocalChats((prev) => [synced, ...prev]);
        window.dispatchEvent(new CustomEvent<BottomBarChatItem>("bs-chat-sync", { detail: synced }));
        setChatMessage("");
        toast.success("Message posted to Collaboration Chat");
        router.refresh();
      }
    });
  };

  // Stopwatch Timer / Time Log widget
  const [timerRunning, setTimerRunning] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [timerProjectId, setTimerProjectId] = React.useState(projects[0]?.id ?? "");
  const [timerNotes, setTimerNotes] = React.useState("");
  const [isLoggingTime, startTimeTransition] = React.useTransition();

  // Right utility popovers: Recent Items, Reminders, Keyboard Shortcuts (?)
  const [recentItems, setRecentItems] = React.useState<RecentRouteEntry[]>(() => [
    { label: "Projects Directory", href: `/${orgSlug}/projects`, visitedAt: todayIso },
    { label: "Users & Directory", href: `/${orgSlug}/projects/users`, visitedAt: todayIso },
    ...projects.slice(0, 2).map((p) => ({
      label: `Project: ${p.name}`,
      href: `/${orgSlug}/projects/${p.id}`,
      visitedAt: todayIso,
    })),
  ]);
  const [reminders, setReminders] = React.useState<ReminderEntry[]>([]);
  const [reminderTitle, setReminderTitle] = React.useState("");
  const [reminderDue, setReminderDue] = React.useState(todayIso);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const savedRecent = window.localStorage.getItem(`bs_recent_${orgSlug}`);
      if (savedRecent) {
        const parsed = JSON.parse(savedRecent);
        if (Array.isArray(parsed) && parsed.length > 0) setRecentItems(parsed);
      }
      const savedRem = window.localStorage.getItem(`bs_reminders_${orgSlug}`);
      if (savedRem) {
        const parsed = JSON.parse(savedRem);
        if (Array.isArray(parsed)) setReminders(parsed);
      }
    } catch {
      // Ignore storage read errors
    }
  }, [orgSlug]);

  React.useEffect(() => {
    if (!pathname) return;
    const rawSeg = pathname.split("/").slice(-2).join(" / ") || "Workspace";
    const matchedProj = projects.find((p) => pathname.endsWith(`/${p.id}`));
    const label = matchedProj ? `Project: ${matchedProj.name}` : rawSeg;
    setRecentItems((prev) => {
      const next: RecentRouteEntry[] = [
        { label, href: pathname, visitedAt: todayIso },
        ...prev.filter((item) => item.href !== pathname),
      ].slice(0, 8);
      try {
        window.localStorage.setItem(`bs_recent_${orgSlug}`, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, [pathname, orgSlug, todayIso, projects]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const persistReminders = (next: ReminderEntry[]) => {
    setReminders(next);
    try {
      window.localStorage.setItem(`bs_reminders_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore storage write errors
    }
  };

  const handleAddReminder = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = reminderTitle.trim();
    if (!clean) return;
    persistReminders([
      { id: `${Date.now()}`, title: clean, dueDate: reminderDue || todayIso, done: false },
      ...reminders,
    ]);
    setReminderTitle("");
    toast.success("Reminder added");
  };

  React.useEffect(() => {
    const onToggleTaskTimer = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          projectId: string;
          taskId: string;
          taskTitle: string;
          taskKey?: string;
        }>
      ).detail;
      if (!detail?.taskId) return;
      if (timerRunning && timerTaskId === detail.taskId) {
        setTimerRunning(false);
        setActivePanel("timer");
        toast.info(`Stopped timer for ${detail.taskKey ?? detail.taskTitle} — ready to save`);
      } else {
        setTimerProjectId(detail.projectId);
        setTimerTaskId(detail.taskId);
        setTimerTaskKey(detail.taskKey ?? null);
        setTimerTaskLabel(detail.taskKey ? `${detail.taskKey}: ${detail.taskTitle}` : detail.taskTitle);
        setTimerNotes(detail.taskKey ? `[${detail.taskKey}] ${detail.taskTitle}` : detail.taskTitle);
        setTimerRunning(true);
        toast.success(`Live timer started for ${detail.taskKey ?? detail.taskTitle}`);
      }
    };
    window.addEventListener("bs-toggle-task-timer", onToggleTaskTimer);
    return () => window.removeEventListener("bs-toggle-task-timer", onToggleTaskTimer);
  }, [timerRunning, timerTaskId]);

  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("bs-timer-state", {
        detail: { running: timerRunning, taskId: timerTaskId, elapsedSeconds },
      }),
    );
    try {
      window.localStorage.setItem(
        `bs_timer_${orgSlug}`,
        JSON.stringify({
          running: timerRunning,
          startedAtMs: timerRunning ? Date.now() : null,
          elapsed: elapsedSeconds,
          projectId: timerProjectId,
          taskId: timerTaskId,
          taskKey: timerTaskKey,
          taskLabel: timerTaskLabel,
          notes: timerNotes,
        }),
      );
    } catch {
      // Ignore
    }
  }, [
    orgSlug,
    timerRunning,
    timerTaskId,
    timerTaskKey,
    timerTaskLabel,
    timerProjectId,
    timerNotes,
    elapsedSeconds,
  ]);

  React.useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const handleLogTrackedTime = () => {
    if (!timerProjectId) {
      toast.error("Create or select a project first.");
      return;
    }
    const hours = Math.max(0.25, Math.round((elapsedSeconds / 3600) * 4) / 4);
    startTimeTransition(async () => {
      const resolvedTaskId =
        timerTaskId && !timerTaskId.startsWith("issue:") ? timerTaskId : null;
      const res = await createTimeLogAction({
        orgSlug,
        projectId: timerProjectId,
        taskId: resolvedTaskId,
        hours,
        billable: true,
        loggedDate: todayIso,
        notes:
          timerNotes.trim() ||
          (timerTaskLabel
            ? `${timerTaskLabel} — Logged via timer (${formatElapsed(elapsedSeconds)})`
            : `Logged via bottom timer (${formatElapsed(elapsedSeconds)})`),
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTimerRunning(false);
      setElapsedSeconds(0);
      setTimerNotes("");
      setTimerTaskId(null);
      setTimerTaskKey(null);
      setTimerTaskLabel(null);
      setActivePanel(null);
      try {
        window.localStorage.removeItem(`bs_timer_${orgSlug}`);
      } catch {
        // Ignore
      }
      toast.success(`Logged ${hours.toFixed(2)}h to Time Logs`);
    });
  };

  return (
    <>
      <footer
        aria-label="Workspace utility bar"
        className="flex h-9 shrink-0 items-center justify-between gap-2 overflow-x-auto border-t bg-background px-2.5 text-xs whitespace-nowrap text-muted-foreground lg:px-4"
      >
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            title="My Pins"
            onClick={() => setActivePanel(activePanel === "pins" ? null : "pins")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-medium whitespace-nowrap transition hover:bg-accent hover:text-foreground",
              activePanel === "pins" && "bg-accent text-foreground",
            )}
          >
            <Pin className="size-3.5 shrink-0 text-amber-600" />
            <span className="hidden sm:inline">My Pins</span>
            <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
              {pins.length}
            </Badge>
          </button>

          <button
            type="button"
            title="Team Chats"
            onClick={() => setActivePanel(activePanel === "chats" ? null : "chats")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-medium whitespace-nowrap transition hover:bg-accent hover:text-foreground",
              activePanel === "chats" && "bg-accent text-foreground",
            )}
          >
            <MessageSquare className="size-3.5 shrink-0 text-violet-600" />
            <span className="hidden md:inline">Chats</span>
            {localChats.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                {localChats.length}
              </Badge>
            )}
          </button>

          <button
            type="button"
            title="Live Chat"
            onClick={() => setActivePanel(activePanel === "live-chat" ? null : "live-chat")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-medium whitespace-nowrap transition hover:bg-accent hover:text-foreground",
              activePanel === "live-chat" && "bg-accent text-foreground",
            )}
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <MessageCircle className="size-3.5 shrink-0 text-emerald-600" />
            <span className="hidden lg:inline">Live Chat</span>
          </button>

          {canViewContacts && (
            <button
              type="button"
              title="CRM Contacts"
              onClick={() => setActivePanel(activePanel === "contacts" ? null : "contacts")}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-medium whitespace-nowrap transition hover:bg-accent hover:text-foreground",
                activePanel === "contacts" && "bg-accent text-foreground",
              )}
            >
              <Users className="size-3.5 shrink-0 text-blue-600" />
              <span className="hidden lg:inline">Contacts</span>
              <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                {contacts.length}
              </Badge>
            </button>
          )}

          {/* Sticky Notes Quick-Pad Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Sticky Notes"
                title="Sticky Notes"
                className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-medium whitespace-nowrap transition hover:bg-accent hover:text-foreground"
              >
                <StickyNote className="size-3.5 shrink-0 text-amber-500" />
                <span className="hidden xl:inline">Notes</span>
                {stickyNotes.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                    {stickyNotes.length}
                  </Badge>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-80 p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="text-xs font-semibold">Sticky Notes</p>
                    <p className="text-[10px] text-muted-foreground">
                      Quick scratchpad persisted across sessions.
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(["amber", "violet", "emerald", "sky"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Select ${c} note color`}
                        onClick={() => setNoteColor(c)}
                        className={cn(
                          "size-3.5 rounded-full border transition",
                          c === "amber" && "bg-amber-400",
                          c === "violet" && "bg-violet-400",
                          c === "emerald" && "bg-emerald-400",
                          c === "sky" && "bg-sky-400",
                          noteColor === c && "ring-2 ring-foreground ring-offset-1",
                        )}
                      />
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddStickyNote} className="flex gap-1.5">
                  <Input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Jot down a quick note..."
                    className="h-7 flex-1 text-xs"
                  />
                  <Button type="submit" size="icon-xs" variant="outline" title="Add note">
                    <Plus className="size-3.5" />
                  </Button>
                </form>

                <div className="max-h-52 space-y-1.5 overflow-y-auto">
                  {stickyNotes.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-muted-foreground">
                      No sticky notes yet.
                    </p>
                  ) : (
                    stickyNotes.map((note) => (
                      <div
                        key={note.id}
                        className={cn(
                          "flex items-start justify-between gap-2 rounded-md border p-2 text-xs whitespace-normal",
                          note.color === "amber" &&
                            "border-amber-500/30 bg-amber-500/10 text-foreground",
                          note.color === "violet" &&
                            "border-violet-500/30 bg-violet-500/10 text-foreground",
                          note.color === "emerald" &&
                            "border-emerald-500/30 bg-emerald-500/10 text-foreground",
                          note.color === "sky" &&
                            "border-sky-500/30 bg-sky-500/10 text-foreground",
                        )}
                      >
                        <p className="flex-1 leading-relaxed">{note.text}</p>
                        <button
                          type="button"
                          aria-label="Delete note"
                          onClick={() =>
                            persistStickyNotes(stickyNotes.filter((n) => n.id !== note.id))
                          }
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right: Recent, Reminders, Quick Add, Theme, Shortcuts (?), Background Tasks (0%), Timer */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Recent Items Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Recent items"
                title="Recent Items"
                className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 whitespace-nowrap text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <History className="size-3.5 shrink-0" />
                <span className="hidden xl:inline">Recent</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-72 p-0">
              <div className="border-b px-3 py-2.5">
                <p className="text-xs font-semibold">Recent Items</p>
                <p className="text-[11px] text-muted-foreground">Jump back to recently visited views.</p>
              </div>
              <div className="max-h-64 divide-y overflow-y-auto">
                {recentItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/50"
                  >
                    <span className="truncate font-medium">{item.label}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {item.visitedAt}
                    </span>
                  </Link>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Reminders Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Reminders"
                title="Reminders"
                className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 whitespace-nowrap text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <BellRing className="size-3.5 shrink-0" />
                <span className="hidden xl:inline">Reminders</span>
                {reminders.filter((r) => !r.done).length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                    {reminders.filter((r) => !r.done).length}
                  </Badge>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-80 p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold">Personal Reminders</p>
                  <p className="text-[11px] text-muted-foreground">
                    Quick follow-ups saved across your workspace session.
                  </p>
                </div>

                <form onSubmit={handleAddReminder} className="flex gap-1.5">
                  <Input
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder="Follow up with client..."
                    className="h-7 flex-1 text-xs"
                  />
                  <Input
                    type="date"
                    value={reminderDue}
                    onChange={(e) => setReminderDue(e.target.value)}
                    className="h-7 w-28 px-1.5 text-[11px]"
                  />
                  <Button type="submit" size="icon-xs" variant="outline" title="Add reminder">
                    <Plus className="size-3.5" />
                  </Button>
                </form>

                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {reminders.length === 0 ? (
                    <p className="py-3 text-center text-[11px] text-muted-foreground">
                      No reminders yet.
                    </p>
                  ) : (
                    reminders.map((rem) => (
                      <div
                        key={rem.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            persistReminders(
                              reminders.map((r) =>
                                r.id === rem.id ? { ...r, done: !r.done } : r,
                              ),
                            )
                          }
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border",
                              rem.done
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-input",
                            )}
                          >
                            {rem.done && <Check className="size-3" />}
                          </span>
                          <span
                            className={cn(
                              "truncate",
                              rem.done && "text-muted-foreground line-through",
                            )}
                          >
                            {rem.title}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label="Delete reminder"
                          onClick={() =>
                            persistReminders(reminders.filter((r) => r.id !== rem.id))
                          }
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Quick Add (+) Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Quick add item"
                title="Quick Add (+)"
                className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-medium whitespace-nowrap text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5 shrink-0 text-primary" />
                <span className="hidden 2xl:inline">Quick Add</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-52">
              <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => triggerDockQuickAdd(`/${orgSlug}/projects?new=1`, "projects")}
              >
                <FolderKanban className="size-3.5 text-violet-600" />
                New Project
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => triggerDockQuickAdd(`/${orgSlug}/projects/tasks?new=1`, "tasks")}
              >
                <CheckSquare className="size-3.5 text-blue-600" />
                New Task
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => triggerDockQuickAdd(`/${orgSlug}/projects/issues?new=1`, "issues")}
              >
                <Bug className="size-3.5 text-rose-600" />
                New Issue
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  triggerDockQuickAdd(`/${orgSlug}/projects/milestones?new=1`, "milestones")
                }
              >
                <Flag className="size-3.5 text-amber-600" />
                New Phase / Milestone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActivePanel("timer")}>
                <Clock className="size-3.5 text-emerald-600" />
                Log Time
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => triggerDockQuickAdd(`/${orgSlug}/crm/deals`)}>
                <Briefcase className="size-3.5 text-blue-600" />
                New CRM Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerDockQuickAdd(`/${orgSlug}/finance/invoices`)}>
                <Receipt className="size-3.5 text-emerald-600" />
                New Finance Invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme / Dark Mode Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Toggle theme"
                title="Switch Theme (Light / Dark / System)"
                className="relative inline-flex shrink-0 items-center justify-center rounded px-1.5 py-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Sun className="size-3.5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                <Moon className="absolute size-3.5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-36">
              <DropdownMenuLabel className="text-xs">Theme</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTheme("light")} className="gap-2 text-xs">
                <Sun className="size-3.5" />
                <span>Light</span>
                {theme === "light" && <span className="ml-auto text-primary">●</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme("dark")} className="gap-2 text-xs">
                <Moon className="size-3.5" />
                <span>Dark</span>
                {theme === "dark" && <span className="ml-auto text-primary">●</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme("system")} className="gap-2 text-xs">
                <Laptop className="size-3.5" />
                <span>System</span>
                {theme === "system" && <span className="ml-auto text-primary">●</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Keyboard Shortcuts (?) Modal Trigger */}
          <button
            type="button"
            aria-label="Keyboard Shortcuts"
            title="Keyboard Shortcuts (?)"
            onClick={() => setShortcutsOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <HelpCircle className="size-3.5" />
          </button>

          {/* Background Task / Export Progress (0%) Indicator */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Background tasks and export progress"
                title="Background Tasks & Exports"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums transition hover:bg-accent hover:text-foreground",
                  activeRunningTask
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {activeRunningTask ? (
                  <Loader2 className="size-3 animate-spin text-primary" />
                ) : (
                  <Activity className="size-3" />
                )}
                <span>{dockProgressPercent}%</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-80 p-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="text-xs font-semibold">Background Tasks &amp; Exports</p>
                    <p className="text-[10px] text-muted-foreground">
                      Tracks CSV exports, project imports, and batch jobs.
                    </p>
                  </div>
                  {bgTasks.some((t) => t.status !== "running") && (
                    <button
                      type="button"
                      onClick={() => setBgTasks((prev) => prev.filter((t) => t.status === "running"))}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {bgTasks.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    <p>No active background jobs (0%).</p>
                    <p className="mt-0.5 text-[11px]">
                      CSV exports &amp; batch imports will report live progress here.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-52 space-y-2 overflow-y-auto">
                    {bgTasks.map((job) => (
                      <div key={job.id} className="space-y-1.5 rounded-md border bg-muted/20 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5 font-medium">
                            {job.status === "running" ? (
                              <Loader2 className="size-3 shrink-0 animate-spin text-primary" />
                            ) : job.status === "completed" ? (
                              <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle className="size-3 shrink-0 text-destructive" />
                            )}
                            <span className="truncate">{job.label}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums">
                            {job.progress}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              job.status === "failed"
                                ? "bg-destructive"
                                : job.status === "completed"
                                  ? "bg-emerald-600"
                                  : "bg-primary",
                            )}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{job.updatedAt}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {allowTimer && (
            <div
              title={timerTaskLabel ? `Tracking: ${timerTaskLabel}` : "Quick Timer"}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 whitespace-nowrap",
                timerRunning
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-border bg-muted/40",
              )}
            >
              <Clock
                className={cn(
                  "size-3.5 shrink-0",
                  timerRunning ? "animate-pulse text-emerald-600" : "text-muted-foreground",
                )}
              />
              {timerTaskKey && (
                <span className="rounded bg-emerald-600 px-1 py-0 font-mono text-[9px] font-bold text-white">
                  {timerTaskKey}
                </span>
              )}
              <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                {formatElapsed(elapsedSeconds)}
              </span>
              <button
                type="button"
                title={timerRunning ? "Pause timer" : "Start timer"}
                onClick={() => setTimerRunning((prev) => !prev)}
                className="rounded p-0.5 text-foreground hover:bg-background"
              >
                {timerRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
              </button>
              <button
                type="button"
                title="Log tracked time"
                onClick={() => setActivePanel("timer")}
                className="rounded px-1 text-[11px] font-medium text-primary hover:bg-background"
              >
                Log
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Keyboard Shortcuts Modal */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="size-4 text-primary" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Speed up your workflow across Projects, Tasks, CRM, and Finance.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Global Navigation
              </p>
              <div className="space-y-1.5 text-xs">
                {[
                  { keys: "Ctrl / ⌘ + K", action: "Open global search" },
                  { keys: "?", action: "Open keyboard shortcuts" },
                  { keys: "Esc", action: "Close modal or drawer" },
                ].map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between gap-2 rounded border bg-muted/20 px-2.5 py-1.5"
                  >
                    <span>{item.action}</span>
                    <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Projects &amp; Tasks
              </p>
              <div className="space-y-1.5 text-xs">
                {[
                  { keys: "Enter", action: "Save inline Kanban task" },
                  { keys: "Enter / ,", action: "Add project tag chip" },
                  { keys: "Drag", action: "Reorder table columns or cards" },
                ].map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between gap-2 rounded border bg-muted/20 px-2.5 py-1.5"
                  >
                    <span>{item.action}</span>
                    <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Utility Drawer */}
      <Sheet open={activePanel !== null} onOpenChange={(open) => !open && setActivePanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {activePanel === "pins" && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Pin className="size-4 text-amber-600" />
                  My Pins
                </SheetTitle>
                <SheetDescription>
                  Quick-access bookmarks across CRM, Finance, and Projects.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 p-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={togglePinCurrent}
                  className="w-full justify-center gap-2"
                >
                  {isCurrentPinned ? (
                    <>
                      <PinOff className="size-3.5" />
                      Unpin Current Page
                    </>
                  ) : (
                    <>
                      <Pin className="size-3.5" />
                      Pin Current Page
                    </>
                  )}
                </Button>

                <div className="space-y-1.5">
                  {pins.map((pin) => (
                    <div
                      key={pin.href}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <Link
                        href={pin.href}
                        onClick={() => setActivePanel(null)}
                        className="truncate font-medium hover:text-primary hover:underline"
                      >
                        {pin.label}
                      </Link>
                      <button
                        type="button"
                        onClick={() => updatePins(pins.filter((p) => p.href !== pin.href))}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activePanel === "chats" && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-violet-600" />
                  Team Chats
                </SheetTitle>
                <SheetDescription>
                  Recent collaboration messages across your organization.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                {canWriteProjects && (
                  <form onSubmit={handleSendChat} className="space-y-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Send a quick message to your team..."
                      required
                    />
                    <div className="flex justify-between">
                      <Link
                        href={`/${orgSlug}/projects/collaboration`}
                        onClick={() => setActivePanel(null)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Open full Collaboration →
                      </Link>
                      <Button type="submit" size="xs" disabled={isSendingChat}>
                        {isSendingChat ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3" />
                        )}
                        Send
                      </Button>
                    </div>
                  </form>
                )}

                <div className="space-y-2.5">
                  {localChats.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No messages yet.
                    </p>
                  ) : (
                    localChats.map((chat) => (
                      <div key={chat.id} className="rounded-lg border bg-muted/20 p-3 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span>{chat.authorName}</span>
                          <span className="font-normal text-muted-foreground">
                            {formatDateTimeUtc(chat.createdAt)} UTC
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-foreground/90">{chat.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {activePanel === "live-chat" && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-emerald-600" />
                  Live Chat Channel
                  <Badge className="bg-emerald-600 text-white text-[10px]">Online</Badge>
                </SheetTitle>
                <SheetDescription>
                  Real-time workspace chat room across CRM, Finance, and Projects.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                {canWriteProjects && (
                  <form onSubmit={handleSendChat} className="space-y-2">
                    <Input
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Message team or project channel live..."
                      required
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="xs" disabled={isSendingChat}>
                        {isSendingChat ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3" />
                        )}
                        Send Live Message
                      </Button>
                    </div>
                  </form>
                )}

                <div className="space-y-2.5">
                  {localChats.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No live messages yet. Start a conversation above.
                    </p>
                  ) : (
                    localChats.map((chat) => (
                      <div key={chat.id} className="rounded-lg border bg-muted/20 p-3 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span>{chat.authorName}</span>
                          <span className="font-normal text-muted-foreground">
                            {formatDateTimeUtc(chat.createdAt)} UTC
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-foreground/90">{chat.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {activePanel === "contacts" && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Users className="size-4 text-blue-600" />
                  CRM Contacts
                </SheetTitle>
                <SheetDescription>
                  Quick lookup of organization contacts across Deals &amp; Projects.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Filter contacts..."
                    className="h-8 text-xs"
                  />
                  <Link
                    href={`/${orgSlug}/crm/contacts`}
                    onClick={() => setActivePanel(null)}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Open CRM →
                  </Link>
                </div>

                <div className="space-y-2">
                  {filteredContacts.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No matching contacts.
                    </p>
                  ) : (
                    filteredContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="size-7">
                            <AvatarFallback className="text-[10px]">
                              {initials(c.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{c.fullName}</p>
                            <p className="truncate text-muted-foreground">
                              {[c.companyName, c.email].filter(Boolean).join(" · ") || "Contact"}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {c.lifecycleStage}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {activePanel === "timer" && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Clock className="size-4 text-emerald-600" />
                  Quick Timer / Time Log
                </SheetTitle>
                <SheetDescription>
                  Track time live and save directly to your project Time Logs.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <div className="rounded-xl border bg-muted/30 p-4 text-center">
                  <p className="font-mono text-3xl font-bold tabular-nums">
                    {formatElapsed(elapsedSeconds)}
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={timerRunning ? "secondary" : "default"}
                      onClick={() => setTimerRunning((prev) => !prev)}
                    >
                      {timerRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
                      {timerRunning ? "Pause" : "Start"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTimerRunning(false);
                        setElapsedSeconds(0);
                      }}
                    >
                      <Square className="size-3.5" />
                      Reset
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <label className="text-xs font-medium" htmlFor="timer-project">
                    Project
                  </label>
                  <select
                    id="timer-project"
                    value={timerProjectId}
                    onChange={(e) => setTimerProjectId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 text-sm">
                  <label className="text-xs font-medium" htmlFor="timer-notes">
                    Notes
                  </label>
                  <Input
                    id="timer-notes"
                    value={timerNotes}
                    onChange={(e) => setTimerNotes(e.target.value)}
                    placeholder="What did you work on?"
                  />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  disabled={isLoggingTime || projects.length === 0}
                  onClick={handleLogTrackedTime}
                >
                  {isLoggingTime && <Loader2 className="size-4 animate-spin" />}
                  Save to Time Logs (
                  {Math.max(0.25, Math.round((elapsedSeconds / 3600) * 4) / 4).toFixed(2)}h)
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
