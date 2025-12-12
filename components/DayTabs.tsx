'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '../lib/utils';

export function DayTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentDay = searchParams.get('day') || 'saturday';

    const handleDayChange = (day: 'saturday' | 'sunday') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('day', day);
        router.push(`/leaderboard?${params.toString()}`);
    };

    return (
        <div className="flex justify-between items-center bg-transparent px-2 mb-4">
            {(['saturday', 'sunday'] as const).map((day) => (
                <button
                    key={day}
                    onClick={() => handleDayChange(day)}
                    className="relative cursor-pointer group px-4 py-2"
                >
                    <span className={cn(
                        "font-bold text-sm tracking-wide transition-colors",
                        currentDay === day ? "text-slate-900" : "text-slate-300 group-hover:text-slate-500"
                    )}>
                        {day === 'saturday' ? 'SATURDAY' : 'SUNDAY'}
                    </span>
                    {currentDay === day && (
                        <div
                            className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-400 rounded-full mx-auto w-8"
                        />
                    )}
                </button>
            ))}
        </div>
    );
}

