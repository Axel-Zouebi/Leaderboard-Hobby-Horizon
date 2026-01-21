'use server';

import { db, Player } from './db';
import { fetchRobloxUser, fetchRobloxAvatar, fetchBatchAvatars } from './roblox';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import { getCurrentDay } from './utils';


export async function getPlayers(day?: string, tournament_type?: 'all-day' | 'special', event?: string) {
    try {
        console.log('Fetching players...', day ? `for ${day}` : 'for all days', tournament_type ? `(${tournament_type})` : '', event ? `event: ${event}` : '');
        const players = await db.getPlayers(day, tournament_type, event);

        // Fetch fresh avatars (non-critical, so we continue even if it fails)
        const userIds = players.map(p => p.robloxUserId);
        if (userIds.length > 0) {
            try {
                const avatarMap = await fetchBatchAvatars(userIds);
                return players.map(p => ({
                    ...p,
                    avatarUrl: avatarMap[p.robloxUserId] || p.avatarUrl
                }));
            } catch (avatarError) {
                console.warn('[Actions] Error fetching avatars, returning players without updated avatars:', avatarError);
                // Return players with existing avatars if batch fetch fails
                return players;
            }
        }

        return players;
    } catch (error) {
        console.error('[Actions] Error in getPlayers:', error);
        // Return empty array on error to prevent crash
        return [];
    }
}

export async function getPendingWinners(day?: string, tournament_type?: 'all-day' | 'special', event?: string) {
    return await db.getPendingWinners(day, tournament_type, event);
}

export async function approvePendingWinnerAction(username: string, day: string, tournament_type: 'all-day' | 'special' = 'all-day'): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Get the pending winner info to know how many wins and points they have
        const pendingList = await db.getPendingWinners(day, tournament_type, undefined);
        const pending = pendingList.find(p => p.username === username && p.day === day && (p.tournament_type || 'all-day') === tournament_type);
        if (!pending) {
            return { success: false, error: 'Pending winner not found. They may have already been registered.' };
        }

        // 2. Fetch Roblox Data with retry logic (built into fetchRobloxUser)
        console.log(`[Approve] Fetching Roblox user data for: ${username}`);
        const robloxUser = await fetchRobloxUser(username, 3); // 3 retries with exponential backoff
        
        if (!robloxUser) {
            return { success: false, error: `Could not find Roblox user: ${username}. The user may not exist or Roblox API is unavailable. Please try again in a few moments.` };
        }
        
        console.log(`[Approve] Found Roblox user: ${robloxUser.name} (ID: ${robloxUser.id})`);

        // Fetch avatar with retry logic (non-critical, so we continue even if it fails)
        let avatarUrl: string | null = null;
        try {
            console.log(`[Approve] Fetching avatar for user: ${robloxUser.id}`);
            avatarUrl = await fetchRobloxAvatar(robloxUser.id, 2); // 2 retries
            if (avatarUrl) {
                console.log(`[Approve] Successfully fetched avatar`);
            } else {
                console.warn(`[Approve] Avatar fetch failed, continuing without avatar`);
            }
        } catch (error) {
            console.warn('[Approve] Avatar fetch failed or timed out, continuing without avatar:', error);
            // Continue without avatar - not critical
        }

        // 3. Create real player with accrued wins and points
        const newPlayer: Player = {
            id: uuidv4(),
            robloxUserId: robloxUser.id.toString(),
            username: robloxUser.name,
            displayname: robloxUser.displayName,
            wins: pending.wins || 0, // Use accrued wins
            points: pending.points || 0, // Use accrued points
            avatarUrl: avatarUrl || '',
            createdAt: new Date().toISOString(),
            day: pending.day,
            tournament_type: pending.tournament_type || 'all-day',
        };

        await db.addPlayer(newPlayer);

        // 4. Remove from pending
        await db.removePendingWinner(username, day, tournament_type);

        revalidatePath('/admin');
        revalidatePath('/leaderboard');
        
        return { success: true };
    } catch (error) {
        console.error('Error in approvePendingWinnerAction:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        return { success: false, error: errorMessage };
    }
}

export async function addPlayerAction(formData: FormData) {
    try {
        const username = formData.get('username') as string;
        let day = formData.get('day') as string | null;
        const tournament_type = formData.get('tournament_type') as 'all-day' | 'special' | null;
        const event = formData.get('event') as string | null;
        
        if (!username) {
            console.error('[addPlayerAction] No username provided');
            return { success: false, error: 'Username is required' };
        }

        // For RVNC Jan 24th, allow day to be null/undefined
        // For Hobby Horizon, default to current day if not provided
        const currentEvent = event || 'rvnc-jan-24th';
        if (!day && currentEvent === 'hobby-horizon') {
            day = getCurrentDay();
        }

        // Use retry logic for consistency with approvePendingWinnerAction
        const robloxUser = await fetchRobloxUser(username, 3); // 3 retries with exponential backoff
        if (!robloxUser) {
            console.error(`[addPlayerAction] Failed to fetch Roblox user for ${username}`);
            return { success: false, error: `Could not find Roblox user: ${username}` };
        }

        let avatarUrl = '';
        try {
            avatarUrl = await fetchRobloxAvatar(robloxUser.id, 2); // 2 retries
        } catch (error) {
            console.warn(`[addPlayerAction] Failed to fetch avatar for ${username}, continuing without avatar:`, error);
            // Continue without avatar
        }

        const newPlayer: Player = {
            id: uuidv4(),
            robloxUserId: robloxUser.id.toString(),
            username: robloxUser.name,
            displayname: robloxUser.displayName,
            wins: 0,
            points: 0,
            avatarUrl: avatarUrl || '', // Fallback or placeholder
            createdAt: new Date().toISOString(),
            day: day || undefined, // Allow null/undefined for RVNC Jan 24th
            tournament_type: day === 'sunday' ? (tournament_type || 'all-day') : undefined, // Use provided tournament_type for Sunday, undefined for Saturday
            event: currentEvent,
        };

        await db.addPlayer(newPlayer);

        revalidatePath('/admin');
        revalidatePath('/leaderboard');
        
        return { success: true };
    } catch (error) {
        console.error('[addPlayerAction] Error adding player:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        return { success: false, error: errorMessage };
    }
}

export async function deletePlayerAction(id: string) {
    await db.deletePlayer(id);
    revalidatePath('/admin');
    revalidatePath('/leaderboard');
}

export async function updateWinsAction(id: string, increment: number) {
    const players = await db.getPlayers();
    const player = players.find(p => p.id === id);
    if (!player) return;

    const newWins = Math.max(0, (player.wins || 0) + increment);
    await db.updatePlayer(id, { wins: newWins });
    revalidatePath('/admin');
    revalidatePath('/leaderboard');
}

export async function updatePointsAction(id: string, increment: number) {
    const players = await db.getPlayers();
    const player = players.find(p => p.id === id);
    if (!player) return;

    const newPoints = Math.max(0, (player.points || 0) + increment);
    await db.updatePlayer(id, { points: newPoints });
    revalidatePath('/admin');
    revalidatePath('/leaderboard');
}
