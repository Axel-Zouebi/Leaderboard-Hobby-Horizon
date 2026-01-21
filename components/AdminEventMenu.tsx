'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Menu } from 'lucide-react';

const EVENTS = [
    { id: 'rvnc-jan-24th', name: 'RVNC Jan 24th' },
    { id: 'hobby-horizon', name: 'Hobby Horizon' },
] as const;

export function AdminEventMenu() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isHovered, setIsHovered] = useState(false);
    
    const currentEvent = searchParams.get('event') || 'rvnc-jan-24th';
    const currentEventName = EVENTS.find(e => e.id === currentEvent)?.name || 'RVNC Jan 24th';

    const handleEventChange = (eventId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('event', eventId);
        // Clear day and tournament params when switching events
        params.delete('day');
        params.delete('tournament');
        router.push(`/admin?${params.toString()}`);
        setIsHovered(false);
    };

    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hamburger Button */}
            <button
                className="p-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
                aria-label="Event menu"
            >
                <Menu className="w-6 h-6 text-white" />
            </button>

            {/* Dropdown Menu */}
            {isHovered && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden z-50">
                    {EVENTS.map((event) => (
                        <button
                            key={event.id}
                            onClick={() => handleEventChange(event.id)}
                            className={`w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center justify-between ${
                                currentEvent === event.id ? 'bg-slate-700 font-semibold' : ''
                            }`}
                        >
                            <span className="text-white">{event.name}</span>
                            {currentEvent === event.id && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
