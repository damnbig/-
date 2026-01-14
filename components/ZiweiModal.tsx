import React, { useState, useEffect } from 'react';
import { astro } from 'iztro';
import { X, Moon, Sparkles, Copy, Calendar, Download } from './Icons';

interface ZiweiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper Types
type Gender = '男' | '女';

const siHuaMap: Record<string, { 禄: string; 权: string; 科: string; 忌: string }> = {
  '甲': { 禄:'廉贞', 权:'破军', 科:'武曲', 忌:'太阳' },
  '乙': { 禄:'天机', 权:'天梁', 科:'紫微', 忌:'太阴' },
  '丙': { 禄:'天同', 权:'天机', 科:'文昌', 忌:'廉贞' },
  '丁': { 禄:'太阴', 权:'天同', 科:'天机', 忌:'巨门' },
  '戊': { 禄:'贪狼', 权:'太阴', 科:'右弼', 忌:'天机' },
  '己': { 禄:'武曲', 权:'贪狼', 科:'天梁', 忌:'文曲' },
  '庚': { 禄:'太阳', 权:'武曲', 科:'太阴', 忌:'天同' },
  '辛': { 禄:'巨门', 权:'太阳', 科:'文曲', 忌:'文昌' },
  '壬': { 禄:'天梁', 权:'紫微', 科:'左辅', 忌:'武曲' },
  '癸': { 禄:'破军', 权:'巨门', 科:'太阴', 忌:'贪狼' }
};

const branches = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

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

  const getMutagenByStem = (stem: string, starName: string) => {
    if (!siHuaMap[stem]) return null;
    const map = siHuaMap[stem];
    if (map.禄 === starName) return '禄';
    if (map.权 === starName) return '权';
    if (map.科 === starName) return '科';
    if (map.忌 === starName) return '忌';
    return null;
  };

  const getOppositeBranch = (branch: string) => {
    const idx = branches.indexOf(branch);
    return branches[(idx + 6) % 12];
  };

  const generateReport = () => {
    if (!birthDate) return;

    try {
      const dateObj = new Date(birthDate);
      const hour = dateObj.getHours();
      const hourIndex = Math.floor((hour + 1) / 2) % 12;

      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const solarDateStr = `${year}-${month}-${day}`;

      // Core calculation using iztro
      const astrolabe = astro.bySolar(solarDateStr, hourIndex, gender, true, 'zh-CN');

      let txt = `【紫微斗数深度命理报告】\n`;
      txt += `生成标识: iZiwei-Pro-v3 | Focus App集成版\n`;
      txt += `================================================\n`;
      txt += `【基本资料】\n`;
      txt += `阳历: ${solarDateStr} ${hour}时\n`;
      txt += `农历: ${astrolabe.lunarDate}\n`;
      txt += `八字: ${astrolabe.chineseDate.yearly} ${astrolabe.chineseDate.monthly} ${astrolabe.chineseDate.daily} ${astrolabe.chineseDate.hourly}\n`;
      txt += `格局: ${astrolabe.fiveElementsClass} | 命主: ${astrolabe.soul} | 身主: ${astrolabe.body}\n`;
      txt += `================================================\n\n`;

      astrolabe.palaces.forEach((palace) => {
        let titleFlags = [];
        if (palace.isBodyPalace) titleFlags.push("★身宫");
        if (palace.isOriginalPalace) titleFlags.push("★来因宫");
        
        txt += `### ${palace.name} [${palace.heavenlyStem}${palace.earthlyBranch}] ${titleFlags.join(' ')}\n`;

        const processStar = (star: any) => {
            let s = `${star.name}`;
            if (star.brightness) s += `(${star.brightness})`;
            if (star.mutagen) s += `【生年${star.mutagen}】`;
            
            // Self mutagen (Departure)
            const selfMutagen = getMutagenByStem(palace.heavenlyStem, star.name);
            if (selfMutagen) s += `【离心自化${selfMutagen}】(变动/消散)`;

            // Inward mutagen (Incoming)
            const oppositeBranch = getOppositeBranch(palace.earthlyBranch);
            const targetPalace = astrolabe.palaces.find(p => p.earthlyBranch === oppositeBranch);
            if (targetPalace) {
                const inwardMutagen = getMutagenByStem(targetPalace.heavenlyStem, star.name);
                if (inwardMutagen) s += `【向心自化${inwardMutagen}】(外界介入)`;
            }
            return s;
        };

        const majors = (palace.majorStars || []).map(processStar).join("，");
        const minors = (palace.minorStars || []).map(processStar).join("，");
        const adhocs = (palace.adhocStars || []).map(s => s.name).join("，");

        txt += ` - 主星: ${majors || "无 (空宫)"}\n`;
        if(minors) txt += ` - 辅星: ${minors}\n`;
        if(adhocs) txt += ` - 杂曜: ${adhocs}\n`;

        let shenshas = [];
        if (palace.changsheng) shenshas.push(`长生:${palace.changsheng}`);
        if (palace.doctor12) shenshas.push(`博士:${palace.doctor12}`);
        if (palace.suiqian12) shenshas.push(`岁前:${palace.suiqian12}`);
        if (palace.jiangqian12) shenshas.push(`将前:${palace.jiangqian12}`);
        
        if (shenshas.length > 0) {
            txt += ` - 神煞: ${shenshas.join(' | ')}\n`;
        }

        const flow = siHuaMap[palace.heavenlyStem];
        if (flow) {
            txt += ` - 宫干飞化: ${palace.heavenlyStem}干 使${flow.禄}化禄、${flow.权}化权、${flow.科}化科、${flow.忌}化忌。\n`;
        }

        if (palace.decadal) {
            txt += ` - 大限: ${palace.decadal.range[0]}-${palace.decadal.range[1]}岁\n`;
        }
        
        txt += `\n`;
      });

      setResult(txt);
    } catch (e) {
      console.error(e);
      setResult("排盘计算出错，请检查输入时间。");
    }
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
                    onClick={generateReport}
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