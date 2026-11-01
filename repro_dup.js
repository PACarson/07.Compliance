'use strict';
/**
 * repro_dup.js —— Phase P（重复 Documents / Verified_Income）只读调查的最小复现脚本
 *
 * 性质：调查用，不是测试套件；只在「repo 副本」上运行，不修改任何文件，不联网，
 * 不碰真实 GAS / Sheets / Drive / Gemini。所有 I/O 都是内存假对象（沿用 105_TestUtils.js
 * 的 fakeSheetAccessor_ / fakeLockProvider_），所以结论是 Node 层级的证据，
 * 【不能】当作真实 GAS 环境的验证（真实 GAS 的并发行为见报告里标【待确认】的部分）。
 *
 * 用法（从 repo 目录之外运行；repo 目录只作为参数传入）：
 *   node repro_dup.js <Compliance repo 副本目录>
 *
 * 每个场景打印「观察到的事实」；脚本本身不做 pass/fail 判定，退出码恒为 0。
 */
const path = require('path');

const repoDir = process.argv[2];
if (!repoDir) {
  console.error('用法: node repro_dup.js <Compliance repo 副本目录>');
  process.exit(2);
}
const R = (f) => require(path.resolve(repoDir, f));

// 被测代码里的占位实现（EventPublisher / RiderOSAdapter）会往 console.log 打很多行；
// 这些行跟调查无关，过滤掉，只留下本脚本自己的输出。
const realLog = console.log.bind(console);
console.log = (...args) => {
  const first = String(args[0]);
  if (first.indexOf('[EventPublisher') === 0 || first.indexOf('[RiderOSAdapter') === 0) return;
  realLog(...args);
};

const C170 = R('170_OperatorConsole.js');
const { createTruthWriter_ } = R('115_TruthWriter.js');
const { createSheetReader_ } = R('117_SheetReader.js');
const { createRiderOSAdapter_ } = R('123_RiderOSAdapter.js');
const { RECONCILIATION_LOG_COLUMNS } = R('130_Reconciliation.js');
const { VERIFIED_INCOME_COLUMNS } = R('140_VerifiedIncome.js');
const { DOCUMENTS_COLUMNS } = R('110_DocumentImport.js');
const { DocumentTextExtractor } = R('112_DocumentTextExtractor.js');
const { fakeStore_, fakeSheetAccessor_, fakeLockProvider_ } = R('105_TestUtils.js');
const { computeMonthlyIncomeSummary_ } = R('160_MonthlyProjection.js');
const { DAILY_ALLOCATION_COLUMNS } = R('142_DailyOrderAllocation.js');

// ---------- 假环境 ----------

function makeEnv(now) {
  const accessor = fakeSheetAccessor_();
  return {
    accessor,
    truthWriter: createTruthWriter_(accessor, fakeLockProvider_()),
    liveReader: createSheetReader_(accessor),
    now
  };
}

/** 一份跟 buildConsoleDeps_() 同形状的 deps。reader 可以换成「冻结的旧快照」来模拟「读发生在别人写入之前」。 */
function depsFor(env, files, opts) {
  const o = opts || {};
  return {
    truthWriter: env.truthWriter,
    sheetReader: o.reader || env.liveReader,
    riderOSAdapter: createRiderOSAdapter_(fakeStore_()),
    folderScanner: {
      listPdfFiles() { return files; },
      getFileHash(fileId) { return o.hashFn ? o.hashFn(fileId) : `hash-of-${fileId}`; }
    },
    now: o.now || env.now
  };
}

function rows(env, sheet, cols) {
  return env.accessor.getWritten(sheet).map((r) => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = r[i]; });
    return obj;
  });
}

function distinct(arr) { return Array.from(new Set(arr)); }

/** 冻结当下状态，返回一个只会回传旧快照的 sheetReader。 */
function freezeReader(env) {
  const snap = {
    Documents: env.liveReader.readAll('Documents', DOCUMENTS_COLUMNS),
    Verified_Income: env.liveReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS),
    Daily_Allocation: env.liveReader.readAll('Daily_Allocation', DAILY_ALLOCATION_COLUMNS)
  };
  return { readAll(sheetName) { return (snap[sheetName] || []).slice(); } };
}

// ---------- 假的抽取器：用 112 的 DocumentTextExtractor 单例换掉 extract()，沿用 171 的做法 ----------

/** 周一开始的 7 天区间；金额结构沿用 171 的合法 candidate（net=450 -> total_income 500）。 */
function candidate(startParts, net) {
  const start = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
  const end = new Date(start.getTime() + 6 * 24 * 3600 * 1000);
  const totalIncome = net + 50;
  return {
    document_meta: {
      source: 'Grab', document_type: 'Weekly Statement', currency: 'MYR',
      period_start_parts: { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1, day: start.getUTCDate() },
      period_end_parts: { year: end.getUTCFullYear(), month: end.getUTCMonth() + 1, day: end.getUTCDate() }
    },
    summary: { total_income: totalIncome, total_deductions: 50, weekly_net: net },
    income_breakdown: { net_delivery_income: totalIncome - 200, incentive: 100, tip: 80, other_payments: 20 },
    extraction_notes: ''
  };
}

const originalExtract = DocumentTextExtractor.extract;
function installExtractor(plan) {
  DocumentTextExtractor.extract = function (document) {
    const p = plan[document.fileId];
    if (!p) throw new Error(`repro: 没有为 fileId=${document.fileId} 准备抽取结果`);
    if (p.fail) throw new Error('repro: 模拟抽取失败（例如 Gemini 503）');
    return {
      mode: 'structured',
      candidate: candidate(p.start, p.net),
      evidence: { extractorId: 'LLMExtractor:repro', extractionVersion: 'repro-v1', evidenceFileId: `ev-${document.fileId}` }
    };
  };
}
function restoreExtractor() { DocumentTextExtractor.extract = originalExtract; }

const W28 = [2026, 7, 6];
const W29 = [2026, 7, 13];
const W30 = [2026, 7, 20];

function show(title, obj) {
  realLog(`\n===== ${title} =====`);
  realLog(JSON.stringify(obj, null, 2));
}

try {
  // ---------------------------------------------------------------------------------------------
  // S1：同一次 consoleBatchImport_ 里三份「内容不同、周也不同」的新文件，全部成功。
  // 想看：document_id 是否唯一；Verified_Income.source_document_id 追溯到哪份文件。
  // ---------------------------------------------------------------------------------------------
  {
    const env = makeEnv(new Date('2026-10-01T10:00:00Z'));
    installExtractor({ F1: { start: W28, net: 450 }, F2: { start: W29, net: 450 }, F3: { start: W30, net: 450 } });
    const files = [{ id: 'F1', name: 'w28.pdf' }, { id: 'F2', name: 'w29.pdf' }, { id: 'F3', name: 'w30.pdf' }];
    const res = C170.consoleBatchImport_('folder', depsFor(env, files));
    const docs = rows(env, 'Documents', DOCUMENTS_COLUMNS);
    const vi = rows(env, 'Verified_Income', VERIFIED_INCOME_COLUMNS);
    const detailW30 = C170.consoleGetIncomeDetail_('CMP-INCOME-2026-W30', depsFor(env, []));
    show('S1 同批三份新文件（各自不同的一周）', {
      stages: res.results.map((r) => `${r.fileId}:${r.stage}`),
      documentsRows: docs.length,
      distinctDocumentIds: distinct(docs.map((d) => d.document_id)).length,
      documentIdsSeen: distinct(docs.map((d) => d.document_id)),
      verifiedIncomeRows: vi.length,
      sourceDocumentIdByIncome: vi.map((v) => `${v.income_id} -> ${v.source_document_id}`),
      drillDown_W30_shouldPointTo_F3: detailW30.document && detailW30.document.driveFileId
    });
  }

  // ---------------------------------------------------------------------------------------------
  // S2：同批两份，第一份抽取失败，第二份成功（N22 / N25 那类情形）。
  // 想看：失败的那份会不会被 Scan / Recovery Center 当成「已完成」；Drill-down 指向哪份 PDF。
  // ---------------------------------------------------------------------------------------------
  {
    const env = makeEnv(new Date('2026-10-01T10:00:00Z'));
    installExtractor({ A: { fail: true }, B: { start: W30, net: 450 } });
    const files = [{ id: 'A', name: 'a-failed.pdf' }, { id: 'B', name: 'b-ok.pdf' }];
    const res = C170.consoleBatchImport_('folder', depsFor(env, files));
    const scan = C170.consoleScanFolder_('folder', depsFor(env, files));
    const recovery = C170.consoleGetRecoveryStatus_(depsFor(env, []));
    const detail = C170.consoleGetIncomeDetail_('CMP-INCOME-2026-W30', depsFor(env, []));
    show('S2 同批两份：A 抽取失败、B 成功', {
      stages: res.results.map((r) => `${r.fileId}:${r.stage}`),
      documentsRows: rows(env, 'Documents', DOCUMENTS_COLUMNS).map((d) => `${d.drive_file_id}:${d.document_id}`),
      verifiedIncome: rows(env, 'Verified_Income', VERIFIED_INCOME_COLUMNS).map((v) => `${v.income_id} src=${v.source_document_id}`),
      scanAfterwards_A_should_needRetry: scan.files.map((f) => `${f.id}: alreadyImported=${f.alreadyImported} needsRetry=${f.needsRetry}`),
      recoveryCenter_completed: recovery.completed.map((c) => c.driveFileId),
      recoveryCenter_pending: recovery.pending.map((c) => c.driveFileId),
      recoveryCenter_failed: recovery.failed.map((c) => c.driveFileId),
      drillDown_W30_shouldPointTo_B: detail.document && detail.document.driveFileId
    });
  }

  // ---------------------------------------------------------------------------------------------
  // S3：同批两份「内容不同、同一周」（例如同一周的对账单后来被更正重发、两份都放进了同一个资料夹）。
  // 想看：Verified_Income / Reconciliation_Log 的重复；160 保留哪一行；totalVerifiedCount。
  // ---------------------------------------------------------------------------------------------
  {
    const env = makeEnv(new Date('2026-10-01T10:00:00Z'));
    installExtractor({ G1: { start: W30, net: 450 }, G2: { start: W30, net: 460 } });
    const files = [{ id: 'G1', name: 'w30-original.pdf' }, { id: 'G2', name: 'w30-reissued.pdf' }];
    const res = C170.consoleBatchImport_('folder', depsFor(env, files));
    const vi = rows(env, 'Verified_Income', VERIFIED_INCOME_COLUMNS);
    const rec = rows(env, 'Reconciliation_Log', RECONCILIATION_LOG_COLUMNS);
    const summary = computeMonthlyIncomeSummary_(vi, '2026-07');
    const rebuild = C170.consoleRebuildProjections_(depsFor(env, []));
    show('S3 同批两份、同一周、内容不同', {
      stages: res.results.map((r) => `${r.fileId}:${r.stage}`),
      verifiedIncomeRows: vi.length,
      distinctIncomeIds: distinct(vi.map((v) => v.income_id)).length,
      netPerRow: vi.map((v) => `${v.source_document_id} net=${v.net}`),
      reconciliationLogRows: rec.length,
      distinctReconciliationIds: distinct(rec.map((r) => r.reconciliation_id)).length,
      monthlySummary_2026_07: { week_count: summary.week_count, net: summary.net },
      consoleRebuild_totalVerifiedCount: rebuild.totalVerifiedCount
    });
  }

  // ---------------------------------------------------------------------------------------------
  // S4：相同内容（相同 file_hash）的两份文件：同一批 vs 分两次执行（对照组）。
  // ---------------------------------------------------------------------------------------------
  {
    const sameHash = () => 'SAME-CONTENT-HASH';
    // 同一批
    const envA = makeEnv(new Date('2026-10-01T10:00:00Z'));
    installExtractor({ H1: { start: W30, net: 450 }, H2: { start: W30, net: 450 } });
    const filesA = [{ id: 'H1', name: 'copy1.pdf' }, { id: 'H2', name: 'copy2.pdf' }];
    const resA = C170.consoleBatchImport_('folder', depsFor(envA, filesA, { hashFn: sameHash }));
    // 分两次执行：第二次执行重新读表
    const envB = makeEnv(new Date('2026-10-01T10:00:00Z'));
    installExtractor({ H1: { start: W30, net: 450 }, H2: { start: W30, net: 450 } });
    const r1 = C170.consoleBatchImport_('folder', depsFor(envB, [{ id: 'H1', name: 'copy1.pdf' }], { hashFn: sameHash, now: new Date('2026-10-01T10:00:00Z') }));
    const r2 = C170.consoleBatchImport_('folder', depsFor(envB, [{ id: 'H2', name: 'copy2.pdf' }], { hashFn: sameHash, now: new Date('2026-10-01T10:05:00Z') }));
    show('S4 相同 file_hash 的两份文件：同一批 vs 分两次执行', {
      sameBatch: {
        stages: resA.results.map((r) => `${r.fileId}:${r.stage}`),
        documentsRows: rows(envA, 'Documents', DOCUMENTS_COLUMNS).length,
        verifiedIncomeRows: rows(envA, 'Verified_Income', VERIFIED_INCOME_COLUMNS).length
      },
      twoSeparateExecutions_control: {
        stages: [...r1.results, ...r2.results].map((r) => `${r.fileId}:${r.stage}`),
        documentsRows: rows(envB, 'Documents', DOCUMENTS_COLUMNS).length,
        verifiedIncomeRows: rows(envB, 'Verified_Income', VERIFIED_INCOME_COLUMNS).length
      }
    });
  }

  // ---------------------------------------------------------------------------------------------
  // S5：两次「同时」执行同一个文件（双击 Batch Import / 两个浏览器页签）。
  // 用「冻结的旧快照」模拟：执行 B 的读发生在执行 A 写入之前。这是对交错顺序的模拟，
  // 不是真实 GAS 的并发实验【待确认】。
  // ---------------------------------------------------------------------------------------------
  {
    const env = makeEnv(new Date('2026-10-01T10:00:00Z'));
    installExtractor({ K1: { start: W30, net: 450 } });
    const files = [{ id: 'K1', name: 'w30.pdf' }];
    const frozen = freezeReader(env); // 此刻两个 Sheet 都是空的：B 在 A 写入之前就读完了
    const resA = C170.consoleBatchImport_('folder', depsFor(env, files, { now: new Date('2026-10-01T10:00:00.000Z') }));
    const resB = C170.consoleBatchImport_('folder', depsFor(env, files, { reader: frozen, now: new Date('2026-10-01T10:00:00.250Z') }));
    const docs = rows(env, 'Documents', DOCUMENTS_COLUMNS);
    const vi = rows(env, 'Verified_Income', VERIFIED_INCOME_COLUMNS);
    show('S5 两个执行交错处理同一个文件（模拟）', {
      stagesA: resA.results.map((r) => `${r.fileId}:${r.stage}`),
      stagesB: resB.results.map((r) => `${r.fileId}:${r.stage}`),
      documentsRows_forSameDriveFile: docs.filter((d) => d.drive_file_id === 'K1').length,
      documentIds: docs.map((d) => d.document_id),
      verifiedIncomeRows: vi.length,
      distinctIncomeIds: distinct(vi.map((v) => v.income_id)).length
    });
  }

  // ---------------------------------------------------------------------------------------------
  // S6：没有任何「同批 / 并发」问题——三次独立执行。第二份文件是「同一周、内容不同」（例如对账单更正重发）。
  // 想看：这份文件之后的归类；每次 Batch 是否都会重新处理它；Reconciliation_Log 的增长。
  // ---------------------------------------------------------------------------------------------
  {
    const env = makeEnv(new Date('2026-10-01T10:00:00Z'));
    installExtractor({ J1: { start: W30, net: 450 }, J2: { start: W30, net: 460 } });
    const both = [{ id: 'J1', name: 'w30-original.pdf' }, { id: 'J2', name: 'w30-reissued.pdf' }];
    const r1 = C170.consoleBatchImport_('folder', depsFor(env, [both[0]], { now: new Date('2026-10-01T10:00:00Z') }));
    const r2 = C170.consoleBatchImport_('folder', depsFor(env, both, { now: new Date('2026-10-01T10:05:00Z') }));
    const r3 = C170.consoleBatchImport_('folder', depsFor(env, both, { now: new Date('2026-10-01T10:10:00Z') }));
    const scan = C170.consoleScanFolder_('folder', depsFor(env, both));
    const recovery = C170.consoleGetRecoveryStatus_(depsFor(env, []));
    show('S6 三次独立执行：第二份是同一周、内容不同的文件', {
      run1: r1.results.map((r) => `${r.fileId}:${r.stage}`),
      run2: r2.results.map((r) => `${r.fileId}:${r.stage}`),
      run3_stillReprocessed: r3.results.map((r) => `${r.fileId}:${r.stage}`),
      documentsRows: rows(env, 'Documents', DOCUMENTS_COLUMNS).map((d) => `${d.drive_file_id}:${d.document_id}`),
      verifiedIncomeRows: rows(env, 'Verified_Income', VERIFIED_INCOME_COLUMNS).length,
      reconciliationLogRows: rows(env, 'Reconciliation_Log', RECONCILIATION_LOG_COLUMNS).length,
      scanAfterwards: scan.files.map((f) => `${f.id}: alreadyImported=${f.alreadyImported} needsRetry=${f.needsRetry}`),
      recoveryCenter_pending: recovery.pending.map((p) => p.driveFileId),
      recoveryCenter_completed: recovery.completed.map((c) => c.driveFileId)
    });
  }
} finally {
  restoreExtractor();
}
