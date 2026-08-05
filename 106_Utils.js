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

if (typeof module !== 'undefined') {
  module.exports = { round2_ };
}
