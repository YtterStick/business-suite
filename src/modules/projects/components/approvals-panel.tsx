"use client";

import * as React from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Flag,
  Loader2,
  MessageSquare,
  Plus,
  Receipt,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatCurrency, formatDate, formatDateTimeUtc } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  bulkReviewApprovalsAction,
  createExpenseClaimAction,
  postApprovalCommentAction,
  requestMilestoneSignoffAction,
  reviewApprovalAction,
} from "@/modules/projects/projects-suite.actions";
import type { ApprovalsQueueDTO } from "@/modules/projects/projects-suite.service";

type ApprovalTab = "timesheets" | "expenses" | "milestones";
type ApprovalKind = "timesheet" | "expense" | "milestone";
type ApprovalPerspective = "pending" | "submitted_by_me" | "approved" | "rejected" | "all";

const PERSPECTIVE_OPTIONS: Array<{ id: ApprovalPerspective; label: string }> = [
  { id: "pending", label: "Pending My Approval" },
  { id: "submitted_by_me", label: "Submitted by Me" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

type SelectedApprovalDetail =
  | { kind: "timesheet"; id: string }
  | { kind: "expense"; id: string }
  | { kind: "milestone"; id: string }
  | null;

export function ApprovalsPanel({
  orgSlug,
  defaultCurrency,
  todayIso,
  queue,
  canWrite,
  canApprove,
  defaultTab = "timesheets",
  openExpenseInitially = false,
}: {
  orgSlug: string;
  defaultCurrency: string;
  todayIso: string;
  queue: ApprovalsQueueDTO;
  canWrite: boolean;
  canApprove: boolean;
  defaultTab?: ApprovalTab;
  openExpenseInitially?: boolean;
}) {
  const [activeTab, setActiveTab] = React.useState<ApprovalTab>(defaultTab);
  const [perspective, setPerspective] = React.useState<ApprovalPerspective>("all");
  const [projectFilter, setProjectFilter] = React.useState<string>("");
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [detailTarget, setDetailTarget] = React.useState<SelectedApprovalDetail>(null);

  // Required Rejection Reason Modal state
  const [rejectModalOpen, setRejectModalOpen] = React.useState(false);
  const [rejectIds, setRejectIds] = React.useState<string[]>([]);
  const [rejectKind, setRejectKind] = React.useState<ApprovalKind>("timesheet");
  const [rejectReason, setRejectReason] = React.useState("");

  // Drawer comments state
  const [commentDraft, setCommentDraft] = React.useState("");

  const [expenseOpen, setExpenseOpen] = React.useState(openExpenseInitially);
  const [signoffOpen, setSignoffOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  React.useEffect(() => {
    if (openExpenseInitially) {
      setActiveTab("expenses");
      setExpenseOpen(true);
    }
  }, [openExpenseInitially]);

  React.useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, perspective, projectFilter, search]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "expense-claim") {
        setActiveTab("expenses");
        setExpenseOpen(true);
      }
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, []);

  // Expense form state
  const [expProjectId, setExpProjectId] = React.useState(queue.projects[0]?.id ?? "");
  const [expTitle, setExpTitle] = React.useState("");
  const [expCategory, setExpCategory] = React.useState("Software & Cloud");
  const [expAmount, setExpAmount] = React.useState("2500");
  const [expCurrency, setExpCurrency] = React.useState(defaultCurrency || "PHP");
  const [expDate, setExpDate] = React.useState(todayIso);
  const [expNotes, setExpNotes] = React.useState("");

  // Milestone signoff request state
  const [msId, setMsId] = React.useState(queue.milestones[0]?.id ?? "");
  const [msNotes, setMsNotes] = React.useState("");

  const pendingTimesheets = queue.timesheets.filter((t) => t.status === "SUBMITTED").length;
  const pendingExpenses = queue.expenses.filter((e) => e.status === "PENDING").length;
  const pendingMilestones = queue.milestoneSignoffs.filter(
    (m) => m.signoffStatus === "PENDING",
  ).length;

  const q = search.trim().toLowerCase();
  const currentUserId = queue.currentUserId;

  const filteredTimesheets = React.useMemo(() => {
    return queue.timesheets.filter((ts) => {
      if (perspective === "pending" && ts.status !== "SUBMITTED") return false;
      if (perspective === "submitted_by_me" && ts.userId !== currentUserId) return false;
      if (perspective === "approved" && ts.status !== "APPROVED") return false;
      if (perspective === "rejected" && ts.status !== "REJECTED") return false;
      if (projectFilter && !ts.projectIds.includes(projectFilter)) return false;
      if (!q) return true;
      return (
        ts.userName.toLowerCase().includes(q) ||
        ts.userEmail.toLowerCase().includes(q) ||
        ts.projectNames.some((p) => p.toLowerCase().includes(q)) ||
        (ts.notes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [queue.timesheets, perspective, currentUserId, projectFilter, q]);

  const filteredExpenses = React.useMemo(() => {
    return queue.expenses.filter((exp) => {
      if (perspective === "pending" && exp.status !== "PENDING") return false;
      if (perspective === "submitted_by_me" && exp.submitterId !== currentUserId) return false;
      if (perspective === "approved" && exp.status !== "APPROVED") return false;
      if (perspective === "rejected" && exp.status !== "REJECTED") return false;
      if (projectFilter && exp.projectId !== projectFilter) return false;
      if (!q) return true;
      return (
        exp.title.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        exp.projectName.toLowerCase().includes(q) ||
        exp.submitterName.toLowerCase().includes(q)
      );
    });
  }, [queue.expenses, perspective, currentUserId, projectFilter, q]);

  const filteredMilestones = React.useMemo(() => {
    return queue.milestoneSignoffs.filter((ms) => {
      if (perspective === "pending" && ms.signoffStatus !== "PENDING") return false;
      if (perspective === "submitted_by_me" && ms.requestedById !== currentUserId) return false;
      if (perspective === "approved" && ms.signoffStatus !== "APPROVED") return false;
      if (perspective === "rejected" && ms.signoffStatus !== "REJECTED") return false;
      if (projectFilter && ms.projectId !== projectFilter) return false;
      if (!q) return true;
      return (
        ms.name.toLowerCase().includes(q) ||
        ms.projectName.toLowerCase().includes(q) ||
        (ms.signoffNotes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [queue.milestoneSignoffs, perspective, currentUserId, projectFilter, q]);

  const activeKind: ApprovalKind =
    activeTab === "timesheets" ? "timesheet" : activeTab === "expenses" ? "expense" : "milestone";

  const activeRowIds =
    activeTab === "timesheets"
      ? filteredTimesheets.map((t) => t.id)
      : activeTab === "expenses"
        ? filteredExpenses.map((e) => e.id)
        : filteredMilestones.map((m) => m.id);

  const allSelected = activeRowIds.length > 0 && activeRowIds.every((id) => selectedIds.includes(id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(activeRowIds);
  };

  const handleApproveSingle = (kind: ApprovalKind, id: string) => {
    startTransition(async () => {
      const res = await reviewApprovalAction({ orgSlug, kind, id, decision: "APPROVED" });
      if (!res.ok) toast.error(res.error.message);
      else toast.success("Item approved");
    });
  };

  const openRejectModal = (kind: ApprovalKind, ids: string[]) => {
    setRejectKind(kind);
    setRejectIds(ids);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkReviewApprovalsAction({
        orgSlug,
        kind: activeKind,
        ids: selectedIds,
        decision: "APPROVED",
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSelectedIds([]);
      toast.success(`Approved ${res.data.count} item(s)`);
    });
  };

  const handleConfirmReject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejectReason.trim()) {
      toast.error("Please enter a rejection reason.");
      return;
    }
    startTransition(async () => {
      const res = await bulkReviewApprovalsAction({
        orgSlug,
        kind: rejectKind,
        ids: rejectIds,
        decision: "REJECTED",
        reviewNotes: rejectReason,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setRejectModalOpen(false);
      setSelectedIds([]);
      toast.success(`Rejected ${res.data.count} item(s)`);
    });
  };

  const handleSubmitComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailTarget || !commentDraft.trim()) return;
    startTransition(async () => {
      const res = await postApprovalCommentAction({
        orgSlug,
        kind: detailTarget.kind,
        id: detailTarget.id,
        body: commentDraft,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setCommentDraft("");
      toast.success("Comment added to approval history");
    });
  };

  const handleSubmitExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createExpenseClaimAction({
        orgSlug,
        projectId: expProjectId,
        title: expTitle,
        category: expCategory,
        amount: Number(expAmount),
        currency: expCurrency,
        expenseDate: expDate,
        notes: expNotes || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setExpTitle("");
      setExpNotes("");
      setExpenseOpen(false);
      setActiveTab("expenses");
      toast.success("Expense claim submitted for approval");
    });
  };

  const handleRequestSignoff = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!msId) return;
    startTransition(async () => {
      const res = await requestMilestoneSignoffAction({
        orgSlug,
        milestoneId: msId,
        notes: msNotes || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setMsNotes("");
      setSignoffOpen(false);
      setActiveTab("milestones");
      toast.success("Phase sign-off requested");
    });
  };

  // Detail Drawer lookup
  const detailTimesheet =
    detailTarget?.kind === "timesheet"
      ? (queue.timesheets.find((t) => t.id === detailTarget.id) ?? null)
      : null;
  const detailExpense =
    detailTarget?.kind === "expense"
      ? (queue.expenses.find((e) => e.id === detailTarget.id) ?? null)
      : null;
  const detailMilestone =
    detailTarget?.kind === "milestone"
      ? (queue.milestoneSignoffs.find((m) => m.id === detailTarget.id) ?? null)
      : null;
  const detailComments = detailTarget
    ? (queue.commentsByKey[`${detailTarget.kind}:${detailTarget.id}`] ?? [])
    : [];

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review submitted weekly timesheets, expense claims, and phase sign-off requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && queue.milestones.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setSignoffOpen(true)}>
              <Flag className="size-3.5" />
              Request Phase Sign-off
            </Button>
          )}
          {canWrite && queue.projects.length > 0 && (
            <Button size="sm" onClick={() => setExpenseOpen(true)}>
              <Plus className="size-3.5" />
              Submit Expense Claim
            </Button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {[
          { id: "timesheets" as const, label: "Timesheets", pending: pendingTimesheets, icon: Clock },
          { id: "expenses" as const, label: "Expense Claims", pending: pendingExpenses, icon: Receipt },
          { id: "milestones" as const, label: "Phase Sign-offs", pending: pendingMilestones, icon: Flag },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              <Badge
                variant={active ? "secondary" : "outline"}
                className="px-1.5 py-0 text-[10px] tabular-nums"
              >
                {tab.pending} pending
              </Badge>
            </button>
          );
        })}
      </div>

      {/* ── Filter Toolbar (Perspective Switcher + Project Filter + Search) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERSPECTIVE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPerspective(opt.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                perspective === opt.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              aria-label="Filter approvals by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="">All Projects</option>
              {queue.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submitter or project..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── Bulk Selection Action Bar ─────────────────────────────────────── */}
      {canApprove && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Badge variant="default" className="tabular-nums">
              {selectedIds.length} selected
            </Badge>
            <span>Ready for bulk approval decision</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="xs" disabled={isPending} onClick={handleBulkApprove}>
              <Check className="size-3.5" />
              Approve Selected
            </Button>
            <Button
              size="xs"
              variant="destructive"
              disabled={isPending}
              onClick={() => openRejectModal(activeKind, selectedIds)}
            >
              <X className="size-3.5" />
              Reject Selected
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* ── Timesheets Queue ──────────────────────────────────────────────── */}
      {activeTab === "timesheets" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-violet-600" />
              Submitted Timesheets ({filteredTimesheets.length})
            </CardTitle>
            <CardDescription>
              Click any timesheet row to inspect daily project &amp; task hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all timesheets"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="size-4 accent-primary"
                    />
                  </TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Week Starting</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTimesheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No timesheets match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTimesheets.map((ts) => (
                    <TableRow
                      key={ts.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("input,button")) return;
                        setDetailTarget({ kind: "timesheet", id: ts.id });
                      }}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select timesheet for ${ts.userName}`}
                          checked={selectedIds.includes(ts.id)}
                          onChange={() => toggleSelect(ts.id)}
                          className="size-4 accent-primary"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{ts.userName}</div>
                        <div className="text-xs text-muted-foreground">{ts.userEmail}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-52 flex-wrap gap-1">
                          {ts.projectNames.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            ts.projectNames.map((name) => (
                              <Badge key={name} variant="outline" className="px-1.5 py-0 text-[10px]">
                                {name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(ts.weekStartIso, { withYear: true })}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {ts.totalHours.toFixed(2)}h
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ts.status === "APPROVED"
                              ? "default"
                              : ts.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {ts.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canApprove && ts.status === "SUBMITTED" ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              size="xs"
                              disabled={isPending}
                              onClick={() => handleApproveSingle("timesheet", ts.id)}
                            >
                              <Check className="size-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => openRejectModal("timesheet", [ts.id])}
                            >
                              <X className="size-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">View details →</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Expense Claims Queue ──────────────────────────────────────────── */}
      {activeTab === "expenses" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Claims ({filteredExpenses.length})</CardTitle>
            <CardDescription>
              Click any claim row to review receipt metadata, approval history, and notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all expense claims"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="size-4 accent-primary"
                    />
                  </TableHead>
                  <TableHead>Expense</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No expense claims match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((exp) => (
                    <TableRow
                      key={exp.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("input,button")) return;
                        setDetailTarget({ kind: "expense", id: exp.id });
                      }}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select expense ${exp.title}`}
                          checked={selectedIds.includes(exp.id)}
                          onChange={() => toggleSelect(exp.id)}
                          className="size-4 accent-primary"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{exp.title}</div>
                        <div className="text-xs text-muted-foreground">{exp.category}</div>
                      </TableCell>
                      <TableCell className="text-sm">{exp.projectName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {exp.submitterName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(exp.expenseDate, { withYear: true })}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {formatCurrency(exp.amount, exp.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            exp.status === "APPROVED"
                              ? "default"
                              : exp.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {exp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canApprove && exp.status === "PENDING" ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              size="xs"
                              disabled={isPending}
                              onClick={() => handleApproveSingle("expense", exp.id)}
                            >
                              <Check className="size-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => openRejectModal("expense", [exp.id])}
                            >
                              <X className="size-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">View details →</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Phase / Milestone Sign-offs Queue ─────────────────────────────── */}
      {activeTab === "milestones" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Phase &amp; Milestone Sign-offs ({filteredMilestones.length})
            </CardTitle>
            <CardDescription>
              Click any phase sign-off row to inspect milestone tasks, deliverables, and comments.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all phase sign-offs"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="size-4 accent-primary"
                    />
                  </TableHead>
                  <TableHead>Phase / Milestone</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Tasks Done</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Sign-off Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMilestones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No phase sign-offs match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMilestones.map((ms) => {
                    const done = ms.tasks.filter((t) => t.status === "DONE").length;
                    return (
                      <TableRow
                        key={ms.id}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("input,button")) return;
                          setDetailTarget({ kind: "milestone", id: ms.id });
                        }}
                        className="cursor-pointer hover:bg-muted/40"
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Select phase ${ms.name}`}
                            checked={selectedIds.includes(ms.id)}
                            onChange={() => toggleSelect(ms.id)}
                            className="size-4 accent-primary"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{ms.name}</div>
                          {ms.signoffNotes && (
                            <div className="text-xs text-muted-foreground">{ms.signoffNotes}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{ms.projectName}</TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {done}/{ms.tasks.length} tasks
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ms.dueDate ? formatDate(ms.dueDate, { withYear: true }) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              ms.signoffStatus === "APPROVED"
                                ? "default"
                                : ms.signoffStatus === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {ms.signoffStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canApprove && ms.signoffStatus === "PENDING" ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                size="xs"
                                disabled={isPending}
                                onClick={() => handleApproveSingle("milestone", ms.id)}
                              >
                                <Check className="size-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => openRejectModal("milestone", [ms.id])}
                              >
                                <X className="size-3.5" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">View details →</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Side-by-Side Interactive Approval Detail Slide-Over Drawer ─────── */}
      <Sheet open={detailTarget !== null} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {detailTimesheet && (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <Clock className="size-4 text-violet-600" />
                    Timesheet: {detailTimesheet.userName}
                  </SheetTitle>
                  <Badge
                    variant={
                      detailTimesheet.status === "APPROVED"
                        ? "default"
                        : detailTimesheet.status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {detailTimesheet.status}
                  </Badge>
                </div>
                <SheetDescription>
                  Week starting {formatDate(detailTimesheet.weekStartIso, { withYear: true })} ·{" "}
                  <span className="font-semibold text-foreground">
                    {detailTimesheet.totalHours.toFixed(2)} hours
                  </span>
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {canApprove && detailTimesheet.status === "SUBMITTED" && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleApproveSingle("timesheet", detailTimesheet.id)}
                      className="flex-1"
                    >
                      <Check className="size-4" />
                      Approve Timesheet
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => openRejectModal("timesheet", [detailTimesheet.id])}
                      className="flex-1"
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {detailTimesheet.reviewNotes && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                    <p className="font-semibold">Review Note:</p>
                    <p className="mt-1">{detailTimesheet.reviewNotes}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Daily Project &amp; Task Hours Breakdown
                  </h3>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Project / Task</TableHead>
                          <TableHead>Billing</TableHead>
                          <TableHead className="text-right">Hours</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailTimesheet.dailyEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-16 text-center text-xs text-muted-foreground">
                              No granular daily log rows attached to this sheet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detailTimesheet.dailyEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {formatDate(entry.dateIso)}
                              </TableCell>
                              <TableCell>
                                <p className="text-xs font-medium">{entry.projectName}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {entry.taskTitle || entry.notes || "General work"}
                                </p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {entry.billable ? "Billable" : "Internal"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs font-semibold tabular-nums">
                                {entry.hours.toFixed(2)}h
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Comment History */}
                <ApprovalCommentsSection
                  comments={detailComments}
                  commentDraft={commentDraft}
                  onCommentDraftChange={setCommentDraft}
                  onSubmit={handleSubmitComment}
                  isPending={isPending}
                />
              </div>
            </>
          )}

          {detailExpense && (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <Receipt className="size-4 text-orange-600" />
                    Expense Claim: {detailExpense.title}
                  </SheetTitle>
                  <Badge
                    variant={
                      detailExpense.status === "APPROVED"
                        ? "default"
                        : detailExpense.status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {detailExpense.status}
                  </Badge>
                </div>
                <SheetDescription>
                  Submitted by {detailExpense.submitterName} for {detailExpense.projectName}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {canApprove && detailExpense.status === "PENDING" && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleApproveSingle("expense", detailExpense.id)}
                      className="flex-1"
                    >
                      <Check className="size-4" />
                      Approve Claim
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => openRejectModal("expense", [detailExpense.id])}
                      className="flex-1"
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {/* Receipt Details Breakdown */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Receipt &amp; Claim Summary
                      </span>
                    </div>
                    <span className="text-lg font-bold tabular-nums">
                      {formatCurrency(detailExpense.amount, detailExpense.currency)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Project</p>
                      <p className="font-medium">{detailExpense.projectName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Category</p>
                      <p className="font-medium">{detailExpense.category}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expense Date</p>
                      <p className="font-medium">
                        {formatDate(detailExpense.expenseDate, { withYear: true })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reviewed By</p>
                      <p className="font-medium">{detailExpense.reviewedByName ?? "Pending"}</p>
                    </div>
                  </div>
                  {detailExpense.notes && (
                    <div className="border-t pt-2 text-xs">
                      <p className="text-muted-foreground">Submitter Notes</p>
                      <p className="mt-0.5">{detailExpense.notes}</p>
                    </div>
                  )}
                  {detailExpense.reviewNotes && (
                    <div className="rounded-md bg-amber-500/10 p-2 text-xs">
                      <p className="font-semibold">Decision Reason:</p>
                      <p>{detailExpense.reviewNotes}</p>
                    </div>
                  )}
                </div>

                <ApprovalCommentsSection
                  comments={detailComments}
                  commentDraft={commentDraft}
                  onCommentDraftChange={setCommentDraft}
                  onSubmit={handleSubmitComment}
                  isPending={isPending}
                />
              </div>
            </>
          )}

          {detailMilestone && (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <Flag className="size-4 text-violet-600" />
                    Phase Sign-off: {detailMilestone.name}
                  </SheetTitle>
                  <Badge
                    variant={
                      detailMilestone.signoffStatus === "APPROVED"
                        ? "default"
                        : detailMilestone.signoffStatus === "REJECTED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {detailMilestone.signoffStatus}
                  </Badge>
                </div>
                <SheetDescription>
                  {detailMilestone.projectName} · Due{" "}
                  {detailMilestone.dueDate
                    ? formatDate(detailMilestone.dueDate, { withYear: true })
                    : "No due date"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {canApprove && detailMilestone.signoffStatus === "PENDING" && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleApproveSingle("milestone", detailMilestone.id)}
                      className="flex-1"
                    >
                      <Check className="size-4" />
                      Approve Phase
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => openRejectModal("milestone", [detailMilestone.id])}
                      className="flex-1"
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {detailMilestone.signoffNotes && (
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                    <p className="font-semibold">Deliverable Sign-off Notes:</p>
                    <p className="mt-1 text-muted-foreground">{detailMilestone.signoffNotes}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Phase Deliverables &amp; Tasks ({detailMilestone.tasks.length})
                  </h3>
                  <div className="space-y-1.5">
                    {detailMilestone.tasks.length === 0 ? (
                      <p className="rounded-lg border p-3 text-xs text-muted-foreground">
                        No tasks assigned to this milestone yet.
                      </p>
                    ) : (
                      detailMilestone.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Priority: {t.priority}
                              {t.dueDate ? ` · Due ${formatDate(t.dueDate)}` : ""}
                            </p>
                          </div>
                          <Badge variant={t.status === "DONE" ? "default" : "outline"}>
                            {t.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <ApprovalCommentsSection
                  comments={detailComments}
                  commentDraft={commentDraft}
                  onCommentDraftChange={setCommentDraft}
                  onSubmit={handleSubmitComment}
                  isPending={isPending}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Required Rejection Reason Modal ───────────────────────────────── */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectIds.length} Selected Item(s)</DialogTitle>
            <DialogDescription>
              A clear rejection reason is required so the submitter knows what to revise.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmReject} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reject-reason">Rejection Reason *</Label>
              <Input
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Missing client receipt or incorrect task allocation..."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Confirm Rejection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Submit Expense Claim Slide-Over Drawer */}
      <Sheet open={expenseOpen} onOpenChange={setExpenseOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Submit Expense Claim</SheetTitle>
            <SheetDescription>Submit a project expense for manager approval.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmitExpense} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="exp-project">Project</Label>
              <select
                id="exp-project"
                value={expProjectId}
                onChange={(e) => setExpProjectId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {queue.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-title">Expense description</Label>
              <Input
                id="exp-title"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder="e.g. Cloud staging server & SSL certificate"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="exp-amount">Amount</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="1"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-currency">Currency</Label>
                <select
                  id="exp-currency"
                  value={expCurrency}
                  onChange={(e) => setExpCurrency(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="PHP">PHP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp-cat">Category</Label>
                <select
                  id="exp-cat"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="Software & Cloud">Software &amp; Cloud</option>
                  <option value="Travel & Meals">Travel &amp; Meals</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-notes">Receipt / Justification Notes</Label>
              <Input
                id="exp-notes"
                value={expNotes}
                onChange={(e) => setExpNotes(e.target.value)}
                placeholder="Optional invoice/receipt reference..."
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Submit Claim
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Request Phase Sign-off Dialog */}
      <Dialog open={signoffOpen} onOpenChange={setSignoffOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Phase Sign-off</DialogTitle>
            <DialogDescription>
              Send a project phase/milestone into the My Approvals queue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestSignoff} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signoff-ms">Phase / Milestone</Label>
              <select
                id="signoff-ms"
                value={msId}
                onChange={(e) => setMsId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {queue.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.projectName} — {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signoff-notes">Deliverable summary</Label>
              <Input
                id="signoff-notes"
                value={msNotes}
                onChange={(e) => setMsNotes(e.target.value)}
                placeholder="e.g. All kickoff deliverables completed & client confirmed"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSignoffOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Request Sign-off
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalCommentsSection({
  comments,
  commentDraft,
  onCommentDraftChange,
  onSubmit,
  isPending,
}: {
  comments: Array<{ id: string; authorName: string; body: string; createdAt: string }>;
  commentDraft: string;
  onCommentDraftChange: (v: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <MessageSquare className="size-3.5" />
        Approval Activity &amp; Comment History ({comments.length})
      </div>

      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments or decision history yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border bg-muted/20 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{c.authorName}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDateTimeUtc(c.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-foreground">{c.body}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          value={commentDraft}
          onChange={(e) => onCommentDraftChange(e.target.value)}
          placeholder="Add a review note or question..."
          className="h-8 text-xs"
        />
        <Button type="submit" size="xs" disabled={isPending || !commentDraft.trim()}>
          <Send className="size-3" />
          Post
        </Button>
      </form>
    </div>
  );
}
