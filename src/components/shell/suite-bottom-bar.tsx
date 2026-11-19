"use client";

import * as React from "react";
import {
  BellRing,
  Check,
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
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}: {
  orgSlug: string;
  todayIso: string;
  projects: BottomBarProjectOption[];
  contacts: BottomBarContactItem[];
  recentChats: BottomBarChatItem[];
  canWriteProjects: boolean;
}) {
  const pathname = usePathname();
  const [activePanel, setActivePanel] = React.useState<UtilityPanel>(null);

  // My Pins (persisted in localStorage per org)
  const defaultPins = React.useMemo<PinnedRoute[]>(
    () => [
      { label: "CRM Deal Pipeline", href: `/${orgSlug}/crm/deals` },
      { label: "Finance Invoices", href: `/${orgSlug}/finance/invoices` },
      { label: "Projects", href: `/${orgSlug}/projects` },
      { label: "Weekly Timesheets", href: `/${orgSlug}/projects/timesheets` },
    ],
    [orgSlug],
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

  // Quick Chats
  const [chatMessage, setChatMessage] = React.useState("");
  const [isSendingChat, startChatTransition] = React.useTransition();

  const handleSendChat = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chatMessage.trim()) return;
    startChatTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: "Workspace",
        entityId: "workspace",
        body: chatMessage,
      });
      if (!res.ok) toast.error(res.error.message);
      else {
        setChatMessage("");
        toast.success("Message posted to Collaboration");
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
      const res = await createTimeLogAction({
        orgSlug,
        projectId: timerProjectId,
        hours,
        billable: true,
        loggedDate: todayIso,
        notes: timerNotes.trim() || `Logged via bottom timer (${formatElapsed(elapsedSeconds)})`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTimerRunning(false);
      setElapsedSeconds(0);
      setTimerNotes("");
      setActivePanel(null);
      toast.success(`Logged ${hours.toFixed(2)}h to Time Logs`);
    });
  };

  return (
    <>
      <footer
        aria-label="Workspace utility bar"
        className="flex h-9 shrink-0 items-center justify-between border-t bg-background px-3 text-xs text-muted-foreground lg:px-5"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "pins" ? null : "pins")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium transition hover:bg-accent hover:text-foreground",
              activePanel === "pins" && "bg-accent text-foreground",
            )}
          >
            <Pin className="size-3.5 text-amber-600" />
            <span>My Pins</span>
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {pins.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "chats" ? null : "chats")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium transition hover:bg-accent hover:text-foreground",
              activePanel === "chats" && "bg-accent text-foreground",
            )}
          >
            <MessageSquare className="size-3.5 text-violet-600" />
            <span>Chats</span>
            {recentChats.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {recentChats.length}
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "live-chat" ? null : "live-chat")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium transition hover:bg-accent hover:text-foreground",
              activePanel === "live-chat" && "bg-accent text-foreground",
            )}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <MessageCircle className="size-3.5 text-emerald-600" />
            <span>Live Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "contacts" ? null : "contacts")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium transition hover:bg-accent hover:text-foreground",
              activePanel === "contacts" && "bg-accent text-foreground",
            )}
          >
            <Users className="size-3.5 text-blue-600" />
            <span>Contacts</span>
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {contacts.length}
            </Badge>
          </button>
        </div>

        {/* Right: Recent Items, Reminders, Keyboard Shortcuts (?), and Quick Timer Widget */}
        <div className="flex items-center gap-1.5">
          {/* Recent Items Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Recent items"
                title="Recent Items"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <History className="size-3.5" />
                <span className="hidden md:inline">Recent</span>
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
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <BellRing className="size-3.5" />
                <span className="hidden md:inline">Reminders</span>
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

          {/* Keyboard Shortcuts (?) Popover */}
          <Popover open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Keyboard Shortcuts"
                title="Keyboard Shortcuts (?)"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <HelpCircle className="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-72 p-3">
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 border-b pb-2">
                  <Keyboard className="size-3.5 text-primary" />
                  <p className="text-xs font-semibold">Keyboard Shortcuts</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  {[
                    { keys: "Ctrl / ⌘ + K", action: "Open global search" },
                    { keys: "?", action: "Toggle shortcuts reference" },
                    { keys: "Esc", action: "Close active drawer or modal" },
                    { keys: "Enter / ,", action: "Commit project tag chip" },
                  ].map((item) => (
                    <div key={item.keys} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{item.action}</span>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {item.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5">
            <Clock
              className={cn(
                "size-3.5",
                timerRunning ? "animate-pulse text-emerald-600" : "text-muted-foreground",
              )}
            />
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatElapsed(elapsedSeconds)}
            </span>
            {canWriteProjects && (
              <>
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
              </>
            )}
          </div>
        </div>
      </footer>

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
                  {recentChats.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No messages yet.
                    </p>
                  ) : (
                    recentChats.map((chat) => (
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
                  {recentChats.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No live messages yet. Start a conversation above.
                    </p>
                  ) : (
                    recentChats.map((chat) => (
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
