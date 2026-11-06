import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadFeed, type Sort } from "@/actions/feed";
import { AppShell } from "@/components/app-shell";
import { ComposeButton, Composer } from "@/components/feed/composer";
import { SortMenu } from "@/components/feed/sort-menu";
import { BellSlot } from "@/components/notifications/bell-slot";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FeedList } from "@/components/feed/feed-list";
import { getSession } from "@/lib/auth/session";

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

  const name = profile.full_name ?? profile.handle ?? "Me";

  return (
    <AppShell>
      <ScreenHeader
        title="Feed"
        actions={
          <>
            <span className="lg:hidden">
              <BellSlot />
            </span>
            <ComposeButton />
          </>
        }
      />
      <div className="flex items-center gap-2">
        <SegmentedControl
          label="Feeds"
          className="flex-1"
          value={tab}
          segments={[
            { value: "campus", label: "Campus", href: href("campus", sort) },
            ...(deptSpace
              ? [{ value: "department", label: deptLabel, href: href("department", sort) }]
              : []),
          ]}
        />
        <SortMenu value={sort} hrefs={{ hot: href(tab, "hot"), new: href(tab, "new") }} />
      </div>
      <Composer
        spaces={[
          { value: "campus", label: "Campus (all of UoS)" },
          ...(deptSpace ? [{ value: deptSpace, label: `${deptLabel} only` }] : []),
        ]}
        initialSpace={space}
        anonymousAllowed={!!flag?.enabled}
        me={{ name, src: profile.avatar_url }}
        placeholder={
          tab === "department" ? `Share something with ${deptLabel}` : "Share something with campus"
        }
      />
      {!page.ok && (
        <p role="alert" className="rounded-card bg-surface p-4 text-subhead text-danger">
          {page.error}{" "}
          <Link href={href(tab, sort)} className="font-semibold text-accent">
            Try again
          </Link>
        </p>
      )}
      <FeedList
        // Re-mount after posting (router.refresh) so a new post shows up at the top.
        key={`${space}:${sort}:${posts.posts[0]?.id ?? ""}`}
        space={space}
        sort={sort}
        initial={posts}
        failed={!page.ok}
        mediaUrls={Object.fromEntries(
          (urls ?? []).flatMap((u) => (u.path && u.signedUrl ? [[u.path, u.signedUrl]] : [])),
        )}
      />
    </AppShell>
  );
}
