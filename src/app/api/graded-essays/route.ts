// src/app/api/usage/ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Ensures the route is always treated as dynamic

interface AIUsageStatus {
    currentCount: number | undefined;
    limit: number | typeof Infinity;
    remaining: number | typeof Infinity;
    isPro: boolean;
}

export async function GET(request: NextRequest) {
    try {
        // requireAuth reads headers, making this route dynamic
        const user = await requireAuth(request);

        // Use the existing check function to get current count and limit
        const usageCheck = await checkAIGenerationUsageLimit(user.id);

        let remaining: number | typeof Infinity;
        if (usageCheck.limit === Infinity) {
            remaining = Infinity;
        } else if (usageCheck.currentCount !== undefined) {
            remaining = Math.max(0, usageCheck.limit - usageCheck.currentCount);
        } else {
            // If count is undefined (e.g., error during fetch), assume limit remains
            remaining = usageCheck.limit;
        }

        const responseData: AIUsageStatus = {
            currentCount: usageCheck.currentCount,
            limit: usageCheck.limit,
            remaining: remaining,
            isPro: usageCheck.limit === Infinity, // Determine if user is Pro based on limit
        };

        return NextResponse.json<ApiResponse<AIUsageStatus>>({
            success: true,
            data: responseData,
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        console.error('Error fetching AI usage status:', error);
        // Return a default "error" state or default free limits
        const errorResponse: AIUsageStatus = {
            currentCount: undefined,
            limit: 5, // Default free limit <-- MODIFIED
            remaining: 0,
            isPro: false,
        };
        return NextResponse.json<ApiResponse<AIUsageStatus>>(
            { success: false, data: errorResponse, error: error.message || 'Failed to fetch AI usage.' },
            { status: 500 }
        );
    }
}