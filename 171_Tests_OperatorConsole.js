if (typeof require === 'function') {
  var {
    buildConsoleDeps_, consoleScanFolder_, consoleImportOneDriveFile_, consoleBatchImport_,
    consoleRetryFile_, consoleManualImport_, consoleRebuildProjections_, consoleGetDashboard_,
    consoleGetIncomeDetail_, consoleGetDashboard, consoleGetLastFolderId, consoleScanFolder,
    consoleManualImport, consoleGetIncomeDetail
  } = require('./170_OperatorConsole.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { createSheetReader_ } = require('./117_SheetReader.js');
  var { createRiderOSAdapter_ } = require('./123_RiderOSAdapter.js');
  require('./130_Reconciliation.js');
  var { VERIFIED_INCOME_COLUMNS } = require('./140_VerifiedIncome.js');
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
  const { DocumentTextExtractor: dte3c } = require('./112_DocumentTextExtractor.js');
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
  const deps7a = fakeConsoleDeps_([{ id: 'f1', name: 'a.pdf' }]);
  const deps7b = fakeConsoleDeps_([{ id: 'f1', name: 'a.pdf' }]);
  assertEqual_('consoleScanFolder 转发结果跟 consoleScanFolder_ 一致', consoleScanFolder('folder1', deps7a), consoleScanFolder_('folder1', deps7b), results);

  const deps8a = fakeConsoleDeps_([]);
  const deps8b = fakeConsoleDeps_([]);
  assertEqual_('consoleManualImport 转发结果跟 consoleManualImport_ 一致', consoleManualImport(TEST_FIXTURE_GRAB_WEEKLY_STATEMENT, deps8a), consoleManualImport_(TEST_FIXTURE_GRAB_WEEKLY_STATEMENT, deps8b), results);

  const deps9a = fakeConsoleDeps_([]);
  const deps9b = fakeConsoleDeps_([]);
  assertEqual_('consoleGetDashboard 转发结果跟 consoleGetDashboard_ 一致', consoleGetDashboard(deps9a), consoleGetDashboard_(deps9b), results);

  assertEqual_('consoleGetLastFolderId 公开版本可呼叫、不抛错（Node 下 PropertiesService 不存在，两版本都回 null）', consoleGetLastFolderId(), null, results);

  const deps11a = fakeConsoleDeps_([]);
  deps11a._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W33', '2026-W33', 'MYR', 1000, 100, 50, 0, -50, 1100, 1100, 'Compliance OS', 'Grab', 'Verified', '2026-08-17T00:00:00Z', null, 'GrabWeeklyParser', '2026-08-10', '2026-08-16']);
  const deps11b = fakeConsoleDeps_([]);
  deps11b._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W33', '2026-W33', 'MYR', 1000, 100, 50, 0, -50, 1100, 1100, 'Compliance OS', 'Grab', 'Verified', '2026-08-17T00:00:00Z', null, 'GrabWeeklyParser', '2026-08-10', '2026-08-16']);
  assertEqual_('consoleGetIncomeDetail 转发结果跟 consoleGetIncomeDetail_ 一致', consoleGetIncomeDetail('CMP-INCOME-2026-W33', deps11a), consoleGetIncomeDetail_('CMP-INCOME-2026-W33', deps11b), results);

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
 */
