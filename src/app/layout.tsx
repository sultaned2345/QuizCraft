// src/app/layout.tsx
import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Suspense } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/AuthContext"
import "./globals.css"
import { Footer } from "@/components/Footer"
import { UpgradeModalProvider } from "@/components/UpgradeModalContext" // <-- 1. IMPORT (FIXED PATH)

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
        <AuthProvider>
          <ThemeProvider defaultTheme="system" storageKey="quizcraft-ui-theme">
            {/* 2. WRAP with Provider */}
            <UpgradeModalProvider>
              <div className="flex-1 flex flex-col">
                <Suspense fallback={null}>{children}</Suspense>
              </div>
              <Footer />
            </UpgradeModalProvider>
            {/* 3. END WRAP */}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}