/** What a notification says and where it leads, for the centre and for push (Phase 5). */
export type NotificationLike = {
  type: string;
  entity_id: string | null;
  payload: unknown;
  actor_name: string | null;
  actor_handle: string | null;
};

export type Described = { title: string; body?: string; href: string };

export function describe(n: NotificationLike): Described {
  const p = (n.payload ?? {}) as Record<string, unknown>;
  const who = n.actor_name ?? "Someone";
  const title = typeof p.title === "string" ? `“${p.title}”` : "your request";
  switch (n.type) {
    case "connect.request":
      return {
        title: `${who} wants to connect`,
        body: typeof p.message === "string" && p.message ? p.message : undefined,
        href: "/chats?tab=requests",
      };
    case "connect.accepted":
      return {
        title: `${who} accepted your request`,
        body: "Say hi!",
        href: n.actor_handle ? `/people/${n.actor_handle}` : "/chats",
      };
    case "backup.nearby":
      return {
        title: `${who} needs backup`,
        body: typeof p.title === "string" ? p.title : undefined,
        href: "/backup",
      };
    case "backup.claimed":
      return {
        title: `${who} is helping with ${title}`,
        body: "Open the chat to sort it out.",
        href: "/backup",
      };
    case "backup.unclaimed":
      return {
        title: `${who} can't help with ${title} after all`,
        body: "It's open again for others.",
        href: "/backup",
      };
    case "backup.resolved":
      return {
        title: `${who} marked ${title} done`,
        body:
          typeof p.points === "number" ? `+${p.points} points for helping. Thank you!` : undefined,
        href: "/backup",
      };
    case "backup.cancelled":
      return { title: `${who} cancelled ${title}`, href: "/backup" };
    case "post.comment":
      return {
        title: `${who} commented on your post`,
        body: typeof p.preview === "string" ? p.preview : undefined,
        href: n.entity_id ? `/feed/${n.entity_id}` : "/feed",
      };
    case "comment.reply":
      return {
        title: `${who} replied to your comment`,
        body: typeof p.preview === "string" ? p.preview : undefined,
        href: n.entity_id ? `/feed/${n.entity_id}` : "/feed",
      };
    case "ping":
      return {
        title: `${who} asks: you free?`,
        body: "Reply within 2 hours.",
        href: n.entity_id ? `/chats/${n.entity_id}` : "/chats",
      };
    case "mentor.request":
      return {
        title: `${who} would like you to mentor them`,
        body: typeof p.message === "string" && p.message ? p.message : undefined,
        href: "/mentors",
      };
    case "mentor.accepted":
      return {
        title: `${who} will mentor you`,
        body: "You're connected now. Say hi!",
        href: n.actor_handle ? `/people/${n.actor_handle}` : "/mentors",
      };
    default:
      return { title: "Something new on UOSBuddy", href: "/notifications" };
  }
}
