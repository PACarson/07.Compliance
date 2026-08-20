/**
 * 116_Tests_TruthWriter.js
 * （共用 helper 从 105_TestUtils.js 来，不在这里重复定义——见该文件顶部
 * 说明为什么：重复定义在 GAS 单一全局作用域下是真实风险，不是理论风险。）
 */
if (typeof require === 'function') {
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { assertEqual_, fakeSheetAccessor_, fakeLockProvider_ } = require('./105_TestUtils.js');
}

function runAllTruthWriterTests() {
  const results = [];

  const accessor1 = fakeSheetAccessor_();
  const lock1 = fakeLockProvider_();
  const writer1 = createTruthWriter_(accessor1, lock1);
  const row = writer1.appendValidatedRow(
    'Verified_Income',
    { income_id: 'CMP-INCOME-2026-W30', net: 1734.10, source: 'Compliance OS' },
    ['income_id', 'source', 'net']
  );
  assertEqual_('栏位按 columnOrder 排序', row, ['CMP-INCOME-2026-W30', 'Compliance OS', 1734.10], results);
  assertEqual_('实际写进假 accessor 的内容一致', accessor1.getWritten('Verified_Income')[0], row, results);

  const writer2 = createTruthWriter_(fakeSheetAccessor_(), fakeLockProvider_());
  let threw = false;
  try {
    writer2.appendValidatedRow('Verified_Income', { income_id: 'X' }, ['income_id', 'net']);
  } catch (e) {
    threw = true;
  }
  results.push({ name: '缺栏位时抛错', pass: threw });

  const writer3 = createTruthWriter_(fakeSheetAccessor_(), fakeLockProvider_());
  const row3 = writer3.appendValidatedRow('Compliance_Calendar', { obligation_id: 'X', completed_at: null }, ['obligation_id', 'completed_at']);
  assertEqual_('null 转成空字符串写入，不抛错', row3, ['X', ''], results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllTruthWriterTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllTruthWriterTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllTruthWriterTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] Script Properties 已设定 SPREADSHEET_ID（gasSheetAccessor_ 2026-08-20
 *     改用 SpreadsheetApp.openById() 取代 getActive()——这个项目是 standalone
 *     script、没有绑定容器，getActive() 在任何情境下都拿不到 Spreadsheet；
 *     不设这个 Script Property，appendRow/getAllRows 会直接抛错）
 * [ ] 真实 GAS 环境下确认 LockService.getScriptLock().waitLock(10000) 在
 *     并发写入时真的会排队而不是互相覆盖
 * [ ] 确认目标 Sheet 建立时相关栏位已经设成 plain-text('@') 格式
 */
