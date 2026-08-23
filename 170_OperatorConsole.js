/**
 * 170_OperatorConsole.js
 * Compliance OS — Operator Console 后端（Real Data Pilot，v0.7，Steven
 * 2026-08-17 定案）。取代 compliance-os-console.jsx——那份是把 121/130/160
 * 的逻辑在浏览器端重新写一份（PORTED LOGIC），这里改成 HTMLService 页面
 * 透过 google.script.run 直接呼叫真正的后端函数，逻辑只有一份（UCR5）。
 *
 * 主要流程：
 *   consoleScanFolder_   —— 列出指定 Drive Folder 里的 PDF，对照 Documents
 *                            现有的 drive_file_id 标出哪些还没汇入（CMP-P11：
 *                            drive_file_id 是权威引用，这是它第一次真的被
 *                            拿来当去重键，不只是存着）
 *   consoleBatchImport_  —— 批次汇入所有未汇入的文件，逐一跑
 *                            110_DocumentImport.js 的 runImportPipeline_，
 *                            每个文件独立成功/失败，一个坏文件不会打断整批
 *   consoleRetryFile_    —— 单一文件重试；文件已经有 Documents 记录时跳过
 *                            重新 import（不会因为重试就被 file_hash 挡成
 *                            重复），直接从抽取重新开始
 *   consoleManualImport_ —— Debug/Fallback：手动贴文字，不透过 Drive
 *   consoleGetDashboard_ —— 目前的 Monthly/YTD 状态，页面载入时呼叫一次
 *
 * 批次汇入完成后自动呼叫 consoleRebuildProjections_——这一步很便宜：
 * 160_MonthlyProjection.js 本来就是即时算、不存汇总表（EP4），「重建」
 * 就是把新汇入后的全部 Verified_Income 重新读一次、重新算一次。
 *
 * 低层 Drive 操作（列资料夹里的 PDF、算文件 hash）透过 folderScanner 注入，
 * 跟 112_DocumentTextExtractor.js 的 driveService 同一个套路——Node 测编排
 * 逻辑（哪些该跳过、批次里一个文件失败要不要继续、重建有没有触发），真的
 * 调 DriveApp 那几行只能在真实 GAS 验证。
 */

if (typeof require === 'function') {
  var { DOCUMENTS_COLUMNS, computeFileHash_, runImportPipeline_ } = require('./110_DocumentImport.js');
  var { VERIFIED_INCOME_COLUMNS } = require('./140_VerifiedIncome.js');
  var { computeMonthlyIncomeSummary_, computeYearToDateIncomeSummary_, computeMonthlyAllocation_, computeComplianceProjection_, findInvalidPeriodIncomeIds_ } = require('./160_MonthlyProjection.js');
}

/** 真的去调用 Drive API 的那一层——只能在真实 GAS 环境跑，Node 测不了。 */
function realFolderScanner_() {
  return {
    listPdfFiles(folderId) {
      const folder = DriveApp.getFolderById(folderId);
      const it = folder.getFilesByType(MimeType.PDF);
      const files = [];
      while (it.hasNext()) {
        const f = it.next();
        files.push({ id: f.getId(), name: f.getName() });
      }
      return files;
    },
    getFileHash(fileId) {
      const bytes = DriveApp.getFileById(fileId).getBlob().getBytes();
      return computeFileHash_(bytes);
    }
  };
}

/**
 * 组装 Console 编排要用的全部依赖。GAS 环境下自动接真的服务；Node 环境
 * 这几个模块级单例本来就是 null（跟 TruthWriter/SheetReader/RiderOSAdapter
 * 一样），测试改用自己组的假 deps，不叫这个函数。
 */
function buildConsoleDeps_() {
  return {
    truthWriter: TruthWriter,
    sheetReader: SheetReader,
    riderOSAdapter: RiderOSAdapter,
    folderScanner: (typeof DriveApp !== 'undefined') ? realFolderScanner_() : null,
    now: new Date()
  };
}

/**
 * 扫描指定 Drive Folder，列出所有 PDF，标出哪些 drive_file_id 已经在
 * Documents 里出现过。这是 drive_file_id 第一次真的被拿来当去重键（CMP-P11
 * 早就把它定成权威引用，但一直只是存着）——比对完全不需要先下载/算文件
 * hash，比 file_hash 去重便宜很多；file_hash 仍然留着当第二层防线，见
 * 110_DocumentImport.js 的 isDuplicateHash_（万一同样内容被传成不同的
 * Drive 文件）。
 *
 * 2026-08-23 修正（审计报告 HIGH-3）：以前只要 Documents 有这个 drive_file_id
 * 的记录就一律当「已汇入」——但 importDocument_ 是先写 Documents（status:
 * 'Imported'）才做抽取，如果抽取半路丢例外（网络、API 限额、格式问题），
 * Documents 记录已经留下了，状态却永远停在 'Imported'（TruthWriter 只增不改，
 * 没有办法回头改成 Failed）。旧逻辑会把这种「卡住、其实什么都没算出来」的
 * 文件跟「真的验证完成」的文件混为一谈，永久排除在未来的批次汇入之外——
 * 相当于静默漏掉这份收入，且没有任何显性信号。现在改成：有 Documents 记录
 * 不够，还要看这个 document_id 有没有对应到一笔 Verified_Income
 * （source_document_id 相符）才算真正完成；有 Documents 记录但查无对应
 * Verified_Income 的，标成 needsRetry: true，交给 consoleBatchImport_ 用
 * isRetry 路径重新处理，不会被当成新文件（那会被 file_hash 挡成
 * duplicate），也不会被永久跳过。
 * @param {string} folderId
 * @param {Object} [deps]
 * @return {{folderId: string, files: Array<{id: string, name: string, alreadyImported: boolean, needsRetry: boolean}>}}
 */
function consoleScanFolder_(folderId, deps) {
  const d = deps || buildConsoleDeps_();
  const documentsByFileId = {};
  d.sheetReader.readAll('Documents', DOCUMENTS_COLUMNS).forEach((doc) => { documentsByFileId[doc.drive_file_id] = doc; });
  const verifiedSourceDocIds = {};
  d.sheetReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS).forEach((v) => {
    if (v.source_document_id) verifiedSourceDocIds[v.source_document_id] = true;
  });

  const files = d.folderScanner.listPdfFiles(folderId).map((f) => {
    const existingDoc = documentsByFileId[f.id];
    if (!existingDoc) {
      return { id: f.id, name: f.name, alreadyImported: false, needsRetry: false };
    }
    const isVerified = !!verifiedSourceDocIds[existingDoc.document_id];
    return { id: f.id, name: f.name, alreadyImported: isVerified, needsRetry: !isVerified };
  });
  return { folderId, files };
}

/**
 * 处理单一 Drive 文件（批次汇入的每一个元素、或单独重试都走这里——
 * UCR5，不要有两份「怎么处理一个文件」的逻辑）。
 *
 * isRetry 且这个 drive_file_id 已经有 Documents 记录时，跳过重新 import
 * （不会被 file_hash 去重挡住——那是给「真的没看过的新文件」用的检查，
 * 不是给「同一个文件再试一次」用的），并且把找到的既有 document_id 一并
 * 带上（2026-08-21 修正：以前这里没带，Retry 出来的 Verified_Income/
 * 证据档就没有 source_document_id 可以追溯回是哪一笔 Documents 记录——
 * documentsRows 本来就已经查过了，只是漏了把找到的那一行的 document_id
 * 传给 runImportPipeline_）。
 * @param {string} fileId
 * @param {string} fileName
 * @param {Object} deps
 * @param {boolean} [isRetry]
 * @param {Array} [documentsRowsSnapshot] 2026-08-23（审计报告 HIGH-2）：批次
 *   汇入以前每个文件各自重读一次整张 Documents/Verified_Income——N 个文件
 *   就是 2N 次全表读取。consoleBatchImport_ 现在批次开始前读一次，把快照
 *   传进来共用；不传就照原本行为自己读一次（单独重试单一文件时用，不需要
 *   为了一个文件另外组快照）。
 * @param {Array} [verifiedIncomeSnapshot]
 * @return {Object}
 */
function consoleImportOneDriveFile_(fileId, fileName, deps, isRetry, documentsRowsSnapshot, verifiedIncomeSnapshot) {
  try {
    const documentsRows = documentsRowsSnapshot || deps.sheetReader.readAll('Documents', DOCUMENTS_COLUMNS);
    const existingDocRow = documentsRows.find((doc) => doc.drive_file_id === fileId);
    const existingIncomeIds = (verifiedIncomeSnapshot || deps.sheetReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS)).map((v) => v.income_id);

    let importInput;
    if (isRetry && existingDocRow) {
      importInput = {
        skipImport: true, existingDocumentId: existingDocRow.document_id,
        source: 'Grab', documentType: 'Weekly Statement', driveFileId: fileId
      };
    } else {
      const fileHash = deps.folderScanner.getFileHash(fileId);
      const existingHashes = documentsRows.map((doc) => doc.file_hash);
      importInput = {
        fileHash, source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income',
        period: 'Pending', // 解析前不知道真正的 period（ISO 周）——只是人类可读的暂存值，
        // 不是权威数据；真正权威的 period 只会在 Verified_Income 上，来自解析结果本身
        // （跟 drive_path 只是缓存、drive_file_id 才是权威引用同一个道理，CMP-P11）
        driveFileId: fileId, drivePath: fileName, existingHashes
      };
    }

    const result = runImportPipeline_(importInput, undefined, Object.assign({}, deps, { existingIncomeIds }));
    return summarizeConsoleResult_(result, fileId, fileName);
  } catch (err) {
    return { fileId, fileName, stage: 'Unexpected_Error', error: err.message };
  }
}

/**
 * 把 runImportPipeline_ 的原始结果转成前端好显示的精简形状。
 * Needs_Review（2026-08-21 新增，LLM candidate 验证没过但形状是对的）要把
 * candidate 跟 validationErrors 一并带上——前端要能显示「LLM 抽出了这些
 * 数字，但哪里跟哪里对不上」，不是只显示一个笼统的失败讯息。
 */
function summarizeConsoleResult_(result, fileId, fileName) {
  const base = { fileId, fileName, stage: result.stage };
  if (result.error) base.error = result.error;
  if (result.validationErrors) base.validationErrors = result.validationErrors;
  if (result.candidate) base.candidate = result.candidate;
  if (result.evidence) base.evidenceFileId = result.evidence.evidenceFileId;
  if (result.verifyResult && result.verifyResult.record) {
    base.incomeId = result.verifyResult.record.income_id;
    base.period = result.verifyResult.record.period;
    base.net = result.verifyResult.record.net;
  }
  if (result.reconciliationResult) {
    base.reconciliationStatus = result.reconciliationResult.status;
  }
  return base;
}

/**
 * 批次汇入：扫描 → 处理还没真正完成的（全新的，或卡住待重试的）→ 逐一
 * 处理，一个文件失败不影响其他文件继续跑 → 结束后自动重建 Monthly/YTD。
 *
 * 2026-08-23 修正（审计报告 HIGH-1）：GAS Web App 单次执行有 6 分钟上限，
 * 一次扫出几十份历史文件（例如整年回填）全部串行处理、每份都真的呼叫一次
 * LLM API，很容易在批次跑到一半就被 GAS 强制中断——不是「失败」，是直接被
 * 杀掉，连结构化的失败结果都回不来。现在改成有时间预算：接近上限就主动
 * 停止，回传 stoppedEarly/remainingCount，而不是被硬杀。已经处理好的不会
 * 重复（scan 每次重新算，Verified_Income 发布本身也幂等），剩下的只要
 * 再呼叫一次 consoleBatchImport_ 就会接着处理——不需要额外的进度状态。
 * @param {string} folderId
 * @param {Object} [deps] 不给就用 buildConsoleDeps_()（GAS 环境）；测试传假的。
 *   deps.timeBudgetMs/deps.nowMs 是给测试用的覆盖点（分别是时间预算跟取得
 *   目前时间的函数），不给就用正式的 4.5 分钟预算跟真的 Date.now()。
 * @return {{scannedCount: number, attemptedCount: number, remainingCount: number, stoppedEarly: boolean, results: Array, rebuild: Object}}
 */
function consoleBatchImport_(folderId, deps) {
  const d = deps || buildConsoleDeps_();
  const scan = consoleScanFolder_(folderId, d);
  const candidates = scan.files.filter((f) => !f.alreadyImported);

  // 2026-08-23（审计报告 HIGH-2）：批次开始前读一次，逐一处理时共用同一份
  // 快照——不是每个文件各自重读整张表。「快照」意味着批次跑到一半，这份
  // 资料不会因为前面几笔已经写入而更新，这是刻意的（同一批次里，后面的
  // 文件判断该不该 retry 用的是批次开始时的状态，不会因为前面文件写入而
  // 变化），不是忘了刷新。
  const documentsSnapshot = d.sheetReader.readAll('Documents', DOCUMENTS_COLUMNS);
  const verifiedIncomeSnapshot = d.sheetReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS);

  const nowMs = d.nowMs || (() => Date.now());
  const timeBudgetMs = d.timeBudgetMs || 4.5 * 60 * 1000; // 6 分钟上限，留 1.5 分钟给 rebuild/收尾
  const startedAt = nowMs();
  const results = [];
  let stoppedEarly = false;

  for (let i = 0; i < candidates.length; i++) {
    if (nowMs() - startedAt > timeBudgetMs) {
      stoppedEarly = true;
      break;
    }
    const file = candidates[i];
    const r = consoleImportOneDriveFile_(file.id, file.name, d, !!file.needsRetry, documentsSnapshot, verifiedIncomeSnapshot);
    results.push(r);
    // 已知风险（113 文件已经记录）：Drive.Files.copy 在紧密循环里连续调用
    // 曾有零星 "Invalid argument" 失败报告——文件之间留一点节流时间。
    if (typeof Utilities !== 'undefined' && i < candidates.length - 1) {
      Utilities.sleep(1200);
    }
  }

  return {
    scannedCount: scan.files.length,
    attemptedCount: results.length,
    remainingCount: candidates.length - results.length,
    stoppedEarly,
    results,
    rebuild: consoleRebuildProjections_(d)
  };
}

/**
 * 重试单一文件（Console 上失败文件旁边的 Retry 按钮）。
 * @param {string} fileId
 * @param {string} fileName
 * @param {Object} [deps]
 * @return {Object}
 */
function consoleRetryFile_(fileId, fileName, deps) {
  const d = deps || buildConsoleDeps_();
  const result = consoleImportOneDriveFile_(fileId, fileName, d, true);
  return Object.assign({}, result, { rebuild: consoleRebuildProjections_(d) });
}

/**
 * Debug/Fallback：手动贴 Statement 文字，不透过 Drive（不是主要流程——
 * Steven 2026-08-17 明确要求：主要流程是 Drive 扫描汇入，手动贴文字只保留
 * 当调试/备用）。
 * @param {string} pastedText
 * @param {Object} [deps]
 * @return {Object}
 */
function consoleManualImport_(pastedText, deps) {
  const d = deps || buildConsoleDeps_();
  const now = d.now;
  const syntheticId = `MANUAL-${now.getTime()}`;
  const bytes = (typeof Utilities !== 'undefined') ? Utilities.newBlob(pastedText).getBytes() : null;
  const fileHash = bytes ? computeFileHash_(bytes) : syntheticId;
  const existingHashes = d.sheetReader.readAll('Documents', DOCUMENTS_COLUMNS).map((doc) => doc.file_hash);
  const existingIncomeIds = d.sheetReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS).map((v) => v.income_id);

  const importInput = {
    fileHash, source: 'Grab', documentType: 'Weekly Statement', documentClass: 'Income',
    period: 'Pending', driveFileId: syntheticId, drivePath: '(手动贴上，非 Drive 汇入)', existingHashes
  };
  const result = runImportPipeline_(importInput, pastedText, Object.assign({}, d, { existingIncomeIds }));
  const summary = summarizeConsoleResult_(result, syntheticId, '(手动贴上)');
  return Object.assign({}, summary, { rebuild: consoleRebuildProjections_(d) });
}

/**
 * 重建 Monthly/YTD——读现有全部 Verified_Income，对每个出现过的月份重新
 * 算一次 Monthly Summary，加一个当年 YTD。160_MonthlyProjection.js 本来
 * 就是即时算、不存汇总表（EP4），这里没有新架构，只是编排「读 + 逐月呼叫」。
 * @param {Object} deps
 * @return {{monthlySummaries: Array, ytd: Object, totalVerifiedCount: number}}
 */
function consoleRebuildProjections_(deps) {
  const verifiedIncomeRecords = deps.sheetReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS);
  // 2026-08-22：改用 computeMonthlyAllocation_ 列出每笔记录实际触及的全部月份
  // （1 或 2 个），不是只取"该周星期四所在月份"——不然一个月如果只有横跨
  // 该月的 Needs_Allocation 记录、没有任何完全落在该月的记录，旧写法会让
  // 这个月完全不出现在 months 里，连它的 needs_allocation 提示都看不到。
  const months = Array.from(new Set(
    verifiedIncomeRecords
      .filter((r) => r.status === 'Verified')
      .reduce((acc, r) => acc.concat(computeMonthlyAllocation_(r).months), [])
  )).sort();
  // 2026-08-22：每个月度摘要都附上 compliance_projection（SOCSO/EPF/Tax）——
  // 需求 §5 的 Monthly Console UI 把这两块放在同一个月份视图里，这里一起
  // 附上，前端不用为了 Compliance Projection 另外发一次请求。
  const monthlySummaries = months.map((ym) => {
    const summary = computeMonthlyIncomeSummary_(verifiedIncomeRecords, ym);
    return Object.assign({}, summary, { compliance_projection: computeComplianceProjection_(ym, summary) });
  });
  const currentYear = deps.now.getFullYear();
  const ytd = computeYearToDateIncomeSummary_(verifiedIncomeRecords, currentYear);
  // 2026-08-22：跟 Needs_Allocation（跨月、待人工判断分月）不是同一件事——
  // 这里是「period 本身就读不出来／不合法」，通常代表 Sheet 里有栏位错位
  // 或残留旧资料，Steven 该去清资料，不是等系统帮他猜。明确列出来，不要
  // 让它们悄悄消失在 Missing_Period 分类里只有 160 自己知道。
  const invalidPeriodIncomeIds = findInvalidPeriodIncomeIds_(verifiedIncomeRecords);
  return { monthlySummaries, ytd, totalVerifiedCount: verifiedIncomeRecords.length, invalidPeriodIncomeIds };
}

/** 页面载入时呼叫一次，显示目前已有的状态（不用先跑一次批次汇入）。 */
function consoleGetDashboard_(deps) {
  return consoleRebuildProjections_(deps || buildConsoleDeps_());
}

/**
 * 单笔 Verified_Income 的完整细节 + 它对应的 Documents 记录——Console 的
 * Drill Down 用（需求 §7）：从月度汇总的一个数字，一路往回追到原始 PDF。
 * 不复制/搬动 PDF（需求 §8）——只回传 drive_file_id，前端自己组 Drive 的
 * 标准检视网址，不为了给一个连结额外调 Drive API。
 * @param {string} incomeId
 * @param {Object} [deps]
 * @return {{income: (Object|null), document: (Object|null)}}
 */
function consoleGetIncomeDetail_(incomeId, deps) {
  const d = deps || buildConsoleDeps_();
  const income = d.sheetReader.readAll('Verified_Income', VERIFIED_INCOME_COLUMNS).find((r) => r.income_id === incomeId) || null;
  if (!income) return { income: null, document: null };

  const doc = income.source_document_id
    ? (d.sheetReader.readAll('Documents', DOCUMENTS_COLUMNS).find((r) => r.document_id === income.source_document_id) || null)
    : null;

  return {
    income,
    document: doc ? { documentId: doc.document_id, driveFileId: doc.drive_file_id, drivePath: doc.drive_path, status: doc.status } : null
  };
}

/** 记住上次用过的 Folder ID，下次打开 Console 不用重新贴。真的很小的一个
 *  便利功能，不是「以后可能需要」的新基础设施——直接为这次要做的批次汇入
 *  服务，用完全一样的 ScriptProperties 缓存手法（跟 112 的 OCR 暂存夹 ID
 *  同一个模式）。 */
function consoleGetLastFolderId_() {
  return (typeof PropertiesService !== 'undefined') ? PropertiesService.getScriptProperties().getProperty('CONSOLE_LAST_FOLDER_ID') : null;
}
function consoleSaveLastFolderId_(folderId) {
  if (typeof PropertiesService !== 'undefined') {
    PropertiesService.getScriptProperties().setProperty('CONSOLE_LAST_FOLDER_ID', folderId);
  }
}

/**
 * HTMLService 入口。部署成 Web App 后打开的就是这个。
 * 2026-08-23 修正（审计报告 LOW-3）：改用 DEFAULT（等同不允许被其他网站
 * iframe 嵌入）——ALLOWALL 是为了故意要给外部网站嵌入用的，这个 Console
 * 只有 Steven 自己用（webapp 部署已经是 access: MYSELF），没有嵌入需求，
 * ALLOWALL 只有 Clickjacking 曝险、没有对应的好处。
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('170_OperatorConsole')
    .evaluate()
    .setTitle('Compliance OS Operator Console')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * ================= 公开给 HTMLService 前端调用的接口 =================
 * google.script.run 看不到、也叫不动结尾带下划线的函数——Apps Script 官方
 * 文档：私有函数（结尾下划线）对客户端不可见，不能被 google.script.run
 * 呼叫。上面每一个 consoleXxx_ 都是这个专案的私有函数惯例（刻意隐藏于
 * IDE 运行下拉菜单），所以都需要在这里补一个不带下划线的公开薄壳，纯
 * 转发、不重复任何逻辑——170_OperatorConsole.html 实际呼叫的是这一层。
 *
 * deps 参数照实作函数原本的签名转发，不在这里默认成 buildConsoleDeps_()
 * ——单元测试照样能注入 fake deps；HTML 前端呼叫时本来就不会带这个参数，
 * 等同 undefined，跟原本行为完全一样，各 consoleXxx_ 内部自己处理
 * `deps || buildConsoleDeps_()`。
 *
 * 之后这个文件如果再新增一个要给前端呼叫的 consoleXxx_，记得在这里补一个
 * 对应的公开版本。这一层刻意手写、不用循环动态生成——google.script.run
 * 认的是编译期看得到的具名 function 声明，不是运行时动态挂上去的属性，
 * 用循环生成在这个平台上有没有效我没有把握，这个环节已经在你那边卡过一次
 * 真实的坑，没必要在这里赌一个我没法验证的写法。
 */

function consoleGetDashboard(deps) {
  return consoleGetDashboard_(deps);
}

function consoleGetLastFolderId() {
  return consoleGetLastFolderId_();
}

function consoleSaveLastFolderId(folderId) {
  return consoleSaveLastFolderId_(folderId);
}

function consoleScanFolder(folderId, deps) {
  return consoleScanFolder_(folderId, deps);
}

function consoleBatchImport(folderId, deps) {
  return consoleBatchImport_(folderId, deps);
}

function consoleRetryFile(fileId, fileName, deps) {
  return consoleRetryFile_(fileId, fileName, deps);
}

function consoleManualImport(pastedText, deps) {
  return consoleManualImport_(pastedText, deps);
}

function consoleGetIncomeDetail(incomeId, deps) {
  return consoleGetIncomeDetail_(incomeId, deps);
}

if (typeof module !== 'undefined') {
  module.exports = {
    realFolderScanner_,
    buildConsoleDeps_,
    consoleScanFolder_,
    consoleImportOneDriveFile_,
    summarizeConsoleResult_,
    consoleBatchImport_,
    consoleRetryFile_,
    consoleManualImport_,
    consoleRebuildProjections_,
    consoleGetDashboard_,
    consoleGetIncomeDetail_,
    consoleGetDashboard,
    consoleGetLastFolderId,
    consoleSaveLastFolderId,
    consoleScanFolder,
    consoleBatchImport,
    consoleRetryFile,
    consoleManualImport,
    consoleGetIncomeDetail
  };
}
