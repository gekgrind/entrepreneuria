import "./globals.css";
import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Playfair_Display } from "next/font/google";
import RootClientLayout from "./RootClientLayout";
import { AuthProvider } from "@/components/auth/AuthProvider";
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

export const metadata: Metadata = {
  title: "Entrepreneuria — Everything Entrepreneur",
  description:
    "AI mentors, admin support, and startup playbooks to help you grow with clarity and confidence.",
  metadataBase: new URL("https://entrepreneuria.io"),
  openGraph: {
    title: "Entrepreneuria — Everything Entrepreneur",
    description:
      "AI mentors, admin support, and startup playbooks to help you grow with clarity and confidence.",
    url: "https://entrepreneuria.io",
    siteName: "Entrepreneuria",
    images: [{ url: "/assets/logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Entrepreneuria — Everything Entrepreneur",
    description:
      "AI mentors, admin support, and startup playbooks to help you grow with clarity and confidence.",
    images: ["/assets/logo.png"],
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
        <AuthProvider initialUser={initialUser}>
          <RootClientLayout>{children}</RootClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
