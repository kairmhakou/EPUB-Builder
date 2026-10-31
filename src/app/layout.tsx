import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EPUBBuilder — Engels naar Algemeen Nederlands",
  description:
    "Vertaal een Engelse tekst naar Algemeen Nederlands en download een EPUB 3 voor Apple Books.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={`${fraunces.variable} ${sourceSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
