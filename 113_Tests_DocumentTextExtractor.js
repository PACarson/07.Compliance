/**
 * 113_Tests_DocumentTextExtractor.js
 */
if (typeof require === 'function') {
  var { createDocumentTextExtractor_, selectExtractorProvider_ } = require('./112_DocumentTextExtractor.js');
  var { assertEqual_ } = require('./105_TestUtils.js');
}

function fakeExtractor_(canned) {
  return { extract(document) { return canned; } };
}

function runAllDocumentTextExtractorTests() {
  const results = [];

  // ---- 换成假的抽取实现，确认 Adapter 只是转发，不夹带自己的逻辑 ----
  const extractor = createDocumentTextExtractor_(fakeExtractor_('测试文字内容'));
  assertEqual_('Adapter 正确转发假实现的结果', extractor.extract({ fileId: 'x' }), '测试文字内容', results);

  // ---- 换一个不同的假实现，确认底层可以随意替换（这就是这个 Adapter 存在的意义）----
  let capturedDocument = null;
  const extractor2 = createDocumentTextExtractor_({
    extract(document) { capturedDocument = document; return 'other implementation'; }
  });
  const result2 = extractor2.extract({ fileId: 'abc', mimeType: 'application/pdf' });
  assertEqual_('可以整个替换底层实现', result2, 'other implementation', results);
  assertEqual_('document 参数有正确传下去', capturedDocument.fileId, 'abc', results);

  // ============ selectExtractorProvider_：provider 选择 ============
  const fakeLLM = { extract() { return { mode: 'structured', candidate: {}, evidence: {} }; } };
  const llmProvider = selectExtractorProvider_('llm', fakeLLM);
  assertEqual_('provider=llm（注入假 deps）：回传的就是那个假 extractor', llmProvider, fakeLLM, results);

  const defaultProvider = selectExtractorProvider_(undefined, fakeLLM);
  assertEqual_('不给 providerName：默认是 llm', defaultProvider, fakeLLM, results);

  const ocrProvider = selectExtractorProvider_('ocr');
  let ocrThrew = false;
  try { ocrProvider.extract({ fileId: 'x' }); } catch (err) { ocrThrew = true; }
  assertEqual_('provider=ocr：明确抛错（fallback 槽位还没接实作，不假装能用）', ocrThrew, true, results);

  let unknownProviderThrew = false;
  try { selectExtractorProvider_('carrier-pigeon'); } catch (err) { unknownProviderThrew = true; }
  assertEqual_('不认得的 provider 名字：直接抛错，不 fallback 到别的（CMP-P10）', unknownProviderThrew, true, results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllDocumentTextExtractorTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllDocumentTextExtractorTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllDocumentTextExtractorTests };
}

/**
 * ============ 人工验证清单 ============
 * [x] 确认要用哪种真实抽取方式——2026-08-21 Steven 决定：LLM-based
 *     extraction（provider='llm'，默认 Gemini），Drive OCR 保留为
 *     fallback/diagnostic 槽位，暂不实作
 * [ ] Script Properties 设定 GEMINI_API_KEY / EXTRACTION_EVIDENCE_FOLDER_ID
 *     （见 128_Tests_LLMExtractor.js 人工清单）
 * [ ] 真实 GAS 环境：DocumentTextExtractor.extract() 对一份真的 Drive PDF
 *     跑一次，确认回传 mode='structured' 且 candidate 通过
 *     125_ExtractionValidation.js 的验证
 */
