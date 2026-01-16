"use client"

import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    ReactFlowProvider,
    useReactFlow,
    useNodesState,
    useEdgesState,
    SelectionMode,
    Viewport,
    Node,
    OnViewportChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './reactflow-enhancements.css';
import { useDiagramStore } from '@/store/use-diagram-store';
import { useTheme } from 'next-themes';
import TableNode from './nodes/table-node';
import RelationshipEdge from './edges/relationship-edge';
import LayoutControls from './layout-controls';
import SuggestionsPanel from './suggestions-panel';
import Toolbar from './toolbar';
import PropertyPanel from './property-panel';
import BottomToolbar from './bottom-toolbar';
import { ValidationPanel } from './validation-panel';
import ExportPanel from './export-panel';
import ExportButton from './export-button';
import { PerformancePanel } from './performance-panel';
import { PerformanceEngine } from '@/lib/performance-engine';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

// Memoize nodeTypes and edgeTypes outside component to prevent re-creation
const nodeTypes = {
    table: TableNode,
};

const edgeTypes = {
    relationship: RelationshipEdge,
};

const CanvasContent = () => {
    const [validationPanelOpen, setValidationPanelOpen] = useState(false);
    const [exportPanelOpen, setExportPanelOpen] = useState(false);
    const [performancePanelOpen, setPerformancePanelOpen] = useState(false);
    const [performanceEngine] = useState(() => new PerformanceEngine());
    const [filteredNodes, setFilteredNodes] = useState<Node[]>([]);
    const { 
        nodes, 
        edges, 
        onNodesChange, 
        onEdgesChange, 
        onConnect,
        selectedNodes,
        selectNode,
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
        autoValidationEnabled,
        runValidation,
        toggleValidation,
        toggleAutoValidation,
        getValidationIssues
    } = useDiagramStore();
    const { theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const { fitView, zoomIn, zoomOut, getZoom, getViewport } = useReactFlow();
    const [reactFlowNodes, setReactFlowNodes, onReactFlowNodesChange] = useNodesState(nodes);
    const [reactFlowEdges, setReactFlowEdges, onReactFlowEdgesChange] = useEdgesState(edges);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync ReactFlow state with store state
    useEffect(() => {
        setReactFlowNodes(nodes);
    }, [nodes, setReactFlowNodes]);

    useEffect(() => {
        setReactFlowEdges(edges);
    }, [edges, setReactFlowEdges]);

    // Performance optimization - viewport culling
    useEffect(() => {
        const config = performanceEngine.getConfig();
        if (config.enableLazyRendering) {
            const viewport = getViewport();
            const visible = performanceEngine.getVisibleNodes(nodes, viewport);
            setFilteredNodes(visible);
            performanceEngine.endRenderCycle(nodes.length, visible.length, visible.length);
        } else {
            setFilteredNodes(nodes);
            performanceEngine.endRenderCycle(nodes.length, nodes.length, nodes.length);
        }
    }, [nodes, getViewport, performanceEngine]);

    // Performance monitoring
    useEffect(() => {
        performanceEngine.startRenderCycle();
    });

    // Event listeners for panels
    useEffect(() => {
        const openPerformancePanel = () => setPerformancePanelOpen(true);
        
        window.addEventListener('openPerformancePanel', openPerformancePanel);
        
        return () => {
            window.removeEventListener('openPerformancePanel', openPerformancePanel);
        };
    }, []);

    const currentTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : 'light';
    const isDark = currentTheme === 'dark';

    const getNodeColor = (node: any) => {
        if (node.type === 'table') {
            return isDark ? '#374151' : '#f3f4f6';
        }
        return isDark ? '#555' : '#eee';
    };

    const handleNodeChange = useCallback((changes: any[]) => {
        onReactFlowNodesChange(changes);
        onNodesChange(changes);
        
        // Handle selection changes
        const selectionChanges = changes.filter(change => change.type === 'select');
        if (selectionChanges.length > 0) {
            const selectedNodeIds = reactFlowNodes
                .filter(node => node.selected)
                .map(node => node.id);
            
            if (selectedNodeIds.length === 1) {
                selectNode(selectedNodeIds[0]);
            } else if (selectedNodeIds.length > 1) {
                selectMultipleNodes(selectedNodeIds);
            } else {
                clearSelection();
            }
        }
    }, [reactFlowNodes, onNodesChange, onReactFlowNodesChange, selectNode, selectMultipleNodes, clearSelection]);

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
            if (selectedNodes.length > 0) {
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
    }, [selectedNodes, nodes, deleteSelectedNodes, clearSelection, selectMultipleNodes, undo, redo, canUndo, canRedo, saveToLocal, loadFromLocal]);

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

    return (
        <div className="w-full h-full bg-background transition-colors duration-300">
            <ReactFlow
                nodes={reactFlowNodes}
                edges={reactFlowEdges}
                onNodesChange={handleNodeChange}
                onEdgesChange={(changes) => {
                    onReactFlowEdgesChange(changes);
                    onEdgesChange(changes);
                }}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                className="bg-background"
                minZoom={0.1}
                maxZoom={4}
                snapToGrid={true}
                snapGrid={[20, 20]}
                onlyRenderVisibleElements={true}
                selectionMode={SelectionMode.Partial}
                multiSelectionKeyCode="Control"
                deleteKeyCode={null} // We handle delete manually
            >
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
                    <Panel position="top-left" className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3">
                        <div className="flex items-center gap-2 text-sm">
                            {getValidationStatusIcon()}
                            <span className="font-medium">{getValidationStatusText()}</span>
                            <span className="text-muted-foreground">Score: {validationScore}</span>
                            <button
                                onClick={() => setValidationPanelOpen(true)}
                                className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                            >
                                Details
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs">
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
            <ExportButton />
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
