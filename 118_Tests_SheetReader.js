if (typeof require === 'function') {
  var { createSheetReader_ } = require('./117_SheetReader.js');
  var { assertEqual_, fakeSheetAccessor_ } = require('./105_TestUtils.js');
}

function runAllSheetReaderTests() {
  const results = [];

  const accessor = fakeSheetAccessor_();
  accessor.appendRow('Documents', ['CMP-DOC-1', 'Grab', 'Weekly Statement', 'Income', '2026-W30', 'hash1', 'file1', 'path1', 'Imported']);
  accessor.appendRow('Documents', ['CMP-DOC-2', 'Grab', 'Weekly Statement', 'Income', '2026-W31', 'hash2', 'file2', 'path2', 'Imported']);
  const reader = createSheetReader_(accessor);
  const columns = ['document_id', 'source', 'document_type', 'document_class', 'period', 'file_hash', 'drive_file_id', 'drive_path', 'status'];

  const rows = reader.readAll('Documents', columns);
  assertEqual_('读回两行', rows.length, 2, results);
  assertEqual_('第一行 document_id 对了', rows[0].document_id, 'CMP-DOC-1', results);
  assertEqual_('第一行 drive_file_id 对了', rows[0].drive_file_id, 'file1', results);
  assertEqual_('第二行 period 对了', rows[1].period, '2026-W31', results);

  assertEqual_('空表回传空阵列', reader.readAll('Verified_Income', columns).length, 0, results);

  let threwOnColumnMismatch = false;
  try {
    reader.readAll('Documents', ['只有一栏']);
  } catch (e) {
    threwOnColumnMismatch = true;
  }
  results.push({ name: '栏位数对不上时抛错，不猜怎么对应', pass: threwOnColumnMismatch });

  // 原样回传，不做任何猜测性转换（例如不会把空字串猜回 null）
  const accessor2 = fakeSheetAccessor_();
  accessor2.appendRow('Documents', ['CMP-DOC-3', 'Grab', 'Weekly Statement', 'Income', '2026-W32', 'hash3', 'file3', '', 'Imported']);
  const rows2 = createSheetReader_(accessor2).readAll('Documents', columns);
  assertEqual_('空字串就是空字串，不猜成 null', rows2[0].drive_path, '', results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllSheetReaderTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllSheetReaderTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllSheetReaderTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] 真实 GAS 环境下，表有表头但没有任何资料列时，确认 getAllRows 回传
 *     空阵列（不是回传含表头那一列）
 * [ ] 真实 Sheet 里如果有某个日期栏位被 Sheets 静默转成 Date 序列值（UEF
 *     Failure Catalog 那条已知教训），确认呼叫方（不是这个模块本身）有做
 *     防御性转换——这个模块刻意原样回传，不在这里面猜
 */
