import { getPlayers } from '../../lib/actions';
import { LeaderboardRow } from '../../components/LeaderboardRow';
import { TopPodium } from '../../components/TopPodium';
import { AutoRefresh } from '../../components/AutoRefresh'; // Import AutoRefresh
import { cn } from '../../lib/utils';

export const dynamic = 'force-dynamic'; // Ensure no caching for latest results
export const revalidate = 0;

export default async function LeaderboardPage() {
    const players = await getPlayers();

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

                    {/* Tabs */}
                    <div className="flex justify-between items-center bg-transparent px-2 mb-4">
                        {['Today', 'Week', 'All Time'].map((tab, i) => (
                            <div key={tab} className="relative cursor-pointer group px-4 py-2">
                                <span className={cn(
                                    "font-bold text-sm tracking-wide transition-colors",
                                    i === 0 ? "text-slate-900" : "text-slate-300 group-hover:text-slate-500"
                                )}>
                                    {tab.toUpperCase()}
                                </span>
                                {i === 0 && (
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-400 rounded-full mx-auto w-8"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
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
