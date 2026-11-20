import { redirect } from "next/navigation";

import { SignupForm } from "@/app/(auth)/signup/signup-form";
import { getMarketingViewer } from "@/server/marketing";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const viewer = await getMarketingViewer();
  if (viewer) {
    redirect(viewer.workspaceHref);
  }
  return <SignupForm />;
}
