/** What a notification says and where it leads, for the centre and for push (Phase 5). */
export type NotificationLike = {
  type: string;
  entity_id: string | null;
  payload: unknown;
  actor_name: string | null;
  actor_handle: string | null;
};

export type Described = { title: string; body?: string; href: string };

const route = (p: Record<string, unknown>) =>
  typeof p.from === "string" && typeof p.to === "string" ? `${p.from} → ${p.to}` : "Your ride";

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
    case "ride.request":
      return {
        title:
          p.kind === "request" ? `${who} can give you a lift` : `${who} wants a seat on your ride`,
        body: route(p),
        href: "/rides?tab=mine",
      };
    case "ride.accepted":
      return {
        title: `${who} accepted you on the ride`,
        body: `${route(p)}. Plan it in the ride chat.`,
        href: n.entity_id ? `/chats/${n.entity_id}` : "/rides?tab=mine",
      };
    case "ride.declined":
      return { title: `${who} couldn't take you this time`, body: route(p), href: "/rides" };
    case "ride.cancelled":
      return { title: `${who} cancelled the ride`, body: route(p), href: "/rides?tab=mine" };
    case "ride.left":
      return { title: `${who} left your ride`, body: route(p), href: "/rides?tab=mine" };
    case "event.reminder":
      return {
        title: `Starting soon: ${typeof p.title === "string" ? p.title : "your event"}`,
        body: typeof p.venue === "string" ? `At ${p.venue}` : undefined,
        href: "/events?tab=going",
      };
    case "event.cancelled":
      return {
        title: `Cancelled: ${typeof p.title === "string" ? p.title : "an event"}`,
        href: "/events?tab=going",
      };
    case "society.verified":
      return {
        title: "Your society page is verified",
        body: "You can post events now.",
        href: "/events?tab=societies",
      };
    case "access.women_only":
      return p.approved
        ? { title: "You can now see women-only rides", href: "/rides" }
        : {
            title: "Your women-only access request wasn't approved",
            href: "/me/privacy#women-only",
          };
    case "account.warning":
      return {
        title: "A warning from the UOSBuddy team",
        body: typeof p.message === "string" ? p.message : undefined,
        href: "/guidelines",
      };
    case "content.removed":
      return {
        title: `Your ${typeof p.kind === "string" ? p.kind : "post"} was removed`,
        body: "It broke the community guidelines.",
        href: "/guidelines",
      };
    case "badge.awarded":
      return {
        title: `New badge: ${typeof p.emoji === "string" ? `${p.emoji} ` : ""}${typeof p.name === "string" ? p.name : "unlocked"}`,
        href: "/me",
      };
    default:
      return { title: "Something new on UOSBuddy", href: "/notifications" };
  }
}
