import { LoginForm } from "@/app/(auth)/login/login-form";
import { getMarketingViewer } from "@/server/marketing";

export default async function LoginPage() {
  const viewer = await getMarketingViewer();
  return <LoginForm viewer={viewer} />;
}
