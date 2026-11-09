import { removePushSubscription, savePushSubscription } from "@/actions/notifications";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type TurnOnResult =
  { state: "on" } | { state: "blocked" } | { state: "error"; error: string };

/** Asks the browser for permission, subscribes it to Web Push and remembers it for this student. */
export async function subscribeThisDevice(key: string): Promise<TurnOnResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { state: "blocked" };
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));
    const result = await savePushSubscription(sub.toJSON(), navigator.userAgent);
    return result.ok ? { state: "on" } : { state: "error", error: result.error };
  } catch {
    return { state: "error", error: "Couldn't turn on notifications in this browser." };
  }
}

/** Stops pushes to this browser: for "Turn off", and on log out so alerts don't follow you off a shared device. */
export async function forgetThisDevice() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscription(sub.endpoint);
  await sub.unsubscribe();
}
