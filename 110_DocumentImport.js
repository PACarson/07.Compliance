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
 * 完整链路（ADR-003）：Import → Parse → Verified Income（解析成功即发布，
 * 不等对账）→ Reconciliation（独立、可选、非阻断的次要验证，就算这步出错
 * 或没有 Rider OS 数据，前面已经发布的 Verified Income 完全不受影响）。
 *
 * extractedText 现在是可选的：不给的话会透过 DocumentTextExtractor 去拿
 * （目前是占位，会抛错——等抽取方式确认后，呼叫方从此不用改，只是不再
 * 需要手动传 extractedText 这个参数）。给了就直接用，主要给测试用，
 * 也适合「抽取已经在别处发生」的情况。
 * @param {Object} importInput 见 importDocument_，另外可选 fileId（给 extractor 用）
 * @param {string} [extractedText]
 * @param {{truthWriter: Object, riderOSAdapter: Object, now: Date}} deps
 * @return {Object}
 */
function processGrabStatement_(importInput, extractedText, deps) {
  const importResult = importDocument_(importInput, deps);
  if (importResult.status === 'Duplicate_Skipped') {
    return { stage: 'Import', result: importResult };
  }

  const text = extractedText || DocumentTextExtractor.extract({ fileId: importInput.driveFileId, mimeType: 'application/pdf' });

  const parser = ParserRegistry.getParserFor({ source: importInput.source, document_type: importInput.documentType });
  const parsedStatement = parser.parse({ source: importInput.source, document_type: importInput.documentType }, text);
  const week = parsedStatement.document_meta.week;

  // ADR-003：解析成功，Verified Income 立刻发布——不等下面的 Reconciliation。
  const eventId = `CMP-EVT-${week}-${deps.now.getTime()}`;
  const verifyResult = verifyAndPublishIncome_(week, parsedStatement, deps.truthWriter, eventId, deps.now);

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
      AlertService.log('WARN', 'processGrabStatement_', 'reconciliation', { week }, msg);
    } else {
      console.warn(`[processGrabStatement_] ${msg}`);
    }
  }

  return { stage: 'Verified', importResult, parsedStatement, verifyResult, reconciliationResult };
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
    processGrabStatement_
  };
}
