/**
 * 127_LLMExtractor.js
 * Compliance OS — LLMExtractor：112_DocumentTextExtractor.js 的具体实现
 * 之一（provider = 'llm'，目前的默认/主要 production 路径）。
 *
 * 「LLM 是 Extraction Engine，不是 Truth Engine」——这个文件只负责
 * PDF → Structured Candidate + 证据留存，不做任何验证判断（candidate 对
 * 不对、能不能变成 Verified，全部是 125_ExtractionValidation.js 的职责，
 * 不在这里）。provider 自己回传的 finishReason 之类的讯号会原样记录进
 * evidence，但不当作 acceptance gate 用。
 *
 * Provider 选用 Gemini（generateContent，2026-08 现行文件里仍在支援、
 * 官方文件标记「Legacy」但没有下线公告的那一代 REST 端点，不是较新的
 * interactions API）——原因：请求/回应的确切形状我有把握（多个独立来源
 * 文件互相印证），比新一代 API 的确切回应栏位更确定；这份专案要的是正确、
 * 可除错，不是最新。真的要换 provider（Gemini 换代、或换 OpenAI/Claude），
 * 只需要在这个文件里换掉 buildXxxRequestBody_/parseXxxResponse_，
 * 112_DocumentTextExtractor.js 跟其他呼叫方完全不用动——这是 Adapter
 * 模式本来就该有的效果。
 *
 * model/API key 都从 Script Properties 读（LLM_EXTRACTOR_MODEL /
 * GEMINI_API_KEY），不写死进代码——模型名称汰换速度比这份专案的部署周期
 * 快，写死等于每次 Google 换代都要改代码重新部署。
 *
 * 证据留存（要求 #6）：raw response + candidate + 送进去的 request 一起
 * 写成一个 Drive 里的 JSON 檔，档名带 document_id + extraction version，
 * 不管这次抽取最后 validate 过不过都会写——candidate 被拒绝了也要留得下
 * 痕迹，不然没办法回头看「这次 LLM 到底是怎么编错的」。
 */

/**
 * Butiran Tempahan（逐笔订单）extraction schema — Phase 4（2026-08-25，
 * 对应 compliance-os-phase4-gemini-extraction-design.md §3，Steven 批准）。
 *
 * 跟上面 LLM_EXTRACTION_SCHEMA_（statement 层级）同一个文件、同一个
 * Adapter，因为两者本质上是同一件事（叫 Gemini 读同一份 PDF、要结构化
 * JSON），只是要的栏位跟 prompt 不同——CMP-P7「外部依赖收拢成单一
 * Adapter」：Gemini 只有一个说话的地方，不要因为多了一种抽取需求就
 * 多开一个文件重新接一次 API。
 *
 * 跟 statement 层级 schema 的关键差异：这里完全不给 Gemini 任何计算或
 * 判断空间——`and_more_count` 没写就是 0、`other_income` 空白就是 0，
 * 这两个「找不到就当 0」的规则明确写进 prompt，而不是留给 Gemini 自己
 * 决定「大概是 0 吧」——CMP-P10 的字面意思是「不确定要显式」，但这里的
 * 情况是"这两个栏位空白本身就是明确证据"，跟"看不清楚所以猜"是两回事，
 * 所以允许写死这条规则，不算违反不猜的原则。除此之外一律要求原文照抄，
 * 抓不到/看不懂的一律留 null，不准 Gemini 用自己的判断填补。
 */
var BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_ = {
  type: 'object',
  properties: {
    extraction_scope: {
      type: 'object',
      description: '这次抽取实际涵盖的页码范围——不管是整份文件还是指定范围，都要照实回报，不要照抄 prompt 里给的范围了事（万一 Gemini 实际上只看得到部分页面）。',
      properties: {
        first_page_seen: { type: 'integer' },
        last_page_seen: { type: 'integer' }
      },
      required: ['first_page_seen', 'last_page_seen']
    },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          weekday_name: { type: 'string', description: 'PDF 上印的原文星期几，例如 "Ahad"，照抄不要翻译' },
          day: { type: 'integer' },
          month_name: { type: 'string', description: 'PDF 上印的原文月份名，例如 "Januari"，照抄不要翻译' },
          day_block_complete: {
            type: 'boolean',
            description: '这个日期分组在你实际看到的页面范围内是否完整（有看到它的开头也看到它自己的 "RM x,xxx.xx" 小计）。如果这个日期分组的内容看起来延伸到你看到的页面范围以外（开头或结尾被切断），填 false。'
          },
          printed_daily_subtotal: {
            type: ['number', 'null'],
            description: '该日期分组结尾印出来的 "RM x,xxx.xx"，逐字读出这个数字本身，不要自己加总 orders 算出来；如果这个分组不完整、看不到它自己的小计，填 null。'
          },
          orders: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                order_row_type: { type: 'string', enum: ['Tunggal', 'Sekaligus'], description: '照 PDF 原文，不要因为看到多个订单号就自己判断成 Sekaligus——以 PDF 实际印的字为准' },
                platform_raw: { type: 'string', description: '照 PDF 原文，例如 "GrabFood"、"GrabExpress Instant -- Bike"，不要正规化或简化' },
                order_ids_raw: {
                  type: 'array', items: { type: 'string' },
                  description: '这一行明确印出来的订单号，逐个照抄，包含前缀（"A-" 或 "PLAN-1-" 等）。只列印出来看得到的，不要因为是 Sekaligus 就推测/补出应该有几个。'
                },
                and_more_count: { type: 'integer', description: '这一行文字里 "and N" 的 N；没有这个文字就填 0，不要自己猜测隐藏了几个订单。' },
                payment_method_raw: { type: 'string', description: '照 PDF 原文，例如 "Tanpa tunai"、"Tunai"，或两者都有时原样列出' },
                base_income: { type: 'number', description: 'Pendapatan asas 栏' },
                other_income: { type: 'number', description: 'Pendapatan lain 栏；这一栏空白（没有印数字）就填 0，不是不确定，是这一栏本来就没有数字。' },
                income_adjustment: { type: 'number', description: 'Pelarasan Pendapatan 栏' },
                net_income: { type: 'number', description: 'Pendapatan bersih 栏' },
                source_page: { type: 'integer', description: '这一行实际印在第几页' },
                low_confidence: { type: 'boolean', description: '如果这一行任何欄位印刷模糊、被遮挡、或你不确定自己读对，填 true，并在下面 notes 具体说明是哪一行、哪个欄位。' }
              },
              required: ['order_row_type', 'platform_raw', 'order_ids_raw', 'and_more_count', 'payment_method_raw', 'base_income', 'other_income', 'income_adjustment', 'net_income', 'source_page', 'low_confidence']
            }
          }
        },
        required: ['weekday_name', 'day', 'month_name', 'day_block_complete', 'printed_daily_subtotal', 'orders']
      }
    },
    notes: {
      type: 'string',
      description: '任何模糊不清、无法确定、或你选择不猜测而留白的地方，具体说明是哪一天、哪一行、哪个欄位。完全没有这类情况就给空字符串。'
    }
  },
  required: ['extraction_scope', 'days', 'notes']
};

/**
 * @param {{firstPage:number, lastPage:number}|null} pageRange 传 null 表示整份文件一次处理（Phase 4 design 的首选路径）；
 *   传 {firstPage, lastPage} 表示只处理这个页码范围内看得到的内容（chunk fallback 用）。
 */
function buildButiranTempahanPrompt_(pageRange) {
  const scopeLine = pageRange
    ? `这次只需要处理第 ${pageRange.firstPage} 页到第 ${pageRange.lastPage} 页看得到的内容——如果某个日期分组的开头或结尾落在这个范围以外，仍然把你在这个范围内看到的部分列出来，并且把该分组的 "day_block_complete" 填 false，不要因为看不到全貌就跳过整个分组不报。`
    : '这是完整一份 PDF，处理全部页面。';
  return [
    '你是一个财务文件抽取工具。以下是一份 Grab 骑手周结单（PDF）当中的',
    '"Butiran Tempahan - Penghantaran"（逐笔订单明细）区段。',
    scopeLine,
    '',
    '严格规则，逐条遵守：',
    '1. 只转录 PDF 上实际印出来的文字和数字，不要计算、不要推测、不要四舍五入。',
    '2. 不要为了让 base_income + other_income + income_adjustment 等于 net_income 而调整任何一个数字——就算加起来对不上，也是照抄各自印出来的数字，对不上是我们自己会去检查的事，不是你要修正的事。',
    '3. 一行如果标示为 "Sekaligus"，只列出这一行明确印出来的订单号；如果文字里有 "and N"，把 N 填进 and_more_count，不要自己猜测/编出那 N 个订单号是什么，也不要因为是 Sekaligus 就把它拆成好几个独立的订单。',
    '4. 一行如果标示为 "Tunggal"，就是单一订单，即使你觉得金额看起来像是多笔订单合并也不要改判成 Sekaligus——以 PDF 印的字为准。',
    '5. 日期只从该行所在的日期分组标题读取（例如 "Ahad, 4 Januari"），不要用其他页面的日期去推断这一行属于哪一天，也不要把一个日期分组的订单归到另一个日期分组。',
    '6. 任何一个欄位如果印刷模糊、被遮挡、看不清楚，把该行的 low_confidence 填 true 并在 notes 说明，欄位本身仍填你能辨识到的最佳读数，不要用 null 掩盖——除非完全无法辨识出任何数字/文字，此时才允许该欄位留空/null 并在 notes 说明原因。',
    '7. 不要输出这份文件里没有出现过的订单号或金额。'
  ].join('\n');
}

/**
 * 纯函数——组 Butiran Tempahan 抽取的 Gemini request body。跟
 * buildGeminiRequestBody_ 结构完全一样，只是换了 prompt 跟 schema——
 * 两者共用同一个 postJson/parseGeminiResponse_/evidence 机制。
 * @param {string} pdfBase64
 * @param {{firstPage:number, lastPage:number}|null} pageRange
 * @return {Object}
 */
function buildGeminiOrderExtractionRequestBody_(pdfBase64, pageRange) {
  return {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
          { text: buildButiranTempahanPrompt_(pageRange) }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_
    }
  };
}

if (typeof require === 'function') {
  var { validateCandidateSchema_ } = require('./125_ExtractionValidation.js');
}

/** Gemini structured-output 用的 JSON Schema——候选值只到 buildVerifiedIncomeRecord_ 真的会用到的栏位，不多要（栏位越多，LLM 出错的地方越多）。 */
var LLM_EXTRACTION_SCHEMA_ = {
  type: 'object',
  properties: {
    document_meta: {
      type: 'object',
      properties: {
        source: { type: 'string', description: '文件来源平台，例如 "Grab"' },
        document_type: { type: 'string', description: '文件类型，例如 "Weekly Statement"' },
        currency: { type: 'string', description: '货币代码，例如 "MYR"' },
        period_start_parts: {
          type: 'object',
          description: '结算期间的起始日期，拆成整数——不要给字符串日期',
          properties: { year: { type: 'integer' }, month: { type: 'integer' }, day: { type: 'integer' } },
          required: ['year', 'month', 'day']
        },
        period_end_parts: {
          type: 'object',
          description: '结算期间的结束日期，拆成整数——不要给字符串日期',
          properties: { year: { type: 'integer' }, month: { type: 'integer' }, day: { type: 'integer' } },
          required: ['year', 'month', 'day']
        }
      },
      required: ['source', 'document_type', 'currency', 'period_start_parts', 'period_end_parts']
    },
    summary: {
      type: 'object',
      properties: {
        total_income: { type: 'number' },
        total_deductions: { type: 'number' },
        weekly_net: { type: 'number' }
      },
      required: ['total_income', 'total_deductions', 'weekly_net']
    },
    income_breakdown: {
      type: 'object',
      properties: {
        net_delivery_income: { type: 'number' },
        incentive: { type: 'number' },
        tip: { type: 'number' },
        other_payments: { type: 'number' }
      },
      required: ['net_delivery_income', 'incentive', 'tip', 'other_payments']
    },
    extraction_notes: {
      type: 'string',
      description: '任何看不清楚、模糊、印刷不清或无法确定的地方，用文字具体说明是哪个欄位、为什么不确定；完全看得清楚就给空字符串。不要在这里编造数字来源。'
    }
  },
  required: ['document_meta', 'summary', 'income_breakdown', 'extraction_notes']
};

function buildExtractionPrompt_(document) {
  return [
    '你是一个财务文件抽取工具。以下是一份收入结算单（PDF）。',
    '请只抽取文件上实际印出来的数字和日期，一律照抄，不要计算、不要推测、不要四舍五入、',
    '不要为了让数字兜起来而调整任何一个值——就算你觉得某两个数字加起来应该等于另一个数字，',
    '也只抄文件上写的，不要自己去凑。',
    '',
    '日期请拆成年/月/日三个整数，不要给字符串格式的日期。',
    '',
    '如果有任何欄位模糊不清、印刷不清楚、或找不到，请在 extraction_notes 里具体说明是哪个欄位，',
    '并且该欄位仍然只能填你能辨识到的最佳猜测数字——不确定的部分靠 extraction_notes 表达，',
    '不要用编造的数字掩盖不确定。',
    `文件来源标注为：source=${(document && document.source) || 'Grab'}, document_type=${(document && document.documentType) || 'Weekly Statement'}。`
  ].join('\n');
}

/**
 * 纯函数——组 Gemini generateContent 的 request body，不碰网络。
 * @param {string} pdfBase64
 * @param {Object} document
 * @return {Object}
 */
function buildGeminiRequestBody_(pdfBase64, document) {
  return {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
          { text: buildExtractionPrompt_(document) }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: LLM_EXTRACTION_SCHEMA_
    }
  };
}

/**
 * 纯函数——从 Gemini generateContent 的 response body 里取出 candidate。
 * 明确检查 finishReason：不是 STOP（例如被安全过滤器挡下、或输出被截断）
 * 一律当抽取失败处理，不要去读一个可能不完整的 JSON（CMP-P10）。
 * @param {Object} responseBody generateContent 回传的原始 JSON
 * @return {{candidate: Object, finishReason: string}}
 */
function parseGeminiResponse_(responseBody) {
  if (!responseBody || !Array.isArray(responseBody.candidates) || responseBody.candidates.length === 0) {
    throw new Error('parseGeminiResponse_: response 里没有 candidates——可能整个请求被拒绝，原始 response: ' + JSON.stringify(responseBody).slice(0, 500));
  }
  const first = responseBody.candidates[0];
  const finishReason = first.finishReason || 'UNKNOWN';
  if (finishReason !== 'STOP') {
    throw new Error(`parseGeminiResponse_: finishReason="${finishReason}"，不是正常完成（可能被安全过滤器挡下或输出被截断），不采用这次输出`);
  }
  const parts = first.content && first.content.parts;
  if (!Array.isArray(parts) || parts.length === 0 || typeof parts[0].text !== 'string') {
    throw new Error('parseGeminiResponse_: response 里找不到 content.parts[0].text');
  }
  let candidate;
  try {
    candidate = JSON.parse(parts[0].text);
  } catch (err) {
    throw new Error(`parseGeminiResponse_: content.parts[0].text 不是合法 JSON——${err.message}`);
  }
  return { candidate, finishReason };
}

/**
 * 证据档案的内容——不管这次 candidate 最后有没有通过验证都要留得下来。
 * @return {Object}
 */
function buildEvidenceRecord_(params) {
  return {
    document_id: params.documentId || null,
    drive_file_id: params.driveFileId,
    extractor_id: params.extractorId,
    extraction_version: params.extractionVersion,
    finish_reason: params.finishReason || null,
    request_prompt: params.prompt,
    raw_candidate: params.candidate,
    raw_response: params.rawResponse
  };
}

/**
 * @param {{apiKey: string, model: string, evidenceFolderId: string}} config
 * @param {{driveService: Object, httpClient: Object, now: (Date|undefined)}} deps
 *   driveService: { getFileBytes(fileId), bytesToBase64(bytes), writeJsonFile(folderId, fileName, obj) }
 *   httpClient: { postJson(url, headers, body) }
 * @return {{extract: function(Object): Object}}
 */
function createLLMExtractor_(config, deps) {
  if (!config || !config.apiKey) {
    throw new Error('createLLMExtractor_: 缺少 apiKey（Script Properties 需要设定 GEMINI_API_KEY）');
  }
  if (!config.evidenceFolderId) {
    throw new Error('createLLMExtractor_: 缺少 evidenceFolderId（Script Properties 需要设定 EXTRACTION_EVIDENCE_FOLDER_ID）');
  }
  const model = config.model || 'gemini-3.7-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  return {
    /**
     * @param {{fileId: string, mimeType: string, documentId: (string|null)}} document
     * @return {{mode: 'structured', candidate: Object, evidence: Object}}
     */
    extract(document) {
      const now = deps.now instanceof Date ? deps.now : new Date();
      const extractionVersion = now.toISOString();
      const extractorId = `LLMExtractor:${model}`;

      const pdfBytes = deps.driveService.getFileBytes(document.fileId);
      const pdfBase64 = deps.driveService.bytesToBase64(pdfBytes);
      const requestBody = buildGeminiRequestBody_(pdfBase64, document);

      const rawResponse = deps.httpClient.postJson(
        `${endpoint}?key=${config.apiKey}`,
        { 'Content-Type': 'application/json' },
        requestBody
      );

      let parsed;
      let evidenceFileId = null;
      try {
        parsed = parseGeminiResponse_(rawResponse);
      } finally {
        // 证据不管抽取有没有成功解析都要写——就算 finishReason 不是 STOP、
        // 或 JSON 解析失败，raw_response 本身就是最重要的除错依据。
        const evidenceRecord = buildEvidenceRecord_({
          documentId: document.documentId,
          driveFileId: document.fileId,
          extractorId,
          extractionVersion,
          finishReason: parsed ? parsed.finishReason : null,
          prompt: buildExtractionPrompt_(document),
          candidate: parsed ? parsed.candidate : null,
          rawResponse
        });
        const evidenceFileName = `${document.documentId || document.fileId}__${extractionVersion.replace(/[:.]/g, '-')}.json`;
        evidenceFileId = deps.driveService.writeJsonFile(config.evidenceFolderId, evidenceFileName, evidenceRecord);
      }

      return {
        mode: 'structured',
        candidate: parsed.candidate,
        evidence: {
          extractorId,
          extractionVersion,
          evidenceFileId,
          finishReason: parsed.finishReason,
          uncertaintyNote: (parsed.candidate && parsed.candidate.extraction_notes) || ''
        }
      };
    },

    /**
     * Butiran Tempahan（逐笔订单）抽取——Phase 4 新增。跟上面 extract()
     * 是同一个 Adapter、同一份 postJson 重试逻辑、同一套证据留存机制，
     * 差别只在 schema/prompt 换成订单层级的，而且多接受一个可选的
     * pageRange 参数支援 chunk fallback（compliance-os-phase4-gemini-
     * extraction-design.md §2：整份文件一次处理是首选，pageRange 只在
     * 需要 fallback 时才用）。
     * @param {{fileId: string, mimeType: string, documentId: (string|null)}} document
     * @param {{firstPage:number, lastPage:number}|null} pageRange 传 null 表示整份处理
     * @return {{mode: 'structured', candidate: Object, evidence: Object}}
     */
    extractOrders(document, pageRange) {
      const now = deps.now instanceof Date ? deps.now : new Date();
      const extractionVersion = now.toISOString();
      const scopeTag = pageRange ? `orders:p${pageRange.firstPage}-${pageRange.lastPage}` : 'orders:full';
      const extractorId = `LLMExtractor:${model}:${scopeTag}`;

      const pdfBytes = deps.driveService.getFileBytes(document.fileId);
      const pdfBase64 = deps.driveService.bytesToBase64(pdfBytes);
      const requestBody = buildGeminiOrderExtractionRequestBody_(pdfBase64, pageRange || null);

      const rawResponse = deps.httpClient.postJson(
        `${endpoint}?key=${config.apiKey}`,
        { 'Content-Type': 'application/json' },
        requestBody
      );

      let parsed;
      let evidenceFileId = null;
      try {
        parsed = parseGeminiResponse_(rawResponse);
      } finally {
        const evidenceRecord = buildEvidenceRecord_({
          documentId: document.documentId,
          driveFileId: document.fileId,
          extractorId,
          extractionVersion,
          finishReason: parsed ? parsed.finishReason : null,
          prompt: buildButiranTempahanPrompt_(pageRange || null),
          candidate: parsed ? parsed.candidate : null,
          rawResponse
        });
        const evidenceFileName = `${document.documentId || document.fileId}__${scopeTag.replace(/[:]/g, '-')}__${extractionVersion.replace(/[:.]/g, '-')}.json`;
        evidenceFileId = deps.driveService.writeJsonFile(config.evidenceFolderId, evidenceFileName, evidenceRecord);
      }

      return {
        mode: 'structured',
        candidate: parsed.candidate,
        evidence: {
          extractorId,
          extractionVersion,
          evidenceFileId,
          finishReason: parsed.finishReason,
          pageRange: pageRange || null,
          uncertaintyNote: (parsed.candidate && parsed.candidate.notes) || ''
        }
      };
    }
  };
}

/** 真的调 DriveApp/UrlFetchApp/Utilities 的那一层——只能在真实 GAS 环境跑，Node 测不了。 */
function realLLMExtractorDeps_(now) {
  return {
    driveService: {
      getFileBytes(fileId) {
        return DriveApp.getFileById(fileId).getBlob().getBytes();
      },
      bytesToBase64(bytes) {
        return Utilities.base64Encode(bytes);
      },
      writeJsonFile(folderId, fileName, obj) {
        const folder = DriveApp.getFolderById(folderId);
        const blob = Utilities.newBlob(JSON.stringify(obj, null, 2), 'application/json', fileName);
        return folder.createFile(blob).getId();
      }
    },
    httpClient: {
      /**
       * 2026-08-23 修正（审计报告 HIGH-4）：以前一有非 2xx 就直接抛错，
       * 429（Rate Limit）、502/503 等短暂性服务端问题在批次汇入几十份
       * 文件时并不罕见，一次偶发就中断当次那个文件的处理。现在对这两类
       * 可重试的状态码做指数退避重试（1s/2s/4s），非 2xx 但不可重试的
       * （例如 400/401，请求本身有问题，重试不会变好）维持原本直接抛错。
       * UrlFetchApp 本身没有可调的逾时设定（GAS 平台限制，不是这里能修的），
       * 重试次数因此也要有上限——不能让单一文件的重试吃光整批的 6 分钟
       * 预算（见 170_OperatorConsole.js 的 consoleBatchImport_ 时间预算）。
       */
      postJson(url, headers, body) {
        const maxAttempts = 4; // 第一次 + 最多 3 次重试
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const response = UrlFetchApp.fetch(url, {
            method: 'post',
            contentType: 'application/json',
            headers,
            payload: JSON.stringify(body),
            muteHttpExceptions: true
          });
          const code = response.getResponseCode();
          const text = response.getContentText();
          if (code >= 200 && code < 300) {
            return JSON.parse(text);
          }
          lastError = new Error(`LLM API 回传 HTTP ${code}：${text.slice(0, 500)}`);
          const isRetryable = code === 429 || code >= 500;
          if (!isRetryable || attempt === maxAttempts) {
            throw lastError;
          }
          Utilities.sleep(1000 * Math.pow(2, attempt - 1)); // 1s, 2s, 4s
        }
        throw lastError;
      }
    },
    now: now || new Date()
  };
}

/**
 * GAS 环境下真正会用到的入口——从 Script Properties 读设定，组出真的
 * LLMExtractor。Script Properties 没设好会直接抛错（CMP-P10：不猜）。
 * @return {{extract: function(Object): Object}}
 */
function realLLMExtractor_() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    apiKey: props.getProperty('GEMINI_API_KEY'),
    model: props.getProperty('LLM_EXTRACTOR_MODEL'), // 没设定时 createLLMExtractor_ 会 fallback 到默认值
    evidenceFolderId: props.getProperty('EXTRACTION_EVIDENCE_FOLDER_ID')
  };
  return createLLMExtractor_(config, realLLMExtractorDeps_());
}

if (typeof module !== 'undefined') {
  module.exports = {
    LLM_EXTRACTION_SCHEMA_,
    BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_,
    buildExtractionPrompt_,
    buildButiranTempahanPrompt_,
    buildGeminiRequestBody_,
    buildGeminiOrderExtractionRequestBody_,
    parseGeminiResponse_,
    buildEvidenceRecord_,
    createLLMExtractor_,
    realLLMExtractorDeps_,
    realLLMExtractor_
  };
}
