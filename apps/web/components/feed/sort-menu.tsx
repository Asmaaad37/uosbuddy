"use client";

import Link from "next/link";
import { Check, ChevronsUpDown } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

const SORTS = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
] as const;

/** Feed sort (redesign §5.2 #2): a small button showing Hot or New that opens a menu. */
export function SortMenu({
  value,
  hrefs,
}: {
  value: "hot" | "new";
  hrefs: Record<"hot" | "new", string>;
}) {
  const current = SORTS.find((s) => s.value === value)!;
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Sort: ${current.label}`}
          className="hit flex h-9 shrink-0 items-center gap-1 rounded-track bg-track px-3 text-footnote font-semibold transition-transform duration-100 ease-out active:scale-[0.97]"
        >
          {current.label}
          <ChevronsUpDown className="size-4 text-sec" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent className="min-w-40">
        {SORTS.map((s) => (
          <MenuItem key={s.value} asChild>
            <Link href={hrefs[s.value]} aria-current={s.value === value ? "page" : undefined}>
              <span className="flex-1">{s.label}</span>
              {s.value === value && <Check className="!text-accent" aria-hidden />}
            </Link>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
