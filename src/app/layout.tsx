// src/app/layout.tsx
import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Inter } from "next/font/google"
import { Suspense } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/AuthContext"
import { Footer } from "@/components/Footer"
import { UpgradeModalProvider } from "@/components/UpgradeModalContext"
import { Toaster } from "@/components/ui/toaster" 
// FIX: Change to default import to match the export in the component file
import CookieConsent from "@/components/CookieConsent" 
import "./globals.css"

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
  children: ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased flex flex-col min-h-screen">
        <AuthProvider>
          <ThemeProvider defaultTheme="system" storageKey="quizcraft-ui-theme">
            <UpgradeModalProvider>
              <div className="flex-1 flex flex-col">
                <Suspense fallback={null}>{children}</Suspense>
              </div>
              <Footer />
              <CookieConsent />
              <Toaster />
            </UpgradeModalProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}