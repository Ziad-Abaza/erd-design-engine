"use client";

import { memo, useMemo, useState, useCallback } from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    EdgeProps,
    getSmoothStepPath,
    MarkerType,
} from 'reactflow';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { RelationshipContextMenu } from '../context-menu';

interface DatabaseRelationshipEdgeData {
    relationship: {
        sourceTable: string;
        targetTable: string;
        sourceColumn: string;
        targetColumn: string;
        cardinality: '1:1' | '1:N' | 'N:M';
        isIdentifying?: boolean;
        label?: string;
    };
    isValid?: boolean;
}

const DatabaseRelationshipEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
}: EdgeProps<DatabaseRelationshipEdgeData>) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const isValid = data?.isValid !== false;
    const isIdentifying = data?.relationship?.isIdentifying ?? true;
    const cardinality = data?.relationship?.cardinality || '1:N';

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const edgeColor = isValid ? (selected ? '#3b82f6' : '#64748b') : '#ef4444';
    const strokeWidth = selected ? 3 : 2;
    const dashArray = isIdentifying ? undefined : '5,5';

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 0, // Makes it sharp orthogonal
    });

    const markerStart = useMemo(() => {
        switch (cardinality) {
            case '1:1': return 'url(#marker-one)';
            case '1:N': return 'url(#marker-one)';
            case 'N:M': return 'url(#marker-many)';
            default: return 'url(#marker-one)';
        }
    }, [cardinality]);

    const markerEnd = useMemo(() => {
        switch (cardinality) {
            case '1:1': return 'url(#marker-one)';
            case '1:N': return 'url(#marker-one-many)';
            case 'N:M': return 'url(#marker-many)';
            default: return 'url(#marker-one-many)';
        }
    }, [cardinality]);

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={markerEnd}
                markerStart={markerStart}
                style={{
                    strokeWidth,
                    stroke: edgeColor,
                    strokeDasharray: dashArray,
                    transition: 'all 0.2s',
                }}
            />

            {/* Interaction layer for easier selection */}
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                className="cursor-pointer"
                style={{ pointerEvents: 'stroke' }}
                onContextMenu={handleContextMenu}
            />

            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan"
                    onContextMenu={handleContextMenu}
                >
                    <div className={cn(
                        "bg-background/90 backdrop-blur-sm border rounded-full px-2 py-0.5 shadow-sm text-[10px] font-medium transition-all hover:scale-110",
                        "flex items-center gap-1.5 whitespace-nowrap",
                        isValid ? (selected ? "border-blue-500 text-blue-600 shadow-blue-100" : "border-slate-200 text-slate-500") : "border-red-500 bg-red-50 text-red-600"
                    )}>
                        {!isValid && <AlertTriangle className="w-3 h-3 text-red-500" />}
                        <span className="opacity-70">{data?.relationship?.sourceColumn}</span>
                        <span className="font-bold text-slate-400">→</span>
                        <span className="opacity-70">{data?.relationship?.targetColumn}</span>
                    </div>
                </div>
            </EdgeLabelRenderer>

            {contextMenu && data?.relationship && (
                <RelationshipContextMenu
                    edgeId={id}
                    sourceTable={data.relationship.sourceTable}
                    targetTable={data.relationship.targetTable}
                    targetColumn={data.relationship.targetColumn}
                    position={contextMenu}
                    onClose={closeContextMenu}
                />
            )}
        </>
    );
};

export default memo(DatabaseRelationshipEdge);
