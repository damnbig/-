import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from '../types';

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key 缺失。请确保 process.env.API_KEY 已设置。");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeIdea = async (idea: string): Promise<AIAnalysisResult | null> => {
  const ai = getAIClient();
  if (!ai) return null;

  // Design Phase 2: Localized Chinese "Chief of Staff"
  const systemPrompt = `
    你是我的“幕僚长”和战略规划师。
    你的目标不仅是列出待办事项，而是利用“艾森豪威尔矩阵”、“GTD（Getting Things Done）”和“SMART原则”将我输入的模糊想法转化为结构化的中文执行方案。
    
    我的输入可能很乱。请识别核心矛盾或主要目标（“核心目标”）。
    根据重要性/紧急性分析任务。
    将大任务拆解为颗粒度细致的行动项。
    预估时间。
    提供关于如何执行得更好或更省力的战略建议。

    输出必须是有效的 JSON 对象，并且所有文本内容（除了 JSON 键名和 Priority 枚举值）必须完全使用中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `我的想法: "${idea}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coreGoal: { type: Type.STRING, description: "一句话总结核心目标（中文）" },
            strategicAdvice: { type: Type.STRING, description: "战略建议，使用 Markdown 格式（中文）" },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "任务标题（中文）" },
                  priority: { type: Type.STRING, enum: ["P0", "P1", "P2", "P3"] },
                  duration: { type: Type.STRING, description: "预估时间，如 '30分钟', '2小时'" },
                  steps: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "3-5 个具体的子步骤（中文）"
                  }
                },
                required: ["title", "priority", "duration", "steps"]
              }
            }
          },
          required: ["coreGoal", "strategicAdvice", "tasks"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIAnalysisResult;
    }
    return null;

  } catch (error) {
    console.error("Gemini 分析失败:", error);
    return null;
  }
};