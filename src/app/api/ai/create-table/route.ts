import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    if (process.env.AI_ENABLED === 'false' || process.env.NEXT_PUBLIC_AI_ENABLED === 'false') {
        return NextResponse.json({ error: 'AI features are disabled' }, { status: 403 });
    }

    try {
        const { prompt, currentSchema } = await req.json();

        // Get timeout from environment or use default (5 minutes for large requests)
        const timeout = parseInt(process.env.AI_REQUEST_TIMEOUT || '300000', 10);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${process.env.AI_SERVER_URL || 'http://localhost:8000'}/api/create-table`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    current_schema: currentSchema || ''
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`AI server responded with ${response.status}`);
            }

            const data = await response.json();
            return NextResponse.json(data);
        } catch (fetchError: any) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms. The AI server may be processing a large request.`);
            }
            throw fetchError;
        }
    } catch (error: any) {
        console.error('AI Create Table Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
