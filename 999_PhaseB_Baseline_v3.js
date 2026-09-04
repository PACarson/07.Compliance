/**
 * Phase B — Zero-Change Baseline Test（v3：Gate 2 连续两次超时，加计时探针定位卡在哪个阶段）
 *
 * 背景：v2 把 Gate 1/Gate 2 拆成两个独立函数后，Steven 独立执行 runPhaseB_Gate2Only()
 * 两次，两次都在约 6 分钟（consumer 帐号 ~360 秒执行上限）被 "Exceeded maximum
 * execution time" 中止——而且中止前完全没有出现任何 [G2] 开头的输出，只有最外层
 * 的 "========== GATE 2 ==========" 标题行。
 *
 * 原因查过 142_DailyOrderAllocation.js 的 runGeminiOrderExtractionWithFallback_ 之后
 * 确认：这个函数本身从头到尾没有任何一行 log。所以目前完全没办法从既有输出分辨
 * 两种可能：
 *   (a) 第一次（整份文件）Gemini 呼叫本身这次就跑超过 360 秒——Gate 1 上次量到
 *       305.6 秒，这次如果落在 340~400+ 秒完全可能只是正常的延迟波动，从头到尾
 *       只打了一次 API，fallback 分支根本没被触发；
 *   (b) 第一次呼叫在合理时间内回来了，但回传结果没通过 125 的四层验证（可能是这
 *       次抽取真的有资料品质问题，也可能只是偶发），落入 chunk fallback 分支，
 *       接着又打了第 2、甚至第 3 次 Gemini，几次呼叫加总超过预算。
 *
 * 这两种情况指向完全不同的下一步——(a) 才需要讨论要不要换更快的 model；(b) 应该
 * 先看 validation 为什么没过，而不是急著换 model 或做 chunk-first。这份 v3 只加
 * 「探针」去回答「卡在哪一次呼叫」这个问题，不改变任何判断逻辑，也不改
 * 112/125/127/142 任何一行——Zero-Change Baseline 对 production code 完全不变。
 *
 * 做法：runGeminiOrderExtractionWithFallback_ 只透过 deps.extractor.extractOrders(...)
 * 呼叫 extractor，这本来就是一个依赖注入点。这里只在测试脚本这一层，用一个纯计
 * 时包装（wrapExtractorWithTiming_）包住原本要传进去的 extractor 物件——142 完全
 * 感知不到这层包装，收到的还是同一个 extractOrders(document, pageRange) 方法、同
 * 样的回传值，唯一差别是每次呼叫前后多两行 console.log。
 *
 * ⚠️ v3 取代 v2，不是并存：麻烦把 GAS 专案里的 999_PhaseB_Baseline_v2.js 整份删除
 * 再加入这份。两份同时留著会造成 PHASE_B_W01_FILE_ID 重复宣告——这在 GAS 共享作用
 * 域里是 SyntaxError，跟 105_TestUtils.js 当初要解决的问题一模一样，务必先删旧的。
 * Gate 1 不受影响、不需要重跑（已经 PASS 过），这份的 runPhaseB_Gate1Only 是从 v2
 * 原样搬过来的，一个字都没改。
 *
 * 用法：
 * 1. 删除 999_PhaseB_Baseline_v2.js
 * 2. 加入这份 999_PhaseB_Baseline_v3.js，确认 PHASE_B_W01_FILE_ID 已经填真实 file ID
 * 3. 直接跑 runPhaseB_Gate2Only（Gate 1 不用重跑）
 * 4. 不管这次是 PASS 还是又超时，把完整 log 原样贴回来——如果又超时，看最后一行
 *    [G2-TIMING] 卡在哪一次 extractOrders 呼叫，就知道是情况 (a) 还是 (b)
 */

const PHASE_B_W01_FILE_ID = "YOUR_W01_DRIVE_FILE_ID_HERE";

function runPhaseB_Gate1Only() {
  const docInfo = { fileId: PHASE_B_W01_FILE_ID, documentId: "CMP-DOC-PHASEB-W01", totalPages: 24 };
  const extractor = realLLMExtractor_();

  console.log("========== GATE 1: API / Schema Integration ==========");
  const g1Start = Date.now();
  try {
    const rawExtract = extractor.extractOrders(docInfo, null);
    const elapsed = (Date.now() - g1Start) / 1000;
    const days = rawExtract.candidate && rawExtract.candidate.days;
    const shapeOk = Array.isArray(days) && days.length > 0 &&
      days.every(d => Array.isArray(d.orders) && typeof d.printed_daily_subtotal !== 'undefined');
    const totalOrdersRaw = days ? days.reduce((s, d) => s + (d.orders ? d.orders.length : 0), 0) : 0;

    console.log(`[G1] API 呼叫成功，耗时 ${elapsed}s`);
    console.log(`[G1] finishReason: ${rawExtract.evidence.finishReason}`);
    console.log(`[G1] evidence 档案 ID: ${rawExtract.evidence.evidenceFileId}`);
    console.log(`[G1] extractorId: ${rawExtract.evidence.extractorId || '(未记录)'}`);
    console.log(`[G1] candidate.days 形状正确（无 schema mismatch）: ${shapeOk}`);
    console.log(`[G1] 回传天数: ${days ? days.length : 0}`);
    console.log(`[G1] 回传订单总笔数: ${totalOrdersRaw}`);
    console.log(`[G1] === GATE 1 判定: ${(rawExtract.evidence.finishReason === 'STOP' && shapeOk) ? 'PASS' : 'FAIL'} ===`);
  } catch (err) {
    console.error(`[G1] API 呼叫失败（耗时 ${(Date.now() - g1Start) / 1000}s）:`, err.message);
    console.log("[G1] === GATE 1 判定: FAIL ===");
  }
}

/**
 * 纯计时包装——不碰 142 的任何一行、不改 deps 的形状（142 只用得到 extractOrders
 * 这一个方法，签章和回传值原样透传）。每次 extractOrders 被呼叫，不管是
 * full_document 还是某个 chunk，都记录开始时间、结束（或例外）时间、耗时。
 * 就算这次又超时，最后一行 [G2-TIMING] 会告诉我们卡在哪一次呼叫上。
 */
function wrapExtractorWithTiming_(rawExtractor) {
  return {
    extractOrders(document, pageRange) {
      const label = pageRange ? `chunk_${pageRange.firstPage}-${pageRange.lastPage}` : 'full_document';
      const t0 = Date.now();
      console.log(`[G2-TIMING] >>> extractOrders(${label}) 开始，此刻 ${new Date(t0).toISOString()}`);
      try {
        const result = rawExtractor.extractOrders(document, pageRange);
        console.log(`[G2-TIMING] <<< extractOrders(${label}) 完成，耗时 ${(Date.now() - t0) / 1000}s，finishReason=${result.evidence.finishReason}`);
        return result;
      } catch (err) {
        console.log(`[G2-TIMING] <<< extractOrders(${label}) 抛出例外，耗时 ${(Date.now() - t0) / 1000}s：${err.message}`);
        throw err;
      }
    }
  };
}

function runPhaseB_Gate2Only() {
  const docInfo = { fileId: PHASE_B_W01_FILE_ID, documentId: "CMP-DOC-PHASEB-W01-G2", totalPages: 24 };
  const verifiedIncomeContext = {
    netDeliveryIncome: 1297.60,
    periodStartParts: { year: 2025, month: 12, day: 29 },
    periodEndParts: { year: 2026, month: 1, day: 4 },
    verifiedIncomeId: "CMP-INCOME-2026-W01-PHASEB-G2"
  };
  const extractor = wrapExtractorWithTiming_(realLLMExtractor_());

  console.log("========== GATE 2: Real Data Accuracy（独立执行，不先跑 Gate 1，含计时探针）==========");
  const g2Start = Date.now();
  const result = runGeminiOrderExtractionWithFallback_(docInfo, verifiedIncomeContext, {
    extractor: extractor,
    now: new Date()
  });
  console.log(`[G2] 编排完成，耗时 ${(Date.now() - g2Start) / 1000}s`);
  console.log(`[G2] 最终 allocationStatus: ${result.allocationStatus}`);
  console.log(`[G2] 尝试历程: ${JSON.stringify(result.attempts)}`);

  const allOrders = result.orderRows || [];
  console.log(`\n--- 订单总数检查 ---`);
  console.log(`[G2] 订单总笔数: ${allOrders.length} / 已知正确 173`);

  const lowConf = allOrders.filter(o => o.low_confidence);
  console.log(`[G2] low_confidence=true 笔数: ${lowConf.length}（已知正确 0）`);
  if (lowConf.length) console.log(JSON.stringify(lowConf, null, 2));

  const nullFields = allOrders.filter(o =>
    [o.base_income, o.other_income, o.income_adjustment, o.net_income].some(v => v === null || typeof v === 'undefined')
  );
  console.log(`[G2] 金额栏位有 null/undefined 的笔数: ${nullFields.length}（已知正确 0）`);
  if (nullFields.length) console.log(JSON.stringify(nullFields, null, 2));

  console.log(`\n--- 逐日 checksum ---`);
  let dailyMatchedCount = 0;
  (result.dailyAllocations || []).forEach(d => {
    if (d.checksum_status === 'Matched') dailyMatchedCount++;
    console.log(`  ${d.date}: ${d.order_row_count}笔 算得=${d.net_delivery_income} 印刷=${d.printed_daily_subtotal} 差=${d.checksum_difference} -> ${d.checksum_status}`);
  });
  console.log(`[G2] 7/7 daily checksum Matched: ${dailyMatchedCount}/7`);

  console.log(`\n--- 整周 statement checksum ---`);
  if (result.statementChecksum) {
    console.log(`[G2] 算得=${result.statementChecksum.calculatedTotal} vs 官方=${result.statementChecksum.statedTotal} -> ${result.statementChecksum.status}`);
    console.log(`（范围提醒：这里指订单净收入加总 vs net_delivery_income，不含 Tip/Insentif/asas 等——那些是 extract() 的范围）`);
  } else {
    console.log("[G2] !!! 没有 statementChecksum !!!");
  }

  console.log(`\n--- 8PRUR5AGXAQRAV 专项检查 ---`);
  const targetOrder = allOrders.find(o =>
    (o.order_ids_raw || o.order_ids || []).some(id => String(id).indexOf('8PRUR5AGXAQRAV') !== -1)
  );
  if (targetOrder) {
    console.log("[G2] 找到:", JSON.stringify(targetOrder, null, 2));
    console.log(`[G2] 判定: ${(targetOrder.net_income === 4.00 && !targetOrder.low_confidence) ? 'PASS' : 'FAIL，见上方内容'}`);
  } else {
    console.log("[G2] !!! FAIL：完全没找到这笔订单 !!!");
  }

  console.log(`\n--- Sekaligus / and N 分布 ---`);
  const sekaligus = allOrders.filter(o => o.order_row_type === 'Sekaligus');
  const singleId = sekaligus.filter(o => (o.order_ids_raw || []).length === 1 && !(o.and_more_count > 0));
  const withAndN = sekaligus.filter(o => o.and_more_count > 0);
  console.log(`[G2] Sekaligus 笔数: ${sekaligus.length}，单-ID 无 and N: ${singleId.length}，含 and N: ${withAndN.length}`);
  if (withAndN.length) console.log(JSON.stringify(withAndN.map(o => ({ ids: o.order_ids_raw, and_more: o.and_more_count }))));

  console.log(`\n--- 跨年份日期检查 ---`);
  const byYear = {};
  allOrders.forEach(o => {
    const y = (o.order_date || o.date || '').slice(0, 4);
    byYear[y] = (byYear[y] || 0) + 1;
  });
  console.log(`[G2] 按年份分布: ${JSON.stringify(byYear)}`);

  console.log(`\n--- 非重试错误 ---`);
  console.log(`[G2] nonRetryableErrors: ${JSON.stringify(result.nonRetryableErrors || [])}`);

  console.log("\n========== 请把这次完整 log 原样贴回来（特别是 [G2-TIMING] 那几行）==========");
}
