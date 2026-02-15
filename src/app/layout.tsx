import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { ThemeProvider } from "./components/theme-provider";
import { CopyFormatProvider } from "./components/copy-format-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://icons0.dev")
  ),
  title: "icons0 — The fastest icon search for you and your AI agent",
  description:
    "Search 200k+ icons from 150+ open-source collections. Browse the web UI or connect the MCP server to your AI coding agent.",
  openGraph: {
    title: "icons0 — The fastest icon search for you and your AI agent",
    description:
      "Search 200k+ icons from 150+ open-source collections. Browse the web UI or connect the MCP server to your AI coding agent.",
    type: "website",
    siteName: "icons0",
  },
  twitter: {
    card: "summary_large_image",
    title: "icons0 — The fastest icon search for you and your AI agent",
    description:
      "Search 200k+ icons from 150+ open-source collections. Browse the web UI or connect the MCP server to your AI coding agent.",
  },
};

async function Providers({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme =
    cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  const copyFormatRaw = cookieStore.get("copyFormat")?.value;
  const copyFormat =
    copyFormatRaw === "react" ? "react" : copyFormatRaw === "shadcn" ? "shadcn" : "svg";

  return (
    <ThemeProvider initialTheme={theme}>
      <CopyFormatProvider initialFormat={copyFormat}>
        {children}
      </CopyFormatProvider>
    </ThemeProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(/theme=light/.test(document.cookie))document.documentElement.classList.remove('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} antialiased`}
      >
        <Suspense>
          <Providers>{children}</Providers>
        </Suspense>
        <Toaster position="bottom-right" duration={2000} />
      </body>
    </html>
  );
}
