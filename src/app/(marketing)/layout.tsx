import { Footer } from "@/components/marketing/footer";
import { Navbar } from "@/components/marketing/navbar";
import { getMarketingViewer } from "@/server/marketing";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getMarketingViewer();
  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-[#0D0E12]">
      <Navbar viewer={viewer} />
      <main className="flex-1">{children}</main>
      <Footer viewer={viewer} />
    </div>
  );
}
