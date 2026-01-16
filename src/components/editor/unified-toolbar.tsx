"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Download, History, Database, ChevronUp, ChevronDown, FileImage, FileText, File } from 'lucide-react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { ExportEngine, ExportOptions } from '@/lib/export-engine';
import HistoryPanel from './history-panel';
import SQLExportPanel from './sql-export-panel';

export default function UnifiedToolbar() {
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const [showSQLExportPanel, setShowSQLExportPanel] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const { nodes, edges } = useDiagramStore();
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Close export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };

        if (showExportMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExportMenu]);

    const handleQuickExport = async (format: 'png' | 'svg' | 'pdf') => {
        setIsExporting(true);
        setShowExportMenu(false);
        
        try {
            // Find the ReactFlow canvas element
            const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
            if (!reactFlowElement) {
                throw new Error('Diagram canvas not found. Please make sure the diagram is loaded.');
            }

            const options: ExportOptions = {
                format,
                quality: 1,
                scale: 2,
                backgroundColor: '#ffffff',
                includeEdges: true,
                includeColumnDetails: true,
                includeEdgeLabels: true,
                filename: `erd-diagram-${Date.now()}`
            };

            await ExportEngine.exportDiagram(reactFlowElement, options);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleDocumentationExport = (format: 'markdown' | 'pdf') => {
        setIsExporting(true);
        setShowExportMenu(false);
        
        try {
            ExportEngine.generateDocumentation(nodes, edges, {
                format,
                includeColumnDetails: true,
                includeRelationships: true,
                includeStatistics: true,
                filename: `schema-documentation-${Date.now()}`
            });
        } catch (error) {
            console.error('Documentation export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            {/* Main Toolbar */}
            <div className="fixed bottom-6 right-6 z-40">
                <div className="bg-card border border-border rounded-lg shadow-xl p-2">
                    {/* Toolbar Header */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
                        <span className="text-xs font-medium text-muted-foreground px-1">Tools</span>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 hover:bg-muted rounded transition-colors"
                        >
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                        </button>
                    </div>
                    
                    {/* Toolbar Buttons */}
                    {isExpanded && (
                        <div className="flex flex-col gap-2">
                            {/* Export Button with Menu */}
                            <div className="relative" ref={exportMenuRef}>
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    disabled={isExporting}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    title="Export diagram"
                                >
                                    {isExporting ? (
                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                    Export
                                </button>
                                
                                {/* Export Menu */}
                                {showExportMenu && (
                                    <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-xl p-2 min-w-[200px]">
                                        <div className="text-xs font-semibold text-muted-foreground px-2 py-1 border-b border-border mb-2">
                                            Quick Export
                                        </div>
                                        
                                        {/* Image Export Options */}
                                        <div className="space-y-1 mb-2">
                                            <div className="text-xs font-medium text-foreground px-2 py-1">Image</div>
                                            <button
                                                onClick={() => handleQuickExport('png')}
                                                disabled={isExporting}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded transition-colors disabled:opacity-50"
                                            >
                                                <FileImage className="w-3 h-3" />
                                                PNG
                                            </button>
                                            <button
                                                onClick={() => handleQuickExport('svg')}
                                                disabled={isExporting}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded transition-colors disabled:opacity-50"
                                            >
                                                <FileText className="w-3 h-3" />
                                                SVG
                                            </button>
                                            <button
                                                onClick={() => handleQuickExport('pdf')}
                                                disabled={isExporting}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded transition-colors disabled:opacity-50"
                                            >
                                                <File className="w-3 h-3" />
                                                PDF
                                            </button>
                                        </div>
                                        
                                        {/* Documentation Export Options */}
                                        <div className="space-y-1">
                                            <div className="text-xs font-medium text-foreground px-2 py-1 border-t border-border">Documentation</div>
                                            <button
                                                onClick={() => handleDocumentationExport('markdown')}
                                                disabled={isExporting}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded transition-colors disabled:opacity-50"
                                            >
                                                <FileText className="w-3 h-3" />
                                                Markdown
                                            </button>
                                            <button
                                                onClick={() => handleDocumentationExport('pdf')}
                                                disabled={isExporting}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded transition-colors disabled:opacity-50"
                                            >
                                                <File className="w-3 h-3" />
                                                Documentation PDF
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* History Panel Button */}
                            <button
                                onClick={() => setShowHistoryPanel(true)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                title="History & Versions"
                            >
                                <History className="w-4 h-4" />
                                History
                            </button>

                            {/* SQL Export Panel Button */}
                            <button
                                onClick={() => setShowSQLExportPanel(true)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                title="Export SQL"
                            >
                                <Database className="w-4 h-4" />
                                SQL Export
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* History Panel */}
            {showHistoryPanel && (
                <div 
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowHistoryPanel(false)}
                >
                    <div 
                        className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <HistoryPanel 
                            isOpen={showHistoryPanel} 
                            onClose={() => setShowHistoryPanel(false)} 
                        />
                    </div>
                </div>
            )}

            {/* SQL Export Panel */}
            {showSQLExportPanel && (
                <div 
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowSQLExportPanel(false)}
                >
                    <div 
                        className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <SQLExportPanel 
                            isOpen={showSQLExportPanel} 
                            onClose={() => setShowSQLExportPanel(false)} 
                        />
                    </div>
                </div>
            )}
        </>
    );
}
