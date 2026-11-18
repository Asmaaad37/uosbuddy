import { describe as group, expect, it } from "vitest";
import { describe } from "./notifications";

const base = {
  entity_id: "11111111-1111-1111-1111-111111111111",
  actor_name: "Ayesha Khan",
  actor_handle: "ayesha_k",
};

group("describe", () => {
  it("names the actor and links to the right place", () => {
    expect(describe({ ...base, type: "connect.request", payload: { message: "Chai?" } })).toEqual({
      title: "Ayesha Khan wants to connect",
      body: "Chai?",
      href: "/chats?tab=requests",
    });
    expect(describe({ ...base, type: "post.comment", payload: { preview: "Nice" } }).href).toBe(
      `/feed/${base.entity_id}`,
    );
    expect(
      describe({ ...base, type: "backup.resolved", payload: { title: "DSA notes", points: 10 } }),
    ).toEqual({
      title: "Ayesha Khan marked “DSA notes” done",
      body: "+10 points for helping. Thank you!",
      href: "/backup",
    });
  });

  it("says Someone for anonymous actors", () => {
    const d = describe({
      ...base,
      actor_name: null,
      actor_handle: null,
      type: "post.comment",
      payload: {},
    });
    expect(d.title).toBe("Someone commented on your post");
  });

  it("links pings to their chat and mentor requests to Mentors", () => {
    expect(describe({ ...base, type: "ping", payload: {} }).href).toBe(`/chats/${base.entity_id}`);
    expect(
      describe({ ...base, type: "mentor.request", payload: { message: "DSA?" } }),
    ).toMatchObject({
      title: "Ayesha Khan would like you to mentor them",
      href: "/mentors",
    });
  });

  it("describes campus life notifications", () => {
    const ride = { from: "UoS main gate", to: "Lahore", kind: "offer" };
    expect(describe({ ...base, type: "ride.request", payload: ride })).toEqual({
      title: "Ayesha Khan wants a seat on your ride",
      body: "UoS main gate → Lahore",
      href: "/rides?tab=mine",
    });
    expect(describe({ ...base, type: "ride.accepted", payload: ride }).href).toBe(
      `/chats/${base.entity_id}`,
    );
    expect(
      describe({
        ...base,
        type: "event.reminder",
        payload: { title: "Open debate", venue: "Hall A" },
      }),
    ).toEqual({
      title: "Starting soon: Open debate",
      body: "At Hall A",
      href: "/events?tab=going",
    });
    expect(describe({ ...base, type: "access.women_only", payload: { approved: true } }).href).toBe(
      "/rides",
    );
  });

  it("describes a feature going live (Notify me)", () => {
    expect(describe({ ...base, type: "feature.live", payload: { feature: "aibuddy" } })).toEqual({
      title: "AIBuddy is here",
      body: "Ask about your courses. Answers come from your notes and past papers.",
      href: "/buddy",
    });
    expect(describe({ ...base, type: "system.test", payload: {} }).title).toBe("Test notification");
  });

  it("describes trust notifications", () => {
    expect(
      describe({ ...base, type: "badge.awarded", payload: { name: "Connector", emoji: "🤝" } }),
    ).toEqual({ title: "New badge: 🤝 Connector", href: "/me" });
    expect(
      describe({ ...base, type: "account.warning", payload: { message: "Keep it civil" } }).body,
    ).toBe("Keep it civil");
    expect(describe({ ...base, type: "content.removed", payload: { kind: "comment" } }).title).toBe(
      "Your comment was removed",
    );
  });
});

group("timetable alerts", () => {
  const slot = (room: string, day: number, start: number) => ({
    course_title: "Databases",
    course_code: "CMPC-5203",
    room_label: room,
    teacher_name: "Iqra Waheed",
    day,
    start_min: start,
    end_min: start + 90,
  });
  it("leads with the most important change and counts the rest", () => {
    const text = describe({
      type: "timetable.changed",
      entity_id: null,
      payload: {
        count: 3,
        first: {
          kind: "moved",
          before: slot("MAB CR-160", 1, 660),
          after: slot("MAB CR-163", 1, 660),
        },
      },
      actor_name: null,
      actor_handle: null,
    });
    expect(text).toEqual({
      title: "3 changes to your timetable",
      body: "Databases moved to MAB CR-163 on Tue 11:00 (+2 more)",
      href: "/timetable",
    });
  });
  it("says a single change plainly", () => {
    expect(
      describe({
        type: "timetable.changed",
        entity_id: null,
        payload: {
          count: 1,
          first: { kind: "retimed", before: slot("X", 0, 480), after: slot("X", 3, 600) },
        },
        actor_name: null,
        actor_handle: null,
      }),
    ).toMatchObject({ title: "Your timetable changed", body: "Databases is now Thu 10:00–11:30" });
  });
  it("announces a newly published term", () => {
    expect(
      describe({
        type: "timetable.published",
        entity_id: null,
        payload: { count: 12, term: "2026-fall" },
        actor_name: null,
        actor_handle: null,
      }).title,
    ).toBe("Your Fall 2026 timetable is up");
  });
});
