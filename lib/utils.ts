import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Determines the current day of the weekend (Saturday or Sunday)
 * Returns null if it's not a weekend day
 */
export function getCurrentDay(): 'saturday' | 'sunday' | null {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (dayOfWeek === 6) return 'saturday';
    if (dayOfWeek === 0) return 'sunday';
    return null;
}

/**
 * Checks if the special tournament is currently active (1pm-2pm on Sunday)
 * @param date Optional date to check, defaults to current time
 * @returns true if it's Sunday between 1pm and 2pm
 */
export function isSpecialTournamentActive(date?: Date): boolean {
    const now = date || new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const hour = now.getHours();
    
    // Special tournament runs 1pm-2pm on Sunday
    return dayOfWeek === 0 && hour >= 13 && hour < 14;
}

/**
 * Determines the tournament type based on time or provided parameter
 * @param day The day of the tournament
 * @param tournament_type Optional explicit tournament type from request
 * @param date Optional date to check, defaults to current time
 * @returns 'all-day' | 'special'
 */
export function getTournamentType(
    day: 'saturday' | 'sunday',
    tournament_type?: 'all-day' | 'special',
    date?: Date
): 'all-day' | 'special' {
    // If explicit type provided, use it
    if (tournament_type) {
        return tournament_type;
    }
    
    // Saturday only has all-day tournament
    if (day === 'saturday') {
        return 'all-day';
    }
    
    // For Sunday, auto-detect based on time if no explicit type
    if (isSpecialTournamentActive(date)) {
        return 'special';
    }
    
    // Default to all-day
    return 'all-day';
}