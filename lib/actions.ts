'use server';

import { db, Player } from './db';
import { fetchRobloxUser, fetchRobloxAvatar, fetchBatchAvatars } from './roblox';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';


export async function getPlayers() {
    console.log('Fetching players...');
    const players = await db.getPlayers();

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

export async function getPendingWinners() {
    return await db.getPendingWinners();
}

export async function approvePendingWinnerAction(username: string) {
    // 1. Get the pending winner info to know how many wins they have
    const pendingList = await db.getPendingWinners();
    const pending = pendingList.find(p => p.username === username);
    if (!pending) return;

    // 2. Fetch Roblox Data
    const robloxUser = await fetchRobloxUser(username);
    if (!robloxUser) {
        console.error('Could not find Roblox user:', username);
        return; // Or throw error
    }
    const avatarUrl = await fetchRobloxAvatar(robloxUser.id);

    // 3. Create real player
    const newPlayer: Player = {
        id: uuidv4(),
        robloxUserId: robloxUser.id.toString(),
        username: robloxUser.name,
        displayname: robloxUser.displayName,
        wins: pending.wins, // Use accrued wins
        avatarUrl: avatarUrl || '',
        createdAt: new Date().toISOString(),
    };

    await db.addPlayer(newPlayer);

    // 4. Remove from pending
    await db.removePendingWinner(username);

    revalidatePath('/admin');
    revalidatePath('/leaderboard');
}

export async function addPlayerAction(formData: FormData) {
    const username = formData.get('username') as string;
    if (!username) return;

    const robloxUser = await fetchRobloxUser(username);
    if (!robloxUser) return;

    const avatarUrl = await fetchRobloxAvatar(robloxUser.id);

    const newPlayer: Player = {
        id: uuidv4(),
        robloxUserId: robloxUser.id.toString(),
        username: robloxUser.name,
        displayname: robloxUser.displayName,
        wins: 0,
        avatarUrl: avatarUrl || '', // Fallback or placeholder
        createdAt: new Date().toISOString(),
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

    const newWins = Math.max(0, player.wins + increment);
    await db.updatePlayer(id, { wins: newWins });
    revalidatePath('/admin');
    revalidatePath('/leaderboard');
}
