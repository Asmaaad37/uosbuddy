import { describe, expect, it } from "vitest";
import { buildingCounts, freeRooms, roomStatus, type Busy, type RoomInfo } from "./free-rooms";

const room = (id: string, building: string | null = "MAB", kind = "lecture"): RoomInfo => ({
  id,
  label: building ? `${building} ${id}` : id,
  building,
  floor: null,
  kind,
});
const cls = (room_id: string, start: number, end: number, day = 0): Busy => ({
  room_id,
  day,
  start_min: start,
  end_min: end,
});

describe("room status", () => {
  const rooms = [room("CR-160"), room("CR-161"), room("CR-162"), room("CR-90", "OKM")];
  const busy = [
    cls("CR-160", 480, 570),
    cls("CR-160", 570, 660), // back to back
    cls("CR-161", 600, 690),
    cls("CR-162", 480, 570, 1), // another day
  ];

  it("follows back-to-back classes to the end of the run", () => {
    const s = roomStatus(rooms, busy, 0, 500).find((r) => r.room.id === "CR-160");
    expect(s).toEqual({ room: rooms[0], state: "busy", freesAt: 660 });
  });
  it("is busy from the start minute and free at the end minute", () => {
    expect(roomStatus(rooms, busy, 0, 600).find((r) => r.room.id === "CR-161")?.state).toBe("busy");
    expect(roomStatus(rooms, busy, 0, 690).find((r) => r.room.id === "CR-161")).toMatchObject({
      state: "free",
      until: null,
    });
  });
  it("says how long a free room stays free", () => {
    expect(roomStatus(rooms, busy, 0, 540).find((r) => r.room.id === "CR-161")).toMatchObject({
      state: "free",
      until: 600,
    });
  });
  it("counts rooms with no classes as free all day, and ignores other days", () => {
    const s = roomStatus(rooms, busy, 0, 500);
    expect(s.find((r) => r.room.id === "CR-90")).toMatchObject({ state: "free", until: null });
    expect(s.find((r) => r.room.id === "CR-162")).toMatchObject({ state: "free", until: null });
  });
  it("leaves out online rooms", () => {
    expect(roomStatus([room("Online", null, "online")], [], 0, 500)).toEqual([]);
  });
});

describe("free and freeing soon", () => {
  const rooms = [room("A"), room("B"), room("C"), room("D", "IAH")];
  const busy = [cls("A", 480, 600), cls("B", 480, 520), cls("C", 560, 700)];

  it("lists free rooms (longest free first), then rooms freeing within 30 minutes", () => {
    const { free, soon } = freeRooms(roomStatus(rooms, busy, 0, 500), 500);
    expect(free.map((f) => [f.room.id, f.until])).toEqual([
      ["D", null],
      ["C", 560],
    ]);
    expect(soon.map((s) => [s.room.id, s.freesAt])).toEqual([["B", 520]]);
  });
  it("counts free rooms per building", () => {
    const { free } = freeRooms(roomStatus(rooms, busy, 0, 500), 500);
    expect(buildingCounts(free)).toEqual([
      ["IAH", 1],
      ["MAB", 1],
    ]);
  });
});
