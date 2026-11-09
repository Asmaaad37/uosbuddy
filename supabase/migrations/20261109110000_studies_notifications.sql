-- Tell a student when their studies change is approved or rejected.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only',
  'account.warning', 'content.removed', 'badge.awarded',
  'feature.live', 'system.test',
  'studies.approved', 'studies.rejected'
));
