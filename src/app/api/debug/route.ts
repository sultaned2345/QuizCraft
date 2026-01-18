import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET() {
  const status = {
    envVars: {
      DATABASE_URL: process.env.DATABASE_URL ? "Set (Hidden)" : "MISSING ❌",
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "MISSING ❌",
      GEMINI_KEY: process.env.GEMINI_API_KEY ? "Set (Hidden)" : "MISSING ❌",
    },
    dbConnection: "Pending...",
    error: null as string | null,
  };

  try {
    // Attempt a simple DB query
    await prisma.$queryRaw`SELECT 1`;
    status.dbConnection = "Success ✅";
    
    return NextResponse.json(status);
  } catch (e: any) {
    console.error("Debug Route Error:", e);
    status.dbConnection = "FAILED ❌";
    status.error = e.message;
    
    // Return the full error object so you can read it in the browser
    return NextResponse.json(status, { status: 500 });
  }
}