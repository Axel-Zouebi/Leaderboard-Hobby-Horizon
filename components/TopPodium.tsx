'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Player } from '../lib/db';
import { Crown, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

interface TopPodiumProps {
    players: Player[];
}

export function TopPodium({ players }: TopPodiumProps) {
    if (players.length === 0) return null;

    // Ensure we have 3 slots (fill with placeholders if needed, though typically not for top 3 logic if <3 exist)
    // Layout expects: [2nd, 1st, 3rd]
    // Incoming is ordered by rank: [1st, 2nd, 3rd, ...]

    const first = players[0];
    const second = players[1];
    const third = players[2];

    return (
        <div className="flex justify-center items-end gap-2 sm:gap-4 mb-8 mt-4 w-full max-w-md mx-auto">
            {/* Second Place */}
            <PodiumItem player={second} rank={2} delay={0.2} />

            {/* First Place - Center and larger */}
            <PodiumItem player={first} rank={1} delay={0} />

            {/* Third Place */}
            <PodiumItem player={third} rank={3} delay={0.3} />
        </div>
    );
}

function PodiumItem({ player, rank, delay }: { player: Player | undefined, rank: number, delay: number }) {
    if (!player) {
        // Placeholder for missing rank if < 3 players
        return <div className="w-24 sm:w-28 opacity-0" />;
    }

    const isFirst = rank === 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: 'spring', stiffness: 300 }}
            className={cn(
                "flex flex-col items-center relative",
                isFirst ? "w-28 sm:w-32 -mt-8 z-10" : "w-24 sm:w-28"
            )}
        >
            {/* Crown for 1st */}
            {isFirst && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: 'spring' }}
                    className="absolute -top-10 text-yellow-400 drop-shadow-md"
                >
                    <Crown size={32} fill="currentColor" />
                </motion.div>
            )}

            {/* Rank Indicator */}
            <div className={cn(
                "font-bold mb-1",
                rank === 1 ? "text-green-500" : rank === 2 ? "text-green-500" : "text-green-500" // Image shows green arrows for all up? Or just colors? Image has "2" green arrow. Let's stick to rank number or arrow.
            )}>
                {/* Image just shows a number with a small arrow. Let's just show rank number for now above avatar. */}
                {/* Actually image has: "2" (green arrow up) above avatar. */}
                <div className="flex flex-col items-center">
                    <span className={cn(
                        "text-lg font-bold",
                        // Colors from image intuition
                        rank === 1 ? "text-slate-800" : "text-slate-800"
                    )}>
                        {rank}
                    </span>
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-green-500 mb-1" />
                </div>
            </div>

            {/* Avatar */}
            <div className={cn(
                "relative rounded-full p-1 bg-white shadow-lg",
                isFirst ? "w-24 h-24 sm:w-28 sm:h-28" : "w-20 h-20 sm:w-24 sm:h-24"
            )}>
                <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-100">
                    <Image
                        src={player.avatarUrl || '/placeholder.svg'} // Fallback
                        alt={player.username}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 96px, 128px"
                        className="object-cover"
                    />
                </div>
                {/* Decorative circle behind? Image has some gray circle pattern behind #1. We'll skip complex BG for now. */}
            </div>

            {/* Info */}
            <div className="text-center mt-3">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight truncate w-full px-1">
                    {player.displayname}
                </h3>
                <p className="text-xs text-slate-400 mb-1">@{player.username}</p>
                <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center justify-center gap-1 text-slate-800 font-bold">
                        <span className="text-blue-500 font-bold text-base tabular-nums">
                            {player.points || 0}
                        </span>
                        <span className="text-xs text-slate-500">pts</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-slate-600 font-semibold text-sm">
                        <span className="text-amber-500">
                            <Trophy size={10} fill="currentColor" />
                        </span>
                        {player.wins || 0}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
