-- Hardening: functions run with the owner's rights (security definer) were still executable by
-- logged-out callers (anon), because Postgres grants EXECUTE to PUBLIC by default and these
-- were never revoked. Each one already checks the caller, so a logged-out call did nothing
-- useful; this closes the door anyway. Signed-in students keep access.
-- Left callable by anon on purpose: the access-rule helpers that table, storage and realtime
-- policies call (is_verified, is_admin, my_university_id, is_member, can_use_topic,
-- can_use_conversation_path), public_stats (the landing page's numbers), invite_preview (the
-- invite link page, before sign-up) and flag (feature switches).
-- Test 360 keeps it this way for new functions.

revoke execute on function
  public.allow_studies_change(uuid),
  public.answer_message_request(uuid, boolean),
  public.block_user(uuid),
  public.connection_state(uuid),
  public.conversation_people(uuid),
  public.create_group(text, text, uuid[]),
  public.decide_studies_change(uuid, boolean, text),
  public.delete_message(uuid),
  public.finish_setup(),
  public.incoming_requests(),
  public.join_batch_chat(text),
  public.mark_read(uuid),
  public.my_connections(),
  public.remove_connection(uuid),
  public.report(text, uuid, text, text),
  public.request_connection(uuid, text),
  public.request_studies_change(uuid, uuid, int, int, text, public.shift_type, text),
  public.respond_connection(uuid, boolean),
  public.save_my_about(text, text, text, public.residence_type, text),
  public.save_my_academic(uuid, uuid, int, int, text, public.shift_type),
  public.save_my_opening_move(text, text),
  public.send_message(uuid, text, text, uuid),
  public.start_dm(uuid),
  public.unblock_user(uuid)
  from public, anon;

grant execute on function
  public.allow_studies_change(uuid),
  public.answer_message_request(uuid, boolean),
  public.block_user(uuid),
  public.connection_state(uuid),
  public.conversation_people(uuid),
  public.create_group(text, text, uuid[]),
  public.decide_studies_change(uuid, boolean, text),
  public.delete_message(uuid),
  public.finish_setup(),
  public.incoming_requests(),
  public.join_batch_chat(text),
  public.mark_read(uuid),
  public.my_connections(),
  public.remove_connection(uuid),
  public.report(text, uuid, text, text),
  public.request_connection(uuid, text),
  public.request_studies_change(uuid, uuid, int, int, text, public.shift_type, text),
  public.respond_connection(uuid, boolean),
  public.save_my_about(text, text, text, public.residence_type, text),
  public.save_my_academic(uuid, uuid, int, int, text, public.shift_type),
  public.save_my_opening_move(text, text),
  public.send_message(uuid, text, text, uuid),
  public.start_dm(uuid),
  public.unblock_user(uuid)
  to authenticated, service_role;
