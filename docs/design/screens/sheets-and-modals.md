# Sheets, dialogs and detail screens

The last step of the 60 · 30 · 10 redesign: every sheet and dialog, plus the chat thread, post
detail and profile actions.

## Audit (before)

- Every sheet's submit (Post, Save, Ask, Create, Upload, Send report…) was plain Midnight, so a
  sheet, which works as its own screen, had no orange action.
- Chat thread Send, the post-detail Comment button and the profile's Connect / Message were Midnight.
- Some descriptions ran 15–21 words (Rides, Market, Society, waitlist, hide chat, Opening Move).
- Rides → Repeats day chips were outlined Sky, unlike `Chip`.

## Plan

1. **One orange action per sheet or dialog:** the submit of each sheet (feed composer, Backup ask,
   market listing, ride, event, society, course, study group, upload, own class, section change,
   group rename and add people, connect note, report, guidelines, waitlist, photo crop, admin
   announce). Dismiss and destructive buttons are unchanged (`quiet` and `destructive`).
2. **Detail screens:** chat Send, post Comment, profile Connect / Message are orange (only one
   shows at a time).
3. **Shorter descriptions:**
   - Rides: "Numbers stay hidden. You'll chat once you accept someone."
   - Market: "Meet on campus to hand things over, and never pay in advance."
   - Society: "For registered UoS societies. An admin checks it first."
   - Waitlist: "Tell us your university. We'll email you once when it's live."
   - Hide chat: "{Name} keeps it. It comes back with any new message."
   - Opening Move: "Reply to their Opening Move to break the ice."
   - Safety wording (report, block, self-harm, support) is unchanged on purpose.
4. **Rides → Repeats** day chips match `Chip` (Midnight when selected).
