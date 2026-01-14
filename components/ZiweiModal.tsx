import React, { useState, useEffect } from 'react';
import { astro } from 'iztro';
import { Solar } from 'lunar-javascript';
import { X, Moon, Sparkles, Copy, Calendar, Download } from './Icons';

interface ZiweiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper Types
type Gender = '男' | '女';

// ==========================================
// 核心逻辑: 静态真理表与计算函数
// ==========================================

// 1. 静态真理表 (避免库版本兼容问题)
const ZHI_HIDDEN: Record<string, string[]> = {
    '子':['癸'], '丑':['己','癸','辛'], '寅':['甲','丙','戊'], '卯':['乙'],
    '辰':['戊','乙','癸'], '巳':['丙','戊','庚'], '午':['丁','己'], '未':['己','丁','乙'],
    '申':['庚','壬','戊'], '酉':['辛'], '戌':['戊','辛','丁'], '亥':['壬','甲']
};

const SHI_SHEN_TABLE: Record<string, Record<string, string>> = {
    '甲':{'甲':'比肩','乙':'劫财','丙':'食神','丁':'伤官','戊':'偏财','己':'正财','庚':'七杀','辛':'正官','壬':'偏印','癸':'正印'},
    '乙':{'甲':'劫财','乙':'比肩','丙':'伤官','丁':'食神','戊':'正财','己':'偏财','庚':'正官','辛':'七杀','壬':'正印','癸':'偏印'},
    '丙':{'甲':'偏印','乙':'正印','丙':'比肩','丁':'劫财','戊':'食神','己':'伤官','庚':'偏财','辛':'正财','壬':'七杀','癸':'正官'},
    '丁':{'甲':'正印','乙':'偏印','丙':'劫财','丁':'比肩','戊':'伤官','己':'食神','庚':'正财','辛':'偏财','壬':'正官','癸':'七杀'},
    '戊':{'甲':'七杀','乙':'正官','丙':'偏印','丁':'正印','戊':'比肩','己':'劫财','庚':'食神','辛':'伤官','壬':'偏财','癸':'正财'},
    '己':{'甲':'正官','乙':'七杀','丙':'正印','丁':'偏印','戊':'劫财','己':'比肩','庚':'伤官','辛':'食神','壬':'正财','癸':'偏财'},
    '庚':{'甲':'偏财','乙':'正财','丙':'七杀','丁':'正官','戊':'偏印','己':'正印','庚':'比肩','辛':'劫财','壬':'食神','癸':'伤官'},
    '辛':{'甲':'正财','乙':'偏财','丙':'正官','丁':'七杀','戊':'正印','己':'偏印','庚':'劫财','辛':'比肩','壬':'伤官','癸':'食神'},
    '壬':{'甲':'食神','乙':'伤官','丙':'偏财','丁':'正财','戊':'七杀','己':'正官','庚':'偏印','辛':'正印','壬':'比肩','癸':'劫财'},
    '癸':{'甲':'伤官','乙':'食神','丙':'正财','丁':'偏财','戊':'正官','己':'七杀','庚':'正印','辛':'偏印','壬':'劫财','癸':'比肩'}
};

const ZW_SIHUA: Record<string, {禄:string, 权:string, 科:string, 忌:string}> = {
    '甲': {禄:'廉贞',权:'破军',科:'武曲',忌:'太阳'},
    '乙': {禄:'天机',权:'天梁',科:'紫微',忌:'太阴'},
    '丙': {禄:'天同',权:'天机',科:'文昌',忌:'廉贞'},
    '丁': {禄:'太阴',权:'天同',科:'天机',忌:'巨门'},
    '戊': {禄:'贪狼',权:'太阴',科:'右弼',忌:'天机'},
    '己': {禄:'武曲',权:'贪狼',科:'天梁',忌:'文曲'},
    '庚': {禄:'太阳',权:'武曲',科:'太阴',忌:'天同'},
    '辛': {禄:'巨门',权:'太阳',科:'文曲',忌:'文昌'},
    '壬': {禄:'天梁',权:'紫微',科:'左辅',忌:'武曲'},
    '癸': {禄:'破军',权:'巨门',科:'太阴',忌:'贪狼'}
};

// 2. 工具函数
function safeStr(input: any): string {
    if (input === null || input === undefined) return "";
    if (typeof input === 'string') return input;
    if (typeof input.getName === 'function') return input.getName();
    if (typeof input.toString === 'function') return input.toString();
    return String(input);
}

function getTenGods(dayGan: string, targetGan: string) {
    // @ts-ignore
    return (SHI_SHEN_TABLE[dayGan] && SHI_SHEN_TABLE[dayGan][targetGan]) || "?";
}

// 3. 核心生成函数
const generateReportLogic = (dateInput: string, gender: '男'|'女') => {
    try {
        const d = new Date(dateInput);
        
        // --- A. 八字计算 (Using lunar-javascript) ---
        const solar = Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), 0);
        const lunar = solar.getLunar();
        const bazi = lunar.getEightChar();
        bazi.setSect(2); // 2 = 立春

        const dayMaster = safeStr(bazi.getDayGan()); 

        let r = `【命理深度分析报告 (八字+紫微)】\n`;
        r += `公历: ${d.toLocaleString('zh-CN')} (${gender})\n`;
        r += `农历: ${lunar.toString()}\n`;
        r += `------------------------------------------------\n\n`;

        // 八字渲染
        r += `## 第一部分：八字命盘\n`;
        const renderPillar = (ganObj: any, zhiObj: any, name: string) => {
            const g = safeStr(ganObj);
            const z = safeStr(zhiObj);
            const tenGod = getTenGods(dayMaster, g);
            // @ts-ignore
            const hiddens = (ZHI_HIDDEN[z] || []).map(h => `${h}<${getTenGods(dayMaster, h)}>`).join(',');
            return `- ${name}柱: [${g}${z}]\n  * 十神: ${tenGod}\n  * 藏干: ${hiddens}`;
        };
        r += renderPillar(bazi.getYearGan(), bazi.getYearZhi(), '年') + '\n';
        r += renderPillar(bazi.getMonthGan(), bazi.getMonthZhi(), '月') + '\n';
        
        const dayZ = safeStr(bazi.getDayZhi());
        // @ts-ignore
        const dayHiddens = (ZHI_HIDDEN[dayZ] || []).map(h => `${h}<${getTenGods(dayMaster, h)}>`).join(',');
        r += `- 日柱: [${dayMaster}${dayZ}] (★日元)\n  * 藏干: ${dayHiddens}\n`;
        r += renderPillar(bazi.getTimeGan(), bazi.getTimeZhi(), '时') + '\n\n';

        // 大运
        r += `### 大运\n`;
        const yun = bazi.getYun(gender === '男' ? 1 : 0);
        const daYuns = yun.getDaYun();
        for (let i = 0; i < 8; i++) {
            const dy = daYuns[i];
            let gz = "";
            try { gz = dy.getGanZhi(); } catch(e) { gz = "??"; }
            if (gz && gz.length >= 1) {
                r += `[${dy.getStartAge()}-${dy.getEndAge()}岁] ${gz}运 <${getTenGods(dayMaster, gz.charAt(0))}>\n`;
            }
        }

        // --- B. 紫微计算 (Using iztro) ---
        r += `\n------------------------------------------------\n`;
        r += `## 第二部分：紫微斗数\n\n`;
        const hourIdx = Math.floor((d.getHours() + 1) / 2) % 12;
        const iztroDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const astrolabe = astro.bySolar(iztroDate, hourIdx, gender, true, 'zh-CN');
        r += `五行局: ${astrolabe.fiveElementsClass} | 命主: ${astrolabe.soul}\n\n`;

        astrolabe.palaces.forEach(p => {
            let flags = [];
            if (p.isBodyPalace) flags.push("★身宫");
            if (p.isOriginalPalace) flags.push("★来因宫");
            r += `### ${p.name} [${p.heavenlyStem}${p.earthlyBranch}] ${flags.join(' ')}\n`;
            
            // 星曜
            const allStars = [...(p.majorStars||[]), ...(p.minorStars||[]), ...(p.adhocStars||[])];
            const starDescs = allStars.map(s => {
                let txt = s.name;
                if (s.brightness) txt += `(${s.brightness})`;
                if (s.mutagen) txt += `[生年${s.mutagen}]`;
                // @ts-ignore
                const siHuaMap = ZW_SIHUA[p.heavenlyStem];
                if (siHuaMap) { 
                     // Simple validation for centrifugal flow (Departure)
                     if(siHuaMap.禄===s.name) txt+='[离心禄]';
                     if(siHuaMap.权===s.name) txt+='[离心权]';
                     if(siHuaMap.科===s.name) txt+='[离心科]';
                     if(siHuaMap.忌===s.name) txt+='[离心忌]';
                }
                return txt;
            });
            r += `  * 星曜: ${starDescs.join(', ') || "无"}\n`;
            
            // 宫干四化
            // @ts-ignore
            const siHua = ZW_SIHUA[p.heavenlyStem];
            if (siHua) r += `  * 飞化: ${p.heavenlyStem}干 -> ${siHua.禄}禄、${siHua.权}权、${siHua.科}科、${siHua.忌}忌\n`;
            if (p.decadal) r += `  * 大限: ${p.decadal.range[0]} - ${p.decadal.range[1]} 岁\n`;
            r += `\n`;
        });

        return r;
    } catch (e: any) {
        return "排盘出错: " + e.message;
    }
};

// ==========================================
// 组件 UI
// ==========================================

export const ZiweiModal: React.FC<ZiweiModalProps> = ({ isOpen, onClose }) => {
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('男');
  const [result, setResult] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

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
      const report = generateReportLogic(birthDate, gender);
      setResult(report);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `iZiwei-Report-${timestamp}.txt`;
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
                {!result ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Moon size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm">请在左侧输入生辰信息并点击生成</p>
                    </div>
                ) : (
                    <>
                        <div className="absolute top-4 right-4 z-10 flex gap-2">
                             <button 
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-xs font-medium transition-all shadow-sm"
                                title="下载 TXT"
                            >
                                <Download size={12} />
                                下载
                            </button>
                            <button 
                                onClick={handleCopy}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm ${copyFeedback ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                {copyFeedback ? <span className="flex items-center gap-1">已复制!</span> : <><Copy size={12} /> 复制报告</>}
                            </button>
                        </div>
                        <textarea 
                            readOnly
                            value={result}
                            className="w-full h-full p-6 md:p-8 resize-none focus:outline-none font-mono text-sm leading-relaxed text-gray-700 bg-white"
                        />
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};