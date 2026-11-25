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
    case "same_password":
      return "That's your current password. Choose a new one.";
    case "captcha_failed":
      return "The security check didn't go through. Refresh the page and try again.";
    case "otp_disabled":
    case "signup_disabled":
      return "New sign-ups are paused right now. Try again later.";
    default:
      // The sign-ups switch (launch fix 3) refuses new accounts in the database.
      if (error.message?.includes("saving new user")) {
        return "New sign-ups are paused right now. Try again later.";
      }
      // Sending the email is the usual failure at this level.
      return (error.status ?? 0) >= 500
        ? "We couldn't send that just now. Try again in a few minutes."
        : "Something went wrong. Try again.";
  }
}
