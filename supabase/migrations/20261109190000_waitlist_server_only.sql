-- Anyone could add rows to the university waitlist straight through the API, skipping the
-- form's bot check and rate limit. Only the server action writes here now, after both checks.
drop policy university_requests_insert on public.university_requests;
revoke insert on public.university_requests from anon, authenticated;
