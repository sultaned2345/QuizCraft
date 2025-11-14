// src/app/layout.tsx
import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Suspense } from "react"
import { Providers } from "./providers"; // <-- 1. IMPORT
import "./globals.css"
import { Footer } from "@/components/Footer"
// --- 2. REMOVE imports for AuthProvider, ThemeProvider, UpgradeModalProvider ---

// Main sans-serif font
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

export const metadata: Metadata = {
  title: "QuizCraft - Turn Documents into Quizzes in Seconds",
  description:
    "Transform any document into engaging quizzes instantly with AI. Perfect for educators, trainers, and content creators.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased flex flex-col min-h-screen">
        {/* --- 3. USE THE NEW PROVIDERS COMPONENT --- */}
        <Providers>
          <div className="flex-1 flex flex-col">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
          <Footer />
        </Providers>
        {/* --- END OF CHANGE --- */}
      </body>
    </html>
  )
}