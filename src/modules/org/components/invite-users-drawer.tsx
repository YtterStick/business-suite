"use client";

import * as React from "react";
import type { MembershipRole, PortalProfile, UserType } from "@prisma/client";
import { Check, Copy, FileSpreadsheet, Loader2, Upload, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { inviteBatchAction } from "@/modules/org/team.actions";

interface InviteUsersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  orgName: string;
  projects: Array<{ id: string; name: string }>;
  defaultUserType?: UserType;
  isOwner?: boolean;
}

export function InviteUsersDrawer({
  open,
  onOpenChange,
  orgSlug,
  orgName,
  projects,
  defaultUserType = "PORTAL",
  isOwner = false,
}: InviteUsersDrawerProps) {
  const [emails, setEmails] = React.useState<string[]>([]);
  const [emailDraft, setEmailDraft] = React.useState("");
  const [userType, setUserType] = React.useState<UserType>(defaultUserType);
  const [role, setRole] = React.useState<MembershipRole>("MEMBER");
  const [portalProfile, setPortalProfile] = React.useState<PortalProfile>(
    defaultUserType === "CLIENT" ? "CLIENT" : "STANDARD",
  );
  const [assignedProjectId, setAssignedProjectId] = React.useState("");
  const [createdLinks, setCreatedLinks] = React.useState<
    Array<{ email: string; invitePath: string }>
  >([]);
  const [copiedEmail, setCopiedEmail] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setEmails([]);
      setEmailDraft("");
      setCreatedLinks([]);
      setUserType(defaultUserType);
      setRole("MEMBER");
      setPortalProfile(defaultUserType === "CLIENT" ? "CLIENT" : "STANDARD");
      setAssignedProjectId("");
    }
  }, [open, defaultUserType]);

  const commitEmails = (raw: string) => {
    const candidates = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));

    if (candidates.length === 0) return;
    setEmails((prev) => Array.from(new Set([...prev, ...candidates])));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (emailDraft.trim()) {
        commitEmails(emailDraft);
        setEmailDraft("");
      }
    } else if (event.key === "Backspace" && emailDraft === "" && emails.length > 0) {
      event.preventDefault();
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pendingList = [...emails];
    if (emailDraft.trim()) {
      const extra = emailDraft
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
      for (const e of extra) {
        if (!pendingList.includes(e)) pendingList.push(e);
      }
    }

    if (pendingList.length === 0) {
      toast.error("Enter at least one valid email address.");
      return;
    }

    startTransition(async () => {
      const res = await inviteBatchAction({
        orgSlug,
        items: pendingList.map((email) => ({
          email,
          role,
          userType,
          portalProfile,
          assignedProjectId: assignedProjectId || null,
        })),
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      if (res.data.skipped.length > 0) {
        toast.warning(
          `${res.data.skipped.length} email(s) skipped: ${res.data.skipped[0]?.reason}`,
        );
      }

      if (res.data.created.length > 0) {
        setCreatedLinks(res.data.created);
        setEmails([]);
        setEmailDraft("");
        toast.success(`Created ${res.data.created.length} invitation(s)`);
      }
    });
  };

  const copyLink = async (email: string, invitePath: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}${invitePath}`);
    setCopiedEmail(email);
    toast.success(`Copied invite link for ${email}`);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Invite Users to {orgName}
          </SheetTitle>
          <SheetDescription>
            Add one or more email tags, pick their Role &amp; Portal Profile, and optionally assign
            a starter project.
          </SheetDescription>
        </SheetHeader>

        {createdLinks.length > 0 ? (
          <div className="space-y-4 px-4 py-5">
            <p className="text-sm font-semibold">Shareable 7-Day Invite Links</p>
            <div className="space-y-2.5">
              {createdLinks.map((item) => (
                <div
                  key={item.email}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.email}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {item.invitePath}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => copyLink(item.email, item.invitePath)}
                  >
                    {copiedEmail === item.email ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    Copy
                  </Button>
                </div>
              ))}
            </div>
            <SheetFooter className="border-t pt-4">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email-tags">Email IDs (press Enter or comma)</Label>
              <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-2 text-sm shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                {emails.map((item) => (
                  <Badge key={item} variant="secondary" className="gap-1 pr-1 text-xs">
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => setEmails((prev) => prev.filter((e) => e !== item))}
                      className="rounded-full p-0.5 hover:bg-foreground/10"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  id="invite-email-tags"
                  type="text"
                  value={emailDraft}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes(",")) {
                      const parts = val.split(",");
                      const tail = parts.pop() ?? "";
                      commitEmails(parts.join(","));
                      setEmailDraft(tail);
                    } else {
                      setEmailDraft(val);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    if (emailDraft.trim()) {
                      commitEmails(emailDraft);
                      setEmailDraft("");
                    }
                  }}
                  placeholder={
                    emails.length === 0
                      ? "teammate@company.com, client@partner.com"
                      : "Add another email..."
                  }
                  className="min-w-36 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="drawer-user-type">User Type</Label>
                <select
                  id="drawer-user-type"
                  value={userType}
                  onChange={(e) => {
                    const next = e.target.value as UserType;
                    setUserType(next);
                    if (next === "CLIENT") {
                      setRole("MEMBER");
                      setPortalProfile("CLIENT");
                    } else if (portalProfile === "CLIENT") {
                      setPortalProfile("STANDARD");
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="PORTAL">Portal User</option>
                  <option value="CLIENT">Client User</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="drawer-role">Role</Label>
                <select
                  id="drawer-role"
                  value={userType === "CLIENT" ? "MEMBER" : role}
                  disabled={userType === "CLIENT"}
                  onChange={(e) => {
                    const nextRole = e.target.value as MembershipRole;
                    setRole(nextRole);
                    if (nextRole !== "OWNER" && portalProfile === "PORTAL_OWNER") {
                      setPortalProfile("STANDARD");
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="MEMBER">Employee</option>
                  <option value="ADMIN">Manager</option>
                  {isOwner && <option value="OWNER">Administrator</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="drawer-profile">Portal Profile</Label>
                <select
                  id="drawer-profile"
                  value={portalProfile}
                  onChange={(e) => {
                    const nextProfile = e.target.value as PortalProfile;
                    setPortalProfile(nextProfile);
                    if (nextProfile === "CLIENT") {
                      setUserType("CLIENT");
                      setRole("MEMBER");
                    } else {
                      setUserType("PORTAL");
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="STANDARD">Standard</option>
                  {isOwner && <option value="PORTAL_OWNER">Portal Owner</option>}
                  <option value="CLIENT">Client</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="drawer-project">Assign Project (optional)</Label>
                <select
                  id="drawer-project"
                  value={assignedProjectId}
                  onChange={(e) => setAssignedProjectId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">No initial project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Send Invite(s)
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function mapRoleToken(raw?: string): MembershipRole {
  const val = (raw ?? "").trim().toLowerCase();
  if (val === "administrator" || val === "owner" || val === "admin_owner") return "OWNER";
  if (val === "manager" || val === "admin") return "ADMIN";
  return "MEMBER";
}

function mapProfileToken(raw?: string): PortalProfile {
  const val = (raw ?? "").trim().toLowerCase();
  if (val === "portal owner" || val === "portal_owner") return "PORTAL_OWNER";
  if (val === "client") return "CLIENT";
  return "STANDARD";
}

export function CsvImportUsersDialog({
  open,
  onOpenChange,
  orgSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
}) {
  const [csvText, setCsvText] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const handleImport = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedItems: Array<{
      email: string;
      role: MembershipRole;
      userType: UserType;
      portalProfile: PortalProfile;
    }> = [];

    for (const line of lines) {
      const [rawEmail, rawRole, rawProfile] = line.split(",").map((c) => c.trim());
      if (!rawEmail || rawEmail.toLowerCase() === "email") continue;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) continue;
      const profile = mapProfileToken(rawProfile);
      parsedItems.push({
        email: rawEmail.toLowerCase(),
        role: mapRoleToken(rawRole),
        userType: profile === "CLIENT" ? "CLIENT" : "PORTAL",
        portalProfile: profile,
      });
    }

    if (parsedItems.length === 0) {
      toast.error("No valid CSV rows found. Format: email,role,portal_profile");
      return;
    }

    startTransition(async () => {
      const res = await inviteBatchAction({ orgSlug, items: parsedItems });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        `Imported ${res.data.created.length} invitation(s)` +
          (res.data.skipped.length > 0 ? ` (${res.data.skipped.length} skipped)` : ""),
      );
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-emerald-600" />
            Import Users via CSV
          </DialogTitle>
          <DialogDescription>
            Upload a `.csv` file or paste rows formatted as{" "}
            <code className="text-xs">email,role,portal_profile</code>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleImport} className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <Upload className="size-3.5" />
              <span>Choose CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
          </div>

          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={
              "email,role,portal_profile\nteammate@company.com,Employee,Standard\nmanager@company.com,Manager,Standard"
            }
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Import &amp; Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
