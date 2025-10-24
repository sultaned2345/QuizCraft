import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Import Prisma client
import { requireAuth, validateRequestBody } from '@/lib/auth'; // Import auth helpers
import { validateDeckCreation, USAGE_LIMITS } from '@/lib/usage-limits'; // Import validation and limits
import { ApiResponse, DecksResponse, CreateDeckData } from '@/types/database'; // Import types
import { Prisma } from '@prisma/client'; // Import Prisma for types if needed

export const runtime = 'nodejs'; // Specify runtime for Vercel

// --- GET Handler: Fetch all decks for the user ---
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request); // Ensure user is authenticated

        // Fetch user's subscription plan using Prisma
        const userProfile = await prisma.profiles.findUnique({
            where: { id: user.id },
            select: { subscription_plan: true },
        });
        // Determine plan and limit, defaulting to 'free' if profile is somehow missing
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const limit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_FLASHCARD_DECKS;

        // Fetch decks and count using Prisma
        const [decks, count] = await prisma.$transaction([
            prisma.flashcard_decks.findMany({
                where: { user_id: user.id },
                orderBy: { created_at: 'desc' }, // Order by newest first
            }),
            prisma.flashcard_decks.count({
                where: { user_id: user.id },
            }),
        ]);

        const responseData: DecksResponse = {
            decks,
            count,
            limit,
        };

        return NextResponse.json<ApiResponse<DecksResponse>>({
            success: true,
            data: responseData,
        });

    } catch (error: any) {
        // Handle errors from requireAuth or Prisma
        if (error instanceof Response) {
            console.error('Authentication error caught in GET /api/decks:', error.status);
            return error; // Forward the 401 response
        }
        console.error('Error fetching decks:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch decks';
        return NextResponse.json<ApiResponse>({
            success: false,
            error: errorMessage,
        }, { status: 500 });
    }
}

// --- POST Handler: Create a new deck ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request); // Ensure user is authenticated

        // Validate usage limits before proceeding
        const limitValidation = await validateDeckCreation(user.id);
        if (!limitValidation.isValid) {
            console.log(`Deck creation blocked for user ${user.id}: ${limitValidation.error}`);
            return NextResponse.json<ApiResponse>({
                success: false,
                error: limitValidation.error,
                message: limitValidation.message
            }, { status: 403 }); // Forbidden status for limit exceeded
        }

        // Parse and validate request body
        let body: CreateDeckData;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('Failed to parse request body:', parseError);
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
        }

        const validation = validateRequestBody(body, ['title']);
        if (!validation.isValid || !body.title) { // Also check title directly for type safety
            console.error('Validation failed:', validation.error);
            return NextResponse.json<ApiResponse>({ success: false, error: validation.error || 'Title is required and cannot be empty.' }, { status: 400 });
        }

        // Create new deck using Prisma
        const newDeck = await prisma.flashcard_decks.create({
            data: {
                user_id: user.id,
                title: body.title.trim(),
                // created_at and updated_at are handled by Prisma/database defaults
            },
        });

        return NextResponse.json<ApiResponse<typeof newDeck>>({
            success: true,
            data: newDeck,
            message: 'Flashcard deck created successfully',
        }, { status: 201 }); // 201 Created status

    } catch (error: any) {
        // Handle errors from requireAuth, validation, or Prisma
        if (error instanceof Response) {
            console.error('Authentication error caught in POST /api/decks:', error.status);
            return error; // Forward the 401 response
        }
        // Handle potential Prisma errors (e.g., unique constraint violations, although unlikely here)
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error('Prisma Error creating deck:', { code: error.code, meta: error.meta });
             // Provide a generic database error message
            return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while creating the deck.' }, { status: 500 });
        }
        // Handle other unexpected errors
        console.error('Unexpected error creating deck:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create deck';
        return NextResponse.json<ApiResponse>({
            success: false,
            error: errorMessage,
        }, { status: 500 });
    }
}