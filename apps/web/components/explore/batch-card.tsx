import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { ShareButton } from "@/components/discovery/share-button";
import { Button } from "@/components/ui/button";
import { AvatarStack } from "@/components/ui/avatar";
import { Card, Overline } from "@/components/ui/card";

/**
 * Explore batch card (redesign §5.1 #2): who from your batch is here, as an avatar stack
 * with dashed empty slots, and two ways to invite the rest.
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
  return (
    <Card className="grid gap-4">
      <div className="grid gap-0.5">
        <Overline>Your batch</Overline>
        <h2 className="text-title2">{title}</h2>
      </div>
      <AvatarStack people={[me, ...batchmates]} />
      {count >= 3 ? (
        <Link
          href="/explore/batch"
          className="-my-1 flex items-center justify-between gap-2 py-1 active:opacity-70"
        >
          <span className="text-body">
            <span className="font-semibold">{count} of your batch are here</span>
          </span>
          <span className="flex items-center text-subhead text-accent">
            See your batch
            <ChevronRight className="size-[18px]" aria-hidden />
          </span>
        </Link>
      ) : (
        <p className="text-body text-sec">
          You&apos;re one of the first here. Invite your batch and this fills up.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <ShareButton block label="Invite batch" url={inviteUrl} text={shareText} />
        <Button asChild block variant="tinted">
          <a href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        </Button>
      </div>
    </Card>
  );
}
