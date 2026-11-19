"use client";

import * as React from "react";
import type { MembershipRole, PortalProfile } from "@prisma/client";
import { Check, Filter, Minus, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export interface CustomUserViewConfig {
  id: string;
  label: string;
  statusFilter: "active" | "invited" | "deactivated" | "all";
  roleFilter: MembershipRole | "";
  profileFilter: PortalProfile | "";
}

export interface MultiFieldUserFilters {
  role: MembershipRole | "";
  portalProfile: PortalProfile | "";
  projectId: string;
  lastActivePreset: "" | "today" | "7d" | "30d" | "custom";
  lastActiveAfter: string;
}

export function CreateCustomViewDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (view: CustomUserViewConfig) => void;
}) {
  const [label, setLabel] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"active" | "invited" | "deactivated" | "all">("active");
  const [roleFilter, setRoleFilter] = React.useState<MembershipRole | "">("");
  const [profileFilter, setProfileFilter] = React.useState<PortalProfile | "">("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = label.trim();
    if (!clean) return;
    onSave({
      id: `custom:${Date.now()}`,
      label: clean,
      statusFilter,
      roleFilter,
      profileFilter,
    });
    setLabel("");
    setRoleFilter("");
    setProfileFilter("");
    setStatusFilter("active");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom View</DialogTitle>
          <DialogDescription>
            Save a reusable user filter preset inside the Custom Views dropdown.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cv-name">View Name</Label>
            <Input
              id="cv-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Delivery Managers"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cv-status">User Status</Label>
              <select
                id="cv-status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "active" | "invited" | "deactivated" | "all")
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="active">Active Users</option>
                <option value="deactivated">Inactive Users</option>
                <option value="invited">Invited Users</option>
                <option value="all">All Active &amp; Inactive</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cv-role">Role</Label>
              <select
                id="cv-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as MembershipRole | "")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Any Role</option>
                <option value="OWNER">Administrator</option>
                <option value="ADMIN">Manager</option>
                <option value="MEMBER">Employee</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cv-profile">Portal Profile</Label>
            <select
              id="cv-profile"
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value as PortalProfile | "")}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">Any Portal Profile</option>
              <option value="PORTAL_OWNER">Portal Owner</option>
              <option value="STANDARD">Standard</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save View</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UserMultiFilterSheet({
  open,
  onOpenChange,
  filters,
  onChangeFilters,
  onResetFilters,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MultiFieldUserFilters;
  onChangeFilters: (next: MultiFieldUserFilters) => void;
  onResetFilters: () => void;
  projects: Array<{ id: string; name: string }>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4 text-primary" />
            Filter Users
          </SheetTitle>
          <SheetDescription>
            Narrow users by role, portal profile, assigned project, and recent activity.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="mf-role">Role</Label>
            <select
              id="mf-role"
              value={filters.role}
              onChange={(e) =>
                onChangeFilters({ ...filters, role: e.target.value as MembershipRole | "" })
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">All Roles</option>
              <option value="OWNER">Administrator</option>
              <option value="ADMIN">Manager</option>
              <option value="MEMBER">Employee</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mf-profile">Portal Profile</Label>
            <select
              id="mf-profile"
              value={filters.portalProfile}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  portalProfile: e.target.value as PortalProfile | "",
                })
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">All Portal Profiles</option>
              <option value="PORTAL_OWNER">Portal Owner</option>
              <option value="STANDARD">Standard</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mf-project">Assigned Project</Label>
            <select
              id="mf-project"
              value={filters.projectId}
              onChange={(e) => onChangeFilters({ ...filters, projectId: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">Any Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mf-last-active">Last Active</Label>
            <select
              id="mf-last-active"
              value={filters.lastActivePreset}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  lastActivePreset: e.target.value as MultiFieldUserFilters["lastActivePreset"],
                })
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">Any time</option>
              <option value="today">Active today</option>
              <option value="7d">Active in last 7 days</option>
              <option value="30d">Active in last 30 days</option>
              <option value="custom">Active on or after date</option>
            </select>
          </div>

          {filters.lastActivePreset === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="mf-last-active-date">From Date</Label>
              <Input
                id="mf-last-active-date"
                type="date"
                value={filters.lastActiveAfter}
                onChange={(e) => onChangeFilters({ ...filters, lastActiveAfter: e.target.value })}
              />
            </div>
          )}
        </div>

        <SheetFooter className="border-t p-4">
          <Button type="button" variant="outline" onClick={onResetFilters}>
            Reset All
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const MATRIX_ROWS = [
  {
    capability: "Manage Portal Settings & Billing",
    owner: true,
    admin: false,
    member: false,
    client: false,
  },
  {
    capability: "Invite, Role-Edit & Deactivate Users",
    owner: true,
    admin: true,
    member: false,
    client: false,
  },
  {
    capability: "Approve Timesheets, Expenses & Phase Sign-offs",
    owner: true,
    admin: true,
    member: false,
    client: false,
  },
  {
    capability: "Delete Projects, Deals & Void Invoices",
    owner: true,
    admin: true,
    member: false,
    client: false,
  },
  {
    capability: "Create Projects, Tasks, Issues & Time Logs",
    owner: true,
    admin: true,
    member: true,
    client: false,
  },
  {
    capability: "View Shared Client Projects, Milestones & Files",
    owner: true,
    admin: true,
    member: true,
    client: true,
  },
];

export function RolesPermissionsMatrixDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-4 text-violet-600" />
            Roles &amp; Permissions Matrix
          </DialogTitle>
          <DialogDescription>
            Roles define organizational hierarchy while Portal Profiles refine module access.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Capability</TableHead>
                <TableHead className="text-center">
                  <Badge variant="outline">Administrator</Badge>
                </TableHead>
                <TableHead className="text-center">
                  <Badge variant="outline">Manager</Badge>
                </TableHead>
                <TableHead className="text-center">
                  <Badge variant="outline">Employee</Badge>
                </TableHead>
                <TableHead className="text-center">
                  <Badge variant="secondary">Client</Badge>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MATRIX_ROWS.map((row) => (
                <TableRow key={row.capability}>
                  <TableCell className="text-xs font-medium">{row.capability}</TableCell>
                  {[row.owner, row.admin, row.member, row.client].map((allowed, idx) => (
                    <TableCell key={idx} className="text-center">
                      {allowed ? (
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

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
