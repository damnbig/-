export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type Category = '工作' | '生活' | '创意';

export type Status = '待办' | '进行中' | '已完成';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: Category;
  priority: Priority;
  status: Status;
  duration?: string;
  subtasks: SubTask[];
  createdAt: number;
}

export interface AIAnalysisResult {
  coreGoal: string;
  strategicAdvice: string;
  tasks: Array<{
    title: string;
    priority: Priority;
    duration: string;
    steps: string[];
  }>;
}