/**
 * 160_MonthlyProjection.js
 * Compliance OS — Monthly Projection Engine（评估结论见治理文档，采纳新增）
 *
 * 职责边界（回答"这属于 Compliance OS 还是 Finance OS"）：只消费已经存在
 * 的 Verified_Income 记录做聚合，不重新解析 PDF、不产生新的 Verified 结果。
 * 月度/年度收入汇总仍然是官方收入的聚合视图，跟 Verified_Income 本身一样
 * 属于 Compliance OS 的 Truth Layer 衍生物——Finance OS 之后可以读这里的
 * 输出去算净资产/现金流，但"官方收入聚合"本身的计算权威还是 Compliance OS。
 *
 * EP4 一致性：月度/年度汇总不是新的 Sheet、不存储——查询时用已有的
 * Verified_Income 记录即时算。原因跟 Compliance_Calendar 的 status 一样：
 * 存成汇总表会变成第二个真相来源，需要额外机制保持同步；这里数据量小
 * （一年最多 ~52 笔周记录），即时算完全没有效能问题，不需要为了不存在的
 * 效能问题预先做快取（EP3）。
 *
 * 2026-08-22 改版——月份归属从"整周归一个月"改成"逐笔判断"：
 * 原本的简化规则是 ISO 周的星期四落在哪个月，整笔 Verified_Income 就算
 * 哪个月（isoWeekToYearMonth_，下面仍然保留，向下相容，但不再被月度/YTD
 * 汇总使用）。这个简化当时就在 161 的人工验证清单里明确留了一条待确认
 * 项目："极少数情况下一周横跨两个月，收入会整笔算进星期四那个月，不会
 * 拆两半"——现在明确不接受这个简化：ISO 周不对齐日历月，一份 Weekly
 * Statement 的起讫日期（period_start/period_end，2026-08-22 起才真正存进
 * Verified_Income，见 140_VerifiedIncome.js）经常横跨两个月，Grab 官方
 * PDF 上只给周总额、两条解析路径（121 正则/127 LLM）都到周层级为止，没有
 * 逐日拆分，所以无法可靠算出跨月那笔金额该怎么分。新规则（computeMonthlyAllocation_）：
 *   - Statement 完全落在同一个月 → 全额归那个月（跟以前结果一致，多数
 *     Statement 属于这种情况）。
 *   - Statement 横跨两个月 → 不猜、不拆、不塞进任一个月的 net 里，明确标成
 *     Needs_Allocation，两个月份都列出来，金额只出现在该月汇总的
 *     needs_allocation 清单中，等以后有逐日数据（Option A）或人工判断
 *     再处理。
 * 这个决定不是重新打开 Architecture Freeze——EP4/Fact vs Projection 的
 * 定位完全不变，改的只是"逐笔怎么归属月份"这个纯函数内部的规则。
 */

if (typeof require === 'function') {
  var { round2_ } = require('./106_Utils.js');
}

function isoWeekToThursdayParts_(isoWeekStr) {
  const m = String(isoWeekStr).match(/^(\d{4})-W(\d{2})$/);
  if (!m) throw new Error(`不是合法的 ISO 周格式（YYYY-Www）：${isoWeekStr}`);
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);

  const jan4 = Date.UTC(year, 0, 4);
  const jan4Date = new Date(jan4);
  const jan4IsoWeekday = (jan4Date.getUTCDay() + 6) % 7; // 周一=0...周日=6
  const week1MondayMs = jan4 - jan4IsoWeekday * 24 * 3600 * 1000;
  const targetThursdayMs = week1MondayMs + ((week - 1) * 7 + 3) * 24 * 3600 * 1000;
  const targetThursday = new Date(targetThursdayMs);
  return {
    year: targetThursday.getUTCFullYear(),
    month: targetThursday.getUTCMonth() + 1,
    day: targetThursday.getUTCDate()
  };
}

/**
 * "2026-W30" -> "2026-07"（用该周星期四所在的月份）。
 * 保留：向下相容 + 仍然是一个合理的「这笔记录大概算哪个月」单一月份标签
 * （例如排序、显示用）。2026-08-22 起，月度/YTD 汇总本身不再靠这个函数
 * 决定归属——真正的归属判断在 computeMonthlyAllocation_，会先看
 * period_start/period_end 是否跨月，跨月的不会被这个函数的答案覆盖。
 */
function isoWeekToYearMonth_(isoWeekStr) {
  const parts = isoWeekToThursdayParts_(isoWeekStr);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function sumField_(records, field) {
  return records.reduce((total, r) => total + (typeof r[field] === 'number' ? r[field] : 0), 0);
}

/** "2026-07-20" -> "2026-07"。UCR4 精神的字符串版：只做格式校验 + 切片，不喂进 Date 构造函数。 */
function yearMonthFromIsoDate_(isoDateStr) {
  const m = String(isoDateStr).match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!m) {
    throw new Error(`不是合法的 ISO 日期字符串（YYYY-MM-DD）：${isoDateStr}`);
  }
  return `${m[1]}-${m[2]}`;
}

/**
 * 一份 Weekly Statement 的起讫日期实际横跨哪些日历月——1 个（完全落在
 * 同一个月）或 2 个（跨月）。只回答"起讫各自属于哪个月"，不做任何更细的
 * 推断（不假设、不猜每天的分布）——这是目前手上的数据粒度唯一能诚实
 * 回答的问题。
 * @param {string} periodStartIso "YYYY-MM-DD"
 * @param {string} periodEndIso "YYYY-MM-DD"
 * @return {string[]} 1 或 2 个 "YYYY-MM"，由早到晚排序、不重复
 */
function computeStatementMonths_(periodStartIso, periodEndIso) {
  const startYm = yearMonthFromIsoDate_(periodStartIso);
  const endYm = yearMonthFromIsoDate_(periodEndIso);
  return startYm === endYm ? [startYm] : [startYm, endYm];
}

/**
 * 单笔 Verified_Income 记录该怎么被 Monthly Projection 归属——纯函数，只吃
 * 已经存在的 period_start/period_end（不重新解析 PDF、不猜）。
 *
 *   status='Full'：整份 Statement 落在同一个月，全额归属那个月。
 *   status='Needs_Allocation'：Statement 横跨 2 个月，目前没有可靠的逐日
 *     拆分（121/127 两条解析路径都只到周层级），不猜哪几天算哪个月——
 *     两个月份都列出来，金额不会被算进任一个月的 net，只出现在
 *     needs_allocation 清单里供人工判断。以后如果拿到逐日数据（Option A），
 *     这里是唯一需要改的地方。
 *   status='Missing_Period'：record 本身没有 period_start/period_end（理论上
 *     不该发生——buildVerifiedIncomeRecord_ 已经在写入前挡了——这里是防御性
 *     判断，万一读到旧资料或外部资料源，仍要有明确、可测试的行为，不是
 *     抛例外中断整批汇总）。
 * @param {Object} verifiedIncomeRecord 需要 income_id/period_start/period_end
 * @return {{status: string, months: string[], yearMonth: (string|undefined), incomeId: string}}
 */
function computeMonthlyAllocation_(verifiedIncomeRecord) {
  const incomeId = verifiedIncomeRecord.income_id;
  if (!verifiedIncomeRecord.period_start || !verifiedIncomeRecord.period_end) {
    return { status: 'Missing_Period', months: [], incomeId };
  }
  const months = computeStatementMonths_(verifiedIncomeRecord.period_start, verifiedIncomeRecord.period_end);
  if (months.length === 1) {
    return { status: 'Full', months, yearMonth: months[0], incomeId };
  }
  return { status: 'Needs_Allocation', months, incomeId };
}

/**
 * 按 income_id 去重，保留第一次出现的那笔。Monthly Projection 必须天然
 * 幂等（需求 §9）：不管呼叫方传进来的 records 有没有重复（Reopen Console、
 * Retry、Batch import 各自重新读一次 Sheet 都可能重叠），聚合本身永远只
 * 算一次，不依赖呼叫方事先去重、也不依赖任何 UI 状态。
 * @param {Array} records
 * @return {Array}
 */
function dedupeByIncomeId_(records) {
  const seen = {};
  const result = [];
  records.forEach((r) => {
    if (!seen[r.income_id]) {
      seen[r.income_id] = true;
      result.push(r);
    }
  });
  return result;
}

/**
 * 找出 status='Verified' 但 period_start/period_end 缺失或格式不合法的
 * 记录——正常情况下不该出现（buildVerifiedIncomeRecord_ 已经在写入前挡
 * 住），这里给 Console/资料品质检查一个明确的读取点，不是常态路径。
 * @param {Array} verifiedIncomeRecords
 * @return {string[]} income_id 清单
 */
function findInvalidPeriodIncomeIds_(verifiedIncomeRecords) {
  return verifiedIncomeRecords
    .filter((r) => r.status === 'Verified')
    .filter((r) => computeMonthlyAllocation_(r).status === 'Missing_Period')
    .map((r) => r.income_id);
}

/**
 * 月度收入汇总——纯函数，即时算，不存储（EP4）。逐笔用
 * computeMonthlyAllocation_ 判断归属；横跨两个月的 Statement 不会被静默
 * 塞进其中一个月，会出现在回传的 needs_allocation 里，net/week_count 都
 * 不含它。天然去重（dedupeByIncomeId_），同一笔 income_id 不管在
 * verifiedIncomeRecords 里出现几次都只算一次。
 * @param {Array} verifiedIncomeRecords Verified_Income 的记录（呼叫方负责提供，
 *   例如读 Sheet 全部记录，或历史回填时提供整批——都不需要重新解析 PDF）
 * @param {string} yearMonth "2026-07"
 * @return {Object}
 */
function computeMonthlyIncomeSummary_(verifiedIncomeRecords, yearMonth) {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error(`yearMonth 格式应该是 "YYYY-MM"：${yearMonth}`);
  }
  const verified = dedupeByIncomeId_(verifiedIncomeRecords.filter((r) => r.status === 'Verified'));

  const fullyIn = [];
  const needsAllocation = [];
  verified.forEach((r) => {
    const allocation = computeMonthlyAllocation_(r);
    if (allocation.status === 'Full' && allocation.yearMonth === yearMonth) {
      fullyIn.push(r);
    } else if (allocation.status === 'Needs_Allocation' && allocation.months.indexOf(yearMonth) !== -1) {
      needsAllocation.push({
        income_id: r.income_id, period: r.period,
        period_start: r.period_start, period_end: r.period_end,
        months: allocation.months
      });
    }
    // Missing_Period：既不进 fullyIn 也不进 needsAllocation——不属于任何一个
    // 月份的正常汇总（Test 6 期望的行为），要找这种记录用
    // findInvalidPeriodIncomeIds_，不是在这里报警。
  });

  return {
    year_month: yearMonth,
    week_count: fullyIn.length,
    net_delivery_income: round2_(sumField_(fullyIn, 'net_delivery_income')),
    incentive: round2_(sumField_(fullyIn, 'incentive')),
    tip: round2_(sumField_(fullyIn, 'tip')),
    other_payments: round2_(sumField_(fullyIn, 'other_payments')),
    total_deductions: round2_(sumField_(fullyIn, 'total_deductions')),
    net: round2_(sumField_(fullyIn, 'net')),
    currency: fullyIn.length ? fullyIn[0].currency : null,
    _source: 'Projection', // 明确标示：这是聚合出来的，不是新的 Verified 记录
    _computed_from: fullyIn.map((r) => r.income_id),
    needs_allocation: needsAllocation // 跨月、金额没算进上面 net 的 Statement——需要人工判断怎么分，不是静默漏掉
  };
}

/**
 * 年初至今（YTD）收入汇总——纯函数，即时算。先算出年度内每个有资料触及
 * 的月份的 computeMonthlyIncomeSummary_，YTD 是这些月度汇总的加总——
 * 月度汇总本身已经处理好 Needs_Allocation/去重，YTD 不重复一次同样的
 * 判断逻辑（单一真相来源：以后归属规则如果要改，只有
 * computeMonthlyAllocation_ 这一个地方要改，YTD 自动跟着对）。
 * @param {Array} verifiedIncomeRecords
 * @param {string} year "2026"
 * @param {string} [throughYearMonth] 算到哪个月为止（含），不给就算全部已有资料
 * @return {Object}
 */
function computeYearToDateIncomeSummary_(verifiedIncomeRecords, year, throughYearMonth) {
  const verified = dedupeByIncomeId_(verifiedIncomeRecords.filter((r) => r.status === 'Verified'));

  const monthsTouched = new Set();
  verified.forEach((r) => {
    computeMonthlyAllocation_(r).months.forEach((ym) => {
      if (ym.indexOf(`${year}-`) === 0) monthsTouched.add(ym);
    });
  });
  let months = Array.from(monthsTouched).sort();
  if (throughYearMonth) months = months.filter((ym) => ym <= throughYearMonth);

  const monthlySummaries = months.map((ym) => computeMonthlyIncomeSummary_(verified, ym));

  const totals = monthlySummaries.reduce((acc, m) => ({
    net_delivery_income: round2_(acc.net_delivery_income + m.net_delivery_income),
    incentive: round2_(acc.incentive + m.incentive),
    tip: round2_(acc.tip + m.tip),
    other_payments: round2_(acc.other_payments + m.other_payments),
    total_deductions: round2_(acc.total_deductions + m.total_deductions),
    net: round2_(acc.net + m.net)
  }), { net_delivery_income: 0, incentive: 0, tip: 0, other_payments: 0, total_deductions: 0, net: 0 });

  const needsAllocation = [];
  const seenIncomeIds = {};
  monthlySummaries.forEach((m) => {
    m.needs_allocation.forEach((entry) => {
      // 跨月的 Statement 会同时出现在它横跨的两个月各自的 needs_allocation
      // 里——去重成一笔，YTD 层级要提醒的是「这笔待处理」，不是「这笔在
      // 几个月各出现一次」。
      if (!seenIncomeIds[entry.income_id]) {
        seenIncomeIds[entry.income_id] = true;
        needsAllocation.push(entry);
      }
    });
  });

  const monthWithCurrency = monthlySummaries.find((m) => m.currency);

  return Object.assign({
    year: String(year),
    through_year_month: throughYearMonth || (months.length ? months[months.length - 1] : null),
    week_count: monthlySummaries.reduce((n, m) => n + m.week_count, 0),
    month_count: months.length,
    currency: monthWithCurrency ? monthWithCurrency.currency : null,
    _source: 'Projection',
    _computed_from: monthlySummaries.reduce((ids, m) => ids.concat(m._computed_from), []),
    needs_allocation: needsAllocation
  }, totals);
}

/**
 * 单一月份的 Compliance Projection（EPF/SOCSO/Tax）——需求 §5/§10。只有
 * SOCSO 有 Steven 已经确认的固定规则（SKSPS Plan 4／Lindung Kendiri，
 * RM49.40/月，固定申报金额，不随当月收入变动，2026-08-05 确认）；EPF
 * （i-Saraan Plus）、所得税都还没有 Steven 确认的计算依据，明确回传
 * Not_Configured，不产生任何数字（CMP-P10：不猜）。
 *
 * 全部三项都标成 status: 'Projection'（不是 'Official_Fact'）——就算 SOCSO
 * 金额固定，这里显示的仍然是「系统认为这个月该缴多少」，不是「SOCSO/
 * PERKESO 真的已经收到的缴费记录」，两者要能区分（需求 §10：不要把
 * Estimated 写成 Paid）。真正的官方缴费记录以后要作为独立的 Official
 * Record 类型进 Compliance OS，跟这里的 Projection 对照，不是这个函数的
 * 范围。
 * @param {string} yearMonth "2026-07"
 * @param {Object} [monthlySummary] computeMonthlyIncomeSummary_ 的回传——
 *   SOCSO/EPF/Tax 目前都不需要用到当月收入，但保留这个参数：以后 EPF/Tax
 *   规则确认、真的要按当月收入算的话，签名不用再改一次
 * @return {{year_month: string, socso: Object, epf: Object, tax: Object}}
 */
function computeComplianceProjection_(yearMonth, monthlySummary) {
  return {
    year_month: yearMonth,
    socso: {
      status: 'Projection',
      amount: 49.40,
      currency: 'MYR',
      plan: 'SKSPS Plan 4 (Lindung Kendiri)',
      note: '固定申报金额，不随当月收入变动（2026-08-05 确认）'
    },
    epf: {
      status: 'Not_Configured',
      amount: null,
      note: 'i-Saraan Plus 登记状态/供款选择尚未确认，不产生数字'
    },
    tax: {
      status: 'Not_Configured',
      amount: null,
      note: '所得税计算规则尚未确认，不产生数字'
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    isoWeekToThursdayParts_,
    isoWeekToYearMonth_,
    yearMonthFromIsoDate_,
    computeStatementMonths_,
    computeMonthlyAllocation_,
    dedupeByIncomeId_,
    findInvalidPeriodIncomeIds_,
    computeMonthlyIncomeSummary_,
    computeYearToDateIncomeSummary_,
    computeComplianceProjection_
  };
}
