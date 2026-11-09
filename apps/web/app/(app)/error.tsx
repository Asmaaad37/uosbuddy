"use client";

import { ErrorScreen } from "@/components/error-screen";

/** Inside the app shell, so the tab bar and sidebar stay usable. */
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} home="/explore" />;
}
