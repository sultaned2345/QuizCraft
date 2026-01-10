"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { AuthProvider } from "@/contexts/AuthContext"
import { UpgradeModalProvider } from "@/components/UpgradeModalContext"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UpgradeModalProvider>
        <NextThemesProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </NextThemesProvider>
      </UpgradeModalProvider>
    </AuthProvider>
  )
}