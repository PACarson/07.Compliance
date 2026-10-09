if (typeof require === 'function') {
  var {
    buildConsoleDeps_, consoleScanFolder_, consoleImportOneDriveFile_, consoleBatchImport_,
    consoleRetryFile_, consoleManualImport_, consoleRebuildProjections_, consoleGetDashboard_,
    consoleGetIncomeDetail_, consoleRunDailyAllocation_, consoleGetDashboard, consoleGetLastFolderId, consoleScanFolder,
    consoleManualImport, consoleGetIncomeDetail, consoleRunDailyAllocation,
    sanitizeForClient_, ASSUMED_STATEMENT_TOTAL_PAGES_,
    consoleGetRecoveryStatus_, consoleRetrySelectedFiles_, summarizeEvidenceFailure_,
    consoleGetRecoveryStatus, consoleRetrySelectedFiles
  } = require('./170_OperatorConsole.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { createSheetReader_ } = require('./117_SheetReader.js');
  var { createRiderOSAdapter_ } = require('./123_RiderOSAdapter.js');
  require('./130_Reconciliation.js');
  var { VERIFIED_INCOME_COLUMNS } = require('./140_VerifiedIncome.js');
  var { DAILY_ALLOCATION_COLUMNS } = require('./142_DailyOrderAllocation.js');
  var { DOCUMENTS_COLUMNS } = require('./110_DocumentImport.js');
  require('./112_DocumentTextExtractor.js');
  var { assertEqual_, fakeStore_, fakeSheetAccessor_, fakeLockProvider_, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT } = require('./105_TestUtils.js');
}

/** 假的 folderScanner——Node 测不了真的 DriveApp，但可以测扫描/去重/批次的编排逻辑。 */
function fakeFolderScanner_(files, behavior) {
  const b = behavior || {};
  return {
    listPdfFiles() { return files; },
    getFileHash(fileId) { return b.getFileHash ? b.getFileHash(fileId) : `hash-of-${fileId}`; }
  };
}

/** 组一份完整、内部一致（同一个 accessor）的假 deps，跟 buildConsoleDeps_() 形状一样。 */
function fakeConsoleDeps_(files, now) {
  const accessor = fakeSheetAccessor_();
  return {
    truthWriter: createTruthWriter_(accessor, fakeLockProvider_()),
    sheetReader: createSheetReader_(accessor),
    riderOSAdapter: createRiderOSAdapter_(fakeStore_()),
    folderScanner: fakeFolderScanner_(files || []),
    now: now || new Date('2026-08-17T10:00:00Z'),
    _accessor: accessor // 方便测试直接检查底层写了什么，不是给编排代码用的
  };
}

/**
 * 2026-10-02 新增——假的证据资料夹扫描器，给 PDF Import Recovery Center 的
 * 测试用。filesByPrefix 是 { '<document_id>__': [{id, name, lastUpdated,
 * content, throwOnRead?}, ...] }——跟真的 realEvidenceScanner_ 同一个介面
 * （listFilesWithPrefix/readJsonFile），folderId 这里不检查（只有一个假
 * 资料夹），throwOnRead 给「证据档案读不出来/格式坏掉」的情境用。
 */
function fakeEvidenceScanner_(filesByPrefix) {
  const byId = {};
  Object.keys(filesByPrefix).forEach((prefix) => {
    filesByPrefix[prefix].forEach((f) => { byId[f.id] = f; });
  });
  return {
    listFilesWithPrefix(folderId, prefix) {
      return (filesByPrefix[prefix] || []).map((f) => ({ id: f.id, name: f.name, lastUpdated: f.lastUpdated }));
    },
    readJsonFile(fileId) {
      const f = byId[fileId];
      if (!f) throw new Error(`fakeEvidenceScanner_: 没有 id=${fileId} 的档案`);
      if (f.throwOnRead) throw new Error(f.throwOnRead);
      return f.content;
    }
  };
}

function runAllOperatorConsoleTests() {
  const results = [];

  // ============ consoleScanFolder_：drive_file_id 去重，且要分清「真的验证完成」vs「卡住待重试」============
  const deps1 = fakeConsoleDeps_([{ id: 'f1', name: 'a.pdf' }, { id: 'f2', name: 'b.pdf' }, { id: 'f3', name: 'c.pdf' }, { id: 'f4', name: 'd.pdf' }]);
  deps1._accessor.appendRow('Documents', ['CMP-DOC-old', 'Grab', 'Weekly Statement', 'Income', '2026-W29', 'oldhash', 'f2', 'path', 'Imported']);
  deps1._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W29', '2026-W29', 'MYR', 500, 50, 10, 0, 0, 560, 560, 'Compliance OS', 'Grab', 'Verified', '2026-07-22T00:00:00Z', 'CMP-DOC-old', 'GrabWeeklyParser', '2026-07-13', '2026-07-19']);
  // f4：有 Documents 记录，但故意不给对应的 Verified_Income——模拟上次抽取
  // /验证半路断掉（审计报告 HIGH-3：以前这种情况会被永久当成「已汇入」）
  deps1._accessor.appendRow('Documents', ['CMP-DOC-stuck', 'Grab', 'Weekly Statement', 'Income', 'Pending', 'stuckhash', 'f4', 'path', 'Imported']);
  const scan = consoleScanFolder_(null, deps1);
  assertEqual_('scan·四个文件都列出来', scan.files.length, 4, results);
  const f1 = scan.files.find((f) => f.id === 'f1');
  const f2 = scan.files.find((f) => f.id === 'f2');
  const f4 = scan.files.find((f) => f.id === 'f4');
  assertEqual_('scan·f1 是新的，标记未汇入', f1.alreadyImported, false, results);
  assertEqual_('scan·f1 是全新文件，不需要走 retry 路径', f1.needsRetry, false, results);
  assertEqual_('scan·f2 有 Documents 记录也有对应 Verified_Income，真的算已汇入', f2.alreadyImported, true, results);
  assertEqual_('scan·f4 有 Documents 记录但查无对应 Verified_Income——卡住了，不能当已完成（2026-08-23 修正 HIGH-3）', f4.alreadyImported, false, results);
  assertEqual_('scan·f4 明确标成需要重试（会走 isRetry 路径，不会被 file_hash 挡成 duplicate）', f4.needsRetry, true, results);

  // ============ consoleImportOneDriveFile_：新文件（Node 环境 OCR 是占位，预期 Extraction_Failed，但不该整个抛出）============
  const deps2 = fakeConsoleDeps_([]);
  let threwOnNewFile = false;
  let newFileResult = null;
  try { newFileResult = consoleImportOneDriveFile_('f9', 'new.pdf', deps2, false); }
  catch (e) { threwOnNewFile = true; }
  results.push({ name: '新文件·consoleImportOneDriveFile_ 不会整个抛出（就算 OCR 在 Node 环境失败）', pass: !threwOnNewFile });
  assertEqual_('新文件·Node 环境下 stage 是 Extraction_Failed（占位 Extractor 预期行为）', newFileResult.stage, 'Extraction_Failed', results);
  assertEqual_('新文件·Documents 记录还是先写好了', deps2._accessor.getWritten('Documents').length, 1, results);

  // ============ consoleImportOneDriveFile_：Retry——已经有 Documents 记录时不重复写、不被 file_hash 挡 ============
  const deps3 = fakeConsoleDeps_([]);
  deps3._accessor.appendRow('Documents', ['CMP-DOC-x', 'Grab', 'Weekly Statement', 'Income', 'Pending', 'existing-hash', 'f10', 'retry.pdf', 'Imported']);
  const retryResult = consoleImportOneDriveFile_('f10', 'retry.pdf', deps3, true);
  assertEqual_('Retry·Documents 没有被重复写入第二笔', deps3._accessor.getWritten('Documents').length, 1, results);
  assertEqual_('Retry·同样卡在 Extraction_Failed（不是被当成 duplicate 挡掉）', retryResult.stage, 'Extraction_Failed', results);

  // ---- 也直接测 consoleRetryFile_ 本身（不是只测它内部用到的 consoleImportOneDriveFile_）----
  const deps3b = fakeConsoleDeps_([]);
  deps3b._accessor.appendRow('Documents', ['CMP-DOC-y', 'Grab', 'Weekly Statement', 'Income', 'Pending', 'existing-hash-2', 'f11', 'retry2.pdf', 'Imported']);
  const retryFnResult = consoleRetryFile_('f11', 'retry2.pdf', deps3b);
  assertEqual_('consoleRetryFile_·Documents 没有被重复写入', deps3b._accessor.getWritten('Documents').length, 1, results);
  assertEqual_('consoleRetryFile_·有带 rebuild', typeof retryFnResult.rebuild, 'object', results);

  // ---- Retry 时既有 document_id 有正确带到 Verified_Income（2026-08-21 修正：
  // 以前 consoleImportOneDriveFile_ 查过 Documents 表却没把找到的 document_id
  // 传给 runImportPipeline_，Retry 出来的 source_document_id 永远是 null）----
  // 这一行是既有代码（不是这次 wiring 加的），原本没有档 typeof require 这个
  // Node-only 特性——在真实 GAS 里 require 整个不存在，直接呼叫会
  // ReferenceError（Steven 真实 GAS 执行时抓到的）。DocumentTextExtractor
  // 在 GAS 里本来就是 112 载入后留下的全域变量，不需要 require；这里补上
  // 跟这份文件其余每一处 require 完全一样的 typeof 守卫，只是把这一行原本
  // 漏掉的守卫补齐，没有改变这个测试原本要验证的行为。
  const dte3c = (typeof require === 'function') ? require('./112_DocumentTextExtractor.js').DocumentTextExtractor : DocumentTextExtractor;
  const originalExtract3c_ = dte3c.extract;
  const validCandidate3c_ = {
    document_meta: { source: 'Grab', document_type: 'Weekly Statement', currency: 'MYR', period_start_parts: { year: 2026, month: 7, day: 20 }, period_end_parts: { year: 2026, month: 7, day: 26 } },
    summary: { total_income: 500, total_deductions: 50, weekly_net: 450 },
    income_breakdown: { net_delivery_income: 300, incentive: 100, tip: 80, other_payments: 20 },
    extraction_notes: ''
  };
  dte3c.extract = function () {
    return { mode: 'structured', candidate: validCandidate3c_, evidence: { extractorId: 'LLMExtractor:test', extractionVersion: '2026-08-21T00:00:00.000Z', evidenceFileId: 'ev-x' } };
  };
  try {
    const deps3c = fakeConsoleDeps_([]);
    deps3c._accessor.appendRow('Documents', ['CMP-DOC-retry-trace', 'Grab', 'Weekly Statement', 'Income', 'Pending', 'existing-hash-3', 'f12', 'retry3.pdf', 'Imported']);
    const retryTraceResult = consoleImportOneDriveFile_('f12', 'retry3.pdf', deps3c, true);
    assertEqual_('Retry+structured·stage 是 Verified', retryTraceResult.stage, 'Verified', results);
    assertEqual_('Retry+structured·source_document_id 对到既有那笔 Documents（不是 null）', deps3c._accessor.getWritten('Verified_Income')[0][VERIFIED_INCOME_COLUMNS.indexOf('source_document_id')], 'CMP-DOC-retry-trace', results);
  } finally {
    dte3c.extract = originalExtract3c_;
  }

  // ============ consoleBatchImport_：真的完成的跳过，卡住的自动重试（不是永久跳过），一个失败不影响其他，结束会重建 ============
  const deps4 = fakeConsoleDeps_([{ id: 'f1', name: 'a.pdf' }, { id: 'f2', name: 'b.pdf' }, { id: 'f3', name: 'c.pdf' }]);
  deps4._accessor.appendRow('Documents', ['CMP-DOC-done', 'Grab', 'Weekly Statement', 'Income', '2026-W29', 'donehash', 'f3', 'path', 'Imported']);
  deps4._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W29', '2026-W29', 'MYR', 500, 50, 10, 0, 0, 560, 560, 'Compliance OS', 'Grab', 'Verified', '2026-07-22T00:00:00Z', 'CMP-DOC-done', 'GrabWeeklyParser', '2026-07-13', '2026-07-19']);
  deps4._accessor.appendRow('Documents', ['CMP-DOC-stuck2', 'Grab', 'Weekly Statement', 'Income', 'Pending', 'stuckhash2', 'f2', 'path', 'Imported']);
  // f3 真的完成（有对应 Verified_Income）、f2 卡住（没有）、f1 全新——
  // 预期：只有 f3 跳过，f1 跟 f2 都要处理（f2 走 isRetry，不会被当 duplicate）
  const batchResult = consoleBatchImport_(null, deps4);
  assertEqual_('批次·总共扫到 3 个', batchResult.scannedCount, 3, results);
  assertEqual_('批次·真的完成的 1 个跳过，卡住的+全新的都要处理，共 2 个', batchResult.attemptedCount, 2, results);
  assertEqual_('批次·两个都跑完了（没有因为其中一个失败就中断）', batchResult.results.length, 2, results);
  assertEqual_('批次·remainingCount 是 0（预算够用，没被时间中断）', batchResult.remainingCount, 0, results);
  assertEqual_('批次·stoppedEarly 是 false', batchResult.stoppedEarly, false, results);
  const stuckFileResult = batchResult.results.find((r) => r.fileId === 'f2');
  assertEqual_('批次·卡住的那笔没有被 file_hash 挡成 duplicate（走的是 isRetry 路径，不是重新登记）', stuckFileResult.stage !== 'Skipped_Duplicate', true, results);
  assertEqual_('批次·重建有回传 monthlySummaries', Array.isArray(batchResult.rebuild.monthlySummaries), true, results);

  // ---- 2026-08-23 新增（审计报告 HIGH-1）：接近时间预算就主动停止，不是被 GAS 硬杀 ----
  const deps4b = fakeConsoleDeps_([{ id: 'g1', name: 'a.pdf' }, { id: 'g2', name: 'b.pdf' }, { id: 'g3', name: 'c.pdf' }]);
  let nowMsCallCount = 0;
  const timeBudgetedResult = consoleBatchImport_(null, Object.assign({}, deps4b, {
    timeBudgetMs: 1000,
    nowMs: () => { nowMsCallCount++; return nowMsCallCount <= 2 ? 0 : 999999; } // 第 3 次呼叫（处理第 2 个文件前的检查）直接跳到远超预算
  }));
  assertEqual_('时间预算·只处理了 1 个就主动停止', timeBudgetedResult.attemptedCount, 1, results);
  assertEqual_('时间预算·stoppedEarly 是 true', timeBudgetedResult.stoppedEarly, true, results);
  assertEqual_('时间预算·remainingCount 反映还有 2 个没处理', timeBudgetedResult.remainingCount, 2, results);
  assertEqual_('时间预算·重建仍然正常跑（已处理的部分不会被时间预算卡住）', typeof timeBudgetedResult.rebuild, 'object', results);

  // ============ consoleManualImport_：Debug/Fallback，直接给文字，不需要真的 DriveApp，可以走到底 ============
  const deps5 = fakeConsoleDeps_([]);
  const manualResult = consoleManualImport_(TEST_FIXTURE_GRAB_WEEKLY_STATEMENT, deps5);
  assertEqual_('手动汇入·stage 是 Verified', manualResult.stage, 'Verified', results);
  assertEqual_('手动汇入·incomeId 对了', manualResult.incomeId, 'CMP-INCOME-2026-W30', results);
  assertEqual_('手动汇入·rebuild 里 totalVerifiedCount 是 1', manualResult.rebuild.totalVerifiedCount, 1, results);

  // ---- 幂等：同一份文字（内容完全相同）再贴一次——在 file_hash 这层就先被
  // 挡下来了（内容相同 = hash 相同，比对到发布层之前），不是靠发布层的
  // Already_Verified 挡。Already_Verified 保护的是不同来源、hash 不同、
  // 但对应到同一周的情况（例如 Retry 路径，见 111_Tests_DocumentImport.js
  // 里对 runImportPipeline_ 的直接测试），两层各司其职。 ----
  const manualResult2 = consoleManualImport_(TEST_FIXTURE_GRAB_WEEKLY_STATEMENT, deps5);
  assertEqual_('手动汇入·内容重复·stage 是 Skipped_Duplicate（file_hash 这层先挡下）', manualResult2.stage, 'Skipped_Duplicate', results);
  assertEqual_('手动汇入·内容重复·Verified_Income 还是只有一笔', deps5._accessor.getWritten('Verified_Income').length, 1, results);

  // ============ consoleRebuildProjections_：跨月聚合 + YTD ============
  const deps6 = fakeConsoleDeps_([]);
  // period_start/period_end（2026-08-22 起 VERIFIED_INCOME_COLUMNS 新增栏位）：
  // W26=2026-06-22~06-28（完全在 6 月），W30=2026-07-20~07-26（完全在 7 月，
  // 跟已确认的真实样本一致）——两笔各自完全落在不同月份，不受这次跨月
  // 归属改版影响，rebuild6 的断言维持原本的预期。
  deps6._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W26', '2026-W26', 'MYR', 1000, 100, 50, 0, -50, 1100, 1100, 'Compliance OS', 'Grab', 'Verified', '2026-07-01T00:00:00Z', 'CMP-DOC-fixture-1', 'GrabWeeklyParser', '2026-06-22', '2026-06-28']);
  deps6._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W30', '2026-W30', 'MYR', 1200, 200, 60, 0, -60, 1400, 1400, 'Compliance OS', 'Grab', 'Verified', '2026-07-28T00:00:00Z', 'CMP-DOC-fixture-2', 'GrabWeeklyParser', '2026-07-20', '2026-07-26']);
  const rebuild6 = consoleRebuildProjections_(deps6);
  assertEqual_('重建·两笔分属不同月份，monthlySummaries 有两笔', rebuild6.monthlySummaries.length, 2, results);
  assertEqual_('重建·totalVerifiedCount 是 2', rebuild6.totalVerifiedCount, 2, results);
  assertEqual_('重建·YTD 涵盖两笔的总和', rebuild6.ytd.net, 2500, results);
  assertEqual_('重建·每个月度摘要都附上 compliance_projection（SOCSO 固定 49.40）', rebuild6.monthlySummaries.every((m) => m.compliance_projection && m.compliance_projection.socso.amount === 49.40), true, results);
  assertEqual_('重建·两笔都是干净资料，invalidPeriodIncomeIds 是空阵列', rebuild6.invalidPeriodIncomeIds, [], results);

  // ---- 2026-08-22 真实事故复现：Verified_Income 混进一笔栏位错位的坏资料，Console 层级要能明确列出来 ----
  const depsBadRow = fakeConsoleDeps_([]);
  depsBadRow._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W42', '2026-W42', 'MYR', 1000, 100, 50, 0, -50, 1100, 1100, 'Compliance OS', 'Grab', 'Verified', '2026-10-19T00:00:00Z', null, 'GrabWeeklyParser', '2026-10-12', '2026-10-18']);
  depsBadRow._accessor.appendRow('Verified_Income', ['CMP-INCOME-BAD-ROW', '2026-W41', 'MYR', 1200, 0, 0, 0, 0, 1200, 1200, 'Compliance OS', 'Grab', 'Verified', '2026-10-12T00:00:00Z', null, 'GrabWeeklyParser', 'MYR', 1200]);
  const rebuildWithBadRow = consoleRebuildProjections_(depsBadRow);
  assertEqual_('重建·栏位错位的坏资料被明确列在 invalidPeriodIncomeIds，不是悄悄消失', rebuildWithBadRow.invalidPeriodIncomeIds, ['CMP-INCOME-BAD-ROW'], results);
  assertEqual_('重建·坏资料不影响好资料继续正常汇总（W42 完全落在 10 月内，2026-10-12 Mon → 2026-10-18 Sun）', rebuildWithBadRow.monthlySummaries.some((m) => m._computed_from.indexOf('CMP-INCOME-2026-W42') !== -1), true, results);

  // ============ consoleGetIncomeDetail_：Drill Down 到原始 Documents/drive_file_id（需求 §7/§8）============
  const deps10 = fakeConsoleDeps_([]);
  deps10._accessor.appendRow('Documents', ['CMP-DOC-detail-1', 'Grab', 'Weekly Statement', 'Income', 'Pending', 'hash-detail-1', 'drive-file-xyz', 'path/to/file.pdf', 'Imported']);
  deps10._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W33', '2026-W33', 'MYR', 1000, 100, 50, 0, -50, 1100, 1100, 'Compliance OS', 'Grab', 'Verified', '2026-08-17T00:00:00Z', 'CMP-DOC-detail-1', 'GrabWeeklyParser', '2026-08-10', '2026-08-16']);
  const detail = consoleGetIncomeDetail_('CMP-INCOME-2026-W33', deps10);
  assertEqual_('Drill Down·income 找得到', detail.income.income_id, 'CMP-INCOME-2026-W33', results);
  assertEqual_('Drill Down·顺藤摸到对应的 Documents 记录·drive_file_id', detail.document.driveFileId, 'drive-file-xyz', results);
  assertEqual_('Drill Down·不复制/回传 PDF 本身，只回传引用（需求 §8）', typeof detail.document.driveFileId, 'string', results);

  const missingDetail = consoleGetIncomeDetail_('CMP-INCOME-NOT-EXIST', deps10);
  assertEqual_('Drill Down·查不到的 income_id 不抛错，回传 null（不是让前端崩溃）', missingDetail, { income: null, document: null }, results);

  // ============ 公开 wrapper 函数：转发是否正确 ============
  // 不测「google.script.run 真的能不能连到公开函数」——那是 GAS 平台行为，
  // Node 测不了，见文件最后的人工清单。这里只测「给一样的 fake deps，
  // 公开版本（consoleXxx）产出的结果跟私有版本（consoleXxx_）一模一样」
  // ——两边各自灌一份独立、起始状态相同的 fake deps，比对回传值。
  // consoleGetDashboard 是这里唯一的例外（2026-09-27 起），见它自己那行
  // 断言旁的说明。
  const deps7a = fakeConsoleDeps_([{ id: 'f1', name: 'a.pdf' }]);
  const deps7b = fakeConsoleDeps_([{ id: 'f1', name: 'a.pdf' }]);
  assertEqual_('consoleScanFolder 转发结果跟 consoleScanFolder_ 一致', consoleScanFolder('folder1', deps7a), consoleScanFolder_('folder1', deps7b), results);

  const deps8a = fakeConsoleDeps_([]);
  const deps8b = fakeConsoleDeps_([]);
  assertEqual_('consoleManualImport 转发结果跟 consoleManualImport_ 一致', consoleManualImport(TEST_FIXTURE_GRAB_WEEKLY_STATEMENT, deps8a), consoleManualImport_(TEST_FIXTURE_GRAB_WEEKLY_STATEMENT, deps8b), results);

  const deps9a = fakeConsoleDeps_([]);
  const deps9b = fakeConsoleDeps_([]);
  // 2026-09-27：consoleGetDashboard 不再是纯转发——真实 GAS 环境下
  // google.script.run 会把这个物件静默传成 null，改成回传 JSON 字符串解决
  // （见 170_OperatorConsole.js 同日修复说明）。这里改成比对
  // JSON.parse(consoleGetDashboard(...)) 是否跟 consoleGetDashboard_(...)
  // 一致——验证的还是「内容没有被破坏」，只是多一层 JSON 字符串往返，不是
  // 原封不动比对回传值本身。
  assertEqual_('consoleGetDashboard 转发内容（还原 JSON 字符串后）跟 consoleGetDashboard_ 一致', JSON.parse(consoleGetDashboard(deps9a)), consoleGetDashboard_(deps9b), results);

  // 2026-09-15：这个断言原本直接写死期望 null——名字里自己就写了原因
  // （Node 环境没有 PropertiesService，所以这个函数在 Node 下必然回 null），
  // 但这个假设只在 Node 测试环境成立。真实 GAS 里 PropertiesService 是真的
  // 存在的，如果 Script Property 里本来就存过值（例如 Steven 自己用过
  // Console 的批次汇入功能，consoleSaveLastFolderId 存过一个真实的 Drive
  // 资料夹 ID），consoleGetLastFolderId() 回真实字符串是正确、预期的行为，
  // 不是 bug——"两版本都回 null" 从来就不该是这个函数的通用契约，只是
  // Node 环境剩下的巧合。这个测试真正想验证的是"这个公开函数能被呼叫、
  // 不会抛例外"，不是"回传值一定是 null"，改成只测前者，后者（null 或
  // 真实字符串）两种结果在两个环境都算通过。
  let consoleGetLastFolderIdThrew_ = false;
  let consoleGetLastFolderIdResult_ = null;
  try {
    consoleGetLastFolderIdResult_ = consoleGetLastFolderId();
  } catch (e) {
    consoleGetLastFolderIdThrew_ = true;
  }
  assertEqual_('consoleGetLastFolderId 公开版本可呼叫、不抛错', consoleGetLastFolderIdThrew_, false, results);
  assertEqual_('consoleGetLastFolderId 回传值是 null 或字符串（真实 GAS 若之前存过 Script Property 会是真实字符串，这是预期行为，不是这里要测的东西）', consoleGetLastFolderIdResult_ === null || typeof consoleGetLastFolderIdResult_ === 'string', true, results);

  const deps11a = fakeConsoleDeps_([]);
  deps11a._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W33', '2026-W33', 'MYR', 1000, 100, 50, 0, -50, 1100, 1100, 'Compliance OS', 'Grab', 'Verified', '2026-08-17T00:00:00Z', null, 'GrabWeeklyParser', '2026-08-10', '2026-08-16']);
  const deps11b = fakeConsoleDeps_([]);
  deps11b._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W33', '2026-W33', 'MYR', 1000, 100, 50, 0, -50, 1100, 1100, 'Compliance OS', 'Grab', 'Verified', '2026-08-17T00:00:00Z', null, 'GrabWeeklyParser', '2026-08-10', '2026-08-16']);
  assertEqual_('consoleGetIncomeDetail 转发结果跟 consoleGetIncomeDetail_ 一致', consoleGetIncomeDetail('CMP-INCOME-2026-W33', deps11a), consoleGetIncomeDetail_('CMP-INCOME-2026-W33', deps11b), results);

  // ============================================================
  // 2026-09-15 Production Wiring Slice——consoleRunDailyAllocation_（Execution
  // B 的入口）。用真的 createTruthWriter_/createSheetReader_ 接一个假的
  // sheetAccessor，只有 Gemini 呼叫本身用假的 orderExtractor（deps 注入，
  // 不是真的打 API）——测的是「找到正确输入、组好 deps、呼叫既有 142 API、
  // 转成清楚回传值」这个编排逻辑本身，不是重新测一次 142 的抽取/校验（那些
  // 已经在 143 测过）。
  // ============================================================
  function seedNeedsAllocationFixture_(deps) {
    deps.truthWriter.appendValidatedRow('Documents', {
      document_id: 'DOC-2026-W01', source: 'Grab', document_type: 'Weekly_Statement', document_class: 'Income_Proof',
      period: '2026-W01', file_hash: 'hash-w01', drive_file_id: '1fUrux2zoQgvKe0DvsPrR5Xma9pxa57yA',
      drive_path: 'Compliance OS/Grab/2026/W01.pdf', status: 'Imported'
    }, DOCUMENTS_COLUMNS);
    deps.truthWriter.appendValidatedRow('Verified_Income', {
      income_id: 'CMP-INCOME-2026-W01', period: '2026-W01', currency: 'MYR',
      // net_delivery_income 故意跟下面 fakeFullyAllocatedCandidate_ 那笔假造的
      // 单笔订单（4.00）对上——runGeminiOrderExtractionWithFallback_ 自己会做
      // statement 层级的 checksum（真实订单总额 vs Verified_Income 的
      // net_delivery_income），两边对不上的话会正确回 Needs_Review，不是这次
      // wiring 测试要验证的东西（142 自己的算术校验，143 已经测过）——这里
      // 只是要让这笔 fixture 内部自洽，测的是编排本身。
      net_delivery_income: 4.00, incentive: 566.20, tip: 50.00, other_payments: 19.00,
      total_deductions: 0, net: 639.20, amount: 639.20, source: 'Compliance OS', origin_platform: 'Grab',
      status: 'Verified', verified_at: '2026-01-05T00:00:00Z', source_document_id: 'DOC-2026-W01', extractor_id: 'test',
      period_start: '2025-12-29', period_end: '2026-01-04'
    }, VERIFIED_INCOME_COLUMNS);
  }
  function fakeOrderExtractor_(candidateOrError) {
    return {
      extractOrders(document, pageRange) {
        if (candidateOrError instanceof Error) throw candidateOrError;
        return { candidate: candidateOrError };
      }
    };
  }
  const fakeFullyAllocatedCandidate_ = {
    extraction_scope: { first_page_seen: 1, last_page_seen: 24 },
    days: [{
      weekday_name: 'Isnin', day: 29, month_name: 'Disember', day_block_complete: true, printed_daily_subtotal: 4.00,
      orders: [{ order_row_type: 'Tunggal', platform_raw: 'GrabFood', order_ids_raw: ['A-TESTORDER1'], and_more_count: 0, payment_method_raw: 'Tanpa tunai', base_income: 2.20, other_income: 1.80, income_adjustment: 0, net_income: 4.00, source_page: 21, low_confidence: false }]
    }],
    notes: ''
  };

  const depsRDA1 = fakeConsoleDeps_();
  seedNeedsAllocationFixture_(depsRDA1);
  const rdaMissing = consoleRunDailyAllocation_('CMP-INCOME-NOT-EXIST', Object.assign({}, depsRDA1, { orderExtractor: fakeOrderExtractor_(fakeFullyAllocatedCandidate_) }));
  assertEqual_('consoleRunDailyAllocation_·找不到 income_id 时明确回 Error（不是抛例外、不是静默 Skipped）', rdaMissing.status, 'Error', results);

  const depsRDA2 = fakeConsoleDeps_();
  seedNeedsAllocationFixture_(depsRDA2);
  const rdaResult = consoleRunDailyAllocation_('CMP-INCOME-2026-W01', Object.assign({}, depsRDA2, { orderExtractor: fakeOrderExtractor_(fakeFullyAllocatedCandidate_) }));
  assertEqual_('consoleRunDailyAllocation_·正常跑完·status 是 Done', rdaResult.status, 'Done', results);
  assertEqual_('consoleRunDailyAllocation_·正常跑完·allocationStatus 是 Fully_Allocated', rdaResult.allocationStatus, 'Fully_Allocated', results);
  assertEqual_('consoleRunDailyAllocation_·正常跑完·真的写了 1 笔 Daily_Allocation', rdaResult.rowsWritten, 1, results);
  const writtenDailyRows = depsRDA2._accessor.getWritten('Daily_Allocation');
  assertEqual_('consoleRunDailyAllocation_·写进 Sheet 的那一行 verified_income_id 正确', writtenDailyRows[0][DAILY_ALLOCATION_COLUMNS.indexOf('verified_income_id')], 'CMP-INCOME-2026-W01', results);

  // 幂等性：同一个 income_id 再跑一次——既有 writeDailyAllocationBatch_ 的
  // skip-if-已经-Fully_Allocated 守卫接手，不需要为这次 wiring 重新发明。
  const rdaRetry = consoleRunDailyAllocation_('CMP-INCOME-2026-W01', Object.assign({}, depsRDA2, { orderExtractor: fakeOrderExtractor_(fakeFullyAllocatedCandidate_) }));
  assertEqual_('consoleRunDailyAllocation_·同一个 income_id 重跑一次·不会重复写（既有 Fully_Allocated 守卫接手）', rdaRetry.skipped, true, results);
  assertEqual_('consoleRunDailyAllocation_·重跑一次后 Daily_Allocation 还是只有 1 笔，不是 2 笔', depsRDA2._accessor.getWritten('Daily_Allocation').length, 1, results);

  // Full（不是 Needs_Allocation）的记录——不需要跑 daily allocation，明确 Skipped
  const depsRDA3 = fakeConsoleDeps_();
  depsRDA3.truthWriter.appendValidatedRow('Verified_Income', {
    income_id: 'CMP-INCOME-2026-W30', period: '2026-W30', currency: 'MYR',
    net_delivery_income: 1000, incentive: 0, tip: 0, other_payments: 0,
    total_deductions: 0, net: 1000, amount: 1000, source: 'Compliance OS', origin_platform: 'Grab',
    status: 'Verified', verified_at: '2026-07-28T09:00:00Z', source_document_id: null, extractor_id: null,
    period_start: '2026-07-20', period_end: '2026-07-26'
  }, VERIFIED_INCOME_COLUMNS);
  const rdaSkipFull = consoleRunDailyAllocation_('CMP-INCOME-2026-W30', depsRDA3);
  assertEqual_('consoleRunDailyAllocation_·Full（非跨月）记录不需要 daily allocation·明确 Skipped', rdaSkipFull.status, 'Skipped', results);

  // Gemini/Drive 在 142 自己的 full-doc + chunk fallback 里全部失败——
  // runGeminiOrderExtractionWithFallback_ 自己的设计是这种情况不抛例外，
  // 回一个正常的、allocationStatus 是 Needs_Review 的结果（143 已经测过
  // 这个 fallback 逻辑本身）。这里验证的是：这次 wiring 正确把这个结果
  // 转成「不写任何 Daily_Allocation、不误判成功」，不是重新测一次 142
  // 的 fallback 逻辑。
  const depsRDA4 = fakeConsoleDeps_();
  seedNeedsAllocationFixture_(depsRDA4);
  const rdaAllAttemptsFailed = consoleRunDailyAllocation_('CMP-INCOME-2026-W01', Object.assign({}, depsRDA4, { orderExtractor: fakeOrderExtractor_(new Error('模拟 Drive 读档失败')) }));
  assertEqual_('consoleRunDailyAllocation_·Gemini/Drive 每次尝试都失败·142 自己的 fallback 接住，回 Done+Needs_Review（不是抛例外）', { status: rdaAllAttemptsFailed.status, allocationStatus: rdaAllAttemptsFailed.allocationStatus }, { status: 'Done', allocationStatus: 'Needs_Review' }, results);
  assertEqual_('consoleRunDailyAllocation_·全部尝试失败时 rowsWritten 是 0，不写任何 Daily_Allocation', rdaAllAttemptsFailed.rowsWritten, 0, results);
  assertEqual_('consoleRunDailyAllocation_·全部尝试失败时 Daily_Allocation 确实完全没有被写入', depsRDA4._accessor.getWritten('Daily_Allocation').length, 0, results);
  assertEqual_('consoleRunDailyAllocation_·全部尝试失败不影响 Verified_Income（还在，状态不变）', depsRDA4.sheetReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS).find((r) => r.income_id === 'CMP-INCOME-2026-W01').status, 'Verified', results);

  // 真的有例外逃出 142 自己的 fallback 之外的情况（例如读 Sheet 本身出问题）
  // ——这才是这个 function 自己那层 try/catch 真正要接住的对象，
  // 用一个会在读 Daily_Allocation 时直接抛错的假 sheetReader 模拟。
  const depsRDA6 = fakeConsoleDeps_();
  seedNeedsAllocationFixture_(depsRDA6);
  const throwingSheetReader = Object.assign({}, depsRDA6.sheetReader, {
    readAll(sheetName, columns) {
      if (sheetName === 'Daily_Allocation') throw new Error('模拟 Sheet API 本身出问题（不是 Gemini/Drive 的错）');
      return depsRDA6.sheetReader.readAll(sheetName, columns);
    }
  });
  const rdaOuterException = consoleRunDailyAllocation_('CMP-INCOME-2026-W01', Object.assign({}, depsRDA6, { sheetReader: throwingSheetReader, orderExtractor: fakeOrderExtractor_(fakeFullyAllocatedCandidate_) }));
  assertEqual_('consoleRunDailyAllocation_·142 fallback 之外真的有例外逃出来（这次新加的外层 try/catch）·明确回 Error，不让整个 console 呼叫崩溃', rdaOuterException.status, 'Error', results);

  const depsRDA5a = fakeConsoleDeps_();
  seedNeedsAllocationFixture_(depsRDA5a);
  const depsRDA5b = fakeConsoleDeps_();
  seedNeedsAllocationFixture_(depsRDA5b);
  assertEqual_(
    'consoleRunDailyAllocation 公开版本转发结果跟 consoleRunDailyAllocation_ 一致',
    consoleRunDailyAllocation('CMP-INCOME-2026-W01', Object.assign({}, depsRDA5a, { orderExtractor: fakeOrderExtractor_(fakeFullyAllocatedCandidate_) })),
    consoleRunDailyAllocation_('CMP-INCOME-2026-W01', Object.assign({}, depsRDA5b, { orderExtractor: fakeOrderExtractor_(fakeFullyAllocatedCandidate_) })),
    results
  );

  // ============ 2026-09-28 加固：真实 GAS 形状的 fixture（Sheets 日期栏读回来是原生 Date）============
  // 上面所有 fixture 的 period_start/period_end 都是 ISO 字符串——Node 里的假 Sheet
  // 不会像真实 Sheets 那样把日期栏读成 Date，「Date 传不过 google.script.run」这类
  // 问题在 Node 永远测不到，只会在真实 GAS 才炸（2026-09-27 dashboard 白屏更可能
  // 就是这个）。这里刻意用 Date 型 fixture，把这个盲区补起来。
  function collectDatePaths_(value, path, found) {
    if (value instanceof Date) { found.push(path); return found; }
    if (value !== null && typeof value === 'object') {
      Object.keys(value).forEach((k) => collectDatePaths_(value[k], `${path}.${k}`, found));
    }
    return found;
  }
  function seedDateTypedCrossMonthRow_(deps) {
    deps._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W01', '2026-W01', 'MYR', 1297.60, 566.20, 50.00, 19.00, 0, 1932.80, 1932.80, 'Compliance OS', 'Grab', 'Verified', '2026-01-05T00:00:00Z', 'DOC-2026-W01', 'test', new Date(2025, 11, 29), new Date(2026, 0, 4)]);
  }

  const depsDate1 = fakeConsoleDeps_();
  seedDateTypedCrossMonthRow_(depsDate1);
  const dateFixtureRow = depsDate1.sheetReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS)[0];
  assertEqual_('Date fixture·假 Sheet 读回来确实是原生 Date（不是字符串，不然这组测试等于没测）', dateFixtureRow.period_start instanceof Date && dateFixtureRow.period_end instanceof Date, true, results);

  const dashDate = consoleGetDashboard_(depsDate1);
  assertEqual_('Date fixture·consoleGetDashboard_ 的 payload 里没有任何原生 Date（google.script.run 传不过 Date）', collectDatePaths_(dashDate, 'dashboard', []), [], results);
  const needsAllocationDate = dashDate.monthlySummaries[0].needs_allocation[0];
  assertEqual_('Date fixture·跨月记录的 period_start/period_end 转成本地日期字符串（不是 UTC 偏移后差一天）', { start: needsAllocationDate.period_start, end: needsAllocationDate.period_end }, { start: '2025-12-29', end: '2026-01-04' }, results);
  const depsDate2 = fakeConsoleDeps_();
  seedDateTypedCrossMonthRow_(depsDate2);
  assertEqual_('Date fixture·公开 consoleGetDashboard 回传的 JSON 字符串里日期也是本地日期', JSON.parse(consoleGetDashboard(depsDate2)).monthlySummaries[0].needs_allocation[0].period_start, '2025-12-29', results);

  const depsDate3 = fakeConsoleDeps_([]);
  seedDateTypedCrossMonthRow_(depsDate3);
  const batchDate = consoleBatchImport_('any-folder', depsDate3);
  assertEqual_('Date fixture·consoleBatchImport_ 的 rebuild 欄位也没有原生 Date（批次汇入/重试/手动汇入的 rebuild 共用同一处转换）', collectDatePaths_(batchDate, 'batch', []), [], results);

  const detailDate = consoleGetIncomeDetail_('CMP-INCOME-2026-W01', depsDate1);
  assertEqual_('Date fixture·consoleGetIncomeDetail_ 的 income（原始一行）没有原生 Date', collectDatePaths_(detailDate, 'detail', []), [], results);
  assertEqual_('Date fixture·consoleGetIncomeDetail_ 的 income.period_start 是本地日期字符串', detailDate.income.period_start, '2025-12-29', results);

  // ============ sanitizeForClient_：纯函数 ============
  assertEqual_('sanitizeForClient_·本地午夜的 Date → YYYY-MM-DD', sanitizeForClient_(new Date(2026, 0, 4)), '2026-01-04', results);
  assertEqual_('sanitizeForClient_·带时间的 Date → ISO 字符串（带 Z，不会被误读成本地日期）', sanitizeForClient_(new Date('2026-01-05T03:04:05.000Z')), '2026-01-05T03:04:05.000Z', results);
  assertEqual_('sanitizeForClient_·无效 Date → null', sanitizeForClient_(new Date('not a date')), null, results);
  assertEqual_('sanitizeForClient_·嵌在物件/阵列里的 Date 也转', sanitizeForClient_({ a: [new Date(2026, 0, 4)], b: { c: new Date(2025, 11, 29) } }), { a: ['2026-01-04'], b: { c: '2025-12-29' } }, results);
  assertEqual_('sanitizeForClient_·一般资料原样通过（null/数字/字符串/布尔/巢状）', sanitizeForClient_({ n: null, x: 1.5, s: 'a', t: true, arr: [1, { k: null }] }), { n: null, x: 1.5, s: 'a', t: true, arr: [1, { k: null }] }, results);
  const sanitizedOdd = sanitizeForClient_({ keep: 1, drop: undefined, fn: function () {}, arr: [undefined, 2] });
  assertEqual_('sanitizeForClient_·undefined/function 属性略过，阵列里的 undefined → null（跟 JSON 语意一致）', { hasDrop: 'drop' in sanitizedOdd, hasFn: 'fn' in sanitizedOdd, arr: sanitizedOdd.arr }, { hasDrop: false, hasFn: false, arr: [null, 2] }, results);
  assertEqual_('sanitizeForClient_·NaN/Infinity → null', sanitizeForClient_([NaN, Infinity, -Infinity, 3]), [null, null, null, 3], results);
  const circularRef = {};
  circularRef.self = circularRef;
  let circularThrewClearly = false;
  try { sanitizeForClient_(circularRef); } catch (e) { circularThrewClearly = /50 层/.test(e.message); }
  assertEqual_('sanitizeForClient_·循环参照明确抛错（不是无限递归、也不是回给前端一个 null）', circularThrewClearly, true, results);

  // ============ consoleRunDailyAllocation_：失败时不再是黑盒 + totalPages 假设值 ============
  const depsRDA7 = fakeConsoleDeps_();
  seedNeedsAllocationFixture_(depsRDA7);
  const seenByExtractor = [];
  const recordingFailingExtractor = {
    extractOrders(document, pageRange) {
      seenByExtractor.push({ totalPages: document.totalPages, pageRange });
      throw new Error('模拟 Gemini HTTP 400');
    }
  };
  const rdaDiag = consoleRunDailyAllocation_('CMP-INCOME-2026-W01', Object.assign({}, depsRDA7, { orderExtractor: recordingFailingExtractor }));
  assertEqual_('consoleRunDailyAllocation_·失败时带回 142 的 attempts（整份、两段 chunk、all_chunks_failed）', rdaDiag.attempts.map((a) => a.label), ['full_document', 'chunk_1-13', 'chunk_12-24', 'all_chunks_failed'], results);
  assertEqual_('consoleRunDailyAllocation_·失败时 errors 带着底层例外文字（不再是没有线索的黑盒 Needs_Review）', rdaDiag.errors.some((e) => String(e.exception || '').indexOf('模拟 Gemini HTTP 400') !== -1), true, results);
  assertEqual_('consoleRunDailyAllocation_·extractor 被呼叫三次（整份 + 两段），每次收到的 document.totalPages 都是那个具名假设值', { calls: seenByExtractor.length, allUseAssumedTotalPages: seenByExtractor.every((c) => c.totalPages === ASSUMED_STATEMENT_TOTAL_PAGES_) }, { calls: 3, allUseAssumedTotalPages: true }, results);
  assertEqual_('consoleRunDailyAllocation_·成功时 attempts/errors 也是阵列（回传形状固定，前端不用判断有没有这两个欄位）', { attempts: Array.isArray(rdaResult.attempts), errors: Array.isArray(rdaResult.errors) }, { attempts: true, errors: true }, results);

  // ============ PDF Import Recovery Center（2026-10-02，真实撞到 2026-W06.pdf 卡住要手动删 Documents 才能重试）============

  // ---- summarizeEvidenceFailure_：纯函数 ----
  assertEqual_('summarizeEvidenceFailure_·API 本身回报的错误优先（真实撞过的 503）', summarizeEvidenceFailure_({ raw_response: { error: { message: 'This model is currently experiencing high demand.' } }, finish_reason: null, raw_candidate: null }), 'LLM API 回传错误：This model is currently experiencing high demand.', results);
  assertEqual_('summarizeEvidenceFailure_·finishReason 不是 STOP', summarizeEvidenceFailure_({ raw_response: {}, finish_reason: 'SAFETY', raw_candidate: null }), 'Gemini 没有正常完成（finishReason=SAFETY，可能被安全过滤器挡下或输出被截断）', results);
  assertEqual_('summarizeEvidenceFailure_·candidate 是 null（没有 API 错误、finishReason 是 STOP）', summarizeEvidenceFailure_({ raw_response: {}, finish_reason: 'STOP', raw_candidate: null }), '没有解析出候选资料（回应格式不是预期的 JSON，或完全没有回应内容）', results);
  // fallback_note 分支排在 raw_candidate 检查之后——raw_candidate 是 null 时会先命中那一条，这里用非 null candidate 单独验证 fallback_note 分支本身
  assertEqual_('summarizeEvidenceFailure_·candidate 存在、有 fallback_note → 回报换过模型（比「候选资料已抽出但验证没过」更具体，优先用这个）', summarizeEvidenceFailure_({ raw_response: {}, finish_reason: 'STOP', raw_candidate: { days: [] }, fallback_note: '主模型 gemini-3.8-flash 因 503 高峰期无算力失败，改用 gemini-3.5-flash 成功' }), '已切换模型但最终仍失败：主模型 gemini-3.8-flash 因 503 高峰期无算力失败，改用 gemini-3.5-flash 成功', results);
  assertEqual_('summarizeEvidenceFailure_·candidate 存在、没有 fallback_note → 候选资料已抽出但后续验证没过', summarizeEvidenceFailure_({ raw_response: {}, finish_reason: 'STOP', raw_candidate: { days: [] } }), '候选资料已抽取出来，但后续验证没有通过（栏位/期间/金额对不上——建议点 Retry 重新确认）', results);
  assertEqual_('summarizeEvidenceFailure_·空物件/undefined 不抛错', [summarizeEvidenceFailure_(null), summarizeEvidenceFailure_(undefined)], ['证据档案是空的', '证据档案是空的'], results);

  // ---- consoleGetRecoveryStatus_：Pending vs Failed vs Completed 的分类 ----
  function seedDoc_(deps, docId, driveFileId, period, drivePath) {
    deps._accessor.appendRow('Documents', [docId, 'Grab', 'Weekly Statement', 'Income', period, `hash-${docId}`, driveFileId, drivePath || `${docId}.pdf`, 'Imported']);
  }
  function seedVerified_(deps, incomeId, period, docId) {
    deps._accessor.appendRow('Verified_Income', [incomeId, period, 'MYR', 500, 50, 10, 0, 0, 560, 560, 'Compliance OS', 'Grab', 'Verified', '2026-07-22T00:00:00Z', docId, 'GrabWeeklyParser', '2026-07-13', '2026-07-19']);
  }

  const depsRec1 = fakeConsoleDeps_([]);
  seedDoc_(depsRec1, 'CMP-DOC-PENDING', 'drive-pending', '2026-W06'); // 从来没有证据档——真的从没被尝试过
  seedDoc_(depsRec1, 'CMP-DOC-FAILED', 'drive-failed', '2026-W06'); // 有证据档，没有 Verified_Income
  seedDoc_(depsRec1, 'CMP-DOC-DONE', 'drive-done', '2026-W07');
  seedVerified_(depsRec1, 'CMP-INCOME-2026-W07', '2026-W07', 'CMP-DOC-DONE');
  depsRec1.evidenceScanner = fakeEvidenceScanner_({
    'CMP-DOC-FAILED__': [
      { id: 'ev1', name: 'CMP-DOC-FAILED__2026-10-01T10-00-00.000Z.json', lastUpdated: new Date('2026-10-01T10:00:00Z'), content: { raw_response: { error: { message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.' } }, finish_reason: null, raw_candidate: null } },
      { id: 'ev2', name: 'CMP-DOC-FAILED__2026-10-01T11-00-00.000Z.json', lastUpdated: new Date('2026-10-01T11:00:00Z'), content: { raw_response: { error: { message: '第二次也失败了' } }, finish_reason: null, raw_candidate: null } }
    ]
  });
  depsRec1.evidenceFolderId = 'evidence-folder-1';
  const recStatus1 = consoleGetRecoveryStatus_(depsRec1);
  assertEqual_('Recovery·从没被尝试过（没有任何证据档）的文件归 Pending', recStatus1.pending.map((p) => p.documentId), ['CMP-DOC-PENDING'], results);
  assertEqual_('Recovery·Pending 不需要 Documents 记录以外的任何东西就能判断，不依赖即时 Drive 资料夹扫描', recStatus1.pending[0].driveFileId, 'drive-pending', results);
  assertEqual_('Recovery·真的打过 Gemini、但没进 Verified_Income 的文件归 Failed，不是 Pending', recStatus1.failed.map((f) => f.documentId), ['CMP-DOC-FAILED'], results);
  assertEqual_('Recovery·Failed 的 lastError 取「最新」一份证据档（按 lastUpdated），不是第一份', recStatus1.failed[0].lastError, 'LLM API 回传错误：第二次也失败了', results);
  assertEqual_('Recovery·Failed 的 attemptCount 是数出来的证据档份数（2 份），不是新发明的持久化欄位', recStatus1.failed[0].attemptCount, 2, results);
  assertEqual_('Recovery·已经进 Verified_Income 的文件归 Completed，不出现在 Pending/Failed（不会被重复标记成需要救援）', { completed: recStatus1.completed.map((c) => c.documentId), notInPending: recStatus1.pending.some((p) => p.documentId === 'CMP-DOC-DONE'), notInFailed: recStatus1.failed.some((f) => f.documentId === 'CMP-DOC-DONE') }, { completed: ['CMP-DOC-DONE'], notInPending: false, notInFailed: false }, results);
  assertEqual_('Recovery·Completed 只带最少欄位（documentId/incomeIds/period），不复制 Verified_Income 整行内容（Section 3C：不建第二个 source of truth）', Object.keys(recStatus1.completed[0]).sort(), ['documentId', 'driveFileId', 'drivePath', 'incomeIds', 'period'].sort(), results);
  // 2026-10-07 补上（对 Recovery 后端做 mutation testing 时发现的缺口，ADR-006 先前记录「后端测试没做过 mutation testing」）：
  // 上面只验证 Completed 的「栏位名称」、没验证值——incomeIds 取错栏位（例如误拿 period）也不会被发现；
  // Failed 的 lastAttemptAt 则完全没有任何测试，整个栏位被拿掉也不会被发现。
  assertEqual_('Recovery·Completed 的 incomeIds / period / drivePath 是 Verified_Income 与 Documents 里的值本身（不只是栏位名称对）', { incomeIds: recStatus1.completed[0].incomeIds, period: recStatus1.completed[0].period, drivePath: recStatus1.completed[0].drivePath }, { incomeIds: ['CMP-INCOME-2026-W07'], period: '2026-W07', drivePath: 'CMP-DOC-DONE.pdf' }, results);
  assertEqual_('Recovery·Failed 的 lastAttemptAt 是「最新」一份证据档的 lastUpdated（11:00，不是 10:00 那份）', recStatus1.failed[0].lastAttemptAt, '2026-10-01T11:00:00.000Z', results);

  // ---- evidenceScanner 没接上（Node 测试环境常态，或 Script Properties 没设定）→ 老实说判断不出来，不是假装都是 Pending ----
  const depsRecNoEvidence = fakeConsoleDeps_([]);
  seedDoc_(depsRecNoEvidence, 'CMP-DOC-X', 'drive-x', '2026-W08');
  const recStatusNoEvidence = consoleGetRecoveryStatus_(depsRecNoEvidence);
  assertEqual_('Recovery·evidenceScanner 没接上 → evidenceFolderConfigured: false，文件进 Pending 但标注 evidenceUnavailable，不是悄悄当成「真的检查过、确定是 Pending」', { configured: recStatusNoEvidence.evidenceFolderConfigured, item: recStatusNoEvidence.pending[0] && { status: recStatusNoEvidence.pending[0].status, evidenceUnavailable: recStatusNoEvidence.pending[0].evidenceUnavailable } }, { configured: false, item: { status: 'Pending', evidenceUnavailable: true } }, results);

  // ---- 证据档案本身读不出来/坏掉（Invalid states are rejected safely）----
  const depsRecBadEvidence = fakeConsoleDeps_([]);
  seedDoc_(depsRecBadEvidence, 'CMP-DOC-BAD', 'drive-bad', '2026-W09');
  depsRecBadEvidence.evidenceScanner = fakeEvidenceScanner_({ 'CMP-DOC-BAD__': [{ id: 'evbad', name: 'CMP-DOC-BAD__x.json', lastUpdated: new Date('2026-10-01T00:00:00Z'), throwOnRead: '档案不是合法 JSON' }] });
  depsRecBadEvidence.evidenceFolderId = 'evidence-folder-1';
  const recStatusBad = consoleGetRecoveryStatus_(depsRecBadEvidence);
  assertEqual_('Recovery·证据档案本身读不出来 → 安全地归 Failed、lastError 说明读取失败，不是让整个 Recovery Center 崩溃', { status: recStatusBad.failed[0] && recStatusBad.failed[0].status, lastErrorMentionsReadFailure: recStatusBad.failed[0] && recStatusBad.failed[0].lastError.indexOf('读取/解析失败') !== -1 }, { status: 'Failed', lastErrorMentionsReadFailure: true }, results);

  // ---- order 层级的证据档（Daily Allocation，带 orders: 的 scope tag）不该被 Recovery Center 误判成 statement 层级的尝试 ----
  const depsRecOrderLevel = fakeConsoleDeps_([]);
  seedDoc_(depsRecOrderLevel, 'CMP-DOC-ORD', 'drive-ord', '2026-W10');
  depsRecOrderLevel.evidenceScanner = fakeEvidenceScanner_({ 'CMP-DOC-ORD__': [{ id: 'evord', name: 'CMP-DOC-ORD__orders:full__2026-10-01T00-00-00.000Z.json', lastUpdated: new Date('2026-10-01T00:00:00Z'), content: {} }] });
  depsRecOrderLevel.evidenceFolderId = 'evidence-folder-1';
  const recStatusOrderLevel = consoleGetRecoveryStatus_(depsRecOrderLevel);
  assertEqual_('Recovery·只有 order 层级（Daily Allocation，orders: scope tag）证据档、没有 statement 层级证据 → 仍归 Pending（Recovery Center 这次的范围是 Document Import，不是 Daily Allocation）', recStatusOrderLevel.pending.map((p) => p.documentId), ['CMP-DOC-ORD'], results);

  // ---- 没有原生 Date 漏出去（跟 consoleGetDashboard 同一个 sanitizeForClient_ 把关）----
  assertEqual_('Recovery·consoleGetRecoveryStatus_ 的回传物件里没有原生 Date（lastAttemptAt 等欄位都已经转成字符串）', collectDatePaths_(recStatus1, 'recovery', []), [], results);
  assertEqual_('Recovery·公开 consoleGetRecoveryStatus 回传的也是已经 sanitize 过的物件（不是另外包一层 JSON 字符串——这个端点不像 consoleGetDashboard 那样有已知的 google.script.run 传输问题史，不需要那层额外保险）', typeof consoleGetRecoveryStatus(depsRec1), 'object', results);

  // ---- consoleRetrySelectedFiles_：复用既有 consoleImportOneDriveFile_，不是新的处理引擎 ----
  const depsRetrySel = fakeConsoleDeps_([]);
  seedDoc_(depsRetrySel, 'CMP-DOC-R1', 'drive-r1', '2026-W11');
  seedDoc_(depsRetrySel, 'CMP-DOC-R2', 'drive-r2', '2026-W12');
  const selResult = consoleRetrySelectedFiles_([{ fileId: 'drive-r1', fileName: 'r1.pdf' }, { fileId: 'drive-r2', fileName: 'r2.pdf' }], depsRetrySel);
  assertEqual_('Retry Selected·每个文件各自回报结果，不是整批只给一个「成功/失败」（部分失败要看得出是哪几份）', selResult.results.map((r) => r.fileId), ['drive-r1', 'drive-r2'], results);
  assertEqual_('Retry Selected·用的是既有的 consoleImportOneDriveFile_（isRetry=true 走的 skipImport 路径），不是另一套汇入引擎——两份文件都沿用各自既有的 document_id，不会产生新的 Documents 记录', depsRetrySel._accessor.getAllRows('Documents').filter((r) => r[0] === 'CMP-DOC-R1' || r[0] === 'CMP-DOC-R2').length, 2, results);
  // 2026-10-07 补上（对 Recovery 后端做 mutation testing 时发现的缺口）：上一条只数「原本那两个 document_id 还在」——
  // 就算每次重试都偷偷新增重复的 Documents 记录，这两个 id 仍然各有 1 笔、数出来永远是 2，抓不到。实测把 isRetry=true
  // 拿掉，Documents 会多出 2 笔重复记录（总数 2 → 4），上一条照样通过；所以另外直接比对 Documents 全部的 document_id。
  assertEqual_('Retry Selected·没有新增任何 Documents 记录：Documents 全部的 document_id 仍然只有原本那两个（拿掉 isRetry=true 会多出重复记录）', depsRetrySel._accessor.getAllRows('Documents').map((r) => r[0]), ['CMP-DOC-R1', 'CMP-DOC-R2'], results);
  assertEqual_('Retry Selected·回传有 rebuild（前端靠它刷新 Dashboard/月度总览），形状跟 consoleBatchImport_ 的一样（有 monthlySummaries 阵列）', { type: typeof selResult.rebuild, monthlySummaries: Array.isArray(selResult.rebuild && selResult.rebuild.monthlySummaries) }, { type: 'object', monthlySummaries: true }, results);

  // ---- Retry Selected 比照 consoleBatchImport_ 的时间预算安全机制（2026-10-01 consoleBatchImport 真实被 GAS 硬杀的同一个理由，Retry Selected 不能重蹈覆辙）----
  const depsRetrySelBudget = fakeConsoleDeps_([]);
  seedDoc_(depsRetrySelBudget, 'CMP-DOC-B1', 'drive-b1', '2026-W13');
  seedDoc_(depsRetrySelBudget, 'CMP-DOC-B2', 'drive-b2', '2026-W14');
  seedDoc_(depsRetrySelBudget, 'CMP-DOC-B3', 'drive-b3', '2026-W15');
  let selBudgetCallCount = 0;
  const selBudgetResult = consoleRetrySelectedFiles_(
    [{ fileId: 'drive-b1', fileName: 'b1.pdf' }, { fileId: 'drive-b2', fileName: 'b2.pdf' }, { fileId: 'drive-b3', fileName: 'b3.pdf' }],
    Object.assign({}, depsRetrySelBudget, {
      timeBudgetMs: 1000,
      nowMs: () => { selBudgetCallCount++; return selBudgetCallCount <= 2 ? 0 : 999999; } // 第 3 次呼叫（处理第 2 份前的检查）直接跳到远超预算，跟 consoleBatchImport_ 既有测试同一个手法
    })
  );
  assertEqual_('Retry Selected·接近/超过时间预算就提早停止（stoppedEarly），不会每份都硬试到被 GAS 平台强制终止——跟 consoleBatchImport_ 共用同一个安全机制，不是重新发明一次', { stoppedEarly: selBudgetResult.stoppedEarly, attempted: selBudgetResult.attemptedCount, remaining: selBudgetResult.remainingCount }, { stoppedEarly: true, attempted: 1, remaining: 2 }, results);

  // ---- Retry 不会重复发布 Verified_Income（双击/重复请求的后端层保险）----
  const depsNoDup = fakeConsoleDeps_([]);
  seedDoc_(depsNoDup, 'CMP-DOC-NODUP', 'drive-nodup', '2026-W16');
  seedVerified_(depsNoDup, 'CMP-INCOME-2026-W16', '2026-W16', 'CMP-DOC-NODUP');
  const recStatusNoDup = consoleGetRecoveryStatus_(depsNoDup);
  assertEqual_('Retry·已经 Completed 的文件不会出现在 Pending/Failed 里，Recovery Center UI 不会给它一个 Retry 按钮（避免误触重新发布）', { inPending: recStatusNoDup.pending.some((p) => p.documentId === 'CMP-DOC-NODUP'), inFailed: recStatusNoDup.failed.some((f) => f.documentId === 'CMP-DOC-NODUP') }, { inPending: false, inFailed: false }, results);

  // ============ 170_OperatorConsole.html：扫描结果排序（2026-10-07；Steven 先前明确提过的需求）============
  // 只能在 Node 跑（要读 HTML 文件、用 vm 执行）；GAS 里没有 fs/vm，整段略过，不算失败。
  // 做法：用括号配对从 HTML 的 <script> 区块抽出「真正的那份函数原始码」丢进 vm 沙盒执行——
  // 测的是 HTML 里实际的代码，不是另外重写一份；render 用一个最小的假 document。
  // 这是这个专案第一个会读 170.html 的自动化测试，顺便补上「HTML script 区块语法合法」这个以前
  // 完全没有任何测试挡着的缺口。真实浏览器/HTML Service 的呈现仍然靠文件末尾的人工验证清单。
  if (typeof require === 'function') {
    const fsHtml = require('fs');
    const pathHtml = require('path');
    const vmHtml = require('vm');
    const htmlText = fsHtml.readFileSync(pathHtml.join(__dirname, '170_OperatorConsole.html'), 'utf8');
    const scriptMatch = htmlText.match(/<script>([\s\S]*?)<\/script>/);
    const scriptText = scriptMatch ? scriptMatch[1] : '';

    let scriptParses = false;
    try { new vmHtml.Script(scriptText); scriptParses = true; } catch (e) { scriptParses = false; }
    assertEqual_('170.html·<script> 区块语法合法（以前没有任何测试会抓到 HTML 里的语法错误）', scriptParses, true, results);

    // 从 script 原始码里抽出 `function name(...) { ... }` 整段（跳过字串里的大括号）
    const extractFn = function (src, name) {
      const start = src.indexOf('function ' + name + '(');
      if (start === -1) throw new Error('170.html 里找不到 function ' + name);
      let i = src.indexOf('{', src.indexOf(')', start));
      let depth = 0;
      let prevSig = ''; // 上一个非空白字元：用来分辨「/」是正则字面量的开头还是除号
      for (; i < src.length; i++) {
        const ch = src[i];
        const nx = src[i + 1];
        if (ch === '/' && nx === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (ch === '/' && nx === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
        if (ch === "'" || ch === '"' || ch === '`') {
          const q = ch;
          i++;
          while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
          prevSig = q;
          continue;
        }
        if (ch === '/' && (prevSig === '' || '(,=:[!&|?{};+-*%<>~^'.indexOf(prevSig) !== -1)) { // 正则字面量（里面可能有引号，例如 /"/g）
          i++;
          let inClass = false;
          while (i < src.length) {
            const c = src[i];
            if (c === '\\') { i += 2; continue; }
            if (c === '[') inClass = true; else if (c === ']') inClass = false; else if (c === '/' && !inClass) break;
            i++;
          }
          prevSig = '/';
          continue;
        }
        if (ch === '{') depth++;
        if (ch === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
        if (!/\s/.test(ch)) prevSig = ch;
      }
      throw new Error('function ' + name + ' 的大括号没有配对');
    };

    const scanEl = { innerHTML: '' };
    const sortSandbox = {
      state: { scan: null, scanSort: 'original' },
      document: {
        getElementById(id) { return id === 'scanResults' ? scanEl : { innerHTML: '' }; },
        createElement() {
          let text = '';
          return {
            set textContent(v) { text = v; },
            get innerHTML() { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
          };
        }
      }
    };
    vmHtml.createContext(sortSandbox);
    vmHtml.runInContext(['sortScanFiles', 'escapeHtml', 'changeScanSort', 'renderScanResults'].map((n) => extractFn(scriptText, n)).join('\n'), sortSandbox);
    const sortFn = (files, mode) => JSON.parse(JSON.stringify(sortSandbox.sortScanFiles(files, mode))); // 跨 vm realm 的阵列，转回本 realm 才好比对
    const names = (files, mode) => sortFn(files, mode).map((f) => f.name);
    const named = (...ns) => ns.map((n, i) => ({ id: 'f' + i, name: n }));

    const origFiles = named('b.pdf', 'a.pdf', 'c.pdf');
    const origSnapshot = JSON.stringify(origFiles);
    const keptOriginal = sortSandbox.sortScanFiles(origFiles, 'original');
    assertEqual_('170.html·sortScanFiles original：维持 Drive 回传的原始顺序', names(origFiles, 'original'), ['b.pdf', 'a.pdf', 'c.pdf'], results);
    assertEqual_('170.html·sortScanFiles 不改动传入的阵列（回传的是新阵列；原始顺序留着才能切回去）', { sameRef: keptOriginal === origFiles, inputUnchanged: JSON.stringify(origFiles) === origSnapshot }, { sameRef: false, inputUnchanged: true }, results);

    const weekFiles = named('2026-W10.pdf', '2026-W2.pdf', '2026-W06.pdf');
    assertEqual_('170.html·sortScanFiles 升序：数字按数值比（W2 < W06 < W10，不是字串顺序）', names(weekFiles, 'name_asc'), ['2026-W2.pdf', '2026-W06.pdf', '2026-W10.pdf'], results);
    assertEqual_('170.html·sortScanFiles 降序：跟升序严格相反', names(weekFiles, 'name_desc'), ['2026-W10.pdf', '2026-W06.pdf', '2026-W2.pdf'], results);
    // 光看 A.pdf < b.pdf 抓不到「sensitivity 被改成分大小写」这种破坏（第一层字母顺序就决定了）；
    // 所以另外用「只差大小写的两个名字」当平手：不分大小写时它们是平手、保持原始顺序，分大小写就会被拆开。
    assertEqual_('170.html·sortScanFiles 不分大小写（A.pdf 排在 b.pdf 前面；只差大小写的 A.pdf / a.pdf 视为平手、保持原始顺序）', { letters: names(named('b.pdf', 'A.pdf', 'c.pdf'), 'name_asc'), tieAsc: names(named('A.pdf', 'a.pdf'), 'name_asc'), tieDesc: names(named('A.pdf', 'a.pdf'), 'name_desc') }, { letters: ['A.pdf', 'b.pdf', 'c.pdf'], tieAsc: ['A.pdf', 'a.pdf'], tieDesc: ['A.pdf', 'a.pdf'] }, results);

    const tieFiles = [{ id: 'first', name: 'x.pdf' }, { id: 'second', name: 'x.pdf' }, { id: 'third', name: 'a.pdf' }];
    assertEqual_('170.html·sortScanFiles 同名时保持原始顺序当 tie-breaker（升序、降序都一样，降序不会把同名反转）', { asc: sortFn(tieFiles, 'name_asc').map((f) => f.id), desc: sortFn(tieFiles, 'name_desc').map((f) => f.id) }, { asc: ['third', 'first', 'second'], desc: ['first', 'second', 'third'] }, results);

    let edgeThrew = false;
    let edgeResults = null;
    try {
      edgeResults = {
        unknownMode: names(origFiles, 'bogus'),
        nullFiles: sortFn(null, 'name_asc'),
        undefinedFiles: sortFn(undefined, 'name_desc'),
        missingName: sortFn([{ id: 'n1' }, { id: 'n2', name: 'a.pdf' }], 'name_asc').map((f) => f.id)
      };
    } catch (e) { edgeThrew = true; }
    assertEqual_('170.html·sortScanFiles 边界：未知 mode 当 original、null/undefined 回空阵列、缺 name 不抛错（缺 name 的当空字串排最前）', { edgeThrew, edgeResults }, { edgeThrew: false, edgeResults: { unknownMode: ['b.pdf', 'a.pdf', 'c.pdf'], nullFiles: [], undefinedFiles: [], missingName: ['n1', 'n2'] } }, results);

    // render：用真正的 renderScanResults / changeScanSort，不是另外重写。
    // 第三个文件名刻意含 < >，确认 escapeHtml 没被排序改动弄丢；名字用字母开头，避免测试依赖「标点 vs 数字」这种
    // 各 ICU 版本可能不同的排序细节（数字 < 字母 在所有 collation 都成立）。
    const renderFiles = [
      { id: 'r1', name: '2026-W10.pdf', alreadyImported: true },
      { id: 'r2', name: '2026-W2.pdf', alreadyImported: false },
      { id: 'r3', name: 'a<b>.pdf', alreadyImported: false }
    ];
    const renderOrder = () => (scanEl.innerHTML.match(/<span class="file-name">(.*?)<\/span>/g) || []).map((m) => m.replace(/<\/?span[^>]*>/g, ''));
    sortSandbox.state.scan = { files: renderFiles };
    sortSandbox.state.scanSort = 'original';
    sortSandbox.renderScanResults(sortSandbox.state.scan);
    assertEqual_('170.html·render 预设（original）：顺序跟扫描回传一致，标题数字不变（3 份 PDF，2 份待处理，1 份已汇入）', { order: renderOrder(), heading: /扫描结果 — 3 份 PDF，2 份待处理，1 份已汇入/.test(scanEl.innerHTML) }, { order: ['2026-W10.pdf', '2026-W2.pdf', 'a&lt;b&gt;.pdf'], heading: true }, results);

    sortSandbox.changeScanSort('name_desc');
    const selectedOptions = (scanEl.innerHTML.match(/<option value="([a-z_]+)" selected>/g) || []).map((m) => m.replace(/.*value="([a-z_]+)".*/, '$1'));
    assertEqual_('170.html·changeScanSort("name_desc")：state 更新、重新 render 成降序、下拉只有「降序」被选中', { stateSort: sortSandbox.state.scanSort, order: renderOrder(), selected: selectedOptions }, { stateSort: 'name_desc', order: ['a&lt;b&gt;.pdf', '2026-W10.pdf', '2026-W2.pdf'], selected: ['name_desc'] }, results);

    sortSandbox.changeScanSort('name_asc');
    assertEqual_('170.html·changeScanSort("name_asc")：切回升序（数字按数值：W2 在 W10 前面）', renderOrder(), ['2026-W2.pdf', '2026-W10.pdf', 'a&lt;b&gt;.pdf'], results);
    assertEqual_('170.html·render 不改动 state.scan.files 的顺序，也没有漏掉 escapeHtml（文件名里的 < > 仍然被转义）', { fileIds: sortSandbox.state.scan.files.map((f) => f.id), escaped: scanEl.innerHTML.indexOf('a<b>') === -1 }, { fileIds: ['r1', 'r2', 'r3'], escaped: true }, results);

    sortSandbox.state.scan = { files: [] };
    sortSandbox.renderScanResults(sortSandbox.state.scan);
    assertEqual_('170.html·资料夹没有 PDF：仍然显示原本的空状态，不渲染排序下拉', { empty: scanEl.innerHTML.indexOf('没有找到 PDF') !== -1, hasSelect: scanEl.innerHTML.indexOf('<select') !== -1 }, { empty: true, hasSelect: false }, results);

    // ============ PDF Import Recovery Center UI（2026-10-07；ADR-006 的 UI 部分）============
    // 同一套做法：从 HTML 抽出真正的函数丢进 vm，配假的 DOM 跟假的 google.script.run——后者由测试手动决定「后端什么时候
    // 回来」，才测得到「请求进行中」的状态。测的是 UI 逻辑 + render 输出 + 对后端的呼叫契约；真实 GAS 环境下
    // google.script.run 的传输行为、真实浏览器的呈现，仍然靠文件末尾的人工验证清单。
    const plain = (x) => JSON.parse(JSON.stringify(x));
    const REC_FNS = ['escapeHtml', 'escapeJs', 'escapeHtmlAttr', 'jsArg', 'money', 'stageBadge', 'reconBadge', 'showToast',
      'recoveryIsTab', 'recoveryIsRetryTab', 'recoveryItemsForTab', 'recoveryCanRetry', 'recoveryMatchesFilter', 'recoveryVisibleItems',
      'recoverySelectedRefs', 'recoveryFindItem', 'formatAttemptTime', 'renderRecoveryStatusLine', 'renderRecoveryTabs', 'renderRecoveryActions',
      'renderRecoverySummary', 'renderRecoveryItem', 'renderRecoveryList', 'renderRecovery', 'recoverySetTab', 'recoverySetFilter', 'recoveryToggle',
      'recoveryToggleAllVisible', 'recoveryMarkImported', 'loadRecoveryStatus', 'recoveryRetryOne', 'recoveryRetrySelected'];
    const recStateStmt = scriptText.match(/state\.recovery = \{[^;]*\};/)[0];
    const recTabsStmt = scriptText.match(/var RECOVERY_TABS = [^;]*;/)[0];
    const makeRec = function () {
      const els = {};
      const el = (id) => els[id] || (els[id] = { id, innerHTML: '', textContent: '', value: '', disabled: false, dataset: {}, classList: { add() {}, remove() {} } });
      const calls = [];
      const pending = [];
      const dashboards = [];
      const chain = (success, failure) => new Proxy({}, {
        get(_, name) {
          if (name === 'withSuccessHandler') return (fn) => chain(fn, failure);
          if (name === 'withFailureHandler') return (fn) => chain(success, fn);
          return (...args) => { const c = { name, args, success, failure }; calls.push(c); pending.push(c); };
        }
      });
      const sb = {
        document: {
          getElementById: el,
          createElement() { let t = ''; return { set textContent(v) { t = v; }, get innerHTML() { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }; }
        },
        google: { script: { run: chain(null, null) } },
        setTimeout() {}, Date, JSON, Object, Array, String, isNaN,
        renderDashboard(d) { dashboards.push(d); },
        state: { scan: null, scanSort: 'original' }
      };
      vmHtml.createContext(sb);
      vmHtml.runInContext(REC_FNS.map((n) => extractFn(scriptText, n)).join('\n') + '\n' + recStateStmt + '\n' + recTabsStmt, sb);
      return {
        S: sb, calls, pending, dashboards, el,
        text: (id) => (els[id] ? els[id].innerHTML : ''),
        toast: () => el('toast').textContent,
        resolve(i, value) { const c = pending.splice(i, 1)[0]; if (c.success) c.success(value); return c; },
        reject(i, err) { const c = pending.splice(i, 1)[0]; if (c.failure) c.failure(err); return c; }
      };
    };
    const recPending = [
      { documentId: 'DOC-P1', driveFileId: 'FID-P1', drivePath: '2026-W15.pdf', period: '2026-04-06~2026-04-12', status: 'Pending', attemptCount: 0 },
      { documentId: 'DOC-P2', driveFileId: 'FID-P2', drivePath: '2026-W16.pdf', status: 'Pending', evidenceUnavailable: true }
    ];
    const recFailed = [
      { documentId: 'DOC-F1', driveFileId: 'FID-F1', drivePath: '2026-W06.pdf', period: '2026-02-02~2026-02-08', status: 'Failed', lastError: 'LLM API 回传错误：This model is currently experiencing high demand', lastAttemptAt: '2026-10-02T03:14:00.000Z', attemptCount: 3 },
      { documentId: 'DOC-F2', driveFileId: 'FID-F2', drivePath: '2026-W07.pdf', status: 'Failed', lastError: '候选资料已抽取出来，但后续验证没有通过', lastAttemptAt: '2026-10-03', attemptCount: 1 },
      { documentId: 'DOC-F3\'x"<y>', driveFileId: '', drivePath: '<img src=x onerror=alert(1)>.pdf', status: 'Failed', lastError: 'x', lastAttemptAt: null, attemptCount: 1 }
    ];
    const recCompleted = [{ documentId: 'DOC-C1', driveFileId: 'FID-C1', drivePath: '2026-W14.pdf', incomeIds: ['CMP-INCOME-2026-W14'], period: '2026-03-30~2026-04-05' }];
    const recStatus = (over) => plain(Object.assign({ evidenceFolderConfigured: true, pending: recPending, failed: recFailed, completed: recCompleted }, over || {}));
    const recLoaded = function (over) { const h = makeRec(); h.S.loadRecoveryStatus(); h.resolve(0, recStatus(over)); return h; };
    const allTrue = (checks) => Object.keys(checks).reduce((o, k) => { o[k] = true; return o; }, {});

    const hf = makeRec();
    const mf = (item, text) => hf.S.recoveryMatchesFilter(item, text);
    assertEqual_('170.html·Recovery·Filter：不分大小写、空白分隔的每个词都要命中；比对路径/document id/期间/失败原因/income id；空筛选全过、缺栏位不抛错',
      [mf(recFailed[0], 'w06'), mf(recFailed[0], 'W06 HIGH'), mf(recFailed[0], 'doc-f1'), mf(recFailed[0], '2026-02-02'), mf(recFailed[0], 'high demand'), mf(recCompleted[0], 'cmp-income-2026-w14'), mf(recFailed[0], 'w06 nothere'), mf(recFailed[1], 'w06'), mf(recFailed[0], ''), mf({}, ''), mf({}, 'x')],
      [true, true, true, true, true, true, false, false, true, true, false], results);

    const hv = recLoaded();
    const vis = (tab, f) => plain(hv.S.recoveryVisibleItems(hv.S.state.recovery.data, tab, f)).map((i) => i.documentId);
    assertEqual_('170.html·Recovery·分页 + Filter 取得「目前看得到的」清单；未知分页回空阵列',
      { failed: vis('failed', ''), failedW06: vis('failed', 'w06'), pending: vis('pending', ''), completed: vis('completed', ''), unknown: vis('bogus', ''), none: vis('failed', 'zzz') },
      { failed: ['DOC-F1', 'DOC-F2', 'DOC-F3\'x"<y>'], failedW06: ['DOC-F1'], pending: ['DOC-P1', 'DOC-P2'], completed: ['DOC-C1'], unknown: [], none: [] }, results);

    const hs = recLoaded();
    const recS = hs.S.state.recovery;
    // 刻意连一个 Completed 的 DOC-C1 也塞进选取：真实使用里它只可能是「选了之后才变成 Completed」的残留，
    // 没有这一笔，Completed 分页的守卫（永远回空）就没有任何测试会碰到
    ['DOC-F1', 'DOC-F2', 'DOC-F3\'x"<y>', 'DOC-P1', 'DOC-C1', 'ghost'].forEach((id) => { recS.selected[id] = true; });
    const refsFailed = plain(hs.S.recoverySelectedRefs(recS));
    recS.filter = 'w06';
    const refsFiltered = plain(hs.S.recoverySelectedRefs(recS));
    recS.filter = ''; recS.tab = 'completed';
    const refsCompleted = plain(hs.S.recoverySelectedRefs(recS));
    recS.tab = 'pending';
    const refsPending = plain(hs.S.recoverySelectedRefs(recS));
    assertEqual_('170.html·Recovery·「重试选中的」只动：选中 ∩ 目前分页+筛选看得到 ∩ 有 Drive file id；被筛掉的选取不会被偷偷重试；Completed 分页永远是空',
      { failedTab: refsFailed, failedTabFiltered: refsFiltered, completedTab: refsCompleted, pendingTab: refsPending },
      { failedTab: [{ fileId: 'FID-F1', fileName: '2026-W06.pdf' }, { fileId: 'FID-F2', fileName: '2026-W07.pdf' }], failedTabFiltered: [{ fileId: 'FID-F1', fileName: '2026-W06.pdf' }], completedTab: [], pendingTab: [{ fileId: 'FID-P1', fileName: '2026-W15.pdf' }] }, results);

    const ft = hv.S.formatAttemptTime;
    assertEqual_('170.html·Recovery·formatAttemptTime：空 → —；不是日期就原样；纯日期原样；完整时间 → YYYY-MM-DD HH:MM',
      { empty: ft(null), invalid: ft('not a date'), dateOnly: ft('2026-10-03'), full: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(ft('2026-10-02T03:14:00.000Z')) },
      { empty: '—', invalid: 'not a date', dateOnly: '2026-10-03', full: true }, results);

    const hr = recLoaded();
    const failedHtml = hr.text('recoveryList');
    const failedChecks = {
      reason: failedHtml.indexOf('失败原因：LLM API 回传错误：This model is currently experiencing high demand') !== -1,
      attempts: failedHtml.indexOf('证据档共 3 份') !== -1,
      time: /最近一次尝试 \d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(failedHtml),
      badge: failedHtml.indexOf('<span class="badge failed">Failed</span>') !== -1,
      retryButton: failedHtml.indexOf('onclick="recoveryRetryOne(\'DOC-F1\')"') !== -1,
      checkbox: failedHtml.indexOf('onchange="recoveryToggle(\'DOC-F1\', this.checked)"') !== -1,
      nameEscaped: failedHtml.indexOf('<img') === -1 && failedHtml.indexOf('&lt;img src=x onerror=alert(1)&gt;.pdf') !== -1,
      argEncoding: failedHtml.indexOf('recoveryToggle(\'DOC-F3\\\'x&quot;&lt;y&gt;\', this.checked)') !== -1,
      noRetryWithoutFileId: failedHtml.indexOf('recoveryRetryOne(\'DOC-F3') === -1,
      noFileIdNote: failedHtml.indexOf('缺少 Drive file id') !== -1,
      defaultTabIsFailed: hr.S.state.recovery.tab === 'failed'
    };
    assertEqual_('170.html·Recovery·Failed 清单渲染：失败原因/次数/时间、Retry 与勾选框的 onclick；文件名跟 onclick 参数都经过转义；没有 Drive file id 的不给 Retry', failedChecks, allTrue(failedChecks), results);

    hr.S.recoverySetTab('pending');
    const pendingHtml = hr.text('recoveryList');
    const pendingChecks = {
      badge: pendingHtml.indexOf('<span class="badge pending">Pending</span>') !== -1,
      noEvidence: pendingHtml.indexOf('证据资料夹里还没有这份文件的抽取证据') !== -1,
      evidenceUnavailable: pendingHtml.indexOf('证据资料夹没接上，判断不出是否尝试过') !== -1,
      retryButton: pendingHtml.indexOf('recoveryRetryOne(\'DOC-P1\')') !== -1,
      selectAll: pendingHtml.indexOf('全选目前列出的 2 份') !== -1,
      activeTab: hr.text('recoveryTabs').indexOf('rec-tab secondary active" onclick="recoverySetTab(\'pending\')"') !== -1
    };
    assertEqual_('170.html·Recovery·Pending 清单渲染：区分「证据档里没有」跟「证据资料夹没接上、判断不出」；当前分页高亮', pendingChecks, allTrue(pendingChecks), results);

    hr.S.recoverySetTab('completed');
    const doneHtml = hr.text('recoveryList');
    const doneChecks = {
      noCheckbox: doneHtml.indexOf('type="checkbox"') === -1,
      noRetry: doneHtml.indexOf('recoveryRetryOne') === -1,
      income: doneHtml.indexOf('CMP-INCOME-2026-W14 · 2026-03-30~2026-04-05') !== -1,
      stamp: doneHtml.indexOf('badge stamp') !== -1,
      noActionBar: hr.text('recoveryActions') === ''
    };
    assertEqual_('170.html·Recovery·Completed 清单渲染：只显示、没有勾选框/Retry/操作列（它们不是卡住的文件）', doneChecks, allTrue(doneChecks), results);

    const hn = recLoaded({ evidenceFolderConfigured: false });
    const hStale = recLoaded();
    hStale.S.state.recovery.error = 'boom';
    hStale.S.renderRecovery();
    const statusChecks = {
      counts: hr.text('recoveryStatusLine').indexOf('Failed 3 · Pending 2 · Completed 1') !== -1,
      noNoteWhenConfigured: hr.text('recoveryStatusLine').indexOf('EXTRACTION_EVIDENCE_FOLDER_ID') === -1,
      noteWhenUnconfigured: hn.text('recoveryStatusLine').indexOf('EXTRACTION_EVIDENCE_FOLDER_ID') !== -1,
      errorKeepsStaleData: hStale.text('recoveryStatusLine').indexOf('rec-error') !== -1 && hStale.text('recoveryStatusLine').indexOf('下面显示的是上一次读取的结果') !== -1 && hStale.text('recoveryList').indexOf('DOC-F1') !== -1
    };
    assertEqual_('170.html·Recovery·状态列：显示三个分页的数量；证据资料夹没接上时明说（不假装分得出 Failed/Pending）；读取失败时保留上一次的资料并标明', statusChecks, allTrue(statusChecks), results);

    const he = recLoaded({ pending: [] });
    he.S.recoverySetTab('pending');
    const emptyTab = he.text('recoveryList');
    hr.S.recoverySetTab('failed');
    hr.S.recoverySetFilter('zzz-no-match');
    const emptyFilter = hr.text('recoveryList');
    assertEqual_('170.html·Recovery·空状态：分页本来就是空 vs 被筛选条件筛光，两种讯息不同',
      { tab: emptyTab.indexOf('目前没有 pending 的文件') !== -1, filtered: emptyFilter.indexOf('没有符合筛选条件的文件') !== -1 && emptyFilter.indexOf('3 份都被筛掉了') !== -1 },
      { tab: true, filtered: true }, results);

    const hl = makeRec();
    hl.S.loadRecoveryStatus();
    const midLoad = { callName: hl.calls[0].name, argCount: hl.calls[0].args.length, loading: hl.S.state.recovery.loading, refreshDisabled: hl.el('recoveryRefreshBtn').disabled, hint: hl.text('recoveryStatusLine').indexOf('读取中') !== -1 };
    hl.S.loadRecoveryStatus();
    const callsWhileLoading = hl.calls.length;
    hl.resolve(0, recStatus());
    assertEqual_('170.html·Recovery·读取：呼叫 consoleGetRecoveryStatus（无参数）、进行中禁用刷新、进行中再点不会发第二个请求；回来后默认落在 Failed，刷新钮恢复',
      { midLoad, callsWhileLoading, after: { loading: hl.S.state.recovery.loading, tab: hl.S.state.recovery.tab, refreshDisabled: hl.el('recoveryRefreshBtn').disabled, hasTabs: hl.text('recoveryTabs').indexOf('Failed <span class="rec-count">3</span>') !== -1 } },
      { midLoad: { callName: 'consoleGetRecoveryStatus', argCount: 0, loading: true, refreshDisabled: true, hint: true }, callsWhileLoading: 1, after: { loading: false, tab: 'failed', refreshDisabled: false, hasTabs: true } }, results);

    const hj = makeRec();
    hj.S.loadRecoveryStatus();
    hj.resolve(0, JSON.stringify(recStatus()));
    const hNull = makeRec(); hNull.S.loadRecoveryStatus(); hNull.resolve(0, null);
    const hBad = makeRec(); hBad.S.loadRecoveryStatus(); hBad.resolve(0, { pending: 1 });
    const hFail = makeRec(); hFail.S.loadRecoveryStatus(); hFail.reject(0, { message: 'boom' });
    const hOnlyPending = makeRec(); hOnlyPending.S.loadRecoveryStatus(); hOnlyPending.resolve(0, recStatus({ failed: [] }));
    const hOnlyDone = makeRec(); hOnlyDone.S.loadRecoveryStatus(); hOnlyDone.resolve(0, recStatus({ failed: [], pending: [] }));
    assertEqual_('170.html·Recovery·读取的各种回传：JSON 字串照样解析；null / 格式不对 = 明确的错误讯息、不崩、不留半套资料（真实 GAS 传输失败的样子）；失败 handler；首次读取依序落在 Failed → Pending → Completed',
      { json: plain(hj.S.state.recovery.data).failed.length, nullErr: hNull.S.state.recovery.error.indexOf('收到 null') !== -1 && hNull.S.state.recovery.data === null, badErr: hBad.S.state.recovery.error.indexOf('格式不对') !== -1 && hBad.S.state.recovery.data === null, fail: hFail.S.state.recovery.error, loadingReset: [hNull, hBad, hFail].every((h) => h.S.state.recovery.loading === false), tabPending: hOnlyPending.S.state.recovery.tab, tabCompleted: hOnlyDone.S.state.recovery.tab },
      { json: 3, nullErr: true, badErr: true, fail: '读取失败：boom', loadingReset: true, tabPending: 'pending', tabCompleted: 'completed' }, results);

    const hp = recLoaded();
    hp.S.recoveryToggle('DOC-F1', true);
    hp.S.recoveryToggle('DOC-F2', true);
    hp.S.loadRecoveryStatus();
    hp.resolve(0, recStatus({ failed: recStatus().failed.filter((f) => f.documentId !== 'DOC-F1'), completed: recStatus().completed }));
    assertEqual_('170.html·Recovery·重新读取后，已经不在 Pending/Failed 里的选取（例如刚重试成功）会被清掉，还在的保留',
      Object.keys(plain(hp.S.state.recovery.selected)), ['DOC-F2'], results);

    // ---- 单档 Retry ----
    const ho = recLoaded();
    ho.S.state.scan = { files: [{ id: 'FID-F1', name: '2026-W06.pdf', alreadyImported: false }] };
    ho.S.recoveryRetryOne('DOC-F1');
    const retryCall = ho.calls[ho.calls.length - 1];
    const busyHtml = ho.text('recoveryList');
    const callsBefore = ho.calls.length;
    ho.S.recoveryRetryOne('DOC-F2');
    ho.S.recoveryRetryOne('nonexistent');
    ho.S.recoveryRetryOne('DOC-F3\'x"<y>');
    ho.S.loadRecoveryStatus();
    const duringChecks = {
      callContract: JSON.stringify([retryCall.name, plain(retryCall.args)]) === JSON.stringify(['consoleRetryFile', ['FID-F1', '2026-W06.pdf']]),
      busy: ho.S.state.recovery.busy === true,
      allRetryButtonsDisabled: (busyHtml.match(/<button class="small secondary" disabled/g) || []).length === 2 && busyHtml.indexOf('<button class="small secondary" onclick') === -1,
      allCheckboxesDisabled: (busyHtml.match(/class="rec-check" disabled/g) || []).length === 3,
      refreshDisabled: ho.el('recoveryRefreshBtn').disabled === true,
      busyLabel: ho.text('recoveryActions').indexOf('重试中：2026-W06.pdf') !== -1,
      noSecondRequest: ho.calls.length === callsBefore
    };
    assertEqual_('170.html·Recovery·单档 Retry：呼叫 consoleRetryFile(driveFileId, drivePath)；进行中全部按钮/勾选框/刷新都禁用、再点其他的（含不存在的、没有 file id 的、刷新）都不会发第二个请求', duringChecks, allTrue(duringChecks), results);

    ho.resolve(0, { fileId: 'FID-F1', fileName: '2026-W06.pdf', stage: 'Verified', incomeId: 'CMP-INCOME-2026-W06', net: 123.4, rebuild: { marker: 'rebuild' } });
    const afterChecks = {
      busyCleared: ho.S.state.recovery.busy === false,
      toast: ho.toast() === '重试成功：2026-W06.pdf',
      dashboardRefreshed: ho.dashboards.length === 1 && ho.dashboards[0].marker === 'rebuild',
      statusReread: ho.pending.length === 1 && ho.pending[0].name === 'consoleGetRecoveryStatus',
      scanMarked: ho.S.state.scan.files[0].alreadyImported === true,
      summary: ho.text('recoverySummary').indexOf('最近一次重试：处理了 1 份') !== -1 && ho.text('recoverySummary').indexOf('Verified') !== -1 && ho.text('recoverySummary').indexOf('CMP-INCOME-2026-W06') !== -1
    };
    assertEqual_('170.html·Recovery·单档 Retry 成功后：解除忙碌、toast、Dashboard 用 rebuild 刷新、扫描清单里那笔标成已汇入、显示结果摘要、自动重新读取现况', afterChecks, allTrue(afterChecks), results);

    const hq = recLoaded();
    hq.S.recoveryRetryOne('DOC-F1');
    hq.resolve(0, { fileId: 'FID-F1', fileName: '2026-W06.pdf', stage: 'Extraction_Failed', error: '503', rebuild: {} });
    const hq2 = recLoaded();
    hq2.S.recoveryRetryOne('DOC-F1');
    hq2.reject(0, { message: 'Exceeded maximum execution time' });
    assertEqual_('170.html·Recovery·单档 Retry 仍失败 / 后端丢例外：toast 照实说、不假装成功、解除忙碌',
      { stillFailed: hq.toast(), stillFailedNotImported: hq.S.state.scan === null, errToast: hq2.toast(), errBusyCleared: hq2.S.state.recovery.busy === false, errNoRefresh: hq2.pending.length === 0 },
      { stillFailed: '重试后仍是：Extraction_Failed', stillFailedNotImported: true, errToast: '重试失败：Exceeded maximum execution time', errBusyCleared: true, errNoRefresh: true }, results);

    // ---- 选取多档 Retry ----
    const hm = recLoaded();
    hm.S.recoveryRetrySelected();
    const noneChecks = { noCall: hm.calls.length === 1, toast: hm.toast() === '还没有选任何可以重试的文件', buttonDisabled: hm.text('recoveryActions').indexOf('<button class="small" disabled') !== -1 };
    assertEqual_('170.html·Recovery·没选任何文件时：按钮是禁用的，硬呼叫也不会发请求（只有 toast）', noneChecks, allTrue(noneChecks), results);

    hm.S.recoveryToggle('DOC-F1', true);
    hm.S.recoveryToggle('DOC-F2', true);
    const barBefore = hm.text('recoveryActions');
    hm.S.recoveryRetrySelected();
    const selCall = hm.calls[hm.calls.length - 1];
    const selChecks = {
      barCount: barBefore.indexOf('已选 2 份') !== -1 && barBefore.indexOf('重试选中的 2 份') !== -1 && barBefore.indexOf('<button class="small" disabled') === -1,
      callContract: JSON.stringify([selCall.name, plain(selCall.args)]) === JSON.stringify(['consoleRetrySelectedFiles', [[{ fileId: 'FID-F1', fileName: '2026-W06.pdf' }, { fileId: 'FID-F2', fileName: '2026-W07.pdf' }]]]),
      busyLabel: hm.text('recoveryActions').indexOf('批次重试中：2 份') !== -1,
      buttonDisabledWhileBusy: hm.text('recoveryActions').indexOf('<button class="small" disabled') !== -1
    };
    assertEqual_('170.html·Recovery·重试选中的：呼叫 consoleRetrySelectedFiles([{fileId, fileName}…])（只有选中且能重试的），进行中按钮禁用并显示进度', selChecks, allTrue(selChecks), results);

    hm.resolve(0, { attemptedCount: 1, remainingCount: 1, stoppedEarly: true, results: [{ fileId: 'FID-F1', fileName: '2026-W06.pdf', stage: 'Verified', incomeId: 'CMP-INCOME-2026-W06', net: 10 }], rebuild: { marker: 'rebuild2' } });
    const summaryHtml = hm.text('recoverySummary');
    const stopChecks = {
      busyCleared: hm.S.state.recovery.busy === false,
      stillSelected: JSON.stringify(Object.keys(plain(hm.S.state.recovery.selected))) === JSON.stringify(['DOC-F2']),
      stoppedEarlyNote: summaryHtml.indexOf('时间预算用完，提早停止') !== -1 && summaryHtml.indexOf('还剩 1 份') !== -1,
      resultListed: summaryHtml.indexOf('2026-W06.pdf') !== -1 && summaryHtml.indexOf('Verified') !== -1,
      toast: hm.toast().indexOf('提早停止') !== -1,
      dashboard: hm.dashboards.length === 1 && hm.dashboards[0].marker === 'rebuild2',
      reread: hm.pending.length === 1 && hm.pending[0].name === 'consoleGetRecoveryStatus'
    };
    assertEqual_('170.html·Recovery·重试选中的回来后（时间预算提早停止）：处理过的从选取拿掉、没处理到的保持选中、明说「不是失败」并提示再点一次、Dashboard 刷新、自动重新读取', stopChecks, allTrue(stopChecks), results);

    const hz = recLoaded();
    hz.S.recoveryToggle('DOC-F1', true);
    hz.S.recoveryRetrySelected();
    hz.resolve(0, null);
    const nullChecks = {
      toast: hz.toast().indexOf('后端回传是空的') !== -1,
      noFakeSummary: hz.text('recoverySummary') === '',
      busyCleared: hz.S.state.recovery.busy === false,
      reread: hz.pending.length === 1 && hz.pending[0].name === 'consoleGetRecoveryStatus',
      selectionKept: JSON.stringify(Object.keys(plain(hz.S.state.recovery.selected))) === JSON.stringify(['DOC-F1'])
    };
    assertEqual_('170.html·Recovery·重试选中的拿到 null（google.script.run 传输失败的样子）：不假装知道结果、不显示假的摘要、重新读取现况；选取保持原样', nullChecks, allTrue(nullChecks), results);

    const ht = recLoaded();
    ht.S.recoverySetTab('pending');
    ht.S.recoveryToggleAllVisible(true);
    const afterAll = Object.keys(plain(ht.S.state.recovery.selected)).sort();
    ht.S.recoverySetFilter('w15');
    ht.S.recoveryToggleAllVisible(false);
    const afterPartialClear = Object.keys(plain(ht.S.state.recovery.selected)).sort();
    ht.S.recoverySetTab('completed');
    ht.S.recoveryToggleAllVisible(true);
    const afterCompleted = Object.keys(plain(ht.S.state.recovery.selected)).sort();
    assertEqual_('170.html·Recovery·全选只作用于目前看得到的（被筛掉的不受影响）；Completed 分页的全选什么都不做',
      { afterAll, afterPartialClear, afterCompleted }, { afterAll: ['DOC-P1', 'DOC-P2'], afterPartialClear: ['DOC-P2'], afterCompleted: ['DOC-P2'] }, results);

    // ---- 页面结构（不靠 vm，直接检查 HTML 文本）----
    const iImport = htmlText.indexOf('<div id="importResults"></div>');
    const iRecovery = htmlText.indexOf('<section id="recoverySection">');
    const iFallback = htmlText.indexOf('<details class="fallback">');
    const initTail = scriptText.slice(scriptText.lastIndexOf('loadDashboard();') - 40);
    const structureChecks = {
      sectionBetweenImportAndFallback: iImport !== -1 && iRecovery > iImport && iFallback > iRecovery,
      allContainers: ['recoveryRefreshBtn', 'recoveryFilter', 'recoveryStatusLine', 'recoveryTabs', 'recoveryActions', 'recoverySummary', 'recoveryList'].every((id) => htmlText.indexOf('id="' + id + '"') !== -1),
      filterWiredStatic: htmlText.indexOf('id="recoveryFilter" type="text"') !== -1 && htmlText.indexOf('oninput="recoverySetFilter(this.value)"') !== -1,
      // 说明文字里会出现「没有『全部重试』」这几个字，所以不能比对中文；改成比对程式结构：重试入口只有这两个、没有任何 retryAll 标识符
      noRetryAll: !/retry_?all/i.test(htmlText) && JSON.stringify(Array.from(new Set(scriptText.match(/recoveryRetry\w*/g) || [])).sort()) === JSON.stringify(['recoveryRetryOne', 'recoveryRetrySelected']),
      firstRenderButNoAutoLoad: initTail.indexOf('renderRecovery();') !== -1 && initTail.indexOf('loadRecoveryStatus') === -1
    };
    assertEqual_('170.html·Recovery·页面结构：区块在「Drive 汇入」之后、Debug/Fallback 之前；容器齐全；Filter 是静态输入框（重绘清单不会抢走焦点）；没有「全部重试」功能（重试入口只有单档跟选取多档两个）；页面载入只渲染初始提示、不自动打后端', structureChecks, allTrue(structureChecks), results);
  }

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllOperatorConsoleTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllOperatorConsoleTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllOperatorConsoleTests };
}

/**
 * ============ 人工验证清单 ============
 * [x] 真实 GAS 环境：部署成 Web App，doGet 真的能打开 170_OperatorConsole.html
 *     （2026-08-20 Steven 已确认：Drive 扫描 + 汇入在真实 GAS 跑通）
 * [ ] 公开 wrapper 改名后重新部署，170_OperatorConsole.html 七个
 *     google.script.run 呼叫（consoleGetDashboard/consoleScanFolder/
 *     consoleBatchImport/consoleRetryFile/consoleManualImport/
 *     consoleSaveLastFolderId/consoleGetLastFolderId）都要跟公开函数名
 *     对上，不能还留着带下划线的旧名字——两边有一个没改对，google.script.run
 *     一样叫不到
 * [ ] "手动贴 statement" 重新测一次——上次只确认了 Drive 汇入这条路径
 * [ ] 真实 Drive Folder 扫描：确认 alreadyImported 判定正确，且真的没有
 *     重复下载/hash 已经汇入过的文件（省下的 API 配额是这层去重存在的
 *     意义）
 * [ ] 真实批次汇入 2026-01 至今的 Grab Weekly Statement：Node 环境测不到
 *     的「Extraction 真的成功、走到 Verified」这条路径，只有这里能验证
 * [ ] 批次汇入中途手动中断（例如关掉页面），确认已经成功的文件不会在
 *     下次扫描时被重复处理，未完成的文件用 Retry 能继续
 * [ ] appsscript.json 的 webapp 存取权限设定符合预期（只有 Steven 自己能开）
 * [ ] 2026-08-22 新增·月度总览 UI：真实 GAS 部署后点年份/月份 pill 能正确
 *     切换，「追溯来源」按钮能叫到 consoleGetIncomeDetail 并显示 Drive 连结，
 *     连结真的能打开对应的原始 PDF（不是打开别份文件）
 * [ ] 找一个真实存在的跨月 Statement（回填历史资料后应该会有），确认
 *     Needs_Allocation 警示区块真的会出现，且两个月份的 pill 都有 ⚠ 标记
 * [ ] 2026-08-23 新增·LLM API 429/5xx 重试退避（127_LLMExtractor.js 的
 *     httpClient.postJson）：UrlFetchApp 是真的 GAS 服务，Node 测不了，
 *     真实批次汇入时留意 log 有没有出现重试訊息，抓一次真的因为限流触发
 *     重试的情况确认行为符合预期
 * [ ] 2026-08-23 新增·批次汇入时间预算：真的拿几十份文件测一次，确认
 *     6 分钟内没跑完时会 stoppedEarly 而不是被 GAS 直接杀掉报错；重新
 *     呼叫一次批次汇入确认会接着处理剩下的，不会重复也不会漏
 * [ ] 2026-08-23 新增·卡住文件自动重试：故意让某份文件的抽取失败一次
 *     （例如暂时关闭网络或用一份格式很怪的 PDF），确认下次批次汇入会
 *     自动重新尝试这份文件，不会永久消失在扫描结果里
 * [ ] 2026-10-07 新增·扫描结果排序（170.html）：真实浏览器里扫描一个有多份 PDF 的资料夹，
 *     切换「原始顺序 / 文件名升序 / 文件名降序」确认顺序真的变、切回原始顺序时跟 Drive
 *     回传一致；标题的「X 份待处理、Y 份已汇入」数字不会因排序改变；排序后对某一笔点
 *     Retry/汇入，清单显示没有错位。Node 只测了排序逻辑跟 render 输出，没有在真实
 *     HTML Service 里渲染过
 * [ ] 2026-10-07 新增·PDF 汇入恢复中心 UI（170.html 的「PDF 汇入恢复中心」区块），部署到真实 GAS 后逐项确认：
 *     (a) 点「刷新状态」后三个分页的数量，跟 Documents / Verified_Income / 证据资料夹的实际情况对得上；
 *         特别是 2026-W06.pdf 这个真实案例是否被正确分类、失败原因是否是人看得懂的一句话；
 *     (b) 真实 google.script.run 回传的 consoleGetRecoveryStatus 不是 null（2026-09-27 consoleGetDashboard 撞过
 *         Date 传输问题；如果这里收到 null，区块会显示「后端回传的资料格式不对」——那就改成回传 JSON 字串）；
 *     (c) 单档 Retry、选取多档「重试选中的」真的能跑完、Dashboard 跟月度总览随后更新、该文件移到 Completed；
 *     (d) 选很多份、让它碰到时间预算：确认显示「时间预算用完，提早停止」、没处理到的仍保持选中、再点一次会接着处理；
 *     (e) 证据资料夹没设定（EXTRACTION_EVIDENCE_FOLDER_ID 留空）时，区块有明确的警告、所有未完成的都在 Pending；
 *     (f) 手机/窄萤幕上勾选框、按钮、Filter 输入框排版没有爆版。Node 只测了 UI 逻辑跟 render 输出，没有在真实
 *         HTML Service 里渲染过
 */
