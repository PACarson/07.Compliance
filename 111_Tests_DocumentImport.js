/**
 * 111_Tests_DocumentImport.js
 */
if (typeof require === 'function') {
  var {
    computeDocumentId_, isDuplicateHash_, importDocument_, processGrabStatement_, DOCUMENTS_COLUMNS
  } = require('./110_DocumentImport.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { createRiderOSAdapter_ } = require('./123_RiderOSAdapter.js');
  require('./120_DocumentParsing.js');
  require('./121_GrabWeeklyParser.js');
  require('./130_Reconciliation.js');
  require('./140_VerifiedIncome.js');
  var { assertEqual_, fakeStore_, fakeSheetAccessor_, fakeLockProvider_, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT } = require('./105_TestUtils.js');
}

function runAllDocumentImportTests() {
  const results = [];
  const fixedNow = new Date('2026-07-28T09:00:00Z');

  // ---- document_id 格式 ----
  const id = computeDocumentId_('Grab', 'Weekly Statement', fixedNow);
  assertEqual_('document_id 格式', id, 'CMP-DOC-20260728-Grab-WeeklyStatement-1785229200000', results);

  let threwBadDate = false;
  try { computeDocumentId_('Grab', 'Weekly Statement', new Date('not-a-date')); } catch (e) { threwBadDate = true; }
  results.push({ name: 'now 不合法时抛错', pass: threwBadDate });

  // ---- 去重判断 ----
  assertEqual_('已存在的 hash 判定为重复', isDuplicateHash_('abc123', ['xyz', 'abc123']), true, results);
  assertEqual_('不存在的 hash 判定为不重复', isDuplicateHash_('abc123', ['xyz']), false, results);
  assertEqual_('空清单判定为不重复', isDuplicateHash_('abc123', []), false, results);

  let threwEmptyHash = false;
  try { isDuplicateHash_('', ['x']); } catch (e) { threwEmptyHash = true; }
  results.push({ name: '空 fileHash 时抛错', pass: threwEmptyHash });

  // ---- importDocument_：重复文件要跳过，不写入 ----
  const accessor1 = fakeSheetAccessor_();
  const deps1 = { truthWriter: createTruthWriter_(accessor1, fakeLockProvider_()), now: fixedNow };
  const dup = importDocument_(
    { fileHash: 'abc123', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', originalFileUrl: 'x', existingHashes: ['abc123'] },
    deps1
  );
  assertEqual_('重复文件·status', dup.status, 'Duplicate_Skipped', results);
  assertEqual_('重复文件·不写入 Documents', accessor1.getWritten('Documents').length, 0, results);

  // ---- importDocument_：新文件要正确导入、写入 ----
  const accessor2 = fakeSheetAccessor_();
  const deps2 = { truthWriter: createTruthWriter_(accessor2, fakeLockProvider_()), now: fixedNow };
  const imported = importDocument_(
    { fileHash: 'def456', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', originalFileUrl: 'https://drive/x', existingHashes: ['abc123'] },
    deps2
  );
  assertEqual_('新文件·status', imported.status, 'Imported', results);
  assertEqual_('新文件·有 document_id', typeof imported.document_id, 'string', results);
  assertEqual_('新文件·Documents 写了一行', accessor2.getWritten('Documents').length, 1, results);
  assertEqual_('新文件·写入栏位数正确', accessor2.getWritten('Documents')[0].length, DOCUMENTS_COLUMNS.length, results);
  assertEqual_('新文件·status 栏位是 Imported', accessor2.getWritten('Documents')[0][DOCUMENTS_COLUMNS.indexOf('status')], 'Imported', results);

  // ---- processGrabStatement_：完整链路（Import → Parse → Reconciliation → Verified Income）----
  const accessor3 = fakeSheetAccessor_();
  const riderAdapter = createRiderOSAdapter_(fakeStore_());
  riderAdapter.onWeeklyEstimateReady({ week: '2026-W30', daily_estimate_total: 1720.00, reward_estimate_total: 14.10, status: 'Ready' });
  const deps3 = { truthWriter: createTruthWriter_(accessor3, fakeLockProvider_()), riderOSAdapter: riderAdapter, now: fixedNow };
  const chainResult = processGrabStatement_(
    { fileHash: 'ghi789', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', originalFileUrl: 'https://drive/y', existingHashes: [] },
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
    deps3
  );
  assertEqual_('完整链路·stage', chainResult.stage, 'Reconciliation', results);
  assertEqual_('完整链路·Import 成功', chainResult.importResult.status, 'Imported', results);
  assertEqual_('完整链路·对账 Auto_Verified', chainResult.reconciliationResult.status, 'Auto_Verified', results);
  assertEqual_('完整链路·Documents 写了', accessor3.getWritten('Documents').length, 1, results);
  assertEqual_('完整链路·Reconciliation_Log 写了', accessor3.getWritten('Reconciliation_Log').length, 1, results);
  assertEqual_('完整链路·Verified_Income 写了', accessor3.getWritten('Verified_Income').length, 1, results);

  // ---- processGrabStatement_：重复文件要在 Import 阶段就停下，不往下跑 Parse/Reconciliation ----
  const accessor4 = fakeSheetAccessor_();
  const deps4 = { truthWriter: createTruthWriter_(accessor4, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
  const dupChain = processGrabStatement_(
    { fileHash: 'ghi789', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', originalFileUrl: 'x', existingHashes: ['ghi789'] },
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
    deps4
  );
  assertEqual_('重复文件链路·在 Import 阶段停下', dupChain.stage, 'Import', results);
  assertEqual_('重复文件链路·完全没有写入任何表', accessor4.getWritten('Documents').length + accessor4.getWritten('Reconciliation_Log').length + accessor4.getWritten('Verified_Income').length, 0, results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllDocumentImportTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllDocumentImportTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllDocumentImportTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] computeFileHash_() 需要真实 GAS 的 Utilities 服务，Node 环境测不了——
 *     真实 GAS 里确认对同一份文件重复算出来的 hash 一致，对不同文件不同
 * [ ] originalFileUrl 目前是外部传入——需要确认：文件到底要存进哪个 Drive
 *     目录？谁负责在那之前把 Telegram 上传的文件存进 Drive 并拿到 URL？
 * [ ] extractedText 目前是外部传入——需要确认：PDF → 文字要怎么做（Advanced
 *     Drive Service 转 Google Doc 再读文字？还是别的方式？）
 * [ ] existingHashes 目前是外部传入——等有读 Sheet 的工具后，要确认真的会
 *     去读 Documents 表全部现有的 file_hash，不是漏掉分页或漏掉某些列
 */
