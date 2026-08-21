/**
 * 111_Tests_DocumentImport.js
 */
if (typeof require === 'function') {
  var {
    computeDocumentId_, isDuplicateHash_, computeSuggestedFileName_, computeSuggestedFolderPath_,
    importDocument_, runImportPipeline_, processGrabStatement_, DOCUMENTS_COLUMNS
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

  // ============ runImportPipeline_：批次汇入要靠的共用核心（不丢例外）============

  // ---- 重复文件：stage 是 Skipped_Duplicate，欄位叫 importResult 不是 result ----
  const accessor5 = fakeSheetAccessor_();
  accessor5.appendRow('Documents', ['x', 'Grab', 'Weekly Statement', 'Income', '2026-W30', 'dup-hash', 'f1', '', 'Imported']);
  const deps5 = { truthWriter: createTruthWriter_(accessor5, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
  const dupPipelineResult = runImportPipeline_(
    { fileHash: 'dup-hash', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', driveFileId: 'f1', existingHashes: ['dup-hash'] },
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
    deps5
  );
  assertEqual_('runImportPipeline_·重复文件·stage', dupPipelineResult.stage, 'Skipped_Duplicate', results);
  assertEqual_('runImportPipeline_·重复文件·importResult.status', dupPipelineResult.importResult.status, 'Duplicate_Skipped', results);

  // ---- 抽取失败：结构化回传 Extraction_Failed，不丢例外（占位 Extractor 会抛错，正好拿来测）----
  const accessor6 = fakeSheetAccessor_();
  const deps6 = { truthWriter: createTruthWriter_(accessor6, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
  let threwOnExtractionFailedPipeline = false;
  let extractionFailedResult = null;
  try {
    extractionFailedResult = runImportPipeline_(
      { fileHash: 'pqr222', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W33', driveFileId: '1BadPdf', existingHashes: [] },
      undefined,
      deps6
    );
  } catch (e) { threwOnExtractionFailedPipeline = true; }
  results.push({ name: 'runImportPipeline_·抽取失败·不丢例外（批次要能继续跑下一个文件）', pass: !threwOnExtractionFailedPipeline });
  assertEqual_('runImportPipeline_·抽取失败·stage', extractionFailedResult && extractionFailedResult.stage, 'Extraction_Failed', results);
  assertEqual_('runImportPipeline_·抽取失败·有带 error 讯息', typeof (extractionFailedResult && extractionFailedResult.error), 'string', results);
  assertEqual_('runImportPipeline_·抽取失败·Documents 还是先写好了（Import 阶段本来就在抽取之前）', accessor6.getWritten('Documents').length, 1, results);

  // ---- 解析失败：结构化回传 Parse_Failed，不丢例外 ----
  const accessor7 = fakeSheetAccessor_();
  const deps7 = { truthWriter: createTruthWriter_(accessor7, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
  const parseFailedResult = runImportPipeline_(
    { fileHash: 'stu333', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W34', driveFileId: '1GarbageText', existingHashes: [] },
    '这份文件里面完全没有 Grab Weekly Statement 该有的任何栏位标签',
    deps7
  );
  assertEqual_('runImportPipeline_·解析失败·stage', parseFailedResult.stage, 'Parse_Failed', results);
  assertEqual_('runImportPipeline_·解析失败·Verified_Income 完全没写', accessor7.getWritten('Verified_Income').length, 0, results);

  // ---- processGrabStatement_ 仍然维持既有「失败就 throw」契约（薄封装，不是行为改变）----
  const accessor8 = fakeSheetAccessor_();
  const deps8 = { truthWriter: createTruthWriter_(accessor8, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
  let threwViaThinWrapper = false;
  try {
    processGrabStatement_(
      { fileHash: 'vwx444', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W35', driveFileId: '1GarbageText2', existingHashes: [] },
      '一样是垃圾文字，不含任何有效栏位',
      deps8
    );
  } catch (e) { threwViaThinWrapper = true; }
  results.push({ name: 'processGrabStatement_·Parse_Failed 仍然 throw（既有契约不变）', pass: threwViaThinWrapper });

  // ---- Retry：skipImport 跳过 importDocument_，不会重复写 Documents，直接从抽取开始 ----
  const accessor9 = fakeSheetAccessor_();
  // 先模拟「第一次尝试」已经写过 Documents 了（例如上一轮批次汇入时抽取失败，但 Import 阶段已经成功）
  accessor9.appendRow('Documents', ['CMP-DOC-old', 'Grab', 'Weekly Statement', 'Income', 'Pending', 'retry-hash', '1RetryFile', '', 'Imported']);
  const deps9 = { truthWriter: createTruthWriter_(accessor9, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
  const retryResult = runImportPipeline_(
    { skipImport: true, source: 'Grab', documentType: 'Weekly Statement', driveFileId: '1RetryFile' },
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
    deps9
  );
  assertEqual_('Retry·跳过 Import，直接成功走到 Verified', retryResult.stage, 'Verified', results);
  assertEqual_('Retry·importResult.status 是 Already_Imported（没有真的又调用一次 importDocument_）', retryResult.importResult.status, 'Already_Imported', results);
  assertEqual_('Retry·Documents 没有被重复写入第二次', accessor9.getWritten('Documents').length, 1, results);

  // ---- Already_Verified：existingIncomeIds 已经有这个 week 时，跳过重复发布，但不当失败 ----
  const accessor10 = fakeSheetAccessor_();
  const deps10 = { truthWriter: createTruthWriter_(accessor10, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow, existingIncomeIds: ['CMP-INCOME-2026-W30'] };
  const alreadyVerifiedResult = runImportPipeline_(
    { fileHash: 'yz555', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: '2026-W30', driveFileId: '1AlreadyDone', existingHashes: [] },
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
    deps10
  );
  assertEqual_('Already_Verified·stage', alreadyVerifiedResult.stage, 'Already_Verified', results);
  assertEqual_('Already_Verified·没有真的再写一次 Verified_Income', accessor10.getWritten('Verified_Income').length, 0, results);

  // ============ mode='structured'（LLM 路径）============
  // DocumentTextExtractor 是 110 require 进来、跟真正呼叫方共用同一个物件
  // 实例（模组快取）——直接把它的 .extract 换掉再还原，不用改
  // runImportPipeline_ 的签名多开一个注入口，改动范围维持最小。
  const { DocumentTextExtractor } = require('./112_DocumentTextExtractor.js');
  const originalExtract_ = DocumentTextExtractor.extract;
  function withMockedExtractor_(envelope, fn) {
    DocumentTextExtractor.extract = function () { return envelope; };
    try { fn(); } finally { DocumentTextExtractor.extract = originalExtract_; }
  }

  const validCandidateForPipeline_ = {
    document_meta: {
      source: 'Grab', document_type: 'Weekly Statement', currency: 'MYR',
      period_start_parts: { year: 2026, month: 7, day: 20 },
      period_end_parts: { year: 2026, month: 7, day: 26 }
    },
    summary: { total_income: 500, total_deductions: 50, weekly_net: 450 },
    income_breakdown: { net_delivery_income: 300, incentive: 100, tip: 80, other_payments: 20 },
    extraction_notes: ''
  };

  // ---- structured + 合法 candidate：走到 Verified，source_document_id/extractor_id 有记录 ----
  withMockedExtractor_(
    { mode: 'structured', candidate: validCandidateForPipeline_, evidence: { extractorId: 'LLMExtractor:test-model', extractionVersion: '2026-08-21T00:00:00.000Z', evidenceFileId: 'ev-1' } },
    () => {
      const accessorLlm = fakeSheetAccessor_();
      const depsLlm = { truthWriter: createTruthWriter_(accessorLlm, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
      const llmResult = runImportPipeline_(
        { fileHash: 'llm-ok', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: 'Pending', driveFileId: '1LlmOk', existingHashes: [] },
        undefined, depsLlm
      );
      assertEqual_('structured+合法·stage 是 Verified', llmResult.stage, 'Verified', results);
      assertEqual_('structured+合法·week 从 period_start_parts 算出（不是 candidate 自己给的）', llmResult.parsedStatement.document_meta.week, '2026-W30', results);
      assertEqual_('structured+合法·extractor_id 记录到 Verified_Income', llmResult.verifyResult.record.extractor_id, 'LLMExtractor:test-model', results);
      assertEqual_('structured+合法·source_document_id 记录到 Verified_Income（不是 null）', typeof llmResult.verifyResult.record.source_document_id, 'string', results);
      assertEqual_('structured+合法·evidence 有跟着回传', llmResult.evidence.evidenceFileId, 'ev-1', results);
    }
  );

  // ---- structured + hallucination（数字兜不起来）：Needs_Review，绝对不能进 Verified_Income ----
  // 这是明确要求的负向测试：candidate 每个数字单独看都像真的，但四则运算对不上
  const hallucinatedCandidate_ = Object.assign({}, validCandidateForPipeline_, {
    summary: { total_income: 999, total_deductions: 50, weekly_net: 450 } // 999 跟 300+100+80+20=500 对不上
  });
  withMockedExtractor_(
    { mode: 'structured', candidate: hallucinatedCandidate_, evidence: { extractorId: 'LLMExtractor:test-model', extractionVersion: '2026-08-21T00:01:00.000Z', evidenceFileId: 'ev-2' } },
    () => {
      const accessorHallu = fakeSheetAccessor_();
      const depsHallu = { truthWriter: createTruthWriter_(accessorHallu, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
      const halluResult = runImportPipeline_(
        { fileHash: 'llm-hallu', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: 'Pending', driveFileId: '1LlmHallu', existingHashes: [] },
        undefined, depsHallu
      );
      assertEqual_('hallucination·stage 是 Needs_Review，不是 Verified', halluResult.stage, 'Needs_Review', results);
      assertEqual_('hallucination·Verified_Income 完全没写（LLM 不是 Truth Engine）', accessorHallu.getWritten('Verified_Income').length, 0, results);
      assertEqual_('hallucination·candidate 原样保留在回传里（不是丢掉，方便人工查）', halluResult.candidate, hallucinatedCandidate_, results);
      assertEqual_('hallucination·validationErrors 有说明哪里对不上', halluResult.validationErrors.length > 0, true, results);
      assertEqual_('hallucination·evidence 还是有跟着回传（证据不因为被拒绝就消失）', halluResult.evidence.evidenceFileId, 'ev-2', results);
      // Documents 记录本身应该还是先写好了——只是这次抽取没能变成 Verified Income
      assertEqual_('hallucination·Documents 记录本身还是先写好了', accessorHallu.getWritten('Documents').length, 1, results);
    }
  );

  // ---- structured + schema 都不对：Extraction_Failed（不是 Needs_Review） ----
  withMockedExtractor_(
    { mode: 'structured', candidate: { document_meta: {} }, evidence: null },
    () => {
      const accessorBadSchema = fakeSheetAccessor_();
      const depsBadSchema = { truthWriter: createTruthWriter_(accessorBadSchema, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
      const badSchemaResult = runImportPipeline_(
        { fileHash: 'llm-badschema', source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income', period: 'Pending', driveFileId: '1BadSchema', existingHashes: [] },
        undefined, depsBadSchema
      );
      assertEqual_('schema 都不对·stage 是 Extraction_Failed（连形状都不对，没什么好 review）', badSchemaResult.stage, 'Extraction_Failed', results);
      assertEqual_('schema 都不对·Verified_Income 完全没写', accessorBadSchema.getWritten('Verified_Income').length, 0, results);
    }
  );

  // ---- Retry 且带 existingDocumentId：应该原样出现在 importResult.document_id 上
  // （2026-08-21 修正前，这里固定是 null——Retry 时证据/Verified_Income 就没有
  // source_document_id 可以追溯，170_OperatorConsole.js 那边现在会把查到的既有
  // document_id 传进来，这里测的是 110 自己有没有正确使用它）----
  const accessor11 = fakeSheetAccessor_();
  const deps11 = { truthWriter: createTruthWriter_(accessor11, fakeLockProvider_()), riderOSAdapter: createRiderOSAdapter_(fakeStore_()), now: fixedNow };
  const retryWithIdResult = runImportPipeline_(
    { skipImport: true, existingDocumentId: 'CMP-DOC-existing-123', source: 'Grab', documentType: 'Weekly Statement', driveFileId: '1RetryWithId' },
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT,
    deps11
  );
  assertEqual_('Retry+existingDocumentId·importResult.document_id 正确带上（不再固定是 null）', retryWithIdResult.importResult.document_id, 'CMP-DOC-existing-123', results);
  assertEqual_('Retry+existingDocumentId·Verified_Income 的 source_document_id 对得上', retryWithIdResult.verifyResult.record.source_document_id, 'CMP-DOC-existing-123', results);

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
 * [x] DocumentTextExtractor 接上真实实现——2026-08-21 决定 LLM-based
 *     extraction（127_LLMExtractor.js），mode='structured' 已经在
 *     runImportPipeline_ 里正确处理
 * [ ] 真实 GAS 环境：对一份真的 Grab Weekly Statement PDF 走一次完整
 *     Console → consoleBatchImport → LLM extraction → validation → Verified
 *     全链路，确认数字真的对
 * [ ] 用两个已经存在、状态是 Extraction_Failed 的真实 Documents（2026-08-21
 *     那次 consoleBatchImport 留下的）执行 consoleRetryFile，确认
 *     Extraction_Failed → Retry → LLM extraction → Validation → Verified
 *     整条 lifecycle 走得通，且 Verified_Income 的 source_document_id
 *     对得上原本那笔 Documents 记录（不是 null）
 * [ ] existingHashes 目前是外部传入——等有读 Sheet 的工具后，要确认真的会
 *     去读 Documents 表全部现有的 file_hash
 * [ ] ADR-003：真实环境下让 riderOSAdapter.getWeeklyEstimate 丢一个未预期的
 *     例外（不是正常的 null），确认 processGrabStatement_ 仍然回传已经发布
 *     好的 verifyResult，不会整个调用都失败
 */
