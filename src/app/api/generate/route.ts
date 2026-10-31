import { NextRequest, NextResponse } from "next/server";
import { buildEpub } from "@/lib/epub";
import { splitIntoChapters } from "@/lib/markdown";
import { translateChapters } from "@/lib/translate";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_CONTENT_CHARS = 500_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const author = typeof body.author === "string" ? body.author.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";

    if (!title) {
      return NextResponse.json({ error: "Titel is verplicht." }, { status: 400 });
    }
    if (!content.trim()) {
      return NextResponse.json({ error: "Brontekst is verplicht." }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return NextResponse.json(
        { error: `Tekst is te lang (max ${MAX_CONTENT_CHARS.toLocaleString()} tekens).` },
        { status: 400 },
      );
    }

    const chapters = splitIntoChapters(content, title);
    const translated = await translateChapters(chapters);
    const epub = await buildEpub(
      { title, author: author || undefined, language: "nl" },
      translated.chapters,
    );

    const headers = new Headers();
    headers.set("Content-Type", "application/epub+zip");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${epub.filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(epub.filename)}`,
    );
    headers.set("Content-Length", String(epub.buffer.length));
    headers.set("X-EPUB-Mode", translated.mode);
    if (translated.warning) {
      headers.set("X-EPUB-Warning", encodeURIComponent(translated.warning));
    }
    headers.set("Cache-Control", "no-store");

    return new NextResponse(new Uint8Array(epub.buffer), {
      status: 200,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout bij genereren.";
    console.error("[generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
