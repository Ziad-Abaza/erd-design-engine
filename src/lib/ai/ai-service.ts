/**
 * AI Service - Main service layer for AI operations
 * Provides unified interface with caching, context management, and queuing
 */

import { AIProvider, AIRequest, AIResponse, AIJob } from './types';
import { LocalAIProvider } from './providers/local-provider';
import { contextManager } from './context-manager';
import { cacheManager } from './cache-manager';
import { RequestQueue } from './request-queue';
import { tokenManager, ChunkedRequest } from './token-manager';
import { ModelDetector, ModelCapabilities } from './model-detector';

export class AIService {
  private provider: AIProvider;
  private queue: RequestQueue;
  private readonly enableCache: boolean;
  private readonly enableContextCompression: boolean;

  private providerPromise: Promise<AIProvider> | null = null;

  constructor(
    provider?: AIProvider,
    options: {
      enableCache?: boolean;
      enableContextCompression?: boolean;
      maxConcurrentRequests?: number;
    } = {}
  ) {
    // Initialize with a default provider to satisfy TypeScript
    const baseURL = process.env.AI_SERVER_URL || 'http://localhost:8000';
    this.provider = new LocalAIProvider(baseURL, process.env.AI_API_KEY, 300000);

    if (provider) {
      this.provider = provider;
    } else {
      // Initialize provider asynchronously
      this.providerPromise = this.createDefaultProvider();
      this.providerPromise.then(p => {
        this.provider = p;
      }).catch(err => {
        console.error('Failed to initialize AI provider:', err);
        // Fallback to basic provider
        this.provider = new LocalAIProvider(baseURL, process.env.AI_API_KEY, 300000);
      });
    }
    this.enableCache = options.enableCache ?? true;
    this.enableContextCompression = options.enableContextCompression ?? true;
    this.queue = new RequestQueue({
      maxConcurrent: options.maxConcurrentRequests ?? 3
    });
  }

  /**
   * Ensure provider is initialized
   */
  private async ensureProvider(): Promise<AIProvider> {
    if (this.provider) {
      return this.provider;
    }
    if (this.providerPromise) {
      return await this.providerPromise;
    }
    // Fallback
    const baseURL = process.env.AI_SERVER_URL || 'http://localhost:8000';
    this.provider = new LocalAIProvider(baseURL, process.env.AI_API_KEY, 300000);
    return this.provider;
  }

  /**
   * Create default provider from environment
   */
  private async createDefaultProvider(): Promise<AIProvider> {
    const baseURL = process.env.AI_SERVER_URL || 'http://localhost:8000';
    const apiKey = process.env.AI_API_KEY;

    // Detect model capabilities to set appropriate timeout
    // Try server first (only once, cached), fall back to environment detection
    let capabilities: ModelCapabilities;
    try {
      capabilities = await ModelDetector.detectFromServer(baseURL) || ModelDetector.detectFromEnv();
    } catch {
      // If detection fails, use environment-based detection
      capabilities = ModelDetector.detectFromEnv();
    }

    // Update token manager with detected limits
    tokenManager.setLimits({
      maxContextTokens: capabilities.maxContextTokens,
      maxInputTokens: Math.max(100, capabilities.maxContextTokens - 2000),
      safetyBuffer: capabilities.maxContextTokens <= 512 ? 50 : 1000
    });

    // Use longer timeout for small context models (they need more processing time)
    const defaultTimeout = capabilities.maxContextTokens <= 512 ? 300000 : 180000;
    const timeout = parseInt(process.env.AI_REQUEST_TIMEOUT || defaultTimeout.toString(), 10);

    // Only log if we have meaningful detection (not default/unknown)
    if (capabilities.name !== 'unknown' || process.env.AI_MODEL_NAME) {
      console.log(`[AI Service] Model: ${capabilities.name}, context: ${capabilities.maxContextTokens} tokens, timeout: ${timeout}ms`);
    }

    return new LocalAIProvider(baseURL, apiKey, timeout);
  }

  /**
   * Process AI request with caching, context compression, and token management
   */
  async processRequest(
    request: AIRequest,
    options: {
      useCache?: boolean;
      compressContext?: boolean;
      priority?: 'high' | 'medium' | 'low';
      background?: boolean;
      chunkLargeSchemas?: boolean;
    } = {}
  ): Promise<AIResponse> {
    if (process.env.AI_ENABLED === 'false' || process.env.NEXT_PUBLIC_AI_ENABLED === 'false') {
      throw new Error('AI features are currently disabled');
    }

    const useCache = options.useCache ?? this.enableCache;
    const compressContext = options.compressContext ?? this.enableContextCompression;
    const chunkLargeSchemas = options.chunkLargeSchemas ?? true;

    // Prepare request with token management
    const prepared = tokenManager.prepareRequest(request, {
      compressContext,
      chunkLargeSchemas
    });

    // Handle chunked requests (multi-step processing)
    if ('chunks' in prepared && prepared.requiresMultiStep) {
      return this.processChunkedRequest(prepared, useCache, options.priority || 'medium');
    }

    // Single request processing
    const finalRequest = prepared as AIRequest;

    // Validate token limits one more time
    const validation = tokenManager.validateRequest(finalRequest);
    if (!validation.valid && validation.adjusted) {
      console.warn('Token limit exceeded, using adjusted request:', validation.error);
      // Use adjusted request but continue processing
    }

    // Check cache
    if (useCache) {
      const cacheKey = cacheManager.createCacheKey(finalRequest);
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return {
          content: typeof cached === 'string' ? cached : JSON.stringify(cached),
          metadata: { cached: true }
        };
      }
    }

    // Process request (with queuing for background requests)
    if (options.background) {
      return this.processBackground(finalRequest, options.priority || 'medium');
    }

    const provider = await this.ensureProvider();
    const response = await this.queue.enqueue(
      () => provider.chat(finalRequest),
      options.priority || 'medium'
    );

    // Cache response
    if (useCache && response.content) {
      const cacheKey = cacheManager.createCacheKey(finalRequest);
      cacheManager.set(cacheKey, response.content);
    }

    return response;
  }

  /**
   * Process chunked request (multi-step for large schemas)
   */
  private async processChunkedRequest(
    chunked: ChunkedRequest,
    useCache: boolean,
    priority: 'high' | 'medium' | 'low'
  ): Promise<AIResponse> {
    const results: any[] = [];

    // Process each chunk
    for (const chunk of chunked.chunks) {
      try {
        // Check cache for each chunk
        let chunkResponse: AIResponse;
        const provider = await this.ensureProvider();

        if (useCache) {
          const cacheKey = cacheManager.createCacheKey(chunk);
          const cached = cacheManager.get(cacheKey);
          if (cached) {
            chunkResponse = {
              content: typeof cached === 'string' ? cached : JSON.stringify(cached),
              metadata: { cached: true }
            };
          } else {
            chunkResponse = await this.queue.enqueue(
              () => provider.chat(chunk),
              priority
            );
            // Cache chunk response
            cacheManager.set(cacheKey, chunkResponse.content);
          }
        } else {
          chunkResponse = await this.queue.enqueue(
            () => provider.chat(chunk),
            priority
          );
        }

        // Parse chunk result
        const extractJSON = (content: string) => {
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
        };

        const chunkData = extractJSON(chunkResponse.content);
        if (chunkData) {
          results.push(chunkData);
        }
      } catch (error: any) {
        console.error('Error processing chunk:', error);
        // Continue with other chunks
      }
    }

    // Merge results from all chunks
    const merged = this.mergeChunkResults(results);

    return {
      content: JSON.stringify(merged),
      metadata: {
        chunked: true,
        chunksProcessed: results.length,
        totalChunks: chunked.chunks.length
      }
    };
  }

  /**
   * Merge results from multiple chunks
   */
  private mergeChunkResults(results: any[]): any {
    if (results.length === 0) {
      return { summary: 'No results from chunked processing', recommendations: [], issues: [] };
    }

    if (results.length === 1) {
      return results[0];
    }

    // Merge recommendations
    const allRecommendations = results.flatMap(r => r.recommendations || []);
    const allIssues = results.flatMap(r => r.issues || []);
    const allInsights = results.flatMap(r => r.insights || []);

    // Combine summaries
    const summaries = results.map(r => r.summary).filter(Boolean);
    const combinedSummary = summaries.length > 0
      ? `Combined analysis from ${results.length} schema chunks:\n${summaries.join('\n\n')}`
      : 'Analysis completed across multiple schema chunks';

    return {
      summary: combinedSummary,
      recommendations: this.deduplicateRecommendations(allRecommendations),
      issues: this.deduplicateIssues(allIssues),
      insights: this.deduplicateInsights(allInsights),
      metrics: results[results.length - 1]?.metrics || {}
    };
  }

  /**
   * Deduplicate recommendations
   */
  private deduplicateRecommendations(recommendations: any[]): any[] {
    const seen = new Set<string>();
    return recommendations.filter(rec => {
      const key = `${rec.type}-${rec.description}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Deduplicate issues
   */
  private deduplicateIssues(issues: any[]): any[] {
    const seen = new Set<string>();
    return issues.filter(issue => {
      const key = `${issue.type}-${issue.category}-${issue.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Deduplicate insights
   */
  private deduplicateInsights(insights: any[]): any[] {
    const seen = new Set<string>();
    return insights.filter(insight => {
      const key = `${insight.category}-${insight.status}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Process request in background (non-blocking)
   */
  private async processBackground(
    request: AIRequest,
    priority: 'high' | 'medium' | 'low'
  ): Promise<AIResponse> {
    return new Promise((resolve, reject) => {
      const job: AIJob = {
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'background',
        request,
        priority,
        callback: resolve,
        errorCallback: reject,
        createdAt: Date.now()
      };

      // Execute in background
      this.ensureProvider().then(provider => {
        return this.queue.enqueue(
          () => provider.chat(request),
          priority
        );
      }).then(resolve).catch(reject);
    });
  }

  /**
   * Stream AI response
   */
  async *stream(
    request: AIRequest,
    options: {
      compressContext?: boolean;
    } = {}
  ): AsyncGenerator<string> {
    if (process.env.AI_ENABLED === 'false' || process.env.NEXT_PUBLIC_AI_ENABLED === 'false') {
      throw new Error('AI features are currently disabled');
    }

    const compressContext = options.compressContext ?? this.enableContextCompression;

    // Compress context if enabled
    if (compressContext && request.messages) {
      request.messages = request.messages.map(msg => {
        if (msg.role === 'user' && typeof msg.content === 'string' && msg.content.includes('Schema:')) {
          try {
            const schemaMatch = msg.content.match(/Schema:\s*({[\s\S]*?})(?:\n|$)/);
            if (schemaMatch) {
              const schema = JSON.parse(schemaMatch[1]);
              const compressed = contextManager.compressSchema(schema);
              msg.content = msg.content.replace(schemaMatch[0], `Schema: ${compressed}`);
            }
          } catch {
            // If compression fails, use original
          }
        }
        return msg;
      });
    }

    const provider = await this.ensureProvider();
    for await (const chunk of provider.stream(request)) {
      yield chunk.content;
      if (chunk.done) break;
    }
  }

  /**
   * Check if AI service is available
   */
  async isAvailable(): Promise<boolean> {
    const provider = await this.ensureProvider();
    return provider.isAvailable();
  }

  /**
   * Clear cache
   */
  clearCache(pattern?: string): void {
    cacheManager.clear(pattern);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheManager.getStats();
  }

  /**
   * Set provider
   */
  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}

