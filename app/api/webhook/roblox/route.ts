
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username } = body;

        if (!username || typeof username !== 'string') {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        const players = await db.getPlayers();
        const existingPlayer = players.find(p => p.username.toLowerCase() === username.toLowerCase());

        if (existingPlayer) {
            // Player exists, increment wins
            const newWins = existingPlayer.wins + 1;
            await db.updatePlayer(existingPlayer.id, { wins: newWins });
            console.log(`[Webhook] Incremented wins for existing player: ${username}`);
        } else {
            // Player does not exist, add to pending
            await db.incrementPendingWinner(username);
            console.log(`[Webhook] Added/Incremented pending winner: ${username}`);
        }

        // Revalidate pages so UI updates immediately (if possible, though this is API route)
        // Note: revalidation might not work perfectly from API route across all hosting environments depending on config,
        // but it helps for ISR/Server Actions integration.
        revalidatePath('/leaderboard');
        revalidatePath('/admin');

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Webhook] Error processing request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
