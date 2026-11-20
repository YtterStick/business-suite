"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Info,
  Layers,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import type { AiProjectBlueprint } from "@/app/api/orgs/[orgSlug]/projects/ai-blueprint/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { addDays, toIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  AiProjectDialog,
  BrowseTemplatesDialog,
  type TemplateGalleryItem,
} from "@/modules/projects/components/project-modals";
import { RichTextEditor } from "@/modules/projects/components/rich-text-editor";
import { TagChipsInput } from "@/modules/projects/components/tag-chips-input";
import { createProjectAction } from "@/modules/projects/projects.actions";
import type {
  MentionReferenceItem,
  ProjectBlueprintPhase,
  ProjectsWorkspaceDTO,
  ProjectTemplateKey,
} from "@/modules/projects/projects.types";

const PROJECT_TAB_OPTIONS: Array<{
  id: string;
  label: string;
  locked?: boolean;
  defaultChecked?: boolean;
}> = [
  { id: "Dashboard", label: "Dashboard", locked: true, defaultChecked: true },
  { id: "Tasks", label: "Tasks", locked: true, defaultChecked: true },
  { id: "Users", label: "Users", defaultChecked: true },
  { id: "Reports", label: "Reports", defaultChecked: true },
  { id: "Documents", label: "Documents", defaultChecked: true },
  { id: "Phases", label: "Phases", defaultChecked: true },
  { id: "Time Logs", label: "Time Logs", defaultChecked: true },
  { id: "Finance", label: "Finance", defaultChecked: true },
  { id: "Expense Claims", label: "Expense Claims", defaultChecked: false },
  { id: "Bugs", label: "Bugs", defaultChecked: true },
  { id: "Feed", label: "Feed", locked: true, defaultChecked: true },
  { id: "Forums", label: "Forums", defaultChecked: false },
  { id: "Pages", label: "Pages", defaultChecked: false },
  { id: "Timesheet", label: "Timesheet", locked: true, defaultChecked: true },
];

const DEFAULT_ENABLED_TABS = PROJECT_TAB_OPTIONS.filter((t) => t.defaultChecked).map((t) => t.id);

type ProjectTabOption = (typeof PROJECT_TAB_OPTIONS)[number];

function SortableProjectTabItem({
  tab,
  checked,
  onToggle,
}: {
  tab: ProjectTabOption;
  checked: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs transition select-none",
        tab.locked ? "bg-muted/60 text-muted-foreground" : "bg-background hover:bg-accent/50",
        isDragging && "z-10 opacity-75 shadow-md ring-2 ring-primary/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          aria-label={`Reorder ${tab.label} tab`}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3 shrink-0" />
        </button>
        <label
          htmlFor={`proj-tab-${tab.id}`}
          className={cn("truncate", tab.locked ? "cursor-not-allowed" : "cursor-pointer")}
        >
          {tab.label}
        </label>
      </div>
      <input
        id={`proj-tab-${tab.id}`}
        type="checkbox"
        checked={checked}
        disabled={tab.locked}
        onChange={onToggle}
        className={cn(
          "size-3.5 shrink-0 accent-primary",
          tab.locked ? "cursor-not-allowed" : "cursor-pointer",
        )}
      />
    </div>
  );
}

interface NewProjectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  defaultCurrency: string;
  currentUserId: string;
  groups: ProjectsWorkspaceDTO["groups"];
  members: ProjectsWorkspaceDTO["members"];
  companies: ProjectsWorkspaceDTO["companies"];
  deals: ProjectsWorkspaceDTO["deals"];
  mentionItems: MentionReferenceItem[];
  initialTemplate?: ProjectTemplateKey;
}

export function NewProjectSheet({
  open,
  onOpenChange,
  orgSlug,
  defaultCurrency,
  currentUserId,
  groups,
  members,
  companies,
  deals,
  mentionItems,
  initialTemplate = "NONE",
}: NewProjectSheetProps) {
  const [name, setName] = React.useState("");
  const [ownerId, setOwnerId] = React.useState(currentUserId);
  const [template, setTemplate] = React.useState<ProjectTemplateKey>(initialTemplate);
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [isStrict, setIsStrict] = React.useState(false);
  const [isPublic, setIsPublic] = React.useState(false);
  const [groupId, setGroupId] = React.useState("");
  const [addingNewGroup, setAddingNewGroup] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [businessHours, setBusinessHours] = React.useState("Standard Business Hours");
  const [taskLayout, setTaskLayout] = React.useState("Standard Layout");
  const [tags, setTags] = React.useState<string[]>([]);
  const [rollupEnabled, setRollupEnabled] = React.useState(true);
  const tabsDndId = React.useId();
  const [tabOrder, setTabOrder] = React.useState<ProjectTabOption[]>(PROJECT_TAB_OPTIONS);
  const [enabledTabs, setEnabledTabs] = React.useState<string[]>(DEFAULT_ENABLED_TABS);
  const [customPhases, setCustomPhases] = React.useState<ProjectBlueprintPhase[]>([]);
  const [budget, setBudget] = React.useState("");
  const [currency, setCurrency] = React.useState(defaultCurrency || "PHP");
  const [companyId, setCompanyId] = React.useState("");
  const [dealId, setDealId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Accordion collapse state
  const [rollupOpen, setRollupOpen] = React.useState(true);
  const [tabsOpen, setTabsOpen] = React.useState(true);
  const [accessOpen, setAccessOpen] = React.useState(true);

  // Modals for AI Project & Browse Templates
  const [aiModalOpen, setAiModalOpen] = React.useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = React.useState(false);

  const tabSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  React.useEffect(() => {
    if (open) {
      setTemplate(initialTemplate);
      setCurrency(defaultCurrency || "PHP");
      setOwnerId(currentUserId);
      setTabOrder(PROJECT_TAB_OPTIONS);
      setEnabledTabs(DEFAULT_ENABLED_TABS);
      setCustomPhases([]);
      setError(null);
    }
  }, [open, initialTemplate, defaultCurrency, currentUserId]);

  const handleTabDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTabOrder((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === String(active.id));
      const newIndex = prev.findIndex((t) => t.id === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const toggleTab = (tabId: string, locked?: boolean) => {
    if (locked) return;
    setEnabledTabs((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId],
    );
  };

  const optionalTabIds = PROJECT_TAB_OPTIONS.filter((t) => !t.locked).map((t) => t.id);
  const allOptionalTabsChecked = optionalTabIds.every((id) => enabledTabs.includes(id));

  const toggleAllOptionalTabs = (checked: boolean) => {
    const lockedIds = PROJECT_TAB_OPTIONS.filter((t) => t.locked).map((t) => t.id);
    setEnabledTabs(checked ? PROJECT_TAB_OPTIONS.map((t) => t.id) : lockedIds);
  };

  const applyAiBlueprint = (blueprint: AiProjectBlueprint) => {
    const today = new Date();
    setName(blueprint.title);
    setDescription(blueprint.descriptionHtml);
    setTags(blueprint.tags);
    setIsStrict(blueprint.isStrict);
    setStartDate(toIsoDate(today));
    setDueDate(toIsoDate(addDays(today, blueprint.durationDays)));
    setTemplate("NONE");
    setCustomPhases(blueprint.phases);
    const lockedIds = PROJECT_TAB_OPTIONS.filter((t) => t.locked).map((t) => t.id);
    setEnabledTabs(Array.from(new Set([...lockedIds, ...blueprint.recommendedTabs])));
    toast.success("AI blueprint applied", {
      description: `${blueprint.phases.length} phases ready to scaffold on Add.`,
    });
  };

  const applyTemplateFromGallery = (tpl: TemplateGalleryItem) => {
    const today = new Date();
    setTemplate(tpl.key);
    if (!name.trim()) setName(tpl.name);
    setTags(tpl.tags);
    setStartDate(toIsoDate(today));
    setDueDate(toIsoDate(addDays(today, tpl.durationDays)));
    setCustomPhases([]);
    const lockedIds = PROJECT_TAB_OPTIONS.filter((t) => t.locked).map((t) => t.id);
    setEnabledTabs(Array.from(new Set([...lockedIds, ...tpl.recommendedTabs])));
    toast.success(`Selected "${tpl.name}" template`);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const orderedEnabledTabs = tabOrder
        .filter((t) => enabledTabs.includes(t.id))
        .map((t) => t.id);

      const res = await createProjectAction({
        orgSlug,
        name,
        description: description || null,
        ownerId: ownerId || null,
        template,
        startDate: startDate || null,
        dueDate: dueDate || null,
        isStrict,
        isPublic,
        rollupEnabled,
        businessHours,
        taskLayout,
        enabledTabs: orderedEnabledTabs,
        customPhases: customPhases.length > 0 ? customPhases : undefined,
        groupId: addingNewGroup ? null : groupId || null,
        newGroupName: addingNewGroup ? newGroupName : null,
        tags,
        budget: budget ? Number(budget) : null,
        currency,
        companyId: companyId || null,
        dealId: dealId || null,
      });

      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      toast.success(`Project "${res.data.name}" created`);
      setName("");
      setDescription("");
      setTags([]);
      setBudget("");
      setNewGroupName("");
      setCustomPhases([]);
      setAddingNewGroup(false);
      onOpenChange(false);
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="border-b pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <SheetTitle>New Project</SheetTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setAiModalOpen(true)}
                  className="gap-1 border-violet-500/30 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
                >
                  <Sparkles className="size-3" />
                  AI Project
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setTemplatesModalOpen(true)}
                  className="gap-1"
                >
                  <Layers className="size-3" />
                  Browse Templates
                </Button>
              </div>
            </div>
            <SheetDescription>
              Configure schedule, rich scope, roll-up rules, custom tabs, and access permissions.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5">
            {customPhases.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-violet-600" />
                  <span className="font-medium">
                    AI Blueprint active: {customPhases.length} phases &amp;{" "}
                    {customPhases.reduce((s, p) => s + p.tasks.length, 0)} tasks will be created.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomPhases([])}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Project Title */}
            <div className="space-y-1.5">
              <Label htmlFor="proj-title">
                Project Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proj-title"
                placeholder="e.g. Website Redesign & Launch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Owner + Template */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-owner">Owner</Label>
                <select
                  id="proj-owner"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-template">Template</Label>
                <select
                  id="proj-template"
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value as ProjectTemplateKey);
                    setCustomPhases([]);
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="NONE">Blank Project</option>
                  <option value="CLIENT_ONBOARDING">Client Onboarding</option>
                  <option value="SOFTWARE_DELIVERY">Software Delivery</option>
                  <option value="MARKETING_LAUNCH">Marketing Campaign Launch</option>
                  <option value="FINANCE_ERP_ROLLOUT">ERP &amp; Finance Rollout</option>
                  <option value="SECURITY_AUDIT">Security &amp; Compliance Audit</option>
                </select>
              </div>
            </div>

            {/* Start Date + End Date */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-start">Start Date</Label>
                <Input
                  id="proj-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-end">End Date</Label>
                <Input
                  id="proj-end"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Strict Project checkbox with tooltip */}
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isStrict}
                  onChange={(e) => setIsStrict(e.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <span>Make this a strict project</span>
              </label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Strict project info"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Strict projects enforce phase &amp; task dates within the project start and end
                  date boundaries.
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Project Group + Add new group */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="proj-group">Project Group</Label>
                <button
                  type="button"
                  onClick={() => setAddingNewGroup((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="size-3" />
                  {addingNewGroup ? "Select existing group" : "Add new group"}
                </button>
              </div>

              {addingNewGroup ? (
                <Input
                  id="proj-group"
                  placeholder="Enter new project group name..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              ) : (
                <select
                  id="proj-group"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Select</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Rich Text WYSIWYG Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                members={members}
                mentionItems={mentionItems}
              />
            </div>

            {/* Business Hours* + Task Layout */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-hours">
                  Business Hours <span className="text-destructive">*</span>
                </Label>
                <select
                  id="proj-hours"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="Standard Business Hours">Standard Business Hours</option>
                  <option value="24x7 Support">24x7 Support</option>
                  <option value="Shift Hours (8am–8pm)">Shift Hours (8am–8pm)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="proj-layout">Task Layout</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Task layout info"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-60">
                      Determines the default field arrangement and board view when opening tasks.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <select
                  id="proj-layout"
                  value={taskLayout}
                  onChange={(e) => setTaskLayout(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="Standard Layout">Standard Layout</option>
                  <option value="Kanban Layout">Kanban Layout</option>
                  <option value="Compact Layout">Compact Layout</option>
                </select>
              </div>
            </div>

            {/* Budget + Currency */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="proj-budget">Budget (optional)</Label>
                <Input
                  id="proj-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="50000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-currency">Currency</Label>
                <select
                  id="proj-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="PHP">PHP (₱)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            {/* CRM Links */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-company">Client Company</Label>
                <select
                  id="proj-company"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Internal / No company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-deal">Linked CRM Deal</Label>
                <select
                  id="proj-deal"
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">No linked deal</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Interactive Tag Chips Input */}
            <div className="space-y-1.5">
              <Label htmlFor="proj-tags">Tags</Label>
              <TagChipsInput id="proj-tags" tags={tags} onChange={setTags} />
            </div>

            {/* Accordion 1: Roll-up */}
            <div className="rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={rollupOpen}
                    onClick={() => setRollupOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 text-sm font-semibold"
                  >
                    {rollupOpen ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <span>Roll-up</span>
                  </button>
                  <input
                    type="checkbox"
                    aria-label="Enable roll-up"
                    checked={rollupEnabled}
                    onChange={(e) => setRollupEnabled(e.target.checked)}
                    className="size-4 cursor-pointer rounded border-input accent-primary"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Roll-up info"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      Automatically aggregates task completion %, dates, and logged hours up to
                      phases and the project summary.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant={rollupEnabled ? "secondary" : "outline"} className="text-[10px]">
                  {rollupEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              {rollupOpen && (
                <div className="border-t bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                  Enable this option to roll-up dates from Tasks/subtasks to projects and Phases.
                  Work hours, time logs, and % completion will roll-up from subtasks to Tasks.
                </div>
              )}
            </div>

            {/* Accordion 2: Customize tabs for this project */}
            <div className="rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={tabsOpen}
                    onClick={() => setTabsOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 text-sm font-semibold"
                  >
                    {tabsOpen ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <span>Customize tabs for this project</span>
                  </button>
                  <input
                    type="checkbox"
                    aria-label="Toggle all optional tabs"
                    checked={allOptionalTabsChecked}
                    onChange={(e) => toggleAllOptionalTabs(e.target.checked)}
                    className="size-4 cursor-pointer rounded border-input accent-primary"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Customize tabs info"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      Drag the grip handle to reorder tabs, and check or uncheck optional modules
                      for this project. Core tabs remain enabled.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {enabledTabs.length} active
                </Badge>
              </div>

              {tabsOpen && (
                <div className="space-y-2 border-t p-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Drag grip handle to reorder tabs</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTabOrder(PROJECT_TAB_OPTIONS);
                        setEnabledTabs(DEFAULT_ENABLED_TABS);
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      Reset default
                    </button>
                  </div>
                  <DndContext
                    id={tabsDndId}
                    sensors={tabSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTabDragEnd}
                  >
                    <SortableContext
                      items={tabOrder.map((t) => t.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        {tabOrder.map((tab) => (
                          <SortableProjectTabItem
                            key={tab.id}
                            tab={tab}
                            checked={enabledTabs.includes(tab.id)}
                            onToggle={() => toggleTab(tab.id, tab.locked)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>

            {/* Accordion 3: Project Access */}
            <div className="rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={accessOpen}
                    onClick={() => setAccessOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 text-sm font-semibold"
                  >
                    {accessOpen ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <span>Project Access</span>
                  </button>
                  <input
                    type="checkbox"
                    aria-label="Make project public"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="size-4 cursor-pointer rounded border-input accent-primary"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Project access info"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      Private restricts access to project members. Public lets all organization
                      portal users view, follow, and comment.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant={isPublic ? "default" : "secondary"} className="text-[10px]">
                  {isPublic ? "Public" : "Private"}
                </Badge>
              </div>

              {accessOpen && (
                <div className="grid grid-cols-1 gap-3 border-t p-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 hover:bg-accent/40">
                    <input
                      type="radio"
                      name="project-access"
                      checked={!isPublic}
                      onChange={() => setIsPublic(false)}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">Private</p>
                      <p className="text-xs text-muted-foreground">
                        Only project users can view and access this project.
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 hover:bg-accent/40">
                    <input
                      type="radio"
                      name="project-access"
                      checked={isPublic}
                      onChange={() => setIsPublic(true)}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">Public</p>
                      <p className="text-xs text-muted-foreground">
                        Portal users can only view, follow, and comment whereas project users will
                        have complete access.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <SheetFooter className="flex-row flex-wrap items-center justify-between gap-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAiModalOpen(true)}
                  className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
                >
                  <Sparkles className="size-3.5" />
                  AI project
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={() => setTemplatesModalOpen(true)}
                  className="text-primary hover:underline"
                >
                  Browse Templates
                </button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AiProjectDialog
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        orgSlug={orgSlug}
        onApplyBlueprint={applyAiBlueprint}
      />

      <BrowseTemplatesDialog
        open={templatesModalOpen}
        onOpenChange={setTemplatesModalOpen}
        onSelectTemplate={applyTemplateFromGallery}
      />
    </>
  );
}
