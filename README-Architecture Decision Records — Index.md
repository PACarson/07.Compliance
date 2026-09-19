# Architecture Decision Records — Index

| ID | Title | Status |
|---|---|---|
| [ADR-000](ADR-000-independent-project.md) | Compliance OS 是独立 GAS 专案 | ACCEPTED |
| [ADR-001](ADR-001-rider-os-adapter.md) | Reconciliation 透过 RiderOSAdapter 读取 Rider OS | ACCEPTED（前提关系已被 ADR-003 取代，Adapter 模式本身未变）|
| [ADR-002](ADR-002-official-truth-principle.md) | Official Truth Principle | ACCEPTED |
| [ADR-003](ADR-003-reconciliation-decoupled.md) | Reconciliation 与 Verified Income 解耦 | ACCEPTED / IMPLEMENTED |
| [ADR-004](ADR-004-daily-order-level-allocation.md) | Daily Order-Level Allocation 四层数据模型 | ACCEPTED / PARTIALLY IMPLEMENTED |
| [ADR-005](ADR-005-gemini-order-extraction.md) | Gemini Extraction Adapter（订单层级）| CLOSED |

全部 6 项都是**历史决策的恢复记录**，不是这次治理建设新做的决定——本次治理建设没有批准、拒绝、或重新打开任何一项。ADR-000/001/002 的原始决定日期无法从现有证据精确还原，标记为 "Historical date unknown"；ADR-003/004/005 有明确的原始日期与之后的演进记录。

## 编号规则

三位数递增，不因整理治理文件而重新编号或补空号。下一个新 ADR 是 ADR-006。

## 状态词汇

- `PROPOSED` — 提议中，未批准
- `ACCEPTED` — 已批准（架构/方向层级），不代表已实作
- `IMPLEMENTED` — 代码已写，不代表已经过真实环境验证
- `VERIFIED` — 已经过真实环境（GAS/Sheet/API）验证
- `REJECTED` — 提议后未采用
- `SUPERSEDED` — 被后续 ADR 取代
- `DEPRECATED` — 曾经有效，现在不再适用
- `CLOSED` — 这个专案既有的状态词，含义等同于"该 ADR 关注的核心问题已经过完整验证链确认"（目前只有 ADR-005 用这个状态）——**不要跟 `IMPLEMENTED`/`VERIFIED` 混用或互相替代**，`CLOSED` 前必须先有 `VERIFIED` 等级的证据，`IMPLEMENTED` 不等于 `CLOSED`

`ACCEPTED`/`IMPLEMENTED`/`VERIFIED` 可以同时对同一个 ADR 的不同部分成立（例如 ADR-004：Daily_Allocation 层 `VERIFIED`，Order_Allocation 层完全没开始）——**逐层/逐部分标注状态，不要用一个词概括整条 ADR**，见各 ADR 文件里的分层说明。

## 如何提出新 ADR

1. 先确认这真的是架构/方向层级的决定，不是一般的代码改动
2. 写 Context / Decision / Rationale / Alternatives / Consequences / Evidence
3. 状态先标 `PROPOSED`，等 Steven 确认后改 `ACCEPTED`
4. 代码写完标注 `IMPLEMENTED`，真实环境验证过再标 `VERIFIED`
5. 状态变更本身不是代码验证——改状态字不会让代码变得更正确，只是记录事实

## 如何记录被取代/拒绝/淘汰的决策

不删除旧 ADR。新增 `Superseded by: ADR-XXX` 或 `Rejected because: ...` 字段，保留原文——历史决策本身是证据，删掉就丢失了"为什么当初这样决定"的脉络。
