"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { loginAction } from "@/app/(auth)/login/actions";
import { AuthShell } from "@/components/brand/auth-shell";
import {
  AuthDivider,
  GoogleAuthButton,
  useGoogleAuthError,
} from "@/components/brand/google-auth-button";
import { TactiqMark } from "@/components/brand/tactiq-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const googleError = useGoogleAuthError();
  const [isPending, startTransition] = React.useTransition();

  const activeError = error ?? googleError;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await loginAction({ email, password });
      if (!res.ok) {
        setError(res.error.message);
      }
    });
  };

  return (
    <AuthShell>
      <Card className="border-border/80 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <TactiqMark animated className="mx-auto size-10 lg:hidden" />
          <CardTitle className="text-xl">Sign in to Tactiq</CardTitle>
          <CardDescription>
            Access CRM, Finance, and Projects for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleAuthButton mode="login" label="Continue with Google" />
          <AuthDivider />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Work email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="owner@acme.test"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {activeError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {activeError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              New to Tactiq?{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Create a workspace
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
