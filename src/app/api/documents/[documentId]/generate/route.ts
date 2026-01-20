import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/getServerSession";
import { prisma } from "@/lib/prisma";
import {
  generateQuizFromContent,
  generateFlashcardsFromContent,
  generateNotesFromContent,
  generatePodcastForDocument,
} from "@/lib/aiGeneration";

// Allow longer timeout for AI generation (Vercel Pro: 60s, Hobby: 10s)
export const maxDuration = 60; 

export async function POST(
  req: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { documentId } = params;

    // 1. Fetch Document
    const document = await prisma.documents.findUnique({
      where: { id: documentId },
    });

    if (!document || !document.extracted_text) {
      return NextResponse.json(
        { error: "Document not found or has no text content." },
        { status: 404 }
      );
    }

    // 2. Check Ownership
    if (document.user_id !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const docTitle = document.file_name; 
    const docText = document.extracted_text;

    console.log(`🚀 Starting Full Generation for: ${docTitle}`);

    // 3. Run All Generators in Parallel
    const results = await Promise.allSettled([
      // A. Quiz
      generateQuizFromContent(docText).then(
        async (qData) => {
          if (!qData) return null;
          return prisma.quiz.create({
            data: {
              title: `${docTitle} Quiz`,
              // FIX: Schema uses 'userId' for Quiz model, not 'user_id'
              userId: session.user.id, 
              document_id: document.id,
              questions: { create: qData.questions },
            },
          });
        }
      ),

      // B. Flashcards
      generateFlashcardsFromContent(docText).then(
        async (fData) => {
          if (!fData) return null;
          return prisma.flashcard_decks.create({
            data: {
              title: `${docTitle} Flashcards`,
              user_id: session.user.id,
              document_id: document.id,
              flashcards: { create: fData },
            },
          });
        }
      ),

      // C. Notes
      generateNotesFromContent(docText).then(async (nContent) => {
        if (!nContent) return null;
        return prisma.notes.create({
          data: {
            title: `${docTitle} Summary`,
            content: nContent,
            user_id: session.user.id,
            document_id: document.id,
          },
        });
      }),

      // D. Podcast
      generatePodcastForDocument(
        docText,
        docTitle,
        session.user.id,
        document.id,
        "document"
      ),
    ]);

    // 4. Parse Results
    const [quizResult, flashcardResult, noteResult, podcastResult] = results;

    const response = {
      success: true,
      quizId:
        quizResult.status === "fulfilled" && quizResult.value
          ? quizResult.value.id
          : null,
      deckId:
        flashcardResult.status === "fulfilled" && flashcardResult.value
          ? flashcardResult.value.id
          : null,
      noteId:
        noteResult.status === "fulfilled" && noteResult.value
          ? noteResult.value.id
          : null,
      podcastId:
        podcastResult.status === "fulfilled" && podcastResult.value
          ? podcastResult.value.id
          : null,
      errors: [] as string[],
    };

    if (quizResult.status === "rejected") response.errors.push("Quiz failed");
    if (podcastResult.status === "rejected") response.errors.push("Podcast failed");

    console.log("✅ Generation Complete", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Generate API Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}