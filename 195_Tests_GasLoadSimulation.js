/**
 * 195_Tests_GasLoadSimulation.js
 * Compliance OS — 整个专案「照 GAS 的方式」载入一次会不会出事。
 *
 * 跟其他 NN_Tests_<Feature>.js 不一样：那些各自 require 自己需要的档案，
 * Node 的 require 顺序是显式指定的，测不出「GAS 把所有档案按文件名字母
 * 序塞进同一个 global scope 执行」这个载入模型本身的问题。这个文件只做
 * 一件事：把所有正式代码檔案（不含 Tests/Constitution/Architecture）串
 * 起来，在一个干净的 VM context 里跑一次，看载入阶段（不是呼叫任何函式，
 * 只是载入）会不会出事。
 *
 * 这份文件是这次新增 LLM extraction 那批改动时实际抓到两个真的 bug 之后
 * 才补上的，不是预防性写好玩的：
 *   1. 108_SheetSetup.js 原本把 SHEET_SCHEMAS_ 写成文件顶层就求值的阵列，
 *      直接嵌入对 DOCUMENTS_COLUMNS 等常数的引用——108 字母序排在
 *      110/130/140/150 前面，顶层求值那些常数当下都还没被赋值
 *   2. 112_DocumentTextExtractor.js 原本在顶层就呼叫 realLLMExtractor_()
 *      （读 Script Properties），Script Properties 没设定好时会让整个
 *      专案在载入阶段就抛错，牵连所有其他完全不相关的函式
 * 两个都是「Node 测试全线绿灯，但真实 GAS 环境会整个炸掉」的类型——Node
 * 的 require 是显式、按需的，这类问题只有模拟 GAS 真正的载入方式才测得到。
 *
 * 以后新增檔案，尤其是任何文件顶层出现 `var X = ...`（不是 `function`）
 * 且右手边引用了其他档案定义的东西，都要留意这个模式；这个测试就是为了
 * 挡下同一类问题再发生第三次。
 */

if (typeof require === 'function') {
  var fs = require('fs');
  var vm = require('vm');
  var path = require('path');
}

/**
 * @param {string} dir
 * @return {string[]} 排除 Tests/Constitution/Architecture 之后、按文件名排序的正式代码档案
 */
function listGasSourceFiles_(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !f.includes('Tests') && !f.startsWith('900_') && !f.startsWith('901_'))
    .sort();
}

/**
 * 组一个最小的 GAS 全局服务替身集合。PropertiesService 刻意回传「有這個
 * service、但任何 key 都还没设定」——这是风险最高的状态（对应「Steven 还
 * 没设定好 Script Properties」的真实情况），比完全不定义 PropertiesService
 * 更容易抓到「顶层就假设读得到某个 Script Property」的问题（完全不定义
 * 只会得到 ReferenceError，没办法区分「用到了不该用的全局」还是「就是没
 * 模拟到」）。SpreadsheetApp/DriveApp/UrlFetchApp/HtmlService/LockService/
 * Utilities 刻意不定义：这些服务的实际调用只应该发生在真的呼叫某个函式
 * 之后（惰性），不该在专案载入阶段就被摸到；摸到了会得到清楚的
 * ReferenceError，直接指出问题在哪个档案的顶层。
 */
function buildMinimalGasSandbox_() {
  return {
    console,
    require: undefined,
    PropertiesService: {
      getScriptProperties() {
        return { getProperty() { return null; } };
      }
    }
  };
}

/**
 * @param {string} dir
 * @return {{ok: boolean, error: (string|undefined), fileCount: number}}
 */
function simulateGasLoad_(dir) {
  const files = listGasSourceFiles_(dir);
  const sandbox = buildMinimalGasSandbox_();
  vm.createContext(sandbox);
  let combined = '';
  files.forEach((f) => {
    combined += `\n// ==== ${f} ====\n` + fs.readFileSync(path.join(dir, f), 'utf8');
  });
  try {
    vm.runInContext(combined, sandbox, { filename: 'gas-combined.js' });
    return { ok: true, fileCount: files.length };
  } catch (err) {
    return { ok: false, error: err.message, fileCount: files.length };
  }
}

/**
 * 找「同一个名字，在不同档案里都被宣告成顶层 function」的情况——GAS 的
 * function 宣告可以重复（不像 const 会直接 SyntaxError），后面载入的会
 * 静默盖掉前面那个，不会有任何错误讯息，只会在某个看似无关的地方behavior
 * 跟预期不符。只抓 `^function name_(` 这个形状（这个专案唯一的顶层函式
 * 宣告风格），够用，不需要真的写一个 JS parser。
 * @param {string} dir
 * @return {Array<{name: string, files: string[]}>}
 */
function findDuplicateTopLevelFunctions_(dir) {
  const files = listGasSourceFiles_(dir);
  const declaredIn = {}; // name -> [file, file, ...]
  files.forEach((f) => {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const re = /^function\s+([A-Za-z0-9_]+)\s*\(/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      (declaredIn[name] = declaredIn[name] || []).push(f);
    }
  });
  return Object.keys(declaredIn)
    .filter((name) => declaredIn[name].length > 1)
    .map((name) => ({ name, files: declaredIn[name] }));
}

function runAllGasLoadSimulationTests() {
  const results = [];
  const dir = __dirname;

  const loadResult = simulateGasLoad_(dir);
  results.push({
    name: `整个专案（${loadResult.fileCount} 个正式代码档案）照 GAS 字母序载入一次，Script Properties 完全没设定的情况下不抛错`,
    pass: loadResult.ok,
    actual: loadResult.ok ? 'ok' : loadResult.error,
    expected: 'ok'
  });

  const duplicates = findDuplicateTopLevelFunctions_(dir);
  results.push({
    name: '没有任何顶层 function 名字在多个档案里重复宣告（会静默互相覆盖，不会抛错）',
    pass: duplicates.length === 0,
    actual: duplicates,
    expected: []
  });

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (${JSON.stringify(r.actual)})`));
  });
  console.log(allPass ? '\n=== runAllGasLoadSimulationTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllGasLoadSimulationTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllGasLoadSimulationTests, simulateGasLoad_, findDuplicateTopLevelFunctions_ };
}
