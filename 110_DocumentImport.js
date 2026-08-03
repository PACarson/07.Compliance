/**
 * 110_DocumentImport.js
 * Compliance OS — Document Import Engine（对应治理文档 §2.1、§4.1、CMP-P4）
 *
 * 老实说清楚这个文件现在能做什么、不能做什么：
 *  - 能：document_id 生成、去重判断、组 Documents 记录、写入（透过 TruthWriter）、
 *    真实的文件 hash 计算（GAS 的 Utilities.computeDigest，不是占位）。
 *  - 不能：还没有「怎么把 PDF 存进 Drive」「怎么把 PDF 转成文字」的实作——
 *    这两件事的具体做法（哪个 Drive 目录、要不要用 Advanced Drive Service
 *    做 OCR）还没跟你确认过，猜一个签名去实作是 UCR7 明确说不要做的事，所以
 *    先留成呼叫方要自己提供的输入（originalFileUrl、extractedText），不是
 *    这个引擎内部自己去做。
 *  - existingHashes（去重要比对的既有 hash 清单）也是呼叫方提供——
 *    TruthWriter 现在只处理写入，还没有对应的读取工具（EP3：不为了这一个
 *    用途现在就先造一个通用 Sheet Reader，等真的需要频繁读的时候再补）。
 */

if (typeof require === 'function') {
  var { ParserRegistry } = require('./120_DocumentParsing.js');
  var { runReconciliationForWeek_ } = require('./130_Reconciliation.js');
}

var DOCUMENTS_COLUMNS = [
  'document_id', 'source', 'document_type', 'document_class',
  'period', 'file_hash', 'original_file_url', 'status'
];

/** CMP-DOC-{YYYYMMDD}-{SOURCE}-{TYPE}-{时间戳}——用时间戳而不是递增序号，
 *  避免需要先读 Sheet 才能算下一个序号（同样是 EP3：不为了这个提前造读取工具）。 */
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

function buildDocumentRecord_(documentId, meta) {
  return {
    document_id: documentId,
    source: meta.source,
    document_type: meta.documentType,
    document_class: meta.documentClass,
    period: meta.period,
    file_hash: meta.fileHash,
    original_file_url: meta.originalFileUrl,
    status: 'Imported'
  };
}

function writeDocumentRecord_(truthWriter, record) {
  return truthWriter.appendValidatedRow('Documents', record, DOCUMENTS_COLUMNS);
}

/**
 * 真实实作（不是占位）：GAS 的 Utilities.computeDigest 是稳定、有文件的
 * API，不是猜的签名。fileBytesProvider 可替换，方便测试。
 * @param {Array} fileBytes （GAS 里通常是 blob.getBytes() 的结果）
 * @return {string} 十六进制 SHA-256
 */
function computeFileHash_(fileBytes) {
  if (typeof Utilities === 'undefined') {
    throw new Error('computeFileHash_ 需要 GAS 的 Utilities 服务，Node 环境请改用测试用的假 hash');
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, fileBytes);
  return digest.map((b) => ((b < 0 ? b + 256 : b).toString(16).padStart(2, '0'))).join('');
}

/**
 * 核心编排：去重 → 生成 ID → 写入 Documents。不碰 Drive、不碰文字抽取——
 * 这两件事呼叫方要自己先做好，把结果（originalFileUrl）传进来。
 * @param {{fileHash: string, source: string, documentType: string, documentClass: string, period: string, originalFileUrl: string, existingHashes: string[]}} input
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
 * 示范：把目前已经存在的引擎串成一条完整链——Import → Parse → Reconciliation
 * （→ Verified Income，Reconciliation 内部已经接了）。之所以叫"示范"而不是
 * 正式对外的编排函数：extractedText 目前还是外部传进来的（对应上面说的文字
 * 抽取还没实作），等那部分接上真实来源后，这个函数的骨架不用大改，只是
 * extractedText 的来源从"参数"变成"内部调用抽取"。
 * @param {Object} importInput 见 importDocument_
 * @param {string} extractedText Document Import Engine 目前还不会自己产生，外部提供
 * @param {{truthWriter: Object, riderOSAdapter: Object, now: Date}} deps
 * @return {Object}
 */
function processGrabStatement_(importInput, extractedText, deps) {
  const importResult = importDocument_(importInput, deps);
  if (importResult.status === 'Duplicate_Skipped') {
    return { stage: 'Import', result: importResult };
  }

  const parser = ParserRegistry.getParserFor({ source: importInput.source, document_type: importInput.documentType });
  const parsedStatement = parser.parse({ source: importInput.source, document_type: importInput.documentType }, extractedText);

  const reconciliationResult = runReconciliationForWeek_(
    parsedStatement.document_meta.week,
    parsedStatement,
    { riderOSAdapter: deps.riderOSAdapter, truthWriter: deps.truthWriter, now: deps.now }
  );

  return { stage: 'Reconciliation', importResult, parsedStatement, reconciliationResult };
}

if (typeof module !== 'undefined') {
  module.exports = {
    DOCUMENTS_COLUMNS,
    computeDocumentId_,
    isDuplicateHash_,
    buildDocumentRecord_,
    writeDocumentRecord_,
    computeFileHash_,
    importDocument_,
    processGrabStatement_
  };
}
