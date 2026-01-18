import { AppSidebar } from '@/components/layout/AppSidebar';
import { PageTransition } from '@/components/PageTransition';
import { PageProvider } from '@/contexts/PageContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { HUDHeader } from '@/components/layout/HUDHeader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // CHANGE: defaultOpen={false} forces it collapsed to icon-only mode
    <SidebarProvider defaultOpen={false} className="flex min-h-screen bg-background w-full">
      <AppSidebar />
      
      {/* SidebarInset ensures content pushes correctly when expanded, but uses full width when collapsed */}
      <SidebarInset className="flex flex-col min-h-screen w-full transition-all duration-300 ease-in-out">
        
        {/* The HUD Header sits inside the inset so it spans the correct width */}
        <HUDHeader />

        {/* Mobile Trigger (visible only on mobile) */}
        <div className="md:hidden p-4 pb-0">
            <SidebarTrigger />
        </div>

        <div className="flex-1 p-4 md:p-8 w-full mx-auto max-w-[1600px]">
            <PageProvider>
                <PageTransition>
                    {children}
                </PageTransition>
            </PageProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}