
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getCurrentDay, getTournamentType } from '@/lib/utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Log incoming request for debugging
        console.log(`[Webhook] Received request:`, {
            hasTournamentType: 'tournament_type' in body,
            tournamentType: body.tournament_type,
            hasDay: 'day' in body,
            day: body.day,
            hasUsername: 'username' in body,
            hasPlayers: 'players' in body,
            hasFirst: 'first' in body,
            playerCount: Array.isArray(body.players) ? body.players.length : 
                        (body.first ? 1 : 0) + (body.second ? 1 : 0) + (body.third ? 1 : 0) +
                        (body.fourth ? 1 : 0) + (body.fifth ? 1 : 0) + (body.sixth ? 1 : 0) +
                        (body.seventh ? 1 : 0) + (body.eighth ? 1 : 0) + (body.ninth ? 1 : 0) +
                        (body.tenth ? 1 : 0)
        });
        
        // Support both old format (single username) and new format (top 10 players)
        let players: Array<{ username: string; rank: number }> = [];
        
        if (body.username) {
            // Legacy format: single winner
            players = [{ username: body.username, rank: 1 }];
        } else if (body.first || body.second || body.third || body.fourth || body.fifth || body.sixth || body.seventh || body.eighth || body.ninth || body.tenth) {
            // New format: explicit first through tenth
            if (body.first) players.push({ username: body.first, rank: 1 });
            if (body.second) players.push({ username: body.second, rank: 2 });
            if (body.third) players.push({ username: body.third, rank: 3 });
            if (body.fourth) players.push({ username: body.fourth, rank: 4 });
            if (body.fifth) players.push({ username: body.fifth, rank: 5 });
            if (body.sixth) players.push({ username: body.sixth, rank: 6 });
            if (body.seventh) players.push({ username: body.seventh, rank: 7 });
            if (body.eighth) players.push({ username: body.eighth, rank: 8 });
            if (body.ninth) players.push({ username: body.ninth, rank: 9 });
            if (body.tenth) players.push({ username: body.tenth, rank: 10 });
        } else if (Array.isArray(body.players)) {
            // New format: array of players with rank
            players = body.players;
        } else {
            return NextResponse.json({ error: 'Invalid request format. Expected username, {first, second, third, ...}, or players array' }, { status: 400 });
        }

        if (players.length === 0) {
            return NextResponse.json({ error: 'No players provided' }, { status: 400 });
        }

        // Determine event: use webhook-provided event, or default to 'rvnc-jan-24th'
        const event = (body.event as string) || 'rvnc-jan-24th';

        // Determine day: use webhook-provided day, or detect current day
        const webhookDay = body.day as string | undefined;
        const day = webhookDay ? getCurrentDay(webhookDay) : getCurrentDay();

        // Determine tournament type from request or auto-detect
        const requestedTournamentType = body.tournament_type as 'all-day' | 'special' | undefined;
        const tournament_type = getTournamentType(day, requestedTournamentType);
        
        // Log the tournament type determination for debugging
        console.log(`[Webhook] Tournament type determination:`, {
            day,
            requestedTournamentType: requestedTournamentType || 'not provided',
            determinedTournamentType: tournament_type,
            currentTime: new Date().toISOString()
        });

        // Points allocation: 1st=100, 2nd=70, 3rd=50, 4th=40, 5th=30, 6th=20, 7th-10th=10 each
        // Only rank 1 gets wins
        const pointsByRank: Record<number, number> = {
            1: 100,
            2: 70,
            3: 50,
            4: 40,
            5: 30,
            6: 20,
            7: 10,
            8: 10,
            9: 10,
            10: 10
        };

        // Get existing players for this day and tournament type
        console.log(`[Webhook] Fetching existing players for day: ${day}, tournament_type: ${tournament_type}, event: ${event}...`);
        const existingPlayers = await db.getPlayers(day, tournament_type, event);
        const playersToUpdate: Array<{ id: string; wins: number; points: number }> = [];
        const skippedPlayers: string[] = [];

        // Process each player from the webhook
        for (const { username, rank } of players) {
            if (!username || typeof username !== 'string') {
                console.warn(`[Webhook] Invalid username for rank ${rank}, skipping`);
                continue;
            }

            const pointsToAdd = pointsByRank[rank] || 0;
            const winsToAdd = rank === 1 ? 1 : 0;

            // Find existing player by username (case-insensitive) and tournament type
            const existingPlayer = existingPlayers.find(p => 
                p.username.toLowerCase() === username.toLowerCase() && 
                (p.tournament_type || 'all-day') === tournament_type
            );

            if (existingPlayer) {
                // Player exists, update stats
                const newWins = (existingPlayer.wins || 0) + winsToAdd;
                const newPoints = (existingPlayer.points || 0) + pointsToAdd;
                playersToUpdate.push({
                    id: existingPlayer.id,
                    wins: newWins,
                    points: newPoints
                });
                console.log(`[Webhook] Will update registered player: ${username} - +${winsToAdd} wins, +${pointsToAdd} points`);
            } else {
                // Player not registered, skip
                skippedPlayers.push(username);
                console.warn(`[Webhook] Skipping ${username} (rank ${rank}) - player not registered. Please register this player before the game.`);
            }
        }

        // Update existing players' stats
        console.log(`[Webhook] Updating ${playersToUpdate.length} registered players...`);
        for (const { id, wins, points } of playersToUpdate) {
            await db.updatePlayer(id, { wins, points });
        }

        if (skippedPlayers.length > 0) {
            console.warn(`[Webhook] Skipped ${skippedPlayers.length} unregistered players: ${skippedPlayers.join(', ')}`);
        }

        console.log(`[Webhook] Successfully updated ${playersToUpdate.length} registered players`);

        // Revalidate pages so UI updates immediately
        revalidatePath('/leaderboard');
        revalidatePath('/admin');

        return NextResponse.json({ 
            success: true,
            updated: playersToUpdate.length,
            skipped: skippedPlayers.length,
            skippedPlayers: skippedPlayers.length > 0 ? skippedPlayers : undefined
        });

    } catch (error) {
        console.error('[Webhook] Error processing request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
