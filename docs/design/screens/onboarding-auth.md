# Onboarding and sign-in

The 60 · 30 · 10 formula applied to sign-in (`/login`, `/forgot-password`, `/reset-password`),
sign-up (`/start/*`, `/pending`) and profile setup (`/setup/*`, also used to edit from Me).

## Audit (before)

- Every step's main button (Email me a code, Continue, Send reset link, Save) was plain Midnight,
  so nothing marked the one thing to do on each step.
- Helper lines ran 13–17 words ("UOSBuddy starts with one campus, so everyone here is actually near
  you.", "Pick up to 10. We use them to suggest people you'll get along with.", the code hints).
- The Shift and "Where do you stay?" choices used an outlined Sky style, unlike the app's chips.

## Plan

1. **One orange action per step:** each form's submit (and Google when it's the main way in) uses
   `cta`. Secondary paths stay tinted or quiet: the email form under Google, "Pending" status,
   "Not from UoS?".
2. **Shorter lines (≤12 words):**
   - Campus: "One campus for now, so everyone here is nearby."
   - Fresher option: "Join with your roll number and a photo of your proof."
   - Fresher account: "Your account first, then a photo of your proof."
   - Forgot password: "We'll email you a link to set a new one."
   - About you: "A photo and a few words help people say hi."
   - Interests: "Pick up to 10 to meet people like you."
   - Privacy: "Only verified UoS students see you. Roll number and email stay private."
   - Code steps: "We sent a 6-digit code to {email}. Check spam too."
3. **Choice pills** (Shift, Where do you stay?) match `Chip`: 48px pills on Card with a lift,
   selected = Midnight with white, heavier text.

Fields, steps, validation, captcha and routes are unchanged. Dialogs and sheets in these flows
(waitlist, avatar cropper) come with the remaining sheets and modals.
