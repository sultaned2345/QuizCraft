'use client';

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  LayoutDashboard,
  Settings,
  LogOut,
  Sparkles,
  HelpCircle,
  User,
  CreditCard,
  UploadCloud
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Logo from "@/components/ui/Logo"
import { useAuth } from "@/contexts/AuthContext"

// Simplified Menu Configuration
const data = {
  navMain: [
    {
      title: "Main Menu",
      items: [
        {
          title: "Turbo Upload",
          url: "/upload",
          icon: UploadCloud,
          variant: "turbo" 
        },
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Library",
          url: "/documents",
          icon: BookOpen,
        },
        {
          title: "Account",
          url: "/account",
          icon: User,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { user, signOut } = useAuth(); 
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <Sidebar variant="inset" collapsible="icon" className="border-r-orange-100 dark:border-r-border" {...props}>
      
      {/* HEADER */}
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-orange-100/50 dark:border-border/40 bg-orange-50/30 dark:bg-card/30 backdrop-blur-sm">
        <div className="w-full flex items-center px-2 group-data-[collapsible=icon]:justify-center">
            <div className="group-data-[collapsible=icon]:hidden">
                <Logo size="md" />
            </div>
            <div className="hidden group-data-[collapsible=icon]:block">
                <Logo variant="icon" size="md" />
            </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-orange-50/30 dark:bg-background/50 pt-4">
        
        {/* NAV GROUPS */}
        {data.navMain.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item: any) => {
                  const isActive = pathname === item.url || pathname?.startsWith(item.url + '/');
                  const isTurbo = item.variant === "turbo";

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        tooltip={item.title}
                        isActive={isActive}
                        className={`
                            h-10 rounded-xl transition-all duration-200 ease-out hover:scale-[1.02] active:scale-95 mb-1
                            ${isActive 
                                ? 'bg-orange-200/50 text-orange-900 font-bold dark:bg-primary/20 dark:text-primary' 
                                : 'text-muted-foreground hover:bg-orange-100/50 hover:text-orange-800 dark:hover:bg-accent'
                            }
                            ${isTurbo ? 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 font-semibold' : ''} 
                        `}
                      >
                        <Link href={item.url}>
                          <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''} ${isTurbo ? 'text-indigo-500' : ''}`} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

      </SidebarContent>

      <SidebarSeparator className="bg-orange-100 dark:bg-border" />

      {/* FOOTER */}
      <SidebarFooter className="bg-orange-50/50 dark:bg-card/30">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-orange-100/50 rounded-xl transition-all"
                >
                  <Avatar className="h-8 w-8 rounded-lg border-2 border-white dark:border-border shadow-sm">
                    <AvatarImage src={user?.user_metadata?.avatar_url || "/placeholder-user.jpg"} alt={user?.email || "User"} />
                    <AvatarFallback className="rounded-lg bg-orange-200 text-orange-800">
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-bold text-foreground">
                        {user?.user_metadata?.full_name || "Happy Learner"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                        {user?.email || "student@quizcraft.app"}
                    </span>
                  </div>
                  <Settings className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-2xl p-2 bg-card/95 backdrop-blur-sm border-orange-100 dark:border-border"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email} />
                      <AvatarFallback className="rounded-lg">
                        {user?.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.user_metadata?.full_name || "User"}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer focus:bg-orange-50 dark:focus:bg-accent">
                    <Link href="/account">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Billing
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer focus:bg-orange-50 dark:focus:bg-accent">
                    <Link href="/profile">
                        <User className="mr-2 h-4 w-4" />
                        Profile Settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer focus:bg-orange-50 dark:focus:bg-accent">
                    <Link href="/support">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help & Support
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="rounded-xl cursor-pointer text-red-600 focus:bg-red-50 dark:focus:bg-red-900/10 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}