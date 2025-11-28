import React from 'react';

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <div className="prose dark:prose-invert">
        <h2 className="text-xl font-semibold mt-6 mb-2">AI Accuracy Disclaimer</h2>
        <p className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          QuizCraft uses Artificial Intelligence to generate questions. While we strive for accuracy, 
          the AI may produce incorrect or misleading information. This tool is for study aid purposes 
          only and should not be the sole source of truth for critical exams.
        </p>
        {/* Add full legal text here */}
      </div>
    </div>
  );
}