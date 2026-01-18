import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  if (process.env.AI_ENABLED === 'false' || process.env.NEXT_PUBLIC_AI_ENABLED === 'false') {
    return NextResponse.json({ error: 'AI features are disabled' }, { status: 403 });
  }

  try {
    const erdState = await req.json();

    const response = await fetch(`${process.env.AI_SERVER_URL || 'http://localhost:8000'}/api/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(erdState),
    });

    if (!response.ok) {
      throw new Error(`AI server responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('AI Suggestion Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
