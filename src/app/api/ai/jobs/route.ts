/**
 * Background Jobs API - For non-blocking AI operations
 */

import { NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai';
import { RequestQueue } from '@/lib/ai/request-queue';

// Store job status (in production, use Redis or database)
const jobStatus = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: number;
}>();

export async function POST(req: Request) {
  if (process.env.AI_ENABLED === 'false' || process.env.NEXT_PUBLIC_AI_ENABLED === 'false') {
    return NextResponse.json({ success: false, error: 'AI features are disabled' }, { status: 403 });
  }

  try {
    const { type, request, priority = 'medium' } = await req.json();

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize job status
    jobStatus.set(jobId, {
      status: 'pending',
      createdAt: Date.now()
    });

    // Process in background
    const aiService = getAIService();
    aiService.processRequest(request, {
      background: true,
      priority: priority || 'medium'
    }).then(result => {
      jobStatus.set(jobId, {
        status: 'completed',
        result,
        createdAt: jobStatus.get(jobId)!.createdAt
      });
    }).catch(error => {
      jobStatus.set(jobId, {
        status: 'failed',
        error: error.message,
        createdAt: jobStatus.get(jobId)!.createdAt
      });
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'pending'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (jobId) {
    const job = jobStatus.get(jobId);
    if (!job) {
      return NextResponse.json({
        success: false,
        error: 'Job not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      jobId,
      ...job
    });
  }

  // Get queue status
  const aiService = getAIService();
  const queue = (aiService as any).queue as RequestQueue;
  const queueStatus = queue.getStatus();

  return NextResponse.json({
    success: true,
    queue: queueStatus,
    cache: (aiService as any).getCacheStats()
  });
}

