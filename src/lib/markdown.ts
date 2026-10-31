import type { Chapter } from "./types";
import { slugify } from "./xml";

/**
 * Split Markdown/plain text into chapters on ATX `#` headings.
 * Content before the first heading becomes "Inleiding" when other chapters exist,
 * or a single chapter named after the book title when there are no headings.
 */
export function splitIntoChapters(content: string, bookTitle: string): Chapter[] {
  const text = content.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return [{ id: "hoofdstuk-1", title: bookTitle || "Hoofdstuk 1", markdown: "" }];
  }

  const lines = text.split("\n");
  const headingIndexes: { index: number; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#\s+(.+?)\s*$/);
    if (match) {
      headingIndexes.push({ index: i, title: match[1].trim() || `Hoofdstuk ${headingIndexes.length + 1}` });
    }
  }

  if (headingIndexes.length === 0) {
    return [
      {
        id: "hoofdstuk-1",
        title: bookTitle || "Hoofdstuk 1",
        markdown: text,
      },
    ];
  }

  const chapters: Chapter[] = [];
  const usedIds = new Set<string>();

  const preamble = lines.slice(0, headingIndexes[0].index).join("\n").trim();
  if (preamble) {
    chapters.push({
      id: uniqueId("inleiding", usedIds),
      title: "Inleiding",
      markdown: preamble,
    });
  }

  for (let i = 0; i < headingIndexes.length; i++) {
    const start = headingIndexes[i].index + 1;
    const end = i + 1 < headingIndexes.length ? headingIndexes[i + 1].index : lines.length;
    const body = lines.slice(start, end).join("\n").trim();
    const title = headingIndexes[i].title;
    chapters.push({
      id: uniqueId(slugify(title), usedIds),
      title,
      markdown: body,
    });
  }

  return chapters;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

/** Convert a limited Markdown subset to EPUB-friendly XHTML body fragments. */
export function markdownToXhtml(markdown: string): string {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return "<p></p>";
  }

  const blocks = text.split(/\n{2,}/);
  const out: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading && !trimmed.includes("\n")) {
      const level = Math.min(heading[1].length, 6);
      out.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      continue;
    }

    if (/^([-*_])\1{2,}\s*$/.test(trimmed)) {
      out.push("<hr />");
      continue;
    }

    const listLines = trimmed.split("\n");
    const isUl = listLines.every((l) => /^[-*+]\s+/.test(l.trim()) || l.trim() === "");
    const isOl = listLines.every((l) => /^\d+\.\s+/.test(l.trim()) || l.trim() === "");

    if (isUl && listLines.some((l) => l.trim())) {
      const items = listLines
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `<li>${inlineMarkdown(l.replace(/^[-*+]\s+/, ""))}</li>`)
        .join("");
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    if (isOl && listLines.some((l) => l.trim())) {
      const items = listLines
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `<li>${inlineMarkdown(l.replace(/^\d+\.\s+/, ""))}</li>`)
        .join("");
      out.push(`<ol>${items}</ol>`);
      continue;
    }

    const paragraphs = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => inlineMarkdown(line))
      .join("<br />");
    out.push(`<p>${paragraphs}</p>`);
  }

  return out.join("\n") || "<p></p>";
}

function inlineMarkdown(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2">$1</a>',
  );
  return s;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
