'use server';

import { db, Player } from './db';
import { fetchRobloxUser, fetchRobloxAvatar, fetchBatchAvatars } from './roblox';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import { getCurrentDay } from './utils';


export async function getPlayers(day?: 'saturday' | 'sunday', tournament_type?: 'all-day' | 'special') {
    console.log('Fetching players...', day ? `for ${day}` : 'for all days', tournament_type ? `(${tournament_type})` : '');
    const players = await db.getPlayers(day, tournament_type);

    // Fetch fresh avatars
    const userIds = players.map(p => p.robloxUserId);
    if (userIds.length > 0) {
        const avatarMap = await fetchBatchAvatars(userIds);
        return players.map(p => ({
            ...p,
            avatarUrl: avatarMap[p.robloxUserId] || p.avatarUrl
        }));
    }

    return players;
}

export async function getPendingWinners(day?: 'saturday' | 'sunday', tournament_type?: 'all-day' | 'special') {
    return await db.getPendingWinners(day, tournament_type);
}

export async function approvePendingWinnerAction(username: string, day: 'saturday' | 'sunday', tournament_type: 'all-day' | 'special' = 'all-day'): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Get the pending winner info to know how many wins and points they have
        const pendingList = await db.getPendingWinners(day, tournament_type);
        const pending = pendingList.find(p => p.username === username && p.day === day && (p.tournament_type || 'all-day') === tournament_type);
        if (!pending) {
            return { success: false, error: 'Pending winner not found. They may have already been registered.' };
        }

        // 2. Fetch Roblox Data with timeout handling
        let robloxUser;
        try {
            const robloxUserPromise = fetchRobloxUser(username);
            const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Roblox API timeout: User lookup took too long (10s)')), 10000)
            );
            robloxUser = await Promise.race([robloxUserPromise, timeoutPromise]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Roblox API timeout: User lookup took too long (10s)';
            console.error('Error fetching Roblox user:', errorMessage);
            return { success: false, error: errorMessage };
        }
        
        if (!robloxUser) {
            return { success: false, error: `Could not find Roblox user: ${username}. Please verify the username is correct.` };
        }

        // Fetch avatar with timeout (non-critical, so we continue even if it fails)
        let avatarUrl: string | null = null;
        try {
            const avatarUrlPromise = fetchRobloxAvatar(robloxUser.id);
            const avatarTimeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Avatar fetch timeout')), 10000)
            );
            avatarUrl = await Promise.race([avatarUrlPromise, avatarTimeoutPromise]);
        } catch (error) {
            console.warn('Avatar fetch failed or timed out, continuing without avatar:', error);
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
    const username = formData.get('username') as string;
    let day = formData.get('day') as 'saturday' | 'sunday';
    const tournament_type = formData.get('tournament_type') as 'all-day' | 'special' | null;
    
    if (!username) return;
    if (!day || (day !== 'saturday' && day !== 'sunday')) {
        // Default to saturday if not provided or invalid
        day = 'saturday';
    }

    const robloxUser = await fetchRobloxUser(username);
    if (!robloxUser) return;

    const avatarUrl = await fetchRobloxAvatar(robloxUser.id);

    const newPlayer: Player = {
        id: uuidv4(),
        robloxUserId: robloxUser.id.toString(),
        username: robloxUser.name,
        displayname: robloxUser.displayName,
        wins: 0,
        points: 0,
        avatarUrl: avatarUrl || '', // Fallback or placeholder
        createdAt: new Date().toISOString(),
        day: day,
        tournament_type: day === 'sunday' ? (tournament_type || 'all-day') : undefined, // Use provided tournament_type for Sunday, undefined for Saturday
    };

    await db.addPlayer(newPlayer);

    revalidatePath('/admin');
    revalidatePath('/leaderboard');
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
