import { NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai';
import { PromptManager } from '@/lib/ai/prompts';

export async function POST(req: Request) {
  if (process.env.AI_ENABLED === 'false' || process.env.NEXT_PUBLIC_AI_ENABLED === 'false') {
    return NextResponse.json({
      success: false,
      error: 'AI features are disabled',
      data: { summary: 'AI features are disabled', issues: [] }
    }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Client-side validation to prevent 422 errors
    if (!body || typeof body !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body. Expected an object.',
        data: {
          summary: 'Request validation failed',
          issues: []
        }
      }, { status: 400 });
    }

    const { schema, validationRules, context, nodes, edges, useCache, background, priority } = body;

    // Validate required fields
    if (!nodes && !edges && !schema) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields. Provide at least one of: nodes, edges, or schema.',
        data: {
          summary: 'Request validation failed',
          issues: []
        }
      }, { status: 400 });
    }

    const aiService = getAIService();

    // Build prompt using prompt manager
    const userPrompt = PromptManager.getValidationPrompt({
      schema,
      nodes,
      edges,
      context,
      validationRules
    });

    const request = {
      messages: [
        {
          role: 'system' as const,
          content: PromptManager.getValidationSystemMessage()
        },
        {
          role: 'user' as const,
          content: userPrompt
        }
      ],
      temperature: 0.2,
      maxTokens: 3000,
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
          summary: 'Unable to complete AI validation. The schema may be too large or the AI service is unavailable.',
          issues: []
        },
        metadata: {
          processingTime: Date.now() - startTime,
          error: true
        }
      }, { status: 500 });
    }

    // Parse JSON response
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

    const analysisResult = extractJSON(response.content) || {
      summary: response.content || 'Validation analysis completed',
      issues: []
    };

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

