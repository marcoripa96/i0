import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import { ThemeProvider } from "./components/theme-provider";
import { CopyFormatProvider } from "./components/copy-format-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "i0 - The Icon Search",
  description:
    "200k+ icons from 150+ open-source collections, searchable via MCP",
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
        className={`${geistSans.variable} ${geistMono.variable} ${GeistPixelSquare.variable} antialiased`}
      >
        <Suspense>
          <Providers>{children}</Providers>
        </Suspense>
        <Toaster position="bottom-right" duration={2000} />
      </body>
    </html>
  );
}
