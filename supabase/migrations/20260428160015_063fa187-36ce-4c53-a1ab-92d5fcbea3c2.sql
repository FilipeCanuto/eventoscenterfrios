-- Lock down SECURITY DEFINER functions that should not be callable via the PostgREST API.
-- Triggers and internal helpers: revoke EXECUTE from anon and authenticated.

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_events_reschedule_reminders() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_registrations_cancel_reminders() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.schedule_event_reminders(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reschedule_event_reminders(uuid) FROM anon, authenticated, public;

-- has_role is used inside RLS policies (which run as the function owner via SECURITY DEFINER context).
-- It does not need to be exposed via the API. Revoke direct EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;

-- Keep EXECUTE for functions intentionally callable via API:
--   register_for_event(uuid, jsonb)            -> anon (public registration)
--   register_for_event(uuid, jsonb, jsonb)     -> anon (public registration with tracking)
--   track_page_view(uuid, text, text, jsonb)   -> anon (visitor analytics)
--   public_check_in(uuid)                      -> anon (QR check-in)
--   unsubscribe_reminders(uuid)                -> anon (email unsubscribe link)
--   get_registration_count(uuid)               -> anon (public event page)
--   get_check_in_window(uuid)                  -> authenticated (dashboard check-in screen)
