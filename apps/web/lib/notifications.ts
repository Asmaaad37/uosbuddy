import { termLabel } from "@/lib/academics";
import { alertLine } from "@/lib/timetable/format";
import { dateRange, pakistanToday, whenLabel } from "@/lib/calendar";

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
    case "backup.expired":
      return {
        title: `${title.charAt(0).toUpperCase()}${title.slice(1)} expired`,
        body: p.mine
          ? "Nobody marked it done in 3 days. Ask again if you still need help."
          : "It wasn't marked done in 3 days, so it's closed now.",
        href: "/backup",
      };
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
    case "mentor.ended":
      return {
        title: `${who} ended your mentorship`,
        body: "You're still connected, so you can message each other.",
        href: "/mentors",
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
    case "studies.approved":
      return { title: "Your studies were updated", href: "/me" };
    case "studies.rejected":
      return {
        title: "We couldn't change your studies",
        body: typeof p.reason === "string" ? p.reason : undefined,
        href: "/setup/academic?edit=1",
      };
    case "badge.awarded":
      return {
        title: `New badge: ${typeof p.emoji === "string" ? `${p.emoji} ` : ""}${typeof p.name === "string" ? p.name : "unlocked"}`,
        href: "/me",
      };
    case "feature.live":
      return p.feature === "aibuddy"
        ? {
            title: "AIBuddy is here",
            body: "Ask about your courses. Answers come from your notes and past papers.",
            href: "/buddy",
          }
        : { title: "Something new is live on UOSBuddy", href: "/explore" };
    case "timetable.changed": {
      const count = typeof p.count === "number" ? p.count : 1;
      const line = alertLine((p.first ?? {}) as Record<string, unknown>);
      return {
        title: count === 1 ? "Your timetable changed" : `${count} changes to your timetable`,
        body: line ? `${line}${count > 1 ? ` (+${count - 1} more)` : ""}` : undefined,
        href: "/timetable",
      };
    }
    case "calendar.reminder": {
      const title = typeof p.title === "string" ? p.title : "A date on the academic calendar";
      const starts = typeof p.starts_on === "string" ? p.starts_on : null;
      return {
        title: starts
          ? `${title}: ${whenLabel({ starts_on: starts, ends_on: null }, pakistanToday()).toLowerCase()}`
          : title,
        body: starts
          ? `${dateRange({ starts_on: starts, ends_on: typeof p.ends_on === "string" ? p.ends_on : null })}${p.tentative ? " (tentative)" : ""}`
          : undefined,
        href: "/calendar",
      };
    }
    case "timetable.published":
      return {
        title: `Your ${termLabel(typeof p.term === "string" ? p.term : null) || "term"} timetable is up`,
        body: "See your week, with rooms and teachers.",
        href: "/timetable",
      };
    case "admin.verifications": {
      const n = typeof p.count === "number" ? p.count : 0;
      return {
        title: `${n} verification${n === 1 ? "" : "s"} waiting over a day`,
        body: "Students can't use UOSBuddy until they're checked.",
        href: "/admin/verifications",
      };
    }
    case "admin.imports":
      return {
        title: "A timetable import is still in review",
        body: "Students see the old timetable until it's published or discarded.",
        href: "/admin/timetable",
      };
    case "system.test":
      return {
        title: "Test notification",
        body: "Notifications are working on this device.",
        href: "/notifications",
      };
    default:
      return { title: "Something new on UOSBuddy", href: "/notifications" };
  }
}
