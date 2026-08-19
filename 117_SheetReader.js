/**
 * 117_SheetReader.js
 * Compliance OS — SheetReader：所有 Sheet 读取的唯一出口。
 *
 * TruthWriter（115）的名字跟职责本来就限定在「写」——把读也塞进那个文件
 * 会让它的名字变得不准确。这里是对称的读取层，共用 TruthWriter 已经在用
 * 的同一个 sheetAccessor（115 的 gasSheetAccessor_/fakeSheetAccessor_ 都已经
 * 加了 getAllRows，不是两套各自独立的「怎么跟 SpreadsheetApp 说话」）。
 *
 * Operator Console 的去重（drive_file_id 存在性检查）、批次汇入后重建
 * Monthly Projection/YTD、Verified Income 发布前的幂等检查，都要读现有
 * 资料——这个模块存在之前，existingHashes 这类输入永远是外部手动传入
 * （见 110/111 旧版注释），没有真的读过 Sheet。
 */

if (typeof require === 'function') {
  var { gasSheetAccessor_ } = require('./115_TruthWriter.js');
}

/**
 * @param {{getAllRows: function(string): Array<Array>}} sheetAccessor
 */
function createSheetReader_(sheetAccessor) {
  /**
   * 读某张表全部资料列，照 columnOrder 转成物件阵列。不做任何值的猜测性
   * 转换（例如不会把空字串猜回 null）——Sheet 里存的是什么就原样回传，
   * 这样才不会在读的时候悄悄发明一个写的时候没做过的转换（CMP-P10）。
   * @param {string} sheetName
   * @param {string[]} columnOrder
   * @return {Array<Object>}
   */
  function readAll(sheetName, columnOrder) {
    const rows = sheetAccessor.getAllRows(sheetName);
    return rows.map(function (row, i) {
      if (row.length !== columnOrder.length) {
        throw new Error(`readAll: 第 ${i + 2} 列栏位数（${row.length}）跟 columnOrder（${columnOrder.length}）对不上（sheet=${sheetName}）——Sheet 结构可能改过，不猜怎么对应`);
      }
      const obj = {};
      columnOrder.forEach(function (col, idx) { obj[col] = row[idx]; });
      return obj;
    });
  }

  return { readAll };
}

// GAS 环境才自动接上真的 SpreadsheetApp；Node 测试环境改用 createSheetReader_
// 自己注入假 accessor。刻意重用 115_TruthWriter.js 的 gasSheetAccessor_——
// 同一个 Sheet 连线只应该有一份「怎么跟 SpreadsheetApp 说话」的实现。
var SheetReader = (typeof SpreadsheetApp !== 'undefined')
  ? createSheetReader_(gasSheetAccessor_())
  : null;

if (typeof module !== 'undefined') {
  module.exports = { createSheetReader_, SheetReader };
}
