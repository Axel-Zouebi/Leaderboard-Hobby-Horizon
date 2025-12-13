'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { cn } from '../lib/utils';
import { Player } from '../lib/db';
import { Crown, Trophy } from 'lucide-react';

interface LeaderboardRowProps {
    player: Player;
    rank: number;
}

export function LeaderboardRow({ player, rank }: LeaderboardRowProps) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
                mass: 1
            }}
            className="bg-white flex items-center p-4 rounded-[2rem] shadow-sm mb-3 relative overflow-hidden"
            suppressHydrationWarning
        >
            <div className="flex items-center gap-4 w-full z-10">
                {/* Rank & Trend */}
                <div className="flex flex-col items-center w-8">
                    <span className="font-bold text-slate-800 text-lg">{rank}</span>
                    {/* Placeholder trend indicator - assuming neutral or random for demo if not in DB, 
                        but let's stick to a static down arrow or dash for >3 to match visual interest 
                        or just nothing. Image has small green/red arrows. 
                        Let's add a small red down arrow for 4th+ just to match the visual vibe of 'movement' 
                        or just a dash. Let's use a dash for simplicity unless requested. 
                        Actually image shows "4" with a red arrow down. 
                        I'll add a random visual indicator for "mock" purposes or static.
                        Let's make it static red for now to match the "4" in the image example. */}
                    <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-red-400 mt-1" />
                </div>

                {/* Avatar */}
                <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-slate-100">
                    <Image
                        src={player.avatarUrl || '/placeholder.svg'}
                        alt={player.username}
                        fill
                        unoptimized
                        sizes="48px"
                        className="object-cover"
                    />
                </div>

                {/* Name */}
                <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 leading-tight">
                        {player.displayname}
                    </h3>
                    <p className="text-xs text-slate-400">@{player.username}</p>
                </div>

                {/* Points and Wins */}
                <div className="text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                        <span className="text-blue-500 font-bold text-lg tabular-nums">
                            {player.points || 0}
                        </span>
                        <span className="text-xs text-slate-500">pts</span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <span className="text-amber-500">
                            <Trophy size={14} fill="currentColor" />
                        </span>
                        <div className="font-semibold text-slate-600 tabular-nums text-sm">
                            {player.wins || 0}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
