/**
 * 131_Tests_Reconciliation.js
 * （assertEqual_/fakeStore_/fakeSheetAccessor_/fakeLockProvider_ 从
 * 105_TestUtils.js 来，不在这里重复定义。）
 */
if (typeof require === 'function') {
  var { reconcileStatement_, recordReconciliationResult_, runReconciliationForWeek_, RECONCILIATION_LOG_COLUMNS } = require('./130_Reconciliation.js');
  var { createRiderOSAdapter_ } = require('./123_RiderOSAdapter.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { assertEqual_, fakeStore_, fakeSheetAccessor_, fakeLockProvider_ } = require('./105_TestUtils.js');
}

function sampleParsedStatement_(weeklyNet) {
  return {
    document_meta: { currency: 'MYR', source: 'Grab' },
    summary: { total_income: weeklyNet, total_deductions: 0, weekly_net: weeklyNet },
    income_breakdown: {
      net_delivery_income: { amount: weeklyNet - 550 },
      incentive: { amount: 500 },
      tip: { amount: 30 },
      other_payments: { amount: 20 }
    }
  };
}

function runAllReconciliationTests() {
  const results = [];
  const fixedNow = new Date('2026-07-28T09:00:00Z');

  const r1 = reconcileStatement_(sampleParsedStatement_(1734.10), { daily_estimate_total: 1720.00, reward_estimate_total: 14.10 });
  assertEqual_('完全吻合·status', r1.status, 'Auto_Verified', results);
  assertEqual_('完全吻合·reason', r1.reason, 'Exact_Match', results);

  const r2 = reconcileStatement_(sampleParsedStatement_(1734.10), { daily_estimate_total: 1720.00, reward_estimate_total: 11.10 });
  assertEqual_('容差内·reason', r2.reason, 'Within_Tolerance', results);

  const r3 = reconcileStatement_(sampleParsedStatement_(1734.10), { daily_estimate_total: 1650.00, reward_estimate_total: 34.10 });
  assertEqual_('超出容差·status', r3.status, 'Needs_Review', results);

  const r4 = reconcileStatement_(sampleParsedStatement_(1000.00), { daily_estimate_total: 995.00, reward_estimate_total: 0.00 });
  assertEqual_('容差边界·status', r4.status, 'Auto_Verified', results);

  let threw1 = false;
  try { reconcileStatement_({ summary: {} }, { daily_estimate_total: 1, reward_estimate_total: 1 }); } catch (e) { threw1 = true; }
  results.push({ name: 'parsedStatement 缺字段抛错', pass: threw1 });

  const accessor = fakeSheetAccessor_();
  const truthWriter = createTruthWriter_(accessor, fakeLockProvider_());
  const recId = recordReconciliationResult_('2026-W30', r1, truthWriter, fixedNow);
  assertEqual_('reconciliation_id 格式正确', recId, 'CMP-REC-2026-W30-1785229200000', results);
  assertEqual_('Reconciliation_Log 真的写了一行', accessor.getWritten('Reconciliation_Log').length, 1, results);
  assertEqual_('写入栏位数正确', accessor.getWritten('Reconciliation_Log')[0].length, RECONCILIATION_LOG_COLUMNS.length, results);

  const emptyAdapter = createRiderOSAdapter_(fakeStore_());
  const deps1 = { riderOSAdapter: emptyAdapter, truthWriter: createTruthWriter_(fakeSheetAccessor_(), fakeLockProvider_()), now: fixedNow };
  const waiting = runReconciliationForWeek_('2026-W30', sampleParsedStatement_(1734.10), deps1);
  assertEqual_('未到齐·status', waiting.status, 'Waiting_For_Rider_Estimate', results);

  const readyAdapter = createRiderOSAdapter_(fakeStore_());
  readyAdapter.onWeeklyEstimateReady({ week: '2026-W30', daily_estimate_total: 1720.00, reward_estimate_total: 14.10, status: 'Ready' });
  const accessor2 = fakeSheetAccessor_();
  const deps2 = { riderOSAdapter: readyAdapter, truthWriter: createTruthWriter_(accessor2, fakeLockProvider_()), now: fixedNow };
  const done = runReconciliationForWeek_('2026-W30', sampleParsedStatement_(1734.10), deps2);
  assertEqual_('Auto_Verified 全流程·status', done.status, 'Auto_Verified', results);
  assertEqual_('Auto_Verified 全流程·有 reconciliation_id', typeof done.reconciliation_id, 'string', results);
  assertEqual_('Auto_Verified 全流程·verifiedIncome 不是 null', done.verifiedIncome !== null, true, results);
  assertEqual_('Auto_Verified 全流程·Reconciliation_Log 写了', accessor2.getWritten('Reconciliation_Log').length, 1, results);
  assertEqual_('Auto_Verified 全流程·Verified_Income 也写了', accessor2.getWritten('Verified_Income').length, 1, results);

  const readyAdapter2 = createRiderOSAdapter_(fakeStore_());
  readyAdapter2.onWeeklyEstimateReady({ week: '2026-W31', daily_estimate_total: 1000.00, reward_estimate_total: 0, status: 'Ready' });
  const accessor3 = fakeSheetAccessor_();
  const deps3 = { riderOSAdapter: readyAdapter2, truthWriter: createTruthWriter_(accessor3, fakeLockProvider_()), now: fixedNow };
  const needsReview = runReconciliationForWeek_('2026-W31', sampleParsedStatement_(1734.10), deps3);
  assertEqual_('Needs_Review·status', needsReview.status, 'Needs_Review', results);
  assertEqual_('Needs_Review·verifiedIncome 是 null', needsReview.verifiedIncome, null, results);
  assertEqual_('Needs_Review·Reconciliation_Log 还是写了（留痕）', accessor3.getWritten('Reconciliation_Log').length, 1, results);
  assertEqual_('Needs_Review·Verified_Income 没有写', accessor3.getWritten('Verified_Income').length, 0, results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${r.actual}, expected ${r.expected})`));
  });
  console.log(allPass ? '\n=== runAllReconciliationTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllReconciliationTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllReconciliationTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] 容差门槛（RM5 / 0.5%）还没被真实数据验证——跑几周真实数据后回来看
 * [ ] 真实 GAS 环境下确认两张表都已经建好、栏位对得上
 * [ ] Needs_Review 案例目前只留痕，不会主动通知——评估要不要额外提醒
 */
