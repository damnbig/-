import React, { useState, useEffect } from 'react';
import { astro } from 'iztro';
import { Solar, Lunar } from 'lunar-javascript';
import { X, Moon, Sparkles, Copy, Calendar, Download, FileText, CheckCircle2, Database, ShieldCheck, ListChecks, ChevronDown, Check } from './Icons';
import { ZW_SIHUA, formatStarWithMarkers, generateLockedZiweiLedger } from '../services/ziweiLedger';
import { advancedQuestionGuides, defaultAdvancedQuestionGuide } from '../services/advancedQuestions';
import {
  buildEvidenceRepairPrompt,
  FactValidationResult,
  FactValidationQuestion,
  formatFactValidationResult,
  getMissingEvidenceReferenceIds,
  mergeEvidencePatch,
  repairLeakedFactReferences,
  validateNotebookAnswer,
} from '../services/ziweiFactValidator';

interface ZiweiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper Types
type Gender = '男' | '女';
type OutputMode = 'report' | 'ledger' | 'facts' | 'audit' | 'questions';
type GeneratedReports = {
    report: string;
    ledger: string;
    notebookFacts: string;
    factCount: number;
    ledgerStatus: 'PASS' | 'BLOCKED';
    fingerprint: string;
};

// ==========================================
// iZiwei Fusion V12 (Precision Fixed)
// ==========================================

// 1. 静态真理表 (保持不变)
const ZHI_HIDDEN: Record<string, string[]> = {'子':['癸'],'丑':['己','癸','辛'],'寅':['甲','丙','戊'],'卯':['乙'],'辰':['戊','乙','癸'],'巳':['丙','戊','庚'],'午':['丁','己'],'未':['己','丁','乙'],'申':['庚','壬','戊'],'酉':['辛'],'戌':['戊','辛','丁'],'亥':['壬','甲']};
const SHI_SHEN_TABLE: Record<string, Record<string, string>> = {'甲':{'甲':'比肩','乙':'劫财','丙':'食神','丁':'伤官','戊':'偏财','己':'正财','庚':'七杀','辛':'正官','壬':'偏印','癸':'正印'},'乙':{'甲':'劫财','乙':'比肩','丙':'伤官','丁':'食神','戊':'正财','己':'偏财','庚':'正官','辛':'七杀','壬':'正印','癸':'偏印'},'丙':{'甲':'偏印','乙':'正印','丙':'比肩','丁':'劫财','戊':'食神','己':'伤官','庚':'偏财','辛':'正财','壬':'七杀','癸':'正官'},'丁':{'甲':'正印','乙':'偏印','丙':'劫财','丁':'比肩','戊':'伤官','己':'食神','庚':'正财','辛':'偏财','壬':'正官','癸':'七杀'},'戊':{'甲':'七杀','乙':'正官','丙':'偏印','丁':'正印','戊':'比肩','己':'劫财','庚':'食神','辛':'伤官','壬':'偏财','癸':'正财'},'己':{'甲':'正官','乙':'七杀','丙':'正印','丁':'偏印','戊':'劫财','己':'比肩','庚':'伤官','辛':'食神','壬':'正财','癸':'偏财'},'庚':{'甲':'偏财','乙':'正财','丙':'七杀','丁':'正官','戊':'偏印','己':'正印','庚':'比肩','辛':'劫财','壬':'食神','癸':'伤官'},'辛':{'甲':'正财','乙':'偏财','丙':'正官','丁':'七杀','戊':'正印','己':'偏印','庚':'劫财','辛':'比肩','壬':'伤官','癸':'食神'},'壬':{'甲':'食神','乙':'伤官','丙':'偏财','丁':'正财','戊':'七杀','己':'正官','庚':'偏印','辛':'正印','壬':'比肩','癸':'劫财'},'癸':{'甲':'伤官','乙':'食神','丙':'正财','丁':'偏财','戊':'正官','己':'七杀','庚':'正印','辛':'偏印','壬':'劫财','癸':'比肩'}};
// 2. 辅助工具
function safeStr(input: any): string {
    if (input === null || input === undefined) return "";
    if (typeof input === 'string') return input;
    if (typeof input.getName === 'function') return input.getName();
    return String(input);
}
function getTenGods(dayGan: string, targetGan: string) {
    // @ts-ignore
    return (SHI_SHEN_TABLE[dayGan] && SHI_SHEN_TABLE[dayGan][targetGan]) || "?";
}
// 3. 核心生成函数 (V12)
const parseReportDate = (dateInput: string): Date => {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
};

const generateReportLogic = (dateInput: string, reportDateInput: string, gender: '男'|'女', caseId: string): GeneratedReports => {
    try {
        const d = new Date(dateInput);
        const reportDate = parseReportDate(reportDateInput);
        if (Number.isNaN(reportDate.getTime())) throw new Error('报告日期无效');
        if (reportDateInput < dateInput.slice(0, 10)) throw new Error('报告日期不能早于出生日期');
        
        // --- A. 八字与基础信息 ---
        const solar = Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), 0);
        const lunar = solar.getLunar();
        const bazi = lunar.getEightChar();
        bazi.setSect(2); 

        // 计算当前时间的农历 (解决年关虚岁问题)
        const reportLunar = Lunar.fromDate(reportDate);
        
        // 核心修正：虚岁 = 当前农历年 - 出生农历年 + 1
        const age = reportLunar.getYear() - lunar.getYear() + 1;
        
        const dayMaster = safeStr(bazi.getDayGan());
        const currentLiuNian = reportLunar.getYearInGanZhi(); 
        const currentLiuNianZhi = reportLunar.getYearZhi();

        let r = `【命理深度分析 (V12修正版)】\n`;
        r += `公历:${d.toLocaleDateString()} ${gender} | 农历:${lunar.toString()} | 虚岁:${age}\n`;
        r += `------------------------------------------------\n`;

        // 1. 八字 (紧凑版)
        r += `## 八字命盘 (日元:${dayMaster})\n`;
        const renderPillar = (g:any, z:any, name:string, nayin:string) => {
            const gs = safeStr(g); const zs = safeStr(z);
            const tg = getTenGods(dayMaster, gs);
            // @ts-ignore
            const h = (ZHI_HIDDEN[zs]||[]).map(Hidden => `${Hidden}<${getTenGods(dayMaster, Hidden)}>`).join('');
            return `- ${name}柱: [${gs}${zs}] ${tg} (${nayin}) 藏:[${h}]`;
        };
        
        r += renderPillar(bazi.getYearGan(), bazi.getYearZhi(), '年', bazi.getYearNaYin()) + '\n';
        r += renderPillar(bazi.getMonthGan(), bazi.getMonthZhi(), '月', bazi.getMonthNaYin()) + '\n';
        
        const dayZ = safeStr(bazi.getDayZhi());
        // @ts-ignore
        const dayH = (ZHI_HIDDEN[dayZ]||[]).map(Hidden => `${Hidden}<${getTenGods(dayMaster, Hidden)}>`).join('');
        r += `- 日柱: [${dayMaster}${dayZ}] ★日主 (${bazi.getDayNaYin()}) 藏:[${dayH}]\n`;
        
        r += renderPillar(bazi.getTimeGan(), bazi.getTimeZhi(), '时', bazi.getTimeNaYin()) + '\n';

        // 2. 大运列表 (完整展开)
        r += `\n### 大运 (起运:${bazi.getYun(gender==='男'?1:0).getStartYear()}年)\n`;
        const yun = bazi.getYun(gender === '男' ? 1 : 0);
        const daYuns = yun.getDaYun();
        let currentDaYunStr = "未起运";
        
        for (let i = 0; i < 8; i++) {
            const dy = daYuns[i];
            let gz = "";
            try { gz = dy.getGanZhi(); } catch(e) { gz = "??"; }
            if (gz && gz.length >= 1) {
                const tg = getTenGods(dayMaster, gz.charAt(0));
                // 打印列表
                r += `[${dy.getStartAge()}-${dy.getEndAge()}岁] ${gz}运 <${tg}>\n`;
                
                // 捕获当前大运
                if (age >= dy.getStartAge() && age <= dy.getEndAge()) {
                    currentDaYunStr = `${gz}运 (${dy.getStartAge()}-${dy.getEndAge()}岁) <${tg}>`;
                }
            }
        }
        
        r += `\n【报告时空 (${reportDateInput}｜农历${reportLunar.getYear()}年/${age}岁)】\n`;
        r += `> 八字: 行[${currentDaYunStr}] | 流年[${currentLiuNian}]\n`;

        // 3. 紫微斗数 (高密度行)
        const hourIdx = Math.floor((d.getHours() + 1) / 2) % 12;
        const iztroDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const astrolabe = astro.bySolar(iztroDate, hourIdx, gender, true, 'zh-CN');
        r += `> 紫微: ${astrolabe.fiveElementsClass} | 命主:${astrolabe.soul} | 身主:${astrolabe.body}\n\n`;

        let daXianName = "", liuNianName = "";

        astrolabe.palaces.forEach((p: any) => {
            const isDaXian = p.decadal && (age >= p.decadal.range[0] && age <= p.decadal.range[1]);
            const isLiuNian = p.earthlyBranch === currentLiuNianZhi;
            if (isDaXian) daXianName = p.name;
            if (isLiuNian) liuNianName = p.name;

            let titleMarks = [];
            if (p.isBodyPalace) titleMarks.push("★身");
            if (p.isOriginalPalace) titleMarks.push("★来");
            if (isDaXian) titleMarks.push("【大限】");
            if (isLiuNian) titleMarks.push("【流年】");
            
            const processStar = (s: any) => {
                return formatStarWithMarkers(astrolabe, p, s);
            };

            const majors = (p.majorStars||[]).map(processStar).join(',');
            const minors = (p.minorStars||[]).map(processStar).join(',');
            const adhocs = (p.adhocStars||[]).map((s: any) => s.name).join(',');
            
            let shenshas = [];
            if(p.boshi12 || p.doctor12) shenshas.push(p.boshi12 || p.doctor12);
            if(p.jiangqian12) shenshas.push(p.jiangqian12);
            if(p.suiqian12) shenshas.push(p.suiqian12);
            if(p.changsheng12 || p.changsheng) shenshas.push(p.changsheng12 || p.changsheng);
            
            // @ts-ignore
            const sh = ZW_SIHUA[p.heavenlyStem];
            const fly = sh ? `${sh.禄}/${sh.权}/${sh.科}/${sh.忌}` : "";

            r += `### [${p.name}] ${p.heavenlyStem}${p.earthlyBranch} ${titleMarks.join(' ')}\n`;
            r += `  * 星: ${majors} | ${minors} | ${adhocs}\n`;
            r += `  * 神: ${shenshas.join(' ')} | 飞: ${p.heavenlyStem}->${fly} | 限:${p.decadal.range[0]}-${p.decadal.range[1]}\n`;
        });
        
        r += `\n> 提示: 本大限命宫[${daXianName}] | 报告流年命宫[${liuNianName}]\n`;

        const lockedLedger = generateLockedZiweiLedger({
            astrolabe,
            caseId,
            gender,
            birthDate: d,
            reportDate,
            lunarText: lunar.toString(),
        });

        return {
            report: r,
            ledger: lockedLedger.markdown,
            notebookFacts: lockedLedger.notebookFacts,
            factCount: lockedLedger.factCount,
            ledgerStatus: lockedLedger.status,
            fingerprint: lockedLedger.fingerprint,
        };
    } catch (e: any) {
        const message = `排盘出错: ${e.message}`;
        return {
            report: message,
            ledger: `# [BLOCKED] 锁定台账生成失败\n\n${message}`,
            notebookFacts: `# [BLOCKED-FACTS] NotebookLM事实包生成失败\n\n${message}`,
            factCount: 0,
            ledgerStatus: 'BLOCKED',
            fingerprint: '',
        };
    }
};

// ==========================================
// 组件 UI
// ==========================================

export const ZiweiModal: React.FC<ZiweiModalProps> = ({ isOpen, onClose }) => {
  const [caseId, setCaseId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [gender, setGender] = useState<Gender>('男');
  const [reports, setReports] = useState<GeneratedReports | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>('report');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [auditInput, setAuditInput] = useState('');
  const [auditResult, setAuditResult] = useState('');
  const [auditValidation, setAuditValidation] = useState<FactValidationResult | null>(null);
  const [auditQuestion, setAuditQuestion] = useState<FactValidationQuestion>('AUTO');
  const [repairInput, setRepairInput] = useState('');
  const [repairMessage, setRepairMessage] = useState('');
  const [repairCopyFeedback, setRepairCopyFeedback] = useState(false);
  const [copiedQuestionId, setCopiedQuestionId] = useState('');
  const [expandedQuestionId, setExpandedQuestionId] = useState('Q0');
  const [selectedAdvancedQuestionVersion, setSelectedAdvancedQuestionVersion] = useState(defaultAdvancedQuestionGuide.version);
  const selectedAdvancedQuestionGuide = advancedQuestionGuides.find(
    guide => guide.version === selectedAdvancedQuestionVersion,
  ) ?? defaultAdvancedQuestionGuide;
  const advancedQuestionMarkdown = selectedAdvancedQuestionGuide.markdown;
  const advancedQuestionVersion = selectedAdvancedQuestionGuide.version;
  const advancedQuestions = selectedAdvancedQuestionGuide.questions;
  const activeResult = outputMode === 'questions'
    ? advancedQuestionMarkdown
    : reports
      ? outputMode === 'report'
      ? reports.report
      : outputMode === 'ledger'
        ? reports.ledger
        : outputMode === 'facts'
          ? reports.notebookFacts
          : auditResult
      : '';

  const questionGroups = advancedQuestions.reduce<Array<{ name: string; items: typeof advancedQuestions }>>((groups, item) => {
    const currentGroup = groups.find(group => group.name === item.group);
    if (currentGroup) currentGroup.items.push(item);
    else groups.push({ name: item.group, items: [item] });
    return groups;
  }, []);

  // Initialize with current time
  useEffect(() => {
    if (isOpen && (!birthDate || !reportDate)) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      const localIso = now.toISOString();
      if (!birthDate) setBirthDate(localIso.slice(0, 16));
      if (!reportDate) setReportDate(localIso.slice(0, 10));
    }
  }, [isOpen, birthDate, reportDate]);

  const handleGenerate = () => {
      if (!birthDate || !reportDate) return;
      const generated = generateReportLogic(birthDate, reportDate, gender, caseId);
      setReports(generated);
      setOutputMode('report');
      setAuditInput('');
      setAuditResult('');
      setAuditValidation(null);
      setAuditQuestion('AUTO');
      setRepairInput('');
      setRepairMessage('');
  };

  const handleAudit = () => {
    if (!reports || !auditInput.trim()) return;
    const result = validateNotebookAnswer(auditInput, reports.notebookFacts, auditQuestion);
    setAuditValidation(result);
    setAuditResult(formatFactValidationResult(result));
    setRepairInput('');
    setRepairMessage('');
  };

  const missingEvidenceIds = auditValidation
    ? getMissingEvidenceReferenceIds(auditValidation)
    : [];
  const repairPrompt = auditValidation
    ? buildEvidenceRepairPrompt(auditValidation)
    : '';
  const inlineReferenceRepair = auditValidation
    ? repairLeakedFactReferences(auditInput, auditValidation)
    : null;

  const handleCopyRepairPrompt = () => {
    if (!repairPrompt) return;
    navigator.clipboard.writeText(repairPrompt);
    setRepairCopyFeedback(true);
    setTimeout(() => setRepairCopyFeedback(false), 2000);
  };

  const handleApplyEvidencePatch = () => {
    if (!reports || !auditValidation || !repairInput.trim() || !missingEvidenceIds.length) return;
    const merged = mergeEvidencePatch(auditInput, repairInput, missingEvidenceIds);
    if (!merged.acceptedLines.length || merged.missingEvidenceIds.length) {
      setRepairMessage(merged.missingEvidenceIds.length
        ? `仍缺少：${merged.missingEvidenceIds.join('、')}。请只粘贴对应的E编号=FACT编号。`
        : '没有识别到可合并的补证行。');
      return;
    }
    const result = validateNotebookAnswer(merged.mergedAnswer, reports.notebookFacts, auditQuestion);
    setAuditInput(merged.mergedAnswer);
    setAuditValidation(result);
    setAuditResult(formatFactValidationResult(result));
    setRepairInput('');
    setRepairMessage(result.status === 'PASS'
      ? `已合并${merged.acceptedLines.length}条补证，原回答正文未改动。`
      : '补证已合并，仍有其他阻断，请查看下方核验结果。');
  };

  const handleApplyInlineReferenceRepair = () => {
    if (!reports || !inlineReferenceRepair?.replacements.length) return;
    const result = validateNotebookAnswer(
      inlineReferenceRepair.repairedAnswer,
      reports.notebookFacts,
      auditQuestion,
    );
    setAuditInput(inlineReferenceRepair.repairedAnswer);
    setAuditValidation(result);
    setAuditResult(formatFactValidationResult(result));
    const replacementSummary = inlineReferenceRepair.replacements
      .map(item => `${item.factId}→${item.evidenceId}`)
      .join('、');
    setRepairMessage(result.status === 'PASS'
      ? `已替换${replacementSummary}并通过复核，原论断未改动。`
      : `已替换${replacementSummary}，仍有其他阻断，请查看下方核验结果。`);
  };

  const handleCopy = () => {
    if (!activeResult) return;
    navigator.clipboard.writeText(activeResult);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleCopyQuestion = (id: string, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedQuestionId(id);
    setTimeout(() => setCopiedQuestionId(current => current === id ? '' : current), 2000);
  };

  const handleDownload = () => {
    if (!activeResult) return;
    const isMarkdown = outputMode === 'ledger' || outputMode === 'facts' || outputMode === 'questions';
    const blob = new Blob(
      [activeResult],
      { type: isMarkdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeCaseId = (caseId.trim() || 'CASE').replace(/[^\w\u4e00-\u9fff-]/g, '_');
    link.download = outputMode === 'ledger'
      ? `${safeCaseId}-LOCKED-盘面事实台账-${timestamp}.md`
      : outputMode === 'facts'
        ? `${safeCaseId}-LOCKED-NotebookLM事实包-${timestamp}.md`
        : outputMode === 'questions'
          ? `紫微单盘-进阶提问清单-${advancedQuestionVersion}.md`
        : outputMode === 'audit'
          ? `${safeCaseId}-NotebookLM回答核验-${timestamp}.txt`
          : `${safeCaseId}-原始命盘-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-6xl h-[90vh] bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-violet-50 to-white shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-200">
               <Moon size={20} className="fill-current" />
             </div>
             <div>
               <h2 className="text-xl font-bold text-gray-900">iZiwei Pro</h2>
               <p className="text-xs text-gray-500 font-medium">Deep Analysis Generator</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
            {/* Input Panel */}
            <div className={`w-full md:w-80 p-6 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 flex-col gap-6 flex-none md:shrink-0 overflow-visible md:overflow-y-auto ${outputMode === 'questions' ? 'hidden' : 'flex'}`}>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <FileText size={12} />
                        案例编号
                    </label>
                    <input
                        type="text"
                        value={caseId}
                        onChange={(e) => setCaseId(e.target.value)}
                        placeholder="例如 ADV-001"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Calendar size={12} />
                        出生日期 (公历)
                    </label>
                    <input 
                        type="datetime-local" 
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Calendar size={12} />
                        报告日期 (公历)
                    </label>
                    <input
                        type="date"
                        value={reportDate}
                        min={birthDate ? birthDate.slice(0, 10) : undefined}
                        onChange={(e) => setReportDate(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">性别</label>
                    <div className="flex bg-white rounded-xl p-1 border border-gray-200">
                        <button 
                            onClick={() => setGender('男')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${gender === '男' ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            男 (Male)
                        </button>
                        <button 
                            onClick={() => setGender('女')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${gender === '女' ? 'bg-pink-100 text-pink-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            女 (Female)
                        </button>
                    </div>
                </div>

                <button 
                    onClick={handleGenerate}
                    className="mt-auto w-full bg-black text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <Sparkles size={16} />
                    排盘生成
                </button>
                <button
                    onClick={() => {
                      setOutputMode('questions');
                      setCopyFeedback(false);
                    }}
                    className="w-full bg-white text-gray-700 py-3 rounded-xl border border-gray-200 font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                    <ListChecks size={16} />
                    进阶提问清单
                </button>
            </div>

            {/* Output Panel */}
            <div className={`p-0 bg-white relative flex flex-col ${outputMode === 'questions' ? 'flex-1 min-h-0' : 'flex-none min-h-[65vh] md:flex-1 md:min-h-0'}`}>
                {!reports && outputMode !== 'questions' ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Moon size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm">请在左侧输入生辰信息并点击生成</p>
                    </div>
                ) : (
                    <>
                        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-white">
                            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg shrink-0">
                                <button
                                    onClick={() => {
                                      setOutputMode('report');
                                      setCopyFeedback(false);
                                    }}
                                    className={`h-8 w-9 sm:w-auto px-0 sm:px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${outputMode === 'report' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    aria-label="原始命盘"
                                    title="原始命盘"
                                >
                                    <FileText size={13} />
                                    <span className="hidden sm:inline">原始命盘</span>
                                </button>
                                <button
                                    onClick={() => {
                                      setOutputMode('ledger');
                                      setCopyFeedback(false);
                                    }}
                                    className={`h-8 w-9 sm:w-auto px-0 sm:px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${outputMode === 'ledger' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    aria-label="锁定台账"
                                    title="锁定台账"
                                    disabled={!reports}
                                >
                                    <CheckCircle2 size={13} />
                                    <span className="hidden sm:inline">锁定台账</span>
                                </button>
                                <button
                                    onClick={() => {
                                      setOutputMode('facts');
                                      setCopyFeedback(false);
                                    }}
                                    className={`h-8 w-9 sm:w-auto px-0 sm:px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${outputMode === 'facts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    aria-label="NotebookLM事实包"
                                    title="NotebookLM事实包"
                                    disabled={!reports}
                                >
                                    <Database size={13} />
                                    <span className="hidden sm:inline">NotebookLM事实包</span>
                                </button>
                                <button
                                    onClick={() => {
                                      setOutputMode('audit');
                                      setCopyFeedback(false);
                                    }}
                                    className={`h-8 w-9 sm:w-auto px-0 sm:px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${outputMode === 'audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    aria-label="回答核验"
                                    title="回答核验"
                                    disabled={!reports}
                                >
                                    <ShieldCheck size={13} />
                                    <span className="hidden sm:inline">回答核验</span>
                                </button>
                                <button
                                    onClick={() => {
                                      setOutputMode('questions');
                                      setCopyFeedback(false);
                                    }}
                                    className={`h-8 w-9 sm:w-auto px-0 sm:px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${outputMode === 'questions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    aria-label="进阶提问清单"
                                    title="进阶提问清单"
                                >
                                    <ListChecks size={13} />
                                    <span className="hidden sm:inline">提问清单</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {reports && (outputMode === 'ledger' || outputMode === 'facts') && (
                                <span className={`text-xs font-semibold ${reports.ledgerStatus === 'PASS' ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {reports?.ledgerStatus === 'PASS'
                                    ? outputMode === 'facts'
                                      ? `${reports.factCount}项事实 · ${reports.fingerprint}`
                                      : `校验通过 · ${reports.fingerprint}`
                                    : '校验未通过'}
                                </span>
                              )}
                             <button 
                                onClick={handleDownload}
                                disabled={!activeResult}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all shadow-sm"
                                title={outputMode === 'facts' ? '下载NotebookLM事实包' : outputMode === 'ledger' ? '下载Markdown台账' : '下载当前内容'}
                            >
                                <Download size={12} />
                                下载
                            </button>
                            <button 
                                onClick={handleCopy}
                                disabled={!activeResult}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${copyFeedback ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                {copyFeedback
                                  ? <span className="flex items-center gap-1">已复制!</span>
                                  : <><Copy size={12} /> {outputMode === 'facts' ? '复制事实包' : outputMode === 'ledger' ? '复制台账' : outputMode === 'audit' ? '复制结果' : outputMode === 'questions' ? '复制全部' : '复制命盘'}</>}
                            </button>
                            </div>
                        </div>
                        {outputMode === 'questions' ? (
                          <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                            <div className="sticky top-0 z-10 px-5 sm:px-7 py-4 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <h3 className="m-0 text-base font-bold text-gray-900">紫微单盘进阶提问清单</h3>
                                  <p className="m-0 mt-1 text-xs text-gray-500">{selectedAdvancedQuestionGuide.description}</p>
                                </div>
                                <div className="inline-flex self-start sm:self-auto shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 p-0.5" aria-label="选择提问清单版本">
                                  {advancedQuestionGuides.map(guide => {
                                    const selected = guide.version === advancedQuestionVersion;
                                    return (
                                      <button
                                        key={guide.version}
                                        type="button"
                                        onClick={() => {
                                          setSelectedAdvancedQuestionVersion(guide.version);
                                          setExpandedQuestionId('Q0');
                                          setCopiedQuestionId('');
                                          setCopyFeedback(false);
                                        }}
                                        className={`min-h-8 px-2.5 rounded-[4px] text-xs font-semibold transition-colors ${selected ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                        aria-pressed={selected}
                                        title={`${guide.version} ${guide.label}`}
                                      >
                                        {guide.version} {guide.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <p className="m-0 mt-2 text-[11px] font-semibold text-violet-700">{advancedQuestionVersion} · {advancedQuestions.length}个复制项 · 可随时切回稳定版</p>
                            </div>
                            <div className="pb-8">
                              {questionGroups.map(group => (
                                <section key={group.name} className="border-b border-gray-100">
                                  <h4 className="m-0 px-5 sm:px-7 py-3 bg-gray-50 text-xs font-bold text-gray-500">{group.name}</h4>
                                  {group.items.map(item => {
                                    const expanded = expandedQuestionId === item.id;
                                    const copied = copiedQuestionId === item.id;
                                    return (
                                      <div key={item.id} className="border-t border-gray-100 first:border-t-0">
                                        <div className="min-h-14 flex items-stretch">
                                          <button
                                            onClick={() => setExpandedQuestionId(expanded ? '' : item.id)}
                                            className="min-w-0 flex-1 px-5 sm:px-7 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                                            aria-expanded={expanded}
                                          >
                                            <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                                            <span className="min-w-0">
                                              <span className="block text-sm font-semibold text-gray-900 break-words">{item.title}</span>
                                              <span className="block mt-0.5 text-[11px] text-gray-500">{item.optional ? '可选步骤' : item.id.startsWith('CP-') ? '阶段检查点' : '正式问题'}</span>
                                            </span>
                                          </button>
                                          <button
                                            onClick={() => handleCopyQuestion(item.id, item.prompt)}
                                            className={`w-14 sm:w-24 shrink-0 border-l border-gray-100 flex items-center justify-center gap-2 text-xs font-semibold transition-colors ${copied ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                            title={`复制${item.title}`}
                                          >
                                            {copied ? <Check size={15} /> : <Copy size={15} />}
                                            <span className="hidden sm:inline">{copied ? '已复制' : '复制'}</span>
                                          </button>
                                        </div>
                                        {expanded && (
                                          <pre className="m-0 px-5 sm:px-7 py-5 border-t border-gray-100 bg-gray-50/60 whitespace-pre-wrap font-mono text-xs sm:text-sm leading-relaxed text-gray-700 overflow-x-auto">
                                            {item.prompt}
                                          </pre>
                                        )}
                                      </div>
                                    );
                                  })}
                                </section>
                              ))}
                            </div>
                          </div>
                        ) : outputMode === 'audit' ? (
                          <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)_auto_auto_minmax(160px,0.65fr)] bg-white">
                            <textarea
                              value={auditInput}
                                onChange={(event) => {
                                  setAuditInput(event.target.value);
                                  setAuditResult('');
                                  setAuditValidation(null);
                                  setRepairInput('');
                                  setRepairMessage('');
                                }}
                              placeholder="只粘贴当前一道问题的Model回答；证据格式示例：E01=Z054"
                              className="w-full min-h-0 p-6 resize-none focus:outline-none font-mono text-sm leading-relaxed text-gray-700 bg-white"
                            />
                            <div className="px-4 sm:px-6 py-3 border-y border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
                              <div className="w-full sm:w-auto min-w-0 flex items-center gap-2">
                                <span className="shrink-0 text-[11px] font-semibold text-emerald-700">核验协议 v3</span>
                                <span className={`truncate text-xs ${reports?.ledgerStatus === 'PASS' ? 'text-gray-500' : 'text-amber-700'}`}>
                                  {reports?.ledgerStatus === 'PASS'
                                    ? '分层显示引用核验与核心闭包；语义角色仍需人工审查'
                                    : '当前事实包未通过台账校验；仍可核验，结果会标明事实源阻断原因'}
                                </span>
                              </div>
                              <div className="w-full sm:w-auto flex items-center gap-2 shrink-0">
                                <select
                                  value={auditQuestion}
                                  onChange={(event) => {
                                    setAuditQuestion(event.target.value as FactValidationQuestion);
                                    setAuditResult('');
                                    setAuditValidation(null);
                                    setRepairInput('');
                                    setRepairMessage('');
                                  }}
                                  title="选择当前回答所属问题；自动模式会从C编号识别"
                                  className="h-9 min-w-0 flex-1 sm:flex-none rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
                                >
                                  <option value="AUTO">自动识别题目</option>
                                  {Array.from({ length: 12 }, (_, index) => index + 1).map(question => (
                                    <option key={question} value={`Q${question}`}>
                                      问题{question}{question === 6 ? ' · 核心闭包' : ''}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={handleCopy}
                                  disabled={!auditResult}
                                  title="复制核验结果"
                                  className="h-9 w-9 sm:w-auto px-0 sm:px-3 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Copy size={14} />
                                  <span className="hidden sm:inline">{copyFeedback ? '已复制' : '复制结果'}</span>
                                </button>
                                <button
                                  onClick={handleAudit}
                                  disabled={!auditInput.trim()}
                                  title={!auditInput.trim()
                                    ? '请先粘贴NotebookLM回答'
                                    : reports?.ledgerStatus === 'PASS'
                                      ? '开始核验'
                                      : '核验当前回答并查看事实源阻断原因'}
                                  className="h-9 w-9 sm:w-auto px-0 sm:px-4 rounded-lg bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ShieldCheck size={14} />
                                  <span className="hidden sm:inline">开始核验</span>
                                </button>
                              </div>
                            </div>
                            <div className={missingEvidenceIds.length || inlineReferenceRepair?.replacements.length ? 'border-b border-amber-200 bg-amber-50 px-4 sm:px-6 py-4' : ''}>
                              {!!inlineReferenceRepair?.replacements.length && (
                                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${missingEvidenceIds.length ? 'mb-4 border-b border-amber-200 pb-4' : ''}`}>
                                  <div>
                                    <p className="m-0 text-xs font-semibold text-amber-900">
                                      可自动修复：正文编号可按有效证据映射替换
                                    </p>
                                    <p className="m-0 mt-1 text-[11px] text-amber-700">
                                      {inlineReferenceRepair.replacements.map(item => `${item.factId}→${item.evidenceId}`).join('、')}；只替换编号，不改论断内容。
                                    </p>
                                  </div>
                                  <button
                                    onClick={handleApplyInlineReferenceRepair}
                                    className="h-9 px-3 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
                                  >
                                    <ShieldCheck size={14} />
                                    替换编号并复核
                                  </button>
                                </div>
                              )}
                              {missingEvidenceIds.length > 0 && (
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                      <p className="m-0 text-xs font-semibold text-amber-900">
                                        可补证：缺少{missingEvidenceIds.join('、')}，不必重写整篇
                                      </p>
                                      <p className="m-0 mt-1 text-[11px] text-amber-700">
                                        复制指令给NotebookLM，再把它返回的映射行粘贴到下方。
                                      </p>
                                    </div>
                                    <button
                                      onClick={handleCopyRepairPrompt}
                                      className="h-9 px-3 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
                                    >
                                      <Copy size={14} />
                                      {repairCopyFeedback ? '已复制' : '复制补证指令'}
                                    </button>
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <textarea
                                      value={repairInput}
                                      onChange={(event) => {
                                        setRepairInput(event.target.value);
                                        setRepairMessage('');
                                      }}
                                      placeholder={missingEvidenceIds.map(id => `${id}=FACT编号`).join('\n')}
                                      className="min-h-20 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-amber-200 font-mono text-xs leading-relaxed text-gray-700"
                                    />
                                    <button
                                      onClick={handleApplyEvidencePatch}
                                      disabled={!repairInput.trim()}
                                      className="h-9 sm:self-end px-4 rounded-lg bg-amber-900 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <ShieldCheck size={14} />
                                      合并复核
                                    </button>
                                  </div>
                                  {repairMessage && <p className="m-0 text-xs font-medium text-amber-800">{repairMessage}</p>}
                                </div>
                              )}
                            </div>
                            <pre className={`m-0 p-6 overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed ${auditResult && !auditResult.startsWith('核验结论：BLOCKED') ? 'text-emerald-700 bg-emerald-50/40' : auditResult ? 'text-red-700 bg-red-50/40' : 'text-gray-400 bg-white'}`}>
                              {auditResult || '核验结果会显示在这里'}
                            </pre>
                          </div>
                        ) : (
                          <textarea 
                              readOnly
                              value={activeResult}
                              className="w-full flex-1 p-6 md:p-8 resize-none focus:outline-none font-mono text-sm leading-relaxed text-gray-700 bg-white"
                          />
                        )}
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
