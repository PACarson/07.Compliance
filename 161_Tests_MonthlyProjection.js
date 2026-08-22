/**
 * 161_Tests_MonthlyProjection.js
 *
 * 2026-08-22 改版：sampleVerifiedIncome_ 现在带真实的 period_start/period_end
 * （Monday-Sunday，用 Python datetime.date.fromisocalendar(2026, W, 1/7) 算出
 * 来核对过，不是随手编的日期）。这批真实日期本身就抓出了旧测试注释的一个
 * 错误：2026-W22 的星期四落在 5 月（不是旧注解写的"在6月"），2026-W27/W31
 * 其实都横跨两个月——这正是这次改版要处理的情况，不是巧合，是刻意选用
 * 这几周当测试资料。
 */
if (typeof require === 'function') {
  var {
    isoWeekToYearMonth_, computeStatementMonths_, computeMonthlyAllocation_,
    dedupeByIncomeId_, findInvalidPeriodIncomeIds_,
    computeMonthlyIncomeSummary_, computeYearToDateIncomeSummary_,
    computeComplianceProjection_
  } = require('./160_MonthlyProjection.js');
  var { assertEqual_ } = require('./105_TestUtils.js');
}

function round2ForTest_(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function sampleVerifiedIncome_(incomeId, period, periodStart, periodEnd, net, status) {
  return {
    income_id: incomeId, period, period_start: periodStart, period_end: periodEnd, currency: 'MYR',
    net_delivery_income: round2ForTest_(net * 0.66), incentive: round2ForTest_(net * 0.32),
    tip: round2ForTest_(net * 0.01), other_payments: round2ForTest_(net * 0.01),
    total_deductions: 0, net, amount: net, source: 'Compliance OS', origin_platform: 'Grab',
    status: status || 'Verified', verified_at: '2026-07-28T09:00:00Z'
  };
}

function runAllMonthlyProjectionTests() {
  const results = [];

  // ============================================================
  // 向下相容：isoWeekToYearMonth_ 本身没有改，仍然导出、仍然是"该周星期四
  // 所在月份"——2026-08-22 起只是不再被月度/YTD 汇总拿来做归属判断。
  // ============================================================
  assertEqual_('isoWeekToYearMonth_ 向下相容·2026-W30', isoWeekToYearMonth_('2026-W30'), '2026-07', results);
  assertEqual_('isoWeekToYearMonth_ 向下相容·2026-W01', isoWeekToYearMonth_('2026-W01'), '2026-01', results);
  let threwBadFormat = false;
  try { isoWeekToYearMonth_('2026-30'); } catch (e) { threwBadFormat = true; }
  results.push({ name: 'isoWeekToYearMonth_ 格式不对时抛错', pass: threwBadFormat });

  // ============================================================
  // computeStatementMonths_ / computeMonthlyAllocation_——新的归属判断本身
  // ============================================================
  assertEqual_(
    '完全落在同一个月·2026-W30（20-26 Julai，跟已确认的真实样本一致）',
    computeStatementMonths_('2026-07-20', '2026-07-26'), ['2026-07'], results
  );
  assertEqual_(
    '横跨两个月·2026-W27（2026-06-29 Mon → 2026-07-05 Sun）',
    computeStatementMonths_('2026-06-29', '2026-07-05'), ['2026-06', '2026-07'], results
  );
  assertEqual_(
    '横跨两个"年"（2026-W01：2025-12-29 Mon → 2026-01-04 Sun）——年份边界不能被漏算',
    computeStatementMonths_('2025-12-29', '2026-01-04'), ['2025-12', '2026-01'], results
  );

  let threwBadIsoDate = false;
  try { computeStatementMonths_('20260720', '2026-07-26'); } catch (e) { threwBadIsoDate = true; }
  results.push({ name: 'computeStatementMonths_ 日期格式不对时抛错（不猜）', pass: threwBadIsoDate });

  const fullAllocation = computeMonthlyAllocation_(sampleVerifiedIncome_('X', '2026-W30', '2026-07-20', '2026-07-26', 100));
  assertEqual_('Full 归属·status', fullAllocation.status, 'Full', results);
  assertEqual_('Full 归属·yearMonth', fullAllocation.yearMonth, '2026-07', results);

  const needsAllocAllocation = computeMonthlyAllocation_(sampleVerifiedIncome_('Y', '2026-W27', '2026-06-29', '2026-07-05', 100));
  assertEqual_('Needs_Allocation 归属·status', needsAllocAllocation.status, 'Needs_Allocation', results);
  assertEqual_('Needs_Allocation 归属·months 两个都列出来', needsAllocAllocation.months, ['2026-06', '2026-07'], results);

  const missingAllocation = computeMonthlyAllocation_({ income_id: 'Z', period: '2026-W99' });
  assertEqual_('Missing_Period 归属·status', missingAllocation.status, 'Missing_Period', results);

  // ============================================================
  // dedupeByIncomeId_ / findInvalidPeriodIncomeIds_——独立小工具
  // ============================================================
  const dupInput = [
    sampleVerifiedIncome_('A', '2026-W30', '2026-07-20', '2026-07-26', 100),
    sampleVerifiedIncome_('A', '2026-W30', '2026-07-20', '2026-07-26', 100),
    sampleVerifiedIncome_('B', '2026-W29', '2026-07-13', '2026-07-19', 200)
  ];
  assertEqual_('dedupeByIncomeId_·只留第一次出现的那笔', dedupeByIncomeId_(dupInput).map((r) => r.income_id), ['A', 'B'], results);

  const invalidPeriodInput = [
    sampleVerifiedIncome_('C', '2026-W30', '2026-07-20', '2026-07-26', 100),
    Object.assign(sampleVerifiedIncome_('D', '2026-W99', null, null, 50), { period_start: undefined, period_end: undefined })
  ];
  assertEqual_('findInvalidPeriodIncomeIds_·抓出缺 period_start/end 的那笔', findInvalidPeriodIncomeIds_(invalidPeriodInput), ['D'], results);

  // ============================================================
  // 主要测试资料集——6 笔真实 Monday-Sunday 周期（Python
  // datetime.date.fromisocalendar 核对过），涵盖：完全落在一个月／横跨两个
  // 月／Superseded 该被整笔排除
  // ============================================================
  const records = [
    sampleVerifiedIncome_('CMP-INCOME-2026-W22', '2026-W22', '2026-05-25', '2026-05-31', 800),           // 完全在 5 月
    sampleVerifiedIncome_('CMP-INCOME-2026-W27', '2026-W27', '2026-06-29', '2026-07-05', 1000),          // 横跨 6/7 月
    sampleVerifiedIncome_('CMP-INCOME-2026-W28', '2026-W28', '2026-07-06', '2026-07-12', 1200),          // 完全在 7 月
    sampleVerifiedIncome_('CMP-INCOME-2026-W29', '2026-W29', '2026-07-13', '2026-07-19', 900),           // 完全在 7 月
    sampleVerifiedIncome_('CMP-INCOME-2026-W30', '2026-W30', '2026-07-20', '2026-07-26', 1734.10),       // 完全在 7 月（真实样本）
    sampleVerifiedIncome_('CMP-INCOME-2026-W31', '2026-W31', '2026-07-27', '2026-08-02', 1100, 'Superseded') // 横跨 7/8 月，且已作废
  ];

  // ---- 需求测试 1：一周完全落在一个月份 → 全额进入该月份 ----
  const julySummary = computeMonthlyIncomeSummary_(records, '2026-07');
  assertEqual_('Test1·7 月汇总只含 3 笔完全落在 7 月的 Statement', julySummary.week_count, 3, results);
  assertEqual_('Test1·7 月 net 是 W28+W29+W30 三笔的加总', julySummary.net, round2ForTest_(1200 + 900 + 1734.10), results);

  // ---- 需求测试 2：多笔同月 Statement → 正确加总、不重复 ----
  assertEqual_('Test2·_computed_from 精确对应那 3 笔 income_id', julySummary._computed_from, ['CMP-INCOME-2026-W28', 'CMP-INCOME-2026-W29', 'CMP-INCOME-2026-W30'], results);
  assertEqual_('Test2·incentive 也正确加总（不是只有 net 对）', julySummary.incentive, round2ForTest_(1200 * 0.32 + 900 * 0.32 + 1734.10 * 0.32), results);

  // ---- 需求测试 3：跨月 Statement → 不静默归属，产生明确 allocation warning ----
  assertEqual_('Test3·跨月的 W27 没有被算进 7 月的 net 里', julySummary._computed_from.indexOf('CMP-INCOME-2026-W27') === -1, true, results);
  assertEqual_('Test3·W27 出现在 7 月的 needs_allocation', julySummary.needs_allocation.map((n) => n.income_id), ['CMP-INCOME-2026-W27'], results);

  const juneSummary = computeMonthlyIncomeSummary_(records, '2026-06');
  assertEqual_('Test3·6 月没有任何 Statement 完全落在 6 月', juneSummary.week_count, 0, results);
  assertEqual_('Test3·6 月 net 是 0（不是被 W27 污染，也不是漏掉 W27 的存在）', juneSummary.net, 0, results);
  assertEqual_('Test3·W27 同样出现在 6 月的 needs_allocation（它横跨的两个月都要看得到）', juneSummary.needs_allocation.map((n) => n.income_id), ['CMP-INCOME-2026-W27'], results);

  const augustSummary = computeMonthlyIncomeSummary_(records, '2026-08');
  assertEqual_('Test3·W31 已经是 Superseded，不该出现在 8 月的 needs_allocation 里', augustSummary.needs_allocation.length, 0, results);
  assertEqual_('Test3·8 月完全没有数据（W31 作废）', augustSummary.week_count, 0, results);

  // ---- 需求测试 4：重复的 Verified Income → 不能重复计算 ----
  const withDuplicateW30 = records.concat([sampleVerifiedIncome_('CMP-INCOME-2026-W30', '2026-W30', '2026-07-20', '2026-07-26', 1734.10)]);
  const julyWithDup = computeMonthlyIncomeSummary_(withDuplicateW30, '2026-07');
  assertEqual_('Test4·重复的 income_id 不会让 week_count 变成 4', julyWithDup.week_count, 3, results);
  assertEqual_('Test4·重复的 income_id 不会让 net 被多算一次', julyWithDup.net, julySummary.net, results);

  // ---- 需求测试 5：Recalculation——同样输入连续算两次，结果完全一致 ----
  const julyFirstRun = computeMonthlyIncomeSummary_(records, '2026-07');
  const julySecondRun = computeMonthlyIncomeSummary_(records, '2026-07');
  assertEqual_('Test5·连续算两次·结果完全相同（含 needs_allocation/_computed_from 的内容与顺序）', julyFirstRun, julySecondRun, results);

  // ---- 需求测试 6：Missing/invalid period → 不能进入正常 Monthly Projection ----
  const recordsWithBadPeriod = records.concat([
    Object.assign(sampleVerifiedIncome_('CMP-INCOME-2026-W98', '2026-W98', null, null, 999), { period_start: undefined, period_end: undefined })
  ]);
  let threwOnBadPeriodRecord = false;
  let julyWithBadPeriod;
  try {
    julyWithBadPeriod = computeMonthlyIncomeSummary_(recordsWithBadPeriod, '2026-07');
  } catch (e) { threwOnBadPeriodRecord = true; }
  results.push({ name: 'Test6·缺 period 的记录不会让整批汇总抛例外', pass: !threwOnBadPeriodRecord });
  if (julyWithBadPeriod) {
    assertEqual_('Test6·缺 period 的那笔没有被算进 7 月 net', julyWithBadPeriod.net, julySummary.net, results);
    assertEqual_('Test6·缺 period 的那笔也没有出现在 needs_allocation（它不是"跨月待处理"，是"根本没有期间"）', julyWithBadPeriod.needs_allocation.map((n) => n.income_id).indexOf('CMP-INCOME-2026-W98') === -1, true, results);
  }
  assertEqual_('Test6·findInvalidPeriodIncomeIds_ 能抓到这笔', findInvalidPeriodIncomeIds_(recordsWithBadPeriod), ['CMP-INCOME-2026-W98'], results);

  // ---- 没有资料的月份／yearMonth 格式校验（既有行为，改版后仍要维持） ----
  const emptyMonth = computeMonthlyIncomeSummary_(records, '2026-03');
  assertEqual_('没有资料的月份·week_count 是 0', emptyMonth.week_count, 0, results);
  assertEqual_('没有资料的月份·net 是 0（不是 null 或抛错）', emptyMonth.net, 0, results);

  let threwBadYearMonth = false;
  try { computeMonthlyIncomeSummary_(records, '2026-7'); } catch (e) { threwBadYearMonth = true; }
  results.push({ name: 'yearMonth 格式不对时抛错', pass: threwBadYearMonth });

  // ============================================================
  // YTD 汇总——2026-08-22 起由月度汇总加总而来（单一真相来源），
  // 自动继承 Needs_Allocation／去重行为，不用重新验证一次同样的规则
  // ============================================================
  const ytdThroughJuly = computeYearToDateIncomeSummary_(records, '2026', '2026-07');
  assertEqual_('YTD 到 7 月·涵盖月数（5/6/7 月都"有资料触及"，即使 6 月净额是 0）', ytdThroughJuly.month_count, 3, results);
  assertEqual_('YTD 到 7 月·week_count 是 1(5月)+0(6月)+3(7月)', ytdThroughJuly.week_count, 4, results);
  assertEqual_('YTD 到 7 月·net 总和（5 月 800 + 6 月 0 + 7 月 3834.10，不含 W27/W31）', ytdThroughJuly.net, round2ForTest_(800 + 0 + 1200 + 900 + 1734.10), results);
  assertEqual_('YTD 到 7 月·needs_allocation 只有 1 笔（W27 横跨 6/7 两月但去重成一笔，不是两笔）', ytdThroughJuly.needs_allocation.map((n) => n.income_id), ['CMP-INCOME-2026-W27'], results);

  const ytdNoLimit = computeYearToDateIncomeSummary_(records, '2026');
  assertEqual_('YTD 不给 through_year_month 时用最新月份（W31 是 Superseded，8 月不该出现）', ytdNoLimit.through_year_month, '2026-07', results);

  // ============================================================
  // computeComplianceProjection_——需求 §10：SOCSO 是已确认的固定值，
  // EPF/Tax 在规则确认前明确回传 Not_Configured，不产生数字
  // ============================================================
  const projection = computeComplianceProjection_('2026-07', julySummary);
  assertEqual_('Compliance Projection·SOCSO 是已确认的固定 Plan 4 金额', projection.socso.amount, 49.40, results);
  assertEqual_('Compliance Projection·SOCSO 标示 Projection（不是 Official_Fact——还没有真的缴费记录对照）', projection.socso.status, 'Projection', results);
  assertEqual_('Compliance Projection·EPF 明确 Not_Configured，不猜数字', projection.epf, { status: 'Not_Configured', amount: null, note: 'i-Saraan Plus 登记状态/供款选择尚未确认，不产生数字' }, results);
  assertEqual_('Compliance Projection·Tax 明确 Not_Configured，不猜数字', projection.tax, { status: 'Not_Configured', amount: null, note: '所得税计算规则尚未确认，不产生数字' }, results);

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
 * [x] 旧清单这一项已经在这次改版处理掉了："该周星期四所在月份"的简化
 *     规则不再用来决定归属——横跨两个月的 Statement 现在会明确标成
 *     Needs_Allocation，不会整笔算进任一个月
 * [ ] 拿真实一整年的 Statement 跑一次，人工看一下 needs_allocation 列出来
 *     的周数是不是你预期的那几周（理论上一年最多 1-2 周会跨月，取决于
 *     1 月 1 日落在星期几）
 * [ ] Console 呈现 Needs_Allocation 的时候（下一步：Console UI），确认呈现
 *     方式让你能一眼看出"这笔钱还没被计入任何月份"，不是被藏在细节里
 */
