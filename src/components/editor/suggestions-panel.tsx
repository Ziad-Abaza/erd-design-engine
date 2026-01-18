"use client"

import { memo, useState, useMemo, useEffect } from 'react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { cn } from '@/lib/utils';
import { Column } from './nodes/table-node';
import {
    Lightbulb,
    Link,
    Hash,
    Check,
    ChevronDown,
    ChevronUp,
    Target,
    ArrowRight,
    Sparkles
} from 'lucide-react';

const SuggestionsPanel = memo(() => {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        foreignKeys: true,
        indexes: false
    });

    const {
        nodes,
        suggestForeignKeys,
        suggestIndexes,
        createSuggestedForeignKey,
        createIndex,
        aiSuggestions,
        isFetchingAISuggestions,
        fetchAISuggestions,
        applyAISuggestion,
        aiEnabled
    } = useDiagramStore();

    const [currentAiEnabled, setCurrentAiEnabled] = useState(true);

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

    const fkSuggestions = useMemo(() => suggestForeignKeys(), [suggestForeignKeys]);
    const indexSuggestions = useMemo(() => suggestIndexes(), [suggestIndexes]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const getTableName = (tableId: string) => {
        const table = nodes.find(node => node.id === tableId);
        return table?.data.label || 'Unknown';
    };

    const getColumnName = (tableId: string, columnId: string) => {
        const table = nodes.find(node => node.id === tableId);
        const column = table?.data.columns.find((col: Column) => col.id === columnId);
        return column?.name || 'Unknown';
    };

    const handleCreateFK = (suggestion: typeof fkSuggestions[0]) => {
        createSuggestedForeignKey(
            suggestion.sourceTableId,
            suggestion.sourceColumnId,
            suggestion.targetTableId,
            suggestion.targetColumnId
        );
    };

    const handleCreateIndex = (suggestion: typeof indexSuggestions[0]) => {
        const table = nodes.find(node => node.id === suggestion.tableId);
        const column = table?.data.columns.find((col: Column) => col.name === suggestion.columnName);
        if (column) {
            createIndex(suggestion.tableId, column.id);
        }
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return 'text-green-600';
        if (confidence >= 0.6) return 'text-yellow-600';
        return 'text-orange-600';
    };

    const getConfidenceLabel = (confidence: number) => {
        if (confidence >= 0.8) return 'High';
        if (confidence >= 0.6) return 'Medium';
        return 'Low';
    };

    if (fkSuggestions.length === 0 && indexSuggestions.length === 0) {
        return null;
    }

    return (
        <div className="bg-card/95 backdrop-blur-sm rounded-lg shadow-md border border-border p-3 transition-all duration-200 hover:shadow-lg max-w-sm">
            <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <div className="text-sm font-semibold text-foreground">Smart Suggestions</div>
                {currentAiEnabled && (
                    <button
                        onClick={() => fetchAISuggestions()}
                        disabled={isFetchingAISuggestions}
                        className={cn(
                            "ml-auto text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded transition-colors",
                            isFetchingAISuggestions && "animate-pulse"
                        )}
                    >
                        {isFetchingAISuggestions ? 'Thinking...' : 'AI Refresh'}
                    </button>
                )}
            </div>

            {/* AI Suggestions Section */}
            {process.env.NEXT_PUBLIC_AI_ENABLED !== 'false' && aiSuggestions.length > 0 && (
                <div className="mb-4">
                    <button
                        onClick={() => toggleSection('ai')}
                        className="flex items-center justify-between w-full text-left hover:bg-muted p-1 rounded transition-colors border-b border-primary/20 bg-primary/5"
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span className="text-xs font-semibold text-primary">
                                AI Optimizations ({aiSuggestions.length})
                            </span>
                        </div>
                        {expandedSections.ai ? (
                            <ChevronUp className="w-3 h-3 text-primary" />
                        ) : (
                            <ChevronDown className="w-3 h-3 text-primary" />
                        )}
                    </button>

                    {expandedSections.ai && (
                        <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {aiSuggestions.map((suggestion) => (
                                <div key={suggestion.id} className={cn(
                                    "rounded p-2 text-xs border-l-2",
                                    suggestion.severity === 'error' ? "bg-red-500/5 border-red-500" :
                                        suggestion.severity === 'warning' ? "bg-yellow-500/5 border-yellow-500" :
                                            "bg-blue-500/5 border-blue-500"
                                )}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold flex items-center gap-1">
                                            {suggestion.title}
                                        </span>
                                        <button
                                            onClick={() => applyAISuggestion(suggestion.id)}
                                            className="text-primary hover:text-primary/80 transition-transform hover:scale-110"
                                            title="Apply Suggestion"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                        {suggestion.details}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Foreign Key Suggestions */}
            {fkSuggestions.length > 0 && (
                <div className="mb-3">
                    <button
                        onClick={() => toggleSection('foreignKeys')}
                        className="flex items-center justify-between w-full text-left hover:bg-muted p-1 rounded transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Link className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-medium">
                                Foreign Keys ({fkSuggestions.length})
                            </span>
                        </div>
                        {expandedSections.foreignKeys ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        )}
                    </button>

                    {expandedSections.foreignKeys && (
                        <div className="mt-2 space-y-2">
                            {fkSuggestions.slice(0, 5).map((suggestion, index) => (
                                <div key={index} className="bg-muted/50 rounded p-2 text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1">
                                            <span className="font-medium">
                                                {getTableName(suggestion.sourceTableId)}.{getColumnName(suggestion.sourceTableId, suggestion.sourceColumnId)}
                                            </span>
                                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                            <span className="font-medium">
                                                {getTableName(suggestion.targetTableId)}.{getColumnName(suggestion.targetTableId, suggestion.targetColumnId)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={cn("text-[10px]", getConfidenceColor(suggestion.confidence))}>
                                                {getConfidenceLabel(suggestion.confidence)}
                                            </span>
                                            <button
                                                onClick={() => handleCreateFK(suggestion)}
                                                className="text-green-600 hover:text-green-700 p-0.5"
                                                title="Create Foreign Key"
                                            >
                                                <Check className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {fkSuggestions.length > 5 && (
                                <div className="text-[10px] text-muted-foreground text-center">
                                    ... and {fkSuggestions.length - 5} more
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Index Suggestions */}
            {indexSuggestions.length > 0 && (
                <div>
                    <button
                        onClick={() => toggleSection('indexes')}
                        className="flex items-center justify-between w-full text-left hover:bg-muted p-1 rounded transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3 text-purple-500" />
                            <span className="text-xs font-medium">
                                Indexes ({indexSuggestions.length})
                            </span>
                        </div>
                        {expandedSections.indexes ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        )}
                    </button>

                    {expandedSections.indexes && (
                        <div className="mt-2 space-y-2">
                            {indexSuggestions.slice(0, 5).map((suggestion, index) => (
                                <div key={index} className="bg-muted/50 rounded p-2 text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1">
                                            <Target className="w-3 h-3 text-purple-500" />
                                            <span className="font-medium">
                                                {getTableName(suggestion.tableId)}.{suggestion.columnName}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleCreateIndex(suggestion)}
                                            className="text-green-600 hover:text-green-700 p-0.5"
                                            title="Create Index"
                                        >
                                            <Check className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="text-[9px] text-muted-foreground">
                                        {suggestion.reason}
                                    </div>
                                </div>
                            ))}
                            {indexSuggestions.length > 5 && (
                                <div className="text-[10px] text-muted-foreground text-center">
                                    ... and {indexSuggestions.length - 5} more
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Actions */}
            <div className="mt-3 pt-2 border-t border-border/50">
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            fkSuggestions.slice(0, 3).forEach(handleCreateFK);
                        }}
                        className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                        disabled={fkSuggestions.length === 0}
                    >
                        Apply Top FKs
                    </button>
                    <button
                        onClick={() => {
                            indexSuggestions.slice(0, 3).forEach(handleCreateIndex);
                        }}
                        className="flex-1 text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded transition-colors"
                        disabled={indexSuggestions.length === 0}
                    >
                        Apply Top Indexes
                    </button>
                </div>
            </div>
        </div>
    );
});

SuggestionsPanel.displayName = 'SuggestionsPanel';

export default SuggestionsPanel;
