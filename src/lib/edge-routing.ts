import { Node } from 'reactflow';

/**
 * Get the width of a node, prioritizing actual dimensions
 */
export function getNodeWidth(node: Node): number {
    if (node.width) return node.width;
    const baseWidth = 200;
    const columnWidth = 150;
    if (node.type === 'table' && node.data?.columns) {
        const maxColumns = Math.max(3, node.data.columns.length);
        return Math.max(baseWidth, columnWidth + maxColumns * 30);
    }
    return baseWidth;
}

/**
 * Get the height of a node, prioritizing actual dimensions
 */
export function getNodeHeight(node: Node): number {
    if (node.height) return node.height;
    const headerHeight = 40;
    const rowHeight = 32;
    if (node.type === 'table' && node.data?.columns) {
        return headerHeight + node.data.columns.length * rowHeight + 20;
    }
    return 200;
}

/**
 * Calculate smart orthogonal path points for an edge to avoid overlapping with other nodes
 * This creates an L-shaped or Z-shaped path that avoids visual clutter
 */
export function calculateSmartOrthogonalPath(sourceNode: Node, targetNode: Node, allNodes: Node[]): { x: number; y: number }[] {
    const sourceWidth = getNodeWidth(sourceNode);
    const sourceHeight = getNodeHeight(sourceNode);
    const targetWidth = getNodeWidth(targetNode);
    const targetHeight = getNodeHeight(targetNode);

    const sourceX = sourceNode.position.x + sourceWidth / 2;
    const sourceY = sourceNode.position.y + sourceHeight / 2;
    const targetX = targetNode.position.x + targetWidth / 2;
    const targetY = targetNode.position.y + targetHeight / 2;

    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // If nodes are close together, no intermediate points needed
    if (absDx < 250 && absDy < 250) {
        return [];
    }

    const pathPoints: { x: number; y: number }[] = [];
    const OFFSET = 50; // Offset distance from nodes to avoid overlap
    const MIN_DISTANCE = 100; // Minimum distance between segments

    // Calculate L-shaped path: horizontal first, then vertical (or vice versa)
    // Choose the direction that avoids other nodes better

    // Option 1: Horizontal first (right/left, then down/up)
    const midX = (sourceX + targetX) / 2;
    const midY1 = sourceY + (dy > 0 ? OFFSET : -OFFSET);
    const midX2 = targetX + (dx > 0 ? -OFFSET : OFFSET);
    const midY2 = targetY;

    // Option 2: Vertical first (down/up, then right/left)
    const midX1_v = sourceX;
    const midY1_v = (sourceY + targetY) / 2;
    const midX2_v = targetX;
    const midY2_v = targetY + (dy > 0 ? -OFFSET : OFFSET);

    // Choose the path that avoids other nodes
    let path1Collisions = 0;
    let path2Collisions = 0;

    // Simple collision detection: check if intermediate points are too close to other nodes
    for (const node of allNodes) {
        if (node.id === sourceNode.id || node.id === targetNode.id) continue;

        const nodeWidth = getNodeWidth(node);
        const nodeHeight = getNodeHeight(node);
        const nodeX = node.position.x + nodeWidth / 2;
        const nodeY = node.position.y + nodeHeight / 2;

        // Check path 1 intermediate points
        const dist1_1 = Math.sqrt(Math.pow(midX - nodeX, 2) + Math.pow(midY1 - nodeY, 2));
        const dist1_2 = Math.sqrt(Math.pow(midX2 - nodeX, 2) + Math.pow(midY2 - nodeY, 2));
        if (dist1_1 < (nodeWidth + nodeHeight) / 2 + 30 || dist1_2 < (nodeWidth + nodeHeight) / 2 + 30) {
            path1Collisions++;
        }

        // Check path 2 intermediate points
        const dist2_1 = Math.sqrt(Math.pow(midX1_v - nodeX, 2) + Math.pow(midY1_v - nodeY, 2));
        const dist2_2 = Math.sqrt(Math.pow(midX2_v - nodeX, 2) + Math.pow(midY2_v - nodeY, 2));
        if (dist2_1 < (nodeWidth + nodeHeight) / 2 + 30 || dist2_2 < (nodeWidth + nodeHeight) / 2 + 30) {
            path2Collisions++;
        }
    }

    // Use the path with fewer collisions, or horizontal-first by default
    if (path2Collisions < path1Collisions && absDy > absDx) {
        // Vertical first
        if (absDy > MIN_DISTANCE) {
            pathPoints.push({ x: midX1_v, y: midY1_v });
        }
        if (absDx > MIN_DISTANCE) {
            pathPoints.push({ x: midX2_v, y: midY2_v });
        }
    } else {
        // Horizontal first (default for most cases)
        if (absDx > MIN_DISTANCE) {
            pathPoints.push({ x: midX, y: midY1 });
        }
        if (absDy > MIN_DISTANCE) {
            pathPoints.push({ x: midX2, y: midY2 });
        }
    }

    return pathPoints;
}
