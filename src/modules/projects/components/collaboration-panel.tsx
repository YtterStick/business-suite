"use client";

import * as React from "react";
import {
  Activity,
  AtSign,
  BookOpen,
  FileText,
  FolderOpen,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Send,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeUtc, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
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

type CollaborationSubTab = "feed" | "pages" | "forums" | "documents";

export interface CollaborationAuditActivity {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

interface CollaborationPanelProps {
  orgSlug: string;
  comments: CommentDTO[];
  projects: Array<{ id: string; name: string }>;
  members?: Array<{ id: string; name: string; email: string }>;
  auditActivities?: CollaborationAuditActivity[];
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
    body.startsWith("[DOC]")
  );
}

export function CollaborationPanel({
  orgSlug,
  comments,
  projects,
  members = [],
  auditActivities = [],
  fixedProjectId,
  showZohoTabs = false,
  canWrite,
}: CollaborationPanelProps) {
  const [activeTab, setActiveTab] = React.useState<CollaborationSubTab>("feed");
  const [selectedProjectId, setSelectedProjectId] = React.useState(
    fixedProjectId ?? projects[0]?.id ?? "workspace",
  );
  const [body, setBody] = React.useState("");
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const feedComments = React.useMemo(
    () => comments.filter((c) => !isStructuredMarker(c.body)),
    [comments],
  );

  const handleBodyChange = (val: string) => {
    setBody(val);
    const match = val.match(/@([^\s@]*)$/);
    setMentionQuery(match ? (match[1] ?? "").toLowerCase() : null);
  };

  const insertMention = (memberName: string) => {
    setBody((prev) => prev.replace(/@([^\s@]*)$/, `@${memberName} `));
    setMentionQuery(null);
  };

  const mentionMatches =
    mentionQuery === null
      ? []
      : members.filter((m) => m.name.toLowerCase().includes(mentionQuery)).slice(0, 5);

  const handlePost = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;

    startTransition(async () => {
      const isWorkspace = selectedProjectId === "workspace";
      const res = await postCommentAction({
        orgSlug,
        entityType: isWorkspace ? "Workspace" : "Project",
        entityId: selectedProjectId,
        body,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setBody("");
      setMentionQuery(null);
      toast.success("Update posted");
    });
  };

  return (
    <div className="space-y-4">
      {showZohoTabs && (
        <div
          role="tablist"
          aria-label="Collaboration sections"
          className="flex gap-2 overflow-x-auto border-b pb-3"
        >
          {[
            { id: "feed" as const, label: "Feed", icon: MessageSquare },
            { id: "pages" as const, label: "Pages", icon: BookOpen },
            { id: "forums" as const, label: "Forums", icon: MessagesSquare },
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
                  "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                    : "bg-background text-muted-foreground hover:text-foreground",
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
        <div className={cn("grid gap-6", showZohoTabs && "lg:grid-cols-12")}>
          <div className={cn("space-y-4", showZohoTabs && "lg:col-span-8")}>
            {canWrite && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="size-4 text-violet-600" />
                    Post Status Update
                  </CardTitle>
                  <CardDescription>
                    Share progress, blockers, or @mention teammates across projects.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePost} className="space-y-3">
                    {!fixedProjectId && (
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            Project: {p.name}
                          </option>
                        ))}
                        <option value="workspace">General Workspace Feed</option>
                      </select>
                    )}

                    <textarea
                      rows={3}
                      value={body}
                      onChange={(e) => handleBodyChange(e.target.value)}
                      placeholder="Write a status update... type @ to mention a teammate"
                      required
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />

                    {mentionMatches.length > 0 && (
                      <div className="rounded-lg border bg-popover p-1 shadow-md">
                        {mentionMatches.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => insertMention(m.name)}
                            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                          >
                            <AtSign className="size-3 text-violet-600" />
                            <span className="font-medium">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={isPending}>
                        {isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                        Post Update
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Team Status Stream ({feedComments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {feedComments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No status updates yet. Post the first update above.
                  </p>
                ) : (
                  feedComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3.5"
                    >
                      <Avatar className="size-8 shrink-0">
                        {comment.author?.avatarUrl && (
                          <AvatarImage src={comment.author.avatarUrl} alt={comment.author.name} />
                        )}
                        <AvatarFallback className="text-xs">
                          {initials(comment.author?.name ?? "User")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              {comment.author?.name ?? "Team Member"}
                            </span>
                            {comment.entityType === "Project" ? (
                              <Link href={`/${orgSlug}/projects/${comment.entityId}`}>
                                <Badge variant="outline" className="text-[10px] hover:bg-accent">
                                  {comment.entityLabel}
                                </Badge>
                              </Link>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Workspace
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTimeUtc(comment.createdAt)} UTC
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-foreground/90">
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {showZohoTabs && (
            <Card className="h-fit lg:col-span-4">
              <CardHeader className="border-b py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Activity className="size-4 text-emerald-600" />
                  Project Activity Stream
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {auditActivities.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">
                    Recent project &amp; task transitions appear here automatically.
                  </p>
                ) : (
                  auditActivities.map((act) => (
                    <div key={act.id} className="space-y-0.5 p-3 text-xs">
                      <p className="font-semibold">{act.actorName}</p>
                      <p className="text-muted-foreground">{act.summary}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateTimeUtc(act.createdAt)} UTC
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
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
