import { create } from 'zustand';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
} from 'reactflow';
import { calculateSmartOrthogonalPath } from '@/lib/edge-routing';
import { RelationshipDetector } from '@/lib/relationship-detector';
import { LayoutEngine } from '@/lib/layout-engine';
import { ValidationEngine, ValidationResult, ValidationIssue } from '@/lib/validation-engine';
import { Column, TableIndex } from '@/components/editor/nodes/table-node';

export interface AISuggestion {
    id: string;
    type: 'add_foreign_key' | 'add_index' | 'change_column_type' | 'rename_column' | 'normalize_table' | 'add_unique_constraint';
    title: string;
    details: string;
    severity: 'info' | 'warning' | 'error';
    actions: {
        action: 'create_fk' | 'create_index' | 'update_column' | 'create_table' | 'rename_column';
        payload: any;
    }[];
}

interface DiagramData {
    nodes: Node[];
    edges: Edge[];
    selectedNodes: string[];
    selectedEdges: string[];
}

interface DiagramHistory {
    past: DiagramData[];
    present: DiagramData;
    future: DiagramData[];
}

interface VersionSnapshot {
    id: string;
    name: string;
    timestamp: number;
    state: DiagramData;
    description?: string;
}

type DiagramStore = DiagramData & {
    nodes: Node[];
    edges: Edge[];
    selectedNodes: string[];
    selectedEdges: string[];
    history: DiagramHistory;
    snapshots: VersionSnapshot[];
    validationResult: ValidationResult | null;
    validationEnabled: boolean;
    autoValidationEnabled: boolean;
    aiEnabled: boolean;
    showRelationshipLabels: boolean;
    setAiEnabled: (enabled: boolean) => void;
    setShowRelationshipLabels: (enabled: boolean) => void;
    validationTimeout: ReturnType<typeof setTimeout> | null;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    clearDiagram: () => void;
    detectRelationships: () => void;
    autoLayout: (options?: { direction?: 'TB' | 'LR' | 'BT' | 'RL'; type?: 'hierarchical' | 'force' | 'group' }) => void;
    validateDiagram: () => { isValid: boolean; errors: string[]; warnings: string[] };
    runValidation: () => ValidationResult;
    toggleValidation: () => void;
    toggleAutoValidation: () => void;
    getValidationIssues: () => ValidationIssue[];
    fixValidationIssue: (issueId: string) => boolean;
    // Table CRUD operations
    addTable: (table: { label: string; columns?: Column[] }) => void;
    deleteTable: (tableId: string) => void;
    renameTable: (tableId: string, newName: string) => void;
    duplicateTable: (tableId: string) => void;
    // Column CRUD operations
    addColumn: (tableId: string, column: Column) => void;
    deleteColumn: (tableId: string, columnId: string) => void;
    renameColumn: (tableId: string, columnId: string, newName: string) => void;
    duplicateColumn: (tableId: string, columnId: string) => void;
    // Advanced property operations
    updateTableProperties: (tableId: string, properties: { engine?: string; collation?: string; comment?: string }) => void;
    updateColumnProperties: (tableId: string, columnId: string, properties: { type?: string; isNullable?: boolean; isUnique?: boolean; isIndexed?: boolean; defaultValue?: string; autoIncrement?: boolean; collation?: string; comment?: string }) => void;
    // Index operations
    addIndex: (tableId: string, index: Omit<TableIndex, 'id'>) => void;
    updateIndex: (tableId: string, indexId: string, properties: Partial<TableIndex>) => void;
    deleteIndex: (tableId: string, indexId: string) => void;
    // Selection operations
    selectNode: (nodeId: string) => void;
    selectMultipleNodes: (nodeIds: string[]) => void;
    clearSelection: () => void;
    deleteSelectedNodes: () => void;
    // FK operations
    createForeignKey: (sourceTableId: string, sourceColumnId: string, targetTableId: string, targetColumnId: string) => void;
    deleteRelationship: (edgeId: string, removeColumn?: boolean) => void;
    // Quick operations
    suggestIndexes: () => { tableId: string; columnName: string; reason: string }[];
    suggestForeignKeys: () => { sourceTableId: string; sourceColumnId: string; targetTableId: string; targetColumnId: string; confidence: number }[];
    createSuggestedForeignKey: (sourceTableId: string, sourceColumnId: string, targetTableId: string, targetColumnId: string) => void;
    createIndex: (tableId: string, columnId: string) => void;
    // History management
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    saveSnapshot: (name?: string, description?: string) => void;
    loadSnapshot: (snapshotId: string) => void;
    deleteSnapshot: (snapshotId: string) => void;
    getSnapshots: () => VersionSnapshot[];
    // Persistence
    saveToLocal: () => void;
    loadFromLocal: () => boolean;
    exportState: () => string;
    importState: (jsonString: string) => boolean;
    // Performance operations
    getDiagramStats: () => { totalNodes: number; totalEdges: number; totalColumns: number; memoryUsage?: number };
    optimizePerformance: () => void;
    cleanupUnusedElements: () => void;
    // Edge routing operations
    updateEdgeData: (edgeId: string, data: any) => void;
    updateEdgePathPoints: (edgeId: string, points: { x: number; y: number }[]) => void;
    resetEdgePath: (edgeId: string) => void;
    addEdgePathPoint: (edgeId: string, point: { x: number; y: number }) => void;
    removeEdgePathPoint: (edgeId: string, index: number) => void;
    updateRelationshipCardinality: (edgeId: string, cardinality: '1:1' | '1:N' | '0:1' | '0:N' | 'N:M') => void;
    // Many-to-Many relationship operations
    createJunctionTable: (sourceTableId: string, targetTableId: string, edgeId?: string) => string | null;
    convertToManyToMany: (edgeId: string) => boolean;
    resolveManyToMany: (edgeId: string) => boolean;
    // Optimized validation
    runValidationDebounced: () => void;
    // AI operations
    aiSuggestions: AISuggestion[];
    isFetchingAISuggestions: boolean;
    fetchAISuggestions: () => Promise<void>;
    applyAISuggestion: (suggestionId: string) => void;
    clearAISuggestions: () => void;
    // Chat operations
    chatMessages: { role: 'user' | 'assistant' | 'system', content: string }[];
    isChatStreaming: boolean;
    sendChatMessage: (content: string, options?: { includeSchema?: boolean, enableThinking?: boolean }) => Promise<void>;
    clearChat: () => void;
    // Create Table operation
    createTableFromNL: (prompt: string) => Promise<boolean>;
};

let validationTimeout: NodeJS.Timeout | null = null;

/**
 * Calculate smart orthogonal path points for an edge to avoid overlapping with other nodes
 * This creates an L-shaped or Z-shaped path that avoids visual clutter
 */


/**
 * Migration helper to ensure old edges work with new per-column handles
 */
const migrateEdgeHandles = (edges: Edge[]): Edge[] => {
    return edges.map(edge => {
        if (!edge.sourceHandle || !edge.targetHandle) return edge;

        let updated = false;
        const newEdge = { ...edge };

        // Migrate source handle format
        if (newEdge.sourceHandle && !newEdge.sourceHandle.includes('-source') && !newEdge.sourceHandle.includes('-target')) {
            if (!newEdge.sourceHandle.startsWith(newEdge.source + '-')) {
                newEdge.sourceHandle = `${newEdge.source}-${newEdge.sourceHandle}-source`;
            } else {
                newEdge.sourceHandle = `${newEdge.sourceHandle}-source`;
            }
            updated = true;
        }

        // Migrate target handle format
        if (newEdge.targetHandle && !newEdge.targetHandle.includes('-target') && !newEdge.targetHandle.includes('-source')) {
            if (!newEdge.targetHandle.startsWith(newEdge.target + '-')) {
                newEdge.targetHandle = `${newEdge.target}-${newEdge.targetHandle}-target`;
            } else {
                newEdge.targetHandle = `${newEdge.targetHandle}-target`;
            }
            updated = true;
        }

        return updated ? newEdge : edge;
    });
};

export const useDiagramStore = create<DiagramStore>((set, get) => ({
    // Initial state
    nodes: [
        {
            id: '1',
            position: { x: 100, y: 100 },
            type: 'table',
            data: {
                label: 'users',
                columns: [
                    { id: 'c1', name: 'id', type: 'uuid', isPrimaryKey: true, isForeignKey: false, isNullable: false },
                    { id: 'c2', name: 'email', type: 'varchar(255)', isPrimaryKey: false, isForeignKey: false, isNullable: false, isUnique: true },
                    { id: 'c3', name: 'password', type: 'varchar(255)', isPrimaryKey: false, isForeignKey: false, isNullable: false },
                    { id: 'c4', name: 'created_at', type: 'timestamp', isPrimaryKey: false, isForeignKey: false, isNullable: true },
                ],
            },
        },
        {
            id: '2',
            position: { x: 500, y: 100 },
            type: 'table',
            data: {
                label: 'posts',
                columns: [
                    { id: 'c1', name: 'id', type: 'uuid', isPrimaryKey: true, isForeignKey: false, isNullable: false },
                    { id: 'c2', name: 'user_id', type: 'uuid', isPrimaryKey: false, isForeignKey: true, isNullable: false },
                    { id: 'c3', name: 'title', type: 'varchar(255)', isPrimaryKey: false, isForeignKey: false, isNullable: false },
                    { id: 'c4', name: 'content', type: 'text', isPrimaryKey: false, isForeignKey: false, isNullable: true },
                ]
            }
        }
    ],
    edges: [],
    selectedNodes: [],
    selectedEdges: [],

    // History state
    history: {
        past: [],
        present: {
            nodes: [],
            edges: [],
            selectedNodes: [],
            selectedEdges: []
        },
        future: []
    },
    snapshots: [],

    // Validation state
    validationResult: null,
    validationEnabled: true,
    autoValidationEnabled: true, // Instructions said this was "stuck in ON", now we make it controllable
    aiEnabled: true,
    showRelationshipLabels: true,
    validationTimeout: null,

    // AI state initial
    aiSuggestions: [],
    isFetchingAISuggestions: false,

    // Chat initial state
    chatMessages: [
        { role: 'system', content: 'You are a senior database architect assistant. You help users design and optimize their Entity Relationship Diagrams.' }
    ],
    isChatStreaming: false,

    onNodesChange: (changes: NodeChange[]) => {
        const currentNodes = get().nodes;
        const newNodes = applyNodeChanges(changes, currentNodes);
        const currentEdges = get().edges;

        // Recalculate paths for ALL non-manual edges to handle obstacles moving into paths
        const updatedEdges = currentEdges.map((edge: Edge) => {
            // Only recalculate if NOT manual and endpoints exist
            if (!edge.data?.isManualPath) {
                const sourceNode = newNodes.find(n => n.id === edge.source);
                const targetNode = newNodes.find(n => n.id === edge.target);
                if (sourceNode && targetNode) {
                    const pathPoints = calculateSmartOrthogonalPath(sourceNode, targetNode, newNodes, edge.id);
                    return {
                        ...edge,
                        data: {
                            ...edge.data,
                            pathPoints
                        }
                    };
                }
            }
            return edge;
        });

        const selectedNodeIds = newNodes
            .filter(node => node.selected)
            .map(node => node.id);

        set({
            nodes: newNodes,
            edges: updatedEdges,
            selectedNodes: selectedNodeIds
        });

        // Auto-validation with debouncing
        const { autoValidationEnabled } = get();
        if (autoValidationEnabled) {
            // Clear existing timeout
            const currentTimeout = get().validationTimeout;
            if (currentTimeout) {
                clearTimeout(currentTimeout);
            }
            // Set new timeout with longer delay for better performance
            const timeoutId = setTimeout(() => get().runValidation(), 1000);
            set({ validationTimeout: timeoutId });
        }
    },
    onEdgesChange: (changes: EdgeChange[]) => {
        const currentEdges = get().edges;
        const newEdges = applyEdgeChanges(changes, currentEdges);
        const selectedEdgeIds = newEdges
            .filter(edge => edge.selected)
            .map(edge => edge.id);

        // Handle edge removals to clean up FK constraints automatically
        let updatedNodes = get().nodes;
        const removedChanges = changes.filter(change => change.type === 'remove');

        if (removedChanges.length > 0) {
            removedChanges.forEach(change => {
                const edgeId = (change as any).id;
                const edge = currentEdges.find(e => e.id === edgeId);

                if (edge?.data?.relationship) {
                    const { targetTable, targetColumn } = edge.data.relationship;
                    updatedNodes = updatedNodes.map(node => {
                        if (node.id === edge.target || node.data.label === targetTable) {
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    // Remove the foreign key column entirely
                                    columns: node.data.columns.filter((c: Column) => c.name !== targetColumn)
                                }
                            };
                        }
                        return node;
                    });
                }
            });
        }

        set({
            edges: newEdges,
            selectedEdges: selectedEdgeIds,
            nodes: updatedNodes
        });

        // Auto-validation with debouncing
        const { autoValidationEnabled } = get();
        if (autoValidationEnabled) {
            // Clear existing timeout
            const currentTimeout = get().validationTimeout;
            if (currentTimeout) {
                clearTimeout(currentTimeout);
            }
            // Set new timeout with longer delay for better performance
            const timeoutId = setTimeout(() => get().runValidation(), 1000);
            set({ validationTimeout: timeoutId });
        }
    },
    onConnect: (connection: Connection) => {
        const { nodes, edges, validationEnabled } = get();

        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) return;

        // Regex to detect table-level handles (e.g. "tableId-table-top-source")
        const tableHandlePattern = /-table-(top|bottom|left|right)-(source|target)$/;

        // 1. Resolve Source Column
        let sourceColId = '';
        if (connection.sourceHandle && !tableHandlePattern.test(connection.sourceHandle)) {
            // It's likely a column handle: "tableId-columnId-source"
            const parts = connection.sourceHandle.split('-');
            // Safety check: ensure enough parts
            if (parts.length >= 3) {
                // columnId is the segment before 'source'
                sourceColId = parts.slice(0, -1).slice(1).join('-');
                // Wait, simple split is risky if IDs have dashes. 
                // Better strategy: We know the suffix is "-source".
                // We know the prefix is `${sourceNode.id}-`.
                // So columnId is the middle.
                const prefix = `${sourceNode.id}-`;
                const suffix = '-source';
                if (connection.sourceHandle.startsWith(prefix) && connection.sourceHandle.endsWith(suffix)) {
                    sourceColId = connection.sourceHandle.substring(prefix.length, connection.sourceHandle.length - suffix.length);
                }
            }
        }

        // 2. Resolve Target Column
        let targetColId = '';
        if (connection.targetHandle && !tableHandlePattern.test(connection.targetHandle)) {
            const prefix = `${targetNode.id}-`;
            const suffix = '-target';
            if (connection.targetHandle.startsWith(prefix) && connection.targetHandle.endsWith(suffix)) {
                targetColId = connection.targetHandle.substring(prefix.length, connection.targetHandle.length - suffix.length);
            }
        }

        const sourceCol = sourceColId
            ? sourceNode.data.columns.find((c: Column) => c.id === sourceColId)
            : (sourceNode.data.columns.find((c: Column) => c.isPrimaryKey) || sourceNode.data.columns[0]);

        if (!sourceCol) {
            console.error(`Link Error: Could not resolve source column. Node: ${sourceNode.data.label}, Handle: ${connection.sourceHandle}`);
            return;
        }

        let targetCol = targetColId
            ? targetNode.data.columns.find((c: Column) => c.id === targetColId)
            : null;

        // 2. Automated FK Logic:
        let finalTargetColumnName = '';
        let finalNodes = nodes;

        if (targetCol) {
            // Use specific target column selected by user
            finalTargetColumnName = targetCol.name;

            // If it's not already a foreign key, we might want to update it
            if (!targetCol.isForeignKey) {
                finalNodes = nodes.map(node => {
                    if (node.id === targetNode.id) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                columns: node.data.columns.map((c: Column) =>
                                    c.id === targetColId
                                        ? {
                                            ...c,
                                            isForeignKey: true,
                                            referencedTable: sourceNode.data.label,
                                            referencedColumn: sourceCol.name
                                        }
                                        : c
                                )
                            }
                        };
                    }
                    return node;
                });
            }
        } else {
            // Default automated logic: find existing FK by naming convention or create new
            const desiredFKName = `${sourceNode.data.label.toLowerCase()}_id`;
            const existingFK = targetNode.data.columns.find((c: Column) =>
                c.name.toLowerCase() === desiredFKName.toLowerCase() ||
                (c.isForeignKey && c.referencedTable === sourceNode.data.label)
            );

            if (existingFK) {
                finalTargetColumnName = existingFK.name;
                targetCol = existingFK;
            } else {
                // Create new FK column
                const newFK: Column = {
                    id: `c${Date.now()}`,
                    name: desiredFKName,
                    type: sourceCol.type,
                    isPrimaryKey: false,
                    isForeignKey: true,
                    isNullable: false,
                    isIndexed: true,
                    referencedTable: sourceNode.data.label,
                    referencedColumn: sourceCol.name,
                };

                finalTargetColumnName = desiredFKName;
                targetCol = newFK;

                finalNodes = nodes.map(node => {
                    if (node.id === targetNode.id) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                columns: [...node.data.columns, newFK]
                            }
                        };
                    }
                    return node;
                });
            }
        }

        // 3. Create the edge with semantic data and specific handles
        const newEdge: Edge = {
            id: `rel_${sourceNode.id}_${targetNode.id}_${Date.now()}`,
            source: connection.source as string,
            target: connection.target as string,
            // Ensure we use column-specific handles for visual stability
            sourceHandle: connection.sourceHandle || `${sourceNode.id}-${sourceCol.id}-source`,
            targetHandle: connection.targetHandle || `${targetNode.id}-${targetCol.id}-target`,
            type: 'relationship',
            data: {
                relationship: {
                    sourceTable: sourceNode.data.label,
                    sourceColumn: sourceCol.name,
                    targetTable: targetNode.data.label,
                    targetColumn: finalTargetColumnName,
                    cardinality: '1:N',
                    isIdentifying: true,
                },
                isValid: true,
            },
            animated: false,
        };

        // Recalculate smart path for the new edge immediately
        const pathNodes = finalNodes;
        const pathPoints = calculateSmartOrthogonalPath(sourceNode, targetNode, pathNodes, newEdge.id);
        newEdge.data.pathPoints = pathPoints;

        set({
            nodes: finalNodes,
            edges: addEdge(newEdge, edges),
        });

        // Auto-validation with debouncing
        if (get().autoValidationEnabled) {
            get().runValidationDebounced();
        }
    },
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    clearDiagram: () => {
        set({
            nodes: [],
            edges: [],
            selectedNodes: [],
            selectedEdges: [],
            history: {
                past: [],
                present: { nodes: [], edges: [], selectedNodes: [], selectedEdges: [] },
                future: []
            },
            snapshots: [],
            validationResult: null
        });
    },
    detectRelationships: () => {
        const { nodes, setEdges } = get();
        const relationships = RelationshipDetector.detectRelationships(nodes);
        const relationshipEdges = RelationshipDetector.relationshipsToEdges(relationships, nodes);
        const validatedEdges = RelationshipDetector.validateAndHighlightEdges(nodes, relationshipEdges);
        setEdges(validatedEdges);
    },
    autoLayout: (options = {}) => {
        const { nodes, edges, setNodes, setEdges } = get();
        const { direction = 'TB', type = 'hierarchical' } = options;

        let layoutResult;
        switch (type) {
            case 'force':
                layoutResult = LayoutEngine.forceDirectedLayout(nodes, edges, 1200, 800);
                break;
            case 'group':
                layoutResult = LayoutEngine.hierarchicalGroupLayout(nodes, edges);
                break;
            default:
                layoutResult = LayoutEngine.autoLayout(nodes, edges, { direction });
        }

        setNodes(layoutResult.nodes);
        setEdges(layoutResult.edges);
    },
    validateDiagram: () => {
        const { nodes, edges } = get();
        return RelationshipDetector.validateRelationships(nodes, edges);
    },
    // Validation methods
    runValidation: () => {
        const { nodes, edges, validationEnabled } = get();
        if (!validationEnabled) {
            return { issues: [], summary: { errors: 0, warnings: 0, info: 0 }, score: 100 };
        }

        const result = ValidationEngine.validateDiagram(nodes, edges);
        set({ validationResult: result });
        return result;
    },
    toggleValidation: () => {
        const { validationEnabled, autoValidationEnabled } = get();
        set({ validationEnabled: !validationEnabled });

        // Run validation when enabling
        if (!validationEnabled && autoValidationEnabled) {
            get().runValidation();
        }
    },
    toggleAutoValidation: () => {
        const { autoValidationEnabled } = get();
        set({ autoValidationEnabled: !autoValidationEnabled });
    },
    getValidationIssues: () => {
        const { validationResult } = get();
        return validationResult?.issues || [];
    },
    fixValidationIssue: (issueId: string) => {
        const { validationResult, autoValidationEnabled } = get();
        if (!validationResult) return false;

        const issue = validationResult.issues.find(i => i.id === issueId);
        if (!issue || !issue.fixAction) return false;

        try {
            issue.fixAction();
            // Re-run validation after fix if auto-validation is enabled
            if (autoValidationEnabled) {
                setTimeout(() => get().runValidation(), 100);
            }
            return true;
        } catch (error) {
            console.error('Failed to fix validation issue:', error);
            return false;
        }
    },
    // Table CRUD operations
    addTable: (table) => {
        const { nodes } = get();
        const newTable = {
            id: `table_${Date.now()}`,
            type: 'table',
            position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
            data: {
                label: table.label,
                columns: (table.columns && table.columns.length > 0
                    ? table.columns.map((col, idx) => ({
                        ...col,
                        id: col.id ?? `c${Date.now()}_${idx}`
                    }))
                    : [{
                        id: `c${Date.now()}_pk`,
                        name: 'id',
                        type: 'uuid',
                        isPrimaryKey: true,
                        isForeignKey: false,
                        isNullable: false
                    }])
            }
        };
        set({ nodes: [...nodes, newTable] });
    },
    deleteTable: (tableId) => {
        const { nodes, edges } = get();
        const filteredNodes = nodes.filter(node => node.id !== tableId);
        const filteredEdges = edges.filter(edge =>
            edge.source !== tableId && edge.target !== tableId
        );
        set({ nodes: filteredNodes, edges: filteredEdges });
    },
    renameTable: (tableId, newName) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node =>
            node.id === tableId
                ? { ...node, data: { ...node.data, label: newName } }
                : node
        );
        set({ nodes: updatedNodes });
    },
    duplicateTable: (tableId) => {
        const { nodes } = get();
        const originalTable = nodes.find(node => node.id === tableId);
        if (!originalTable) return;

        const duplicatedTable = {
            ...originalTable,
            id: `table_${Date.now()}`,
            position: {
                x: originalTable.position.x + 50,
                y: originalTable.position.y + 50
            },
            data: {
                ...originalTable.data,
                label: `${originalTable.data.label}_copy`
            }
        };
        set({ nodes: [...nodes, duplicatedTable] });
    },
    // Column CRUD operations
    addColumn: (tableId, column) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node =>
            node.id === tableId
                ? {
                    ...node,
                    data: {
                        ...node.data,
                        columns: [...node.data.columns, {
                            ...column,
                            id: `c${Date.now()}`
                        }]
                    }
                }
                : node
        );
        set({ nodes: updatedNodes });
    },
    deleteColumn: (tableId, columnId) => {
        const { nodes, edges } = get();
        const updatedNodes = nodes.map(node =>
            node.id === tableId
                ? {
                    ...node,
                    data: {
                        ...node.data,
                        columns: node.data.columns.filter((col: Column) => col.id !== columnId)
                    }
                }
                : node
        );

        // Remove edges connected to this column's handles
        const columnHandlePrefix = `${tableId}-${columnId}-`;
        const updatedEdges = edges.filter(edge =>
            !(edge.sourceHandle?.startsWith(columnHandlePrefix)) &&
            !(edge.targetHandle?.startsWith(columnHandlePrefix))
        );

        set({ nodes: updatedNodes, edges: updatedEdges });
    },
    renameColumn: (tableId, columnId, newName) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node =>
            node.id === tableId
                ? {
                    ...node,
                    data: {
                        ...node.data,
                        columns: node.data.columns.map((col: Column) =>
                            col.id === columnId ? { ...col, name: newName } : col
                        )
                    }
                }
                : node
        );
        set({ nodes: updatedNodes });
    },
    duplicateColumn: (tableId, columnId) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node => {
            if (node.id !== tableId) return node;

            const columnToDuplicate = node.data.columns.find((col: Column) => col.id === columnId);
            if (!columnToDuplicate) return node;

            return {
                ...node,
                data: {
                    ...node.data,
                    columns: [...node.data.columns, {
                        ...columnToDuplicate,
                        id: `c${Date.now()}`,
                        name: `${columnToDuplicate.name}_copy`
                    }]
                }
            };
        });
        set({ nodes: updatedNodes });
    },
    // Selection operations
    selectNode: (nodeId) => {
        set({ selectedNodes: [nodeId] });
    },
    selectMultipleNodes: (nodeIds) => {
        set({ selectedNodes: nodeIds });
    },
    clearSelection: () => {
        set({ selectedNodes: [], selectedEdges: [] });
    },
    deleteSelectedNodes: () => {
        const { selectedNodes, selectedEdges, nodes, edges } = get();

        let updatedNodes = nodes;
        let updatedEdges = edges;

        // 1. Handle selected edges first (clean up constraints)
        selectedEdges.forEach(edgeId => {
            const edge = edges.find(e => e.id === edgeId);
            if (edge?.data?.relationship) {
                const { targetTable, targetColumn } = edge.data.relationship;
                updatedNodes = updatedNodes.map(node => {
                    if (node.id === edge.target || node.data.label === targetTable) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                // Remove the foreign key column entirely
                                columns: node.data.columns.filter((c: Column) => c.name !== targetColumn)
                            }
                        };
                    }
                    return node;
                });
            }
        });
        updatedEdges = updatedEdges.filter(edge => !selectedEdges.includes(edge.id));

        // 2. Handle selected nodes (and their connected edges/constraints)
        selectedNodes.forEach(nodeId => {
            // Find edges where this node is the SOURCE (parent)
            // We need to remove FK columns in the TARGET nodes
            updatedEdges.forEach(edge => {
                if (edge.source === nodeId && edge.data?.relationship) {
                    const { targetTable, targetColumn } = edge.data.relationship;
                    updatedNodes = updatedNodes.map(node => {
                        if (node.id === edge.target || node.data.label === targetTable) {
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    // Remove the foreign key column entirely
                                    columns: node.data.columns.filter((c: Column) => c.name !== targetColumn)
                                }
                            };
                        }
                        return node;
                    });
                }
            });
        });

        // Final filter for nodes and edges
        const finalNodes = updatedNodes.filter(node => !selectedNodes.includes(node.id));
        const finalEdges = updatedEdges.filter(edge =>
            !selectedNodes.includes(edge.source) && !selectedNodes.includes(edge.target)
        );

        set({
            nodes: finalNodes,
            edges: finalEdges,
            selectedNodes: [],
            selectedEdges: []
        });
    },
    // FK operations
    createForeignKey: (sourceTableId, sourceColumnId, targetTableId, targetColumnId) => {
        const { nodes, edges } = get();
        const parentNode = nodes.find(n => n.id === targetTableId);
        const childNode = nodes.find(n => n.id === sourceTableId);
        if (!parentNode || !childNode) return;

        const pkColumn = parentNode.data.columns.find((c: Column) => c.id === targetColumnId);
        const fkColumn = childNode.data.columns.find((c: Column) => c.id === sourceColumnId);
        if (!pkColumn || !fkColumn) return;

        const edgeId = `fk_${parentNode.id}_${pkColumn.id}_to_${childNode.id}_${fkColumn.id}`;
        if (edges.find(edge => edge.id === edgeId)) return;

        const updatedNodes = nodes.map(node => {
            if (node.id === childNode.id) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        columns: node.data.columns.map((col: Column) =>
                            col.id === fkColumn.id
                                ? { ...col, isForeignKey: true, referencedTable: parentNode.data.label, referencedColumn: pkColumn.name }
                                : col
                        )
                    }
                };
            }
            return node;
        });

        // Calculate smart orthogonal path points to avoid overlapping with other nodes/edges
        const pathPoints = calculateSmartOrthogonalPath(parentNode, childNode, nodes, edgeId);

        const newEdge: Edge = {
            id: edgeId,
            source: parentNode.id,
            target: childNode.id,
            sourceHandle: `${parentNode.id}-${pkColumn.id}-source`,
            targetHandle: `${childNode.id}-${fkColumn.id}-target`,
            type: 'relationship',
            data: {
                relationship: {
                    sourceTable: parentNode.data.label,
                    targetTable: childNode.data.label,
                    sourceColumn: pkColumn.name,
                    targetColumn: fkColumn.name,
                    cardinality: '1:N',
                    isIdentifying: true,
                },
                isValid: true,
                pathPoints: pathPoints,
            },
            animated: false,
        };

        set({ nodes: updatedNodes, edges: [...edges, newEdge] });
    },
    deleteRelationship: (edgeId, removeColumn = true) => {
        const { nodes, edges } = get();
        const edge = edges.find(e => e.id === edgeId);
        if (!edge) return;

        let updatedNodes = nodes;
        if (removeColumn && edge.data?.relationship) {
            const { targetTable, targetColumn } = edge.data.relationship;
            updatedNodes = nodes.map(node => {
                if (node.id === edge.target || node.data.label === targetTable) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            columns: node.data.columns.filter((c: Column) => c.name !== targetColumn)
                        }
                    };
                }
                return node;
            });
        } else if (edge.data?.relationship) {
            // Just clear the isForeignKey flag and reference info if we don't remove the column
            const { targetTable, targetColumn } = edge.data.relationship;
            updatedNodes = nodes.map(node => {
                if (node.id === edge.target || node.data.label === targetTable) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            columns: node.data.columns.map((c: Column) =>
                                c.name === targetColumn
                                    ? { ...c, isForeignKey: false, referencedTable: undefined, referencedColumn: undefined }
                                    : c
                            )
                        }
                    };
                }
                return node;
            });
        }

        set({
            nodes: updatedNodes,
            edges: edges.filter(e => e.id !== edgeId)
        });
    },
    // Quick operations
    suggestIndexes: () => {
        const { nodes } = get();
        const suggestions: { tableId: string; columnName: string; reason: string }[] = [];

        nodes.forEach(node => {
            if (node.type !== 'table') return;

            node.data.columns.forEach((column: Column) => {
                // Suggest index for foreign keys
                if (column.isForeignKey) {
                    suggestions.push({
                        tableId: node.id,
                        columnName: column.name,
                        reason: 'Foreign key column should be indexed for better join performance'
                    });
                }

                // Suggest index for unique columns
                if (column.isUnique && !column.isPrimaryKey) {
                    suggestions.push({
                        tableId: node.id,
                        columnName: column.name,
                        reason: 'Unique constraint benefits from index for faster lookups'
                    });
                }

                // Suggest index for commonly queried columns (heuristic)
                if (column.name.includes('email') || column.name.includes('name') || column.name.includes('status')) {
                    suggestions.push({
                        tableId: node.id,
                        columnName: column.name,
                        reason: 'Commonly queried column should be indexed for better search performance'
                    });
                }
            });
        });

        return suggestions;
    },
    suggestForeignKeys: () => {
        const { nodes, edges } = get();
        const suggestions: { sourceTableId: string; sourceColumnId: string; targetTableId: string; targetColumnId: string; confidence: number }[] = [];

        // Get existing relationships to avoid duplicates
        const existingRelationships = new Set(
            edges.map(edge => `${edge.source}-${edge.sourceHandle}-to-${edge.target}-${edge.targetHandle}`)
        );

        nodes.forEach(sourceNode => {
            if (sourceNode.type !== 'table') return;

            nodes.forEach(targetNode => {
                if (targetNode.type !== 'table' || sourceNode.id === targetNode.id) return;

                sourceNode.data.columns.forEach((sourceColumn: Column) => {
                    // Skip primary keys and existing foreign keys
                    if (sourceColumn.isPrimaryKey || sourceColumn.isForeignKey) return;

                    targetNode.data.columns.forEach((targetColumn: Column) => {
                        // Only suggest relationships to primary keys
                        if (!targetColumn.isPrimaryKey) return;

                        // Skip if relationship already exists
                        const relationshipKey = `${sourceNode.id}-${sourceColumn.id}-to-${targetNode.id}-${targetColumn.id}`;
                        if (existingRelationships.has(relationshipKey)) return;

                        let confidence = 0;

                        // High confidence for naming patterns
                        if (sourceColumn.name === `${targetNode.data.label.toLowerCase()}_id` ||
                            sourceColumn.name === `${targetNode.data.label.toLowerCase()}id` ||
                            sourceColumn.name.endsWith(`_${targetNode.data.label.toLowerCase()}_id`)) {
                            confidence = 0.9;
                        }
                        // Medium confidence for _id suffix
                        else if (sourceColumn.name.endsWith('_id') && targetColumn.type === sourceColumn.type) {
                            confidence = 0.7;
                        }
                        // Low confidence for type matching
                        else if (targetColumn.type === sourceColumn.type) {
                            confidence = 0.4;
                        }

                        if (confidence > 0.3) {
                            suggestions.push({
                                sourceTableId: sourceNode.id,
                                sourceColumnId: sourceColumn.id,
                                targetTableId: targetNode.id,
                                targetColumnId: targetColumn.id,
                                confidence
                            });
                        }
                    });
                });
            });
        });

        // Sort by confidence
        return suggestions.sort((a, b) => b.confidence - a.confidence);
    },
    createSuggestedForeignKey: (sourceTableId, sourceColumnId, targetTableId, targetColumnId) => {
        const { createForeignKey } = get();
        createForeignKey(sourceTableId, sourceColumnId, targetTableId, targetColumnId);
    },
    createIndex: (tableId, columnId) => {
        // For now, we'll just log this. In a full implementation, this would
        // add index metadata to the column or create a separate index structure
        const { nodes } = get();
        const table = nodes.find(node => node.id === tableId);
        const column = table?.data.columns.find((col: Column) => col.id === columnId);

        if (table && column) {
            console.log(`Created index on ${table.data.label}.${column.name}`);
            // In a full implementation, you might add an `isIndexed: true` property to the column
            // or maintain a separate indexes array in the table data
        }
    },
    // Advanced property operations
    updateTableProperties: (tableId, properties) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node =>
            node.id === tableId
                ? {
                    ...node,
                    data: {
                        ...node.data,
                        ...properties
                    }
                }
                : node
        );
        set({ nodes: updatedNodes });
    },
    updateColumnProperties: (tableId, columnId, properties) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node =>
            node.id === tableId
                ? {
                    ...node,
                    data: {
                        ...node.data,
                        columns: node.data.columns.map((col: Column) =>
                            col.id === columnId ? { ...col, ...properties } : col
                        )
                    }
                }
                : node
        );
        set({ nodes: updatedNodes });
    },
    // Index operations
    addIndex: (tableId, index) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node => {
            if (node.id !== tableId) return node;

            const newIndex = {
                ...index,
                id: `idx_${Date.now()}`
            };

            return {
                ...node,
                data: {
                    ...node.data,
                    indexes: [...(node.data.indexes || []), newIndex]
                }
            };
        });
        set({ nodes: updatedNodes });
    },
    updateIndex: (tableId, indexId, properties) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node => {
            if (node.id !== tableId) return node;

            return {
                ...node,
                data: {
                    ...node.data,
                    indexes: node.data.indexes?.map((index: TableIndex) =>
                        index.id === indexId ? { ...index, ...properties } : index
                    ) || []
                }
            };
        });
        set({ nodes: updatedNodes });
    },
    deleteIndex: (tableId, indexId) => {
        const { nodes } = get();
        const updatedNodes = nodes.map(node => {
            if (node.id !== tableId) return node;

            return {
                ...node,
                data: {
                    ...node.data,
                    indexes: node.data.indexes?.filter((index: TableIndex) => index.id !== indexId) || []
                }
            };
        });
        set({ nodes: updatedNodes });
    },
    // History management
    undo: () => {
        const { history } = get();
        if (history.past.length === 0) return;

        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, history.past.length - 1);

        set({
            history: {
                past: newPast,
                present: previous,
                future: [history.present, ...history.future]
            },
            nodes: previous.nodes,
            edges: previous.edges,
            selectedNodes: previous.selectedNodes,
            selectedEdges: previous.selectedEdges || []
        });
    },
    redo: () => {
        const { history } = get();
        if (history.future.length === 0) return;

        const next = history.future[0];
        const newFuture = history.future.slice(1);

        set({
            history: {
                past: [...history.past, history.present],
                present: next,
                future: newFuture
            },
            nodes: next.nodes,
            edges: next.edges,
            selectedNodes: next.selectedNodes,
            selectedEdges: next.selectedEdges || []
        });
    },
    canUndo: () => {
        const { history } = get();
        return history.past.length > 0;
    },
    canRedo: () => {
        const { history } = get();
        return history.future.length > 0;
    },
    saveSnapshot: (name?: string, description?: string) => {
        const { nodes, edges, selectedNodes, selectedEdges, snapshots } = get();
        const snapshot: VersionSnapshot = {
            id: `snapshot_${Date.now()}`,
            name: name || `Snapshot ${new Date().toLocaleString()}`,
            timestamp: Date.now(),
            state: { nodes, edges, selectedNodes, selectedEdges },
            description
        };

        set({ snapshots: [...snapshots, snapshot] });
    },
    loadSnapshot: (snapshotId: string) => {
        const { snapshots, history } = get();
        const snapshot = snapshots.find(s => s.id === snapshotId);
        if (!snapshot) return;

        set({
            history: {
                past: [...history.past, history.present],
                present: snapshot.state,
                future: []
            },
            nodes: snapshot.state.nodes,
            edges: snapshot.state.edges,
            selectedNodes: snapshot.state.selectedNodes,
            selectedEdges: snapshot.state.selectedEdges || []
        });
    },
    deleteSnapshot: (snapshotId: string) => {
        const { snapshots } = get();
        set({ snapshots: snapshots.filter(s => s.id !== snapshotId) });
    },
    getSnapshots: () => {
        return get().snapshots;
    },
    // Persistence
    saveToLocal: () => {
        const { nodes, edges, selectedNodes, selectedEdges, snapshots } = get();
        const data = {
            nodes,
            edges,
            selectedNodes,
            selectedEdges,
            snapshots,
            timestamp: Date.now()
        };
        localStorage.setItem('erd-diagram-state', JSON.stringify(data));
    },
    loadFromLocal: () => {
        try {
            const saved = localStorage.getItem('erd-diagram-state');
            if (!saved) return false;

            const data = JSON.parse(saved);
            const migratedEdges = migrateEdgeHandles(data.edges || []);

            set({
                nodes: data.nodes || [],
                edges: migratedEdges,
                selectedNodes: data.selectedNodes || [],
                snapshots: data.snapshots || [],
                history: {
                    past: [],
                    present: {
                        nodes: data.nodes || [],
                        edges: migratedEdges,
                        selectedNodes: data.selectedNodes || [],
                        selectedEdges: data.selectedEdges || []
                    },
                    future: []
                }
            });
            return true;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return false;
        }
    },
    exportState: () => {
        const { nodes, edges, selectedNodes, selectedEdges, snapshots } = get();
        return JSON.stringify({
            nodes,
            edges,
            selectedNodes,
            selectedEdges,
            snapshots,
            exportedAt: new Date().toISOString()
        }, null, 2);
    },
    importState: (jsonString: string) => {
        try {
            const data = JSON.parse(jsonString);
            if (!data.nodes || !Array.isArray(data.nodes)) {
                throw new Error('Invalid data format');
            }

            const migratedEdges = migrateEdgeHandles(data.edges || []);

            set({
                nodes: data.nodes || [],
                edges: migratedEdges,
                selectedNodes: data.selectedNodes || [],
                snapshots: data.snapshots || [],
                history: {
                    past: [],
                    present: {
                        nodes: data.nodes || [],
                        edges: migratedEdges,
                        selectedNodes: data.selectedNodes || [],
                        selectedEdges: data.selectedEdges || []
                    },
                    future: []
                }
            });
            return true;
        } catch (error) {
            console.error('Failed to import state:', error);
            return false;
        }
    },

    // Performance operations
    getDiagramStats: () => {
        const { nodes, edges } = get();
        let totalColumns = 0;

        nodes.forEach(node => {
            if (node.data.columns) {
                totalColumns += node.data.columns.length;
            }
        });

        let memoryUsage;
        if ('memory' in performance) {
            const memory = (performance as any).memory;
            memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
        }

        return {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            totalColumns,
            memoryUsage
        };
    },

    optimizePerformance: () => {
        const { nodes, edges } = get();

        // Remove duplicate edges
        const uniqueEdges = edges.filter((edge, index, self) =>
            index === self.findIndex((e) =>
                e.source === edge.source &&
                e.target === edge.target &&
                e.sourceHandle === edge.sourceHandle &&
                e.targetHandle === edge.targetHandle
            )
        );

        // Remove orphaned edges (edges that reference non-existent nodes)
        const nodeIds = new Set(nodes.map(n => n.id));
        const validEdges = uniqueEdges.filter(edge =>
            nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );

        set({ edges: validEdges });
    },

    cleanupUnusedElements: () => {
        const { nodes, edges } = get();

        // Find connected node IDs
        const connectedNodeIds = new Set<string>();
        edges.forEach(edge => {
            connectedNodeIds.add(edge.source);
            connectedNodeIds.add(edge.target);
        });

        // Keep nodes that are either connected or have no connections (isolated tables might be intentional)
        // For now, we'll only remove completely empty tables
        const cleanedNodes = nodes.filter(node => {
            if (!node.data.columns || node.data.columns.length === 0) {
                return false; // Remove empty tables
            }
            return true;
        });

        set({ nodes: cleanedNodes });
    },
    updateEdgeData: (edgeId: string, data: any) => {
        const { edges } = get();
        const updatedEdges = edges.map(edge =>
            edge.id === edgeId
                ? { ...edge, data: { ...edge.data, ...data } }
                : edge
        );
        set({ edges: updatedEdges });
    },
    updateEdgePathPoints: (edgeId: string, points: { x: number; y: number }[]) => {
        const { edges } = get();
        const updatedEdges = edges.map(edge =>
            edge.id === edgeId
                ? { ...edge, data: { ...edge.data, pathPoints: points, isManualPath: true } }
                : edge
        );
        set({ edges: updatedEdges });
    },
    addEdgePathPoint: (edgeId: string, point: { x: number; y: number }) => {
        const { edges } = get();
        const updatedEdges = edges.map(edge => {
            if (edge.id !== edgeId) return edge;
            const pathPoints = [...(edge.data?.pathPoints || []), point];
            return { ...edge, data: { ...edge.data, pathPoints, isManualPath: true } };
        });
        set({ edges: updatedEdges });
    },
    removeEdgePathPoint: (edgeId: string, index: number) => {
        const { edges } = get();
        const updatedEdges = edges.map(edge => {
            if (edge.id !== edgeId) return edge;
            const pathPoints = (edge.data?.pathPoints || []).filter((_: any, i: number) => i !== index);
            return { ...edge, data: { ...edge.data, pathPoints, isManualPath: true } };
        });
        set({ edges: updatedEdges });
    },
    resetEdgePath: (edgeId: string) => {
        const { edges, nodes } = get();
        const updatedEdges = edges.map(edge => {
            if (edge.id !== edgeId) return edge;

            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);

            const pathPoints = (sourceNode && targetNode)
                ? calculateSmartOrthogonalPath(sourceNode, targetNode, nodes, edgeId)
                : [];

            return {
                ...edge,
                data: {
                    ...edge.data,
                    pathPoints,
                    isManualPath: false
                }
            };
        });
        set({ edges: updatedEdges });
    },
    updateRelationshipCardinality: (edgeId: string, cardinality: '1:1' | '1:N' | '0:1' | '0:N' | 'N:M') => {
        const { edges, nodes } = get();
        const edge = edges.find(e => e.id === edgeId);
        if (!edge || !edge.data?.relationship) return;

        const { targetTable, targetColumn } = edge.data.relationship;

        // Update edge cardinality
        const updatedEdges = edges.map(e =>
            e.id === edgeId
                ? {
                    ...e,
                    data: {
                        ...e.data,
                        relationship: { ...e.data.relationship, cardinality }
                    }
                }
                : e
        );

        // If Many-to-Many is selected, automatically resolve it with a junction table
        if (cardinality === 'N:M') {
            get().resolveManyToMany(edgeId);
            return;
        }

        // Update target column properties based on cardinality
        const isUnique = cardinality === '1:1' || cardinality === '0:1';
        const isNullable = cardinality === '0:1' || cardinality === '0:N';

        const updatedNodes = nodes.map(node => {
            if (node.id === edge.target || node.data.label === targetTable) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        columns: node.data.columns.map((col: Column) =>
                            col.name === targetColumn
                                ? { ...col, isUnique, isNullable }
                                : col
                        )
                    }
                };
            }
            return node;
        });

        set({
            edges: updatedEdges,
            nodes: updatedNodes
        });

        // Trigger validation debounced for performance
        if (get().autoValidationEnabled) {
            get().runValidationDebounced();
        }
    },
    runValidationDebounced: () => {
        if (validationTimeout) clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
            get().runValidation();
        }, 300); // 300ms debounce
    },
    // Many-to-Many relationship operations
    createJunctionTable: (sourceTableId: string, targetTableId: string, edgeId?: string) => {
        const { nodes, edges } = get();
        const sourceNode = nodes.find(n => n.id === sourceTableId);
        const targetNode = nodes.find(n => n.id === targetTableId);

        if (!sourceNode || !targetNode) return null;

        // Find primary keys of both tables
        const sourcePK = sourceNode.data.columns.find((c: Column) => c.isPrimaryKey);
        const targetPK = targetNode.data.columns.find((c: Column) => c.isPrimaryKey);

        if (!sourcePK || !targetPK) {
            console.warn('Both tables must have primary keys for junction table creation');
            return null;
        }

        // Generate junction table name
        const junctionTableName = `${sourceNode.data.label}_${targetNode.data.label}`.toLowerCase();

        // Create junction table node
        const junctionTableId = `junction_${Date.now()}`;
        const junctionTable = {
            id: junctionTableId,
            type: 'junctionTable',
            position: {
                x: (sourceNode.position.x + targetNode.position.x) / 2,
                y: (sourceNode.position.y + targetNode.position.y) / 2 + 100
            },
            data: {
                label: junctionTableName,
                sourceTable: sourceNode.data.label,
                targetTable: targetNode.data.label,
                sourceColumn: sourcePK.name,
                targetColumn: targetPK.name,
                isAutoGenerated: true,
                columns: [
                    {
                        id: `c${Date.now()}_1`,
                        name: `${sourceNode.data.label.toLowerCase()}_id`,
                        type: sourcePK.type,
                        isPrimaryKey: true,
                        isForeignKey: true,
                        isNullable: false,
                        referencedTable: sourceNode.data.label,
                        referencedColumn: sourcePK.name,
                    },
                    {
                        id: `c${Date.now()}_2`,
                        name: `${targetNode.data.label.toLowerCase()}_id`,
                        type: targetPK.type,
                        isPrimaryKey: true,
                        isForeignKey: true,
                        isNullable: false,
                        referencedTable: targetNode.data.label,
                        referencedColumn: targetPK.name,
                    }
                ]
            }
        };

        // Create edges from source to junction and junction to target
        const sourceToJunctionEdge: Edge = {
            id: `rel_${sourceNode.id}_${junctionTableId}_${Date.now()}`,
            source: sourceNode.id,
            target: junctionTableId,
            sourceHandle: `${sourceNode.id}-${sourcePK.id}-source`,
            targetHandle: `${junctionTableId}-${junctionTable.data.columns[0].id}-target`,
            type: 'relationship',
            data: {
                relationship: {
                    sourceTable: sourceNode.data.label,
                    sourceColumn: sourcePK.name,
                    targetTable: junctionTableName,
                    targetColumn: `${sourceNode.data.label.toLowerCase()}_id`,
                    cardinality: '1:N',
                    isIdentifying: true,
                },
                isValid: true,
            },
            animated: false,
        };

        const junctionToTargetEdge: Edge = {
            id: `rel_${junctionTableId}_${targetNode.id}_${Date.now()}`,
            source: junctionTableId,
            target: targetNode.id,
            sourceHandle: `${junctionTableId}-${junctionTable.data.columns[1].id}-source`,
            targetHandle: `${targetNode.id}-${targetPK.id}-target`,
            type: 'relationship',
            data: {
                relationship: {
                    sourceTable: junctionTableName,
                    sourceColumn: `${targetNode.data.label.toLowerCase()}_id`,
                    targetTable: targetNode.data.label,
                    targetColumn: targetPK.name,
                    cardinality: '1:N',
                    isIdentifying: true,
                },
                isValid: true,
            },
            animated: false,
        };

        // Optional: Filter the original N:M edge if it exists
        // Actually, we'll keep it but it will be updated by resolveManyToMany
        const updatedEdges = edges;

        set({
            nodes: [...nodes, junctionTable],
            edges: [...updatedEdges, sourceToJunctionEdge, junctionToTargetEdge]
        });

        return junctionTableId;
    },
    convertToManyToMany: (edgeId: string) => {
        const { edges, nodes } = get();
        const edge = edges.find(e => e.id === edgeId);

        if (!edge || !edge.data?.relationship) return false;

        // Update edge to N:M cardinality
        const updatedEdges = edges.map(e =>
            e.id === edgeId
                ? {
                    ...e,
                    type: 'manyToMany',
                    data: {
                        ...e.data,
                        relationship: { ...e.data.relationship, cardinality: 'N:M' as const },
                        hasJunctionTable: false
                    }
                }
                : e
        );

        set({ edges: updatedEdges });
        return true;
    },
    resolveManyToMany: (edgeId: string) => {
        const { nodes, edges } = get();
        const edge = edges.find(e => e.id === edgeId);

        if (!edge || !edge.data?.relationship) return false;

        const { sourceTable, targetTable, targetColumn } = edge.data.relationship;
        const sourceNode = nodes.find(n => n.data.label === sourceTable);
        const targetNode = nodes.find(n => n.data.label === targetTable);

        if (!sourceNode || !targetNode) return false;

        // 1. Create junction table (returns ID but state update happens inside createJunctionTable)
        const junctionTableId = get().createJunctionTable(sourceNode.id, targetNode.id, edgeId);

        if (junctionTableId) {
            // 2. Get the FRESH state from store
            const { edges: currentEdges, nodes: currentNodes } = get();

            // 3. REMOVE the original edge and update the rest
            const finalEdges = currentEdges.filter(e => e.id !== edgeId);

            // 4. REMOVE the old foreign key column from the target (child) table
            const finalNodes = currentNodes.map(node => {
                if (node.id === targetNode.id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            columns: node.data.columns.filter((col: Column) => col.name !== targetColumn)
                        }
                    };
                }
                return node;
            });

            set({
                edges: finalEdges,
                nodes: finalNodes
            });

            // Trigger validation debounced for performance
            if (get().autoValidationEnabled) {
                get().runValidationDebounced();
            }

            return true;
        }

        return false;
    },
    // AI Actions
    fetchAISuggestions: async () => {
        if (!get().aiEnabled) return;
        const { nodes, edges } = get();
        set({ isFetchingAISuggestions: true });

        try {
            const erdState = {
                nodes: nodes.map(n => ({
                    id: n.id,
                    label: n.data.label,
                    columns: n.data.columns
                })),
                edges: edges.map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    data: e.data
                }))
            };

            const response = await fetch('/api/ai/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(erdState)
            });

            if (!response.ok) throw new Error('Failed to fetch AI suggestions');

            const data = await response.json();
            set({ aiSuggestions: data.suggestions || [], isFetchingAISuggestions: false });
        } catch (error) {
            console.error('Error fetching AI suggestions:', error);
            set({ isFetchingAISuggestions: false });
        }
    },
    applyAISuggestion: (suggestionId: string) => {
        const { aiSuggestions, nodes, autoValidationEnabled } = get();
        set({ aiSuggestions: aiSuggestions.filter(s => s.id !== suggestionId) });

        // Trigger validation if auto-validation is enabled
        if (autoValidationEnabled) {
            get().runValidation();
        }
    },
    clearAISuggestions: () => {
        set({ aiSuggestions: [] });
    },
    // Chat Actions
    sendChatMessage: async (content, options = {}) => {
        if (!get().aiEnabled) return;
        const { chatMessages, nodes } = get();
        const newMessages = [...chatMessages, { role: 'user' as const, content }];

        set({
            chatMessages: newMessages,
            isChatStreaming: true
        });

        try {
            const messagesForAI = [...newMessages];

            if (options.includeSchema) {
                const schemaSummary = nodes.map(n =>
                    `Table ${n.data.label}: ${n.data.columns.map((c: { name: string; type: string }) => `${c.name} (${c.type})`).join(', ')}`
                ).join('\n');

                messagesForAI.push({
                    role: 'system',
                    content: `Current schema context:\n${schemaSummary}`
                });
            }

            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesForAI,
                    enable_thinking: options.enableThinking
                })
            });

            if (!response.ok) throw new Error('Chat request failed');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader found');

            let assistantContent = '';
            set({ chatMessages: [...newMessages, { role: 'assistant', content: '' }] });

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') break;

                        try {
                            const data = JSON.parse(dataStr);
                            const delta = data.choices[0].delta.content;
                            if (delta) {
                                assistantContent += delta;
                                set(state => ({
                                    chatMessages: state.chatMessages.map((msg, i) =>
                                        i === state.chatMessages.length - 1
                                            ? { ...msg, content: assistantContent }
                                            : msg
                                    )
                                }));
                            }
                        } catch {
                            // Ignore parse errors for partial chunks
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            set(state => ({
                chatMessages: [...state.chatMessages, { role: 'assistant', content: 'Sorry, I encountered an error processing your request.' }]
            }));
        } finally {
            set({ isChatStreaming: false });
        }
    },
    clearChat: () => {
        set({
            chatMessages: [{ role: 'system', content: 'You are a senior database architect assistant. You help users design and optimize their Entity Relationship Diagrams.' }]
        });
    },
    createTableFromNL: async (prompt) => {
        if (!get().aiEnabled) return false;
        const { nodes } = get();
        try {
            const schemaSummary = nodes.map(n =>
                `Table ${n.data.label}: ${n.data.columns.map((c: { name: string; type: string }) => `${c.name} (${c.type})`).join(', ')}`
            ).join('\n');

            const response = await fetch('/api/ai/create-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, currentSchema: schemaSummary })
            });

            if (!response.ok) throw new Error('Create table request failed');

            const tableData = await response.json();

            const prevNodes = get().nodes;
            get().addTable(tableData);

            const nextNodes = get().nodes;
            const newNode = nextNodes.find(n => !prevNodes.some(p => p.id === n.id) && n.data?.label === tableData?.label);

            const suggestions = Array.isArray(tableData?.suggested_relationships)
                ? tableData.suggested_relationships
                : [];

            // Also detect relationships using RelationshipDetector for any foreign key columns
            if (newNode) {
                const detectedRelationships = RelationshipDetector.detectRelationships(
                    nextNodes.filter(n => n.type === 'table') as any[]
                );

                // Add detected relationships that involve the new table
                const newTableRelationships = detectedRelationships.filter(rel =>
                    rel.sourceTable.toLowerCase() === newNode.data.label.toLowerCase() ||
                    rel.targetTable.toLowerCase() === newNode.data.label.toLowerCase()
                );

                // Convert detected relationships to suggestions format
                newTableRelationships.forEach(rel => {
                    const existingSuggestion = suggestions.find((s: any) =>
                        s.from_table === rel.sourceTable &&
                        s.from_column === rel.sourceColumn &&
                        s.to_table === rel.targetTable &&
                        s.to_column === rel.targetColumn
                    );
                    if (!existingSuggestion) {
                        suggestions.push({
                            from_table: rel.sourceTable,
                            from_column: rel.sourceColumn,
                            to_table: rel.targetTable,
                            to_column: rel.targetColumn,
                            relationship_type: rel.cardinality === '1:N' || rel.cardinality === '1:1' ? 'one_to_many' : 'many_to_many',
                            confidence: 'high',
                            reason: 'Automatically detected from foreign key column pattern'
                        });
                    }
                });
            }

            if (newNode && suggestions.length > 0) {
                const tableIdByLabel = new Map(nextNodes.map(n => [String(n.data.label), n.id]));
                const getColumnIdByName = (tableId: string, colName: string) => {
                    const node = nextNodes.find(n => n.id === tableId);
                    const col = node?.data?.columns?.find((c: Column) => c.name === colName);
                    return col?.id;
                };

                suggestions
                    .filter((s: any) => {
                        const conf = String(s?.confidence ?? 'medium').toLowerCase();
                        return conf === 'high' || conf === 'medium';
                    })
                    .forEach((s: any) => {
                        const relType = String(s?.relationship_type ?? '').toLowerCase();
                        if (relType !== 'one_to_many' && relType !== '1:n' && relType !== '1:1') return;

                        const fromTable = String(s?.from_table ?? '');
                        const toTable = String(s?.to_table ?? '');
                        const fromColumn = String(s?.from_column ?? '');
                        const toColumn = String(s?.to_column ?? '');
                        if (!fromTable || !toTable || !fromColumn || !toColumn) return;

                        const childTableId = tableIdByLabel.get(fromTable);
                        const parentTableId = tableIdByLabel.get(toTable);
                        if (!childTableId || !parentTableId) return;

                        const childColumnId = getColumnIdByName(childTableId, fromColumn);
                        const parentColumnId = getColumnIdByName(parentTableId, toColumn);
                        if (!childColumnId || !parentColumnId) return;

                        get().createForeignKey(childTableId, childColumnId, parentTableId, parentColumnId);
                    });
            }
            return true;
        } catch (error) {
            console.error('Create table error:', error);
            return false;
        }
    },
    setAiEnabled: (enabled: boolean) => set({ aiEnabled: enabled }),
    setShowRelationshipLabels: (enabled: boolean) => set({ showRelationshipLabels: enabled }),
}));
