import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Credixa",
  description: "Pratiche, affidi, lavorazione e incassi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${sans.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
