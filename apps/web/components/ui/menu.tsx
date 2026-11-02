"use client";

import * as React from "react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// Small overflow menus ("More" on profiles and chats).
export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align="end"
        sideOffset={6}
        className={cn(
          "z-50 min-w-44 rounded-md border border-line bg-surface p-1 text-ink shadow-lift",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & { danger?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex h-10 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm font-medium outline-none select-none data-[highlighted]:bg-surface-2 [&_svg]:size-4",
        danger && "text-danger",
        className,
      )}
      {...props}
    />
  );
}
