import { PublicFooter } from "@/components/marketing/footer";
import { PublicNavbar } from "@/components/marketing/navbar";
import { getMarketingViewer } from "@/server/marketing";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getMarketingViewer();
  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-[#0D0E12]">
      <PublicNavbar viewer={viewer} />
      <main className="flex-1">{children}</main>
      <PublicFooter viewer={viewer} />
    </div>
  );
}
