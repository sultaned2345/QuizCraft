// src/app/api/decks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Import Prisma client
import { requireAuth, validateRequestBody } from '@/lib/auth'; // Import auth helpers
import { validateDeckCreation, USAGE_LIMITS } from '@/lib/usage-limits'; // Import validation and limits
import { ApiResponse, CreateDeckData, FlashcardDeck } from '@/types/database'; // Adjust types if needed
import { Prisma } from '@prisma/client'; // Import Prisma for types if needed

export const runtime = 'nodejs'; // Specify runtime for Vercel

// Define a type for the paginated response data structure
interface PaginatedDecksResponse {
  decks: FlashcardDeck[]; // Or a simplified Deck type if needed for list view
  count: number; // Total count of decks for the user
  limit: number | typeof Infinity; // Usage limit for the plan
  totalPages: number;
  currentPage: number;
}


// --- UPDATED GET Handler: Fetch all decks for the user with Pagination ---
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request); // Ensure user is authenticated

        // --- Pagination Parameters ---
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '9', 10); // Default to 9 per page (to match grid)
        const skip = (page - 1) * limit;

        // Fetch user's subscription plan using Prisma
        const userProfile = await prisma.profiles.findUnique({
            where: { id: user.id },
            select: { subscription_plan: true },
        });
        // Determine plan and limit, defaulting to 'free' if profile is somehow missing
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const usageLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_FLASHCARD_DECKS;

        // Fetch decks and total count using Prisma in a single transaction
        const [decksData, totalCount] = await prisma.$transaction([
            prisma.flashcard_decks.findMany({
                where: { user_id: user.id },
                orderBy: { created_at: 'desc' }, // Order by newest first
                take: limit,
                skip: skip,
                // Optionally select fewer fields if full deck isn't needed for list
                // select: { id: true, title: true, created_at: true, _count: { select: { flashcards: true } } } // Example: include card count
            }),
            prisma.flashcard_decks.count({
                where: { user_id: user.id },
            }),
        ]);

        // Ensure dates are serialized correctly
        const decks = decksData.map(deck => ({
            ...deck,
            created_at: deck.created_at?.toISOString() || '',
            updated_at: deck.updated_at?.toISOString() || '',
        }));

        const totalPages = Math.ceil(totalCount / limit);

        // Prepare response data matching the PaginatedDecksResponse interface
        const responseData: PaginatedDecksResponse = {
            decks,
            count: totalCount,
            limit: usageLimit,
            totalPages,
            currentPage: page,
        };

        return NextResponse.json<ApiResponse<PaginatedDecksResponse>>({
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
        // Handle Prisma specific error for invalid UUID format if applicable (less likely here)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid User ID format somehow?' }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch decks';
        return NextResponse.json<ApiResponse>({
            success: false,
            error: errorMessage,
        }, { status: 500 });
    }
}

// --- POST Handler: Create a new deck (remains largely the same, using Prisma) ---
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
        const newDeckData = await prisma.flashcard_decks.create({
            data: {
                user_id: user.id,
                title: body.title.trim(),
                // created_at and updated_at are handled by Prisma/database defaults
            },
        });

        // Serialize dates for response
        const newDeck = {
            ...newDeckData,
            created_at: newDeckData.created_at?.toISOString() || '',
            updated_at: newDeckData.updated_at?.toISOString() || '',
        };

        return NextResponse.json<ApiResponse<FlashcardDeck>>({ // Use FlashcardDeck type
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