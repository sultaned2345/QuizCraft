// src/app/(app)/account/AccountClient.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUpgradeModal } from '@/components/UpgradeModalContext';
import { cn } from '@/lib/utils';
import { getUserUsage } from '@/lib/usage-limits';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';
import { 
  User, 
  Settings, 
  CreditCard, 
  Bell, 
  Moon, 
  Sun, 
  Laptop, 
  Check, 
  Infinity, 
  Loader2, 
  LogOut,
  Mail,
  Shield,
  Zap
} from 'lucide-react';

type UsageData = Awaited<ReturnType<typeof getUserUsage>>;

interface AccountClientProps {
  initialData: UsageData;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export function AccountClient({ initialData, user }: AccountClientProps) {
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const { openModal } = useUpgradeModal();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);

  // Stats from DB
  const isPro = initialData.plan === 'pro';

  // Mock Notifications State
  const [notifications, setNotifications] = useState({
    marketing: false,
    security: true,
    updates: true,
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      toast({ title: "Error signing out", variant: "destructive" });
    }
  };

  const navItems = [
    { id: 'general', label: 'General', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      
      {/* Page Header */}
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* LEFT COLUMN: Navigation Sidebar */}
        <aside className="lg:w-64 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-4 lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                    activeTab === item.id 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT COLUMN: Content Area */}
        <div className="flex-1 space-y-6">
          
          {/* --- GENERAL TAB --- */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20 border-2 border-muted">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-xl bg-primary/10 text-primary">
                        {(user.email[0] || 'U').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                       <Button variant="outline" size="sm" disabled>Change Avatar</Button>
                       <p className="text-xs text-muted-foreground">JPG, GIF or PNG. 1MB max.</p>
                    </div>
                  </div>
                  
                  <Separator />

                  {/* Form Inputs */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="email" value={user.email} disabled className="pl-9 bg-muted/50" />
                      </div>
                      <p className="text-[0.8rem] text-muted-foreground">
                        Your email is managed via your signup provider.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userId">User ID</Label>
                      <div className="relative">
                        <Shield className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="userId" value={user.id} disabled className="pl-9 bg-muted/50 font-mono text-xs" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Session</CardTitle>
                  <CardDescription>Manage your active session.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                   <div>
                     <p className="font-medium">Current Session</p>
                     <p className="text-sm text-muted-foreground">You are currently logged in on this device.</p>
                   </div>
                   <Button variant="outline" onClick={handleSignOut} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                     <LogOut className="w-4 h-4 mr-2" /> Sign Out
                   </Button>
                </CardContent>
              </Card>

              <DeleteAccountSection />
            </div>
          )}

          {/* --- APPEARANCE TAB --- */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card>
                <CardHeader>
                  <CardTitle>Theme Preferences</CardTitle>
                  <CardDescription>Select the theme for the dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Light Mode */}
                    <div 
                      className={cn(
                        "cursor-pointer rounded-xl border-2 p-1 hover:border-primary transition-all",
                        theme === 'light' ? "border-primary bg-primary/5" : "border-muted"
                      )}
                      onClick={() => setTheme('light')}
                    >
                      <div className="space-y-2 rounded-lg bg-[#f0f2f5] p-2">
                        <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                          <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                          <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                        </div>
                        <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                          <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                          <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                        </div>
                      </div>
                      <div className="p-2 text-center text-sm font-medium">Light</div>
                    </div>

                    {/* Dark Mode */}
                    <div 
                      className={cn(
                        "cursor-pointer rounded-xl border-2 p-1 hover:border-primary transition-all",
                        theme === 'dark' ? "border-primary bg-primary/5" : "border-muted"
                      )}
                      onClick={() => setTheme('dark')}
                    >
                       <div className="space-y-2 rounded-lg bg-slate-950 p-2">
                        <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                          <div className="h-2 w-[80px] rounded-lg bg-slate-400" />
                          <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                        </div>
                        <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                          <div className="h-4 w-4 rounded-full bg-slate-400" />
                          <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                        </div>
                      </div>
                      <div className="p-2 text-center text-sm font-medium">Dark</div>
                    </div>

                    {/* System Mode */}
                    <div 
                      className={cn(
                        "cursor-pointer rounded-xl border-2 p-1 hover:border-primary transition-all",
                        theme === 'system' ? "border-primary bg-primary/5" : "border-muted"
                      )}
                      onClick={() => setTheme('system')}
                    >
                      <div className="flex h-full items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900 p-4">
                         <Laptop className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div className="p-2 text-center text-sm font-medium">System</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* --- BILLING TAB --- */}
          {activeTab === 'billing' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>You are currently on the <span className="font-semibold text-foreground capitalize">{initialData.plan}</span> plan.</CardDescription>
                  </div>
                  <Badge variant={isPro ? "default" : "secondary"} className="text-sm px-3 py-1">
                    {isPro ? "PRO" : "FREE"}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-6">
                  {!isPro ? (
                    <div className="bg-muted/30 p-4 rounded-lg border flex items-center justify-between">
                       <div className="space-y-1">
                         <p className="font-medium text-sm">Upgrade to Pro</p>
                         <p className="text-xs text-muted-foreground">Unlock unlimited generation and storage.</p>
                       </div>
                       <Button onClick={openModal} size="sm" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0">
                         Upgrade Now
                       </Button>
                    </div>
                  ) : (
                    <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 flex items-center gap-3 text-primary">
                       <Check className="h-5 w-5" />
                       <span className="font-medium text-sm">Your subscription is active and in good standing.</span>
                    </div>
                  )}
                </CardContent>
               </Card>

               {/* Usage Bars */}
               <Card>
                 <CardHeader>
                   <CardTitle>Usage Limits</CardTitle>
                   <CardDescription>Your resource consumption for this billing cycle.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-8">
                    <UsageItem 
                      label="AI Generations" 
                      icon={Zap} 
                      used={initialData.aiGenerations.used} 
                      limit={initialData.aiGenerations.limit} 
                    />
                    <UsageItem 
                      label="Documents Uploaded" 
                      icon={User} 
                      used={initialData.documents.used} 
                      limit={initialData.documents.limit} 
                    />
                    <UsageItem 
                      label="Quizzes Created" 
                      icon={Check} 
                      used={initialData.quizzes.used} 
                      limit={initialData.quizzes.limit} 
                    />
                 </CardContent>
               </Card>
            </div>
          )}

          {/* --- NOTIFICATIONS TAB --- */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Choose what you want to be notified about.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="flex items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <Label className="text-base">Product Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive news about new features and improvements.
                        </p>
                      </div>
                      <Switch 
                        checked={notifications.updates}
                        onCheckedChange={(checked) => setNotifications(prev => ({...prev, updates: checked}))}
                      />
                   </div>
                   <Separator />
                   <div className="flex items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <Label className="text-base">Security Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified about login attempts and password changes.
                        </p>
                      </div>
                      <Switch 
                        checked={notifications.security}
                        disabled
                        onCheckedChange={(checked) => setNotifications(prev => ({...prev, security: checked}))}
                      />
                   </div>
                   <Separator />
                   <div className="flex items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <Label className="text-base">Marketing Emails</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive offers and promotions.
                        </p>
                      </div>
                      <Switch 
                        checked={notifications.marketing}
                        onCheckedChange={(checked) => setNotifications(prev => ({...prev, marketing: checked}))}
                      />
                   </div>
                </CardContent>
               </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Helper for Usage Bars
function UsageItem({ label, icon: Icon, used, limit }: { label: string, icon: any, used: number, limit: number | typeof Infinity }) {
  const isUnlimited = limit === Infinity;
  const percentage = isUnlimited ? 0 : Math.min((used / (limit as number)) * 100, 100);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <span className="text-muted-foreground">
          {isUnlimited ? (
            <span className="flex items-center text-primary text-xs font-bold gap-1">
              <Infinity className="h-3 w-3" /> Unlimited
            </span>
          ) : (
            <span>{used} / {limit}</span>
          )}
        </span>
      </div>
      {isUnlimited ? (
         <div className="h-2 w-full bg-primary/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary w-full opacity-50"></div>
         </div>
      ) : (
        <Progress value={percentage} className="h-2" />
      )}
    </div>
  );
}