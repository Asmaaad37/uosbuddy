import { BottomNav } from "@/components/bottom-nav";

/** Signed-in app shell: pages scroll above the bottom navigation. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav />
    </>
  );
}
