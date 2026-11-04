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
