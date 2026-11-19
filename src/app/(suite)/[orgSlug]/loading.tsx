import { TablePageSkeleton } from "@/components/shell/route-skeletons";

export default function SuiteLoading() {
  return <TablePageSkeleton columns={5} rows={6} withKpis />;
}
