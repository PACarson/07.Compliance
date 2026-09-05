/**
 * 109_Tests_SheetSetup.js
 * 只测 SHEET_SCHEMAS_ 这份设定本身的一致性（纯资料检查，不碰任何 GAS
 * 服务）——ensureSheetSchema_/setupComplianceOsSheets 实际怎么操作真的
 * Sheet，属于 I/O 集成，留给下面的人工验证清单，不在这里堆一整套假
 * Spreadsheet/Sheet/Range mock 硬测。
 */

if (typeof require === 'function') {
  var { buildSheetSchemas_ } = require('./108_SheetSetup.js');
  var { DOCUMENTS_COLUMNS } = require('./110_DocumentImport.js');
  var { RECONCILIATION_LOG_COLUMNS } = require('./130_Reconciliation.js');
  var { VERIFIED_INCOME_COLUMNS } = require('./140_VerifiedIncome.js');
  var { DAILY_ALLOCATION_COLUMNS, NON_ORDER_INCOME_ALLOCATION_COLUMNS } = require('./142_DailyOrderAllocation.js');
  var { COMPLIANCE_CALENDAR_COLUMNS, COMPLIANCE_COMPLETIONS_COLUMNS } = require('./150_ComplianceCalendar.js');
  var { assertEqual_ } = require('./105_TestUtils.js');
}

function runAllSheetSetupTests() {
  const results = [];
  const SHEET_SCHEMAS_ = buildSheetSchemas_();
  const byName = {};
  SHEET_SCHEMAS_.forEach((s) => { byName[s.name] = s; });

  assertEqual_('七张表都在，名字对（2026-09-05 新增 Daily_Allocation / Non_Order_Income_Allocation）', Object.keys(byName).sort(), [
    'Compliance_Calendar', 'Compliance_Completions', 'Daily_Allocation', 'Documents',
    'Non_Order_Income_Allocation', 'Reconciliation_Log', 'Verified_Income'
  ].sort(), results);

  // columns 直接引用来源常数，不是复制一份——这几条其实是在防「引用到
  // 错的常数」（例如手滑把 VERIFIED_INCOME_COLUMNS 接到 Documents 那笔）
  assertEqual_('Documents.columns 就是 DOCUMENTS_COLUMNS', byName.Documents.columns, DOCUMENTS_COLUMNS, results);
  assertEqual_('Verified_Income.columns 就是 VERIFIED_INCOME_COLUMNS', byName.Verified_Income.columns, VERIFIED_INCOME_COLUMNS, results);
  assertEqual_('Reconciliation_Log.columns 就是 RECONCILIATION_LOG_COLUMNS', byName.Reconciliation_Log.columns, RECONCILIATION_LOG_COLUMNS, results);
  assertEqual_('Compliance_Calendar.columns 就是 COMPLIANCE_CALENDAR_COLUMNS', byName.Compliance_Calendar.columns, COMPLIANCE_CALENDAR_COLUMNS, results);
  assertEqual_('Compliance_Completions.columns 就是 COMPLIANCE_COMPLETIONS_COLUMNS', byName.Compliance_Completions.columns, COMPLIANCE_COMPLETIONS_COLUMNS, results);
  assertEqual_('Daily_Allocation.columns 就是 DAILY_ALLOCATION_COLUMNS', byName.Daily_Allocation.columns, DAILY_ALLOCATION_COLUMNS, results);
  assertEqual_('Non_Order_Income_Allocation.columns 就是 NON_ORDER_INCOME_ALLOCATION_COLUMNS', byName.Non_Order_Income_Allocation.columns, NON_ORDER_INCOME_ALLOCATION_COLUMNS, results);

  // textColumns 里的每一个名字都必须真的存在于自己的 columns 里——
  // 这是 ensureSheetSchema_ 运行时会做的同一个检查，这里先在 Node 挡掉打字错
  SHEET_SCHEMAS_.forEach((schema) => {
    const allValid = schema.textColumns.every((col) => schema.columns.includes(col));
    assertEqual_(`${schema.name}.textColumns 全部都在 columns 里`, allValid, true, results);
  });

  // 金额/整数栏位不能被误列进 textColumns——列进去会让 Sheets 把它当文字，
  // SUM 之类的公式就不能用了
  const verifiedIncomeNumeric = ['net_delivery_income', 'incentive', 'tip', 'other_payments', 'total_deductions', 'net', 'amount'];
  assertEqual_(
    'Verified_Income 的金额栏位没有被误列进 textColumns',
    verifiedIncomeNumeric.some((col) => byName.Verified_Income.textColumns.includes(col)),
    false, results
  );

  const reconciliationNumeric = ['statement_total', 'rider_os_estimate', 'reward_sheet_total', 'rider_total', 'difference', 'difference_pct'];
  assertEqual_(
    'Reconciliation_Log 的金额栏位没有被误列进 textColumns',
    reconciliationNumeric.some((col) => byName.Reconciliation_Log.textColumns.includes(col)),
    false, results
  );

  assertEqual_(
    'Compliance_Calendar 的 reminder_lead_days 没有被误列进 textColumns',
    byName.Compliance_Calendar.textColumns.includes('reminder_lead_days'),
    false, results
  );

  const dailyAllocationNumeric = ['order_row_count', 'net_delivery_income', 'printed_daily_subtotal', 'checksum_difference'];
  assertEqual_(
    'Daily_Allocation 的金额/数量栏位没有被误列进 textColumns',
    dailyAllocationNumeric.some((col) => byName.Daily_Allocation.textColumns.includes(col)),
    false, results
  );
  assertEqual_(
    'Daily_Allocation 没有 month 栏位（Steven 明确要求，month 用 date.slice(0,7) 查，不落地存）',
    byName.Daily_Allocation.columns.includes('month'),
    false, results
  );

  assertEqual_(
    'Non_Order_Income_Allocation 的 amount 栏位没有被误列进 textColumns',
    byName.Non_Order_Income_Allocation.textColumns.includes('amount'),
    false, results
  );
  assertEqual_(
    'Non_Order_Income_Allocation 的 allocated_date 有被列进 textColumns（跟其他日期字符串栏位同一个防转换规则）',
    byName.Non_Order_Income_Allocation.textColumns.includes('allocated_date'),
    true, results
  );

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllSheetSetupTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllSheetSetupTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllSheetSetupTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] 真实 GAS 环境：Script Properties 设好 SPREADSHEET_ID 后执行
 *     setupComplianceOsSheets()，确认五张表都建好、表头文字正确
 * [ ] 表头列确认有 freeze（滚动时表头留在上面）
 * [ ] 在 Verified_Income 的 verified_at 栏位（或 Compliance_Calendar 的
 *     due_date）手动贴一个 ISO 字符串，确认储存格显示的还是原字符串，
 *     不会被 Sheets 静默转成日期
 * [ ] 在 Verified_Income 的 net 栏位贴数字，确认能被 SUM() 加总（没有被
 *     误设成 plain-text）
 * [ ] 对已经有资料、表头跟预期不一致的 Sheet 执行一次，确认会抛错而不是
 *     静默覆盖表头
 * [ ] 重复执行 setupComplianceOsSheets() 两次，确认第二次是 no-op
 *     （不会重复插入 Sheet、不会重复设格式导致的副作用）
 */
