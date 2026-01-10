// src/app/(app)/layout.tsx
import { AppSidebar } from '@/components/layout/AppSidebar';
import { PageTransition } from '@/components/PageTransition';
import { PageProvider } from '@/contexts/PageContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // FIX: Changed 'bg-black' to 'bg-background' for theme support
    <div className="flex min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <AppSidebar />
      <main className="flex-1 pl-16 flex flex-col min-h-screen">
        {/* FIX: Removed 'max-w-[1600px]' to make page full width */}
        <div className="flex-1 p-6 md:p-12 w-full mx-auto">
            <PageProvider>
                <PageTransition>
                    {children}
                </PageTransition>
            </PageProvider>
        </div>
      </main>
    </div>
  );
}