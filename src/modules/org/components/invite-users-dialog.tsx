"use client";

import * as React from "react";
import type { MembershipRole, PortalProfile, UserType } from "@prisma/client";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { inviteMemberAction } from "@/modules/org/team.actions";

interface InviteUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  orgName: string;
  defaultUserType?: UserType;
  isOwner?: boolean;
}

export function InviteUsersDialog({
  open,
  onOpenChange,
  orgSlug,
  orgName,
  defaultUserType = "PORTAL",
  isOwner = false,
}: InviteUsersDialogProps) {
  const [email, setEmail] = React.useState("");
  const [userType, setUserType] = React.useState<UserType>(defaultUserType);
  const [role, setRole] = React.useState<MembershipRole>("MEMBER");
  const [portalProfile, setPortalProfile] = React.useState<PortalProfile>(
    defaultUserType === "CLIENT" ? "CLIENT" : "STANDARD",
  );
  const [createdInviteUrl, setCreatedInviteUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setCreatedInviteUrl(null);
      setCopied(false);
      setEmail("");
      setUserType(defaultUserType);
      setRole("MEMBER");
      setPortalProfile(defaultUserType === "CLIENT" ? "CLIENT" : "STANDARD");
    }
  }, [open, defaultUserType]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await inviteMemberAction({
        orgSlug,
        email,
        role,
        userType,
        portalProfile,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setCreatedInviteUrl(`${window.location.origin}${res.data.invitePath}`);
      setEmail("");
      toast.success(`Invitation created for ${res.data.email}`);
    });
  };

  const handleCopy = async () => {
    if (!createdInviteUrl) return;
    await navigator.clipboard.writeText(createdInviteUrl);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Invite User to {orgName}</SheetTitle>
          <SheetDescription>
            Generate a secure 7-day invite link for a Portal User or Client User.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4">
          {createdInviteUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Shareable Invite Link</p>
                <p className="mt-1 break-all font-mono text-xs">{createdInviteUrl}</p>
              </div>
              <SheetFooter className="p-0">
                <Button type="button" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </SheetFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="suite-invite-email">Email ID</Label>
                <Input
                  id="suite-invite-email"
                  type="email"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="suite-invite-type">User Type</Label>
                  <select
                    id="suite-invite-type"
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
                  <Label htmlFor="suite-invite-role">Role</Label>
                  <select
                    id="suite-invite-role"
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

              <div className="space-y-1.5">
                <Label htmlFor="suite-invite-profile">Portal Profile</Label>
                <select
                  id="suite-invite-profile"
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

              <SheetFooter className="p-0 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Create Invite Link
                </Button>
              </SheetFooter>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
