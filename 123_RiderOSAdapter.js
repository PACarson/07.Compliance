/**
 * 123_RiderOSAdapter.js
 * Compliance OS — RiderOSAdapter：Reconciliation Engine 跟 Rider OS 之间
 * 唯一的出入口（UCR7 Infrastructure Adapter / Port isolation）。
 *
 * Rider OS 目前还没有 §4.2 ADR-001 定的 RIDER_WEEKLY_ESTIMATE_READY 发布
 * 能力——按 UCR7「依赖还没确认时先写 Adapter，内部放占位 + log，不要猜签名
 * 硬上」，这个文件先把 Reconciliation Engine 需要的两个方法定出来，内部
 * 实现（真的接 EventBus 订阅、还是别的机制）等 Rider OS 那边建好再补。
 * Reconciliation Engine 从头到尾只认 getWeeklyEstimate()，完全不知道背后
 * 现在是占位、以后会不会换成 Library/REST/Event。
 *
 * 存储后端可替换（工厂函数 + 注入），预设在 GAS 里走 PropertiesService，
 * 测试时可以换成假的 in-memory store，不需要真的连 GAS 环境。
 */

function createRiderOSAdapter_(store) {
  const CACHE_PREFIX = 'RIDER_WEEKLY_ESTIMATE_';

  function logPlaceholder_(funcName, detail) {
    const msg = `[占位实现，等 Rider OS 真的建好 RIDER_WEEKLY_ESTIMATE_READY 发布能力] ${detail}`;
    if (typeof AlertService !== 'undefined' && typeof AlertService.log === 'function') {
      AlertService.log('WARN', 'RiderOSAdapter', funcName, detail, msg);
    } else {
      console.warn(`[RiderOSAdapter.${funcName}] ${msg}`);
    }
  }

  return {
    /**
     * Rider OS 发布 RIDER_WEEKLY_ESTIMATE_READY 时应该调用这个（现在是手动/
     * 占位调用点；等真的接上 EventBus 订阅，改的是「谁来调用它」，这个方法
     * 本身的签名不变，Reconciliation Engine 不受影响）。
     * @param {{week: string, daily_estimate_total: number, reward_estimate_total: number, status: string}} payload
     */
    onWeeklyEstimateReady(payload) {
      if (!payload || !payload.week) {
        throw new Error('RIDER_WEEKLY_ESTIMATE_READY payload 缺少 week');
      }
      logPlaceholder_('onWeeklyEstimateReady', `收到 week=${payload.week} 的估算数据`);
      // TODO(Rider OS 建好后)：评估要不要改成透过 UCR6 的 TruthEngine-等价物
      // 写进 Sheet，而不是留在这个轻量 store 里——取决于到时候要不要长期
      // 留存这份缓存，还是只是过渡态。
      store.set(CACHE_PREFIX + payload.week, JSON.stringify(payload));
    },

    /**
     * Reconciliation Engine 用这个取某一周的 Rider OS 估算。Rider OS 还没
     * 发布过这一周的数据时回传 null——Reconciliation Engine 用这个判断
     * 「两边到齐了没」，不能当成 0 处理。
     * @param {string} week 例如 "2026-W30"
     * @return {{week: string, daily_estimate_total: number, reward_estimate_total: number, status: string}|null}
     */
    getWeeklyEstimate(week) {
      const raw = store.get(CACHE_PREFIX + week);
      if (!raw) {
        logPlaceholder_('getWeeklyEstimate', `week=${week} 还没有 Rider OS 的估算数据`);
        return null;
      }
      return JSON.parse(raw);
    }
  };
}

function gasPropertiesStore_() {
  return {
    get(key) {
      return PropertiesService.getScriptProperties().getProperty(key);
    },
    set(key, value) {
      PropertiesService.getScriptProperties().setProperty(key, value);
    }
  };
}

// GAS 环境下才自动接上真的 PropertiesService；Node 测试环境里 PropertiesService
// 不存在，RiderOSAdapter 就先不初始化，改用 createRiderOSAdapter_ 自己注入假 store。
var RiderOSAdapter = (typeof PropertiesService !== 'undefined')
  ? createRiderOSAdapter_(gasPropertiesStore_())
  : null;

if (typeof module !== 'undefined') {
  module.exports = { createRiderOSAdapter_, RiderOSAdapter };
}
