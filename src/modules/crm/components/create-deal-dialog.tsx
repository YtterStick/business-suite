"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { createDealAction } from "@/modules/crm/deals.actions";
import type {
  CreateDealResultDTO,
  KanbanStageColumnDTO,
  SelectOptionDTO,
} from "@/modules/crm/deals.types";

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  pipelineId: string;
  defaultCurrency: string;
  stages: KanbanStageColumnDTO[];
  initialStageId: string;
  companies: SelectOptionDTO[];
  contacts: Array<SelectOptionDTO & { companyId: string | null }>;
  onCreated: (result: CreateDealResultDTO) => void;
}

export function CreateDealDialog({
  open,
  onOpenChange,
  orgSlug,
  pipelineId,
  defaultCurrency,
  stages,
  initialStageId,
  companies,
  contacts,
  onCreated,
}: CreateDealDialogProps) {
  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("15000");
  const [currency, setCurrency] = React.useState(defaultCurrency || "PHP");
  const [stageId, setStageId] = React.useState(initialStageId);
  const [companyId, setCompanyId] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [expectedCloseDate, setExpectedCloseDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setStageId(initialStageId || stages[0]?.id || "");
      setCurrency(defaultCurrency || "PHP");
      setError(null);
    }
  }, [open, initialStageId, stages, defaultCurrency]);

  const filteredContacts = React.useMemo(() => {
    if (!companyId) return contacts;
    const matching = contacts.filter((c) => c.companyId === companyId);
    return matching.length > 0 ? matching : contacts;
  }, [companyId, contacts]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createDealAction({
        orgSlug,
        pipelineId,
        stageId,
        title,
        amount: Number(amount),
        currency,
        companyId: companyId || null,
        contactId: contactId || null,
        expectedCloseDate: expectedCloseDate || null,
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      onCreated(res.data);

      if (res.data.automation) {
        toast.success(`Deal "${res.data.deal.title}" closed won`, {
          description: `Created Draft Invoice ${res.data.automation.invoice.number} & Project "${res.data.automation.project.name}".`,
        });
      } else {
        toast.success(`Created deal "${res.data.deal.title}"`);
      }

      setTitle("");
      setAmount("15000");
      setCompanyId("");
      setContactId("");
      setExpectedCloseDate("");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
          <DialogDescription>
            Add an opportunity to your pipeline. Moving a deal to Closed Won automatically drafts
            an Invoice and delivery Project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deal-title">Deal title</Label>
            <Input
              id="deal-title"
              placeholder="e.g. Enterprise CRM Rollout — Phase 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="deal-amount">Amount</Label>
              <Input
                id="deal-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-currency">Currency</Label>
              <select
                id="deal-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="PHP">PHP (₱)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-stage">Pipeline stage</Label>
              <select
                id="deal-stage"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.probability}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deal-company">Company</Label>
              <select
                id="deal-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">No company linked</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-contact">Primary contact</Label>
              <select
                id="deal-contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">No contact linked</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-close-date">Expected close date</Label>
            <Input
              id="deal-close-date"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Create Deal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
