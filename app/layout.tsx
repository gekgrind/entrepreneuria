import "./globals.css";
import type { Metadata } from "next";
import RootClientLayout from "./RootClientLayout";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <RootClientLayout>
          <div className="pt-[calc(var(--header-height)+20px)]">
            {children}
          </div>
        </RootClientLayout>
      </body>
    </html>
  );
}
