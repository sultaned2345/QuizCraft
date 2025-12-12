'use client';
import { useRouter } from 'next/navigation';
import { AudioInput } from '@/components/AudioInput';
import { Separator } from '@/components/ui/separator';

export default function NewNotePage() {
  const router = useRouter();

  const handleAudioSuccess = (docId: string) => {
    // Navigate to the document page where they can "Generate Notes" 
    // OR trigger note generation automatically here.
    // Let's go to the document page so they can choose "Quiz" or "Summary"
    router.push(`/documents/${docId}`);
  };

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-3xl font-bold mb-6">Create New Study Material</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">From Lecture (Audio)</h2>
          <AudioInput onTranscriptionComplete={handleAudioSuccess} />
        </section>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <section>
             {/* Your existing Text/PDF input would go here */}
             <p className="text-center text-muted-foreground">Drag and drop PDFs above...</p>
        </section>
      </div>
    </div>
  );
}