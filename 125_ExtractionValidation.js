/**
 * 125_ExtractionValidation.js
 * Compliance OS — Extraction Validation：LLM 抽取出来的 Structured Candidate
 * 进 Verified_Income 之前，一定要先通过这一关。
 *
 * 「LLM 是 Extraction Engine，不是 Truth Engine」——这个文件就是那条边界
 * 本身。127_LLMExtractor.js 只负责把 PDF 变成一个 candidate；candidate 长
 * 什么样、数字对不对、期间猜没猜对，全部由这里独立判断，LLM 自己说多有
 * 把握不算数（真正的 acceptance gate 是这几个纯函数，不是 provider 回传的
 * confidence）。
 *
 * 全部纯逻辑、不碰任何 GAS 服务——这是这个专案「自动测试只测纯逻辑，I/O
 * 集成才需要人工验证」惯例里最该被自动测试覆盖的一块：candidate 有没有
 * 通过验证，不该取决于真的调了哪个 LLM provider。
 *
 * 三层检查，任何一层没过就不能变成 Verified：
 *   1. validateCandidateSchema_  —— 形状对不对、必要栏位在不在、类型对不对
 *   2. validateCandidatePeriod_  —— period 是不是可以确定（UCR4：只信年/月/日
 *      拆开的整数，不信 LLM 自己算的字符串日期或 week；week 永远由我们自己
 *      的代码从 period_start_parts 算，不采用 candidate 里任何 week 字段）
 *   3. validateCandidateArithmetic_ —— summary/income_breakdown 彼此的数学
 *      关系（±0.01 容差，对应现有 round2_ 的精度）对不对
 *
 * validateExtractionCandidate_ 是外部唯一入口：schema 没过直接 Extraction_
 * Failed（连基本形状都不对，没什么好人工看的）；schema 过但 period/
 * arithmetic 没过 → Needs_Review（形状对、但数字或期间站不住，需要人看，
 * 不能静默接受也不能直接当失败丢掉——candidate 本身要保留，见
 * 127_LLMExtractor.js 的证据留存）。
 */

if (typeof require === 'function') {
  var { round2_ } = require('./106_Utils.js');
}

var EXTRACTION_TOLERANCE_ = 0.01; // 跟 round2_ 的精度（2 位小数）对齐

function isFiniteNumber_(v) {
  return typeof v === 'number' && isFinite(v);
}

function isPositiveInt_(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * @param {*} candidate LLM 回传、还没验证过的东西——先当完全不可信处理
 * @return {string[]} 空阵列代表通过
 */
function validateCandidateSchema_(candidate) {
  const errors = [];
  const path = (p) => `document_meta/summary/income_breakdown 结构缺失或类型错误：${p}`;

  if (!candidate || typeof candidate !== 'object') {
    return ['candidate 本身不是一个 object'];
  }

  const dm = candidate.document_meta;
  if (!dm || typeof dm !== 'object') {
    errors.push(path('document_meta'));
  } else {
    if (typeof dm.source !== 'string' || !dm.source) errors.push(path('document_meta.source'));
    if (typeof dm.document_type !== 'string' || !dm.document_type) errors.push(path('document_meta.document_type'));
    if (typeof dm.currency !== 'string' || !dm.currency) errors.push(path('document_meta.currency'));
    ['period_start_parts', 'period_end_parts'].forEach((key) => {
      const parts = dm[key];
      if (!parts || typeof parts !== 'object') {
        errors.push(path(`document_meta.${key}`));
      } else {
        ['year', 'month', 'day'].forEach((f) => {
          if (!isPositiveInt_(parts[f])) errors.push(path(`document_meta.${key}.${f}`));
        });
      }
    });
  }

  const s = candidate.summary;
  if (!s || typeof s !== 'object') {
    errors.push(path('summary'));
  } else {
    ['total_income', 'total_deductions', 'weekly_net'].forEach((f) => {
      if (!isFiniteNumber_(s[f])) errors.push(path(`summary.${f}`));
    });
  }

  const b = candidate.income_breakdown;
  if (!b || typeof b !== 'object') {
    errors.push(path('income_breakdown'));
  } else {
    ['net_delivery_income', 'incentive', 'tip', 'other_payments'].forEach((f) => {
      if (!isFiniteNumber_(b[f])) errors.push(path(`income_breakdown.${f}`));
    });
  }

  return errors;
}

/**
 * 只信拆开的整数年/月/日（UCR4）。week 不采用 candidate 自己给的任何值——
 * 就算它给了，也不读、不比对——一律由这里用 period_start_parts 重新算，
 * 这是「不允许因为 LLM 猜测日期而生成错误的 week」这条要求最直接的实现：
 * LLM 只需要负责抄对 statement 上印的起讫日期，week 的算术完全不假手于它。
 * @param {Object} candidate 已经过 validateCandidateSchema_ 的 candidate
 * @return {{errors: string[], week: (string|null), periodStartIso: (string|null), periodEndIso: (string|null)}}
 */
function validateCandidatePeriod_(candidate) {
  const errors = [];
  const dm = candidate.document_meta;
  const startParts = dm.period_start_parts;
  const endParts = dm.period_end_parts;

  const startDate = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const endDate = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));

  if (isNaN(startDate.getTime())) errors.push(`period_start_parts 组不出合法日期：${JSON.stringify(startParts)}`);
  if (isNaN(endDate.getTime())) errors.push(`period_end_parts 组不出合法日期：${JSON.stringify(endParts)}`);
  if (errors.length > 0) return { errors, week: null, periodStartIso: null, periodEndIso: null };

  // 校验 month/day 真的落在合法范围内——Date.UTC 对越界值会自动进位
  // （例如 month=13 会变成隔年 1 月），这种「组得出日期但跟原始整数对不上」
  // 本身就代表 candidate 给的数字有问题，必须拒绝而不是接受进位后的结果
  const startRoundTrips = startDate.getUTCFullYear() === startParts.year &&
    startDate.getUTCMonth() === startParts.month - 1 && startDate.getUTCDate() === startParts.day;
  const endRoundTrips = endDate.getUTCFullYear() === endParts.year &&
    endDate.getUTCMonth() === endParts.month - 1 && endDate.getUTCDate() === endParts.day;
  if (!startRoundTrips) errors.push(`period_start_parts 不是合法的年/月/日组合：${JSON.stringify(startParts)}`);
  if (!endRoundTrips) errors.push(`period_end_parts 不是合法的年/月/日组合：${JSON.stringify(endParts)}`);
  if (errors.length > 0) return { errors, week: null, periodStartIso: null, periodEndIso: null };

  const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 3600 * 1000));
  if (spanDays < 1 || spanDays > 10) {
    errors.push(`period_start 到 period_end 相差 ${spanDays} 天，不像一份 weekly statement 该有的范围（预期 1-10 天）——可能日期抄错`);
  }

  const week = isoWeekFromParts_(startParts);
  const periodStartIso = isoDateStringFromParts_(startParts);
  const periodEndIso = isoDateStringFromParts_(endParts);

  return { errors, week: errors.length > 0 ? null : week, periodStartIso, periodEndIso };
}

function isoDateStringFromParts_(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** 跟 121_GrabWeeklyParser.js 的 isoWeek_ 同一个算法（ISO 8601 周数）。 */
function isoWeekFromParts_(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const target = new Date(date.getTime());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const weekNumber = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * summary/income_breakdown 彼此站不站得住——这是拦「数字编得看起来合理但
 * 互相对不上」这种 hallucination 最直接的一关：LLM 可能每个数字单独看都
 * 像真的，但四则运算兜不起来，人不会算错这个，LLM 会。
 * @param {Object} candidate 已经过 schema 验证的 candidate
 * @return {string[]}
 */
function validateCandidateArithmetic_(candidate) {
  const errors = [];
  const s = candidate.summary;
  const b = candidate.income_breakdown;

  const recomputedTotalIncome = round2_(b.net_delivery_income + b.incentive + b.tip + b.other_payments);
  const totalIncomeDiff = round2_(s.total_income - recomputedTotalIncome);
  if (Math.abs(totalIncomeDiff) > EXTRACTION_TOLERANCE_) {
    errors.push(
      `summary.total_income (${s.total_income}) 跟 net_delivery_income+incentive+tip+other_payments ` +
      `重新加总的结果 (${recomputedTotalIncome}) 对不上，差 ${totalIncomeDiff}`
    );
  }

  const recomputedNet = round2_(s.total_income - s.total_deductions);
  const netDiff = round2_(s.weekly_net - recomputedNet);
  if (Math.abs(netDiff) > EXTRACTION_TOLERANCE_) {
    errors.push(
      `summary.weekly_net (${s.weekly_net}) 跟 total_income-total_deductions ` +
      `重新计算的结果 (${recomputedNet}) 对不上，差 ${netDiff}`
    );
  }

  return errors;
}

/**
 * 外部唯一入口。三层检查依序跑：schema 没过就直接 Extraction_Failed（不用
 * 再看 period/arithmetic，形状都不对，没有可以进一步验证的东西）；schema
 * 过但 period 或 arithmetic 没过 → Needs_Review，errors 里两类都会列出来，
 * 不会因为 period 先失败就不检查 arithmetic（一次把所有问题都告诉人，不要
 * 让人改一个又跳出下一个）。
 * @param {*} candidate 127_LLMExtractor.js 产出、还没验证过的 candidate
 * @return {{valid: boolean, stage: (string|null), errors: string[], week: (string|null), periodStartIso: (string|null), periodEndIso: (string|null)}}
 */
function validateExtractionCandidate_(candidate) {
  const schemaErrors = validateCandidateSchema_(candidate);
  if (schemaErrors.length > 0) {
    return { valid: false, stage: 'Extraction_Failed', errors: schemaErrors, week: null, periodStartIso: null, periodEndIso: null };
  }

  const periodResult = validateCandidatePeriod_(candidate);
  const arithmeticErrors = validateCandidateArithmetic_(candidate);
  const errors = periodResult.errors.concat(arithmeticErrors);

  if (errors.length > 0) {
    return { valid: false, stage: 'Needs_Review', errors, week: null, periodStartIso: periodResult.periodStartIso, periodEndIso: periodResult.periodEndIso };
  }

  return {
    valid: true, stage: null, errors: [],
    week: periodResult.week, periodStartIso: periodResult.periodStartIso, periodEndIso: periodResult.periodEndIso
  };
}

/**
 * 验证通过后，把简化的 candidate 形状normalize 成 GrabWeeklyParser 现有
 * 输出的同一个 canonical 形状——下游（Reconciliation/VerifiedIncome）完全
 * 不用知道这笔资料是 regex 解析出来的还是 LLM 抽取出来的，两条路径汇流
 * 成同一个 parsedStatement 形状（跟 GrabWeeklyParser 那份共用同一组栏位
 * 名字，buildVerifiedIncomeRecord_ 不用改一行）。
 * 只能对已经 validateExtractionCandidate_ 判定 valid 的 candidate 呼叫。
 * @param {Object} candidate
 * @param {{valid: true, week: string, periodStartIso: string, periodEndIso: string}} validation validateExtractionCandidate_ 的回传（valid 必须是 true）
 * @param {string} extractorId 例如 "LLMExtractor:gemini-3.7-flash"
 * @param {string} extractionVersion
 * @return {Object} parsedStatement，形状跟 GrabWeeklyParser.parse() 的回传一致
 */
function normalizeExtractionCandidate_(candidate, validation, extractorId, extractionVersion) {
  if (!validation || !validation.valid) {
    throw new Error('normalizeExtractionCandidate_: 只能对已经验证通过（valid: true）的 candidate 呼叫');
  }
  const b = candidate.income_breakdown;
  return {
    document_meta: {
      source: candidate.document_meta.source,
      document_type: candidate.document_meta.document_type,
      period_start: validation.periodStartIso,
      period_end: validation.periodEndIso,
      week: validation.week,
      currency: candidate.document_meta.currency
    },
    summary: {
      total_income: candidate.summary.total_income,
      total_deductions: candidate.summary.total_deductions,
      weekly_net: candidate.summary.weekly_net
    },
    income_breakdown: {
      net_delivery_income: { code: 'net_delivery_income', amount: b.net_delivery_income },
      incentive: { code: 'incentive', amount: b.incentive },
      tip: { code: 'tip', amount: b.tip },
      other_payments: { code: 'other_payments', amount: b.other_payments }
    },
    extraction_notes: candidate.extraction_notes || '',
    _parser_id: extractorId,
    _schema_version: extractionVersion
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    EXTRACTION_TOLERANCE_,
    validateCandidateSchema_,
    validateCandidatePeriod_,
    validateCandidateArithmetic_,
    validateExtractionCandidate_,
    normalizeExtractionCandidate_,
    isoWeekFromParts_,
    isoDateStringFromParts_
  };
}
