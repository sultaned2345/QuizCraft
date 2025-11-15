// components/PageProgressBar.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.configure({ showSpinner: false });

    const handleStart = () => NProgress.start();
    const handleStop = () => NProgress.done();

    // We use a combination of pathname and searchParams to detect
    // *any* route change, even just query param changes.
    // We use a state variable to track the previous full path.
    const fullPath = `${pathname}?${searchParams.toString()}`;
    
    // We need to store the previous path to compare.
    // A simple variable won't work due to React's render cycle.
    // Using state is the idiomatic way.
    const [previousPath, setPreviousPath] = useState(fullPath);

    if (fullPath !== previousPath) {
      handleStart();
      // We don't call handleStop() here, because the new page
      // will trigger its own useEffect, and we want the bar to
      // stay active until the *new* page is hydrated.
      setPreviousPath(fullPath);
    }
    
    // This effect runs on the *new* page after navigation.
    // We call done() here to signify the new page is loaded.
    handleStop();

  }, [pathname, searchParams]); // Dependency array is correct

  // This component renders nothing. It just runs effects.
  return null;
}