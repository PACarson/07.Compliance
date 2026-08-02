# Compliance OS — Governance Layer（Draft v0.6）

> **状态：Draft，Governance layer 内容收尾，v0.5 的 6 项修正你已全部确认，1 项（私有函数命名）改成 GAS 平台惯例。这层不再继续展开——按你的意见，再讨论治理细节收益递减，重心转到 Phase 2 Step 4。**
>
> v0.6：确认 v0.5 六项（EP3、Property OS 理由、UCR1-4/1899 bug、Compliance Calendar Projection、RiderOSAdapter、ADR-000）；私有函数命名改回 GAS 后缀惯例 `functionName_()`；`RiderOSAdapter` 已经写好并测试（占位版）。改动清单见 §9。

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
Reconciliation Engine         [Runtime / Decision]  ← 对账 Rider OS
      │
      ▼
Compliance OS Truth Layer     [Runtime / Projection]
      │
      ▼
Event Bus                     [Runtime / Event, Integration / Bridge]
      │
      ▼
Finance OS（Verified Income）   Reminder OS（Compliance Calendar）
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
Imported → Parsed → Reconciled → Verified
              │          │
              ▼          ▼
        Failed_Parse   Needs_Review ──(人工确认)──▶ Verified
                                   └──(判定有误)──▶ Rejected

重新解析：Verified → Superseded（旧版本保留，新版本变当前）
```

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

## 3. Data Ownership — 对应 `904_Data_Ownership.js`

- Compliance OS 独占官方原始文件的读写权；Finance OS / Rider OS / Reminder OS 永远不直接打开这些文件或其 Sheet
- **Finance OS 边界（已确认）**：收入 → 读 Compliance OS 的 Verified Income；车辆等 Rider OS 资产 → 仍可直接读 Rider OS；房产 → Property OS；Investment / Cash 不变（已同步更新 Finance OS 自己的 904 记录）

### 3.1 Document Repository（已确认不采纳——v0.5 修正了原来的理由）

⚠️ 之前 v0.3/v0.4 的理由写的是「Property OS 连 Governance layer 都还没开始」——**这个已经过时**：对照 UEF v1.5 原文，Property OS 其实是生态里除了 Rider OS 之外第一个走完 Architecture + Contract Design 阶段、Foundation 层和 Obligation Engine/Scheduler Runtime 都已经跑起来的真实项目（ADR-P01 到 P07）。

结论不变（还是不抽 Document Repository），但理由要更新：Property OS 现有的真实代码是 **Obligation Engine / Scheduler**（到期日、宽限期、Overdue 状态），不是文件导入/解析——两者是不同的能力。「第二个项目独立做出同一个模式才共用」这条 Blueprint 规则（BP-2/BP-5）现在的状态是：文件导入/解析这个能力上，生态里仍然只有 Compliance OS 一个（甚至还没实作 Import Engine，只写了 Parser），所以维持不抽取的结论仍然成立，只是不能再说 Property OS "还没开始"。

顺带一提：Property OS 的 Obligation Engine（到期日/宽限期/Overdue）跟 Compliance OS 的 Compliance Calendar（§7）在概念上相当接近，值得留意——但两边应该各自独立发展，如果未来真的独立收敛到同一个模式，才是 Blueprint 意义上「第二个项目验证」的证据，现在刻意去对齐反而会破坏这个证据的独立性。

### 3.2 Official Truth Principle（ADR-002，不变）

所有官方 / 法定文件只能由 Compliance OS 解析并发布 Verified Result；其他 Domain 不得自行解析或推导官方性质的结果，但可以用 Verified Result 做自己的下游计算（Finance OS 算净资产不受影响）。

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

**900s Engineering**：900_Constitution.js（§1，含 ADR-000，**已写**——CMP-P1-10 原则 + CMP-CR1-5 编码规则）／901_System_Architecture.js（§2，**已写**——Compliance OS 自己的模块目录 + Architecture-Layers-to-Blueprint 映射）／902_Event_Model.js（§5）／903_State_Model.js（§2.3）／904_Data_Ownership.js（§3）／905_CoreBridge.js（§4）／906_AI_Integration.js（Reserved T3）／907_File_Map.js（本节）／908_Project_State.js（§9）／909_ADR.js（§1 ADR-000、§4.2 ADR-001、§3.2 ADR-002）

**100s Blueprint**：101_Vision.js（§0）／102_Principles.js／105_TestUtils.js（**已写**——共用测试 helper，见下方发现）／110_DocumentImport.js（下一步，唯一还没写的环节）／115_TruthWriter.js（**已写**）／116_Tests_TruthWriter.js（**已写**）／120_DocumentParsing.js（已写）／121_GrabWeeklyParser.js（已写）／122_Tests_GrabWeeklyParser.js（已写）／123_RiderOSAdapter.js（已写，占位版）／124_Tests_RiderOSAdapter.js（已写）／130_Reconciliation.js（**已写**，含真实 TruthWriter/VerifiedIncome 整合）／131_Tests_Reconciliation.js（**已写**）／140_VerifiedIncome.js（**已写**）／141_Tests_VerifiedIncome.js（**已写**）／150_ComplianceCalendar.js

> ⚠️ **实测发现（不是靠推理）**：用 Node 的 vm 模块把交付的文件按 GAS 实际的文件名字母序整个合并执行了一次（模拟 GAS 单一全局作用域），抓到 122 跟 141 两个测试文件各自用 `const` 宣告了同名的 `SAMPLE_RAW_TEXT`——这在 GAS 里会直接 SyntaxError，整个项目会加载失败，不是运行时才出错。已经抽成 `105_TestUtils.js` 共用，重新跑过合并模拟，确认不会再发生。

---

## 7. Sheet Schema

**Documents**：document_id `CMP-DOC-{YYYYMMDD}-{SOURCE}-{TYPE}-{SEQ}` / source / document_type / document_class / period / file_hash / original_file_url / status

**Parsed_Statements**：parse_id / document_id / parser_id / parser_version / period / gross_income / incentive / adjustment / penalty / total / raw_json / is_current

**Reconciliation_Log**：reconciliation_id / parse_id / statement_total / rider_os_estimate / reward_sheet_total / difference / difference_pct / reason / within_tolerance / status

**Verified_Income**（Finance OS 唯一读取的表）：income_id `CMP-INCOME-{YYYY}-W{WW}` / period / currency / net_delivery_income / incentive / tip / other_payments / total_deductions / net / amount / source（固定 "Compliance OS"）/ origin_platform / status / verified_at

**Compliance_Calendar**（v0.5：按 UEF EP4「可推导的状态别存」重新设计）

| 字段 | 说明 |
|---|---|
| obligation_id | `CMP-CAL-{TYPE}-{YYYY}` |
| category / title / due_date / recurrence | |
| reminder_lead_days | |
| completed_at | **存的是事实**（真的完成了没有），nullable |
| linked_document_id | |

⚠️ 之前 v0.1-v0.4 的 `status` 字段（Upcoming/Due_Soon/Overdue/Completed）删掉——按 EP4（Property OS 的 Obligation Engine 就是这个原则的原始案例：Overdue 完全可以从 due_date + 宽限期 + 当下时间推出来，存成字段只会变成第二个真相来源，还要靠排程 job 保持同步，job 一失败状态就是错的）。现在：Upcoming / Due_Soon / Overdue 三态查询时用 `due_date`、`reminder_lead_days`、当下时间即时算出来；`Completed` 才是真的需要写入的事实（是否真的完成了，没法用时间推），用 `completed_at` 是否有值判断。

**Audit_Log / Compliance_Events_Log**：字段略，留痕每次解析/人工覆盖/发布事件。

**⚠️ 新增注意事项**（对应 UEF Failure Catalog，Property OS 上线前就发现的教训）：写入 Sheets 的 ISO 日期字符串（例如 "2026-07-20"）读回来不保证还是字符串——Sheets 可能悄悄转成日期序列值，任何靠字符串比对的逻辑（例如用 period 当 key）都可能因此坏掉。建 Sheet 时这些栏位要强制设成纯文字格式（`'@'`），读取时也要做防御性转换，两边都做，不能只做一边。

---

## 8. 决策记录

- **ADR-000**：为什么 Compliance OS 是独立项目 → 已决定，见 §1
- **ADR-001**：Reconciliation Engine 读取 Rider OS 数据 → 已决定，见 §4.2（Event + Weekly Settlement 触发 + UCR7 Adapter 模式，Adapter 内部先占位）
- **ADR-002**：Official Truth Principle → 已决定，见 §3.2
- Decision OS → 维持不纳入
- Finance OS 904 → 已确认，见 §3

**已确认（v0.6）**：私有函数命名不照 UEF 原文字面的「前缀」，GAS 继续用后缀下划线 `functionName_()`（隐藏于 Apps Script Run 下拉选单的实际平台好处）。代码已经改回来。

**Language Convention Override（提案，我没有你实际 UEF 文档的写入权限，这段供你自己合并进去）**：
> UEF 定义的是语言无关的原则；若某个平台拥有官方或事实上的最佳实践，Domain 可以采用该平台惯例，但须在项目自己的 Constitution 中明确声明。GAS 生态标准：私有函数用后缀下划线 `functionName_()`。

---

## 9. Project State — 对应 `908_Project_State.js`

- Status：**Draft v0.6**
- v0.6 变更：v0.5 六项修正（EP3、Property OS 理由、UCR1-4/1899 bug、Compliance Calendar Projection、RiderOSAdapter 设计、ADR-000）全部确认；私有函数命名改回 GAS 后缀惯例，`120_DocumentParsing.js`/`121_GrabWeeklyParser.js`/`122_Tests_GrabWeeklyParser.js` 同步改名，测试重跑全过；新增并测试通过 `123_RiderOSAdapter.js` + `124_Tests_RiderOSAdapter.js`（占位版，7 项测试全过）；记录了 Language Convention Override 提案文字，供你合并进实际 UEF 文档
- Phase 2 实际进度校正：Step 1（字段分析）、Step 2（JSON Schema）、Step 3（GrabWeeklyParser）都已完成；Step 4（Reconciliation Engine）的前置依赖 RiderOSAdapter 已经写好，Reconciliation Engine 本体还没写——这是唯一剩下的部分，不是从头开始
- v0.5 变更（对照你上传的 UEF v1.5 / Blueprint v1.2 原文修正）：
  - 引用错误修正：anti-premature-engineering 从误引的「P6」改成正确的「EP3」
  - Blueprint 0-5 层的 Tier 从「整行笼统标注」改成逐节点精确对照原文（尤其 Integration 层：Bridge/Import-Export/External Systems 三者 Tier 并不相同，之前混在一起标 T2 是不精确的）
  - §3.1 Property OS 现状修正：它不是"还没开始 Governance"，而是已经有真实跑起来的 Foundation 层 + Obligation Engine/Scheduler Runtime；不采纳 Document Repository 的结论不变，理由改成"能力不同（Obligation/Scheduling ≠ 文件导入解析），不是进度不同"
  - 新增 ADR-000（为什么是独立项目）
  - 新增 §2.4 对照 UEF Reference Architecture，标出 Observability 偏薄、Reminder 层刻意外包给 Reminder OS 两点
  - 新增 §3.3 Security，明确对应 Blueprint Cross-Cutting Capabilities 而不是自己发明一套
  - Compliance_Calendar 按 EP4 重新设计：删掉存储的 status，Upcoming/Due_Soon/Overdue 改成查询时用 due_date 即时算，只有 Completed（用 completed_at）是真正需要存的事实
  - 新增 Sheets 日期序列值静默转换的提醒（Failure Catalog 里 Property OS 上线前发现的教训）
  - `120_DocumentParsing.js` / `121_GrabWeeklyParser.js` 补上 UCR1-4；新增 `122_Tests_GrabWeeklyParser.js`（按 `NN_Tests_<FeatureId>.js` 惯例，含人工验证清单），15 项测试全部通过
  - ADR-001 改用 UCR7 的 Adapter 模式（`RiderOSAdapter`，内部先占位）；新增 `publishComplianceEvent_()` 作为 EventBus 发布的唯一出口
  - 待确认：UCR2 私有函数前缀 vs 后缀下划线，见 §8
- Next：`110_DocumentImport.js`（PDF/文字进来 → hash 去重 → Document ID → Drive 存档 → 交给 GrabWeeklyParser）——接上这个之后，Import → Parse → Reconciliation → Verified Income 整条链就真正首尾相连了，不再需要手动传 parsedStatement 进去
