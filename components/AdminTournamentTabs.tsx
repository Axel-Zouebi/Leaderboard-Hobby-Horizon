'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '../lib/utils';

export function AdminTournamentTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentTournament = searchParams.get('tournament') || 'all-day';

    const handleTournamentChange = (tournament: 'all-day' | 'special') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tournament', tournament);
        router.push(`/admin?${params.toString()}`);
    };

    return (
        <div className="flex gap-2 mb-4">
            {(['all-day', 'special'] as const).map((tournament) => (
                <button
                    key={tournament}
                    onClick={() => handleTournamentChange(tournament)}
                    className={cn(
                        "px-4 py-2 rounded-lg font-medium transition-colors",
                        currentTournament === tournament
                            ? "bg-blue-600 text-white"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                    )}
                >
                    {tournament === 'all-day' ? 'All Day' : 'Special (1pm)'}
                </button>
            ))}
        </div>
    );
}
