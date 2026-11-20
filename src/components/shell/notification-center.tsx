"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  AtSign,
  Bell,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  FolderKanban,
  Settings,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { initials } from "@/lib/format";
import {
  DEFAULT_NOTIFICATION_PREFS,
  mapNotificationCategory,
  type NotificationCategory,
  type NotificationKind,
  type NotificationPreferences,
  type TopBarNotificationItem,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

function formatRelativeNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((todayStart - itemDayStart) / 86400000);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return `${dateStr} at ${timeStr}`;
}

function NotificationKindBadgeIcon({ kind }: { kind: NotificationKind }) {
  switch (kind) {
    case "mention":
      return <AtSign className="size-2.5 text-violet-600 dark:text-violet-300" />;
    case "assignment":
      return <UserCheck className="size-2.5 text-sky-600 dark:text-sky-300" />;
    case "approval":
      return <CheckCircle2 className="size-2.5 text-amber-600 dark:text-amber-300" />;
    case "overdue":
      return <AlertTriangle className="size-2.5 text-rose-600 dark:text-rose-300" />;
    case "automation":
      return <Sparkles className="size-2.5 text-emerald-600 dark:text-emerald-300" />;
    case "task":
      return <CheckSquare className="size-2.5 text-blue-600 dark:text-blue-300" />;
  }
}

export function NotificationCenter({
  orgSlug,
  userId,
  initialNotifications,
}: {
  orgSlug: string;
  userId: string;
  initialNotifications: TopBarNotificationItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [liveItems, setLiveItems] = React.useState<TopBarNotificationItem[]>([]);
  const [activeCategory, setActiveCategory] = React.useState<NotificationCategory>("all");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [settingsView, setSettingsView] = React.useState(false);
  const [lastReadAt, setLastReadAt] = React.useState<string>("");
  const [readIds, setReadIds] = React.useState<string[]>([]);
  const [prefs, setPrefs] = React.useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);

  const readAtKey = `bs_notif_read_${orgSlug}_${userId}`;
  const readIdsKey = `bs_notif_read_ids_${orgSlug}_${userId}`;
  const prefsKey = `bs_notif_prefs_${orgSlug}_${userId}`;

  React.useEffect(() => {
    try {
      const savedAt = window.localStorage.getItem(readAtKey);
      if (savedAt) setLastReadAt(savedAt);
      const savedIds = window.localStorage.getItem(readIdsKey);
      if (savedIds) {
        const parsed = JSON.parse(savedIds);
        if (Array.isArray(parsed)) setReadIds(parsed);
      }
      const savedPrefs = window.localStorage.getItem(prefsKey);
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs) as Partial<NotificationPreferences>;
        setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...parsed });
      }
    } catch {
      // Ignore storage read error
    }
  }, [readAtKey, readIdsKey, prefsKey]);

  React.useEffect(() => {
    const onLiveNotify = (event: Event) => {
      const item = (event as CustomEvent<TopBarNotificationItem>).detail;
      if (!item) return;
      setLiveItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 25));
      if (prefs.inAppSound) {
        toast.info(item.title, { description: item.description });
      }
    };
    window.addEventListener("bs-notify", onLiveNotify);
    return () => window.removeEventListener("bs-notify", onLiveNotify);
  }, [prefs.inAppSound]);

  const allItems = React.useMemo(() => {
    const merged = [...liveItems, ...initialNotifications];
    const seen = new Set<string>();
    const unique: TopBarNotificationItem[] = [];
    for (const item of merged) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const cat = mapNotificationCategory(item.kind);
      if (cat === "mentions" && !prefs.mentions) continue;
      if (cat === "assignments" && !prefs.assignments) continue;
      if (cat === "approvals" && !prefs.approvals) continue;
      if (cat === "overdue" && !prefs.overdue) continue;
      unique.push(item);
    }
    return unique.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [liveItems, initialNotifications, prefs]);

  const isUnread = React.useCallback(
    (item: TopBarNotificationItem) => {
      if (readIds.includes(item.id)) return false;
      if (!lastReadAt) return true;
      return item.createdAt > lastReadAt;
    },
    [readIds, lastReadAt],
  );

  const counts = React.useMemo(() => {
    const c: Record<NotificationCategory, number> = {
      all: 0,
      mentions: 0,
      assignments: 0,
      approvals: 0,
      overdue: 0,
    };
    for (const item of allItems) {
      if (!isUnread(item)) continue;
      c.all += 1;
      const cat = mapNotificationCategory(item.kind);
      c[cat] += 1;
    }
    return c;
  }, [allItems, isUnread]);

  const visibleItems = React.useMemo(() => {
    return allItems.filter((item) => {
      if (activeCategory !== "all" && mapNotificationCategory(item.kind) !== activeCategory) {
        return false;
      }
      if (unreadOnly && !isUnread(item)) return false;
      return true;
    });
  }, [allItems, activeCategory, unreadOnly, isUnread]);

  const markItemRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].slice(-120);
      try {
        window.localStorage.setItem(readIdsKey, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const markAllRead = () => {
    const latest = allItems[0]?.createdAt || new Date().toISOString();
    setLastReadAt(latest);
    setReadIds([]);
    try {
      window.localStorage.setItem(readAtKey, latest);
      window.localStorage.removeItem(readIdsKey);
    } catch {
      // Ignore
    }
    toast.success("All notifications marked as read");
  };

  const togglePref = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(prefsKey, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleNotificationClick = (item: TopBarNotificationItem) => {
    markItemRead(item.id);
    setOpen(false);
    router.push(item.href);
  };

  const tabs: Array<{ id: NotificationCategory; label: string }> = [
    { id: "all", label: "All" },
    { id: "mentions", label: "Mentions (@)" },
    { id: "assignments", label: "Assignments" },
    { id: "approvals", label: "Approvals" },
    { id: "overdue", label: "Overdue" },
  ];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSettingsView(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Notifications"
          title="Notifications"
          className="relative"
        >
          <Bell className="size-4" />
          {counts.all > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums">
              {counts.all > 99 ? "99+" : counts.all}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[440px] max-w-[96vw] overflow-hidden p-0">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            {settingsView ? (
              <button
                type="button"
                onClick={() => setSettingsView(false)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary"
              >
                <ArrowLeft className="size-4" />
                Notification Settings
              </button>
            ) : (
              <>
                <span className="text-sm font-semibold">Notifications</span>
                {counts.all > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                    {counts.all} unread
                  </Badge>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {!settingsView && (
              <>
                <button
                  type="button"
                  role="switch"
                  aria-checked={unreadOnly}
                  onClick={() => setUnreadOnly((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <span>Unread Only</span>
                  <span
                    className={cn(
                      "inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
                      unreadOnly ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "size-3 rounded-full bg-background shadow-xs transition-transform",
                        unreadOnly ? "translate-x-3" : "translate-x-0",
                      )}
                    />
                  </span>
                </button>

                {counts.all > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    title="Mark all as read"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <CheckCheck className="size-3.5" />
                    <span className="hidden sm:inline">Mark all read</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setSettingsView((v) => !v)}
              title="Notification Settings"
              aria-label="Notification Settings"
              className={cn(
                "rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground",
                settingsView && "bg-accent text-foreground",
              )}
            >
              <Settings className="size-4" />
            </button>
          </div>
        </div>

        {settingsView ? (
          <div className="space-y-3 p-4">
            <p className="text-xs text-muted-foreground">
              Choose which Tactiq workspace alerts appear in your Notification Center and digest emails.
            </p>
            <div className="divide-y rounded-lg border dark:divide-zinc-800 dark:border-zinc-800">
              {(
                [
                  {
                    key: "mentions",
                    label: "Mentions (@)",
                    desc: "Notify when a teammate @mentions you in comments or Feed.",
                  },
                  {
                    key: "assignments",
                    label: "Task & Issue Assignments",
                    desc: "Notify when tasks, subtasks, or issues are assigned or updated.",
                  },
                  {
                    key: "approvals",
                    label: "Approvals & Sign-offs",
                    desc: "Notify on submitted timesheets, expense claims, and phase sign-offs.",
                  },
                  {
                    key: "overdue",
                    label: "Overdue Task Alerts",
                    desc: "Surface tasks and milestones past their scheduled due date.",
                  },
                  {
                    key: "emailDigest",
                    label: "Daily Email Digest",
                    desc: "Receive an end-of-day summary email for unread items.",
                  },
                  {
                    key: "inAppSound",
                    label: "Real-Time Toast Popups",
                    desc: "Show instant in-app banner alerts when live events trigger.",
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40"
                >
                  <div>
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    onChange={() => togglePref(item.key)}
                    className="size-4 rounded border-border accent-primary"
                  />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b bg-muted/30 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/50">
              {tabs.map((tab) => {
                const active = activeCategory === tab.id;
                const badgeCount = counts[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
                      active
                        ? "bg-background text-foreground shadow-xs dark:bg-zinc-800"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{tab.label}</span>
                    {badgeCount > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0 text-[9px] font-bold tabular-nums",
                          active
                            ? "bg-primary/15 text-primary"
                            : "bg-muted-foreground/15 text-muted-foreground",
                        )}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Notification List */}
            <div className="max-h-[400px] divide-y overflow-y-auto dark:divide-zinc-800">
              {visibleItems.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                  {unreadOnly
                    ? "No unread notifications in this category."
                    : "All caught up — no recent notifications here."}
                </div>
              ) : (
                visibleItems.map((item) => {
                  const unread = isUnread(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNotificationClick(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/50 dark:hover:bg-zinc-900/70",
                        unread && "bg-blue-50/45 dark:bg-blue-950/20",
                      )}
                    >
                      <div className="relative mt-0.5 shrink-0">
                        <Avatar className="size-8 border dark:border-zinc-700">
                          {item.actorAvatarUrl && (
                            <AvatarImage src={item.actorAvatarUrl} alt={item.actorName} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                            {initials(item.actorName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border bg-background shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
                          <NotificationKindBadgeIcon kind={item.kind} />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs leading-snug text-foreground">
                          <span className="font-semibold">{item.title}</span>
                        </p>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {item.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {item.entityKey && (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 font-mono text-[9px] font-semibold text-primary"
                            >
                              {item.entityKey}
                            </Badge>
                          )}
                          {item.projectName && (
                            <span className="inline-flex items-center gap-1 truncate rounded bg-muted px-1.5 py-0 text-[10px] text-muted-foreground dark:bg-zinc-800">
                              <FolderKanban className="size-2.5" />
                              {item.projectName}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeNotificationTime(item.createdAt)}
                          </span>
                        </div>
                      </div>

                      {unread && (
                        <span
                          aria-label="Unread"
                          className="mt-2 size-2 shrink-0 rounded-full bg-blue-500"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
