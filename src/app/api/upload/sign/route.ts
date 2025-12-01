import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; 
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';

const STORAGE_BUCKET_NAME = 'user_documents';

export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        const { fileName, fileType } = await request.json();

        if (!fileName || !fileType) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Missing file metadata' }, { status: 400 });
        }

        // Create a unique path: userId/timestamp-filename
        const storagePath = `${user.id}/${Date.now()}-${fileName}`;

        // Create a signed Upload URL (valid for 60 seconds)
        // Note: 'createSignedUploadUrl' is the correct method for PUT requests
        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET_NAME)
            .createSignedUploadUrl(storagePath);

        if (error) throw error;

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                signedUrl: data.signedUrl,
                path: data.path, // We need to send this back to the main API later
                token: data.token
            }
        });

    } catch (error: any) {
        console.error('Error signing upload url:', error);
        return NextResponse.json<ApiResponse>({ 
            success: false, 
            error: error.message || 'Failed to generate upload URL' 
        }, { status: 500 });
    }
}