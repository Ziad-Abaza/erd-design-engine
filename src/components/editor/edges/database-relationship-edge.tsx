import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    EdgeProps,
    getSmoothStepPath,
    Position,
    useReactFlow,
} from 'reactflow';
import { cn } from '@/lib/utils';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { RelationshipContextMenu } from '../context-menu';
import { useDiagramStore } from '@/store/use-diagram-store';

interface DatabaseRelationshipEdgeData {
    relationship: {
        sourceTable: string;
        targetTable: string;
        sourceColumn: string;
        targetColumn: string;
        cardinality: '1:1' | '1:N' | '0:1' | '0:N' | 'N:M';
        isIdentifying?: boolean;
        label?: string;
    };
    isValid?: boolean;
    pathPoints?: { x: number; y: number }[];
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
    const { screenToFlowPosition } = useReactFlow();
    const updateEdgePathPoints = useDiagramStore(state => state.updateEdgePathPoints);
    const showRelationshipLabels = useDiagramStore(state => state.showRelationshipLabels);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isDraggingPoint, setIsDraggingPoint] = useState<number | null>(null);

    const isValid = data?.isValid !== false;
    const isIdentifying = data?.relationship?.isIdentifying ?? true;
    const cardinality = data?.relationship?.cardinality || '1:N';
    const pathPoints = data?.pathPoints || [];

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

    // Calculate full path through all points
    const { edgePath, labelX, labelY, midpoints } = useMemo(() => {
        // Safety check: Don't render if coordinates are not yet available or invalid
        if (typeof sourceX !== 'number' || typeof sourceY !== 'number' ||
            typeof targetX !== 'number' || typeof targetY !== 'number' ||
            isNaN(sourceX) || isNaN(sourceY) || isNaN(targetX) || isNaN(targetY)) {
            return { edgePath: "", labelX: 0, labelY: 0, midpoints: [] };
        }

        let fullPath = "";
        let finalLabelX = 0;
        let finalLabelY = 0;
        const currentMidpoints: { x: number; y: number; index: number }[] = [];

        // All points including source and target
        const points = [
            { x: sourceX, y: sourceY, pos: sourcePosition },
            ...(data?.pathPoints || []).map(p => ({ ...p, pos: undefined })),
            { x: targetX, y: targetY, pos: targetPosition }
        ];

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];

            let sPos = start.pos as Position;
            let tPos = end.pos as Position;

            if (!sPos) {
                const prev = points[i - 1];
                const dx = start.x - prev.x;
                const dy = start.y - prev.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                    sPos = dx > 0 ? Position.Right : Position.Left;
                } else {
                    sPos = dy > 0 ? Position.Bottom : Position.Top;
                }
            }

            if (!tPos) {
                // Peek ahead to next point or use current segment direction
                const next = points[i + 2];
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                    tPos = dx > 0 ? Position.Left : Position.Right;
                } else {
                    tPos = dy > 0 ? Position.Top : Position.Bottom;
                }
            }

            const [segmentPath, segLabelX, segLabelY] = getSmoothStepPath({
                sourceX: start.x,
                sourceY: start.y,
                sourcePosition: sPos,
                targetX: end.x,
                targetY: end.y,
                targetPosition: tPos,
                borderRadius: 0,
            });

            if (segmentPath) {
                fullPath += (fullPath ? " " : "") + segmentPath;
            }

            // Collect midpoints for adding new waypoints
            currentMidpoints.push({ x: segLabelX, y: segLabelY, index: i });

            // Use the middle segment for the label
            if (i === Math.floor((points.length - 1) / 2)) {
                finalLabelX = segLabelX;
                finalLabelY = segLabelY;
            }
        }

        return { edgePath: fullPath, labelX: finalLabelX, labelY: finalLabelY, midpoints: currentMidpoints };
    }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data?.pathPoints]);

    const markerStart = useMemo(() => {
        switch (cardinality) {
            case '1:1': return 'url(#marker-one-only)';
            case '1:N': return 'url(#marker-one-only)';
            case '0:1': return 'url(#marker-one-only)';
            case '0:N': return 'url(#marker-one-only)';
            case 'N:M': return 'url(#marker-many)';
            default: return 'url(#marker-one-only)';
        }
    }, [cardinality]);

    const markerEnd = useMemo(() => {
        switch (cardinality) {
            case '1:1': return 'url(#marker-one-only)';
            case '1:N': return 'url(#marker-one-many)';
            case '0:1': return 'url(#marker-zero-one)';
            case '0:N': return 'url(#marker-zero-many)';
            case 'N:M': return 'url(#marker-many)';
            default: return 'url(#marker-one-many)';
        }
    }, [cardinality]);

    const onAddPoint = useCallback((x: number, y: number, index: number) => {
        const newPoints = [...pathPoints];
        newPoints.splice(index, 0, { x, y });
        updateEdgePathPoints(id, newPoints);
    }, [id, pathPoints, updateEdgePathPoints]);

    const onRemovePoint = useCallback((index: number) => {
        const newPoints = pathPoints.filter((_, i) => i !== index);
        updateEdgePathPoints(id, newPoints);
    }, [id, pathPoints, updateEdgePathPoints]);

    const onStartDragPoint = useCallback((index: number) => {
        setIsDraggingPoint(index);
    }, []);

    useEffect(() => {
        if (isDraggingPoint === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            const position = screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
            });

            const newPoints = [...pathPoints];
            newPoints[isDraggingPoint] = { x: position.x, y: position.y };
            updateEdgePathPoints(id, newPoints);
        };

        const handleMouseUp = () => {
            setIsDraggingPoint(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [id, isDraggingPoint, pathPoints, screenToFlowPosition, updateEdgePathPoints]);

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
                    transition: isDraggingPoint !== null ? 'none' : 'all 0.2s',
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
                {showRelationshipLabels && (
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
                )}

                {/* Draggable waypoints */}
                {selected && pathPoints.map((point, index) => (
                    <div
                        key={`point-${index}`}
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${point.x}px,${point.y}px)`,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan group"
                    >
                        <div
                            className="w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-move shadow-md hover:scale-125 transition-transform"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                onStartDragPoint(index);
                            }}
                        />
                        <button
                            className="absolute -top-4 -right-4 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemovePoint(index);
                            }}
                        >
                            <X className="w-2 h-2" />
                        </button>
                    </div>
                ))}

                {/* Midpoints to add new points */}
                {selected && isDraggingPoint === null && midpoints.map((mid, i) => (
                    <div
                        key={`mid-${i}`}
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${mid.x}px,${mid.y}px)`,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan"
                    >
                        <button
                            className="w-4 h-4 bg-white border border-blue-200 text-blue-500 rounded-full flex items-center justify-center shadow-sm opacity-0 hover:opacity-100 hover:scale-125 transition-all"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddPoint(mid.x, mid.y, mid.index);
                            }}
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                ))}
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
