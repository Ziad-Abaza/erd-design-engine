"use client"

import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import { KeyRound, Link, Fingerprint, Plus, Trash2, Edit3, Check, X, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDiagramStore } from '@/store/use-diagram-store';
import { TableContextMenu, ColumnContextMenu } from '../context-menu';
import { ValidationEngine, ValidationIssue } from '@/lib/validation-engine';

export type Column = {
    id: string;
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isNullable: boolean;
    isUnique?: boolean;
    isIndexed?: boolean;
    defaultValue?: string;
    autoIncrement?: boolean;
    collation?: string;
    comment?: string;
    referencedTable?: string;
    referencedColumn?: string;
};

export type TableIndex = {
    id: string;
    name: string;
    columns: string[];
    type: 'INDEX' | 'UNIQUE' | 'FULLTEXT' | 'SPATIAL';
    comment?: string;
};

export type TableNodeData = {
    label: string;
    columns: Column[];
    engine?: 'InnoDB' | 'MyISAM' | 'MEMORY' | 'ARCHIVE' | 'CSV';
    collation?: string;
    comment?: string;
    indexes?: TableIndex[];
};

const TableNode = ({ data, selected, id, type }: NodeProps<TableNodeData>) => {
    const [editingTable, setEditingTable] = useState(false);
    const [editingColumn, setEditingColumn] = useState<string | null>(null);
    const [newColumnName, setNewColumnName] = useState('');
    const [newColumnType, setNewColumnType] = useState('varchar(255)');
    const [tableName, setTableName] = useState(data.label);
    const [columnNames, setColumnNames] = useState<Record<string, string>>({});
    const [draggedColumn, setDraggedColumn] = useState<{ columnId: string; columnName: string } | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        type: 'table' | 'column';
        position: { x: number; y: number };
        data?: any;
    } | null>(null);

    const {
        renameTable,
        renameColumn,
        deleteColumn,
        addColumn,
        duplicateColumn,
        deleteTable,
        createForeignKey,
        getValidationIssues
    } = useDiagramStore();

    // Get validation issues for this table
    const validationIssues = getValidationIssues().filter(issue => issue.tableId === id);
    const tableErrors = validationIssues.filter(issue => issue.type === 'error');
    const tableWarnings = validationIssues.filter(issue => issue.type === 'warning');

    // Get validation issues for specific columns
    const getColumnValidationIssues = (columnId: string) => {
        return validationIssues.filter(issue => issue.columnId === columnId);
    };

    const getValidationIndicator = () => {
        if (tableErrors.length > 0) {
            return <XCircle className="w-4 h-4 text-red-500" />;
        }
        if (tableWarnings.length > 0) {
            return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        }
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    };

    const getValidationBorderColor = () => {
        if (tableErrors.length > 0) {
            return 'border-red-500';
        }
        if (tableWarnings.length > 0) {
            return 'border-yellow-500';
        }
        return '';
    };

    const getColumnValidationBorderColor = (columnId: string) => {
        const columnIssues = getColumnValidationIssues(columnId);
        if (columnIssues.some(issue => issue.type === 'error')) {
            return 'border-l-2 border-l-red-500';
        }
        if (columnIssues.some(issue => issue.type === 'warning')) {
            return 'border-l-2 border-l-yellow-500';
        }
        return '';
    };

    const handleTableRename = useCallback(() => {
        if (tableName.trim() && tableName !== data.label) {
            renameTable(id, tableName.trim());
        }
        setEditingTable(false);
    }, [tableName, data.label, id, renameTable]);

    const handleColumnRename = useCallback((columnId: string) => {
        const newName = columnNames[columnId];
        if (newName?.trim() && newName !== data.columns.find(c => c.id === columnId)?.name) {
            renameColumn(id, columnId, newName.trim());
        }
        setEditingColumn(null);
        setColumnNames(prev => ({ ...prev, [columnId]: '' }));
    }, [columnNames, data.columns, id, renameColumn, renameColumn]);

    const handleAddColumn = useCallback(() => {
        if (newColumnName.trim()) {
            addColumn(id, {
                id: `temp_${Date.now()}`,
                name: newColumnName.trim(),
                type: newColumnType,
                isPrimaryKey: false,
                isForeignKey: false,
                isNullable: true
            });
            setNewColumnName('');
            setNewColumnType('varchar(255)');
        }
    }, [newColumnName, newColumnType, id, addColumn]);

    const handleDeleteColumn = useCallback((columnId: string) => {
        deleteColumn(id, columnId);
    }, [id, deleteColumn]);

    const handleDuplicateColumn = useCallback((columnId: string) => {
        duplicateColumn(id, columnId);
    }, [id, duplicateColumn]);

    const handleDeleteTable = useCallback(() => {
        deleteTable(id);
    }, [id, deleteTable]);

    const handleDragStart = useCallback((e: React.DragEvent, columnId: string, columnName: string) => {
        setDraggedColumn({ columnId, columnName });
        e.dataTransfer.effectAllowed = 'link';
        e.dataTransfer.setData('text/plain', JSON.stringify({ sourceTableId: id, columnId, columnName }));
    }, [id]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'link';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetColumnId: string) => {
        e.preventDefault();

        try {
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const { sourceTableId, columnId, columnName } = dragData;

            // Don't allow creating FK to the same table
            if (sourceTableId === id) {
                return;
            }

            // Create foreign key relationship
            createForeignKey(sourceTableId, columnId, id, targetColumnId);

            // Show success feedback (could be enhanced with toast)
            console.log(`Created FK: ${columnName} -> ${data.columns.find(c => c.id === targetColumnId)?.name}`);
        } catch (error) {
            console.error('Failed to create foreign key:', error);
        }

        setDraggedColumn(null);
    }, [id, data.columns, createForeignKey]);

    const handleDragEnd = useCallback(() => {
        setDraggedColumn(null);
    }, []);

    const handleTableContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            type: 'table',
            position: { x: e.clientX, y: e.clientY },
            data: { tableId: id, tableName: data.label }
        });
    }, [id, data.label]);

    const handleColumnContextMenu = useCallback((e: React.MouseEvent, column: Column) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            type: 'column',
            position: { x: e.clientX, y: e.clientY },
            data: {
                tableId: id,
                columnId: column.id,
                columnName: column.name,
                columnType: column.type,
                isPrimaryKey: column.isPrimaryKey,
                isForeignKey: column.isForeignKey,
                isUnique: column.isUnique
            }
        });
    }, [id]);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    return (
        <>
            <NodeResizer
                minWidth={200}
                minHeight={150}
                isVisible={selected}
                lineClassName="border-primary"
                handleClassName="h-3 w-3 bg-white border-2 border-primary rounded"
            />
            <div
                className={cn(
                    "bg-card border rounded-md shadow-sm min-w-[200px] transition-all w-full h-full",
                    selected ? "border-primary ring-1 ring-primary shadow-lg scale-[1.01]" : "border-border",
                    getValidationBorderColor()
                )}
                onContextMenu={handleTableContextMenu}
            >
                {/* Table Header */}
                <div className={cn(
                    "p-2 border-b border-border font-bold text-sm flex items-center justify-between rounded-t-md",
                    type === 'junctionTable' ? "bg-purple-500/10 text-purple-700 dark:text-purple-300" : "bg-secondary/50"
                )}>
                    {editingTable ? (
                        <div className="flex items-center gap-1 flex-1">
                            <input
                                type="text"
                                value={tableName}
                                onChange={(e) => setTableName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleTableRename()}
                                className="bg-background border rounded px-1 py-0.5 text-xs flex-1"
                                autoFocus
                            />
                            <button onClick={handleTableRename} className="text-green-600 hover:text-green-700">
                                <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingTable(false)} className="text-red-600 hover:text-red-700">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 flex-1 justify-center">
                                {data.label}
                                {(tableErrors.length > 0 || tableWarnings.length > 0) && (
                                    <div className="flex items-center gap-1">
                                        {getValidationIndicator()}
                                        <span className="text-xs text-muted-foreground">
                                            {tableErrors.length + tableWarnings.length}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => setEditingTable(true)}
                                    className="text-muted-foreground hover:text-foreground p-0.5"
                                >
                                    <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={handleDeleteTable}
                                    className="text-muted-foreground hover:text-red-600 p-0.5"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Columns */}
                <div className="p-2 space-y-1">
                    {data.columns.map((col) => (
                        <div key={col.id} className="group">
                            {editingColumn === col.id ? (
                                <div className="flex items-center gap-1 text-xs">
                                    <input
                                        type="text"
                                        value={columnNames[col.id] || col.name}
                                        onChange={(e) => setColumnNames(prev => ({ ...prev, [col.id]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleColumnRename(col.id)}
                                        className="bg-background border rounded px-1 py-0.5 flex-1"
                                        autoFocus
                                    />
                                    <button onClick={() => handleColumnRename(col.id)} className="text-green-600 hover:text-green-700">
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => setEditingColumn(null)} className="text-red-600 hover:text-red-700">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className={cn(
                                        "flex items-center justify-between text-xs gap-2 p-1 rounded transition-colors cursor-default",
                                        col.isPrimaryKey ? "hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "hover:bg-muted",
                                        draggedColumn?.columnId === col.id && "opacity-50",
                                        getColumnValidationBorderColor(col.id)
                                    )}
                                    draggable={!col.isPrimaryKey}
                                    onDragStart={(e) => handleDragStart(e, col.id, col.name)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, col.id)}
                                    onDragEnd={handleDragEnd}
                                    onContextMenu={(e) => handleColumnContextMenu(e, col)}
                                >
                                    <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                                        {col.isPrimaryKey && <KeyRound className="w-3 h-3 text-yellow-500 shrink-0" />}
                                        {col.isForeignKey && <Link className="w-3 h-3 text-blue-500 shrink-0" />}
                                        {col.isUnique && !col.isPrimaryKey && <Fingerprint className="w-3 h-3 text-purple-500 shrink-0" />}
                                        <span className={cn(
                                            "font-mono truncate",
                                            col.isPrimaryKey ? "font-bold text-foreground" : "text-foreground/90",
                                            !col.isPrimaryKey && "cursor-move hover:text-primary"
                                        )}>{col.name}</span>
                                        {getColumnValidationIssues(col.id).length > 0 && (
                                            <div className="flex items-center gap-1">
                                                {getColumnValidationIssues(col.id).some(issue => issue.type === 'error') && (
                                                    <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                                                )}
                                                {getColumnValidationIssues(col.id).some(issue => issue.type === 'warning') && !getColumnValidationIssues(col.id).some(issue => issue.type === 'error') && (
                                                    <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                                        <span className="text-[10px] uppercase opacity-70">{col.type}</span>
                                        {col.isNullable && <span className="text-[9px] border border-border px-0.5 rounded text-muted-foreground/70">NULL</span>}
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingColumn(col.id)}
                                                className="text-muted-foreground hover:text-foreground p-0.5"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleDuplicateColumn(col.id)}
                                                className="text-muted-foreground hover:text-foreground p-0.5"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteColumn(col.id)}
                                                className="text-muted-foreground hover:text-red-600 p-0.5"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add New Column */}
                    <div className="border-t border-border pt-2 mt-2">
                        <div className="flex items-center gap-1 text-xs">
                            <input
                                type="text"
                                placeholder="Column name"
                                value={newColumnName}
                                onChange={(e) => setNewColumnName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                                className="bg-background border rounded px-1 py-0.5 flex-1"
                            />
                            <select
                                value={newColumnType}
                                onChange={(e) => setNewColumnType(e.target.value)}
                                className="bg-background border rounded px-1 py-0.5 text-xs"
                            >
                                <optgroup label="Numeric">
                                    <option value="int">INT</option>
                                    <option value="bigint">BIGINT</option>
                                    <option value="tinyint">TINYINT</option>
                                    <option value="decimal">DECIMAL</option>
                                    <option value="double">DOUBLE</option>
                                </optgroup>
                                <optgroup label="String">
                                    <option value="varchar(255)">VARCHAR</option>
                                    <option value="text">TEXT</option>
                                    <option value="longtext">LONGTEXT</option>
                                    <option value="enum">ENUM</option>
                                </optgroup>
                                <optgroup label="Date/Time">
                                    <option value="timestamp">TIMESTAMP</option>
                                    <option value="datetime">DATETIME</option>
                                    <option value="date">DATE</option>
                                </optgroup>
                                <optgroup label="Other">
                                    <option value="uuid">UUID</option>
                                    <option value="boolean">BOOLEAN</option>
                                    <option value="json">JSON</option>
                                </optgroup>
                            </select>
                            <button
                                onClick={handleAddColumn}
                                className="text-green-600 hover:text-green-700 p-0.5"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    {data.columns.length === 0 && (
                        <div className="text-[10px] text-muted-foreground text-center italic py-1">
                            No columns
                        </div>
                    )}

                    {/* Drag Instructions */}
                    {data.columns.length > 0 && (
                        <div className="text-[9px] text-muted-foreground text-center italic pt-1 border-t border-border/50">
                            Drag non-PK columns to other tables to create FK • Right-click for more options
                        </div>
                    )}
                </div>

                <Handle
                    type="target"
                    position={Position.Left}
                    className="!bg-primary !border-background !w-2.5 !h-2.5"
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-primary !border-background !w-2.5 !h-2.5"
                />
            </div>

            {/* Context Menu */}
            {contextMenu && contextMenu.type === 'table' && (
                <TableContextMenu
                    tableId={contextMenu.data.tableId}
                    tableName={contextMenu.data.tableName}
                    position={contextMenu.position}
                    onClose={closeContextMenu}
                />
            )}

            {contextMenu && contextMenu.type === 'column' && (
                <ColumnContextMenu
                    tableId={contextMenu.data.tableId}
                    columnId={contextMenu.data.columnId}
                    columnName={contextMenu.data.columnName}
                    columnType={contextMenu.data.columnType}
                    isPrimaryKey={contextMenu.data.isPrimaryKey}
                    isForeignKey={contextMenu.data.isForeignKey}
                    isUnique={contextMenu.data.isUnique}
                    position={contextMenu.position}
                    onClose={closeContextMenu}
                />
            )}
        </>
    );
};

export default memo(TableNode);
