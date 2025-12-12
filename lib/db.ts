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
    displayname: string;
    wins: number;
    points: number;
    avatarUrl: string;
    createdAt: string;
    day: 'saturday' | 'sunday';
}

export interface PendingWinner {
    username: string;
    wins: number;
    points: number;
    day: 'saturday' | 'sunday';
}

// Helper to read local JSON with migration support
function readLocalData(): Player[] {
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    const players: any[] = JSON.parse(data);
    
    // Migration: Add day field if missing (default to saturday)
    // Migration: Add points field if missing (default to 0)
    let needsMigration = false;
    const migratedPlayers = players.map((player: any) => {
        const updates: any = {};
        if (!player.day) {
            needsMigration = true;
            updates.day = 'saturday' as const;
        }
        if (player.points === undefined) {
            needsMigration = true;
            updates.points = 0;
        }
        if (needsMigration && Object.keys(updates).length > 0) {
            return { ...player, ...updates };
        }
        return player;
    });
    
    // If migration was needed, write back the migrated data
    if (needsMigration) {
        writeLocalData(migratedPlayers);
    }
    
    return migratedPlayers;
}

// Helper to write local JSON
function writeLocalData(data: Player[]) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper to read local Pending JSON with migration support
function readLocalPendingData(): PendingWinner[] {
    if (!fs.existsSync(PENDING_DATA_FILE)) {
        return [];
    }
    const data = fs.readFileSync(PENDING_DATA_FILE, 'utf-8');
    const pending: any[] = JSON.parse(data);
    
    // Migration: Add day field if missing (default to saturday)
    // Migration: Add points field if missing (default to 0)
    let needsMigration = false;
    const migratedPending = pending.map((p: any) => {
        const updates: any = {};
        if (!p.day) {
            needsMigration = true;
            updates.day = 'saturday' as const;
        }
        if (p.points === undefined) {
            needsMigration = true;
            updates.points = 0;
        }
        if (needsMigration && Object.keys(updates).length > 0) {
            return { ...p, ...updates };
        }
        return p;
    });
    
    // If migration was needed, write back the migrated data
    if (needsMigration) {
        writeLocalPendingData(migratedPending);
    }
    
    return migratedPending;
}

// Helper to write local Pending JSON
function writeLocalPendingData(data: PendingWinner[]) {
    fs.writeFileSync(PENDING_DATA_FILE, JSON.stringify(data, null, 2));
}

export const db = {
    getPlayers: async (day?: 'saturday' | 'sunday'): Promise<Player[]> => {
        if (supabase) {
            let query = supabase
                .from('players')
                .select('*');
            
            if (day) {
                query = query.eq('day', day);
            }
            
            const { data, error } = await query.order('points', { ascending: false }).order('wins', { ascending: false });
            if (error) throw error;
            const players = (data || []).map((p: any) => ({
                id: p.id,
                robloxUserId: p.roblox_user_id,
                username: p.username,
                displayname: p.displayname,
                wins: p.wins || 0,
                points: p.points || 0,
                avatarUrl: p.avatar_url,
                createdAt: p.created_at,
                day: p.day || 'saturday', // Default to saturday for migration
            }));
            // Sort by points DESC, then wins DESC (Supabase order might not handle multiple sorts correctly)
            return players.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.wins - a.wins;
            });
        } else {
            // Local fallback
            let players = readLocalData();
            if (day) {
                players = players.filter(p => p.day === day);
            }
            return players.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.wins - a.wins;
            });
        }
    },

    getPendingWinners: async (day?: 'saturday' | 'sunday'): Promise<PendingWinner[]> => {
        if (supabase) {
            let query = supabase
                .from('pending_winners')
                .select('*');
            
            if (day) {
                query = query.eq('day', day);
            }
            
            const { data, error } = await query.order('wins', { ascending: false });

            // If table doesn't exist or error, just return empty to avoid crashing app if user didn't migrate
            if (error) {
                console.warn('Supabase error fetching pending_winners (table might be missing):', error.message);
                return [];
            }

            return (data || []).map((p: any) => ({
                username: p.username,
                wins: p.wins || 0,
                points: p.points || 0,
                day: p.day || 'saturday', // Default to saturday for migration
            }));
        } else {
            let pending = readLocalPendingData();
            if (day) {
                pending = pending.filter(p => p.day === day);
            }
            return pending.sort((a, b) => b.wins - a.wins);
        }
    },

    incrementPendingWinner: async (username: string, day: 'saturday' | 'sunday', wins: number = 0, points: number = 0): Promise<void> => {
        if (supabase) {
            // Try to find existing for this day
            const { data } = await supabase
                .from('pending_winners')
                .select('wins, points')
                .eq('username', username)
                .eq('day', day)
                .single();

            if (data) {
                await supabase
                    .from('pending_winners')
                    .update({ 
                        wins: (data.wins || 0) + wins,
                        points: (data.points || 0) + points
                    })
                    .eq('username', username)
                    .eq('day', day);
            } else {
                await supabase
                    .from('pending_winners')
                    .insert([{ username, wins, points, day }]);
            }
        } else {
            const pending = readLocalPendingData();
            const existing = pending.find(p => p.username === username && p.day === day);
            if (existing) {
                existing.wins = (existing.wins || 0) + wins;
                existing.points = (existing.points || 0) + points;
            } else {
                pending.push({ username, wins, points, day });
            }
            writeLocalPendingData(pending);
        }
    },

    removePendingWinner: async (username: string, day?: 'saturday' | 'sunday'): Promise<void> => {
        if (supabase) {
            let query = supabase
                .from('pending_winners')
                .delete()
                .eq('username', username);
            
            if (day) {
                query = query.eq('day', day);
            }
            
            await query;
        } else {
            const pending = readLocalPendingData();
            const newPending = day 
                ? pending.filter(p => !(p.username === username && p.day === day))
                : pending.filter(p => p.username !== username);
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
                    displayname: player.displayname,
                    wins: player.wins || 0,
                    points: player.points || 0,
                    avatar_url: player.avatarUrl,
                    created_at: player.createdAt,
                    day: player.day
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
            if (updates.points !== undefined) dbUpdates.points = updates.points;
            if (updates.avatarUrl) dbUpdates.avatar_url = updates.avatarUrl;
            if (updates.day) dbUpdates.day = updates.day;

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
    },

    getGameStatus: async (): Promise<string> => {
        if (supabase) {
            const { data, error } = await supabase
                .from('game_settings')
                .select('value')
                .eq('key', 'status')
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
                console.warn('Error fetching game status:', error);
            }
            return data?.value || 'STOP';
        } else {
            const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');
            if (!fs.existsSync(SETTINGS_FILE)) return 'STOP';
            try {
                const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
                return settings.status || 'STOP';
            } catch {
                return 'STOP';
            }
        }
    },

    setGameStatus: async (status: string): Promise<void> => {
        if (supabase) {
            // Upsert the status
            const { error } = await supabase
                .from('game_settings')
                .upsert({ key: 'status', value: status }, { onConflict: 'key' });

            if (error) throw error;
        } else {
            const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');
            let settings: any = {};
            if (fs.existsSync(SETTINGS_FILE)) {
                try {
                    settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
                } catch { }
            }
            settings.status = status;
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        }
    }
};
