"use client";

import React, { useState } from 'react';
import { History, Database, Download, Upload, Save, RotateCcw } from 'lucide-react';
import { useDiagramStore } from '@/store/use-diagram-store';
import HistoryPanel from './history-panel';
import SQLExportPanel from './sql-export-panel';
import { cn } from '@/lib/utils';

const BottomToolbar = () => {
    const { saveToLocal, loadFromLocal, undo, redo, canUndo, canRedo } = useDiagramStore();
    const [showHistory, setShowHistory] = useState(false);
    const [showExport, setShowExport] = useState(false);

    return (
        <>
            {/* Floating Action Buttons */}
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-full shadow-lg border border-border p-2 z-40">
                {/* Undo/Redo Group */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
                    <button
                        onClick={undo}
                        disabled={!canUndo()}
                        className={cn(
                            "p-2 rounded-full transition-colors",
                            canUndo() 
                                ? "hover:bg-accent text-foreground" 
                                : "text-muted-foreground cursor-not-allowed"
                        )}
                        title="Undo"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo()}
                        className={cn(
                            "p-2 rounded-full transition-colors",
                            canRedo() 
                                ? "hover:bg-accent text-foreground" 
                                : "text-muted-foreground cursor-not-allowed"
                        )}
                        title="Redo"
                    >
                        <RotateCcw className="w-4 h-4 rotate-180" />
                    </button>
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-border" />

                {/* Save/Load Group */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
                    <button
                        onClick={saveToLocal}
                        className="p-2 rounded-full hover:bg-accent text-foreground transition-colors"
                        title="Save to Local Storage"
                    >
                        <Save className="w-4 h-4" />
                    </button>
                    <button
                        onClick={loadFromLocal}
                        className="p-2 rounded-full hover:bg-accent text-foreground transition-colors"
                        title="Load from Local Storage"
                    >
                        <Upload className="w-4 h-4" />
                    </button>
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-border" />

                {/* History/Export Group */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
                    <button
                        onClick={() => setShowHistory(true)}
                        className="p-2 rounded-full hover:bg-accent text-foreground transition-colors"
                        title="History & Versions"
                    >
                        <History className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowExport(true)}
                        className="p-2 rounded-full hover:bg-accent text-foreground transition-colors"
                        title="Export SQL"
                    >
                        <Database className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* History Panel */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div 
                        className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <HistoryPanel 
                            isOpen={showHistory} 
                            onClose={() => setShowHistory(false)} 
                        />
                    </div>
                </div>
            )}

            {/* SQL Export Panel */}
            {showExport && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div 
                        className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <SQLExportPanel 
                            isOpen={showExport} 
                            onClose={() => setShowExport(false)} 
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default BottomToolbar;
