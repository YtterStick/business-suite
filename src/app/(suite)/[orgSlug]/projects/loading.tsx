import { TablePageSkeleton } from "@/components/shell/route-skeletons";

export default function ProjectsSectionLoading() {
  return <TablePageSkeleton columns={6} rows={7} withKpis />;
}
