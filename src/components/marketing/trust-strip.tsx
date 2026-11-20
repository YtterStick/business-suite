import { FileSpreadsheet, Globe2, Lock, ShieldCheck } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: FileSpreadsheet,
    title: "CSV Data Import",
    description: "Migrate from Excel, Trello, or Jira in minutes.",
    iconColor: "text-sky-500",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Data Isolation",
    description: "Dedicated tenant boundaries with granular access control.",
    iconColor: "text-emerald-500",
  },
  {
    icon: Lock,
    title: "Encrypted at Rest & Daily Backups",
    description: "Protected storage backed by complete change audit trails.",
    iconColor: "text-violet-500",
  },
  {
    icon: Globe2,
    title: "Multi-Currency & Asia/Manila Ready",
    description: "Native PHP, USD, EUR, GBP, SGD with GMT+8 defaults.",
    iconColor: "text-amber-500",
  },
] as const;

export function TrustStrip() {
  return (
    <section
      aria-label="Migration and platform reliability"
      className="border-t bg-muted/25 py-8 dark:bg-white/[0.015]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, title, description, iconColor }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-xl border bg-background/70 p-4 dark:bg-white/[0.02]"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                <Icon className={`size-4 ${iconColor}`} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
