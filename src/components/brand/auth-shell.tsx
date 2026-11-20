import * as React from "react";
import { Check, FolderKanban, Handshake, Receipt } from "lucide-react";

import { TactiqLogo } from "@/components/brand/tactiq-logo";

const FEATURES = [
  { icon: Handshake, label: "CRM pipelines that turn deals into projects" },
  { icon: FolderKanban, label: "Kanban, Gantt, phases & live time tracking" },
  { icon: Receipt, label: "Timesheets flow straight into invoices" },
];

function AnimatedBoardPreview() {
  return (
    <div className="tq-rise rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm [animation-delay:700ms]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-white/70">Website Revamp · Sprint 4</span>
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          On track
        </span>
      </div>
      <div className="relative">
        <div className="grid grid-cols-3 gap-3">
          {["To do", "In progress", "Done"].map((col) => (
            <div key={col} className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{col}</p>
              <div className="h-12 rounded-lg border border-dashed border-white/10" />
              <div className="h-8 rounded-lg bg-white/[0.05]" />
            </div>
          ))}
        </div>
        {/* Card that travels To do → In progress → Done */}
        <div className="tq-card-travel absolute top-[1.375rem] left-0 w-[calc((100%-1.5rem)/3)]">
          <div className="relative h-12 rounded-lg border border-indigo-400/40 bg-gradient-to-br from-indigo-500/30 to-cyan-400/20 px-2.5 py-2 shadow-lg shadow-indigo-500/20">
            <p className="truncate text-[10px] font-semibold text-white">TQ-T12 Checkout</p>
            <div className="mt-1.5 h-1 w-3/4 rounded-full bg-white/30" />
            <span className="tq-card-check absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-emerald-400 text-zinc-950">
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh bg-background">
      {/* Animated brand panel */}
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="tq-blob absolute -top-24 -left-24 size-96 rounded-full bg-violet-600/35 blur-3xl" />
          <div className="tq-blob absolute top-1/3 -right-32 size-[28rem] rounded-full bg-indigo-600/30 blur-3xl [animation-delay:-6s]" />
          <div className="tq-blob absolute -bottom-32 left-1/4 size-96 rounded-full bg-cyan-500/20 blur-3xl [animation-delay:-11s]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        </div>

        <div className="relative">
          <TactiqLogo animated markClassName="size-10" wordmarkClassName="text-2xl text-white" />
        </div>

        <div className="relative space-y-8">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">
            <span className="tq-rise block [animation-delay:150ms]">Plan it.</span>
            <span className="tq-rise block [animation-delay:300ms]">Track it.</span>
            <span className="tq-rise block bg-gradient-to-r from-violet-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent [animation-delay:450ms]">
              Bill it.
            </span>
          </h2>

          <ul className="space-y-3">
            {FEATURES.map((f, idx) => (
              <li
                key={f.label}
                className="tq-rise flex items-center gap-3 text-sm text-white/75"
                style={{ animationDelay: `${550 + idx * 120}ms` }}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
                  <f.icon className="size-4 text-indigo-300" />
                </span>
                {f.label}
              </li>
            ))}
          </ul>

          <AnimatedBoardPreview />
        </div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Tactiq · CRM, Finance & Projects in one workspace
        </p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="tq-rise w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
