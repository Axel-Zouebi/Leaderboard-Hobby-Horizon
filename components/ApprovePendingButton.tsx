'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

interface ApprovePendingButtonProps {
    username: string;
    day: string;
    tournament_type: 'all-day' | 'special';
    approveAction: (username: string, day: string, tournament_type: 'all-day' | 'special') => Promise<{ success: boolean; error?: string }>;
}

export default function ApprovePendingButton({ 
    username, 
    day, 
    tournament_type, 
    approveAction 
}: ApprovePendingButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Clear error after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleApprove = async () => {
        if (loading) return;
        
        setLoading(true);
        setError(null);

        try {
            // Show a message that this might take a while
            console.log(`Starting approval for ${username}... This may take 20-30 seconds due to Roblox API delays.`);
            
            const result = await approveAction(username, day, tournament_type);
            if (result.success) {
                // Refresh the page to show updated data
                router.refresh();
            } else {
                setError(result.error || 'Failed to approve player');
                // Still refresh to see current state after a delay
                setTimeout(() => {
                    router.refresh();
                }, 1500);
            }
        } catch (err) {
            console.error('Error approving pending winner:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to approve player';
            setError(errorMessage);
            // Still refresh to see current state after a delay
            setTimeout(() => {
                router.refresh();
            }, 1500);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={handleApprove}
                disabled={loading}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
                    loading
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }`}
                title={loading ? 'Processing...' : 'Approve and register player'}
            >
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <CheckCircle className="w-5 h-5" />
                )}
                <span className="sr-only">Approve</span>
            </button>
            {error && (
                <span className="text-xs text-red-400 max-w-[150px] text-right break-words" title={error}>
                    {error.length > 30 ? `${error.substring(0, 30)}...` : error}
                </span>
            )}
        </div>
    );
}
