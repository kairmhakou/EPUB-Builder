import { BuilderForm } from "@/components/BuilderForm";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <header className="mb-10 animate-fade-up">
        <p
          className="mb-3 font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-4xl"
          style={{ fontVariationSettings: '"SOFT" 40, "WONK" 0' }}
        >
          EPUBBuilder
        </p>
        <h1 className="max-w-xl text-lg leading-snug text-[color:var(--ink-muted)] sm:text-xl">
          Engels boek → Algemeen Nederlands EPUB voor Apple Books.
        </h1>
      </header>

      <section
        className="animate-fade-up-delay rounded-lg border border-[color:var(--rule)] bg-white/55 p-5 shadow-[var(--shadow)] backdrop-blur-sm sm:p-7"
        aria-label="Boek genereren"
      >
        <BuilderForm />
      </section>

      <footer className="mt-10 space-y-2 text-sm text-[color:var(--ink-muted)]">
        <p>
          Pipeline: plak of upload → vertaal (OpenAI of demo) → geldige EPUB 3 → download voor iOS.
        </p>
        <p>
          Op iPhone: download in Safari → Deel → Boeken. PDF/EPUB-import volgt buiten scope van v1.
        </p>
      </footer>
    </main>
  );
}
