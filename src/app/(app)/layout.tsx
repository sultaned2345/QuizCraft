// src/app/(app)/layout.tsx
import { AppLayoutClient } from './AppLayoutClient'; // Import the new client wrapper

// This is now a Server Component (no 'use client')
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayoutClient>
      {children} {/* Pass the Server Component page to the Client Component wrapper */}
    </AppLayoutClient>
  );
}