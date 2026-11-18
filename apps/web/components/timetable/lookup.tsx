"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { NativeSelect } from "@/components/ui/native-select";

type Option = { id: string; label: string };
const MODES = [
  { key: "section", label: "Section", pick: "Choose a section" },
  { key: "teacher", label: "Teacher", pick: "Choose a teacher" },
  { key: "room", label: "Room", pick: "Choose a room" },
] as const;
type Mode = (typeof MODES)[number]["key"];

/** Phase 11.3: look up any section's, teacher's or room's week. */
export function Lookup({ options }: { options: Record<Mode, Option[]> }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("section");
  const [value, setValue] = useState("");
  const current = MODES.find((m) => m.key === mode)!;
  const list = options[mode];

  return (
    <div className="grid gap-3 rounded-card bg-surface p-4 shadow-card">
      <div role="radiogroup" aria-label="Look up" className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <Chip
            key={m.key}
            role="radio"
            aria-checked={mode === m.key}
            selected={mode === m.key}
            onClick={() => {
              setMode(m.key);
              setValue("");
            }}
          >
            {m.label}
          </Chip>
        ))}
      </div>
      {list.length ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (value) router.push(`/timetable/${mode}/${value}`);
          }}
        >
          <NativeSelect
            aria-label={current.pick}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">{current.pick}</option>
            {list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" disabled={!value}>
            Show their week
          </Button>
        </form>
      ) : (
        <p className="text-sec">
          Nothing to look up yet. Sections, teachers and rooms appear once a timetable is published.
        </p>
      )}
    </div>
  );
}
