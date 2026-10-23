import type { AuthError } from "@supabase/supabase-js";

/** Supabase auth errors in words a student can act on. */
export function authErrorMessage(error: AuthError | null | undefined) {
  if (!error) return "Something went wrong. Try again.";
  switch (error.code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts just now. Wait a minute and try again.";
    case "otp_expired":
      return "That code has expired or is wrong. Request a new one.";
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the code.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Log in instead.";
    case "weak_password":
      return "Choose a stronger password.";
    case "otp_disabled":
    case "signup_disabled":
      return "New sign-ups are paused right now. Try again later.";
    default:
      return "Something went wrong. Try again.";
  }
}
