
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getCurrentDay } from '@/lib/utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Support both old format (single username) and new format (top 3 players)
        let players: Array<{ username: string; rank: number }> = [];
        
        if (body.username) {
            // Legacy format: single winner
            players = [{ username: body.username, rank: 1 }];
        } else if (body.first || body.second || body.third) {
            // New format: explicit first/second/third
            if (body.first) players.push({ username: body.first, rank: 1 });
            if (body.second) players.push({ username: body.second, rank: 2 });
            if (body.third) players.push({ username: body.third, rank: 3 });
        } else if (Array.isArray(body.players)) {
            // New format: array of players with rank
            players = body.players;
        } else {
            return NextResponse.json({ error: 'Invalid request format. Expected username, {first, second, third}, or players array' }, { status: 400 });
        }

        if (players.length === 0) {
            return NextResponse.json({ error: 'No players provided' }, { status: 400 });
        }

        // Detect current day (Saturday or Sunday)
        const currentDay = getCurrentDay();
        const day = currentDay || 'saturday';
        
        if (!currentDay) {
            console.warn(`[Webhook] Received results on non-weekend day, defaulting to saturday`);
        }

        // Process each player
        for (const { username, rank } of players) {
            if (!username || typeof username !== 'string') {
                console.warn(`[Webhook] Invalid username for rank ${rank}, skipping`);
                continue;
            }

            // Determine points and wins based on rank
            let pointsToAdd = 0;
            let winsToAdd = 0;
            
            if (rank === 1) {
                pointsToAdd = 100;
                winsToAdd = 1;
            } else if (rank === 2) {
                pointsToAdd = 70;
            } else if (rank === 3) {
                pointsToAdd = 50;
            }

            const allPlayers = await db.getPlayers(day);
            const existingPlayer = allPlayers.find(p => p.username.toLowerCase() === username.toLowerCase());

            if (existingPlayer) {
                // Player exists, update wins and points
                const newWins = (existingPlayer.wins || 0) + winsToAdd;
                const newPoints = (existingPlayer.points || 0) + pointsToAdd;
                await db.updatePlayer(existingPlayer.id, { wins: newWins, points: newPoints });
                console.log(`[Webhook] Updated player: ${username} (${day}) - +${winsToAdd} wins, +${pointsToAdd} points`);
            } else {
                // Player does not exist, add to pending
                await db.incrementPendingWinner(username, day, winsToAdd, pointsToAdd);
                console.log(`[Webhook] Added/Incremented pending: ${username} (${day}) - +${winsToAdd} wins, +${pointsToAdd} points`);
            }
        }

        // Revalidate pages so UI updates immediately
        revalidatePath('/leaderboard');
        revalidatePath('/admin');

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Webhook] Error processing request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
