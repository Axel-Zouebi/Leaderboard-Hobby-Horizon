'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '../lib/utils';

export function AdminDayTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentDay = searchParams.get('day') || 'saturday';

    const handleDayChange = (day: 'saturday' | 'sunday') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('day', day);
        router.push(`/admin?${params.toString()}`);
    };

    return (
        <div className="flex gap-2 mb-4">
            {(['saturday', 'sunday'] as const).map((day) => (
                <button
                    key={day}
                    onClick={() => handleDayChange(day)}
                    className={cn(
                        "px-4 py-2 rounded-lg font-medium transition-colors",
                        currentDay === day
                            ? "bg-blue-600 text-white"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                    )}
                >
                    {day === 'saturday' ? 'Saturday' : 'Sunday'}
                </button>
            ))}
        </div>
    );
}

