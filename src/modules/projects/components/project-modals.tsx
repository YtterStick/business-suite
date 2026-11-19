"use client";

import * as React from "react";
import { CheckCircle2, Layers, Loader2, Sparkles } from "lucide-react";

import type { AiProjectBlueprint } from "@/app/api/orgs/[orgSlug]/projects/ai-blueprint/route";
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
import type { ProjectBlueprintPhase, ProjectTemplateKey } from "@/modules/projects/projects.types";

export interface TemplateGalleryItem {
  key: Exclude<ProjectTemplateKey, "NONE">;
  name: string;
  category: string;
  durationDays: number;
  summary: string;
  tags: string[];
  recommendedTabs: string[];
  phases: ProjectBlueprintPhase[];
}

export const TEMPLATE_GALLERY_ITEMS: TemplateGalleryItem[] = [
  {
    key: "CLIENT_ONBOARDING",
    name: "Client Onboarding",
    category: "Customer Success",
    durationDays: 30,
    summary: "Guide new B2B customers from kickoff call to user training and production go-live.",
    tags: ["onboarding", "client-success"],
    recommendedTabs: ["Dashboard", "Tasks", "Users", "Reports", "Documents", "Phases", "Time Logs", "Feed", "Timesheet"],
    phases: [
      {
        name: "Kickoff & Discovery",
        offsetDays: 7,
        tasks: ["Hold stakeholder kickoff", "Collect workspace & billing details"],
      },
      {
        name: "Configuration & Training",
        offsetDays: 21,
        tasks: ["Configure user roles & permissions", "Run team onboarding session"],
      },
      {
        name: "Go-Live & Handover",
        offsetDays: 30,
        tasks: ["Sign off production readiness"],
      },
    ],
  },
  {
    key: "SOFTWARE_DELIVERY",
    name: "Software Delivery",
    category: "Engineering",
    durationDays: 42,
    summary: "Structured SDLC template covering technical spec, core sprint build, QA, and UAT.",
    tags: ["engineering", "release"],
    recommendedTabs: ["Dashboard", "Tasks", "Users", "Reports", "Documents", "Phases", "Time Logs", "Bugs", "Feed", "Timesheet"],
    phases: [
      {
        name: "Architecture & Spec",
        offsetDays: 7,
        tasks: ["Finalize technical specification"],
      },
      {
        name: "Core Build",
        offsetDays: 28,
        tasks: ["Implement core modules", "Internal QA & security review"],
      },
      {
        name: "UAT & Deployment",
        offsetDays: 42,
        tasks: ["Client UAT walkthrough", "Production deployment & monitoring"],
      },
    ],
  },
  {
    key: "MARKETING_LAUNCH",
    name: "Marketing Campaign Launch",
    category: "Marketing",
    durationDays: 30,
    summary: "Plan creative briefs, CRM UTM tracking, multi-channel rollout, and ROI review.",
    tags: ["marketing", "campaign"],
    recommendedTabs: ["Dashboard", "Tasks", "Users", "Reports", "Documents", "Phases", "Feed", "Forums", "Pages", "Timesheet"],
    phases: [
      {
        name: "Creative & Messaging",
        offsetDays: 7,
        tasks: ["Approve campaign brief", "Design landing page & ad assets"],
      },
      {
        name: "Channel Rollout",
        offsetDays: 18,
        tasks: ["Configure email sequences & CRM UTM tracking", "Publish launch announcements"],
      },
      {
        name: "Attribution & Review",
        offsetDays: 30,
        tasks: ["Measure pipeline attribution & ROI"],
      },
    ],
  },
  {
    key: "FINANCE_ERP_ROLLOUT",
    name: "ERP & Finance Rollout",
    category: "Finance",
    durationDays: 35,
    summary: "Set up PHP/USD tax codes, CRM-to-invoice automation, and month-end reconciliation.",
    tags: ["finance", "erp", "billing"],
    recommendedTabs: ["Dashboard", "Tasks", "Users", "Reports", "Documents", "Phases", "Time Logs", "Finance", "Expense Claims", "Feed", "Timesheet"],
    phases: [
      {
        name: "Chart of Accounts & Tax Setup",
        offsetDays: 10,
        tasks: ["Configure PHP/USD tax codes & invoice prefixes", "Import opening balances"],
      },
      {
        name: "CRM Billing Integration",
        offsetDays: 25,
        tasks: ["Validate Closed Won draft invoice automation", "Reconcile payment gateways"],
      },
      {
        name: "Month-End Close Training",
        offsetDays: 35,
        tasks: ["Train finance team & run parallel close"],
      },
    ],
  },
  {
    key: "SECURITY_AUDIT",
    name: "Security & Compliance Audit",
    category: "Operations & Risk",
    durationDays: 30,
    summary: "Audit RBAC roles, multi-tenant isolation, remediation SLAs, and compliance sign-off.",
    tags: ["security", "compliance"],
    recommendedTabs: ["Dashboard", "Tasks", "Users", "Reports", "Documents", "Phases", "Bugs", "Feed", "Timesheet"],
    phases: [
      {
        name: "Access & Tenant Review",
        offsetDays: 7,
        tasks: ["Audit RBAC roles & MFA coverage", "Verify tenant isolation tests"],
      },
      {
        name: "Remediation",
        offsetDays: 21,
        tasks: ["Resolve high-severity findings", "Update incident response playbook"],
      },
      {
        name: "Sign-off",
        offsetDays: 30,
        tasks: ["Issue final compliance attestation"],
      },
    ],
  },
];

const SAMPLE_PROMPTS = [
  "6-week ERP & billing onboarding for a retail client",
  "Mobile customer portal build with UAT and deployment",
  "Q4 product launch marketing campaign with CRM tracking",
  "SOC 2 access and tenant isolation security audit",
];

export function AiProjectDialog({
  open,
  onOpenChange,
  orgSlug,
  onApplyBlueprint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  onApplyBlueprint: (blueprint: AiProjectBlueprint) => void;
}) {
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [blueprint, setBlueprint] = React.useState<AiProjectBlueprint | null>(null);

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/orgs/${encodeURIComponent(orgSlug)}/projects/ai-blueprint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        },
      );
      const data = (await res.json()) as { blueprint?: AiProjectBlueprint; error?: string };
      if (!res.ok || !data.blueprint) {
        setError(data.error ?? "Could not generate blueprint.");
      } else {
        setBlueprint(data.blueprint);
      }
    } catch {
      setError("Network error while generating blueprint.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600" />
            AI Project Generator
          </DialogTitle>
          <DialogDescription>
            Describe your project goal to auto-scaffold phases, tasks, tags, and tabs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGenerate} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-project-prompt">Project prompt</Label>
            <textarea
              id="ai-project-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Launch a 6-week ERP and CRM onboarding project for Metro Retail..."
              required
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_PROMPTS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setPrompt(sample)}
                className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {sample}
              </button>
            ))}
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate Blueprint
            </Button>
          </div>
        </form>

        {blueprint && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{blueprint.title}</p>
                <p className="text-xs text-muted-foreground">
                  {blueprint.phases.length} phases · ~{blueprint.durationDays} days
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {blueprint.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {blueprint.phases.map((phase) => (
                <div key={phase.name} className="rounded-md border bg-background p-2.5 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span>{phase.name}</span>
                    <span className="text-muted-foreground">Day {phase.offsetDays}</span>
                  </div>
                  <ul className="mt-1.5 space-y-1 text-muted-foreground">
                    {phase.tasks.map((task) => (
                      <li key={task} className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  onApplyBlueprint(blueprint);
                  onOpenChange(false);
                }}
              >
                Apply to Project Form
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BrowseTemplatesDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (item: TemplateGalleryItem) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-4 text-violet-600" />
            Browse Project Templates
          </DialogTitle>
          <DialogDescription>
            Choose a curated Zoho-style project blueprint with phases, starter tasks, and tabs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATE_GALLERY_ITEMS.map((tpl) => {
            const taskTotal = tpl.phases.reduce((sum, p) => sum + p.tasks.length, 0);
            return (
              <div
                key={tpl.key}
                className="flex flex-col justify-between rounded-lg border bg-card p-3.5 shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{tpl.name}</p>
                      <p className="text-[11px] text-muted-foreground">{tpl.category}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {tpl.durationDays}d
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{tpl.summary}</p>
                  <div className="flex flex-wrap gap-1">
                    {tpl.phases.map((p) => (
                      <Badge key={p.name} variant="secondary" className="text-[10px] font-normal">
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                  <span className="text-[11px] text-muted-foreground">
                    {tpl.phases.length} phases · {taskTotal} tasks
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    onClick={() => {
                      onSelectTemplate(tpl);
                      onOpenChange(false);
                    }}
                  >
                    Use Template
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
