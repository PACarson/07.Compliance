/**
 * 999_LatencyReliabilityObservation.js
 *
 * Accuracy Gate 2 = REOPENED / BLOCKED（13 次真实独立呼叫只有 3 次抓对
 * statement 周期，见 142 的 resolveDateFromDayMonth_ 2026-09-06 的修复
 * 和当时的 forensic table）。这份文件不判断 PASS/FAIL、不做任何 accuracy
 * 判定——它只做 observability：每次真的呼叫一次 Gemini，把耗时/结果/
 * extraction scope 记一笔，写进一个跨执行累积的 log。
 *
 * 2026-09-07 新增两个栏位——last_page_seen、promptTokenCount：都是 Gemini
 * 呼叫本来就有回传、只是原本没被记下来的资料，不是新猜出来的东西：
 *
 *   - last_page_seen：extractOrders() 的回传值 result.candidate
 *     .extraction_scope.last_page_seen 本来就有（127_LLMExtractor.js 的
 *     BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_ 本来就要求 Gemini 回报这个栏位）——
 *     完全不用碰 127，直接从 extractOrders() 的回传值读。
 *   - promptTokenCount：extractOrders() 的回传值本身没有这个栏位（127 只
 *     回传 evidenceFileId，不回传 rawResponse/usageMetadata 本身），但 127
 *     自己已经把完整 rawResponse（含 usageMetadata）写进 evidenceFileId
 *     指向的那份 evidence JSON 档——这里只是用 DriveApp 读回同一份 127
 *     自己写好的档案，不是另外打一次 API，也不是复制一份 postJson 逻辑。
 *     读不到（旧格式/档案不存在/栏位缺失）一律 null，不猜测。
 *
 * 只记第一次（全文件，pageRange=null）呼叫的这两个栏位——chunk fallback
 * 那几次本来就只看部分页面，不是这里要观察的信号。
 *
 * 127/125/142/108、Gemini prompt/schema/model/retry/chunk 策略、任何
 * accuracy 判定规则、任何既有 persistence，这次一行都没有改。
 *
 * 已知目前的真实数据点：143.3s、179.6s、305.6s（Gate 1）、>360s(超时) x2，
 * 加上后续 latency observation 累积的样本。波动 >2.5x，样本还不够多，
 * 现在不该拿这几个数字去决定要不要换 model 或改架构，只该先累积更多次
 * 同一份 fixture 的真实观测——这次新增的两个栏位是为了回答另一个问题：
 * 「extraction 错误是否高度集中于 Gemini 没有看到完整 statement」，目前
 * 只有 5 个 forensic 样本、4 个相关，还不足以下结论，只能继续观察。
 *
 * 记录栏位：timestamp / model / fixture / total_execution_seconds /
 * gemini_request_seconds / gemini_call_count / response_received /
 * orders_extracted / checksum_status / last_page_seen / promptTokenCount / error
 *
 * ⚠️ 刻意没有的两个栏位——retry_count、HTTP status：这两个只存在于
 * 127_LLMExtractor.js 的 realLLMExtractorDeps_().httpClient.postJson() 内部的
 * for 迴圈里（429/5xx 重试、1s/2s/4s backoff），从外面（这份测试脚本）唯一能
 * 看到的是整次 postJson 呼叫最后成功还是丟出例外，看不到中间试了几次、每次
 * 是什么状态码——要拿到这两个栏位，只有两条路：(a) 改 127 让它把这些资讯回传
 * 出来，或 (b) 在这份脚本里重新写一份 postJson 的重试逻辑副本，跳过 127 直接
 * 观察。两条路都不是「不碰 127」能达到的，所以先不做，这两个栏位留白。
 *
 * 储存位置：沿用既有的 EXTRACTION_EVIDENCE_FOLDER_ID（Script Properties），
 * 在同一个 Drive 资料夹里的同一个 .jsonl 档案继续 append（不建新 Sheet、
 * 不建新 Script Property、不建新 Drive 资料夹、不动既有 evidence 档案）。
 * 旧记录不会、也不需要 retroactively 补上新栏位——旧记录读回来这两个栏位
 * 是 undefined（不是 null），printLatencyStats_/computeLatencyStats_ 对
 * 这两种情况分开计数，不会因为旧记录缺栏位而整个失败。
 *
 * ⚠️ 常数/函式名称刻意跟 999_PhaseB_Baseline_v4.js 的 PHASE_B_W01_FILE_ID /
 * wrapExtractorWithTiming_ 都不同名——这份工具是跟 v4 并存，不是取代它，两份
 * 档案都会留在专案里，同名的 function 在 GAS 共用作用域里不会报错、只会默默
 * 被后加载的那份盖掉，比 const 重复宣告更难发现，所以特意错开命名。
 *
 * 用法：
 * 1. LATENCY_OBS_W01_FILE_ID 填跟 v4 的 PHASE_B_W01_FILE_ID 同一个真实 file ID
 * 2. 跑 runLatencyObservation()——目标累计约 10-15 次真实成功观测，不用连续
 *    跑、不用刻意凑数，有空时跑就好，每跑一次自动累积一笔到 log 里
 * 3. 只想看目前累积的分布、不想再打一次 API，就单独跑 printLatencyStats_()
 */

const LATENCY_OBS_W01_FILE_ID = "YOUR_W01_DRIVE_FILE_ID_HERE";
const LATENCY_OBS_LOG_FILE_NAME_ = 'compliance_os_latency_observations.jsonl';

/** 跟 v4 的 wrapExtractorWithTiming_ 同样的手法（包 deps.extractor.extractOrders，
 * 不碰 142 一行），差别只是把耗时/scope 累加进外部传入的 accumulator，而不是
 * 直接 console.log——这样才能在 runGeminiOrderExtractionWithFallback_ 回来
 * 之后，拿到这次真正花在 Gemini 上的秒数、以及第一次（全文件）呼叫看到的
 * extraction_scope/evidenceFileId。 */
function wrapExtractorWithLatencyTiming_(rawExtractor, accumulator) {
  return {
    extractOrders(document, pageRange) {
      const t0 = Date.now();
      try {
        const result = rawExtractor.extractOrders(document, pageRange);
        accumulator.geminiSeconds += (Date.now() - t0) / 1000;
        accumulator.callCount += 1;
        if (!pageRange && !accumulator.firstCallCaptured) {
          accumulator.firstCallCaptured = true;
          accumulator.lastPageSeen = extractLastPageSeen_(result);
          accumulator.firstCallEvidenceFileId = (result.evidence && result.evidence.evidenceFileId) || null;
        }
        return result;
      } catch (err) {
        accumulator.geminiSeconds += (Date.now() - t0) / 1000;
        accumulator.callCount += 1;
        throw err;
      }
    }
  };
}

/** 纯函式，只做栏位存取（不碰 DriveApp），方便 Node 测。任何一层缺失/
 * 类型不对都回传 null，不猜测、不抛错。 */
function extractLastPageSeen_(extractOrdersResult) {
  const scope = extractOrdersResult && extractOrdersResult.candidate && extractOrdersResult.candidate.extraction_scope;
  return (scope && typeof scope.last_page_seen === 'number') ? scope.last_page_seen : null;
}

/** 纯函式：从一份已经读进来、parse 好的 evidence record 物件里取
 * promptTokenCount。跟「怎么读到这份 record」（DriveApp）分开，方便 Node 测。 */
function extractPromptTokenCountFromEvidenceRecord_(evidenceRecord) {
  const usage = evidenceRecord && evidenceRecord.raw_response && evidenceRecord.raw_response.usageMetadata;
  return (usage && typeof usage.promptTokenCount === 'number') ? usage.promptTokenCount : null;
}

/** 真的去 Drive 读回 127 自己已经写好的 evidence 档——只能在真 GAS 环境跑，
 * Node 测不了。读不到（旧格式、档案不存在、栏位缺失、evidenceFileId 本身
 * 是 null）一律回传 null，不让整个 observation 因此失败。 */
function readPromptTokenCountFromEvidenceFile_(evidenceFileId) {
  if (!evidenceFileId) return null;
  try {
    const file = DriveApp.getFileById(evidenceFileId);
    const record = JSON.parse(file.getBlob().getDataAsString());
    return extractPromptTokenCountFromEvidenceRecord_(record);
  } catch (err) {
    return null;
  }
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
  const geminiAccumulator = { geminiSeconds: 0, callCount: 0, firstCallCaptured: false, lastPageSeen: null, firstCallEvidenceFileId: null };
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
    last_page_seen: null,
    promptTokenCount: null,
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
    observation.last_page_seen = geminiAccumulator.lastPageSeen;
    observation.promptTokenCount = readPromptTokenCountFromEvidenceFile_(geminiAccumulator.firstCallEvidenceFileId);
  } catch (err) {
    observation.total_execution_seconds = round2_((Date.now() - t0) / 1000);
    observation.gemini_request_seconds = round2_(geminiAccumulator.geminiSeconds);
    observation.gemini_call_count = geminiAccumulator.callCount;
    observation.last_page_seen = geminiAccumulator.lastPageSeen;
    observation.promptTokenCount = readPromptTokenCountFromEvidenceFile_(geminiAccumulator.firstCallEvidenceFileId);
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

/** 纯函式：给定已经读进来的全部 observation 物件阵列，算出统计——跟「怎么
 * 读到这些记录」（Drive）分开，方便 Node 测，尤其是旧记录没有新栏位时的
 * 向后兼容性。不判断 PASS/FAIL，不定义任何 threshold——只有既定的
 * min/max/P50/P90/P95/>300s/>330s 比例，加上第 9 点允许的 scope 分布计数
 * （complete/incomplete/unknown + 原始数值分布），同样不判断好坏、不下结论。 */
function computeLatencyStats_(allObservations) {
  const succeeded = allObservations.filter((o) => o.response_received);
  const times = succeeded.map((o) => o.total_execution_seconds).sort((a, b) => a - b);
  const multiCall = succeeded.filter((o) => o.gemini_call_count > 1).length;
  const checksumOk = succeeded.filter((o) => o.checksum_status === 'Fully_Allocated').length;

  // scope 分布——旧记录（加这两个栏位之前写的）读回来 last_page_seen 会是
  // undefined（不是 null，JSONL 里根本没有这个 key），跟「有读、但读到 null」
  // 分开算，两种都不算进 complete/incomplete
  const scopeKnown = succeeded.filter((o) => typeof o.last_page_seen === 'number');
  const scopeComplete = scopeKnown.filter((o) => o.last_page_seen >= 24);
  const scopeIncomplete = scopeKnown.filter((o) => o.last_page_seen < 24);
  const scopeUnknown = succeeded.length - scopeKnown.length;
  const tokenKnown = succeeded.filter((o) => typeof o.promptTokenCount === 'number');

  return {
    totalObservations: allObservations.length,
    succeededCount: succeeded.length,
    failedCount: allObservations.length - succeeded.length,
    min: times.length ? times[0] : null,
    max: times.length ? times[times.length - 1] : null,
    p50: percentile_(times, 50),
    p90: percentile_(times, 90),
    p95: percentile_(times, 95),
    over300Count: times.filter((t) => t > 300).length,
    over330Count: times.filter((t) => t > 330).length,
    totalTimedCount: times.length,
    multiCallCount: multiCall,
    checksumOkCount: checksumOk,
    scope: {
      completeCount: scopeComplete.length,
      incompleteCount: scopeIncomplete.length,
      unknownCount: scopeUnknown,
      lastPageSeenValues: scopeKnown.map((o) => o.last_page_seen),
      promptTokenCountValues: tokenKnown.map((o) => o.promptTokenCount)
    }
  };
}

/** 只看目前累积的分布，不会再打一次 Gemini API。 */
function printLatencyStats_() {
  const all = readAllLatencyObservations_();
  const stats = computeLatencyStats_(all);

  console.log(`\n========== Latency Reliability Observation：累计 ${stats.totalObservations} 次（成功 ${stats.succeededCount} 次，失败/超时 ${stats.failedCount} 次）==========`);
  if (stats.totalTimedCount === 0) {
    console.log('目前还没有成功的观测值可以算分布。');
    return;
  }
  console.log(`min=${stats.min}s, max=${stats.max}s`);
  console.log(`P50=${stats.p50}s, P90=${stats.p90}s, P95=${stats.p95}s`);
  console.log(`>300s 比例: ${stats.over300Count}/${stats.totalTimedCount}（${round2_((100 * stats.over300Count) / stats.totalTimedCount)}%）`);
  console.log(`>330s 比例: ${stats.over330Count}/${stats.totalTimedCount}（${round2_((100 * stats.over330Count) / stats.totalTimedCount)}%）`);
  if (stats.multiCallCount > 0) console.log(`⚠️ 其中 ${stats.multiCallCount} 次触发了 chunk fallback（gemini_call_count > 1）——这几次的总耗时不能跟单次呼叫直接比较，看分布时留意一下`);
  console.log(`checksum 全部通过(Fully_Allocated)比例: ${stats.checksumOkCount}/${stats.succeededCount}`);

  console.log(`\n--- extraction scope（2026-09-07 新增，只留存证据，不做任何判定/threshold） ---`);
  console.log(`scope known(last_page_seen 有值): ${stats.scope.completeCount + stats.scope.incompleteCount}，complete(=24页): ${stats.scope.completeCount}，incomplete(<24页): ${stats.scope.incompleteCount}，unknown(旧记录没有这个栏位，或这次读不到): ${stats.scope.unknownCount}`);
  console.log(`last_page_seen 原始分布: ${JSON.stringify(stats.scope.lastPageSeenValues)}`);
  console.log(`promptTokenCount 原始分布: ${JSON.stringify(stats.scope.promptTokenCountValues)}`);

  if (stats.totalTimedCount < 8) console.log('（样本数还少，这几个百分位数只能当参考，建议先累积到至少 8～10 次成功观测再认真看）');
}

if (typeof module !== 'undefined') {
  module.exports = {
    wrapExtractorWithLatencyTiming_,
    extractLastPageSeen_,
    extractPromptTokenCountFromEvidenceRecord_,
    percentile_,
    computeLatencyStats_
  };
}
