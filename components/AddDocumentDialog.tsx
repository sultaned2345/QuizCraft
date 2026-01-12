// components/AddDocumentDialog.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Sparkles, Loader2 } from 'lucide-react';
import { useTurboGenerator } from '@/hooks/useTurboGenerator';
import { useToast } from '@/hooks/use-toast';
// REMOVED: import { parseFile } from '@/lib/file-parser'; (Unused and dangerous in client component)

interface AddDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDocumentDialog({ open, onOpenChange }: AddDocumentDialogProps) {
  const [activeTab, setActiveTab] = useState('upload');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { generate, isGenerating, status } = useTurboGenerator();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleMagic = async () => {
     setIsProcessing(true);
     try {
       let contentToProcess = '';
       
       if (activeTab === 'upload' && file) {
          // 1. Upload/Parse File
          const formData = new FormData();
          formData.append('file', file);
          
          const parseRes = await fetch('/api/parse-file', {
             method: 'POST',
             body: formData
          });
          
          if (!parseRes.ok) throw new Error('Failed to parse file');
          const data = await parseRes.json();
          contentToProcess = data.content;
       } else if (activeTab === 'text') {
          contentToProcess = text;
       }
       
       if (!contentToProcess) throw new Error('No content provided');

       // 2. Trigger Generation
       await generate('quiz', contentToProcess, { source: activeTab });
       
       // Close dialog
       onOpenChange(false);

     } catch (error: any) {
        toast({
           title: "Error",
           description: error.message,
           variant: "destructive"
        });
     } finally {
        setIsProcessing(false);
     }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Knowledge Source</DialogTitle>
          <DialogDescription>
            Upload a PDF, paste text, or provide a link to generate study materials.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">File Upload</TabsTrigger>
            <TabsTrigger value="text">Paste Text</TabsTrigger>
            <TabsTrigger value="link" disabled>Link (Coming Soon)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4 py-4">
             <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="file">PDF / DOCX</Label>
                <Input id="file" type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} />
             </div>
             {file && (
                <div className="text-sm text-muted-foreground">
                   Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
             )}
          </TabsContent>
          
          <TabsContent value="text" className="space-y-4 py-4">
             <div className="grid w-full gap-1.5">
                <Label htmlFor="text">Study Notes / Content</Label>
                <Textarea 
                   id="text" 
                   placeholder="Paste your lecture notes or essay here..." 
                   className="min-h-[200px]"
                   value={text}
                   onChange={(e) => setText(e.target.value)}
                />
             </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
           <Button 
              onClick={handleMagic} 
              disabled={isProcessing || isGenerating || (activeTab === 'upload' && !file) || (activeTab === 'text' && !text)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg hover:shadow-primary/20 transition-all"
           >
              {isProcessing || isGenerating ? (
                 <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {status === 'idle' ? 'Processing...' : status}
                 </>
              ) : (
                 <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Magic
                 </>
              )}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}