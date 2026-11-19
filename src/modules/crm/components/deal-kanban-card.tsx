"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeft,
  Building2,
  Calendar,
  FolderKanban,
  GripVertical,
  MoreHorizontal,
  Receipt,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KanbanDealCardDTO, KanbanStageColumnDTO } from "@/modules/crm/deals.types";

interface DealCardSurfaceProps {
  orgSlug: string;
  deal: KanbanDealCardDTO;
  stages?: KanbanStageColumnDTO[];
  canWrite: boolean;
  onQuickMove?: (dealId: string, targetStageId: string) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export function DealCardSurface({
  orgSlug,
  deal,
  stages = [],
  canWrite,
  onQuickMove,
  isDragging = false,
  isOverlay = false,
  dragHandleProps,
}: DealCardSurfaceProps) {
  const isWon = deal.status === "CLOSED_WON";
  const isLost = deal.status === "CLOSED_LOST";

  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-card p-3.5 text-card-foreground shadow-2xs transition-all",
        isDragging && "opacity-35 ring-2 ring-primary/30",
        isOverlay && "rotate-1 cursor-grabbing shadow-lg ring-2 ring-primary/40",
        !isDragging && !isOverlay && "hover:border-foreground/20 hover:shadow-sm",
        isWon && "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/15",
        isLost && "border-rose-500/20 opacity-85",
      )}
    >
      {/* Card Header: Drag Handle + Title + Stage Menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          {canWrite && (
            <button
              type="button"
              aria-label={`Drag ${deal.title}`}
              className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
              {...dragHandleProps}
            >
              <GripVertical className="size-3.5" />
            </button>
          )}
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight">
            {deal.title}
          </h4>
        </div>

        {canWrite && stages.length > 0 && onQuickMove && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${deal.title}`}
                className="shrink-0 opacity-70 transition group-hover:opacity-100"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
                <ArrowRightLeft className="size-3" />
                Move to stage
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {stages.map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  disabled={stage.id === deal.stageId}
                  onSelect={() => onQuickMove(deal.id, stage.id)}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: stage.color ?? "#64748b" }}
                    />
                    {stage.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{stage.probability}%</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Company & Contact Metadata */}
      {(deal.company || deal.contact) && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {deal.company && (
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate font-medium text-foreground/85">{deal.company.name}</span>
            </div>
          )}
          {deal.contact && (
            <div className="flex items-center gap-1.5 truncate">
              <UserRound className="size-3.5 shrink-0" />
              <span className="truncate">{deal.contact.fullName}</span>
            </div>
          )}
        </div>
      )}

      {/* Amount + Probability Row */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-sm font-bold tabular-nums tracking-tight">
          {formatCurrency(deal.amount, deal.currency)}
        </span>
        <Badge
          variant={isWon ? "default" : isLost ? "destructive" : "secondary"}
          className={cn(
            "px-1.5 py-0 text-[10px] font-semibold tabular-nums",
            isWon && "bg-emerald-600 text-white hover:bg-emerald-600",
          )}
        >
          {deal.probability}%
        </Badge>
      </div>

      {/* Cross-Module Links (Auto-created Invoice & Project) */}
      {(deal.invoiceCount > 0 || deal.projectCount > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t pt-2.5">
          {deal.invoiceCount > 0 && (
            <Link
              href={`/${orgSlug}/finance/invoices`}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              <Receipt className="size-3" />
              <span>{deal.latestInvoiceNumber ?? `${deal.invoiceCount} Invoice`}</span>
            </Link>
          )}
          {deal.projectCount > 0 && (
            <Link
              href={`/${orgSlug}/projects`}
              className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 transition hover:bg-violet-500/20 dark:text-violet-300"
            >
              <FolderKanban className="size-3" />
              <span>{deal.projectCount === 1 ? "Project" : `${deal.projectCount} Projects`}</span>
            </Link>
          )}
        </div>
      )}

      {/* Card Footer: Expected Close Date & Owner */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="size-3 shrink-0" />
          <span>
            {deal.expectedCloseDate
              ? `Close ${formatDate(deal.expectedCloseDate)}`
              : "No close date"}
          </span>
        </div>

        {deal.owner && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar className="size-5">
              {deal.owner.avatarUrl && (
                <AvatarImage src={deal.owner.avatarUrl} alt={deal.owner.name} />
              )}
              <AvatarFallback className="text-[9px] font-semibold">
                {initials(deal.owner.name)}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-20 truncate">{deal.owner.name.split(" ")[0]}</span>
          </div>
        )}
      </div>
    </article>
  );
}

interface SortableDealCardProps {
  orgSlug: string;
  deal: KanbanDealCardDTO;
  stages: KanbanStageColumnDTO[];
  canWrite: boolean;
  onQuickMove: (dealId: string, targetStageId: string) => void;
}

export function SortableDealCard({
  orgSlug,
  deal,
  stages,
  canWrite,
  onQuickMove,
}: SortableDealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    disabled: !canWrite,
    data: {
      type: "deal",
      deal,
      stageId: deal.stageId,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <DealCardSurface
        orgSlug={orgSlug}
        deal={deal}
        stages={stages}
        canWrite={canWrite}
        onQuickMove={onQuickMove}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
