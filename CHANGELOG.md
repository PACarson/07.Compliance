# Compliance OS — Governance Changelog

完整叙事细节见 `900_Constitution.js` 的 `changelog` 数组（本文件不重复维护第二份完整叙事，只做分类索引 + 指向）。这份文件区分变更类型，方便快速查询"这次变了什么类别的东西"。

## 变更类型

- **Governance changes** — 治理文件本身的建立/整理，不影响代码或数据
- **Architecture changes** — 系统边界、模块职责、execution boundary 等架构层级决定
- **Schema changes** — Sheet 栏位新增/调整
- **Extraction-contract changes** — Gemini prompt/schema/model/抽取范围的变化
- **Production code changes** — 生产代码本身的新增/修改
- **Verification-only changes** — 没有改代码，只是执行了验证并记录结果

## 两种流程

- **Code → Verify → Governance**：先看/先跑代码事实，再写进治理文件。本文件多数条目属于这一种。
- **Governance → Authorized Implementation**：先有明确架构决定（通常 Steven 直接决定），据此授权实作，实作完成后把验证结果写回。2026-09-15 的 Production Wiring Slice（Separate Execution Boundary）是这个流程的例子——Steven 先做架构决定，Claude 才动手实作。

---

## 2026-09-15 — Governance Foundation 建立（本次）

- **类型**: Governance changes
- **流程**: 不适用（整理既有证据，不是新决策）
- 建立 `governance/` 目录（本文件所在目录），恢复 ADR-000～005，建立 Module Catalog/Data Ownership/Verification Status/Architecture Overview
- **Production Code Changes: NONE**（本次任务严格禁止修改生产代码）

## 2026-09-15 — GAS Compatibility Fixes（`111`/`143`/`171` 测试文件）

- **类型**: Production code changes（测试文件本身，非业务逻辑）
- **流程**: Code → Verify → Governance（真实 GAS 执行失败 → 诊断 → 修复 → 记录）
- 详见 `VERIFICATION_STATUS.md` 的 "GAS Compatibility Bugs Found During Real Verification" 一节

## 2026-09-15 — Production Wiring Slice（Separate Execution Boundary）

- **类型**: Architecture changes + Production code changes（`160`/`161`/`170`/`171`）
- **流程**: **Governance → Authorized Implementation**——Steven 先确认架构（Execution A/B/C 分离），Claude 才动手
- 完整设计：`ArchitectureDecisionConfirmation_2026-09-15.md`；完整实作证据：`ProductionWiringSlice_Implementation_2026-09-15.md`
- Schema changes: NONE（沿用既有 `Daily_Allocation`/`Non_Order_Income_Allocation` schema，2026-09-05 已定案）
- Extraction-contract changes: NONE（`extractOrders()` 内部逻辑未改一行）

## 2026-09-06～2026-09-15 — ADR-005 / Gate 2 验证链（CLOSED）

- **类型**: Verification-only changes（直到 2026-09-06 修复 `resolveDateFromDayMonth_` 那一次例外，属于 Production code changes）
- **流程**: Code → Verify → Governance
- 完整时间序见 `adr/ADR-005-gemini-order-extraction.md`

## 2026-09-05～06 — Daily_Allocation/Non_Order_Income_Allocation 持久化

- **类型**: Production code changes（142 新增持久化函数）+ Schema changes（新增两张表）
- **流程**: Code → Verify → Governance
- 真实 GAS+Sheet 验证：2026-09-06（`999_PersistenceVerification.js`）

## 2026-08-24～25 — ADR-004/005 原始决策

- **类型**: Architecture changes + Extraction-contract changes
- **流程**: Governance → Authorized Implementation（Steven 决定方向，142/143/125/127 才据此实作）
- 来源：`compliance-os-governance-draft.md` v0.9

## 2026-08-17～18 — ADR-003 + Real Data Pilot

- **类型**: Architecture changes（ADR-003）+ Production code changes（110/117/140/170）
- 来源：`compliance-os-governance-draft.md` v0.7/v0.8

## Historical date unknown — ADR-000/001/002

- **类型**: Architecture changes
- 来源：`compliance-os-governance-draft.md` §1/§3.2/§4.2；原始决策日期无法从现有证据精确还原
