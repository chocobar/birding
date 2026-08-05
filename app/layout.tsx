import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const themeScript = `
  let theme;
  try { theme = localStorage.getItem('theme'); } catch {}
  document.documentElement.classList.toggle(
    'dark',
    theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches)
  );
`;

export const metadata: Metadata = {
  title: "Birding Discovery | Find Birds and Birding Locations Worldwide",
  description: "Discover common birds and nearby birding locations anywhere in the world. Enter your location to find parks, woodlands, nature reserves, and bird species in your area.",
  keywords: "birds, birdwatching, birding locations, nature reserves, wildlife, bird identification, birdwatching app, ornithology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`} suppressHydrationWarning>
      <head>
        <Script id="theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
