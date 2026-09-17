# Production Wiring Slice Report — 110 → Daily Allocation → 160（实作完成）

**承接**：`ArchitectureDecisionConfirmation_2026-09-15.md`（已确认的 Separate Execution Boundary 设计）

---

## 1. Code Inspection（承接先前已完成的部分，实作阶段新确认的一点）

先前的 Code Inspection（`ProductionWiringSlice_Report_2026-09-15.md`）已经确认过 110/142/160 的实际行为，这里不重复。实作过程中新确认一件事：`runGeminiOrderExtractionWithFallback_` 期待的 `verifiedIncomeContext` 形状是 `{verifiedIncomeId, periodStartParts:{year,month,day}, periodEndParts:{year,month,day}, netDeliveryIncome}`（camelCase，期间是拆解过的年月日物件）——跟 Verified_Income 自己栏位的 snake_case、ISO 字符串形状完全不同。142 在这次 wiring 之前从来没有真的接过 Verified_Income 的资料（唯一呼叫方是 143 手写的 fixture 常量），这个转换本来就不存在，是这次 wiring 该补的一块，不是发现了什么设计缺陷。

## 2. Implementation

**Files changed（这一轮，不含之前已经报告过的 ADR-005 closure）**：
- `160_MonthlyProjection.js`
- `161_Tests_MonthlyProjection.js`
- `170_OperatorConsole.js`
- `171_Tests_OperatorConsole.js`

**110_DocumentImport.js：零改动。** 按 Architecture Decision Section 7，Execution A 的 contract 不变——PDF→weekly extraction→validation→Verified Income persistence，不需要为了这次 wiring 加任何代码。

**160_MonthlyProjection.js**：
- `computeMonthlyIncomeSummary_`/`computeYearToDateIncomeSummary_` 新增可选参数 `dailyAllocationRecords`（不给或给空阵列，行为跟 2026-09-15 之前完全一样，回归安全）
- Needs_Allocation 记录先查 142 既有的 `getLatestDailyAllocationRows_` 是不是 Fully_Allocated；是的话订单收入按 `allocation_date` 分月计入 `net_delivery_income`/`net`，非订单收入（Insentif/Tip/Bayaran lain-lain）记入新的 `unallocated_non_order_income`，两者刻意分开，都不会互相污染
- 新增 `partially_allocated` 阵列（订单收入已分月、非订单收入待处理的记录），跟既有 `needs_allocation` 用同一套跨月去重逻辑
- 修了一个实作途中自己发现的 circular require（142 原本就 require 了 160 的 `yearMonthFromIsoDate_`，这次在 160 加一个反向的 require 会让 Node 测试环境视谁先被当入口载入而看到对方不完整的 exports）——改成 call-time 才 require，不是 module 顶层，GAS 环境完全不受影响（本来就没有载入顺序问题）

**170_OperatorConsole.js**：
- 新增 `consoleRunDailyAllocation_(incomeId, deps)`——Execution B 的入口：定位 `verified_income_id`→读对应 Verified_Income/Documents→呼叫既有 `runGeminiOrderExtractionWithFallback_`/`writeDailyAllocationBatch_`→回传明确的结果状态。只调用既有 142 API，没有重新实作任何 daily allocation 逻辑
- 新增 `isoDateStringToParts_`（ISO 字符串→`{year,month,day}`，142 需要但从未存在过的小转换）、`lazyOrderExtractor_`（112 的 `DocumentTextExtractor` 单例只往外传 `.extract()`，没传 `.extractOrders()`，这里另外包一层给 142 用，没有改到 112 半行）
- `consoleRebuildProjections_` 现在多读一次既有的 `Daily_Allocation`，传给 160——纯读取，不会因此触发 Execution B
- 新增公开薄壳 `consoleRunDailyAllocation`，加进 `module.exports`

## 3. Data Flow

```
Execution A（110_DocumentImport.js，不变）
  PDF → extract()（statement 层级）→ 验证 → Verified_Income（durable persisted）

Execution B（170_OperatorConsole.js 新增的 consoleRunDailyAllocation_，独立触发）
  verified_income_id → 读 Verified_Income/Documents
    → runGeminiOrderExtractionWithFallback_()（142，既有，未改）→ extractOrders()
    → writeDailyAllocationBatch_()（142，既有，未改）→ Daily_Allocation

Execution C（160_MonthlyProjection.js，这次改的部分）
  读 Daily_Allocation（既有 getLatestDailyAllocationRows_）→ 按 allocation_date 分月
    → Monthly/YTD 的 net_delivery_income/net
```

## 4. Non-Order Income

Insentif/Tip/Bayaran lain-lain：明确 **UNALLOCATED / NOT DATED**——新增的 `unallocated_non_order_income` 栏位（月度汇总跟 YTD 都有），不猜日期、不按订单比例分摊、不平均分配、不强行塞进任一个月。这次 Slice 完全没有实作这三类的逐笔日期抽取（明确排除在范围外，见 Section 7）。

## 5. Tests

**新增/修改的测试全部通过**——161 新增 Test1-7（用 Gate 2 已验证的真实 W01 每日数字：12月 528.60、1月 769.00）、YTD 去重测试；171 新增 `consoleRunDailyAllocation_` 的 6 种情境（正常成功、找不到记录、非跨月记录 Skip、幂等重跑、142 fallback 吸收的失败、真的逃出 142 之外的例外）。

**全套回归**（16 个功能测试文件逐一执行）：

| 文件 | 结果 |
|---|---|
| 109/111/113/116/118/122/124/126/128/131/141/151/161/171/190 | 全部通过 |
| 143（142 自己的测试） | 101/106，5 个失败——跟这次改动前的原始 zip 逐字比对完全一样，跟这次 wiring 无关（142 这次 Slice 一行没动） |
| 195（24 档案 GAS 载入模拟） | 2 项失败——跟改动前的原始 zip 输出逐字比对完全相同：旧的 `999_PhaseB_Baseline_v2/v3/v4.js` 三份历史档案互相宣告了同名的 const/function，是这次改动之前就存在的遗留问题，不在这次 Slice 的授权范围内（不属于 110/160/170），没有修它 |

**实作过程中自己抓到、修掉的问题**（不是隐藏起来，照实说）：
1. 上面提过的 circular require
2. `verifiedIncomeContext` 一开始按 Verified_Income 自己的栏位名字（snake_case、ISO 字符串）组，实际上 142 要的是完全不同的形状（camelCase、拆解过的日期）——第一次跑测试就直接抛错，照错误訊息追出来修的，不是憑空想到
3. 自己写的一个 YTD 测试断言算错了（用错了 `net` 而不是 `net_delivery_income` 的比例），程式本身是对的，是我的测试预期值算错——独立重新算过一次才改

## 6. Real GAS Verification

**PENDING**——跟先前 ADR-005 closure 那次一样的根本限制：这个环境没有到你真实 GAS 专案的网络路由，这些改动目前只存在于我自己 sandbox 里、你之前上传的 zip 副本上。需要你把改过的 4 个档案贴回真实专案后，自己跑一次才能真正确认。

**至少需要你确认的项目**（照你给的清单）：
- 一个已经确认的非跨月 statement——`consoleGetDashboard`/`consoleRebuildProjections_` 结果不变
- W01 跨月 statement——对一笔真实的、`period_start/period_end` 是 2025-12-29/2026-01-04 的 Verified_Income 记录呼叫 `consoleRunDailyAllocation`，确认真的写进 `Daily_Allocation`
- `verified_income_id` 关联正确
- Monthly Projection 真的读到 `Daily_Allocation`（12月/1月的 net_delivery_income 应该分别显示 528.60/769.00，不是整周消失）
- 重复呼叫 `consoleRunDailyAllocation` 不会 double count（第二次应该 `skipped:true`）

## 7. Idempotency

Test「同一个 income_id 重跑一次」证明：第二次呼叫 `skipped:true`，`Daily_Allocation` 还是只有第一次那 1 笔——完全靠既有 `writeDailyAllocationBatch_` 的 skip-if-Fully_Allocated 守卫，没有为这次 wiring 另外发明任何机制。

## 8. Regression

Test1(wiring)/Test7 明确验证：非跨月月份的汇总、以及跨月但完全没有 `Daily_Allocation` 的既有情境，结果跟 2026-09-15 之前逐位元相同（`assertEqual_` 比对整个回传物件，不是只挑几个欄位）。161/171 原有的全部测试也都还是通过。

## 9. Governance

**ADR-005 = CLOSED，这次没有重新打开，也没有修改。** 你在这个 sandbox 里会看到 `900_Constitution.js` 也显示"有变动"——那是先前已经报告过的 ADR-005 Closure 那一轮的改动（`ADR005_Closure_Report` 那次），不是这次 Production Wiring Slice 动的，这次 Slice 的范围严格只有 Section 2 列的那 4 个档案。没有因为这次改动新建任何 ADR。

## 10. Final Status

- **Implementation: PASS**
- **Local tests: PASS**（新增测试全部通过；143/195 的既有失败逐字比对确认是改动前就存在、跟这次无关，没有被这次改动引入新的失败）
- **Real GAS verification: PENDING**（这个环境没有到你真实专案的网络路由，需要你贴回去自己跑——见 Section 6 清单）
- **Production readiness**：本地实作+测试完成，逻辑正确性有信心，但"production ready"这个判断不能只继承本地测试结果——还没有任何一行在真实 GAS/真实 Sheet 上跑过，Section 6 那几项没有变成你确认过的事实之前，这句话只能停在这里，不能说"可以上生产"。

---

*等你把 4 个改过的档案贴回真实专案、完成 Section 6 的真实验证后，再回来决定这一轮算不算正式 PASS。*
