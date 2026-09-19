# ADR-004: Daily Order-Level Allocation 四层数据模型

- **Status**: ACCEPTED（模型本身）/ **PARTIALLY IMPLEMENTED**（见下方分层说明，不要把整条 ADR 当成单一状态）
- **Historical date**: 2026-08-24～25（原始设计），本 ADR 的实作/验证状态持续演进至 2026-09-15
- **Recovery evidence**: `compliance-os-governance-draft.md` §2.7、§8（原始决策记录）；`142_DailyOrderAllocation.js`/`143_Tests_DailyOrderAllocation.js`；`900_Constitution.js` ADR-004 条目（changelog 2026-08-21 起数笔、2026-09-15 补充）；`901_System_Architecture.js` 142/160/170 条目

## Context

Grab Weekly Statement 是周结（Isnin-Ahad），但会计月份是日历月——一周如果横跨两个月，原本的做法是整周判 `Needs_Allocation`、完全排除在 Monthly/YTD 之外，导致真实存在的收入"消失"在月度报表里。

## Decision

引入四层数据模型，取代整周粗颗粒的 `Needs_Allocation`：

1. **Order_Allocation** — 逐笔订单层级
2. **Non_Order_Income_Allocation** — Insentif/Tip/Bayaran lain-lain 等非订单收入
3. **Daily_Allocation** — 逐日汇总（本 ADR 目前唯一有实作+持久化+生产连接的一层）
4. **Monthly_Allocation** — 月度汇总（目前由 `160_MonthlyProjection.js` 承担部分职责，未独立建表）

## Implementation Status（逐层，不要合并成一句话）

| 层 | 持久化实作 | Node 测试 | 真实 GAS/Sheet 验证 | 生产接入（110/160/170）|
|---|---|---|---|---|
| Order_Allocation | ❌ 未开始 | — | — | — |
| Non_Order_Income_Allocation | ✅（2026-09-05） | ✅ | ✅（2026-09-06） | ❌ 明确排除在 2026-09-15 wiring 范围外，见 ADR-005 |
| **Daily_Allocation** | ✅（2026-09-05） | ✅ | ✅（2026-09-06，持久化本身） | ⚠️ 2026-09-15 新增 `consoleRunDailyAllocation_`（170）+ 消费逻辑（160）——**只在本地/Node 测试环境验证，未在真实 GAS 环境跑过** |
| Monthly_Allocation | ❌ 未独立建表（职责暂由 160 承担） | — | — | — |

## Rationale

Order_Allocation 需要逐笔订单层级的抽取（见 ADR-005），比整周粗颗粒的做法复杂得多；先落地对准确性影响最大的 Daily_Allocation（订单收入按日汇总），Non_Order_Income 的逐笔日期分配明确列为已知限制、不是这次实作范围（见 ADR-005 与 `VERIFICATION_STATUS.md`）。

## Consequences

- 跨月周的订单收入（net_delivery_income）现在**理论上**可以按 `allocation_date` 正确分月计入 Monthly/YTD——但截至本文件建立时，这条路径尚未经过真实 GAS 验证，不能宣称"已解决"
- 跨月周的非订单收入（Insentif/Tip/Bayaran lain-lain）明确保持 `unallocated_non_order_income`，不猜测、不按比例分摊、不强行塞进某个月
- Execution Boundary：Daily Allocation 的触发（Execution B）刻意跟 Document Import（Execution A）分开成独立的 GAS execution，不在同一次执行内完成——理由与证据见下方 Production Wiring 部分

## Production Wiring（2026-09-15，本次治理建设前最新一轮实作）

- Steven 正式确认架构：**Separate Execution Boundary**（Execution A=110 不变、Execution B=142 独立入口、Execution C=160 消费者）
- 新增：`consoleRunDailyAllocation_`/`consoleRunDailyAllocation`（170），`isoDateStringToParts_`、`lazyOrderExtractor_`（170，本地小工具，未改 112）
- `160_MonthlyProjection.js` 新增消费 `Daily_Allocation` 的逻辑（`partially_allocated`、`unallocated_non_order_income`）
- 完整设计依据：`ArchitectureDecisionConfirmation_2026-09-15.md`；完整实作/测试证据：`ProductionWiringSlice_Implementation_2026-09-15.md`
- **真实 GAS 验证进行中**：`161_Tests_MonthlyProjection`（160 的测试）已经真实 GAS 跑过并 PASS；`171_Tests_OperatorConsole`（170 的测试，含新增的 `consoleRunDailyAllocation_` 测试）在真实 GAS 环境发现并修复了两类环境相容性问题（详见 `VERIFICATION_STATUS.md`），修复后的版本尚待 Steven 重新在真实 GAS 确认

## Related

ADR-002, ADR-005
