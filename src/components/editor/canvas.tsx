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
import UnifiedSidebar from './unified-sidebar';
import StatusBar from './status-bar';
import PropertyPanel from './property-panel';
import ChatPanel from './chat-panel';
import { ValidationPanel } from './validation-panel';
import ExportPanel from './export-panel';
import { PerformancePanel } from './performance-panel';
import HistoryPanel from './history-panel';
import { SqlImportPanel } from './sql-import-panel';
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
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [importPanelOpen, setImportPanelOpen] = useState(false);
    const [showMinimap, setShowMinimap] = useState(true);

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

    // Event listeners for modal panels
    useEffect(() => {
        const openPerformancePanel = () => setPerformancePanelOpen(true);
        const openExportPanel = () => setExportPanelOpen(true);
        const openImportPanel = () => setImportPanelOpen(true);
        const openValidationPanel = () => setValidationPanelOpen(true);
        const openHistoryPanel = () => setHistoryPanelOpen(true);

        const handleMinimapToggle = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.enabled === 'boolean') {
                setShowMinimap(event.detail.enabled);
            }
        };

        const handleSettingsChange = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.showMinimap === 'boolean') {
                setShowMinimap(event.detail.showMinimap);
            }
        };

        // Load initial minimap setting from localStorage
        try {
            const savedSettings = localStorage.getItem('erd-editor-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                setShowMinimap(settings.showMinimap ?? true);
            }
        } catch (error) {
            console.error('Failed to load minimap setting:', error);
        }

        window.addEventListener('openPerformancePanel', openPerformancePanel);
        window.addEventListener('openExportPanel', openExportPanel);
        window.addEventListener('openImportPanel', openImportPanel);
        window.addEventListener('openValidationPanel', openValidationPanel);
        window.addEventListener('openHistoryPanel', openHistoryPanel);
        window.addEventListener('minimapToggled', handleMinimapToggle as EventListener);
        window.addEventListener('settingsChanged', handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener('openPerformancePanel', openPerformancePanel);
            window.removeEventListener('openExportPanel', openExportPanel);
            window.removeEventListener('openImportPanel', openImportPanel);
            window.removeEventListener('openValidationPanel', openValidationPanel);
            window.removeEventListener('openHistoryPanel', openHistoryPanel);
            window.removeEventListener('minimapToggled', handleMinimapToggle as EventListener);
            window.removeEventListener('settingsChanged', handleSettingsChange as EventListener);
        };
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


    return (
        <div className="w-full h-full bg-background transition-colors duration-300 overflow-hidden">
            {/* Status Bar */}
            <StatusBar />
            {/* SVG Marker Definitions - Global scope */}
            <svg style={{ position: 'absolute', width: 0, height: 0, zIndex: -1 }}>
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
                        <path d="M 4 0 L 4 10 M 8 0 L 8 10" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path d="M 8 5 L 15 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </marker>
                </defs>
            </svg>

            {/* Main Canvas Area with Safe Zone */}
            <div className="pt-12 pb-8 pl-8 pr-8 h-full">
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
                    onlyRenderVisibleElements={true}
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
                    {showMinimap && (
                        <MiniMap
                            nodeColor={getNodeColor}
                            maskColor={isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)'}
                            style={{
                                backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                                height: 140,
                                width: 200,
                                border: '1px solid',
                                borderColor: isDark ? '#374151' : '#e5e7eb',
                                backdropFilter: 'blur(8px)',
                            }}
                            className="rounded-lg shadow-2xl transition-all duration-300 hover:shadow-primary/20 hover:scale-105 border-primary/10"
                            pannable
                            zoomable
                            position="top-left"
                        />
                    )}
                </ReactFlow>
            </div>

            {/* Unified Sidebar */}
            <UnifiedSidebar />

            {/* Property Panel */}
            <PropertyPanel />

            {/* Modal Panels */}
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
            {historyPanelOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div
                        className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <HistoryPanel
                            isOpen={historyPanelOpen}
                            onClose={() => setHistoryPanelOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* SQL Import Panel */}
            {importPanelOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div
                        className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <SqlImportPanel onClose={() => setImportPanelOpen(false)} />
                    </div>
                </div>
            )}

            {/* Chat Panel */}
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
