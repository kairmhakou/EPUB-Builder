import { NextResponse } from "next/server";
import { getTranslateMode } from "@/lib/translate";

export const runtime = "nodejs";

export async function GET() {
  const mode = getTranslateMode();
  return NextResponse.json({
    mode,
    demo: mode === "demo",
    message:
      mode === "demo"
        ? "Demo-modus: zet OPENAI_API_KEY in .env voor echte vertaling."
        : "OpenAI-vertaling beschikbaar.",
  });
}
