/**
 * 105_TestUtils.js
 * Compliance OS — 测试共用工具 + 固定样本数据。
 *
 * 存在原因：拿 Node vm 模块把交付的文件按 GAS 实际的文件名字母序整个合并
 * 执行后，抓到 122 跟 141 两个文件各自用 const 宣告了同名的
 * SAMPLE_RAW_TEXT——GAS 是单一全局作用域，两个 const 同名会直接
 * SyntaxError，整个项目会加载失败。这不是靠推理发现的，是实际跑了模拟才
 * 抓到。顺便把 assertEqual_/fakeStore_/fakeSheetAccessor_/fakeLockProvider_
 * 这些原本在 5 个测试文件里重复定义的 helper 也收进这里——function 重复
 * 宣告虽然不会报错（后加载的会静默覆盖前面的），但一样脆弱，不应该维持。
 */

function assertEqual_(name, actual, expected, results) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, pass, actual, expected });
}

function fakeStore_() {
  const data = {};
  return {
    get(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    set(key, value) { data[key] = value; }
  };
}

function fakeSheetAccessor_() {
  const written = {};
  return {
    appendRow(sheetName, rowArray) { (written[sheetName] = written[sheetName] || []).push(rowArray); },
    getWritten(sheetName) { return written[sheetName] || []; },
    getAllRows(sheetName) { return written[sheetName] || []; } // 假的 Sheet：写过的就是现在存在的
  };
}

function fakeLockProvider_() {
  return { withLock(fn) { return fn(); } };
}

/** 重建样本文件 Ringkasan/Butiran pendapatan 区块的抽取文字，供多个测试文件共用。 */
var TEST_FIXTURE_GRAB_WEEKLY_STATEMENT = `
Penyata Pemandu
20 Julai, 2026 - 26 Julai, 2026

Ringkasan
Jumlah Pendapatan
1,734.10
Jumlah Penolakan
0.00
Jumlah Mingguan
RM1,734.10

Butiran pendapatan
Pendapatan bersih penghantaran
1,146.00
Pendapatan asas makanan
750.30
Pendapatan asas Express
68.40
Bonus add-on express
0.00
Komisen
0.00
Pelarasan Pendapatan
327.30
Insentif
557.10
Tip
19.00
Bayaran lain-lain
12.00
`;

/** 上面样本 + 模拟真实 22 页文件末尾术语表重复出现同样字词的诱饵版本。 */
var TEST_FIXTURE_GRAB_WEEKLY_STATEMENT_WITH_GLOSSARY_DECOY =
  TEST_FIXTURE_GRAB_WEEKLY_STATEMENT +
  `
Cara membaca penyata
Tip: Jumlah tip mingguan yang diberikan penumpang. Sebagai contoh 999.99
Insentif: Jumlah insentif yang dibayar ke dalam Dompet Grab anda, contohnya 888.88
Komisen: Jumlah yang perlu dibayar kepada Grab, contohnya 777.77
`;

if (typeof module !== 'undefined') {
  module.exports = {
    assertEqual_, fakeStore_, fakeSheetAccessor_, fakeLockProvider_,
    TEST_FIXTURE_GRAB_WEEKLY_STATEMENT, TEST_FIXTURE_GRAB_WEEKLY_STATEMENT_WITH_GLOSSARY_DECOY
  };
}
