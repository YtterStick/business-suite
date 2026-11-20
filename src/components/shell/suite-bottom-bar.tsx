"use client";

import * as React from "react";
import {
  Activity,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
  History,
  Keyboard,
  Loader2,
  MessageCircle,
  MessageSquare,
  Pause,
  Pin,
  PinOff,
  Play,
  Plus,
  Send,
  Square,
  StickyNote,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTimeUtc, formatTime, initials } from "@/lib/format";
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
  projectId?: string;
  projectName?: string;
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
  currentUserName = "You",
  canWriteProjects,
  canLogTime,
  canViewContacts = true,
}: {
  orgSlug: string;
  todayIso: string;
  projects: BottomBarProjectOption[];
  contacts: BottomBarContactItem[];
  recentChats: BottomBarChatItem[];
  currentUserName?: string;
  canWriteProjects: boolean;
  canLogTime?: boolean;
  canViewContacts?: boolean;
}) {
  const allowTimer = canLogTime ?? canWriteProjects;
  const pathname = usePathname();
  const router = useRouter();
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
      const nowTime = formatTime(new Date().toISOString());
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
  const [chatProjectId, setChatProjectId] = React.useState<string>("ALL");
  const [composerChatProjectId, setComposerChatProjectId] = React.useState<string>(
    projects[0]?.id ?? "workspace",
  );
  const [chatMessage, setChatMessage] = React.useState("");
  const [localChats, setLocalChats] = React.useState<BottomBarChatItem[]>(recentChats);
  const [isSendingChat, startChatTransition] = React.useTransition();
  const projectMap = React.useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  React.useEffect(() => {
    setLocalChats(recentChats);
  }, [recentChats]);

  React.useEffect(() => {
    const onChatSync = (event: Event) => {
      const msg = (event as CustomEvent<BottomBarChatItem>).detail;
      if (!msg) return;
      setLocalChats((prev) =>
        prev.some((c) => c.id === msg.id) ? prev : [...prev, msg],
      );
    };
    window.addEventListener("bs-chat-sync", onChatSync);
    return () => window.removeEventListener("bs-chat-sync", onChatSync);
  }, []);

  const visibleDockChats = React.useMemo(() => {
    return localChats
      .filter((chat) => {
        if (chatProjectId === "ALL") return true;
        return (chat.projectId ?? "workspace") === chatProjectId;
      })
      .map((chat) => {
        const topicMatch = chat.body.match(/^\[TOPIC:([^\]]+)\]\s*/);
        const topic = topicMatch?.[1]?.trim() || null;
        const cleanBody = topicMatch ? chat.body.slice(topicMatch[0].length) : chat.body;
        return {
          ...chat,
          topic,
          cleanBody,
          resolvedProjectName:
            chat.projectName ??
            (chat.projectId && chat.projectId !== "workspace"
              ? (projectMap.get(chat.projectId) ?? "Project")
              : "General Workspace"),
        };
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [localChats, chatProjectId, projectMap]);

  const handleSendChat = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanBody = chatMessage.trim();
    if (!cleanBody) return;
    const targetPid =
      chatProjectId !== "ALL" ? chatProjectId : composerChatProjectId || "workspace";
    const isWorkspace = targetPid === "workspace";
    const targetProjectName = isWorkspace
      ? "General Workspace"
      : (projectMap.get(targetPid) ?? "Project");

    startChatTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: isWorkspace ? "Workspace" : "Project",
        entityId: targetPid,
        body: cleanBody,
      });
      if (!res.ok) toast.error(res.error.message);
      else {
        const synced: BottomBarChatItem = {
          id: `live-chat-${Date.now()}`,
          authorName: currentUserName || "You",
          body: cleanBody,
          createdAt: new Date().toISOString(),
          projectId: targetPid,
          projectName: targetProjectName,
        };
        setLocalChats((prev) => [...prev, synced]);
        window.dispatchEvent(new CustomEvent<BottomBarChatItem>("bs-chat-sync", { detail: synced }));
        setChatMessage("");
        toast.success(`Posted to ${targetProjectName}`);
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
    const onOpenTimer = (event: Event) => {
      const detail = (event as CustomEvent<{ start?: boolean }>).detail;
      setActivePanel("timer");
      if (detail?.start) {
        setTimerRunning(true);
      }
    };
    window.addEventListener("bs-open-timer", onOpenTimer);
    return () => {
      window.removeEventListener("bs-toggle-task-timer", onToggleTaskTimer);
      window.removeEventListener("bs-open-timer", onOpenTimer);
    };
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="My Pins"
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
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium">My Pins ({pins.length})</p>
              <p className="text-[11px] opacity-80">Pin favorite pages across CRM, Finance &amp; Projects.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Team Chats"
                onClick={() => setActivePanel(activePanel === "chats" ? null : "chats")}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-medium whitespace-nowrap transition hover:bg-accent hover:text-foreground",
                  activePanel === "chats" && "bg-accent text-foreground",
                )}
              >
                <MessageSquare className="size-3.5 shrink-0 text-violet-600" />
                <span className="hidden md:inline">Team Chats</span>
                {localChats.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                    {localChats.length}
                  </Badge>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium">Team Chats</p>
              <p className="text-[11px] opacity-80">Internal project &amp; workspace team channels.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Client Live Chat"
                onClick={() => setActivePanel(activePanel === "live-chat" ? null : "live-chat")}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1 font-medium whitespace-nowrap transition hover:bg-accent hover:text-foreground",
                  activePanel === "live-chat" && "bg-accent text-foreground",
                )}
              >
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <MessageCircle className="size-3.5 shrink-0 text-emerald-600" />
                <span className="hidden lg:inline">Client Live Chat</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium">Client Live Chat</p>
              <p className="text-[11px] opacity-80">External client &amp; stakeholder support chat channel.</p>
            </TooltipContent>
          </Tooltip>

          {canViewContacts && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="CRM Contacts"
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
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">CRM Contacts ({contacts.length})</p>
                <p className="text-[11px] opacity-80">Quick lookup across workspace clients &amp; stakeholders.</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Sticky Notes Quick-Pad Popover */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Sticky Notes"
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
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">Sticky Notes</p>
                <p className="text-[11px] opacity-80">Quick personal scratchpad across workspace sessions.</p>
              </TooltipContent>
            </Tooltip>
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

        {/* Right: Recent, Reminders, Shortcuts (?), Background Tasks (0%), Timer */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Recent Items Popover */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Recent items"
                    className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 whitespace-nowrap text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <History className="size-3.5 shrink-0" />
                    <span className="hidden xl:inline">Recent</span>
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">Recent Items</p>
                <p className="text-[11px] opacity-80">Jump back to recently visited workspace views.</p>
              </TooltipContent>
            </Tooltip>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Reminders"
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
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">Personal Reminders</p>
                <p className="text-[11px] opacity-80">Quick follow-ups &amp; due dates for your session.</p>
              </TooltipContent>
            </Tooltip>
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

          {/* Keyboard Shortcuts (?) Modal Trigger */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Keyboard Shortcuts"
                onClick={() => setShortcutsOpen(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <HelpCircle className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium">Help &amp; Shortcuts (?)</p>
              <p className="text-[11px] opacity-80">View keyboard shortcuts &amp; workspace tips.</p>
            </TooltipContent>
          </Tooltip>

          {/* Background Task / Export Progress Indicator */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Background jobs and export progress"
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
                    <span className="hidden sm:inline font-sans font-medium">Jobs</span>
                    <span>{dockProgressPercent}%</span>
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">Background Jobs ({dockProgressPercent}%)</p>
                <p className="text-[11px] opacity-80">
                  Tracks CSV exports, imports &amp; background tasks (0% when idle).
                </p>
              </TooltipContent>
            </Tooltip>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <div
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
                    aria-label={timerRunning ? "Pause timer" : "Start timer"}
                    title={timerRunning ? "Pause timer" : "Start timer"}
                    onClick={() => setTimerRunning((prev) => !prev)}
                    className="rounded p-0.5 text-foreground hover:bg-background"
                  >
                    {timerRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Log tracked time"
                    title="Log tracked time"
                    onClick={() => setActivePanel("timer")}
                    className="rounded px-1 text-[11px] font-medium text-primary hover:bg-background"
                  >
                    Log
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">Quick Time Tracker</p>
                <p className="text-[11px] opacity-80">
                  {timerTaskLabel
                    ? `Tracking "${timerTaskLabel}" — click Log to save hours.`
                    : "Start the live timer and click Log to record billable hours."}
                </p>
              </TooltipContent>
            </Tooltip>
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

          {(activePanel === "chats" || activePanel === "live-chat") && (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b pb-3">
                <SheetTitle className="flex items-center gap-2">
                  {activePanel === "live-chat" ? (
                    <>
                      <MessageCircle className="size-4 text-emerald-600" />
                      Client Live Chat
                      <Badge className="bg-emerald-600 text-[10px] text-white">Online</Badge>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="size-4 text-violet-600" />
                      Team Chats
                    </>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {activePanel === "live-chat"
                    ? "External client support & stakeholder conversation thread."
                    : "Internal team channels synchronized with Projects Collaboration."}
                </SheetDescription>
                <div className="flex items-center justify-between gap-2 pt-2">
                  <select
                    aria-label="Filter chat by project"
                    value={chatProjectId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setChatProjectId(next);
                      if (next !== "ALL") setComposerChatProjectId(next);
                    }}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                  >
                    <option value="ALL">All Projects &amp; Workspace</option>
                    <option value="workspace">General Workspace</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Link
                    href={`/${orgSlug}/projects/collaboration`}
                    onClick={() => setActivePanel(null)}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Full Chat →
                  </Link>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {visibleDockChats.length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted-foreground">
                    No messages in this channel yet. Start the conversation below.
                  </p>
                ) : (
                  visibleDockChats.map((chat) => {
                    const isOwn =
                      chat.authorName === currentUserName || chat.authorName === "You";
                    return (
                      <div
                        key={chat.id}
                        className={cn(
                          "flex items-end gap-2",
                          isOwn ? "justify-end" : "justify-start",
                        )}
                      >
                        {!isOwn && (
                          <Avatar className="size-6 shrink-0">
                            <AvatarFallback className="text-[9px]">
                              {initials(chat.authorName)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "flex max-w-[82%] flex-col gap-0.5",
                            isOwn ? "items-end" : "items-start",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-1.5 px-1 text-[10px]">
                            <span className="font-semibold text-foreground">
                              {isOwn ? "You" : chat.authorName}
                            </span>
                            <Badge variant="outline" className="px-1 py-0 text-[9px]">
                              {chat.topic ?? chat.resolvedProjectName}
                            </Badge>
                            <span className="text-muted-foreground">
                              {formatDateTimeUtc(chat.createdAt)}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "rounded-2xl px-3 py-2 text-xs leading-relaxed",
                              isOwn
                                ? "rounded-br-sm bg-indigo-600 text-white"
                                : "rounded-bl-sm border bg-muted/60 text-foreground dark:border-zinc-800 dark:bg-zinc-900",
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{chat.cleanBody}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {canWriteProjects && (
                <form onSubmit={handleSendChat} className="space-y-2 border-t bg-background p-3">
                  {chatProjectId === "ALL" && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        Post to:
                      </span>
                      <select
                        aria-label="Select project to message"
                        value={composerChatProjectId}
                        onChange={(e) => setComposerChatProjectId(e.target.value)}
                        className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="workspace">General Workspace</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-xl border border-input bg-muted/20 px-2.5 py-1.5">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder={
                        chatProjectId === "ALL"
                          ? `Message in ${composerChatProjectId === "workspace" ? "General Workspace" : (projectMap.get(composerChatProjectId) ?? "Project")}...`
                          : `Message in ${chatProjectId === "workspace" ? "General Workspace" : (projectMap.get(chatProjectId) ?? "Project")}...`
                      }
                      required
                      className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    />
                    <Button type="submit" size="xs" disabled={isSendingChat || !chatMessage.trim()}>
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
            </div>
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
