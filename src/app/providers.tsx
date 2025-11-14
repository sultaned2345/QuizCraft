// src/app/providers.tsx
'use client';

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { UpgradeModalProvider } from "@/components/UpgradeModalContext";
import { PageProvider } from "@/contexts/PageContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system" storageKey="quizcraft-ui-theme">
        <UpgradeModalProvider>
          <PageProvider>
            {children}
          </PageProvider>
        </UpgradeModalProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}