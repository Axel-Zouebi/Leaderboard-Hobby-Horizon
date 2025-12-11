import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { status } = body;

        if (!status || (status !== 'START' && status !== 'STOP')) {
            return NextResponse.json({ error: 'Invalid status. Must be START or STOP' }, { status: 400 });
        }

        await db.setGameStatus(status);

        // Revalidate admin page so UI updates
        revalidatePath('/admin');

        return NextResponse.json({ success: true, status });
    } catch (error) {
        console.error('Error setting game status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
