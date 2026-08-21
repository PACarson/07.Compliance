/**
 * 141_Tests_VerifiedIncome.js
 * （样本文字/assertEqual_/fakeSheetAccessor_/fakeLockProvider_ 从
 * 105_TestUtils.js 来，不在这里重复定义。）
 */
if (typeof require === 'function') {
  var {
    buildVerifiedIncomeRecord_, buildIncomeVerifiedEvent_, writeVerifiedIncome_,
    verifyAndPublishIncome_, VERIFIED_INCOME_COLUMNS
  } = require('./140_VerifiedIncome.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { ParserRegistry } = require('./120_DocumentParsing.js');
  require('./121_GrabWeeklyParser.js');
  var { assertEqual_, fakeSheetAccessor_, fakeLockProvider_, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT } = require('./105_TestUtils.js');
}

function runAllVerifiedIncomeTests() {
  const results = [];

  const parser = ParserRegistry.getParserFor({ source: 'Grab', document_type: 'Weekly Statement' });
  const parsedStatement = parser.parse({ source: 'Grab', document_type: 'Weekly Statement' }, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT);
  const week = parsedStatement.document_meta.week;
  const fixedNow = new Date('2026-07-28T09:00:00Z');

  // ADR-003：这个函数现在完全不需要 Reconciliation 结果——这就是 Compliance OS
  // v1 能不依赖 Rider OS 独立运行的核心。net/amount 直接来自 parsedStatement
  // 自己的 summary.weekly_net（陈述值，CMP-P5），不经过任何对账步骤。
  const record = buildVerifiedIncomeRecord_(week, parsedStatement, fixedNow);
  assertEqual_('income_id', record.income_id, 'CMP-INCOME-2026-W30', results);
  assertEqual_('source 固定 Compliance OS（CMP-P2）', record.source, 'Compliance OS', results);
  assertEqual_('origin_platform 是 Grab（内部用）', record.origin_platform, 'Grab', results);
  assertEqual_('net 直接来自 parsedStatement.summary.weekly_net（不经过 Reconciliation）', record.net, 1734.10, results);
  assertEqual_('incentive 细项来自 parsedStatement', record.incentive, 557.10, results);
  assertEqual_('status 就是 Verified——解析成功即发布', record.status, 'Verified', results);

  // ============ 2026-08-21 新增：source_document_id / extractor_id 追溯栏位 ============
  const recordWithSource = buildVerifiedIncomeRecord_(week, parsedStatement, fixedNow, 'CMP-DOC-20260728-Grab-WeeklyStatement-1');
  assertEqual_('传了 sourceDocumentId：record.source_document_id 有记录', recordWithSource.source_document_id, 'CMP-DOC-20260728-Grab-WeeklyStatement-1', results);
  assertEqual_('extractor_id 直接读 parsedStatement._parser_id（这里是 GrabWeeklyParser）', recordWithSource.extractor_id, 'GrabWeeklyParser', results);
  assertEqual_('不传 sourceDocumentId（既有呼叫方不用改）：source_document_id 是 null，不是 undefined 或抛错', record.source_document_id, null, results);

  let threwOnMissingWeeklyNet = false;
  try { buildVerifiedIncomeRecord_(week, { document_meta: parsedStatement.document_meta, income_breakdown: parsedStatement.income_breakdown, summary: {} }, fixedNow); }
  catch (e) { threwOnMissingWeeklyNet = true; }
  results.push({ name: 'summary.weekly_net 缺失时抛错', pass: threwOnMissingWeeklyNet });

  let threwOnBadDate = false;
  try { buildVerifiedIncomeRecord_(week, parsedStatement, new Date('not-a-date')); }
  catch (e) { threwOnBadDate = true; }
  results.push({ name: 'now 不是合法 Date 时抛错', pass: threwOnBadDate });

  const event = buildIncomeVerifiedEvent_(record, 'CMP-EVT-20260728-0001');
  assertEqual_('event.income_id 跟 record 一致', event.income_id, record.income_id, results);
  assertEqual_('event.source 固定 Compliance OS', event.source, 'Compliance OS', results);

  const accessor = fakeSheetAccessor_();
  const truthWriter = createTruthWriter_(accessor, fakeLockProvider_());
  writeVerifiedIncome_(truthWriter, record);
  const writtenRow = accessor.getWritten('Verified_Income')[0];
  assertEqual_('写入的栏位数跟 VERIFIED_INCOME_COLUMNS 一致', writtenRow.length, VERIFIED_INCOME_COLUMNS.length, results);
  assertEqual_('写入第一栏是 income_id', writtenRow[0], record.income_id, results);

  const accessor2 = fakeSheetAccessor_();
  const truthWriter2 = createTruthWriter_(accessor2, fakeLockProvider_());
  const { record: r2, event: e2, skipped: skipped2 } = verifyAndPublishIncome_(week, parsedStatement, truthWriter2, 'CMP-EVT-20260728-0002', fixedNow);
  assertEqual_('端到端·record.income_id', r2.income_id, 'CMP-INCOME-2026-W30', results);
  assertEqual_('端到端·真的写进了 Sheet', accessor2.getWritten('Verified_Income').length, 1, results);
  assertEqual_('端到端·event_id 有带上', e2.event_id, 'CMP-EVT-20260728-0002', results);
  assertEqual_('端到端·没传 existingIncomeIds 时 skipped 是 false', skipped2, false, results);

  // ---- 幂等：existingIncomeIds 已经有这个 income_id 时，不重复写入 ----
  const accessor3 = fakeSheetAccessor_();
  const truthWriter3 = createTruthWriter_(accessor3, fakeLockProvider_());
  const dup = verifyAndPublishIncome_(week, parsedStatement, truthWriter3, 'CMP-EVT-20260728-0003', fixedNow, ['CMP-INCOME-2026-W30']);
  assertEqual_('幂等·skipped 是 true', dup.skipped, true, results);
  assertEqual_('幂等·event 是 null（没有真的发布）', dup.event, null, results);
  assertEqual_('幂等·完全没写进 Sheet', accessor3.getWritten('Verified_Income').length, 0, results);

  // ---- 幂等：existingIncomeIds 有值但不包含这个 income_id 时，照样正常发布 ----
  const accessor4 = fakeSheetAccessor_();
  const truthWriter4 = createTruthWriter_(accessor4, fakeLockProvider_());
  const notDup = verifyAndPublishIncome_(week, parsedStatement, truthWriter4, 'CMP-EVT-20260728-0004', fixedNow, ['CMP-INCOME-2026-W01', 'CMP-INCOME-2026-W02']);
  assertEqual_('不是同一笔·skipped 是 false', notDup.skipped, false, results);
  assertEqual_('不是同一笔·正常写进 Sheet', accessor4.getWritten('Verified_Income').length, 1, results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllVerifiedIncomeTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllVerifiedIncomeTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllVerifiedIncomeTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] EventPublisher.publish() 目前只 log，EventBus 真实调用方式确认后要接上
 * [ ] verified_at 存进 Sheet 要确认那一栏已经设成 plain-text('@') 格式
 */
