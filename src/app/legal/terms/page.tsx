// src/app/legal/terms/page.tsx
import { SafeHTML } from '@/components/SafeHTML'; // Assuming you have this or use standard HTML

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="text-muted-foreground mb-4">Last Updated: {new Date().toLocaleDateString()}</p>
      
      <div className="prose dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>By accessing or using QuizCraft, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. AI Disclaimer</h2>
          <p>QuizCraft uses Artificial Intelligence (AI) to generate quizzes, notes, and feedback. While we strive for accuracy, <strong>AI can make mistakes (hallucinations).</strong> Users should verify generated content against authoritative sources. QuizCraft is not liable for academic errors or incorrect study materials.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. User Content</h2>
          <p>You retain ownership of the documents (PDFs, text) you upload. By uploading content, you grant QuizCraft a license to process this data solely for the purpose of generating study materials for you.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Account Termination</h2>
          <p>We reserve the right to terminate or suspend access to our service immediately, without prior notice, for any breach of these Terms.</p>
        </section>
      </div>
    </div>
  );
}