import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Square, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { generateRobotAction } from '../lib/llm';
import type { ActionScript } from '../lib/ActionParser';

interface ActionGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onActionGenerated: (actionData: { name: string, script: ActionScript, prompt: string, id?: string }) => void;
    initialData?: { id: string, name: string, prompt: string } | null;
}

export function ActionGeneratorModal({ isOpen, onClose, onActionGenerated, initialData }: ActionGeneratorModalProps) {
    const [actionName, setActionName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    // Update state when initialData changes
    useEffect(() => {
        if (initialData && isOpen) {
            setActionName(initialData.name);
            setPrompt(initialData.prompt);
        } else if (!isOpen) {
            // Clear when closing
            setActionName('');
            setPrompt('');
        }
    }, [initialData, isOpen]);

    // Initialize Speech Recognition if supported
    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'zh-CN'; // Defaulting to Chinese as per request context

            recognitionRef.current.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setPrompt(prev => prev + (prev ? ' ' : '') + finalTranscript);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setError(`语音识别错误: ${event.error}`);
                setIsRecording(false);
            };

            recognitionRef.current.onend = () => {
                setIsRecording(false);
            };
        }
    }, []);

    useEffect(() => {
        const storedKey = localStorage.getItem('gemini_api_key');
        if (storedKey) setApiKey(storedKey);
    }, []);

    const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setApiKey(e.target.value);
        localStorage.setItem('gemini_api_key', e.target.value);
    };

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            setError("您的浏览器不支持语音识别(如Safari/Firefox)。请使用Chrome。");
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            setError(null);
            try {
                recognitionRef.current.start();
                setIsRecording(true);
            } catch (e: any) {
                setError("无法启动语音识别");
            }
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("请输入动作描述");
            return;
        }
        if (!apiKey.trim()) {
            setError("请提供 API Key");
            return;
        }

        setError(null);
        setIsGenerating(true);

        try {
            const result = await generateRobotAction(prompt, apiKey);
            if (result.success) {
                onActionGenerated({
                    id: initialData?.id,
                    name: actionName.trim() || prompt.substring(0, 15) + (prompt.length > 15 ? '...' : ''),
                    script: result.script,
                    prompt: prompt
                });
                setPrompt('');
                setActionName('');
                onClose();
            } else {
                const errResult = result as { success: false; error: string };
                setError(errResult.error || "生成失败，未知错误");
            }
        } catch (err: any) {
            setError(err.message || "生成请求异常");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="text-blue-500" size={20} />
                        {initialData ? '编辑动作' : 'AI 新增动作'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Gemini API Key
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={handleKeyChange}
                            placeholder="输入您的 Gemini API Key..."
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-mono"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Key仅保存在本地浏览器</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            动作名称
                        </label>
                        <input
                            type="text"
                            value={actionName}
                            onChange={(e) => setActionName(e.target.value)}
                            placeholder="给动作起个好听的名字 (可选)"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                            disabled={isGenerating}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            动作描述 (文本或语音)
                        </label>
                        <div className="relative">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="例如：缓慢下蹲，然后突然跳起；或者做个俯卧撑..."
                                className="w-full h-32 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none text-sm leading-relaxed pr-12 shadow-inner"
                                disabled={isGenerating}
                            />
                            <button
                                onClick={toggleRecording}
                                disabled={isGenerating}
                                className={`absolute bottom-3 right-3 p-2 rounded-full transition-all flex items-center justify-center ${isRecording
                                    ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                    }`}
                                title={isRecording ? "停止录音" : "开始语音输入"}
                            >
                                {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={16} />
                            <p className="text-sm text-red-800 leading-relaxed">{error}</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        disabled={isGenerating}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim() || !apiKey.trim()}
                        className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all flex items-center justify-center min-w-[100px] disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                    >
                        {isGenerating ? (
                            <><Loader2 size={16} className="animate-spin mr-2" /> 生成中...</>
                        ) : (
                            '生成动作'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
