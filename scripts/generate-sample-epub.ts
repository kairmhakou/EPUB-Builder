/**
 * Quick offline smoke test: builds a demo-mode Dutch-labeled EPUB without Next.js.
 * Run: npm run test:epub
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { splitIntoChapters } from "../src/lib/markdown";
import { translateChapters } from "../src/lib/translate";
import { buildEpub } from "../src/lib/epub";

async function main() {
  const sample = `# The Beginning

Once upon a time, there was a small village by the sea.

The people there loved stories and quiet mornings.

# The Journey

A young traveler arrived with a book of maps and a restless heart.

She asked the villagers for directions to the northern lighthouse.
`;

  const chapters = splitIntoChapters(sample, "Sample Book");
  const translated = await translateChapters(chapters);
  const epub = await buildEpub(
    { title: "Voorbeeldboek", author: "EPUBBuilder Demo", language: "nl" },
    translated.chapters,
  );

  const outDir = join(process.cwd(), "samples");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, epub.filename);
  writeFileSync(outPath, epub.buffer);

  console.log(`Wrote ${outPath} (${epub.buffer.length} bytes)`);
  console.log(`Mode: ${translated.mode}`);
  if (translated.warning) console.log(`Warning: ${translated.warning}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
