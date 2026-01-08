// src/app/(app)/layout.tsx
import { AppSidebar } from '@/components/layout/AppSidebar';
import { PageTransition } from '@/components/PageTransition';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-black text-foreground font-sans selection:bg-white/20">
      {/* 1. Fixed Sidebar */}
      <AppSidebar />

      {/* 2. Main Content Area */}
      {/* Added 'pl-16' to offset the fixed sidebar width */}
      <main className="flex-1 pl-16 flex flex-col min-h-screen">
        <div className="flex-1 p-6 md:p-12 max-w-[1600px] mx-auto w-full">
            <PageTransition>
                {children}
            </PageTransition>
        </div>
      </main>
    </div>
  );
}