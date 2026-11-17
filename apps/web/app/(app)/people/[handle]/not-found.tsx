import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/ui/screen-header";

export default function ProfileNotFound() {
  return (
    <AppShell>
      <ScreenHeader
        title="Profile not available"
        back="/explore"
        subtitle={
          <>The handle may be wrong, or this student has chosen who can see their profile.</>
        }
      />
      <Button asChild block variant="tinted">
        <Link href="/explore">Back to explore</Link>
      </Button>
    </AppShell>
  );
}
