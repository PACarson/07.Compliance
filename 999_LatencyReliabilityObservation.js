/**
 * 999_LatencyReliabilityObservation.js
 *
 * Accuracy 已经关闭（999_PhaseB_Baseline_v4.js 现场跑过：173/173、7/7 daily
 * checksum、statement checksum、8PRUR5AGXAQRAV、Sekaligus 分布全部 Matched/PASS）。
 * 这份不是 Gate，不判断 PASS/FAIL，也不重新检查一次准确度——它只做一件事：
 * 每次真的呼叫一次 Gemini，把这次的耗时/结果记一笔，写进一个会跨执行累积的
 * log，让 P50/P90/P95 从「4 个孤立数字」变成一个真的可以看分布的样本。
 *
 * 已知目前 4 个真实数据点：143.3s、179.6s、305.6s（Gate 1）、>360s(超时) x2。
 * 波动 >2.5x，样本太少，现在不该拿这几个数字去决定要不要换 model 或改架构，
 * 只该先累积更多次同一份 fixture 的真实观测。
 *
 * 记录栏位：timestamp / model / fixture / total_execution_seconds /
 * gemini_request_seconds / gemini_call_count / response_received /
 * orders_extracted / checksum_status / error
 *
 * ⚠️ 刻意没有的两个栏位——retry_count、HTTP status：这两个只存在于
 * 127_LLMExtractor.js 的 realLLMExtractorDeps_().httpClient.postJson() 内部的
 * for 迴圈里（429/5xx 重试、1s/2s/4s backoff），从外面（这份测试脚本）唯一能
 * 看到的是整次 postJson 呼叫最后成功还是丟出例外，看不到中间试了几次、每次
 * 是什么状态码——要拿到这两个栏位，只有两条路：(a) 改 127 让它把这些资讯回传
 * 出来，或 (b) 在这份脚本里重新写一份 postJson 的重试逻辑副本，跳过 127 直接
 * 观察。两条路都不是「不碰 127」能达到的，所以先不做，这两个栏位留白。如果
 * 后续真的需要分辨「360s+ 是单次生成慢，还是被 429/503 重试拖长的」，再决定
 * 要不要接受其中一种做法的取舍。
 *
 * 储存位置：沿用既有的 EXTRACTION_EVIDENCE_FOLDER_ID（Script Properties），
 * 在同一个 Drive 资料夹里新增一个纯 append 的 .jsonl 檔（每行一个 JSON
 * 物件），不需要额外建 Sheet 或新的 Script Property。
 *
 * ⚠️ 常数/函式名称刻意跟 999_PhaseB_Baseline_v4.js 的 PHASE_B_W01_FILE_ID /
 * wrapExtractorWithTiming_ 都不同名——这份工具是跟 v4 并存，不是取代它，两份
 * 档案都会留在专案里，同名的 function 在 GAS 共用作用域里不会报错、只会默默
 * 被后加载的那份盖掉，比 const 重复宣告更难发现，所以特意错开命名。
 *
 * 用法：
 * 1. LATENCY_OBS_W01_FILE_ID 填跟 v4 的 PHASE_B_W01_FILE_ID 同一个真实 file ID
 * 2. 跑 runLatencyObservation()——建议接下来几天，能跑几次跑几次（不同时段、
 *    不用刻意连续），每跑一次自动累积一笔到 log 里，最后会印出目前的分布
 * 3. 只想看目前累积的分布、不想再打一次 API，就单独跑 printLatencyStats_()
 */

const LATENCY_OBS_W01_FILE_ID = "YOUR_W01_DRIVE_FILE_ID_HERE";
const LATENCY_OBS_LOG_FILE_NAME_ = 'compliance_os_latency_observations.jsonl';

/** 跟 v4 的 wrapExtractorWithTiming_ 同样的手法（包 deps.extractor.extractOrders，
 * 不碰 142 一行），差别只是把耗时累加进外部传入的 accumulator，而不是直接
 * console.log——这样才能在 runGeminiOrderExtractionWithFallback_ 回来之后，
 * 拿到「这次总共花在 Gemini 上的秒数」，跟 total_execution_seconds 分开记。
 * 两者理论上应该很接近（125/142 的处理已经证实是纯计算、没有网路呼叫），
 * 如果两者差距明显，或 gemini_call_count > 1，代表这次触发了 chunk fallback，
 * 是另一种需要区分的情况，不是单纯的单次呼叫变慢。 */
function wrapExtractorWithLatencyTiming_(rawExtractor, accumulator) {
  return {
    extractOrders(document, pageRange) {
      const t0 = Date.now();
      try {
        const result = rawExtractor.extractOrders(document, pageRange);
        accumulator.geminiSeconds += (Date.now() - t0) / 1000;
        accumulator.callCount += 1;
        return result;
      } catch (err) {
        accumulator.geminiSeconds += (Date.now() - t0) / 1000;
        accumulator.callCount += 1;
        throw err;
      }
    }
  };
}

function runLatencyObservation() {
  const model = PropertiesService.getScriptProperties().getProperty('LLM_EXTRACTOR_MODEL') || '(未设定，使用 createLLMExtractor_ 的预设值)';
  const docInfo = { fileId: LATENCY_OBS_W01_FILE_ID, documentId: 'CMP-DOC-LATENCY-OBS-W01', totalPages: 24 };
  const verifiedIncomeContext = {
    netDeliveryIncome: 1297.60,
    periodStartParts: { year: 2025, month: 12, day: 29 },
    periodEndParts: { year: 2026, month: 1, day: 4 },
    verifiedIncomeId: 'CMP-INCOME-2026-W01-LATENCY-OBS'
  };
  const geminiAccumulator = { geminiSeconds: 0, callCount: 0 };
  const extractor = wrapExtractorWithLatencyTiming_(realLLMExtractor_(), geminiAccumulator);

  const observation = {
    timestamp: new Date().toISOString(),
    model: model,
    fixture: docInfo.documentId,
    total_execution_seconds: null,
    gemini_request_seconds: null,
    gemini_call_count: null,
    response_received: false,
    orders_extracted: null,
    checksum_status: null,
    error: null
  };

  const t0 = Date.now();
  try {
    const result = runGeminiOrderExtractionWithFallback_(docInfo, verifiedIncomeContext, {
      extractor: extractor,
      now: new Date()
    });
    observation.total_execution_seconds = round2_((Date.now() - t0) / 1000);
    observation.gemini_request_seconds = round2_(geminiAccumulator.geminiSeconds);
    observation.gemini_call_count = geminiAccumulator.callCount;
    observation.response_received = true;
    observation.orders_extracted = (result.orderRows || []).length;
    observation.checksum_status = result.allocationStatus;
  } catch (err) {
    observation.total_execution_seconds = round2_((Date.now() - t0) / 1000);
    observation.gemini_request_seconds = round2_(geminiAccumulator.geminiSeconds);
    observation.gemini_call_count = geminiAccumulator.callCount;
    observation.error = String(err && err.message || err);
  }

  appendLatencyObservation_(observation);
  console.log('[LATENCY-OBS] 本次记录：\n' + JSON.stringify(observation, null, 2));
  printLatencyStats_();
}

function appendLatencyObservation_(observation) {
  const folderId = PropertiesService.getScriptProperties().getProperty('EXTRACTION_EVIDENCE_FOLDER_ID');
  const folder = DriveApp.getFolderById(folderId);
  const line = JSON.stringify(observation);
  const files = folder.getFilesByName(LATENCY_OBS_LOG_FILE_NAME_);
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(file.getBlob().getDataAsString() + line + '\n');
  } else {
    folder.createFile(LATENCY_OBS_LOG_FILE_NAME_, line + '\n', MimeType.PLAIN_TEXT);
  }
}

function readAllLatencyObservations_() {
  const folderId = PropertiesService.getScriptProperties().getProperty('EXTRACTION_EVIDENCE_FOLDER_ID');
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(LATENCY_OBS_LOG_FILE_NAME_);
  if (!files.hasNext()) return [];
  return files.next().getBlob().getDataAsString().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function percentile_(sortedAscValues, p) {
  if (sortedAscValues.length === 0) return null;
  const idx = Math.min(sortedAscValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAscValues.length) - 1));
  return sortedAscValues[idx];
}

/** 只看目前累积的分布，不会再打一次 Gemini API。 */
function printLatencyStats_() {
  const all = readAllLatencyObservations_();
  const succeeded = all.filter((o) => o.response_received);
  const times = succeeded.map((o) => o.total_execution_seconds).sort((a, b) => a - b);
  const multiCall = succeeded.filter((o) => o.gemini_call_count > 1).length;

  console.log(`\n========== Latency Reliability Observation：累计 ${all.length} 次（成功 ${succeeded.length} 次，失败/超时 ${all.length - succeeded.length} 次）==========`);
  if (times.length === 0) {
    console.log('目前还没有成功的观测值可以算分布。');
    return;
  }
  console.log(`min=${times[0]}s, max=${times[times.length - 1]}s`);
  console.log(`P50=${percentile_(times, 50)}s, P90=${percentile_(times, 90)}s, P95=${percentile_(times, 95)}s`);
  const over300 = times.filter((t) => t > 300).length;
  const over330 = times.filter((t) => t > 330).length;
  console.log(`>300s 比例: ${over300}/${times.length}（${round2_((100 * over300) / times.length)}%）`);
  console.log(`>330s 比例: ${over330}/${times.length}（${round2_((100 * over330) / times.length)}%）`);
  if (multiCall > 0) console.log(`⚠️ 其中 ${multiCall} 次触发了 chunk fallback（gemini_call_count > 1）——这几次的总耗时不能跟单次呼叫直接比较，看分布时留意一下`);
  const checksumOk = succeeded.filter((o) => o.checksum_status === 'Fully_Allocated').length;
  console.log(`checksum 全部通过(Fully_Allocated)比例: ${checksumOk}/${succeeded.length}`);
  if (times.length < 8) console.log('（样本数还少，这几个百分位数只能当参考，建议先累积到至少 8～10 次成功观测再认真看）');
}
