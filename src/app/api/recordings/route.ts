import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const recordings = await prisma.recordings.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' }
    });
    return NextResponse.json<ApiResponse>({ success: true, data: recordings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Handle DELETE as well
export async function DELETE(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if(!id) throw new Error("Missing ID");

        await prisma.recordings.delete({
            where: { id, user_id: user.id }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}