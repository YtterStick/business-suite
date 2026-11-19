"use client";

import * as React from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CheckCircle2, Filter, Plus, Search, Sparkles, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addToTotals, formatCurrencyTotals } from "@/lib/format";
import { CreateDealDialog } from "@/modules/crm/components/create-deal-dialog";
import { DealCardSurface } from "@/modules/crm/components/deal-kanban-card";
import {
  DealKanbanColumn,
  STAGE_DROPPABLE_PREFIX,
} from "@/modules/crm/components/deal-kanban-column";
import { moveDealStageAction } from "@/modules/crm/deals.actions";
import type {
  CreateDealResultDTO,
  KanbanBoardDTO,
  KanbanDealCardDTO,
  KanbanStageColumnDTO,
} from "@/modules/crm/deals.types";

interface DealKanbanBoardProps {
  orgSlug: string;
  defaultCurrency: string;
  initialBoard: KanbanBoardDTO;
  canWrite: boolean;
  openCreateInitially?: boolean;
}

interface OptimisticMovePayload {
  dealId: string;
  targetStageId: string;
  beforeDealId: string | null;
  afterDealId: string | null;
}

function applyDealMove(
  stages: KanbanStageColumnDTO[],
  move: OptimisticMovePayload,
): KanbanStageColumnDTO[] {
  let movingDeal: KanbanDealCardDTO | null = null;
  for (const stage of stages) {
    const found = stage.deals.find((d) => d.id === move.dealId);
    if (found) {
      movingDeal = found;
      break;
    }
  }
  if (!movingDeal) return stages;

  const targetStage = stages.find((s) => s.id === move.targetStageId);
  if (!targetStage) return stages;

  const updatedDeal: KanbanDealCardDTO = {
    ...movingDeal,
    stageId: targetStage.id,
    probability: targetStage.probability,
    status:
      targetStage.type === "WON"
        ? "CLOSED_WON"
        : targetStage.type === "LOST"
          ? "CLOSED_LOST"
          : "OPEN",
  };

  return stages.map((stage) => {
    const withoutMoving = stage.deals.filter((d) => d.id !== move.dealId);
    if (stage.id !== targetStage.id) {
      return { ...stage, deals: withoutMoving };
    }

    let insertIndex = withoutMoving.length;
    if (move.afterDealId) {
      const idx = withoutMoving.findIndex((d) => d.id === move.afterDealId);
      if (idx !== -1) insertIndex = idx;
    } else if (move.beforeDealId) {
      const idx = withoutMoving.findIndex((d) => d.id === move.beforeDealId);
      if (idx !== -1) insertIndex = idx + 1;
    }

    const nextDeals = [...withoutMoving];
    nextDeals.splice(insertIndex, 0, updatedDeal);
    return { ...stage, deals: nextDeals };
  });
}

export function DealKanbanBoard({
  orgSlug,
  defaultCurrency,
  initialBoard,
  canWrite,
  openCreateInitially = false,
}: DealKanbanBoardProps) {
  const router = useRouter();
  const dndContextId = React.useId();
  const [boardStages, setBoardStages] = React.useState<KanbanStageColumnDTO[]>(initialBoard.stages);
  const [optimisticStages, addOptimisticMove] = React.useOptimistic(
    boardStages,
    applyDealMove,
  );
  const [, startTransition] = React.useTransition();

  const [activeDealId, setActiveDealId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showLostColumn, setShowLostColumn] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(openCreateInitially);
  const [createStageId, setCreateStageId] = React.useState(initialBoard.stages[0]?.id ?? "");

  React.useEffect(() => {
    setBoardStages(initialBoard.stages);
  }, [initialBoard.stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findDealLocation = React.useCallback(
    (dealId: string) => {
      for (const stage of optimisticStages) {
        const index = stage.deals.findIndex((d) => d.id === dealId);
        if (index !== -1) {
          return { stage, deal: stage.deals[index]!, index };
        }
      }
      return null;
    },
    [optimisticStages],
  );

  const activeDeal = React.useMemo(
    () => (activeDealId ? (findDealLocation(activeDealId)?.deal ?? null) : null),
    [activeDealId, findDealLocation],
  );

  const visibleStages = React.useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return optimisticStages
      .filter((stage) => showLostColumn || stage.type !== "LOST")
      .map((stage) => {
        if (!normalized) return stage;
        return {
          ...stage,
          deals: stage.deals.filter(
            (deal) =>
              deal.title.toLowerCase().includes(normalized) ||
              deal.company?.name.toLowerCase().includes(normalized) ||
              deal.contact?.fullName.toLowerCase().includes(normalized),
          ),
        };
      });
  }, [optimisticStages, searchQuery, showLostColumn]);

  const metrics = React.useMemo(() => {
    const openTotals: Record<string, number> = {};
    const weightedTotals: Record<string, number> = {};
    const wonTotals: Record<string, number> = {};
    let openCount = 0;
    let wonCount = 0;

    for (const stage of optimisticStages) {
      for (const deal of stage.deals) {
        if (stage.type === "WON") {
          wonCount += 1;
          addToTotals(wonTotals, deal.currency, deal.amount);
        } else if (stage.type === "OPEN") {
          openCount += 1;
          addToTotals(openTotals, deal.currency, deal.amount);
          addToTotals(weightedTotals, deal.currency, (deal.amount * deal.probability) / 100);
        }
      }
    }

    return { openTotals, weightedTotals, wonTotals, openCount, wonCount };
  }, [optimisticStages]);

  const commitStageMove = React.useCallback(
    (payload: OptimisticMovePayload, dealTitle: string) => {
      const targetStage = boardStages.find((s) => s.id === payload.targetStageId);

      startTransition(async () => {
        addOptimisticMove(payload);

        const res = await moveDealStageAction({
          orgSlug,
          dealId: payload.dealId,
          targetStageId: payload.targetStageId,
          beforeDealId: payload.beforeDealId,
          afterDealId: payload.afterDealId,
        });

        if (!res.ok) {
          toast.error("Could not move deal", {
            description: res.error.message,
          });
          return;
        }

        setBoardStages((prev) => {
          const moved = applyDealMove(prev, payload);
          if (!res.data.automation) return moved;

          return moved.map((stage) => ({
            ...stage,
            deals: stage.deals.map((d) =>
              d.id === payload.dealId
                ? {
                    ...d,
                    status: res.data.deal.status,
                    probability: res.data.deal.probability,
                    closedAt: res.data.deal.closedAt,
                    invoiceCount: Math.max(d.invoiceCount, 1),
                    projectCount: Math.max(d.projectCount, 1),
                    latestInvoiceNumber: res.data.automation?.invoice.number ?? d.latestInvoiceNumber,
                    latestProjectId: res.data.automation?.project.id ?? d.latestProjectId,
                  }
                : d,
            ),
          }));
        });

        if (res.data.automation) {
          const { invoice, project } = res.data.automation;
          toast.success(`"${dealTitle}" marked Closed Won`, {
            description: `Provisioned Draft Invoice ${invoice.number} & Project "${project.name}".`,
            action: {
              label: "View Invoice",
              onClick: () => router.push(`/${orgSlug}/finance/invoices`),
            },
          });
        } else if (targetStage) {
          toast.success(`Moved "${dealTitle}" to ${targetStage.name}`);
        }
      });
    },
    [addOptimisticMove, boardStages, orgSlug, router],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDealId(null);
    const { active, over } = event;
    if (!over || !canWrite) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const sourceLoc = findDealLocation(activeId);
    if (!sourceLoc) return;

    let targetStage: KanbanStageColumnDTO | undefined;
    let beforeDealId: string | null = null;
    let afterDealId: string | null = null;

    if (overId.startsWith(STAGE_DROPPABLE_PREFIX)) {
      const targetStageId = overId.slice(STAGE_DROPPABLE_PREFIX.length);
      targetStage = optimisticStages.find((s) => s.id === targetStageId);
      if (targetStage) {
        const remaining = targetStage.deals.filter((d) => d.id !== activeId);
        beforeDealId = remaining[remaining.length - 1]?.id ?? null;
      }
    } else {
      const overLoc = findDealLocation(overId);
      if (!overLoc) return;
      targetStage = overLoc.stage;

      const remaining = targetStage.deals.filter((d) => d.id !== activeId);
      const targetIndex = remaining.findIndex((d) => d.id === overId);

      if (targetIndex === -1) {
        beforeDealId = remaining[remaining.length - 1]?.id ?? null;
      } else if (sourceLoc.stage.id === targetStage.id && sourceLoc.index < overLoc.index) {
        // Dragging down within the same column places the card after the hovered item.
        beforeDealId = remaining[targetIndex]?.id ?? null;
        afterDealId = remaining[targetIndex + 1]?.id ?? null;
      } else {
        // Dragging up or from another column places the card before the hovered item.
        beforeDealId = remaining[targetIndex - 1]?.id ?? null;
        afterDealId = remaining[targetIndex]?.id ?? null;
      }
    }

    if (!targetStage) return;

    commitStageMove(
      {
        dealId: activeId,
        targetStageId: targetStage.id,
        beforeDealId,
        afterDealId,
      },
      sourceLoc.deal.title,
    );
  };

  const handleQuickMove = (dealId: string, targetStageId: string) => {
    const loc = findDealLocation(dealId);
    if (!loc || loc.stage.id === targetStageId) return;

    const targetStage = optimisticStages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    const tail = targetStage.deals[targetStage.deals.length - 1] ?? null;
    commitStageMove(
      {
        dealId,
        targetStageId,
        beforeDealId: tail?.id ?? null,
        afterDealId: null,
      },
      loc.deal.title,
    );
  };

  const handleDealCreated = (result: CreateDealResultDTO) => {
    setBoardStages((prev) =>
      prev.map((stage) =>
        stage.id === result.deal.stageId
          ? { ...stage, deals: [...stage.deals, result.deal] }
          : stage,
      ),
    );
  };

  const openCreateInStage = (stageId: string) => {
    setCreateStageId(stageId);
    setCreateOpen(true);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Pipeline Header & KPIs */}
      <div className="flex flex-col gap-4 border-b bg-background px-4 py-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{initialBoard.pipeline.name}</h1>
              <Badge variant="outline" className="gap-1 text-xs font-medium">
                <Sparkles className="size-3 text-emerald-600" />
                Closed Won → Draft Invoice &amp; Project
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Drag deals across stages to forecast revenue and trigger post-sale provisioning.
            </p>
          </div>

          {canWrite && (
            <Button
              type="button"
              onClick={() => openCreateInStage(initialBoard.stages[0]?.id ?? "")}
            >
              <Plus className="size-4" />
              New Deal
            </Button>
          )}
        </div>

        {/* Metrics + Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-xs">
              <TrendingUp className="size-3.5 text-blue-600" />
              <span className="text-muted-foreground">Open Pipeline:</span>
              <span className="font-semibold tabular-nums">
                {formatCurrencyTotals(metrics.openTotals, defaultCurrency)}
              </span>
              <span className="text-muted-foreground">({metrics.openCount})</span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">Weighted Forecast:</span>
              <span className="font-semibold tabular-nums">
                {formatCurrencyTotals(metrics.weightedTotals, defaultCurrency)}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 text-xs">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span className="text-muted-foreground">Closed Won:</span>
              <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatCurrencyTotals(metrics.wonTotals, defaultCurrency)}
              </span>
              <span className="text-muted-foreground">({metrics.wonCount})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56 sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter deals, companies..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Button
              type="button"
              variant={showLostColumn ? "outline" : "secondary"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowLostColumn((prev) => !prev)}
            >
              <Filter className="size-3.5" />
              {showLostColumn ? "Hide Lost" : "Show Lost"}
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Columns Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 lg:p-6">
        <DndContext
          id={dndContextId}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDealId(null)}
        >
          <div className="flex h-full min-h-[480px] items-stretch gap-4">
            {visibleStages.map((stage) => (
              <DealKanbanColumn
                key={stage.id}
                orgSlug={orgSlug}
                defaultCurrency={defaultCurrency}
                stage={stage}
                allStages={optimisticStages}
                canWrite={canWrite}
                onQuickMove={handleQuickMove}
                onAddDealInStage={openCreateInStage}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal ? (
              <div className="w-76">
                <DealCardSurface
                  orgSlug={orgSlug}
                  deal={activeDeal}
                  canWrite={canWrite}
                  isOverlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <CreateDealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgSlug={orgSlug}
        pipelineId={initialBoard.pipeline.id}
        defaultCurrency={defaultCurrency}
        stages={initialBoard.stages}
        initialStageId={createStageId}
        companies={initialBoard.companies}
        contacts={initialBoard.contacts}
        onCreated={handleDealCreated}
      />
    </div>
  );
}
