"use client";

import * as React from "react";
import {
  Activity,
  AtSign,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  FolderOpen,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTimeUtc, initials } from "@/lib/format";
import { emitWorkspaceNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  CollaborationCalendarTab,
  CollaborationChatTab,
  type CollaborationCalendarEvent,
} from "@/modules/projects/components/collaboration-calendar-chat";
import {
  CollaborationDocumentsTab,
  CollaborationForumsTab,
  CollaborationPagesTab,
  EXPLORER_DOC_PREFIX,
  FORUM_PREFIX,
  REPLY_PREFIX,
  WIKI_PREFIX,
} from "@/modules/projects/components/collaboration-tabs";
import { postCommentAction } from "@/modules/projects/projects.actions";
import type { CommentDTO } from "@/modules/projects/projects.types";

type CollaborationSubTab = "feed" | "calendar" | "chat" | "pages" | "forums" | "documents";
type FeedFilterType = "all" | "status" | "task" | "project";
type FeedStreamToggle = "all" | "status" | "activity";

const FEED_REPLY_PREFIX = "[FEED_REPLY]|";

export interface CollaborationAuditActivity {
  id: string;
  actorName: string;
  category: "task" | "project" | "phase" | "issue";
  actionVerb: string;
  entityKey?: string | null;
  entityTitle: string;
  projectId?: string | null;
  projectName?: string | null;
  description?: string | null;
  summary: string;
  action: string;
  createdAt: string;
  href?: string;
}

interface CollaborationPanelProps {
  orgSlug: string;
  todayIso?: string;
  comments: CommentDTO[];
  projects: Array<{ id: string; name: string }>;
  members?: Array<{ id: string; name: string; email: string }>;
  auditActivities?: CollaborationAuditActivity[];
  calendarEvents?: CollaborationCalendarEvent[];
  fixedProjectId?: string;
  showZohoTabs?: boolean;
  canWrite: boolean;
}

function isStructuredMarker(body: string): boolean {
  return (
    body.startsWith(WIKI_PREFIX) ||
    body.startsWith(FORUM_PREFIX) ||
    body.startsWith(REPLY_PREFIX) ||
    body.startsWith(EXPLORER_DOC_PREFIX) ||
    body.startsWith(FEED_REPLY_PREFIX) ||
    body.startsWith("[DOC]") ||
    body.startsWith("[SUBTASK]|") ||
    body.startsWith("[DEP]|") ||
    body.startsWith("[ATTACH]|")
  );
}

interface UnifiedStreamItem {
  id: string;
  streamType: "status" | "activity";
  category: "status" | "task" | "project";
  actorName: string;
  actorAvatarUrl?: string | null;
  actionVerb: string;
  entityKey?: string | null;
  entityTitle?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  bodyOrDescription: string | null;
  href?: string;
  createdAt: string;
}

export function CollaborationPanel({
  orgSlug,
  todayIso = "",
  comments,
  projects,
  members = [],
  auditActivities = [],
  calendarEvents = [],
  fixedProjectId,
  showZohoTabs = false,
  canWrite,
}: CollaborationPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<CollaborationSubTab>("feed");
  const [selectedProjectId, setSelectedProjectId] = React.useState(
    fixedProjectId ?? projects[0]?.id ?? "workspace",
  );
  const [body, setBody] = React.useState("");
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [feedFilter, setFeedFilter] = React.useState<FeedFilterType>("all");
  const [streamToggle, setStreamToggle] = React.useState<FeedStreamToggle>("all");
  const [expandedDescIds, setExpandedDescIds] = React.useState<string[]>([]);
  const [replyOpenId, setReplyOpenId] = React.useState<string | null>(null);
  const [replyDraft, setReplyDraft] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const feedComments = React.useMemo(
    () => comments.filter((c) => !isStructuredMarker(c.body)),
    [comments],
  );

  const repliesByTargetId = React.useMemo(() => {
    const map = new Map<
      string,
      Array<{ id: string; authorName: string; body: string; createdAt: string }>
    >();
    for (const c of comments) {
      if (!c.body.startsWith(FEED_REPLY_PREFIX)) continue;
      const rest = c.body.slice(FEED_REPLY_PREFIX.length);
      const sep = rest.indexOf("|");
      if (sep < 0) continue;
      const targetId = rest.slice(0, sep);
      const replyBody = rest.slice(sep + 1);
      const bucket = map.get(targetId) ?? [];
      bucket.push({
        id: c.id,
        authorName: c.author?.name ?? "Team Member",
        body: replyBody,
        createdAt: c.createdAt,
      });
      map.set(targetId, bucket);
    }
    return map;
  }, [comments]);

  const unifiedStream = React.useMemo<UnifiedStreamItem[]>(() => {
    const statusItems: UnifiedStreamItem[] = feedComments.map((c) => ({
      id: c.id,
      streamType: "status",
      category: "status",
      actorName: c.author?.name ?? "Team Member",
      actorAvatarUrl: c.author?.avatarUrl ?? null,
      actionVerb:
        c.entityType === "Project"
          ? "posted a status update in"
          : "shared an update in",
      entityKey: null,
      entityTitle: null,
      projectId: c.entityType === "Project" ? c.entityId : null,
      projectName: c.entityType === "Project" ? c.entityLabel : "General Workspace",
      bodyOrDescription: c.body,
      href: c.entityType === "Project" ? `/${orgSlug}/projects/${c.entityId}` : undefined,
      createdAt: c.createdAt,
    }));

    const activityItems: UnifiedStreamItem[] = auditActivities.map((act) => ({
      id: `act-${act.id}`,
      streamType: "activity",
      category: act.category === "project" ? "project" : "task",
      actorName: act.actorName,
      actorAvatarUrl: null,
      actionVerb: act.actionVerb,
      entityKey: act.entityKey ?? null,
      entityTitle: act.entityTitle,
      projectId: act.projectId ?? null,
      projectName: act.projectName ?? null,
      bodyOrDescription: act.description ?? act.summary,
      href: act.href,
      createdAt: act.createdAt,
    }));

    return [...statusItems, ...activityItems].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }, [feedComments, auditActivities, orgSlug]);

  const visibleStream = React.useMemo(() => {
    return unifiedStream.filter((item) => {
      if (streamToggle === "status" && item.streamType !== "status") return false;
      if (streamToggle === "activity" && item.streamType !== "activity") return false;
      if (feedFilter === "status" && item.category !== "status") return false;
      if (feedFilter === "task" && item.category !== "task") return false;
      if (feedFilter === "project" && item.category !== "project") return false;
      return true;
    });
  }, [unifiedStream, streamToggle, feedFilter]);

  const handleBodyChange = (val: string) => {
    setBody(val);
    const match = val.match(/@([^\s@]*)$/);
    setMentionQuery(match ? (match[1] ?? "").toLowerCase() : null);
  };

  const insertMention = (label: string, projectTagId?: string) => {
    setBody((prev) => prev.replace(/@([^\s@]*)$/, `@${label} `));
    if (projectTagId) setSelectedProjectId(projectTagId);
    setMentionQuery(null);
  };

  const memberMatches =
    mentionQuery === null
      ? []
      : members.filter((m) => m.name.toLowerCase().includes(mentionQuery)).slice(0, 4);

  const projectMatches =
    mentionQuery === null || fixedProjectId
      ? []
      : projects.filter((p) => p.name.toLowerCase().includes(mentionQuery)).slice(0, 3);

  const handlePost = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody) return;

    startTransition(async () => {
      const isWorkspace = selectedProjectId === "workspace";
      const res = await postCommentAction({
        orgSlug,
        entityType: isWorkspace ? "Workspace" : "Project",
        entityId: selectedProjectId,
        body: cleanBody,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      const projName = projects.find((p) => p.id === selectedProjectId)?.name ?? null;
      if (cleanBody.includes("@")) {
        emitWorkspaceNotification({
          kind: "mention",
          actorName: "You",
          title: "New @mention in Collaboration Feed",
          description: cleanBody,
          entityKey: "FEED",
          projectName: isWorkspace ? null : projName,
          href: `/${orgSlug}/projects/collaboration`,
          badgeLabel: "@Mention",
        });
      }
      if (isWorkspace) {
        window.dispatchEvent(
          new CustomEvent("bs-chat-sync", {
            detail: {
              id: `feed-post-${Date.now()}`,
              authorName: "You",
              body: cleanBody,
              createdAt: new Date().toISOString(),
            },
          }),
        );
      }

      setBody("");
      setMentionQuery(null);
      toast.success("Update posted");
      router.refresh();
    });
  };

  const handleReplySubmit = (targetId: string) => {
    const clean = replyDraft.replaceAll("|", " ").trim();
    if (!clean) return;
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: fixedProjectId ? "Project" : "Workspace",
        entityId: fixedProjectId ?? "workspace",
        body: `${FEED_REPLY_PREFIX}${targetId}|${clean}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setReplyDraft("");
      setReplyOpenId(null);
      toast.success("Reply added");
      router.refresh();
    });
  };

  const toggleDescription = (id: string) => {
    setExpandedDescIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-4">
      {showZohoTabs && (
        <div
          role="tablist"
          aria-label="Collaboration sections"
          className="flex gap-2 overflow-x-auto border-b pb-3 dark:border-zinc-800"
        >
          {[
            { id: "feed" as const, label: "Feed", icon: MessageSquare },
            { id: "calendar" as const, label: "Calendar", icon: Calendar },
            { id: "chat" as const, label: "Chat", icon: MessagesSquare },
            { id: "pages" as const, label: "Pages", icon: BookOpen },
            { id: "forums" as const, label: "Forums", icon: Activity },
            { id: "documents" as const, label: "Documents", icon: FolderOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition dark:border-zinc-800",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                    : "bg-background text-muted-foreground hover:text-foreground dark:bg-zinc-900/70",
                )}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {(!showZohoTabs || activeTab === "feed") && (
        <div className="space-y-4">
          {/* Zoho-Style Inline Status Composer */}
          {canWrite && (
            <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
              <CardContent className="pt-4">
                <form onSubmit={handlePost} className="space-y-3">
                  <textarea
                    rows={2}
                    value={body}
                    onChange={(e) => handleBodyChange(e.target.value)}
                    placeholder="Share a quick thought and start a discussion... (type @ to mention a teammate or tag a @project)"
                    required
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-zinc-800 dark:bg-zinc-950"
                  />

                  {(memberMatches.length > 0 || projectMatches.length > 0) && (
                    <div className="rounded-lg border bg-popover p-1.5 shadow-md dark:border-zinc-800">
                      {memberMatches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => insertMention(m.name)}
                          className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                        >
                          <AtSign className="size-3 text-violet-600" />
                          <span className="font-medium">{m.name}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">Teammate</span>
                        </button>
                      ))}
                      {projectMatches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => insertMention(p.name, p.id)}
                          className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                        >
                          <FolderKanban className="size-3 text-emerald-600" />
                          <span className="font-medium">{p.name}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">@project</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {!fixedProjectId ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">@project:</span>
                        <select
                          value={selectedProjectId}
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          className="h-8 rounded-md border border-input bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                          <option value="workspace">General Workspace</option>
                        </select>
                      </div>
                    ) : (
                      <div />
                    )}

                    <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                      {isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      Post
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Stream Filters Bar: All Feeds ▾ + Feed Status / Activity Stream toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center gap-2">
              <select
                value={feedFilter}
                onChange={(e) => setFeedFilter(e.target.value as FeedFilterType)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="all">All Feeds</option>
                <option value="status">Status Updates</option>
                <option value="task">Task Activity</option>
                <option value="project">Project Updates</option>
              </select>
              <span className="text-xs text-muted-foreground">
                Showing {visibleStream.length} {visibleStream.length === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="inline-flex rounded-lg border bg-background p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "status", label: "Feed Status" },
                  { id: "activity", label: "Activity Stream" },
                ] as const
              ).map((toggle) => (
                <button
                  key={toggle.id}
                  type="button"
                  onClick={() => setStreamToggle(toggle.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition",
                    streamToggle === toggle.id
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {toggle.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Activity & Status Stream */}
          <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
            <CardHeader className="border-b py-3 dark:border-zinc-800">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="size-4 text-emerald-500" />
                Workspace Stream
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0 dark:divide-zinc-800">
              {visibleStream.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No updates match your current stream filters.
                </p>
              ) : (
                visibleStream.map((item) => {
                  const isExpanded = expandedDescIds.includes(item.id);
                  const replies = repliesByTargetId.get(item.id) ?? [];
                  const isReplying = replyOpenId === item.id;
                  const hasDescription = Boolean(item.bodyOrDescription?.trim());

                  return (
                    <div key={item.id} className="space-y-2.5 px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <Avatar className="mt-0.5 size-8 shrink-0 border dark:border-zinc-700">
                          {item.actorAvatarUrl && (
                            <AvatarImage src={item.actorAvatarUrl} alt={item.actorName} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {initials(item.actorName)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
                            <span className="font-semibold text-foreground">{item.actorName}</span>
                            <span className="text-muted-foreground">{item.actionVerb}</span>
                            {item.entityKey && (
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 font-mono text-[10px] font-semibold text-primary"
                              >
                                {item.entityKey}
                              </Badge>
                            )}
                            {item.entityTitle &&
                              (item.href ? (
                                <Link
                                  href={item.href}
                                  className="font-semibold text-foreground hover:text-primary hover:underline"
                                >
                                  {item.entityTitle}
                                </Link>
                              ) : (
                                <span className="font-semibold text-foreground">
                                  {item.entityTitle}
                                </span>
                              ))}
                            {item.projectName && (
                              <>
                                {item.streamType === "activity" && (
                                  <span className="text-muted-foreground">in</span>
                                )}
                                {item.projectId ? (
                                  <Link
                                    href={`/${orgSlug}/projects/${item.projectId}`}
                                    className="font-medium text-primary hover:underline"
                                  >
                                    {item.projectName}
                                  </Link>
                                ) : (
                                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                    {item.projectName}
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>

                          {/* Status body always visible for Feed Status posts; expandable for Activity */}
                          {item.streamType === "status" && item.bodyOrDescription && (
                            <p className="whitespace-pre-wrap text-sm text-foreground/90">
                              {item.bodyOrDescription}
                            </p>
                          )}

                          {/* Action meta row: • Comment • Show Description • [Timestamp] */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => setReplyOpenId(isReplying ? null : item.id)}
                                className="font-medium text-primary hover:underline"
                              >
                                Comment{replies.length > 0 ? ` (${replies.length})` : ""}
                              </button>
                            )}
                            {hasDescription && item.streamType === "activity" && (
                              <>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => toggleDescription(item.id)}
                                  className="inline-flex items-center gap-0.5 font-medium text-foreground/80 hover:text-primary"
                                >
                                  {isExpanded ? (
                                    <>
                                      Hide Description <ChevronUp className="size-3" />
                                    </>
                                  ) : (
                                    <>
                                      Show Description <ChevronDown className="size-3" />
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                            <span>•</span>
                            <span>{formatDateTimeUtc(item.createdAt)} UTC</span>
                          </div>

                          {/* Expanded description for activity entries */}
                          {item.streamType === "activity" && isExpanded && item.bodyOrDescription && (
                            <div className="mt-2 rounded-lg border bg-muted/30 p-2.5 text-xs text-foreground/90 dark:border-zinc-800 dark:bg-zinc-950/60">
                              {item.bodyOrDescription}
                            </div>
                          )}

                          {/* Inline Replies */}
                          {replies.length > 0 && (
                            <div className="mt-2 space-y-1.5 border-l-2 border-border/70 pl-3 dark:border-zinc-800">
                              {replies.map((rep) => (
                                <div key={rep.id} className="text-xs">
                                  <span className="font-semibold text-foreground">
                                    {rep.authorName}
                                  </span>{" "}
                                  <span className="text-foreground/90">{rep.body}</span>
                                  <span className="ml-2 text-[10px] text-muted-foreground">
                                    {formatDateTimeUtc(rep.createdAt)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Inline Reply Composer */}
                          {isReplying && (
                            <div className="mt-2 flex items-center gap-2">
                              <Input
                                value={replyDraft}
                                onChange={(e) => setReplyDraft(e.target.value)}
                                placeholder="Write a comment..."
                                className="h-8 flex-1 text-xs"
                              />
                              <Button
                                type="button"
                                size="xs"
                                disabled={isPending}
                                onClick={() => handleReplySubmit(item.id)}
                              >
                                Reply
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showZohoTabs && activeTab === "calendar" && (
        <CollaborationCalendarTab
          todayIso={todayIso}
          events={calendarEvents}
          projects={projects}
        />
      )}

      {showZohoTabs && activeTab === "chat" && (
        <CollaborationChatTab
          orgSlug={orgSlug}
          comments={comments}
          projects={projects}
          members={members}
          canWrite={canWrite}
        />
      )}

      {showZohoTabs && activeTab === "pages" && (
        <CollaborationPagesTab
          orgSlug={orgSlug}
          comments={comments}
          projects={projects}
          members={members}
          canWrite={canWrite}
        />
      )}

      {showZohoTabs && activeTab === "forums" && (
        <CollaborationForumsTab
          orgSlug={orgSlug}
          comments={comments}
          projects={projects}
          canWrite={canWrite}
        />
      )}

      {showZohoTabs && activeTab === "documents" && (
        <CollaborationDocumentsTab
          orgSlug={orgSlug}
          comments={comments}
          projects={projects}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
