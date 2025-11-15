// src/components/PageProgressBar.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Move useState to the top level.
  // This state will store the *current* path.
  const [currentPath, setCurrentPath] = useState(`${pathname}?${searchParams.toString()}`);

  useEffect(() => {
    NProgress.configure({ showSpinner: false });

    const handleStart = () => NProgress.start();
    const handleStop = () => NProgress.done();

    const newPath = `${pathname}?${searchParams.toString()}`;

    // Compare the new path from props to the one we have in state
    if (newPath !== currentPath) {
      handleStart();
      // Update the state to the new path
      setCurrentPath(newPath);
    }
    
    // This effect runs *after* the new page component has mounted.
    // So we can safely call done().
    handleStop();

    // The dependency array ensures this runs on every path change
    // and correctly compares against the 'currentPath' state.
  }, [pathname, searchParams, currentPath]);

  return null;
}