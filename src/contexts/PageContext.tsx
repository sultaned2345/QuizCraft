// src/contexts/PageContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of the context
// It can be a specific quiz, a specific essay, a generic page, or null
export type PageContextType =
  | { type: 'quiz'; id: string }
  | { type: 'essay'; id: string }
  | { type: 'document'; id: string }
  | { type: 'project'; id: string } // FIX: Added 'project' type to support project pages
  | { type: 'page'; name: string } // For generic pages like 'essay-grader'
  | null;

interface PageContextState {
  pageContext: PageContextType;
  setPageContext: (context: PageContextType) => void;
}

// Create the context
const PageContext = createContext<PageContextState | undefined>(undefined);

// Create the provider component
export function PageProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContext] = useState<PageContextType>(null);

  const value = {
    pageContext,
    setPageContext,
  };

  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

// Create the custom hook
export function usePageContext() {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error('usePageContext must be used within a PageProvider');
  }
  return context;
}