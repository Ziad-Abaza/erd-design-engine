import { Node } from 'reactflow';

/**
 * Get the width of a node, prioritizing actual dimensions
 */
export function getNodeWidth(node: Node): number {
    if (node.width) return node.width;
    const baseWidth = 200;
    if (node.type === 'table' && node.data?.columns) {
        const columnWidth = 150;
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
 * Checks if a horizontal or vertical segment intersects a node's rectangle
 */
function segmentIntersectsNode(p1: { x: number; y: number }, p2: { x: number; y: number }, node: Node): boolean {
    const width = getNodeWidth(node);
    const height = getNodeHeight(node);
    const padding = 20;

    const rect = {
        left: node.position.x - padding,
        right: node.position.x + width + padding,
        top: node.position.y - padding,
        bottom: node.position.y + height + padding
    };

    // Horizontal segment
    if (Math.abs(p1.y - p2.y) < 0.1) {
        const xMin = Math.min(p1.x, p2.x);
        const xMax = Math.max(p1.x, p2.x);
        return p1.y > rect.top && p1.y < rect.bottom && xMax > rect.left && xMin < rect.right;
    }
    // Vertical segment
    if (Math.abs(p1.x - p2.x) < 0.1) {
        const yMin = Math.min(p1.y, p2.y);
        const yMax = Math.max(p1.y, p2.y);
        return p1.x > rect.left && p1.x < rect.right && yMax > rect.top && yMin < rect.bottom;
    }

    return false;
}

/**
 * Simplifies a path by removing redundant points that lie on the same line
 */
function simplifyPath(path: { x: number; y: number }[]): { x: number; y: number }[] {
    if (path.length <= 2) return path;
    const simplified = [path[0]];

    for (let i = 1; i < path.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        const curr = path[i];
        const next = path[i + 1];

        // Skip if current point is same as previous
        if (Math.abs(curr.x - prev.x) < 0.1 && Math.abs(curr.y - prev.y) < 0.1) continue;

        // Skip if current point is on the straight line between prev and next
        const isHorizontal = Math.abs(prev.y - curr.y) < 0.1 && Math.abs(curr.y - next.y) < 0.1;
        const isVertical = Math.abs(prev.x - curr.x) < 0.1 && Math.abs(prev.y - curr.y) > 0.1 && Math.abs(curr.x - next.x) < 0.1;

        // Better straight line check
        const isPointOnLine = (p1: any, p2: any, p3: any) => {
            if (Math.abs(p1.x - p2.x) < 0.1 && Math.abs(p2.x - p3.x) < 0.1) return true; // vertical
            if (Math.abs(p1.y - p2.y) < 0.1 && Math.abs(p2.y - p3.y) < 0.1) return true; // horizontal
            return false;
        };

        if (!isPointOnLine(prev, curr, next)) {
            simplified.push(curr);
        }
    }

    const last = path[path.length - 1];
    const prevToLast = simplified[simplified.length - 1];
    if (Math.abs(last.x - prevToLast.x) > 0.1 || Math.abs(last.y - prevToLast.y) > 0.1) {
        simplified.push(last);
    }

    return simplified;
}

/**
 * Calculate smart orthogonal path points for an edge to avoid overlapping with other nodes
 */
export function calculateSmartOrthogonalPath(sourceNode: Node, targetNode: Node, allNodes: Node[], edgeId?: string): { x: number; y: number }[] {
    const sW = getNodeWidth(sourceNode);
    const sH = getNodeHeight(sourceNode);
    const tW = getNodeWidth(targetNode);
    const tH = getNodeHeight(targetNode);

    const sX = sourceNode.position.x + sW / 2;
    const sY = sourceNode.position.y + sH / 2;
    const tX = targetNode.position.x + tW / 2;
    const tY = targetNode.position.y + tH / 2;

    const dx = tX - sX;
    const dy = tY - sY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // If nodes are very close, return direct path
    if (absDx < 40 && absDy < 40) return [];

    // Base candidates
    let candidates: { x: number; y: number }[][] = [
        [{ x: sX, y: sY }, { x: tX, y: tY }], // Direct
        [{ x: sX, y: sY }, { x: tX, y: sY }, { x: tX, y: tY }], // L-H
        [{ x: sX, y: sY }, { x: sX, y: tY }, { x: tX, y: tY }], // L-V
        [{ x: sX, y: sY }, { x: (sX + tX) / 2, y: sY }, { x: (sX + tX) / 2, y: tY }, { x: tX, y: tY }], // Z-H
        [{ x: sX, y: sY }, { x: sX, y: (sY + tY) / 2 }, { x: tX, y: (sY + tY) / 2 }, { x: tX, y: tY }]  // Z-V
    ];

    // Detect collisions for base paths to find obstacles
    const obstacles: Node[] = [];
    for (const path of candidates) {
        const simplified = simplifyPath(path);
        for (let i = 0; i < simplified.length - 1; i++) {
            for (const node of allNodes) {
                if (node.id === sourceNode.id || node.id === targetNode.id) continue;
                if (segmentIntersectsNode(simplified[i], simplified[i + 1], node)) {
                    if (!obstacles.find(o => o.id === node.id)) obstacles.push(node);
                }
            }
        }
    }

    // For each obstacle, try paths that go around it
    const PADDING = 60;
    for (const node of obstacles) {
        const nW = getNodeWidth(node);
        const nH = getNodeHeight(node);
        const left = node.position.x - PADDING;
        const right = node.position.x + nW + PADDING;
        const top = node.position.y - PADDING;
        const bottom = node.position.y + nH + PADDING;

        candidates.push([{ x: sX, y: sY }, { x: left, y: sY }, { x: left, y: tY }, { x: tX, y: tY }]);
        candidates.push([{ x: sX, y: sY }, { x: right, y: sY }, { x: right, y: tY }, { x: tX, y: tY }]);
        candidates.push([{ x: sX, y: sY }, { x: sX, y: top }, { x: tX, y: top }, { x: tX, y: tY }]);
        candidates.push([{ x: sX, y: sY }, { x: sX, y: bottom }, { x: tX, y: bottom }, { x: tX, y: tY }]);
    }

    // Deterministic offset to midpoints to avoid edge stacking
    let edgeOffset = 0;
    if (edgeId) {
        let hash = 0;
        for (let i = 0; i < edgeId.length; i++) hash = ((hash << 5) - hash) + edgeId.charCodeAt(i);
        edgeOffset = ((Math.abs(hash) % 5) - 2) * 8;
    }

    // Scoring function
    function getPathScore(path: { x: number; y: number }[]): number {
        let collisions = 0;
        let length = 0;

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            length += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

            for (const node of allNodes) {
                if (node.id === sourceNode.id || node.id === targetNode.id) continue;
                if (segmentIntersectsNode(p1, p2, node)) collisions++;
            }
        }

        let score = collisions * 100000; // Extreme collision penalty
        score += (path.length - 2) * 2000; // Turn penalty
        score += length * 0.1; // Length penalty
        return score;
    }

    let bestPath: { x: number; y: number }[] = [];
    let minScore = Infinity;

    for (let rawPath of candidates) {
        let path = rawPath.map((p, i) => {
            if (i === 0 || i === rawPath.length - 1) return p;

            const prev = rawPath[i - 1];
            let ox = 0, oy = 0;
            if (Math.abs(prev.x - p.x) < 0.1) ox = edgeOffset;
            else if (Math.abs(prev.y - p.y) < 0.1) oy = edgeOffset;

            return { x: p.x + ox, y: p.y + oy };
        });

        const simplified = simplifyPath(path);
        const score = getPathScore(simplified);

        if (score < minScore) {
            minScore = score;
            bestPath = simplified;
        }
    }

    // If best path is direct and clean, return no intermediate points
    if (bestPath.length === 2 && minScore === 0) return [];

    return bestPath.slice(1, -1);
}
