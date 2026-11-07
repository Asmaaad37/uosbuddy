"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowBigUp,
  FileText,
  Flag,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { addResource, deleteResource, voteResource } from "@/actions/courses";
import { ReportDialog } from "@/components/connect/safety-menu";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { NativeSelect } from "@/components/ui/native-select";
import { signedUrl } from "@/components/ui/private-image";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RESOURCE_KINDS, fileSize, type ResourceKind } from "@/lib/academics";
import { browserClient } from "@/lib/supabase/lazy";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export type Resource = {
  id: string;
  kind: string;
  title: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  year: number | null;
  teacher_name: string | null;
  upvotes: number;
  mine: boolean;
  voted: boolean;
};

const BUCKET = "course-resources";
const TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Phase 6 task 3: a course's shared files — filter, upvote, open, upload. */
export function Resources({
  course,
  initial,
  enrolled,
}: {
  course: string;
  initial: Resource[];
  enrolled: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<ResourceKind | "all">("all");
  const [reporting, setReporting] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function open(r: Resource) {
    const url = await signedUrl(BUCKET, r.file_path);
    if (url) window.open(url, "_blank", "noopener");
    else setError("Couldn't open the file. Try again.");
  }

  async function vote(r: Resource) {
    const next = !r.voted;
    setItems((list) =>
      list.map((x) =>
        x.id === r.id ? { ...x, voted: next, upvotes: x.upvotes + (next ? 1 : -1) } : x,
      ),
    );
    const result = await voteResource(r.id, next);
    if (!result.ok) setError(result.error);
  }

  const shown = items.filter((r) => filter === "all" || r.kind === filter);

  return (
    <div className="grid gap-3">
      {enrolled && <UploadSheet course={course} onDone={() => router.refresh()} />}
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label="Filter files"
      >
        {(["all", ...Object.keys(RESOURCE_KINDS)] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k as ResourceKind | "all")}
            className={cn(
              "h-9 shrink-0 rounded-pill border px-3 text-sm font-semibold",
              filter === k
                ? "border-accent bg-tint text-tint-text"
                : "border-sep text-label hover:bg-raised",
            )}
          >
            {k === "all" ? "All" : RESOURCE_KINDS[k as ResourceKind]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {shown.length ? (
        <ul className="grid gap-2">
          {shown.map((r) => (
            <li
              key={r.id}
              id={`r-${r.id}`}
              className="flex scroll-mt-20 items-center gap-3 rounded-card border border-sep bg-surface p-3 target:border-accent"
            >
              <button
                type="button"
                onClick={() => open(r)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-field bg-raised text-sec">
                  {r.mime_type === "application/pdf" ? (
                    <FileText className="size-5" />
                  ) : (
                    <ImageIcon className="size-5" />
                  )}
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-semibold">{r.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-sec">
                    <Pill tone="neutral" className="h-5 px-1.5 text-[11px]">
                      {RESOURCE_KINDS[r.kind as ResourceKind] ?? r.kind}
                    </Pill>
                    {r.year && <span>{r.year}</span>}
                    {r.teacher_name && <span>· {r.teacher_name}</span>}
                    <span>· {fileSize(r.size_bytes)}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={r.voted}
                aria-label={`Upvote, ${r.upvotes}`}
                onClick={() => vote(r)}
                className={cn(
                  "flex h-9 items-center gap-1 rounded-pill px-2.5 text-sm font-semibold",
                  r.voted ? "bg-tint text-accent" : "bg-raised text-sec",
                )}
              >
                <ArrowBigUp className={cn("size-4", r.voted && "fill-current")} /> {r.upvotes}
              </button>
              <Menu>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="File options"
                    className="grid size-9 place-items-center rounded-pill text-sec hover:bg-raised"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </MenuTrigger>
                <MenuContent>
                  {r.mine ? (
                    <MenuItem
                      danger
                      onSelect={async () => {
                        const result = await deleteResource(r.id);
                        if (result.ok) setItems((list) => list.filter((x) => x.id !== r.id));
                        else setError(result.error);
                      }}
                    >
                      <Trash2 /> Delete
                    </MenuItem>
                  ) : (
                    <MenuItem onSelect={() => setReporting(r.id)}>
                      <Flag /> Report
                    </MenuItem>
                  )}
                </MenuContent>
              </Menu>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FileText}>
          {items.length
            ? "Nothing of that kind yet."
            : "No files yet. Share your notes or a past paper!"}
        </EmptyState>
      )}
      <ReportDialog
        open={!!reporting}
        onOpenChange={(o) => !o && setReporting(null)}
        title="Report file"
        targetType="resource"
        targetId={reporting ?? ""}
      />
    </div>
  );
}

function UploadSheet({ course, onDone }: { course: string; onDone: () => void }) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ResourceKind>("notes");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [teacher, setTeacher] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function pick(f: File | undefined) {
    if (!f) return;
    if (!TYPES[f.type]) return setError("Share a PDF or a photo (JPG, PNG, WebP).");
    if (f.size > 10 * 1024 * 1024) return setError("Files are up to 10 MB.");
    setError(undefined);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!file) return setError("Choose a file");
    setBusy(true);
    try {
      const path = `${course}/${crypto.randomUUID()}.${TYPES[file.type]}`;
      const supabase = await browserClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const result = await addResource({
        course,
        kind,
        title,
        path,
        mime: file.type as "application/pdf",
        size: file.size,
        year: year ? Number(year) : undefined,
        teacher: teacher || undefined,
      });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      setFile(null);
      setTitle("");
      onDone();
    } catch {
      setError("Couldn't upload the file. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" block>
          <Upload /> Share a file
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">Share a file</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-sec">
          PDF or photo, up to 10 MB. Everyone verified at UoS can open it.
        </SheetDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload /> {file ? `${file.name} (${fileSize(file.size)})` : "Choose a file"}
          </Button>
          <Field id={`${id}-kind`} label="What is it?">
            {(aria) => (
              <NativeSelect
                {...aria}
                value={kind}
                onChange={(e) => setKind(e.target.value as ResourceKind)}
              >
                {Object.entries(RESOURCE_KINDS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field id={`${id}-title`} label="Title">
            {(aria) => (
              <Input
                {...aria}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-year`} label="Year (optional)">
              {(aria) => (
                <Input
                  {...aria}
                  inputMode="numeric"
                  value={year}
                  maxLength={4}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                  placeholder="2025"
                />
              )}
            </Field>
            <Field id={`${id}-teacher`} label="Teacher (optional)">
              {(aria) => (
                <Input
                  {...aria}
                  value={teacher}
                  maxLength={80}
                  onChange={(e) => setTeacher(e.target.value)}
                />
              )}
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" block disabled={busy || !file}>
            {busy && <Loader2 className="animate-spin" />} Share
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
