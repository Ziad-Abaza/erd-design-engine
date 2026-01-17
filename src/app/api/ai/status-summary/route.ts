import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { schema, validationResults, performanceMetrics, nodes, edges } = await req.json();

    // Use chat completions API with a structured prompt for status summary
    const response = await fetch(`${process.env.AI_SERVER_URL || 'http://localhost:8000'}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a database health expert. Analyze validation and performance data to provide a comprehensive health summary with actionable insights.'
          },
          {
            role: 'user',
            content: `Generate a comprehensive status summary for this database schema:

Schema: ${JSON.stringify(schema || { nodes, edges })}
Validation Results: ${JSON.stringify(validationResults || [])}
Performance Metrics: ${JSON.stringify(performanceMetrics || [])}

Analyze and provide:
- Overall health status
- Health score (0-100)
- Category-specific insights
- Prioritized next steps

Return ONLY valid JSON in this exact format:
{
  "overall": "healthy|warning|critical",
  "score": 0-100,
  "insights": [
    {
      "category": "category_name",
      "status": "status_description",
      "recommendation": "actionable_recommendation"
    }
  ],
  "nextSteps": [
    "Prioritized action item 1",
    "Prioritized action item 2"
  ]
}`
          }
        ],
        enable_thinking: false,
        temperature: 0.3,
        max_tokens: 1500
      }),
    });

    if (!response.ok) {
      throw new Error(`AI server responded with ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }

    let summaryResult;
    try {
      summaryResult = JSON.parse(content);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      summaryResult = {
        overall: 'warning',
        score: 75,
        insights: [],
        nextSteps: ['Review schema for potential improvements']
      };
    }

    return NextResponse.json({
      success: true,
      data: summaryResult,
      metadata: {
        model: data.model || 'unknown',
        tokens: data.usage?.total_tokens || 0,
        processingTime: Date.now()
      }
    });
  } catch (error: any) {
    console.error('AI Status Summary Error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      data: {
        overall: 'warning',
        score: 75,
        insights: [],
        nextSteps: ['Unable to generate AI summary. Check AI server connection.']
      }
    }, { status: 500 });
  }
}

