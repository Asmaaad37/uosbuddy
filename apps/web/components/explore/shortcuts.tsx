"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calculator,
  CalendarDays,
  Car,
  Clock,
  FileText,
  GraduationCap,
  LayoutGrid,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const MAIN = [
  { label: "Timetable", href: "/timetable", icon: Clock },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Rides", href: "/rides", icon: Car },
  { label: "Market", href: "/market", icon: ShoppingBag },
] as const;

const MORE = [
  { label: "Batch", href: "/explore/batch", icon: Users },
  { label: "Events", href: "/events", icon: Sparkles },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Mentors", href: "/mentors", icon: GraduationCap },
  { label: "GPA", href: "/gpa", icon: Calculator },
  { label: "Resources", href: "/resources", icon: FileText },
] as const;

const tile =
  "group flex flex-col items-center gap-2 rounded-well py-1 text-center transition-transform duration-100 ease-out active:scale-[0.97]";
const well = "grid size-[58px] place-items-center rounded-well bg-sky";

function Tile({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <>
      <span className={well}>
        <Icon className="size-6 text-accent" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="text-footnote font-semibold text-label">{label}</span>
    </>
  );
}

/**
 * Explore shortcuts (explore-v2): the four most used, then More for the rest, so the row
 * stays one glance (Hick's law). 58px Sky wells with Blue icons.
 */
export function Shortcuts() {
  const [more, setMore] = useState(false);
  return (
    <nav aria-label="Shortcuts">
      <ul className="grid grid-cols-5 gap-1">
        {MAIN.map(({ label, href, icon }) => (
          <li key={label}>
            <Link href={href} className={tile}>
              <Tile label={label} icon={icon} />
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={`${tile} w-full`}
            aria-haspopup="dialog"
            onClick={() => setMore(true)}
          >
            <Tile label="More" icon={LayoutGrid} />
          </button>
        </li>
      </ul>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent>
          <SheetTitle className="text-title2">More</SheetTitle>
          <SheetDescription className="sr-only">Everything else on UOSBuddy</SheetDescription>
          <ul className="grid grid-cols-3 gap-y-5 pt-4 pb-2">
            {MORE.map(({ label, href, icon }) => (
              <li key={label}>
                <Link href={href} className={tile} onClick={() => setMore(false)}>
                  <Tile label={label} icon={icon} />
                </Link>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
