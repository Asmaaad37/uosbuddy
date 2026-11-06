"use client";

import { useState } from "react";
import { LogOut, SunMoon } from "lucide-react";
import { signOut } from "@/actions/onboarding";
import { useAppearance, type Appearance } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

/** Me → Appearance (redesign §5.5 #4): System, Dark or Light, saved on this device. */
export function AppearanceRow() {
  const { appearance, setAppearance } = useAppearance();
  return (
    <li className="flex items-center gap-4 pl-4">
      <SunMoon className="size-[22px] shrink-0 text-sec" strokeWidth={1.75} aria-hidden />
      <span
        data-row-text
        className="flex min-h-[60px] min-w-0 flex-1 items-center justify-between gap-3 py-3 pr-4 shadow-[inset_0_-1px_0_var(--sep)]"
      >
        <span id="appearance-label" className="text-body">
          Appearance
        </span>
        <SegmentedControl
          label="Appearance"
          className="w-44 shrink-0"
          value={appearance}
          onChange={(v) => setAppearance(v as Appearance)}
          segments={[
            { value: "system", label: "System" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
      </span>
    </li>
  );
}

/** Log out (redesign §5.5 #5): a full-width destructive row that confirms in a sheet. */
export function LogOutRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" size="lg" block onClick={() => setOpen(true)}>
        Log out
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle className="text-title2">Log out?</SheetTitle>
          <SheetDescription className="mb-5 text-subhead text-sec">
            You can log back in any time with your email.
          </SheetDescription>
          <form action={signOut} className="grid gap-2">
            <Button type="submit" variant="destructive" block>
              <LogOut aria-hidden /> Log out
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="quiet" block>
                Cancel
              </Button>
            </SheetClose>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
