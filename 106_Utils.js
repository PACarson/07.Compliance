/**
 * 106_Utils.js
 * Compliance OS — 共用的生产代码工具函数（不是测试用的，测试 helper 在
 * 105_TestUtils.js）。
 *
 * round2_() 原本在 130_Reconciliation.js 和 160_MonthlyProjection.js 各自
 * 重复宣告了一份——虽然是 function 宣告不会像 const 撞名那样直接
 * SyntaxError，但一样是「多份文件各自维护同一份逻辑，容易日后跑偏」的
 * 脆弱模式，抽出来统一维护。
 */

function round2_(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * 把「应该是 YYYY-MM-DD 的值」正规化成一个干净的 ISO 日期字符串。两种
 * 输入都要接受：正常情况下 textColumns（108_SheetSetup.js）已经让 Sheets
 * 把日期栏存成纯文本，读回来是字符串；但既有资料、或储存格格式被人为/
 * 意外改回日期格式的情况下，Sheets 的 getValues() 会给一个原生 Date
 * 物件，不是字符串——这正是造成 Monthly Projection「不是合法的 ISO
 * 日期」整批崩溃的成因之一（2026-08-22 真实 GAS 部署时发生过）。
 *
 * 不抛错——回传 null 代表「这个值现在没办法安全当成日期用」，由呼叫方
 * 决定怎么处理（例如 160_MonthlyProjection.js 的 computeMonthlyAllocation_
 * 会把 null 当作 Missing_Period，而不是让整批汇总因为一笔坏资料就中断）。
 * 这个函数本身只负责「能不能安全转成一个乾净字符串」，不负责决定上层
 * 该怎么应对——那是各自呼叫方的责任，不要在这里混着做。
 * @param {*} value
 * @return {string|null} "YYYY-MM-DD"，或 null（无法安全判定）
 */
function normalizeIsoDateString_(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const mo = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = { round2_, normalizeIsoDateString_ };
}
