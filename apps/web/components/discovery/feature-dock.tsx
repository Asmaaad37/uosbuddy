"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import {
  BookOpen,
  CalendarDays,
  Car,
  Clock,
  LifeBuoy,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const lanes = {
  people: "bg-lane-people text-lane-people-ink",
  learn: "bg-lane-learn text-lane-learn-ink",
  help: "bg-lane-help text-lane-help-ink",
  campus: "bg-lane-campus text-lane-campus-ink",
} as const;

const TILES = [
  { label: "Batch", href: "/explore/batch", icon: Users, lane: "people" },
  { label: "Backup", href: "/backup", icon: LifeBuoy, lane: "help" },
  { label: "Courses", href: "/courses", icon: BookOpen, lane: "learn" },
  { label: "Buddy", href: "/buddy", icon: Sparkles, lane: "learn" },
  { label: "Rides", href: "/rides", icon: Car, lane: "campus" },
  { label: "Market", href: "/market", icon: ShoppingBag, lane: "campus" },
  { label: "Events", href: "/events", icon: CalendarDays, lane: "campus" },
  { label: "Timetable", href: "/timetable", icon: Clock, lane: "learn" },
] as const;

const SPRING = { type: "spring", stiffness: 260, damping: 22 } as const;

/**
 * Feature dock (Section 6.3 #2). Tapping a live tile springs it up and fans a few preview
 * cards, then navigates; with reduced motion it just navigates.
 */
export function FeatureDock({ previews }: { previews: { name: string; avatar: string | null }[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [opening, setOpening] = useState<string | null>(null);

  function open(href: string) {
    if (reduce) return router.push(href);
    // Navigate straight away; the spring plays while the next page loads.
    setOpening(href);
    router.push(href);
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-5">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const isOpening = opening === tile.href;
          const body = (
            <>
              <span className="relative">
                {isOpening &&
                  previews.slice(0, 3).map((p, i) => (
                    <m.span
                      key={p.name + i}
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -mt-5 -ml-5"
                      initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.6 }}
                      animate={{
                        opacity: 1,
                        x: (i - 1) * 30,
                        y: -52 - (i === 1 ? 10 : 0),
                        rotate: (i - 1) * 12,
                        scale: 1,
                      }}
                      transition={{ ...SPRING, delay: i * 0.03 }}
                    >
                      <Avatar
                        name={p.name}
                        src={p.avatar}
                        size="md"
                        className="ring-2 ring-surface"
                      />
                    </m.span>
                  ))}
                <m.span
                  animate={isOpening ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
                  transition={SPRING}
                  className={cn(
                    "relative grid size-14 place-items-center overflow-hidden rounded-[18px] shadow-card [&_svg]:size-7",
                    lanes[tile.lane],
                  )}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-1 top-1 h-1/2 rounded-t-[16px] bg-gradient-to-b from-white/45 to-white/0"
                  />
                  <Icon strokeWidth={1.75} />
                </m.span>
              </span>
              <span className="rounded-pill bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink shadow-card">
                {tile.label}
              </span>
            </>
          );
          return (
            <li key={tile.label} className="flex justify-center">
              <a
                href={tile.href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  open(tile.href);
                }}
                // Four to a row: fits a 360 px phone with the 16 px gutters.
                className="group flex w-full max-w-20 flex-col items-center gap-2 rounded-md outline-offset-4"
              >
                {body}
              </a>
            </li>
          );
        })}
      </ul>
    </LazyMotion>
  );
}
