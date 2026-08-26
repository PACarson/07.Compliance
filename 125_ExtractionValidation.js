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

// =======================================================================
// Order-level（Butiran Tempahan）candidate validation —— Phase 4，2026-08-25
// Steven 明确要求把原本 142 里混在一起的检查拆成三个独立、各自可测试的
// 层级（Structural / Arithmetic / Traceability），理由是「checksum 过了
// 不等于整个 extraction 都对」——订单号本身抄错、但金额跟日期都对的话，
// 光靠 142 的 checksum 抓不到，需要一个专门检查「这个订单号看起来像不像
// 真的、有没有被保留下来」的独立关卡。三层任何一层没过都是 Needs_Review
// （不是 Extraction_Failed——形状本身如果没问题，代表这是可以留给人看的
// candidate，不是要整个丢弃），跟 validateExtractionCandidate_ 同一套
// stage 语意。
//
// 刻意的边界：这几个函数只检查 candidate「内部」自洽，不接收
// periodStartParts/periodEndParts 之类的外部脉络——candidate 是不是真的
// 落在「这份 Statement 的」期间范围内，属于跟外部资料对照的判断，交给
// 142_DailyOrderAllocation.js 既有的 resolveOrderDate_（Phase 3 已经写好
// 并测过），不在这里重复一份。这里只检查 weekday_name/month_name 本身
// 是不是「看起来像」合法值（已知枚举），不检查它们在特定一份 Statement
// 里对不对得上——避免 125 这个通用验证文件反过来依赖 142 这个功能专属
// 文件，维持既有的依赖方向（106/125 是共用底层，142 才依赖它们，不反过来）。
// =======================================================================

var ORDER_ID_PATTERN_ = /^(A-|PLAN-\d+-)[A-Z0-9]{4,}$/;
var KNOWN_WEEKDAY_NAMES_ = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
var KNOWN_MONTH_NAMES_ = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
var KNOWN_PAYMENT_METHODS_RAW_ = [/^Tanpa\s*tunai$/i, /^Tunai$/i, /^Tunai\s*\/\s*Tanpa\s*tunai$/i];

/**
 * @param {*} candidate 127_LLMExtractor.js 的 extractOrders() 产出、还没验证过的 candidate
 * @return {string[]}
 */
function validateOrderCandidateSchema_(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object') return ['candidate 本身不是一个 object'];
  if (!candidate.extraction_scope || !isPositiveInt_(candidate.extraction_scope.first_page_seen) || !isPositiveInt_(candidate.extraction_scope.last_page_seen)) {
    errors.push('extraction_scope.first_page_seen/last_page_seen 缺失或不是正整数');
  }
  if (!Array.isArray(candidate.days)) {
    errors.push('candidate.days 不是阵列');
    return errors; // 没有 days 阵列，下面逐项检查没有意义
  }
  candidate.days.forEach((day, di) => {
    const dp = `days[${di}]`;
    if (typeof day.weekday_name !== 'string') errors.push(`${dp}.weekday_name 缺失或不是字符串`);
    if (!isPositiveInt_(day.day)) errors.push(`${dp}.day 缺失或不是正整数`);
    if (typeof day.month_name !== 'string') errors.push(`${dp}.month_name 缺失或不是字符串`);
    if (typeof day.day_block_complete !== 'boolean') errors.push(`${dp}.day_block_complete 缺失或不是 boolean`);
    if (day.printed_daily_subtotal !== null && !isFiniteNumber_(day.printed_daily_subtotal)) errors.push(`${dp}.printed_daily_subtotal 既不是数字也不是 null`);
    if (!Array.isArray(day.orders)) {
      errors.push(`${dp}.orders 不是阵列`);
      return;
    }
    day.orders.forEach((order, oi) => {
      const op = `${dp}.orders[${oi}]`;
      if (order.order_row_type !== 'Tunggal' && order.order_row_type !== 'Sekaligus') errors.push(`${op}.order_row_type 不是 Tunggal 或 Sekaligus：${JSON.stringify(order.order_row_type)}`);
      if (typeof order.platform_raw !== 'string' || !order.platform_raw) errors.push(`${op}.platform_raw 缺失`);
      if (!Array.isArray(order.order_ids_raw)) errors.push(`${op}.order_ids_raw 不是阵列`);
      if (!Number.isInteger(order.and_more_count) || order.and_more_count < 0) errors.push(`${op}.and_more_count 缺失或不是非负整数`);
      if (typeof order.payment_method_raw !== 'string' || !order.payment_method_raw) errors.push(`${op}.payment_method_raw 缺失`);
      ['base_income', 'other_income', 'income_adjustment', 'net_income'].forEach((f) => {
        if (!isFiniteNumber_(order[f])) errors.push(`${op}.${f} 缺失或不是数字`);
      });
      if (!isPositiveInt_(order.source_page)) errors.push(`${op}.source_page 缺失或不是正整数`);
      if (typeof order.low_confidence !== 'boolean') errors.push(`${op}.low_confidence 缺失或不是 boolean`);
    });
  });
  return errors;
}

/**
 * Structural Integrity —— Steven 2026-08-25 §2 明确列的项目：row type 合法、
 * 订单号格式符合已知 Grab pattern、Sekaligus >= 1 个 ID（今天用 W33 真实
 * PDF 核实过的规则，不是 >= 2）、and N / bundled count 逻辑一致、payment
 * method 是已知值。只检查 candidate 内部一致，不比对外部 period（见文件
 * 顶端的边界说明）。
 * @param {Object} candidate 已经过 validateOrderCandidateSchema_ 的 candidate
 * @return {string[]}
 */
function validateOrderCandidateStructural_(candidate) {
  const errors = [];
  candidate.days.forEach((day, di) => {
    const dp = `days[${di}]`;
    if (KNOWN_WEEKDAY_NAMES_.indexOf(day.weekday_name) === -1) errors.push(`${dp}.weekday_name 不是已知的马来文星期几：${day.weekday_name}`);
    if (KNOWN_MONTH_NAMES_.indexOf(day.month_name) === -1) errors.push(`${dp}.month_name 不是已知的马来文月份：${day.month_name}`);
    if (day.day < 1 || day.day > 31) errors.push(`${dp}.day 超出 1-31 范围：${day.day}`);

    day.orders.forEach((order, oi) => {
      const op = `${dp}.orders[${oi}]`;
      const idCount = order.order_ids_raw.length;

      if (order.order_row_type === 'Sekaligus' && idCount === 0 && order.and_more_count === 0) {
        errors.push(`${op}: Sekaligus 一个订单号都没有、and_more_count 也是 0，无法识别`);
      }
      if (order.order_row_type === 'Tunggal' && idCount > 1) {
        errors.push(`${op}: 标示为 Tunggal 却有 ${idCount} 个订单号，跟单一订单矛盾`);
      }
      if (order.order_row_type === 'Tunggal' && order.and_more_count > 0) {
        errors.push(`${op}: 标示为 Tunggal 却有 and_more_count=${order.and_more_count}，"and N" 只应该出现在 Sekaligus`);
      }
      order.order_ids_raw.forEach((id) => {
        if (!ORDER_ID_PATTERN_.test(id)) errors.push(`${op}: 订单号格式不符合已知 Grab pattern（A-/PLAN-N- 前缀）：${JSON.stringify(id)}`);
      });
      if (!KNOWN_PAYMENT_METHODS_RAW_.some((re) => re.test(order.payment_method_raw))) {
        errors.push(`${op}: payment_method_raw 不是已知值：${JSON.stringify(order.payment_method_raw)}`);
      }
    });
  });
  return errors;
}

/**
 * Arithmetic Integrity（订单层级）—— 跟 validateCandidateArithmetic_ 同一个
 * 精神，换成逐笔订单的 base+other+adjustment vs net。142_DailyOrderAllocation.js
 * 的文字解析路径（parseOrderRowCandidate_）也用同一个容差常数
 * EXTRACTION_TOLERANCE_，两条路径（文字 regex / Gemini JSON）共用同一个
 * 算术判准，不是各自维护一份可能悄悄不一致的容差。
 * @param {Object} candidate 已经过 schema 验证的 candidate
 * @return {string[]}
 */
function validateOrderCandidateArithmetic_(candidate) {
  const errors = [];
  candidate.days.forEach((day, di) => {
    day.orders.forEach((order, oi) => {
      const recomputed = round2_(order.base_income + order.other_income + order.income_adjustment);
      const diff = round2_(order.net_income - recomputed);
      if (Math.abs(diff) > EXTRACTION_TOLERANCE_) {
        errors.push(`days[${di}].orders[${oi}]: base(${order.base_income})+other(${order.other_income})+adjustment(${order.income_adjustment})=${recomputed}，跟 net_income(${order.net_income}) 对不上，差 ${diff}`);
      }
    });
  });
  return errors;
}

/**
 * Traceability / Identity Integrity —— Steven 2026-08-25 §2 明确要求：
 * 原始订单号必须保留、不能被 Gemini 自己「修正」成看起来更合理的样子。
 * 这一层没有能独立核对的外部证据（不像 arithmetic 有算术关系可以打脸），
 * 所以检查的是「有没有明显被动过手脚」的形状特征，而不是「这个订单号
 * 本身对不对」——后者本来就没有独立信息源可以核对，这也是为什么文首
 * 强调「checksum 过不代表订单号是对的」这个盲点没有被这一层解决，只是
 * 被更明确地圈出来。
 * @param {Object} candidate
 * @return {string[]}
 */
function validateOrderCandidateTraceability_(candidate) {
  const errors = [];
  candidate.days.forEach((day, di) => {
    day.orders.forEach((order, oi) => {
      const op = `days[${di}].orders[${oi}]`;
      const idCount = order.order_ids_raw.length;
      if (order.order_row_type === 'Sekaligus' && idCount + order.and_more_count < 1) {
        errors.push(`${op}: Sekaligus 订单号数量（含 and N）合计为 0，无法追溯`);
      }
      // 同一行内部出现重复订单号，通常代表 Gemini 把同一个号码读了两次
      // 而不是真的有两笔一样的订单——保留下来让人看，不要静默去重
      // （去重本身就是一种"修正"，不该在 candidate 阶段发生）。
      const dupIds = order.order_ids_raw.filter((id, idx) => order.order_ids_raw.indexOf(id) !== idx);
      if (dupIds.length > 0) {
        errors.push(`${op}: order_ids_raw 内部有重复订单号，可能是读取重复而非真实重复：${JSON.stringify(dupIds)}`);
      }
    });
  });
  return errors;
}

/**
 * 外部唯一入口——order-level 版本的 validateExtractionCandidate_。
 * @param {*} candidate
 * @return {{valid: boolean, stage: (string|null), errors: string[]}}
 */
function validateOrderExtractionCandidate_(candidate) {
  const schemaErrors = validateOrderCandidateSchema_(candidate);
  if (schemaErrors.length > 0) {
    return { valid: false, stage: 'Extraction_Failed', errors: schemaErrors };
  }
  const errors = []
    .concat(validateOrderCandidateStructural_(candidate))
    .concat(validateOrderCandidateArithmetic_(candidate))
    .concat(validateOrderCandidateTraceability_(candidate));
  if (errors.length > 0) {
    return { valid: false, stage: 'Needs_Review', errors };
  }
  return { valid: true, stage: null, errors: [] };
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
    isoDateStringFromParts_,
    ORDER_ID_PATTERN_,
    KNOWN_WEEKDAY_NAMES_,
    KNOWN_MONTH_NAMES_,
    validateOrderCandidateSchema_,
    validateOrderCandidateStructural_,
    validateOrderCandidateArithmetic_,
    validateOrderCandidateTraceability_,
    validateOrderExtractionCandidate_
  };
}
