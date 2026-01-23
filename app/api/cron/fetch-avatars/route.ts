import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchRobloxUser, fetchRobloxAvatar } from '@/lib/roblox';
import { revalidatePath } from 'next/cache';

export async function GET(request: Request) {
    try {
        // Authentication for cron-job.org compatibility
        // Supports both Authorization header (Bearer token) and query parameter
        const cronSecret = process.env.CRON_SECRET;
        
        if (cronSecret) {
            const authHeader = request.headers.get('authorization');
            const url = new URL(request.url);
            const querySecret = url.searchParams.get('secret');
            
            // Check if provided secret matches (either in header or query param)
            const headerMatch = authHeader === `Bearer ${cronSecret}`;
            const queryMatch = querySecret === cronSecret;
            
            if (!headerMatch && !queryMatch) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        console.log('[Cron] Starting avatar fetch job...');

        // Get one player without an avatar
        const playersWithoutAvatars = await db.getPlayersWithoutAvatars();

        if (playersWithoutAvatars.length === 0) {
            console.log('[Cron] No players need avatar fetching');
            return NextResponse.json({ 
                success: true, 
                message: 'No players need avatar fetching',
                processed: 0 
            });
        }

        const player = playersWithoutAvatars[0];
        console.log(`[Cron] Processing player: ${player.username} (ID: ${player.id})`);

        // Fetch Roblox user data
        const robloxUser = await fetchRobloxUser(player.username, 3);

        if (!robloxUser) {
            console.warn(`[Cron] Failed to fetch Roblox user data for ${player.username}`);
            return NextResponse.json({ 
                success: false, 
                message: `Failed to fetch Roblox user data for ${player.username}`,
                processed: 0 
            });
        }

        console.log(`[Cron] Fetched Roblox user data for ${player.username} (ID: ${robloxUser.id})`);

        // Fetch avatar
        const avatarUrl = await fetchRobloxAvatar(robloxUser.id.toString(), 2);

        if (!avatarUrl) {
            console.warn(`[Cron] Failed to fetch avatar for ${player.username} (ID: ${robloxUser.id})`);
            // Still update the user data even if avatar fetch failed
            await db.updatePlayer(player.id, {
                robloxUserId: robloxUser.id.toString(),
                displayname: robloxUser.displayName,
            });
            return NextResponse.json({ 
                success: true, 
                message: `Updated user data but failed to fetch avatar for ${player.username}`,
                processed: 1 
            });
        }

        // Update player with all fetched data
        await db.updatePlayer(player.id, {
            robloxUserId: robloxUser.id.toString(),
            displayname: robloxUser.displayName,
            avatarUrl: avatarUrl,
        });

        console.log(`[Cron] Successfully updated player ${player.username} with avatar and user data`);

        // Revalidate pages so UI updates
        revalidatePath('/leaderboard');
        revalidatePath('/admin');

        return NextResponse.json({ 
            success: true, 
            message: `Successfully processed ${player.username}`,
            processed: 1 
        });

    } catch (error) {
        console.error('[Cron] Error in avatar fetch job:', error);
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            processed: 0 
        }, { status: 500 });
    }
}
