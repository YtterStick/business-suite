import { redirect } from "next/navigation";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { getMarketingViewer } from "@/server/marketing";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const viewer = await getMarketingViewer();
  if (viewer) {
    redirect(viewer.workspaceHref);
  }
  return <LoginForm />;
}
