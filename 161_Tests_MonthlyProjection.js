/**
 * 161_Tests_MonthlyProjection.js
 */
if (typeof require === 'function') {
  var {
    isoWeekToYearMonth_, computeMonthlyIncomeSummary_, computeYearToDateIncomeSummary_
  } = require('./160_MonthlyProjection.js');
  var { assertEqual_ } = require('./105_TestUtils.js');
}

function sampleVerifiedIncome_(incomeId, period, net, status) {
  return {
    income_id: incomeId, period, currency: 'MYR',
    net_delivery_income: net * 0.66, incentive: net * 0.32, tip: net * 0.01, other_payments: net * 0.01,
    total_deductions: 0, net, amount: net, source: 'Compliance OS', origin_platform: 'Grab',
    status: status || 'Verified', verified_at: '2026-07-28T09:00:00Z'
  };
}

function runAllMonthlyProjectionTests() {
  const results = [];

  // ---- ISO 周 -> 月份，用已知样本核对（2026-W30 已经确认对应 20-26 Julai 2026） ----
  assertEqual_('2026-W30 属于 2026-07（跟样本 Statement 的实际日期一致）', isoWeekToYearMonth_('2026-W30'), '2026-07', results);
  assertEqual_('2026-W01 属于 2026-01', isoWeekToYearMonth_('2026-W01'), '2026-01', results);
  assertEqual_('2026-W52 属于 2026-12', isoWeekToYearMonth_('2026-W52'), '2026-12', results);

  let threwBadFormat = false;
  try { isoWeekToYearMonth_('2026-30'); } catch (e) { threwBadFormat = true; }
  results.push({ name: '格式不对时抛错', pass: threwBadFormat });

  // ---- 月度汇总：正确过滤该月的周、正确加总、跳过非 Verified 状态 ----
  const records = [
    sampleVerifiedIncome_('CMP-INCOME-2026-W27', '2026-W27', 1000),
    sampleVerifiedIncome_('CMP-INCOME-2026-W28', '2026-W28', 1200),
    sampleVerifiedIncome_('CMP-INCOME-2026-W29', '2026-W29', 900),
    sampleVerifiedIncome_('CMP-INCOME-2026-W30', '2026-W30', 1734.10),
    sampleVerifiedIncome_('CMP-INCOME-2026-W31', '2026-W31', 1100, 'Superseded'), // 不该被算进去
    sampleVerifiedIncome_('CMP-INCOME-2026-W22', '2026-W22', 800) // 6 月，不该被算进 7 月汇总
  ];

  const julySummary = computeMonthlyIncomeSummary_(records, '2026-07');
  assertEqual_('7 月汇总·涵盖周数', julySummary.week_count, 4, results);
  assertEqual_('7 月汇总·net 总和', julySummary.net, round2_(1000 + 1200 + 900 + 1734.10), results);
  assertEqual_('7 月汇总·_source 标示 Projection', julySummary._source, 'Projection', results);
  assertEqual_('7 月汇总·排除了 Superseded 的那笔', julySummary._computed_from.indexOf('CMP-INCOME-2026-W31') === -1, true, results);

  const emptyMonth = computeMonthlyIncomeSummary_(records, '2026-03');
  assertEqual_('没有资料的月份·week_count 是 0', emptyMonth.week_count, 0, results);
  assertEqual_('没有资料的月份·net 是 0（不是 null 或抛错）', emptyMonth.net, 0, results);

  let threwBadYearMonth = false;
  try { computeMonthlyIncomeSummary_(records, '2026-7'); } catch (e) { threwBadYearMonth = true; }
  results.push({ name: 'yearMonth 格式不对时抛错', pass: threwBadYearMonth });

  // ---- YTD 汇总 ----
  const ytdThroughJuly = computeYearToDateIncomeSummary_(records, '2026', '2026-07');
  assertEqual_('YTD 到 7 月·涵盖月数', ytdThroughJuly.month_count, 2, results); // 6月 + 7月（22週在6月）
  assertEqual_('YTD 到 7 月·net 总和（含 6 月那笔）', ytdThroughJuly.net, round2_(800 + 1000 + 1200 + 900 + 1734.10), results);

  const ytdNoLimit = computeYearToDateIncomeSummary_(records, '2026');
  assertEqual_('YTD 不给 through_year_month 时用最新月份', ytdNoLimit.through_year_month, '2026-07', results);

  function round2_(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllMonthlyProjectionTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllMonthlyProjectionTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllMonthlyProjectionTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] 用你真实的历史 Verified_Income（等 PDF 都导入后）核对月度汇总是否
 *     符合你自己对当月收入的印象/银行入账记录，抓出任何 Reconciliation
 *     阶段没抓到的异常
 * [ ] 确认"该周星期四所在月份"这个简化规则你能接受——极少数情况下一周
 *     横跨两个月，收入会整笔算进星期四那个月，不会拆两半
 */
