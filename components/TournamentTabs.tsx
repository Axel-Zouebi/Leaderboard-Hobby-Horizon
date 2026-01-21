'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '../lib/utils';

export function TournamentTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentTournament = searchParams.get('tournament') || 'all-day';

    const handleTournamentChange = (tournament: 'all-day' | 'special') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tournament', tournament);
        // Preserve event parameter
        if (!params.get('event')) {
            params.set('event', 'hobby-horizon'); // Default to hobby-horizon for tournament tabs
        }
        router.push(`/leaderboard?${params.toString()}`);
    };

    return (
        <div className="flex justify-between items-center bg-transparent px-2 mb-4">
            {(['all-day', 'special'] as const).map((tournament) => (
                <button
                    key={tournament}
                    onClick={() => handleTournamentChange(tournament)}
                    className="relative cursor-pointer group px-4 py-2"
                >
                    <span className={cn(
                        "font-bold text-sm tracking-wide transition-colors",
                        currentTournament === tournament ? "text-slate-900" : "text-slate-300 group-hover:text-slate-500"
                    )}>
                        {tournament === 'all-day' ? 'ALL DAY' : 'SPECIAL (1PM)'}
                    </span>
                    {currentTournament === tournament && (
                        <div
                            className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-400 rounded-full mx-auto w-8"
                        />
                    )}
                </button>
            ))}
        </div>
    );
}
