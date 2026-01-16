"use client";

import React, { useState } from 'react';
import { Panel } from 'reactflow';
import { useDiagramStore } from '@/store/use-diagram-store';
import { Download, FileImage, FileText, Upload, Database, Layout, ChevronDown, Activity, RotateCcw, AlertTriangle } from 'lucide-react';
import { SqlImportPanel } from './sql-import-panel';

const Toolbar = () => {
    const { selectedNodes, selectedEdges, deleteSelectedNodes, addTable, detectRelationships, autoLayout, runValidation, clearDiagram } = useDiagramStore();
    const [showImportPanel, setShowImportPanel] = useState(false);
    const [showLayoutOptions, setShowLayoutOptions] = useState(false);

    const openPerformancePanel = () => {
        const event = new CustomEvent('openPerformancePanel');
        window.dispatchEvent(event);
    };

    const handleAddNewTable = () => {
        const tableName = prompt('Enter table name:');
        if (tableName?.trim()) {
            addTable({ label: tableName.trim() });
        }
    };

    const handleNewProject = () => {
        if (window.confirm('Are you sure you want to start a new project? This will clear all current tables and relationships.')) {
            clearDiagram();
        }
    };

    const openExportPanel = () => {
        // This will be handled by the parent component
        const event = new CustomEvent('openExportPanel');
        window.dispatchEvent(event);
    };

    const openImportPanel = () => {
        setShowImportPanel(true);
    };

    const handleSmartLayout = (type: 'hierarchical' | 'force' | 'group' = 'hierarchical') => {
        autoLayout({ type, direction: 'TB' });
        setShowLayoutOptions(false);
    };

    return (
        <>
            <Panel
                position="top-right"
                className="react-flow__panel flex flex-col gap-3 p-3 w-48"
            >
                <div className="bg-card/95 backdrop-blur-sm rounded-lg shadow-md border border-border p-3 transition-all duration-200 hover:shadow-lg">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                            <div className="text-xs font-semibold text-foreground">ERD Editor</div>
                            <div className="text-xs text-muted-foreground">v0.1</div>
                        </div>

                        {/* Add Table Button */}
                        <button
                            onClick={handleAddNewTable}
                            className="bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center p-2 text-xs font-medium"
                        >
                            + Add Table
                        </button>

                        {/* New Project Button */}
                        <button
                            onClick={handleNewProject}
                            className="bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors flex items-center justify-center gap-1 p-2 text-xs font-medium"
                        >
                            <RotateCcw className="w-3 h-3" />
                            New Project
                        </button>

                        {/* Delete Selected Button */}
                        {(selectedNodes.length > 0 || selectedEdges.length > 0) && (
                            <button
                                onClick={deleteSelectedNodes}
                                className="bg-red-600 hover:bg-red-700 text-white rounded transition-colors p-2 text-xs font-medium"
                            >
                                Delete Selected ({selectedNodes.length + selectedEdges.length})
                            </button>
                        )}

                        <div className="w-full h-px bg-border"></div>

                        {/* Detect Relationship Button */}
                        <button
                            onClick={detectRelationships}
                            className="bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-xs font-medium"
                        >
                            Detect Relationship
                        </button>

                        {/* Smart Layout Button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowLayoutOptions(!showLayoutOptions)}
                                className="bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-xs font-medium flex items-center gap-1"
                            >
                                <Layout className="w-3 h-3" />
                                Smart Layout
                                <ChevronDown className="w-3 h-3" />
                            </button>

                            {/* Layout Options Dropdown */}
                            {showLayoutOptions && (
                                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 min-w-48">
                                    <div className="p-1">
                                        <button
                                            onClick={() => handleSmartLayout('hierarchical')}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent rounded transition-colors flex items-center gap-2"
                                        >
                                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                            Hierarchical Layout
                                            <span className="text-muted-foreground text-xs">Best for parent-child relationships</span>
                                        </button>
                                        <button
                                            onClick={() => handleSmartLayout('force')}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent rounded transition-colors flex items-center gap-2"
                                        >
                                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                            Force Directed Layout
                                            <span className="text-muted-foreground text-xs">Optimizes relationship flow</span>
                                        </button>
                                        <button
                                            onClick={() => handleSmartLayout('group')}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent rounded transition-colors flex items-center gap-2"
                                        >
                                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                            Group Layout
                                            <span className="text-muted-foreground text-xs">Groups related tables</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="w-full h-px bg-border"></div>

                        {/* Validate Button */}
                        <button
                            onClick={runValidation}
                            className="bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-xs font-medium"
                        >
                            Validate
                        </button>

                        <div className="w-full h-px bg-border"></div>

                        {/* Performance Button */}
                        <button
                            onClick={openPerformancePanel}
                            className="bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-xs font-medium flex items-center gap-2"
                        >
                            <Activity className="w-3 h-3" />
                            Performance
                        </button>

                        <div className="w-full h-px bg-border"></div>

                        {/* Import Section */}
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-foreground">Import</div>

                            {/* Import SQL Button */}
                            <button
                                onClick={openImportPanel}
                                className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors p-2 text-xs font-medium flex items-center gap-2"
                            >
                                <Database className="w-3 h-3" />
                                Import SQL
                            </button>
                        </div>

                        <div className="w-full h-px bg-border"></div>

                        {/* Export Section */}
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-semibold text-foreground">Export</div>

                            {/* Export Diagram Button */}
                            <button
                                onClick={openExportPanel}
                                className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors p-2 text-xs font-medium flex items-center gap-2"
                            >
                                <Download className="w-3 h-3" />
                                Export Diagram
                            </button>
                        </div>
                    </div>
                </div>
            </Panel>

            {/* SQL Import Panel */}
            {showImportPanel && (
                <SqlImportPanel onClose={() => setShowImportPanel(false)} />
            )}
        </>
    );
};

export default Toolbar;
