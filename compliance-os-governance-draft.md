# Compliance OS — Governance Layer（Draft v0.7）

> **状态：v0.6 之后本已 Architecture Freeze（见 §9）；v0.7 是 Freeze 自己写的例外条款——「有新证据或真实数据暴露问题」——触发原因：Steven 要求 Compliance OS v1 必须能不依赖 Rider OS 独立跑完整条链路，而现行实作（`130`/`140`.js）在这点上比已批准的 ADR-002 原文更严格。v0.7 只动这一件事（ADR-003），不重开其他已冻结的设计，签字前不动 `900`/`901` 实际代码。**
>
> v0.6：确认 v0.5 六项（EP3、Property OS 理由、UCR1-4/1899 bug、Compliance Calendar Projection、RiderOSAdapter、ADR-000）；私有函数命名改回 GAS 后缀惯例 `functionName_()`；`RiderOSAdapter` 已经写好并测试（占位版）。改动清单见 §9。
>
> v0.7（**已批准并实作，2026-08-17**）：新增 ADR-003（Reconciliation 与 Verified Income 解耦）+ CMP-P12；更新 §2.1 Pipeline、§2.3 Document Lifecycle、§7 Reconciliation_Log schema（Verified_Income schema 维持不变，见 §7 说明）；110/130/140 与对应测试已实作、Node 模拟 + 10 组 `runAllXTests()` 重跑通过，`900`/`901` 已同步。PDF 抽取方式：Drive OCR 先接成真的，LLM API 按证据决定，见 §9。

---

## 0. Positioning

（跟 v0.4 一致，未变）Grab Statement、EPF、SOCSO、路税、LHDN 的共同点是「法定 / 官方 / 需要遵守规定」，不只是「政府」——所以用 **Compliance OS**，不用 Government OS。管理的是 **Official Records**，Income（Grab Statement）是 Phase 2 第一个落地场景。

**Ownership 边界：**

| OS | 拥有 | 不拥有 |
|---|---|---|
| Rider OS | 接单、油耗、保养、Daily Estimate、Reward Sheet、车辆资产 | 财务对账、官方收入认定 |
| **Compliance OS** | 所有 Official Records | 净资产、现金、股票 |
| Finance OS | 资产、负债、现金、股票、净资产、目标 | 收入从哪来 |
| Reminder OS | 通知的发送时机与渠道 | 通知内容背后的业务含义 |

---

## 1. UEF / Blueprint Adoption — 对应 `900_Constitution.js`

- 治理指针（不复制内容，按 BP-1）：受 **UEF v1.5**（不是之前写的 v1.3——UEF 在你上传原文前已经经过 v1.4、v1.5 两次修订）与 **Blueprint v1.2** 约束
- Domain：Compliance OS
- Scope：官方 / 法定 Official Records 的导入、解析、对账、验证、发布
- 非 Scope：财富管理（Finance OS）、日常营运（Rider OS）、通知发送逻辑（Reminder OS）

**ADR-000（新增，UEF §1a 要求每个新项目在 Initiation 阶段要有）：为什么 Compliance OS 是独立 GAS 项目，不是塞进 Rider OS 或 Finance OS 里的一个模块**

- Question：官方文件的导入/解析/对账要不要独立成项目，还是作为 Rider OS 或 Finance OS 的一个模块？
- Options：(a) 塞进 Rider OS（它已经有 Reward Sheet/Daily Estimate）(b) 塞进 Finance OS（它是收入的最终消费者）(c) 独立项目
- Decision：(c)。Domain Ownership 检查（UEF §2）：官方文件解析涉及的知识（Grab/EPF/SOCSO/LHDN 各自的格式、法规）跟 Rider OS 的日常营运知识、Finance OS 的财富管理知识都不是同一个 domain；塞进任何一边都会让那个项目背负不属于它的职责，也违反已经定案的 Official Truth Principle（§3.2）——如果解析逻辑长在 Finance OS 里，"只有 Compliance OS 能解析官方文件"这条就没有意义了
- Evidence：Finance OS 现有 904_Data_Ownership 草案的范围明确是净值/目标/资产，没有解析逻辑；Rider OS 的范围是营运，两者都不该扩权

---

## 2. Architecture — 对应 `901_System_Architecture.js`

### 2.1 Pipeline

```
PDF / 官方文件
      │
      ▼
Document Import Engine        [Integration / Import-Export]
      │
      ▼
Document Parsing Engine       [Runtime / Execution]  ← 可插拔 Parser
      │
      ▼
Structured Statement Data
      │
      ▼
Compliance OS Truth Layer     [Runtime / Projection]  ← Verified Income 在此发布（不等 Reconciliation，ADR-003）
      │
      ▼
Event Bus                     [Runtime / Event, Integration / Bridge]
      │
      ▼
Finance OS（Verified Income）   Reminder OS（Compliance Calendar）

Reconciliation Engine         [Runtime / Decision]  ← ADR-003：独立旁支，可选、非阻断
      │                          有 Rider OS 数据才跑（ADR-001 不变）；跑完只
      ▼                          写一笔新的 Reconciliation_Log（append-only，
Reconciliation_Log               UCR6），从不回头改 Verified_Income
                                  （查某一周现在的对账状态：查询时从这张表
                                  取最新一笔算，见实作阶段新增的
                                  getCurrentReconciliationStatus_()）
```

### 2.2 对应 Blueprint 0–5 层（v0.5：改成对照原文的精确 Tier，不是之前整行笼统标注）

| Blueprint 层 / 节点 | 对应 Compliance OS 内容 | 原文 Tier |
|---|---|---|
| 0 Governance | 指针见 §1 | — |
| 1 Foundation · Schema | §7 Sheet Schema | T1 |
| 1 Foundation · Event Definitions | §5 Event Model | T1 |
| 1 Foundation · Identity | ID 规则（CMP- 命名空间）| T2 |
| 1 Foundation · Versioning | Parsed_Statements 从不覆盖，旧版本保留 | T1 |
| 2 Runtime · Decision | Reconciliation 的容差判断 | T2 |
| 2 Runtime · Event | 事件发布 | T1 |
| 2 Runtime · Projection | Verified_Income | T2 |
| 2 Runtime · Query | Finance/Reminder 读取 | T1 |
| 3 Intelligence（全部）| OCR/LLM 抽取、差异 AI 解释 | **T3，按 BP-3 只留 name+purpose，不展开** |
| 4 Integration · Bridge | 原文对 Bridge 的 T2 证据是「共用 Sheet 当非正式桥接」——Compliance OS 的 CoreBridge（§4）是更结构化的事件契约，比现有 T2 证据更进一步，不是简单套用同一个模式 | 现状 T2（非正式）|
| 4 Integration · Import/Export | Document Import Engine——**原文这里现在是 T3（生态里还没有任何实现）**，Compliance OS 一旦真正写出 Import Engine 代码（目前还没写，只写了 Parser），会是第一个实现，届时才变 T2 | T3 → 待实现后成为 T2 |
| 4 Integration · External Systems | Grab——原文明确写「Grab 常被提到但没人真正对接过」，`GrabWeeklyParser` 是生态里第一次真正处理 Grab 数据（即使只是解析 PDF Statement，不是连 API）| T2 |
| 5 Testing | Unit Test（`122_Tests_GrabWeeklyParser.js`）+ 对账容差测试 | — |

> ⚠️ 修正：v0.1-v0.4 一直把这条anti-premature-engineering 原则引用成「P6」，对照 UEF 原文，正确编号是 **EP3**（P 开头的编号是 Rider OS 自己 Constitution 里的项目专属规则，跟 UEF 生态级的 EP1-EP6 是两套不同的编号）。之前所有提到 P6 的地方都应该理解成 EP3。

### 2.3 Document Lifecycle — 对应 `903_State_Model.js`

```
Imported → Parsed → Verified
              │         │
              ▼         └── 对账状态（查询时算，见 §2.5 ADR-003 实作阶段更新）：
        Failed_Parse         Not_Performed（预设）──▶ Matched
                              Not_Performed（预设）──▶ Discrepancy_Flagged ──(人工判断)──▶ 更新注解，或 Rejected

重新解析：Verified → Superseded（旧版本保留，新版本变当前）
```

v0.6 及之前：`Reconciled` 是 `Verified` 前必经的独立状态，Rider OS 未提供数据或对账超容差时文件停在 `Needs_Review`，永远不会变成 `Verified`。v0.7（ADR-003）：`Verified` 只取决于解析成功；对账结果改为发布后才附加的注解，不再是前置状态。

### 2.4 对照 UEF 的 Reference Architecture（新增小节）

UEF 定了新 Domain OS 的默认起始模板：`Truth → State → Event → Service → Observability → Operational Intelligence → Reminder → Intelligence-stub`，「除非 Initiation 有说明理由要偏离」。逐项对照：

| 默认层 | Compliance OS 现状 |
|---|---|
| Truth | ✓ 已有（Compliance OS Truth Layer） |
| State | ✓ 已有（§2.3 Document Lifecycle） |
| Event | ✓ 已有（§5 Event Model） |
| Service | ✓ 三个 Engine（Import/Parsing/Reconciliation） |
| Observability | **未展开**——目前只有 Audit_Log / Compliance_Events_Log 两张表，比 Rider OS 已验证过的 Observability 模式（EventLogger/HealthMonitor/MetricsEngine/AnomalyEngine，5 个文件）薄很多。先记在这里，不在这版展开设计——没有立即的需求，EP3 |
| Operational Intelligence | 对应 §2.2 的 Intelligence 层，T3 预留 |
| Reminder | **刻意偏离**：不在 Compliance OS 内部做，直接对接既有的 Reminder OS（§4.3），理由：Reminder OS 已经是生态级共用服务，Compliance OS 自己再做一层没有意义 |
| Intelligence-stub | 对应 §2.2 的 T3 预留 |

---

### 2.5 Reconciliation 与 Verified Income 解耦 — ADR-003（已批准，2026-08-17 实作完成）

**触发**：Steven 要求 Compliance OS v1 必须能不依赖 Rider OS 独立跑完整条 Import→Parse→Verified→Monthly Projection 链路。检查现行实作（`130_Reconciliation.js`／`140_VerifiedIncome.js`／`110_DocumentImport.js`）后发现：Rider OS 尚未提供本周估算、或提供的估算跟 Grab Statement 差异超出容差时，Verified Income **完全不会被建立**——不是标记出来，是那笔记录根本不存在。这正好落在 Architecture Freeze（§9）自己写的例外条款内：「除非有新证据或真实数据暴露问题」。

**Question**：Reconciliation（对账 Rider OS）应不应该是 Verified Income 能不能发布的前提条件？

**Options**：
(a) 维持现状——Reconciliation 必须先跑、且落在 `Auto_Verified`，Verified Income 才写入
(b) 完全移除 Reconciliation，不再对账
(c) Reconciliation 变成独立、可选、非阻断的次要验证层——Verified Income 在解析成功后立即发布；Reconciliation 有 Rider OS 数据才跑（ADR-001「两边到齐才跑」不变），跑完只在 Reconciliation_Log 留一笔新记录（`Not_Performed` / `Matched` / `Discrepancy_Flagged`），从不决定 Verified Income 发不发布，也从不撤销或阻断已经发布的记录

**Decision**：(c)。**Steven 批准（2026-08-17）**，并明确追加：`Discrepancy_Flagged` 不得撤销或阻断已经 Verified 的官方收入；同一批只处理 ADR-003 本身，不借机扩大其他 Architecture 变更；下一阶段优先做 Real Data Pilot（用 2026-01 至今的真实 Grab Weekly Statement 跑一次，找真实 bug），Finance OS 暂缓。

**Evidence**：
- ADR-002 / CMP-P1 原文（§3.2）只要求「只有 Compliance OS 能解析并发布官方结果」，没有一句话要求「Rider OS 对账通过才算发布」——现行代码的强制闸门是实作阶段自行收紧的隐性假设，比已批准的原则文字更严格。这个 ADR 是让实作跟已批准的决策对齐，不是推翻 ADR-002
- ADR-001（§4.2）「两边到齐才跑」描述的是 Reconciliation *自己* 何时启动（对账本来就需要两边都有数字），从没说过"没启动"等于"不能发布"——这条本身不需要改
- 更符合 CMP-P10（异常要显性，不能静默）：现状是「无数据」或「差异超容差」都让 Verified Income 沉默缺席，比"发布了但标注有问题"更容易被忽略
- 直接满足 Steven 的目标：Compliance OS v1 不依赖 Rider OS 就能独立发布完整月份的 Verified Income

**新增原则（已批准，已同步进 `900_Constitution.js`）**：
> **CMP-P12「Reconciliation is an annotation, not a publication gate」**：Verified Income 的发布只取决于官方文件是否解析成功并通过现有验证逻辑；Rider OS 对账（或未来任何其他交叉验证来源）只能在事后为已发布的记录附加状态注解（`Not_Performed`/`Matched`/`Discrepancy_Flagged`），永远不能决定该记录发不发布或延迟发布，`Discrepancy_Flagged` 也不得撤销或阻断已经 Verified 的官方收入。跟 CMP-P5（陈述值优先于计算值）同一种「检查用来标注、不用来否决」模式，这次的检查来源在外部（Rider OS）。

**实作阶段发现的修正**（跟 ADR-003 的决定本身无关，是把「怎么落地」这件事对齐既有约束）：签字前的草稿写「Reconciliation 事后更新既有 Verified_Income 记录的 reconciliation_status」——实际写代码时对照 `115_TruthWriter.js` 才确认：TruthWriter（UCR6）现在只有 `appendValidatedRow`，没有任何原地更新的方法，「更新既有记录」这件事本来就做不到。改成跟 `150_ComplianceCalendar.js` 的 Completed 判定同一个模式（EP4）：Reconciliation 只管往 `Reconciliation_Log` append，`Verified_Income` 完全不新增欄位；要看某一周现在的对账状态，呼叫新增的 `getCurrentReconciliationStatus_(week, reconciliationLogRecords)`，从 log 里取最新一笔算，不是读一个可能过期的存量欄位。ADR-003 本身的决定（发布不等对账、Discrepancy_Flagged 不阻断）没有变，变的只是这一点技术实现方式。

**影响范围（Impact，已实作）**：
- `110_DocumentImport.js`：`processGrabStatement_()` 解析成功后直接呼叫 `verifyAndPublishIncome_()` 发布 Verified Income；Reconciliation 包在 `try/catch` 里，就算丢未预期例外也不影响已发布的记录（新增测试直接验证这一点，不只是没数据的正常情况）
- `130_Reconciliation.js`：对 `140_VerifiedIncome.js` **零依赖**（原本的 `require` 整行拿掉）。`runReconciliationForWeek_()` 没有 Rider OS 数据时，写一笔 `status: Not_Performed` 的 `Reconciliation_Log`（不再是整个跳过、不写任何记录）；有数据时正常对账，`reconcileStatement_()` 的 status 词汇改成 `Matched`/`Discrepancy_Flagged`（原本是 `Auto_Verified`/`Needs_Review`），结果一律只写进 `Reconciliation_Log`，不碰 `Verified_Income`。新增 `getCurrentReconciliationStatus_()`
- `140_VerifiedIncome.js`：`buildVerifiedIncomeRecord_()`/`verifyAndPublishIncome_()` 拿掉 `reconciliationResult` 参数，net/amount 直接来自 `parsedStatement.summary.weekly_net`；**没有**新增 `reconciliation_status` 欄位（见上面的修正说明）
- **Verified_Income schema**：不变——ADR-003 不需要它加欄位
- `901_System_Architecture.js` / `900_Constitution.js`：已同步（pipeline 图、模块说明、`adrs[]`/`principles[]`、verificationHistory）
- 既有测试：`111_Tests_DocumentImport.js`（21→32 项）、`131_Tests_Reconciliation.js`（19→24 项）、`141_Tests_VerifiedIncome.js` 全部更新为新行为；`190_Tests_Contracts.js` 检查过——没有任何 Adapter 方法签名变了，不需要改
- Node vm 合并加载模拟（全部 22 个文件）+ 10 组 `runAllXTests()` 重跑，全部通过
- **未涉及**：Rider OS 自己的任何代码；`123_RiderOSAdapter.js` 的两个方法签名（`onWeeklyEstimateReady`/`getWeeklyEstimate`）不变

**Next Steps**：
1. ~~Steven 签字确认本 ADR + CMP-P12~~ **已完成（2026-08-17）**
2. ~~实作上述影响范围~~ **已完成（2026-08-17）**——110/130/140 + 既有测试全部更新，Node 模拟 + 10 组 `runAllXTests()` 重跑通过
3. ~~签字后同步进 900/901~~ **已完成**——`adrs[]` 加入 ADR-003（status: Decided）、`principles[]` 加入 CMP-P12，pipeline 图/模块说明/verificationHistory 同步更新
4. **下一步（Real Data Pilot，Steven 2026-08-17 定的优先序，Finance OS 暂缓）**：先把 `112_DocumentTextExtractor.js` 的 Drive OCR 接成真的可运行实现，直接拿 2026-01 至今的真实 Grab Weekly Statement 批次跑一次；Operator Console（HTMLService）+ Drive 直读 + `drive_file_id` 去重 + 批次汇入是这一步的操作介面。目标不是把架构做得更完整，是让真实数据跑起来、暴露真实 bug（Parser failure / OCR 失败 / 去重失败 / 周界/月界 / schema mismatch / 缺欄位 / 金额解析错误 / 重试与幂等 等），当作下一轮 Architecture 决策的证据——不是继续按「以后可能需要」设计

**PDF 抽取方式（Steven 2026-08-17 定案，比原本「两个都做」更精确）**：`112_DocumentTextExtractor.js` 现有的 Adapter 接口（`extract({fileId, mimeType})`）保留不动。**现在只把 Drive OCR 接成真的**，拿来跑真实历史 PDF；LLM API 那个实现继续占位（UCR7 惯例），不因为「Adapter 已经在那里」就顺便选定供应商（Claude/Gemini/OpenAI）。只有真实 PDF 数据证明 Drive OCR 不够准时，才根据实际 failure evidence 决定要不要启用 LLM、选哪家——决定权留给证据，不是留给「反正都要做」。

**Review Trigger**：Rider OS 真正开始发布 `RIDER_WEEKLY_ESTIMATE_READY`、且累积出真实的 `Discrepancy_Flagged` 案例后，回头检查现有容差设定（`DEFAULT_RECONCILIATION_CONFIG`）与人工判断流程是否需要细化——容差数字本身仍是 CMP-P10 意义下「合理猜测、未经真实数据验证」的占位值，这个 ADR 不改变那件事。

**Related ADRs**：ADR-001（不变，§4.2 的 Adapter 模式与触发机制沿用）、ADR-002（不变，本 ADR 是对齐其原文，不是修改）

---

## 3. Data Ownership — 对应 `904_Data_Ownership.js`

- Compliance OS 独占官方原始文件的读写权；Finance OS / Rider OS / Reminder OS 永远不直接打开这些文件或其 Sheet
- **Finance OS 边界（已确认）**：收入 → 读 Compliance OS 的 Verified Income；车辆等 Rider OS 资产 → 仍可直接读 Rider OS；房产 → Property OS；Investment / Cash 不变（已同步更新 Finance OS 自己的 904 记录）

### 3.1 Document Repository（已确认不采纳——v0.5 修正了原来的理由）

⚠️ 之前 v0.3/v0.4 的理由写的是「Property OS 连 Governance layer 都还没开始」——**这个已经过时**：对照 UEF v1.5 原文，Property OS 其实是生态里除了 Rider OS 之外第一个走完 Architecture + Contract Design 阶段、Foundation 层和 Obligation Engine/Scheduler Runtime 都已经跑起来的真实项目（ADR-P01 到 P07）。

结论不变（还是不抽 Document Repository），但理由要更新：Property OS 现有的真实代码是 **Obligation Engine / Scheduler**（到期日、宽限期、Overdue 状态），不是文件导入/解析——两者是不同的能力。「第二个项目独立做出同一个模式才共用」这条 Blueprint 规则（BP-2/BP-5）现在的状态是：文件导入/解析这个能力上，生态里仍然只有 Compliance OS 一个（甚至还没实作 Import Engine，只写了 Parser），所以维持不抽取的结论仍然成立，只是不能再说 Property OS "还没开始"。

顺带一提：Property OS 的 Obligation Engine（到期日/宽限期/Overdue）跟 Compliance OS 的 Compliance Calendar（§7）在概念上相当接近，值得留意——但两边应该各自独立发展，如果未来真的独立收敛到同一个模式，才是 Blueprint 意义上「第二个项目验证」的证据，现在刻意去对齐反而会破坏这个证据的独立性。

### 3.2 Official Truth Principle（ADR-002，不变）

所有官方 / 法定文件只能由 Compliance OS 解析并发布 Verified Result；其他 Domain 不得自行解析或推导官方性质的结果，但可以用 Verified Result 做自己的下游计算（Finance OS 算净资产不受影响）。

> v0.7：ADR-003（§2.5）澄清了这条原文本身从未要求的一件事——Rider OS 对账不是「能不能发布 Verified Result」的前提。本节文字不变，只是实作现在才真正对齐它。

### 3.3 Security & Retention（新增，对应 Blueprint Cross-Cutting Capabilities · Security，原文 T3 保留）

Blueprint 把 Security 列在 Cross-Cutting Capabilities（不是 0-5 主干的一部分），原文写「无任何证据，保留」——所以这里不展开设计一整套安全体系，只记 Compliance OS 自己domain 内必须遵守的最低限度：

- 原始 PDF 存在 Compliance OS 专属、权限受限的 Drive 目录，其他 OS 不可读
- 身份证号、完整银行账号等敏感字段只留在原始 PDF 里，Parsed_Statements / Verified_Income / 任何对外 Event 都不应包含
- 税务与官方文件建议长期保留（例如至少 7 年，具体以 LHDN 现行规定为准）

如果未来第二个项目也需要类似的文件级安全规则，才是把 Security 从 T3 往上推的证据，现在不预先设计通用方案。

---

## 4. Module Boundary（含 CoreBridge） — 对应 `905_CoreBridge.js`

### 4.1 Parser Interface

已写好并测试通过：`120_DocumentParsing.js`（DocumentParser 基类 + ParserRegistry）+ `121_GrabWeeklyParser.js`（Grab 实现）。补上了 UEF 的 UCR1（IIFE）/UCR2（私有函数命名，**v0.6 改回 GAS 平台惯例的后缀下划线 `functionName_()`**，见 §8 的 Language Convention Override）/UCR3（try/catch + AlertService.log，本地找不到 AlertService 时退回 console.error）/UCR4（日期一律用 Date.UTC 从拆解好的整数组装，不把字符串直接交给 Date 解析——这条对应 UEF Failure Catalog 里 Rider OS 那个"1899 date"真实 bug）。

### 4.2 Rider OS Contract（ADR-001，v0.5：改用 UCR7 的 Adapter 模式）

UEF UCR7（Infrastructure Adapter / Port isolation，v1.4 新增，Rider OS 的 TruthEngine 和 Property OS 的 `publishPropertyEvent_()` 两个项目独立收敛出的模式）明确说：Domain 层代码不直接调用外部依赖，一律通过唯一一个 Adapter 函数；依赖的真实接口还没确认时，先写 Adapter，内部先放 log 占位，不要用猜的签名硬上。

这正好是目前的处境——Rider OS 还没有发布 `RIDER_WEEKLY_ESTIMATE_READY` 事件的能力（依赖还没确认）。**已写好并测试**：`123_RiderOSAdapter.js`，暴露 `onWeeklyEstimateReady(payload)` / `getWeeklyEstimate(week)` 两个方法，存储后端可替换（工厂函数注入，GAS 环境预设走 PropertiesService，测试用假 store），Reconciliation Engine 只需要认这两个方法。7 项测试全过（含「未到齐回 null 不是 0」「缺 week 抛错」「不同 week 互不干扰」）。

```
RIDER_WEEKLY_ESTIMATE_READY   (Rider OS 发布 → Compliance OS 订阅，透过 RiderOSAdapter)
{
  week: "2026-W30",
  daily_estimate_total: 2025.00,
  reward_estimate_total: 100.00,
  status: "Ready"
}
```

Rider OS 在自己既有的每周结算完成后发布一次，不做每日同步。Reconciliation Engine 采「两边到齐才跑」：本周期的 Parsed_Statements 与 RIDER_WEEKLY_ESTIMATE_READY，不管谁先到，都先缓存，两个都到齐才开始 Reconciliation。

> v0.7：「两边到齐才跑」描述的仍然只是 Reconciliation *本身* 何时启动——不再等同于「没启动就不能发布 Verified Income」。两者的解耦见 §2.5 ADR-003。

### 4.3 Reminder OS Contract

Compliance OS 发布 `COMPLIANCE_DUE_SOON` 等事件，Reminder OS 只需要 title / due_date / message / category 就能推送。

---

## 5. Event Model — 对应 `902_Event_Model.js`

### 5.1 内部事件 vs 跨 OS 事件

`DOCUMENT_IMPORTED` / `DOCUMENT_PARSED` / `DOCUMENT_VERIFIED` 是 Compliance OS 自己的内部事件，不上跨项目 Event Bus。跨 OS 只发布 `INCOME_VERIFIED`、`COMPLIANCE_*` 系列。

按 UCR7，发布动作本身也应该收拢到唯一一个 Adapter——`publishComplianceEvent_()`（命名直接照搬 Property OS 已验证过的 `publishPropertyEvent_()` 模式），Domain 逻辑（Reconciliation Engine 等）只调用这一个函数，不直接碰 EventBus。

### 5.2 具名 Compliance 事件（已确认不采纳）

维持通用 `COMPLIANCE_DUE_SOON` / `OVERDUE` / `COMPLETED` + `category`。

### 5.3 Event Schemas

```
INCOME_VERIFIED
{
  event_id: "CMP-EVT-20260728-0001",
  income_id: "CMP-INCOME-2026-W30",
  period: "2026-W30",
  net_delivery_income: 1146.00,
  incentive: 557.10,
  tip: 19.00,
  other_payments: 12.00,
  total_deductions: 0.00,
  net: 1734.10,
  amount: 1734.10,
  currency: "MYR",
  source: "Compliance OS",
  origin_platform: "Grab",
  status: "Verified",
  verified_at: "2026-07-28T09:00:00+08:00"
}

COMPLIANCE_DUE_SOON / COMPLIANCE_OVERDUE / COMPLIANCE_COMPLETED
{
  event_id: "CMP-EVT-20260901-0002",
  obligation_id: "CMP-CAL-ROADTAX-2026",
  category: "Vehicle",
  title: "路税续保",
  due_date: "2026-09-15",
  days_remaining: 14,
  message: "路税将在 9 月 15 日到期",
  priority: "normal"
}
```

---

## 6. File Map — 对应 `907_File_Map.js`

**900s Engineering**：900_Constitution.js（§1，含 ADR-000，**已写**——CMP-P1-12 原则 + CMP-CR1-5 编码规则）／901_System_Architecture.js（§2，**已写**——Compliance OS 自己的模块目录 + Architecture-Layers-to-Blueprint 映射）／902_Event_Model.js（§5）／903_State_Model.js（§2.3）／904_Data_Ownership.js（§3）／905_CoreBridge.js（§4）／906_AI_Integration.js（Reserved T3）／907_File_Map.js（本节）／908_Project_State.js（§9）／909_ADR.js（§1 ADR-000、§4.2 ADR-001、§3.2 ADR-002、§2.5 ADR-003）

**100s Blueprint**：101_Vision.js（§0）／102_Principles.js／105_TestUtils.js（**已写**）／110_DocumentImport.js（**已写**，v2）／111_Tests_DocumentImport.js（**已写**）／112_DocumentTextExtractor.js（**已写**）／113_Tests_DocumentTextExtractor.js（**已写**）／115_TruthWriter.js（**已写**）／116_Tests_TruthWriter.js（**已写**）／120_DocumentParsing.js（已写）／121_GrabWeeklyParser.js（已写）／122_Tests_GrabWeeklyParser.js（已写）／123_RiderOSAdapter.js（已写，占位版）／124_Tests_RiderOSAdapter.js（已写）／130_Reconciliation.js（**已写**）／131_Tests_Reconciliation.js（**已写**）／140_VerifiedIncome.js（**已写**，v2：EventPublisher）／141_Tests_VerifiedIncome.js（**已写**）／150_ComplianceCalendar.js（**已写**）／151_Tests_ComplianceCalendar.js（**已写**）／190_Tests_Contracts.js（**已写**，新增测试类别）

核心 Runtime 主线全部写完。剩下只有 `906_AI_Integration.js`——按 Blueprint BP-3 刻意保留 Tier 3，不展开。

> ⚠️ **实测发现（不是靠推理）**：用 Node 的 vm 模块把交付的文件按 GAS 实际的文件名字母序整个合并执行了一次（模拟 GAS 单一全局作用域），抓到 122 跟 141 两个测试文件各自用 `const` 宣告了同名的 `SAMPLE_RAW_TEXT`——这在 GAS 里会直接 SyntaxError，整个项目会加载失败，不是运行时才出错。已经抽成 `105_TestUtils.js` 共用，重新跑过合并模拟，确认不会再发生。

---

## 7. Sheet Schema

**Documents**：document_id `CMP-DOC-{YYYYMMDD}-{SOURCE}-{TYPE}-{SEQ}` / source / document_type / document_class / period / file_hash / **drive_file_id**（权威引用，取代原本设想的 original_file_url）/ **drive_path**（人类可读缓存，可能过期，不是真相来源）/ status

**Drive 存档规范（采纳建议）**：
- 目录结构：`Compliance OS/{source}/{year}/{可读标签}`，例如 `Compliance OS/Grab/2026/Weekly Statements`；新增文件类型只需要新增子目录，不动架构
- 建议文件名：`{SOURCE}_{TYPE_CODE}_{PERIOD}.pdf`，例如 `GRAB_WEEKLY_2026_W30.pdf`、`EPF_STATEMENT_2026_07.pdf`——但这是给人看的，不是系统去重的依据；真正防止重复导入的还是 file_hash，两份文件名一样但内容不同（或反过来）都不影响去重逻辑

**Parsed_Statements**：parse_id / document_id / parser_id / parser_version / period / gross_income / incentive / adjustment / penalty / total / raw_json / is_current

**Reconciliation_Log**：reconciliation_id / week / statement_total / rider_os_estimate / reward_sheet_total / rider_total / difference / difference_pct / reason / within_tolerance / status（v0.7：对照 `130_Reconciliation.js` 的 `RECONCILIATION_LOG_COLUMNS` 修正——原文档写的是 `parse_id`，实际字段是 `week`，且原文档漏列了 `rider_total`；顺手修正的既有 drift，跟 ADR-003 本身无关。ADR-003 实作后：`status` 的词汇从 `Auto_Verified`/`Needs_Review` 改成 `Not_Performed`/`Matched`/`Discrepancy_Flagged`；没有 Rider OS 数据时现在也会写一笔 `Not_Performed`，不再整个跳过不留痕。查某一周「现在」的对账状态用新增的 `getCurrentReconciliationStatus_(week, records)`，取这张表里该周最新一笔）

**Verified_Income**（Finance OS 唯一读取的表）：income_id `CMP-INCOME-{YYYY}-W{WW}` / period / currency / net_delivery_income / incentive / tip / other_payments / total_deductions / net / amount / source（固定 "Compliance OS"）/ origin_platform / status / verified_at——**ADR-003 实作后 schema 不变，没有加欄位**（签字前的草稿曾写要加 `reconciliation_status` 欄位，实际写代码时发现 TruthWriter/UCR6 只支援 append、没有原地更新，这个欄位写了也没办法维护成最新值，所以改成不存；对账状态是 `Reconciliation_Log` 的衍生查询结果，不是这张表自己的事实，见上一行）

**Compliance_Calendar**（v0.6：实作时进一步修正——完成记录改成独立的 append-only 表）

| 字段 | 说明 |
|---|---|
| obligation_id | `CMP-CAL-{CODE}-{YYYY}`，CODE 由建立时明确指定（例如 ROADTAX），不从 category 自动推 |
| category / title / due_date / recurrence | |
| reminder_lead_days | |
| linked_document_id | |

**Compliance_Completions**（v0.6 新增，append-only）

| 字段 | 说明 |
|---|---|
| obligation_id | 对应 Compliance_Calendar 的哪一笔 |
| completed_at | 真正的事实——这个动作什么时候发生 |
| linked_document_id / note | |

⚠️ v0.1-v0.4 设想 `completed_at` 直接存在 Compliance_Calendar 那一行，实作时发现这需要 UPDATE 既有行——但 TruthWriter（UCR6）现在只支援 append，且这更贴近生态整体的 event-sourcing 风格（Rider OS TruthEngine、Personal AI Core EventBus 都是只加不改）。改成：Compliance_Calendar 的一行只在建立时写一次（不可变定义），完成与否改成查「Compliance_Completions 里有没有这个 obligation_id 的记录」——周期性义务因此每一期用新的 obligation_id（不是同一笔复用），避免要处理"这笔完成记录属于哪一期"的对应问题。Upcoming/Due_Soon/Overdue 三态维持 v0.5 的判断：查询时用 `due_date`、`reminder_lead_days`、当下时间即时算，不存欄位。

**Audit_Log / Compliance_Events_Log**：字段略，留痕每次解析/人工覆盖/发布事件。

**⚠️ 新增注意事项**（对应 UEF Failure Catalog，Property OS 上线前就发现的教训）：写入 Sheets 的 ISO 日期字符串（例如 "2026-07-20"）读回来不保证还是字符串——Sheets 可能悄悄转成日期序列值，任何靠字符串比对的逻辑（例如用 period 当 key）都可能因此坏掉。建 Sheet 时这些栏位要强制设成纯文字格式（`'@'`），读取时也要做防御性转换，两边都做，不能只做一边。

---

## 8. 决策记录

- **ADR-000**：为什么 Compliance OS 是独立项目 → 已决定，见 §1
- **ADR-001**：Reconciliation Engine 读取 Rider OS 数据 → 已决定，见 §4.2（Event + Weekly Settlement 触发 + UCR7 Adapter 模式，Adapter 内部先占位）
- **ADR-002**：Official Truth Principle → 已决定，见 §3.2
- **ADR-003**：Reconciliation 与 Verified Income 解耦（Rider OS 从必要条件变成可选、非阻断的次要验证）→ **已批准并实作（2026-08-17）**，见 §2.5
- Decision OS → 维持不纳入
- Finance OS 904 → 已确认，见 §3
- **评审建议「平台稳定 ID 优先于路径/显示名」推广到整个生态**（Drive→file_id、Calendar→event_id、Sheets→spreadsheet_id、Gmail→message_id）→ 方向认同，但按 BP-2/UEF §0.9，Blueprint 层级的推广需要第二个项目独立验证同样的模式，或有明确的生态级效益，不是单一项目讲得通就够。目前只有 Compliance OS 一个实例（drive_file_id vs drive_path），先留在这里当 Compliance OS 自己的原则（CMP-P 系列可以补一条），不越权直接宣告成生态规则——这也是 UEF 自己的 Candidate Patterns（D7）机制存在的原因

**已确认（v0.6）**：私有函数命名不照 UEF 原文字面的「前缀」，GAS 继续用后缀下划线 `functionName_()`（隐藏于 Apps Script Run 下拉选单的实际平台好处）。代码已经改回来。

**Language Convention Override（提案，我没有你实际 UEF 文档的写入权限，这段供你自己合并进去）**：
> UEF 定义的是语言无关的原则；若某个平台拥有官方或事实上的最佳实践，Domain 可以采用该平台惯例，但须在项目自己的 Constitution 中明确声明。GAS 生态标准：私有函数用后缀下划线 `functionName_()`。

---

## 9. Project State — 对应 `908_Project_State.js`

- Status：**Architecture Freeze**（采纳评审建议的表述）——Governance 层（Architecture / Data Ownership / Module Boundary / File Map / Sheet Schema / Event Model / ADR-000-003）内容稳定，往后除非有新证据或真实数据暴露问题，不再主动扩充设计。重心转向工程质量（测试覆盖、Contract Test、已知限制的透明度），跟 UEF Blueprint Change Policy（§0.9）的精神一致——不因为"讨论起来合理"就继续加，只有第二个项目的独立证据或真实需求才动。**v0.7：Freeze 本身写了例外条款，ADR-003（§2.5）是目前唯一在跑过的例外，已批准并实作完成（2026-08-17）——不是重新打开整层设计，ADR-000/001/002 与 Freeze 其余范围维持不变。Freeze 对下一阶段（Real Data Pilot：Drive OCR、Operator Console、批次汇入）继续有效——Steven 明确列了这次不做的清单：Document Repository、新的 Compliance Event types、Decision OS、其他未来抽象、为了"以后可能需要"而加的 Infrastructure，只有真实数据跑出来的证据才能再开例外**
- **核心 Runtime 现状**（用 `901_System_Architecture.js` 的 `computeComplianceOsEngineeringMetrics_()` 算，不是手动维护的数字）：12 个模块，11 个 Tested，1 个 Designed（`906_AI_Integration.js`，按 Blueprint BP-3 刻意保留 Tier 3，不是缺测试）。22 个 .js 文件（含 900/901 本身）的 GAS 合并模拟 2026-08-17 重跑，持续通过
- **已知限制**（占位、等确认才能变真的，都不影响继续开发）：PDF→文字抽取方式（**Drive OCR 是下一步要接成真的实作**，跑真实历史 PDF；LLM API 保留占位，不因为 Adapter 已经在那里就先选供应商——只有真实数据证明 Drive OCR 不够准才根据实际 failure evidence 决定要不要启用、选哪家）、Personal AI Core EventBus 真实调用方式、Rider OS 的 RIDER_WEEKLY_ESTIMATE_READY 发布能力（现在明确不等它——ADR-003 之后 Rider OS 完全是可选项）、Compliance Calendar 的通知去重策略（连续多天 Due_Soon 会不会重复吵）
- **历史变更摘要**（v0.1→v0.7 完整细节见各版本自身，这里只列大方向）：v0.1-v0.3 定下 Compliance OS 的定位、Data Ownership、Parser/Reconciliation/Event 设计，三轮外部评审逐步收敛（Document Repository 不抽离、通用 Compliance 事件不加具名类型、Official Truth Principle）；v0.4 用真实 Grab Statement 修正了收入结构假设；v0.5 对照 UEF v1.5/Blueprint v1.2 原文修正了引用错误与 Tier 判断，新增 ADR-000；v0.6 起进入实作阶段——`900_Constitution.js`/`901_System_Architecture.js` 落成 Compliance OS 自己的 UEF/Blueprint，核心链路（Import→Parse→Reconciliation→VerifiedIncome→ComplianceCalendar）全部写完测试，含一次实测抓到的真实 GAS 撞名 bug（详见 `901` 的 verificationHistory）；v0.7（**已批准并实作，2026-08-17**）：Steven 要求 v1 不依赖 Rider OS 独立运行，触发 ADR-003——Reconciliation 从 Verified Income 的前提条件改成可选、非阻断的事后注解（对账状态查询时从 Reconciliation_Log 现算，Verified_Income schema 不变），核心链路简化为 Import→Parse→VerifiedIncome→（可选）Reconciliation→ComplianceCalendar；110/130/140 + 对应测试已实作并通过全套回归；PDF 抽取方式定案为 Drive OCR 先做真的、LLM API 按证据决定；下一阶段 Real Data Pilot 优先，Finance OS 暂缓
- Next（**Steven 2026-08-17 定的优先序**）：Real Data Pilot 优先，Finance OS 暂缓——(1) 先把 Drive OCR 接成真的实作，直接批次跑 2026-01 至今的真实 Grab Weekly Statement，配 Operator Console（HTMLService，Drive 直读 + `drive_file_id` 去重 + 批次汇入）；(2) 目的是找真实数据暴露的 bug（Parser failure / OCR 失败 / 去重失败 / 周界月界 / schema mismatch / 缺欄位 / 金额解析错误 / 重试与幂等），当作下一轮 Architecture 决策的证据；(3) Compliance OS 用真实数据稳定运行一段时间、真实 bug 修完之后，才开始 Finance OS，作为验证「Constitution + Architecture + Adapter + NN_Tests + Contract Tests」这套模式是否真的可复用的第二个 Domain OS——不是现在
