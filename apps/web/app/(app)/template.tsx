/**
 * Tab switch (redesign §6): each signed-in screen cross-fades in over 150 ms. A template
 * re-mounts on every navigation, so the fade plays per screen; the shell stays put.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
