"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { AuthProvider } from "@/contexts/AuthContext" // ADDED

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider> {/* ADDED: Wrap everything in AuthProvider */}
      <NextThemesProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
    </AuthProvider>
  )
}