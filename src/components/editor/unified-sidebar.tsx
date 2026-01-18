"use client";

import React, { useState, useEffect } from 'react';
import {
    Plus,
    Sparkles,
    RotateCcw,
    Trash2,
    Link,
    Layout,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
    ChevronUp,
    Activity,
    Database,
    Download,
    Upload,
    Save,
    History,
    FileImage,
    FileText,
    File,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Loader2,
    Menu,
    X
} from 'lucide-react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { cn } from '@/lib/utils';

interface SidebarSectionProps {
    title: string;
    icon: React.ReactNode;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    isCollapsed?: boolean;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
    title,
    icon,
    isExpanded,
    onToggle,
    children,
    isCollapsed = false
}) => {
    return (
        <div className="border-b border-border last:border-b-0">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors text-left"
            >
                {icon}
                {!isCollapsed && (
                    <>
                        <span className="text-sm font-medium">{title}</span>
                        <ChevronDown className={cn(
                            "w-4 h-4 transition-transform ml-auto",
                            isExpanded && "rotate-180"
                        )} />
                    </>
                )}
            </button>
            {isExpanded && !isCollapsed && (
                <div className="px-2 pb-2 space-y-1">
                    {children}
                </div>
            )}
        </div>
    );
};

const UnifiedSidebar: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        tools: true,
        importExport: false,
        projectSettings: false,
        quality: false
    });

    const [showLayoutOptions, setShowLayoutOptions] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [currentAiEnabled, setCurrentAiEnabled] = useState(true);

    const {
        selectedNodes,
        selectedEdges,
        deleteSelectedNodes,
        addTable,
        detectRelationships,
        autoLayout,
        runValidation,
        clearDiagram,
        createTableFromNL,
        saveToLocal,
        loadFromLocal,
        undo,
        redo,
        canUndo,
        canRedo,
        validationResult,
        validationEnabled,
        autoValidationEnabled,
        toggleAutoValidation,
        getValidationIssues,
        aiEnabled
    } = useDiagramStore();

    // Initialize currentAiEnabled with store value
    useEffect(() => {
        setCurrentAiEnabled(aiEnabled);
    }, [aiEnabled]);

    // Listen for AI settings changes
    useEffect(() => {
        const handleAiEnabledChange = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.enabled === 'boolean') {
                setCurrentAiEnabled(event.detail.enabled);
            }
        };

        const handleSettingsChange = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.aiEnabled === 'boolean') {
                setCurrentAiEnabled(event.detail.aiEnabled);
            }
        };

        // Load initial setting
        try {
            const savedSettings = localStorage.getItem('erd-editor-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                setCurrentAiEnabled(settings.aiEnabled ?? true);
            }
        } catch (error) {
            console.error('Failed to load AI setting:', error);
        }

        window.addEventListener('aiEnabledChanged', handleAiEnabledChange as EventListener);
        window.addEventListener('settingsChanged', handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener('aiEnabledChanged', handleAiEnabledChange as EventListener);
            window.removeEventListener('settingsChanged', handleSettingsChange as EventListener);
        };
    }, []);

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handleAiCreateTable = async () => {
        const promptText = prompt('Describe the table you want to create (e.g. "A students table with name, email, and birth date"):');
        if (promptText?.trim()) {
            setIsGenerating(true);
            const success = await createTableFromNL(promptText);
            setIsGenerating(false);
            if (!success) {
                alert('Failed to generate table. Make sure the AI server is running.');
            }
        }
    };

    const handleAddNewTable = () => {
        const tableName = prompt('Enter table name:');
        if (tableName?.trim()) {
            addTable({ label: tableName.trim() });
        }
    };

    const handleNewProject = () => {
        if (window.confirm('Are you sure you want to start a new project? This will clear all current tables and relationships.')) {
            clearDiagram();
        }
    };

    const handleSmartLayout = (type: 'hierarchical' | 'force' | 'group' = 'hierarchical') => {
        autoLayout({ type, direction: 'TB' });
        setShowLayoutOptions(false);
    };

    const openPerformancePanel = () => {
        const event = new CustomEvent('openPerformancePanel');
        window.dispatchEvent(event);
    };

    const openExportPanel = () => {
        const event = new CustomEvent('openExportPanel');
        window.dispatchEvent(event);
    };

    const openImportPanel = () => {
        const event = new CustomEvent('openImportPanel');
        window.dispatchEvent(event);
    };

    // Validation status
    const validationIssues = getValidationIssues();
    const hasErrors = validationIssues.some(issue => issue.type === 'error');
    const hasWarnings = validationIssues.some(issue => issue.type === 'warning');
    const validationScore = validationResult?.score || 100;

    const getValidationStatusIcon = () => {
        if (!validationEnabled) return null;
        if (hasErrors) return <XCircle className="w-4 h-4 text-red-500" />;
        if (hasWarnings) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    };

    const getValidationStatusText = () => {
        if (!validationEnabled) return 'Validation disabled';
        if (hasErrors) return `${validationIssues.filter(i => i.type === 'error').length} errors`;
        if (hasWarnings) return `${validationIssues.filter(i => i.type === 'warning').length} warnings`;
        return 'Valid';
    };

    return (
        <div className={cn(
            "fixed right-0 top-0 h-full bg-card/95 backdrop-blur-sm border-l border-border shadow-2xl z-30 transition-all duration-300",
            isCollapsed ? "w-12" : "w-80"
        )}>
            {/* Collapse Toggle */}
            <div className="p-2 border-b border-border">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-full flex items-center justify-center p-2 hover:bg-muted rounded-lg transition-colors"
                >
                    {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
            </div>

            {!isCollapsed && (
                <div className="overflow-y-auto h-full pb-20">
                    {/* Tools Section */}
                    <SidebarSection
                        title="Tools"
                        icon={<Plus className="w-4 h-4" />}
                        isExpanded={expandedSections.tools}
                        onToggle={() => toggleSection('tools')}
                    >
                        <div className="space-y-2">
                            <button
                                onClick={handleAddNewTable}
                                className="w-full bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 p-2 text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Add Table
                            </button>

                            {currentAiEnabled && (
                                <button
                                    onClick={handleAiCreateTable}
                                    disabled={isGenerating}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-all flex items-center justify-center gap-2 p-2 text-sm font-medium disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    AI Table
                                </button>
                            )}

                            <button
                                onClick={handleNewProject}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors flex items-center justify-center gap-2 p-2 text-sm font-medium"
                            >
                                <RotateCcw className="w-4 h-4" />
                                New Project
                            </button>

                            {(selectedNodes.length > 0 || selectedEdges.length > 0) && (
                                <button
                                    onClick={deleteSelectedNodes}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white rounded transition-colors p-2 text-sm font-medium"
                                >
                                    <Trash2 className="w-4 h-4 inline mr-2" />
                                    Delete ({selectedNodes.length + selectedEdges.length})
                                </button>
                            )}

                            <button
                                onClick={detectRelationships}
                                className="w-full bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-sm font-medium"
                            >
                                <Link className="w-4 h-4 inline mr-2" />
                                Detect Relationships
                            </button>

                            {/* Smart Layout */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowLayoutOptions(!showLayoutOptions)}
                                    className="w-full bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-sm font-medium flex items-center gap-2"
                                >
                                    <Layout className="w-4 h-4" />
                                    Smart Layout
                                    <ChevronDown className={cn(
                                        "w-4 h-4 transition-transform ml-auto",
                                        showLayoutOptions && "rotate-180"
                                    )} />
                                </button>

                                {showLayoutOptions && (
                                    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 min-w-full">
                                        <div className="p-1">
                                            <button
                                                onClick={() => handleSmartLayout('hierarchical')}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors"
                                            >
                                                Hierarchical Layout
                                            </button>
                                            <button
                                                onClick={() => handleSmartLayout('force')}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors"
                                            >
                                                Force Directed Layout
                                            </button>
                                            <button
                                                onClick={() => handleSmartLayout('group')}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors"
                                            >
                                                Group Layout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SidebarSection>

                    {/* Import/Export Section */}
                    <SidebarSection
                        title="Import/Export"
                        icon={<Database className="w-4 h-4" />}
                        isExpanded={expandedSections.importExport}
                        onToggle={() => toggleSection('importExport')}
                    >
                        <div className="space-y-2">
                            <button
                                onClick={openImportPanel}
                                className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors p-2 text-sm font-medium flex items-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Import SQL
                            </button>

                            <button
                                onClick={openExportPanel}
                                className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors p-2 text-sm font-medium flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Export Diagram
                            </button>

                            {/* Quick Export */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    disabled={isExporting}
                                    className="w-full bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isExporting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <FileImage className="w-4 h-4" />
                                    )}
                                    Quick Export
                                    <ChevronDown className={cn(
                                        "w-4 h-4 transition-transform ml-auto",
                                        showExportMenu && "rotate-180"
                                    )} />
                                </button>

                                {showExportMenu && (
                                    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 min-w-full">
                                        <div className="p-1">
                                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors">
                                                PNG
                                            </button>
                                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors">
                                                SVG
                                            </button>
                                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors">
                                                PDF
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SidebarSection>

                    {/* Project Settings Section */}
                    <SidebarSection
                        title="Project Settings"
                        icon={<Menu className="w-4 h-4" />}
                        isExpanded={expandedSections.projectSettings}
                        onToggle={() => toggleSection('projectSettings')}
                    >
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2">
                                <button
                                    onClick={undo}
                                    disabled={!canUndo()}
                                    className={cn(
                                        "p-2 rounded-full transition-colors",
                                        canUndo()
                                            ? "hover:bg-accent text-foreground"
                                            : "text-muted-foreground cursor-not-allowed"
                                    )}
                                    title="Undo"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={redo}
                                    disabled={!canRedo()}
                                    className={cn(
                                        "p-2 rounded-full transition-colors",
                                        canRedo()
                                            ? "hover:bg-accent text-foreground"
                                            : "text-muted-foreground cursor-not-allowed"
                                    )}
                                    title="Redo"
                                >
                                    <RotateCcw className="w-4 h-4 rotate-180" />
                                </button>
                                <button
                                    onClick={saveToLocal}
                                    className="p-2 rounded-full hover:bg-accent text-foreground transition-colors"
                                    title="Save"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={loadFromLocal}
                                    className="p-2 rounded-full hover:bg-accent text-foreground transition-colors"
                                    title="Load"
                                >
                                    <Upload className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        const event = new CustomEvent('openHistoryPanel');
                                        window.dispatchEvent(event);
                                    }}
                                    className="p-2 rounded-full hover:bg-accent text-foreground transition-colors"
                                    title="History"
                                >
                                    <History className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </SidebarSection>

                    {/* Quality Section */}
                    <SidebarSection
                        title="Quality"
                        icon={<Activity className="w-4 h-4" />}
                        isExpanded={expandedSections.quality}
                        onToggle={() => toggleSection('quality')}
                    >
                        <div className="space-y-2">
                            <button
                                onClick={() => {
                                    const event = new CustomEvent('openValidationPanel');
                                    window.dispatchEvent(event);
                                }}
                                className="w-full bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-sm font-medium"
                            >
                                <AlertTriangle className="w-4 h-4 inline mr-2" />
                                Validate Schema
                            </button>

                            <button
                                onClick={openPerformancePanel}
                                className="w-full bg-card/80 hover:bg-card text-foreground border border-border rounded transition-colors p-2 text-sm font-medium"
                            >
                                <Activity className="w-4 h-4 inline mr-2" />
                                Performance
                            </button>

                            {validationEnabled && (
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-2 text-sm mb-2">
                                        {getValidationStatusIcon()}
                                        <span className="font-medium">{getValidationStatusText()}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Score: {validationScore}
                                    </div>
                                    <label className="flex items-center gap-2 mt-2 text-xs">
                                        <input
                                            type="checkbox"
                                            checked={autoValidationEnabled}
                                            onChange={toggleAutoValidation}
                                            className="w-3 h-3"
                                        />
                                        Auto-validate
                                    </label>
                                </div>
                            )}
                        </div>
                    </SidebarSection>
                </div>
            )}
        </div>
    );
};

export default UnifiedSidebar;
