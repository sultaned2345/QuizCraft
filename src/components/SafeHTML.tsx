// src/components/SafeHTML.tsx
import React from 'react';
import DOMPurify from 'dompurify'; // Ensure you have this: npm install dompurify @types/dompurify

interface SafeHTMLProps {
  content: string;
  className?: string;
}

export const SafeHTML = ({ content, className = "" }: SafeHTMLProps) => {
  // Sanitize content to prevent XSS attacks
  const sanitizedContent = typeof window !== 'undefined' 
    ? DOMPurify.sanitize(content) 
    : content; // Server-side fallback

  return (
    <div 
      className={`prose prose-slate dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};