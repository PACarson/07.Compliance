if (typeof require === 'function') {
  var {
    buildConsoleDeps_, consoleScanFolder_, consoleImportOneDriveFile_, consoleBatchImport_,
    consoleRetryFile_, consoleManualImport_, consoleRebuildProjections_, consoleGetDashboard_,
    consoleGetDashboard, consoleGetLastFolderId, consoleScanFolder, consoleManualImport
  } = require('./170_OperatorConsole.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { createSheetReader_ } = require('./117_SheetReader.js');
  var { createRiderOSAdapter_ } = require('./123_RiderOSAdapter.js');
  require('./130_Reconciliation.js');
  require('./140_VerifiedIncome.js');
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

  // ============ consoleScanFolder_：drive_file_id 去重 ============
  const deps1 = fakeConsoleDeps_([{ id: 'f1', name: 'a.pdf' }, { id: 'f2', name: 'b.pdf' }, { id: 'f3', name: 'c.pdf' }]);
  deps1._accessor.appendRow('Documents', ['CMP-DOC-old', 'Grab', 'Weekly Statement', 'Income', '2026-W29', 'oldhash', 'f2', 'path', 'Imported']);
  const scan = consoleScanFolder_(null, deps1);
  assertEqual_('scan·三个文件都列出来', scan.files.length, 3, results);
  const f2 = scan.files.find((f) => f.id === 'f2');
  const f1 = scan.files.find((f) => f.id === 'f1');
  assertEqual_('scan·f2 的 drive_file_id 已经在 Documents 里，标记已汇入', f2.alreadyImported, true, results);
  assertEqual_('scan·f1 是新的，标记未汇入', f1.alreadyImported, false, results);

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

  // ============ consoleBatchImport_：只处理未汇入的，一个失败不影响其他，结束会重建 ============
  const deps4 = fakeConsoleDeps_([{ id: 'f1', name: 'a.pdf' }, { id: 'f2', name: 'b.pdf' }, { id: 'f3', name: 'c.pdf' }]);
  deps4._accessor.appendRow('Documents', ['CMP-DOC-old2', 'Grab', 'Weekly Statement', 'Income', '2026-W29', 'oldhash2', 'f3', 'path', 'Imported']);
  const batchResult = consoleBatchImport_(null, deps4);
  assertEqual_('批次·总共扫到 3 个', batchResult.scannedCount, 3, results);
  assertEqual_('批次·已汇入 1 个，只处理 2 个', batchResult.attemptedCount, 2, results);
  assertEqual_('批次·两个都跑完了（没有因为其中一个失败就中断）', batchResult.results.length, 2, results);
  assertEqual_('批次·重建有回传 monthlySummaries', Array.isArray(batchResult.rebuild.monthlySummaries), true, results);

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
  deps6._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W26', '2026-W26', 'MYR', 1000, 100, 50, 0, -50, 1100, 1100, 'Compliance OS', 'Grab', 'Verified', '2026-07-01T00:00:00Z']);
  deps6._accessor.appendRow('Verified_Income', ['CMP-INCOME-2026-W30', '2026-W30', 'MYR', 1200, 200, 60, 0, -60, 1400, 1400, 'Compliance OS', 'Grab', 'Verified', '2026-07-28T00:00:00Z']);
  const rebuild6 = consoleRebuildProjections_(deps6);
  assertEqual_('重建·两笔分属不同月份，monthlySummaries 有两笔', rebuild6.monthlySummaries.length, 2, results);
  assertEqual_('重建·totalVerifiedCount 是 2', rebuild6.totalVerifiedCount, 2, results);
  assertEqual_('重建·YTD 涵盖两笔的总和', rebuild6.ytd.net, 2500, results);

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
 */
