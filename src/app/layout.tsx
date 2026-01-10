import type { Metadata } from "next";
import { Inter } from "next/font/google"; // or your font
import "./globals.css";
import { Providers } from "./providers"; // Import the fixed provider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QuizCraft",
  description: "AI-Powered Study Tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // FIX: Add suppressHydrationWarning, REMOVE "dark" from className if present
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <Providers>
           {children}
        </Providers>
      </body>
    </html>
  );
}