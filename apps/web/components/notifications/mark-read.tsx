"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/actions/notifications";

/** Opening the centre marks everything read (after it has rendered unread dots). */
export function MarkAllRead() {
  useEffect(() => {
    void markNotificationsRead();
  }, []);
  return null;
}
