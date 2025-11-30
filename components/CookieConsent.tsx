'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import Link from 'next/link';

// CHANGED: "export default function" instead of "export function"
export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem('quizcraft-cookie-consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('quizcraft-cookie-consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur border-t shadow-lg animate-in slide-in-from-bottom-5">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          <p>
            We use cookies to improve your experience. By using our site, you agree to our{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsVisible(false)}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button size="sm" onClick={acceptCookies}>
            Accept Cookies
          </Button>
        </div>
      </div>
    </div>
  );
}