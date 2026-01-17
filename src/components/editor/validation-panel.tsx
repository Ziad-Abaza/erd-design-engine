"use client"

import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X, ChevronDown, ChevronUp, Zap, Settings, Lightbulb, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDiagramStore } from '@/store/use-diagram-store';
import { ValidationEngine, ValidationIssue, ValidationSeverity, ValidationCategory, NormalizationSuggestion } from '@/lib/validation-engine';

const severityIcons = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
};

const severityColors = {
    error: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    info: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
};

const categoryIcons = {
    schema: Settings,
    naming: Settings,
    performance: Zap,
    integrity: CheckCircle,
    normalization: Lightbulb
};

const categoryColors = {
    schema: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    naming: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    performance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    integrity: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    normalization: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
};

interface ValidationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ValidationPanel({ isOpen, onClose }: ValidationPanelProps) {
    const [validationResult, setValidationResult] = useState<ReturnType<typeof ValidationEngine.validateDiagram> | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<ValidationCategory | 'all'>('all');
    const [selectedSeverity, setSelectedSeverity] = useState<ValidationSeverity | 'all'>('all');
    const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
    const [autoFixing, setAutoFixing] = useState<string | null>(null);
    const [normalizationSuggestions, setNormalizationSuggestions] = useState<NormalizationSuggestion[]>([]);
    const [aiValidation, setAiValidation] = useState<{
        summary: string;
        issues: Array<{
            id: string;
            type: 'error' | 'warning' | 'info';
            category: string;
            title: string;
            description: string;
            location?: { table?: string; column?: string };
            suggestions?: Array<{ action: string; sql?: string; automated: boolean }>;
            confidence: number;
        }>;
    } | null>(null);
    const [isAiValidating, setIsAiValidating] = useState(false);
    const [aiValidationError, setAiValidationError] = useState<string | null>(null);
    const [showAiIssues, setShowAiIssues] = useState(true);

    const nodes = useDiagramStore(state => state.nodes);
    const edges = useDiagramStore(state => state.edges);
    const selectNode = useDiagramStore(state => state.selectNode);
    const createIndex = useDiagramStore(state => state.createIndex);
    const updateColumnProperties = useDiagramStore(state => state.updateColumnProperties);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isOpen) {
            // Debounce validation runs to prevent UI stutter during rapid changes
            timeout = setTimeout(() => {
                runValidation();
            }, 500);
        }
        return () => clearTimeout(timeout);
    }, [isOpen, nodes, edges]);

    const runValidation = () => {
        const result = ValidationEngine.validateDiagram(nodes, edges);
        setValidationResult(result);

        const suggestions = ValidationEngine.generateNormalizationSuggestions(nodes, edges);
        setNormalizationSuggestions(suggestions);
    };

    const runAIValidation = async () => {
        setIsAiValidating(true);
        setAiValidationError(null);
        
        try {
            const response = await fetch('/api/ai/validation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodes,
                    edges
                })
            });

            const result = await response.json();
            
            if (result.success && result.data) {
                setAiValidation(result.data);
            } else {
                setAiValidationError(result.error || 'Failed to get AI validation');
                // Fallback to showing partial data if available
                if (result.data) {
                    setAiValidation(result.data);
                }
            }
        } catch (error: any) {
            console.error('AI Validation Error:', error);
            setAiValidationError(error.message || 'Failed to connect to AI service');
        } finally {
            setIsAiValidating(false);
        }
    };

    const filteredIssues = useMemo(() => {
        if (!validationResult) return [];

        return validationResult.issues.filter(issue => {
            const categoryMatch = selectedCategory === 'all' || issue.category === selectedCategory;
            const severityMatch = selectedSeverity === 'all' || issue.type === selectedSeverity;
            return categoryMatch && severityMatch;
        });
    }, [validationResult, selectedCategory, selectedSeverity]);

    const toggleIssueExpansion = (issueId: string) => {
        setExpandedIssues(prev => {
            const newSet = new Set(prev);
            if (newSet.has(issueId)) {
                newSet.delete(issueId);
            } else {
                newSet.add(issueId);
            }
            return newSet;
        });
    };

    const handleAutoFix = async (issue: ValidationIssue) => {
        if (!issue.autoFixable || !issue.fixAction) return;

        setAutoFixing(issue.id);
        try {
            // Handle specific auto-fix actions
            if (issue.category === 'performance' && issue.columnId && issue.tableId) {
                if (issue.type === 'warning' && issue.title.includes('Unindexed foreign key')) {
                    // Auto-add index to foreign key
                    updateColumnProperties(issue.tableId, issue.columnId, { isIndexed: true });
                }
            }

            // Run validation again after fix
            setTimeout(runValidation, 100);
        } finally {
            setAutoFixing(null);
        }
    };

    const handleSelectTable = (tableId: string) => {
        selectNode(tableId);
        onClose();
    };

    const getQualityScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600';
        if (score >= 70) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getQualityScoreLabel = (score: number) => {
        if (score >= 90) return 'Excellent';
        if (score >= 70) return 'Good';
        if (score >= 50) return 'Fair';
        return 'Poor';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold">Schema Validation</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Analyze your database schema for issues and improvements
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Quality Score */}
                {validationResult && (
                    <div className="p-6 border-b">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <div className={cn("text-3xl font-bold", getQualityScoreColor(validationResult.score))}>
                                        {validationResult.score}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {getQualityScoreLabel(validationResult.score)}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <span className="text-sm">{validationResult.summary.errors} Errors</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                        <span className="text-sm">{validationResult.summary.warnings} Warnings</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                        <span className="text-sm">{validationResult.summary.info} Info</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={runValidation}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                >
                                    Re-run Validation
                                </button>
                                <button
                                    onClick={runAIValidation}
                                    disabled={isAiValidating}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isAiValidating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            AI Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            AI Analysis
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="p-4 border-b flex gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Category:</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as ValidationCategory | 'all')}
                            className="px-3 py-1 border rounded-md text-sm bg-background"
                        >
                            <option value="all">All Categories</option>
                            <option value="schema">Schema</option>
                            <option value="naming">Naming</option>
                            <option value="performance">Performance</option>
                            <option value="integrity">Integrity</option>
                            <option value="normalization">Normalization</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Severity:</label>
                        <select
                            value={selectedSeverity}
                            onChange={(e) => setSelectedSeverity(e.target.value as ValidationSeverity | 'all')}
                            className="px-3 py-1 border rounded-md text-sm bg-background"
                        >
                            <option value="all">All Severities</option>
                            <option value="error">Errors</option>
                            <option value="warning">Warnings</option>
                            <option value="info">Info</option>
                        </select>
                    </div>
                </div>

                {/* AI Validation Error */}
                {aiValidationError && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                        {aiValidationError}
                    </div>
                )}

                {/* AI Validation Summary */}
                {aiValidation && aiValidation.summary && (
                    <div className="mx-6 mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                            <h3 className="font-semibold text-purple-900">AI Validation Summary</h3>
                            <button
                                onClick={() => setShowAiIssues(!showAiIssues)}
                                className="ml-auto text-xs text-purple-700 hover:text-purple-900"
                            >
                                {showAiIssues ? 'Hide' : 'Show'} AI Issues
                            </button>
                        </div>
                        <p className="text-sm text-purple-800">{aiValidation.summary}</p>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* AI Validation Issues */}
                        {showAiIssues && aiValidation && aiValidation.issues && aiValidation.issues.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                    AI-Detected Issues ({aiValidation.issues.length})
                                </h3>
                                <div className="space-y-2">
                                    {aiValidation.issues.map(issue => {
                                        const Icon = severityIcons[issue.type];
                                        const CategoryIcon = categoryIcons[issue.category as ValidationCategory] || Settings;
                                        const isExpanded = expandedIssues.has(issue.id);

                                        return (
                                            <div
                                                key={issue.id}
                                                className={cn(
                                                    "border rounded-lg p-4 transition-all",
                                                    severityColors[issue.type]
                                                )}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-medium">{issue.title}</h4>
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded-full text-xs font-medium",
                                                                    categoryColors[issue.category as ValidationCategory] || categoryColors.schema
                                                                )}>
                                                                    <CategoryIcon className="w-3 h-3 inline mr-1" />
                                                                    {issue.category}
                                                                </span>
                                                                <span className="text-xs text-gray-500">
                                                                    Confidence: {(issue.confidence * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                            <p className="text-sm mb-2">{issue.description}</p>

                                                            {isExpanded && (
                                                                <div className="space-y-2 mt-3">
                                                                    {issue.location && (issue.location.table || issue.location.column) && (
                                                                        <div className="text-xs text-gray-600">
                                                                            Location: {issue.location.table || 'N/A'}
                                                                            {issue.location.column && ` → ${issue.location.column}`}
                                                                        </div>
                                                                    )}

                                                                    {issue.suggestions && issue.suggestions.length > 0 && (
                                                                        <div className="bg-background/50 p-3 rounded-md space-y-2">
                                                                            <div className="font-medium text-sm mb-1">Suggestions:</div>
                                                                            {issue.suggestions.map((suggestion, idx) => (
                                                                                <div key={idx} className="text-sm">
                                                                                    <div className="mb-1">{suggestion.action}</div>
                                                                                    {suggestion.sql && (
                                                                                        <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-xs text-gray-700 overflow-x-auto">
                                                                                            {suggestion.sql}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleIssueExpansion(issue.id)}
                                                        className="text-muted-foreground hover:text-foreground p-1"
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Traditional Issues */}
                        {filteredIssues.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Traditional Validation Issues ({filteredIssues.length})</h3>
                                <div className="space-y-2">
                                    {filteredIssues.map(issue => {
                                        const Icon = severityIcons[issue.type];
                                        const CategoryIcon = categoryIcons[issue.category];
                                        const isExpanded = expandedIssues.has(issue.id);

                                        return (
                                            <div
                                                key={issue.id}
                                                className={cn(
                                                    "border rounded-lg p-4 transition-all",
                                                    severityColors[issue.type]
                                                )}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-medium">{issue.title}</h4>
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded-full text-xs font-medium",
                                                                    categoryColors[issue.category]
                                                                )}>
                                                                    <CategoryIcon className="w-3 h-3 inline mr-1" />
                                                                    {issue.category}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm mb-2">{issue.description}</p>

                                                            {isExpanded && (
                                                                <div className="space-y-2 mt-3">
                                                                    {issue.suggestion && (
                                                                        <div className="bg-background/50 p-3 rounded-md">
                                                                            <div className="font-medium text-sm mb-1">Suggestion:</div>
                                                                            <div className="text-sm">{issue.suggestion}</div>
                                                                        </div>
                                                                    )}

                                                                    {(issue.tableId || issue.columnId) && (
                                                                        <div className="flex gap-2">
                                                                            {issue.tableId && (
                                                                                <button
                                                                                    onClick={() => handleSelectTable(issue.tableId!)}
                                                                                    className="px-3 py-1 bg-background border rounded text-sm hover:bg-background/80"
                                                                                >
                                                                                    Go to Table
                                                                                </button>
                                                                            )}
                                                                            {issue.autoFixable && (
                                                                                <button
                                                                                    onClick={() => handleAutoFix(issue)}
                                                                                    disabled={autoFixing === issue.id}
                                                                                    className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 disabled:opacity-50"
                                                                                >
                                                                                    {autoFixing === issue.id ? 'Fixing...' : 'Auto Fix'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleIssueExpansion(issue.id)}
                                                        className="text-muted-foreground hover:text-foreground p-1"
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Normalization Suggestions */}
                        {normalizationSuggestions.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Normalization Suggestions</h3>
                                <div className="space-y-3">
                                    {normalizationSuggestions.map((suggestion, index) => (
                                        <div key={index} className="border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4">
                                            <div className="flex items-start gap-3">
                                                <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                                                <div>
                                                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                                                        {suggestion.description}
                                                    </h4>
                                                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                                                        {suggestion.reason}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "px-2 py-1 rounded text-xs font-medium",
                                                            suggestion.impact === 'high' ? 'bg-red-100 text-red-700' :
                                                                suggestion.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-green-100 text-green-700'
                                                        )}>
                                                            {suggestion.impact} impact
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Type: {suggestion.type}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No Issues */}
                        {filteredIssues.length === 0 && normalizationSuggestions.length === 0 && (!aiValidation || aiValidation.issues.length === 0) && validationResult && (
                            <div className="text-center py-12">
                                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-green-600 mb-2">No Issues Found</h3>
                                <p className="text-muted-foreground">
                                    Your schema looks good! No validation issues detected.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
