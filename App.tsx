import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutGrid, 
  Briefcase, 
  Coffee, 
  Palette, 
  Plus,
  BrainCircuit
} from './components/Icons';
import { Task, Category, Status, AIAnalysisResult } from './types';
import { TaskCard } from './components/TaskCard';
import { NewTaskModal } from './components/NewTaskModal';
import { ChiefOfStaffModal } from './components/ChiefOfStaffModal';
import { TaskDetailModal } from './components/TaskDetailModal';

const App: React.FC = () => {
  // --- Persistent State ---
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('focus-tasks');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load tasks', e);
    }
    return [
      {
        id: '1',
        title: '长按任务卡片可拖拽',
        description: '在手机上，我们优化了视图。试着在底部切换领域。',
        category: '工作',
        priority: 'P1',
        status: '待办',
        duration: '5分钟',
        subtasks: [],
        createdAt: Date.now()
      }
    ];
  });

  // Save to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem('focus-tasks', JSON.stringify(tasks));
  }, [tasks]);
  
  const [activeCategory, setActiveCategory] = useState<Category | '全部'>('全部');
  const [isNewTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [isChiefModalOpen, setChiefModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null);

  // Mobile specific state
  const [mobileActiveStatus, setMobileActiveStatus] = useState<Status>('待办');

  // --- Computed ---
  const filteredTasks = useMemo(() => {
    return activeCategory === '全部' 
      ? tasks 
      : tasks.filter(t => t.category === activeCategory);
  }, [tasks, activeCategory]);

  const columns: Status[] = ['待办', '进行中', '已完成'];

  // --- Handlers ---
  const handleMoveTask = (id: string, newStatus: Status) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    if (selectedTask && selectedTask.id === id) {
       setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleDeleteTask = (id: string) => {
     setTasks(prev => prev.filter(t => t.id !== id));
     if (selectedTask?.id === id) setSelectedTask(null);
  };

  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'status' | 'subtasks'>) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      createdAt: Date.now(),
      status: '待办', // Default to ToDo
      subtasks: [], 
      ...taskData
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask);
  };

  const handleAIPlanCreated = (result: AIAnalysisResult) => {
    const newTasks: Task[] = result.tasks.map((t, index) => ({
      id: `ai-task-${Date.now()}-${index}`,
      title: t.title,
      description: index === 0 ? `[核心目标: ${result.coreGoal}]\n\n${result.strategicAdvice}` : undefined,
      category: '工作',
      priority: t.priority,
      status: '待办',
      duration: t.duration,
      subtasks: t.steps.map((step, si) => ({
        id: `ai-sub-${Date.now()}-${index}-${si}`,
        title: step,
        completed: false
      })),
      createdAt: Date.now()
    }));

    setTasks(prev => [...newTasks, ...prev]);
  };

  // --- Drag & Drop Handlers ---
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, status: Status) => {
    e.preventDefault();
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, status: Status) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      handleMoveTask(taskId, status);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  // --- Render Helpers ---
  const renderNavButton = (cat: Category | '全部', icon: React.ReactNode, label: string) => {
    const isActive = activeCategory === cat;
    return (
      <button 
        onClick={() => setActiveCategory(cat)}
        className={`
          flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 group
          ${isActive 
            ? 'bg-white shadow-sm text-gray-900 font-semibold' 
            : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
          }
        `}
      >
        <span className={`${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'}`}>
          {icon}
        </span>
        <span className="text-sm">{label}</span>
        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
      </button>
    );
  };

  const renderMobileTab = (cat: Category | '全部', icon: React.ReactNode, label: string) => {
    const isActive = activeCategory === cat;
    return (
       <button 
        onClick={() => setActiveCategory(cat)}
        className="flex flex-col items-center justify-center gap-1 flex-1 py-1"
       >
         <div className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
           {icon}
         </div>
         <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
           {label}
         </span>
       </button>
    );
  };

  return (
    <div className="flex h-screen w-full bg-[#F5F5F7] text-gray-900 overflow-hidden font-sans pb-safe">
      
      {/* Desktop Sidebar - Hidden on Mobile */}
      <aside className="w-64 h-full hidden md:flex flex-col p-6 border-r border-gray-200/60 bg-[#F5F5F7]/50 backdrop-blur-md">
        <div className="mb-10 pl-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
             <div className="w-3 h-3 bg-black rounded-full" />
             Focus.
          </h1>
          <p className="text-xs text-gray-400 font-medium mt-1 ml-5 tracking-wide">二阶段：离线版</p>
        </div>

        <nav className="space-y-2 flex-1">
          {renderNavButton('全部', <LayoutGrid size={18} />, '总览')}
          <div className="pt-4 pb-2 pl-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">领域</div>
          {renderNavButton('工作', <Briefcase size={18} />, '工作')}
          {renderNavButton('生活', <Coffee size={18} />, '生活')}
          {renderNavButton('创意', <Palette size={18} />, '创意')}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative">
        
        {/* Mobile Header & Controls */}
        <div className="md:hidden flex flex-col bg-[#F5F5F7] pt-safe z-20">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
               Focus.
            </h1>
            <div className="flex gap-2">
              <button 
                onClick={() => setChiefModalOpen(true)} 
                className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center"
              >
                <BrainCircuit size={18} />
              </button>
              <button 
                onClick={() => setNewTaskModalOpen(true)} 
                className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center shadow-lg"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* iOS Style Segmented Control for Status */}
          <div className="px-4 pb-2">
            <div className="bg-gray-200/60 p-1 rounded-xl flex relative">
              {columns.map(status => (
                <button
                  key={status}
                  onClick={() => setMobileActiveStatus(status)}
                  className={`
                    flex-1 py-1.5 text-xs font-semibold rounded-lg z-10 transition-colors duration-200
                    ${mobileActiveStatus === status ? 'text-gray-900' : 'text-gray-500'}
                  `}
                >
                  {status}
                </button>
              ))}
              {/* Animated sliding background pill */}
              <div 
                className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm transition-all duration-300 ease-out"
                style={{
                  width: 'calc(33.33% - 5px)',
                  left: mobileActiveStatus === '待办' ? '4px' : mobileActiveStatus === '进行中' ? 'calc(33.33% + 2px)' : 'calc(66.66%)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Desktop Header - Hidden on Mobile */}
        <header className="hidden md:flex px-8 py-6 items-end justify-between shrink-0">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">
              {activeCategory === '全部' ? '总览' : activeCategory}
            </h2>
            <p className="text-gray-500 font-medium text-sm">
              {filteredTasks.length} 个待办任务 • 本地已同步
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm font-semibold"
              onClick={() => setChiefModalOpen(true)}
            >
              <BrainCircuit size={16} />
              AI 规划
            </button>
            <button 
               className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm font-semibold"
               onClick={() => setNewTaskModalOpen(true)}
            >
              <Plus size={16} />
              新建任务
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 md:px-8 pb-24 md:pb-8 relative">
          
          {/* Mobile View: Single Column List based on Segmented Control */}
          <div className="md:hidden h-full overflow-y-auto scrollbar-hide pt-2 pb-24 space-y-3">
            {filteredTasks
              .filter(t => t.status === mobileActiveStatus)
              .map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onMove={handleMoveTask}
                  onDelete={handleDeleteTask}
                  onClick={setSelectedTask}
                />
              ))
            }
            {filteredTasks.filter(t => t.status === mobileActiveStatus).length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                   <Coffee size={24} className="opacity-50" />
                 </div>
                 <p className="text-sm font-medium">暂无{mobileActiveStatus}任务</p>
              </div>
            )}
          </div>

          {/* Desktop View: Kanban Board */}
          <div className="hidden md:flex h-full gap-8 min-w-[800px]">
            {columns.map(status => (
              <div 
                key={status} 
                className={`
                  flex-1 flex flex-col min-w-[300px] h-full rounded-2xl transition-colors duration-300
                  ${dragOverColumn === status ? 'bg-indigo-50/50 border-2 border-indigo-200 border-dashed' : 'border-2 border-transparent'}
                `}
                onDragOver={(e) => handleDragOver(e, status)}
                onDrop={(e) => handleDrop(e, status)}
                onDragLeave={handleDragLeave}
              >
                <div className="flex items-center justify-between mb-4 px-2 pt-2">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{status}</h3>
                  <span className="text-xs font-semibold bg-gray-200/50 text-gray-500 px-2 py-0.5 rounded-md">
                    {filteredTasks.filter(t => t.status === status).length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-3 scrollbar-hide">
                  {filteredTasks
                    .filter(t => t.status === status)
                    .map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onMove={handleMoveTask}
                        onDelete={handleDeleteTask}
                        onClick={setSelectedTask}
                      />
                    ))
                  }
                  {filteredTasks.filter(t => t.status === status).length === 0 && (
                    <div className="h-32 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-300 text-sm font-medium">
                      暂无
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Bottom Tab Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 glass pb-safe pt-2 px-6 border-t border-gray-200/50 flex justify-between items-center z-30">
          {renderMobileTab('全部', <LayoutGrid size={24} strokeWidth={activeCategory === '全部' ? 2.5 : 2} />, '总览')}
          {renderMobileTab('工作', <Briefcase size={24} strokeWidth={activeCategory === '工作' ? 2.5 : 2} />, '工作')}
          {renderMobileTab('生活', <Coffee size={24} strokeWidth={activeCategory === '生活' ? 2.5 : 2} />, '生活')}
          {renderMobileTab('创意', <Palette size={24} strokeWidth={activeCategory === '创意' ? 2.5 : 2} />, '创意')}
        </div>

      </main>

      {/* New Task Modal */}
      <NewTaskModal 
        isOpen={isNewTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        onCreate={handleCreateTask}
      />

      {/* Chief of Staff Modal */}
      <ChiefOfStaffModal
        isOpen={isChiefModalOpen}
        onClose={() => setChiefModalOpen(false)}
        onPlanCreated={handleAIPlanCreated}
      />

      {/* Immersive Task Detail View */}
      <TaskDetailModal 
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
};

export default App;