/**
 * 111_Tests_DocumentImport.js
 */
if (typeof require === 'function') {
  var {
    computeDocumentId_, isDuplicateHash_, computeSuggestedFileName_, computeSuggestedFolderPath_,
    importDocument_, processGrabStatement_, DOCUMENTS_COLUMNS
  } = require('./110_DocumentImport.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { createRiderOSAdapter_ } = require('./123_RiderOSAdapter.js');
  require('./120_DocumentParsing.js');
  require('./121_GrabWeeklyParser.js');
  require('./130_Reconciliation.js');
  require('./140_VerifiedIncome.js');
  require('./112_DocumentTextExtractor.js');
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

  // ---- 建议的 Drive 文件名 / 目录 ----
  assertEqual_('建议文件名格式', computeSuggestedFileName_('Grab', 'WEEKLY', '2026-W30'), 'GRAB_WEEKLY_2026_W30.pdf', results);
  assertEqual_('建议文件名格式（EPF 月结单）', computeSuggestedFileName_('EPF', 'STATEMENT', '2026-07'), 'EPF_STATEMENT_2026_07.pdf', results);
  assertEqual_('建议目录路径', computeSuggestedFolderPath_('Grab', '2026', 'Weekly Statements'), 'Compliance OS/Grab/2026/Weekly Statements', results);

  // ---- 去重判断 ----
  assertEqual_('已存在的 hash 判定为重复', isDuplicateHash_('abc123', ['xyz', 'abc123']), true, results);
  assertEqual_('不存在的 hash 判定为不重复', isDuplicateHash_('abc123', ['xyz']), false, results);

  let threwEmptyHash = false;
  try { isDuplicateHash_('', ['x']); } catch (e) { threwEmptyHash = true; }
  results.push({ name: '空 fileHash 时抛错', pass: threwEmptyHash });

  // ---- importDocument_：重复文件要跳过，不写入 ----
  const accessor1 = fakeSheetAccessor_();
  const deps1 = { truthWriter: createTruthWriter_(accessor1, fakeLockProvider_()), now: fixedNow };
  const dup = importDocument_(
    { fileHash: 'abc123', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', driveFileId: 'x', drivePath: 'Compliance OS/Grab/2026', existingHashes: ['abc123'] },
    deps1
  );
  assertEqual_('重复文件·status', dup.status, 'Duplicate_Skipped', results);
  assertEqual_('重复文件·不写入 Documents', accessor1.getWritten('Documents').length, 0, results);

  // ---- importDocument_：新文件要正确导入、写入（含新的 drive_file_id/drive_path 栏位）----
  const accessor2 = fakeSheetAccessor_();
  const deps2 = { truthWriter: createTruthWriter_(accessor2, fakeLockProvider_()), now: fixedNow };
  const imported = importDocument_(
    { fileHash: 'def456', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', driveFileId: '1AbCdEfGh', drivePath: 'Compliance OS/Grab/2026/Weekly Statements', existingHashes: ['abc123'] },
    deps2
  );
  assertEqual_('新文件·status', imported.status, 'Imported', results);
  assertEqual_('新文件·Documents 写了一行', accessor2.getWritten('Documents').length, 1, results);
  assertEqual_('新文件·写入栏位数正确', accessor2.getWritten('Documents')[0].length, DOCUMENTS_COLUMNS.length, results);
  assertEqual_('新文件·drive_file_id 栏位正确', accessor2.getWritten('Documents')[0][DOCUMENTS_COLUMNS.indexOf('drive_file_id')], '1AbCdEfGh', results);
  assertEqual_('新文件·drive_path 栏位正确', accessor2.getWritten('Documents')[0][DOCUMENTS_COLUMNS.indexOf('drive_path')], 'Compliance OS/Grab/2026/Weekly Statements', results);

  // ---- importDocument_：drivePath 是可选的（不给就是空字符串，不是缺栏位抛错）----
  const accessor2b = fakeSheetAccessor_();
  const deps2b = { truthWriter: createTruthWriter_(accessor2b, fakeLockProvider_()), now: fixedNow };
  const importedNoPath = importDocument_(
    { fileHash: 'jkl000', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W31', driveFileId: '1XyZ', existingHashes: [] },
    deps2b
  );
  assertEqual_('drivePath 省略时不报错', importedNoPath.status, 'Imported', results);

  // ---- processGrabStatement_：完整链路（有 Rider OS 数据）----
  const accessor3 = fakeSheetAccessor_();
  const riderAdapter = createRiderOSAdapter_(fakeStore_());
  riderAdapter.onWeeklyEstimateReady({ week: '2026-W30', daily_estimate_total: 1720.00, reward_estimate_total: 14.10, status: 'Ready' });
  const deps3 = { truthWriter: createTruthWriter_(accessor3, fakeLockProvider_()), riderOSAdapter: riderAdapter, now: fixedNow };
  const chainResult = processGrabStatement_(
    { fileHash: 'ghi789', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', driveFileId: '1QwErTy', drivePath: 'Compliance OS/Grab/2026/Weekly Statements', existingHashes: [] },
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
    deps3
  );
  assertEqual_('完整链路·stage', chainResult.stage, 'Verified', results);
  assertEqual_('完整链路·Verified Income 真的发布了', chainResult.verifyResult.record.status, 'Verified', results);
  assertEqual_('完整链路·对账 Matched', chainResult.reconciliationResult.status, 'Matched', results);
  assertEqual_('完整链路·Verified_Income 写了', accessor3.getWritten('Verified_Income').length, 1, results);
  assertEqual_('完整链路·Reconciliation_Log 也写了', accessor3.getWritten('Reconciliation_Log').length, 1, results);

  // ---- processGrabStatement_：ADR-003 核心——完全没有 Rider OS 数据时，
  // Verified Income 照样发布（Compliance OS v1 不依赖 Rider OS 独立运行）----
  const accessor3b = fakeSheetAccessor_();
  const emptyRiderAdapter = createRiderOSAdapter_(fakeStore_());
  const deps3b = { truthWriter: createTruthWriter_(accessor3b, fakeLockProvider_()), riderOSAdapter: emptyRiderAdapter, now: fixedNow };
  const noRiderResult = processGrabStatement_(
    { fileHash: 'stu222', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', driveFileId: '1NoRider', existingHashes: [] },
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
    deps3b
  );
  assertEqual_('无 Rider OS 数据·stage 仍是 Verified', noRiderResult.stage, 'Verified', results);
  assertEqual_('无 Rider OS 数据·Verified Income 仍然发布', noRiderResult.verifyResult.record.status, 'Verified', results);
  assertEqual_('无 Rider OS 数据·reconciliationResult.status 是 Not_Performed', noRiderResult.reconciliationResult.status, 'Not_Performed', results);
  assertEqual_('无 Rider OS 数据·Verified_Income 照样写了', accessor3b.getWritten('Verified_Income').length, 1, results);
  assertEqual_('无 Rider OS 数据·Reconciliation_Log 也写了（Not_Performed 留痕）', accessor3b.getWritten('Reconciliation_Log').length, 1, results);

  // ---- processGrabStatement_：ADR-003 的非阻断保证——就算 Reconciliation
  // 端丢一个「预期外」的例外（不是正常的没数据 null，是真的坏掉），已经
  // 发布的 Verified Income 也不能跟着报错 ----
  const accessor3c = fakeSheetAccessor_();
  const throwingRiderAdapter = { getWeeklyEstimate() { throw new Error('模拟 Rider OS Adapter 未预期的故障'); } };
  const deps3c = { truthWriter: createTruthWriter_(accessor3c, fakeLockProvider_()), riderOSAdapter: throwingRiderAdapter, now: fixedNow };
  let threwDespiteReconciliationError = false;
  let resultDespiteReconciliationError = null;
  try {
    resultDespiteReconciliationError = processGrabStatement_(
      { fileHash: 'vwx333', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', driveFileId: '1BadAdapter', existingHashes: [] },
      TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
      deps3c
    );
  } catch (e) {
    threwDespiteReconciliationError = true;
  }
  results.push({ name: 'Reconciliation 未预期例外·processGrabStatement_ 本身不抛错', pass: !threwDespiteReconciliationError });
  assertEqual_('Reconciliation 未预期例外·Verified Income 仍然发布', resultDespiteReconciliationError && resultDespiteReconciliationError.verifyResult.record.status, 'Verified', results);
  assertEqual_('Reconciliation 未预期例外·reconciliationResult 是 null（失败了，不是假装成功）', resultDespiteReconciliationError && resultDespiteReconciliationError.reconciliationResult, null, results);
  assertEqual_('Reconciliation 未预期例外·Verified_Income 确实写进 Sheet 了', accessor3c.getWritten('Verified_Income').length, 1, results);

  // ---- processGrabStatement_：不给 extractedText 时会走 DocumentTextExtractor（目前占位，应该抛错，不是静默失败）----
  const accessor4 = fakeSheetAccessor_();
  const deps4 = { truthWriter: createTruthWriter_(accessor4, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
  let threwOnNoExtractor = false;
  try {
    processGrabStatement_(
      { fileHash: 'mno111', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W32', driveFileId: '1NoText', existingHashes: [] },
      undefined,
      deps4
    );
  } catch (e) {
    threwOnNoExtractor = true;
  }
  results.push({ name: '不给 extractedText 时走占位 Extractor 并正确抛错', pass: threwOnNoExtractor });
  // 但 Import 阶段应该已经先成功写入了（duplicate check 和 import 发生在 extractor 调用之前）
  assertEqual_('占位 Extractor 抛错前，Documents 已经先写好了', accessor4.getWritten('Documents').length, 1, results);

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
 * [ ] computeFileHash_() 需要真实 GAS 的 Utilities 服务，Node 环境测不了
 * [ ] drive_path 是缓存不是真相来源——如果 Drive 里手动搬动过文件，这个
 *     栏位可能过期；真的需要准确路径时应该查 Drive，不是只信这个栏位
 * [ ] DocumentTextExtractor 接上真实实现（Drive OCR / LLM API）后，确认
 *     processGrabStatement_() 不再需要手动传 extractedText 也能跑通
 * [ ] existingHashes 目前是外部传入——等有读 Sheet 的工具后，要确认真的会
 *     去读 Documents 表全部现有的 file_hash
 * [ ] ADR-003：真实环境下让 riderOSAdapter.getWeeklyEstimate 丢一个未预期的
 *     例外（不是正常的 null），确认 processGrabStatement_ 仍然回传已经发布
 *     好的 verifyResult，不会整个调用都失败
 */
