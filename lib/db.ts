// lib/db.ts
import { supabase } from './supabaseClient';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');
const PENDING_DATA_FILE = path.join(process.cwd(), 'pending_data.json');

export interface Player {
    id: string;
    robloxUserId: string;
    username: string;
    wins: number;
    avatarUrl: string;
    createdAt: string;
}

export interface PendingWinner {
    username: string;
    wins: number;
}

// Helper to read local JSON
function readLocalData(): Player[] {
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
}

// Helper to write local JSON
function writeLocalData(data: Player[]) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper to read local Pending JSON
function readLocalPendingData(): PendingWinner[] {
    if (!fs.existsSync(PENDING_DATA_FILE)) {
        return [];
    }
    const data = fs.readFileSync(PENDING_DATA_FILE, 'utf-8');
    return JSON.parse(data);
}

// Helper to write local Pending JSON
function writeLocalPendingData(data: PendingWinner[]) {
    fs.writeFileSync(PENDING_DATA_FILE, JSON.stringify(data, null, 2));
}

export const db = {
    getPlayers: async (): Promise<Player[]> => {
        if (supabase) {
            const { data, error } = await supabase
                .from('players')
                .select('*')
                .order('wins', { ascending: false });
            if (error) throw error;
            return (data || []).map((p: any) => ({
                id: p.id,
                robloxUserId: p.roblox_user_id,
                username: p.username,
                wins: p.wins,
                avatarUrl: p.avatar_url,
                createdAt: p.created_at,
            }));
        } else {
            // Local fallback
            return readLocalData().sort((a, b) => b.wins - a.wins);
        }
    },

    getPendingWinners: async (): Promise<PendingWinner[]> => {
        if (supabase) {
            const { data, error } = await supabase
                .from('pending_winners')
                .select('*')
                .order('wins', { ascending: false });

            // If table doesn't exist or error, just return empty to avoid crashing app if user didn't migrate
            if (error) {
                console.warn('Supabase error fetching pending_winners (table might be missing):', error.message);
                return [];
            }

            return (data || []).map((p: any) => ({
                username: p.username,
                wins: p.wins,
            }));
        } else {
            return readLocalPendingData().sort((a, b) => b.wins - a.wins);
        }
    },

    incrementPendingWinner: async (username: string): Promise<void> => {
        if (supabase) {
            // Try to find existing
            const { data } = await supabase
                .from('pending_winners')
                .select('wins')
                .eq('username', username)
                .single();

            if (data) {
                await supabase
                    .from('pending_winners')
                    .update({ wins: data.wins + 1 })
                    .eq('username', username);
            } else {
                await supabase
                    .from('pending_winners')
                    .insert([{ username, wins: 1 }]);
            }
        } else {
            const pending = readLocalPendingData();
            const existing = pending.find(p => p.username === username);
            if (existing) {
                existing.wins++;
            } else {
                pending.push({ username, wins: 1 });
            }
            writeLocalPendingData(pending);
        }
    },

    removePendingWinner: async (username: string): Promise<void> => {
        if (supabase) {
            await supabase
                .from('pending_winners')
                .delete()
                .eq('username', username);
        } else {
            const pending = readLocalPendingData();
            const newPending = pending.filter(p => p.username !== username);
            writeLocalPendingData(newPending);
        }
    },

    addPlayer: async (player: Player): Promise<Player> => {
        if (supabase) {
            const { data, error } = await supabase
                .from('players')
                .insert([{
                    id: player.id,
                    roblox_user_id: player.robloxUserId,
                    username: player.username,
                    wins: player.wins,
                    avatar_url: player.avatarUrl,
                    created_at: player.createdAt
                }])
                .select()
                .single();
            if (error) throw error;
            return player; // Return input for simplicity, or map result
        } else {
            const players = readLocalData();
            players.push(player);
            writeLocalData(players);
            return player;
        }
    },

    updatePlayer: async (id: string, updates: Partial<Player>): Promise<void> => {
        if (supabase) {
            const dbUpdates: any = {};
            if (updates.wins !== undefined) dbUpdates.wins = updates.wins;
            if (updates.avatarUrl) dbUpdates.avatar_url = updates.avatarUrl;

            const { error } = await supabase
                .from('players')
                .update(dbUpdates)
                .eq('id', id);
            if (error) throw error;
        } else {
            const players = readLocalData();
            const index = players.findIndex(p => p.id === id);
            if (index !== -1) {
                players[index] = { ...players[index], ...updates };
                writeLocalData(players);
            }
        }
    },

    deletePlayer: async (id: string): Promise<void> => {
        if (supabase) {
            const { error } = await supabase.from('players').delete().eq('id', id);
            if (error) throw error;
        } else {
            const players = readLocalData();
            const newPlayers = players.filter(p => p.id !== id);
            writeLocalData(newPlayers);
        }
    }
};
