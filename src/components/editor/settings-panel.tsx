"use client";

import React, { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Sparkles, Eye, EyeOff, Zap, CheckCircle, Globe } from 'lucide-react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const {
        autoValidationEnabled,
        toggleAutoValidation,
        validationEnabled,
    } = useDiagramStore();

    // Local state for settings
    const [aiEnabled, setAiEnabled] = useState(true);
    const [showMinimap, setShowMinimap] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [showRelationshipLabels, setShowRelationshipLabels] = useState(true);
    const [localAutoValidationEnabled, setLocalAutoValidationEnabled] = useState(true);

    // Load defaults and sync with store on open
    useEffect(() => {
        if (isOpen) {
            try {
                const savedSettings = localStorage.getItem('erd-editor-settings');
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);

                    // Update Local State
                    setAiEnabled(settings.aiEnabled ?? true);
                    setShowMinimap(settings.showMinimap ?? true);
                    setDarkMode(settings.darkMode ?? false);
                    setShowRelationshipLabels(settings.showRelationshipLabels ?? true);
                    setLocalAutoValidationEnabled(settings.autoValidationEnabled ?? true);

                    // Sync Store
                    const state = useDiagramStore.getState();
                    if (state.setAiEnabled) state.setAiEnabled(settings.aiEnabled ?? true);
                    if (state.setShowRelationshipLabels) state.setShowRelationshipLabels(settings.showRelationshipLabels ?? true);

                    // Sync AutoValidation if needed
                    if (settings.autoValidationEnabled !== undefined && settings.autoValidationEnabled !== state.autoValidationEnabled) {
                        state.toggleAutoValidation();
                    }
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }
    }, [isOpen]);

    // Save settings to localStorage
    const saveSettings = () => {
        const settings = {
            aiEnabled,
            showMinimap,
            darkMode,
            showRelationshipLabels,
            autoValidationEnabled,
        };
        localStorage.setItem('erd-editor-settings', JSON.stringify(settings));

        // Dispatch custom events for settings changes
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings }));

        // Show success message
        alert('Settings saved successfully!');
    };

    // Handle AI toggle
    const handleAiToggle = (enabled: boolean) => {
        setAiEnabled(enabled);
        useDiagramStore.getState().setAiEnabled(enabled);
        window.dispatchEvent(new CustomEvent('aiEnabledChanged', { detail: { enabled } }));
    };

    // Handle Auto-validation toggle
    const handleAutoValidationToggle = (enabled: boolean) => {
        setLocalAutoValidationEnabled(enabled);
        useDiagramStore.getState().toggleAutoValidation();
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: { autoValidationEnabled: enabled } }));
    };

    // Handle minimap toggle
    const handleMinimapToggle = (enabled: boolean) => {
        setShowMinimap(enabled);
        window.dispatchEvent(new CustomEvent('minimapToggled', { detail: { enabled } }));
    };

    // Handle relationship labels toggle
    const handleRelationshipLabelsToggle = (enabled: boolean) => {
        setShowRelationshipLabels(enabled);
        useDiagramStore.getState().setShowRelationshipLabels(enabled);
        window.dispatchEvent(new CustomEvent('relationshipLabelsToggled', { detail: { enabled } }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100]">
            <div
                className="absolute bg-background border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
                style={{
                    top: '0%',
                    left: '50%',
                    transform: 'translate(-50%, 15%)'
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <SettingsIcon className="w-6 h-6 text-primary" />
                        <div>
                            <h2 className="text-xl font-semibold">Settings</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Configure your ERD Editor preferences
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* AI Features Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                <h3 className="text-lg font-semibold">AI Features</h3>
                            </div>

                            <div className="space-y-3">
                                <SettingToggle
                                    label="Enable AI Features"
                                    description="Turn on AI-powered table generation, suggestions, and chat assistance"
                                    checked={aiEnabled}
                                    onChange={handleAiToggle}
                                    icon={<Sparkles className="w-4 h-4 text-purple-600" />}
                                />
                            </div>
                        </div>

                        {/* Validation Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <h3 className="text-lg font-semibold">Validation</h3>
                            </div>

                            <div className="space-y-3">
                                <SettingToggle
                                    label="Auto-validate Schema"
                                    description="Automatically validate your schema as you make changes"
                                    checked={localAutoValidationEnabled}
                                    onChange={handleAutoValidationToggle}
                                    icon={<CheckCircle className="w-4 h-4 text-green-600" />}
                                />
                            </div>
                        </div>

                        {/* Display Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <Eye className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-semibold">Display</h3>
                            </div>

                            <div className="space-y-3">
                                <SettingToggle
                                    label="Show Minimap"
                                    description="Display a miniature overview of your entire diagram"
                                    checked={showMinimap}
                                    onChange={handleMinimapToggle}
                                    icon={<Eye className="w-4 h-4 text-blue-600" />}
                                />

                                <SettingToggle
                                    label="Show Relationship Labels"
                                    description="Display cardinality labels on relationship edges"
                                    checked={showRelationshipLabels}
                                    onChange={handleRelationshipLabelsToggle}
                                    icon={<Globe className="w-4 h-4 text-blue-600" />}
                                />

                                <SettingToggle
                                    label="Dark Mode"
                                    description="Use dark theme for the editor"
                                    checked={darkMode}
                                    onChange={setDarkMode}
                                    icon={<EyeOff className="w-4 h-4 text-gray-600" />}
                                />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-muted/30">
                    <div className="text-xs text-muted-foreground">
                        Settings are saved to your browser's local storage
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                saveSettings();
                                onClose();
                            }}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface SettingToggleProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon?: React.ReactNode;
}

function SettingToggle({ label, description, checked, onChange, icon }: SettingToggleProps) {
    return (
        <div className="flex items-start justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-start gap-3 flex-1">
                {icon && <div className="mt-0.5">{icon}</div>}
                <div className="flex-1">
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{description}</div>
                </div>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    checked ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                )}
            >
                <span
                    className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        checked ? "translate-x-6" : "translate-x-1"
                    )}
                />
            </button>
        </div>
    );
}
