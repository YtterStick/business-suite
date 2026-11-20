import type { Metadata } from "next";

import { Capabilities } from "@/components/marketing/capabilities";
import { CtaBanner } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { Pillars } from "@/components/marketing/pillars";
import { Pricing } from "@/components/marketing/pricing";
import { Workflow } from "@/components/marketing/workflow";
import { getMarketingViewer } from "@/server/marketing";

export const metadata: Metadata = {
  title: "Tactiq — Run your entire business on one unified operating system",
  description:
    "Tactiq brings your customer relationships, invoicing, and project delivery into a single connected workspace—eliminating app-switching and data silos.",
};

export default async function LandingPage() {
  const viewer = await getMarketingViewer();
  return (
    <>
      <Hero
        primaryHref={viewer ? viewer.workspaceHref : "/signup"}
        primaryLabel={viewer ? "Open your workspace" : "Get Started for Free"}
      />
      <Pillars />
      <Workflow />
      <Capabilities />
      <Pricing />
      <CtaBanner viewer={viewer} />
    </>
  );
}
