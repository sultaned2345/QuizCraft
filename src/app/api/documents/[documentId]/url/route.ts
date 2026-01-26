import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Assuming this is used for signing

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { documentId } = params;

    // --- FIX START: Guard against invalid IDs ---
    // 1. Check if ID exists and is not the string "undefined"
    // 2. Validate it looks like a UUID (36 chars, dashes)
    const isValidUUID =
      documentId &&
      documentId !== 'undefined' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId);

    if (!isValidUUID) {
      console.warn(`[API] Blocked invalid documentId: ${documentId}`);
      return NextResponse.json(
        { error: 'Invalid or missing document ID' },
        { status: 400 }
      );
    }
    // --- FIX END ---

    // Now safe to query Prisma
    const document = await prisma.documents.findUnique({
      where: {
        id: documentId,
        user_id: user.id, // Ensure user owns the document
      },
      select: {
        storage_path: true,
        file_name: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Generate Signed URL (assuming Supabase storage)
    const { data, error } = await supabaseAdmin
      .storage
      .from('documents') // Check your bucket name
      .createSignedUrl(document.storage_path, 60 * 60); // 1 hour expiry

    if (error || !data) {
      throw new Error('Failed to generate signed URL');
    }

    return NextResponse.json({
      success: true,
      url: data.signedUrl,
      fileName: document.file_name
    });

  } catch (error: any) {
    console.error('Error in signed URL route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}