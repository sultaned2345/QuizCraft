// src/app/(app)/AppLayoutClient.tsx
'use client';

import { useState, Suspense } from 'react';
import { PageProvider } from '@/contexts/PageContext';
import dynamic from 'next/dynamic';
import { ChatToggleButton } from '@/components/ChatToggleButton';
import { PageProgressBar } from '@/components/PageProgressBar';
import { Sidebar } from '@/components/layout/Sidebar'; // Import new Sidebar
import { HUDHeader } from '@/components/layout/HUDHeader'; // Import new Header
import { usePathname } from 'next/navigation';

const ChatWidgetContainer = dynamic(
  () =>
    import('@/components/ChatWidgetContainer').then(
      (mod) => mod.ChatWidgetContainer
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const pathname = usePathname();
  const isDocumentPage = pathname.startsWith('/documents/');

  return (
    <PageProvider>
      <Suspense fallback={null}>
        <PageProgressBar />
      </Suspense>
      
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none z-[-1]" />

      <div className="flex min-h-screen w-full bg-background/50">
        
        {/* 1. The Glass Dock */}
        <Sidebar />

        <div className="flex flex-col flex-1 sm:pl-24 transition-all duration-300">
          {/* 2. The HUD Header */}
          <HUDHeader />
          
          {/* 3. Main Content Area */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col overflow-hidden max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </main>
        </div>

        {!isDocumentPage && (
          <>
            <ChatToggleButton
              isOpen={isChatOpen}
              onClick={() => setIsChatOpen(!isChatOpen)}
            />
            <ChatWidgetContainer
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
            />
          </>
        )}
      </div>
    </PageProvider>
  );
}