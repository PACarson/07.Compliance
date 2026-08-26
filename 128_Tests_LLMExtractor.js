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
    BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_, buildButiranTempahanPrompt_, buildGeminiOrderExtractionRequestBody_
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
