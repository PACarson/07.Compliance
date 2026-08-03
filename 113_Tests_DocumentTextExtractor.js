/**
 * 113_Tests_DocumentTextExtractor.js
 */
if (typeof require === 'function') {
  var { createDocumentTextExtractor_ } = require('./112_DocumentTextExtractor.js');
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
 * [ ] 确认要用哪种真实抽取方式（Drive OCR？Gemini/OpenAI/Claude 哪一个？）
 * [ ] 真实实现确认后，写一个新的 xxxExtractor_() 工厂函数换掉
 *     placeholderExtractor_()，其他文件完全不用碰
 */
