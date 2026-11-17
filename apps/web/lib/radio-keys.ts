import type { KeyboardEvent } from "react";

/**
 * Arrow keys for a hand-made radio group (role="radiogroup" with role="radio" buttons), as
 * keyboard and screen-reader users expect: Right/Down picks the next option, Left/Up the
 * previous, Home/End the first and last. Put it on the group's onKeyDown.
 */
export function radioArrowKeys(e: KeyboardEvent<HTMLElement>) {
  const radios = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'),
  );
  if (!radios.length) return;
  const at = radios.indexOf(document.activeElement as HTMLElement);
  let next: number;
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      next = at < 0 ? 0 : (at + 1) % radios.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      next = at < 0 ? radios.length - 1 : (at - 1 + radios.length) % radios.length;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = radios.length - 1;
      break;
    default:
      return;
  }
  e.preventDefault();
  radios[next]!.focus();
  radios[next]!.click();
}
