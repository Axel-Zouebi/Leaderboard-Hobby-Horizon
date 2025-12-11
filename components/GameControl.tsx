'use client';

import { useState } from 'react';
import { Play, Square, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GameControlProps {
    initialStatus: string;
}

export default function GameControl({ initialStatus }: GameControlProps) {
    const [status, setStatus] = useState(initialStatus);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const toggleStatus = async (newStatus: 'START' | 'STOP') => {
        if (loading) return;
        setLoading(true);

        try {
            const res = await fetch('/api/game/control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) {
                throw new Error('Failed to update status');
            }

            const data = await res.json();
            setStatus(data.status);
            router.refresh();
        } catch (error) {
            console.error('Error updating game status:', error);
            alert('Failed to update game status');
        } finally {
            setLoading(false);
        }
    };

    const isRunning = status === 'START';

    return (
        <div className="glass-panel p-6 border-l-4 border-l-blue-500 bg-blue-500/5">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                Tournament Control
            </h2>

            <div className="flex items-center gap-6">
                <div className="flex-1">
                    <p className="text-gray-400 text-sm uppercase tracking-wider font-semibold mb-1">Current Status</p>
                    <div className={`text-2xl font-bold ${isRunning ? 'text-green-400' : 'text-red-400'}`}>
                        {isRunning ? 'RUNNING' : 'INTERMISSION (PAUSED)'}
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => toggleStatus('START')}
                        disabled={loading || isRunning}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all
                            ${isRunning
                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                            }`}
                    >
                        {loading && !isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                        START
                    </button>

                    <button
                        onClick={() => toggleStatus('STOP')}
                        disabled={loading || !isRunning}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all
                            ${!isRunning
                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
                            }`}
                    >
                        {loading && isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
                        STOP
                    </button>
                </div>
            </div>
        </div>
    );
}
