"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
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
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const googleError = useGoogleAuthError();
  const [isPending, startTransition] = React.useTransition();
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [recoveryEmail, setRecoveryEmail] = React.useState("");
  const [recoverySubmitted, setRecoverySubmitted] = React.useState(false);

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

  const handleOpenForgot = () => {
    setRecoveryEmail(email);
    setRecoverySubmitted(false);
    setForgotOpen(true);
  };

  const handleRecoverySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recoveryEmail.trim()) return;
    setRecoverySubmitted(true);
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="login-password">Password</Label>
                <button
                  type="button"
                  onClick={handleOpenForgot}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
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

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              Reset your password
            </DialogTitle>
            <DialogDescription>
              Recover access to your Tactiq workspace account.
            </DialogDescription>
          </DialogHeader>

          {recoverySubmitted ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                If <span className="font-semibold text-foreground">{recoveryEmail}</span> is linked
                to a Google account, use <span className="font-medium">Continue with Google</span>{" "}
                above for instant sign-in. For email/password workspace accounts, ask your workspace
                Administrator to send a fresh workspace invitation or re-provision your credentials.
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setForgotOpen(false)}>
                  Back to Sign In
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="recovery-email">Work email</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Continue</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AuthShell>
  );
}
