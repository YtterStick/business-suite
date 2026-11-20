"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addToTotals, formatCurrencyTotals } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SortableDealCard } from "@/modules/crm/components/deal-kanban-card";
import type { KanbanStageColumnDTO } from "@/modules/crm/deals.types";

export const STAGE_DROPPABLE_PREFIX = "stage:";

export function stageDroppableId(stageId: string): string {
  return `${STAGE_DROPPABLE_PREFIX}${stageId}`;
}

interface DealKanbanColumnProps {
  orgSlug: string;
  defaultCurrency: string;
  stage: KanbanStageColumnDTO;
  allStages: KanbanStageColumnDTO[];
  canWrite: boolean;
  isFirstStage?: boolean;
  isBoardEmpty?: boolean;
  seedingSample?: boolean;
  onQuickMove: (dealId: string, targetStageId: string) => void;
  onAddDealInStage: (stageId: string) => void;
  onLoadSampleData?: () => void;
}

export function DealKanbanColumn({
  orgSlug,
  defaultCurrency,
  stage,
  allStages,
  canWrite,
  isFirstStage = false,
  isBoardEmpty = false,
  seedingSample = false,
  onQuickMove,
  onAddDealInStage,
  onLoadSampleData,
}: DealKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageDroppableId(stage.id),
    data: {
      type: "stage",
      stageId: stage.id,
    },
  });

  const totalsByCurrency: Record<string, number> = {};
  const weightedByCurrency: Record<string, number> = {};

  for (const deal of stage.deals) {
    addToTotals(totalsByCurrency, deal.currency, deal.amount);
    addToTotals(weightedByCurrency, deal.currency, (deal.amount * deal.probability) / 100);
  }

  const isWonColumn = stage.type === "WON";
  const isLostColumn = stage.type === "LOST";

  return (
    <section
      aria-label={`${stage.name} stage`}
      className={cn(
        "flex h-full w-80 shrink-0 flex-col rounded-xl border bg-muted/35 transition-colors",
        isWonColumn && "border-emerald-500/30 bg-emerald-500/[0.04]",
        isLostColumn && "border-rose-500/20 bg-rose-500/[0.02]",
        isOver && "border-primary/60 bg-primary/[0.05] ring-2 ring-primary/20",
      )}
    >
      {/* Column Header */}
      <div className="flex flex-col gap-2 border-b px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: stage.color ?? "#64748b" }}
            />
            <h3 className="truncate text-sm font-semibold tracking-tight">{stage.name}</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px] tabular-nums">
              {stage.deals.length}
            </Badge>
          </div>

          {canWrite && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Add deal to ${stage.name}`}
              onClick={() => onAddDealInStage(stage.id)}
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrencyTotals(totalsByCurrency, defaultCurrency, { compact: true })}
          </span>
          {isWonColumn ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-3" />
              Auto-bills &amp; projects
            </span>
          ) : (
            <span className="tabular-nums">
              Weighted {formatCurrencyTotals(weightedByCurrency, defaultCurrency, { compact: true })}
            </span>
          )}
        </div>
      </div>

      {/* Droppable Deal Card List */}
      <div ref={setNodeRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        <SortableContext
          items={stage.deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {stage.deals.length === 0 ? (
            isBoardEmpty && isFirstStage ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-blue-500/40 bg-blue-500/[0.04] p-5 text-center">
                <span className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Sparkles className="size-4" />
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">Create your first deal</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Add a prospective deal here, then drag it to Closed Won to auto-create a Project &amp; Draft Invoice.
                </p>
                {canWrite && (
                  <div className="mt-4 flex w-full flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onAddDealInStage(stage.id)}
                      className="w-full gap-1.5"
                    >
                      <Plus className="size-3.5" />
                      Create First Deal
                    </Button>
                    {onLoadSampleData && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={seedingSample}
                        onClick={onLoadSampleData}
                        className="w-full gap-1.5 text-xs"
                      >
                        <Sparkles className="size-3.5 text-violet-600" />
                        {seedingSample ? "Loading Sample..." : "Load Sample Data"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "flex min-h-24 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground",
                  isWonColumn &&
                    "border-emerald-500/40 text-emerald-700/80 dark:text-emerald-300/80",
                )}
              >
                {isWonColumn
                  ? "Drop a deal here to mark Closed Won and auto-create an Invoice & Project"
                  : "Drop a deal here"}
              </div>
            )
          ) : (
            stage.deals.map((deal) => (
              <SortableDealCard
                key={deal.id}
                orgSlug={orgSlug}
                deal={deal}
                stages={allStages}
                canWrite={canWrite}
                onQuickMove={onQuickMove}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}
