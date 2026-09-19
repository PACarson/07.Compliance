# Compliance OS — Architecture Overview

来源：实际代码（本次治理建设逐档核对，不是凭文件名推断）+ `compliance-os-governance-draft.md` 的历史记录 + `901_System_Architecture.js`。

## 系统边界

Compliance OS 拥有全部 **Official Records**（income proof、tax、EPF/SOCSO/EIS、路税/JPJ、保险、证件）——不只是"政府相关"，而是"法定/官方/需遵守规定"的数据。

| 相邻系统 | 关系 |
|---|---|
| Rider OS | 透过 `RiderOSAdapter`（ADR-001）提供营运数据给 Reconciliation，可选、非阻断（ADR-003） |
| Finance OS | 只读 Compliance OS 发布的 Verified Income（ADR-002 Official Truth Principle），不直接解析原始数据 |
| Reminder OS | 消费 Compliance Calendar 事件；目前实际串接是 `EventPublisher` 占位实作，**尚未真实串接**（见 VERIFICATION_STATUS.md） |

## CURRENT IMPLEMENTATION — Document Import → Verified Income

```
Google Drive（指定 Folder）
      │
      ▼
Operator Console（170_OperatorConsole.js/.html）── HTMLService，drive_file_id 去重、批次汇入、Retry
      │
      ▼
Document Import（110_DocumentImport.js：runImportPipeline_）
      │
      ▼
DocumentTextExtractor（112，provider factory：llm 默认走 127，ocr 仍是未实作占位）
      │  ── 一次 Gemini 呼叫：extract()（statement 层级周总额，不是逐笔订单）
      ▼
mode='structured' 分支：validateExtractionCandidate_ → normalizeExtractionCandidate_（125）
mode='text' 分支：既有 regex Parser（121_GrabWeeklyParser.js）
      ▼
Verified Income 发布（140_VerifiedIncome.js：verifyAndPublishIncome_，写入 Verified_Income Sheet）
      │
      ▼（非阻断，try/catch）
Reconciliation（130，ADR-003：可选，写 Reconciliation_Log，从不回改 Verified_Income）
```

**110_DocumentImport.js 不直接呼叫 142_DailyOrderAllocation.js**——这是 2026-09-15 的刻意架构决定（Separate Execution Boundary，见 ADR-004），不是遗漏。

## CURRENT IMPLEMENTATION — Daily Allocation（Execution B，独立触发）

```
Console 新增的 consoleRunDailyAllocation_（170，2026-09-15）
      │  输入：一个已存在的 verified_income_id 字符串
      ▼
读取对应 Verified_Income + Documents 记录
      ▼
runGeminiOrderExtractionWithFallback_（142，既有，未改）
      │  ── 独立的第二次 Gemini 呼叫：extractOrders()（逐笔订单/Butiran Tempahan）
      ▼
writeDailyAllocationBatch_（142，既有，未改）→ 写入 Daily_Allocation Sheet
```

**⚠️ 只在本地/Node 测试环境验证过实作正确性，尚未在真实 GAS 环境跑过**（见 VERIFICATION_STATUS.md）。

## CURRENT IMPLEMENTATION — Monthly Projection（Execution C，消费者）

```
consoleRebuildProjections_（170）读取 Verified_Income + Daily_Allocation
      ▼
computeMonthlyIncomeSummary_ / computeYearToDateIncomeSummary_（160，2026-09-15 新增消费逻辑）
      │  跨月周：若有 Fully_Allocated 的 Daily_Allocation，订单收入按 allocation_date 正确分月；
      │  非订单收入（Insentif/Tip/Bayaran lain-lain）明确留在 unallocated_non_order_income，不猜
      ▼
Monthly/YTD 汇总 + Compliance Projection（SOCSO 固定值/EPF·Tax 明确 Not_Configured）
```

`160_MonthlyProjection.js` 这部分逻辑**已经过真实 GAS 验证 PASS**（`161_Tests_MonthlyProjection`，2026-09-15）。

## PROPOSED / NOT YET IMPLEMENTED

- **Order_Allocation、Monthly_Allocation 两张表**（ADR-004 四层模型的另外两层）——完全未开始，未来阶段
- **Insentif/Tip/Bayaran lain-lain 逐笔日期抽取**——ADR-005 明确排除的范围，目前的抽取契约（`extract()` 只回报周总额）本来就不支持
- **Compliance Calendar 真实义务数据**——`150_ComplianceCalendar.js` 引擎本身已实作+测试，但 `Compliance_Calendar` 表里目前没有任何一笔真实义务记录（路税/保险/证件到期日都还没输入）
- **EventPublisher 真实串接 Reminder OS**——目前是占位实作，`901_System_Architecture.js` 自己记录"真实调用方式还没确认"
- **历史 1-9 月 Grab Statement 回填**——未开始，明确要求先完成 Daily Allocation 的真实 GAS 验证才适合动手
- **106_AI_Integration.js**（Tier 3 Intelligence）——刻意保留 Reserved，Blueprint BP-3

## 主要模块依赖关系

见 [MODULE_CATALOG.md](MODULE_CATALOG.md) 每个模块的 Dependencies 栏位。
