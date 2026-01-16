import { Node, Edge, Viewport } from 'reactflow';

export interface PerformanceConfig {
    enableLazyRendering: boolean;
    maxNodesInView: number;
    viewportBuffer: number;
    enableGrouping: boolean;
    enableBackgroundLayout: boolean;
}

export interface PerformanceMetrics {
    totalNodes: number;
    visibleNodes: number;
    renderedNodes: number;
    fps: number;
    renderTime: number;
    memoryUsage?: number;
}

export interface TableGroup {
    id: string;
    name: string;
    nodeIds: string[];
    position: { x: number; y: number };
    collapsed: boolean;
    color?: string;
}

export class PerformanceEngine {
    private config: PerformanceConfig;
    private metrics: PerformanceMetrics;
    private frameCount: number = 0;
    private lastFrameTime: number = 0;
    private renderStartTime: number = 0;
    private tableGroups: Map<string, TableGroup> = new Map();
    private visibilityCache: Map<string, boolean> = new Map();

    constructor(config: Partial<PerformanceConfig> = {}) {
        this.config = {
            enableLazyRendering: true,
            maxNodesInView: 100,
            viewportBuffer: 200,
            enableGrouping: false,
            enableBackgroundLayout: true,
            ...config
        };

        this.metrics = {
            totalNodes: 0,
            visibleNodes: 0,
            renderedNodes: 0,
            fps: 0,
            renderTime: 0
        };
    }

    // Viewport culling for performance optimization
    getVisibleNodes(nodes: Node[], viewport: Viewport): Node[] {
        if (!this.config.enableLazyRendering) {
            return nodes;
        }

        const { x, y, zoom } = viewport;
        const buffer = this.config.viewportBuffer / zoom;
        
        // Calculate viewport bounds with buffer
        const viewportBounds = {
            left: -x / zoom - buffer,
            top: -y / zoom - buffer,
            right: (-x + window.innerWidth) / zoom + buffer,
            bottom: (-y + window.innerHeight) / zoom + buffer
        };

        // Filter nodes based on viewport bounds
        const visibleNodes = nodes.filter(node => {
            const nodeBounds = {
                left: node.position.x,
                top: node.position.y,
                right: node.position.x + (node.width || 200),
                bottom: node.position.y + (node.height || 150)
            };

            return this.isNodeInViewport(nodeBounds, viewportBounds);
        });

        // Limit number of nodes to render
        if (visibleNodes.length > this.config.maxNodesInView) {
            return visibleNodes.slice(0, this.config.maxNodesInView);
        }

        return visibleNodes;
    }

    private isNodeInViewport(nodeBounds: any, viewportBounds: any): boolean {
        return !(
            nodeBounds.right < viewportBounds.left ||
            nodeBounds.left > viewportBounds.right ||
            nodeBounds.bottom < viewportBounds.top ||
            nodeBounds.top > viewportBounds.bottom
        );
    }

    // Table grouping for large schemas
    createTableGroups(nodes: Node[], edges: Edge[]): TableGroup[] {
        if (!this.config.enableGrouping || nodes.length < 20) {
            return [];
        }

        const groups: TableGroup[] = [];
        const ungroupedNodes = new Set(nodes.map(n => n.id));
        
        // Group by proximity
        const clustered = this.clusterNodesByProximity(nodes);
        
        clustered.forEach((cluster, index) => {
            const groupId = `group-${index}`;
            const groupName = `Group ${index + 1}`;
            
            const group: TableGroup = {
                id: groupId,
                name: groupName,
                nodeIds: cluster.map(n => n.id),
                position: this.calculateGroupCenter(cluster),
                collapsed: false,
                color: this.getGroupColor(index)
            };

            groups.push(group);
            cluster.forEach(node => ungroupedNodes.delete(node.id));
        });

        // Create group for remaining ungrouped nodes
        if (ungroupedNodes.size > 0) {
            const remainingNodes = nodes.filter(n => ungroupedNodes.has(n.id));
            groups.push({
                id: 'group-remaining',
                name: 'Other Tables',
                nodeIds: remainingNodes.map(n => n.id),
                position: this.calculateGroupCenter(remainingNodes),
                collapsed: false,
                color: '#94a3b8'
            });
        }

        this.tableGroups.clear();
        groups.forEach(group => this.tableGroups.set(group.id, group));
        
        return groups;
    }

    private clusterNodesByProximity(nodes: Node[]): Node[][] {
        const clusters: Node[][] = [];
        const visited = new Set<string>();
        const maxDistance = 500; // Maximum distance for clustering

        nodes.forEach(node => {
            if (visited.has(node.id)) return;

            const cluster = [node];
            visited.add(node.id);

            // Find nearby nodes
            nodes.forEach(otherNode => {
                if (visited.has(otherNode.id) || node.id === otherNode.id) return;

                const distance = this.calculateDistance(node, otherNode);
                if (distance <= maxDistance) {
                    cluster.push(otherNode);
                    visited.add(otherNode.id);
                }
            });

            clusters.push(cluster);
        });

        return clusters;
    }

    private calculateDistance(node1: Node, node2: Node): number {
        const dx = node1.position.x - node2.position.x;
        const dy = node1.position.y - node2.position.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private calculateGroupCenter(nodes: Node[]): { x: number; y: number } {
        if (nodes.length === 0) return { x: 0, y: 0 };

        const sumX = nodes.reduce((sum, node) => sum + node.position.x, 0);
        const sumY = nodes.reduce((sum, node) => sum + node.position.y, 0);

        return {
            x: sumX / nodes.length,
            y: sumY / nodes.length
        };
    }

    private getGroupColor(index: number): string {
        const colors = [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
        ];
        return colors[index % colors.length];
    }

    // Performance monitoring
    startRenderCycle(): void {
        this.renderStartTime = performance.now();
        this.frameCount++;
    }

    endRenderCycle(totalNodes: number, visibleNodes: number, renderedNodes: number): void {
        const renderTime = performance.now() - this.renderStartTime;
        const currentTime = performance.now();

        // Calculate FPS
        if (currentTime - this.lastFrameTime >= 1000) {
            this.metrics.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = currentTime;
        }

        this.metrics.totalNodes = totalNodes;
        this.metrics.visibleNodes = visibleNodes;
        this.metrics.renderedNodes = renderedNodes;
        this.metrics.renderTime = renderTime;

        // Memory usage (if available)
        if ('memory' in performance) {
            const memory = (performance as any).memory;
            this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
        }
    }

    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    // Background layout processing
    async processBackgroundLayout(nodes: Node[], edges: Edge[]): Promise<void> {
        if (!this.config.enableBackgroundLayout) {
            return;
        }

        // Process in chunks to avoid blocking UI
        const chunkSize = 50;
        const chunks = this.createChunks(nodes, chunkSize);

        for (let i = 0; i < chunks.length; i++) {
            await this.processChunk(chunks[i], edges);
            
            // Yield control to browser
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    private createChunks<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    private async processChunk(nodes: Node[], edges: Edge[]): Promise<void> {
        // Simulate background processing
        return new Promise(resolve => {
            setTimeout(() => {
                // Process node optimizations
                nodes.forEach(node => {
                    this.optimizeNode(node);
                });
                resolve();
            }, 0);
        });
    }

    private optimizeNode(node: Node): void {
        // Add optimization logic here
        // For example: pre-calculate positions, optimize data structures
    }

    // Progressive loading
    async loadNodesProgressively(nodes: Node[], onLoad: (loadedNodes: Node[]) => void): Promise<void> {
        const batchSize = 20;
        const delay = 100; // ms between batches

        for (let i = 0; i < nodes.length; i += batchSize) {
            const batch = nodes.slice(i, i + batchSize);
            onLoad(batch);
            
            if (i + batchSize < nodes.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Configuration management
    updateConfig(newConfig: Partial<PerformanceConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig(): PerformanceConfig {
        return { ...this.config };
    }

    // Table group management
    getTableGroups(): TableGroup[] {
        return Array.from(this.tableGroups.values());
    }

    getTableGroup(id: string): TableGroup | undefined {
        return this.tableGroups.get(id);
    }

    updateTableGroup(group: TableGroup): void {
        this.tableGroups.set(group.id, group);
    }

    deleteTableGroup(id: string): void {
        this.tableGroups.delete(id);
    }

    toggleGroupCollapse(id: string): void {
        const group = this.tableGroups.get(id);
        if (group) {
            group.collapsed = !group.collapsed;
            this.tableGroups.set(id, group);
        }
    }

    // Performance recommendations
    getPerformanceRecommendations(): string[] {
        const recommendations: string[] = [];

        if (this.metrics.totalNodes > 100 && !this.config.enableLazyRendering) {
            recommendations.push('Enable lazy rendering for better performance with large schemas');
        }

        if (this.metrics.totalNodes > 50 && !this.config.enableGrouping) {
            recommendations.push('Enable table grouping to organize large schemas');
        }

        if (this.metrics.fps < 30) {
            recommendations.push('Consider reducing the maximum nodes in view or enabling grouping');
        }

        if (this.metrics.memoryUsage && this.metrics.memoryUsage > 100) {
            recommendations.push('High memory usage detected. Consider enabling lazy rendering');
        }

        if (this.metrics.renderTime > 16) { // 60fps = 16ms per frame
            recommendations.push('Slow render time detected. Enable background layout processing');
        }

        return recommendations;
    }

    // Reset metrics
    resetMetrics(): void {
        this.metrics = {
            totalNodes: 0,
            visibleNodes: 0,
            renderedNodes: 0,
            fps: 0,
            renderTime: 0
        };
        this.frameCount = 0;
        this.lastFrameTime = 0;
    }
}
