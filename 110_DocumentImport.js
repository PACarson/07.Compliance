/**
 * 110_DocumentImport.js
 * Compliance OS — Document Import Engine（对应治理文档 §2.1、§4.1、CMP-P4）
 *
 * v2（采纳 Drive 存档建议后）：
 *  - Sheet 只存 drive_file_id（权威、稳定引用）+ drive_path（人类可读缓存，
 *    明确标注可能过期，不是真相来源——真正需要路径时应该向 Drive 查询，
 *    不该只信 Sheet 里存的字符串；这是 EP4「可推导的东西不当权威来源」在
 *    这里的具体应用）。不存完整 URL——URL 是 drive_file_id 的纯字符串组合，
 *    需要时现算，不占一个欄位。
 *  - PDF → 文字抽取现在透过 112_DocumentTextExtractor.js（UCR7 Adapter）取得，
 *    不再只是文档注释里说"外部提供"——但抽取器本身还是占位，Drive 存档
 *    位置/建议文件名/文件夹结构是可以现在就定的（不依赖任何未确认的外部
 *    服务），所以先把这部分做实。
 */

if (typeof require === 'function') {
  var { ParserRegistry } = require('./120_DocumentParsing.js');
  // 只是要它的自我注册副作用（ParserRegistry.register(new GrabWeeklyParser())），
  // 不解构任何东西——这个文件真的会调用 ParserRegistry.getParserFor_()
  // （经 120），所以由这里保证 registry 有内容，而不是靠每个呼叫方
  // （170/171 之前就漏掉了）各自记得另外 require 一次具体 Parser。
  // GAS 环境这行不影响任何事——全部檔案本来就一起载入同一个 global scope，
  // 121 底部的 register() 本来就一定会跑；这行只是补 Node 环境下的
  // require 顺序依赖，两边行为不会分岔。
  require('./121_GrabWeeklyParser.js');
  var { runReconciliationForWeek_ } = require('./130_Reconciliation.js');
  var { verifyAndPublishIncome_ } = require('./140_VerifiedIncome.js');
  var { DocumentTextExtractor } = require('./112_DocumentTextExtractor.js');
}

var DOCUMENTS_COLUMNS = [
  'document_id', 'source', 'document_type', 'document_class',
  'period', 'file_hash', 'drive_file_id', 'drive_path', 'status'
];

/** CMP-DOC-{YYYYMMDD}-{SOURCE}-{TYPE}-{时间戳} */
function computeDocumentId_(source, documentType, now) {
  if (!(now instanceof Date) || isNaN(now.getTime())) {
    throw new Error('computeDocumentId_: now 必须是合法的 Date 对象'); // UCR4
  }
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const typeCode = String(documentType).replace(/\s+/g, '');
  return `CMP-DOC-${y}${m}${d}-${source}-${typeCode}-${now.getTime()}`;
}

function isDuplicateHash_(fileHash, existingHashes) {
  if (!fileHash) throw new Error('isDuplicateHash_: fileHash 不能是空的');
  return (existingHashes || []).indexOf(fileHash) !== -1;
}

/**
 * 建议的 Drive 文件名：{SOURCE}_{TYPE_CODE}_{PERIOD}.pdf。
 * typeCode 由呼叫方明确指定，不自动从 documentType 猜——不同来源的简称
 * 习惯不一样（GRAB_WEEKLY / EPF_STATEMENT / LHDN_EA 没有统一规则，猜比
 * 明确指定更容易出错，CMP-P10）。
 * @example computeSuggestedFileName_('GRAB', 'WEEKLY', '2026-W30') -> "GRAB_WEEKLY_2026_W30.pdf"
 */
function computeSuggestedFileName_(source, typeCode, period) {
  const periodCode = String(period).replace(/-/g, '_');
  return `${String(source).toUpperCase()}_${String(typeCode).toUpperCase()}_${periodCode}.pdf`;
}

/**
 * 建议的 Drive 目录路径：Compliance OS/{source}/{year}/{文件夹标签}。
 * 不存进 Sheet——纯粹给实际上传流程参考用来决定放哪个目录。
 * @example computeSuggestedFolderPath_('Grab', '2026', 'Weekly Statements') -> "Compliance OS/Grab/2026/Weekly Statements"
 */
function computeSuggestedFolderPath_(source, year, folderLabel) {
  return `Compliance OS/${source}/${year}/${folderLabel}`;
}

function buildDocumentRecord_(documentId, meta) {
  return {
    document_id: documentId,
    source: meta.source,
    document_type: meta.documentType,
    document_class: meta.documentClass,
    period: meta.period,
    file_hash: meta.fileHash,
    drive_file_id: meta.driveFileId,
    drive_path: meta.drivePath || '',
    status: 'Imported'
  };
}

function writeDocumentRecord_(truthWriter, record) {
  return truthWriter.appendValidatedRow('Documents', record, DOCUMENTS_COLUMNS);
}

/** GAS 的 Utilities.computeDigest 是稳定、有文件的 API，不是猜的签名。 */
function computeFileHash_(fileBytes) {
  if (typeof Utilities === 'undefined') {
    throw new Error('computeFileHash_ 需要 GAS 的 Utilities 服务，Node 环境请改用测试用的假 hash');
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, fileBytes);
  return digest.map((b) => ((b < 0 ? b + 256 : b).toString(16).padStart(2, '0'))).join('');
}

/**
 * 核心编排：去重 → 生成 ID → 写入 Documents。不碰 Drive 上传本身（呼叫方
 * 已经把文件存进 Drive、算好 driveFileId 才会调用这个函数）。
 * @param {{fileHash: string, source: string, documentType: string, documentClass: string, period: string, driveFileId: string, drivePath: string, existingHashes: string[]}} input
 * @param {{truthWriter: Object, now: Date}} deps
 * @return {{status: string, document_id: (string|null), record: (Object|null)}}
 */
function importDocument_(input, deps) {
  if (isDuplicateHash_(input.fileHash, input.existingHashes)) {
    return { status: 'Duplicate_Skipped', document_id: null, record: null };
  }
  const documentId = computeDocumentId_(input.source, input.documentType, deps.now);
  const record = buildDocumentRecord_(documentId, input);
  writeDocumentRecord_(deps.truthWriter, record);
  return { status: 'Imported', document_id: documentId, record };
}

/**
 * 共用核心序列：Import → Extract → Parse → Verify（ADR-003：解析成功即发布）
 * → Reconciliation（非阻断）。不管每一步成功或失败都回传结构化结果，不丢
 * 例外——单次直接调用（processGrabStatement_）或批次汇入（Operator Console）
 * 自己决定要不要把失败转成 throw。这样序列本身只有一份，不会因为要支援
 * 批次重试就复制一份逻辑出来（UCR5）。
 *
 * importInput.skipImport = true 时跳过 importDocument_（Retry 用——文件的
 * Documents 记录已经存在，不需要、也不应该再重复检查一次 file_hash 去重，
 * 直接从抽取开始）。
 * deps.existingIncomeIds 会原样传给 verifyAndPublishIncome_ 做发布前的幂等
 * 检查（见 140_VerifiedIncome.js）。
 * @param {Object} importInput 见 importDocument_，另外可选 fileId/skipImport
 * @param {string} [extractedText]
 * @param {{truthWriter: Object, riderOSAdapter: Object, now: Date, existingIncomeIds: (string[]|undefined)}} deps
 * @return {{stage: string, importResult: Object, parsedStatement: (Object|undefined), verifyResult: (Object|undefined), reconciliationResult: (Object|undefined), error: (string|undefined)}}
 */
function runImportPipeline_(importInput, extractedText, deps) {
  const importResult = importInput.skipImport
    ? { status: 'Already_Imported', document_id: null, record: null }
    : importDocument_(importInput, deps);

  if (importResult.status === 'Duplicate_Skipped') {
    return { stage: 'Skipped_Duplicate', importResult };
  }

  let text;
  try {
    text = extractedText || DocumentTextExtractor.extract({ fileId: importInput.driveFileId, mimeType: 'application/pdf' });
  } catch (err) {
    return { stage: 'Extraction_Failed', importResult, error: err.message };
  }

  let parsedStatement;
  try {
    const parser = ParserRegistry.getParserFor({ source: importInput.source, document_type: importInput.documentType });
    parsedStatement = parser.parse({ source: importInput.source, document_type: importInput.documentType }, text);
  } catch (err) {
    return { stage: 'Parse_Failed', importResult, error: err.message };
  }

  const week = parsedStatement.document_meta.week;
  let verifyResult;
  try {
    const eventId = `CMP-EVT-${week}-${deps.now.getTime()}`;
    verifyResult = verifyAndPublishIncome_(week, parsedStatement, deps.truthWriter, eventId, deps.now, deps.existingIncomeIds);
  } catch (err) {
    return { stage: 'Verify_Failed', importResult, parsedStatement, error: err.message };
  }

  // Reconciliation：独立、可选、非阻断——就算这里丢错，也不能让呼叫方以为
  // 上面已经成功发布的 Verified Income 也失败了（CMP-P10：异常要显性，但
  // 不能让次要步骤的问题冒充主要步骤的失败）。
  let reconciliationResult = null;
  try {
    reconciliationResult = runReconciliationForWeek_(
      week,
      parsedStatement,
      { riderOSAdapter: deps.riderOSAdapter, truthWriter: deps.truthWriter, now: deps.now }
    );
  } catch (err) {
    const msg = `Reconciliation 失败，但不影响已发布的 Verified Income（${verifyResult.record.income_id}）：${err.message}`;
    if (typeof AlertService !== 'undefined' && typeof AlertService.log === 'function') {
      AlertService.log('WARN', 'runImportPipeline_', 'reconciliation', { week }, msg);
    } else {
      console.warn(`[runImportPipeline_] ${msg}`);
    }
  }

  return {
    stage: verifyResult.skipped ? 'Already_Verified' : 'Verified',
    importResult, parsedStatement, verifyResult, reconciliationResult
  };
}

/**
 * 对外的单次调用入口——维持既有「失败就 throw」的行为/契约不变（既有测试
 * 全部照旧）。内部改叫 runImportPipeline_ 共用序列，Extraction_Failed/
 * Parse_Failed/Verify_Failed 这几种结构化失败在这里转成 throw；
 * Skipped_Duplicate/Already_Verified/Verified 都正常回传，不是失败。
 * @param {Object} importInput 见 importDocument_，另外可选 fileId（给 extractor 用）
 * @param {string} [extractedText]
 * @param {{truthWriter: Object, riderOSAdapter: Object, now: Date}} deps
 * @return {Object}
 */
function processGrabStatement_(importInput, extractedText, deps) {
  const result = runImportPipeline_(importInput, extractedText, deps);
  if (result.stage === 'Extraction_Failed' || result.stage === 'Parse_Failed' || result.stage === 'Verify_Failed') {
    throw new Error(`[${result.stage}] ${result.error}`);
  }
  return result;
}

if (typeof module !== 'undefined') {
  module.exports = {
    DOCUMENTS_COLUMNS,
    computeDocumentId_,
    isDuplicateHash_,
    computeSuggestedFileName_,
    computeSuggestedFolderPath_,
    buildDocumentRecord_,
    writeDocumentRecord_,
    computeFileHash_,
    importDocument_,
    runImportPipeline_,
    processGrabStatement_
  };
}
