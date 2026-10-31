"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StatusInfo = {
  mode: "openai" | "demo";
  demo: boolean;
  message: string;
};

type Phase = "idle" | "working" | "done" | "error";

const STAGE_MESSAGES = [
  "Brontekst analyseren…",
  "Opsplitsen in hoofdstukken…",
  "Vertalen naar Algemeen Nederlands…",
  "EPUB 3 samenstellen…",
  "Bestand klaarmaken voor download…",
];

export function BuilderForm() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data: StatusInfo) => setStatus(data))
      .catch(() =>
        setStatus({
          mode: "demo",
          demo: true,
          message: "Kon status niet laden; waarschijnlijk demo-modus.",
        }),
      );
  }, []);

  const clearStageTimer = useCallback(() => {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearStageTimer(), [clearStageTimer]);

  async function onFileChange(file: File | null) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".md") && !lower.endsWith(".markdown")) {
      setError("Alleen .txt of .md bestanden worden ondersteund in v1.");
      return;
    }
    const text = await file.text();
    setContent(text);
    setFileName(file.name);
    setError(null);
    if (!title.trim()) {
      const base = file.name.replace(/\.(txt|md|markdown)$/i, "");
      setTitle(base);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setDownloadName(null);

    if (!title.trim() || !content.trim()) {
      setError("Vul een titel en brontekst in.");
      return;
    }

    setPhase("working");
    setStageIndex(0);
    clearStageTimer();
    stageTimer.current = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGE_MESSAGES.length - 2));
    }, 1800);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim() || undefined,
          content,
        }),
      });

      clearStageTimer();
      setStageIndex(STAGE_MESSAGES.length - 1);

      if (!res.ok) {
        let message = `Genereren mislukt (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      const warnHeader = res.headers.get("X-EPUB-Warning");
      if (warnHeader) {
        setWarning(decodeURIComponent(warnHeader));
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plainMatch = disposition.match(/filename="([^"]+)"/i);
      const name = utfMatch
        ? decodeURIComponent(utfMatch[1])
        : plainMatch?.[1] || `${title.trim()}.epub`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDownloadName(name);
      setPhase("done");
    } catch (err) {
      clearStageTimer();
      setPhase("error");
      setError(err instanceof Error ? err.message : "Onbekende fout");
    }
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && phase !== "working";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {status?.demo && (
        <div
          role="status"
          className="rounded-md border border-[color:var(--warn)]/25 bg-[color:var(--warn-bg)] px-4 py-3 text-sm text-[color:var(--warn)] animate-fade-up"
        >
          {status.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold tracking-wide text-[color:var(--ink)]">
            Titel <span className="text-[color:var(--danger)]">*</span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijv. The Little Prince"
            className="rounded-md border border-[color:var(--rule)] bg-white/80 px-3 py-2.5 text-base outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
            required
            disabled={phase === "working"}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold tracking-wide text-[color:var(--ink)]">
            Auteur <span className="font-normal text-[color:var(--ink-muted)]">(optioneel)</span>
          </span>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Bijv. Antoine de Saint-Exupéry"
            className="rounded-md border border-[color:var(--rule)] bg-white/80 px-3 py-2.5 text-base outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
            disabled={phase === "working"}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="text-sm font-semibold tracking-wide">
            Engelse brontekst <span className="text-[color:var(--danger)]">*</span>
          </label>
          <div className="flex items-center gap-2">
            {fileName && (
              <span className="text-xs text-[color:var(--ink-muted)] truncate max-w-[12rem]">
                {fileName}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={phase === "working"}
              className="rounded-md border border-[color:var(--rule)] bg-[color:var(--paper-deep)] px-3 py-1.5 text-sm font-medium transition hover:bg-white disabled:opacity-50"
            >
              Upload .txt / .md
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setFileName(null);
          }}
          placeholder={"Plak Markdown of platte tekst.\n\n# Chapter One\n\nOnce upon a time…\n\n# Chapter Two\n\n…"}
          rows={14}
          className="w-full resize-y rounded-md border border-[color:var(--rule)] bg-white/80 px-3 py-3 font-mono text-sm leading-relaxed outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)] min-h-[220px]"
          required
          disabled={phase === "working"}
        />
        <p className="text-xs text-[color:var(--ink-muted)]">
          Tip: begin hoofdstukken met <code className="rounded bg-[color:var(--paper-deep)] px-1"># Heading</code> voor
          automatische splitsing in de EPUB.
        </p>
      </div>

      {(phase === "working" || phase === "done") && (
        <div
          className="rounded-md border border-[color:var(--rule)] bg-white/70 px-4 py-3"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              {phase === "working" ? STAGE_MESSAGES[stageIndex] : "EPUB klaar"}
            </span>
            <span className="text-[color:var(--ink-muted)]">
              {phase === "working" ? `${stageIndex + 1}/${STAGE_MESSAGES.length}` : "✓"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--paper-deep)]">
            <div
              className={`h-full rounded-full bg-[color:var(--accent)] transition-all duration-500 ${
                phase === "working" ? "progress-pulse" : ""
              }`}
              style={{
                width:
                  phase === "done"
                    ? "100%"
                    : `${((stageIndex + 1) / STAGE_MESSAGES.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[color:var(--danger)]/20 bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger)]"
        >
          {error}
        </div>
      )}

      {warning && (
        <div
          role="status"
          className="rounded-md border border-[color:var(--warn)]/25 bg-[color:var(--warn-bg)] px-4 py-3 text-sm text-[color:var(--warn)]"
        >
          {warning}
        </div>
      )}

      {phase === "done" && downloadName && (
        <div className="rounded-md border border-[color:var(--success)]/20 bg-[color:var(--success-bg)] px-4 py-3 text-sm text-[color:var(--success)]">
          Download gestart: <strong className="font-semibold">{downloadName}</strong>. Open het bestand in Apple
          Books op je iPhone.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center justify-center rounded-md bg-[color:var(--accent)] px-5 py-2.5 text-base font-semibold text-white shadow-[var(--shadow)] transition hover:bg-[color:var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {phase === "working" ? "Bezig…" : "Vertaal & genereer EPUB"}
        </button>
        <span className="text-sm text-[color:var(--ink-muted)]">
          Uitvoer: EPUB 3 · taal <code className="rounded bg-[color:var(--paper-deep)] px-1">nl</code>
        </span>
      </div>
    </form>
  );
}
