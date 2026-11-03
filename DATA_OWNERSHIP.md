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

- **Contribution Planning S1 的四张表**（`Official_Evidence`、`Contribution_Plan_Lines`、`Official_Payments`、`Payment_Links`；见 `S1_Final_Design_2026-10-31.md` §5；2026-11-02 登记）——**都还没建表、没有批准**。下表的分类是**提议**；表名本身也未定（D-S1-7，默认「待确认」），真的要建表时需要 Steven 重新确认：

| 表（提议） | Authoritative Source | Derived | Evidence/Audit | Projection/Reporting | Temporary Execution |
|---|---|---|---|---|---|
| `Official_Evidence` | ✅（登记了哪些官方文件 / 参考号；文件本身在 Drive，CMP-P5） | | | | |
| `Contribution_Plan_Lines` | ✅（用户的计划决定） | | | | |
| `Official_Payments` | ✅（官方记录里的付款事实；其中**覆盖期是陈述值**，不是系统推算） | | | | |
| `Payment_Links` | ✅（用户确认的「付款 ↔ 计划」对应关系） | | | | |
| 计划 vs 实际的对照结果、覆盖状态查询 | | | | ✅（查询时现算，不落地存表，EP4） | |

- 栏位级的事实分类（提议）：**官方文件记载的事实 / 用户主动申报的事实 / 系统计算结果 / 尚未核实的政策信息**四类严格分开；**用户断言不得自动升级为已核实的官方事实**（后一句是 Steven 来信的要求，已确认；栏位级的分类本身是提议）。
- 第 2 张「用户状态 / 政策事实断言」表**不在 S1**（D-S1-1，默认推迟、待确认），所以这里没有登记；备选规格在 `S1_Final_Design_2026-10-31.md` 附录 A。

## 不属于本次治理建设范围

Rider OS / Finance OS / Reminder OS 自己拥有的表，不在这份文件的记录范围内（跨 OS 边界本身见 ARCHITECTURE.md 的"系统边界"一节）。
