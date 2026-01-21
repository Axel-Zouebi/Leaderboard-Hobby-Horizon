import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Determines the current day of the week
 * Returns the day name as a lowercase string (e.g., 'monday', 'tuesday', etc.)
 * Can also accept a webhook-specified day parameter
 */
export function getCurrentDay(webhookDay?: string): string {
    if (webhookDay) {
        return webhookDay.toLowerCase();
    }
    
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayOfWeek];
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
 * @param day The day of the tournament (any day string)
 * @param tournament_type Optional explicit tournament type from request
 * @param date Optional date to check, defaults to current time
 * @returns 'all-day' | 'special'
 */
export function getTournamentType(
    day: string,
    tournament_type?: 'all-day' | 'special',
    date?: Date
): 'all-day' | 'special' {
    // If explicit type provided, use it
    if (tournament_type) {
        return tournament_type;
    }
    
    // For backward compatibility: Saturday only has all-day tournament
    if (day === 'saturday') {
        return 'all-day';
    }
    
    // For Sunday, auto-detect based on time if no explicit type
    if (day === 'sunday' && isSpecialTournamentActive(date)) {
        return 'special';
    }
    
    // Default to all-day for all other days
    return 'all-day';
}