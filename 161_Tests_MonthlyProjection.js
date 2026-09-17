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
  // 2026-08-22 真实 GAS 崩溃复现：Sheets 自动转换出的原生 Date 物件、
  // 栏位错位读到的非日期字符串——都不该让 computeMonthlyAllocation_ 抛错
  // ============================================================
  const dateObjectAllocation = computeMonthlyAllocation_({
    income_id: 'DATEOBJ', period_start: new Date(2026, 6, 20), period_end: new Date(2026, 6, 26) // 月份 0-index：6=7月
  });
  assertEqual_('原生 Date 物件·不抛错，正确识别成 Full', dateObjectAllocation.status, 'Full', results);
  assertEqual_('原生 Date 物件·yearMonth 算对（用 getFullYear/getMonth，不是字符串硬凑）', dateObjectAllocation.yearMonth, '2026-07', results);

  const garbagePeriodAllocation = computeMonthlyAllocation_({ income_id: 'GARBAGE', period_start: 'MYR', period_end: 1200 });
  assertEqual_('栏位错位读到的垃圾值（模拟旧 16 栏资料被新 schema 读串位）·不抛错，归 Missing_Period（不是让 yearMonthFromIsoDate_ 的例外往外逃逸）', garbagePeriodAllocation.status, 'Missing_Period', results);

  let threwOnMixedBadRecord = false;
  let julyWithRealCrashScenario;
  try {
    julyWithRealCrashScenario = computeMonthlyIncomeSummary_([
      sampleVerifiedIncome_('CMP-INCOME-2026-W28', '2026-W28', '2026-07-06', '2026-07-12', 1200),
      { income_id: 'CMP-INCOME-BAD-ROW', period: '2026-W29', period_start: 'MYR', period_end: 1200, status: 'Verified', net: 999 } // 模拟真实撞到的那笔坏资料
    ], '2026-07');
  } catch (e) { threwOnMixedBadRecord = true; }
  results.push({ name: '整批汇总里混一笔栏位错位的坏资料·不会让好资料一起崩（2026-08-22 真实事故复现）', pass: !threwOnMixedBadRecord });
  if (julyWithRealCrashScenario) {
    assertEqual_('好的那笔（W28）正常算进 net', julyWithRealCrashScenario.net, 1200, results);
    assertEqual_('坏的那笔没有偷偷被算进去', julyWithRealCrashScenario.week_count, 1, results);
  }

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
  // 2026-09-15 Production Wiring Slice——Needs_Allocation 不再无条件排除，
  // 先查有没有 142 已经 Fully_Allocated 的 Daily_Allocation。W01 的每日数字
  // 是 Gate 2 已经验证过的真实 ground truth（不是编的）：
  //   12月 = 157.90+196.00+174.70 = 528.60
  //   1月  = 187.60+162.40+213.50+205.50 = 769.00
  //   合计 = 1297.60（跟已验证的周总额吻合）
  // ============================================================
  function sampleDailyAllocationRow_(batchId, incomeId, date, orderCount, netDeliveryIncome, allocationStatus) {
    return {
      daily_allocation_id: `${batchId}-${date}`, batch_id: batchId, verified_income_id: incomeId,
      date, order_row_count: orderCount, net_delivery_income: netDeliveryIncome,
      printed_daily_subtotal: netDeliveryIncome, checksum_difference: 0,
      checksum_status: 'Fully_Allocated', allocation_status: allocationStatus || 'Fully_Allocated',
      written_at: '2026-09-10T15:17:28.008Z'
    };
  }
  const w01Income = {
    income_id: 'CMP-INCOME-2026-W01', period: '2026-W01',
    period_start: '2025-12-29', period_end: '2026-01-04', currency: 'MYR',
    net_delivery_income: 1297.60, incentive: 566.20, tip: 50.00, other_payments: 19.00,
    total_deductions: 0, net: round2ForTest_(1297.60 + 566.20 + 50.00 + 19.00),
    amount: 1932.80, source: 'Compliance OS', origin_platform: 'Grab', status: 'Verified',
    verified_at: '2026-01-05T00:00:00Z', source_document_id: 'DOC-2026-W01'
  };
  const w01DailyRowsData = [
    ['2025-12-29', 21, 157.90], ['2025-12-30', 28, 196.00], ['2025-12-31', 23, 174.70],
    ['2026-01-01', 22, 187.60], ['2026-01-02', 20, 162.40], ['2026-01-03', 28, 213.50], ['2026-01-04', 31, 205.50]
  ];
  const w01DailyRows = w01DailyRowsData.map(([date, count, amt]) => sampleDailyAllocationRow_('BATCH-W01-1', 'CMP-INCOME-2026-W01', date, count, amt));

  // ---- Test 1：非跨月 Statement——传了（跟它无关的）Daily_Allocation 也不受影响 ----
  const julyWithUnrelatedDaily = computeMonthlyIncomeSummary_(records, '2026-07', w01DailyRows);
  assertEqual_('Test1(wiring)·非跨月月份的汇总，传入无关的 Daily_Allocation 不影响结果', julyWithUnrelatedDaily, julySummary, results);

  // ---- Test 2：跨月 Statement（真实 W01）——12/1 月分别拿到正确的订单收入 ----
  const decSummary = computeMonthlyIncomeSummary_([w01Income], '2025-12', w01DailyRows);
  const janSummary = computeMonthlyIncomeSummary_([w01Income], '2026-01', w01DailyRows);
  assertEqual_('Test2·12月 net_delivery_income = 157.90+196.00+174.70', decSummary.net_delivery_income, 528.60, results);
  assertEqual_('Test2·1月 net_delivery_income = 187.60+162.40+213.50+205.50', janSummary.net_delivery_income, 769.00, results);
  assertEqual_('Test2·12+1月订单收入合计等于已验证的周总额 1297.60', round2ForTest_(decSummary.net_delivery_income + janSummary.net_delivery_income), 1297.60, results);
  assertEqual_('Test2·W01 不再出现在 12 月的 needs_allocation（订单收入已经可靠分月）', decSummary.needs_allocation.length, 0, results);
  assertEqual_('Test2·W01 不再出现在 1 月的 needs_allocation', janSummary.needs_allocation.length, 0, results);

  // ---- Test 3：verified_income_id 正确关联——不会跟别的 income_id 的 Daily_Allocation 混在一起 ----
  const decoyDailyRows = [sampleDailyAllocationRow_('BATCH-DECOY-1', 'CMP-INCOME-2026-W99', '2026-01-01', 5, 9999)];
  const janWithDecoyOnly = computeMonthlyIncomeSummary_([w01Income], '2026-01', decoyDailyRows);
  assertEqual_('Test3·verified_income_id 不匹配的 Daily_Allocation 不会被误用', janWithDecoyOnly.net_delivery_income, 0, results);
  assertEqual_('Test3·verified_income_id 不匹配时 W01 仍然落回 needs_allocation', janWithDecoyOnly.needs_allocation.map((n) => n.income_id), ['CMP-INCOME-2026-W01'], results);
  assertEqual_('Test3·partially_allocated 里的 income_id 精确等于 W01 自己的 income_id', janSummary.partially_allocated.map((p) => p.income_id), ['CMP-INCOME-2026-W01'], results);

  // ---- Test 4：重复执行不会 double count——两批 Fully_Allocated，只认最新一批 ----
  const w01OldWrongBatch = w01DailyRowsData.map(([date, count, amt]) =>
    sampleDailyAllocationRow_('BATCH-W01-0-OLDER', 'CMP-INCOME-2026-W01', date, count, amt + 1000) // 故意跟真值不同，确认真的没被用到
  );
  const janWithOldAndNewBatch = computeMonthlyIncomeSummary_([w01Income], '2026-01', w01OldWrongBatch.concat(w01DailyRows));
  assertEqual_('Test4·同一个 verified_income_id 有新旧两批 Fully_Allocated，只用最新一批（不是两批加总，也不是用到旧的那批）', janWithOldAndNewBatch.net_delivery_income, 769.00, results);

  // ---- Test 5：allocation failure（Needs_Review）——fail closed，落回 needs_allocation，不假装已分配 ----
  const w01NeedsReviewRows = w01DailyRowsData.map(([date, count, amt]) =>
    sampleDailyAllocationRow_('BATCH-W01-FAILED', 'CMP-INCOME-2026-W01', date, count, amt, 'Needs_Review')
  );
  const janWithFailedAllocation = computeMonthlyIncomeSummary_([w01Income], '2026-01', w01NeedsReviewRows);
  assertEqual_('Test5·allocation_status 是 Needs_Review 时不计入 net_delivery_income', janWithFailedAllocation.net_delivery_income, 0, results);
  assertEqual_('Test5·allocation_status 是 Needs_Review 时落回 needs_allocation（不是 partially_allocated）', janWithFailedAllocation.needs_allocation.map((n) => n.income_id), ['CMP-INCOME-2026-W01'], results);
  assertEqual_('Test5·allocation_status 是 Needs_Review 时 partially_allocated 是空的', janWithFailedAllocation.partially_allocated.length, 0, results);

  // ---- Test 6：非订单收入（Insentif/Tip/Bayaran lain-lain）——已知但不猜日期，跟 net 分开 ----
  assertEqual_('Test6·12月 unallocated_non_order_income = 566.20+50.00+19.00（Insentif+Tip+Bayaran lain-lain）', decSummary.unallocated_non_order_income, 635.20, results);
  assertEqual_('Test6·1月同一笔记录也会看到同样的未分配金额（横跨的两个月都要看得到，跟 needs_allocation 原本的做法一致）', janSummary.unallocated_non_order_income, 635.20, results);
  assertEqual_('Test6·非订单收入完全没有被塞进 12 月的 net_delivery_income（还是干净的 528.60，不是 528.60+一部分 635.20）', decSummary.net_delivery_income, 528.60, results);
  assertEqual_('Test6·net 也只含可靠分月的订单收入部分（12月 net 等于 net_delivery_income，不含猜测的非订单收入）', decSummary.net, decSummary.net_delivery_income, results);

  // ---- Test 7：既有行为回归——跨月周如果完全没有 Daily_Allocation，维持 2026-09-15 之前一模一样的排除行为 ----
  const janWithoutAnyDailyAllocation = computeMonthlyIncomeSummary_([w01Income], '2026-01');
  assertEqual_('Test7·没给 dailyAllocationRecords（或不存在）时，行为完全等同这次改版之前——整周排除，net_delivery_income 是 0', janWithoutAnyDailyAllocation.net_delivery_income, 0, results);
  assertEqual_('Test7·没给 dailyAllocationRecords 时落回 needs_allocation', janWithoutAnyDailyAllocation.needs_allocation.map((n) => n.income_id), ['CMP-INCOME-2026-W01'], results);
  assertEqual_('Test7·非跨月的既有测试资料集（julySummary）行为完全不受这次改动影响', computeMonthlyIncomeSummary_(records, '2026-07'), julySummary, results);

  // ---- YTD 层级：partially_allocated / unallocated_non_order_income 的去重
  //      （用同一年内横跨两月的 W27，不是跨年份的 W01——W01 横跨
  //      2025/2026 两个不同"年"，本来就不会同时出现在同一次 YTD 查询里，
  //      不能拿它测这个去重逻辑；W27 横跨 6/7 月、同一年，才是会真的
  //      触发"同一笔在两个月的 YTD 汇总里都出现"这个情况的例子） ----
  const w27DailyRows = [
    sampleDailyAllocationRow_('BATCH-W27-1', 'CMP-INCOME-2026-W27', '2026-06-29', 10, 300),
    sampleDailyAllocationRow_('BATCH-W27-1', 'CMP-INCOME-2026-W27', '2026-06-30', 10, 300),
    sampleDailyAllocationRow_('BATCH-W27-1', 'CMP-INCOME-2026-W27', '2026-07-01', 10, 400)
  ];
  const recordsWithW27Allocated = records.map((r) => r.income_id === 'CMP-INCOME-2026-W27'
    ? Object.assign({}, r, { incentive: 100, tip: 10, other_payments: 5 })
    : r);
  const ytdWithW27Allocated = computeYearToDateIncomeSummary_(recordsWithW27Allocated, '2026', '2026-07', w27DailyRows);
  assertEqual_('YTD 去重(wiring)·partially_allocated 只有一笔 W27，不是两笔（6月/7月各出现一次要去重）', ytdWithW27Allocated.partially_allocated.map((p) => p.income_id), ['CMP-INCOME-2026-W27'], results);
  assertEqual_('YTD 去重(wiring)·unallocated_non_order_income 只算一次 W27 的 100+10+5=115（不是两个月各算一次变 230）', ytdWithW27Allocated.unallocated_non_order_income, 115, results);
  // 这行本来直接拿 net(800/1200/900/1734.10) 去加，第一次跑测试就抓到自己
  // 算错——sampleVerifiedIncome_ 的 net_delivery_income 是 net*0.66，不是
  // net 本身。改成用同一个换算方式重新算一次，独立核对过跟实作结果一致
  // （528.00+600+792.00+594.00+1144.51+400=4058.51），不是看到 FAIL 就直接
  // 把预期值改成程式回传的数字。
  assertEqual_(
    'YTD 去重(wiring)·W27 的订单收入正确分进 6/7 两月（W22/28/29/30 是 net*0.66，W27 是 300+300+400 这三天）',
    ytdWithW27Allocated.net_delivery_income,
    round2ForTest_(round2ForTest_(800 * 0.66) + (300 + 300) + round2ForTest_(1200 * 0.66) + round2ForTest_(900 * 0.66) + round2ForTest_(1734.10 * 0.66) + 400),
    results
  );

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
