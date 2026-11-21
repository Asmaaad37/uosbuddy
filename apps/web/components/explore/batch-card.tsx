import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { ShareButton } from "@/components/discovery/share-button";
import { AvatarStack } from "@/components/ui/avatar";
import { HeroCard } from "@/components/ui/hero-card";

/**
 * Explore's focal card (explore-v2): your batch, who's here as an avatar stack with a count,
 * and the screen's one orange action, "Invite your batch". WhatsApp sits beside it as a quiet
 * icon button.
 */
export function BatchCard({
  title,
  me,
  batchmates,
  count,
  inviteUrl,
  shareText,
  whatsappHref,
}: {
  title: string;
  me: { name: string; src: string | null };
  batchmates: { name: string; src: string | null }[];
  /** Batchmates here, not counting you. */
  count: number;
  inviteUrl: string;
  shareText: string;
  whatsappHref: string;
}) {
  const here = count + 1;
  return (
    <HeroCard aria-labelledby="your-batch" className="grid gap-5">
      <div className="grid gap-1">
        <p className="text-overline text-on-fill/75 uppercase">Your batch</p>
        <h2 id="your-batch" className="text-[1.75rem] leading-8 font-extrabold tracking-[-0.03em]">
          {title}
        </h2>
      </div>
      <Link
        href="/explore/batch"
        className="-my-1 flex w-fit items-center gap-4 rounded-pill py-1 pr-2 active:scale-[0.98]"
      >
        <AvatarStack people={[me, ...batchmates]} slots={3} onMidnight />
        <span className="text-headline">
          <span className="text-[1.375rem] font-extrabold">{here}</span> here so far
        </span>
      </Link>
      <div className="flex gap-3">
        <ShareButton
          variant="cta"
          size="lg"
          className="min-w-0 flex-1"
          label="Invite your batch"
          icon="user-plus"
          url={inviteUrl}
          text={shareText}
        />
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          aria-label="Invite on WhatsApp"
          className="grid size-[52px] shrink-0 place-items-center rounded-btn bg-on-fill/15 text-on-fill transition-transform duration-100 ease-out hover:bg-on-fill/20 active:scale-[0.97]"
        >
          <MessageCircle className="size-6" aria-hidden />
        </a>
      </div>
    </HeroCard>
  );
}
