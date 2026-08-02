/**
 * 122_Tests_GrabWeeklyParser.js
 * （样本文字 + assertEqual_ 从 105_TestUtils.js 来，不在这里重复定义。）
 */
if (typeof require === 'function') {
  var { ParserRegistry } = require('./120_DocumentParsing.js');
  require('./121_GrabWeeklyParser.js');
  var { assertEqual_, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT_WITH_GLOSSARY_DECOY } = require('./105_TestUtils.js');
}

const TEST_DOCUMENT = { source: 'Grab', document_type: 'Weekly Statement' };

function runAllGrabWeeklyParserTests() {
  const results = [];

  const parser = ParserRegistry.getParserFor(TEST_DOCUMENT);
  assertEqual_('parserId 匹配', parser.parserId(), 'GrabWeeklyParser', results);

  const result = parser.parse(TEST_DOCUMENT, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT);
  assertEqual_('period_start', result.document_meta.period_start, '2026-07-20', results);
  assertEqual_('period_end', result.document_meta.period_end, '2026-07-26', results);
  assertEqual_('week', result.document_meta.week, '2026-W30', results);
  assertEqual_('total_income', result.summary.total_income, 1734.1, results);
  assertEqual_('weekly_net', result.summary.weekly_net, 1734.1, results);
  assertEqual_('net_delivery_income', result.income_breakdown.net_delivery_income.amount, 1146.0, results);
  assertEqual_('incentive', result.income_breakdown.incentive.amount, 557.1, results);
  assertEqual_('tip', result.income_breakdown.tip.amount, 19.0, results);
  assertEqual_('other_payments', result.income_breakdown.other_payments.amount, 12.0, results);
  assertEqual_('一致性检查·净派送收入', result._consistency_check.net_delivery_stated_vs_computed_diff, 0, results);
  assertEqual_('一致性检查·总收入', result._consistency_check.total_income_stated_vs_recomputed_diff, 0, results);

  const decoyResult = parser.parse(TEST_DOCUMENT, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT_WITH_GLOSSARY_DECOY);
  assertEqual_('抗干扰·incentive 不被 888.88 污染', decoyResult.income_breakdown.incentive.amount, 557.1, results);
  assertEqual_('抗干扰·tip 不被 999.99 污染', decoyResult.income_breakdown.tip.amount, 19.0, results);
  assertEqual_(
    '抗干扰·commission 不被 777.77 污染',
    decoyResult.income_breakdown.net_delivery_income.components.commission.amount,
    0.0,
    results
  );

  let threwOnMissingField = false;
  try {
    parser.parse(TEST_DOCUMENT, 'Ringkasan\nJumlah Pendapatan\n1,734.10\nButiran pendapatan');
  } catch (e) {
    threwOnMissingField = true;
  }
  results.push({ name: '缺字段时抛错（非静默）', pass: threwOnMissingField });

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${r.actual}, expected ${r.expected})`));
  });
  console.log(allPass ? '\n=== runAllGrabWeeklyParserTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllGrabWeeklyParserTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllGrabWeeklyParserTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] 用 Document Import Engine 实际从 Drive 抽取一份真实 Grab PDF 的文字，
 *     确认抽取出来的文字格式跟这里的重建样本一致
 * [ ] 在真实 GAS 环境（非 Node）跑一次，确认 AlertService.log 真的被调用到
 * [ ] 把 parse() 的输出写进 Parsed_Statements 表后重新读回来，确认字符串
 *     字段没有被 Sheets 静默转成日期序列值
 */
