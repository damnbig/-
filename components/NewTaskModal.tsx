import React, { useState } from 'react';
import { X, CheckCircle2 } from './Icons';
import { Task, Category, Priority } from '../types';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (task: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks'>) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('工作');
  const [priority, setPriority] = useState<Priority>('P2');
  const [duration, setDuration] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onCreate({
      title,
      description,
      category,
      priority,
      duration: duration || undefined
    });
    
    // Reset and close
    setTitle('');
    setDescription('');
    setCategory('工作');
    setPriority('P2');
    setDuration('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">新建任务</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">任务名称</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：完成季度报告..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">领域</label>
              <div className="flex bg-gray-50 rounded-xl p-1 border border-gray-200">
                {(['工作', '生活', '创意'] as Category[]).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all ${
                      category === cat ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">优先级</label>
              <div className="relative">
                <select 
                  value={priority}
                  onChange={e => setPriority(e.target.value as Priority)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="P0">P0 - 紧急且重要</option>
                  <option value="P1">P1 - 重要不紧急</option>
                  <option value="P2">P2 - 紧急不重要</option>
                  <option value="P3">P3 - 不紧急不重要</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Duration & Description */}
          <div>
             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">预估时长</label>
             <input 
              type="text" 
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="例如：30分钟"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">备注</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="添加详细描述..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 resize-none transition-all"
            />
          </div>

          <div className="pt-2 flex justify-end">
             <button 
               type="submit"
               disabled={!title.trim()}
               className="bg-black text-white px-6 py-3 rounded-full font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-lg flex items-center gap-2"
             >
               <CheckCircle2 size={16} />
               创建任务
             </button>
          </div>

        </form>
      </div>
    </div>
  );
};