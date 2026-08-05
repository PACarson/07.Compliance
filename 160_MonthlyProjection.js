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
 * ISO 周不对齐日历月——同一周可能横跨两个月。这里用 ISO 周定年份的同一套
 * 规则（该周的星期四落在哪个月，这周就算哪个月），跟 UCR4 一致，全程用
 * 拆解好的整数透过 Date.UTC 组装，不解析日期字符串。这是一个必要的简化，
 * 明确记录在这里，不是没想过。
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

/** "2026-W30" -> "2026-07"（用该周星期四所在的月份，理由见文件头注释） */
function isoWeekToYearMonth_(isoWeekStr) {
  const parts = isoWeekToThursdayParts_(isoWeekStr);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function sumField_(records, field) {
  return records.reduce((total, r) => total + (typeof r[field] === 'number' ? r[field] : 0), 0);
}

/**
 * 月度收入汇总——纯函数，即时算，不存储（EP4）。
 * @param {Array} verifiedIncomeRecords Verified_Income 的记录（呼叫方负责提供，
 *   例如读 Sheet 全部记录，或历史回填时提供整批——都不需要重新解析 PDF）
 * @param {string} yearMonth "2026-07"
 * @return {Object}
 */
function computeMonthlyIncomeSummary_(verifiedIncomeRecords, yearMonth) {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error(`yearMonth 格式应该是 "YYYY-MM"：${yearMonth}`);
  }
  const relevant = verifiedIncomeRecords.filter((r) => isoWeekToYearMonth_(r.period) === yearMonth && r.status === 'Verified');
  if (relevant.length === 0) {
    return {
      year_month: yearMonth, week_count: 0, net_delivery_income: 0, incentive: 0, tip: 0,
      other_payments: 0, total_deductions: 0, net: 0, currency: null,
      _source: 'Projection', _computed_from: []
    };
  }
  return {
    year_month: yearMonth,
    week_count: relevant.length,
    net_delivery_income: round2_(sumField_(relevant, 'net_delivery_income')),
    incentive: round2_(sumField_(relevant, 'incentive')),
    tip: round2_(sumField_(relevant, 'tip')),
    other_payments: round2_(sumField_(relevant, 'other_payments')),
    total_deductions: round2_(sumField_(relevant, 'total_deductions')),
    net: round2_(sumField_(relevant, 'net')),
    currency: relevant[0].currency,
    _source: 'Projection', // 明确标示：这是聚合出来的，不是新的 Verified 记录
    _computed_from: relevant.map((r) => r.income_id)
  };
}

/**
 * 年初至今（YTD）收入汇总——纯函数，即时算。
 * @param {Array} verifiedIncomeRecords
 * @param {string} year "2026"
 * @param {string} [throughYearMonth] 算到哪个月为止（含），不给就算全部已有资料
 * @return {Object}
 */
function computeYearToDateIncomeSummary_(verifiedIncomeRecords, year, throughYearMonth) {
  const relevant = verifiedIncomeRecords.filter((r) => {
    if (r.status !== 'Verified') return false;
    const ym = isoWeekToYearMonth_(r.period);
    if (!ym.startsWith(`${year}-`)) return false;
    if (throughYearMonth && ym > throughYearMonth) return false;
    return true;
  });
  const months = Array.from(new Set(relevant.map((r) => isoWeekToYearMonth_(r.period)))).sort();
  return {
    year: String(year),
    through_year_month: throughYearMonth || (months.length ? months[months.length - 1] : null),
    week_count: relevant.length,
    month_count: months.length,
    net_delivery_income: round2_(sumField_(relevant, 'net_delivery_income')),
    incentive: round2_(sumField_(relevant, 'incentive')),
    tip: round2_(sumField_(relevant, 'tip')),
    other_payments: round2_(sumField_(relevant, 'other_payments')),
    total_deductions: round2_(sumField_(relevant, 'total_deductions')),
    net: round2_(sumField_(relevant, 'net')),
    currency: relevant.length ? relevant[0].currency : null,
    _source: 'Projection',
    _computed_from: relevant.map((r) => r.income_id)
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    isoWeekToThursdayParts_,
    isoWeekToYearMonth_,
    computeMonthlyIncomeSummary_,
    computeYearToDateIncomeSummary_
  };
}
