import type { Metadata, Viewport } from "next";
import { Site } from "@/components/Site";
import "./globals.css";
import "./refinements.css";
export const metadata: Metadata = {
  title: {
    default: "TIDEHOUSE — A little closer to doing nothing.",
    template: "%s — TIDEHOUSE",
  },
  description:
    "Five thoughtful coastal cabins. Explore the grounds, find your view and reserve a quieter kind of stay. A fictional retreat with a working test-booking experience.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "TIDEHOUSE — A coastal retreat",
    description:
      "Five cabins. An ever-changing sea. A place to find your own kind of quiet.",
    type: "website",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f1e9",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Site>{children}</Site>
      </body>
    </html>
  );
}
