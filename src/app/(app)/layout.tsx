import { AppSidebar } from '@/components/layout/AppSidebar';
import { PageTransition } from '@/components/PageTransition';
import { PageProvider } from '@/contexts/PageContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // FIX: Wrapped in SidebarProvider to resolve context error
    // FIX: Moved global styles to SidebarProvider className
    <SidebarProvider className="flex min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 w-full">
      <AppSidebar />
      
      {/* FIX: Removed 'pl-16' as SidebarProvider handles spacing automatically */}
      <main className="flex-1 flex flex-col min-h-screen w-full transition-all duration-300 ease-in-out">
        
        {/* ADD: SidebarTrigger is required for mobile/collapsible interaction */}
        <div className="p-4 flex items-center gap-4">
            <SidebarTrigger className="md:hidden" />
            {/* You can remove md:hidden if you want the toggle visible on desktop too */}
        </div>

        <div className="flex-1 p-6 md:p-12 pt-0 w-full mx-auto">
            <PageProvider>
                <PageTransition>
                    {children}
                </PageTransition>
            </PageProvider>
        </div>
      </main>
    </SidebarProvider>
  );
}