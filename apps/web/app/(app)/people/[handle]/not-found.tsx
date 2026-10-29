import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function ProfileNotFound() {
  return (
    <AppShell back="/explore">
      <div className="grid gap-2">
        <h1 className="text-[28px] leading-tight font-bold">Profile not available</h1>
        <p className="text-ink-2">
          The handle may be wrong, or this student has chosen who can see their profile.
        </p>
      </div>
      <Button asChild block variant="secondary">
        <Link href="/explore">Back to explore</Link>
      </Button>
    </AppShell>
  );
}
