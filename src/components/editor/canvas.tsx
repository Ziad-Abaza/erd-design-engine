"use client"

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    ReactFlowProvider,
    useReactFlow,
    SelectionMode,
    Node,
    NodeChange,
    EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './reactflow-enhancements.css';
import { useDiagramStore } from '@/store/use-diagram-store';
import { useTheme } from 'next-themes';
import TableNode from './nodes/table-node';
import DatabaseRelationshipEdge from './edges/database-relationship-edge';
import Toolbar from './toolbar';
import PropertyPanel from './property-panel';
import BottomToolbar from './bottom-toolbar';
import { ValidationPanel } from './validation-panel';
import ExportPanel from './export-panel';
import UnifiedToolbar from './unified-toolbar';
import ChatPanel from './chat-panel';
import { PerformancePanel } from './performance-panel';
import { PerformanceEngine } from '@/lib/performance-engine';
import { AlertTriangle, CheckCircle, XCircle, Sparkles, Loader2 } from 'lucide-react';

const CanvasContent = () => {
    // Memoize nodeTypes and edgeTypes to prevent re-creation warnings
    const nodeTypes = useMemo(() => ({
        table: TableNode,
        junctionTable: TableNode,
    }), []);

    const edgeTypes = useMemo(() => ({
        relationship: DatabaseRelationshipEdge,
        manyToMany: DatabaseRelationshipEdge,
        editableRelationship: DatabaseRelationshipEdge, // Alias for backward compatibility or data issues
    }), []);

    const [validationPanelOpen, setValidationPanelOpen] = useState(false);
    const [exportPanelOpen, setExportPanelOpen] = useState(false);
    const [performancePanelOpen, setPerformancePanelOpen] = useState(false);
    const [performanceEngine] = useState(() => new PerformanceEngine());
    const [aiStatusSummary, setAiStatusSummary] = useState<{
        overall: 'healthy' | 'warning' | 'critical';
        score: number;
        insights: Array<{ category: string; status: string; recommendation: string }>;
        nextSteps: string[];
    } | null>(null);
    const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(false);
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        selectedNodes,
        selectedEdges,
        selectMultipleNodes,
        clearSelection,
        deleteSelectedNodes,
        addTable,
        undo,
        redo,
        canUndo,
        canRedo,
        saveToLocal,
        loadFromLocal,
        validationResult,
        validationEnabled,
        runValidation,
        autoValidationEnabled,
        toggleAutoValidation,
        getValidationIssues
    } = useDiagramStore();
    const { theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const { getViewport } = useReactFlow();
    useEffect(() => {
        setMounted(true);
    }, []);

    // Selection monitoring to sync selectedNodes/selectedEdges
    /*
        const selection = useMemo(() => ({
            nodes: nodes.filter(n => n.selected).map(n => n.id),
            edges: edges.filter(e => e.selected).map(e => e.id)
        }), [nodes, edges]);
    */

    const currentTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : 'light';
    const isDark = currentTheme === 'dark';

    const getNodeColor = (node: Node) => {
        if (node.type === 'table') {
            return isDark ? '#374151' : '#f3f4f6';
        }
        return isDark ? '#555' : '#eee';
    };

    // Performance monitoring
    useEffect(() => {
        performanceEngine.startRenderCycle();
    });

    // Event listeners for panels
    useEffect(() => {
        const openPerformancePanel = () => setPerformancePanelOpen(true);
        window.addEventListener('openPerformancePanel', openPerformancePanel);
        return () => window.removeEventListener('openPerformancePanel', openPerformancePanel);
    }, []);

    // Handle node change
    // Handle node change
    const handleNodeChange = useCallback((changes: NodeChange[]) => {
        onNodesChange(changes);
    }, [onNodesChange]);

    // Handle edge change
    const handleEdgeChange = useCallback((changes: EdgeChange[]) => {
        onEdgesChange(changes);
    }, [onEdgesChange]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Handle undo/redo
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (canUndo()) {
                undo();
            }
        }
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
            event.preventDefault();
            if (canRedo()) {
                redo();
            }
        }

        // Handle save (Ctrl+S)
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            saveToLocal();
        }

        // Handle load (Ctrl+O)
        if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
            event.preventDefault();
            loadFromLocal();
        }

        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (selectedNodes.length > 0 || selectedEdges.length > 0) {
                event.preventDefault();
                deleteSelectedNodes();
            }
        }
        if (event.key === 'Escape') {
            clearSelection();
        }
        // Ctrl+A to select all nodes
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            event.preventDefault();
            const allNodeIds = nodes.map(node => node.id);
            selectMultipleNodes(allNodeIds);
        }
    }, [selectedNodes, selectedEdges, nodes, deleteSelectedNodes, clearSelection, selectMultipleNodes, undo, redo, canUndo, canRedo, saveToLocal, loadFromLocal]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Handle export panel opening event
    useEffect(() => {
        const handleOpenExportPanel = () => {
            setExportPanelOpen(true);
        };

        window.addEventListener('openExportPanel', handleOpenExportPanel);
        return () => window.removeEventListener('openExportPanel', handleOpenExportPanel);
    }, []);

    // Auto-save functionality
    useEffect(() => {
        const autoSaveInterval = setInterval(() => {
            saveToLocal();
        }, 30000); // Auto-save every 30 seconds

        // Load from local storage on mount
        loadFromLocal();

        return () => clearInterval(autoSaveInterval);
    }, [saveToLocal, loadFromLocal]);

    // Save on window unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            saveToLocal();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveToLocal]);

    const handleAddNewTable = useCallback(() => {
        const tableName = prompt('Enter table name:');
        if (tableName?.trim()) {
            addTable({ label: tableName.trim() });
        }
    }, [addTable]);

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
        setIsLoadingAiSummary(true);
        try {
            const performanceMetrics = performanceEngine.getMetrics();
            const response = await fetch('/api/ai/status-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodes,
                    edges,
                    validationResults: validationIssues,
                    performanceMetrics
                })
            });

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
        if (validationEnabled && validationResult) {
            fetchAIStatusSummary();
        }
    }, [validationResult, validationEnabled, nodes, edges]);

    return (
        <div className="w-full h-full bg-background transition-colors duration-300">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodeChange}
                onEdgesChange={handleEdgeChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                className="bg-background"
                minZoom={0.1}
                maxZoom={4}
                snapToGrid={true}
                snapGrid={[20, 20]}
                onlyRenderVisibleElements={false}
                selectionMode={SelectionMode.Partial}
                multiSelectionKeyCode="Control"
                deleteKeyCode={null} // We handle delete manually
            >
                {/* SVG Marker Definitions - must be inside ReactFlow */}
                <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                    <defs>
                        {/* One marker (|) */}
                        <marker
                            id="marker-one"
                            viewBox="0 0 10 10"
                            refX="5"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 5 0 L 5 10" stroke="currentColor" strokeWidth="2" fill="none" />
                        </marker>

                        {/* Many marker (Crow's Foot) */}
                        <marker
                            id="marker-many"
                            viewBox="0 0 10 10"
                            refX="5"
                            refY="5"
                            markerWidth="8"
                            markerHeight="8"
                            orient="auto-start-reverse"
                        >
                            <path d="M 0 0 L 5 5 L 0 10 M 5 5 L 10 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </marker>

                        {/* Optional marker (O) */}
                        <marker
                            id="marker-optional"
                            viewBox="0 0 10 10"
                            refX="5"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="white" />
                        </marker>

                        {/* One and only one (||) */}
                        <marker
                            id="marker-one-only"
                            viewBox="0 0 12 10"
                            refX="11"
                            refY="5"
                            markerWidth="8"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 4 0 L 4 10 M 8 0 L 8 10" stroke="currentColor" strokeWidth="2" fill="none" />
                        </marker>

                        {/* Zero or many (O <) */}
                        <marker
                            id="marker-zero-many"
                            viewBox="0 0 15 10"
                            refX="14"
                            refY="5"
                            markerWidth="10"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <circle cx="4" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="white" />
                            <path d="M 8 0 L 15 5 L 8 10 M 15 5 L 15 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </marker>

                        {/* One or many (| <) */}
                        <marker
                            id="marker-one-many"
                            viewBox="0 0 15 10"
                            refX="14"
                            refY="5"
                            markerWidth="10"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 4 0 L 4 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <path d="M 8 0 L 15 5 L 8 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </marker>

                        {/* Zero or one (O |) */}
                        <marker
                            id="marker-zero-one"
                            viewBox="0 0 15 10"
                            refX="14"
                            refY="5"
                            markerWidth="10"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <circle cx="4" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="white" />
                            <path d="M 10 0 L 10 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </marker>
                    </defs>
                </svg>

                <Background
                    gap={20}
                    color={isDark ? '#333' : '#ddd'}
                    variant={BackgroundVariant.Dots}
                />
                <Controls
                    className="bg-card/95 backdrop-blur-sm border-border shadow-lg rounded-lg overflow-hidden transition-all duration-200 hover:shadow-xl"
                    showZoom={true}
                    showFitView={true}
                    showInteractive={false}
                    position="bottom-left"
                />
                <MiniMap
                    nodeColor={getNodeColor}
                    maskColor={isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}
                    style={{
                        backgroundColor: isDark ? '#111' : '#fff',
                        height: 180,
                        width: 250,
                        border: '1px solid',
                        borderColor: isDark ? '#374151' : '#e5e7eb',
                    }}
                    className="rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
                    pannable
                    zoomable
                    position="bottom-right"
                />

                {/* Validation Status Panel */}
                {validationEnabled && (
                    <Panel position="top-left" className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 max-w-md">
                        <div className="flex items-center gap-2 text-sm mb-2">
                            {getValidationStatusIcon()}
                            <span className="font-medium">{getValidationStatusText()}</span>
                            <span className="text-muted-foreground">Score: {validationScore}</span>
                            {aiStatusSummary && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                    aiStatusSummary.overall === 'healthy' ? 'bg-green-100 text-green-700' :
                                    aiStatusSummary.overall === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    AI: {aiStatusSummary.overall} ({aiStatusSummary.score})
                                </span>
                            )}
                            <button
                                onClick={() => setValidationPanelOpen(true)}
                                className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                            >
                                Details
                            </button>
                        </div>

                        {/* AI Insights */}
                        {aiStatusSummary && aiStatusSummary.insights && aiStatusSummary.insights.length > 0 && (
                            <div className="mb-2 space-y-1">
                                {aiStatusSummary.insights.slice(0, 2).map((insight, idx) => (
                                    <div key={idx} className="text-xs text-muted-foreground">
                                        <span className="font-medium">{insight.category}:</span> {insight.status}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* AI Next Steps */}
                        {aiStatusSummary && aiStatusSummary.nextSteps && aiStatusSummary.nextSteps.length > 0 && (
                            <div className="mb-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                                <div className="flex items-center gap-1 mb-1">
                                    <Sparkles className="w-3 h-3 text-purple-600" />
                                    <span className="text-xs font-medium text-purple-900 dark:text-purple-100">AI Next Steps</span>
                                </div>
                                <ul className="text-xs text-purple-800 dark:text-purple-200 space-y-0.5">
                                    {aiStatusSummary.nextSteps.slice(0, 2).map((step, idx) => (
                                        <li key={idx}>• {step}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-xs">
                            <label className="flex items-center gap-1">
                                <input
                                    type="checkbox"
                                    checked={autoValidationEnabled}
                                    onChange={toggleAutoValidation}
                                    className="w-3 h-3"
                                />
                                Auto-validate
                            </label>
                            <button
                                onClick={runValidation}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Refresh
                            </button>
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
                        </div>
                    </Panel>
                )}

                <Toolbar />
            </ReactFlow>
            <PropertyPanel />
            <BottomToolbar />
            <ValidationPanel
                isOpen={validationPanelOpen}
                onClose={() => setValidationPanelOpen(false)}
            />
            <ExportPanel
                isOpen={exportPanelOpen}
                onClose={() => setExportPanelOpen(false)}
            />
            <PerformancePanel
                isOpen={performancePanelOpen}
                onClose={() => setPerformancePanelOpen(false)}
            />
            <UnifiedToolbar />
            <ChatPanel />
        </div>
    );
};

export default function Canvas() {
    return (
        <ReactFlowProvider>
            <CanvasContent />
        </ReactFlowProvider>
    )
}
