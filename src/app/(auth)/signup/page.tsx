"use client";

import * as React from "react";
import Link from "next/link";

import { signupAction } from "@/app/(auth)/signup/actions";
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

export default function SignupPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [organizationName, setOrganizationName] = React.useState("");
  const [defaultCurrency, setDefaultCurrency] = React.useState<
    "PHP" | "USD" | "EUR" | "GBP" | "SGD"
  >("USD");
  const [error, setError] = React.useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const googleError = useGoogleAuthError();
  const [isPending, startTransition] = React.useTransition();

  const activeError = error ?? googleError;
  const isCreating = isPending || googleLoading;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await signupAction({
        name,
        email,
        password,
        organizationName,
        defaultCurrency,
      });
      if (!res.ok) {
        setError(res.error.message);
      }
    });
  };

  return (
    <AuthShell>
      {isCreating && (
        <TactiqLoader
          overlay
          label={googleLoading ? "Connecting to Google..." : "Creating your Tactiq workspace..."}
          sublabel="Provisioning CRM pipelines, Finance & Projects"
        />
      )}

      <Card className="border-border/80 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <TactiqMark animated className="mx-auto size-10" />
          <CardTitle className="text-xl">Create your Tactiq workspace</CardTitle>
          <CardDescription>
            Launch CRM, Finance, and Projects for your team in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleAuthButton
            mode="signup"
            label="Continue with Google"
            onLoadingChange={setGoogleLoading}
          />
          <AuthDivider label="or sign up with email" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Your full name</Label>
              <Input
                id="signup-name"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-org">Workspace name</Label>
              <Input
                id="signup-org"
                placeholder="Your company or team name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="signup-email">Work email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-currency">Currency</Label>
                <select
                  id="signup-currency"
                  value={defaultCurrency}
                  onChange={(e) =>
                    setDefaultCurrency(e.target.value as "PHP" | "USD" | "EUR" | "GBP" | "SGD")
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="USD">USD ($)</option>
                  <option value="PHP">PHP (₱)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="SGD">SGD (S$)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {activeError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {activeError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isCreating}>
              {isPending && <TactiqSpinner className="size-4" />}
              Create Workspace
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
