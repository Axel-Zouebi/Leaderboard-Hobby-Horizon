'use server';

import { db, Player } from './db';
import { fetchRobloxUser, fetchRobloxAvatar, fetchBatchAvatars } from './roblox';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import { getCurrentDay } from './utils';


export async function getPlayers(day?: 'saturday' | 'sunday') {
    console.log('Fetching players...', day ? `for ${day}` : 'for all days');
    const players = await db.getPlayers(day);

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

export async function getPendingWinners(day?: 'saturday' | 'sunday') {
    return await db.getPendingWinners(day);
}

export async function approvePendingWinnerAction(username: string, day: 'saturday' | 'sunday') {
    // 1. Get the pending winner info to know how many wins and points they have
    const pendingList = await db.getPendingWinners(day);
    const pending = pendingList.find(p => p.username === username && p.day === day);
    if (!pending) return;

    // 2. Fetch Roblox Data
    const robloxUser = await fetchRobloxUser(username);
    if (!robloxUser) {
        console.error('Could not find Roblox user:', username);
        return; // Or throw error
    }
    const avatarUrl = await fetchRobloxAvatar(robloxUser.id);

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
    };

    await db.addPlayer(newPlayer);

    // 4. Remove from pending
    await db.removePendingWinner(username, day);

    revalidatePath('/admin');
    revalidatePath('/leaderboard');
}

export async function addPlayerAction(formData: FormData) {
    const username = formData.get('username') as string;
    let day = formData.get('day') as 'saturday' | 'sunday';
    
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
