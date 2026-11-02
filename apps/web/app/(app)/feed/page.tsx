import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadFeed, type Sort } from "@/actions/feed";
import { AppShell } from "@/components/app-shell";
import { Composer } from "@/components/feed/composer";
import { FeedList } from "@/components/feed/feed-list";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Feed" };

type Props = { searchParams: Promise<{ tab?: string; sort?: string }> };

/** Phase 5 task 2: Campus and Department feeds, Hot or New. */
export default async function FeedPage({ searchParams }: Props) {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/feed");
  const params = await searchParams;
  const deptSpace = profile.department_id ? `department:${profile.department_id}` : null;
  const tab = params.tab === "department" && deptSpace ? "department" : "campus";
  const space = tab === "department" ? deptSpace! : "campus";
  const sort: Sort = params.sort === "new" ? "new" : "hot";

  const [page, { data: dept }, { data: flag }] = await Promise.all([
    loadFeed({ space, sort }),
    profile.department_id
      ? supabase
          .from("departments")
          .select("short_code")
          .eq("id", profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("feature_flags").select("enabled").eq("key", "anonymous_posts").maybeSingle(),
  ]);
  const posts = page.ok ? page.data : { posts: [], next: null };
  const paths = posts.posts.flatMap((p) => p.media_paths ?? []);
  const { data: urls } = paths.length
    ? await supabase.storage.from("post-media").createSignedUrls(paths, 60 * 60)
    : { data: [] };

  const deptLabel = dept?.short_code ?? "Department";
  const href = (t: string, s: Sort) =>
    `/feed?${new URLSearchParams({ ...(t !== "campus" && { tab: t }), ...(s !== "hot" && { sort: s }) })}`;

  return (
    <AppShell>
      <h1 className="text-[28px] leading-tight font-bold">Feed</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Feeds" className="flex gap-2">
          {[
            { key: "campus", label: "Campus" },
            ...(deptSpace ? [{ key: "department", label: deptLabel }] : []),
          ].map((t) => (
            <Link
              key={t.key}
              href={href(t.key, sort)}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "flex h-10 items-center rounded-pill border px-4 text-sm font-semibold",
                tab === t.key
                  ? "border-ink bg-ink text-bg"
                  : "border-line bg-surface hover:border-ink-2/50",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Sort" className="flex rounded-pill bg-surface-2 p-1">
          {(["hot", "new"] as const).map((s) => (
            <Link
              key={s}
              href={href(tab, s)}
              aria-current={sort === s ? "page" : undefined}
              className={cn(
                "h-8 rounded-pill px-3 text-sm leading-8 font-semibold capitalize",
                sort === s ? "bg-surface text-ink shadow-card" : "text-ink-2",
              )}
            >
              {s}
            </Link>
          ))}
        </nav>
      </div>
      <Composer
        spaces={[
          { value: "campus", label: "Campus (all of UoS)" },
          ...(deptSpace ? [{ value: deptSpace, label: `${deptLabel} only` }] : []),
        ]}
        initialSpace={space}
        anonymousAllowed={!!flag?.enabled}
      />
      <FeedList
        // Re-mount after posting (router.refresh) so a new post shows up at the top.
        key={`${space}:${sort}:${posts.posts[0]?.id ?? ""}`}
        space={space}
        sort={sort}
        initial={posts}
        mediaUrls={Object.fromEntries(
          (urls ?? []).flatMap((u) => (u.path && u.signedUrl ? [[u.path, u.signedUrl]] : [])),
        )}
      />
    </AppShell>
  );
}
