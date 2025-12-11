import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET() {
    try {
        const status = await db.getGameStatus();
        return NextResponse.json({ status });
    } catch (error) {
        console.error('Error fetching game status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
