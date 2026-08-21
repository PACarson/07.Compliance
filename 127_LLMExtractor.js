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
      postJson(url, headers, body) {
        const response = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          headers,
          payload: JSON.stringify(body),
          muteHttpExceptions: true
        });
        const code = response.getResponseCode();
        const text = response.getContentText();
        if (code < 200 || code >= 300) {
          throw new Error(`LLM API 回传 HTTP ${code}：${text.slice(0, 500)}`);
        }
        return JSON.parse(text);
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
    buildExtractionPrompt_,
    buildGeminiRequestBody_,
    parseGeminiResponse_,
    buildEvidenceRecord_,
    createLLMExtractor_,
    realLLMExtractorDeps_,
    realLLMExtractor_
  };
}
