# EPUBBuilder

Web MVP that turns an English book source (Markdown / plain text) into a **Dutch (Algemeen Nederlands)** **EPUB 3** file you can download and open in **Apple Books** on iPhone.

Pipeline: **Input English → Translate to Algemeen Nederlands → Package EPUB 3 → Download**

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- OpenAI API for translation (optional)
- JSZip for EPUB packaging

## Setup

```bash
cd "C:\Study_files\Cursor projects\EPUBBuilder"
npm install
cp .env.example .env
```

Edit `.env` if you want real translation:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Without `OPENAI_API_KEY`, the app runs in **demo mode**: it still builds a valid `nl` EPUB, but prefixes lines with `[NL-demo]` instead of translating.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

## Smoke-test EPUB packaging

```bash
npm run test:epub
```

Writes a sample file under `samples/`.

## iOS / Apple Books download

1. Prefer **Safari** on iPhone (or open the downloaded file on desktop and AirDrop it).
2. Enter title + English text (or upload `.txt` / `.md`).
3. Tap **Vertaal & genereer EPUB**.
4. When the download finishes: **Deel → Boeken** (Share → Books), or open the `.epub` from Files.
5. The response uses:
   - `Content-Type: application/epub+zip`
   - `Content-Disposition: attachment; filename="….epub"`

> Localhost on a physical iPhone requires your machine’s LAN IP (e.g. `http://192.168.x.x:3000`) and that the phone is on the same network. For the quickest check, generate on desktop and AirDrop the `.epub`.

## Project structure

```
src/
  app/
    api/generate/route.ts   # Translate + build EPUB, stream download
    api/status/route.ts     # Demo vs OpenAI mode
    page.tsx                # UI
    layout.tsx
    globals.css
  components/BuilderForm.tsx
  lib/
    markdown.ts             # Chapter split + Markdown → XHTML
    translate.ts            # OpenAI / demo translation
    epub.ts                 # EPUB 3 packaging
    xml.ts
    types.ts
scripts/generate-sample-epub.ts
```

## Env vars

| Variable         | Required | Description                                      |
|------------------|----------|--------------------------------------------------|
| `OPENAI_API_KEY` | No       | Enables real EN → Algemeen Nederlands translation |
| `OPENAI_MODEL`   | No       | Defaults to `gpt-4o-mini`                        |

## Chapter detection

ATX `# Heading` lines become EPUB chapters. Text before the first heading becomes **Inleiding**. Without headings, the whole book is one chapter.

## Out of scope (v1)

- Native iOS app
- PDF OCR / complex EPUB import
- Accounts / history
- Bilingual side-by-side reader
- Custom in-app reader

## Known limitations

- Markdown support is a practical subset (headings, paragraphs, lists, bold/italic, links, code, hr).
- Long books are chunked for the API; very large texts may hit timeouts (`maxDuration` 300s on the generate route).
- Cover images are not included (title page only).
- Demo mode is not a real translation.

## License

Private / study project.
