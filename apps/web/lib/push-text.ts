/**
 * What a chat push says on the lock screen. A message request from someone you haven't
 * accepted never shows their words, and with previews off no message text is shown at all.
 */
export function messagePushText(m: {
  dm: boolean;
  chatTitle: string | null;
  sender: string;
  text: string;
  isRequest: boolean;
  previews: boolean;
}): { title: string; body: string } {
  if (m.isRequest) return { title: "New message request", body: "Open UOSBuddy to read it." };
  const title = m.dm ? m.sender : (m.chatTitle ?? "Group chat");
  if (!m.previews) return { title, body: m.dm ? "New message" : `${m.sender} sent a message` };
  return { title, body: m.dm ? m.text : `${m.sender}: ${m.text}` };
}
