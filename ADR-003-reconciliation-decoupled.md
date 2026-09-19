# ADR-003: Reconciliation 与 Verified Income 发布解耦

- **Status**: ACCEPTED / IMPLEMENTED（历史决策，恢复记录）
- **Historical date**: 2026-08-17（批准并实作）
- **Recovery evidence**: `compliance-os-governance-draft.md` §2.5、§9（v0.7）；`130_Reconciliation.js`（`runReconciliationForWeek_`、`getCurrentReconciliationStatus_`）；`110_DocumentImport.js`（`runImportPipeline_` 里 Reconciliation 包在 try/catch，失败只记 WARN）；`900_Constitution.js` CMP-P12

## Context

原本设计里，Verified Income 的发布依赖 Rider OS 数据先完成对账（Reconciliation 是前提条件）。但 Steven 明确要求 v1 不依赖 Rider OS 就能独立运行——Rider OS 当时没有发布数据的能力（见 ADR-001），如果 Reconciliation 是硬性前提，Compliance OS 会完全卡住。

## Decision

Reconciliation 从"必要前提"改成"可选、非阻断的事后注解"：
- Verified Income 的发布不等待、不依赖 Reconciliation 结果
- Reconciliation 跑完只新增一笔 `Reconciliation_Log`（append-only，UCR6 风格），从不回头修改 Verified_Income
- 查某一周"现在"的对账状态，是从 `Reconciliation_Log` 查询时现算最新一笔（`getCurrentReconciliationStatus_`），不是 Verified_Income 自己的栏位
- 没有 Rider OS 数据时，也会写一笔 `Not_Performed` 状态的记录，不是整个跳过不留痕
- `Reconciliation_Log` 的状态词汇：`Not_Performed`/`Matched`/`Discrepancy_Flagged`

## Rationale

Verified_Income 的 TruthWriter（UCR6）本来就只支援 append、不支援原地更新——原本设想在 Verified_Income 加一个 `reconciliation_status` 栏位，写代码时才发现这个栏位没办法维护成最新值，所以改成不加这个栏位，对账状态改为衍生查询。

## Consequences

Compliance OS 核心链路简化为 `Import→Parse→VerifiedIncome→（可选）Reconciliation→ComplianceCalendar`；Rider OS 的依赖从"必要"降级为"可选"，即使 Rider OS 从未发布任何数据，Compliance OS 也能完整运作。

## Verification

110/130/140 与对应测试已实作，Node 模拟 + 全套 `runAllXTests()` 重跑通过（2026-08-17）。

## Related

ADR-001
