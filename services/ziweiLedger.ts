import { Lunar } from 'lunar-javascript';

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
const HUA_CODE: Record<Hua, string> = { 禄: 'L', 权: 'Q', 科: 'K', 忌: 'J' };
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const PALACE_ORDER = ['命', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

type LedgerContext = {
  astrolabe: any;
  caseId: string;
  gender: '男' | '女';
  birthDate: Date;
  reportDate: Date;
  lunarText: string;
};

export type LedgerResult = {
  markdown: string;
  notebookFacts: string;
  factCount: number;
  status: 'PASS' | 'BLOCKED';
  fingerprint: string;
  issues: string[];
};

type CanonicalFactRecord = {
  id: string;
  type: string;
  fields: Record<string, string>;
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

type TransformPath = {
  hua: Hua;
  star: string;
  targetId: string;
};

type TransformLayerRecord = {
  id: string;
  layer: string;
  sourceId: string;
  stem: string;
  paths: TransformPath[];
};

type DecadalLedgerGroup = {
  id: string;
  phase: '已历' | '当前' | '下一限';
  range: [number, number];
  natalRecord: PalaceRecord;
  scope: any;
  representativeDate: Date;
  representativeAge: number;
  layerRecord: TransformLayerRecord;
  layerRow: string[];
  palaceRows: string[][];
};

function normalizePalaceName(name: string): string {
  const normalized = String(name || '').replace(/宫$/, '');
  return normalized === '交友' ? '仆役' : normalized;
}

function getOppositeBranch(branch: string): string {
  const index = BRANCHES.indexOf(branch);
  return index < 0 ? '' : BRANCHES[(index + 6) % 12];
}

function getTrineBranches(branch: string): string[] {
  const index = BRANCHES.indexOf(branch);
  return index < 0 ? [] : [BRANCHES[(index + 4) % 12], BRANCHES[(index + 8) % 12]];
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

function sanitizeFactValue(value: unknown): string {
  return textOrDash(value).replace(/[|\r\n]+/g, '／');
}

function renderFactLine(record: CanonicalFactRecord, caseId: string, fingerprint: string): string {
  const fields = {
    TYPE: record.type,
    CASE: caseId,
    FP: fingerprint,
    ...record.fields,
  };
  return [
    'FACT',
    record.id,
    ...Object.entries(fields).map(([key, value]) => `${key}=${sanitizeFactValue(value)}`),
  ].join('|');
}

function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function representativeDateForNominalAge(birthLunarYear: number, nominalAge: number): Date {
  const solar = Lunar.fromYmd(birthLunarYear + nominalAge - 1, 6, 1).getSolar();
  return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), 12, 0, 0);
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
  const values = getShenshaEntries(palace).map(entry => entry.name);
  return values.length ? values.join('、') : '—';
}

function getShenshaEntries(palace: any): { category: string; name: string }[] {
  return [
    { category: '博士十二神', name: palace.boshi12 || palace.doctor12 },
    { category: '将前十二神', name: palace.jiangqian12 },
    { category: '岁前十二神', name: palace.suiqian12 },
    { category: '长生十二神', name: palace.changsheng12 || palace.changsheng },
  ].filter(entry => Boolean(entry.name));
}

function formatFlags(palace: any, age: number, reportYearBranch: string): string {
  const flags: string[] = [];
  if (palace.isBodyPalace) flags.push('身宫');
  if (palace.isOriginalPalace) flags.push('来因宫');
  if (palace.decadal?.range && age >= palace.decadal.range[0] && age <= palace.decadal.range[1]) {
    flags.push('报告日期所在大限命宫');
  }
  if (palace.earthlyBranch === reportYearBranch) flags.push('报告流年命宫');
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
    reportDate,
    lunarText,
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

  const birthLunar = Lunar.fromDate(birthDate);
  const reportLunar = Lunar.fromDate(reportDate);
  const birthYearStem = textOrDash(birthLunar.getYearGan());
  const reportLunarYear = reportLunar.getYear();
  const age = reportLunarYear - birthLunar.getYear() + 1;
  const normalizedCurrentGanZhi = reportLunar.getYearInGanZhi();
  const currentYearBranch = reportLunar.getYearZhi();
  const reportYearStem = normalizedCurrentGanZhi.charAt(0);
  const reportYearBranch = normalizedCurrentGanZhi.charAt(1);

  const activeDasha = validPalaceRecords.filter(record => {
    const range = record.palace.decadal?.range;
    return Array.isArray(range) && age >= range[0] && age <= range[1];
  });
  const activeYear = validPalaceRecords.filter(record => record.palace.earthlyBranch === currentYearBranch);
  const bodyPalaces = validPalaceRecords.filter(record => record.palace.isBodyPalace);
  const originalPalaces = validPalaceRecords.filter(record => record.palace.isOriginalPalace);

  let horoscopeScope: any;
  let yearlyScope: any;
  let decadalScope: any;
  try {
    horoscopeScope = astrolabe.horoscope(reportDate);
    yearlyScope = horoscopeScope.yearly;
    decadalScope = horoscopeScope.decadal;
  } catch (error) {
    issues.push(`无法取得报告年份运限数据：${error instanceof Error ? error.message : String(error)}`);
  }

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
    ['M10', '报告流年', normalizedCurrentGanZhi],
    ['M11', '报告日期', formatDate(reportDate)],
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

  let atomicItemIndex = 0;
  const atomicItemRows = validPalaceRecords.flatMap(record => {
    const palace = record.palace;
    const opposite = recordByBranch.get(getOppositeBranch(palace.earthlyBranch));
    const starEntries = [
      ...(palace.majorStars || []).map((star: any) => ({ category: '主星', star, marked: true })),
      ...(palace.minorStars || []).map((star: any) => ({ category: '辅星', star, marked: true })),
      ...(palace.adhocStars || []).map((star: any) => ({ category: '杂曜', star, marked: false })),
    ].map(entry => {
      atomicItemIndex += 1;
      const selfHua = entry.marked
        ? transformationForStar(palace.heavenlyStem, entry.star.name)
        : undefined;
      const incomingHua = entry.marked && opposite
        ? transformationForStar(opposite.palace.heavenlyStem, entry.star.name)
        : undefined;
      return [
        `Z${String(atomicItemIndex).padStart(3, '0')}`,
        record.id,
        `${record.name}宫`,
        entry.category,
        entry.star.name,
        textOrDash(entry.star.brightness),
        textOrDash(entry.star.mutagen),
        selfHua || '—',
        incomingHua || '—',
      ];
    });
    const shenshaEntries = getShenshaEntries(palace).map(entry => {
      atomicItemIndex += 1;
      return [
        `Z${String(atomicItemIndex).padStart(3, '0')}`,
        record.id,
        `${record.name}宫`,
        entry.category,
        entry.name,
        '—',
        '—',
        '—',
        '—',
      ];
    });
    return [...starEntries, ...shenshaEntries];
  });

  const relationRows = validPalaceRecords.map((record, index) => {
    const opposite = recordByBranch.get(getOppositeBranch(record.palace.earthlyBranch));
    const trines = getTrineBranches(record.palace.earthlyBranch)
      .map(branch => recordByBranch.get(branch))
      .filter((item): item is PalaceRecord => Boolean(item));
    return [
      `R${String(index + 1).padStart(2, '0')}`,
      record.id,
      `${record.name}宫`,
      record.palace.earthlyBranch,
      opposite?.id || '未定位',
      trines[0]?.id || '未定位',
      trines[1]?.id || '未定位',
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

  const flyAtomicRows = validPalaceRecords.flatMap(record => {
    const map = ZW_SIHUA[record.palace.heavenlyStem];
    const flyId = fIdByPalaceId.get(record.id) || 'F??';
    return HUA_ORDER.map(hua => {
      const star = map?.[hua] || '未知';
      const target = map ? findStarTarget(star) : undefined;
      return [
        `${flyId}-${HUA_CODE[hua]}`,
        flyId,
        '本命宫干飞化',
        record.id,
        record.palace.heavenlyStem,
        hua,
        star,
        target?.id || '未落盘',
      ];
    });
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

  const buildTransformLayer = (
    id: string,
    layer: string,
    sourceId: string,
    stem: string,
  ): TransformLayerRecord => {
    const map = ZW_SIHUA[stem];
    if (!map) {
      issues.push(`${layer}天干${stem}没有四化映射`);
      return {
        id,
        layer,
        sourceId,
        stem,
        paths: HUA_ORDER.map(hua => ({ hua, star: '未知', targetId: '未落盘' })),
      };
    }
    const paths: TransformPath[] = HUA_ORDER.map(hua => {
      const star = map[hua];
      const target = findStarTarget(star);
      if (!target) issues.push(`${layer}${hua}星${star}未在十二宫找到落点`);
      return { hua, star, targetId: target?.id || '未落盘' };
    });
    return { id, layer, sourceId, stem, paths };
  };

  const transformLayerToRow = (record: TransformLayerRecord): string[] => [
    record.id,
    record.layer,
    record.sourceId,
    record.stem,
    ...record.paths.map(path => `${path.star}→${path.targetId}`),
  ];

  const dashaRecord = activeDasha[0];
  const yearRecord = activeYear[0];
  const layerRecords = [
    buildTransformLayer('D01', '生年四化', '生年天干', birthYearStem),
    buildTransformLayer('D02', '报告日期所在大限四化', dashaRecord?.id || '未定位', dashaRecord?.palace.heavenlyStem || ''),
    buildTransformLayer('D03', '报告流年四化', 'M10', reportYearStem),
  ];
  const layerRows = layerRecords.map(transformLayerToRow);

  const chronologicalDashaRecords = validPalaceRecords
    .filter(record => Array.isArray(record.palace.decadal?.range) && record.palace.decadal.range.length === 2)
    .sort((left, right) => left.palace.decadal.range[0] - right.palace.decadal.range[0]);
  const activeDashaChronologicalIndex = chronologicalDashaRecords.findIndex(record => record.id === dashaRecord?.id);
  const selectedDashaRecords = activeDashaChronologicalIndex >= 0
    ? chronologicalDashaRecords.slice(0, Math.min(activeDashaChronologicalIndex + 2, chronologicalDashaRecords.length))
    : [];

  const decadalGroups: DecadalLedgerGroup[] = selectedDashaRecords.map((natalRecord, index) => {
    const id = `DA${String(index + 1).padStart(2, '0')}`;
    const range = natalRecord.palace.decadal.range as [number, number];
    const representativeDate = representativeDateForNominalAge(birthLunar.getYear(), range[0]);
    let scope: any;
    let representativeAge = Number.NaN;
    try {
      const representativeHoroscope = astrolabe.horoscope(representativeDate);
      scope = representativeHoroscope.decadal;
      representativeAge = representativeHoroscope.age?.nominalAge;
    } catch (error) {
      issues.push(`${id}无法取得大限数据：${error instanceof Error ? error.message : String(error)}`);
    }

    const phase: DecadalLedgerGroup['phase'] = index < activeDashaChronologicalIndex
      ? '已历'
      : index === activeDashaChronologicalIndex ? '当前' : '下一限';
    const scopePalaceNames = Array.isArray(scope?.palaceNames)
      ? scope.palaceNames.map((name: string) => normalizePalaceName(name))
      : [];
    const palaceRows = PALACE_ORDER.map((name, palaceOrderIndex) => {
      const palaceIndex = scopePalaceNames.indexOf(name);
      const palace = palaceIndex >= 0 ? astrolabe.palaces?.[palaceIndex] : undefined;
      const record = palace
        ? validPalaceRecords.find(item => item.palace === palace || item.palace.index === palace.index)
        : undefined;
      if (!record) issues.push(`${id}-L${String(palaceOrderIndex + 1).padStart(2, '0')}大限${name}宫未定位`);
      return [
        `${id}-L${String(palaceOrderIndex + 1).padStart(2, '0')}`,
        `大限${name}宫`,
        record?.id || '未定位',
        record ? `${record.name}宫` : '—',
        record ? `${record.palace.heavenlyStem}${record.palace.earthlyBranch}` : '—',
      ];
    });

    const layerRecord = buildTransformLayer(
      id,
      `${range[0]}-${range[1]}岁大限四化`,
      natalRecord.id,
      scope?.heavenlyStem || '',
    );

    return {
      id,
      phase,
      range,
      natalRecord,
      scope,
      representativeDate,
      representativeAge,
      layerRecord,
      layerRow: transformLayerToRow(layerRecord),
      palaceRows,
    };
  });

  const decadalSummaryRows = decadalGroups.map(group => [
    group.id,
    group.phase,
    `${group.range[0]}-${group.range[1]}`,
    group.natalRecord.id,
    `${group.natalRecord.name}宫`,
    `${group.scope?.heavenlyStem || '—'}${group.scope?.earthlyBranch || '—'}`,
    ...group.layerRow.slice(4),
  ]);
  const decadalPalaceRows = decadalGroups.flatMap(group => group.palaceRows);
  const renderAtomicLayerRows = (record: TransformLayerRecord): string[][] => record.paths.map(path => [
    `${record.id}-${HUA_CODE[path.hua]}`,
    record.id,
    record.layer,
    record.sourceId,
    record.stem,
    path.hua,
    path.star,
    path.targetId,
  ]);
  const layerAtomicRows = layerRecords.flatMap(renderAtomicLayerRows);
  const decadalAtomicRows = decadalGroups.flatMap(group => renderAtomicLayerRows(group.layerRecord));
  const atomicTransformRows = [...flyAtomicRows, ...layerAtomicRows, ...decadalAtomicRows];

  const yearlyPalaceNames = Array.isArray(yearlyScope?.palaceNames)
    ? yearlyScope.palaceNames.map((name: string) => normalizePalaceName(name))
    : [];
  const yearRows = PALACE_ORDER.map((name, index) => {
    const palaceIndex = yearlyPalaceNames.indexOf(name);
    const palace = palaceIndex >= 0 ? astrolabe.palaces?.[palaceIndex] : undefined;
    const record = palace
      ? validPalaceRecords.find(item => item.palace === palace || item.palace.index === palace.index)
      : undefined;
    if (!record) issues.push(`LY${String(index + 1).padStart(2, '0')}流年${name}宫未定位`);
    return [
      `LY${String(index + 1).padStart(2, '0')}`,
      `流年${name}宫`,
      record?.id || '未定位',
      record ? `${record.name}宫` : '—',
      record ? `${record.palace.heavenlyStem}${record.palace.earthlyBranch}` : '—',
    ];
  });

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

  const expectedAtomicItemCount = validPalaceRecords.reduce((total, record) => (
    total
    + (record.palace.majorStars || []).length
    + (record.palace.minorStars || []).length
    + (record.palace.adhocStars || []).length
    + getShenshaEntries(record.palace).length
  ), 0);
  const atomicItemsOk = Boolean(
    atomicItemRows.length === expectedAtomicItemCount
    && new Set(atomicItemRows.map(row => row[0])).size === atomicItemRows.length
    && atomicItemRows.every(row => /^Z\d{3}$/.test(row[0]) && /^B\d{2}$/.test(row[1]) && row[4] && row[4] !== '—'),
  );
  if (!atomicItemsOk) issues.push('Z星曜与神煞原子事实不完整、编号重复或宫位引用异常');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'Z星曜与神煞原子事实完整性',
    `${atomicItemRows.length}/${expectedAtomicItemCount}`,
    atomicItemsOk ? 'PASS' : 'FAIL',
  ]);

  const relationsOk = Boolean(
    relationRows.length === 12
    && new Set(relationRows.map(row => row[0])).size === 12
    && relationRows.every(row => {
      const source = validPalaceRecords.find(record => record.id === row[1]);
      const opposite = validPalaceRecords.find(record => record.id === row[4]);
      const trines = row.slice(5, 7).map(id => validPalaceRecords.find(record => record.id === id));
      return Boolean(
        source
        && opposite
        && getOppositeBranch(source.palace.earthlyBranch) === opposite.palace.earthlyBranch
        && getOppositeBranch(opposite.palace.earthlyBranch) === source.palace.earthlyBranch
        && trines.every(Boolean)
        && trines.map(record => record?.palace.earthlyBranch).every(branch => getTrineBranches(source.palace.earthlyBranch).includes(branch || ''))
      );
    }),
  );
  if (!relationsOk) issues.push('R宫位对宫与三合关系不完整、不唯一或不对称');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'R宫位对宫与三合关系完整性',
    `${relationRows.length}/12`,
    relationsOk ? 'PASS' : 'FAIL',
  ]);

  const expectedAtomicTransformCount = (flyRows.length + layerRows.length + decadalGroups.length) * 4;
  const atomicTransformsOk = Boolean(
    atomicTransformRows.length === expectedAtomicTransformCount
    && new Set(atomicTransformRows.map(row => row[0])).size === atomicTransformRows.length
    && atomicTransformRows.every(row => {
      const stem = row[4];
      const hua = row[5] as Hua;
      const expectedStar = ZW_SIHUA[stem]?.[hua];
      const expectedTarget = expectedStar ? findStarTarget(expectedStar)?.id : undefined;
      return Boolean(
        HUA_ORDER.includes(hua)
        && expectedStar
        && row[6] === expectedStar
        && expectedTarget
        && row[7] === expectedTarget
      );
    }),
  );
  if (!atomicTransformsOk) issues.push('四化原子事实不完整、编号重复或星曜落点与四化映射不一致');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    '四化原子事实完整性与唯一性',
    `${atomicTransformRows.length}/${expectedAtomicTransformCount}`,
    atomicTransformsOk ? 'PASS' : 'FAIL',
  ]);

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
    ['报告日期所在大限命宫', activeDasha],
    ['报告流年命宫', activeYear],
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

  const dContractOk = Boolean(
    layerRows[0]?.[0] === 'D01' && layerRows[0]?.[1] === '生年四化'
    && layerRows[1]?.[0] === 'D02' && layerRows[1]?.[1] === '报告日期所在大限四化'
    && layerRows[2]?.[0] === 'D03' && layerRows[2]?.[1] === '报告流年四化',
  );
  if (!dContractOk) issues.push('D01-D03层级编号契约不一致');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'D01-D03层级编号契约',
    'D01生年/D02大限/D03流年',
    dContractOk ? 'PASS' : 'FAIL',
  ]);

  const dashaScopePalace = Number.isInteger(decadalScope?.index) && decadalScope.index >= 0
    ? astrolabe.palaces?.[decadalScope.index]
    : undefined;
  const dashaScopeRecord = dashaScopePalace
    ? validPalaceRecords.find(record => (
      record.palace === dashaScopePalace || record.palace.index === dashaScopePalace.index
    ))
    : undefined;
  const d02ScopeOk = Boolean(
    activeDasha.length === 1
    && dashaRecord
    && dashaScopeRecord?.id === dashaRecord.id
    && decadalScope?.heavenlyStem === dashaRecord.palace.heavenlyStem
    && decadalScope?.earthlyBranch === dashaRecord.palace.earthlyBranch
    && layerRows[1]?.[2] === dashaRecord.id
    && layerRows[1]?.[3] === decadalScope.heavenlyStem,
  );
  if (!d02ScopeOk) {
    issues.push(`D02与iztro报告日期所在大限不一致：年龄定位=${dashaRecord?.id || '未定位'}，iztro=${dashaScopeRecord?.id || decadalScope?.name || '未定位'}`);
  }
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'M08虚岁、D02与iztro报告日期所在大限一致性',
    `M08/D02/iztro.decadal`,
    d02ScopeOk ? 'PASS' : 'FAIL',
  ]);

  const reportBaselineOk = Boolean(
    horoscopeScope
    && horoscopeScope.age?.nominalAge === age
    && String(horoscopeScope.solarDate || '') === `${reportDate.getFullYear()}-${reportDate.getMonth() + 1}-${reportDate.getDate()}`,
  );
  if (!reportBaselineOk) {
    issues.push(`M08与报告日期不一致：M08=农历${reportLunarYear}年/虚岁${age}，iztro虚岁=${horoscopeScope?.age?.nominalAge ?? '缺失'}`);
  }
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'M08报告年份、虚岁与M11报告日期一致性',
    'M08/M11/iztro.age',
    reportBaselineOk ? 'PASS' : 'FAIL',
  ]);

  const yearStemBranchOk = Boolean(
    ZW_SIHUA[reportYearStem]
    && BRANCHES.includes(reportYearBranch)
    && currentYearBranch === reportYearBranch
    && yearlyScope?.heavenlyStem === reportYearStem
    && yearlyScope?.earthlyBranch === reportYearBranch,
  );
  if (!yearStemBranchOk) {
    issues.push(`报告年份干支不一致：M10=${normalizedCurrentGanZhi}，流年命宫地支=${currentYearBranch || '缺失'}，iztro=${yearlyScope ? `${yearlyScope.heavenlyStem}${yearlyScope.earthlyBranch}` : '缺失'}`);
  }
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    '报告年份干支与流年数据一致性',
    'M10/D03/iztro.yearly',
    yearStemBranchOk ? 'PASS' : 'FAIL',
  ]);

  const expectedYearMap = ZW_SIHUA[reportYearStem];
  const expectedYearPaths = expectedYearMap
    ? HUA_ORDER.map(hua => `${expectedYearMap[hua]}→${findStarTarget(expectedYearMap[hua])?.id || '未落盘'}`)
    : [];
  const d03MapOk = Boolean(
    expectedYearMap
    && layerRows[2]?.[2] === 'M10'
    && layerRows[2]?.[3] === reportYearStem
    && expectedYearPaths.every((path, index) => layerRows[2]?.[index + 4] === path),
  );
  if (!d03MapOk) issues.push(`D03未按M10天干${reportYearStem || '缺失'}生成四化`);
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'D03流年四化与M10天干映射',
    'M10/D03',
    d03MapOk ? 'PASS' : 'FAIL',
  ]);

  const yearTargetIds = yearRows.map(row => row[2]);
  const lyCompleteOk = Boolean(
    yearRows.length === 12
    && yearlyPalaceNames.length === 12
    && new Set(yearlyPalaceNames).size === 12
    && PALACE_ORDER.every(name => yearlyPalaceNames.includes(name))
    && yearTargetIds.every(id => /^B\d{2}$/.test(id))
    && new Set(yearTargetIds).size === 12,
  );
  if (!lyCompleteOk) issues.push('LY01-LY12流年十二宫叠宫不完整或落点不唯一');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'LY01-LY12流年十二宫完整性与唯一性',
    yearTargetIds.join('、') || '未定位',
    lyCompleteOk ? 'PASS' : 'FAIL',
  ]);

  const ly01Ok = Boolean(yearRows[0]?.[2] && yearRows[0][2] === yearRecord?.id);
  if (!ly01Ok) issues.push(`LY01与报告流年命宫不一致：LY01=${yearRows[0]?.[2] || '未定位'}，标记=${yearRecord?.id || '未定位'}`);
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'LY01与报告流年命宫标记一致性',
    `LY01/${yearRecord?.id || '未定位'}`,
    ly01Ok ? 'PASS' : 'FAIL',
  ]);

  const currentDecadalGroups = decadalGroups.filter(group => group.phase === '当前');
  const nextDecadalGroups = decadalGroups.filter(group => group.phase === '下一限');
  const decadalSequenceOk = Boolean(
    decadalGroups.length >= 1
    && currentDecadalGroups.length === 1
    && nextDecadalGroups.length <= 1
    && decadalGroups.every((group, index) => (
      group.id === `DA${String(index + 1).padStart(2, '0')}`
      && (index === 0 || group.range[0] === decadalGroups[index - 1].range[1] + 1)
      && group.range[1] === group.range[0] + 9
    )),
  );
  if (!decadalSequenceOk) issues.push('DA大限事实组顺序、年龄范围或当前/下一限标记异常');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'DA大限事实组顺序、年龄范围与阶段唯一性',
    decadalGroups.map(group => `${group.id}:${group.phase}:${group.range[0]}-${group.range[1]}`).join('、') || '未生成',
    decadalSequenceOk ? 'PASS' : 'FAIL',
  ]);

  const decadalPalacesOk = Boolean(
    decadalGroups.length >= 1
    && decadalGroups.every(group => {
      const targetIds = group.palaceRows.map(row => row[2]);
      return group.palaceRows.length === 12
        && targetIds.every(id => /^B\d{2}$/.test(id))
        && new Set(targetIds).size === 12
        && group.palaceRows[0]?.[2] === group.natalRecord.id;
    }),
  );
  if (!decadalPalacesOk) issues.push('DA各限L01-L12叠宫不完整、落点不唯一或L01与大限命宫不一致');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'DA各限L01-L12完整性、唯一性与大限命宫一致性',
    decadalGroups.map(group => `${group.id}-L01:${group.palaceRows[0]?.[2] || '未定位'}`).join('、') || '未生成',
    decadalPalacesOk ? 'PASS' : 'FAIL',
  ]);

  const decadalTransformsOk = Boolean(
    decadalGroups.length >= 1
    && decadalGroups.every(group => {
      const expectedMap = ZW_SIHUA[group.natalRecord.palace.heavenlyStem];
      const expectedPaths = expectedMap
        ? HUA_ORDER.map(hua => `${expectedMap[hua]}→${findStarTarget(expectedMap[hua])?.id || '未落盘'}`)
        : [];
      return Boolean(
        expectedMap
        && group.scope?.index === group.natalRecord.palace.index
        && group.scope?.heavenlyStem === group.natalRecord.palace.heavenlyStem
        && group.scope?.earthlyBranch === group.natalRecord.palace.earthlyBranch
        && group.representativeAge === group.range[0]
        && HUA_ORDER.every((hua, index) => group.scope?.mutagen?.[index] === expectedMap[hua])
        && expectedPaths.every((path, index) => group.layerRow[index + 4] === path)
      );
    }),
  );
  if (!decadalTransformsOk) issues.push('DA大限命宫、干支、四化或代表日期与iztro不一致');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    'DA各限命宫、干支、四化与iztro一致性',
    decadalGroups.map(group => `${group.id}/${group.natalRecord.id}/${formatDate(group.representativeDate)}`).join('、') || '未生成',
    decadalTransformsOk ? 'PASS' : 'FAIL',
  ]);

  const currentDecadalGroup = currentDecadalGroups[0];
  const currentDecadalMatchesD02 = Boolean(
    currentDecadalGroup
    && currentDecadalGroup.natalRecord.id === dashaRecord?.id
    && currentDecadalGroup.scope?.heavenlyStem === layerRows[1]?.[3]
    && HUA_ORDER.every((_, index) => currentDecadalGroup.layerRow[index + 4] === layerRows[1]?.[index + 4]),
  );
  if (!currentDecadalMatchesD02) issues.push('当前DA事实组与D02摘要不一致');
  checkRows.push([
    `Y${String(checkRows.length + 1).padStart(2, '0')}`,
    '当前DA事实组与D02摘要一致性',
    `${currentDecadalGroup?.id || '未定位'}/D02`,
    currentDecadalMatchesD02 ? 'PASS' : 'FAIL',
  ]);

  const canonicalFacts = JSON.stringify({
    metaRows,
    baseRows,
    atomicItemRows,
    relationRows,
    flyRows,
    atomicTransformRows,
    selfHuaRows,
    birthRows,
    layerRows,
    decadalSummaryRows,
    decadalPalaceRows,
    yearRows,
  });
  const fingerprint = fnv1a(canonicalFacts);
  const status: LedgerResult['status'] = issues.length ? 'BLOCKED' : 'PASS';
  const statusText = status === 'PASS' ? 'PASS，可作为NotebookLM锁定事实来源' : 'BLOCKED，不得进入论命';

  const factRecords: CanonicalFactRecord[] = [
    ...metaRows.map(row => ({
      id: row[0],
      type: 'META',
      fields: { FIELD: row[1], VALUE: row[2] },
    })),
    ...baseRows.map(row => ({
      id: row[0],
      type: 'PALACE',
      fields: {
        PALACE_NAME: row[1],
        STEM_BRANCH: row[2],
        DECADA_RANGE: row[7],
        FLAGS: row[8],
      },
    })),
    ...atomicItemRows.map(row => ({
      id: row[0],
      type: 'ITEM',
      fields: {
        PALACE: row[1],
        PALACE_NAME: row[2],
        CATEGORY: row[3],
        NAME: row[4],
        BRIGHTNESS: row[5],
        BIRTH_HUA: row[6],
        SELF_HUA: row[7],
        INCOMING_HUA: row[8],
      },
    })),
    ...relationRows.map(row => ({
      id: row[0],
      type: 'RELATION',
      fields: {
        SELF: row[1],
        PALACE_NAME: row[2],
        BRANCH: row[3],
        OPPOSITE: row[4],
        TRINE_1: row[5],
        TRINE_2: row[6],
      },
    })),
    ...birthRows.map(row => ({
      id: row[0],
      type: 'BIRTH_HUA',
      fields: { HUA: row[1], STAR: row[2], TARGET: row[3] },
    })),
    ...atomicTransformRows.map(row => ({
      id: row[0],
      type: 'TRANSFORM',
      fields: {
        PARENT: row[1],
        LAYER: row[2],
        SOURCE: row[3],
        SOURCE_STEM: row[4],
        HUA: row[5],
        STAR: row[6],
        TARGET: row[7],
      },
    })),
    ...selfHuaRows.map(row => ({
      id: row[0],
      type: 'SELF_HUA',
      fields: {
        MARKER_PALACE: row[1],
        SOURCE: row[2],
        HUA: row[3],
        STAR: row[4],
        DIRECTION: row[5],
        TARGET: row[6],
        BASIS: row[7],
      },
    })),
    ...layerRows.map(row => ({
      id: row[0],
      type: 'LAYER',
      fields: {
        LAYER: row[1],
        SOURCE: row[2],
        SOURCE_STEM: row[3],
        ATOMS: HUA_ORDER.map(hua => `${row[0]}-${HUA_CODE[hua]}`).join(','),
      },
    })),
    ...decadalSummaryRows.map(row => ({
      id: row[0],
      type: 'DECADA',
      fields: {
        PHASE: row[1],
        AGE_RANGE: row[2],
        SOURCE: row[3],
        PALACE_NAME: row[4],
        STEM_BRANCH: row[5],
        ATOMS: HUA_ORDER.map(hua => `${row[0]}-${HUA_CODE[hua]}`).join(','),
      },
    })),
    ...decadalPalaceRows.map(row => ({
      id: row[0],
      type: 'DECADA_PALACE',
      fields: {
        DECADA_PALACE: row[1],
        TARGET: row[2],
        NATAL_PALACE: row[3],
        NATAL_STEM_BRANCH: row[4],
      },
    })),
    ...yearRows.map(row => ({
      id: row[0],
      type: 'YEAR_PALACE',
      fields: {
        YEAR_PALACE: row[1],
        TARGET: row[2],
        NATAL_PALACE: row[3],
        NATAL_STEM_BRANCH: row[4],
      },
    })),
    ...checkRows.map(row => ({
      id: row[0],
      type: 'CHECK',
      fields: { ITEM: row[1], REFERENCE: row[2], RESULT: row[3] },
    })),
  ];
  const factLines = factRecords.map(record => renderFactLine(record, caseId, fingerprint));
  const notebookFactSections = [
    `# [LOCKED-FACTS] ${caseId} NotebookLM紫微事实包`,
    '',
    '> 生成器：iZiwei Notebook Fact Pack v1',
    '> 来源台账：iZiwei Deterministic Ledger v4.1',
    `> 校验状态：${statusText}`,
    `> 盘面指纹：${fingerprint}`,
    `> 事实总数：${factLines.length}`,
    '> 本文件是NotebookLM唯一盘面事实源。每一条FACT都是自描述完整事实，不依赖表头或上下文补全。',
    '> 证据登记统一置于回答末尾，格式为一行一个“E编号=事实编号”；网页按编号还原完整FACT。',
    '> 正文只使用E编号解释含义，不重新口述宫位之间的飞入、冲、对宫、三合、向心或离心关系。',
    '',
    '## Canonical Facts',
    '',
    ...factLines,
    '',
    '## 使用契约',
    '',
    '1. 全部C完成后统一登记证据，一行只写一个“E编号=事实编号”，同一E不得改绑其他事实。',
    '2. 技术关系只存在于网页还原的FACT中；解释正文写“依据E编号，该结构……”并讨论老师如何解释。',
    '3. 回答完成后粘贴到网页“回答核验”；引用核验只证明已登记事实可还原，问题6还需通过核心闭包。',
    '4. 同一因果路径只合并结构计数，路径内部并存的禄权科忌与自化仍须全部登记并参与加减。',
  ];

  const sections = [
    `# [LOCKED] ${caseId} 紫微斗数盘面事实台账`,
    '',
    `> 生成器：iZiwei Deterministic Ledger v4.1`,
    `> 校验状态：${statusText}`,
    `> 盘面指纹：${fingerprint}`,
    `> 本文件只记录排盘事实，不包含性格、吉凶、事件或现实解释。`,
    `> NotebookLM优先引用Z、R及四化原子编号；B、F、D、DA保留为完整盘面与兼容摘要。`,
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
    '## Z. 星曜与神煞原子事实（分析优先引用）',
    '',
    '> 一行只记录一个星曜或神煞。正文需要提及具体星曜、旺陷或自化标记时，优先引用本表编号，不要重新抄写整宫。',
    '',
    markdownTable(
      ['编号', '宫位编号', '宫位', '类别', '名称', '亮度', '生年四化', '离心四化', '向心四化'],
      atomicItemRows,
    ),
    '',
    '## R. 宫位关系原子事实（分析唯一关系源）',
    '',
    '> 对宫与三合只读取本表，不依据地支临时心算。三方四正由本宫、对宫与两个三合宫共同组成。',
    '',
    markdownTable(['编号', '本宫编号', '本宫', '地支', '对宫编号', '三合宫一', '三合宫二'], relationRows),
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
    '## D. 生年、报告日期所在大限与报告流年分层',
    '',
    markdownTable(['编号', '层级', '起点', '天干', '禄', '权', '科', '忌'], layerRows),
    '',
    '## DA. 已历、当前与下一大限事实组',
    '',
    '> DA按虚岁起点顺排，仅输出截至当前大限及其下一限；“当前”组必须与D02完全一致。',
    '',
    markdownTable(
      ['编号', '阶段', '虚岁范围', '大限命宫落入本命', '本命宫位', '大限干支', '禄', '权', '科', '忌'],
      decadalSummaryRows,
    ),
    '',
    '### DA-L. 各限十二宫叠入本命',
    '',
    markdownTable(['编号', '大限宫位', '落入本命宫编号', '本命宫位', '本命干支'], decadalPalaceRows),
    '',
    '## A. 四化原子事实（分析优先引用）',
    '',
    '> 一行只记录一颗星的一种四化与落点。引用单条飞化时使用原子编号，例如F11-K；不得只写父行F11后自行改写科忌或落宫。',
    '',
    markdownTable(
      ['原子编号', '父编号', '层级', '起点', '天干', '四化', '星曜', '落点宫'],
      atomicTransformRows,
    ),
    '',
    '## LY. 报告年份流年十二宫叠宫事实',
    '',
    markdownTable(['编号', '流年宫位', '落入本命宫编号', '本命宫位', '本命干支'], yearRows),
    '',
    '## Y. 自动一致性校验',
    '',
    markdownTable(['编号', '检查项', '引用', '结果'], checkRows),
    '',
    '## 生成结果',
    '',
    `- 校验状态：${status}`,
    `- 十二宫：${validPalaceRecords.length}/12`,
    `- 星曜与神煞原子事实：${atomicItemRows.length}项`,
    `- 宫位关系原子事实：${relationRows.length}/12`,
    `- 宫干飞化：${flyRows.length}/12`,
    `- 四化原子事实：${atomicTransformRows.length}/${(flyRows.length + layerRows.length + decadalGroups.length) * 4}`,
    `- 生年四化：${birthRows.length}/4`,
    `- 离心与向心飞化：${selfHuaRows.length}项`,
    `- 大限事实组：${decadalGroups.length}组（${decadalPalaceRows.filter(row => /^B\d{2}$/.test(row[2])).length}/${decadalGroups.length * 12}个叠宫）`,
    `- 流年十二宫叠宫：${yearRows.filter(row => /^B\d{2}$/.test(row[2])).length}/12`,
    `- 自动核验：${checkRows.filter(row => row[3] === 'PASS').length}/${checkRows.length}通过`,
    `- 盘面指纹：${fingerprint}`,
    issues.length ? `- 阻断原因：${issues.join('；')}` : '- 阻断原因：无',
    '',
    '> NotebookLM使用规则：本文件负责盘面事实；具体星曜优先引用Z，宫位关系只引用R，单条四化优先引用原子编号。课程来源只负责解释论法，不得修改本文件中的编号与字段。',
  ];

  return {
    markdown: sections.join('\n'),
    notebookFacts: notebookFactSections.join('\n'),
    factCount: factLines.length,
    status,
    fingerprint,
    issues,
  };
}
