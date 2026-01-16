import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["300", "400", "700", "900"],
});

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${merriweather.variable} font-sans min-h-screen bg-background text-foreground antialiased`}>
        <Providers>
           <div className="relative flex min-h-screen flex-col">
            {children}
           </div>
           <Toaster />
        </Providers>
      </body>
    </html>
  );
}