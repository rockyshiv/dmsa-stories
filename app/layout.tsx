import type { Metadata, Viewport } from "next";
import { Archivo, Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({ variable: "--font-bebas", weight: "400", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

// Private per-player links: never indexed.
export const metadata: Metadata = {
  title: "Share your story | Divyaang Myithri Sports Academy",
  description: "A private interview link for DMSA players.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#081733" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${archivo.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
