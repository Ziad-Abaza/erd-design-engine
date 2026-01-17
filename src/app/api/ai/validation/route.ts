import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { schema, validationRules, context, nodes, edges } = await req.json();

    // Use chat completions API with a structured prompt for validation analysis
    const response = await fetch(`${process.env.AI_SERVER_URL || 'http://localhost:8000'}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a database schema validation expert. Analyze schemas and provide structured JSON validation results with actionable recommendations.'
          },
          {
            role: 'user',
            content: `Validate this database schema for best practices:

Schema: ${JSON.stringify(schema || { nodes, edges })}
${context ? `Context: ${context}` : ''}
${validationRules ? `Validation Rules: ${JSON.stringify(validationRules)}` : ''}

Check for:
- Naming convention violations
- Missing primary keys
- Orphaned foreign keys
- Data type inconsistencies
- Normalization issues
- Referential integrity problems
- Best practice violations

Return ONLY valid JSON in this exact format:
{
  "summary": "Validation summary",
  "issues": [
    {
      "id": "unique-issue-id",
      "type": "error|warning|info",
      "category": "schema|naming|integrity|performance|normalization",
      "title": "Brief issue title",
      "description": "Detailed description",
      "location": {
        "table": "table_name",
        "column": "column_name"
      },
      "suggestions": [
        {
          "action": "action_description",
          "sql": "Optional SQL fix",
          "automated": true|false
        }
      ],
      "confidence": 0.0-1.0
    }
  ]
}`
          }
        ],
        enable_thinking: false,
        temperature: 0.2,
        max_tokens: 3000
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
        summary: content || 'Validation analysis completed',
        issues: []
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
    console.error('AI Validation Analysis Error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      data: {
        summary: 'Unable to complete AI validation. Please check your AI server connection.',
        issues: []
      }
    }, { status: 500 });
  }
}

