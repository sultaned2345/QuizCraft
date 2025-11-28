import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <div className="prose dark:prose-invert">
        <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2 className="text-xl font-semibold mt-6 mb-2">1. Data Collection</h2>
        <p>
          We use Supabase for authentication and database storage. When you sign up, 
          we collect your email address. We also store the quizzes you generate and 
          your performance history.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. AI Generation</h2>
        <p>
          Data submitted to our quiz generators is processed by third-party AI providers 
          (OpenAI or Google Gemini). Do not submit sensitive personal information 
          into quiz prompts.
        </p>
        
        {/* Add full legal text here */}
      </div>
    </div>
  );
}