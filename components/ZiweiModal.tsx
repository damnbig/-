import React, { useState, useEffect } from 'react';
import { astro } from 'iztro';
import { Solar, Lunar } from 'lunar-javascript';
import { X, Moon, Sparkles, Copy, Calendar, Download, FileText, CheckCircle2 } from './Icons';
import { ZW_SIHUA, formatStarWithMarkers, generateLockedZiweiLedger } from '../services/ziweiLedger';

interface ZiweiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper Types
type Gender = '男' | '女';
type OutputMode = 'report' | 'ledger';
type GeneratedReports = {
    report: string;
    ledger: string;
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
const generateReportLogic = (dateInput: string, gender: '男'|'女', caseId: string): GeneratedReports => {
    try {
        const d = new Date(dateInput);
        const today = new Date();
        
        // --- A. 八字与基础信息 ---
        const solar = Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), 0);
        const lunar = solar.getLunar();
        const bazi = lunar.getEightChar();
        bazi.setSect(2); 

        // 计算当前时间的农历 (解决年关虚岁问题)
        const todayLunar = Lunar.fromDate(today);
        
        // 核心修正：虚岁 = 当前农历年 - 出生农历年 + 1
        const age = todayLunar.getYear() - lunar.getYear() + 1;
        
        const dayMaster = safeStr(bazi.getDayGan());
        const currentLiuNian = todayLunar.getYearInGanZhi(); 
        const currentLiuNianZhi = todayLunar.getYearZhi();

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
        
        r += `\n【当前时空 (农历${todayLunar.getYear()}年/${age}岁)】\n`;
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
        
        r += `\n> 提示: 本大限命宫[${daXianName}] | 今年流年命宫[${liuNianName}]\n`;

        const lockedLedger = generateLockedZiweiLedger({
            astrolabe,
            caseId,
            gender,
            birthDate: d,
            lunarText: lunar.toString(),
            age,
            reportLunarYear: todayLunar.getYear(),
            currentGanZhi: currentLiuNian,
            currentYearBranch: currentLiuNianZhi,
            birthYearStem: safeStr(bazi.getYearGan()),
        });

        return {
            report: r,
            ledger: lockedLedger.markdown,
            ledgerStatus: lockedLedger.status,
            fingerprint: lockedLedger.fingerprint,
        };
    } catch (e: any) {
        const message = `排盘出错: ${e.message}`;
        return {
            report: message,
            ledger: `# [BLOCKED] 锁定台账生成失败\n\n${message}`,
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
  const [gender, setGender] = useState<Gender>('男');
  const [reports, setReports] = useState<GeneratedReports | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>('report');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const activeResult = reports
    ? (outputMode === 'report' ? reports.report : reports.ledger)
    : '';

  // Initialize with current time
  useEffect(() => {
    if (isOpen && !birthDate) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setBirthDate(now.toISOString().slice(0, 16));
    }
  }, [isOpen]);

  const handleGenerate = () => {
      if (!birthDate) return;
      const generated = generateReportLogic(birthDate, gender, caseId);
      setReports(generated);
      setOutputMode('report');
  };

  const handleCopy = () => {
    if (!activeResult) return;
    navigator.clipboard.writeText(activeResult);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownload = () => {
    if (!activeResult) return;
    const isLedger = outputMode === 'ledger';
    const blob = new Blob(
      [activeResult],
      { type: isLedger ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeCaseId = (caseId.trim() || 'CASE').replace(/[^\w\u4e00-\u9fff-]/g, '_');
    link.download = isLedger
      ? `${safeCaseId}-LOCKED-盘面事实台账-${timestamp}.md`
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

      <div className="relative w-full max-w-4xl bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-violet-50 to-white">
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

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
            {/* Input Panel */}
            <div className="w-full md:w-80 p-6 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col gap-6 shrink-0 overflow-y-auto">
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
            </div>

            {/* Output Panel */}
            <div className="flex-1 p-0 bg-white relative flex flex-col min-h-[300px]">
                {!reports ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Moon size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm">请在左侧输入生辰信息并点击生成</p>
                    </div>
                ) : (
                    <>
                        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-white">
                            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                                <button
                                    onClick={() => {
                                      setOutputMode('report');
                                      setCopyFeedback(false);
                                    }}
                                    className={`h-8 px-3 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${outputMode === 'report' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <FileText size={13} />
                                    原始命盘
                                </button>
                                <button
                                    onClick={() => {
                                      setOutputMode('ledger');
                                      setCopyFeedback(false);
                                    }}
                                    className={`h-8 px-3 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${outputMode === 'ledger' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <CheckCircle2 size={13} />
                                    锁定台账
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {outputMode === 'ledger' && (
                                <span className={`text-xs font-semibold ${reports.ledgerStatus === 'PASS' ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {reports.ledgerStatus === 'PASS' ? `校验通过 · ${reports.fingerprint}` : '校验未通过'}
                                </span>
                              )}
                             <button 
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-xs font-medium transition-all shadow-sm"
                                title={outputMode === 'ledger' ? '下载 Markdown 台账' : '下载 TXT 命盘'}
                            >
                                <Download size={12} />
                                下载
                            </button>
                            <button 
                                onClick={handleCopy}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm ${copyFeedback ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                {copyFeedback
                                  ? <span className="flex items-center gap-1">已复制!</span>
                                  : <><Copy size={12} /> {outputMode === 'ledger' ? '复制台账' : '复制命盘'}</>}
                            </button>
                            </div>
                        </div>
                        <textarea 
                            readOnly
                            value={activeResult}
                            className="w-full flex-1 p-6 md:p-8 resize-none focus:outline-none font-mono text-sm leading-relaxed text-gray-700 bg-white"
                        />
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
