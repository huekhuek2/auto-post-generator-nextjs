import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
    try {
        const { id, password } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
        }

        // Simple password check
        // In a real app, use environment variables. For this scratchpad/demo, we allow a hardcoded fallback if env is missing, 
        // but we strongly prefer the env var. 
        // The user asked for "password input", so we match against a preset value.
        const CORRECT_PASSWORD = process.env.ADMIN_PASSWORD || '34627265';

        if (password !== CORRECT_PASSWORD) {
            return NextResponse.json({ error: 'Unauthorized: Incorrect Password' }, { status: 401 });
        }

        // Execute Delete
        await sql`DELETE FROM posts WHERE id = ${id}`;

        return NextResponse.json({ success: true, message: 'Post deleted successfully' });

    } catch (error) {
        console.error('Delete API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
