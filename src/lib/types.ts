export type BookMetadata = {
  title: string;
  author?: string;
  language?: string;
};

export type Chapter = {
  id: string;
  title: string;
  markdown: string;
};

export type TranslateMode = "openai" | "demo";

export type GenerateRequest = {
  title: string;
  author?: string;
  content: string;
};

export type GenerateProgressEvent =
  | { type: "status"; message: string }
  | { type: "progress"; current: number; total: number; message: string }
  | { type: "error"; message: string }
  | { type: "done"; filename: string; mode: TranslateMode; warning?: string };
