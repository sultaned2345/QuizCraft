'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FileText, 
  StickyNote, 
  PenTool, // New Icon
  Settings,
  LogOut,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const pathname = usePathname();

  const routes = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      active: pathname === "/dashboard",
    },
    {
      label: "Documents",
      icon: FileText,
      href: "/documents",
      active: pathname.startsWith("/documents"),
    },
    {
      label: "Notes",
      icon: StickyNote,
      href: "/notes",
      active: pathname.startsWith("/notes"),
    },
    // REPLACED: Removed Quizzes & Flashcards, Added Essay Grader
    {
      label: "Essay Grader",
      icon: PenTool,
      href: "/essay-grader",
      active: pathname.startsWith("/essay-grader"),
    },
  ];

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-secondary/10 border-r border-border">
      <div className="px-3 py-2">
        <Link href="/dashboard" className="flex items-center pl-3 mb-14">
           {/* You can add your logo here */}
           <h1 className="text-2xl font-bold">QuizCraft</h1>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-primary hover:bg-primary/10 rounded-lg transition",
                route.active ? "text-primary bg-primary/10" : "text-muted-foreground"
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn("h-5 w-5 mr-3", route.active ? "text-primary" : "text-muted-foreground")} />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Bottom Actions */}
      <div className="mt-auto px-3 py-2 space-y-1">
         <Link href="/account">
            <Button variant="ghost" className="w-full justify-start gap-3">
               <Settings className="h-5 w-5" />
               Settings
            </Button>
         </Link>
      </div>
    </div>
  );
}