export type Hua = '禄' | '权' | '科' | '忌';

export const ZW_SIHUA: Record<string, Record<Hua, string>> = {
  甲: { 禄: '廉贞', 权: '破军', 科: '武曲', 忌: '太阳' },
  乙: { 禄: '天机', 权: '天梁', 科: '紫微', 忌: '太阴' },
  丙: { 禄: '天同', 权: '天机', 科: '文昌', 忌: '廉贞' },
  丁: { 禄: '太阴', 权: '天同', 科: '天机', 忌: '巨门' },
  戊: { 禄: '贪狼', 权: '太阴', 科: '右弼', 忌: '天机' },
  己: { 禄: '武曲', 权: '贪狼', 科: '天梁', 忌: '文曲' },
  庚: { 禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同' },
  辛: { 禄: '巨门', 权: '太阳', 科: '文曲', 忌: '文昌' },
  壬: { 禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲' },
  癸: { 禄: '破军', 权: '巨门', 科: '太阴', 忌: '贪狼' },
};

const HUA_ORDER: Hua[] = ['禄', '权', '科', '忌'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const PALACE_ORDER = ['命', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

type LedgerContext = {
  astrolabe: any;
  caseId: string;
  gender: '男' | '女';
  birthDate: Date;
  lunarText: string;
  age: number;
  reportLunarYear: number;
  currentGanZhi: string;
  currentYearBranch: string;
  birthYearStem: string;
};

type LedgerResult = {
  markdown: string;
  status: 'PASS' | 'BLOCKED';
  fingerprint: string;
  issues: string[];
};

type PalaceRecord = {
  id: string;
  palace: any;
  name: string;
};

type SelfHuaRecord = {
  id: string;
  markerPalaceId: string;
  sourcePalaceId: string;
  targetPalaceId: string;
  hua: Hua;
  star: string;
  direction: '离心' | '向心';
  basisId: string;
};

function normalizePalaceName(name: string): string {
  const normalized = String(name || '').replace(/宫$/, '');
  return normalized === '交友' ? '仆役' : normalized;
}

function getOppositeBranch(branch: string): string {
  const index = BRANCHES.indexOf(branch);
  return index < 0 ? '' : BRANCHES[(index + 6) % 12];
}

function getAllStars(palace: any): any[] {
  return [
    ...(palace.majorStars || []),
    ...(palace.minorStars || []),
    ...(palace.adhocStars || []),
  ];
}

function getMarkedStars(palace: any): any[] {
  return [...(palace.majorStars || []), ...(palace.minorStars || [])];
}

function transformationForStar(stem: string, starName: string): Hua | undefined {
  const map = ZW_SIHUA[stem];
  if (!map) return undefined;
  return HUA_ORDER.find(hua => map[hua] === starName);
}

function textOrDash(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || '—';
}

function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRange(palace: any): string {
  const range = palace.decadal?.range;
  return Array.isArray(range) && range.length === 2 ? `${range[0]}-${range[1]}` : '—';
}

function formatStarBase(star: any): string {
  return `${star.name}${star.brightness ? `(${star.brightness})` : ''}`;
}

export function formatStarWithMarkers(astrolabe: any, palace: any, star: any): string {
  let text = formatStarBase(star);
  if (star.mutagen) text += `[生${star.mutagen}]`;

  const selfHua = transformationForStar(palace.heavenlyStem, star.name);
  if (selfHua) text += '[↓离]';

  const oppositeBranch = getOppositeBranch(palace.earthlyBranch);
  const oppositePalace = astrolabe.palaces.find((item: any) => item.earthlyBranch === oppositeBranch);
  if (oppositePalace && transformationForStar(oppositePalace.heavenlyStem, star.name)) {
    text += '[↑向]';
  }
  return text;
}

function formatStarList(astrolabe: any, palace: any, stars: any[]): string {
  return stars.length
    ? stars.map(star => formatStarWithMarkers(astrolabe, palace, star)).join('、')
    : '—';
}

function formatAdhocStars(palace: any): string {
  const stars = palace.adhocStars || [];
  return stars.length ? stars.map((star: any) => star.name).join('、') : '—';
}

function formatShensha(palace: any): string {
  const values = [
    palace.boshi12 || palace.doctor12,
    palace.jiangqian12,
    palace.suiqian12,
    palace.changsheng12 || palace.changsheng,
  ].filter(Boolean);
  return values.length ? values.join('、') : '—';
}

function formatFlags(palace: any, age: number, currentYearBranch: string): string {
  const flags: string[] = [];
  if (palace.isBodyPalace) flags.push('身宫');
  if (palace.isOriginalPalace) flags.push('来因宫');
  if (palace.decadal?.range && age >= palace.decadal.range[0] && age <= palace.decadal.range[1]) {
    flags.push('当前大限命宫');
  }
  if (palace.earthlyBranch === currentYearBranch) flags.push('当前流年命宫');
  return flags.length ? flags.join('、') : '—';
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function markdownTable(headers: string[], rows: string[][]): string {
  const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const header = `| ${headers.map(escape).join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.map(value => escape(String(value))).join(' | ')} |`).join('\n');
  return `${header}\n${divider}\n${body}`;
}

function sanitizeCaseId(caseId: string): string {
  const trimmed = caseId.trim();
  return trimmed || `CASE-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
}

export function generateLockedZiweiLedger(context: LedgerContext): LedgerResult {
  const {
    astrolabe,
    gender,
    birthDate,
    lunarText,
    age,
    reportLunarYear,
    currentGanZhi,
    currentYearBranch,
    birthYearStem,
  } = context;
  const caseId = sanitizeCaseId(context.caseId);
  const issues: string[] = [];

  const palaceByName = new Map<string, any>();
  for (const palace of astrolabe.palaces || []) {
    palaceByName.set(normalizePalaceName(palace.name), palace);
  }

  const palaceRecords: PalaceRecord[] = PALACE_ORDER.map((name, index) => ({
    id: `B${String(index + 1).padStart(2, '0')}`,
    palace: palaceByName.get(name),
    name,
  }));

  for (const record of palaceRecords) {
    if (!record.palace) issues.push(`缺少${record.name}宫`);
  }

  const validPalaceRecords = palaceRecords.filter(record => record.palace);
  const idByPalace = new Map<any, string>(validPalaceRecords.map(record => [record.palace, record.id]));
  const recordByBranch = new Map<string, PalaceRecord>(
    validPalaceRecords.map(record => [record.palace.earthlyBranch, record]),
  );
  const fIdByPalaceId = new Map<string, string>(
    validPalaceRecords.map((record, index) => [record.id, `F${String(index + 1).padStart(2, '0')}`]),
  );

  const findStarTarget = (starName: string): PalaceRecord | undefined => (
    validPalaceRecords.find(record => getAllStars(record.palace).some(star => star.name === starName))
  );

  const activeDasha = validPalaceRecords.filter(record => {
    const range = record.palace.decadal?.range;
    return Array.isArray(range) && age >= range[0] && age <= range[1];
  });
  const activeYear = validPalaceRecords.filter(record => record.palace.earthlyBranch === currentYearBranch);
  const bodyPalaces = validPalaceRecords.filter(record => record.palace.isBodyPalace);
  const originalPalaces = validPalaceRecords.filter(record => record.palace.isOriginalPalace);

  const metaRows = [
    ['M01', '案例编号', caseId],
    ['M02', '性别', gender],
    ['M03', '公历出生时间', formatDateTime(birthDate)],
    ['M04', '农历出生信息', lunarText],
    ['M05', '五行局', textOrDash(astrolabe.fiveElementsClass)],
    ['M06', '命主', textOrDash(astrolabe.soul)],
    ['M07', '身主', textOrDash(astrolabe.body)],
    ['M08', '报告基准', `农历${reportLunarYear}年，虚岁${age}`],
    ['M09', '生年天干', textOrDash(birthYearStem)],
    ['M10', '当前流年', currentGanZhi],
  ];

  const baseRows = validPalaceRecords.map(record => {
    const palace = record.palace;
    return [
      record.id,
      `${record.name}宫`,
      `${palace.heavenlyStem}${palace.earthlyBranch}`,
      formatStarList(astrolabe, palace, palace.majorStars || []),
      formatStarList(astrolabe, palace, palace.minorStars || []),
      formatAdhocStars(palace),
      formatShensha(palace),
      formatRange(palace),
      formatFlags(palace, age, currentYearBranch),
    ];
  });

  const flyRows = validPalaceRecords.map(record => {
    const map = ZW_SIHUA[record.palace.heavenlyStem];
    const flyId = fIdByPalaceId.get(record.id) || 'F??';
    if (!map) {
      issues.push(`${record.id}宫干${record.palace.heavenlyStem}没有四化映射`);
      return [flyId, record.id, record.palace.heavenlyStem, '—', '—', '—', '—'];
    }

    const paths = HUA_ORDER.map(hua => {
      const star = map[hua];
      const target = findStarTarget(star);
      if (!target) issues.push(`${flyId}${hua}星${star}未在十二宫找到落点`);
      return `${star}→${target?.id || '未落盘'}`;
    });
    return [flyId, record.id, record.palace.heavenlyStem, ...paths];
  });

  const selfHuaDrafts: Omit<SelfHuaRecord, 'id'>[] = [];
  for (const target of validPalaceRecords) {
    for (const star of getMarkedStars(target.palace)) {
      const selfHua = transformationForStar(target.palace.heavenlyStem, star.name);
      if (selfHua) {
        selfHuaDrafts.push({
          markerPalaceId: target.id,
          sourcePalaceId: target.id,
          targetPalaceId: target.id,
          hua: selfHua,
          star: star.name,
          direction: '离心',
          basisId: fIdByPalaceId.get(target.id) || 'F??',
        });
      }

      const opposite = recordByBranch.get(getOppositeBranch(target.palace.earthlyBranch));
      if (opposite) {
        const incomingHua = transformationForStar(opposite.palace.heavenlyStem, star.name);
        if (incomingHua) {
          selfHuaDrafts.push({
            markerPalaceId: target.id,
            sourcePalaceId: opposite.id,
            targetPalaceId: target.id,
            hua: incomingHua,
            star: star.name,
            direction: '向心',
            basisId: fIdByPalaceId.get(opposite.id) || 'F??',
          });
        }
      }
    }
  }

  const selfHuaRecords: SelfHuaRecord[] = selfHuaDrafts.map((record, index) => ({
    id: `S${String(index + 1).padStart(2, '0')}`,
    ...record,
  }));
  const selfHuaRows = selfHuaRecords.map(record => [
    record.id,
    record.markerPalaceId,
    record.sourcePalaceId,
    record.hua,
    record.star,
    record.direction,
    record.targetPalaceId,
    record.basisId,
  ]);

  const birthMap = ZW_SIHUA[birthYearStem];
  const birthRows = HUA_ORDER.map((hua, index) => {
    const expectedStar = birthMap?.[hua] || '未知';
    const target = findStarTarget(expectedStar);
    const actualTargets = validPalaceRecords.filter(record => (
      getMarkedStars(record.palace).some(star => star.name === expectedStar && star.mutagen === hua)
    ));
    if (!birthMap) issues.push(`生年天干${birthYearStem}没有四化映射`);
    if (!target) issues.push(`生年${hua}星${expectedStar}未在十二宫找到`);
    if (actualTargets.length !== 1 || actualTargets[0]?.id !== target?.id) {
      issues.push(`生年${hua}的静态四化与iztro标记不一致`);
    }
    return [`BS${String(index + 1).padStart(2, '0')}`, hua, expectedStar, target?.id || '未落盘'];
  });

  const renderLayer = (id: string, layer: string, sourceId: string, stem: string): string[] => {
    const map = ZW_SIHUA[stem];
    if (!map) {
      issues.push(`${layer}天干${stem}没有四化映射`);
      return [id, layer, sourceId, stem, '—', '—', '—', '—'];
    }
    const paths = HUA_ORDER.map(hua => {
      const star = map[hua];
      return `${star}→${findStarTarget(star)?.id || '未落盘'}`;
    });
    return [id, layer, sourceId, stem, ...paths];
  };

  const dashaRecord = activeDasha[0];
  const yearRecord = activeYear[0];
  const layerRows = [
    renderLayer('D01', '生年四化', '生年天干', birthYearStem),
    renderLayer('D02', '当前大限四化', dashaRecord?.id || '未定位', dashaRecord?.palace.heavenlyStem || ''),
    renderLayer('D03', '当前流年四化', yearRecord?.id || '未定位', yearRecord?.palace.heavenlyStem || ''),
  ];

  const checkRows: string[][] = [];
  validPalaceRecords.forEach((record, index) => {
    const palace = record.palace;
    const flyRow = flyRows[index];
    const ok = Boolean(
      palace.heavenlyStem
      && palace.earthlyBranch
      && Array.isArray(palace.decadal?.range)
      && flyRow?.[1] === record.id,
    );
    if (!ok) issues.push(`${record.id}基础字段或飞化引用不完整`);
    checkRows.push([
      `Y${String(checkRows.length + 1).padStart(2, '0')}`,
      `${record.id}宫位、干支、星曜、大限与F表起点`,
      `${record.id}/${flyRow?.[0] || '无'}`,
      ok ? 'PASS' : 'FAIL',
    ]);
  });

  birthRows.forEach(row => {
    const hua = row[1] as Hua;
    const expectedStar = birthMap?.[hua];
    const target = expectedStar ? findStarTarget(expectedStar) : undefined;
    const actualMatches = target
      ? getMarkedStars(target.palace).filter(star => star.name === expectedStar && star.mutagen === hua)
      : [];
    const ok = Boolean(target && actualMatches.length === 1);
    checkRows.push([
      `Y${String(checkRows.length + 1).padStart(2, '0')}`,
      `${row[0]}生年${hua}与iztro原始标记`,
      `${row[0]}/${row[3]}`,
      ok ? 'PASS' : 'FAIL',
    ]);
  });

  selfHuaRecords.forEach(record => {
    const source = validPalaceRecords.find(item => item.id === record.sourcePalaceId);
    const target = validPalaceRecords.find(item => item.id === record.targetPalaceId);
    const mappedHua = source ? transformationForStar(source.palace.heavenlyStem, record.star) : undefined;
    const branchesOpposite = source && target
      ? getOppositeBranch(source.palace.earthlyBranch) === target.palace.earthlyBranch
      : false;
    const ok = Boolean(
      source
      && target
      && mappedHua === record.hua
      && (
        (record.direction === '离心' && source.id === target.id)
        || (record.direction === '向心' && branchesOpposite)
      ),
    );
    if (!ok) issues.push(`${record.id}自化/向心映射校验失败`);
    checkRows.push([
      `Y${String(checkRows.length + 1).padStart(2, '0')}`,
      `${record.id}${record.direction}${record.hua}${record.star}`,
      `${record.basisId}/${record.sourcePalaceId}→${record.targetPalaceId}`,
      ok ? 'PASS' : 'FAIL',
    ]);
  });

  [
    ['身宫', bodyPalaces],
    ['来因宫', originalPalaces],
    ['当前大限命宫', activeDasha],
    ['当前流年命宫', activeYear],
  ].forEach(([label, records]) => {
    const typedRecords = records as PalaceRecord[];
    const ok = typedRecords.length === 1;
    if (!ok) issues.push(`${label}数量为${typedRecords.length}，应为1`);
    checkRows.push([
      `Y${String(checkRows.length + 1).padStart(2, '0')}`,
      `${label}唯一性`,
      typedRecords.map(record => record.id).join('、') || '未定位',
      ok ? 'PASS' : 'FAIL',
    ]);
  });

  const canonicalFacts = JSON.stringify({
    metaRows,
    baseRows,
    flyRows,
    selfHuaRows,
    birthRows,
    layerRows,
  });
  const fingerprint = fnv1a(canonicalFacts);
  const status: LedgerResult['status'] = issues.length ? 'BLOCKED' : 'PASS';
  const statusText = status === 'PASS' ? 'PASS，可作为NotebookLM锁定事实来源' : 'BLOCKED，不得进入论命';

  const sections = [
    `# [LOCKED] ${caseId} 紫微斗数盘面事实台账`,
    '',
    `> 生成器：iZiwei Deterministic Ledger v1`,
    `> 校验状态：${statusText}`,
    `> 盘面指纹：${fingerprint}`,
    `> 本文件只记录排盘事实，不包含性格、吉凶、事件或现实解释。`,
    '',
    '## M. 案例与时空元数据',
    '',
    markdownTable(['编号', '字段', '值'], metaRows),
    '',
    '## B. 十二宫基础事实（唯一盘面事实源）',
    '',
    markdownTable(
      ['编号', '宫位', '干支', '主星及原始标记', '辅星及原始标记', '杂曜', '神煞', '大限年龄', '命身来因及限运标记'],
      baseRows,
    ),
    '',
    '## BS. 生年四化事实',
    '',
    markdownTable(['编号', '四化', '星曜', '落宫编号'], birthRows),
    '',
    '## F. 十二宫宫干飞化',
    '',
    markdownTable(['编号', '起点宫', '宫干', '禄', '权', '科', '忌'], flyRows),
    '',
    '## S. 离心与向心飞化事实',
    '',
    markdownTable(['编号', '原始标记所在宫', '起点宫', '四化', '星曜', '方向', '落点宫', '依据'], selfHuaRows),
    '',
    '## D. 生年、当前大限与当前流年分层',
    '',
    markdownTable(['编号', '层级', '起点', '天干', '禄', '权', '科', '忌'], layerRows),
    '',
    '## Y. 自动一致性校验',
    '',
    markdownTable(['编号', '检查项', '引用', '结果'], checkRows),
    '',
    '## 生成结果',
    '',
    `- 校验状态：${status}`,
    `- 十二宫：${validPalaceRecords.length}/12`,
    `- 宫干飞化：${flyRows.length}/12`,
    `- 生年四化：${birthRows.length}/4`,
    `- 离心与向心飞化：${selfHuaRows.length}项`,
    `- 自动核验：${checkRows.filter(row => row[3] === 'PASS').length}/${checkRows.length}通过`,
    `- 盘面指纹：${fingerprint}`,
    issues.length ? `- 阻断原因：${issues.join('；')}` : '- 阻断原因：无',
    '',
    '> NotebookLM使用规则：本文件负责盘面事实；课程来源只负责解释论法，不得修改本文件中的编号与字段。',
  ];

  return {
    markdown: sections.join('\n'),
    status,
    fingerprint,
    issues,
  };
}
