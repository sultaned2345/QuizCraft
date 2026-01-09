'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  Shield, 
  Cpu, 
  CreditCard,
  CheckCircle2,
  Loader2
} from 'lucide-react';
// Corrected import path for Avatar (now that we created the file)
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
// Replaced deprecated auth-helpers with ssr
import { createBrowserClient } from '@supabase/ssr';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  // Initialize Supabase client correctly for client components
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');

  // Placeholder stats - in real app, fetch from usage limits
  const usageStats = {
    aiCredits: 78,
    storage: 45,
    plan: 'PRO_TIER'
  };

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });

      if (error) throw error;
      
      toast({ description: "Identity updated successfully." });
      setIsEditing(false);
    } catch (e) {
      toast({ variant: "destructive", description: "Update failed." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">System Identity</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your operative profile and system access.
          </p>
        </div>
        <Button variant="outline" onClick={() => signOut()} className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300">
            Disconnect Session
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Col: Identity Card */}
        <div className="md:col-span-2 space-y-6">
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                    <Shield className="w-24 h-24 text-white rotate-12" />
                </div>

                <div className="relative z-10 flex items-start gap-6">
                    <Avatar className="h-24 w-24 border-2 border-white/10 shadow-xl">
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback className="bg-zinc-800 text-2xl font-mono">{fullName?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    
                    <div className="space-y-4 flex-1 max-w-md">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Operative Name</label>
                            {isEditing ? (
                                <Input 
                                    value={fullName} 
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="bg-black/50 border-white/10 h-9 font-medium"
                                />
                            ) : (
                                <div className="text-xl font-medium text-white flex items-center gap-3">
                                    {fullName || 'Unknown User'}
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] tracking-widest px-2 py-0.5">
                                        ACTIVE
                                    </Badge>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Comm Link</label>
                            <div className="flex items-center gap-2 text-zinc-400 font-mono text-sm">
                                <Mail className="w-3 h-3" />
                                {user?.email}
                            </div>
                        </div>

                        <div className="pt-2">
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleUpdateProfile} disabled={isLoading} className="bg-white text-black hover:bg-zinc-200">
                                        {isLoading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                                        Save Changes
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                </div>
                            ) : (
                                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="border-white/10 hover:bg-white/5">
                                    Edit Identity
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Authentication Methods */}
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-6">
                 <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-zinc-500" /> Security Protocols
                 </h3>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                        <div className="flex items-center gap-3">
                             <div className="h-8 w-8 rounded bg-white/5 flex items-center justify-center">
                                 <Mail className="w-4 h-4 text-zinc-400" />
                             </div>
                             <div>
                                 <div className="text-sm text-zinc-200 font-medium">Email Authentication</div>
                                 <div className="text-xs text-zinc-500">Secure entry via {user?.email}</div>
                             </div>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                 </div>
            </div>
        </div>

        {/* Right Col: Usage Stats */}
        <div className="space-y-6">
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-6">
                <h3 className="text-sm font-medium text-white mb-6 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-zinc-500" /> Resource Usage
                </h3>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">AI Tokens</span>
                            <span className="text-white font-mono">{usageStats.aiCredits}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 w-[78%] shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Storage Grid</span>
                            <span className="text-white font-mono">{usageStats.storage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[45%] shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-zinc-500" />
                                <span className="text-xs text-zinc-300">Current Plan</span>
                            </div>
                            <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                                {usageStats.plan}
                            </span>
                        </div>
                        <Button className="w-full mt-4 bg-white text-black hover:bg-zinc-200 text-xs font-bold tracking-wide">
                            UPGRADE CAPACITY
                        </Button>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}