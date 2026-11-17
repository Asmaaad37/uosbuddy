-- Dead code: privacy_settings.women_only_spaces was never read or written. Women-only access
-- is a request an admin confirms (women_only_access and women_eligible()), not a setting.
alter table public.privacy_settings drop column women_only_spaces;
