"use client";

import * as React from "react";
import {
  AlignJustify,
  ArrowDown,
  ArrowUp,
  Filter,
  GanttChart,
  GripVertical,
  Kanban,
  List,
  Rows3,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ProjectViewMode = "list" | "board" | "gantt";
export type SavedProjectView = "all" | "active" | "mine" | "delayed" | "archived";
export type TableDensity = "comfortable" | "compact";

export const SAVED_VIEW_LABELS: Record<SavedProjectView, string> = {
  all: "All Projects",
  active: "Active Projects",
  mine: "My Projects",
  delayed: "Delayed Projects",
  archived: "Archived",
};

export interface DisplayColumnOption<TKey extends string = string> {
  key: TKey;
  label: string;
  required?: boolean;
}

export interface DisplayPopoverProps<TKey extends string = string> {
  viewMode: ProjectViewMode;
  savedView: SavedProjectView;
  savedViewCounts: Record<SavedProjectView, number>;
  onSavedViewChange: (next: SavedProjectView) => void;
  density: TableDensity;
  onDensityChange: (next: TableDensity) => void;
  columns: Array<DisplayColumnOption<TKey>>;
  visibleColumns: Record<TKey, boolean>;
  onToggleColumn: (key: TKey, checked: boolean) => void;
  onMoveColumn: (key: TKey, delta: -1 | 1) => void;
  onReorderColumns: (source: TKey, target: TKey) => void;
  onResetColumns: () => void;
}

/**
 * Linear / Notion-style Display popover consolidating view scope,
 * comfortable/compact density toggle, and column visibility/ordering.
 */
export function DisplayPopover<TKey extends string>({
  viewMode,
  savedView,
  savedViewCounts,
  onSavedViewChange,
  density,
  onDensityChange,
  columns,
  visibleColumns,
  onToggleColumn,
  onMoveColumn,
  onReorderColumns,
  onResetColumns,
}: DisplayPopoverProps<TKey>) {
  const [draggedCol, setDraggedCol] = React.useState<TKey | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<TKey | null>(null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 bg-background text-xs font-medium"
        >
          <SlidersHorizontal className="size-3.5 text-primary" />
          <span>Display</span>
          {savedView !== "all" && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {SAVED_VIEW_LABELS[savedView].split(" ")[0]}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3.5 p-3.5">
        {/* Saved View Scope */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Project View
          </p>
          <div className="grid grid-cols-1 gap-1">
            {(Object.keys(SAVED_VIEW_LABELS) as SavedProjectView[]).map((key) => {
              const active = savedView === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSavedViewChange(key)}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition",
                    active
                      ? "bg-primary/10 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span>{SAVED_VIEW_LABELS[key]}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                    {savedViewCounts[key]}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row Density */}
        {viewMode === "list" && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Row Density
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => onDensityChange("comfortable")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition",
                  density === "comfortable"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Rows3 className="size-3.5" />
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => onDensityChange("compact")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition",
                  density === "compact"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <AlignJustify className="size-3.5" />
                Compact
              </button>
            </div>
          </div>
        )}

        {/* Columns Visibility & Ordering */}
        {viewMode === "list" && (
          <div className="space-y-1.5 border-t pt-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Columns
              </p>
              <button
                type="button"
                onClick={onResetColumns}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Reset
              </button>
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {columns.map((col, idx) => (
                <div
                  key={col.key}
                  draggable
                  onDragStart={() => setDraggedCol(col.key)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverCol(col.key);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedCol) onReorderColumns(draggedCol, col.key);
                    setDraggedCol(null);
                    setDragOverCol(null);
                  }}
                  onDragEnd={() => {
                    setDraggedCol(null);
                    setDragOverCol(null);
                  }}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-muted/60",
                    dragOverCol === col.key && "ring-1 ring-primary",
                  )}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/70" />
                    <input
                      type="checkbox"
                      disabled={col.required}
                      checked={Boolean(visibleColumns[col.key])}
                      onChange={(e) => onToggleColumn(col.key, e.target.checked)}
                      className="size-3.5 accent-primary"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      aria-label={`Move ${col.label} up`}
                      onClick={() => onMoveColumn(col.key, -1)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === columns.length - 1}
                      aria-label={`Move ${col.label} down`}
                      onClick={() => onMoveColumn(col.key, 1)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Consolidated toolbar for Projects Workspace: View switcher + Filters/Automation + Display popover. */
export function ProjectsToolbar<TKey extends string>({
  viewMode,
  onViewModeChange,
  activeFilterCount,
  filterPopoverContent,
  onOpenAutomation,
  shownCount,
  displayProps,
  activeFilterChips,
}: {
  viewMode: ProjectViewMode;
  onViewModeChange: (mode: ProjectViewMode) => void;
  activeFilterCount: number;
  filterPopoverContent: React.ReactNode;
  onOpenAutomation: () => void;
  shownCount: number;
  displayProps: DisplayPopoverProps<TKey>;
  activeFilterChips?: React.ReactNode;
}) {
  return (
    <div className="border-b bg-muted/20 px-4 py-2.5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Segmented View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-lg border bg-background p-0.5 shadow-2xs"
            role="group"
            aria-label="Project view switcher"
          >
            {(
              [
                ["list", "List View", List],
                ["board", "Board", Kanban],
                ["gantt", "Gantt", GanttChart],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          <Badge variant="secondary" className="text-xs tabular-nums">
            {shownCount} shown
          </Badge>
        </div>

        {/* Right: Filters, Automation & Display Popover */}
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={activeFilterCount > 0 ? "secondary" : "outline"}
                className={cn(
                  "h-8 gap-1.5 text-xs",
                  activeFilterCount === 0 && "bg-background",
                )}
              >
                <Filter className="size-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="h-4 px-1 text-[10px]">{activeFilterCount}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3.5">
              {filterPopoverContent}
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenAutomation}
            className="h-8 gap-1.5 bg-background text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            <Workflow className="size-3.5" />
            Automation
          </Button>

          <DisplayPopover {...displayProps} />
        </div>
      </div>

      {activeFilterChips}
    </div>
  );
}
