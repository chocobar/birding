import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://birding.live";
const SITE_NAME = "Birding Discovery";
const TITLE = "Birding Discovery – Find Birds & Birding Spots Near You";
const DESCRIPTION =
  "Discover common birds near you and find top birdwatching spots — parks, woodlands and nature reserves worldwide. Free live bird finder by location.";

const themeScript = `
  let theme;
  try { theme = localStorage.getItem('theme'); } catch {}
  document.documentElement.classList.toggle(
    'dark',
    theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches)
  );
`;

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "birds",
    "birdwatching",
    "birding locations",
    "birding near me",
    "birds near me",
    "bird identification",
    "nature reserves",
    "birdwatching spots",
    "birdwatching app",
    "ornithology",
  ],
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  ...(googleVerification ? { verification: { google: googleVerification } } : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a1a2e" },
    { media: "(prefers-color-scheme: dark)", color: "#050b14" },
  ],
  colorScheme: "dark light",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: DESCRIPTION,
      inLanguage: "en",
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: `${SITE_URL}/`,
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      applicationCategory: "TravelApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      description: DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script id="theme" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
