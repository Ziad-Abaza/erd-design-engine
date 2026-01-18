"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Sparkles, Loader2, Settings } from 'lucide-react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { cn } from '@/lib/utils';
import { SettingsPanel } from './settings-panel';

const StatusBar: React.FC = () => {
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [aiStatusSummary, setAiStatusSummary] = useState<{
        overall: 'healthy' | 'warning' | 'critical';
        score: number;
        insights: Array<{ category: string; status: string; recommendation: string }>;
        nextSteps: string[];
    } | null>(null);
    const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(false);
    const [currentAiEnabled, setCurrentAiEnabled] = useState(true);

    const {
        validationResult,
        validationEnabled,
        runValidation,
        getValidationIssues,
        nodes,
        edges,
        aiEnabled
    } = useDiagramStore();

    // Listen for AI settings changes
    useEffect(() => {
        const handleAiEnabledChange = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.enabled === 'boolean') {
                setCurrentAiEnabled(event.detail.enabled);
            }
        };

        const handleSettingsChange = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.aiEnabled === 'boolean') {
                setCurrentAiEnabled(event.detail.aiEnabled);
            }
        };

        // Load initial setting
        try {
            const savedSettings = localStorage.getItem('erd-editor-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                setCurrentAiEnabled(settings.aiEnabled ?? true);
            }
        } catch (error) {
            console.error('Failed to load AI setting:', error);
        }

        window.addEventListener('aiEnabledChanged', handleAiEnabledChange as EventListener);
        window.addEventListener('settingsChanged', handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener('aiEnabledChanged', handleAiEnabledChange as EventListener);
            window.removeEventListener('settingsChanged', handleSettingsChange as EventListener);
        };
    }, []);

    // Initialize currentAiEnabled with store value
    useEffect(() => {
        setCurrentAiEnabled(aiEnabled);
    }, [aiEnabled]);

    // Get validation status for display
    const validationIssues = getValidationIssues();
    const hasErrors = validationIssues.some(issue => issue.type === 'error');
    const hasWarnings = validationIssues.some(issue => issue.type === 'warning');
    const validationScore = validationResult?.score || 100;

    const getValidationStatusIcon = () => {
        if (!validationEnabled) return null;
        if (hasErrors) return <XCircle className="w-4 h-4 text-red-500" />;
        if (hasWarnings) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    };

    const getValidationStatusText = () => {
        if (!validationEnabled) return 'Validation disabled';
        if (hasErrors) return `${validationIssues.filter(i => i.type === 'error').length} errors`;
        if (hasWarnings) return `${validationIssues.filter(i => i.type === 'warning').length} warnings`;
        return 'Valid';
    };

    const fetchAIStatusSummary = async () => {
        if (!currentAiEnabled) return;

        setIsLoadingAiSummary(true);
        try {
            const response = await fetch('/api/ai/status-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodes,
                    edges,
                    validationResults: validationIssues,
                    performanceMetrics: {}
                })
            });

            if (response.status === 403) {
                // Gracefully handle forbidden if it slips through (e.g. race condition)
                return;
            }

            const result = await response.json();
            if (result.success && result.data) {
                setAiStatusSummary(result.data);
            }
        } catch (error: any) {
            console.error('AI Status Summary Error:', error);
        } finally {
            setIsLoadingAiSummary(false);
        }
    };

    // Fetch AI summary when validation results change
    useEffect(() => {
        if (validationEnabled && validationResult && aiEnabled) {
            fetchAIStatusSummary();
        }
    }, [validationResult, validationEnabled, nodes, edges, aiEnabled]);

    return (
        <div className="fixed top-0 left-0 right-0 h-12 bg-card/95 backdrop-blur-sm border-b border-border z-40 flex items-center justify-between px-4">
            {/* Left side - App info */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <div className="text-sm font-semibold text-foreground">ERD Editor</div>
                    <div className="text-xs text-muted-foreground">v0.1</div>
                </div>

                {/* Document info */}
                <div className="text-xs text-muted-foreground">
                    {nodes.length} tables • {edges.length} relationships
                </div>
            </div>

            {/* Center - Validation Status */}
            {validationEnabled && (
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                        {getValidationStatusIcon()}
                        <span className="font-medium">{getValidationStatusText()}</span>
                        <span className="text-muted-foreground">Score: {validationScore}</span>

                        {aiStatusSummary && currentAiEnabled && (
                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded",
                                aiStatusSummary.overall === 'healthy' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                    aiStatusSummary.overall === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            )}>
                                AI: {aiStatusSummary.overall} ({aiStatusSummary.score})
                            </span>
                        )}
                    </div>

                    {/* AI Insights (compact) */}
                    {aiStatusSummary && aiStatusSummary.insights && aiStatusSummary.insights.length > 0 && currentAiEnabled && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {aiStatusSummary.insights.slice(0, 1).map((insight, idx) => (
                                <span key={idx}>
                                    <span className="font-medium">{insight.category}:</span> {insight.status}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-2 text-xs">
                        <button
                            onClick={runValidation}
                            className="text-muted-foreground hover:text-foreground"
                            title="Run validation"
                        >
                            Refresh
                        </button>
                        {currentAiEnabled && (
                        <button
                            onClick={fetchAIStatusSummary}
                            disabled={isLoadingAiSummary}
                            className="text-purple-600 hover:text-purple-800 disabled:opacity-50 flex items-center gap-1"
                            title="Refresh AI Summary"
                        >
                            {isLoadingAiSummary ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Sparkles className="w-3 h-3" />
                            )}
                        </button>
                    )}
                    </div>
                </div>
            )}

            {/* Right side - Quick actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        const event = new CustomEvent('openValidationPanel');
                        window.dispatchEvent(event);
                    }}
                    className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded text-xs font-medium transition-colors"
                >
                    Validation Details
                </button>

                <button
                    onClick={() => setShowSettingsPanel(true)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="Settings"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {/* Settings Panel */}
            <SettingsPanel
                isOpen={showSettingsPanel}
                onClose={() => setShowSettingsPanel(false)}
            />
        </div>
    );
};

export default StatusBar;
