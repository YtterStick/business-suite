"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { createWorkspaceAction } from "@/app/(auth)/onboarding/actions";
import { TactiqLoader, TactiqMark, TactiqSpinner } from "@/components/brand/tactiq-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function OnboardingSubmitState() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending && (
        <TactiqLoader
          overlay
          label="Launching your workspace..."
          sublabel="Setting up projects, phases & default pipeline"
        />
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <TactiqSpinner className="size-4" />}
        Create Workspace
      </Button>
    </>
  );
}

export function OnboardingForm({
  userName,
  error,
}: {
  userName: string;
  error?: string;
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <TactiqMark animated className="mx-auto size-10" />
        <CardTitle className="text-xl">Create your workspace</CardTitle>
        <CardDescription>
          Welcome, {userName}. Name your Tactiq workspace to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <form action={createWorkspaceAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="workspaceName">Workspace Name</Label>
            <Input
              id="workspaceName"
              name="workspaceName"
              placeholder="Your company or team name"
              required
              minLength={2}
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="defaultCurrency">Default Currency</Label>
            <select
              id="defaultCurrency"
              name="defaultCurrency"
              defaultValue="USD"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="USD">USD ($)</option>
              <option value="PHP">PHP (₱)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="SGD">SGD (S$)</option>
            </select>
          </div>

          <OnboardingSubmitState />
        </form>
      </CardContent>
    </Card>
  );
}
