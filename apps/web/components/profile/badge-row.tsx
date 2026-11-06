/** Phase 9 task 3: earned badges, shown as small stamps on a profile. */
export function BadgeRow({
  badges,
}: {
  badges: { slug: string; name: string; emoji: string; description: string }[];
}) {
  if (!badges.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Badges">
      {badges.map((b) => (
        <li
          key={b.slug}
          title={b.description}
          className="flex h-8 items-center gap-1.5 rounded-pill border border-sep bg-surface px-3 text-sm font-semibold"
        >
          <span aria-hidden>{b.emoji}</span> {b.name}
          <span className="sr-only">: {b.description}</span>
        </li>
      ))}
    </ul>
  );
}
