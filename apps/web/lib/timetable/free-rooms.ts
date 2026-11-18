/** Phase 11.3: which rooms are free at a given day and minute, from this week's classes. */

export type RoomInfo = {
  id: string;
  label: string;
  building: string | null;
  floor: number | null;
  kind: string;
};
export type Busy = { room_id: string | null; day: number; start_min: number; end_min: number };

export type RoomStatus =
  | { room: RoomInfo; state: "free"; until: number | null }
  | { room: RoomInfo; state: "busy"; freesAt: number };

/** Classes run 08:00–18:30 at UoS; outside that every room is "free", which helps no one. */
export const TEACHING_START = 8 * 60;
export const TEACHING_END = 18 * 60 + 30;
/** "Freeing soon" means within this many minutes. */
export const SOON = 30;

/**
 * Each room's state at `min` on `day`. A busy room frees at the end of its run of classes
 * (back-to-back classes count as one). A free room is free until its next class, or for the
 * rest of the day (`until: null`). Online rooms aren't places, so they're left out.
 */
export function roomStatus(
  rooms: RoomInfo[],
  busy: Busy[],
  day: number,
  min: number,
): RoomStatus[] {
  const byRoom = new Map<string, Busy[]>();
  for (const b of busy) {
    if (b.day !== day || !b.room_id) continue;
    const list = byRoom.get(b.room_id) ?? [];
    list.push(b);
    byRoom.set(b.room_id, list);
  }
  return rooms
    .filter((r) => r.kind !== "online")
    .map((room): RoomStatus => {
      const classes = (byRoom.get(room.id) ?? []).sort((a, b) => a.start_min - b.start_min);
      const now = classes.find((c) => c.start_min <= min && min < c.end_min);
      if (now) {
        let freesAt = now.end_min;
        // Follow back-to-back (or overlapping) classes to the end of the run.
        for (const c of classes) {
          if (c.start_min <= freesAt && c.end_min > freesAt) freesAt = c.end_min;
        }
        return { room, state: "busy", freesAt };
      }
      const next = classes.find((c) => c.start_min > min);
      return { room, state: "free", until: next ? next.start_min : null };
    });
}

/** Free rooms first (longest free first), then rooms freeing within SOON minutes. */
export function freeRooms(statuses: RoomStatus[], min: number) {
  const free = statuses
    .filter((s): s is Extract<RoomStatus, { state: "free" }> => s.state === "free")
    .sort(
      (a, b) =>
        (b.until ?? 24 * 60) - (a.until ?? 24 * 60) || a.room.label.localeCompare(b.room.label),
    );
  const soon = statuses
    .filter(
      (s): s is Extract<RoomStatus, { state: "busy" }> =>
        s.state === "busy" && s.freesAt - min <= SOON,
    )
    .sort((a, b) => a.freesAt - b.freesAt || a.room.label.localeCompare(b.room.label));
  return { free, soon };
}

/** Free-room counts per building, for the building chips. */
export function buildingCounts(free: { room: RoomInfo }[]) {
  const counts = new Map<string, number>();
  for (const f of free) {
    const key = f.room.building ?? "Other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
