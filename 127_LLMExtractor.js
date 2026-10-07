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
            // 2026-09-27 修复（真实 GAS：每次呼叫 Gemini 都立刻回 HTTP 400
            // "Unknown name \"type\"...Proto field is not repeating, cannot
            // start list"，2.74 秒内就失败，连 PDF 都还没真的开始处理）：
            // Gemini 的 Schema.type 是单一 enum 欄位（protobuf 非 repeating），
            // 不支援 JSON Schema 常见的 type: [x, 'null'] 联合类型写法——不管
            // 换哪个 gemini-*-flash 模型、额度够不够，这个请求本身在到达
            // 模型推理之前就会被 API 拒绝，不是模型或额度问题。改用 Gemini
            // 自己支援的 nullable: true + 单一 type，语意完全不变（仍然允许
            // null，仍然是 days.items 的 required 欄位——required 只规定这个
            // key 要存在，不规定值不能是 null，125_ExtractionValidation.js
            // 的 validateOrderExtractionCandidate_ 本来就是 !== null 才检查
            // 是不是数字，这里不用跟着改）。
            type: 'number',
            nullable: true,
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
    raw_response: params.rawResponse,
    // 2026-10-01 新增，主模型 503 换成 fallback 模型才成功时才有值，其余
    // 情况是 null——不是每份证据都要有这个栏位有意义的值。
    fallback_note: params.fallbackNote || null
  };
}

/**
 * 2026-09-28：没有任何设定时用的默认模型——单一来源，createLLMExtractor_ 的
 * 最终防线跟 resolveLLMExtractorConfig_ 都读这一个，不要各写一份。原本是
 * gemini-3.7-flash；真实 GAS 环境实测 3.5-flash 免费额度（除错记录里的 429
 * 写着 free_tier_requests, limit: 20）很快用完、又常遇到 503，改成目前最新
 * 一代的 gemini-3.8-flash（2026-09-02 发布；Steven 2026-09-28 确认用它在真实 GAS
 * 跑通了 daily allocation，含 PDF 输入 + responseSchema）。这只是「Script Properties 没设定时」的默认值，
 * 正常情况下 model 应该由 LLM_EXTRACTOR_MODEL 决定，见下面
 * resolveLLMExtractorConfig_。
 */
var DEFAULT_LLM_EXTRACTOR_MODEL_ = 'gemini-3.8-flash';

/**
 * 2026-10-01 新增，2026-10-02 从「第二个模型」扩成「第三个模型」（Steven
 * 要求：前两个都失败还有第三个可以用）：503（高峰期该模型没有算力）时依序
 * 换打的候选模型，跟主模型同一个道理——没设定 Script Properties 就用这些
 * 默认值，不是写死唯一选项。三层默认值刻意选三个「世代、发布时间都明显
 * 不同」的模型，降低全部同时撞高峰期的机率（真实撞过三次 503——09-27 的
 * 3.7-flash、09-29 的 3.8-flash、10-01 又是 3.7-flash）。
 *
 * 明确不选 gemini-2.5-flash（多份除错记录里这个外部除错助手一直建议的
 * "稳定选项"）：查证 Google 官方 deprecations 页面（2026-10-01）显示 2.5
 * 系列目前限制成「只有以前真的呼叫过的专案才能继续用」，官方原文明确写
 * 「新专案请改用 3.5 Flash-Lite 或 3.8 Flash」——这个专案从未真的呼叫过
 * gemini-2.5-flash，选它当预设很可能直接连不上（跟这次遇到的问题是同一
 * 类：没有真的查证一个模型名字是不是当下还能用就拿来当预设，2026-09-27
 * 已经在 realLLMExtractor_ 的写死模型事件上犯过一次类似的错）。
 */
var DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_ = 'gemini-3.6-flash';
/** 2026-10-02 新增——第三层，Steven 明确要求「第三个没设定就默认用 gemini-3.5-flash」。 */
var DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_ = 'gemini-3.5-flash';

/**
 * 2026-09-28 新增，2026-10-02 从两层扩成三层——纯函数，Node 可测。从 Script
 * Properties（传进来的只要有 getProperty(key) 就行）解析出 createLLMExtractor_
 * 要的 config。
 *
 * 优先序，三层都一样：Script Property 有设（去掉前后空白后非空）就用它，
 * 否则用对应的 DEFAULT_*。这是这个文件开头就讲清楚的设计原则——模型名称
 * 汰换比部署周期快，不写死进代码，换模型只要改 Script Properties。真实 GAS
 * 环境曾经把 realLLMExtractor_ 改成写死 model: 'gemini-3.8-flash'（能动，但
 * 违反这个原则，下次 Google 换代又要改代码重新部署）；这里改回读设定，并且
 * 处理「设定值是空白/只有空格」——那种值会是 truthy，`||` 不会落到默认值，
 * 模型名变成空白，URL 直接 404。
 *
 * modelChain 是去重后、照优先顺序排列的实际尝试清单（createLLMExtractor_
 * 用这个，不自己重新组一次）：后面哪一层如果跟前面任何一层同名，视同没有
 * 那一层——不会真的切换成同一个模型重打一次。modelSource 系列欄位只是给人
 * 看的（'ScriptProperty:LLM_EXTRACTOR_FALLBACK_MODEL_2' 或 'default'），
 * createLLMExtractor_ 不读它们；用来在 GAS 里一眼确认到底用的是哪个来源的
 * 模型，不用再猜。
 * @param {{getProperty: function(string): (string|null)}} props
 * @return {{apiKey: (string|null), model: string, modelSource: string, fallbackModel: (string|null), fallbackModelSource: string, fallbackModel2: (string|null), fallbackModel2Source: string, modelChain: string[], evidenceFolderId: (string|null)}}
 */
function resolveLLMExtractorConfig_(props) {
  function resolveTier_(key, defaultValue) {
    const raw = props.getProperty(key);
    const trimmed = (typeof raw === 'string') ? raw.trim() : '';
    return { value: trimmed || defaultValue, fromProperty: !!trimmed };
  }
  const primary = resolveTier_('LLM_EXTRACTOR_MODEL', DEFAULT_LLM_EXTRACTOR_MODEL_);
  const fb1 = resolveTier_('LLM_EXTRACTOR_FALLBACK_MODEL', DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_);
  const fb2 = resolveTier_('LLM_EXTRACTOR_FALLBACK_MODEL_2', DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_);
  const seen = {};
  const modelChain = [];
  [primary.value, fb1.value, fb2.value].forEach((m) => {
    if (!seen[m]) { seen[m] = true; modelChain.push(m); }
  });
  return {
    apiKey: props.getProperty('GEMINI_API_KEY'),
    model: primary.value,
    modelSource: primary.fromProperty ? 'ScriptProperty:LLM_EXTRACTOR_MODEL' : 'default',
    fallbackModel: fb1.value !== primary.value ? fb1.value : null,
    fallbackModelSource: fb1.fromProperty ? 'ScriptProperty:LLM_EXTRACTOR_FALLBACK_MODEL' : 'default',
    fallbackModel2: (modelChain.indexOf(fb2.value) !== -1 && fb2.value !== primary.value && fb2.value !== fb1.value) ? fb2.value : null,
    fallbackModel2Source: fb2.fromProperty ? 'ScriptProperty:LLM_EXTRACTOR_FALLBACK_MODEL_2' : 'default',
    modelChain,
    evidenceFolderId: props.getProperty('EXTRACTION_EVIDENCE_FOLDER_ID')
  };
}

/**
 * @param {{apiKey: string, model: string, evidenceFolderId: string}} config
 * @param {{driveService: Object, httpClient: Object, now: (Date|undefined)}} deps
 *   driveService: { getFileBytes(fileId), bytesToBase64(bytes), writeJsonFile(folderId, fileName, obj) }
 *   httpClient: { postJson(url, headers, body) }
 * @return {{extract: function(Object): Object}}
 */
/**
 * 2026-10-01 新增，2026-10-02 从「两层」扩成「任意长度的模型链」（Steven
 * 要求：前两个都失败还要有第三个可以用）——纯函数（接受 io 注入，Node 可
 * 测）。真实 GAS 撞过三次：某个模型在 Google 高峰期回 HTTP 503（这个模型
 * 现在没有算力，不是这个专案的问题），换一个模型立刻就通（09-27
 * 3.7-flash→3.5-flash、09-29 3.8-flash→3.5-flash、10-01 又是
 * 3.7-flash→3.5-flash——每次都是外部除错助手手写一次性诊断脚本才做到，
 * production 代码本身没有这个能力）。这里把它做成 extract()/extractOrders()
 * 共用的能力：依序尝试 models 里的每个模型，只有在 isCapacityIssue（503，
 * 127 的 createRetryingPostJson_ 设的旗标）失败时才换下一个；撞到非 503
 * 的例外（429 额度用尽、400 请求本身有问题）立刻原样丢出去，不会继续往
 * 下一个模型试——429 换模型有没有用尚未证实，142 那边已经有自己的「不要
 * 浪费额度」处理，这里不重复判断；400 换模型不会让 schema 错误变好，继续
 * 试只是白费时间。
 *
 * allModelsCapacityExhausted：全部模型都试过、而且全部都是因为
 * isCapacityIssue 才失败时才是 true——142 可以用这个旗标判断「这不是单一
 * 模型的偶发问题，是当下所有候选模型都没有算力」，决定要不要比照额度用尽
 * 跳过后续的 chunk fallback（同样的容量紧张，换页码重打也不会有不同结果）。
 * 只要有任何一个模型是因为非 503 的原因失败（例如中途撞到 429），这个旗标
 * 就是 false——不是「全部都是容量问题」，不该被当成同一回事处理。
 * @param {string[]} models 照优先顺序排列、已去重的模型名字（至少 1 个）
 * @param {string} apiKey
 * @param {{postJson: function(string, Object, Object): Object}} httpClient
 * @param {Object} requestBody 每个模型送出去的 request body 完全一样（换模型
 *   不需要换 schema/prompt，只换 URL 里的模型名字）
 * @return {{rawResponse: Object, modelUsed: string, attemptedModelErrors: Array<{model: string, error: Error}>, primaryError: (Error|null)}}
 */
function postJsonWithModelFallback_(models, apiKey, httpClient, requestBody) {
  function callModel_(modelName) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    return httpClient.postJson(`${endpoint}?key=${apiKey}`, { 'Content-Type': 'application/json' }, requestBody);
  }
  const attemptedModelErrors = [];
  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    try {
      const rawResponse = callModel_(modelName);
      return { rawResponse, modelUsed: modelName, attemptedModelErrors, primaryError: attemptedModelErrors.length > 0 ? attemptedModelErrors[0].error : null };
    } catch (err) {
      attemptedModelErrors.push({ model: modelName, error: err });
      const isLastModel = i === models.length - 1;
      const canTryNext = !isLastModel && !!(err && err.isCapacityIssue);
      if (!canTryNext) {
        err.attemptedModelErrors = attemptedModelErrors;
        err.allModelsCapacityExhausted = attemptedModelErrors.every((a) => a.error && a.error.isCapacityIssue === true);
        if (attemptedModelErrors.length > 1) {
          err.primaryModelError = attemptedModelErrors.slice(0, -1).map((a) => `${a.model}: ${a.error.message}`).join(' | ');
        }
        throw err;
      }
    }
  }
}

function createLLMExtractor_(config, deps) {
  if (!config || !config.apiKey) {
    throw new Error('createLLMExtractor_: 缺少 apiKey（Script Properties 需要设定 GEMINI_API_KEY）');
  }
  if (!config.evidenceFolderId) {
    throw new Error('createLLMExtractor_: 缺少 evidenceFolderId（Script Properties 需要设定 EXTRACTION_EVIDENCE_FOLDER_ID）');
  }
  const model = config.model || DEFAULT_LLM_EXTRACTOR_MODEL_;
  // 2026-10-02：优先用 config.modelChain（resolveLLMExtractorConfig_ 已经去重、
  // 排好顺序）；没有的话（例如呼叫方直接手写 config，像既有测试那样）退回
  // 「只有主模型，没有 fallback」，不会因为缺这个欄位就报错或试图自己猜。
  const modelChain = Array.isArray(config.modelChain) && config.modelChain.length > 0 ? config.modelChain : [model];

  return {
    /**
     * @param {{fileId: string, mimeType: string, documentId: (string|null)}} document
     * @return {{mode: 'structured', candidate: Object, evidence: Object}}
     */
    extract(document) {
      const now = deps.now instanceof Date ? deps.now : new Date();
      const extractionVersion = now.toISOString();

      const pdfBytes = deps.driveService.getFileBytes(document.fileId);
      const pdfBase64 = deps.driveService.bytesToBase64(pdfBytes);
      const requestBody = buildGeminiRequestBody_(pdfBase64, document);

      const { rawResponse, modelUsed, attemptedModelErrors } = postJsonWithModelFallback_(modelChain, config.apiKey, deps.httpClient, requestBody);
      const extractorId = `LLMExtractor:${modelUsed}`;

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
          rawResponse,
          // 2026-10-01：primaryError 不是 null 代表真的切换模型才成功，留下
          // 痕迹方便回头查「这次为什么用的不是设定的主模型」，不是每次都要
          // 去猜。primaryError 是 null（从头就用主模型成功）时这个欄位不写，
          // 不为了「统一形状」硬塞一个 null 进 evidence。
          fallbackNote: attemptedModelErrors.length > 0
            ? `${attemptedModelErrors.map((a) => `${a.model} 因 503 高峰期无算力失败（${a.error.message}）`).join('；')}——改用 ${modelUsed} 成功`
            : undefined
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

      const pdfBytes = deps.driveService.getFileBytes(document.fileId);
      const pdfBase64 = deps.driveService.bytesToBase64(pdfBytes);
      const requestBody = buildGeminiOrderExtractionRequestBody_(pdfBase64, pageRange || null);

      const { rawResponse, modelUsed, attemptedModelErrors } = postJsonWithModelFallback_(modelChain, config.apiKey, deps.httpClient, requestBody);
      const extractorId = `LLMExtractor:${modelUsed}:${scopeTag}`;

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
          rawResponse,
          fallbackNote: attemptedModelErrors.length > 0
            ? `${attemptedModelErrors.map((a) => `${a.model} 因 503 高峰期无算力失败（${a.error.message}）`).join('；')}——改用 ${modelUsed} 成功`
            : undefined
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

/**
 * 2026-09-28 新增——纯函数，Node 可测。从 Gemini 429 错误的 response body
 * 里解析出建议等待秒数：优先读结构化的 details[].retryDelay（RetryInfo，
 * 例如 "52s"），读不到就退回 message 文字里人看得懂的 "Please retry in
 * Xs"（同一个数字通常两个地方都有，结构化的比较不会因为 Google 改了措辞
 * 就解析失败）。两个都没有、或 responseText 根本不是合法 JSON，回传 null，
 * 呼叫方自己决定 fallback（不在这里假设一个数字）。
 * @param {string} responseText postJson 收到的原始 response body 文字
 * @return {(number|null)} 建议等待秒数，解析不出来回传 null
 */
function parseRetryDelaySeconds_(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    const details = (parsed.error && parsed.error.details) || [];
    const retryInfo = details.find((d) => d['@type'] && String(d['@type']).indexOf('RetryInfo') !== -1);
    if (retryInfo && retryInfo.retryDelay) {
      const match = String(retryInfo.retryDelay).match(/^([\d.]+)s$/);
      if (match) return parseFloat(match[1]);
    }
    const message = (parsed.error && parsed.error.message) || '';
    const messageMatch = message.match(/retry in ([\d.]+)s/i);
    if (messageMatch) return parseFloat(messageMatch[1]);
  } catch (err) {
    // responseText 不是合法 JSON，或形状跟预期不一样——回 null，不要让这层
    // 新增的解析本身出错反而害原本能重试的请求也失败。
  }
  return null;
}

/**
 * 2026-09-28：重试等待的上限。
 * - 单次等待最多 55 秒：Gemini 429 有时会回报很长的建议等待时间，不能整个照睡。
 * - 单次 postJson 累计最多等 60 秒：GAS Web App 一次执行只有 6 分钟，而一次成功的
 *   整份订单抽取本身就要跑 100 秒以上；consoleRunDailyAllocation_ 最坏会连打三次
 *   （整份 + 两段 chunk）。超过就不再重试、直接把最后一次的错误抛出去，让
 *   142 记进 attempts，也比整个执行被 GAS 硬杀、连结构化的失败结果都回不来好。
 */
var MAX_SINGLE_RETRY_SLEEP_MS_ = 55000;
var MAX_TOTAL_RETRY_SLEEP_MS_ = 60000;

/**
 * 2026-10-02 新增，真实 GAS 触发：consoleRunDailyAllocation_ 一次只处理一笔
 * 收入，整个 6 分钟都是它的，上面这组「耐心」预算（配合三层模型链）对它是
 * 合理的——已经这样真实验证过三次。但 consoleBatchImport_ 在同一次执行里
 * 要处理很多份文件，6 分钟要分给全部文件；2026-10-01 20:25-20:31 真实撞到
 * consoleBatchImport 整个被 GAS 平台硬杀（"Exceeded maximum execution
 * time"——平台层级终止，不是 catchable 的例外，consoleImportOneDriveFile_
 * 的 try/catch 完全接不住，连一个干净的失败结果都救不回来），因为批次汇入
 * 沿用了跟单笔一样耐心的重试预算；这次把模型链从两层扩成三层，如果沿用
 * 同一套预算、还让批次情境套用，只会让这个风险更大，不是更小。
 *
 * 分成两种预算，由 realLLMExtractor_(profile) 决定用哪一种：
 * - SINGLE_RETRY_BUDGET_：consoleRunDailyAllocation_ 用，沿用上面原本的值。
 * - BATCH_RETRY_BUDGET_：consoleBatchImport_/consoleRetryFile_/
 *   consoleManualImport_（经 112 的 lazyLLMExtractor_）用，收紧成几秒等级——
 *   高峰期没算力就让这一份文件快速、干净地失败（Steven 已经看得到"抽取
 *   失败 Retry"），下一份文件才有机会在剩下的时间内处理，不要为了一份文件
 *   的重试把整批拖到被硬杀。
 */
var SINGLE_RETRY_BUDGET_ = { maxSingleRetrySleepMs: MAX_SINGLE_RETRY_SLEEP_MS_, maxTotalRetrySleepMs: MAX_TOTAL_RETRY_SLEEP_MS_ };
var BATCH_RETRY_BUDGET_ = { maxSingleRetrySleepMs: 8000, maxTotalRetrySleepMs: 10000 };

/**
 * 组出带重试的 postJson。I/O 从参数注入（真实环境是 UrlFetchApp.fetch /
 * Utilities.sleep，Node 测试用假的），重试策略本身因此可以在 Node 里测——原本
 * 这段整个躲在 realLLMExtractorDeps_ 里面，「只能在真实 GAS 环境跑，Node 测不了」。
 *
 * 2026-08-23 修正（审计报告 HIGH-4）：以前一有非 2xx 就直接抛错，429（Rate
 * Limit）、502/503 等短暂性服务端问题在批次汇入几十份文件时并不罕见，一次偶发
 * 就中断当次那个文件的处理。现在对这两类可重试的状态码做退避重试，非 2xx 但不可
 * 重试的（例如 400/401，请求本身有问题，重试不会变好）维持原本直接抛错。
 * UrlFetchApp 本身没有可调的逾时设定（GAS 平台限制，不是这里能修的），重试次数
 * 因此也要有上限——不能让单一文件的重试吃光整批的 6 分钟预算（见 170 的
 * consoleBatchImport_ 时间预算）。
 *
 * 2026-09-28 加固（真实撞过：429 明确回 "Please retry in 52.712601335s"，但原本
 * 固定 1s/2s/4s 的 exponential backoff 总共只等 7 秒就用完 3 次重试——quota 窗口
 * 根本还没到，等于全部重试都在浪费，3 次都还是同一个 429）：429 优先读 Gemini
 * 自己回报的建议等待秒数（RetryInfo.retryDelay，见 parseRetryDelaySeconds_，读不
 * 到就退回原本的 exponential backoff）；503 维持原本的 exponential backoff（503
 * 是容量问题，Google 没给明确等待秒数）。等待有上限，见 MAX_*_RETRY_SLEEP_MS_。
 *
 * @param {{fetch: function(string, Object): {getResponseCode: function(): number, getContentText: function(): string}, sleep: function(number): void}} io
 * @return {function(string, Object, Object): Object} postJson(url, headers, body)
 */
function createRetryingPostJson_(io, retryBudget) {
  // 2026-10-02：retryBudget 是可选的覆盖值（见上面 SINGLE_RETRY_BUDGET_/
  // BATCH_RETRY_BUDGET_ 的说明）——没给就照旧用模组层级的默认值，既有呼叫方
  // （只传一个参数）行为完全不变。
  const maxSingleRetrySleepMs = (retryBudget && retryBudget.maxSingleRetrySleepMs) || MAX_SINGLE_RETRY_SLEEP_MS_;
  const maxTotalRetrySleepMs = (retryBudget && retryBudget.maxTotalRetrySleepMs) || MAX_TOTAL_RETRY_SLEEP_MS_;
  return function postJson(url, headers, body) {
    const maxAttempts = 4; // 第一次 + 最多 3 次重试
    let lastError;
    let totalSleptMs = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = io.fetch(url, {
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
      // 2026-09-29：HTTP 429 明确代表额度/频率限制用尽（RFC 6585），不是内容或
      // 请求本身的问题——真的放弃重试时（不管是自然用完 maxAttempts 还是撞到
      // 下面的累计等待上限）在 Error 上挂一个结构化旗标，让呼叫方（142 的
      // fallback 编排）不用去解析这段中文/英文错误文字猜是不是额度问题就能
      // 判断「重试同一个 quota 没有意义」。503（容量）、400（请求本身有问题）
      // 都不设这个旗标——只有 429 明确代表 quota/rate-limit。
      if (code === 429) lastError.isQuotaExhausted = true;
      // 2026-10-01：503 明确代表「这个模型现在高峰期没有算力」（Google 官方
      // 错误文字："This model is currently experiencing high demand"），不是
      // 额度问题、也不是请求本身有问题——真实撞过两次（09-27 gemini-3.7-flash、
      // 09-29 gemini-3.8-flash），两次都是换一个不同的模型立刻就通。跟
      // isQuotaExhausted 分开设一个旗标，呼叫方（下面的 postJsonWithModel
      // Fallback_）只在这个旗标为真时才考虑换模型重打；429 额度用完换模型
      // 有没有用尚未证实，不在这里混为一谈。
      if (code === 503) lastError.isCapacityIssue = true;
      const isRetryable = code === 429 || code >= 500;
      if (!isRetryable || attempt === maxAttempts) {
        throw lastError;
      }
      const suggestedDelaySeconds = code === 429 ? parseRetryDelaySeconds_(text) : null;
      const rawDelayMs = suggestedDelaySeconds != null
        ? suggestedDelaySeconds * 1000 + 500 // +500ms 缓冲，避免卡在窗口边界又撞一次
        : 1000 * Math.pow(2, attempt - 1); // 没有建议秒数时的原有 1s/2s/4s
      const delayMs = Math.min(rawDelayMs, maxSingleRetrySleepMs);
      if (totalSleptMs + delayMs > maxTotalRetrySleepMs) {
        // 2026-09-29 修正可读性缺陷（真实 Cloud logs 发现）：原本把这句中文
        // 直接接在 lastError.message 后面——lastError.message 本身已经是
        // 「HTTP 429：」加上被 slice(0,500) 截断到一半的原始 JSON，两段直接
        // 黏在一起，读起来像是接在 JSON 结构中间的乱码（例如
        // `"status": "RESOURCE_EXHAUSTED",\n    "（已累计等待 9 秒...）"`）。
        // 改成中文说明放最前面、自成一句，原始错误文字放冒号后面，读的时候
        // 一眼就知道两段是分开的。isQuotaExhausted 沿用上面已经判断过的值
        // （503 走的是 exponential backoff，1s/2s/4s，在 BATCH_RETRY_BUDGET_
        // 的单次 8 秒上限下也可能撞到这里——2026-10-02 起不能再假设只有 429
        // 会落到这个分支）。
        const capped = new Error(`重试已达累计等待上限（已睡 ${Math.round(totalSleptMs / 1000)} 秒，再等会逼近 GAS 单次执行上限）——不再重试，最后一次错误：${lastError.message}`);
        capped.isQuotaExhausted = lastError.isQuotaExhausted === true;
        capped.isCapacityIssue = lastError.isCapacityIssue === true;
        throw capped;
      }
      io.sleep(delayMs);
      totalSleptMs += delayMs;
    }
    throw lastError;
  };
}

/** 真的调 DriveApp/UrlFetchApp/Utilities 的那一层——只能在真实 GAS 环境跑，Node 测不了。 */
function realLLMExtractorDeps_(now, retryBudget) {
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
      // 重试策略本身（含 429 依 Gemini 回报的秒数等待、累计等待上限）在
      // createRetryingPostJson_ 里，Node 用假的 fetch/sleep 测过；这里只接真的
      // UrlFetchApp / Utilities.sleep，没有别的逻辑。retryBudget 没给就是
      // undefined，createRetryingPostJson_ 自己会退回模组层级的默认值。
      postJson: createRetryingPostJson_({
        fetch: (url, options) => UrlFetchApp.fetch(url, options),
        sleep: (ms) => Utilities.sleep(ms)
      }, retryBudget)
    },
    now: now || new Date()
  };
}

/**
 * GAS 环境下真正会用到的入口——从 Script Properties 读设定，组出真的
 * LLMExtractor。Script Properties 没设好会直接抛错（CMP-P10：不猜）。
 *
 * 2026-10-02 新增 profile 参数（真实 GAS 触发：consoleBatchImport 2026-10-01
 * 20:25-20:31 被 GAS 平台硬杀，见 SINGLE_RETRY_BUDGET_/BATCH_RETRY_BUDGET_
 * 上方的完整说明）：
 * - 'single'（预设，不传就是这个）：170 的 lazyOrderExtractor_ 用——完整的
 *   三层模型链（config.modelChain）+ 耐心的 SINGLE_RETRY_BUDGET_。
 * - 'batch'：112 的 lazyLLMExtractor_ 用——只用主模型（不换模型，
 *   modelChain 收窄成只有一个元素）+ 收紧的 BATCH_RETRY_BUDGET_。
 * @param {('single'|'batch')} [profile] 预设 'single'
 * @return {{extract: function(Object): Object, extractOrders: function(Object, ?Object): Object}}
 */
function realLLMExtractor_(profile) {
  const isBatch = profile === 'batch';
  const config = resolveLLMExtractorConfig_(PropertiesService.getScriptProperties());
  if (isBatch) {
    // 批次汇入情境：不换模型，见 BATCH_RETRY_BUDGET_ 上方说明——高峰期没
    // 算力就让这一份文件快速失败，不要为了换模型拖长单一文件的处理时间。
    config.modelChain = [config.model];
  }
  // ⚠️ 部署这版之前先确认 Script Properties：如果 LLM_EXTRACTOR_MODEL 还设成
  // 'gemini-3.5-flash'（2026-09-27 除错记录里看到的值），这里会照旧读到
  // 3.5-flash，不会自动变成 3.8-flash。要用 3.8-flash：把该 key 的值改成
  // gemini-3.8-flash，或整个删掉这个 key。
  return createLLMExtractor_(config, realLLMExtractorDeps_(undefined, isBatch ? BATCH_RETRY_BUDGET_ : SINGLE_RETRY_BUDGET_));
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
    parseRetryDelaySeconds_,
    createRetryingPostJson_,
    postJsonWithModelFallback_,
    SINGLE_RETRY_BUDGET_,
    BATCH_RETRY_BUDGET_,
    DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_,
    DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_,
    MAX_SINGLE_RETRY_SLEEP_MS_,
    MAX_TOTAL_RETRY_SLEEP_MS_,
    DEFAULT_LLM_EXTRACTOR_MODEL_,
    resolveLLMExtractorConfig_,
    createLLMExtractor_,
    realLLMExtractorDeps_,
    realLLMExtractor_
  };
}
