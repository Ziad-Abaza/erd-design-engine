"use client"

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useDiagramStore } from '@/store/use-diagram-store';
import {
    Edit3,
    Trash2,
    Copy,
    Plus,
    KeyRound,
    Link,
    Fingerprint,
    Hash,
    ArrowRightLeft
} from 'lucide-react';

export type ContextMenuAction = {
    id: string;
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    separator?: boolean;
    disabled?: boolean;
    danger?: boolean;
};

interface ContextMenuProps {
    actions: ContextMenuAction[];
    position: { x: number; y: number };
    onClose: () => void;
}

const ContextMenu = ({ actions, position, onClose }: ContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    useEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;

        const rect = menu.getBoundingClientRect();
        const { innerWidth, innerHeight } = window;

        let adjustedX = position.x;
        let adjustedY = position.y;

        // Adjust horizontal position if menu would go off screen
        if (position.x + rect.width > innerWidth) {
            adjustedX = innerWidth - rect.width - 10;
        }

        // Adjust vertical position if menu would go off screen
        if (position.y + rect.height > innerHeight) {
            adjustedY = innerHeight - rect.height - 10;
        }

        // Ensure menu doesn't go off the left or top edges
        adjustedX = Math.max(10, adjustedX);
        adjustedY = Math.max(10, adjustedY);

        setAdjustedPosition({ x: adjustedX, y: adjustedY });
    }, [position]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleActionClick = (action: ContextMenuAction) => {
        if (!action.disabled && action.onClick) {
            action.onClick();
            onClose();
        }
    };

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[180px] bg-card border border-border rounded-md shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
            }}
        >
            {actions.map((action, index) => {
                if (action.separator) {
                    return (
                        <div key={`separator-${index}`} className="my-1 border-t border-border" />
                    );
                }

                return (
                    <button
                        key={action.id}
                        onClick={() => handleActionClick(action)}
                        disabled={action.disabled}
                        className={cn(
                            "w-full px-2 py-1.5 text-left text-xs flex items-center gap-2 transition-colors",
                            "hover:bg-muted focus:bg-muted",
                            action.disabled && "opacity-50 cursor-not-allowed",
                            action.danger && "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        )}
                    >
                        {action.icon && <span className="w-3 h-3 shrink-0">{action.icon}</span>}
                        <span className="truncate">{action.label}</span>
                    </button>
                );
            })}
        </div>,
        document.body
    );
};

export const TableContextMenu = memo(({
    tableId,
    tableName,
    position,
    onClose
}: {
    tableId: string;
    tableName: string;
    position: { x: number; y: number };
    onClose: () => void;
}) => {
    const {
        renameTable,
        deleteTable,
        duplicateTable,
        addColumn,
        selectNode,
        nodes,
        createJunctionTable
    } = useDiagramStore();

    const actions: ContextMenuAction[] = [
        {
            id: 'rename',
            label: 'Rename Table',
            icon: <Edit3 className="w-3 h-3" />,
            onClick: () => {
                const newName = prompt(`Rename table "${tableName}":`, tableName);
                if (newName?.trim() && newName !== tableName) {
                    renameTable(tableId, newName.trim());
                }
            }
        },
        {
            id: 'duplicate',
            label: 'Duplicate Table',
            icon: <Copy className="w-3 h-3" />,
            onClick: () => {
                duplicateTable(tableId);
            }
        },
        {
            id: 'separator1',
            label: '',
            separator: true,
            onClick: () => { }
        },
        {
            id: 'create-many-to-many',
            label: 'Create Many-to-Many Relationship',
            icon: <ArrowRightLeft className="w-3 h-3" />,
            onClick: () => {
                // Get other tables for selection
                const otherTables = nodes.filter(n => n.id !== tableId && n.type === 'table');
                if (otherTables.length === 0) {
                    alert('No other tables available for many-to-many relationship');
                    return;
                }

                const tableNames = otherTables.map(n => n.data.label);
                const selection = prompt(
                    `Select target table for many-to-many relationship:\n${tableNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}\n\nEnter number or table name:`,
                    ''
                );

                if (!selection?.trim()) return;

                let targetTable;
                const selectedIndex = parseInt(selection.trim());

                if (selectedIndex >= 1 && selectedIndex <= tableNames.length) {
                    targetTable = otherTables[selectedIndex - 1];
                } else {
                    targetTable = otherTables.find(n =>
                        n.data.label.toLowerCase() === selection.trim().toLowerCase()
                    );
                }

                if (targetTable) {
                    createJunctionTable(tableId, targetTable.id);
                } else {
                    alert('Invalid table selection');
                }
            }
        },
        {
            id: 'separator2',
            label: '',
            separator: true,
            onClick: () => { }
        },
        {
            id: 'add-column',
            label: 'Add Column',
            icon: <Plus className="w-3 h-3" />,
            onClick: () => {
                const columnName = prompt('Enter column name:');
                if (columnName?.trim()) {
                    addColumn(tableId, {
                        id: `temp_${Date.now()}`,
                        name: columnName.trim(),
                        type: 'varchar(255)',
                        isPrimaryKey: false,
                        isForeignKey: false,
                        isNullable: true
                    });
                }
            }
        },
        {
            id: 'separator3',
            label: '',
            separator: true,
            onClick: () => { }
        },
        {
            id: 'delete',
            label: 'Delete Table',
            icon: <Trash2 className="w-3 h-3" />,
            onClick: () => {
                if (confirm(`Are you sure you want to delete table "${tableName}"?`)) {
                    deleteTable(tableId);
                }
            },
            danger: true
        }
    ];

    return <ContextMenu actions={actions} position={position} onClose={onClose} />;
});

export const ColumnContextMenu = memo(({
    tableId,
    columnId,
    columnName,
    columnType,
    isPrimaryKey,
    isForeignKey,
    isUnique,
    position,
    onClose
}: {
    tableId: string;
    columnId: string;
    columnName: string;
    columnType: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isUnique: boolean;
    position: { x: number; y: number };
    onClose: () => void;
}) => {
    const {
        renameColumn,
        deleteColumn,
        duplicateColumn,
        addColumn
    } = useDiagramStore();

    const actions: ContextMenuAction[] = [
        {
            id: 'rename',
            label: 'Rename Column',
            icon: <Edit3 className="w-3 h-3" />,
            onClick: () => {
                const newName = prompt(`Rename column "${columnName}":`, columnName);
                if (newName?.trim() && newName !== columnName) {
                    renameColumn(tableId, columnId, newName.trim());
                }
            }
        },
        {
            id: 'duplicate',
            label: 'Duplicate Column',
            icon: <Copy className="w-3 h-3" />,
            onClick: () => {
                duplicateColumn(tableId, columnId);
            }
        },
        {
            id: 'separator1',
            label: '',
            separator: true,
            onClick: () => { }
        },
        {
            id: 'toggle-pk',
            label: isPrimaryKey ? 'Remove Primary Key' : 'Set as Primary Key',
            icon: <KeyRound className="w-3 h-3" />,
            onClick: () => {
                // This would need to be implemented in the store
                console.log('Toggle PK not yet implemented');
            },
            disabled: isForeignKey // Can't be both PK and FK
        },
        {
            id: 'toggle-unique',
            label: isUnique ? 'Remove Unique' : 'Set as Unique',
            icon: <Fingerprint className="w-3 h-3" />,
            onClick: () => {
                // This would need to be implemented in the store
                console.log('Toggle Unique not yet implemented');
            }
        },
        {
            id: 'toggle-nullable',
            label: 'Toggle Nullable',
            icon: <Hash className="w-3 h-3" />,
            onClick: () => {
                // This would need to be implemented in the store
                console.log('Toggle Nullable not yet implemented');
            }
        },
        {
            id: 'separator2',
            label: '',
            separator: true,
            onClick: () => { }
        },
        {
            id: 'delete',
            label: 'Delete Column',
            icon: <Trash2 className="w-3 h-3" />,
            onClick: () => {
                if (confirm(`Are you sure you want to delete column "${columnName}"?`)) {
                    deleteColumn(tableId, columnId);
                }
            },
            danger: true
        }
    ];

    return <ContextMenu actions={actions} position={position} onClose={onClose} />;
});

export const RelationshipContextMenu = memo(({
    edgeId,
    sourceTable,
    targetTable,
    targetColumn,
    position,
    onClose
}: {
    edgeId: string;
    sourceTable: string;
    targetTable: string;
    targetColumn: string;
    position: { x: number; y: number };
    onClose: () => void;
}) => {
    const { deleteRelationship, resetEdgePath } = useDiagramStore();

    const actions: ContextMenuAction[] = [
        {
            id: 'reset-path',
            label: 'Reset Edge Path',
            icon: <Edit3 className="w-3 h-3" />,
            onClick: () => {
                resetEdgePath(edgeId);
            }
        },
        {
            id: 'separator',
            label: '',
            separator: true,
            onClick: () => { }
        },
        {
            id: 'delete-rel',
            label: 'Delete Relationship Only',
            icon: <Link className="w-3 h-3" />,
            onClick: () => {
                deleteRelationship(edgeId, false);
            }
        },
        {
            id: 'delete-full',
            label: `Delete Relationship + ${targetColumn}`,
            icon: <Trash2 className="w-3 h-3" />,
            onClick: () => {
                if (confirm(`Remove relationship and delete column "${targetColumn}" from "${targetTable}"?`)) {
                    deleteRelationship(edgeId, true);
                }
            },
            danger: true
        }
    ];

    return <ContextMenu actions={actions} position={position} onClose={onClose} />;
});

export default memo(ContextMenu);
