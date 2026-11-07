"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/discovery/share-button";
import type { DirectoryPerson } from "@/lib/discovery";

/** Counts up to `to` over ~1.2 s (eased), or shows it at once with reduced motion. */
function useCountUp(to: number, reduce: boolean | null) {
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce || to === 0) return setN(to);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, reduce]);
  return n;
}

/**
 * Batch reveal (Section 7 #10), shown once after setup: how many of your batch are here,
 * a fan of the first few, and an invite.
 */
export function BatchReveal({
  count,
  label,
  people,
  inviteUrl,
}: {
  count: number;
  label: string;
  people: DirectoryPerson[];
  inviteUrl: string;
}) {
  const reduce = useReducedMotion();
  const n = useCountUp(count, reduce);
  const fan = people.slice(0, 3);

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        aria-labelledby="reveal"
        className="grid gap-5 rounded-card bg-surface p-5 text-center shadow-card"
      >
        {count > 0 ? (
          <>
            <p
              className="text-[64px] leading-none font-bold tracking-[-0.03em] text-accent"
              aria-hidden
            >
              {n}
            </p>
            <h2 id="reveal" className="text-title2">
              <span className="sr-only">{count} </span>
              of {label} {count === 1 ? "is" : "are"} already here
            </h2>
          </>
        ) : (
          <h2 id="reveal" className="text-title2">
            You&apos;re the first from {label}!
          </h2>
        )}

        {fan.length > 0 && (
          <div className="relative mx-auto h-28 w-64" aria-hidden>
            {fan.map((p, i) => {
              const name = p.full_name ?? p.handle ?? "Student";
              const angle = fan.length === 1 ? 0 : (i - (fan.length - 1) / 2) * 10;
              return (
                <m.div
                  key={p.id}
                  className="absolute top-2 left-1/2 -ml-20 flex w-40 items-center gap-2 rounded-well bg-raised p-2 text-left shadow-card"
                  initial={reduce ? false : { opacity: 0, y: 24, rotate: 0 }}
                  animate={{ opacity: 1, y: Math.abs(angle) / 2, rotate: angle, x: angle * 5 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 22,
                    delay: 0.9 + i * 0.08,
                  }}
                >
                  <Avatar name={name} src={p.avatar_url} size="sm" />
                  <span className="truncate text-subhead font-semibold">{name.split(" ")[0]}</span>
                </m.div>
              );
            })}
          </div>
        )}

        <div className="grid gap-2">
          {count > 0 && (
            <Button asChild block>
              <Link href="/explore/batch">See your batch</Link>
            </Button>
          )}
          <ShareButton
            block
            variant={count > 0 ? "tinted" : "primary"}
            url={inviteUrl}
            text="I'm on UOSBuddy. Come find our batch:"
          />
        </div>
      </section>
    </LazyMotion>
  );
}
