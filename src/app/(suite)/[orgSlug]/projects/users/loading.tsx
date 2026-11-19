import { TablePageSkeleton } from "@/components/shell/route-skeletons";

export default function UsersLoading() {
  return <TablePageSkeleton columns={7} rows={8} withKpis={false} />;
}
