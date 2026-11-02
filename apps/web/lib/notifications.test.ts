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
});
