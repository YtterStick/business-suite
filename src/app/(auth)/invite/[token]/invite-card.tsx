"use client";

import * as React from "react";
import type { MembershipRole } from "@prisma/client";
import Link from "next/link";

import {
  acceptExistingUserInviteAction,
  registerAndAcceptInviteAction,
} from "@/app/(auth)/invite/[token]/actions";
import { TactiqLoader, TactiqMark, TactiqSpinner } from "@/components/brand/tactiq-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL } from "@/lib/rbac";

interface InviteAcceptanceCardProps {
  token: string;
  organizationName: string;
  invitedEmail: string;
  role: MembershipRole;
  invitedByName: string | null;
  signedInEmail: string | null;
}

export function InviteAcceptanceCard({
  token,
  organizationName,
  invitedEmail,
  role,
  invitedByName,
  signedInEmail,
}: InviteAcceptanceCardProps) {
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const emailMatchesSession =
    signedInEmail !== null && signedInEmail.toLowerCase() === invitedEmail.toLowerCase();

  const handleAcceptExisting = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptExistingUserInviteAction(token);
      if (!res.ok) setError(res.error.message);
    });
  };

  const handleRegisterAndAccept = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await registerAndAcceptInviteAction({ token, name, password });
      if (!res.ok) setError(res.error.message);
    });
  };

  return (
    <>
      {isPending && (
        <TactiqLoader
          overlay
          label={`Opening ${organizationName}...`}
          sublabel="Configuring your workspace access & projects"
        />
      )}
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <TactiqMark animated className="mx-auto size-10" />
          <CardTitle className="text-xl">Join {organizationName}</CardTitle>
          <CardDescription>
            {invitedByName ? `${invitedByName} invited ` : "You were invited "}
            <span className="font-medium text-foreground">{invitedEmail}</span> as{" "}
            <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailMatchesSession ? (
            <div className="space-y-3">
              <Button onClick={handleAcceptExisting} className="w-full" disabled={isPending}>
                {isPending && <TactiqSpinner className="size-4" />}
                Accept &amp; Open {organizationName}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRegisterAndAccept} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Full name</Label>
                <Input
                  id="invite-name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Create password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <TactiqSpinner className="size-4" />}
                Create Account &amp; Join
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account for {invitedEmail}?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in first
                </Link>
              </p>
            </form>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
