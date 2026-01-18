import { NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai';
import { PromptManager } from '@/lib/ai/prompts';
import { contextManager } from '@/lib/ai';

export async function POST(req: Request) {
  if (process.env.AI_ENABLED === 'false' || process.env.NEXT_PUBLIC_AI_ENABLED === 'false') {
    return NextResponse.json({
      success: false,
      error: 'AI features are disabled',
      data: { overall: 'warning', score: 0, insights: [], nextSteps: ['AI features are disabled'] }
    }, { status: 403 });
  }

  try {
    const { schema, validationResults, performanceMetrics, nodes, edges, useCache, background, priority } = await req.json();

    const aiService = getAIService();

    // Compress validation results and performance metrics for efficiency
    const compressedValidation = validationResults
      ? contextManager.compressValidationResults(validationResults)
      : validationResults;
    const compressedMetrics = performanceMetrics
      ? contextManager.compressPerformanceMetrics(performanceMetrics)
      : performanceMetrics;

    // Build prompt using prompt manager
    const userPrompt = PromptManager.getStatusSummaryPrompt({
      schema,
      nodes,
      edges,
      validationResults: compressedValidation,
      performanceMetrics: compressedMetrics
    });

    const request = {
      messages: [
        {
          role: 'system' as const,
          content: PromptManager.getStatusSummarySystemMessage()
        },
        {
          role: 'user' as const,
          content: userPrompt
        }
      ],
      temperature: 0.3,
      maxTokens: 1500,
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
        priority: priority || 'low', // Status summary is lower priority
        background: background === true
      });
    } catch (error: any) {
      console.error('AI Service Error:', error);
      // Return fallback response instead of throwing
      return NextResponse.json({
        success: false,
        error: error.message || 'AI service error',
        data: {
          overall: 'warning',
          score: 75,
          insights: [],
          nextSteps: ['Unable to generate AI summary. The schema may be too large or the AI service is unavailable.']
        },
        metadata: {
          processingTime: Date.now() - startTime,
          error: true
        }
      }, { status: 500 });
    }

    // Parse JSON response
    let summaryResult: any;
    try {
      const provider = (aiService as any).provider;
      const extractJSON = provider.extractJSON?.bind(provider) || ((content: string) => {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[1]);
          } catch {
            return null;
          }
        }
        try {
          return JSON.parse(content);
        } catch {
          return null;
        }
      });

      summaryResult = extractJSON(response.content);
    } catch (parseError: any) {
      console.error('JSON Parse Error:', parseError);
      summaryResult = null;
    }

    // Fallback if parsing fails
    if (!summaryResult) {
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
        model: response.model || 'unknown',
        tokens: response.tokens?.total || 0,
        processingTime: Date.now() - startTime,
        cached: response.metadata?.cached || false,
        chunked: response.metadata?.chunked || false,
        chunksProcessed: response.metadata?.chunksProcessed
      }
    });
  } catch (error: any) {
    console.error('AI Status Summary Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      data: {
        overall: 'warning',
        score: 75,
        insights: [],
        nextSteps: ['Unable to generate AI summary. Check AI server connection.']
      }
    }, { status: 500 });
  }
}

