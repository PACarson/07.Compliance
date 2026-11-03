# Architecture Decision Records — Index

| ID | Title | Status |
|---|---|---|
| [ADR-000](ADR-000-independent-project.md) | Compliance OS 是独立 GAS 专案 | ACCEPTED |
| [ADR-001](ADR-001-rider-os-adapter.md) | Reconciliation 透过 RiderOSAdapter 读取 Rider OS | ACCEPTED（前提关系已被 ADR-003 取代，Adapter 模式本身未变）|
| [ADR-002](ADR-002-official-truth-principle.md) | Official Truth Principle | ACCEPTED |
| [ADR-003](ADR-003-reconciliation-decoupled.md) | Reconciliation 与 Verified Income 解耦 | ACCEPTED / IMPLEMENTED |
| [ADR-004](ADR-004-daily-order-level-allocation.md) | Daily Order-Level Allocation 四层数据模型 | ACCEPTED / PARTIALLY IMPLEMENTED |
| [ADR-005](ADR-005-gemini-order-extraction.md) | Gemini Extraction Adapter（订单层级）| CLOSED |
| [ADR-006](ADR-006-pdf-import-recovery-center.md) | PDF Import Recovery Center | PROPOSED（架构）/ 后端 IMPLEMENTED / UI IMPLEMENTED（2026-10-07）——后端与 UI 都只经 Node 测试，未 VERIFIED |

前 6 项是**历史决策的恢复记录**，不是治理建设新做的决定——本次治理建设没有批准、拒绝、或重新打开任何一项。ADR-000/001/002 的原始决定日期无法从现有证据精确还原，标记为 "Historical date unknown"；ADR-003/004/005 有明确的原始日期与之后的演进记录。**ADR-006 不是历史恢复记录，是 2026-10-04 这个窗口里真正新增的 ADR**——见该文件本身的 Status 行，分层状态不要简化成一个词。

## 编号规则

三位数递增，不因整理治理文件而重新编号或补空号。下一个新 ADR 是 ADR-007。

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

## 草案（DRAFT，未编号；**尚未批准**）——Contribution Planning & Official Payment Records

> **2026-11-02 登记**（Steven 要求把本窗口形成的决定、提议与待决事项写入治理文件）。这一节**只是登记**：下表每一项的状态都是 `PROPOSED`（草案）——**没有**正式 ADR 编号，**没有**被批准，**没有**任何实作，**没有**任何层级的验证。按上面「如何提出新 ADR」第 3 步，只有 Steven 确认后才能改成 `ACCEPTED` 并指定编号。**下一个正式编号仍是 ADR-007——本节没有占用它。**

| 草案标签 | 标题 | 状态 | 与 S1 的关系 | 待决 / 阻塞 |
|---|---|---|---|---|
| `ADR-DRAFT-CPR-1` | 官方记录的身份、记录链与写入原语（含证据登记） | `PROPOSED`（DRAFT） | S1 的核心。**表设计部分已被 `S1_Final_Design_2026-10-31.md`（同为 `PROPOSED`：4 表 / 44 列）收窄取代**；**写入原语部分**必须在 TruthWriter 方案确定后修订（Decision Note DT-1 / D-S1-9） | DT-1（Freeze 例外：方案 A 或 B1）、DT-2、DT-3、DT-4；D-S1-1、D-S1-3 |
| `ADR-DRAFT-CPR-2` | 计划与实际的对照：查询时计算，复用现有状态词汇 | `PROPOSED`（DRAFT） | S1 只做**金额**维度的对照；时间维度（`due_date` / `Overdue`）推迟 | D-S1-3 |
| `ADR-DRAFT-CPR-3` | SOCSO 覆盖期（陈述值，精确到天）与独立的 Grab 报销 | `PROPOSED`（DRAFT） | A 部分（覆盖期）进 S1，且 S1 比草案多一个 `coverage_statement` 栏位（`NOT_STATED` / `START_ONLY` / `START_AND_END`，用来表达「起点已知、终点未知」）；B 部分（Grab 报销）**不在** S1 | D-S1-6 |
| `ADR-DRAFT-CPR-4` | 政策规则（`Policy_Rule`）与解析接口；EPF 奖励与 Tax 通知书的边界 | `PROPOSED`（DRAFT） | **不在** S1（后续切片） | 政策登记表 10 项待人工抽查 |
| `ADR-DRAFT-CPR-5` | 日历集成：派生义务，不建第二套提醒 | `PROPOSED`（DRAFT） | **不在** S1（后续切片；来信明确排除 Calendar 集成） | — |

- **草案正文与配套设计**：`ADR_Drafts_Contribution_Planning_2026-10-26.md`（5 份草案 + 「批准之后才应用」的治理更新提案）、`Contribution_Planning_Design_2026-10-26.md`、`S1_Final_Design_2026-10-31.md`、`TruthWriter_Decision_Note_2026-10-31.md`、`S1_Test_Plan_2026-10-31.md`。这些文件是否已放进本仓库，以仓库实际为准。
- **业务范围已确认，架构未批准**：Steven 2026-10-21 授权信 D1 – D6 与 2026-10-29 S1 收敛信确认了**业务范围与边界**（登记在 `CHANGELOG.md` 的 2026-11-02 条）。这**不等于**批准上表任何一份草案，也**不等于**授权任何实作。
- **编号冲突（PENDING）**：本索引写「下一个新 ADR 是 ADR-007」；`PhaseP_Documents_Processing_State_Design_2026-10-17.md` 也把自己的新 ADR 暂称 ADR-007（`:33`、`:575–576`、`:586`；该设计未被采纳，其 §10 的 D1 – D7 在 2026-10-18 的交接清单里仍无答复，本窗口也没有看到答复）。两者谁先用 ADR-007、或如何排序，由 Steven 决定；在那之前所有草案保持 `ADR-DRAFT-…` 标签。
- **重复索引文件（PENDING）**：仓库里有内容相同的两份索引（本文件与 `README-Architecture Decision Records #U2014 Index.md`），`CHANGELOG.md:42` 记录了「最后只留哪一份由 Steven 决定」。**本次只更新了本文件**；两份都保留的话，另一份需要同步。
- **被取代的前身**：`Contribution_Planning_Design_2026-10-26.md` §11.1 的 S1 规格（5 表 / 88 栏）已按来信要求重新核对，被 `S1_Final_Design_2026-10-31.md` 的提议（4 表 / 44 列）取代——**取代的只是提议，不是已批准的决定**。上一轮的 D-1 … D-18 与 D-S1-1 … D-S1-15 的对应关系见 `S1_Final_Design_2026-10-31.md` §13.2。
