import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { schema, queryPatterns, dbType, nodes, edges } = await req.json();

    // Use chat completions API with a structured prompt for performance analysis
    const response = await fetch(`${process.env.AI_SERVER_URL || 'http://localhost:8000'}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a database performance expert. Analyze database schemas and provide structured JSON recommendations for optimization.'
          },
          {
            role: 'user',
            content: `Analyze this database schema for performance issues:

Schema: ${JSON.stringify(schema || { nodes, edges })}
Database Type: ${dbType || 'postgresql'}
${queryPatterns ? `Query Patterns: ${JSON.stringify(queryPatterns)}` : ''}

Focus on:
- Missing indexes on foreign keys
- Composite index opportunities
- Query optimization patterns
- Table partitioning candidates
- Normalization vs denormalization trade-offs

Return ONLY valid JSON in this exact format:
{
  "summary": "Overall performance assessment",
  "recommendations": [
    {
      "type": "index|query|schema|partition",
      "priority": "high|medium|low",
      "description": "Clear description of the recommendation",
      "impact": "Expected improvement or benefit",
      "sql": "Optional SQL statement to implement"
    }
  ],
  "metrics": {
    "estimatedImprovement": "e.g., 40-60% query speed improvement",
    "riskLevel": "low|medium|high"
  }
}`
          }
        ],
        enable_thinking: false,
        temperature: 0.3,
        max_tokens: 2000
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

    let analysisResult;
    try {
      analysisResult = JSON.parse(content);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      analysisResult = {
        summary: content || 'Performance analysis completed',
        recommendations: [],
        metrics: {
          estimatedImprovement: 'Unable to quantify',
          riskLevel: 'medium'
        }
      };
    }

    return NextResponse.json({
      success: true,
      data: analysisResult,
      metadata: {
        model: data.model || 'unknown',
        tokens: data.usage?.total_tokens || 0,
        processingTime: Date.now()
      }
    });
  } catch (error: any) {
    console.error('AI Performance Analysis Error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      data: {
        summary: 'Unable to complete AI analysis. Please check your AI server connection.',
        recommendations: [],
        metrics: {
          estimatedImprovement: 'Unknown',
          riskLevel: 'medium'
        }
      }
    }, { status: 500 });
  }
}

