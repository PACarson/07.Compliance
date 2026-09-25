/**
 * 修正版：把这份 CMP-INCOME-2026-W01 真实 Gemini 证据（6:16:57 AM 那份，
 * 173/173 笔订单、7/7 天 Matched、整周 1297.60）正式写入 Daily_Allocation。
 *
 * 跟原本那版唯一的差异：
 *   原本：consoleRunDailyAllocation(id, { orderExtractor: realEvidenceExtractor })
 *   现在：consoleRunDailyAllocation(id, Object.assign(buildConsoleDeps_(), { orderExtractor: realEvidenceExtractor }))
 *
 * 原因：consoleRunDailyAllocation_ 的 deps 参数是「全有全无」——
 *   const d = deps || buildConsoleDeps_();
 * 只要传了任何 deps 物件，就完全不会再叫 buildConsoleDeps_()，导致
 * sheetReader/truthWriter/now 全部变成 undefined，撞到 d.sheetReader.readAll(...)
 * 就是原本那个 TypeError。用 Object.assign(buildConsoleDeps_(), {...}) 先铺开
 * 真的默认值，再只覆盖 orderExtractor 这一项，其他 5 个 consoleXxx_ 函数、
 * 以及 171_Tests_OperatorConsole.js 里所有既有测试呼叫 consoleRunDailyAllocation_
 * 时，用的都是这个写法。
 *
 * 零 API 消耗：orderExtractor 直接回传已经存在 Drive 里的证据文件内容，
 * 完全不会真的打 Gemini，不会再撞 429。
 */
function applyVerifiedAllocationFromEvidence() {
  console.log(">>> 开始将真实 Gemini 证据数据正式写入 Daily_Allocation 表...");

  const folderId = PropertiesService.getScriptProperties().getProperty('EXTRACTION_EVIDENCE_FOLDER_ID');
  const folder = DriveApp.getFolderById(folderId);
  const targetEvidenceName = "CMP-DOC-20260921-Grab-WeeklyStatement-1790031891844__orders-full__2026-09-24T22-14-06-586Z.json";
  const file = folder.getFilesByName(targetEvidenceName).next();
  const evidence = JSON.parse(file.getBlob().getDataAsString());

  const realEvidenceExtractor = {
    extractOrders(doc, pageRange) {
      return {
        mode: 'structured',
        candidate: evidence.raw_candidate,
        evidence: {
          extractorId: evidence.extractor_id,
          extractionVersion: evidence.extraction_version,
          evidenceFileId: file.getId(),
          finishReason: evidence.finish_reason
        }
      };
    }
  };

  // 关键修正就是这一行：先拿真的 sheetReader/truthWriter/now，只覆盖 orderExtractor。
  const deps = Object.assign(buildConsoleDeps_(), { orderExtractor: realEvidenceExtractor });

  const result = consoleRunDailyAllocation("CMP-INCOME-2026-W01", deps);
  console.log("执行结果:", JSON.stringify(result, null, 2));

  // 预期： { "incomeId": "CMP-INCOME-2026-W01", "status": "Done",
  //          "allocationStatus": "Fully_Allocated", "skipped": false, "rowsWritten": 7 }
}
