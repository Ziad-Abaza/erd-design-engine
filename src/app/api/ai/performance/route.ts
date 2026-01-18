import { NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai';
import { PromptManager } from '@/lib/ai/prompts';

export async function POST(req: Request) {
  if (process.env.AI_ENABLED === 'false' || process.env.NEXT_PUBLIC_AI_ENABLED === 'false') {
    return NextResponse.json({
      success: false,
      error: 'AI features are disabled',
      data: { summary: 'AI features are disabled', recommendations: [], metrics: { estimatedImprovement: '0%', riskLevel: 'none' } }
    }, { status: 403 });
  }

  try {
    const { schema, queryPatterns, dbType, nodes, edges, useCache, background, priority } = await req.json();

    const aiService = getAIService();

    // Build prompt using prompt manager
    const userPrompt = PromptManager.getPerformancePrompt({
      schema,
      nodes,
      edges,
      queryPatterns,
      dbType
    });

    const request = {
      messages: [
        {
          role: 'system' as const,
          content: PromptManager.getPerformanceSystemMessage()
        },
        {
          role: 'user' as const,
          content: userPrompt
        }
      ],
      temperature: 0.1, // Lower temperature for more structured outputs
      maxTokens: 2000,
      enableThinking: false
    };

    // Process request with caching, context compression, and token management
    const startTime = Date.now();
    let response: any;

    try {
      response = await aiService.processRequest(request, {
        useCache: useCache !== false, // Default to true
        compressContext: true,
        chunkLargeSchemas: true, // Enable chunking for large schemas
        priority: priority || 'medium',
        background: background === true
      });
    } catch (error: any) {
      console.error('AI Service Error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'AI service error',
        data: {
          summary: 'Unable to complete AI analysis. The schema may be too large or the AI service is unavailable.',
          recommendations: [],
          metrics: {
            estimatedImprovement: 'Unknown',
            riskLevel: 'medium'
          }
        },
        metadata: {
          processingTime: Date.now() - startTime,
          error: true
        }
      }, { status: 500 });
    }

    // Enhanced JSON extraction with better error handling
    const extractJSON = (content: string): any | null => {
      if (!content) return null;

      // Remove common conversational prefixes
      const conversationalPrefixes = [
        /^I'm an AI language model[^]*?However, I can give you[^]*?/i,
        /^I cannot directly analyze[^]*?However, I can[^]*?/i,
        /^As an AI[^]*?I can provide[^]*?/i
      ];

      let cleaned = content.trim();
      for (const pattern of conversationalPrefixes) {
        cleaned = cleaned.replace(pattern, '').trim();
      }

      // Try extracting from markdown code blocks
      const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/) ||
        cleaned.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (e) {
          console.warn('Failed to parse JSON from markdown block:', e);
        }
      }

      // Try to find JSON object in the text
      const jsonObjectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        try {
          return JSON.parse(jsonObjectMatch[0]);
        } catch (e) {
          console.warn('Failed to parse JSON object:', e);
        }
      }

      // Try parsing the entire content
      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.warn('Failed to parse content as JSON:', e);
        return null;
      }
    };

    const analysisResult = extractJSON(response.content);

    // Validate the result structure
    if (!analysisResult || typeof analysisResult !== 'object') {
      console.error('Invalid JSON response from AI:', response.content);
      return NextResponse.json({
        success: false,
        error: 'AI returned invalid JSON response',
        data: {
          summary: 'Unable to parse AI response. The model may have returned conversational text instead of JSON.',
          recommendations: [],
          metrics: {
            estimatedImprovement: 'Unknown',
            riskLevel: 'medium'
          },
          rawResponse: response.content?.substring(0, 500) // Include first 500 chars for debugging
        },
        metadata: {
          model: response.model || 'unknown',
          tokens: response.tokens?.total || 0,
          processingTime: Date.now() - startTime,
          cached: response.metadata?.cached || false
        }
      }, { status: 500 });
    }

    // Ensure required fields exist
    if (!analysisResult.summary) analysisResult.summary = 'Performance analysis completed';
    if (!Array.isArray(analysisResult.recommendations)) analysisResult.recommendations = [];
    if (!analysisResult.metrics) {
      analysisResult.metrics = {
        estimatedImprovement: 'Unable to quantify',
        riskLevel: 'medium'
      };
    }

    return NextResponse.json({
      success: true,
      data: analysisResult,
      metadata: {
        model: response.model || 'unknown',
        tokens: response.tokens?.total || 0,
        processingTime: Date.now() - startTime,
        cached: response.metadata?.cached || false
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

