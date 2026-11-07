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
          "menu-pop z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) rounded-well bg-raised p-1 text-label shadow-lift",
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
        "flex h-11 cursor-pointer items-center gap-2.5 rounded-field px-3 text-body outline-none select-none data-[highlighted]:bg-thumb [&_svg]:size-[18px] [&_svg]:text-sec",
        danger && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}
