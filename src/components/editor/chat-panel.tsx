"use client"

import { useState, useRef, useEffect, memo } from 'react';
import { useDiagramStore } from '@/store/use-diagram-store';
import { cn } from '@/lib/utils';
import {
    MessageSquare,
    Send,
    X,
    Trash2,
    Sparkles,
    Bot,
    User,
    ShieldCheck,
    Loader2,
    Database
} from 'lucide-react';

const ChatPanel = memo(() => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [includeSchema, setIncludeSchema] = useState(true);
    const [enableThinking, setEnableThinking] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const {
        chatMessages,
        isChatStreaming,
        sendChatMessage,
        clearChat
    } = useDiagramStore();

    // Listen for AI settings changes
    useEffect(() => {
        const handleSettingsChange = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.aiEnabled === 'boolean') {
                setAiEnabled(event.detail.aiEnabled);
            }
        };

        const handleAiEnabledChange = (event: CustomEvent) => {
            if (event.detail && typeof event.detail.enabled === 'boolean') {
                setAiEnabled(event.detail.enabled);
            }
        };

        // Load initial setting from localStorage
        try {
            const savedSettings = localStorage.getItem('erd-editor-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                setAiEnabled(settings.aiEnabled ?? true);
            }
        } catch (error) {
            console.error('Failed to load AI setting:', error);
        }

        window.addEventListener('settingsChanged', handleSettingsChange as EventListener);
        window.addEventListener('aiEnabledChanged', handleAiEnabledChange as EventListener);

        return () => {
            window.removeEventListener('settingsChanged', handleSettingsChange as EventListener);
            window.removeEventListener('aiEnabledChanged', handleAiEnabledChange as EventListener);
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatMessages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isChatStreaming) return;
        const msg = inputValue;
        setInputValue('');
        await sendChatMessage(msg, { includeSchema, enableThinking });
    };

    // Hide if AI is disabled via settings
    if (!aiEnabled) {
        return null;
    }

    return (

        <>
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-8 right-8 z-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-2 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 flex items-center gap-2 group hover:shadow-primary/25 border-2 border-primary/20 backdrop-blur-sm"
                >
                    <div className="relative">
                        <MessageSquare className="w-4 h-4" />
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse border-2 border-background"></div>
                    </div>
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-medium pb-0.5 whitespace-nowrap">
                        Ask AI
                    </span>
                </button>
            )}

            {/* Chat Panel */}
            <div className={cn(
                "fixed top-0 right-0 h-full w-[400px] z-[100] bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
                    <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary" />
                        <div>
                            <h2 className="text-sm font-bold">Database Architect</h2>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-green-500" />
                                AI Powered
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={clearChat}
                            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-red-500"
                            title="Clear Chat"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Messages Container */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
                >
                    {chatMessages.filter(m => m.role !== 'system').map((msg, i) => (
                        <div key={i} className={cn(
                            "flex gap-3",
                            msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                        )}>
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                                msg.role === 'user' ? "bg-primary/10 border-primary/20" : "bg-secondary border-border"
                            )}>
                                {msg.role === 'user' ? <User className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4" />}
                            </div>
                            <div className={cn(
                                "max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed",
                                msg.role === 'user'
                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                    : "bg-muted text-foreground rounded-tl-none border border-border/50 shadow-sm"
                            )}>
                                {msg.content.split('\n').map((line, idx) => (
                                    <p key={idx} className={idx > 0 ? "mt-2" : ""}>{line}</p>
                                ))}
                            </div>
                        </div>
                    ))}
                    {isChatStreaming && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                            <div className="bg-muted p-3 rounded-2xl rounded-tl-none text-xs border border-border/50 animate-pulse">
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="p-3 border-t border-border bg-secondary/30 space-y-3">
                    <div className="flex items-center gap-4 px-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={includeSchema}
                                onChange={(e) => setIncludeSchema(e.target.checked)}
                                className="w-3 h-3 accent-primary"
                            />
                            <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground flex items-center gap-1">
                                <Database className="w-2.5 h-2.5" /> Incl. Schema
                            </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={enableThinking}
                                onChange={(e) => setEnableThinking(e.target.checked)}
                                className="w-3 h-3 accent-primary"
                            />
                            <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> High Reasoning
                            </span>
                        </label>
                    </div>

                    <div className="relative">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask about your schema..."
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 pr-12 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none min-h-[80px]"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isChatStreaming}
                            className="absolute bottom-3 right-3 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

ChatPanel.displayName = 'ChatPanel';

export default ChatPanel;
