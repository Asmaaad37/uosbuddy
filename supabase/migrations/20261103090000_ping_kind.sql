-- Phase 6 task 7: "You free?" pings open a 2-hour chat. A new conversation kind, added in
-- its own migration because a new enum value can't be used in the transaction that adds it.
alter type public.conversation_kind add value if not exists 'ping';
