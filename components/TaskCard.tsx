import React from 'react';
import { Task, Priority } from '../types';
import { Clock, CheckCircle2, MoreHorizontal } from './Icons';

interface TaskCardProps {
  task: Task;
  onMove: (id: string, newStatus: Task['status']) => void;
  onDelete: (id: string) => void;
  onClick: (task: Task) => void;
}

const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const colors = {
    'P0': 'bg-red-50 text-red-600 border-red-100',
    'P1': 'bg-orange-50 text-orange-600 border-orange-100',
    'P2': 'bg-blue-50 text-blue-600 border-blue-100',
    'P3': 'bg-gray-50 text-gray-500 border-gray-100',
  };

  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors[priority]}`}>
      {priority}
    </span>
  );
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onMove, onDelete, onClick }) => {
  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation(); // Prevent opening the details modal
    action();
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a subtle "lift" effect by identifying this element is being dragged
    e.currentTarget.classList.add('opacity-50', 'scale-95', 'rotate-2');
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-50', 'scale-95', 'rotate-2');
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onClick(task)}
      className="group bg-white p-4 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 border border-gray-100/50 flex flex-col gap-3 relative animate-in fade-in slide-in-from-bottom-2 cursor-pointer active:scale-[0.98] active:cursor-grabbing"
    >
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex gap-2 items-center">
          <PriorityBadge priority={task.priority} />
          {task.duration && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
              <Clock size={10} />
              {task.duration}
            </span>
          )}
        </div>
        <button 
          onClick={(e) => handleAction(e, () => onDelete(task.id))}
          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 -mr-1"
          title="删除任务"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Content */}
      <div>
        <h3 className="text-gray-900 font-semibold text-sm leading-snug mb-1 group-hover:text-indigo-600 transition-colors">{task.title}</h3>
        {task.description && (
          <p className="text-gray-500 text-xs line-clamp-2">{task.description}</p>
        )}
      </div>

      {/* Subtasks Preview (if any) */}
      {task.subtasks.length > 0 && (
        <div className="bg-gray-50/50 rounded-lg p-2 space-y-1 group-hover:bg-indigo-50/30 transition-colors">
          {task.subtasks.slice(0, 2).map(st => (
            <div key={st.id} className="flex items-center gap-2 text-xs text-gray-500">
               <div className={`w-1.5 h-1.5 rounded-full ${st.completed ? 'bg-green-400' : 'bg-gray-300'}`} />
               <span className={st.completed ? 'line-through opacity-60' : ''}>{st.title}</span>
            </div>
          ))}
          {task.subtasks.length > 2 && (
            <div className="text-[10px] text-gray-400 pl-3.5">还有 {task.subtasks.length - 2} 个步骤</div>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{task.category}</span>
        
        {/* Simple State Mover */}
        <div className="flex gap-1">
           {task.status !== '待办' && (
             <button onClick={(e) => handleAction(e, () => onMove(task.id, '待办'))} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400" title="移至待办">
               <div className="w-2 h-2 rounded-full border border-gray-400" />
             </button>
           )}
           {task.status !== '进行中' && (
             <button onClick={(e) => handleAction(e, () => onMove(task.id, '进行中'))} className="w-6 h-6 rounded-full hover:bg-blue-50 flex items-center justify-center text-blue-500" title="开始进行">
               <div className="w-2 h-2 rounded-full bg-blue-400" />
             </button>
           )}
           {task.status !== '已完成' && (
             <button onClick={(e) => handleAction(e, () => onMove(task.id, '已完成'))} className="w-6 h-6 rounded-full hover:bg-green-50 flex items-center justify-center text-green-500" title="标记完成">
               <CheckCircle2 size={14} />
             </button>
           )}
        </div>
      </div>
    </div>
  );
};