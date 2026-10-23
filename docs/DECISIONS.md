# Decisions log

One line per non-obvious choice: what we chose, the alternatives, and why.

- 2026-10-23 · Phase R · Researched UniPal through REA headless Playwright scenarios (390×844) rather than a manual DevTools session, because the evidence is reproducible and passive by default. The Google sign-in and "Forgot password?" buttons were not clicked, because both would hit their auth backend.
- 2026-10-23 · Phase R · Recorded new features as §5.10 (#76–82) instead of editing §4.3 directly, because the N1 schema change needs human approval first (Rule 2).
- 2026-10-23 · Phase R · The human approved #76–82. Applied #76 to §4.3 (`university_domains.campus_id/mail_host/returning_only` + `auth_providers`) and promoted #35 Q&A to P0.
- 2026-10-23 · Design · Brand set to cobalt `#0034D3` on cream `#F2ECE1`, with navy `#0B0838` + sky `#99CCFF` in dark mode (Cosmos refs C/D chosen by the human). This replaces the placeholder campus green. Four lane colours (violet/mint/cyan/cobalt) carry feature identity instead of a single accent. Violet tiles use white text, because navy on violet is only 3.7:1.
- 2026-10-23 · Repo · Kept `UOSBuddy_BUILD_PLAN.md` at the root for now, although §4.1 says `docs/BUILD_PLAN.md`. The human has it open; it moves in Phase 0's scaffold commit.
