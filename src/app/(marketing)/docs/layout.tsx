import { DocsTopBar } from "@/components/docs/docs-search";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocsTopBar />
      <div className="mx-auto flex max-w-[90rem]">
        <DocsSidebar />
        <div className="min-w-0 flex-1 px-4 py-10 sm:px-6 lg:px-10">{children}</div>
      </div>
    </>
  );
}
