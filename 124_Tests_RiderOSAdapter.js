/**
 * 124_Tests_RiderOSAdapter.js
 * （fakeStore_/assertEqual_ 从 105_TestUtils.js 来，不在这里重复定义。）
 */
if (typeof require === 'function') {
  var { createRiderOSAdapter_ } = require('./123_RiderOSAdapter.js');
  var { assertEqual_, fakeStore_ } = require('./105_TestUtils.js');
}

function runAllRiderOSAdapterTests() {
  const results = [];

  const adapter1 = createRiderOSAdapter_(fakeStore_());
  assertEqual_('未到齐时回 null', adapter1.getWeeklyEstimate('2026-W30'), null, results);

  const adapter2 = createRiderOSAdapter_(fakeStore_());
  const payload = { week: '2026-W30', daily_estimate_total: 2025.0, reward_estimate_total: 100.0, status: 'Ready' };
  adapter2.onWeeklyEstimateReady(payload);
  const readBack = adapter2.getWeeklyEstimate('2026-W30');
  assertEqual_('读回 week', readBack.week, '2026-W30', results);
  assertEqual_('读回 daily_estimate_total', readBack.daily_estimate_total, 2025.0, results);
  assertEqual_('读回 reward_estimate_total', readBack.reward_estimate_total, 100.0, results);
  assertEqual_('读回 status', readBack.status, 'Ready', results);

  let threw = false;
  try {
    adapter2.onWeeklyEstimateReady({ daily_estimate_total: 1 });
  } catch (e) {
    threw = true;
  }
  results.push({ name: '缺 week 时抛错', pass: threw });

  adapter2.onWeeklyEstimateReady({ week: '2026-W31', daily_estimate_total: 999, reward_estimate_total: 0, status: 'Ready' });
  assertEqual_('W30 不受 W31 写入影响', adapter2.getWeeklyEstimate('2026-W30').daily_estimate_total, 2025.0, results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${r.actual}, expected ${r.expected})`));
  });
  console.log(allPass ? '\n=== runAllRiderOSAdapterTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllRiderOSAdapterTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllRiderOSAdapterTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] 在真实 GAS 项目里确认 PropertiesService 版本能正常存取
 * [ ] Rider OS 真的建好发布能力后，确认是被 EventBus 订阅正确触发调用
 * [ ] 评估这个缓存要不要移到 TruthWriter/Sheet，还是维持 PropertiesService
 */
