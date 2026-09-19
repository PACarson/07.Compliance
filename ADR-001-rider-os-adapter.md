# ADR-001: Reconciliation Engine 透过 RiderOSAdapter 读取 Rider OS 数据

- **Status**: ACCEPTED（历史决策，恢复记录）——**注意**：这项决策本身没有被推翻，但它原本假设的"Rider OS 数据是 Verified Income 发布的前提条件"这个关系，已经被 ADR-003 明确取代（Reconciliation 改成可选、非阻断）。本条目只记录 Adapter 模式本身，不代表 ADR-001 原文的全部内容在 ADR-003 之后都还成立
- **Historical date**: Unknown exact date — 早于 v0.6（同 ADR-000）
- **Recovery evidence**: `compliance-os-governance-draft.md` §4.2；`123_RiderOSAdapter.js`（实作，占位版）；`124_Tests_RiderOSAdapter.js`

## Context

Compliance OS 的 Reconciliation Engine 需要 Rider OS 的营运数据（daily estimate、reward sheet）跟 Grab Statement 对账，但 Rider OS 是另一个独立专案，且当时还没有发布这类数据的能力。

## Decision

- Rider OS 透过事件 `RIDER_WEEKLY_ESTIMATE_READY`（周结算完成后，不是逐日）通知 Compliance OS
- Compliance OS 端用 `RiderOSAdapter`（UCR7 Adapter 模式）作为唯一的读取入口，不直接耦合 Rider OS 的内部实作
- Rider OS 尚未具备这个发布能力时，Adapter 内部先用占位实作——这是外部依赖，不阻塞 Compliance OS 自己的开发

## Rationale

Adapter 模式让 Rider OS 未来变更内部实作时，Compliance OS 不需要跟着改；占位实作让两个专案的开发进度互相解耦。

## Consequences

`123_RiderOSAdapter.js` 目前仍是占位版（`createRiderOSAdapter_`/`gasPropertiesStore_`），真实的 Rider OS 发布能力尚未确认存在。ADR-003 实作后，这个依赖从"必要"降级为"可选"——见 ADR-003。

## Related

ADR-000, ADR-003
