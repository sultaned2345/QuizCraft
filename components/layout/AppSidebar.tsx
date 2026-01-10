'use client';

import * as React from "react"
import {
  BookOpen,
  Settings,
  User,
  LogOut,
  LayoutDashboard,
  Plus
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AddDocumentDialog } from "@/components/AddDocumentDialog"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { session, signOut } = useAuth()
  const pathname = usePathname()

  // CLEANUP: Removed Quizzes, Notes, Flashcards from global nav
  // to enforce the "Turbo AI" document-centric workflow.
  const navMain = [
    {
      title: "Library",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard" || pathname.startsWith("/documents"),
    },
    {
      title: "Settings",
      url: "/account",
      icon: Settings,
      isActive: pathname === "/account",
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BookOpen className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">QuizCraft</span>
                <span className="truncate text-xs">Turbo Edition</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarMenu className="px-2 py-2">
           {navMain.map((item) => (
             <SidebarMenuItem key={item.title}>
               <SidebarMenuButton asChild isActive={item.isActive} tooltip={item.title}>
                 <Link href={item.url}>
                   <item.icon />
                   <span>{item.title}</span>
                 </Link>
               </SidebarMenuButton>
             </SidebarMenuItem>
           ))}
        </SidebarMenu>
        
        <SidebarSeparator className="mx-2 my-2"/>

        {/* Quick Action */}
        <div className="px-2">
          <AddDocumentDialog>
            <SidebarMenuButton className="w-full justify-start text-muted-foreground hover:text-foreground">
              <Plus className="mr-2 h-4 w-4" />
              <span>New Study Set</span>
            </SidebarMenuButton>
          </AddDocumentDialog>
        </div>

      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/account">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={session?.user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="rounded-lg">QC</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{session?.user?.email?.split('@')[0]}</span>
                  <span className="truncate text-xs">{session?.user?.email}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <SidebarMenuButton onClick={() => signOut()} tooltip="Log out">
                <LogOut />
                <span>Log out</span>
             </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}