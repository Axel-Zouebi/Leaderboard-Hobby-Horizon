
import { NextResponse } from 'next/server';
import { db, Player } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getCurrentDay, getTournamentType } from '@/lib/utils';
import { fetchRobloxUser, fetchBatchAvatars } from '@/lib/roblox';
import { v4 as uuidv4 } from 'uuid';

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

        // Phase 1: Collect user data for all players (with rate limiting)
        console.log(`[Webhook] Phase 1: Fetching user data for ${players.length} players...`);
        const playerData: Array<{
            username: string;
            rank: number;
            robloxUser: { id: number; name: string; displayName: string } | null;
            pointsToAdd: number;
            winsToAdd: number;
        }> = [];

        for (let i = 0; i < players.length; i++) {
            const { username, rank } = players[i];
            
            if (!username || typeof username !== 'string') {
                console.warn(`[Webhook] Invalid username for rank ${rank}, skipping`);
                continue;
            }

            // Rate limit: 100ms delay between user search requests
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const robloxUser = await fetchRobloxUser(username, 3);
            const pointsToAdd = pointsByRank[rank] || 0;
            const winsToAdd = rank === 1 ? 1 : 0;

            playerData.push({
                username,
                rank,
                robloxUser,
                pointsToAdd,
                winsToAdd
            });

            if (robloxUser) {
                console.log(`[Webhook] Fetched user data for ${username} (ID: ${robloxUser.id})`);
            } else {
                console.warn(`[Webhook] Failed to fetch user data for ${username}, will skip`);
            }
        }

        // Phase 2: Check existing players and create new ones
        console.log(`[Webhook] Phase 2: Creating/updating player records...`);
        const existingPlayers = await db.getPlayers(day, tournament_type);
        const playersToUpdate: Array<{ id: string; wins: number; points: number }> = [];
        const newPlayers: Array<{ player: Player; userId: string }> = [];
        const userIdsToFetch: string[] = [];

        for (const { username, robloxUser, pointsToAdd, winsToAdd } of playerData) {
            if (!robloxUser) {
                console.warn(`[Webhook] Skipping ${username} - failed to fetch Roblox user data`);
                continue;
            }

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
                console.log(`[Webhook] Will update existing player: ${username} - +${winsToAdd} wins, +${pointsToAdd} points`);
            } else {
                // Create new player with placeholder avatar
                const newPlayer: Player = {
                    id: uuidv4(),
                    robloxUserId: robloxUser.id.toString(),
                    username: robloxUser.name,
                    displayname: robloxUser.displayName,
                    wins: winsToAdd,
                    points: pointsToAdd,
                    avatarUrl: '', // Placeholder - will be updated in Phase 3
                    createdAt: new Date().toISOString(),
                    day: day,
                    tournament_type: tournament_type,
                };
                newPlayers.push({ player: newPlayer, userId: robloxUser.id.toString() });
                userIdsToFetch.push(robloxUser.id.toString());
                console.log(`[Webhook] Will create new player: ${username} (ID: ${robloxUser.id}) - ${winsToAdd} wins, ${pointsToAdd} points`);
            }
        }

        // Create all new players immediately
        for (const { player } of newPlayers) {
            await db.addPlayer(player);
        }

        // Phase 3: Batch fetch avatars for all new players
        console.log(`[Webhook] Phase 3: Batch fetching avatars for ${userIdsToFetch.length} new players...`);
        let avatarMap: Record<string, string> = {};
        if (userIdsToFetch.length > 0) {
            try {
                avatarMap = await fetchBatchAvatars(userIdsToFetch);
                console.log(`[Webhook] Successfully fetched ${Object.keys(avatarMap).length} avatars via batch API`);
            } catch (error) {
                console.error(`[Webhook] Batch avatar fetch failed:`, error);
                // Continue without avatars - players will have placeholder
            }
        }

        // Phase 4: Update new players with avatars and update existing players' stats
        console.log(`[Webhook] Phase 4: Updating player records...`);
        
        // Update new players with avatars
        for (const { player, userId } of newPlayers) {
            const avatarUrl = avatarMap[userId] || '';
            if (avatarUrl) {
                await db.updatePlayer(player.id, { avatarUrl });
                console.log(`[Webhook] Updated avatar for ${player.username}`);
            }
        }

        // Update existing players' stats
        for (const { id, wins, points } of playersToUpdate) {
            await db.updatePlayer(id, { wins, points });
        }

        console.log(`[Webhook] Successfully processed ${newPlayers.length} new players and updated ${playersToUpdate.length} existing players`);

        // Revalidate pages so UI updates immediately
        revalidatePath('/leaderboard');
        revalidatePath('/admin');

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Webhook] Error processing request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
