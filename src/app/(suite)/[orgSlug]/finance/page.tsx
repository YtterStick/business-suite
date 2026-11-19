import { redirect } from "next/navigation";

export default async function FinanceRootPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/finance/dashboard`);
}
