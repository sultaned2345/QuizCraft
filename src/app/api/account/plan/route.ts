// src/app/api/account/plan/route.ts
// NEW FILE

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // <-- ADD THIS LINE AT THE TOP


/**
 * @route POST /api/account/plan
 * @description Updates the subscription_plan for the authenticated user.
 * @body { newPlan: 'free' | 'pro' }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { newPlan } = await request.json();

    if (newPlan !== 'free' && newPlan !== 'pro') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid plan. Must be "free" or "pro".'
      }, { status: 400 });
    }

    const updatedProfile = await prisma.profiles.update({
      where: {
        id: user.id
      },
      data: {
        subscription_plan: newPlan
      },
      select: {
        id: true,
        subscription_plan: true
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedProfile,
      message: `Plan updated to ${newPlan}.`
    });

  } catch (error: any) {
    if (error instanceof Response) return error; // Handle requireAuth errors
    console.error('[API /api/account/plan] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update plan.' },
      { status: 500 }
    );
  }
}