'use client';

import React, { useState, useEffect } from 'react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { PerformanceEngine, PerformanceConfig, PerformanceMetrics, TableGroup } from '@/lib/performance-engine';
import { 
  Settings, 
  Activity, 
  Layers, 
  Zap, 
  Monitor, 
  Clock, 
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';

interface PerformancePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PerformancePanel({ isOpen, onClose }: PerformancePanelProps) {
  const { nodes, edges, setNodes } = useDiagramStore();
  const [performanceEngine] = useState(() => new PerformanceEngine());
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [config, setConfig] = useState<PerformanceConfig>(performanceEngine.getConfig());
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      updateMetrics();
      updateTableGroups();
      updateRecommendations();
      
      const interval = setInterval(updateMetrics, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, nodes, edges]);

  const updateMetrics = () => {
    const currentMetrics = performanceEngine.getMetrics();
    setMetrics(currentMetrics);
  };

  const updateTableGroups = () => {
    const groups = performanceEngine.getTableGroups();
    setTableGroups(groups);
  };

  const updateRecommendations = () => {
    const recs = performanceEngine.getPerformanceRecommendations();
    setRecommendations(recs);
  };

  const handleConfigChange = (key: keyof PerformanceConfig, value: boolean | number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    performanceEngine.updateConfig(newConfig);
  };

  const toggleGroup = (groupId: string) => {
    performanceEngine.toggleGroupCollapse(groupId);
    updateTableGroups();
    
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const createGroups = () => {
    const groups = performanceEngine.createTableGroups(nodes, edges);
    setTableGroups(groups);
  };

  const clearGroups = () => {
    tableGroups.forEach(group => performanceEngine.deleteTableGroup(group.id));
    setTableGroups([]);
    setExpandedGroups(new Set());
  };

  const resetMetrics = () => {
    performanceEngine.resetMetrics();
    updateMetrics();
  };

  const getPerformanceScore = () => {
    if (!metrics) return 0;
    
    let score = 100;
    
    // FPS penalty
    if (metrics.fps < 30) score -= 30;
    else if (metrics.fps < 45) score -= 15;
    else if (metrics.fps < 55) score -= 5;
    
    // Render time penalty
    if (metrics.renderTime > 50) score -= 25;
    else if (metrics.renderTime > 30) score -= 15;
    else if (metrics.renderTime > 16) score -= 5;
    
    // Memory usage penalty
    if (metrics.memoryUsage && metrics.memoryUsage > 150) score -= 20;
    else if (metrics.memoryUsage && metrics.memoryUsage > 100) score -= 10;
    
    // Node count penalty
    if (metrics.totalNodes > 200) score -= 15;
    else if (metrics.totalNodes > 100) score -= 5;
    
    return Math.max(0, score);
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg z-50 border-l border-gray-200">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Performance</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <XCircle className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Performance Score */}
          {metrics && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Performance Score</span>
                <span className={`text-2xl font-bold ${getPerformanceColor(getPerformanceScore())}`}>
                  {getPerformanceScore()}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getPerformanceScore() >= 80 ? 'bg-green-500' :
                    getPerformanceScore() >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${getPerformanceScore()}%` }}
                />
              </div>
            </div>
          )}

          {/* Metrics */}
          {metrics && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Performance Metrics
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Nodes</span>
                  <span className="font-medium">{metrics.totalNodes}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Visible Nodes</span>
                  <span className="font-medium">{metrics.visibleNodes}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rendered Nodes</span>
                  <span className="font-medium">{metrics.renderedNodes}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">FPS</span>
                  <span className={`font-medium ${
                    metrics.fps >= 55 ? 'text-green-600' :
                    metrics.fps >= 30 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.fps}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Render Time</span>
                  <span className={`font-medium ${
                    metrics.renderTime <= 16 ? 'text-green-600' :
                    metrics.renderTime <= 30 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.renderTime.toFixed(1)}ms
                  </span>
                </div>
                {metrics.memoryUsage && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Memory Usage</span>
                    <span className={`font-medium ${
                      metrics.memoryUsage <= 50 ? 'text-green-600' :
                      metrics.memoryUsage <= 100 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {metrics.memoryUsage.toFixed(1)}MB
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={resetMetrics}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Metrics
              </button>
            </div>
          )}

          {/* Configuration */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Performance Settings
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Lazy Rendering</label>
                <button
                  onClick={() => handleConfigChange('enableLazyRendering', !config.enableLazyRendering)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.enableLazyRendering ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.enableLazyRendering ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Table Grouping</label>
                <button
                  onClick={() => handleConfigChange('enableGrouping', !config.enableGrouping)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.enableGrouping ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.enableGrouping ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Background Layout</label>
                <button
                  onClick={() => handleConfigChange('enableBackgroundLayout', !config.enableBackgroundLayout)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.enableBackgroundLayout ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.enableBackgroundLayout ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div>
                <label className="text-sm text-gray-700">Max Nodes in View</label>
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={config.maxNodesInView}
                  onChange={(e) => handleConfigChange('maxNodesInView', parseInt(e.target.value))}
                  className="w-full mt-1"
                />
                <div className="text-xs text-gray-500 mt-1">{config.maxNodesInView} nodes</div>
              </div>
            </div>
          </div>

          {/* Table Groups */}
          {config.enableGrouping && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Table Groups
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={createGroups}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Create Groups
                  </button>
                  <button
                    onClick={clearGroups}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {tableGroups.length === 0 ? (
                <p className="text-sm text-gray-500">No groups created yet</p>
              ) : (
                <div className="space-y-2">
                  {tableGroups.map(group => (
                    <div key={group.id} className="border border-gray-200 rounded">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          {expandedGroups.has(group.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="text-sm font-medium">{group.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {group.nodeIds.length} tables
                          </span>
                          {group.collapsed ? (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Eye className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>
                      {expandedGroups.has(group.id) && (
                        <div className="px-2 pb-2 text-xs text-gray-600">
                          {group.nodeIds.map(nodeId => {
                            const node = nodes.find(n => n.id === nodeId);
                            return node ? (
                              <div key={nodeId} className="py-1 pl-6">
                                • {node.data.name}
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Recommendations
              </h3>
              <div className="space-y-2">
                {recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <span className="text-sm text-yellow-800">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
