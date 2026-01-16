"use client"

import { useState, useCallback, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, X, Database, Loader2, Download } from 'lucide-react'
import { useDiagramStore } from '@/store/use-diagram-store'
import { parseSQLFile } from '@/lib/sql-parser'
import { Node, Edge } from 'reactflow'
import { Column, TableNodeData } from './nodes/table-node'
import { LayoutEngine } from '@/lib/layout-engine'

interface ImportResult {
    success: boolean
    tables: TableNodeData[]
    edges: Edge[]
    errors: string[]
    warnings: string[]
    stats: {
        tablesCount: number
        columnsCount: number
        relationshipsCount: number
    }
    foreignKeyConstraints?: Array<{
        tableName: string
        columnName: string
        referencedTable: string
        referencedColumn: string
        onDelete?: string
        onUpdate?: string
        cardinality?: '1:1' | '1:N' | 'N:M'
    }>
}

export function SqlImportPanel({ onClose }: { onClose: () => void }) {
    const [isDragging, setIsDragging] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [sqlContent, setSqlContent] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { setNodes, setEdges, autoLayout } = useDiagramStore()

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        const sqlFile = files.find(file =>
            file.name.toLowerCase().endsWith('.sql') ||
            file.type === 'text/sql' ||
            file.type === 'text/plain'
        )

        if (sqlFile) {
            await processFile(sqlFile)
        } else {
            setImportResult({
                success: false,
                tables: [],
                edges: [],
                errors: ['Please drop a valid .sql file'],
                warnings: [],
                stats: { tablesCount: 0, columnsCount: 0, relationshipsCount: 0 }
            })
        }
    }, [])

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            await processFile(file)
        }
    }, [])

    const processFile = async (file: File) => {
        setIsProcessing(true)
        setImportResult(null)

        try {
            const content = await file.text()
            setSqlContent(content)
            await parseAndImportSQL(content)
        } catch (error) {
            setImportResult({
                success: false,
                tables: [],
                edges: [],
                errors: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`],
                warnings: [],
                stats: { tablesCount: 0, columnsCount: 0, relationshipsCount: 0 }
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const parseAndImportSQL = async (sql: string) => {
        try {
            // Parse SQL to get comprehensive result
            const parseResult = parseSQLFile(sql)

            if (parseResult.tables.length === 0) {
                setImportResult({
                    success: false,
                    tables: [],
                    edges: [],
                    errors: parseResult.errors.length > 0 ? parseResult.errors : ['No CREATE TABLE statements found in the SQL file'],
                    warnings: parseResult.warnings,
                    stats: { tablesCount: 0, columnsCount: 0, relationshipsCount: 0 }
                })
                return
            }

            // Use a single timestamp for this import operation to ensure consistent IDs
            const importTimestamp = Date.now()

            // Convert to ReactFlow nodes
            const nodes: Node[] = parseResult.tables.map((table: TableNodeData, index: number) => ({
                id: `table_${importTimestamp}_${index}`,
                type: 'table',
                position: { x: 0, y: 0 }, // Will be positioned by layout engine
                data: {
                    label: table.label,
                    columns: table.columns,
                    engine: table.engine || 'InnoDB',
                    collation: table.collation,
                    comment: table.comment,
                    indexes: table.indexes
                }
            }))

            // Create edges from foreign key relationships
            const edges: Edge[] = []
            const tableMap = new Map<string, string>()

            parseResult.tables.forEach((table: TableNodeData, index: number) => {
                tableMap.set(table.label, `table_${importTimestamp}_${index}`)
            })

            parseResult.foreignKeyConstraints.forEach((fk) => {
                const sourceTableId = tableMap.get(fk.tableName)
                const targetTableId = tableMap.get(fk.referencedTable)

                if (sourceTableId && targetTableId) {
                    const sourceTable = parseResult.tables.find((t: TableNodeData) => t.label === fk.tableName)
                    const targetTable = parseResult.tables.find((t: TableNodeData) => t.label === fk.referencedTable)

                    const sourceColumn = sourceTable?.columns.find((col: Column) => col.name === fk.columnName)
                    const targetColumn = targetTable?.columns.find((col: Column) => col.name === fk.referencedColumn)

                    if (sourceColumn && targetColumn) {
                        edges.push({
                            id: `fk_${targetTableId}_${targetColumn.id}_to_${sourceTableId}_${sourceColumn.id}`,
                            source: targetTableId, // Parent
                            target: sourceTableId, // Child
                            sourceHandle: targetColumn.id,
                            targetHandle: sourceColumn.id,
                            type: 'relationship',
                            animated: false,
                            data: {
                                relationship: {
                                    sourceTable: fk.referencedTable,
                                    targetTable: fk.tableName,
                                    sourceColumn: fk.referencedColumn,
                                    targetColumn: fk.columnName,
                                    cardinality: fk.cardinality || '1:N'
                                },
                                label: `${fk.referencedColumn} → ${fk.columnName}`,
                                onDelete: fk.onDelete,
                                onUpdate: fk.onUpdate,
                                isValid: true
                            }
                        })
                    }
                }
            })

            // Apply automatic layout
            const layoutResult = LayoutEngine.autoLayout(nodes, edges, { direction: 'TB' })

            // Calculate statistics
            const stats = {
                tablesCount: parseResult.tables.length,
                columnsCount: parseResult.tables.reduce((sum: number, table: TableNodeData) => sum + table.columns.length, 0),
                relationshipsCount: edges.length
            }

            // Combine warnings from parsing and additional checks
            const warnings: string[] = [...parseResult.warnings]

            parseResult.tables.forEach((table: TableNodeData) => {
                if (table.columns.length === 0) {
                    warnings.push(`Table "${table.label}" has no columns`)
                }
                if (!table.columns.some((col: Column) => col.isPrimaryKey)) {
                    warnings.push(`Table "${table.label}" has no primary key`)
                }
            })

            setImportResult({
                success: true,
                tables: parseResult.tables,
                edges,
                errors: parseResult.errors,
                warnings,
                stats,
                foreignKeyConstraints: parseResult.foreignKeyConstraints
            })

        } catch (error) {
            setImportResult({
                success: false,
                tables: [],
                edges: [],
                errors: [`Failed to parse SQL: ${error instanceof Error ? error.message : 'Unknown error'}`],
                warnings: [],
                stats: { tablesCount: 0, columnsCount: 0, relationshipsCount: 0 }
            })
        }
    }


    const handleImport = useCallback(() => {
        if (!importResult?.success) return

        try {
            // Use a single timestamp for this import operation to ensure consistent IDs
            const importTimestamp = Date.now()

            // Convert tables to nodes with proper layout
            const nodes: Node[] = importResult.tables.map((table, index) => ({
                id: `table_${importTimestamp}_${index}`,
                type: 'table',
                position: { x: 0, y: 0 }, // Will be positioned by layout
                data: {
                    label: table.label,
                    columns: table.columns,
                    engine: table.engine || 'InnoDB',
                    collation: table.collation,
                    comment: table.comment,
                    indexes: table.indexes
                }
            }))

            // Create edges from foreign key relationships using stored constraints
            const edges: Edge[] = []
            const tableMap = new Map<string, string>()

            importResult.tables.forEach((table: TableNodeData, index: number) => {
                tableMap.set(table.label, `table_${importTimestamp}_${index}`)
            })

            // Use the stored foreign key constraints to create edges
            if (importResult.foreignKeyConstraints) {
                importResult.foreignKeyConstraints.forEach((fk) => {
                    const sourceTableId = tableMap.get(fk.tableName)
                    const targetTableId = tableMap.get(fk.referencedTable)

                    if (sourceTableId && targetTableId) {
                        const sourceTable = importResult.tables.find((t: TableNodeData) => t.label === fk.tableName)
                        const targetTable = importResult.tables.find((t: TableNodeData) => t.label === fk.referencedTable)

                        const sourceColumn = sourceTable?.columns.find((col: Column) => col.name === fk.columnName)
                        const targetColumn = targetTable?.columns.find((col: Column) => col.name === fk.referencedColumn)

                        if (sourceColumn && targetColumn) {
                            edges.push({
                                id: `fk_${targetTableId}_${targetColumn.id}_to_${sourceTableId}_${sourceColumn.id}`,
                                source: targetTableId, // Parent
                                target: sourceTableId, // Child
                                sourceHandle: targetColumn.id,
                                targetHandle: sourceColumn.id,
                                type: 'relationship',
                                animated: false,
                                data: {
                                    relationship: {
                                        sourceTable: fk.referencedTable,
                                        targetTable: fk.tableName,
                                        sourceColumn: fk.referencedColumn,
                                        targetColumn: fk.columnName,
                                        cardinality: fk.cardinality || '1:N'
                                    },
                                    label: `${fk.referencedColumn} → ${fk.columnName}`,
                                    onDelete: fk.onDelete,
                                    onUpdate: fk.onUpdate,
                                    isValid: true
                                }
                            })
                        }
                    }
                })
            }

            // Apply layout
            const layoutResult = LayoutEngine.autoLayout(nodes, edges, { direction: 'TB' })

            // Update the store
            setNodes(layoutResult.nodes)
            setEdges(edges)

            // Apply auto-layout to optimize positioning
            setTimeout(() => {
                autoLayout({ direction: 'TB', type: 'hierarchical' })
            }, 100)

            onClose()
        } catch (error) {
            console.error('Failed to import:', error)
        }
    }, [importResult, setNodes, setEdges, autoLayout, onClose])

    const handleClear = useCallback(() => {
        setImportResult(null)
        setSqlContent('')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Import SQL Schema</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {!importResult && (
                        <>
                            <div
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-muted-foreground/50'
                                    }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {isProcessing ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Processing SQL file...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <Upload className="w-12 h-12 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium">Drop your SQL file here</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                or click to browse
                                            </p>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".sql,text/sql,text/plain"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                                        >
                                            Browse Files
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="text-xs text-muted-foreground space-y-1">
                                <p>• Supports standard SQL CREATE TABLE statements</p>
                                <p>• Compatible with PostgreSQL, MySQL, and SQLite dialects</p>
                                <p>• Detects PRIMARY KEY, FOREIGN KEY, UNIQUE, and NOT NULL constraints</p>
                                <p>• Automatically creates relationships and applies intelligent layout</p>
                                <p>• For best results, use standard SQL types and avoid dialect-specific features</p>
                            </div>
                        </>
                    )}

                    {importResult && (
                        <div className="space-y-4">
                            <div className={`flex items-center gap-2 p-3 rounded-md ${importResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                                }`}>
                                {importResult.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                )}
                                <span className={`text-sm font-medium ${importResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                                    }`}>
                                    {importResult.success ? 'SQL parsed successfully!' : 'Failed to parse SQL'}
                                </span>
                            </div>

                            {importResult.success && (
                                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-md">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary">{importResult.stats.tablesCount}</div>
                                        <div className="text-xs text-muted-foreground">Tables</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary">{importResult.stats.columnsCount}</div>
                                        <div className="text-xs text-muted-foreground">Columns</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary">{importResult.stats.relationshipsCount}</div>
                                        <div className="text-xs text-muted-foreground">Relationships</div>
                                    </div>
                                </div>
                            )}

                            {importResult.errors.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-red-600">Errors:</h4>
                                    <div className="space-y-1">
                                        {importResult.errors.map((error, index) => (
                                            <div key={index} className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                                {error}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Help section for parsing errors */}
                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
                                        <h5 className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">💡 Need a working example?</h5>
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                                            Download our sample SQL file that's guaranteed to work:
                                        </p>
                                        <button
                                            onClick={() => {
                                                const sampleSQL = `-- Standard SQL Schema Example
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    author_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
);`;
                                                const blob = new Blob([sampleSQL], { type: 'text/sql' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'example-schema.sql';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded transition-colors"
                                        >
                                            Download Example SQL
                                        </button>
                                    </div>
                                </div>
                            )}

                            {importResult.warnings.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-yellow-600">Warnings:</h4>
                                    <div className="space-y-1">
                                        {importResult.warnings.map((warning, index) => (
                                            <div key={index} className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                                                {warning}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {importResult.success && importResult.tables.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Detected Tables:</h4>
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {importResult.tables.map((table, index) => (
                                            <div key={index} className="text-xs bg-muted/50 p-2 rounded flex justify-between items-center">
                                                <span className="font-mono">{table.label}</span>
                                                <span className="text-muted-foreground">{table.columns.length} columns</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {sqlContent && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-medium">SQL Content Preview:</h4>
                                        <button
                                            onClick={() => {
                                                const blob = new Blob([sqlContent], { type: 'text/sql' })
                                                const url = URL.createObjectURL(blob)
                                                const a = document.createElement('a')
                                                a.href = url
                                                a.download = 'schema.sql'
                                                a.click()
                                                URL.revokeObjectURL(url)
                                            }}
                                            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                                        >
                                            <Download className="w-3 h-3" />
                                            Download
                                        </button>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-md max-h-32 overflow-y-auto">
                                        <pre className="text-xs font-mono whitespace-pre-wrap">
                                            {sqlContent.substring(0, 1000)}
                                            {sqlContent.length > 1000 && '...'}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                {importResult.success ? (
                                    <>
                                        <button
                                            onClick={handleImport}
                                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                                        >
                                            Import to Diagram
                                        </button>
                                        <button
                                            onClick={handleClear}
                                            className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
                                        >
                                            Clear
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleClear}
                                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                                        >
                                            Try Again
                                        </button>
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
