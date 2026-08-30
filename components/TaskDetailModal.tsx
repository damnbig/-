import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  Briefcase, 
  Coffee, 
  Palette, 
  AlertCircle, 
  Trash2,
  Calendar,
  Plus
} from './Icons';
import { Task, Priority, Category, Status } from '../types';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
  onUpdate: (updatedTask: Task) => void;
  onDelete: (id: string) => void;
}

const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const colors = {
    'P0': 'bg-red-50 text-red-600 border-red-100 ring-red-500/10',
    'P1': 'bg-orange-50 text-orange-600 border-orange-100 ring-orange-500/10',
    'P2': 'bg-blue-50 text-blue-600 border-blue-100 ring-blue-500/10',
    'P3': 'bg-gray-50 text-gray-500 border-gray-100 ring-gray-500/10',
  };

  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ring-1 inset-0 ${colors[priority]}`}>
      {priority}
    </span>
  );
};

const CategoryIcon: React.FC<{ category: Category }> = ({ category }) => {
  switch (category) {
    case '工作': return <Briefcase size={16} className="text-gray-500" />;
    case '生活': return <Coffee size={16} className="text-gray-500" />;
    case '创意': return <Palette size={16} className="text-gray-500" />;
    default: return null;
  }
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, onUpdate, onDelete }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  if (!task) return null;

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    onUpdate({ ...task, subtasks: updatedSubtasks });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newSubtask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle,
      completed: false
    };

    onUpdate({
      ...task,
      subtasks: [...task.subtasks, newSubtask]
    });
    setNewSubtaskTitle('');
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    onUpdate({
      ...task,
      subtasks: task.subtasks.filter(st => st.id !== subtaskId)
    });
  };

  const handleStatusChange = (newStatus: Status) => {
    onUpdate({ ...task, status: newStatus });
  };

  const handleDelete = () => {
    if (window.confirm('确定要删除这个任务吗？')) {
      onDelete(task.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blur Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-md transition-opacity duration-300" 
        onClick={onClose} 
      />

      {/* Modal Card - Designed for Immersion */}
      <div className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-white/40 flex flex-col max-h-[85vh]">
        
        {/* Header Area */}
        <div className="px-8 pt-8 pb-4 flex justify-between items-start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                <CategoryIcon category={task.category} />
                {task.category}
              </span>
              <PriorityBadge priority={task.priority} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{task.title}</h2>
          </div>
          
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-2 space-y-8 scrollbar-hide">
          
          {/* Metadata Row */}
          <div className="flex items-center gap-6 text-sm text-gray-500 border-b border-gray-100 pb-6">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{task.duration || '无时长限制'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>创建于 {new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Description */}
          {task.description && (
             <div className="space-y-2">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">任务详情</h3>
               <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
                 {task.description}
               </p>
             </div>
          )}

          {/* Subtasks Section */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                <span>检查清单</span>
                <span className="text-gray-300">{task.subtasks.filter(t => t.completed).length}/{task.subtasks.length}</span>
             </h3>
             
             <div className="bg-gray-50 rounded-2xl p-2 space-y-1">
               {task.subtasks.map(st => (
                 <div 
                    key={st.id} 
                    className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                 >
                    <div 
                      onClick={() => handleToggleSubtask(st.id)}
                      className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer shrink-0
                        ${st.completed ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 group-hover:border-indigo-400'}
                      `}
                    >
                      {st.completed && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <span 
                      onClick={() => handleToggleSubtask(st.id)}
                      className={`text-sm font-medium transition-all flex-1 cursor-pointer ${st.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                    >
                      {st.title}
                    </span>
                    <button 
                      onClick={() => handleDeleteSubtask(st.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <X size={14} />
                    </button>
                 </div>
               ))}
               
               {/* Quick Add Subtask Input */}
               <form onSubmit={handleAddSubtask} className="flex items-center gap-3 p-3 pl-3.5">
                  <div className="w-4 h-4 rounded-full border border-gray-300 border-dashed flex items-center justify-center shrink-0">
                    <Plus size={10} className="text-gray-400" />
                  </div>
                  <input 
                    type="text" 
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="添加新步骤..." 
                    className="bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none flex-1 font-medium"
                  />
               </form>
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50/80 backdrop-blur-xl border-t border-gray-100 flex justify-between items-center mt-auto">
           <button 
             onClick={handleDelete}
             className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
           >
             <Trash2 size={16} />
             删除
           </button>

           <div className="flex bg-gray-200/50 p-1 rounded-full">
              {(['待办', '进行中', '已完成'] as Status[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                    task.status === s 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 shadow-none'
                  }`}
                >
                  {s}
                </button>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};