/**
 * 999_PersistenceVerification.js
 *
 * 只能在真的 GAS 环境跑（需要 SPREADSHEET_ID 这个 Script Property，跟
 * 115_TruthWriter.js 既有前提一样）。这份脚本一次做完 Step 1-6 的全部内容——
 * 没有 Gemini 呼叫、没有多分钟等待，全部是本地 Sheet/Drive 操作，不会撞到
 * GAS 6 分钟上限，不需要像 Gate 2 那样拆成好几个函式分开跑。
 *
 * 每一段 console.log 都直接对应最终报告的 A-E 段落，跑完整段贴回来即可，
 * 不用另外整理。
 *
 * 用的 batch 是 2026-09-04 v4 那次真实、Fully_Allocated 的 Gate 2 结果——
 * 7 天的数字照那次贴回来的 log 原样重建，不是重新跑 extraction。唯一没办法
 * 还原的是 batchId 本身的确切字串（那次 log 印了 allocationStatus/尝试历程/
 * checksum，但没有印 batchId）——这里用同样的 CMP-OALB-{verifiedIncomeId}-
 * {timestamp} 格式配一个新的 timestamp，代表的是「现在才把这个已经算好的
 * 结果存进 Sheet」这个动作本身发生的时间，不是编造历史资料。
 *
 * Non_Order_Income 的 null 三连示范用的是真实存在于 DOAL_FIXTURE_NONORDER_W01_
 * 的一行 Insentif 说明文字（"Shift Top-Up: Kelana Jaya, TTDI Shift (2628250)"），
 * 跑真的 matchInsentifLineDate_——这行不符合 "Bonus Harian <星期几>"（那是
 * W33 fixture 才有的格式，W01 用的是 Shift Top-Up/Bonus Mingguan Berganda），
 * 两个已知格式都碰不到，是真实、非造假的 Not_Determinable。
 *
 * Scope：不碰 127/125/999_LatencyReliabilityObservation.js，不新增 Sheet/
 * Script Property/dependency，不实作 Insentif/Bayaran-lain-lain 的逐行抽取、
 * Order_Allocation、Monthly_Allocation——这些一个字都没写在这里。
 */

function runRealPersistenceVerification() {
  const verifiedIncomeId = 'CMP-INCOME-2026-W01-PHASEB-G2'; // 跟 v4 那次真实 verifiedIncomeContext.verifiedIncomeId 完全一样
  const now = new Date();

  console.log('========== A. Real GAS Sheet setup ==========');
  const setupResults = setupComplianceOsSheets();
  setupResults.forEach((r) => console.log(`  ${r.name}: ${r.action}`));
  const daSetup = setupResults.find((r) => r.name === 'Daily_Allocation');
  const noiSetup = setupResults.find((r) => r.name === 'Non_Order_Income_Allocation');
  console.log(`  Daily_Allocation 建立/确认: ${daSetup ? daSetup.action : '!!! 没找到 !!!'}`);
  console.log(`  Non_Order_Income_Allocation 建立/确认: ${noiSetup ? noiSetup.action : '!!! 没找到 !!!'}`);
  console.log(`  其他既有五张表: ${setupResults.filter((r) => r.name !== 'Daily_Allocation' && r.name !== 'Non_Order_Income_Allocation').map((r) => `${r.name}(${r.action})`).join(', ')}`);

  // 2026-09-04 v4 真实、Fully_Allocated 的 Gate 2 结果——照那次贴回来的 log 原样重建
  const realBatchResult = {
    batchId: `CMP-OALB-${verifiedIncomeId}-${now.getTime()}`,
    allocationStatus: 'Fully_Allocated',
    dailyAllocations: [
      { date: '2026-01-04', order_row_count: 31, net_delivery_income: 205.5, printed_daily_subtotal: 205.5, checksum_difference: 0, checksum_status: 'Matched' },
      { date: '2026-01-03', order_row_count: 28, net_delivery_income: 213.5, printed_daily_subtotal: 213.5, checksum_difference: 0, checksum_status: 'Matched' },
      { date: '2026-01-02', order_row_count: 20, net_delivery_income: 162.4, printed_daily_subtotal: 162.4, checksum_difference: 0, checksum_status: 'Matched' },
      { date: '2026-01-01', order_row_count: 22, net_delivery_income: 187.6, printed_daily_subtotal: 187.6, checksum_difference: 0, checksum_status: 'Matched' },
      { date: '2025-12-31', order_row_count: 23, net_delivery_income: 174.7, printed_daily_subtotal: 174.7, checksum_difference: 0, checksum_status: 'Matched' },
      { date: '2025-12-30', order_row_count: 28, net_delivery_income: 196, printed_daily_subtotal: 196, checksum_difference: 0, checksum_status: 'Matched' },
      { date: '2025-12-29', order_row_count: 21, net_delivery_income: 157.9, printed_daily_subtotal: 157.9, checksum_difference: 0, checksum_status: 'Matched' }
    ]
  };

  console.log('\n========== B. Daily_Allocation persistence ==========');
  const daWriteResult = writeDailyAllocationBatch_(TruthWriter, realBatchResult, verifiedIncomeId, now);
  console.log(`  write: ${!daWriteResult.skipped && daWriteResult.written.length === 7 ? 'PASS' : 'FAIL'}（skipped=${daWriteResult.skipped}）`);
  console.log(`  batch_id: ${realBatchResult.batchId}`);
  console.log(`  rows written: ${daWriteResult.written.length}`);
  console.log(`  代表性第一行: ${JSON.stringify(daWriteResult.written[0])}`);

  const daAllRowsRaw = gasSheetAccessor_().getAllRows('Daily_Allocation');
  const daRecordsForQuery = daAllRowsRaw.map((row) => {
    const obj = {}; DAILY_ALLOCATION_COLUMNS.forEach((col, i) => { obj[col] = row[i]; }); return obj;
  });
  const thisWriteReadBack = daRecordsForQuery.filter((r) => r.batch_id === realBatchResult.batchId);
  console.log(`  read-back: ${thisWriteReadBack.length === 7 ? 'PASS' : 'FAIL'}（Sheet 里这个 batch_id 实际读回 ${thisWriteReadBack.length} 行，应该 7 行；Sheet 目前总行数 ${daAllRowsRaw.length}）`);

  console.log('\n========== C. Non_Order_Income_Allocation persistence ==========');
  const insentifDescription = 'Shift Top-Up: Kelana Jaya, TTDI Shift (2628250)';
  const insentifMatch = matchInsentifLineDate_(insentifDescription, { year: 2025, month: 12, day: 29 }, { year: 2026, month: 1, day: 4 });
  console.log(`  candidate 判定结果（真实跑 matchInsentifLineDate_，不是手造）: ${JSON.stringify(insentifMatch)}`);
  const noiCandidate = {
    category: 'Insentif', descriptionRaw: insentifDescription, amount: 7.00,
    dateSource: insentifMatch.dateSource, allocatedDate: insentifMatch.allocatedDate,
    referencedSourcePeriod: insentifMatch.referencedSourcePeriod, linkedOrderId: null
  };
  const noiWriteResult = writeNonOrderIncomeAllocationBatch_(TruthWriter, [noiCandidate], realBatchResult.batchId, verifiedIncomeId, now);
  console.log(`  write: ${noiWriteResult.length === 1 ? 'PASS' : 'FAIL'}`);
  console.log(`  写入前的 row 物件: ${JSON.stringify(noiWriteResult[0])}`);

  const noiAllRowsRaw = gasSheetAccessor_().getAllRows('Non_Order_Income_Allocation');
  const justWrittenRawRow = noiAllRowsRaw[noiAllRowsRaw.length - 1];
  const allocIdx = NON_ORDER_INCOME_ALLOCATION_COLUMNS.indexOf('allocated_date');
  const refIdx = NON_ORDER_INCOME_ALLOCATION_COLUMNS.indexOf('referenced_source_period');
  const linkIdx = NON_ORDER_INCOME_ALLOCATION_COLUMNS.indexOf('linked_order_id');
  console.log(`  read-back 这一行原始值 —— allocated_date=${JSON.stringify(justWrittenRawRow[allocIdx])}, referenced_source_period=${JSON.stringify(justWrittenRawRow[refIdx])}, linked_order_id=${JSON.stringify(justWrittenRawRow[linkIdx])}`);
  const nullFieldsOk = justWrittenRawRow[allocIdx] === '' && justWrittenRawRow[refIdx] === '' && justWrittenRawRow[linkIdx] === '';
  console.log(`  null-field persistence: ${nullFieldsOk ? 'PASS（真的是空字符串，不是 "null"/"undefined"/栏位错位）' : 'FAIL，见上面原始值'}`);
  console.log(`  read-back（整体）: ${noiAllRowsRaw.length >= 1 ? 'PASS' : 'FAIL'}（Sheet 目前总行数 ${noiAllRowsRaw.length}）`);

  console.log('\n========== D. Latest-batch retrieval ==========');
  const latestBatchId = getLatestDailyAllocationBatchId_(verifiedIncomeId, daRecordsForQuery);
  const latestRows = getLatestDailyAllocationRows_(verifiedIncomeId, daRecordsForQuery);
  console.log(`  getLatestDailyAllocationBatchId_ 回传: ${latestBatchId}`);
  console.log(`  是不是刚刚写入的这个 batch: ${latestBatchId === realBatchResult.batchId ? 'PASS' : 'FAIL'}`);
  console.log(`  getLatestDailyAllocationRows_ 回传笔数: ${latestRows.length}，判定: ${latestRows.length === 7 ? 'PASS' : 'FAIL'}`);

  console.log('\n========== E. Fully_Allocated guard ==========');
  const defaultGuardResult = writeDailyAllocationBatch_(TruthWriter, realBatchResult, verifiedIncomeId, new Date(), daRecordsForQuery);
  console.log(`  Case A（预设行为，同一个已存在的 batch 结果再写一次）: skipped=${defaultGuardResult.skipped}, reason=${defaultGuardResult.reason}, written.length=${defaultGuardResult.written.length}`);
  console.log(`  Case A 判定: ${(defaultGuardResult.skipped === true && defaultGuardResult.written.length === 0) ? 'PASS' : 'FAIL'}`);

  const forceBatchResult = Object.assign({}, realBatchResult, { batchId: `CMP-OALB-${verifiedIncomeId}-${Date.now()}` });
  const forceGuardResult = writeDailyAllocationBatch_(TruthWriter, forceBatchResult, verifiedIncomeId, new Date(), daRecordsForQuery, true);
  console.log(`  Case B（force:true，用一个新 batchId 避免跟 Case A 撞 daily_allocation_id）: skipped=${forceGuardResult.skipped}, written.length=${forceGuardResult.written.length}`);
  console.log(`  Case B 判定: ${(forceGuardResult.skipped === false && forceGuardResult.written.length === 7) ? 'PASS' : 'FAIL'}`);
  console.log(`  ⚠️ Case B 会在 Daily_Allocation 真的多写 7 行（force 覆盖的必然结果）——这是这次验证特意造出来的第二个 batch，不是错误；如果不想留着，麻烦手动去 Sheet 删掉 batch_id=${forceBatchResult.batchId} 的那 7 行`);

  console.log('\n========== 请把以上完整 log 原样贴回来 ==========');
}
