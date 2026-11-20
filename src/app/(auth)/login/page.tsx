"use client";

import * as React from "react";
import Link from "next/link";

import { loginAction } from "@/app/(auth)/login/actions";
import { AuthShell } from "@/components/brand/auth-shell";
import {
  AuthDivider,
  GoogleAuthButton,
  useGoogleAuthError,
} from "@/components/brand/google-auth-button";
import { TactiqLoader, TactiqMark, TactiqSpinner } from "@/components/brand/tactiq-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const googleError = useGoogleAuthError();
  const [isPending, startTransition] = React.useTransition();

  const activeError = error ?? googleError;
  const isAuthenticating = isPending || googleLoading;

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
      {isAuthenticating && (
        <TactiqLoader
          overlay
          label={googleLoading ? "Connecting to Google..." : "Signing you in to Tactiq..."}
          sublabel="Preparing your CRM, Finance & Projects dashboard"
        />
      )}

      <Card className="border-border/80 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <TactiqMark animated className="mx-auto size-10" />
          <CardTitle className="text-xl">Sign in to Tactiq</CardTitle>
          <CardDescription>
            Access CRM, Finance, and Projects for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleAuthButton
            mode="login"
            label="Continue with Google"
            onLoadingChange={setGoogleLoading}
          />
          <AuthDivider />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Work email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                placeholder="Enter your password"
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

            <Button type="submit" className="w-full" disabled={isAuthenticating}>
              {isPending && <TactiqSpinner className="size-4" />}
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
