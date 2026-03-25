import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

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
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}