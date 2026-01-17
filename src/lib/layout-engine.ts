import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';
import { TableNodeData } from '@/components/editor/nodes/table-node';

export interface LayoutOptions {
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSpacing: number;
  rankSpacing: number;
  alignNodes?: boolean;
  minimizeEdgeCrossings?: boolean;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export class LayoutEngine {
  private static readonly DEFAULT_OPTIONS: LayoutOptions = {
    direction: 'TB',
    nodeSpacing: 100,
    rankSpacing: 150,
    alignNodes: true,
    minimizeEdgeCrossings: true,
  };

  static autoLayout(
    nodes: Node<TableNodeData>[],
    edges: Edge[],
    options: Partial<LayoutOptions> = {}
  ): LayoutResult {
    const layoutOptions = { ...this.DEFAULT_OPTIONS, ...options };

    // Create a new directed graph
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: layoutOptions.direction,
      nodesep: layoutOptions.nodeSpacing,
      ranksep: layoutOptions.rankSpacing,
      marginx: 50,
      marginy: 50,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to the graph
    nodes.forEach((node) => {
      const nodeWidth = this.estimateNodeWidth(node);
      const nodeHeight = this.estimateNodeHeight(node);

      g.setNode(node.id, {
        width: nodeWidth,
        height: nodeHeight,
      });
    });

    // Add edges to the graph
    edges.forEach((edge) => {
      if (edge.source && edge.target) {
        g.setEdge(edge.source, edge.target);
      }
    });

    // Layout the graph
    dagre.layout(g);

    // Apply layout to nodes
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWithPosition.width / 2,
          y: nodeWithPosition.y - nodeWithPosition.height / 2,
        },
        targetPosition: this.getTargetPosition(layoutOptions.direction),
        sourcePosition: this.getSourcePosition(layoutOptions.direction),
      };
    });

    // Optimize edge paths if requested
    const layoutedEdges = layoutOptions.minimizeEdgeCrossings
      ? this.optimizeEdgePaths(edges, layoutedNodes)
      : edges;

    return {
      nodes: layoutedNodes,
      edges: layoutedEdges,
    };
  }

  static forceDirectedLayout(
    nodes: Node<TableNodeData>[],
    edges: Edge[],
    width: number,
    height: number
  ): LayoutResult {
    // Simple force-directed layout implementation
    const layoutedNodes = [...nodes];
    const forces = new Map<string, { x: number; y: number }>();

    // Initialize forces
    layoutedNodes.forEach(node => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Repulsive forces between all nodes
    for (let i = 0; i < layoutedNodes.length; i++) {
      for (let j = i + 1; j < layoutedNodes.length; j++) {
        const nodeA = layoutedNodes[i];
        const nodeB = layoutedNodes[j];

        const dx = nodeA.position.x - nodeB.position.x;
        const dy = nodeA.position.y - nodeB.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = 5000 / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        const forceA = forces.get(nodeA.id)!;
        const forceB = forces.get(nodeB.id)!;

        forceA.x += fx;
        forceA.y += fy;
        forceB.x -= fx;
        forceB.y -= fy;
      }
    }

    // Attractive forces for connected nodes
    edges.forEach(edge => {
      const sourceNode = layoutedNodes.find(n => n.id === edge.source);
      const targetNode = layoutedNodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = distance * 0.01;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        const sourceForce = forces.get(sourceNode.id)!;
        const targetForce = forces.get(targetNode.id)!;

        sourceForce.x += fx;
        sourceForce.y += fy;
        targetForce.x -= fx;
        targetForce.y -= fy;
      }
    });

    // Apply forces and update positions
    layoutedNodes.forEach(node => {
      const force = forces.get(node.id)!;
      node.position.x += force.x * 0.1;
      node.position.y += force.y * 0.1;

      // Keep nodes within bounds
      node.position.x = Math.max(50, Math.min(width - 200, node.position.x));
      node.position.y = Math.max(50, Math.min(height - 150, node.position.y));
    });

    return {
      nodes: layoutedNodes,
      edges,
    };
  }

  static hierarchicalGroupLayout(
    nodes: Node<TableNodeData>[],
    edges: Edge[],
    groupBy: 'schema' | 'relationship' = 'relationship'
  ): LayoutResult {
    // Group nodes by their relationships or schemas
    const groups = new Map<string, Node<TableNodeData>[]>();

    if (groupBy === 'relationship') {
      // Find connected components
      const visited = new Set<string>();
      const components: string[][] = [];

      nodes.forEach(node => {
        if (!visited.has(node.id)) {
          const component: string[] = [];
          this.dfs(node.id, edges, visited, component);
          components.push(component);
        }
      });

      // Create groups from components
      components.forEach((component, index) => {
        const groupNodes = nodes.filter(n => component.includes(n.id));
        groups.set(`group-${index}`, groupNodes);
      });
    } else {
      // Group by schema (if available in node data)
      nodes.forEach(node => {
        const schema = (node.data as any).schema || 'default';
        if (!groups.has(schema)) {
          groups.set(schema, []);
        }
        groups.get(schema)!.push(node);
      });
    }

    // Layout each group separately
    const layoutedNodes: Node<TableNodeData>[] = [];
    let yOffset = 50;
    let xOffset = 50;

    groups.forEach((groupNodes, groupName) => {
      const groupEdges = edges.filter(e =>
        groupNodes.some(n => n.id === e.source) &&
        groupNodes.some(n => n.id === e.target)
      );

      const groupLayout = this.autoLayout(groupNodes, groupEdges, {
        direction: 'LR',
        nodeSpacing: 80,
        rankSpacing: 120,
      });

      // Offset the group
      groupLayout.nodes.forEach(node => {
        node.position.x += xOffset;
        node.position.y += yOffset;
        layoutedNodes.push(node);
      });

      // Update offset for next group
      const groupWidth = Math.max(...groupLayout.nodes.map(n => n.position.x + 200));
      const groupHeight = Math.max(...groupLayout.nodes.map(n => n.position.y + 150));

      if (xOffset + groupWidth > 800) {
        xOffset = 50;
        yOffset += groupHeight + 100;
      } else {
        xOffset += groupWidth + 100;
      }
    });

    return {
      nodes: layoutedNodes,
      edges,
    };
  }

  private static dfs(
    nodeId: string,
    edges: Edge[],
    visited: Set<string>,
    component: string[]
  ): void {
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    component.push(nodeId);

    edges.forEach(edge => {
      if (edge.source === nodeId && !visited.has(edge.target)) {
        this.dfs(edge.target, edges, visited, component);
      } else if (edge.target === nodeId && !visited.has(edge.source)) {
        this.dfs(edge.source, edges, visited, component);
      }
    });
  }

  private static estimateNodeWidth(node: Node<TableNodeData>): number {
    const baseWidth = 200;
    const columnWidth = 150;
    const maxColumns = Math.max(3, node.data.columns.length);
    return Math.max(baseWidth, columnWidth + maxColumns * 30);
  }

  private static estimateNodeHeight(node: Node<TableNodeData>): number {
    const headerHeight = 40;
    const columnHeight = 25;
    const padding = 20;
    const minColumns = Math.max(1, node.data.columns.length);
    return headerHeight + (minColumns * columnHeight) + padding;
  }

  private static getTargetPosition(direction: string): Position {
    switch (direction) {
      case 'TB':
        return Position.Top;
      case 'BT':
        return Position.Bottom;
      case 'LR':
        return Position.Left;
      case 'RL':
        return Position.Right;
      default:
        return Position.Top;
    }
  }

  private static getSourcePosition(direction: string): Position {
    switch (direction) {
      case 'TB':
        return Position.Bottom;
      case 'BT':
        return Position.Top;
      case 'LR':
        return Position.Right;
      case 'RL':
        return Position.Left;
      default:
        return Position.Bottom;
    }
  }

  private static optimizeEdgePaths(edges: Edge[], nodes: Node[]): Edge[] {
    // Simple edge optimization - could be enhanced with more sophisticated algorithms
    return edges.map(edge => {
      // Don't modify custom relationship edges
      if (edge.type && ['relationship', 'manyToMany', 'editableRelationship'].includes(edge.type)) {
        return edge;
      }

      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        // Determine if edge should be animated based on distance
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return {
          ...edge,
          animated: distance > 300, // Animate long edges
          type: distance > 200 ? 'smoothstep' : 'straight',
        };
      }

      return edge;
    });
  }
}
