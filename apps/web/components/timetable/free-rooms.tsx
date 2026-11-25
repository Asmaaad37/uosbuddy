"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { ReportWrongInfo } from "@/components/timetable/report-wrong-info";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { fieldClass } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DAYS, minToTime, timeToMin } from "@/lib/academics";
import {
  TEACHING_END,
  TEACHING_START,
  buildingCounts,
  freeRooms,
  roomStatus,
  type Busy,
  type RoomInfo,
} from "@/lib/timetable/free-rooms";
import { duration, pakistanNow } from "@/lib/timetable/week";

const pad = (min: number) => minToTime(min).padStart(5, "0");

/**
 * Phase 11.3: free rooms now (Pakistan time) or at a chosen day and time, from this week's
 * published timetable. Rooms with no classes count as free; back-to-back classes as one run.
 */
export function FreeRoomFinder({ rooms, busy }: { rooms: RoomInfo[]; busy: Busy[] }) {
  // Set after mount so the server and the device agree; Pakistan time either way.
  const [at, setAt] = useState<{ day: number; min: number } | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  useEffect(() => setAt(pakistanNow()), []);

  const result = useMemo(() => {
    if (!at) return null;
    return freeRooms(roomStatus(rooms, busy, at.day, at.min), at.min);
  }, [at, rooms, busy]);

  if (!rooms.length) {
    return (
      <EmptyState icon={DoorOpen} title="No rooms yet">
        Rooms appear once this term&apos;s timetable is published.
      </EmptyState>
    );
  }
  if (!at || !result) return <p className="text-sec">Checking rooms…</p>;

  const outside = at.day > 5 || at.min < TEACHING_START || at.min >= TEACHING_END;
  const counts = buildingCounts(result.free);
  const inBuilding = <T extends { room: RoomInfo }>(list: T[]) =>
    building ? list.filter((s) => (s.room.building ?? "Other") === building) : list;

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 rounded-card bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-subhead font-semibold">
            Day
            <NativeSelect
              value={at.day}
              onChange={(e) => setAt({ ...at, day: Number(e.target.value) })}
            >
              {DAYS.slice(0, 6).map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-subhead font-semibold">
            Time
            <input
              type="time"
              className={fieldClass}
              value={pad(at.min)}
              onChange={(e) => {
                const min = timeToMin(e.target.value);
                if (min !== null) setAt({ ...at, min });
              }}
            />
          </label>
          <Button size="sm" variant="plain" onClick={() => setAt(pakistanNow())}>
            Now
          </Button>
        </div>
        <p className="text-footnote text-sec">Pakistan time, from this week&apos;s timetable.</p>
      </div>

      {outside ? (
        <EmptyState icon={DoorOpen} title="Outside teaching hours">
          Classes run {pad(TEACHING_START)}–{pad(TEACHING_END)}, Monday to Saturday. Pick a time to
          plan ahead.
        </EmptyState>
      ) : (
        <>
          {counts.length > 1 && (
            <div
              role="radiogroup"
              aria-label="Building"
              className="-mx-4 flex gap-2 overflow-x-auto px-4"
            >
              <Chip
                role="radio"
                aria-checked={!building}
                selected={!building}
                onClick={() => setBuilding(null)}
              >
                All · {result.free.length}
              </Chip>
              {counts.map(([b, n]) => (
                <Chip
                  key={b}
                  role="radio"
                  aria-checked={building === b}
                  selected={building === b}
                  onClick={() => setBuilding(b)}
                >
                  {b} · {n}
                </Chip>
              ))}
            </div>
          )}
          <RoomList
            title="Free"
            empty="No free rooms at this time."
            items={inBuilding(result.free).map((s) => ({
              room: s.room,
              note:
                s.until === null ? "Free for the rest of the day" : `Free until ${pad(s.until)}`,
            }))}
          />
          {inBuilding(result.soon).length > 0 && (
            <RoomList
              title="Freeing soon"
              items={inBuilding(result.soon).map((s) => ({
                room: s.room,
                note: `Frees in ${duration(s.freesAt - at.min)} (${pad(s.freesAt)})`,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}

function RoomList({
  title,
  empty,
  items,
}: {
  title: string;
  empty?: string;
  items: { room: RoomInfo; note: string }[];
}) {
  return (
    <section aria-label={title} className="grid gap-2">
      <h3 className="px-1 text-overline text-ter uppercase">
        {title} · {items.length}
      </h3>
      {items.length ? (
        <ul className="overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
          {items.map(({ room, note }) => (
            <li key={room.id} className="flex items-center border-b border-sep pr-4 last:border-0">
              <Link
                href={`/timetable/room/${room.id}`}
                className="flex flex-1 items-center justify-between gap-3 px-4 py-3 active:bg-raised"
              >
                <span className="grid">
                  <span className="font-medium">{room.label}</span>
                  <span className="text-footnote text-sec">
                    {note}
                    {room.floor !== null ? ` · Floor ${room.floor}` : ""}
                  </span>
                </span>
              </Link>
              <ReportWrongInfo roomId={room.id} label={room.label} className="self-center" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card bg-surface p-4 text-center text-sec shadow-card">{empty}</p>
      )}
    </section>
  );
}
