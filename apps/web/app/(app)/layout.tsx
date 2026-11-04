import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { NavProgress } from "@/components/nav-progress";

/** Signed-in app shell: pages scroll above the bottom navigation. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <NavProgress />
      </Suspense>
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav />
    </>
  );
}
