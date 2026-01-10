import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Uses Service Role for storage
import { getServerSession } from '@/lib/getServerSession';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;

    if (!file || !projectId) {
      return NextResponse.json({ error: 'File and Project ID are required' }, { status: 400 });
    }

    // 1. Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const uniqueName = `${session.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const bucketName = 'documents'; // Ensure this bucket exists in Supabase

    // Convert File to Buffer for Supabase upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(uniqueName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // 2. Create Document Record
    const document = await prisma.documents.create({
      data: {
        user_id: session.user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: BigInt(file.size),
        storage_path: uploadData.path,
      },
    });

    // 3. Link Document to Project
    await prisma.project_content_links.create({
      data: {
        user_id: session.user.id,
        project_id: projectId,
        content_id: document.id,
        content_type: 'document',
      },
    });

    // 4. Trigger AI Generation Job (Optional: can be done via separate call)
    await prisma.generation_jobs.create({
      data: {
        user_id: session.user.id,
        document_id: document.id,
        job_type: 'summary', // Default job
        status: 'pending'
      }
    });

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error('Upload Source Error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}