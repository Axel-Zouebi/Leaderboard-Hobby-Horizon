import { getPlayers, getPendingWinners, addPlayerAction, deletePlayerAction, updateWinsAction, updatePointsAction, approvePendingWinnerAction } from '../../lib/actions';
import { db } from '@/lib/db';
import GameControl from '@/components/GameControl';
import { AdminDayTabs } from '@/components/AdminDayTabs';
import { AdminTournamentTabs } from '@/components/AdminTournamentTabs';
import { AdminEventMenu } from '@/components/AdminEventMenu';
import ApprovePendingButton from '@/components/ApprovePendingButton';
import Image from 'next/image';
import { Trash2, Plus, Minus, UserPlus } from 'lucide-react';
import { Suspense } from 'react';

// Simple inline button for speed/simplicity
function ActionButton({ action, children, variant = 'primary', ...props }: any) {
    return (
        <form action={action} className="inline-block">
            <button
                type="submit"
                className={`p-2 rounded-lg transition-colors ${variant === 'danger' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
                    variant === 'success' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' :
                        variant === 'secondary' ? 'bg-white/10 text-white hover:bg-white/20' :
                            'bg-blue-600 text-white hover:bg-blue-500'
                    }`}
                {...props}
            >
                {children}
            </button>
        </form>
    )
}

function AdminDayTabsWrapper() {
    return (
        <Suspense fallback={
            <div className="flex gap-2 mb-4">
                <div className="px-4 py-2 rounded-lg font-medium bg-white/10 text-white/70">Saturday</div>
                <div className="px-4 py-2 rounded-lg font-medium bg-white/10 text-white/70">Sunday</div>
            </div>
        }>
            <AdminDayTabs />
        </Suspense>
    );
}

function AdminTournamentTabsWrapper() {
    return (
        <Suspense fallback={
            <div className="flex gap-2 mb-4">
                <div className="px-4 py-2 rounded-lg font-medium bg-white/10 text-white/70">All Day</div>
                <div className="px-4 py-2 rounded-lg font-medium bg-white/10 text-white/70">Special (1pm)</div>
            </div>
        }>
            <AdminTournamentTabs />
        </Suspense>
    );
}

export default async function AdminPage({
    searchParams,
}: {
    searchParams?: Promise<{ day?: string; tournament?: string; event?: string }> | { day?: string; tournament?: string; event?: string };
}) {
    // In Next.js 16, searchParams is a Promise that needs to be awaited
    const params = searchParams instanceof Promise ? await searchParams : (searchParams || {});
    
    // Get event from URL params, default to 'rvnc-jan-24th'
    const event: string = params.event || 'rvnc-jan-24th';
    
    // Get day from URL params, default to current day
    const day: string = params.day || 'saturday';
    
    // Get tournament type from URL params, default to 'all-day'
    const tournamentParam = params.tournament;
    const tournament_type: 'all-day' | 'special' = (tournamentParam === 'special' ? 'special' : 'all-day');
    
    const players = await getPlayers(day, tournament_type, event);
    const pendingWinners = await getPendingWinners(day, tournament_type);

    return (
        <main className="min-h-screen bg-black text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                    <div className="flex items-center gap-4">
                        <AdminEventMenu />
                        <a href="/leaderboard" target="_blank" className="text-blue-400 hover:underline">
                            View Leaderboard →
                        </a>
                    </div>
                </header>

                {/* Game Control Section */}
                <GameControl initialStatus={await db.getGameStatus()} />

                {/* Day Selector - Only show for Hobby Horizon event */}
                {event === 'hobby-horizon' && (
                    <div className="glass-panel p-4">
                        <h2 className="text-lg font-semibold mb-4">Select Day</h2>
                        <AdminDayTabsWrapper />
                    </div>
                )}

                {/* Tournament Type Selector - Only show on Sunday for Hobby Horizon (backward compatibility) */}
                {event === 'hobby-horizon' && day === 'sunday' && (
                    <div className="glass-panel p-4">
                        <h2 className="text-lg font-semibold mb-4">Select Tournament Type</h2>
                        <AdminTournamentTabsWrapper />
                    </div>
                )}

                {/* Add Player Form */}
                <div className="glass-panel p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <UserPlus className="w-5 h-5" />
                        Add Player ({day.charAt(0).toUpperCase() + day.slice(1)}{day === 'sunday' ? ` - ${tournament_type === 'all-day' ? 'All Day' : 'Special'}` : ''})
                    </h2>
                    <form action={addPlayerAction} className="flex gap-4">
                        <input
                            name="username"
                            type="text"
                            placeholder="Roblox Username"
                            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        <input
                            name="day"
                            type="hidden"
                            value={day}
                        />
                        <input
                            name="event"
                            type="hidden"
                            value={event}
                        />
                        {day === 'sunday' && (
                            <input
                                name="tournament_type"
                                type="hidden"
                                value={tournament_type}
                            />
                        )}
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Add
                        </button>
                    </form>
                </div>

                {/* Pending Winners Section */}
                {pendingWinners.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-red-400 text-xl font-bold flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            Pending Approvals ({pendingWinners.length}) - {day.charAt(0).toUpperCase() + day.slice(1)}{day === 'sunday' ? ` (${tournament_type === 'all-day' ? 'All Day' : 'Special'})` : ''}
                        </h2>
                        {pendingWinners.map((pending) => (
                            <div key={`${pending.username}-${pending.day}`} className="glass p-4 rounded-xl flex items-center gap-4 border-l-4 border-l-red-500 bg-red-500/5">
                                <div className="h-12 w-12 rounded-full bg-red-900/50 flex items-center justify-center text-red-200 font-bold border border-red-500/30">
                                    ?
                                </div>

                                <div className="flex-1">
                                    <div className="font-semibold text-lg text-red-200">{pending.username}</div>
                                    <div className="text-sm text-red-400/70">
                                        Unregistered Wins: {pending.wins || 0} • Unregistered Points: {pending.points || 0} • Day: {pending.day.charAt(0).toUpperCase() + pending.day.slice(1)}{pending.day === 'sunday' ? ` • Tournament: ${(pending.tournament_type || 'all-day') === 'all-day' ? 'All Day' : 'Special'}` : ''}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="font-bold text-xl text-red-400 tabular-nums">
                                            +{pending.wins || 0} wins
                                        </div>
                                        <div className="font-bold text-lg text-red-300 tabular-nums">
                                            +{pending.points || 0} pts
                                        </div>
                                    </div>
                                    <ApprovePendingButton
                                        username={pending.username}
                                        day={pending.day}
                                        tournament_type={pending.tournament_type || 'all-day'}
                                        approveAction={approvePendingWinnerAction}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Player List */}
                <div className="space-y-4">
                    <h2 className="text-white/50 text-sm font-semibold uppercase tracking-wider">
                        Registered Players - {day.charAt(0).toUpperCase() + day.slice(1)}{day === 'sunday' ? ` (${tournament_type === 'all-day' ? 'All Day' : 'Special'})` : ''}
                    </h2>
                    {players.map((player) => (
                        <div key={player.id} className="glass p-4 rounded-xl flex items-center gap-4">
                            <div className="relative h-12 w-12 rounded-full overflow-hidden bg-gray-800">
                                {player.avatarUrl ? (
                                    <Image
                                        src={player.avatarUrl}
                                        alt={player.username}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                        No Avatar
                                    </div>
                                )}
                            </div>

                            <div className="flex-1">
                                <div className="font-semibold text-lg">{player.displayname || player.username}</div>
                                <div className="text-sm text-gray-400">
                                    @{player.username} • Wins: {player.wins || 0} • Points: {player.points || 0} • Day: {player.day.charAt(0).toUpperCase() + player.day.slice(1)}{player.day === 'sunday' ? ` • Tournament: ${(player.tournament_type || 'all-day') === 'all-day' ? 'All Day' : 'Special'}` : ''}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Wins Controls */}
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs text-gray-400">Wins</span>
                                    <div className="flex items-center gap-1">
                                        <ActionButton action={updateWinsAction.bind(null, player.id, -1)} variant="secondary">
                                            <Minus className="w-4 h-4" />
                                        </ActionButton>
                                        <div className="w-12 text-center font-bold text-lg tabular-nums">
                                            {player.wins || 0}
                                        </div>
                                        <ActionButton action={updateWinsAction.bind(null, player.id, 1)} variant="secondary">
                                            <Plus className="w-4 h-4" />
                                        </ActionButton>
                                    </div>
                                </div>

                                <div className="w-px h-8 bg-white/10 mx-2" />

                                {/* Points Controls */}
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs text-gray-400">Points</span>
                                    <div className="flex items-center gap-1">
                                        <ActionButton action={updatePointsAction.bind(null, player.id, -10)} variant="secondary">
                                            <Minus className="w-4 h-4" />
                                        </ActionButton>
                                        <div className="w-12 text-center font-bold text-lg tabular-nums">
                                            {player.points || 0}
                                        </div>
                                        <ActionButton action={updatePointsAction.bind(null, player.id, 10)} variant="secondary">
                                            <Plus className="w-4 h-4" />
                                        </ActionButton>
                                    </div>
                                </div>

                                <div className="w-px h-8 bg-white/10 mx-2" />

                                <ActionButton action={deletePlayerAction.bind(null, player.id)} variant="danger">
                                    <Trash2 className="w-4 h-4" />
                                </ActionButton>
                            </div>
                        </div>
                    ))}
                    {players.length === 0 && (
                        <div className="text-center text-gray-500 py-12">
                            No players added yet.
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
