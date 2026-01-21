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
    day: string; // Flexible day support - can be any day name
    tournament_type?: 'all-day' | 'special'; // Optional for backward compatibility
    event?: string; // Event identifier (e.g., 'hobby-horizon', 'rvnc-jan-24th')
}

export interface PendingWinner {
    username: string;
    wins: number;
    points: number;
    day: string; // Flexible day support - can be any day name
    tournament_type?: 'all-day' | 'special'; // Optional for backward compatibility
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
    // Migration: Add tournament_type field if missing (default to all-day)
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
        if (player.tournament_type === undefined) {
            needsMigration = true;
            updates.tournament_type = 'all-day' as const;
        }
        if (Object.keys(updates).length > 0) {
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
    // Migration: Add tournament_type field if missing (default to all-day)
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
        if (p.tournament_type === undefined) {
            needsMigration = true;
            updates.tournament_type = 'all-day' as const;
        }
        if (Object.keys(updates).length > 0) {
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
    getPlayers: async (day?: string, tournament_type?: 'all-day' | 'special', event?: string): Promise<Player[]> => {
        if (supabase) {
            let query = supabase
                .from('players')
                .select('*');
            
            // Filter by event if provided
            // Note: If event column doesn't exist, this will fail and be caught by error handling below
            if (event) {
                if (event === 'hobby-horizon') {
                    // For hobby-horizon, include players with event='hobby-horizon' OR event is null (old players)
                    // Using PostgREST OR syntax: field.is.null,field.eq.value
                    query = query.or('event.is.null,event.eq.hobby-horizon');
                } else {
                    // For other events (like rvnc-jan-24th), only show players with that exact event
                    query = query.eq('event', event);
                }
            } else {
                // If no event specified, default to 'rvnc-jan-24th' for new tournaments
                query = query.eq('event', 'rvnc-jan-24th');
            }
            
            if (day) {
                query = query.eq('day', day);
            }
            
            if (tournament_type) {
                query = query.eq('tournament_type', tournament_type);
            } else if (day && day === 'sunday') {
                // For Sunday, if no tournament_type specified, default to all-day for backward compatibility
                // Only apply this if day is defined and is 'sunday'
                query = query.or('tournament_type.is.null,tournament_type.eq.all-day');
            }
            
            const { data, error } = await query.order('points', { ascending: false }).order('wins', { ascending: false });
            if (error) {
                // If event column doesn't exist, fall back to filtering without event
                const errorMessage = error.message || '';
                const errorCode = (error as any).code || '';
                if (errorMessage.includes('event') || errorMessage.includes('column') || errorCode === '42703' || errorCode === 'PGRST116') {
                    console.warn('[DB] Event column may not exist, falling back to no event filter:', errorMessage);
                    // Retry query without event filter
                    let fallbackQuery = supabase.from('players').select('*');
                    if (day) fallbackQuery = fallbackQuery.eq('day', day);
                    if (tournament_type) {
                        fallbackQuery = fallbackQuery.eq('tournament_type', tournament_type);
                    } else if (day && day === 'sunday') {
                        fallbackQuery = fallbackQuery.or('tournament_type.is.null,tournament_type.eq.all-day');
                    }
                    const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('points', { ascending: false }).order('wins', { ascending: false });
                    if (fallbackError) {
                        console.error('[DB] Fallback query also failed:', fallbackError);
                        throw fallbackError;
                    }
                    // Filter in memory for hobby-horizon (all old players) or return empty for rvnc-jan-24th
                    const filteredData = event === 'hobby-horizon' ? (fallbackData || []) : [];
                    console.log(`[DB] Fallback query returned ${filteredData.length} players for event ${event}`);
                    return (filteredData || []).map((p: any) => ({
                        id: p.id,
                        robloxUserId: p.roblox_user_id,
                        username: p.username,
                        displayname: p.displayname,
                        wins: p.wins || 0,
                        points: p.points || 0,
                        avatarUrl: p.avatar_url,
                        createdAt: p.created_at,
                        day: p.day || 'saturday',
                        tournament_type: p.tournament_type || 'all-day',
                        event: p.event || 'hobby-horizon',
                    })).sort((a, b) => {
                        if (b.points !== a.points) return b.points - a.points;
                        return b.wins - a.wins;
                    });
                }
                console.error('[DB] Query error:', error);
                throw error;
            }
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
                tournament_type: p.tournament_type || 'all-day', // Default to all-day for migration
                // If event is null/undefined, default based on what we're querying for
                // If we're querying hobby-horizon and event is null, it's an old player (hobby-horizon)
                // Otherwise, default to rvnc-jan-24th for new players
                event: p.event || (event === 'hobby-horizon' ? 'hobby-horizon' : 'rvnc-jan-24th'),
            }));
            // Sort by points DESC, then wins DESC (Supabase order might not handle multiple sorts correctly)
            return players.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.wins - a.wins;
            });
        } else {
            // Local fallback
            let players = readLocalData();
            
            // Filter by event if provided
            if (event) {
                if (event === 'hobby-horizon') {
                    // For hobby-horizon, include players with event='hobby-horizon' OR event is null/undefined (old players)
                    players = players.filter(p => !p.event || p.event === 'hobby-horizon');
                } else {
                    // For other events (like rvnc-jan-24th), only show players with that exact event
                    players = players.filter(p => p.event === event);
                }
            } else {
                // If no event specified, default to 'rvnc-jan-24th' for new tournaments
                players = players.filter(p => p.event === 'rvnc-jan-24th');
            }
            
            if (day) {
                players = players.filter(p => p.day === day);
            }
            if (tournament_type) {
                players = players.filter(p => (p.tournament_type || 'all-day') === tournament_type);
            } else if (day && day === 'sunday') {
                // For Sunday, if no tournament_type specified, default to all-day for backward compatibility
                // Only apply this if day is defined and is 'sunday'
                players = players.filter(p => !p.tournament_type || p.tournament_type === 'all-day');
            }
            return players.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.wins - a.wins;
            });
        }
    },

    getPendingWinners: async (day?: string, tournament_type?: 'all-day' | 'special', event?: string): Promise<PendingWinner[]> => {
        if (supabase) {
            let query = supabase
                .from('pending_winners')
                .select('*');
            
            // Filter by event if provided
            // Note: pending_winners might not have event column, so we'll handle errors gracefully
            if (event) {
                try {
                    if (event === 'hobby-horizon') {
                        // For hobby-horizon, include pending winners with event='hobby-horizon' OR event is null (old pending)
                        query = query.or('event.is.null,event.eq.hobby-horizon');
                    } else {
                        // For other events (like rvnc-jan-24th), only show pending winners with that exact event
                        query = query.eq('event', event);
                    }
                } catch (err) {
                    // If event column doesn't exist, fall back to showing all pending winners for hobby-horizon only
                    if (event !== 'hobby-horizon') {
                        // For new events, return empty if event column doesn't exist
                        return [];
                    }
                    // For hobby-horizon, continue without event filter
                }
            } else {
                // If no event specified, default to 'rvnc-jan-24th' - but since pending winners shouldn't exist for new events, return empty
                try {
                    query = query.eq('event', 'rvnc-jan-24th');
                } catch (err) {
                    // If event column doesn't exist, return empty for default event
                    return [];
                }
            }
            
            if (day) {
                query = query.eq('day', day);
            }
            
            if (tournament_type) {
                query = query.eq('tournament_type', tournament_type);
            } else if (day === 'sunday') {
                // For Sunday, if no tournament_type specified, default to all-day for backward compatibility
                query = query.or('tournament_type.is.null,tournament_type.eq.all-day');
            }
            
            const { data, error } = await query.order('wins', { ascending: false });

            // If table doesn't exist or error, just return empty to avoid crashing app if user didn't migrate
            if (error) {
                // If error is about event column, return empty for new events, or all for hobby-horizon
                if (error.message?.includes('event') || error.code === '42703') {
                    if (event === 'hobby-horizon') {
                        // Retry without event filter for hobby-horizon
                        let fallbackQuery = supabase.from('pending_winners').select('*');
                        if (day) fallbackQuery = fallbackQuery.eq('day', day);
                        if (tournament_type) {
                            fallbackQuery = fallbackQuery.eq('tournament_type', tournament_type);
                        } else if (day === 'sunday') {
                            fallbackQuery = fallbackQuery.or('tournament_type.is.null,tournament_type.eq.all-day');
                        }
                        const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('wins', { ascending: false });
                        if (fallbackError) {
                            console.warn('Supabase error fetching pending_winners (table might be missing):', fallbackError.message);
                            return [];
                        }
                        return (fallbackData || []).map((p: any) => ({
                            username: p.username,
                            wins: p.wins || 0,
                            points: p.points || 0,
                            day: p.day || 'saturday',
                            tournament_type: p.tournament_type || 'all-day',
                        }));
                    } else {
                        // For new events, return empty if event column doesn't exist
                        return [];
                    }
                }
                console.warn('Supabase error fetching pending_winners (table might be missing):', error.message);
                return [];
            }

            return (data || []).map((p: any) => ({
                username: p.username,
                wins: p.wins || 0,
                points: p.points || 0,
                day: p.day || 'saturday', // Default to saturday for migration
                tournament_type: p.tournament_type || 'all-day', // Default to all-day for migration
            }));
        } else {
            let pending = readLocalPendingData();
            
            // Filter by event if provided
            if (event) {
                if (event === 'hobby-horizon') {
                    // For hobby-horizon, include pending winners with event='hobby-horizon' OR event is null/undefined (old pending)
                    pending = pending.filter(p => !p.event || p.event === 'hobby-horizon');
                } else {
                    // For other events (like rvnc-jan-24th), only show pending winners with that exact event
                    pending = pending.filter(p => p.event === event);
                }
            } else {
                // If no event specified, default to 'rvnc-jan-24th' - return empty since pending shouldn't exist for new events
                pending = pending.filter(p => p.event === 'rvnc-jan-24th');
            }
            
            if (day) {
                pending = pending.filter(p => p.day === day);
            }
            if (tournament_type) {
                pending = pending.filter(p => (p.tournament_type || 'all-day') === tournament_type);
            } else if (day === 'sunday') {
                // For Sunday, if no tournament_type specified, default to all-day for backward compatibility
                pending = pending.filter(p => !p.tournament_type || p.tournament_type === 'all-day');
            }
            return pending.sort((a, b) => b.wins - a.wins);
        }
    },

    incrementPendingWinner: async (username: string, day: string, wins: number = 0, points: number = 0, tournament_type: 'all-day' | 'special' = 'all-day'): Promise<void> => {
        if (supabase) {
            // Try to find existing for this day and tournament_type
            const { data } = await supabase
                .from('pending_winners')
                .select('wins, points')
                .eq('username', username)
                .eq('day', day)
                .eq('tournament_type', tournament_type)
                .single();

            if (data) {
                await supabase
                    .from('pending_winners')
                    .update({ 
                        wins: (data.wins || 0) + wins,
                        points: (data.points || 0) + points
                    })
                    .eq('username', username)
                    .eq('day', day)
                    .eq('tournament_type', tournament_type);
            } else {
                await supabase
                    .from('pending_winners')
                    .insert([{ username, wins, points, day, tournament_type }]);
            }
        } else {
            const pending = readLocalPendingData();
            const existing = pending.find(p => p.username === username && p.day === day && (p.tournament_type || 'all-day') === tournament_type);
            if (existing) {
                existing.wins = (existing.wins || 0) + wins;
                existing.points = (existing.points || 0) + points;
            } else {
                pending.push({ username, wins, points, day, tournament_type });
            }
            writeLocalPendingData(pending);
        }
    },

    removePendingWinner: async (username: string, day?: string, tournament_type?: 'all-day' | 'special'): Promise<void> => {
        if (supabase) {
            let query = supabase
                .from('pending_winners')
                .delete()
                .eq('username', username);
            
            if (day) {
                query = query.eq('day', day);
            }
            
            if (tournament_type) {
                query = query.eq('tournament_type', tournament_type);
            }
            
            await query;
        } else {
            const pending = readLocalPendingData();
            const newPending = day 
                ? (tournament_type
                    ? pending.filter(p => !(p.username === username && p.day === day && (p.tournament_type || 'all-day') === tournament_type))
                    : pending.filter(p => !(p.username === username && p.day === day)))
                : pending.filter(p => p.username !== username);
            writeLocalPendingData(newPending);
        }
    },

    addPlayer: async (player: Player): Promise<Player> => {
        if (supabase) {
            const insertData: any = {
                id: player.id,
                roblox_user_id: player.robloxUserId,
                username: player.username,
                displayname: player.displayname,
                wins: player.wins || 0,
                points: player.points || 0,
                avatar_url: player.avatarUrl,
                created_at: player.createdAt,
                day: player.day,
                tournament_type: player.tournament_type || 'all-day',
            };
            
            // Only include event if column exists (will be added if migration runs)
            // If column doesn't exist, Supabase will ignore it
            if (player.event) {
                insertData.event = player.event;
            }
            
            const { data, error } = await supabase
                .from('players')
                .insert([insertData])
                .select()
                .single();
            if (error) {
                // If event column doesn't exist, try without it
                if (error.message?.includes('event') || error.code === '42703') {
                    console.warn('[DB] Event column may not exist, inserting without event field');
                    delete insertData.event;
                    const { data: retryData, error: retryError } = await supabase
                        .from('players')
                        .insert([insertData])
                        .select()
                        .single();
                    if (retryError) throw retryError;
                    return player; // Return input player with event field
                }
                throw error;
            }
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
            if (updates.tournament_type !== undefined) dbUpdates.tournament_type = updates.tournament_type;

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
