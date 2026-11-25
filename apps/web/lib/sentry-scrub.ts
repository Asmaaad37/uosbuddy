/**
 * Launch fix 2: strip personal data from Sentry events before they leave the app. Request
 * bodies, cookies, headers and query strings can carry messages, emails, handles or session
 * tokens; a user is reduced to their id (no email, name or IP).
 */
type ScrubbableEvent = {
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
    query_string?: unknown;
  };
  user?: { id?: string | number; [key: string]: unknown };
};

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
    if (event.request.headers) {
      const ua = event.request.headers["user-agent"];
      event.request.headers = ua ? { "user-agent": ua } : {};
    }
  }
  if (event.user) event.user = event.user.id !== undefined ? { id: event.user.id } : {};
  return event;
}
