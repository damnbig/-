import React, { useState, useEffect } from 'react';
import { Sparkles, BrainCircuit, X, ChevronRight, CheckCircle2 } from './Icons';
import { analyzeIdea } from '../services/geminiService';
import { AIAnalysisResult } from '../types';

interface ChiefOfStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanCreated: (result: AIAnalysisResult) => void;
}

export const ChiefOfStaffModal: React.FC<ChiefOfStaffModalProps> = ({ isOpen, onClose, onPlanCreated }) => {
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen && !result) {
      setInput('');
    }
  }, [isOpen, result]);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setIsThinking(true);
    const data = await analyzeIdea(input);
    setResult(data);
    setIsThinking(false);
  };

  const handleApply = () => {
    if (result) {
      onPlanCreated(result);
      onClose();
      // Small delay to clear state for next time
      setTimeout(() => setResult(null), 500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-8 pb-4 flex justify-between items-center border-b border-gray-100/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
               <BrainCircuit size={20} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-gray-900 tracking-tight">幕僚长 (Chief of Staff)</h2>
               <p className="text-sm text-gray-500 font-medium">战略规划与任务梳理</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 pt-6 overflow-y-auto flex-1">
          {!result ? (
            <div className="flex flex-col gap-6 h-full justify-center">
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-semibold text-gray-800">您在思考什么？</h3>
                <p className="text-gray-500">无论是杂乱的想法、模糊的目标还是焦虑，都请倒在这里。我将利用艾森豪威尔矩阵和 GTD 原则为您梳理结构。</p>
              </div>
              
              <div className="relative">
                <textarea
                  className="w-full h-40 bg-gray-50 rounded-2xl p-6 text-lg text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all border border-gray-100"
                  placeholder="例如：'我最近感觉工作效率很低，而且想开始学一个新的技能，但是完全不知道怎么安排时间...'"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isThinking}
                />
                {isThinking && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium text-indigo-600 animate-pulse">正在分析优先级...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={handleSubmit}
                  disabled={!input.trim() || isThinking}
                  className="bg-black text-white px-8 py-3 rounded-full font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-xl flex items-center gap-2"
                >
                  <Sparkles size={18} />
                  分析并生成计划
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              {/* Core Goal Section */}
              <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">核心目标</h4>
                <p className="text-xl font-medium text-indigo-900 leading-relaxed">"{result.coreGoal}"</p>
              </div>

              {/* Strategy Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                  战略建议
                </h4>
                <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line bg-gray-50 p-5 rounded-xl">
                  {result.strategicAdvice}
                </div>
              </div>

              {/* Proposed Tasks Preview */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                   <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                   执行方案 ({result.tasks.length} 项)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.tasks.map((task, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                         <span className="font-medium text-gray-800 text-sm">{task.title}</span>
                         <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{task.priority}</span>
                      </div>
                      <span className="text-[11px] text-gray-400">{task.duration} • {task.steps.length} 步</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (Only valid when result exists) */}
        {result && (
          <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
             <button onClick={() => setResult(null)} className="text-gray-500 hover:text-gray-800 text-sm font-medium px-4">
               返回修改
             </button>
             <button 
               onClick={handleApply}
               className="bg-indigo-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
             >
               <CheckCircle2 size={18} />
               确认并执行
             </button>
          </div>
        )}
      </div>
    </div>
  );
};