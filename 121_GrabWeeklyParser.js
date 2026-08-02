/**
 * 121_GrabWeeklyParser.js
 * Compliance OS — GrabWeeklyParser：把 Grab「Penyata Pemandu」周结单的抽取文字
 * 转成标准 JSON（对应 Phase 2 字段分析文档的 Schema，含收入层级关系）。
 *
 * 只处理「结构化文字 → JSON」这一步，不处理「PDF → 文字」——那是 Document
 * Import Engine 的职责。如果 Grab 改版 Statement 格式，只需要改这个文件——
 * Reconciliation Engine、Event Bus、Finance OS 完全不受影响。
 *
 * 遵循 UCR1（IIFE）、UCR2（私有函数前缀 _）、UCR3（try/catch + AlertService.log）、
 * UCR4（日期一律用 Date.UTC(y, m, d) 从已拆解的整数组装，绝不用字符串直接
 * new Date(str) —— 这条对应 UEF Failure Catalog 里 Rider OS 的「1899 date」bug）。
 */

if (typeof require === 'function') {
  var { DocumentParser, ParserRegistry } = require('./120_DocumentParsing.js');
}

var GrabWeeklyParser = (function () {
  'use strict';

  const MALAY_MONTHS_ = {
    januari: 1, februari: 2, mac: 3, april: 4, mei: 5, jun: 6,
    julai: 7, ogos: 8, september: 9, oktober: 10, november: 11, disember: 12
  };

  /**
   * "20 Julai, 2026" -> { year: 2026, month: 7, day: 20 }（整数组件，不组字符串喂给 Date）
   */
  function parseMalayDateParts_(text) {
    const m = text.trim().match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/);
    if (!m) throw new Error(`日期格式无法识别：${text}`);
    const day = parseInt(m[1], 10);
    const month = MALAY_MONTHS_[m[2].toLowerCase()];
    const year = parseInt(m[3], 10);
    if (!month) throw new Error(`无法识别的马来文月份：${m[2]}`);
    return { year, month, day };
  }

  function isoDateString_(parts) {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  /**
   * ISO 8601 周数。UCR4：全程用整数年/月/日透过 Date.UTC() 组装，不把日期
   * 字符串交给 Date 构造函数解析。
   */
  function isoWeek_(parts) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    if (isNaN(date.getTime())) {
      throw new Error(`无法组出合法日期：${JSON.stringify(parts)}`);
    }
    const target = new Date(date.getTime());
    const dayNr = (date.getUTCDay() + 6) % 7; // 周一=0 ... 周日=6
    target.setUTCDate(target.getUTCDate() - dayNr + 3); // 移到本周四
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
    const weekNumber = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
    return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  }

  function round2_(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * 在 text 里找 label 之后最近的一个金额（例如 "1,734.10"），转成 number。
   * 找不到就抛错——宁可 Failed_Parse 让人工介入，也不要静默给错的数字。
   */
  function findAmountAfterLabel_(text, label, searchWindow) {
    const window_ = searchWindow || 160;
    const idx = text.indexOf(label);
    if (idx === -1) {
      throw new Error(`找不到字段："${label}"`);
    }
    const windowText = text.slice(idx + label.length, idx + label.length + window_);
    const m = windowText.match(/-?[\d,]+\.\d{2}/);
    if (!m) {
      throw new Error(`找到字段 "${label}" 但附近 ${window_} 字内没有金额`);
    }
    return parseFloat(m[0].replace(/,/g, ''));
  }

  function logAndRethrow_(funcName, input, err) {
    const msg = err && err.message ? err.message : String(err);
    if (typeof AlertService !== 'undefined' && typeof AlertService.log === 'function') {
      AlertService.log('ERROR', 'GrabWeeklyParser', funcName, input, msg);
    } else {
      console.error(`[GrabWeeklyParser.${funcName}] ${msg}`);
    }
    throw err;
  }

  class GrabWeeklyParser extends DocumentParser {
    parserId() {
      return 'GrabWeeklyParser';
    }

    schemaVersion() {
      return '1.0.0';
    }

    canParse(document) {
      return !!document && document.source === 'Grab' && document.document_type === 'Weekly Statement';
    }

    parse(document, rawText) {
      try {
        return this.parseInternal_(rawText);
      } catch (err) {
        logAndRethrow_('parse', { document }, err);
      }
    }

    parseInternal_(rawText) {
      // ---- 1. 统计期间 ----
      const periodMatch = rawText.match(
        /(\d{1,2}\s+[A-Za-z]+,?\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]+,?\s+\d{4})/
      );
      if (!periodMatch) {
        throw new Error('找不到统计期间（例如 "20 Julai, 2026 - 26 Julai, 2026"）');
      }
      const periodStartParts = parseMalayDateParts_(periodMatch[1]);
      const periodEndParts = parseMalayDateParts_(periodMatch[2]);

      // ---- 2. 顶层汇总（Ringkasan）——范围限定，见下方说明 ----
      // 22 页的真实文件后面的术语表（Cara membaca penyata）会重新解释每个字段，
      // 一定也会再出现一次这些字词；对整份文字做 indexOf 可能抓到术语表里的
      // 说明文字而不是 Ringkasan 的实际数字，所以限定搜索范围。
      const ringkasanIdx = rawText.indexOf('Ringkasan');
      const butiranIdx = rawText.indexOf('Butiran pendapatan');
      if (ringkasanIdx === -1 || butiranIdx === -1 || butiranIdx <= ringkasanIdx) {
        throw new Error('找不到 "Ringkasan" 或 "Butiran pendapatan" 区块，无法界定汇总范围');
      }
      const summarySection = rawText.slice(ringkasanIdx, butiranIdx);

      const summary = {
        total_income: findAmountAfterLabel_(summarySection, 'Jumlah Pendapatan'),
        total_deductions: findAmountAfterLabel_(summarySection, 'Jumlah Penolakan'),
        weekly_net: findAmountAfterLabel_(summarySection, 'Jumlah Mingguan')
      };

      // ---- 3. 收入结构（含层级关系）----
      const breakdownSection = rawText.slice(butiranIdx, butiranIdx + 1200);

      const components = {
        base_food_income: {
          label_ms: 'Pendapatan asas makanan',
          amount: findAmountAfterLabel_(breakdownSection, 'Pendapatan asas makanan')
        },
        base_express_income: {
          label_ms: 'Pendapatan asas Express',
          amount: findAmountAfterLabel_(breakdownSection, 'Pendapatan asas Express')
        },
        express_addon_bonus: {
          label_ms: 'Bonus add-on express',
          amount: findAmountAfterLabel_(breakdownSection, 'Bonus add-on express')
        },
        income_adjustment: {
          label_ms: 'Pelarasan Pendapatan',
          amount: findAmountAfterLabel_(breakdownSection, 'Pelarasan Pendapatan')
        },
        commission: {
          label_ms: 'Komisen',
          amount: findAmountAfterLabel_(breakdownSection, 'Komisen')
        }
      };

      const netDeliveryStated = findAmountAfterLabel_(breakdownSection, 'Pendapatan bersih penghantaran');
      const netDeliveryComputed = round2_(
        components.base_food_income.amount +
          components.base_express_income.amount +
          components.express_addon_bonus.amount +
          components.income_adjustment.amount -
          components.commission.amount
      );

      const incomeBreakdown = {
        net_delivery_income: {
          code: 'net_delivery_income',
          label_ms: 'Pendapatan bersih penghantaran',
          amount: netDeliveryStated,
          components
        },
        incentive: {
          code: 'incentive',
          label_ms: 'Insentif',
          amount: findAmountAfterLabel_(breakdownSection, 'Insentif')
        },
        tip: {
          code: 'tip',
          label_ms: 'Tip',
          amount: findAmountAfterLabel_(breakdownSection, 'Tip')
        },
        other_payments: {
          code: 'other_payments',
          label_ms: 'Bayaran lain-lain',
          amount: findAmountAfterLabel_(breakdownSection, 'Bayaran lain-lain')
        }
      };

      // ---- 4. 自我一致性检查（不是 Schema 的一部分，是 Reconciliation 之前的自检）----
      const recomputedTotal = round2_(
        netDeliveryStated +
          incomeBreakdown.incentive.amount +
          incomeBreakdown.tip.amount +
          incomeBreakdown.other_payments.amount
      );
      const consistencyCheck = {
        net_delivery_stated_vs_computed_diff: round2_(netDeliveryStated - netDeliveryComputed),
        total_income_stated_vs_recomputed_diff: round2_(summary.total_income - recomputedTotal)
      };

      return {
        document_meta: {
          source: 'Grab',
          document_type: 'Weekly Statement',
          period_start: isoDateString_(periodStartParts),
          period_end: isoDateString_(periodEndParts),
          week: isoWeek_(periodStartParts),
          currency: 'MYR'
        },
        summary,
        income_breakdown: incomeBreakdown,
        itemized_detail: {
          note: '逐笔明细（Tip/Insentif/派送订单）留待 Phase 3 展开；本版本只保留结构化的顶层与分类账小计'
        },
        _consistency_check: consistencyCheck,
        _parser_id: this.parserId(),
        _schema_version: this.schemaVersion()
      };
    }
  }

  return GrabWeeklyParser;
})();

ParserRegistry.register(new GrabWeeklyParser());

if (typeof module !== 'undefined') {
  module.exports = { GrabWeeklyParser };
}
