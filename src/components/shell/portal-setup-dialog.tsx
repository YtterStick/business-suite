"use client";

import * as React from "react";
import type { MembershipRole } from "@prisma/client";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  GitBranch,
  Loader2,
  Minus,
  Plus,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { updatePortalConfigAction } from "@/modules/org/team.actions";

export interface PortalConfigSummary {
  name: string;
  slug: string;
  defaultCurrency: string;
  timezone: string;
  invoicePrefix: string;
  quotePrefix: string;
  defaultPaymentTermsDays: number;
  restrictEmployeeReopen?: boolean;
}

type SetupSection = "portal" | "statuses" | "roles" | "blueprints";

const INITIAL_STATUS_GROUPS = [
  {
    entity: "Tasks",
    statuses: [
      { key: "TODO", label: "Open / To Do", color: "bg-slate-500" },
      { key: "IN_PROGRESS", label: "In Progress", color: "bg-blue-600" },
      { key: "IN_REVIEW", label: "In Review", color: "bg-amber-500" },
      { key: "DONE", label: "Closed / Done", color: "bg-emerald-600" },
    ],
  },
  {
    entity: "Projects",
    statuses: [
      { key: "PLANNING", label: "Planning", color: "bg-indigo-500" },
      { key: "ACTIVE", label: "Active", color: "bg-emerald-600" },
      { key: "ON_HOLD", label: "On Hold", color: "bg-amber-500" },
      { key: "COMPLETED", label: "Completed", color: "bg-slate-600" },
    ],
  },
  {
    entity: "Issues",
    statuses: [
      { key: "OPEN", label: "Open", color: "bg-rose-600" },
      { key: "IN_PROGRESS", label: "Investigating", color: "bg-amber-500" },
      { key: "RESOLVED", label: "Resolved", color: "bg-emerald-600" },
      { key: "CLOSED", label: "Closed", color: "bg-slate-500" },
    ],
  },
];

const BUILTIN_PRIORITIES = [
  { key: "LOW", label: "Low", color: "bg-slate-500" },
  { key: "MEDIUM", label: "Medium", color: "bg-blue-600" },
  { key: "HIGH", label: "High", color: "bg-amber-500" },
  { key: "URGENT", label: "Urgent / Critical", color: "bg-rose-600" },
];

const PERMISSION_MATRIX = [
  { capability: "Manage Portal Settings, Org Hours & Holidays", owner: true, admin: true, member: false, client: false },
  { capability: "Invite Users & Assign Roles / Profiles", owner: true, admin: true, member: false, client: false },
  { capability: "Approve Timesheets, Expenses & Phase Sign-offs", owner: true, admin: true, member: false, client: false },
  { capability: "Create & Edit Projects, Tasks, Phases & Issues", owner: true, admin: true, member: true, client: false },
  { capability: "Log Time & Submit Weekly Timesheets", owner: true, admin: true, member: true, client: false },
  { capability: "View Finance Invoices, Payments & Budget Burn", owner: true, admin: true, member: true, client: false },
  { capability: "View Shared Client Portal Projects & Deliverables", owner: true, admin: true, member: true, client: true },
];

export function PortalSetupDialog({
  open,
  onOpenChange,
  orgSlug,
  role,
  portalConfig,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  role: MembershipRole;
  portalConfig: PortalConfigSummary;
}) {
  const canManageSettings = can(role, "org.settings.manage");
  const [section, setSection] = React.useState<SetupSection>("portal");
  const [portalName, setPortalName] = React.useState(portalConfig.name);
  const [currency, setCurrency] = React.useState(portalConfig.defaultCurrency || "PHP");
  const [timezone, setTimezone] = React.useState(portalConfig.timezone || "Asia/Manila");
  const [restrictEmployeeReopen, setRestrictEmployeeReopen] = React.useState(
    Boolean(portalConfig.restrictEmployeeReopen),
  );
  const [isSaving, startTransition] = React.useTransition();

  // Organization Hours & Holidays
  const [workWeek, setWorkWeek] = React.useState("Mon – Fri (5 days)");
  const [shiftStart, setShiftStart] = React.useState("09:00");
  const [shiftEnd, setShiftEnd] = React.useState("18:00");
  const [holidays, setHolidays] = React.useState<Array<{ id: string; name: string; date: string }>>([
    { id: "h1", name: "New Year's Day", date: "2026-01-01" },
    { id: "h2", name: "Independence Day", date: "2026-06-12" },
  ]);
  const [holidayName, setHolidayName] = React.useState("");
  const [holidayDate, setHolidayDate] = React.useState("");

  // Custom Statuses & Priorities
  const [customStatusName, setCustomStatusName] = React.useState("");
  const [customStatusEntity, setCustomStatusEntity] = React.useState("Tasks");
  const [customStatuses, setCustomStatuses] = React.useState<
    Array<{ entity: string; label: string; color: string }>
  >([]);
  const [customPriorityName, setCustomPriorityName] = React.useState("");
  const [customPriorities, setCustomPriorities] = React.useState<
    Array<{ label: string; color: string }>
  >([]);

  // Blueprints & Workflow Rules
  const [rules, setRules] = React.useState({
    taskBlueprintActive: true,
    dealWonAutoProject: true,
    rollupCompletion: true,
    overdueTaskAlert: true,
    approvalBellNotify: true,
  });

  React.useEffect(() => {
    setPortalName(portalConfig.name);
    setCurrency(portalConfig.defaultCurrency || "PHP");
    setTimezone(portalConfig.timezone || "Asia/Manila");
    setRestrictEmployeeReopen(Boolean(portalConfig.restrictEmployeeReopen));
  }, [portalConfig]);

  React.useEffect(() => {
    try {
      const savedStatuses = window.localStorage.getItem(`bs_custom_statuses_${orgSlug}`);
      if (savedStatuses) setCustomStatuses(JSON.parse(savedStatuses));
      const savedPriorities = window.localStorage.getItem(`bs_custom_priorities_${orgSlug}`);
      if (savedPriorities) setCustomPriorities(JSON.parse(savedPriorities));
      const savedHolidays = window.localStorage.getItem(`bs_org_holidays_${orgSlug}`);
      if (savedHolidays) setHolidays(JSON.parse(savedHolidays));
      const savedHours = window.localStorage.getItem(`bs_org_hours_${orgSlug}`);
      if (savedHours) {
        const parsed = JSON.parse(savedHours) as {
          workWeek?: string;
          shiftStart?: string;
          shiftEnd?: string;
        };
        if (parsed.workWeek) setWorkWeek(parsed.workWeek);
        if (parsed.shiftStart) setShiftStart(parsed.shiftStart);
        if (parsed.shiftEnd) setShiftEnd(parsed.shiftEnd);
      }
      const savedRules = window.localStorage.getItem(`bs_portal_rules_${orgSlug}`);
      if (savedRules) setRules((prev) => ({ ...prev, ...JSON.parse(savedRules) }));
    } catch {
      // Ignore storage read issues
    }
  }, [orgSlug]);

  const handleSavePortal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      window.localStorage.setItem(
        `bs_org_hours_${orgSlug}`,
        JSON.stringify({ workWeek, shiftStart, shiftEnd }),
      );
    } catch {
      // Ignore storage error
    }
    startTransition(async () => {
      const res = await updatePortalConfigAction({
        orgSlug,
        name: portalName,
        defaultCurrency: currency === "USD" ? "USD" : "PHP",
        timezone,
        restrictEmployeeReopen,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Portal settings & organization hours saved");
    });
  };

  const handleAddHoliday = () => {
    if (!holidayName.trim() || !holidayDate) return;
    const next = [...holidays, { id: `${Date.now()}`, name: holidayName.trim(), date: holidayDate }];
    setHolidays(next);
    setHolidayName("");
    setHolidayDate("");
    try {
      window.localStorage.setItem(`bs_org_holidays_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
    toast.success("Holiday added");
  };

  const handleRemoveHoliday = (id: string) => {
    const next = holidays.filter((h) => h.id !== id);
    setHolidays(next);
    try {
      window.localStorage.setItem(`bs_org_holidays_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  };

  const handleAddCustomStatus = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = customStatusName.trim();
    if (!label) return;
    const next = [...customStatuses, { entity: customStatusEntity, label, color: "bg-violet-600" }];
    setCustomStatuses(next);
    setCustomStatusName("");
    try {
      window.localStorage.setItem(`bs_custom_statuses_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
    toast.success(`Added custom status "${label}"`);
  };

  const handleAddCustomPriority = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = customPriorityName.trim();
    if (!label) return;
    const next = [...customPriorities, { label, color: "bg-fuchsia-600" }];
    setCustomPriorities(next);
    setCustomPriorityName("");
    try {
      window.localStorage.setItem(`bs_custom_priorities_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
    toast.success(`Added custom priority "${label}"`);
  };

  const toggleRule = (key: keyof typeof rules) => {
    const next = { ...rules, [key]: !rules[key] };
    setRules(next);
    try {
      window.localStorage.setItem(`bs_portal_rules_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
    toast.success("Workflow rule updated");
  };

  const navItems: Array<{
    id: SetupSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "portal", label: "Portal Settings", icon: Sliders },
    { id: "statuses", label: "Custom Statuses & Priorities", icon: Tag },
    { id: "roles", label: "Roles & Profiles Matrix", icon: Shield },
    { id: "blueprints", label: "Blueprints & Automation", icon: Sparkles },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="size-4 text-violet-600" />
            Portal Setup &amp; Administration
          </DialogTitle>
          <DialogDescription>
            Configure organization hours, holidays, custom statuses, permissions matrix, and
            automation blueprints for{" "}
            <span className="font-medium text-foreground">{portalConfig.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Left Setup Navigation */}
          <nav
            aria-label="Portal Setup sections"
            className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b bg-muted/20 p-2 sm:w-56 sm:flex-col sm:border-r sm:border-b-0 sm:p-3"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium whitespace-nowrap transition",
                    active
                      ? "bg-background text-foreground shadow-2xs ring-1 ring-border"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Setup Content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {/* 1. PORTAL SETTINGS (Org Hours & Holidays) */}
            {section === "portal" && (
              <form onSubmit={handleSavePortal} className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold">Portal Settings &amp; Organization Hours</h3>
                  <p className="text-xs text-muted-foreground">
                    Organization naming, default currency, standard working hours, and holidays.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-org-name">Portal Name</Label>
                    <Input
                      id="setup-org-name"
                      value={portalName}
                      onChange={(e) => setPortalName(e.target.value)}
                      disabled={!canManageSettings}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-org-slug">Portal URL Slug</Label>
                    <Input id="setup-org-slug" value={`/${portalConfig.slug}`} disabled />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-currency">Default Currency</Label>
                    <select
                      id="setup-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      disabled={!canManageSettings}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-60"
                    >
                      <option value="PHP">PHP — Philippine Peso</option>
                      <option value="USD">USD — US Dollar</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-tz">Portal Timezone</Label>
                    <select
                      id="setup-tz"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      disabled={!canManageSettings}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-60"
                    >
                      <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                      <option value="UTC">UTC (GMT+0)</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                    </select>
                  </div>
                </div>

                {/* Business Hours */}
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Clock className="size-3.5 text-violet-600" />
                    Organization Business Hours
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Work Week</Label>
                      <select
                        value={workWeek}
                        onChange={(e) => setWorkWeek(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="Mon – Fri (5 days)">Mon – Fri (5 days)</option>
                        <option value="Mon – Sat (6 days)">Mon – Sat (6 days)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Start Time</Label>
                      <Input
                        type="time"
                        value={shiftStart}
                        onChange={(e) => setShiftStart(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">End Time</Label>
                      <Input
                        type="time"
                        value={shiftEnd}
                        onChange={(e) => setShiftEnd(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Company Holidays */}
                <div className="space-y-2.5 rounded-lg border p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <CalendarDays className="size-3.5 text-amber-600" />
                    Company Holidays ({holidays.length})
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {holidays.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs"
                      >
                        <span>
                          <span className="font-medium">{h.name}</span>{" "}
                          <span className="text-muted-foreground">({h.date})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveHoliday(h.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Input
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      placeholder="Holiday name..."
                      className="h-8 flex-1 text-xs"
                    />
                    <Input
                      type="date"
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      className="h-8 w-36 text-xs"
                    />
                    <Button type="button" size="xs" variant="outline" onClick={handleAddHoliday}>
                      <Plus className="size-3.5" />
                      Add Holiday
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Prefixes: {portalConfig.invoicePrefix} / {portalConfig.quotePrefix} · Net{" "}
                    {portalConfig.defaultPaymentTermsDays}d
                  </span>
                  {canManageSettings && (
                    <Button type="submit" size="sm" disabled={isSaving}>
                      {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                      Save Settings
                    </Button>
                  )}
                </div>
              </form>
            )}

            {/* 2. CUSTOM STATUSES & PRIORITIES */}
            {section === "statuses" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold">Custom Statuses &amp; Priorities</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure lifecycle statuses and priority tiers across Tasks, Projects, and
                    Issues.
                  </p>
                </div>

                <div className="space-y-3">
                  {INITIAL_STATUS_GROUPS.map((group) => {
                    const extras = customStatuses.filter((s) => s.entity === group.entity);
                    return (
                      <div key={group.entity} className="rounded-lg border p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.entity} Statuses
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {group.statuses.map((st) => (
                            <Badge key={st.key} variant="outline" className="gap-1.5 py-1">
                              <span className={cn("size-2 rounded-full", st.color)} />
                              {st.label}
                            </Badge>
                          ))}
                          {extras.map((st, idx) => (
                            <Badge key={`${st.label}-${idx}`} variant="secondary" className="gap-1.5 py-1">
                              <span className={cn("size-2 rounded-full", st.color)} />
                              {st.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleAddCustomStatus}
                  className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3"
                >
                  <div className="space-y-1">
                    <Label htmlFor="status-entity" className="text-xs">
                      Module
                    </Label>
                    <select
                      id="status-entity"
                      value={customStatusEntity}
                      onChange={(e) => setCustomStatusEntity(e.target.value)}
                      className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="Tasks">Tasks</option>
                      <option value="Projects">Projects</option>
                      <option value="Issues">Issues</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="status-label" className="text-xs">
                      Add Custom Status
                    </Label>
                    <Input
                      id="status-label"
                      value={customStatusName}
                      onChange={(e) => setCustomStatusName(e.target.value)}
                      placeholder="e.g. Client UAT Ready"
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button type="submit" size="sm" variant="outline">
                    <Plus className="size-3.5" />
                    Add Status
                  </Button>
                </form>

                <Separator />

                {/* Priorities Section */}
                <div className="space-y-3">
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Priority Levels
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {BUILTIN_PRIORITIES.map((p) => (
                        <Badge key={p.key} variant="outline" className="gap-1.5 py-1">
                          <span className={cn("size-2 rounded-full", p.color)} />
                          {p.label}
                        </Badge>
                      ))}
                      {customPriorities.map((p, idx) => (
                        <Badge key={`${p.label}-${idx}`} variant="secondary" className="gap-1.5 py-1">
                          <span className={cn("size-2 rounded-full", p.color)} />
                          {p.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleAddCustomPriority} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="prio-label" className="text-xs">
                        Add Custom Priority Label
                      </Label>
                      <Input
                        id="prio-label"
                        value={customPriorityName}
                        onChange={(e) => setCustomPriorityName(e.target.value)}
                        placeholder="e.g. Blocker / P0"
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button type="submit" size="sm" variant="outline">
                      <Plus className="size-3.5" />
                      Add Priority
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {/* 3. ROLES & PROFILES PERMISSION MATRIX */}
            {section === "roles" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Roles &amp; Profiles Permission Matrix</h3>
                  <p className="text-xs text-muted-foreground">
                    Hierarchical authority (`Administrator &gt; Manager &gt; Employee`) paired with
                    Portal Profiles (`Portal Owner`, `Standard`, `Client`).
                  </p>
                </div>

                {/* Task Reopen Permissions Toggle */}
                <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3.5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold">
                      Restrict reopening closed tasks to Admins &amp; Managers
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      When enabled, Employees cannot reopen Closed or Cancelled tasks (tasks linked
                      to approved timesheets or billed Finance invoices are always locked).
                    </p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={restrictEmployeeReopen}
                      disabled={!canManageSettings || isSaving}
                      onChange={(e) => {
                        const nextVal = e.target.checked;
                        setRestrictEmployeeReopen(nextVal);
                        startTransition(async () => {
                          const res = await updatePortalConfigAction({
                            orgSlug,
                            name: portalName,
                            defaultCurrency: currency === "USD" ? "USD" : "PHP",
                            timezone,
                            restrictEmployeeReopen: nextVal,
                          });
                          if (!res.ok) {
                            setRestrictEmployeeReopen(!nextVal);
                            toast.error(res.error.message);
                            return;
                          }
                          toast.success(
                            nextVal
                              ? "Closed task reopening restricted to Admins & Managers"
                              : "Employees allowed to reopen unlocked closed tasks",
                          );
                        });
                      }}
                      className="size-4 accent-primary"
                    />
                  </label>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capability / Module</TableHead>
                        <TableHead className="text-center">Administrator</TableHead>
                        <TableHead className="text-center">Manager</TableHead>
                        <TableHead className="text-center">Employee</TableHead>
                        <TableHead className="text-center">Client</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSION_MATRIX.map((row) => (
                        <TableRow key={row.capability}>
                          <TableCell className="text-xs font-medium">{row.capability}</TableCell>
                          {[row.owner, row.admin, row.member, row.client].map((ok, i) => (
                            <TableCell key={i} className="text-center">
                              {ok ? (
                                <Check className="mx-auto size-4 text-emerald-600" />
                              ) : (
                                <Minus className="mx-auto size-4 text-muted-foreground/40" />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <Button asChild size="xs" variant="outline" onClick={() => onOpenChange(false)}>
                    <Link href={`/${orgSlug}/projects/users`}>
                      Manage Portal &amp; Client Users →
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* 4. BLUEPRINTS & WORKFLOW AUTOMATION RULES */}
            {section === "blueprints" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold">
                    Blueprints &amp; Workflow Automation Rules
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Enforced task state blueprints and cross-module CRM/Finance/Projects
                    automations.
                  </p>
                </div>

                {/* Blueprint Flow Preview */}
                <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <GitBranch className="size-3.5 text-violet-600" />
                      Task Delivery Blueprint
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleRule("taskBlueprintActive")}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        rules.taskBlueprintActive
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {rules.taskBlueprintActive ? "Active" : "Paused"}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <Badge variant="outline">Open / To Do</Badge>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <Badge variant="outline">In Progress</Badge>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <Badge variant="outline">In Review</Badge>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <Badge>Closed / Done</Badge>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      key: "dealWonAutoProject" as const,
                      title: "Deal Closed Won -> Auto-Create Project & Draft Invoice",
                      description:
                        "Provisions a Delivery Project with starter Phases & Tasks plus a Finance Draft Invoice on Deal Won.",
                    },
                    {
                      key: "rollupCompletion" as const,
                      title: "Roll-up Dates, Hours & % Completion",
                      description:
                        "Rolls task hours and status completion percentage upward into Phases and Projects.",
                    },
                    {
                      key: "overdueTaskAlert" as const,
                      title: "Overdue Task & SLA Escalation",
                      description:
                        "Flags overdue tasks inside Projects Home and pushes alerts into the Notifications bell.",
                    },
                    {
                      key: "approvalBellNotify" as const,
                      title: "Timesheet, Expense & Phase Sign-off Routing",
                      description:
                        "Routes submitted sheets and claims directly to My Approvals for manager decision.",
                    },
                  ].map((rule) => {
                    const enabled = rules[rule.key];
                    return (
                      <div
                        key={rule.key}
                        className="flex items-start justify-between gap-3 rounded-lg border p-3.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2
                              className={cn(
                                "size-4 shrink-0",
                                enabled ? "text-emerald-600" : "text-muted-foreground",
                              )}
                            />
                            <span className="text-sm font-medium">{rule.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{rule.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleRule(rule.key)}
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                            enabled
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                        >
                          {enabled ? "Active" : "Paused"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
