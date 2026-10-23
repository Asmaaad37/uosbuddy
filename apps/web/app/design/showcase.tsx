"use client";

import * as React from "react";
import { BookOpen, Car, LifeBuoy, MessageCircle, ShoppingBag, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Chip, Stamp } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FeatureTile } from "@/components/ui/feature-tile";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Marquee } from "@/components/ui/marquee";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";

const swatches = [
  ["bg", "bg-bg"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["ink", "bg-ink"],
  ["ink-2", "bg-ink-2"],
  ["line", "bg-line"],
  ["brand", "bg-brand"],
  ["brand-soft", "bg-brand-soft"],
  ["brand-deep", "bg-brand-deep"],
  ["lane-people", "bg-lane-people"],
  ["lane-learn", "bg-lane-learn"],
  ["lane-help", "bg-lane-help"],
  ["lane-campus", "bg-lane-campus"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-t border-line pt-6">
      <h2 className="text-xs font-semibold tracking-[0.12em] text-ink-2 uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function Showcase({ theme }: { theme: "light" | "dark" }) {
  const id = (s: string) => `${theme}-${s}`;
  const [handle, setHandle] = React.useState("ali");

  return (
    <div
      data-theme={theme}
      className="grid min-w-0 grid-cols-1 gap-8 bg-bg px-4 py-8 text-ink md:px-8"
    >
      <header className="flex items-center justify-between">
        <p className="font-pixel text-2xl">{theme.toUpperCase()}</p>
        <Stamp tone="verified">VERIFIED</Stamp>
      </header>

      <Section title="Colour tokens">
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {swatches.map(([name, cls]) => (
            <li key={name} className="grid gap-1.5">
              <span className={`h-12 rounded-sm border border-line ${cls}`} />
              <span className="truncate font-mono text-[11px] text-ink-2">{name}</span>
            </li>
          ))}
        </ul>
        <div className="bg-holo h-10 rounded-pill" aria-label="Holographic accent" role="img" />
      </Section>

      <Section title="Typography">
        <p className="font-pixel text-[44px] leading-none">143 BATCHMATES</p>
        <p className="text-[28px] leading-tight font-bold">Find your batch. Find your people.</p>
        <p className="max-w-prose">
          Body 16/1.5 in Geist. Students verify they belong to UoS, find their batch and section,
          and get backup from batchmates and seniors.
        </p>
        <p className="text-sm text-ink-2">Secondary text · CS · 2024 · Sec B · Morning</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Get started</Button>
          <Button variant="brand">Connect</Button>
          <Button variant="secondary">I already have an account</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger" size="md">
            Block
          </Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="secondary">
            Small
          </Button>
          <Button size="icon" variant="secondary" aria-label="Message">
            <MessageCircle />
          </Button>
        </div>
        <Button block>Full-width primary (mobile)</Button>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("handle")} label="Handle" hint="Letters, numbers and underscores.">
            {(aria) => (
              <Input {...aria} value={handle} onChange={(e) => setHandle(e.target.value)} />
            )}
          </Field>
          <Field
            id={id("roll")}
            label="Roll number"
            hint="Only an admin sees this. Deleted after review."
            error="That doesn't look like a UoS roll number."
          >
            {(aria) => <Input {...aria} defaultValue="12-ABC" />}
          </Field>
          <Field id={id("bio")} label="Bio" hint="Up to 280 characters.">
            {(aria) => <Textarea {...aria} placeholder="Chai, cricket and C++." />}
          </Field>
          <Field id={id("dept")} label="Department">
            {(aria) => (
              <Select>
                <SelectTrigger {...aria}>
                  <SelectValue placeholder="Choose your department" />
                </SelectTrigger>
                <SelectContent data-theme={theme}>
                  <SelectGroup>
                    <SelectLabel>Computing</SelectLabel>
                    <SelectItem value="cs">Computer Science</SelectItem>
                    <SelectItem value="it">Information Technology</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Sciences</SelectLabel>
                    <SelectItem value="math">Mathematics</SelectItem>
                    <SelectItem value="phy">Physics</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="section">
          <TabsList aria-label="Directory scope">
            <TabsTrigger value="section">My Section</TabsTrigger>
            <TabsTrigger value="batch">My Batch</TabsTrigger>
            <TabsTrigger value="dept">My Department</TabsTrigger>
            <TabsTrigger value="all">All UoS</TabsTrigger>
          </TabsList>
          <TabsContent value="section" className="pt-3 text-ink-2">
            38 people in CS · 2024 · Sec B
          </TabsContent>
          <TabsContent value="batch" className="pt-3 text-ink-2">
            143 people in CS · 2024
          </TabsContent>
          <TabsContent value="dept" className="pt-3 text-ink-2">
            612 people in CS
          </TabsContent>
          <TabsContent value="all" className="pt-3 text-ink-2">
            4,210 people at UoS
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Avatars, chips and stamps">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name="Ayesha Khan" size="sm" />
          <Avatar name="Bilal Ahmed" />
          <Avatar name="Sana Iqbal" size="lg" />
          <Avatar name="Hamza Raza" size="xl" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip>🏏 Cricket</Chip>
          <Chip>💻 Coding</Chip>
          <Chip tone="outline">📚 Poetry</Chip>
          <Chip tone="brand">Same section</Chip>
          <Chip tone="people">Batch</Chip>
          <Chip tone="learn">Courses</Chip>
          <Chip tone="help">Backup</Chip>
          <Chip tone="campus">Rides</Chip>
        </div>
        <div className="flex flex-wrap gap-3">
          <Stamp tone="verified">Verified</Stamp>
          <Stamp tone="email">UoS Email</Stamp>
          <Stamp tone="mentor">Mentor</Stamp>
          <Stamp tone="hero">Backup Hero</Stamp>
        </div>
      </Section>

      <Section title="Feature dock">
        <div className="flex flex-wrap gap-3">
          <FeatureTile href="#" label="Batch" lane="people" icon={<Users />} />
          <FeatureTile href="#" label="Backup" lane="help" icon={<LifeBuoy />} />
          <FeatureTile href="#" label="Courses" lane="learn" icon={<BookOpen />} />
          <FeatureTile href="#" label="Buddy" lane="learn" icon={<Sparkles />} />
          <FeatureTile href="#" label="Rides" lane="campus" icon={<Car />} />
          <FeatureTile href="#" label="Market" lane="campus" icon={<ShoppingBag />} />
        </div>
      </Section>

      <Section title="Marquee">
        <Marquee
          items={[
            "12 new batchmates today",
            "Backup claimed in CS-201",
            "Rides to Lahore Friday",
            "1,204 students joined",
          ]}
        />
      </Section>

      <Section title="Overlays and feedback">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="md">
                Open dialog
              </Button>
            </DialogTrigger>
            <DialogContent data-theme={theme}>
              <DialogTitle>Block Bilal?</DialogTitle>
              <DialogDescription>
                You won&apos;t see each other anywhere on UOSBuddy. They won&apos;t be told.
              </DialogDescription>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost" size="md">
                    Cancel
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" size="md">
                    Block
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="md">
                Open sheet
              </Button>
            </SheetTrigger>
            <SheetContent data-theme={theme}>
              <SheetTitle className="text-xl font-bold">Filters</SheetTitle>
              <SheetDescription className="mt-1 text-ink-2">
                Narrow your batch by shift, residence and hometown.
              </SheetDescription>
              <div className="mt-6 flex flex-wrap gap-2">
                <Chip tone="brand">Morning</Chip>
                <Chip>Evening</Chip>
                <Chip>Hostelite</Chip>
                <Chip>Day scholar</Chip>
              </div>
              <Button block className="mt-8">
                Show 38 people
              </Button>
            </SheetContent>
          </Sheet>

          <Button
            variant="secondary"
            size="md"
            onClick={() =>
              toast.success("Request sent", { description: "We'll ping you when Sana accepts." })
            }
          >
            Show toast
          </Button>
        </div>
      </Section>

      <Section title="Dotted canvas">
        <div className="bg-dotted grid h-40 place-items-center rounded-lg border border-line">
          <p className="text-ink-2">Your section is quiet. Invite 3 classmates.</p>
        </div>
      </Section>
    </div>
  );
}
