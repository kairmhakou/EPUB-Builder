import OpenAI from "openai";
import type { Chapter, TranslateMode } from "./types";

const SYSTEM_PROMPT = `Je bent een professionele literaire vertaler van Engels naar Algemeen Nederlands (AN).

Regels:
- Vertaal naar standaard Algemeen Nederlands zoals gebruikt in boeken en kwaliteitsmedia in Nederland.
- Gebruik geen Vlaamse spreektaal, dialect of regionaal idiomatisch Vlaams.
- Vermijd overdreven informele chattaal; houd een natuurlijke, leesbare boekstijl aan die past bij de brontekst.
- Behoud Markdown-structuur exact: koppen (# ## ###), alinea's, lijsten, vet/cursief, links en code.
- Vertaal de inhoud van koppen; laat Markdown-markeringen intact.
- Behoud alinea-scheidingen en witregels waar relevant.
- Geef alleen de vertaalde Markdown terug, zonder uitleg of aanhalingstekens.`;

export type TranslateResult = {
  chapters: Chapter[];
  mode: TranslateMode;
  warning?: string;
};

export function getTranslateMode(): TranslateMode {
  return process.env.OPENAI_API_KEY?.trim() ? "openai" : "demo";
}

export async function translateChapters(
  chapters: Chapter[],
  onProgress?: (current: number, total: number, message: string) => void,
): Promise<TranslateResult> {
  const mode = getTranslateMode();

  if (mode === "demo") {
    onProgress?.(0, chapters.length, "Demo-modus: mockvertaling…");
    const demoChapters = chapters.map((ch, i) => {
      onProgress?.(i + 1, chapters.length, `Demo-vertaling hoofdstuk ${i + 1}/${chapters.length}`);
      return {
        ...ch,
        title: demoTranslateLine(ch.title),
        markdown: demoTranslateMarkdown(ch.markdown),
      };
    });

    return {
      chapters: demoChapters,
      mode: "demo",
      warning:
        "Demo-modus actief: geen OPENAI_API_KEY gevonden. Tekst is gemarkeerd als [NL-demo] i.p.v. echt vertaald. Zet OPENAI_API_KEY in .env voor echte Algemeen Nederlands-vertaling.",
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const translated: Chapter[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    onProgress?.(i, chapters.length, `Vertalen: ${chapter.title}`);

    const chunks = chunkMarkdown(chapter.markdown, 3500);
    const translatedChunks: string[] = [];

    for (let c = 0; c < chunks.length; c++) {
      translatedChunks.push(
        await translateText(client, model, chunks[c], `hoofdstuk "${chapter.title}" deel ${c + 1}/${chunks.length}`),
      );
    }

    const titleNl = await translateText(client, model, chapter.title, "hoofdstuktitel");
    translated.push({
      id: chapter.id,
      title: titleNl.trim() || chapter.title,
      markdown: translatedChunks.join("\n\n"),
    });

    onProgress?.(i + 1, chapters.length, `Klaar: ${titleNl.trim() || chapter.title}`);
  }

  return { chapters: translated, mode: "openai" };
}

async function translateText(
  client: OpenAI,
  model: string,
  text: string,
  context: string,
): Promise<string> {
  if (!text.trim()) return text;

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Vertaal de volgende Engelse tekst (${context}) naar Algemeen Nederlands. Behoud Markdown.\n\n${text}`,
      },
    ],
  });

  const out = response.choices[0]?.message?.content?.trim();
  if (!out) {
    throw new Error(`Lege vertaalrespons voor ${context}`);
  }
  return out;
}

/** Split long markdown on paragraph boundaries while staying under ~maxChars. */
export function chunkMarkdown(markdown: string, maxChars: number): string[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [""];
  if (trimmed.length <= maxChars) return [trimmed];

  const paragraphs = trimmed.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      // Hard-split oversized paragraphs
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChars) {
      chunks.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [trimmed];
}

function demoTranslateLine(line: string): string {
  if (!line.trim()) return line;
  if (line.startsWith("[NL-demo]")) return line;
  return `[NL-demo] ${line}`;
}

function demoTranslateMarkdown(markdown: string): string {
  if (!markdown.trim()) return markdown;

  return markdown
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;

      const heading = line.match(/^(#{1,6}\s+)(.*)$/);
      if (heading) {
        return `${heading[1]}${demoTranslateLine(heading[2])}`;
      }

      const list = line.match(/^((?:[-*+]|\d+\.)\s+)(.*)$/);
      if (list) {
        return `${list[1]}${demoTranslateLine(list[2])}`;
      }

      return demoTranslateLine(line);
    })
    .join("\n");
}
