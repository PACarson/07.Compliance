# Compliance OS — Data Ownership

逐表分类，不只凭 Sheet 名称认定。

| 表 | Authoritative Source | Derived | Evidence/Audit | Projection/Reporting | Temporary Execution |
|---|---|---|---|---|---|
| `Documents` | ✅（哪些文件被 import 过） | | | | |
| `Verified_Income` | ✅（Finance OS 唯一读取的官方事实，ADR-002） | | | | |
| `Reconciliation_Log` | | ✅（对账是 Verified_Income 之外的衍生判断，ADR-003） | | | |
| `Daily_Allocation` | | ✅（从 Verified_Income + Gemini order-level 抽取衍生） | | | |
| `Non_Order_Income_Allocation` | | ✅（同上，尚未实作） | | | |
| `Order_Allocation` | | — | | | 未建表 |
| `Monthly_Allocation` | | — | | | 未建表，职责暂由 160 的 compute-on-demand 承担 |
| `Compliance_Calendar` | ✅（义务的定义本身，建立时写一次不可变） | | | | |
| `Compliance_Completions` | ✅（完成这件事本身是事实） | | | | |
| Gemini raw response / evidence JSON（Drive） | | | ✅ | | |
| 原始 PDF（Drive） | ✅（CMP-P5：印刷内容是权威值） | | | | |
| Monthly/YTD 汇总（160 的回传值） | | | | ✅（compute-on-demand，不落地存表） | |
| `partially_allocated`/`unallocated_non_order_income`（160 回传值） | | | | ✅ | |

## 说明

- **Authoritative source data**：这个表/数据本身就是事实，不是从别处算出来的
- **Derived data**：从 authoritative source 计算/衍生出来的，本身不是独立真相
- **Evidence/audit data**：留痕用，不参与业务计算本身
- **Projection/reporting data**：查询时现算，EP4 原则——不落地存成 rollup 表，避免"单一事实来源"被破坏成两份实作
- **Temporary execution data**：执行期间的暂存，不持久化

## PROPOSED — REQUIRES APPROVAL

- Order_Allocation、Monthly_Allocation 两张表的所有权分类目前只是**推断**（基于 ADR-004 原始设计意图），两张表都还没建，这里的分类是**建议**，不是已批准的架构规则——真的要建表时需要 Steven 重新确认

## 不属于本次治理建设范围

Rider OS / Finance OS / Reminder OS 自己拥有的表，不在这份文件的记录范围内（跨 OS 边界本身见 ARCHITECTURE.md 的"系统边界"一节）。
