
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getCurrentDay } from '@/lib/utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username } = body;

        if (!username || typeof username !== 'string') {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        // Detect current day (Saturday or Sunday)
        const currentDay = getCurrentDay();
        if (!currentDay) {
            console.warn(`[Webhook] Received win on non-weekend day for: ${username}`);
            // Still process but default to saturday
            const day = 'saturday';
            const players = await db.getPlayers(day);
            const existingPlayer = players.find(p => p.username.toLowerCase() === username.toLowerCase());

            if (existingPlayer) {
                const newWins = existingPlayer.wins + 1;
                await db.updatePlayer(existingPlayer.id, { wins: newWins });
                console.log(`[Webhook] Incremented wins for existing player: ${username} (${day})`);
            } else {
                await db.incrementPendingWinner(username, day);
                console.log(`[Webhook] Added/Incremented pending winner: ${username} (${day})`);
            }
        } else {
            // Filter players by current day
            const players = await db.getPlayers(currentDay);
            const existingPlayer = players.find(p => p.username.toLowerCase() === username.toLowerCase());

            if (existingPlayer) {
                // Player exists for this day, increment wins
                const newWins = existingPlayer.wins + 1;
                await db.updatePlayer(existingPlayer.id, { wins: newWins });
                console.log(`[Webhook] Incremented wins for existing player: ${username} (${currentDay})`);
            } else {
                // Player does not exist for this day, add to pending
                await db.incrementPendingWinner(username, currentDay);
                console.log(`[Webhook] Added/Incremented pending winner: ${username} (${currentDay})`);
            }
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
