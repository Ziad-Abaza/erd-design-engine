"use client"

import React, { useState, useEffect } from 'react';
import { History, Save, Download, Upload, RotateCcw, RotateCw, Trash2, Eye, Plus, Clock, FileText } from 'lucide-react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { cn } from '@/lib/utils';

const HistoryPanel = ({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) => {
    const { 
        undo, 
        redo, 
        canUndo, 
        canRedo, 
        saveSnapshot, 
        loadSnapshot, 
        deleteSnapshot, 
        getSnapshots,
        saveToLocal,
        loadFromLocal,
        exportState,
        importState
    } = useDiagramStore();

    const [snapshots, setSnapshots] = useState(getSnapshots());
    const [snapshotName, setSnapshotName] = useState('');
    const [snapshotDescription, setSnapshotDescription] = useState('');
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [importText, setImportText] = useState('');
    const [showImportDialog, setShowImportDialog] = useState(false);

    useEffect(() => {
        setSnapshots(getSnapshots());
    }, [getSnapshots]);

    const handleSaveSnapshot = () => {
        if (snapshotName.trim()) {
            saveSnapshot(snapshotName.trim(), snapshotDescription.trim());
            setSnapshots(getSnapshots());
            setSnapshotName('');
            setSnapshotDescription('');
            setShowSaveDialog(false);
        }
    };

    const handleLoadSnapshot = (snapshotId: string) => {
        loadSnapshot(snapshotId);
        if (onClose) onClose();
    };

    const handleDeleteSnapshot = (snapshotId: string) => {
        if (confirm('Are you sure you want to delete this snapshot?')) {
            deleteSnapshot(snapshotId);
            setSnapshots(getSnapshots());
        }
    };

    const handleExport = () => {
        const state = exportState();
        const blob = new Blob([state], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `erd-diagram-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        if (importText.trim()) {
            const success = importState(importText);
            if (success) {
                setImportText('');
                setShowImportDialog(false);
                if (onClose) onClose();
            } else {
                alert('Failed to import diagram. Please check the file format.');
            }
        }
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                setImportText(content);
                setShowImportDialog(true);
            };
            reader.readAsText(file);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    // button to open history panel
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">History & Version Management</h2>
                    </div>
                    <button
                        onClick={onClose || (() => {})}
                        className="text-muted-foreground hover:text-foreground p-1 rounded"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
                    <button
                        onClick={undo}
                        disabled={!canUndo()}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors",
                            canUndo() 
                                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                    >
                        <RotateCcw className="w-4 h-4" />
                        Undo
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo()}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors",
                            canRedo() 
                                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                    >
                        <RotateCw className="w-4 h-4" />
                        Redo
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={() => setShowSaveDialog(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Save Snapshot
                    </button>
                    <button
                        onClick={saveToLocal}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        Save Local
                    </button>
                    <button
                        onClick={loadFromLocal}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        Load Local
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <label className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Import
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileImport}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Version Snapshots
                        </h3>

                        {snapshots.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No snapshots saved yet</p>
                                <p className="text-sm">Create your first snapshot to save the current state</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {snapshots.map((snapshot) => (
                                    <div
                                        key={snapshot.id}
                                        className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-foreground">{snapshot.name}</h4>
                                                {snapshot.description && (
                                                    <p className="text-sm text-muted-foreground mt-1">{snapshot.description}</p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {formatDate(snapshot.timestamp)}
                                                </p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                    <span>{snapshot.state.nodes.length} tables</span>
                                                    <span>{snapshot.state.edges.length} relationships</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4">
                                                <button
                                                    onClick={() => handleLoadSnapshot(snapshot.id)}
                                                    className="text-primary hover:text-primary/80 p-1 rounded"
                                                    title="Restore this version"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSnapshot(snapshot.id)}
                                                    className="text-red-600 hover:text-red-700 p-1 rounded"
                                                    title="Delete snapshot"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Snapshot Dialog */}
                {showSaveDialog && (
                    <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
                        <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold mb-4">Save Snapshot</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={snapshotName}
                                        onChange={(e) => setSnapshotName(e.target.value)}
                                        className="w-full px-3 py-2 border border-border rounded bg-background"
                                        placeholder="Enter snapshot name..."
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Description (optional)</label>
                                    <textarea
                                        value={snapshotDescription}
                                        onChange={(e) => setSnapshotDescription(e.target.value)}
                                        className="w-full px-3 py-2 border border-border rounded bg-background resize-none"
                                        rows={3}
                                        placeholder="Add a description..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => {
                                        setShowSaveDialog(false);
                                        setSnapshotName('');
                                        setSnapshotDescription('');
                                    }}
                                    className="px-4 py-2 text-sm border border-border rounded hover:bg-muted"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveSnapshot}
                                    disabled={!snapshotName.trim()}
                                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Import Dialog */}
                {showImportDialog && (
                    <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
                        <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full p-6">
                            <h3 className="text-lg font-semibold mb-4">Import Diagram State</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">JSON Data</label>
                                    <textarea
                                        value={importText}
                                        onChange={(e) => setImportText(e.target.value)}
                                        className="w-full px-3 py-2 border border-border rounded bg-background font-mono text-xs resize-none"
                                        rows={12}
                                        placeholder="Paste your exported diagram JSON here..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => {
                                        setShowImportDialog(false);
                                        setImportText('');
                                    }}
                                    className="px-4 py-2 text-sm border border-border rounded hover:bg-muted"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={!importText.trim()}
                                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Import
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPanel;
