'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '../lib/utils';

export function AdminDayTabs() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const currentDay = searchParams.get('day') || 'saturday';

    const handleDayChange = (day: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('day', day);
        // Preserve event parameter
        if (!params.get('event')) {
            params.set('event', 'hobby-horizon'); // Default to hobby-horizon for day tabs
        }
        // Remove tournament param when switching away from Sunday (only Sunday has tournament types)
        if (day !== 'sunday') {
            params.delete('tournament');
        }
        router.push(`/admin?${params.toString()}`);
    };

    // Default days for backward compatibility, but can be extended
    const days = ['saturday', 'sunday'];

    return (
        <div className="flex gap-2 mb-4 flex-wrap">
            {days.map((day) => (
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
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                </button>
            ))}
        </div>
    );
}

