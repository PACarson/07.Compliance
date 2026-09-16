# Production Wiring Slice Report — 110 → Daily Allocation → 160

**Final Status：BLOCKED — ARCHITECTURAL DECISION REQUIRED**

在完成 Section 3 要求的完整 code reading 之后，命中 Section 5 明确列出的那个 STOP 条件本身——不是我判断要不要 STOP，是读完代码后，Section 5 描述的情况就是真的。没有写任何 110/160 的实作代码。

---

## 1. Code Inspection

**110（`runImportPipeline_`）实际流程**：`importDocument_`（去重+写 Documents）→ `DocumentTextExtractor.extract({fileId, mimeType, documentId})` → 若 `mode='structured'`：`validateExtractionCandidate_` → `normalizeExtractionCandidate_` → `verifyAndPublishIncome_`（写 Verified_Income）→ `runReconciliationForWeek_`（non-blocking）。**全程只有一次 Gemini 呼叫**，经 112 路由到 127 的 `extract()`——statement 层级摘要 schema（周总额），不是逐笔订单。110 里没有任何一处提到 142、`extractOrders`、或 `runGeminiOrderExtractionWithFallback_`。

**142（`runGeminiOrderExtractionWithFallback_`）实际流程**：唯一的 production-ready 顶层入口。第一步（第724行）就是 `deps.extractor.extractOrders(document, null)`——**它自己独立呼叫 Gemini**，用的是 `extractOrders()`，跟 110 用的 `extract()` 是不同的 schema/prompt（逐笔订单 vs 周总额）。验证失败才 fallback 到切页重试（同样呼叫 `extractOrders`）。往下 `candidateFromGeminiOrderRow_` 是纯函数，只吃"已经是 Gemini order-schema 形状"的资料——没有任何入口能接受"已经用其他方式取得的逐笔资料"绕过这次 extractOrders 呼叫。

**160（`computeMonthlyIncomeSummary_`/`computeYearToDateIncomeSummary_`）实际流程**：只读 `verifiedIncomeRecords`，透过 `computeMonthlyAllocation_`（纯粹只看 `period_start`/`period_end`）分类 Full/Needs_Allocation/Missing_Period。Needs_Allocation 的记录金额**完全不进 net**，只出现在回传的 `needs_allocation` 列表里给人看。全文件搜寻 `Daily_Allocation`/`Non_Order_Income`/142 的任何 export，**零匹配**。

**为什么 142 之前没接上**——不是遗漏，是文档明确记录的分期决定：142 檔頭注释写着这版只做"Phase 3：pure functions + tests，不接 108/110"；后来加的 persistence 段落注释也写"Order_Allocation/Monthly_Allocation 不在这次范围内，Steven 明确只列了这两张表"——接上 110/160 一直是被明确列为下一阶段，不是被忘记。这次任务就是那个阶段。

---

## 2. 命中 Section 5 的 STOP 条件

Section 5 的判断句「如果 110 已经获得足够的 extraction result」在这里是假：110 现有的 extraction（周总额）不含任何逐日/逐笔资料，142 的 daily allocation 需要的是完全不同形状的资料，两者不能互相代替。「或使用现有 142 API 所支持的调用方式」——现有 142 API 唯一的顶层入口就是会自己打一次 `extractOrders()` 的那个函数，没有第二种不需要额外呼叫的调用方式。

**按要求逐项报告**：

- **为什么无法复用已有 extraction**：110 的 `extract()` 回传 statement 层级周总额；142 需要的是逐日/逐笔 Butiran Tempahan 明细（`extractOrders()` 的 schema）。这是两个不同的 Gemini 呼叫，不是同一份资料的两种读法。
- **会产生多少额外 Gemini calls**：不是每份 statement 都多一次——只有**跨月周**才需要 daily allocation（单月周现有流程已经处理得很好，不受影响）。Grab 周是周一到周日，跟日历月天然不对齐，稳态下大约每个月出现一次跨月周，不是每周。这次要回填的 1-9 月，粗估约 8-9 次跨月周，也就是约 8-9 次额外的 `extractOrders()` 呼叫，不是 9 个月份 × 每周一次。
- **对 GAS 6-minute limit 的影响**：这个刚好有真实数据——Gate 2 那 10 次真实呼叫，`extractOrders()` 单次执行时间落在 115-289 秒（最长将近 4.8 分钟）。如果这次呼叫跟 110 现有的 `extract()`+验证+写入+Reconciliation 放在同一次 `runImportPipeline_` 执行里顺序执行，跨月周那份 statement 有实际风险跑到接近甚至超过 GAS 的 360 秒硬限——这不是理论上的谨慎，是根据刚验证过的真实延迟数字算出来的。

---

## 3. 需要你决定的（不是我该自己选的）

三个方向，各有取舍，没有先做掉：

**A. 把 daily allocation 拆成独立的第二步，不塞进 `runImportPipeline_`**——Needs_Allocation 一出现，就是一个可以之后（另一次呼叫、另一个 6 分钟预算）单独处理的信号，不占用主 import 那次执行的时间预算。缺点是不是"一次 import 就全自动做完"，多一个步骤。

**B. 直接塞进同一次 `runImportPipeline_`，跨月周才触发**——全自动，但会真的偶尔逼近或超过 6 分钟限制（不是假设，是刚测出来的真实延迟范围）。

**C. 长期看，127/125 如果哪天让 `extract()` 一次就回传逐日明细，两次呼叫会变成一次**——但这会动到 127/125，这两个文件这次 Slice 明确不准动，所以只能记下来，不是这次能选的选项。

我倾向 A（这次项目里 Reconciliation 也是类似的"独立、非阻断"处理方式，风格上一致），但这是要花你确认的架构决定，不是我该自己拍板的实作细节。

---

## 4. 顺便抓到的一个算术问题

你在 Section 14 给的验证数字，我按你自己的指示重新独立算了一次七个每日金额：

- 12月（29+30+31日）：157.90+196.00+174.70 = **RM528.60**（跟你给的一致）
- 1月（1+2+3+4日）：187.60+162.40+213.50+205.50 = **RM769.00**（你给的是 RM669.00，差了 100）
- 合计：**RM1,297.60**（跟已验证过的周总额吻合；你给的 Total RM1,197.60 是沿用了上面那个 669 的误差）

后面如果真的写 Test 2 的断言，正确数字是 December RM528.60 / January RM769.00 / Total RM1,297.60，不是原文那三个数字。

---

## 5. 尚未进行的部分（照 Section 5 的 STOP 指示，没有往下做）

Implementation / Data Flow / Tests / Real GAS Verification / Idempotency / Regression：均未开始，等 Section 3 的方向决定后才会有内容可以报告。

**Governance**：ADR-005 = CLOSED，未修改，未重开。127/125/142/108/999/900/901 全部逐字节未动——本轮只读不写。
