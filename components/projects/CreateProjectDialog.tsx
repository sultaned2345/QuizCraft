'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'upload'>('details');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  // Step 1: Create Project Container
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });

      if (!res.ok) throw new Error('Failed to create project');
      const data = await res.json();
      
      setProjectId(data.project.id);
      setStep('upload'); // Move to upload step
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not create project." });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Upload Source File
  const handleUpload = async () => {
    if (!file || !projectId) return;
    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);

    try {
      const res = await fetch('/api/upload/source', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      
      // OPTIONAL: Trigger processing immediately
      fetch('/api/generation-jobs/process', { method: 'POST' });

      toast({ title: "Success", description: "Project created and file uploaded!" });
      router.push(`/projects/${projectId}`);
      setOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Upload Failed", description: "Created project but failed to upload file." });
      // Still navigate to project so user isn't stuck
      router.push(`/projects/${projectId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 shadow-lg">
          <Plus size={18} /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{step === 'details' ? 'Create Workspace' : 'Add Study Material'}</DialogTitle>
          <DialogDescription>
            {step === 'details' ? 'Start by naming your new study project.' : 'Upload a PDF or Audio recording to start.'}
          </DialogDescription>
        </DialogHeader>
        
        {step === 'details' ? (
          <form onSubmit={handleCreateProject} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                placeholder="e.g. Biology 101"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "Next: Add Content"}
            </Button>
          </form>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <FileUp className="h-10 w-10 text-muted-foreground mb-2" />
              <Input 
                type="file" 
                className="hidden" 
                id="file-upload"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Label htmlFor="file-upload" className="cursor-pointer">
                {file ? file.name : "Click to select PDF or Audio"}
              </Label>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}`)}>
                Skip
              </Button>
              <Button onClick={handleUpload} disabled={!file || isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : "Upload & Create"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}