import { TactiqLoader } from "@/components/brand/tactiq-logo";

export function TablePageSkeleton(_props: {
  columns?: number;
  rows?: number;
  withKpis?: boolean;
}) {
  void _props;
  return <TactiqLoader className="min-h-[65vh]" />;
}

export function KanbanBoardSkeleton() {
  return <TactiqLoader className="min-h-[65vh]" />;
}

export function DashboardWidgetsSkeleton() {
  return <TactiqLoader className="min-h-[65vh]" />;
}

export function CollaborationSkeleton() {
  return <TactiqLoader className="min-h-[65vh]" />;
}
