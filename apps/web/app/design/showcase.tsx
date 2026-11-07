"use client";

import * as React from "react";
import {
  Bell,
  Car,
  FileText,
  HelpCircle,
  Lock,
  MessageCircle,
  PenSquare,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, Overline, SectionHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupedList, Row } from "@/components/ui/grouped-list";
import { Field, Input, SearchField } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TabBar } from "@/components/ui/tab-bar";
import { toast } from "@/components/ui/toast";
import { VerifiedBadge } from "@/components/ui/verified-badge";

const swatches = [
  ["bg", "bg-bg"],
  ["surface", "bg-surface"],
  ["raised", "bg-raised"],
  ["track", "bg-track"],
  ["thumb", "bg-thumb"],
  ["sep", "bg-sep"],
  ["label", "bg-label"],
  ["sec", "bg-sec"],
  ["ter", "bg-ter"],
  ["accent", "bg-accent"],
  ["fill", "bg-fill"],
  ["tint", "bg-tint"],
  ["danger", "bg-danger"],
] as const;

const type = [
  ["Large title", "text-large-title", "34 / 41 · 700 · −2.2%"],
  ["Title 2", "text-title2", "22 / 28 · 700 · −1.2%"],
  ["Section header", "text-section", "20 / 25 · 700"],
  ["Headline", "text-headline", "17 / 22 · 600"],
  ["Body text", "text-body", "17 / 24 · 400"],
  ["Subhead and rows", "text-subhead", "15 / 20 · 400"],
  ["Footnote and meta", "text-footnote", "13 / 18 · 400"],
  ["Tab label", "text-tab-label", "11 / 13 · 600 · +1%"],
] as const;

const NEEDS = [
  ["notes", "Notes", FileText],
  ["explain", "Explain a topic", HelpCircle],
  ["ride", "Ride", Car],
  ["company", "Company", Users],
  ["borrow", "Borrow something", ShoppingBag],
] as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="px-1 text-overline text-ter uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** One theme's worth of every primitive (redesign §2–3). */
export function Showcase({ theme }: { theme: "light" | "dark" }) {
  const id = (s: string) => `${theme}-${s}`;
  const [segment, setSegment] = React.useState("primary");
  const [need, setNeed] = React.useState("notes");

  return (
    <div data-theme={theme} className="grid min-w-0 gap-8 bg-bg px-4 py-8 text-label md:px-8">
      <div className="flex items-center justify-between">
        <p className="text-title2">{theme.toUpperCase()}</p>
        <div className="flex gap-2">
          <IconButton aria-label="Notifications">
            <Bell />
          </IconButton>
          <IconButton fill aria-label="New post">
            <PenSquare />
          </IconButton>
        </div>
      </div>

      <Group title="Colour">
        <Card className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {swatches.map(([name, cls]) => (
            <div key={name} className="grid gap-1">
              <span className={`h-10 rounded-field border border-sep ${cls}`} />
              <span className="text-footnote text-ter">{name}</span>
            </div>
          ))}
        </Card>
      </Group>

      <Group title="Type">
        <Card className="grid gap-3">
          {type.map(([label, cls, spec]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b border-sep pb-2 last:border-0"
            >
              <span className={cls}>{label}</span>
              <span className="shrink-0 text-footnote text-ter">{spec}</span>
            </div>
          ))}
          <Overline>Overline · 13 / 18 · 600</Overline>
        </Card>
      </Group>

      <Group title="Buttons">
        <div className="grid grid-cols-2 gap-3">
          <Button>Primary</Button>
          <Button variant="tinted">Tinted</Button>
          <Button variant="plain">Plain</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm" variant="tinted">
            Small tinted
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Group>

      <Group title="Inputs">
        <SearchField placeholder="Search people and chats" aria-label="Search people and chats" />
        <Field id={id("handle")} label="Handle" hint="Letters, numbers and underscores.">
          {(aria) => <Input {...aria} defaultValue="ali" />}
        </Field>
        <Field
          id={id("roll")}
          label="Roll number"
          error="That doesn't look like a UoS roll number."
        >
          {(aria) => <Input {...aria} defaultValue="12-ABC" />}
        </Field>
        <Field id={id("dept")} label="Department">
          {(aria) => (
            <NativeSelect {...aria} defaultValue="">
              <option value="">Choose your department</option>
              <option>Computer Science</option>
            </NativeSelect>
          )}
        </Field>
      </Group>

      <Group title="Segmented control">
        <SegmentedControl
          label="Chats"
          value={segment}
          onChange={setSegment}
          segments={[
            { value: "primary", label: "Primary" },
            { value: "requests", label: "Requests" },
            { value: "groups", label: "Groups" },
          ]}
        />
      </Group>

      <Group title="Chips and pills">
        <div className="flex flex-wrap gap-2">
          {NEEDS.map(([value, label, icon]) => (
            <Chip key={value} icon={icon} selected={need === value} onClick={() => setNeed(value)}>
              {label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill>Same section</Pill>
          <Pill tone="brand">Soon</Pill>
          <Pill tone="outline">CS · 2022</Pill>
          <span className="flex items-center gap-1 text-headline">
            Asmaad Saeed <VerifiedBadge />
          </span>
        </div>
      </Group>

      <Group title="Grouped list">
        <GroupedList header="Privacy and settings">
          <Row icon={Lock} title="Privacy" subtitle="Who sees your profile" href="#" />
          <Row icon={Bell} title="Notifications" href="#" />
          <Row
            icon={MessageCircle}
            title="Admin"
            subtitle="Verification queue, reports"
            href="#"
            trailing={<Pill tone="brand">Review</Pill>}
          />
        </GroupedList>
      </Group>

      <Group title="Cards and empty states">
        <Card className="grid gap-3">
          <Overline>Your batch</Overline>
          <p className="text-title2">CS · Class of 2022</p>
          <AvatarStack people={[{ name: "Asmaad Saeed" }]} />
        </Card>
        <SectionHeader title="People like you" trailing="See all" />
        <EmptyState
          icon={Users}
          action={
            <Button variant="plain" size="sm">
              Invite batchmates
            </Button>
          }
        >
          Suggestions appear as more of your batch joins.
        </EmptyState>
        <EmptyState
          icon={Search}
          title="No chats yet"
          action={
            <Button variant="tinted" size="md">
              Find your batch
            </Button>
          }
        >
          Say hi to someone in your batch. Chats you start show up here.
        </EmptyState>
      </Group>

      <Group title="Avatars">
        <div className="flex items-end gap-3">
          {([36, 40, 44, 52, 64] as const).map((s) => (
            <Avatar key={s} name="Asmaad Saeed" size={s} />
          ))}
        </div>
      </Group>

      <Group title="Tab bar">
        <div className="relative h-28 overflow-hidden rounded-card bg-bg">
          <TabBar className="absolute" />
        </div>
      </Group>

      <Group title="Overlays and feedback">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="tinted">
                Open dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Block Bilal?</DialogTitle>
              <DialogDescription>
                He won&apos;t be able to find you or message you. He isn&apos;t told.
              </DialogDescription>
              <div className="grid grid-cols-2 gap-3">
                <DialogClose asChild>
                  <Button variant="quiet">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive">Block</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="tinted">
                Open sheet
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="text-title2">Filters</SheetTitle>
              <SheetDescription className="mb-4 text-subhead text-sec">
                Narrow the directory.
              </SheetDescription>
              <div className="flex flex-wrap gap-2">
                <Chip selected>Same section</Chip>
                <Chip>Same city</Chip>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            size="sm"
            variant="tinted"
            onClick={() =>
              toast("Post hidden", { action: { label: "Undo", onClick: () => undefined } })
            }
          >
            Show toast
          </Button>
        </div>
      </Group>
    </div>
  );
}
