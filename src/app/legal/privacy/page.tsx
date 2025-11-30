// src/app/legal/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-muted-foreground mb-4">Last Updated: {new Date().toLocaleDateString()}</p>
      
      <div className="prose dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold">1. Information We Collect</h2>
          <ul className="list-disc pl-5">
            <li><strong>Account Data:</strong> Email address and authentication details (via Supabase).</li>
            <li><strong>Usage Data:</strong> Quiz scores, study patterns, and AI generation history.</li>
            <li><strong>Uploaded Content:</strong> Documents and text you submit for processing.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. How We Use Your Data</h2>
          <p>We use your data to:</p>
          <ul className="list-disc pl-5">
            <li>Provide and maintain the QuizCraft service.</li>
            <li>Generate quizzes and flashcards using AI providers (e.g., OpenAI, Google Gemini).</li>
            <li>Improve the accuracy of our study algorithms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Data Storage</h2>
          <p>Your data is securely stored using Supabase (PostgreSQL). We do not sell your personal data to third parties.</p>
        </section>
      </div>
    </div>
  );
}