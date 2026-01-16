"use client"

import React, { useState, useEffect } from 'react';
import { Database, Download, Copy, Check, Settings, AlertTriangle, FileText, Play, RefreshCw, GitCompare } from 'lucide-react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { generateSQL, SQLOptions, SQLGenerationResult } from '@/lib/sql-generator';
import { cn } from '@/lib/utils';

const SQLExportPanel = ({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) => {
    const { nodes, edges, selectedNodes } = useDiagramStore();
    const [sqlResult, setSqlResult] = useState<SQLGenerationResult | null>(null);
    const [options, setOptions] = useState<SQLOptions>({
        includeComments: true,
        includeIfNotExists: true,
        includeForeignKeys: true,
        includeIndexes: true,
        dropTables: false,
        selectedOnly: false,
        selectedNodes: []
    });
    const [copied, setCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSyncDialog, setShowSyncDialog] = useState(false);
    const [existingSQL, setExistingSQL] = useState('');

    useEffect(() => {
        setOptions(prev => ({ ...prev, selectedNodes }));
    }, [selectedNodes]);

    useEffect(() => {
        if (isOpen) {
            generateSQLCode();
        }
    }, [isOpen, options, nodes, edges]);

    const generateSQLCode = async () => {
        setIsGenerating(true);
        try {
            const result = generateSQL(nodes, edges, options);
            setSqlResult(result);
        } catch (error) {
            setSqlResult({
                sql: '',
                warnings: [],
                errors: ['Failed to generate SQL: ' + (error instanceof Error ? error.message : 'Unknown error')]
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyToClipboard = async () => {
        if (sqlResult?.sql) {
            try {
                await navigator.clipboard.writeText(sqlResult.sql);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (error) {
                console.error('Failed to copy to clipboard:', error);
            }
        }
    };

    const handleDownload = () => {
        if (sqlResult?.sql) {
            const blob = new Blob([sqlResult.sql], { type: 'text/sql' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schema-${new Date().toISOString().split('T')[0]}.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleDatabaseSync = () => {
        setShowSyncDialog(true);
    };

    const generateDiffSQL = () => {
        if (!existingSQL.trim() || !sqlResult?.sql) {
            return '';
        }

        // Basic diff logic - in a real implementation, this would be more sophisticated
        const existingLines = existingSQL.split('\n').filter(line => line.trim());
        const newLines = sqlResult.sql.split('\n').filter(line => line.trim());
        
        const differences: string[] = [];
        differences.push('-- Database Schema Differences');
        differences.push(`-- Generated on: ${new Date().toISOString()}`);
        differences.push('-- This is a basic diff implementation');
        differences.push('-- Review carefully before applying to production database');
        differences.push('');

        // For now, just return the new SQL as the "diff"
        // In a real implementation, you'd parse both schemas and generate ALTER statements
        differences.push('-- Potential changes (review required):');
        differences.push(sqlResult.sql);

        return differences.join('\n');
    };

    const handleOptionChange = (key: keyof SQLOptions, value: any) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    const getSelectedTablesCount = () => {
        return options.selectedOnly ? selectedNodes.length : nodes.filter(n => n.type === 'table').length;
    };

    // button to open sql export panel
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">SQL Export</h2>
                        <span className="text-sm text-muted-foreground">
                            ({getSelectedTablesCount()} tables)
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={generateSQLCode}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
                            Regenerate
                        </button>
                        <button
                            onClick={onClose || (() => {})}
                            className="text-muted-foreground hover:text-foreground p-1 rounded"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Options Panel */}
                    <div className="w-80 border-r border-border p-4 space-y-4 overflow-y-auto">
                        <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Export Options
                            </h3>
                            
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={options.includeComments}
                                        onChange={(e) => handleOptionChange('includeComments', e.target.checked)}
                                        className="rounded border-border"
                                    />
                                    <span>Include comments</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={options.includeIfNotExists}
                                        onChange={(e) => handleOptionChange('includeIfNotExists', e.target.checked)}
                                        className="rounded border-border"
                                    />
                                    <span>IF NOT EXISTS</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={options.includeForeignKeys}
                                        onChange={(e) => handleOptionChange('includeForeignKeys', e.target.checked)}
                                        className="rounded border-border"
                                    />
                                    <span>Foreign keys</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={options.includeIndexes}
                                        onChange={(e) => handleOptionChange('includeIndexes', e.target.checked)}
                                        className="rounded border-border"
                                    />
                                    <span>Indexes</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={options.dropTables}
                                        onChange={(e) => handleOptionChange('dropTables', e.target.checked)}
                                        className="rounded border-border"
                                    />
                                    <span>DROP statements</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={options.selectedOnly}
                                        onChange={(e) => handleOptionChange('selectedOnly', e.target.checked)}
                                        className="rounded border-border"
                                        disabled={selectedNodes.length === 0}
                                    />
                                    <span>Selected tables only</span>
                                </label>
                            </div>
                        </div>

                        {/* Statistics */}
                        <div className="border-t border-border pt-4">
                            <h4 className="text-sm font-medium mb-2">Statistics</h4>
                            <div className="space-y-1 text-xs text-muted-foreground">
                                <div>Total tables: {nodes.filter(n => n.type === 'table').length}</div>
                                <div>Selected tables: {selectedNodes.length}</div>
                                <div>Relationships: {edges.length}</div>
                                <div>Export mode: {options.selectedOnly ? 'Selected' : 'All'}</div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-border pt-4 space-y-2">
                            <button
                                onClick={handleCopyToClipboard}
                                disabled={!sqlResult?.sql || copied}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy to Clipboard'}
                            </button>
                            <button
                                onClick={handleDownload}
                                disabled={!sqlResult?.sql}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                Download .sql
                            </button>
                            <button
                                onClick={handleDatabaseSync}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                            >
                                <GitCompare className="w-4 h-4" />
                                Database Sync
                            </button>
                        </div>
                    </div>

                    {/* SQL Output */}
                    <div className="flex-1 flex flex-col">
                        <div className="p-4 border-b border-border">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Generated SQL
                                </h3>
                                {isGenerating && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Warnings and Errors */}
                        {sqlResult && (sqlResult.warnings.length > 0 || sqlResult.errors.length > 0) && (
                            <div className="p-4 border-b border-border space-y-2">
                                {sqlResult.warnings.map((warning, index) => (
                                    <div key={index} className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                        <span>{warning}</span>
                                    </div>
                                ))}
                                {sqlResult.errors.map((error, index) => (
                                    <div key={index} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* SQL Code */}
                        <div className="flex-1 p-4 overflow-auto">
                            {isGenerating ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <div className="text-center">
                                        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                                        <p>Generating SQL code...</p>
                                    </div>
                                </div>
                            ) : sqlResult?.sql ? (
                                <pre className="text-xs font-mono bg-muted/50 p-4 rounded border border-border overflow-auto h-full">
                                    <code>{sqlResult.sql}</code>
                                </pre>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <div className="text-center">
                                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>No SQL generated</p>
                                        <p className="text-sm">Check export options and try again</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Database Sync Dialog */}
            {showSyncDialog && (
                <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[80vh] flex flex-col">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <GitCompare className="w-5 h-5" />
                            Database Schema Sync
                        </h3>
                        
                        <div className="space-y-4 flex-1 overflow-hidden">
                            <div>
                                <label className="block text-sm font-medium mb-1">Existing Database Schema</label>
                                <textarea
                                    value={existingSQL}
                                    onChange={(e) => setExistingSQL(e.target.value)}
                                    className="w-full px-3 py-2 border border-border rounded bg-background font-mono text-xs resize-none"
                                    rows={8}
                                    placeholder="Paste your existing database schema SQL here..."
                                />
                            </div>
                            
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setShowSyncDialog(false);
                                        setExistingSQL('');
                                    }}
                                    className="px-4 py-2 text-sm border border-border rounded hover:bg-muted"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const diffSQL = generateDiffSQL();
                                        if (diffSQL) {
                                            const blob = new Blob([diffSQL], { type: 'text/sql' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `schema-diff-${new Date().toISOString().split('T')[0]}.sql`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                        }
                                    }}
                                    disabled={!existingSQL.trim() || !sqlResult?.sql}
                                    className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                                >
                                    Generate Diff SQL
                                </button>
                            </div>
                            
                            <div className="text-xs text-muted-foreground border-t border-border pt-4">
                                <p className="font-medium mb-2">About Database Sync:</p>
                                <ul className="space-y-1">
                                    <li>• This is a basic diff implementation for development purposes</li>
                                    <li>• Always review generated SQL before applying to production</li>
                                    <li>• Consider using professional schema migration tools for production</li>
                                    <li>• Backup your database before applying any schema changes</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SQLExportPanel;
