/**
 * 128_Tests_LLMExtractor.js
 * 纯逻辑 + 假 deps 两层：request/response 的组装跟解析完全不碰网络，Node
 * 测得到；createLLMExtractor_ 用假的 driveService/httpClient 测编排逻辑
 * （证据一定要写、就算解析失败也要写）。真的打 Gemini API 那一行
 * （realLLMExtractorDeps_ 里的 UrlFetchApp.fetch）只能在真实 GAS 验证，
 * 见文件最后的人工清单。
 */

if (typeof require === 'function') {
  var {
    LLM_EXTRACTION_SCHEMA_, buildGeminiRequestBody_, parseGeminiResponse_,
    buildEvidenceRecord_, createLLMExtractor_,
    BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_, buildButiranTempahanPrompt_, buildGeminiOrderExtractionRequestBody_,
    parseRetryDelaySeconds_, resolveLLMExtractorConfig_, DEFAULT_LLM_EXTRACTOR_MODEL_,
    createRetryingPostJson_, MAX_SINGLE_RETRY_SLEEP_MS_, MAX_TOTAL_RETRY_SLEEP_MS_,
    SINGLE_RETRY_BUDGET_, BATCH_RETRY_BUDGET_,
    postJsonWithModelFallback_, DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_, DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_,
    // 2026-10-11 Phase N：执行级调用预算
    createExecutionBudget_, createBudgetExhaustedError_, realLLMExtractor_,
    EXECUTION_HARD_LIMIT_MS_, EXECUTION_RESERVE_MS_, EXECUTION_MIN_CALL_ESTIMATE_MS_, EXECUTION_MAX_FETCHES_
  } = require('./127_LLMExtractor.js');
  var { assertEqual_ } = require('./105_TestUtils.js');
}

function fakeDriveService_(fileBytes) {
  const written = [];
  return {
    getFileBytes() { return fileBytes || 'fake-pdf-bytes'; },
    bytesToBase64(bytes) { return `base64(${bytes})`; },
    writeJsonFile(folderId, fileName, obj) {
      const id = `evidence-${written.length + 1}`;
      written.push({ id, folderId, fileName, obj });
      return id;
    },
    _written: written
  };
}

function fakeHttpClient_(responseBody, throwErr) {
  const calls = [];
  return {
    postJson(url, headers, body) {
      calls.push({ url, headers, body });
      if (throwErr) throw throwErr;
      return responseBody;
    },
    _calls: calls
  };
}

/** 依 URL 里的模型名字回传/丢出不同结果的假 httpClient，专门给「切模型」测试用。 */
function fakeHttpClientPerModel_(responsesByModel) {
  const calls = [];
  return {
    postJson(url, headers, body) {
      const m = url.match(/\/models\/([^:]+):generateContent/);
      const modelName = m ? m[1] : '?';
      calls.push({ url, modelName, body });
      const r = responsesByModel[modelName];
      if (r === undefined) throw new Error(`fakeHttpClientPerModel_: 没有替 ${modelName} 准备回应`);
      if (r instanceof Error) throw r;
      return r;
    },
    _calls: calls
  };
}
function capacityError_(msg) {
  const e = new Error(msg || 'LLM API 回传 HTTP 503：{"error":{"code":503,"status":"UNAVAILABLE"}}');
  e.isCapacityIssue = true;
  return e;
}

function fakeGeminiSuccessResponse_(candidateObj) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: { role: 'model', parts: [{ text: JSON.stringify(candidateObj) }] }
      }
    ]
  };
}

/**
 * 2026-09-28 新增：Gemini responseSchema 的形状检查。2026-09-27 真实 GAS 撞到
 * printed_daily_subtotal 的 type: ['number','null']——Gemini 的 Schema.type 是
 * 单一 enum，写成阵列会在到达模型推理之前就被 API 以 HTTP 400 拒绝，每次呼叫
 * 都失败，跟模型、额度都无关；而且 Node 测试完全看不到（原本没有任何东西检查
 * schema 本身长什么样）。这里只检查「已经在真实环境证实会炸」的规则，加上纯结构
 * 一致性（required 的欄位真的存在、array 有 items），不去猜 Gemini 其他没被
 * 证实的限制。
 * @return {string[]} 违规描述；空阵列代表没问题
 */
function lintGeminiResponseSchema_(node, path, problems) {
  const here = path || 'schema';
  const errs = problems || [];
  if (node === null || typeof node !== 'object') { errs.push(`${here}: 不是物件`); return errs; }
  if (typeof node.type !== 'string') {
    errs.push(`${here}.type 必须是单一字符串（真实撞过：type: ['number','null'] 会被 Gemini 以 HTTP 400 拒绝，要允许 null 请用 nullable: true），现在是 ${JSON.stringify(node.type)}`);
  } else if (['object', 'array', 'string', 'number', 'integer', 'boolean'].indexOf(node.type) === -1) {
    errs.push(`${here}.type=${node.type} 不是已知的 schema type`);
  }
  if ('nullable' in node && typeof node.nullable !== 'boolean') errs.push(`${here}.nullable 必须是 boolean`);
  if (node.type === 'object') {
    const props = node.properties || {};
    Object.keys(props).forEach((k) => lintGeminiResponseSchema_(props[k], `${here}.properties.${k}`, errs));
    (node.required || []).forEach((r) => { if (!(r in props)) errs.push(`${here}.required 里的 "${r}" 不在 properties 里`); });
  }
  if (node.type === 'array') {
    if (!node.items) errs.push(`${here}: type=array 必须有 items`);
    else lintGeminiResponseSchema_(node.items, `${here}.items`, errs);
  }
  return errs;
}

/** 假的 UrlFetchApp/Utilities.sleep：依序回传预设的 HTTP 回应，记录每次 fetch 跟每次 sleep。 */
function fakeHttpIo_(responses) {
  const calls = [];
  const sleeps = [];
  let i = 0;
  return {
    calls, sleeps,
    fetch(url, options) {
      calls.push({ url, options });
      const r = responses[Math.min(i, responses.length - 1)];
      i++;
      return { getResponseCode() { return r.code; }, getContentText() { return r.text; } };
    },
    sleep(ms) { sleeps.push(ms); }
  };
}
function quota429Body_(retryDelay) {
  return JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] } });
}
function tryPost_(postJson) {
  try { return { value: postJson('https://example.test/x', { 'Content-Type': 'application/json' }, { a: 1 }) }; }
  catch (e) { return { error: e.message, errorObj: e }; }
}

function fakeScriptProps_(map) {
  return { getProperty(key) { return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null; } };
}

// ---- 2026-10-11 Phase N 测试用 helper（名字带 PhaseN128 是因为 GAS 是单一全局作用域，
// 不同测试文件的同名 function 会静默互相覆盖；刻意避开泛用名字）----
/** 假时钟：fetch 的耗时跟睡眠都推进它；预算的 now 就接这个，测试不用真的等。 */
function fakeClockPhaseN128_(startMs) {
  const c = { t: startMs || 0 };
  c.now = function () { return c.t; };
  return c;
}
/**
 * 跟 fakeHttpIo_ 一样依序回传预设回应，但 fetch 要花 latencyMs（数字或函数 (idx, response) => ms）、
 * 睡眠也推进同一个假时钟，并按顺序记下 'fetch'/'sleep' 事件——用来验证「不白睡」（最后一个事件
 * 不会是 sleep）。response.throws 会让 fetch 抛例外（模拟 UrlFetchApp 的网络例外）。
 */
function timedIoPhaseN128_(clock, responses, latencyMs) {
  const calls = [];
  const sleeps = [];
  const events = [];
  let i = 0;
  return {
    calls, sleeps, events,
    fetch() {
      const idx = i++;
      const r = typeof responses === 'function' ? responses(idx) : responses[Math.min(idx, responses.length - 1)];
      calls.push({ idx, startMs: clock.t, code: r.code });
      events.push('fetch');
      clock.t += typeof latencyMs === 'function' ? latencyMs(idx, r) : (latencyMs || 0);
      if (r.throws) throw new Error(r.throws);
      return { getResponseCode() { return r.code; }, getContentText() { return r.text; } };
    },
    sleep(ms) { sleeps.push(ms); events.push('sleep'); clock.t += ms; }
  };
}

function runAllLLMExtractorTests() {
  const results = [];

  // ============ buildGeminiRequestBody_：纯函数 ============
  const reqBody = buildGeminiRequestBody_('BASE64DATA', { source: 'Grab', documentType: 'Weekly Statement' });
  assertEqual_('request body 带 inline_data.mime_type=application/pdf', reqBody.contents[0].parts[0].inline_data.mime_type, 'application/pdf', results);
  assertEqual_('request body 带 base64 data', reqBody.contents[0].parts[0].inline_data.data, 'BASE64DATA', results);
  assertEqual_('request body 有 text part（prompt）', typeof reqBody.contents[0].parts[1].text, 'string', results);
  assertEqual_('request body responseMimeType 是 application/json', reqBody.generationConfig.responseMimeType, 'application/json', results);
  assertEqual_('request body 带上 schema', reqBody.generationConfig.responseSchema, LLM_EXTRACTION_SCHEMA_, results);

  // ============ parseGeminiResponse_：纯函数 ============
  const goodCandidate = { document_meta: { source: 'Grab' }, summary: {}, income_breakdown: {}, extraction_notes: '' };
  const parsed = parseGeminiResponse_(fakeGeminiSuccessResponse_(goodCandidate));
  assertEqual_('正常 response：解出 candidate', parsed.candidate, goodCandidate, results);
  assertEqual_('正常 response：finishReason 是 STOP', parsed.finishReason, 'STOP', results);

  let noCandidatesThrew = false;
  try { parseGeminiResponse_({ candidates: [] }); } catch (err) { noCandidatesThrew = true; }
  assertEqual_('candidates 是空阵列：抛错', noCandidatesThrew, true, results);

  let notStopThrew = false;
  try {
    parseGeminiResponse_({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: '{}' }] } }] });
  } catch (err) { notStopThrew = true; }
  assertEqual_('finishReason 不是 STOP（例如 SAFETY）：抛错，不採用这次输出', notStopThrew, true, results);

  let malformedJsonThrew = false;
  const malformedResponse = {
    candidates: [
      { finishReason: 'STOP', content: { parts: [{ text: 'not valid json{{{' }] } }
    ]
  };
  try {
    parseGeminiResponse_(malformedResponse);
  } catch (err) { malformedJsonThrew = true; }
  assertEqual_('text 不是合法 JSON：抛错', malformedJsonThrew, true, results);

  // ============ buildEvidenceRecord_：纯函数 ============
  const evidence = buildEvidenceRecord_({
    documentId: 'CMP-DOC-1', driveFileId: 'file-1', extractorId: 'LLMExtractor:test-model',
    extractionVersion: '2026-08-21T00:00:00.000Z', finishReason: 'STOP', prompt: 'p', candidate: goodCandidate, rawResponse: { a: 1 }
  });
  assertEqual_('证据记录带 document_id', evidence.document_id, 'CMP-DOC-1', results);
  assertEqual_('证据记录带 raw_candidate', evidence.raw_candidate, goodCandidate, results);
  assertEqual_('证据记录带 raw_response（原始 provider 回传，不是只留最终金额）', evidence.raw_response, { a: 1 }, results);

  // ============ createLLMExtractor_：编排（假 driveService/httpClient） ============
  const drive1 = fakeDriveService_('pdf-bytes-1');
  const http1 = fakeHttpClient_(fakeGeminiSuccessResponse_(goodCandidate));
  const extractor1 = createLLMExtractor_(
    { apiKey: 'k', model: 'gemini-3.7-flash', evidenceFolderId: 'folder-1' },
    { driveService: drive1, httpClient: http1, now: new Date('2026-08-21T10:00:00.000Z') }
  );
  const extractResult1 = extractor1.extract({ fileId: 'file-1', documentId: 'CMP-DOC-1' });
  assertEqual_('extract() 回传 mode=structured', extractResult1.mode, 'structured', results);
  assertEqual_('extract() 回传的 candidate 就是 provider 给的那份', extractResult1.candidate, goodCandidate, results);
  assertEqual_('extract() evidence 带 extractorId', extractResult1.evidence.extractorId, 'LLMExtractor:gemini-3.7-flash', results);
  assertEqual_('extract() 成功时也写了一份证据档', drive1._written.length, 1, results);
  assertEqual_('证据档名带 document_id', drive1._written[0].fileName.indexOf('CMP-DOC-1') === 0, true, results);

  // 证据一定要写——就算 parseGeminiResponse_ 在里面抛错（例如 finishReason 不是
  // STOP），也不能让这次尝试完全无迹可寻，这是要求 #6 最容易漏掉的一半
  const drive2 = fakeDriveService_('pdf-bytes-2');
  const http2 = fakeHttpClient_({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: '{}' }] } }] });
  const extractor2 = createLLMExtractor_(
    { apiKey: 'k', model: 'gemini-3.7-flash', evidenceFolderId: 'folder-1' },
    { driveService: drive2, httpClient: http2, now: new Date('2026-08-21T10:00:00.000Z') }
  );
  let extract2Threw = false;
  try {
    extractor2.extract({ fileId: 'file-2', documentId: 'CMP-DOC-2' });
  } catch (err) {
    extract2Threw = true;
  }
  assertEqual_('finishReason=SAFETY：extract() 本身会抛错', extract2Threw, true, results);
  assertEqual_('finishReason=SAFETY：即使抛错，证据档还是写了（raw_response 保留、candidate 是 null）', drive2._written.length, 1, results);
  assertEqual_('抛错情况下证据档的 raw_candidate 是 null（没有解析出来）', drive2._written[0].obj.raw_candidate, null, results);

  // ============ 缺设定：明确抛错，不猜 ============
  let missingApiKeyThrew = false;
  try { createLLMExtractor_({ evidenceFolderId: 'x' }, {}); } catch (err) { missingApiKeyThrew = true; }
  assertEqual_('缺 apiKey：createLLMExtractor_ 直接抛错', missingApiKeyThrew, true, results);

  let missingFolderThrew = false;
  try { createLLMExtractor_({ apiKey: 'k' }, {}); } catch (err) { missingFolderThrew = true; }
  assertEqual_('缺 evidenceFolderId：createLLMExtractor_ 直接抛错', missingFolderThrew, true, results);

  // ============ Butiran Tempahan order extraction —— Phase 4，2026-08-25 ============
  const orderReqBodyFull = buildGeminiOrderExtractionRequestBody_('BASE64DATA', null);
  assertEqual_('order extraction request body：整份文件模式带 inline_data', orderReqBodyFull.contents[0].parts[0].inline_data.mime_type, 'application/pdf', results);
  assertEqual_('order extraction request body：用的是 Butiran Tempahan schema，不是 statement schema', orderReqBodyFull.generationConfig.responseSchema, BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_, results);
  assertEqual_('order extraction request body：整份文件模式 prompt 里没有页码限定文字', orderReqBodyFull.contents[0].parts[1].text.indexOf('这次只需要处理第') === -1, true, results);

  const orderReqBodyChunk = buildGeminiOrderExtractionRequestBody_('BASE64DATA', { firstPage: 7, lastPage: 14 });
  assertEqual_('order extraction request body：chunk 模式 prompt 里明确写出页码范围', orderReqBodyChunk.contents[0].parts[1].text.indexOf('第 7 页到第 14 页') !== -1, true, results);

  const promptText = buildButiranTempahanPrompt_(null);
  ['不要计算', '不要自己猜测', 'Sekaligus', 'and N', 'low_confidence'].forEach((mustContain) => {
    assertEqual_(`prompt 明确包含 Steven 要求的用语：「${mustContain}」`, promptText.indexOf(mustContain) !== -1, true, results);
  });

  function fakeGeminiOrderSuccessResponse_(candidateObj) {
    return { candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(candidateObj) }] } }] };
  }
  const sampleOrderCandidate = {
    extraction_scope: { first_page_seen: 7, last_page_seen: 9 },
    days: [{ weekday_name: 'Ahad', day: 4, month_name: 'Januari', day_block_complete: true, printed_daily_subtotal: 5.50,
      orders: [{ order_row_type: 'Tunggal', platform_raw: 'GrabFood', order_ids_raw: ['A-8QLIOUFWWKVDAV'], and_more_count: 0, payment_method_raw: 'Tanpa tunai', base_income: 4.10, other_income: 1.40, income_adjustment: 0, net_income: 5.50, source_page: 7, low_confidence: false }] }],
    notes: ''
  };
  const orderExtractorDeps = { driveService: fakeDriveService_(), httpClient: fakeHttpClient_(fakeGeminiOrderSuccessResponse_(sampleOrderCandidate)), now: new Date('2026-08-25T00:00:00Z') };
  const orderExtractor = createLLMExtractor_({ apiKey: 'k', evidenceFolderId: 'folder-1' }, orderExtractorDeps);
  const orderResult = orderExtractor.extractOrders({ fileId: 'file-1', documentId: 'doc-1' }, null);
  assertEqual_('extractOrders 整份文件模式：拿到 candidate', orderResult.candidate, sampleOrderCandidate, results);
  assertEqual_('extractOrders：evidence extractorId 标了 "orders:full"，跟 statement 层级的 extractorId 不会混淆', orderResult.evidence.extractorId.indexOf('orders:full') !== -1, true, results);
  assertEqual_('extractOrders：证据文件真的写了（跟 extract() 用同一套证据机制）', orderExtractorDeps.driveService._written.length, 1, results);

  const chunkExtractor = createLLMExtractor_({ apiKey: 'k', evidenceFolderId: 'folder-1' }, { driveService: fakeDriveService_(), httpClient: fakeHttpClient_(fakeGeminiOrderSuccessResponse_(sampleOrderCandidate)), now: new Date('2026-08-25T00:00:00Z') });
  const chunkResult = chunkExtractor.extractOrders({ fileId: 'file-1', documentId: 'doc-1' }, { firstPage: 1, lastPage: 12 });
  assertEqual_('extractOrders：chunk 模式 evidence 标出实际用的页码范围', chunkResult.evidence.pageRange, { firstPage: 1, lastPage: 12 }, results);
  assertEqual_('extractOrders：chunk 模式 extractorId 带页码范围，方便事后从证据文件分辨这是哪一次呼叫', chunkResult.evidence.extractorId.indexOf('p1-12') !== -1, true, results);

  // ============ 2026-09-28 加固：schema 形状检查（Node 就能抓到「Gemini 会直接 HTTP 400」这类错）============
  assertEqual_('schema lint·statement 层级 schema 没有违规', lintGeminiResponseSchema_(LLM_EXTRACTION_SCHEMA_), [], results);
  assertEqual_('schema lint·Butiran Tempahan 订单层级 schema 没有违规', lintGeminiResponseSchema_(BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_), [], results);
  const badSchema = { type: 'object', properties: { printed_daily_subtotal: { type: ['number', 'null'] } }, required: ['printed_daily_subtotal', 'missing_field'] };
  const badProblems = lintGeminiResponseSchema_(badSchema);
  assertEqual_('schema lint·真的抓得到 2026-09-27 那个 bug（type 用阵列）', badProblems.some((p) => p.indexOf('printed_daily_subtotal.type') !== -1), true, results);
  assertEqual_('schema lint·也抓得到 required 指到不存在的欄位', badProblems.some((p) => p.indexOf('missing_field') !== -1), true, results);
  const dayItems = BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_.properties.days.items;
  assertEqual_('printed_daily_subtotal 是单一 type + nullable: true（不能退回阵列写法），而且仍是 required', { type: dayItems.properties.printed_daily_subtotal.type, nullable: dayItems.properties.printed_daily_subtotal.nullable, required: dayItems.required.indexOf('printed_daily_subtotal') !== -1 }, { type: 'number', nullable: true, required: true }, results);

  // ============ parseRetryDelaySeconds_：429 的建议等待秒数 ============
  const quota429Structured = JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure' }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '52s' }] } });
  assertEqual_('parseRetryDelaySeconds_·读结构化 RetryInfo.retryDelay', parseRetryDelaySeconds_(quota429Structured), 52, results);
  assertEqual_('parseRetryDelaySeconds_·retryDelay 带小数秒', parseRetryDelaySeconds_(JSON.stringify({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '1.218196528s' }] } })), 1.218196528, results);
  assertEqual_('parseRetryDelaySeconds_·没有 RetryInfo 时退回 message 里的 "Please retry in Xs."（2026-09-27 真实撞过的写法）', parseRetryDelaySeconds_(JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota.\nPlease retry in 52.712601335s.', status: 'RESOURCE_EXHAUSTED' } })), 52.712601335, results);
  assertEqual_('parseRetryDelaySeconds_·503 容量错误没有等待秒数 → null（呼叫方退回 exponential backoff）', parseRetryDelaySeconds_(JSON.stringify({ error: { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' } })), null, results);
  assertEqual_('parseRetryDelaySeconds_·不是合法 JSON → null，不抛错', parseRetryDelaySeconds_('<html>Bad Gateway</html>'), null, results);
  assertEqual_('parseRetryDelaySeconds_·空字符串/undefined/字面 null → null，不抛错', [parseRetryDelaySeconds_(''), parseRetryDelaySeconds_(undefined), parseRetryDelaySeconds_('null')], [null, null, null], results);

  // ============ createRetryingPostJson_：重试策略（原本躲在 GAS-only 的函数里，Node 测不到）============
  const ioOk = fakeHttpIo_([{ code: 200, text: '{"ok":true}' }]);
  const okResult = tryPost_(createRetryingPostJson_(ioOk));
  assertEqual_('postJson·2xx 直接回传解析后的 JSON，不睡、只打一次', [okResult.value, ioOk.calls.length, ioOk.sleeps], [{ ok: true }, 1, []], results);

  // ---- 2026-10-02 新增：retryBudget 覆盖值（BATCH_RETRY_BUDGET_ 修 consoleBatchImport 2026-10-01 真实被硬杀的问题）----
  const ioTightBudget429 = fakeHttpIo_([{ code: 429, text: quota429Body_('52s') }, { code: 200, text: '{"ok":1}' }]);
  tryPost_(createRetryingPostJson_(ioTightBudget429, { maxSingleRetrySleepMs: 5000, maxTotalRetrySleepMs: 5000 }));
  assertEqual_('postJson·带 retryBudget 覆盖值：Gemini 建议等 52 秒，但收紧成单次/累计都只有 5 秒 → 真的只睡 5 秒，不是 52.5 秒（批次汇入情境用，不能沿用单笔执行的耐心预算）', ioTightBudget429.sleeps, [5000], results);
  const ioDefaultBudget429 = fakeHttpIo_([{ code: 429, text: quota429Body_('52s') }, { code: 200, text: '{"ok":1}' }]);
  tryPost_(createRetryingPostJson_(ioDefaultBudget429)); // 不传 retryBudget
  assertEqual_('postJson·不传 retryBudget（既有呼叫方的既有行为）→ 照旧用模组层级默认值，睡 52.5 秒，不受这次新增参数影响', ioDefaultBudget429.sleeps, [52500], results);
  assertEqual_('SINGLE_RETRY_BUDGET_/BATCH_RETRY_BUDGET_·批次情境的预算明确比单笔情境收紧（consoleBatchImport 一次要分给很多份文件，consoleRunDailyAllocation 一次只处理一笔，整个 6 分钟都是它的）', BATCH_RETRY_BUDGET_.maxTotalRetrySleepMs < SINGLE_RETRY_BUDGET_.maxTotalRetrySleepMs, true, results);
  assertEqual_('postJson·送给 fetch 的选项跟原本一致（post/json/headers/payload/muteHttpExceptions）', ioOk.calls[0].options, { method: 'post', contentType: 'application/json', headers: { 'Content-Type': 'application/json' }, payload: '{"a":1}', muteHttpExceptions: true }, results);

  const io429 = fakeHttpIo_([{ code: 429, text: quota429Body_('52s') }, { code: 200, text: '{"ok":1}' }]);
  const r429 = tryPost_(createRetryingPostJson_(io429));
  assertEqual_('postJson·429 带 retryDelay=52s → 等 52.5 秒（不是原本的 1 秒）再重试，然后成功', [r429.value, io429.sleeps], [{ ok: 1 }, [52500]], results);

  const io429Frac = fakeHttpIo_([{ code: 429, text: quota429Body_('1.2s') }, { code: 200, text: '{"ok":1}' }]);
  tryPost_(createRetryingPostJson_(io429Frac));
  assertEqual_('postJson·retryDelay=1.2s → 等 1.7 秒', io429Frac.sleeps, [1700], results);

  const io503 = fakeHttpIo_([{ code: 503, text: '{"error":{"code":503,"status":"UNAVAILABLE"}}' }, { code: 503, text: '{}' }, { code: 200, text: '{"ok":2}' }]);
  const r503 = tryPost_(createRetryingPostJson_(io503));
  assertEqual_('postJson·503 沿用原本的 exponential backoff（1s、2s），然后成功', [r503.value, io503.sleeps], [{ ok: 2 }, [1000, 2000]], results);

  // ============ isQuotaExhausted 旗标（2026-09-29，供 142 的 fallback 编排判断要不要跳过 chunk）============
  const io429Exhausted = fakeHttpIo_([{ code: 429, text: quota429Body_('1s') }, { code: 429, text: quota429Body_('1s') }, { code: 429, text: quota429Body_('1s') }, { code: 429, text: quota429Body_('1s') }]);
  const r429Exhausted = tryPost_(createRetryingPostJson_(io429Exhausted));
  assertEqual_('isQuotaExhausted·自然用完 4 次 attempts、最后一次还是 429 → 旗标为 true', !!(r429Exhausted.errorObj && r429Exhausted.errorObj.isQuotaExhausted), true, results);

  const io429Capped = fakeHttpIo_([{ code: 429, text: quota429Body_('52s') }]);
  const r429Capped = tryPost_(createRetryingPostJson_(io429Capped));
  assertEqual_('isQuotaExhausted·撞到累计等待上限而放弃 → 旗标也是 true（不是只有自然用完次数才算）', !!(r429Capped.errorObj && r429Capped.errorObj.isQuotaExhausted), true, results);
  assertEqual_('isQuotaExhausted·撞到累计上限的错误讯息把中文说明放最前面、自成一句，不是接在被截断的原始 JSON 后面（可读性修复）', /^重试已达累计等待上限/.test(r429Capped.error), true, results);

  const io503Exhausted = fakeHttpIo_([{ code: 503, text: '{}' }, { code: 503, text: '{}' }, { code: 503, text: '{}' }, { code: 503, text: '{}' }]);
  const r503Exhausted = tryPost_(createRetryingPostJson_(io503Exhausted));
  assertEqual_('isQuotaExhausted·503（容量问题，不是额度）用完重试 → 旗标不是 true（503 不代表 quota，chunking 换个 range 打说不定真的有机会）', !!(r503Exhausted.errorObj && r503Exhausted.errorObj.isQuotaExhausted), false, results);

  const io400b = fakeHttpIo_([{ code: 400, text: '{}' }]);
  const r400b = tryPost_(createRetryingPostJson_(io400b));
  assertEqual_('isQuotaExhausted·400（请求本身有问题）不重试、旗标也不是 true', !!(r400b.errorObj && r400b.errorObj.isQuotaExhausted), false, results);

  const io429NoHint = fakeHttpIo_([{ code: 429, text: 'not json' }]);

  const r429NoHint = tryPost_(createRetryingPostJson_(io429NoHint));
  assertEqual_('postJson·429 但读不到建议秒数 → 退回 1s/2s/4s，最后一次失败照旧抛出 HTTP 429（总共打 4 次）', [io429NoHint.sleeps, io429NoHint.calls.length, /HTTP 429/.test(r429NoHint.error)], [[1000, 2000, 4000], 4, true], results);

  const io400 = fakeHttpIo_([{ code: 400, text: '{"error":{"code":400,"message":"Invalid JSON payload"}}' }]);
  const r400 = tryPost_(createRetryingPostJson_(io400));
  assertEqual_('postJson·400（请求本身有问题）不重试、不睡，直接抛错', [io400.calls.length, io400.sleeps, /HTTP 400/.test(r400.error)], [1, [], true], results);

  const ioHuge = fakeHttpIo_([{ code: 429, text: quota429Body_('300s') }]);
  const rHuge = tryPost_(createRetryingPostJson_(ioHuge));
  assertEqual_('postJson·建议等 300 秒也只睡单次上限，累计超过总上限就不再重试（保护 GAS 6 分钟上限）', [ioHuge.sleeps, ioHuge.calls.length, /HTTP 429/.test(rHuge.error), /不再重试/.test(rHuge.error)], [[MAX_SINGLE_RETRY_SLEEP_MS_], 2, true, true], results);
  assertEqual_('postJson·单次上限小于累计上限（否则累计上限永远碰不到、形同虚设）', MAX_SINGLE_RETRY_SLEEP_MS_ <= MAX_TOTAL_RETRY_SLEEP_MS_, true, results);

  const ioWorst = fakeHttpIo_([{ code: 429, text: quota429Body_('52s') }]);
  tryPost_(createRetryingPostJson_(ioWorst));
  assertEqual_('postJson·每次都 429 的最坏情况：一次 postJson 累计睡眠不超过总上限', ioWorst.sleeps.reduce((a, b) => a + b, 0) <= MAX_TOTAL_RETRY_SLEEP_MS_, true, results);

  // ============ postJsonWithModelFallback_（2026-10-01 两层，2026-10-02 扩成任意长度的模型链）============
  const httpFallbackOk = fakeHttpClientPerModel_({ 'gemini-3.8-flash': capacityError_(), 'gemini-3.5-flash': { ok: 'from-fallback' } });
  const fbOk = postJsonWithModelFallback_(['gemini-3.8-flash', 'gemini-3.5-flash'], 'key1', httpFallbackOk, { q: 1 });
  assertEqual_('postJsonWithModelFallback_·主模型 503 → 换第二个模型成功，回传 modelUsed=第二个', { rawResponse: fbOk.rawResponse, modelUsed: fbOk.modelUsed, attemptedCount: fbOk.attemptedModelErrors.length }, { rawResponse: { ok: 'from-fallback' }, modelUsed: 'gemini-3.5-flash', attemptedCount: 1 }, results);
  assertEqual_('postJsonWithModelFallback_·两次呼叫送的是同一个 requestBody（换模型不用换 schema/prompt）', httpFallbackOk._calls.map((c) => c.body), [{ q: 1 }, { q: 1 }], results);

  // ---- 2026-10-02 新增：三层都设定，前两层都 503、第三层才成功 ----
  const httpThreeTier = fakeHttpClientPerModel_({ 'gemini-3.8-flash': capacityError_('tier1 down'), 'gemini-3.6-flash': capacityError_('tier2 down'), 'gemini-3.5-flash': { ok: 'from-tier3' } });
  const fbTier3 = postJsonWithModelFallback_(['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'], 'key1', httpThreeTier, { q: 1 });
  assertEqual_('postJsonWithModelFallback_·三层模型链：前两层都 503，第三层成功 → modelUsed 是第三层，三个模型都真的打过', { rawResponse: fbTier3.rawResponse, modelUsed: fbTier3.modelUsed, calls: httpThreeTier._calls.map((c) => c.modelName) }, { rawResponse: { ok: 'from-tier3' }, modelUsed: 'gemini-3.5-flash', calls: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'] }, results);
  assertEqual_('postJsonWithModelFallback_·三层都试过：allModelsCapacityExhausted 不适用于"成功"的情况（这个旗标只在全部失败时才有意义），attemptedModelErrors 记了前两层各自的失败', fbTier3.attemptedModelErrors.map((a) => a.model), ['gemini-3.8-flash', 'gemini-3.6-flash'], results);

  const httpFallbackAlsoFails = fakeHttpClientPerModel_({ 'gemini-3.8-flash': capacityError_('primary down'), 'gemini-3.5-flash': capacityError_('fallback also down') });
  let fbBothFailErr = null;
  try { postJsonWithModelFallback_(['gemini-3.8-flash', 'gemini-3.5-flash'], 'key1', httpFallbackAlsoFails, {}); } catch (e) { fbBothFailErr = e; }
  assertEqual_('postJsonWithModelFallback_·两个模型都 503 → 抛出最后一个的例外，并附上更早那层的错误讯息（不是直接吞掉，方便回头查每一层各自的状况）', { thrown: !!fbBothFailErr, message: fbBothFailErr && fbBothFailErr.message, primaryModelError: fbBothFailErr && fbBothFailErr.primaryModelError }, { thrown: true, message: 'fallback also down', primaryModelError: 'gemini-3.8-flash: primary down' }, results);
  assertEqual_('postJsonWithModelFallback_·全部模型都因为 503 失败 → allModelsCapacityExhausted=true（142 可以用这个判断「不是单一模型偶发，是全部候选模型当下都没算力」）', fbBothFailErr.allModelsCapacityExhausted, true, results);

  // ---- 2026-10-02 新增：三层都设定，但中途撞到非 503（429）→ 立刻停止，不会继续试第三层，allModelsCapacityExhausted 不该是 true ----
  const httpMixedFailure = fakeHttpClientPerModel_({ 'gemini-3.8-flash': capacityError_('tier1 down'), 'gemini-3.6-flash': (function () { const e = new Error('429 quota'); e.isQuotaExhausted = true; return e; })() });
  let mixedErr = null;
  try { postJsonWithModelFallback_(['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'], 'key1', httpMixedFailure, {}); } catch (e) { mixedErr = e; }
  assertEqual_('postJsonWithModelFallback_·第二层撞 429（不是 503）→ 立刻停止，完全不会去试第三层', { thrown: !!mixedErr, calls: httpMixedFailure._calls.map((c) => c.modelName) }, { thrown: true, calls: ['gemini-3.8-flash', 'gemini-3.6-flash'] }, results);
  assertEqual_('postJsonWithModelFallback_·混合失败原因（一个 503、一个 429）→ allModelsCapacityExhausted 是 false，不是全部都是容量问题', mixedErr.allModelsCapacityExhausted, false, results);

  const httpNoFallbackConfigured = fakeHttpClientPerModel_({ 'gemini-3.8-flash': capacityError_() });
  let noFbErr = null;
  try { postJsonWithModelFallback_(['gemini-3.8-flash'], 'key1', httpNoFallbackConfigured, {}); } catch (e) { noFbErr = e; }
  assertEqual_('postJsonWithModelFallback_·models 只有一个（没有设定任何 fallback）→ 直接把它的例外丢出去，完全不会多打一次', { thrown: !!noFbErr, calls: httpNoFallbackConfigured._calls.length }, { thrown: true, calls: 1 }, results);

  const httpQuota = fakeHttpClientPerModel_({ 'gemini-3.8-flash': (function () { const e = new Error('429'); e.isQuotaExhausted = true; return e; })() });
  let quotaErr = null;
  try { postJsonWithModelFallback_(['gemini-3.8-flash', 'gemini-3.5-flash'], 'key1', httpQuota, {}); } catch (e) { quotaErr = e; }
  assertEqual_('postJsonWithModelFallback_·429（isQuotaExhausted，不是 isCapacityIssue）→ 不切模型，直接丢出去（额度问题换模型有没有用未证实，这里不假设有用）', { thrown: !!quotaErr, calls: httpQuota._calls.length }, { thrown: true, calls: 1 }, results);

  const httpPlain400 = fakeHttpClientPerModel_({ 'gemini-3.8-flash': new Error('LLM API 回传 HTTP 400：Invalid JSON payload') });
  let plain400Err = null;
  try { postJsonWithModelFallback_(['gemini-3.8-flash', 'gemini-3.5-flash'], 'key1', httpPlain400, {}); } catch (e) { plain400Err = e; }
  assertEqual_('postJsonWithModelFallback_·400（请求本身有问题，没有 isCapacityIssue）→ 不切模型（换模型不会让 schema 错误变好）', { thrown: !!plain400Err, calls: httpPlain400._calls.length }, { thrown: true, calls: 1 }, results);

  // ---- createLLMExtractor_ 整合：主模型 503、有设定 fallback → extractOrders() 实际成功，用 fallback 的结果 ----
  const fallbackOrderCandidate = { extraction_scope: { first_page_seen: 1, last_page_seen: 2 }, days: [], notes: '' };
  const driveFb = fakeDriveService_();
  const httpFbExtractor = fakeHttpClientPerModel_({ 'gemini-3.8-flash': capacityError_(), 'gemini-3.5-flash': fakeGeminiSuccessResponse_(fallbackOrderCandidate) });
  const extractorWithFallback = createLLMExtractor_({ apiKey: 'k', model: 'gemini-3.8-flash', modelChain: ['gemini-3.8-flash', 'gemini-3.5-flash'], evidenceFolderId: 'folder-1' }, { driveService: driveFb, httpClient: httpFbExtractor, now: new Date('2026-10-01T00:00:00Z') });
  const fbExtractResult = extractorWithFallback.extractOrders({ fileId: 'f1', documentId: 'doc1' }, null);
  assertEqual_('createLLMExtractor_·主模型 503、有 fallback → extractOrders() 正常成功（呼叫方完全不用知道切换过模型）', fbExtractResult.candidate, fallbackOrderCandidate, results);
  assertEqual_('createLLMExtractor_·evidence.extractorId 反映真正成功的模型（gemini-3.5-flash），不是设定档里的主模型', fbExtractResult.evidence.extractorId, 'LLMExtractor:gemini-3.5-flash:orders:full', results);
  assertEqual_('createLLMExtractor_·写进 Drive 的证据档带 fallback_note，记录换模型的原因（方便真实 GAS 事后排查为什么用的不是主模型）', /gemini-3\.8-flash.*503.*gemini-3\.5-flash|主模型 gemini-3\.8-flash.*改用 gemini-3\.5-flash/.test(driveFb._written[0].obj.fallback_note || ''), true, results);

  // ---- 没设定 fallback 的既有情境：503 就正常失败，不受这次新增功能影响 ----
  const driveNoFb = fakeDriveService_();
  const httpNoFb = fakeHttpClientPerModel_({ 'gemini-3.8-flash': capacityError_() });
  const extractorNoFallback = createLLMExtractor_({ apiKey: 'k', model: 'gemini-3.8-flash', evidenceFolderId: 'folder-1' }, { driveService: driveNoFb, httpClient: httpNoFb, now: new Date('2026-10-01T00:00:00Z') });
  let noFbExtractErr = null;
  try { extractorNoFallback.extract({ fileId: 'f1', documentId: 'doc1' }); } catch (e) { noFbExtractErr = e; }
  assertEqual_('createLLMExtractor_·config 没给 fallbackModel（既有呼叫方的既有行为）→ 503 照样直接失败，不受这次新增功能影响', !!noFbExtractErr, true, results);

  // ============ resolveLLMExtractorConfig_ 的 fallbackModel/fallbackModel2/modelChain 解析（2026-10-02 扩成三层，Steven 明确要求）============
  const fbCfgDefault = resolveLLMExtractorConfig_(fakeScriptProps_({}));
  assertEqual_('resolve·三层都没设定 → 各自用默认值，modelChain 是三个默认值依序排列', { fallbackModel: fbCfgDefault.fallbackModel, fallbackModelSource: fbCfgDefault.fallbackModelSource, fallbackModel2: fbCfgDefault.fallbackModel2, fallbackModel2Source: fbCfgDefault.fallbackModel2Source, modelChain: fbCfgDefault.modelChain }, { fallbackModel: DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_, fallbackModelSource: 'default', fallbackModel2: DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_, fallbackModel2Source: 'default', modelChain: [DEFAULT_LLM_EXTRACTOR_MODEL_, DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_, DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_] }, results);
  assertEqual_('resolve·第三层默认值明确是 gemini-3.5-flash（Steven 2026-10-02 明确要求：前两个都失败还有第三个，没设定就用这个）', DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_, 'gemini-3.5-flash', results);
  assertEqual_('resolve·默认的 fallback/fallbackModel2 都明确不是 gemini-2.5-flash（2026-10-01 查证：2.5 系列已限制成只有先前真的用过的专案才能用，Google 官方建议新专案改用 3.5-flash 或 3.8-flash——这个专案从未真的呼叫过 2.5-flash，拿它当默认很可能直接连不上）', [DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_, DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_].indexOf('gemini-2.5-flash') !== -1, false, results);

  const fbCfgSet = resolveLLMExtractorConfig_(fakeScriptProps_({ LLM_EXTRACTOR_FALLBACK_MODEL: 'gemini-2.0-flash', LLM_EXTRACTOR_FALLBACK_MODEL_2: 'gemini-3.1-flash-lite' }));
  assertEqual_('resolve·fallbackModel/fallbackModel2 都有设定 → 各自用设定值（就算是已经下线的旧模型也不在这层拦——GAS 真的打下去才会知道，不在这里猜哪些模型还活着），modelChain 依序是三个设定值', { fallbackModel: fbCfgSet.fallbackModel, fallbackModelSource: fbCfgSet.fallbackModelSource, fallbackModel2: fbCfgSet.fallbackModel2, fallbackModel2Source: fbCfgSet.fallbackModel2Source, modelChain: fbCfgSet.modelChain }, { fallbackModel: 'gemini-2.0-flash', fallbackModelSource: 'ScriptProperty:LLM_EXTRACTOR_FALLBACK_MODEL', fallbackModel2: 'gemini-3.1-flash-lite', fallbackModel2Source: 'ScriptProperty:LLM_EXTRACTOR_FALLBACK_MODEL_2', modelChain: [DEFAULT_LLM_EXTRACTOR_MODEL_, 'gemini-2.0-flash', 'gemini-3.1-flash-lite'] }, results);

  const fbCfgSameAsPrimary = resolveLLMExtractorConfig_(fakeScriptProps_({ LLM_EXTRACTOR_MODEL: 'gemini-3.5-flash', LLM_EXTRACTOR_FALLBACK_MODEL: 'gemini-3.5-flash', LLM_EXTRACTOR_FALLBACK_MODEL_2: 'gemini-3.5-flash' }));
  assertEqual_('resolve·三层都设成同一个名字 → fallbackModel/fallbackModel2 都视为没有（null），modelChain 去重后只剩一个元素，不会真的切换成同一个模型重打', { fallbackModel: fbCfgSameAsPrimary.fallbackModel, fallbackModel2: fbCfgSameAsPrimary.fallbackModel2, modelChain: fbCfgSameAsPrimary.modelChain }, { fallbackModel: null, fallbackModel2: null, modelChain: ['gemini-3.5-flash'] }, results);

  const fbCfgPartialDup = resolveLLMExtractorConfig_(fakeScriptProps_({ LLM_EXTRACTOR_MODEL: 'gemini-3.8-flash', LLM_EXTRACTOR_FALLBACK_MODEL: 'gemini-3.6-flash', LLM_EXTRACTOR_FALLBACK_MODEL_2: 'gemini-3.8-flash' }));
  assertEqual_('resolve·第三层设成跟第一层一样（第二层不同）→ 第三层视为没有，modelChain 只有两个元素，不会把第一层排第二次', { fallbackModel2: fbCfgPartialDup.fallbackModel2, modelChain: fbCfgPartialDup.modelChain }, { fallbackModel2: null, modelChain: ['gemini-3.8-flash', 'gemini-3.6-flash'] }, results);

  const fbCfgBlank = resolveLLMExtractorConfig_(fakeScriptProps_({ LLM_EXTRACTOR_FALLBACK_MODEL: '  ', LLM_EXTRACTOR_FALLBACK_MODEL_2: '' }));
  assertEqual_('resolve·fallbackModel/fallbackModel2 设成空白/空字符串 → 都当没设，各自用默认值', [fbCfgBlank.fallbackModel, fbCfgBlank.fallbackModel2], [DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_, DEFAULT_LLM_EXTRACTOR_FALLBACK_MODEL_2_], results);

  // ============ resolveLLMExtractorConfig_：模型来自 Script Properties，没设才用默认 ============
  const cfgSet = resolveLLMExtractorConfig_(fakeScriptProps_({ LLM_EXTRACTOR_MODEL: 'gemini-2.5-flash', GEMINI_API_KEY: 'key-1', EXTRACTION_EVIDENCE_FOLDER_ID: 'folder-1' }));
  assertEqual_('resolve·有设 LLM_EXTRACTOR_MODEL 就用它（换模型改设定，不用改代码）', [cfgSet.model, cfgSet.modelSource], ['gemini-2.5-flash', 'ScriptProperty:LLM_EXTRACTOR_MODEL'], results);
  assertEqual_('resolve·apiKey/evidenceFolderId 原样带过来', [cfgSet.apiKey, cfgSet.evidenceFolderId], ['key-1', 'folder-1'], results);
  const cfgUnset = resolveLLMExtractorConfig_(fakeScriptProps_({}));
  assertEqual_('resolve·没设就用默认模型', [cfgUnset.model, cfgUnset.modelSource], [DEFAULT_LLM_EXTRACTOR_MODEL_, 'default'], results);
  const cfgBlank = resolveLLMExtractorConfig_(fakeScriptProps_({ LLM_EXTRACTOR_MODEL: '   ' }));
  assertEqual_('resolve·设成空白/只有空格也当没设（否则模型名变空白，URL 直接 404）', [cfgBlank.model, cfgBlank.modelSource], [DEFAULT_LLM_EXTRACTOR_MODEL_, 'default'], results);
  assertEqual_('resolve·前后空白/换行会去掉', resolveLLMExtractorConfig_(fakeScriptProps_({ LLM_EXTRACTOR_MODEL: '  gemini-2.5-flash \n' })).model, 'gemini-2.5-flash', results);
  assertEqual_('resolve·默认模型是 gemini-3.8-flash（2026-09-28 定的）', DEFAULT_LLM_EXTRACTOR_MODEL_, 'gemini-3.8-flash', results);

  // =====================================================================
  // 2026-10-11 Phase N：执行级调用预算（createExecutionBudget_ / createBudgetExhaustedError_）
  // 背景：单个 postJson 的 4 次尝试 × 3 层模型链 × 142 的 3 个 stage 会连乘到 36 次 fetch、
  // 纯睡眠最坏 540 秒，超过 GAS 360 秒硬限制（平台强制中止，不是 catchable 的例外）。
  // 预算是「准入控制」：每次 fetch 之前、每次睡眠之前先问；放不下就抛 isBudgetExhausted。
  // 全部用假时钟（Node，不真的等）。真实 GAS 重新验证：PENDING。
  // =====================================================================

  // ---- 常数：数字本身 + 它们之间必须成立的关系（设计意图）----
  assertEqual_('Phase N·预算常数：硬限制 360 秒 / 保留 30 秒 / 最短真实呼叫 115 秒（Gate 2 真实数据）/ 最多 12 次 fetch', [EXECUTION_HARD_LIMIT_MS_, EXECUTION_RESERVE_MS_, EXECUTION_MIN_CALL_ESTIMATE_MS_, EXECUTION_MAX_FETCHES_], [360000, 30000, 115000, 12], results);
  assertEqual_('Phase N·预算常数：次数上限 ≥ 一次完整模型链（3 模型 × 4 次 = 12，一个 stage 要能走完整条链）且 < 三层连乘（3 × 3 × 4 = 36，修的就是这个）', EXECUTION_MAX_FETCHES_ >= 3 * 4 && EXECUTION_MAX_FETCHES_ < 3 * 3 * 4, true, results);
  assertEqual_('Phase N·预算常数：硬限制 − 保留 > 最短真实呼叫（第一次呼叫永远放得下，预算不会一开始就拒绝所有呼叫）', EXECUTION_HARD_LIMIT_MS_ - EXECUTION_RESERVE_MS_ > EXECUTION_MIN_CALL_ESTIMATE_MS_, true, results);

  // ---- 次数闸 ----
  const clkCount = fakeClockPhaseN128_();
  const budCount = createExecutionBudget_({ now: clkCount.now });
  const countAdmits = [];
  for (let k = 0; k < 13; k++) countAdmits.push(budCount.tryBeginFetch().ok);
  assertEqual_('Phase N·预算·次数闸：前 12 次放行、第 13 次拒绝（reason=max_fetches），snapshot 记着已开始 12 次', { first12: countAdmits.slice(0, 12).every(Boolean), thirteenth: countAdmits[12], reason: budCount.snapshot().exhaustedReason, started: budCount.snapshot().fetchesStarted, exhausted: budCount.snapshot().exhausted }, { first12: true, thirteenth: false, reason: 'max_fetches', started: 12, exhausted: true }, results);

  // ---- 时间闸边界（用小数字，起点故意不是 0：经过时间必须用差值算）----
  const tinyOpts = { hardLimitMs: 1000, reserveMs: 100, minCallEstimateMs: 300, maxFetches: 99 }; // 最晚开始时间 = 1000 − 100 − 300 = 600
  const clkAtEdge = fakeClockPhaseN128_(5000);
  const budAtEdge = createExecutionBudget_(Object.assign({ now: clkAtEdge.now }, tinyOpts));
  clkAtEdge.t = 5000 + 600;
  const atEdge = budAtEdge.tryBeginFetch();
  const clkOverEdge = fakeClockPhaseN128_(5000);
  const budOverEdge = createExecutionBudget_(Object.assign({ now: clkOverEdge.now }, tinyOpts));
  clkOverEdge.t = 5000 + 601;
  const overEdge = budOverEdge.tryBeginFetch();
  assertEqual_('Phase N·预算·时间闸边界：已耗时 + 预计呼叫时间 恰好 == 硬限制 − 保留 → 放行（含边界）；多 1 毫秒 → 拒绝（reason=time），而且拒绝时不计入已开始的 fetch', [atEdge.ok, overEdge.ok, overEdge.reason, budOverEdge.snapshot().fetchesStarted], [true, false, 'time', 0], results);

  // ---- 预计呼叫时间 = max(下限, 本次执行最慢的一次)：慢呼叫会拉高估计，快呼叫不会拉低 ----
  const slowOpts = { hardLimitMs: 2000, reserveMs: 100, minCallEstimateMs: 300, maxFetches: 99 };
  function admitAfterCall_(callMs, elapsedAtNextMs) {
    const clk = fakeClockPhaseN128_();
    const bud = createExecutionBudget_(Object.assign({ now: clk.now }, slowOpts));
    const g = bud.tryBeginFetch();
    clk.t += callMs;
    bud.endFetch(g.startedAtMs);
    clk.t = elapsedAtNextMs;
    return bud.tryBeginFetch().ok;
  }
  assertEqual_('Phase N·预算·预计呼叫时间取本次执行最慢的一次：刚才那次花 500ms（> 下限 300ms）→ 最晚开始时间 = 2000−100−500 = 1400（1400 放行、1401 拒绝；只看下限的话 1500 本来会放行）', [admitAfterCall_(500, 1400), admitAfterCall_(500, 1401), admitAfterCall_(500, 1500)], [true, false, false], results);
  assertEqual_('Phase N·预算·快呼叫不会把预计时间拉低到下限以下：刚才那次只花 50ms → 最晚开始时间仍是 2000−100−300 = 1600', [admitAfterCall_(50, 1600), admitAfterCall_(50, 1601)], [true, false], results);

  // ---- sticky + canContinueAfter 只是询问 ----
  const clkSticky = fakeClockPhaseN128_();
  const budSticky = createExecutionBudget_(Object.assign({ now: clkSticky.now }, tinyOpts));
  const hypothetical = budSticky.canContinueAfter(601); // 睡 601ms 之后放不下
  const freshAfter = budSticky.tryBeginFetch();         // 单看「现在就开始」其实放得下（elapsed=0），但预算已经喊过停
  assertEqual_('Phase N·预算·sticky：拒绝过一次之后一律拒绝（不会出现「这次不行、下一次又行」，142 的「剩下 stage 一律跳过」跟预算状态永远一致），原因沿用第一次的', [hypothetical.ok, hypothetical.reason, freshAfter.ok, freshAfter.reason, budSticky.snapshot().fetchesStarted], [false, 'time', false, 'time', 0], results);
  const clkAsk = fakeClockPhaseN128_();
  const budAsk = createExecutionBudget_(Object.assign({ now: clkAsk.now }, tinyOpts));
  const askResults = [budAsk.canContinueAfter(0).ok, budAsk.canContinueAfter(100).ok];
  assertEqual_('Phase N·预算·canContinueAfter 只是询问：不消耗 fetch 次数', [askResults, budAsk.snapshot().fetchesStarted], [[true, true], 0], results);
  const clkAskFull = fakeClockPhaseN128_();
  const budAskFull = createExecutionBudget_({ now: clkAskFull.now, maxFetches: 1 });
  budAskFull.tryBeginFetch();
  const askAfterFull = budAskFull.canContinueAfter(0);
  assertEqual_('Phase N·预算·次数已用完时 canContinueAfter 也拒绝（不要为一个不会发生的重试白睡）', [askAfterFull.ok, askAfterFull.reason], [false, 'max_fetches'], results);

  // ---- endFetch 的防御、snapshot 形状、选项验证、预设时钟 ----
  const clkEnd = fakeClockPhaseN128_(1000);
  const budEnd = createExecutionBudget_({ now: clkEnd.now });
  budEnd.endFetch(undefined);
  budEnd.endFetch('x');
  budEnd.endFetch(clkEnd.t + 5000); // 开始时间在「未来」= 时钟倒退，负的持续时间
  assertEqual_('Phase N·预算·endFetch 收到缺参数/非数字/时钟倒退（负持续时间）→ 忽略，不污染预计呼叫时间', budEnd.snapshot().maxObservedCallMs, 0, results);
  const snapShape = budEnd.snapshot();
  assertEqual_('Phase N·预算·snapshot 只有 primitive（数字/字串/布尔/null）：会原样经 google.script.run 回传，不能有 Date；JSON 往返不变', JSON.stringify(JSON.parse(JSON.stringify(snapShape))) === JSON.stringify(snapShape) && Object.keys(snapShape).every((k) => snapShape[k] === null || ['number', 'string', 'boolean'].indexOf(typeof snapShape[k]) !== -1), true, results);
  const budBadOpts = createExecutionBudget_({ now: 'not-a-function', hardLimitMs: -1, reserveMs: NaN, minCallEstimateMs: 'x', maxFetches: Infinity });
  const badOptsSnap = budBadOpts.snapshot();
  assertEqual_('Phase N·预算·选项非法（负数/NaN/字串/Infinity/now 不是函数）→ 各自退回默认值，不抛错', [badOptsSnap.hardLimitMs, badOptsSnap.reserveMs, badOptsSnap.estimatedCallMs, badOptsSnap.maxFetches], [EXECUTION_HARD_LIMIT_MS_, EXECUTION_RESERVE_MS_, EXECUTION_MIN_CALL_ESTIMATE_MS_, EXECUTION_MAX_FETCHES_], results);
  const budRealClock = createExecutionBudget_();
  const realClockSnap = budRealClock.snapshot();
  assertEqual_('Phase N·预算·不给 now → 用真的 Date.now（已耗时是很小的非负数；预设预算第一次一定放行）', [typeof realClockSnap.elapsedMs, realClockSnap.elapsedMs >= 0 && realClockSnap.elapsedMs < 5000, budRealClock.tryBeginFetch().ok], ['number', true, true], results);

  // ---- createBudgetExhaustedError_：结构化旗标 + 保留最后一次实际错误 ----
  const lastReal503 = capacityError_('LLM API 回传 HTTP 503：{"error":{"code":503}}');
  const lastReal429 = (function () { const e = new Error('LLM API 回传 HTTP 429：RESOURCE_EXHAUSTED'); e.isQuotaExhausted = true; return e; })();
  const exhaustedFrom503 = createBudgetExhaustedError_('max_fetches', { fetchesStarted: 12, maxFetches: 12 }, lastReal503);
  const exhaustedFrom429 = createBudgetExhaustedError_('time', { elapsedMs: 200000, estimatedCallMs: 115000, reserveMs: 30000, hardLimitMs: 360000 }, lastReal429);
  const exhaustedNoLast = createBudgetExhaustedError_('max_fetches', { fetchesStarted: 0, maxFetches: 0 }, undefined);
  assertEqual_('Phase N·预算错误·带结构化旗标 isBudgetExhausted/budgetReason，快照原样挂上；最后一次实际错误的 isCapacityIssue/isQuotaExhausted 照样带过来（诊断用）、错误文字保留「最后一次实际错误」',
    { flag: exhaustedFrom503.isBudgetExhausted, reason: exhaustedFrom503.budgetReason, cap: exhaustedFrom503.isCapacityIssue, quota: exhaustedFrom503.isQuotaExhausted, keepsLast: /最后一次实际错误：LLM API 回传 HTTP 503/.test(exhaustedFrom503.message), snapshotKept: exhaustedFrom503.executionBudget.fetchesStarted, from429: [exhaustedFrom429.isQuotaExhausted, exhaustedFrom429.isCapacityIssue, exhaustedFrom429.budgetReason] },
    { flag: true, reason: 'max_fetches', cap: true, quota: false, keepsLast: true, snapshotKept: 12, from429: [true, false, 'time'] }, results);
  assertEqual_('Phase N·预算错误·预算一开始就用尽（没有「最后一次实际错误」）→ 两个旗标都是 false、文字里没有「最后一次实际错误」；文字明说是「明确失败，不是静默跳过」', { cap: exhaustedNoLast.isCapacityIssue, quota: exhaustedNoLast.isQuotaExhausted, noLastText: exhaustedNoLast.message.indexOf('最后一次实际错误') === -1, explicit: /不是静默跳过/.test(exhaustedNoLast.message) }, { cap: false, quota: false, noLastText: true, explicit: true }, results);

  // ---- createRetryingPostJson_ + executionBudget ----
  const ioNoBudget503 = fakeHttpIo_([{ code: 503, text: '{}' }]);
  const rNoBudget503 = tryPost_(createRetryingPostJson_(ioNoBudget503, undefined, undefined));
  assertEqual_('Phase N·postJson·不给 executionBudget（第三个参数 undefined）→ 跟 2026-10-02 的行为一字不差：打 4 次、睡 1/2/4 秒、错误不带预算旗标', [ioNoBudget503.calls.length, ioNoBudget503.sleeps, !!rNoBudget503.errorObj.isBudgetExhausted, rNoBudget503.errorObj.isCapacityIssue], [4, [1000, 2000, 4000], false, true], results);

  const clkCut = fakeClockPhaseN128_();
  const ioCut = timedIoPhaseN128_(clkCut, [{ code: 503, text: '{}' }], 0);
  const rCut = tryPost_(createRetryingPostJson_(ioCut, undefined, createExecutionBudget_({ now: clkCut.now, maxFetches: 2 })));
  assertEqual_('Phase N·postJson·次数用尽中途拒绝：只打 2 次；睡眠只有第一次重试前那次，拒绝发生在「睡之前」所以没有白睡（最后一个事件是 fetch，不是 sleep）；错误带 isBudgetExhausted + 上一次 503 的 isCapacityIssue + 最后一次实际错误',
    { fetches: ioCut.calls.length, sleeps: ioCut.sleeps, lastEvent: ioCut.events[ioCut.events.length - 1], flag: rCut.errorObj.isBudgetExhausted === true, reason: rCut.errorObj.budgetReason, cap: rCut.errorObj.isCapacityIssue === true, mentionsLast: /HTTP 503/.test(rCut.error) },
    { fetches: 2, sleeps: [1000], lastEvent: 'fetch', flag: true, reason: 'max_fetches', cap: true, mentionsLast: true }, results);

  const clkZero = fakeClockPhaseN128_();
  const ioZero = timedIoPhaseN128_(clkZero, [{ code: 200, text: '{"ok":1}' }], 0);
  const rZero = tryPost_(createRetryingPostJson_(ioZero, undefined, createExecutionBudget_({ now: clkZero.now, maxFetches: 0 })));
  assertEqual_('Phase N·postJson·预算在第一次 fetch 之前就拒绝：一次 fetch 都不打、不睡；错误明确带旗标，没有「最后一次实际错误」', { fetches: ioZero.calls.length, sleeps: ioZero.sleeps, flag: rZero.errorObj.isBudgetExhausted === true, noLast: rZero.error.indexOf('最后一次实际错误') === -1 }, { fetches: 0, sleeps: [], flag: true, noLast: true }, results);

  const clkTime = fakeClockPhaseN128_();
  const ioTime = timedIoPhaseN128_(clkTime, [{ code: 429, text: quota429Body_('53.5s') }, { code: 200, text: '{"ok":1}' }], 0);
  const rTime = tryPost_(createRetryingPostJson_(ioTime, undefined, createExecutionBudget_({ now: clkTime.now, hardLimitMs: 100000, reserveMs: 10000, minCallEstimateMs: 40000 })));
  assertEqual_('Phase N·postJson·时间闸在「睡之前」拒绝：429 要等 54 秒，但睡完就放不下下一次呼叫（最晚开始时间只有 50 秒）→ 不睡、不重打，错误带 isBudgetExhausted(time) + 429 的 isQuotaExhausted',
    { fetches: ioTime.calls.length, sleeps: ioTime.sleeps, flag: rTime.errorObj.isBudgetExhausted === true, reason: rTime.errorObj.budgetReason, quota: rTime.errorObj.isQuotaExhausted === true, elapsedMs: clkTime.t },
    { fetches: 1, sleeps: [], flag: true, reason: 'time', quota: true, elapsedMs: 0 }, results);

  // 回归守卫：2026-09-28 真实验证过的「429 依 Gemini 建议秒数等待后重试」在预设预算下必须照样成功
  const clkProven = fakeClockPhaseN128_();
  const ioProven = timedIoPhaseN128_(clkProven, [{ code: 429, text: quota429Body_('52s') }, { code: 200, text: '{"ok":1}' }], 0);
  const budProven = createExecutionBudget_({ now: clkProven.now });
  const rProven = tryPost_(createRetryingPostJson_(ioProven, SINGLE_RETRY_BUDGET_, budProven));
  assertEqual_('Phase N·postJson·回归守卫（2026-09-28 真实验证过的路径）：429 建议等 52 秒 → 预设预算下仍然睡 52.5 秒、重试、成功，不被预算拦下', { value: rProven.value, sleeps: ioProven.sleeps, fetches: ioProven.calls.length, exhausted: budProven.snapshot().exhausted }, { value: { ok: 1 }, sleeps: [52500], fetches: 2, exhausted: false }, results);

  // 每次 fetch 的耗时都记下来（成功、HTTP 错误、抛例外都算）
  const clkDur = fakeClockPhaseN128_();
  const budDur = createExecutionBudget_({ now: clkDur.now });
  tryPost_(createRetryingPostJson_(timedIoPhaseN128_(clkDur, [{ code: 200, text: '{"ok":1}' }], 200000), undefined, budDur));
  const clkThrow = fakeClockPhaseN128_();
  const budThrow = createExecutionBudget_({ now: clkThrow.now });
  const rThrow = tryPost_(createRetryingPostJson_(timedIoPhaseN128_(clkThrow, [{ code: 0, throws: 'DNS failure' }], 70000), undefined, budThrow));
  assertEqual_('Phase N·postJson·记录每次 fetch 的耗时：成功那次 200 秒记进 maxObservedCallMs；fetch 直接抛例外（网络例外）也记（try/finally），而且例外原样往外传、不被预算改写', { ok: budDur.snapshot().maxObservedCallMs, threw: budThrow.snapshot().maxObservedCallMs, message: rThrow.error, notBudget: !rThrow.errorObj.isBudgetExhausted }, { ok: 200000, threw: 70000, message: 'DNS failure', notBudget: true }, results);

  // 同一个预算在多个 postJson 之间累计（预算是「整次执行」的，不是每个 postJson 各一份）
  const clkShared = fakeClockPhaseN128_();
  const sharedScript = [503, 503, 200, 503, 503, 200].map((c) => (c === 200 ? { code: 200, text: '{"ok":1}' } : { code: c, text: '{}' }));
  const ioShared = timedIoPhaseN128_(clkShared, sharedScript, 0);
  const budShared = createExecutionBudget_({ now: clkShared.now, maxFetches: 5 });
  const postShared = createRetryingPostJson_(ioShared, undefined, budShared);
  const firstShared = tryPost_(postShared);
  const secondShared = tryPost_(postShared);
  assertEqual_('Phase N·postJson·同一个预算跨多次 postJson 累计：第一次用 3 次 fetch 成功，第二次只剩 2 次 → 第 6 次 fetch 被拒绝（总共 5 次）', { first: firstShared.value, secondFlag: secondShared.errorObj && secondShared.errorObj.isBudgetExhausted === true, totalFetches: ioShared.calls.length }, { first: { ok: 1 }, secondFlag: true, totalFetches: 5 }, results);

  // ---- postJsonWithModelFallback_：预算错误不换下一个模型 ----
  const budgetErrCarrying503 = createBudgetExhaustedError_('max_fetches', { fetchesStarted: 12, maxFetches: 12 }, capacityError_('last 503'));
  const httpBudgetStop = fakeHttpClientPerModel_({ 'm1': budgetErrCarrying503, 'm2': { ok: 'must-not-be-called' } });
  let budgetStopErr = null;
  try { postJsonWithModelFallback_(['m1', 'm2'], 'key1', httpBudgetStop, {}); } catch (e) { budgetStopErr = e; }
  assertEqual_('Phase N·模型链·预算错误（即使带着上一次 503 的 isCapacityIssue）不换下一个模型：只打过第一个、抛出的就是那个错误；allModelsCapacityExhausted 是 false（没有全部试过——旗标的定义）',
    { calls: httpBudgetStop._calls.map((c) => c.modelName), sameError: budgetStopErr === budgetErrCarrying503, allExhausted: budgetStopErr && budgetStopErr.allModelsCapacityExhausted }, { calls: ['m1'], sameError: true, allExhausted: false }, results);

  // ---- 整条链（真的 createRetryingPostJson_ + createLLMExtractor_）：数字 ----
  function chainWithBudget_(maxFetchesOverride) {
    const clk = fakeClockPhaseN128_();
    const io = timedIoPhaseN128_(clk, [{ code: 503, text: '{}' }], 0);
    const bud = maxFetchesOverride === null ? undefined : createExecutionBudget_({ now: clk.now });
    const extractor = createLLMExtractor_({ apiKey: 'k', model: 'm1', modelChain: ['m1', 'm2', 'm3'], evidenceFolderId: 'f' }, { driveService: fakeDriveService_(), httpClient: { postJson: createRetryingPostJson_(io, SINGLE_RETRY_BUDGET_, bud) }, now: new Date('2026-10-11T00:00:00Z') });
    const seen = [];
    for (let k = 0; k < 3; k++) { // 142 最多呼叫 3 次 extractOrders（full + 2 chunk）
      let err = null;
      try { extractor.extractOrders({ fileId: 'f1', documentId: 'd1' }, null); } catch (e) { err = e; }
      seen.push({ fetchesSoFar: io.calls.length, budgetFlag: !!(err && err.isBudgetExhausted), threw: !!err });
    }
    return seen;
  }
  assertEqual_('Phase N·整条链（3 模型 × 4 次）全部 503：第一次 extractOrders 恰好用掉 12 次 fetch、抛的是真实的 503（不是预算错误）；第 2、3 次一进来就被预算拒绝、fetch 数不再增加', chainWithBudget_(undefined), [{ fetchesSoFar: 12, budgetFlag: false, threw: true }, { fetchesSoFar: 12, budgetFlag: true, threw: true }, { fetchesSoFar: 12, budgetFlag: true, threw: true }], results);
  assertEqual_('Phase N·对照（没有预算 = 2026-10-02 的行为）：同样三次 extractOrders 打满 36 次 fetch——这就是被修掉的连乘', chainWithBudget_(null).map((s) => s.fetchesSoFar), [12, 24, 36], results);

  // ---- 接线测试（Node-only）：用假的 GAS 全域物件跑「真的」realLLMExtractor_，确认预算真的接到打 Gemini 的那一层 ----
  // 「建了预算却没接上」是这类修复最容易出的漏洞——上面的测试都是直接把预算交给 createRetryingPostJson_，
  // 没有碰 realLLMExtractorDeps_ / realLLMExtractor_ 这条真正的接线。这里假装 GAS 的 UrlFetchApp /
  // Utilities / DriveApp / PropertiesService，让真实的接线从头跑到尾。⚠️ 这仍然是 Node 里的假 GAS，
  // 不是真实 GAS：真实 UrlFetchApp 的行为（逾时、回应大小……）这里完全没有验证。
  if (typeof require === 'function' && typeof realLLMExtractor_ === 'function') {
    const gScope = globalThis;
    const gasNames = ['UrlFetchApp', 'Utilities', 'DriveApp', 'PropertiesService'];
    const savedGas = {};
    gasNames.forEach((k) => { savedGas[k] = { had: Object.prototype.hasOwnProperty.call(gScope, k), value: gScope[k] }; });
    try {
      const clkWire = fakeClockPhaseN128_();
      let wireFetches = 0;
      gScope.UrlFetchApp = { fetch() { wireFetches++; return { getResponseCode() { return 503; }, getContentText() { return '{}'; } }; } };
      gScope.Utilities = { sleep(ms) { clkWire.t += ms; }, base64Encode(b) { return 'b64(' + b + ')'; }, newBlob(content, mime, name) { return { content, mime, name }; } };
      gScope.DriveApp = { getFileById() { return { getBlob() { return { getBytes() { return 'bytes'; } }; } }; }, getFolderById() { return { createFile() { return { getId() { return 'ev-id'; } }; } }; } };
      gScope.PropertiesService = { getScriptProperties() { return fakeScriptProps_({ GEMINI_API_KEY: 'k', EXTRACTION_EVIDENCE_FOLDER_ID: 'folder-1' }); } };
      const threeStages_ = (extractor) => {
        const flags = [];
        for (let k = 0; k < 3; k++) {
          try { extractor.extractOrders({ fileId: 'f1', documentId: 'd1' }, null); flags.push('ok'); } catch (e) { flags.push(e.isBudgetExhausted ? 'budget' : 'real'); }
        }
        return flags;
      };
      wireFetches = 0;
      const wiredFlags = threeStages_(realLLMExtractor_('single', createExecutionBudget_({ now: clkWire.now })));
      const wiredFetches = wireFetches;
      wireFetches = 0;
      const unwiredFlags = threeStages_(realLLMExtractor_('single'));
      const unwiredFetches = wireFetches;
      wireFetches = 0;
      const batchFlags = threeStages_(realLLMExtractor_('batch'));
      const batchFetches = wireFetches;
      assertEqual_('Phase N·接线（假 GAS 全域物件跑真的 realLLMExtractor_）：给了 executionBudget → 三次 extractOrders 总共只打 12 次 UrlFetchApp.fetch，第 2、3 次是预算错误；不给 → 36 次（证明预算真的是靠这个参数接到最底层，不是别的巧合）',
        { wired: [wiredFetches, wiredFlags], unwired: [unwiredFetches, unwiredFlags] },
        { wired: [12, ['real', 'budget', 'budget']], unwired: [36, ['real', 'real', 'real']] }, results);
      assertEqual_('Phase N·接线·「batch」路径（112 的 lazyLLMExtractor_ 用，不给预算）完全不受影响：只用主模型、BATCH 预算，每次 extractOrders 打 4 次，三次共 12 次', [batchFetches, batchFlags], [12, ['real', 'real', 'real']], results);
    } finally {
      gasNames.forEach((k) => { if (savedGas[k].had) gScope[k] = savedGas[k].value; else delete gScope[k]; });
    }
  }

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllLLMExtractorTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllLLMExtractorTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllLLMExtractorTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] Script Properties 设定 GEMINI_API_KEY / EXTRACTION_EVIDENCE_FOLDER_ID
 *     （LLM_EXTRACTOR_MODEL 可选，不设走默认值）
 * [ ] 真的对一份真实 Grab Weekly Statement PDF 跑 realLLMExtractor_().extract()，
 *     确认 candidate 数字（net_delivery_income/incentive/tip/other_payments/
 *     total_income/total_deductions/weekly_net）真的对得上 PDF 上印的数字
 * [ ] 确认 evidenceFolderId 那个 Drive 资料夹真的出现了证据 JSON 档，档名
 *     带 document_id + 时间戳
 * [ ] 确认 generateContent 端点在 2026-08 之后没有被 Google 下线——文件
 *     顶部注解已经写明这是标记「Legacy」但仍在支援的端点，如果哪天真的
 *     被关闭，只需要改这个文件的 buildGeminiRequestBody_/parseGeminiResponse_
 *     跟 endpoint URL，其他文件不用动
 * [ ] 故意用一份数字对不上、或没有 Ringkasan 区块的怪异 PDF 测一次，确认
 *     真实 finishReason/candidate 的行为跟这里假设的一致
 *
 * ============ Phase 4（2026-08-25）新增，Butiran Tempahan order extraction ============
 * 下面这些完全没有在这个 sandbox 里验证过——不是"应该没问题"，是真的没
 * 打过 Gemini API（这个环境的网络白名单不包含 Google 的 API 网域），
 * Steven 批准进 Phase 4 implementation 后，这些必须是第一批要做的事：
 * [ ] extractOrders(document, null) 真的对 W01/W33 原始 PDF（不是 pdftotext
 *     fixture）跑一次，确认 Gemini 真的能在整份文件模式下把 Butiran
 *     Tempahan 完整读出来——第 9 步端到端验证的核心，目前完全没做过
 * [ ] 确认 W01 那个跨 3 页的 "Ahad, 4 Januari" 日期分组，Gemini 会不会
 *     正确回报全部 31 笔订单，还是漏掉视觉上离标题比较远的那几页
 * [ ] 故意找一份大到会被截断的 PDF（或者调低 max output tokens 模拟），
 *     确认 finishReason 真的会是 "MAX_TOKENS" 而不是 "STOP"，
 *     runGeminiOrderExtractionWithFallback_ 目前假设截断会导致
 *     validateOrderExtractionCandidate_ 判定失败进而触发 chunk fallback，
 *     这个假设完全没有用真实 truncated response 验证过
 * [ ] chunk fallback 路径（142_DailyOrderAllocation.js 的
 *     runGeminiOrderExtractionWithFallback_ 对半切页码范围）目前只用假的
 *     extractor 测过合并逻辑本身，从没让真的 Gemini 在两个不同页码范围各
 *     处理一次同一份 PDF——"分段之后 Gemini 会不会给出可以正确合并的结果"
 *     这件事本身还没有证据
 * [ ] 实际测量一次真实的 input/output token 数，跟 Phase 4 design 文件
 *     §14 的估算（约 7-8K input、8-10K output）核对，价格随时可能变，
 *     数量级需要用真实资料校正
 */
