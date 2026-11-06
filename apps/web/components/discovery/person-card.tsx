import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Pill, Stamp } from "@/components/ui/badge";
import { cardLine, type DirectoryPerson } from "@/lib/discovery";
import { cn } from "@/lib/utils";

/**
 * Person card (Section 6.3 #6): avatar (photo only where allowed), name, studies line, up to
 * three interests and the strongest reason. The Connect pill arrives with Phase 4.
 */
export function PersonCard({
  person,
  reason,
  className,
}: {
  person: DirectoryPerson;
  reason?: string;
  className?: string;
}) {
  const name = person.full_name ?? person.handle ?? "Student";
  const line = cardLine(person);
  return (
    <Link
      href={`/people/${person.handle}`}
      className={cn(
        "flex gap-3 rounded-lg border border-line bg-surface p-3 transition-colors [contain-intrinsic-size:auto_96px] [content-visibility:auto] hover:border-ink-2/40",
        className,
      )}
    >
      <Avatar name={name} src={person.avatar_url} size="md" />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{name}</p>
          {person.has_uni_email && (
            <Stamp tone="email" className="h-5 shrink-0 text-[9px]">
              UoS email
            </Stamp>
          )}
        </div>
        {line && <p className="truncate text-[13px] text-ink-2">{line}</p>}
        {(reason || (person.interests?.length ?? 0) > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {reason && (
              <Pill tone="brand" className="h-6 px-2 text-xs">
                {reason}
              </Pill>
            )}
            {person.interests?.slice(0, reason ? 2 : 3).map((label) => (
              <Pill key={label} tone="neutral" className="h-6 px-2 text-xs">
                {label}
              </Pill>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
