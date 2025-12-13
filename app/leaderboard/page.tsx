import { getPlayers } from '../../lib/actions';
import { LeaderboardRow } from '../../components/LeaderboardRow';
import { TopPodium } from '../../components/TopPodium';
import { AutoRefresh } from '../../components/AutoRefresh';
import { DayTabs } from '../../components/DayTabs';
import { TournamentTabs } from '../../components/TournamentTabs';
import { getCurrentDay } from '../../lib/utils';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic'; // Ensure no caching for latest results
export const revalidate = 0;

function DayTabsWrapper() {
    return (
        <Suspense fallback={<div className="flex justify-between items-center bg-transparent px-2 mb-4">
            <div className="px-4 py-2"><span className="font-bold text-sm tracking-wide text-slate-300">SATURDAY</span></div>
            <div className="px-4 py-2"><span className="font-bold text-sm tracking-wide text-slate-300">SUNDAY</span></div>
        </div>}>
            <DayTabs />
        </Suspense>
    );
}

function TournamentTabsWrapper() {
    return (
        <Suspense fallback={<div className="flex justify-between items-center bg-transparent px-2 mb-4">
            <div className="px-4 py-2"><span className="font-bold text-sm tracking-wide text-slate-300">ALL DAY</span></div>
            <div className="px-4 py-2"><span className="font-bold text-sm tracking-wide text-slate-300">SPECIAL (1PM)</span></div>
        </div>}>
            <TournamentTabs />
        </Suspense>
    );
}

export default async function LeaderboardPage({
    searchParams,
}: {
    searchParams?: Promise<{ day?: string; tournament?: string }> | { day?: string; tournament?: string };
}) {
    // In Next.js 16, searchParams is a Promise that needs to be awaited
    const params = searchParams instanceof Promise ? await searchParams : (searchParams || {});
    
    // Get day from URL params, default to current day if weekend, otherwise saturday
    let day: 'saturday' | 'sunday' = 'saturday';
    const dayParam = params.day;
    
    if (dayParam === 'sunday') {
        day = 'sunday';
    } else if (dayParam === 'saturday') {
        day = 'saturday';
    } else {
        const currentDay = getCurrentDay();
        if (currentDay) {
            day = currentDay;
        }
    }

    // Get tournament type from URL params, default to 'all-day'
    const tournamentParam = params.tournament;
    const tournament_type: 'all-day' | 'special' = (tournamentParam === 'special' ? 'special' : 'all-day');

    const players = await getPlayers(day, tournament_type);

    // Split top 3 and the rest
    const topPlayers = players.slice(0, 3);
    const restPlayers = players.slice(3);

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 overflow-hidden relative">
            <AutoRefresh /> {/* Enable auto-refresh */}

            <div className="max-w-lg mx-auto h-full flex flex-col">
                <header className="mb-6 relative">
                    {/* Header with Back Arrow and Title */}
                    <div className="flex items-center justify-between mb-8">
                        <button className="p-2 rounded-full hover:bg-slate-200 transition-colors">
                            {/* ChevronLeft Icon mock */}
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h1 className="text-xl font-bold tracking-tight uppercase">Leaderboard</h1>
                        <div className="w-10" /> {/* Spacer for centering */}
                    </div>

                    {/* Day Tabs */}
                    <DayTabsWrapper />
                    
                    {/* Tournament Tabs - Only show on Sunday */}
                    {day === 'sunday' && <TournamentTabsWrapper />}
                </header>

                <div className="flex-1 flex flex-col">
                    {/* Podium for Top 3 */}
                    <TopPodium players={topPlayers} />

                    {/* List for the rest */}
                    <div className="flex-1 space-y-1 pb-10">
                        {restPlayers.map((player, index) => (
                            <LeaderboardRow
                                key={player.id}
                                player={player}
                                rank={index + 4} // Start at 4
                            />
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
