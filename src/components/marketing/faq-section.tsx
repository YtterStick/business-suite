"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Is Tactiq really free to use?",
    a: "Yes. All core CRM, Projects, and Finance capabilities are included inside your workspace out of the box—no locked modules or gated features—so sales, delivery, and billing work together from day one.",
  },
  {
    q: "How do CRM, Projects, and Finance share data automatically?",
    a: "All three apps run on the same underlying database. When a deal moves to Closed Won in CRM, Tactiq automatically generates the delivery project (using the deal value as the budget) and creates a linked draft invoice in Finance—while approved timesheets and expenses flow directly into billing.",
  },
  {
    q: "Can I invite external clients and team members to my workspace?",
    a: "Yes. Administrators can invite colleagues as Managers or Employees, and add external stakeholders with the Client role. Client accounts have scoped portal visibility to only the projects and deliverables shared with them.",
  },
  {
    q: "How does multi-workspace isolation work if I run multiple businesses?",
    a: "One Tactiq account can own or belong to multiple separate workspaces. Every workspace maintains strictly isolated records, URLs, members, currency settings, and audit history—and you can switch workspaces or create a new one anytime from the top bar.",
  },
  {
    q: "Can I import my existing contacts, tasks, or invoices from spreadsheets?",
    a: "Yes. Tactiq supports CSV data import so teams migrating from Excel, Trello, or Jira can bring contacts, project items, and catalogs in without manual re-entry, then connect them immediately across CRM, Projects, and Finance.",
  },
  {
    q: "Is my workspace data secure and backed up?",
    a: "Workspace data is encrypted in transit and at rest with daily automated backups. Every request enforces workspace role-based authorization, and key updates across deals, invoices, and approvals are logged in the workspace audit trail.",
  },
] as const;

export function FaqSection() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <section
      id="faq"
      className="scroll-mt-20 border-t bg-muted/20 py-16 sm:py-24 dark:bg-white/[0.015]"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Everything you need to know about running your business on Tactiq."
        />

        <div className="mt-10 divide-y rounded-2xl border bg-card sm:mt-14 dark:bg-white/[0.02]">
          {FAQS.map((item, idx) => {
            const isOpen = openIndex === idx;
            const panelId = `faq-panel-${idx}`;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/30 sm:px-6 sm:py-5"
                >
                  <span className="text-sm font-semibold sm:text-base">{item.q}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180 text-foreground",
                    )}
                  />
                </button>
                <div
                  id={panelId}
                  hidden={!isOpen}
                  className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6"
                >
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
