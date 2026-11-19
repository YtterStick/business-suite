"use client";

import * as React from "react";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  History,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeUtc } from "@/lib/format";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/modules/projects/components/rich-text-editor";
import {
  deleteTaskMetaCommentAction,
  postCommentAction,
  toggleTaskMetaCommentAction,
} from "@/modules/projects/projects.actions";
import type { CommentDTO } from "@/modules/projects/projects.types";

export const WIKI_PREFIX = "[WIKI]|";
export const FORUM_PREFIX = "[FORUM]|";
export const REPLY_PREFIX = "[REPLY]|";
export const EXPLORER_DOC_PREFIX = "[FDOC]|";

export interface WikiPageItem {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  htmlBody: string;
  authorName: string;
  createdAt: string;
}

export interface ForumTopicItem {
  id: string;
  title: string;
  category: string;
  projectId: string;
  projectName: string;
  body: string;
  authorName: string;
  createdAt: string;
  replies: Array<{
    id: string;
    authorName: string;
    body: string;
    createdAt: string;
  }>;
}

export interface ExplorerDocItem {
  id: string;
  title: string;
  folder: string;
  version: string;
  sizeLabel: string;
  projectId: string;
  projectName: string;
  url: string;
  authorName: string;
  createdAt: string;
}

const DEFAULT_FOLDERS = [
  "Specs & SOWs",
  "Design Assets",
  "Deliverables",
  "Contracts & Finance",
];

function sanitizeField(val: string): string {
  return val.replaceAll("|", " ").trim();
}

export function CollaborationPagesTab({
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
  const projectMap = React.useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const [isPending, startTransition] = React.useTransition();

  const pages = React.useMemo<WikiPageItem[]>(() => {
    const parsed = comments
      .filter((c) => c.body.startsWith(WIKI_PREFIX))
      .map((c) => {
        const rest = c.body.slice(WIKI_PREFIX.length);
        const parts = rest.split("|");
        const title = parts[0]?.trim() || "Untitled Page";
        const projectId = parts[1]?.trim() || "workspace";
        const htmlBody = parts.slice(2).join("|");
        return {
          id: c.id,
          title,
          projectId,
          projectName: projectMap.get(projectId) ?? "Workspace Knowledge Base",
          htmlBody,
          authorName: c.author?.name ?? "Team Member",
          createdAt: c.createdAt,
        };
      });

    if (parsed.length > 0) return parsed;
    return [
      {
        id: "builtin-welcome",
        title: "Engineering & Delivery Playbook",
        projectId: projects[0]?.id ?? "workspace",
        projectName: projects[0]?.name ?? "Workspace Knowledge Base",
        htmlBody:
          "<p>Central knowledge base for project specs, onboarding checklists, and client SOPs. Click <strong>New Page</strong> to add documentation linked to any project.</p>",
        authorName: "Portal Setup",
        createdAt: "",
      },
    ];
  }, [comments, projectMap, projects]);

  const [selectedId, setSelectedId] = React.useState(pages[0]?.id ?? "");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const activePage = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  // Create form state
  const [newTitle, setNewTitle] = React.useState("");
  const [newProjId, setNewProjId] = React.useState(projects[0]?.id ?? "workspace");
  const [newHtml, setNewHtml] = React.useState("<p>Write project documentation here...</p>");

  // Edit state
  const [editTitle, setEditTitle] = React.useState("");
  const [editHtml, setEditHtml] = React.useState("");

  React.useEffect(() => {
    if (activePage) {
      setEditTitle(activePage.title);
      setEditHtml(activePage.htmlBody);
      setEditing(false);
    }
  }, [activePage?.id]);

  const handleCreatePage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = sanitizeField(newTitle);
    if (!cleanTitle) return;
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: newProjId === "workspace" ? "Workspace" : "Project",
        entityId: newProjId,
        body: `${WIKI_PREFIX}${cleanTitle}|${newProjId}|${newHtml}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setNewTitle("");
      setNewHtml("<p></p>");
      setCreateOpen(false);
      toast.success("Wiki page created");
      router.refresh();
    });
  };

  const handleSaveEdit = () => {
    if (!activePage || activePage.id === "builtin-welcome") return;
    const cleanTitle = sanitizeField(editTitle) || activePage.title;
    startTransition(async () => {
      const res = await toggleTaskMetaCommentAction({
        orgSlug,
        commentId: activePage.id,
        body: `${WIKI_PREFIX}${cleanTitle}|${activePage.projectId}|${editHtml}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setEditing(false);
      toast.success("Page saved");
      router.refresh();
    });
  };

  const handleDeletePage = (id: string) => {
    if (id === "builtin-welcome") return;
    startTransition(async () => {
      const res = await deleteTaskMetaCommentAction({ orgSlug, commentId: id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Page deleted");
      router.refresh();
    });
  };

  // Group pages by Project for sidebar tree
  const treeGroups = React.useMemo(() => {
    const map = new Map<string, WikiPageItem[]>();
    for (const p of pages) {
      const bucket = map.get(p.projectName) ?? [];
      bucket.push(p);
      map.set(p.projectName, bucket);
    }
    return Array.from(map.entries());
  }, [pages]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Sidebar Tree */}
      <Card className="lg:col-span-4 xl:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3">
          <CardTitle className="text-sm font-semibold">Wiki Page Tree</CardTitle>
          {canWrite && (
            <Button size="xs" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              New Page
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          {treeGroups.map(([projName, groupPages]) => (
            <div key={projName} className="space-y-1">
              <div className="flex items-center gap-1.5 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Folder className="size-3.5 text-amber-500" />
                <span className="truncate">{projName}</span>
              </div>
              <div className="space-y-0.5 pl-3">
                {groupPages.map((pg) => {
                  const isActive = activePage?.id === pg.id;
                  return (
                    <button
                      key={pg.id}
                      type="button"
                      onClick={() => setSelectedId(pg.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition",
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{pg.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Main Rich-Text Viewer / Editor */}
      <Card className="lg:col-span-8 xl:col-span-9">
        {activePage ? (
          <>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Pages</span>
                  <ChevronRight className="size-3" />
                  <span>{activePage.projectName}</span>
                </div>
                <CardTitle className="text-lg">{activePage.title}</CardTitle>
                <CardDescription className="text-xs">
                  By {activePage.authorName}
                  {activePage.createdAt ? ` · ${formatDateTimeUtc(activePage.createdAt)} UTC` : ""}
                </CardDescription>
              </div>

              {canWrite && activePage.id !== "builtin-welcome" && (
                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <Button size="xs" variant="outline" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                      <Button size="xs" disabled={isPending} onClick={handleSaveEdit}>
                        Save Page
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleDeletePage(activePage.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-5">
              {editing ? (
                <div className="space-y-3">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="font-semibold"
                  />
                  <RichTextEditor
                    value={editHtml}
                    onChange={setEditHtml}
                    members={members}
                    mentionItems={[]}
                  />
                </div>
              ) : (
                <div
                  className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground [&_h1]:text-xl [&_h1]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(activePage.htmlBody) }}
                />
              )}
            </CardContent>
          </>
        ) : null}
      </Card>

      {/* New Wiki Page Drawer */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>New Wiki Page</SheetTitle>
            <SheetDescription>Create a collaborative rich-text knowledge page.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreatePage} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="wiki-title">Page Title</Label>
              <Input
                id="wiki-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. API Integration & Staging Runbook"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiki-project">Project</Label>
              <select
                id="wiki-project"
                value={newProjId}
                onChange={(e) => setNewProjId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="workspace">Workspace Knowledge Base</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <RichTextEditor
                value={newHtml}
                onChange={setNewHtml}
                members={members}
                mentionItems={[]}
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Publish Page
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CollaborationForumsTab({
  orgSlug,
  comments,
  projects,
  canWrite,
}: {
  orgSlug: string;
  comments: CommentDTO[];
  projects: Array<{ id: string; name: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const projectMap = React.useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const [projectFilter, setProjectFilter] = React.useState("");
  const [selectedTopicId, setSelectedTopicId] = React.useState<string | null>(null);
  const [newTopicOpen, setNewTopicOpen] = React.useState(false);
  const [topicTitle, setTopicTitle] = React.useState("");
  const [topicProjId, setTopicProjId] = React.useState(projects[0]?.id ?? "workspace");
  const [topicCategory, setTopicCategory] = React.useState("Architecture");
  const [topicBody, setTopicBody] = React.useState("");
  const [replyDraft, setReplyDraft] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const topics = React.useMemo<ForumTopicItem[]>(() => {
    const replyMap = new Map<string, ForumTopicItem["replies"]>();
    for (const c of comments) {
      if (!c.body.startsWith(REPLY_PREFIX)) continue;
      const rest = c.body.slice(REPLY_PREFIX.length);
      const sep = rest.indexOf("|");
      const targetTopicId = sep >= 0 ? rest.slice(0, sep).trim() : "";
      const bodyText = sep >= 0 ? rest.slice(sep + 1) : rest;
      if (!targetTopicId) continue;
      const list = replyMap.get(targetTopicId) ?? [];
      list.push({
        id: c.id,
        authorName: c.author?.name ?? "Team Member",
        body: bodyText,
        createdAt: c.createdAt,
      });
      replyMap.set(targetTopicId, list);
    }

    return comments
      .filter((c) => c.body.startsWith(FORUM_PREFIX))
      .map((c) => {
        const rest = c.body.slice(FORUM_PREFIX.length);
        const [rawTitle, rawCat, ...bodyParts] = rest.split("|");
        return {
          id: c.id,
          title: rawTitle?.trim() || "Discussion Topic",
          category: rawCat?.trim() || "General",
          projectId: c.entityId,
          projectName: projectMap.get(c.entityId) ?? "Workspace Forum",
          body: bodyParts.join("|"),
          authorName: c.author?.name ?? "Team Member",
          createdAt: c.createdAt,
          replies: replyMap.get(c.id) ?? [],
        };
      })
      .filter((t) => !projectFilter || t.projectId === projectFilter);
  }, [comments, projectMap, projectFilter]);

  const activeTopic = topics.find((t) => t.id === selectedTopicId) ?? topics[0] ?? null;

  const handleCreateTopic = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = sanitizeField(topicTitle);
    const cleanCat = sanitizeField(topicCategory);
    if (!cleanTitle || !topicBody.trim()) return;

    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: topicProjId === "workspace" ? "Workspace" : "Project",
        entityId: topicProjId,
        body: `${FORUM_PREFIX}${cleanTitle}|${cleanCat}|${topicBody.trim()}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTopicTitle("");
      setTopicBody("");
      setNewTopicOpen(false);
      toast.success("Forum discussion started");
      router.refresh();
    });
  };

  const handlePostReply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTopic || !replyDraft.trim()) return;
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: activeTopic.projectId === "workspace" ? "Workspace" : "Project",
        entityId: activeTopic.projectId,
        body: `${REPLY_PREFIX}${activeTopic.id}|${replyDraft.trim()}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setReplyDraft("");
      toast.success("Reply posted");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          aria-label="Filter forum threads by project"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {canWrite && (
          <Button size="sm" onClick={() => setNewTopicOpen(true)}>
            <Plus className="size-3.5" />
            New Topic
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Topics List */}
        <Card className="lg:col-span-5">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm font-semibold">
              Discussion Topics ({topics.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {topics.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No forum topics yet. Click &ldquo;New Topic&rdquo; to start a categorized thread.
              </p>
            ) : (
              topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 p-3.5 text-left transition hover:bg-muted/40",
                    activeTopic?.id === topic.id && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{topic.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {topic.replies.length} replies
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {topic.projectName}
                    </Badge>
                    <span>· {topic.category}</span>
                    <span>· {topic.authorName}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Thread Reader & Reply Box */}
        <Card className="lg:col-span-7">
          {activeTopic ? (
            <>
              <CardHeader className="border-b pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{activeTopic.projectName}</Badge>
                  <Badge variant="outline">{activeTopic.category}</Badge>
                </div>
                <CardTitle className="mt-1 text-base">{activeTopic.title}</CardTitle>
                <CardDescription className="text-xs">
                  Started by {activeTopic.authorName} · {formatDateTimeUtc(activeTopic.createdAt)}{" "}
                  UTC
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="rounded-lg border bg-muted/20 p-3.5 text-sm whitespace-pre-wrap">
                  {activeTopic.body}
                </div>

                <div className="space-y-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <MessageCircle className="size-3.5" />
                    Thread Replies ({activeTopic.replies.length})
                  </p>
                  {activeTopic.replies.map((reply) => (
                    <div key={reply.id} className="rounded-lg border p-3 text-xs">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{reply.authorName}</span>
                        <span className="font-normal text-muted-foreground">
                          {formatDateTimeUtc(reply.createdAt)} UTC
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-foreground/90">{reply.body}</p>
                    </div>
                  ))}
                </div>

                {canWrite && (
                  <form onSubmit={handlePostReply} className="flex gap-2 pt-2">
                    <Input
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Post a threaded reply..."
                      className="h-8 text-xs"
                    />
                    <Button type="submit" size="sm" className="h-8" disabled={isPending}>
                      <Send className="size-3.5" />
                      Reply
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-48 items-center justify-center text-xs text-muted-foreground">
              Select a forum topic on the left to view replies.
            </CardContent>
          )}
        </Card>
      </div>

      {/* New Topic Drawer */}
      <Sheet open={newTopicOpen} onOpenChange={setNewTopicOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Start Forum Discussion</SheetTitle>
            <SheetDescription>Create a threaded topic categorized by Project.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateTopic} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="forum-title">Topic Title</Label>
              <Input
                id="forum-title"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                placeholder="e.g. Multi-currency rounding standard for PHP/USD"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="forum-project">Project</Label>
                <select
                  id="forum-project"
                  value={topicProjId}
                  onChange={(e) => setTopicProjId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="workspace">Workspace General</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forum-cat">Category</Label>
                <select
                  id="forum-cat"
                  value={topicCategory}
                  onChange={(e) => setTopicCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="Architecture">Architecture</option>
                  <option value="Client Decision">Client Decision</option>
                  <option value="Design Critique">Design Critique</option>
                  <option value="Release Notes">Release Notes</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forum-body">Discussion Details</Label>
              <textarea
                id="forum-body"
                rows={4}
                value={topicBody}
                onChange={(e) => setTopicBody(e.target.value)}
                required
                placeholder="Describe the context and questions for the team..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setNewTopicOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Post Topic
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CollaborationDocumentsTab({
  orgSlug,
  comments,
  projects,
  canWrite,
}: {
  orgSlug: string;
  comments: CommentDTO[];
  projects: Array<{ id: string; name: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const projectMap = React.useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const [activeFolder, setActiveFolder] = React.useState<string>("ALL");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [docTitle, setDocTitle] = React.useState("");
  const [docFolder, setDocFolder] = React.useState(DEFAULT_FOLDERS[0]!);
  const [docVersion, setDocVersion] = React.useState("v1.0");
  const [docSize, setDocSize] = React.useState("240 KB");
  const [docProjId, setDocProjId] = React.useState(projects[0]?.id ?? "workspace");
  const [docUrl, setDocUrl] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const docs = React.useMemo<ExplorerDocItem[]>(() => {
    return comments
      .filter((c) => c.body.startsWith(EXPLORER_DOC_PREFIX))
      .map((c) => {
        const parts = c.body.slice(EXPLORER_DOC_PREFIX.length).split("|");
        const projId = parts[4]?.trim() || c.entityId || "workspace";
        return {
          id: c.id,
          title: parts[0]?.trim() || "Document",
          folder: parts[1]?.trim() || DEFAULT_FOLDERS[0]!,
          version: parts[2]?.trim() || "v1.0",
          sizeLabel: parts[3]?.trim() || "—",
          projectId: projId,
          projectName: projectMap.get(projId) ?? "Workspace",
          url: parts[5]?.trim() || "#",
          authorName: c.author?.name ?? "Team Member",
          createdAt: c.createdAt,
        };
      });
  }, [comments, projectMap]);

  const folders = React.useMemo(() => {
    const set = new Set(DEFAULT_FOLDERS);
    for (const d of docs) set.add(d.folder);
    return Array.from(set);
  }, [docs]);

  const visibleDocs =
    activeFolder === "ALL" ? docs : docs.filter((d) => d.folder === activeFolder);

  const handleUploadDoc = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = sanitizeField(docTitle);
    if (!cleanTitle) return;
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: docProjId === "workspace" ? "Workspace" : "Project",
        entityId: docProjId,
        body: `${EXPLORER_DOC_PREFIX}${cleanTitle}|${sanitizeField(docFolder)}|${sanitizeField(docVersion) || "v1.0"}|${sanitizeField(docSize) || "File"}|${docProjId}|${docUrl.trim() || "#"}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setDocTitle("");
      setDocUrl("");
      setUploadOpen(false);
      toast.success("Document uploaded to explorer");
      router.refresh();
    });
  };

  const handleBumpVersion = (doc: ExplorerDocItem) => {
    const match = doc.version.match(/v?(\d+)(?:\.(\d+))?/i);
    const major = Number(match?.[1] ?? 1);
    const minor = Number(match?.[2] ?? 0) + 1;
    const nextVersion = `v${major}.${minor}`;
    startTransition(async () => {
      const res = await toggleTaskMetaCommentAction({
        orgSlug,
        commentId: doc.id,
        body: `${EXPLORER_DOC_PREFIX}${doc.title}|${doc.folder}|${nextVersion}|${doc.sizeLabel}|${doc.projectId}|${doc.url}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Updated ${doc.title} to ${nextVersion}`);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Folders Sidebar */}
      <Card className="lg:col-span-4 xl:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3">
          <CardTitle className="text-sm font-semibold">Folders</CardTitle>
          {canWrite && (
            <Button size="xs" onClick={() => setUploadOpen(true)}>
              <Upload className="size-3.5" />
              Upload
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-1 p-3">
          <button
            type="button"
            onClick={() => setActiveFolder("ALL")}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition",
              activeFolder === "ALL"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="size-3.5" />
              All Documents
            </span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
              {docs.length}
            </Badge>
          </button>

          {folders.map((folder) => {
            const count = docs.filter((d) => d.folder === folder).length;
            return (
              <button
                key={folder}
                type="button"
                onClick={() => setActiveFolder(folder)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition",
                  activeFolder === folder
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <Folder className="size-3.5 shrink-0 text-amber-500" />
                  <span className="truncate">{folder}</span>
                </span>
                <span className="text-[10px] tabular-nums opacity-75">{count}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* File Explorer Table */}
      <Card className="lg:col-span-8 xl:col-span-9">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm font-semibold">
            {activeFolder === "ALL" ? "All Documents" : activeFolder} ({visibleDocs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Linked Project</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-xs text-muted-foreground">
                    No files in this folder yet. Click &ldquo;Upload&rdquo; to add a file.
                  </TableCell>
                </TableRow>
              ) : (
                visibleDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {doc.folder} · {doc.sizeLabel}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                        <History className="size-2.5" />
                        {doc.version}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doc.projectId !== "workspace" ? (
                        <Link href={`/${orgSlug}/projects/${doc.projectId}`}>
                          <Badge variant="secondary" className="text-[10px] hover:bg-accent">
                            {doc.projectName}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Workspace
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {doc.authorName}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {doc.url !== "#" && (
                          <Button asChild size="xs" variant="ghost">
                            <a href={doc.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-3.5" />
                            </a>
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => handleBumpVersion(doc)}
                            title="Upload minor version bump"
                          >
                            + Version
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upload File Drawer */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Upload Document</SheetTitle>
            <SheetDescription>Add a file with folder, version badge, and project tag.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUploadDoc} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-file">Select Local File (Optional)</Label>
              <Input
                id="doc-file"
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setDocTitle(f.name);
                    setDocSize(`${Math.max(1, Math.round(f.size / 1024))} KB`);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Document Name</Label>
              <Input
                id="doc-title"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Client-Architecture-Spec.pdf"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="doc-folder">Folder</Label>
                <select
                  id="doc-folder"
                  value={docFolder}
                  onChange={(e) => setDocFolder(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-ver">Version</Label>
                <Input
                  id="doc-ver"
                  value={docVersion}
                  onChange={(e) => setDocVersion(e.target.value)}
                  placeholder="v1.0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-proj">Linked Project Tag</Label>
              <select
                id="doc-proj"
                value={docProjId}
                onChange={(e) => setDocProjId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="workspace">Workspace Shared</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-url">External URL (Optional)</Label>
              <Input
                id="doc-url"
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save Document
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
