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
import { RelationshipDetector } from '@/lib/relationship-detector';
import { LayoutEngine } from '@/lib/layout-engine';
import { ValidationEngine, ValidationResult, ValidationIssue } from '@/lib/validation-engine';
import { Column, TableIndex } from '@/components/editor/nodes/table-node';

interface DiagramData {
    nodes: Node[];
    edges: Edge[];
    selectedNodes: string[];
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
    history: DiagramHistory;
    snapshots: VersionSnapshot[];
    validationResult: ValidationResult | null;
    validationEnabled: boolean;
    autoValidationEnabled: boolean;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
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
    
    // History state
    history: {
        past: [],
        present: {
            nodes: [],
            edges: [],
            selectedNodes: []
        },
        future: []
    },
    snapshots: [],
    
    // Validation state
    validationResult: null,
    validationEnabled: true,
    autoValidationEnabled: true,
    onNodesChange: (changes: NodeChange[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
        
        // Auto-validation
        const { autoValidationEnabled } = get();
        if (autoValidationEnabled) {
            setTimeout(() => get().runValidation(), 300);
        }
    },
    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
        
        // Auto-validation
        const { autoValidationEnabled } = get();
        if (autoValidationEnabled) {
            setTimeout(() => get().runValidation(), 300);
        }
    },
    onConnect: (connection: Connection) => {
        set({
            edges: addEdge(connection, get().edges),
        });
        
        // Auto-validation
        const { autoValidationEnabled } = get();
        if (autoValidationEnabled) {
            setTimeout(() => get().runValidation(), 300);
        }
    },
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    detectRelationships: () => {
        const { nodes, setEdges } = get();
        const relationships = RelationshipDetector.detectRelationships(nodes);
        const relationshipEdges = RelationshipDetector.relationshipsToEdges(relationships);
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
        const { validationEnabled } = get();
        set({ validationEnabled: !validationEnabled });
        
        // Run validation when enabling
        if (!validationEnabled) {
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
        const { validationResult } = get();
        if (!validationResult) return false;
        
        const issue = validationResult.issues.find(i => i.id === issueId);
        if (!issue || !issue.autoFixable || !issue.fixAction) return false;
        
        try {
            issue.fixAction();
            // Re-run validation after fix
            setTimeout(() => get().runValidation(), 100);
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
                columns: table.columns || [
                    { id: 'c1', name: 'id', type: 'uuid', isPrimaryKey: true, isForeignKey: false, isNullable: false }
                ]
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
        const { nodes } = get();
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
        set({ nodes: updatedNodes });
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
        set({ selectedNodes: [] });
    },
    deleteSelectedNodes: () => {
        const { selectedNodes, nodes, edges } = get();
        const filteredNodes = nodes.filter(node => !selectedNodes.includes(node.id));
        const filteredEdges = edges.filter(edge => 
            !selectedNodes.includes(edge.source) && !selectedNodes.includes(edge.target)
        );
        set({ nodes: filteredNodes, edges: filteredEdges, selectedNodes: [] });
    },
    // FK operations
    createForeignKey: (sourceTableId, sourceColumnId, targetTableId, targetColumnId) => {
        const { nodes, edges } = get();
        const edgeId = `fk_${sourceTableId}_${sourceColumnId}_to_${targetTableId}_${targetColumnId}`;
        
        // Check if edge already exists
        const existingEdge = edges.find(edge => edge.id === edgeId);
        if (existingEdge) return;
        
        // Update source column to be a foreign key
        const updatedNodes = nodes.map(node => {
            if (node.id === sourceTableId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        columns: node.data.columns.map((col: Column) => 
                            col.id === sourceColumnId 
                                ? { ...col, isForeignKey: true }
                                : col
                        )
                    }
                };
            }
            return node;
        });
        
        const newEdge = {
            id: edgeId,
            source: sourceTableId,
            target: targetTableId,
            sourceHandle: sourceColumnId,
            targetHandle: targetColumnId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#3b82f6', strokeWidth: 2 }
        };
        
        set({ nodes: updatedNodes, edges: [...edges, newEdge] });
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
            selectedNodes: previous.selectedNodes
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
            selectedNodes: next.selectedNodes
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
        const { nodes, edges, selectedNodes, snapshots } = get();
        const snapshot: VersionSnapshot = {
            id: `snapshot_${Date.now()}`,
            name: name || `Snapshot ${new Date().toLocaleString()}`,
            timestamp: Date.now(),
            state: { nodes, edges, selectedNodes },
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
            selectedNodes: snapshot.state.selectedNodes
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
        const { nodes, edges, selectedNodes, snapshots } = get();
        const data = {
            nodes,
            edges,
            selectedNodes,
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
            set({
                nodes: data.nodes || [],
                edges: data.edges || [],
                selectedNodes: data.selectedNodes || [],
                snapshots: data.snapshots || [],
                history: {
                    past: [],
                    present: {
                        nodes: data.nodes || [],
                        edges: data.edges || [],
                        selectedNodes: data.selectedNodes || []
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
        const { nodes, edges, selectedNodes, snapshots } = get();
        return JSON.stringify({
            nodes,
            edges,
            selectedNodes,
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

            set({
                nodes: data.nodes || [],
                edges: data.edges || [],
                selectedNodes: data.selectedNodes || [],
                snapshots: data.snapshots || [],
                history: {
                    past: [],
                    present: {
                        nodes: data.nodes || [],
                        edges: data.edges || [],
                        selectedNodes: data.selectedNodes || []
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
}));
