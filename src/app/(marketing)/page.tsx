import type { Metadata } from "next";

import { Capabilities } from "@/components/marketing/capabilities";
import { FaqSection } from "@/components/marketing/faq-section";
import { CtaBanner } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { Pillars } from "@/components/marketing/pillars";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { UseCasesSection } from "@/components/marketing/use-cases-section";
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
        viewer={viewer}
        primaryHref={viewer ? viewer.workspaceHref : "/signup"}
        primaryLabel={viewer ? "Open your workspace" : "Get Started for Free"}
      />
      <TrustStrip />
      <Pillars viewer={viewer} />
      <Workflow />
      <UseCasesSection />
      <Capabilities />
      <FaqSection />
      <CtaBanner viewer={viewer} />
    </>
  );
}
