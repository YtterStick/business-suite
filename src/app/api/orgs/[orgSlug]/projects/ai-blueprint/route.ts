import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import type { ProjectBlueprintPhase } from "@/modules/projects/projects.types";
import { assertTenant, authorize } from "@/server/tenancy";

const requestSchema = z.object({
  prompt: z.string().trim().min(4, "Please describe the project you want to scaffold.").max(600),
});

export interface AiProjectBlueprint {
  title: string;
  descriptionHtml: string;
  durationDays: number;
  tags: string[];
  recommendedTabs: string[];
  isStrict: boolean;
  phases: ProjectBlueprintPhase[];
}

function buildDomainBlueprint(prompt: string): AiProjectBlueprint {
  const lower = prompt.toLowerCase();
  const cleanTitle = prompt
    .replace(/^(build|create|launch|plan|setup|implement|design)\s+(a|an|the)?\s*/i, "")
    .trim();
  const title =
    cleanTitle.length > 3
      ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1, 72)
      : "Custom Client Delivery Project";

  const isFinance = /erp|invoice|billing|finance|accounting|payroll|tax/i.test(lower);
  const isSecurity = /security|audit|compliance|soc2|iso|gdpr|pen/i.test(lower);
  const isMarketing = /marketing|campaign|launch|seo|brand|growth|webinar/i.test(lower);
  const isSoftware = /app|portal|api|saas|mobile|web|platform|integration|migration/i.test(lower);

  let phases: ProjectBlueprintPhase[];
  let tags: string[];
  let recommendedTabs = [
    "Dashboard",
    "Tasks",
    "Users",
    "Reports",
    "Phases",
    "Time Logs",
    "Feed",
    "Timesheet",
  ];
  let durationDays = 35;

  if (isFinance) {
    durationDays = 42;
    tags = ["finance", "erp", "billing"];
    recommendedTabs = [...recommendedTabs, "Finance", "Documents"];
    phases = [
      {
        name: "Discovery & Chart of Accounts",
        offsetDays: 10,
        tasks: [
          "Review tax rules (PHP/USD) & invoice numbering prefixes",
          "Import historical customer & opening ledger balances",
        ],
      },
      {
        name: "CRM-to-Finance Automation",
        offsetDays: 24,
        tasks: [
          "Test Closed Won deal -> Draft Invoice provisioning",
          "Configure payment methods & reconciliation alerts",
        ],
      },
      {
        name: "Parallel Close & Handover",
        offsetDays: 42,
        tasks: ["Run parallel month-end reconciliation", "Train finance controllers & sign off"],
      },
    ];
  } else if (isSecurity) {
    durationDays = 30;
    tags = ["security", "compliance", "audit"];
    recommendedTabs = [...recommendedTabs, "Bugs", "Documents"];
    phases = [
      {
        name: "Threat Model & Access Audit",
        offsetDays: 7,
        tasks: [
          "Verify multi-tenant organization isolation constraints",
          "Review RBAC permissions across Owner, Admin, and Member roles",
        ],
      },
      {
        name: "Hardening & Remediation",
        offsetDays: 21,
        tasks: [
          "Patch prioritized findings & verify audit logging",
          "Test backup restore & incident escalation runbook",
        ],
      },
      {
        name: "Compliance Sign-Off",
        offsetDays: 30,
        tasks: ["Deliver executive compliance report"],
      },
    ];
  } else if (isMarketing) {
    durationDays = 28;
    tags = ["marketing", "launch", "growth"];
    recommendedTabs = [...recommendedTabs, "Documents", "Forums", "Pages"];
    phases = [
      {
        name: "Positioning & Assets",
        offsetDays: 7,
        tasks: ["Finalize messaging & landing page copy", "Produce campaign creative assets"],
      },
      {
        name: "Campaign Execution",
        offsetDays: 18,
        tasks: [
          "Configure CRM lead capture & email sequences",
          "Launch paid & organic distribution channels",
        ],
      },
      {
        name: "Attribution & Optimization",
        offsetDays: 28,
        tasks: ["Review pipeline conversion metrics & ROI"],
      },
    ];
  } else if (isSoftware) {
    durationDays = 45;
    tags = ["engineering", "delivery", "sprint"];
    recommendedTabs = [...recommendedTabs, "Bugs", "Documents"];
    phases = [
      {
        name: "Architecture & Specification",
        offsetDays: 7,
        tasks: [
          "Confirm technical requirements & acceptance criteria",
          "Design database schema & API contracts",
        ],
      },
      {
        name: "Iterative Implementation",
        offsetDays: 28,
        tasks: [
          "Build core workflows & UI components",
          "Execute automated tests & security review",
        ],
      },
      {
        name: "UAT & Production Rollout",
        offsetDays: 45,
        tasks: [
          "Complete stakeholder UAT walkthrough",
          "Deploy to production & enable monitoring",
        ],
      },
    ];
  } else {
    tags = ["delivery", "onboarding", "client"];
    recommendedTabs = [...recommendedTabs, "Documents", "Bugs"];
    phases = [
      {
        name: "Kickoff & Alignment",
        offsetDays: 7,
        tasks: [
          "Host kickoff call & confirm stakeholders",
          "Document project scope, timeline & success metrics",
        ],
      },
      {
        name: "Execution & Checkpoints",
        offsetDays: 21,
        tasks: [
          "Complete primary deliverables & weekly status check-ins",
          "Review interim outputs with client",
        ],
      },
      {
        name: "Final Review & Sign-Off",
        offsetDays: 35,
        tasks: ["Deliver final handover package & close project"],
      },
    ];
  }

  const descriptionHtml = `<p><b>Objective:</b> ${prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p><p><b>Execution Plan:</b></p><ul>${phases
    .map((p) => `<li><b>${p.name}</b> (Day ${p.offsetDays}): ${p.tasks.join("; ")}</li>`)
    .join("")}</ul>`;

  return {
    title,
    descriptionHtml,
    durationDays,
    tags,
    recommendedTabs,
    isStrict: isSecurity || isFinance,
    phases,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await context.params;
    const tenant = await assertTenant(orgSlug);
    authorize(tenant, "projects.project.manage");

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid prompt." },
        { status: 400 },
      );
    }

    const blueprint = buildDomainBlueprint(parsed.data.prompt);
    return NextResponse.json({ blueprint });
  } catch (error) {
    if (error instanceof AppError) {
      const status =
        error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[api/projects/ai-blueprint] error", error);
    return NextResponse.json({ error: "Failed to generate blueprint." }, { status: 500 });
  }
}
