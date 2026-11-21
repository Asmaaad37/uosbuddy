import Link from "next/link";
import {
  BookOpen,
  Calculator,
  CalendarDays,
  Car,
  Clock,
  GraduationCap,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";

const SHORTCUTS = [
  { label: "Batch", href: "/explore/batch", icon: Users },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Timetable", href: "/timetable", icon: Clock },
  { label: "Rides", href: "/rides", icon: Car },
  { label: "Market", href: "/market", icon: ShoppingBag },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Mentors", href: "/mentors", icon: GraduationCap },
  { label: "GPA", href: "/gpa", icon: Calculator },
] as const;

/** Explore shortcuts (redesign §5.1 #3): one card, 4×2, neutral 52px wells. */
export function Shortcuts() {
  return (
    <Card className="px-2 sm:px-3">
      <nav aria-label="Shortcuts">
        <ul className="grid grid-cols-4 gap-y-4">
          {SHORTCUTS.map(({ label, href, icon: Icon }) => (
            <li key={label}>
              <Link
                href={href}
                className="group flex flex-col items-center gap-2 rounded-well py-1 transition-transform duration-100 ease-out active:scale-[0.97]"
              >
                <span className="grid size-[58px] place-items-center rounded-well bg-sky">
                  <Icon className="size-6 text-accent" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-footnote leading-4 text-sec">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Card>
  );
}
