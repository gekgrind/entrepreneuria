import "./globals.css";
import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Playfair_Display } from "next/font/google";
import RootClientLayout from "./RootClientLayout";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ClickSpark } from "@/components/global/ClickSpark";
import { getUser } from "@/lib/auth/get-user";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-label",
  display: "swap",
});

const siteTitle = "Entrepreneuria — Leverage for solo founders";
const siteDescription =
  "Launch planners, pitch decks, and free AI founder tools you can use today — plus first access to Prospra, an AI founder mentor now in private build.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  metadataBase: new URL("https://entrepreneuria.io"),
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "https://entrepreneuria.io",
    siteName: "Entrepreneuria",
    images: [
      {
        url: "/logos/entrepreneuria-logo.png",
        width: 1024,
        height: 1024,
        alt: "Entrepreneuria",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/logos/entrepreneuria-logo.png"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialUser = await getUser();

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}
      >
        <ClickSpark />
        <AuthProvider initialUser={initialUser}>
          <RootClientLayout>{children}</RootClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
