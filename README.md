<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# iZiwei 排盘工具

这是一个基于 React、Vite、iztro 与 lunar-javascript 的本地优先排盘工具。

View your app in AI Studio: https://ai.studio/apps/a2858775-fa43-4fa1-a6d2-1a5099b99407

## 锁定台账

紫微排盘提供两种输出：

- `原始命盘`：用于日常查看和人工阅读。
- `锁定台账`：将十二宫、生年四化、宫干飞化、离心/向心飞化、当前大限和流年写成带稳定编号的 Markdown 事实表，并在导出前自动校验。

NotebookLM 工作流中，应把锁定台账单独添加为案例事实来源；课程和笔记来源只负责解释论法，不得覆盖台账字段。只有显示 `PASS` 的台账才应进入后续分析。

## 本地运行

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
