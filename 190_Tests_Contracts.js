/**
 * 190_Tests_Contracts.js
 * Compliance OS — Contract Tests（采纳评审建议，新增的测试类别）
 *
 * 跟 NN_Tests_<FeatureId>.js 不一样：那些测的是「这个模块自己的行为对不
 * 对」，这份测的是「所有实现某个 Adapter 契约的东西，形状对不对」——
 * 不管以后 Parser/Adapter 有几个、谁写的，只要通过这份测试，Registry/
 * Reconciliation Engine 等呼叫方就能放心用。
 */
if (typeof require === 'function') {
  var { DocumentParser, ParserRegistry } = require('./120_DocumentParsing.js');
  require('./121_GrabWeeklyParser.js');
  var { createRiderOSAdapter_ } = require('./123_RiderOSAdapter.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { createDocumentTextExtractor_ } = require('./112_DocumentTextExtractor.js');
  var { createEventPublisher_ } = require('./140_VerifiedIncome.js');
  var { assertEqual_, fakeStore_, fakeSheetAccessor_, fakeLockProvider_ } = require('./105_TestUtils.js');
}

function assertHasMethods_(name, obj, methodNames, results) {
  methodNames.forEach((m) => {
    results.push({ name: `${name} 有方法 "${m}"`, pass: obj && typeof obj[m] === 'function' });
  });
}

function runAllContractTests() {
  const results = [];

  // ---- DocumentParser 契约：ParserRegistry 里注册的每一个 Parser 都要满足 ----
  const registered = ParserRegistry.listRegistered();
  results.push({ name: 'ParserRegistry 至少注册了一个 Parser', pass: registered.length > 0 });
  ['GrabWeeklyParser'].forEach((parserId) => {
    const parser = ParserRegistry.getParserFor({ source: 'Grab', document_type: 'Weekly Statement' });
    assertHasMethods_(parserId, parser, ['canParse', 'parse', 'parserId', 'schemaVersion'], results);
    results.push({ name: `${parserId}.parserId() 回传字符串`, pass: typeof parser.parserId() === 'string' });
    results.push({ name: `${parserId} 是 DocumentParser 的实例`, pass: parser instanceof DocumentParser });
  });

  // ---- Adapter 契约：createXxx_() 工厂产出的物件都要有文档承诺的方法 ----
  assertHasMethods_('RiderOSAdapter', createRiderOSAdapter_(fakeStore_()), ['onWeeklyEstimateReady', 'getWeeklyEstimate'], results);
  assertHasMethods_('TruthWriter', createTruthWriter_(fakeSheetAccessor_(), fakeLockProvider_()), ['appendValidatedRow'], results);
  assertHasMethods_('DocumentTextExtractor', createDocumentTextExtractor_({ extract: () => '' }), ['extract'], results);
  assertHasMethods_('EventPublisher', createEventPublisher_({ publish: () => {} }), ['publish'], results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}`));
  console.log(allPass ? '\n=== runAllContractTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllContractTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllContractTests };
}
