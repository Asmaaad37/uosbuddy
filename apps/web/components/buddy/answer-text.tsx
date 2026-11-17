import { Fragment, type ReactNode } from "react";

/**
 * AI Buddy's answers in the simple formatting its prompt asks for: paragraphs, "-" and "1."
 * lists, **bold** and `code`. Built as React elements (never HTML), so whatever the model
 * writes is shown as text, not run; anything else stays as written.
 */
export function AnswerText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join("\n"))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={list.ordered ? "list-decimal pl-5" : "list-disc pl-5"}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      // A stray heading (the prompt asks for none) reads as a bold line.
      para.push(heading ? `**${heading[1]}**` : line);
    }
  }
  flushPara();
  flushList();
  return <div className="grid gap-2">{blocks}</div>;
}

/** **bold** and `code` inside a line; other characters as they are. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*\n]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^`[^`\n]+`$/.test(part)) {
      return (
        <code key={i} className="rounded bg-raised px-1 py-0.5 font-mono text-footnote">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
