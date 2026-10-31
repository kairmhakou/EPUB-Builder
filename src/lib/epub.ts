import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { markdownToXhtml } from "./markdown";
import type { BookMetadata, Chapter } from "./types";
import { escapeXml, sanitizeFilename } from "./xml";

const STYLESHEET = `body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  margin: 1.2em 1.4em;
  color: #1a1a1a;
}
h1, h2, h3, h4, h5, h6 {
  font-family: "Palatino Linotype", Palatino, Georgia, serif;
  line-height: 1.25;
  margin: 1.4em 0 0.6em;
  font-weight: normal;
}
h1 { font-size: 1.6em; }
h2 { font-size: 1.35em; }
h3 { font-size: 1.15em; }
p { margin: 0 0 0.9em; text-indent: 0; }
ul, ol { margin: 0 0 1em 1.2em; }
li { margin: 0.25em 0; }
a { color: #1a4a6e; }
code {
  font-family: "Courier New", monospace;
  font-size: 0.92em;
}
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 1.5em 0;
}
.titlepage {
  text-align: center;
  margin-top: 30%;
}
.titlepage h1 {
  font-size: 2em;
  margin-bottom: 0.4em;
}
.titlepage .author {
  font-size: 1.15em;
  font-style: italic;
  color: #444;
}
.titlepage .lang {
  margin-top: 2em;
  font-size: 0.9em;
  color: #666;
}
`;

export type EpubBuildResult = {
  buffer: Buffer;
  filename: string;
  bookId: string;
};

export async function buildEpub(
  metadata: BookMetadata,
  chapters: Chapter[],
): Promise<EpubBuildResult> {
  const title = metadata.title.trim() || "Naamloos boek";
  const author = metadata.author?.trim() || "Onbekende auteur";
  const language = metadata.language || "nl";
  const bookId = `urn:uuid:${uuidv4()}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const zip = new JSZip();

  // EPUB requires uncompressed mimetype as first entry
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.folder("META-INF")!.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  );

  const oebps = zip.folder("OEBPS")!;
  oebps.file("styles.css", STYLESHEET);

  oebps.file(
    "titlepage.xhtml",
    xhtmlDocument(
      title,
      language,
      `<section class="titlepage">
  <h1>${escapeXml(title)}</h1>
  <p class="author">${escapeXml(author)}</p>
  <p class="lang">Algemeen Nederlands</p>
</section>`,
    ),
  );

  const chapterFiles = chapters.map((ch, index) => {
    const href = `chapter-${String(index + 1).padStart(3, "0")}.xhtml`;
    const body = `<h1>${escapeXml(ch.title)}</h1>\n${markdownToXhtml(ch.markdown)}`;
    oebps.file(href, xhtmlDocument(ch.title, language, body));
    return { id: `chap${index + 1}`, href, title: ch.title };
  });

  const navItems = [
    { href: "titlepage.xhtml", title: "Titelpagina" },
    ...chapterFiles.map((c) => ({ href: c.href, title: c.title })),
  ];

  oebps.file("nav.xhtml", buildNav(title, language, navItems));
  oebps.file("toc.ncx", buildNcx(bookId, title, navItems));
  oebps.file(
    "content.opf",
    buildOpf({
      bookId,
      title,
      author,
      language,
      modified,
      chapterFiles,
    }),
  );

  const buffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      mimeType: "application/epub+zip",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    }),
  );

  return {
    buffer,
    filename: `${sanitizeFilename(title)}.epub`,
    bookId,
  };
}

function xhtmlDocument(title: string, lang: string, bodyInner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
${bodyInner}
</body>
</html>
`;
}

function buildNav(
  bookTitle: string,
  lang: string,
  items: { href: string; title: string }[],
): string {
  const lis = items
    .map((item) => `      <li><a href="${escapeXml(item.href)}">${escapeXml(item.title)}</a></li>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">
<head>
  <meta charset="UTF-8" />
  <title>Inhoudsopgave — ${escapeXml(bookTitle)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Inhoudsopgave</h1>
    <ol>
${lis}
    </ol>
  </nav>
</body>
</html>
`;
}

function buildNcx(
  bookId: string,
  title: string,
  items: { href: string; title: string }[],
): string {
  const navPoints = items
    .map(
      (item, i) => `    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(item.title)}</text></navLabel>
      <content src="${escapeXml(item.href)}" />
    </navPoint>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(bookId)}" />
    <meta name="dtb:depth" content="1" />
    <meta name="dtb:totalPageCount" content="0" />
    <meta name="dtb:maxPageNumber" content="0" />
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>
`;
}

function buildOpf(opts: {
  bookId: string;
  title: string;
  author: string;
  language: string;
  modified: string;
  chapterFiles: { id: string; href: string; title: string }[];
}): string {
  const manifestChapters = opts.chapterFiles
    .map(
      (c) =>
        `    <item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");

  const spineChapters = opts.chapterFiles
    .map((c) => `    <itemref idref="${c.id}"/>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="${escapeXml(opts.language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(opts.bookId)}</dc:identifier>
    <dc:title>${escapeXml(opts.title)}</dc:title>
    <dc:creator>${escapeXml(opts.author)}</dc:creator>
    <dc:language>${escapeXml(opts.language)}</dc:language>
    <meta property="dcterms:modified">${opts.modified}</meta>
  </metadata>
  <manifest>
    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
${manifestChapters}
  </manifest>
  <spine toc="ncx">
    <itemref idref="titlepage"/>
${spineChapters}
  </spine>
</package>
`;
}
