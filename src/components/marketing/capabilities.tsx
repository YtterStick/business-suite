import {
  BarChart3,
  Building2,
  History,
  Search,
  ShieldCheck,
  Users,
  Workflow as WorkflowIcon,
  Globe2,
} from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";

export function Capabilities() {
  return (
    <section id="capabilities" className="scroll-mt-20 border-t py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Enterprise-ready"
          title="Built for teams that outgrow spreadsheets"
          description="The controls and visibility larger organizations expect, without the enterprise complexity."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {/* Global search */}
          <article className="rounded-2xl border bg-card p-6 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/20">
                <Search className="size-5" />
              </span>
              <h3 className="text-lg font-semibold">Global Suite Search</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> anywhere to find any client, deal, project, task, or invoice across every app.
            </p>
            <div className="mt-5 overflow-hidden rounded-lg border bg-background">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
                <Search className="size-3.5" />
                website red…
              </div>
              {[
                ["Deal", "Website Redesign", "bg-sky-500"],
                ["Project", "Website Redesign · Delivery", "bg-violet-500"],
                ["Invoice", "INV-0043 · Website Redesign", "bg-emerald-500"],
              ].map(([kind, label, dot], i) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-3 py-2 text-xs ${i === 0 ? "bg-accent" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-1.5 rounded-full ${dot}`} />
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{kind}</span>
                </div>
              ))}
            </div>
          </article>

          {/* Automations */}
          <article className="rounded-2xl border bg-card p-6 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20">
                <WorkflowIcon className="size-5" />
              </span>
              <h3 className="text-lg font-semibold">Custom Workflow Automations</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Turn repetitive hand-offs into rules. When something happens in one app, Tactiq does the follow-up work in another.
            </p>
            <div className="mt-5 space-y-2">
              {[
                ["When deal is Closed Won", "Create project with budget"],
                ["When deal is Closed Won", "Draft invoice in Finance"],
                ["When expenses are selected", "Convert to one invoice"],
              ].map(([when, then]) => (
                <div key={then} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">IF</span>
                  <span className="truncate text-muted-foreground">{when}</span>
                  <span className="ml-auto rounded bg-indigo-500/10 px-1.5 py-0.5 font-medium text-indigo-600 dark:text-indigo-400">
                    THEN
                  </span>
                  <span className="truncate">{then}</span>
                </div>
              ))}
            </div>
          </article>

          {/* RBAC */}
          <article className="rounded-2xl border bg-card p-6 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                <ShieldCheck className="size-5" />
              </span>
              <h3 className="text-lg font-semibold">Role-Based Access &amp; Approvals</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Administrators, Managers, Employees, and Clients each see exactly what they should. Timesheets and expenses route for approval.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
              {[
                ["Administrator", "Full control"],
                ["Manager", "Approve & manage"],
                ["Employee", "Assigned work"],
                ["Client", "Shared items only"],
              ].map(([role, scope]) => (
                <div key={role} className="rounded-lg border bg-background px-3 py-2">
                  <p className="font-semibold">{role}</p>
                  <p className="text-muted-foreground">{scope}</p>
                </div>
              ))}
            </div>
          </article>

          {/* Reporting */}
          <article className="rounded-2xl border bg-card p-6 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
                <BarChart3 className="size-5" />
              </span>
              <h3 className="text-lg font-semibold">Real-Time Cross-App Reporting</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Pipeline, delivery, and cash flow on the same live numbers — no exports, no stale dashboards.
            </p>
            <div className="mt-5 flex h-28 items-end gap-2 rounded-lg border bg-background p-3">
              {[38, 52, 45, 66, 58, 74, 70, 88, 80, 95].map((h, i) => (
                <div key={i} className="flex flex-1 flex-col justify-end gap-0.5" style={{ height: "100%" }}>
                  <div className="rounded-sm bg-emerald-500/70" style={{ height: `${h * 0.45}%` }} />
                  <div className="rounded-sm bg-indigo-500/70" style={{ height: `${h * 0.45}%` }} />
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Building2, title: "Multiple workspaces", text: "One login for every business or client you run." },
            { icon: Users, title: "Client portal", text: "Share progress with clients without exposing internals." },
            { icon: History, title: "Audit trail", text: "Every important change recorded with who and when." },
            { icon: Globe2, title: "Timezone & currency aware", text: "Defaults to Asia/Manila and PHP — configurable per workspace." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border p-5 transition-colors hover:bg-muted/40">
              <Icon className="size-5 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{children}</kbd>
  );
}
