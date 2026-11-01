# S1 最终设计（S1 Final Design）：最小化 Official Contribution Record Core

| 项 | 值 |
|---|---|
| **状态** | **DESIGN ONLY** |
| **本轮是否修改代码** | **NO**（没有修改任何业务代码、测试代码、治理文件或正式配置；只读检查 + 文档交付） |
| **是否运行真实 GAS** | **NO**（也没有访问或修改任何生产数据、没有新增 Sheet、没有调用 Gemini、没有部署、没有迁移、没有创建真实记录） |
| **是否部署** | **NO** |
| **尚未解决的阻塞事项** | 见下方 B-1 … B-9（全部是 UNVERIFIED / PENDING，不是"已知没问题"） |
| 文档日期 | 2026-10-31 起草，2026-11-01 定稿（Asia/Kuala_Lumpur；文件名沿用本轮日期后缀） |
| 对应任务 | 2026-10-29 来信「Compliance OS — S1 Final Design 收敛任务」 |
| 同批文件 | `TruthWriter_Decision_Note_2026-10-31.md`、`S1_Test_Plan_2026-10-31.md`（本轮只交付这三份） |

**尚未解决的阻塞事项**

| # | 标记 | 内容 |
|---|---|---|
| B-1 | **UNVERIFIED** | SOCSO / EPF 官方文件的真实样子：收据 / 记录上印不印覆盖期、参考号长什么样、EPF 记录是一笔一张还是对账单里多行——政策登记表里这几项都是 NOT STATED（N6：EPF 凭证形式与参考号格式；N7：SKSPS 收据 / 参考号格式与多月预缴覆盖期规则），我没见过你的真实文件。所以证据种类设计得很通用，覆盖期允许"只知道起点"，由你的第一份真实文件（Test Plan 的 V8 / V9）来校准。 |
| B-2 | **UNVERIFIED** | 真实 GAS 的锁 / `flush` / 重入行为没有任何仓库内证据，官方 Lock 文档本会话重新抓取被拒（`PROVENANCE_REQUIRED`，没有绕过）。详见 Decision Note B-1。并发保护在验证之前只能说"设计上同一保护范围"。 |
| B-3 | **UNVERIFIED** | 真实 GAS 里已设文本格式的列读回过原生 `Date` 对象：仓库验证记录写明发生过、根因"尚未查明"（`VERIFICATION_STATUS.md:100–107`）。我没有独立验证；S1 的做法是读入边界一律规范化并自己做日历校验（§4.5）。 |
| B-4 | **PENDING** | 政策登记表（`Official_Policy_Register_2026-10-23.md`）仍等你抽查那 10 项。**S1 不含任何政策数值**（费率、资格、金额、生效日期），也不读取任何政策规则（§3.4）。 |
| B-5 | **UNVERIFIED** | UCR6 的原文不在仓库内（`900_Constitution.js:204` 只说 CMP-CR 建立在 UEF 的 UCR1-7 之上）；本文把 UCR6 理解为"Sheet 写入唯一出口、只追加"，来自引用处（`115:3–5`、`901:132`、`MODULE_CATALOG.md:43`）。 |
| B-6 | **UNVERIFIED** | 基线是 10-21 上传的 `07.Compliance-main.zip` 的只读工作副本（77 个文件）；之后你若改过任何文件，本文不知道。 |
| B-7 | **UNVERIFIED** | 本轮禁止访问真实 Sheet / 生产数据：真实表头是否漂移、现存数据、真实并发频率，均未知。 |
| B-8 | **PENDING（待你决定）** | §13 的决定 D-S1-1 … D-S1-15（最关键的三个：第 2 张表要不要进 S1、时间维度要不要进 S1、Freeze 例外 / TruthWriter 方案）。 |
| B-9 | **说明** | 来信写"基于已确认的用户决策"，但**没有列出清单**。本文只把来信明文与 10-21 授权信 D1–D6 当作已确认（§1.2）；上一轮的 D-1…D-18 没有收到答复，一律视为未决，默认值都标"默认，待确认"。 |

证据标签：【源码证实】= 本轮亲自读过那一行（**不等于**真实 GAS 观察）；【设计建议】= 我的设计判断，不是事实；【UNVERIFIED】= 没有证据，不得当事实；【PENDING】= 等你决定或核对。所有行号都指向 B-6 所说的基线副本。

---

## 0. 结论摘要

**S1 的最终形状（建议，待你确认）**

1. **4 张表、44 列**（来信暂定 5 表；上一轮 88 列）：`Official_Evidence`（12）、`Contribution_Plan_Lines`（9）、`Official_Payments`（15）、`Payment_Links`（8）。
2. 第 2 张表（用户状态／政策事实断言表）：**我无法证明它属于 S1 必需范围 → 推迟**（理由见 §6）。你若仍要它进 S1，备选规格在附录 A（11 列，S1 就变成 5 表 55 列），不需要再来一轮设计。
3. 上一轮 88 列里 **45 列被删除或推迟，43 列保留，新增 1 列**（`coverage_statement`），逐列去向见 §10。新增那一列的原因：来信要求"未知的结束日期不得推断"，上一轮的 `NOT_STATED` 只能表示"起止都没陈述"，**无法表示"起点已知、终点未知"**——而官方页面说保障"从缴款的日期和时间起"（登记表 POL-SOC-01/02，仅"官方证实·有限"、待抽查），所以"起点有、终点没有"很可能是常见情形。
4. **对照只做金额维度**（计划额 vs 已结清额，状态 `Planned / Partially_Paid / Paid / Overpaid / Not_Planned / Discrepancy_Flagged / Not_Applicable`）。时间维度（`due_date`、`Overdue`）和 SOCSO 覆盖时间线（缺口 / 重叠）**推迟**：它们不在来信列出的 S1 业务范围里，且 `Overdue` 对自雇 SOCSO / EPF 自愿缴款只是"相对你自己定的日期"，不是官方逾期（登记表 POL-SOC-07）。
5. 覆盖期只做**记录**，并提供一个三值查询 `coverageStatusOn_`：`COVERED / NOT_COVERED_BY_THIS_PAYMENT / UNKNOWN`；**终点未知时永远不会返回 `COVERED`**。
6. 写入走"受保护追加"（见 Decision Note，推荐方案 A）；**读取失败与"确实没有记录"是两种不同类型的结果**，任何路径都不得把异常当成空表（§8）。
7. 本文**不含任何政策数值**；示例全部虚构（附录 B）。

**需要你尽快回答的三件事**（其余都有默认值）

| 决定 | 一句话 | 我的默认 |
|---|---|---|
| D-S1-1 | 第 2 张表放不放进 S1 | 不放（推迟），备选规格见附录 A |
| D-S1-3 | 时间维度（`due_date` / `Overdue`）放不放进 S1 | 不放（推迟） |
| D-S1-9 | TruthWriter：是否批准 Freeze 例外去改 `115` | 批准 → 方案 A；不批准 → 方案 B1（Decision Note DT-1） |

---

## 1. 基线、方法与"已确认决策"的处理

### 1.1 做了什么、没做什么

- **只读**。读了 `115`、`117`、`116`、`105`、`106`、`108`、`109`、`190`、`195`、`140`、`170`、`130`、`150`、`160`、`900`、`MODULE_CATALOG.md`、`VERIFICATION_STATUS.md`、治理草案相关行，以及我方上一轮的设计报告、ADR 草案与政策登记表。
- **没有**：改任何文件、运行任何测试或脚本、运行真实 GAS、访问真实 Sheet、调用 Gemini、部署、迁移、创建记录。文中所有"预期通过 / 预期失败 / 会返回什么"都是设计预期，不是执行结果。
- 上一轮设计（7 表 / 129 列；S1 = 5 表 / 88 列）作为**起点**被重新核对：每一列都要有理由才保留（§10）。

### 1.2 来信里的"已确认的用户决策"

来信没有列出清单。本文只把下面两类当作**已确认**：

1. **来信本身的明文**：S1 = 暂定 5 张表；S1 业务范围与排除项；TruthWriter 的 A / B 两个方案并列待比较；未获批准的 ADR 保持 DRAFT；未知的保障结束日期不得推断；本轮只做设计。
2. **2026-10-21 授权信 D1–D6**（附件 `605f082a-attachment.txt` 第 38–120 行）：D1 总体范围已批准（计划 + 实际官方记录 + 对照，不做计算器）；D3 SOCSO 自缴、可一次缴多个月、覆盖期精确到日、不假设自然月、不得自行推断正式保险规则；D4 不得把未经核实的政策数字写死；D6 手动录入 + 正式文件引用，所有正式记录经过确定性验证、LLM 不得直接写入 Truth。

上一轮报告里的 **D-1…D-18 没有收到答复，一律视为未决**。与 S1 相关的那些被合并进 §13 的 D-S1-1…15（对应关系在 §13.2）。

---

## 2. S1 范围核对

### 2.1 来信列出的 S1 业务范围 → 设计落点

| 来信 §3 的 S1 范围 | 落点 |
|---|---|
| SOCSO 自雇人士缴款记录 | `Official_Evidence` + `Official_Payments`（`payment_kind = SOCSO_CONTRIBUTION`） |
| EPF 缴款记录 | `Official_Evidence` + `Official_Payments`（`payment_kind = EPF_CONTRIBUTION`） |
| 预算计划与实际官方缴款的可追溯比较 | `Contribution_Plan_Lines` + `Payment_Links` + 对照纯函数（金额维度，§7.2） |
| SOCSO 保障期间的精确日期记录，未知结束日期不得推断 | `Official_Payments` 的四个 `coverage_*` 栏位 + `coverageStatusOn_`（§7.3） |

### 2.2 来信排除项 → S1 里**不存在**的东西

| 排除项 | S1 里没有 |
|---|---|
| Tax / CP500 完整流程 | 没有 Tax 的证据种类、计划种类、付款种类、通知书转录、退款（负向结清） |
| EPF 激励的自动计算或资格判定 | 没有激励行、预期激励、i-Saraan（Plus）注册状态、规则版本、任何费率 / 上限 / 资格字段 |
| Grab 报销自动化 | 没有报销事件表、没有付款→报销链接、没有 `payer_channel` |
| Calendar 集成 | 没有 `due_date`、没有派生义务、不写 `Compliance_Calendar` |
| PDF / LLM 自动导入 | 没有 `entry_source`、没有导入路径；所有记录手动录入后过确定性校验（D6） |
| Phase P 重复收入修复 | 不碰 `110`、`140`、`170` 的导入路径 |
| 其他债务 / 信用卡 | 没有 |

### 2.3 相对上一轮设计，S1 内部又收窄了什么

| 收窄 | 原因 |
|---|---|
| 第 2 张表（`Scheme_Status_Log` / 断言表）推迟 | 无 S1 范围项消费它（§6） |
| `due_date`、`stated_deadline_date`、`Overdue` 推迟 | 不在来信 S1 范围；属于日历 / 时间维度（D-S1-3） |
| SOCSO 覆盖时间线（缺口、重叠、逐月表、`covered_today`）推迟 | 来信要的是"精确日期**记录**"，不是时间线分析；时间线是我自己加的功能 |
| `plan_set`（`MAIN` / `ALT-*`）、`scheme_option`、`rule_id`、`origin`、`notice_evidence_id` 推迟 | 都属于 Tax / 激励 / 方案比较（S3） |
| `payer_channel`、`entry_source` 推迟 | 在 S1 里都只有一个允许值，没有任何逻辑依赖 |
| 付款上的 `official_reference` / `reference_norm` / `evidence_exception_reason` 删除 | 付款**必须**挂证据（D-S1-4），参考号只放在证据上；"无凭证例外"取消 |

---

## 3. 四类事实的区分（来信 §4-A）

### 3.1 四类事实 + 一类元数据

| 代号 | 含义 | S1 里谁是 | 系统能做什么 | 系统**不能**做什么 |
|---|---|---|---|---|
| **OD** | **官方文件记载的事实**：来源是一份**已登记**的官方文件，**由你抄写**进来 | 付款的 `amount` / `payment_date` / `line_no`；证据的 `official_reference` / `document_date`；覆盖期（当 `coverage_basis = PRINTED_ON_EVIDENCE`） | 检查证据存在、有效、种类相容；检查格式 / 位数 / 日历真伪；检查重复与冲突 | **不能验证你抄的值与原件一致**；不能验证原件是官方文件；S1 不重算文件哈希 |
| **UD** | **用户主动申报的事实** | 计划行（预算）；链接的 `allocated_amount`；`coverage_basis = USER_STATED` 的覆盖期；证据的种类、存放位置、备注；`reason` / `note` | 检查格式；保留历史；永远标明"这是你的申报" | 不能判断申报对不对 |
| **SC** | **系统计算结果** | 对照状态、已结清额、差额、未分配额、完整性标注、`coverageStatusOn_` 的输出 | **只在查询时算**，输出带 `_source: 'Projection'`（先例 `160_MonthlyProjection.js:313`）；**不落地、不存快照**（CMP-P6，`900_Constitution.js:145`） | — |
| **UP** | **尚未核实的政策信息** | **S1 里没有**：不存、不读、不用（§3.4） | — | — |
| **M** | 系统元数据：键、`entry_seq`、`entry_type`、`recorded_at`、登记时测得的文件哈希 | 各表的键与审计栏位 | 由系统生成 / 校验；不是关于世界的事实 | — |

> "OD"的诚实说明：这类栏位在表上叫"官方"，实际上是**"你声称原件上写着这个"**。S1 没有第二个人复核、也不读取文件内容。降低抄写风险的办法只有三条：①付款必须挂证据（原件可被找到）；②更正有完整历史（§5 各表的"历史修正"）；③第一份真实文件逐字段人工核对（Test Plan 的 V8 / V9）。

### 3.2 不得自动升级用户断言（来信 §4-A 最后一句）

| # | 规则 | 如何落实 |
|---|---|---|
| R-F1 | 任何 OD 类栏位只能出现在**带有效 `evidence_id`** 的行里（付款） | 行级校验 + 锁内检查证据存在且有效（§9.2） |
| R-F2 | `coverage_basis = PRINTED_ON_EVIDENCE` 只在付款已挂有效证据时才被接受；`USER_STATED` 永远不要求证据，也永远不会被系统改成 `PRINTED_ON_EVIDENCE` | 行级校验；Test Plan D 组 |
| R-F3 | 把 `USER_STATED` 改为 `PRINTED_ON_EVIDENCE` 只能由你提交一条 `CORRECTION` / `REVISION`（必须写 `reason`），系统不会自动做，历史里留着前一条 | `entry_type` 规则 |
| R-F4 | 所有输出把 OD / UD 标出来：对照结果里每笔付款带 `evidence_id` 和证据种类；覆盖期查询带 `basis` | 纯函数输出结构（§7） |
| R-F5 | SC 类结果永不写回任何表 | 静态检查：S1 模块里没有对 S1 表的"状态"类写入；对照函数是纯函数 |
| R-F6 | UP 类信息不进入 S1 的任何表、常量或函数（§3.4） | 静态检查（Test Plan H1） |

### 3.3 "系统验证什么 / 不验证什么"一览

| 系统会验证 | 系统不会（也不能）验证 |
|---|---|
| 证据已登记且有效、种类与付款相容；金额 ≤ 2 位小数；日期是真实的日历日期；键与栏位一致；同键重复 / 冲突；外键存在；超额分配 | 抄写的金额 / 日期 / 参考号是否与原件一致；原件是否真是官方文件；Drive 文件内容是否仍与登记的哈希一致；覆盖期是否符合 PERKESO 的规则 |

### 3.4 "尚未核实的政策信息"在 S1 里的处理：不存、不读、不用

S1 **不依赖**下表任何一点，也不在代码或 Sheet 里保存它们的数值（来信 §5 最后一条、10-21 授权信 D4）。登记表仍等你抽查，所以这些点现在都只是"有线索 / 待核实"，不是事实：

| 政策点 | 登记表条目 | 当前状态（按登记表原标记） | S1 怎么处理 |
|---|---|---|---|
| SOCSO 保障"从缴款的日期和时间起" | POL-SOC-01 / 02 | 官方证实·有限（页面日期 NOT STATED；待抽查） | 覆盖起点是**你录入的值**，系统从不取 `payment_date` 去补 |
| 多月预缴的覆盖期怎么算 | N7 | NOT STATED（官方页面没写；登记表只有「从缴款日期和时间起」） | 覆盖终点是你录入的值或"未知"，系统从不用"缴款日 + N 个月"去补 |
| SKSPS 的档位与金额 | POL-SOC-01 | 官方证实（待抽查） | `planned_amount` 完全由你填，S1 没有任何默认值或查表 |
| EPF i-Saraan / Plus 的比例、上限、资格 | POL-EPF-01 / 02；N10 | 部分 PENDING | 完全不涉及 |
| SOCSO 雇主缴款期限与利息 | POL-SOC-07 | **不适用**于自雇缴款 | 不得套用；S1 没有期限概念 |

> 落实方式：静态检查 S1 模块里**没有**政策类标识符与数字字面量（Test Plan H1）；本文示例金额 / 日期全部虚构（附录 B）。

---

## 4. 通用约定（四张表共用）

### 4.1 追加链（entry chain）

每一行是一条"条目"（entry）；同一业务键的全部条目是一条"链"（chain）。条目**只追加**：不改、不删、不覆盖（CMP-P4，`900_Constitution.js:133`；UCR6 原文缺失见 B-5）。

| 栏位 | 每张表都有 | 作用 |
|---|---|---|
| 键栏位（`evidence_id` / `plan_key` / `payment_key` / `link_key`） | ✓ | 链的稳定业务身份（§4.2） |
| `entry_seq` | ✓ | 链内序号，整数 ≥ 1。"谁是最新"只看它，**不看 `recorded_at`** |
| `entry_type` | ✓ | `ORIGINAL / REVISION / CORRECTION / VOID` |
| `reason` | ✓ | 非 ORIGINAL 必填：为什么改、为什么作废 |
| `recorded_at` | ✓ | 系统写入时间（UTC ISO-8601，带 `Z`）。**只供审计**：不参与身份、排序、"相同"判断 |

**四种条目类型，以及各表允许哪些**（这四种正好对应 10-21 授权信要求说明的"计划调整、取消、付款更正、重复提交"）

| `entry_type` | 含义 | Evidence | Plan | Payments | Links |
|---|---|---|---|---|---|
| `ORIGINAL` | 链的第一条（`entry_seq = 1`，且只能是 1） | ✓ | ✓ | ✓ | ✓ |
| `REVISION` | **世界变了**：你改了预算、改了分配方式 | — | ✓ | — | ✓ |
| `CORRECTION` | **之前抄错了**：照原件改正 | ✓ | ✓ | ✓ | ✓ |
| `VOID` | 整条记录作废（内容 = 作废前最后有效内容的完整副本） | ✓ | ✓ | ✓ | ✓ |

> 证据与付款是"原件上写着什么"的转录，不存在"世界变了"的情形，所以它们没有 `REVISION`：改了就是改正（`CORRECTION`）。计划与链接是你自己的申报，会随想法变化，所以有 `REVISION`。重复提交不需要条目类型：由 §9.2 的判定吸收（`Already_Recorded`）。

**链规则**（【设计建议】）

| # | 规则 |
|---|---|
| C1 | 链的第一条必须是 `ORIGINAL` 且 `entry_seq = 1`；`ORIGINAL` 不能出现在别的位置 |
| C2 | 新条目的 `entry_seq` 必须等于链上当前最大序号 + 1（否则 `Stale_Sequence`，§9.2） |
| C3 | **有效条目 = 链上 `entry_seq` 最大的那条**。它是 `VOID` → 该链"已作废"，不进入有效视图，但仍可被查询为 `Voided` |
| C4 | `VOID` 条目的内容栏位必须与作废前的有效条目逐一相同（`VOID_SNAPSHOT_MISMATCH` 守卫）。这样每一行都自己说明"被作废的是什么" |
| C5 | 作废之后允许用 `REVISION` / `CORRECTION` **复活**（必须写 `reason`，携带完整新内容）。原因：键由事实推导，同一事实重新登记只能得到同一个键 |
| C6 | 非 `ORIGINAL` 条目必须写 `reason` |
| C7 | **身份栏位在链内不可变**：每个条目重新推导出的键必须等于它的键栏位。要改身份 = `VOID` 旧链 + 登记新链（代价见 §12 R-S1-2） |
| C8 | 内容的变化只能经 `REVISION` / `CORRECTION`；`VOID` 不得改内容（C4） |

### 4.2 业务键（只由业务事实推导，没有时间戳、计数器、随机数）

| 表 | 键栏位 | 构造 | 例（**虚构**） |
|---|---|---|---|
| `Official_Evidence` | `evidence_id` | 有文件：`CMP-EVD-F-{H16}`；无文件：`CMP-EVD-R-{SCHEME}-{REFNORM}` | `CMP-EVD-F-A1B2C3D4E5F60718`；`CMP-EVD-R-SOCSO-EX-0001` |
| `Contribution_Plan_Lines` | `plan_key` | `CMP-PLN-MAIN-{LINE_KIND}-{YYYY-MM}` | `CMP-PLN-MAIN-SOCSO_CONTRIBUTION-2026-07` |
| `Official_Payments` | `payment_key` | `CMP-PAY-{PAYMENT_KIND}-{EVC}-L{line_no}` | `CMP-PAY-SOCSO_CONTRIBUTION-F-A1B2C3D4E5F60718-L1` |
| `Payment_Links` | `link_key` | `CMP-LNK-{payment_key}~{plan_key}` | 见附录 B |

符号：`H16` = 文件 SHA-256（小写十六进制）的前 16 位**转大写**；`SCHEME` = `SOCSO` 或 `EPF`（由 `evidence_kind` 决定）；`REFNORM` 见 §4.6；`EVC` = `evidence_id` 去掉 `CMP-EVD-` 前缀；`MAIN` 是字面量（"主计划"，多方案比较推迟，见 §2.3）；`LINE_KIND` / `PAYMENT_KIND` 取 `EPF_CONTRIBUTION` 或 `SOCSO_CONTRIBUTION`。

| # | 规则 |
|---|---|
| K1 | 键只含业务事实。来信 §4-C："不得直接使用不稳定的时间戳作为唯一业务身份"；仓库现状是时间戳派生 id（`110_DocumentImport.js:47,210`、`130_Reconciliation.js:103`、`150_ComplianceCalendar.js:172`），本设计**不沿用** |
| K2 | 同一业务事实永远得到同一个键 → 重复提交落在同一条链上，由 §9.2 吸收，不会长出第二个"正式记录" |
| K3 | `payment_key` **以证据为锚**：同一份证据 + 同一行号 → 同一个付款键。"同一张收据被重复登记"在键上就撞车，不依赖参考号有没有抄对 |
| K4 | 键是单射的：`payment_key` 由 (`payment_kind`, `evidence_id`, `line_no`) 唯一决定；从**最后一个** `-L` 切开可以反向解出（`line_no` 只含数字，不含 `L`）。`link_key` 用 `~` 分隔，而 `~` 不在 `REFNORM` 字符集里，也不会出现在任何键里 |
| K5 | `H16` 只有 64 位。理论上两个不同文件可能同前缀；这种情形会表现为"同键 + 同序号 + 不同内容"→ `Conflict`（完整哈希不同），**不会静默合并** |

**取舍（明说，不掩盖）**

| # | 取舍 | 后果 |
|---|---|---|
| T1 | 同一份文件**重新扫描**（字节不同 → 哈希不同）得到另一个 `evidence_id` | 系统挡不住；只有两份证据都有参考号、且规范化后相同，才给出 `POSSIBLE_DUPLICATE_EVIDENCE` 提示（不阻止，CMP-P12，`900_Constitution.js:183`） |
| T2 | 仅参考号的证据，参考号抄错 = 键错 | 只能 `VOID` + 重新登记，且挂在它下面的付款也要重登记（级联）。这是"不用时间戳、不用随机数"换来的代价 |
| T3 | 有文件的证据**换存放位置**（新 `drive_file_id`、同一字节） | 哈希不变 → 键不变，用 `CORRECTION` 更新位置即可 |

### 4.3 "相同"与"状态签名"

- **相同（same）**：两行在**除 `recorded_at` 以外**的所有栏位上，规范化之后逐一相等。规范化 = 文本 trim；金额转整数分；日期转 `YYYY-MM-DD`；空字符串与 `null` 视为相等；哈希转小写。
- **状态签名（state signature）**：`isVoid` + 除 `entry_seq`、`entry_type`、`reason`、`recorded_at` 之外的规范化内容。两个条目"状态签名相等"= 它们描述的是**同一个有效状态**。
- 用途（详见 §9.2 与 Decision Note）：同序号 + 相同 → `Already_Recorded`；同序号 + 不同 → `Conflict`；**新序号但状态签名与链头相等** → `Already_Recorded`（这让"超时后用重新计算的序号重发"也不会追加第二行）。

### 4.4 栏位类型（Sheet 层）

现有建表机制的 schema 形状是 `{name, columns, textColumns}`（`108_SheetSetup.js:46`）；**不在 `textColumns` 里的栏位让 Sheets 当数字处理**（`108:19–20`）。凡 ID、哈希、日期字符串、ISO 时间戳一律设为纯文本 `@` 格式（`108:15–20`、`:152–160`），原因是仓库已记录的"日期字符串被 Sheets 静默转成日期序列值"教训（`108:59–64`；`115:11–14`）。

| 表 | 栏位数 | 文本栏位 | 数字栏位（不进 `textColumns`） |
|---|---|---|---|
| `Official_Evidence` | 12 | 11 | `entry_seq` |
| `Contribution_Plan_Lines` | 9 | 7 | `entry_seq`、`planned_amount` |
| `Official_Payments` | 15 | 12 | `entry_seq`、`amount`、`line_no` |
| `Payment_Links` | 8 | 6 | `entry_seq`、`allocated_amount` |
| **合计** | **44** | **36** | **8** |

### 4.5 金额、日期与时区规则

**金额**（CMP-P9，`900_Constitution.js:166`；CMP-P10，`:171`）

| 规则 | 内容 |
|---|---|
| 接受的输入 | JS number，或十进制字符串 |
| 转换 | number → `String(x)`（**不设容差参数**）；字符串原样 |
| 严格格式 | `^[0-9]{1,9}(\.[0-9]{1,2})?$`，且 > 0 |
| 拒绝 | 科学计数法、负号、前后空白、千分位、全角数字、空值、超过 2 位小数、整数部分超过 9 位 |
| 内部表示 | **整数分**（由整数部分与小数部分分别解析，不经浮点乘法） |
| 不使用 | `round2_`（`106_Utils.js:12–14`）：它会把抄错的金额**静默**四舍五入成另一个数，违背 CMP-P10 |

| 输入（虚构） | 结果 |
|---|---|
| `100`、`"100"` | 接受 → 10000 分 |
| `100.5`、`"100.50"` | 接受 → 10050 分 |
| `"100.005"` | `AMOUNT_TOO_MANY_DECIMALS` |
| `0.1 + 0.2`（JS number，`String` 得 `0.30000000000000004`） | `AMOUNT_TOO_MANY_DECIMALS` |
| `"1e3"`、`"-5"`、`"1,000.00"`、`" 100"`、`"１００"` | `AMOUNT_FORMAT_INVALID` |
| `0`、`"0.00"` | `AMOUNT_NOT_POSITIVE` |
| `"1000000000"`（10 位整数） | `AMOUNT_TOO_LARGE` |
| 空 / `null` | `REQUIRED_MISSING` |

**日期**（CMP-CR4，`900_Constitution.js:223`）

| 规则 | 内容 |
|---|---|
| 格式 | 严格 `YYYY-MM-DD`；整数年 / 月 / 日；用 `Date.UTC` 构造再回读比对（防 `2026-02-30`、闰年错误）。**不得**只用 `normalizeIsoDateString_`（`106:32–44`）——它不验证日历真伪，且对 Date 物件用的是本地时区读取 |
| "不得晚于今天" | 只适用于 `payment_date`、`document_date`；"今天"= `Asia/Kuala_Lumpur` 的日历日，由边缘层算好以 `{y, m, d}` **注入**；纯校验函数不读时钟 |
| 覆盖期日期、`period_key` | 与"今天"无关（覆盖期可以在未来：预缴） |
| 读回 | 从 Sheet 读到的日期栏位先经 `normalizeIsoDateString_` 规范化，再做上面的日历校验；原因 B-3（原生 Date 读回，根因 UNVERIFIED）。已存的行用 `checkFuture = false` 校验（早先合法的行不会因为时间推移变非法） |

**时区**

- `appsscript.json:2` 的项目时区是 `Asia/Singapore`【源码证实】；业务日期**不依赖它**：S1 明确使用 `Asia/Kuala_Lumpur`（D-S1-13）。
- 既有风险：`150_ComplianceCalendar.js:72` 用 UTC 日期分量，导致马来西亚时间 00:00–08:00 差一天【源码证实】。S1 **不用** `getUTC*` 或主机本地时区去取"今天"；是否另案修 `150` 不在 S1。
- 边缘层取"今天"的方法 `Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd')` **UNVERIFIED**（Test Plan V10）；在验证前，只能说"设计上这样做"。
- `recorded_at` 是 UTC ISO（`new Date().toISOString()`，带 `Z`），只用于审计。

### 4.6 参考号规范化（`REFNORM`）与文件哈希

**`REFNORM(text)`**（只在两处用：①无文件证据取键；②计算 `POSSIBLE_DUPLICATE_EVIDENCE`）

1. trim，并**去掉全部空白字符**（`\s`，含 NBSP、全角空格）；
2. 检查每个字符 ∈ `[A-Za-z0-9._/#-]`——**先检查、后转大写**：非 ASCII 一律拒绝（避免 Unicode 大小写映射把 `ı` 变成 `I` 之类的意外）；
3. 转大写；长度必须 1–64；
4. 失败：无文件证据 → `Invalid(REFERENCE_NOT_NORMALIZABLE)`；有文件证据 → 只是不参与重复提示，**不**视为校验错误。

**文件哈希**：`file_hash_sha256` = 64 位小写十六进制；输入允许大写，规范化为小写后再校验。哈希由**登记边缘适配器**对文件字节计算后传入——**复用既有的 `computeFileHash_(fileBytes)`**（`110_DocumentImport.js:95–101`：`Utilities.computeDigest(SHA_256)`，输出小写十六进制），不另写一份；纯校验函数只验格式并核对它与 `evidence_id` 的 `H16` 一致。该函数在 Node 里测不了（`111_Tests_DocumentImport.js:349` 自己写明），对真实文件内容是否算对 **UNVERIFIED**，并入 Test Plan V8（用独立工具复算对照）。S1 **不会**事后重新核对 Drive 文件是否仍与登记时的哈希一致（§3.3）。

### 4.7 行级校验错误码与写入结果词汇

**行级校验**（纯函数；一次返回**全部**错误，不止第一个；没有读写任何 Sheet）

| 错误码 | 触发 |
|---|---|
| `REQUIRED_MISSING` | 必填栏位为空 |
| `ENUM_VALUE_INVALID` | 不在允许值内 |
| `AMOUNT_FORMAT_INVALID` / `AMOUNT_TOO_MANY_DECIMALS` / `AMOUNT_NOT_POSITIVE` / `AMOUNT_TOO_LARGE` | §4.5 |
| `DATE_FORMAT_INVALID` / `DATE_NOT_REAL` / `DATE_IN_FUTURE` | §4.5 |
| `PERIOD_KEY_INVALID` | 不是 `YYYY-MM`（月 01–12） |
| `LINE_NO_INVALID` | 不是整数 ≥ 1 |
| `COVERAGE_COMBINATION_INVALID` | `coverage_statement` 与起止日期 / `coverage_basis` 的有无不匹配（§5.3） |
| `COVERAGE_END_BEFORE_START` | 终点早于起点 |
| `COVERAGE_NOT_ALLOWED_FOR_KIND` | EPF 付款带了覆盖期栏位 |
| `EVIDENCE_SOURCE_MISSING` | 既无文件、也无（参考号 + 存放位置） |
| `FILE_FIELDS_INCOMPLETE` | `drive_file_id` 与 `file_hash_sha256` 只有一个 |
| `FILE_HASH_FORMAT_INVALID` | 哈希不是 64 位十六进制 |
| `REFERENCE_NOT_NORMALIZABLE` | 无文件证据的参考号无法规范化 |
| `KEY_MISMATCH` | 键栏位 ≠ 由事实重新推导出的键（含 C7 身份被改） |
| `ENTRY_SEQ_INVALID` | `entry_seq` 不是整数 ≥ 1；或 `ORIGINAL` 不是 1 |
| `ENTRY_TYPE_NOT_ALLOWED` | 该表不允许这个条目类型（如付款用 `REVISION`） |
| `REASON_REQUIRED` | 非 `ORIGINAL` 缺 `reason` |
| `TEXT_TOO_LONG` | 文本栏位超长（`note` / `reason` / `accessible_location` ≤ 500 字符；`official_reference` ≤ 120；`drive_file_id` ≤ 200） |
| `RECORDED_AT_INVALID` | 仅"已存行"校验：`recorded_at` 不是 UTC ISO |

> 长度上限是我随手定的防呆值，**不是**政策值，可以调整。

**写入结果词汇**（与 Decision Note §4–§5 一致）

| 结果 | 含义 | `written` | 调用方 |
|---|---|---|---|
| `Appended` | 本次调用追加了一行 | `YES` | 完成 |
| `Already_Recorded` | 同序号相同内容，或新序号但状态签名与链头相等：**本次没有写入** | `NO` | 视为成功（幂等） |
| `Conflict` | 同键同序号但内容不同 | `NO` | 人工查看；系统不自动解决 |
| `Stale_Sequence` | `entry_seq` ≠ 当前最大 + 1，且不属于上面两种"已记录" | `NO` | 带返回的 `expectedSeq` 与当前有效内容重新决定 |
| `Rejected(code)` | 通过行级校验，但违反跨记录规则（§9.2） | `NO` | 修正前提后再试 |
| `Invalid(errors[])` | 行级校验失败（未读写任何 Sheet） | `NO` | 修正输入 |
| `Failed{phase, written}` | 基础设施失败；`phase ∈ SCHEMA / LOCK / READ / DECIDE / APPEND / FLUSH` | `NO` 或 `MAYBE` | `NO` → 直接重试；`MAYBE` → **原样重发**，结果会收敛（§9.3） |

`phase` 与 `written` 的对应：`SCHEMA`、`LOCK`、`READ`、`DECIDE` → `NO`；`APPEND`、`FLUSH` → `MAYBE`（`appendRow` 失败是否留下半行、`flush` 是否必要均 **UNVERIFIED**，V4 / V7）。`SCHEMA` 只出现在锁外的表头预检（§8）。

**读取侧结果**（§8）：`Read_Failed{reason}`，`reason ∈ SHEET_MISSING / ROW_WIDTH_MISMATCH / SCHEMA_MISMATCH / API_ERROR`；按键查询：`Found / Not_Found / Voided / Read_Failed`。

---

## 5. 四张表的规格（来信 §4-A）

栏位表约定：类型 = `文本`（纯文本 `@`）或 `数字`；"必填"里的"条件"见规则列；**事实类**见 §3.1（OD 官方文件记载 / UD 用户申报 / M 系统元数据）。所有"允许值"都是**本设计的闭集**，不是政策枚举。

### 5.1 `Official_Evidence`（12 列）

**业务用途**：登记"你拿什么当官方依据"——一份 SOCSO / EPF 的缴款记录或收据，有文件，或没有文件但有参考号与存放位置。付款必须挂在某条有效证据下（D-S1-4）。它**不解析**文件内容，也**不保存**文件。

| # | 栏位 | 类型 | 必填 | 允许值 / 规则 | 事实类 |
|---|---|---|---|---|---|
| 1 | `evidence_id` | 文本 | ✓ | 派生键（§4.2）；每个条目重新推导后必须相等 | M |
| 2 | `entry_seq` | 数字 | ✓ | 整数 ≥ 1；`ORIGINAL` = 1；之后 = 当前最大 + 1 | M |
| 3 | `entry_type` | 文本 | ✓ | `ORIGINAL` / `CORRECTION` / `VOID` | M |
| 4 | `evidence_kind` | 文本 | ✓ | `SOCSO_PAYMENT_RECORD` / `EPF_PAYMENT_RECORD`。**不区分**收据、对账单、门户截图——我没见过真实文件（B-1），区分会是猜测（D-S1-10） | UD |
| 5 | `official_reference` | 文本 | 条件 | 无文件时必填；有文件时可选。照文件印刷抄写，trim 后保存，≤ 120 字符 | OD |
| 6 | `document_date` | 文本 | 可选 | 严格 `YYYY-MM-DD`；不得晚于今天（KL） | OD |
| 7 | `drive_file_id` | 文本 | 条件 | 与哈希**同有同无**；无空白；≤ 200 字符 | M |
| 8 | `file_hash_sha256` | 文本 | 条件 | 64 位小写十六进制（§4.6） | M |
| 9 | `accessible_location` | 文本 | 条件 | 无文件时必填：怎么找到原件（例如"纸本，放在文件夹 X"——虚构）；有文件时可空；≤ 500 | UD |
| 10 | `note` | 文本 | 可选 | ≤ 500 | UD |
| 11 | `reason` | 文本 | 条件 | 非 `ORIGINAL` 必填；≤ 500 | UD |
| 12 | `recorded_at` | 文本 | ✓ | UTC ISO-8601（带 `Z`），系统生成，仅审计 | M |

**"有文件" / "无文件"**：`drive_file_id` 与 `file_hash_sha256` 都非空 = 有文件；都为空 = 无文件（则必须有 `official_reference` 与 `accessible_location`，否则 `EVIDENCE_SOURCE_MISSING`）；只有其一 → `FILE_FIELDS_INCOMPLETE`。

| 项 | 内容 |
|---|---|
| **主键与关联键** | 链键 `evidence_id`；条目唯一标识 = (`evidence_id`, `entry_seq`)。被 `Official_Payments.evidence_id` 引用（多对一） |
| **来源与证据关系** | 它**就是**来源登记：有文件 → 原件在 Drive，登记时测得的哈希是当时内容的指纹，之后文件被改系统**不会发现**（§3.3）；无文件 → 原件在 `accessible_location`（纸本、门户……），系统打不开，只靠你的描述。两种都**不等于**"系统验证为官方"——系统里"官方"的意思是"你声明它是官方文件" |
| **重复识别** | 同文件字节（同哈希）→ 同键 → 相同则 `Already_Recorded`、不同则 `Conflict`，**不会出现第二条链**；无文件证据同 `SCHEME` + 同 `REFNORM` → 同键，同上；**重新扫描**（字节不同）→ 不同键 → 若两份的参考号规范化后相同，给 `POSSIBLE_DUPLICATE_EVIDENCE` 提示（不阻止） |
| **历史修正** | 抄错参考号 / 日期 / 种类 / 位置 / 备注 → `CORRECTION`（必填 `reason`）。键相关的事实变了（文件字节、无文件证据的参考号 / `SCHEME`）→ 不可 `CORRECTION`（C7，`KEY_MISMATCH`），只能 `VOID` + 登记新链（T2）。`VOID` 时若仍有有效付款引用它 → `Rejected(EVIDENCE_IN_USE)`（先作废付款）。`CORRECTION` 改 `evidence_kind` 导致已挂付款不再相容 → `Rejected(EVIDENCE_KIND_CHANGE_BREAKS_PAYMENTS)`。作废后可复活（C5） |
| **查询失败 vs 确实没有** | 按键查询返回 `Found` / `Not_Found`（**读取成功且**无此键）/ `Voided` / `Read_Failed{reason}`。付款登记时：证据读取失败 → `Failed{READ, NO}`（**不是** `EVIDENCE_NOT_FOUND`）；`Not_Found` 或 `Voided` → `Rejected(EVIDENCE_NOT_FOUND)`，`detail.state` 区分这两种 |

### 5.2 `Contribution_Plan_Lines`（9 列）

**业务用途**：你的预算——某个月打算向 EPF 或 SOCSO 缴多少。它是对照的"计划"一侧，是你的**申报**（UD），不是官方事实，不需要证据。`period_key` 是**预算月份**（记账桶），**不是**覆盖期、**不是**到期月（§7.4）。

| # | 栏位 | 类型 | 必填 | 允许值 / 规则 | 事实类 |
|---|---|---|---|---|---|
| 1 | `plan_key` | 文本 | ✓ | 派生键（§4.2） | M |
| 2 | `entry_seq` | 数字 | ✓ | 同 §5.1 | M |
| 3 | `entry_type` | 文本 | ✓ | `ORIGINAL` / `REVISION` / `CORRECTION` / `VOID` | M |
| 4 | `line_kind` | 文本 | ✓ | `EPF_CONTRIBUTION` / `SOCSO_CONTRIBUTION`（键的一部分，不可变） | UD |
| 5 | `period_key` | 文本 | ✓ | `YYYY-MM`，月 01–12（键的一部分，不可变） | UD |
| 6 | `planned_amount` | 数字 | ✓ | > 0，≤ 2 位小数（§4.5）；**完全由你填，没有默认值、没有查表** | UD |
| 7 | `note` | 文本 | 可选 | ≤ 500（可写你的依据） | UD |
| 8 | `reason` | 文本 | 条件 | 非 `ORIGINAL` 必填 | UD |
| 9 | `recorded_at` | 文本 | ✓ | 同 §5.1 | M |

| 项 | 内容 |
|---|---|
| **主键与关联键** | 链键 `plan_key`；被 `Payment_Links.plan_key` 引用（一对多） |
| **来源与证据关系** | 没有官方来源。系统**不检查**数额合不合理（S1 没有任何政策值，D4）；依据写在 `note` |
| **重复识别** | 同 (`line_kind`, `period_key`) 只能有**一条**链。同一个月同一种制度想放两行 → **S1 不支持**（那是 S3 的多方案 / `plan_set`）；需要时合成一行并在 `note` 说明 |
| **历史修正** | 预算改了 → `REVISION`；抄错 → `CORRECTION`；取消 → `VOID`（仍有有效链接 → `Rejected(LINKS_EXIST)`，先作废链接）。改 `line_kind` / `period_key` = 改身份 → `VOID` + 新链（链接也要重做）。预算改小到低于已结清额**不会被拒绝**：对照会显示 `Overpaid`（不阻止，CMP-P12） |
| **查询失败 vs 确实没有** | 同 §5.1。**读取失败时对照不输出任何计划行**（返回 `Read_Failed`），而不是输出"全部 `Planned`" |

### 5.3 `Official_Payments`（15 列）

**业务用途**：官方记录上的一次缴款（OD）：缴了多少、哪天缴、凭哪份证据；SOCSO 另记**覆盖期记录**。**一笔付款 = 一份证据上的一行**（`line_no`）。

| # | 栏位 | 类型 | 必填 | 允许值 / 规则 | 事实类 |
|---|---|---|---|---|---|
| 1 | `payment_key` | 文本 | ✓ | 派生键（§4.2） | M |
| 2 | `entry_seq` | 数字 | ✓ | 同 §5.1 | M |
| 3 | `entry_type` | 文本 | ✓ | `ORIGINAL` / `CORRECTION` / `VOID` | M |
| 4 | `payment_kind` | 文本 | ✓ | `SOCSO_CONTRIBUTION` / `EPF_CONTRIBUTION`（键的一部分，不可变）；须与证据种类相容 | OD |
| 5 | `amount` | 数字 | ✓ | > 0，≤ 2 位小数（§4.5）；官方记录上的实缴金额。**不建模负数 / 退款**（§7.2） | OD |
| 6 | `payment_date` | 文本 | ✓ | 严格 `YYYY-MM-DD`；不得晚于今天（KL）；官方记录上的缴款日 | OD |
| 7 | `line_no` | 数字 | ✓ | 整数 ≥ 1：这份证据上的第几笔；一页一笔则为 1（键的一部分，不可变） | M |
| 8 | `evidence_id` | 文本 | ✓ | 必须指向一条**有效**证据（键的一部分，不可变） | M（外键） |
| 9 | `coverage_statement` | 文本 | 条件 | SOCSO 付款**必填**：`NOT_STATED` / `START_ONLY` / `START_AND_END`；EPF 付款必须为空 | UD 或 OD（按 `coverage_basis`） |
| 10 | `coverage_start` | 文本 | 条件 | 见下表；严格日期 | 同上 |
| 11 | `coverage_end` | 文本 | 条件 | 见下表；严格日期，**含当日**，≥ 起点 | 同上 |
| 12 | `coverage_basis` | 文本 | 条件 | `PRINTED_ON_EVIDENCE` / `USER_STATED`；见下表 | UD |
| 13 | `note` | 文本 | 可选 | ≤ 500 | UD |
| 14 | `reason` | 文本 | 条件 | 非 `ORIGINAL` 必填 | UD |
| 15 | `recorded_at` | 文本 | ✓ | 同 §5.1 | M |

**覆盖期四栏的组合规则**（来信："SOCSO 保障期间的精确日期记录，未知结束日期不得推断"）

| `coverage_statement` | `coverage_start` | `coverage_end` | `coverage_basis` | 含义 |
|---|---|---|---|---|
| `NOT_STATED` | 必须空 | 必须空 | 必须空 | 文件与你都没有陈述覆盖期；系统**不推断** |
| `START_ONLY` | 必填 | 必须空 | 必填 | 只知道起点（例如文件印着"自某日起"）；**终点未知，永不推断** |
| `START_AND_END` | 必填 | 必填，≥ 起点 | 必填 | 起止都有；终点含当日 |
| （EPF 付款） | 必须空 | 必须空 | 必须空 | `coverage_statement` 也必须空；EPF 不套用覆盖期模型（D3；来信 B）→ 带任何覆盖期栏位 = `COVERAGE_NOT_ALLOWED_FOR_KIND` |

不符合上表 → `COVERAGE_COMBINATION_INVALID`；终点早于起点 → `COVERAGE_END_BEFORE_START`。**S1 不假设覆盖期按自然月划分**，也**不**从 `payment_date` 或缴款月份去补起点 / 终点（D3、§3.4）。

| 项 | 内容 |
|---|---|
| **主键与关联键** | 链键 `payment_key`；外键 `evidence_id` → `Official_Evidence`（有效、种类相容：`SOCSO_CONTRIBUTION` ↔ `SOCSO_PAYMENT_RECORD`，`EPF_CONTRIBUTION` ↔ `EPF_PAYMENT_RECORD`，否则 `Rejected(EVIDENCE_KIND_MISMATCH)`）；被 `Payment_Links.payment_key` 引用 |
| **来源与证据关系** | `evidence_id` 必填（R-F1）。覆盖期 `PRINTED_ON_EVIDENCE` = 你从证据上转录；`USER_STATED` = 你自己的陈述（来自门户、通知或你的理解）。系统**永不**把 `USER_STATED` 升级成 `PRINTED_ON_EVIDENCE`（R-F2、R-F3） |
| **重复识别** | 同证据 + 同行号 → 同键（相同 → `Already_Recorded`；不同 → `Conflict`）。同证据不同行号（对账单多行，正常）→ 不同键，不提示。**不同键但**有效付款的 `payment_kind`、`amount`、`payment_date` 都相同 → `POSSIBLE_DUPLICATE`（提示，不阻止：可能真的缴了两次） |
| **历史修正** | 金额 / 日期 / 覆盖期抄错 → `CORRECTION`；`amount` 改小到低于已分配总额 → `Rejected(ALLOCATION_EXCEEDS_AMOUNT)`（先改链接）；作废 → `VOID`（仍有有效链接 → `Rejected(LINKS_EXIST)`）；改 `payment_kind` / `evidence_id` / `line_no` = 改身份 → `VOID` + 新链；覆盖期 `USER_STATED` → `PRINTED_ON_EVIDENCE` 只能由你提交 `CORRECTION` + `reason`（R-F3） |
| **查询失败 vs 确实没有** | 同 §5.1：`Found` / `Not_Found` / `Voided` / `Read_Failed{reason}`；覆盖期查询在读取失败时返回 `Read_Failed`，**不会**返回 `UNKNOWN` 或 `NOT_COVERED_BY_THIS_PAYMENT` |

### 5.4 `Payment_Links`（8 列）

**业务用途**：把"某笔付款里的多少钱"算在"某个计划行"上（UD）。这是多对多：一笔付款覆盖多个月（一对多）；一个月分几次缴（多对一）。系统**不按比例自动拆分**，**不按覆盖期自动对应**——`allocated_amount` 由你陈述。

| # | 栏位 | 类型 | 必填 | 允许值 / 规则 | 事实类 |
|---|---|---|---|---|---|
| 1 | `link_key` | 文本 | ✓ | 派生键（§4.2） | M |
| 2 | `entry_seq` | 数字 | ✓ | 同 §5.1 | M |
| 3 | `entry_type` | 文本 | ✓ | `ORIGINAL` / `REVISION` / `CORRECTION` / `VOID` | M |
| 4 | `payment_key` | 文本 | ✓ | 必须指向一条**有效**付款（键的一部分，不可变） | M（外键） |
| 5 | `plan_key` | 文本 | ✓ | 必须指向一条**有效**计划行（键的一部分，不可变） | M（外键） |
| 6 | `allocated_amount` | 数字 | ✓ | > 0，≤ 2 位小数；这笔付款有多少算在这行上 | UD |
| 7 | `reason` | 文本 | 条件 | 非 `ORIGINAL` 必填 | UD |
| 8 | `recorded_at` | 文本 | ✓ | 同 §5.1 | M |

| 项 | 内容 |
|---|---|
| **主键与关联键** | 链键 `link_key`；外键 `payment_key`、`plan_key` |
| **来源与证据关系** | UD：链接是你的分配陈述，证据在付款上；链接本身不挂证据 |
| **跨记录规则（锁内，§9.2）** | `Rejected(PAYMENT_NOT_FOUND)`、`Rejected(PLAN_NOT_FOUND)`（不存在或已作废）；`Rejected(LINK_INCOMPATIBLE)`（付款种类 ≠ 计划行种类）；`Rejected(OVER_ALLOCATION)`（该付款的全部有效链接分配总额，含本次新值，> 付款金额）。**不**设"不得超过计划额"的上限：超出只表现为对照里的 `Overpaid` |
| **重复识别** | 同 (`payment_key`, `plan_key`) 只有一条链。重复提交 → `Already_Recorded`；想改分配额 → `REVISION`（**不是**再追加一条 `ORIGINAL`） |
| **历史修正** | 分配变了 → `REVISION`；抄错 → `CORRECTION`；取消 → `VOID`。改 `payment_key` / `plan_key` = 改身份 → `VOID` + 新链 |
| **查询失败 vs 确实没有** | 同 §5.1。付款的**未分配部分**（金额 − 有效分配总额）在对照里是 `Not_Planned` 行，不是错误（§7.2） |

---

## 6. 第 2 张表（用户状态 / 政策事实断言表）：推迟

来信："若无法证明某张表或某字段属于 S1 必需范围，列入后续阶段"。我对这张表做了这个检验——**S1 的四项业务范围，哪一项在没有它时做不成？**

| S1 业务范围项 | 需要"用户状态 / 政策事实断言"吗？ | 理由 |
|---|---|---|
| SOCSO 缴款记录 | 否 | 证据 + 付款已能表达；缴费种类（SKSPS 档位等）不是 S1 要核对的东西 |
| EPF 缴款记录 | 否 | 同上；**i-Saraan Plus 注册状态**才是它的主要用途，而 EPF 激励被来信排除 |
| 计划 vs 实际可追溯对照 | 否 | 左边是你填的预算，右边是已登记付款；对照只看金额 |
| SOCSO 覆盖期精确日期 | 否 | 覆盖期是**付款的属性**（§5.3），不需要单独的"状态"表 |

**结论：无法证明它属于 S1 必需范围 → 推迟。** 补充理由：

1. 它最自然的用途（EPF 激励注册状态、规则版本）被来信明确排除；没有 S1 功能消费它，就是"为将来预留的基础设施"，与 Steven 2026-08-17 的约定相冲突（`compliance-os-governance-draft.md:196`）。
2. 它若存**政策事实**（资格、金额、生效日期）就违反 R-F6，且政策登记表尚未抽查（B-4）；若只存"用户状态"，S1 里没有任何函数读它。
3. 以后加这张表是**纯新增**（新 Sheet + 新纯函数），不改 S1 的四张表，所以现在不建不会造成返工。

**如果你仍要它进 S1**：附录 A 已给出备选规格（11 列，S1 变成 5 张表 / 55 列），不需要再来一轮设计。需要你决定（D-S1-1）。

---

## 7. 派生视图（只在查询时计算，永不落地）

### 7.1 有效视图与完整性检查

纯函数 `有效视图(四张表的已读取行) → { 有效记录, 已作废链, 完整性问题[], 提示[], 吸收的重复行[] }`。

**算法**：①每行先经行级校验（`checkFuture = false`）；②按键分链；③链内按 `entry_seq` 排序（**不按 `recorded_at`**），**每条链的全部条目都保留**供审计读取（`cprChainHistory_`，§9.5）；④完全相同的重复行（同键、同序号、内容相同）被**吸收**并列入 `吸收的重复行`；⑤取序号最大者为有效条目，`VOID` 者进 `已作废链`；⑥对有效记录跑下表的检查。**只标注，不阻止**（CMP-P12）；**不修复、不删除**。

| 完整性问题（出现则相关计划行 → `Discrepancy_Flagged`） | 条件 |
|---|---|
| `AMBIGUOUS_ENTRY` | 同键同序号、内容**不同**的两行 |
| `SEQ_GAP` | 链内序号不连续（如 1, 3） |
| `CHAIN_START_INVALID` | 链的第一条不是 `entry_seq = 1` 的 `ORIGINAL`，或 `ORIGINAL` 出现在非首位 |
| `DANGLING_LINK` | 有效链接指向不存在 / 已作废的付款或计划行 |
| `OVER_ALLOCATION` | 某有效付款的有效链接分配总额 > 付款金额 |
| `LINK_INCOMPATIBLE` | 有效链接的付款种类 ≠ 计划行种类 |
| `EVIDENCE_MISSING` | 有效付款引用的证据不存在 / 已作废 / 种类不相容（`detail.state` 区分） |
| `ROW_INVALID` | 已存的行未通过行级校验（例如有人手工把金额改成 3 位小数、把日期改坏），`detail` 带错误码 |

> 正常写入路径（§9）会在锁内拒绝这些情形，所以它们**只会**来自手工改表、锁外写入或并发缺口——**检出它们是这张视图的价值**。无法解析的行（例如金额不是数字）不参与加总，列入问题；相关计划行一律 `Discrepancy_Flagged`。

| 提示（只作标注，不改变状态） | 条件 |
|---|---|
| `POSSIBLE_DUPLICATE` | 不同键的有效付款，`payment_kind` + `amount` + `payment_date` 相同 |
| `POSSIBLE_DUPLICATE_EVIDENCE` | 不同键的有效证据，`SCHEME` 相同且参考号规范化后相同 |
| `COVERAGE_NOT_STATED` | SOCSO 付款 `coverage_statement = NOT_STATED` |
| `COVERAGE_END_UNKNOWN` | SOCSO 付款 `coverage_statement = START_ONLY` |

### 7.2 对照（金额维度，纯函数，没有"截至某日"参数）

**输入**：有效视图。**对每条有效计划行**：`P` = 计划额（整数分）；`S` = 该行所有有效链接（指向有效、种类相容的付款）的 `allocated_amount` 之和；`短缺` = max(P − S, 0)；`超额` = max(S − P, 0)。

| 状态 | 条件（优先级自上而下） | 含义 |
|---|---|---|
| `Discrepancy_Flagged` | 该行、其链接、或其链接的付款 / 证据有 §7.1 的完整性问题 | 数据不自洽，**不下金额结论**（仍输出 `P`、`S` 与问题列表） |
| `Planned` | `S = 0` | 有计划、尚无结清；**不含任何时间判断**（不等于"未到期"，也不等于"逾期"） |
| `Partially_Paid` | `0 < S < P` | 已部分结清 |
| `Paid` | `S = P` | 恰好结清 |
| `Overpaid` | `S > P` | 已结清额超出计划（可能是你调低了计划，也可能是多缴） |
| `Not_Planned` | **付款级**：付款金额 − 有效分配总额 > 0 的**未分配部分** | 这笔钱没有对应任何计划行（信息，不是错误） |
| `Not_Applicable` | 已作废的计划行 | 只出现在"已作废"清单，不进主表 |

**`Overdue` 推迟**（D-S1-3）：它需要"截至某日"和"到期日"两个输入；而对自雇 SOCSO / EPF 自愿缴款，"到期日"只是你给自己定的日期，不是官方逾期（登记表 POL-SOC-07 的期限 / 利息规则适用于雇主缴款，**不得套用**）。

**与现有枚举的关系**（来信要求先查现有枚举再决定）

| 词 | 现有用法【源码证实】 | S1 |
|---|---|---|
| `Discrepancy_Flagged` | `130_Reconciliation.js:89`（对账发现差异） | 沿用同一字符串；语义是"数据不自洽"，**同名不同域，不共享代码** |
| `Not_Performed` | `130_Reconciliation.js:132` | 不用 |
| `Overdue` | `150_ComplianceCalendar.js:76`（日历基于到期日的状态） | **不用**，避免同名不同义 |
| `Planned` / `Partially_Paid` / `Paid` / `Overpaid` / `Not_Planned` / `Not_Applicable` | 仓库内未发现同名枚举（我没有逐文件穷尽搜索；实施前用 `195` 的重名检测确认） | S1 内定义 |

**来信要求处理的情形**

| 情形 | S1 的处理 |
|---|---|
| 部分缴费 | 一条链接 `allocated_amount` < `P` → `Partially_Paid`；再追加链接累加 |
| 一次付款覆盖多个期间 | 一笔付款 → 多条链接，每个计划月一条（附录 B） |
| 一笔计划对应多笔付款 | 多条链接指向同一计划行，`S` 累加 |
| 一笔付款对应多个计划 | 同上：一对多 |
| **退款** | **S1 不建模**：金额必须 > 0（负数 → `AMOUNT_NOT_POSITIVE`）；不得用负付款或改写原付款来表示退款。自雇 SOCSO / EPF 是否会发生退款、怎么发生，我没有官方证据（**UNVERIFIED**），S1 不假设；需要时在后续阶段设计"反向结清"（D-S1-1 之外的新决定） |
| 重复付款 | 不同键、同种类 + 金额 + 日期 → `POSSIBLE_DUPLICATE` 提示；由你决定保留或 `VOID` 其一 |
| 更正 | `CORRECTION` / `REVISION` 条目；对照永远按**当前有效条目**重算，旧快照从不当成当前事实（CMP-P6，`900_Constitution.js:145`） |
| 同一张收据被重复登记 | 键上就撞车（K3）；换了扫描件则给 `POSSIBLE_DUPLICATE_EVIDENCE`（T1） |

**状态怎么"转换"**（状态不存储；"转换"= 追加某条记录后重新计算的结果变化）

| 追加的记录 | 计划行状态的变化 |
|---|---|
| 计划行 `ORIGINAL` | → `Planned` |
| 链接 `ORIGINAL`，使 `0 < S < P` | `Planned` → `Partially_Paid` |
| 链接使 `S = P` | → `Paid` |
| 链接使 `S > P` | → `Overpaid` |
| 计划 `REVISION` 把 `P` 调低到 < `S` | `Paid` / `Partially_Paid` → `Overpaid` |
| 计划 `REVISION` 把 `P` 调高到 > `S` | `Paid` → `Partially_Paid` |
| 链接 `VOID` | `S` 减少，状态回退 |
| 付款 / 计划 `VOID` | 仍有有效链接 → 被 `LINKS_EXIST` 拒绝（先作废链接）；作废后计划行进"已作废"清单 |
| 手工改表造成悬空 / 超额分配 | → `Discrepancy_Flagged` |

**输出形状**（金额一律输出为两位小数的**字符串**，由整数分格式化，不输出浮点数）

```
{ _source: 'Projection',                       // 先例：160_MonthlyProjection.js:313
  lines:   [{ plan_key, line_kind, period_key, planned_amount, settled_amount,
              shortfall, excess, status, issues: [...],
              links: [{ link_key, payment_key, allocated_amount,
                        payment: { amount, payment_date, evidence_id, evidence_kind } }] }],
  unallocatedPayments: [{ payment_key, amount, allocated, unallocated, status: 'Not_Planned' }],
  voided: [...], integrity: [...], flags: [...], absorbedDuplicateRows: [...] }
```

### 7.3 覆盖期查询 `coverageStatusOn(payment, 日期)`（只针对"这一笔付款的记录"）

| `coverage_statement` | 日期早于起点 | 日期不早于起点 / 在区间内 | 区间外 |
|---|---|---|---|
| `NOT_STATED` | `UNKNOWN` | `UNKNOWN` | — |
| `START_ONLY` | `NOT_COVERED_BY_THIS_PAYMENT` | **`UNKNOWN`（永远不会是 `COVERED`）** | — |
| `START_AND_END` | `NOT_COVERED_BY_THIS_PAYMENT` | `COVERED`（起点 ≤ 日期 ≤ 终点） | `NOT_COVERED_BY_THIS_PAYMENT` |
| EPF 付款 | `Not_Applicable` | `Not_Applicable` | `Not_Applicable` |

- 返回值带 `basis`（`PRINTED_ON_EVIDENCE` / `USER_STATED`）与 `payment_key`、`evidence_id`（R-F4）。
- **它回答的是"这一笔付款的记录是否声称覆盖该日"，不是"你在这一天有没有保障"**：`NOT_COVERED_BY_THIS_PAYMENT` 不代表没保障（别的付款可能覆盖，也可能记录不全）。S1 不跨付款汇总，也不推断正式保障规则（D3；§3.4）。**跨付款的缺口 / 重叠分析推迟**。
- 日期入参同样经严格日期校验；读取失败返回 `Read_Failed`，不是 `UNKNOWN`。

### 7.4 S1 不做的时间维度（推迟，不留空栏位）

`due_date`、`Overdue`、SOCSO 覆盖时间线（缺口 / 重叠 / 逐月表）、Compliance Calendar 集成：S1 **一列都不预留**。以后需要 = 在对应表的表尾追加栏位 + 手工补表头（先例 `140_VerifiedIncome.js:18–28`），比现在为"可能用到"预留空栏位更便宜，也符合 `compliance-os-governance-draft.md:196`。日历集成还会牵涉 `150:72` 的 UTC 日期分量问题，那是另案（上一轮 D-14）。

---

## 8. 读取失败 与 "确实没有记录"：两种不同的结果（来信 §4-A、§4-B(5)）

### 8.1 现状与 S1 契约

| 情形 | 现状【源码证实】 | S1 契约【设计建议】 |
|---|---|---|
| Sheet 不存在 | `getAllRows` 抛错（`115_TruthWriter.js:82`） | `Read_Failed{SHEET_MISSING}` |
| 表里只有表头 / 空表 | 返回 `[]`（`115:84`） | 读取**成功**，空；按键查询得 `Not_Found` |
| 行宽与期望不符 | `readAll` 抛错（`117_SheetReader.js:35–37`） | `Read_Failed{ROW_WIDTH_MISMATCH}`，**不截断、不补空** |
| 表头被人改动 | **运行期不检查**；只有建表时检查（`108_SheetSetup.js:140–148`），`readAll` 只比行宽（`117:35–37`） | 每个入口在首次读 / 写之前做表头预检 → 读：`Read_Failed{SCHEMA_MISMATCH}`；写：`Failed{SCHEMA, NO}` |
| `SPREADSHEET_ID` 缺失、Spreadsheet 打不开、配额等 | 抛异常（`115:66–69`）；控制台调用点 catch 后变成 `status:'Error'` 对象（`170_OperatorConsole.js:259`、`:885`） | `Read_Failed{API_ERROR}`，带原始消息 |
| "找不到这条记录" | 与读取失败**同样**是 `status:'Error'`，只靠文字区分（`170:806–807`；`readAll` 本身在 `try` 之外 `:804–808`） | `Not_Found`（读取成功且无此键）**≠** `Read_Failed` |

### 8.2 契约规则

| # | 规则 |
|---|---|
| RF1 | S1 的所有读取函数返回类型化结果（成功的行，或 `Read_Failed{reason}`）。**任何 `catch` 都不得返回 `[]`**（静态检查，Test Plan H 组） |
| RF2 | "确实没有"= 读取成功 + 键不在有效视图 → `Not_Found`；链头是 `VOID` → `Voided` |
| RF3 | 写路径上的任何读取失败（含锁内读取相关表）→ **不追加**，返回 `Failed{READ, NO}` 并带 `readFailure` 代码 |
| RF4 | 行宽检查是读取的一部分：写路径里行映射失败也记为 `phase = READ`（不是 `DECIDE`）。`decide` 自己 catch `readOther` 的异常并以 `Failed` 返回，不让它冒泡成阶段不明的异常 |
| RF5 | 表头预检在**锁外、原语之外**（D-S1-12）：它需要读第 1 行，而现有访问器的 `getAllRows` 从第 2 行起读（`115:85`）。限制：预检与随后的写之间存在时间差（R-S1-6）；锁内的行宽检查补充兜底 |
| RF6 | 运行期**不自动建表**：Sheet 缺失 → `SHEET_MISSING`。建表只由 S1 自己的、需要人手动运行的建表函数完成（D-S1-8） |
| RF7 | 任何未来的调用方（控制台、菜单、脚本）必须把 `Read_Failed` 显示成**错误**，不得显示成"没有记录" |

> 为什么这条这么重要：若读取失败被吞成 `[]`，对照会把所有计划行显示成 `Planned`、把已登记的付款显示成不存在——你很可能因此**重新登记**一遍，造出重复的正式记录。fail closed 是防重复的前提。

---

## 9. 写入边界（摘要；完整分析见 `TruthWriter_Decision_Note_2026-10-31.md`）

### 9.1 推荐形状与退路

- **推荐方案 A（通用受保护追加）**：在 `TruthWriter` 里新增**一个**通用方法（暂定名 `appendGuarded(sheetName, columnOrder, decide)`）：同一次 `withLock` 里「新鲜读取 → 调用方给的纯函数 `decide(rows, readOther)` → 栏位检查 → `appendRow` → `flush`」；`115` 里**没有** S1 领域规则；返回类型化结果。条件：你批准 Freeze 例外（`compliance-os-governance-draft.md:420`；Decision Note DT-1）。
- **退路 B1**：外层自己持锁，内层复用 `createTruthWriter_` 注入"空操作锁"调用 `appendValidatedRow`；不改任何已批准文件；需守 G1–G5。B2（绕过写入出口）与 B3（嵌套单例锁）不采纳。
- **无论 A 或 B1**：并发保护是否成立取决于 B-2 里未验证的 GAS 行为（V3–V5）。S1 的安全底线**不依赖锁**：①重试收敛；②有效视图吸收相同重复行。

### 9.2 锁内判定顺序与跨记录原因码

**顺序**（`decide` 内，在锁内新鲜读取之后；先到先得）

| 步 | 判定 | 结果 |
|---|---|---|
| 1 | 行映射（行宽检查）；`readOther` 读相关表 | 失败 → `Failed{READ, NO}` |
| 2 | 链上已有**同 `entry_seq`** 的行：内容相同 / 内容不同 | 相同 → `Already_Recorded`；不同 → `Conflict` |
| 3 | 候选的**状态签名**等于链头（有效条目）的状态签名 | `Already_Recorded`（让"超时后用重新计算的序号重发"也不会追加第二行） |
| 4 | `entry_seq ≠ 当前最大 + 1` | `Stale_Sequence{expectedSeq}` |
| 5 | 条目类型约束：空链只能 `ORIGINAL`；非空链不能 `ORIGINAL`；`VOID` 的内容必须等于链头内容 | `Rejected(ENTRY_TYPE_INVALID)` ／ `Rejected(VOID_SNAPSHOT_MISMATCH)` |
| 6 | 跨记录规则（下表） | `Rejected(code)` |
| 7 | 追加 | `Appended` |

**跨记录规则**（都在锁内、对**新鲜读取**的有效视图判定——不是调用方带来的旧快照）

| 对象 / 操作 | 规则 | 拒绝码 |
|---|---|---|
| 证据 `VOID` | 仍有有效付款引用它 | `EVIDENCE_IN_USE` |
| 证据 `CORRECTION` | 改了 `evidence_kind`，使已挂的有效付款不再相容 | `EVIDENCE_KIND_CHANGE_BREAKS_PAYMENTS` |
| 计划行 `VOID` | 仍有有效链接引用它 | `LINKS_EXIST` |
| 付款 `ORIGINAL` / `CORRECTION` / 复活 | 证据必须存在且有效 | `EVIDENCE_NOT_FOUND`（`detail.state` = `Not_Found` 或 `Voided`） |
| 同上 | 证据种类与付款种类相容 | `EVIDENCE_KIND_MISMATCH` |
| 付款 `VOID` | 仍有有效链接引用它 | `LINKS_EXIST` |
| 付款 `CORRECTION` | `amount` 低于该付款已有的有效分配总额 | `ALLOCATION_EXCEEDS_AMOUNT` |
| 链接 `ORIGINAL` / `REVISION` / `CORRECTION` / 复活 | 付款存在且有效 | `PAYMENT_NOT_FOUND` |
| 同上 | 计划行存在且有效 | `PLAN_NOT_FOUND` |
| 同上 | 付款种类 = 计划行种类 | `LINK_INCOMPATIBLE` |
| 同上 | 该付款的有效链接分配总额（含本次新值，替换本链旧值）≤ 付款金额 | `OVER_ALLOCATION` |

### 9.3 结果与重试

| 结果 | 重试指引 |
|---|---|
| `Appended`、`Already_Recorded` | 成功，不需要重试 |
| `Failed{…, written: NO}`（`SCHEMA` / `LOCK` / `READ` / `DECIDE`） | 确定没写，**直接重试**安全 |
| `Failed{…, written: MAYBE}`（`APPEND` / `FLUSH`） | **原样重发**：第一次若已落地 → 同序号相同 → `Already_Recorded`；若没落地 → `Appended`；若期间别人写了同一条链 → `Conflict` / `Stale_Sequence`。**不会出现两行** |
| `Conflict`、`Stale_Sequence`、`Rejected`、`Invalid` | 不是基础设施问题，重试同样输入没有用；按 §4.7 的"调用方"一栏处理 |
| `appendRow` 失败留下半行（**UNVERIFIED**，V7） | 下次读取行宽不符 → `Read_Failed{ROW_WIDTH_MISMATCH}` fail closed；S1 **不自动修复**，需要你人工处理那一行 |

### 9.4 多步录入（证据 → 付款 → 链接）：每步各自幂等，没有跨行事务

编排函数顺序执行各步，**遇到第一个既非 `Appended` 也非 `Already_Recorded` 的结果就停止**，并返回每一步的结果。

| 停在哪一步 | 可见后果 | 恢复 |
|---|---|---|
| 证据已写，付款未写 | 证据存在、没有付款 | 重发付款 |
| 证据、付款已写，链接未写或只写了一部分 | 付款有"未分配部分"，对照里显示 `Not_Planned`（信息）；计划行显示 `Planned` / `Partially_Paid`——**不会静默丢失** | **重发整套序列**：已写的返回 `Already_Recorded`，未写的 `Appended` |

### 9.5 S1 的函数面（设计；名字暂定，前缀 `cpr`；`195` 的重名检测在实施时一并确认）

| 暂定名 | 纯 / 边缘 | 作用 |
|---|---|---|
| `cprCanonicalizeAmount_`、`cprParseIsoDate_`、`cprNormalizeRef_` | 纯 | §4.5、§4.6 |
| `cprDeriveKey_(表, 行)` | 纯 | §4.2 |
| `cprValidateRow_(表, 行, ctx{today, checkFuture})` | 纯 | §4.7 行级校验，返回全部错误与规范化后的行 |
| `cprRowsEqual_`、`cprStateSignature_` | 纯 | §4.3 |
| `cprDecideAppend_(表, 候选, 行们, readOther, ctx)` | 纯 | §9.2；作为 `decide` 传给受保护追加原语 |
| `cprBuildEffectiveView_`、`cprCompareAmounts_`、`cprCoverageStatusOn_` | 纯 | §7 |
| `cprChainHistory_(视图, 键)`、`cprDiffEntries_(条目甲, 条目乙)` | 纯 | 审计轨迹：取一条链的全部条目（按 `entry_seq` 排序，含 `VOID`）；列出相邻两条之间变化的栏位 |
| `cprReadTable_(表名)`、`cprPreflightHeader_(表名)` | 边缘 | §8；类型化读取 |
| `cprSubmit_(表, 输入)`、`cprSubmitSequence_(步骤们)` | 边缘（编排） | 校验 → 预检 → 受保护追加 → 类型化结果；§9.4 |
| `cprTodayKl_()`、`cprNowUtcIso_()`、`cprComputeFileHash_(fileId)` | 边缘 | 取"今天"（KL）、取 UTC 时间、读 Drive 文件字节并调用既有 `computeFileHash_`（`110:95–101`）（V8、V10） |
| `cprSetupSheets()` | 边缘（手动运行） | 建表：调用既有 `ensureSheetSchema_`（`108:116`）与 S1 **自己**的 schema 列表 |

> 新文件的名称与编号在实施授权时按 File Map 规范决定，本文**不预占**。新文件里不得有与既有全局名重名的顶层函数（`195_Tests_GasLoadSimulation.js:96–111` 会检出；测试文件名必须含 "Tests" 才会被排除在加载模拟之外，`:38–42`）。

### 9.6 与既有契约的关系

- `appendValidatedRow`、`gasLockProvider_`、`TruthWriter` 单例、模块导出**一行不动**（方案 A 只在 `createTruthWriter_` 的返回对象里**新增**一个方法）。
- `decide` 里**不得**使用 `TruthWriter` 单例（否则嵌套同一把脚本锁，行为 UNVERIFIED，Decision Note B3）。
- **零改动建表路线（D-S1-8 默认）**：`cprSetupSheets()` 用 S1 自己的 schema 列表调用 `ensureSheetSchema_`；`buildSheetSchemas_()` **不变** → `109_Tests_SheetSetup.js:25–28` 对"七张表"的断言**照样通过**。代价：`setupComplianceOsSheets()` **不会**建 S1 的表（Sheet Schema 注册表分在两处）。
- 备选（D-S1-8 的另一项）：把 S1 的四张表登记进 `buildSheetSchemas_()` → 必须同时改 `108` 与 `109:25–28`（**否则该断言会失败**），并需要 Freeze 例外。

---

## 10. 88 列 → 44 列：逐列去向（来信："不要为了凑齐 88 列而保留"）

上一轮 S1 = 5 张表 / 88 列（19 + 15 + 21 + 22 + 11）。**结果：保留 43 列、删除或推迟 45 列、新增 1 列 = 44 列。** 去向记号：**留** = 保留；**留\*** = 保留但改动；**删** = 删除；**推** = 推迟到后续阶段。

### 10.1 旧 `Official_Evidence`（19 → 12）

| 旧栏位 | 去向 | 理由 |
|---|---|---|
| `evidence_id` | 留\* | 键规则改为 `F-{H16}` / `R-{SCHEME}-{REFNORM}`（不再含 KIND） |
| `entry_seq`、`entry_type` | 留 | 追加链；允许类型缩为 `ORIGINAL` / `CORRECTION` / `VOID` |
| `evidence_kind` | 留\* | 10 个值缩为 2 个通用值（D-S1-10）；Tax / Grab / Bank / Other 推迟 |
| `scheme` | 删 | 可由 `evidence_kind` 推出，S1 只有两种 |
| `issuer`、`document_title` | 删 | 没有 S1 逻辑依赖；真实格式未知（B-1） |
| `official_reference` | 留 | 条件必填 |
| `document_date` | 留\* | 由必填放宽为可选：我没见过真实文件，不强迫你填文件上可能没有的东西 |
| `applicable_period` | 删 | "系统不解析"的纯抄写栏位，没有消费者 |
| `storage_kind` | 删 | 可由"有无文件"推出（`PORTAL_ONLY` / `PHYSICAL_COPY` = 无文件 + `accessible_location`） |
| `drive_file_id`、`file_hash_sha256` | 留 | 有文件时同有同无 |
| `file_name` | 删 | 可由 Drive 按 id 取得；不是身份 |
| `accessible_location` | 留\* | 由总是必填改为"无文件时必填" |
| `entry_source` | 删 | 只有 `MANUAL_ENTRY` 一个值，没有逻辑依赖 |
| `note`、`reason`、`recorded_at` | 留 | |

### 10.2 旧 `Scheme_Status_Log`（15 → 0）

| 旧栏位 | 去向 | 理由 |
|---|---|---|
| 全部 15 列（`status_id` … `recorded_at`） | **推**（整表） | §6：无法证明属于 S1 必需范围；备选规格见附录 A |

### 10.3 旧 `Plan_Line`（21 → 9，并改名 `Contribution_Plan_Lines`）

| 旧栏位 | 去向 | 理由 |
|---|---|---|
| `plan_key` | 留\* | 键规则：`CMP-PLN-MAIN-{LINE_KIND}-{YYYY-MM}` |
| `entry_seq`、`entry_type` | 留 | |
| `scheme` | 删 | 可由 `line_kind` 推出 |
| `plan_set`、`scheme_option` | 推 | 多方案预算比较（S3）；键里的 `MAIN` 是字面量 |
| `line_kind` | 留\* | 缩为 `EPF_CONTRIBUTION` / `SOCSO_CONTRIBUTION`（激励行、Tax 分期推迟） |
| `period_key` | 留\* | 缩为 `YYYY-MM`（`YA…-I…` 形式属于 Tax） |
| `instalment_no` | 推 | Tax |
| `direction` | 删 | S1 全是 OUT；`IN` 只用于激励 |
| `planned_amount` | 留 | |
| `due_date` | 推 | 时间维度（D-S1-3） |
| `stated_deadline_date`、`applicable_year`、`notice_evidence_id` | 推 | Tax 通知书 |
| `origin` | 删 | S1 全是 `USER_PLAN` |
| `rule_id` | 推 | 政策规则（S3；S1 不读政策，R-F6） |
| `entry_source` | 删 | 同上 |
| `note`、`reason`、`recorded_at` | 留 | |

### 10.4 旧 `Official_Payment`（22 → 15，并改名 `Official_Payments`）

| 旧栏位 | 去向 | 理由 |
|---|---|---|
| `payment_key` | 留\* | 键规则改为以证据为锚（§4.2 K3） |
| `entry_seq`、`entry_type` | 留 | 允许类型：`ORIGINAL` / `CORRECTION` / `VOID` |
| `scheme` | 删 | 可由 `payment_kind` 推出 |
| `payment_kind` | 留\* | 缩为 `SOCSO_CONTRIBUTION` / `EPF_CONTRIBUTION`（激励入账、Tax 推迟） |
| `direction` | 删 | S1 全是 OUT |
| `amount`、`payment_date`、`line_no` | 留 | |
| `official_reference`、`reference_norm` | 删 | 付款**必须挂证据**，参考号只放在证据上（D-S1-4），避免两处真相 |
| `evidence_id` | 留\* | 由"条件必填"改为**必填** |
| `evidence_exception_reason` | 删 | 取消"无凭证例外"（D-S1-4） |
| `payer_channel` | 删 | 只有 `SELF` 一个值；平台代扣不在 S1 |
| `coverage_start`、`coverage_end` | 留 | |
| `coverage_basis` | 留\* | 值缩为 `PRINTED_ON_EVIDENCE` / `USER_STATED`；`NOT_STATED` 挪进新栏位 `coverage_statement`；`PERKESO_PORTAL_RECORD` 我没有证据证明门户记录是另一种来源（并入 `USER_STATED`，或在 `note` 说明） |
| `applicable_period` | 删 | 纯抄写栏位，没有消费者 |
| `entry_source` | 删 | 同上 |
| `note`、`reason`、`recorded_at` | 留 | |
| **（新增）`coverage_statement`** | **新** | `NOT_STATED / START_ONLY / START_AND_END`：旧模型无法表达"起点已知、终点未知"，而来信要求"未知的结束日期不得推断" |

### 10.5 旧 `Payment_Link`（11 → 8，并改名 `Payment_Links`）

| 旧栏位 | 去向 | 理由 |
|---|---|---|
| `link_key` | 留\* | 去掉 `S` / `F` 中缀：`CMP-LNK-{payment_key}~{plan_key}` |
| `entry_seq`、`entry_type` | 留 | |
| `link_kind` | 删 | 只剩 `SETTLES`；`FUNDS_CLAIM` 属于 Grab 报销（排除） |
| `payment_key` | 留 | |
| `target_key` | 留\*（改名 `plan_key`） | 目标只剩计划行 |
| `allocated_amount` | 留 | |
| `entry_source` | 删 | |
| `note` | 删 | 没有消费者；解释写在 `reason`，付款 / 计划行各有 `note` |
| `reason`、`recorded_at` | 留 | |

**合计**：12 + 0 + 9 + 14 + 8 = **43 列保留**（其中标 **留\*** 的有改动）；7 + 15 + 12 + 8 + 3 = **45 列删除 / 推迟**；+ 1 列新增 = **44**。上一轮 7 张表中**不在 88 里**的两张（`Reimbursement_Event` 18 列、`Policy_Rule` 23 列）仍**不在 S1**。

---

## 11. 设计决定 vs 事实证据（来信 §6：把两者分开）

### 11.1 事实证据（【源码证实】= 本轮亲自读过那一行；**不等于**真实 GAS 观察）

| # | 事实 | 位置 |
|---|---|---|
| SF-1 | `appendValidatedRow(sheetName, rowObject, columnOrder)`：空 `rowObject` 在锁外抛错；锁内缺栏位（`undefined`）抛错；`null → ''`；`appendRow`；返回该行 | `115_TruthWriter.js:31–44`（`:32`、`:36–38`、`:41`、`:43`） |
| SF-2 | 工厂只返回 `{ appendValidatedRow }` | `115:48` |
| SF-3 | 访问器：缺表时 `appendRow` / `getAllRows` 抛错；`lastRow < 2` 返回 `[]`；读取从第 2 行起 | `115:73–88`（`:77`、`:82`、`:84`、`:85`） |
| SF-4 | 脚本锁 `waitLock(10000)`，`finally` 释放，没有 `flush` | `115:90–102`（`:94`、`:95–99`） |
| SF-5 | `SPREADSHEET_ID` 缺失即抛错 | `115:66–69` |
| SF-6 | `readAll` 行宽不符抛错；没有表头检查；表头只在建表时检查 | `117_SheetReader.js:32–42`（`:35–37`）；`108_SheetSetup.js:140–148` |
| SF-7 | schema 形状 `{name, columns, textColumns}`；现有 7 张表；`ensureSheetSchema_`；文本格式 | `108:46–104`、`:116`、`:152–160` |
| SF-8 | 测试断言恰好 7 张表名 | `109_Tests_SheetSetup.js:25–28` |
| SF-9 | 测试假件：访问器从不抛错；假锁没有互斥 | `105_TestUtils.js:27–38` |
| SF-10 | 契约测试只断言 `appendValidatedRow` 存在；`TruthWriter` 测试 3 例；锁排队的人工项未勾 | `190_Tests_Contracts.js:42`；`116_Tests_TruthWriter.js:14–36`、`:60–61` |
| SF-11 | 现有"是否已存在"检查在锁外、用调用方的快照 | `140_VerifiedIncome.js:189–198`；`170_OperatorConsole.js:234–237`、`:314–315`、`:533–534`、`:575–576`、`:870–871` |
| SF-12 | 控制台把异常转成 `status:'Error'`；"找不到"与读取失败同样是 `Error`；原则注释"永远回明确的结果状态" | `170:259`、`:885`；`:806–807`、`:804–808`；`:815–820` |
| SF-13 | 时间戳派生 id | `110_DocumentImport.js:47,210`；`130_Reconciliation.js:103`；`150_ComplianceCalendar.js:172` |
| SF-14 | `150:72` 用 UTC 日期分量；项目时区 `Asia/Singapore` | `150:72`；`appsscript.json:2` |
| SF-15 | `round2_` 静默四舍五入；`normalizeIsoDateString_` 不验日历真伪、对 Date 用本地读取 | `106_Utils.js:12–14`；`:32–44` |
| SF-16 | 真实 GAS 读回过原生 `Date`（根因未明）；Calendar 真实 GAS **未做** | `VERIFICATION_STATUS.md:100–107`；`:124` |
| SF-17 | 既有状态词：`Discrepancy_Flagged`、`Not_Performed`、`Overdue`；投影标注 `_source:'Projection'` | `130:89`、`:132`；`150:76`；`160_MonthlyProjection.js:313` |
| SF-18 | 加载模拟：载入非测试、非 900/901 文件；检出重名顶层函数 | `195_Tests_GasLoadSimulation.js:38–42`、`:96–111` |
| SF-19 | 宪法条款：P4、P6、P9、P10、P12、CR4；"CMP-CR 建立在 UEF UCR1-7 之上" | `900_Constitution.js:133`、`:145`、`:166`、`:171`、`:183`、`:223`；`:204` |
| SF-20 | 治理：不做"为将来预留"的基础设施；Freeze 例外条款 | `compliance-os-governance-draft.md:196`；`:420` |
| SF-21 | 模块目录对 TruthWriter 的描述："唯一的写入出口 … append-only (UCR6)"；"真实 GAS 验证过"（未逐项列出） | `MODULE_CATALOG.md:43–44` |
| SF-22 | 既有 `computeFileHash_(fileBytes)`：`Utilities.computeDigest(SHA_256)` → 小写十六进制；Node 里测不了 | `110_DocumentImport.js:95–101`；`111_Tests_DocumentImport.js:349` |

### 11.2 设计决定（【设计建议】；不是事实，可以被你推翻）

| # | 决定 | 理由（简） |
|---|---|---|
| SD-1 | 4 张表 / 44 列 | 来信的"无法证明必需就推迟"（§10） |
| SD-2 | 断言表推迟 | §6 |
| SD-3 | 追加链 + 四种条目类型；有效 = 最大 `entry_seq` | 对应"计划调整 / 取消 / 付款更正 / 重复提交"；不依赖时间戳 |
| SD-4 | 键只由业务事实推导；付款以证据为锚 | 来信 §4-C；K3 |
| SD-5 | 身份栏位链内不可变，改身份 = `VOID` + 新链 | 让"键 = 事实"在每个条目都可校验 |
| SD-6 | 新增 `coverage_statement` | 表达"终点未知"，永不推断 |
| SD-7 | 金额：严格十进制字符串 → 整数分；>2 位小数拒绝 | CMP-P9 / P10；避免浮点与静默舍入 |
| SD-8 | 日期：严格日历校验；"今天"= `Asia/Kuala_Lumpur`，由边缘注入 | CMP-CR4；避开 `150:72` 的坑 |
| SD-9 | 预期内的失败用类型化结果，不靠异常 | 与 `170:815–820` 一致 |
| SD-10 | 对照只做金额维度；`Overdue` 推迟 | §7.2、D-S1-3 |
| SD-11 | 重复嫌疑只提示、不阻止 | CMP-P12 |
| SD-12 | 证据种类用两个通用值 | 没见过真实文件（B-1） |
| SD-13 | 不建模退款 | 没有官方证据说明会怎样发生（UNVERIFIED） |
| SD-14 | 零改动建表路线 | 不碰 `108` / `109`（D-S1-8） |
| SD-15 | 表头预检放在原语之外、锁之外 | 访问器读不到第 1 行；保持原语通用 |
| SD-16 | 付款必须挂证据，取消"无凭证例外" | 没有证据就没有稳定身份，也违反 R-F1 |

---

## 12. 风险登记

| # | 风险 | 后果 | 缓解 | 关闭方式 |
|---|---|---|---|---|
| R-S1-1 | OD 类栏位是"你抄的"，系统无法验证与原件一致（§3.1） | 抄错的金额 / 日期会成为"官方记录" | 付款必须挂证据；`CORRECTION` 保留历史；第一份真实文件逐字段核对 | V8、V9 |
| R-S1-2 | **身份不可变的级联成本**（C7）：无文件证据的参考号抄错 → 键错 → `VOID` + 重新登记，其下付款与链接也要重做 | 操作繁琐；中途失败会留下"迁了一半"的状态 | 每步幂等、序列可重放（§9.4）；有文件的证据其键来自哈希，不受打字影响，所以**优先登记文件** | 实施时再看是否需要"迁移辅助"（另行决定） |
| R-S1-3 | 同一文件重新扫描得到新 `evidence_id`；重复付款只提示、挡不住（T1、`POSSIBLE_DUPLICATE`） | 可能出现两条描述同一笔付款的记录 | 提示 + 你决定 `VOID` 其一 | — |
| R-S1-4 | 真实 GAS 的锁 / `flush` / 重入语义**未验证**（B-2） | 两个重叠提交可能都通过检查 | 锁内判定；重试收敛；有效视图吸收相同重复行 | V3–V5 |
| R-S1-5 | 真实 GAS 读回原生 `Date`（B-3） | 日期栏位读回错误或比较失败 | 读入边界规范化 + 日历校验；异常行标 `ROW_INVALID` | V6 |
| R-S1-6 | 表头预检在**锁外**，与随后的写之间有时间差 | 预检通过后表头被人改动 | 锁内行宽检查兜底；改表头是低频人工操作 | V2 |
| R-S1-7 | 有人**直接在 Sheet 里**改 / 删 / 插行（绕过 TruthWriter） | 破坏追加链的不变量 | 有效视图检出并标注（`AMBIGUOUS_ENTRY`、`SEQ_GAP`、`ROW_INVALID`……），不阻止、不修复 | Test Plan D6 |
| R-S1-8 | 零改动路线下 Sheet Schema 注册表分在两处 | `setupComplianceOsSheets()` 不会建 S1 的表；将来合并要改 `108` / `109` | 文档明示（§9.6）；D-S1-8 | — |
| R-S1-9 | 锁内整表读取的成本随行数增长；脚本锁只等 10 秒（`115:94`） | 数据多了，锁内变慢，其他写入排队超时 | S1 是个人规模（预计几十到几百行，**估计值，未测量**）；真的变大再改读取方式 | V5 顺便观察 |
| R-S1-10 | 官方文件真实格式未知（B-1） | 证据种类 / 覆盖期模型可能与真实文件不符 | 通用种类；`START_ONLY`；V8 / V9 校准；需要改的只是允许值与规则，**不改键** | V8、V9 |
| R-S1-11 | 对照只有金额维度：你可能把 `Planned` 当成"还没到期" | 误读 | 文档与输出都标注"不含任何时间判断" | — |
| R-S1-12 | 退款 / 反向结清不建模（SD-13） | 若发生退款，系统无法表达；你可能想用 `CORRECTION` 改写原付款 | 文档明示；拒绝负金额；出现时另行设计 | — |
| R-S1-13 | 基线是 10-21 的副本（B-6） | 如果 `115` 等文件之后被改过，"只新增、不改"的前提要重核 | 实施前重读 | — |
| R-S1-14 | Freeze 例外未批准 | 方案 A 不可用 | 退路 B1（Decision Note §6.3） | D-S1-9 |
| R-S1-15 | 设计面偏大：四种条目类型 + 状态签名 + 一批原因码 | 实现与测试量大 | 全是纯函数，Node 里可穷举测试；Test Plan 已分层。**若你认为过重，`REVISION` 可并入 `CORRECTION`**（少一种类型，失去"改主意 vs 抄错"的区分）——这是可以事后再删的简化，不需要现在决定 | — |

---

## 13. 待你决定的事项

默认值都标"**默认，待确认**"：你不回答，我也**不会**据此开始实施。

### 13.1 D-S1-1 … D-S1-15

| # | 问题 | 选项（默认在前） | 需要在……之前 |
|---|---|---|---|
| **D-S1-1** | 第 2 张表（用户状态 / 政策事实断言）放不放进 S1 | (a) **推迟**（默认，待确认）；(b) 放进 S1，用附录 A 的 11 列规格（S1 = 5 表 / 55 列） | 实施授权前 |
| D-S1-2 | SOCSO 覆盖期放在哪 | (a) **付款行上的四栏**（默认，待确认）；(b) 单独的覆盖期表（S1 里没有理由多一张表和一层链接） | 实施授权前 |
| **D-S1-3** | 时间维度（`due_date`、`Overdue`、覆盖时间线、日历集成）放不放进 S1 | (a) **推迟**（默认，待确认）；(b) 把 `due_date` 与 `Overdue` 放进 S1（新增 1 列，并引入"截至某日"输入与马来西亚日期边界规则；`Overdue` 对自雇缴款没有官方定义） | 实施授权前 |
| D-S1-4 | 付款是否必须挂证据 | (a) **必须**（默认，待确认；取消"无凭证例外"）；(b) 允许例外并永久标注 `NO_EVIDENCE`（要恢复参考号与例外栏位，键的稳定性变差） | 实施授权前 |
| D-S1-5 | 金额超过 2 位小数 | (a) **拒绝**（默认，待确认）；(b) 静默 `round2_`（不推荐：抄错的数会悄悄变成另一个数） | 实施授权前 |
| D-S1-6 | 覆盖期约定 | (a) **终点含当日；只到天；允许 `START_ONLY` 与 `NOT_STATED`**（默认，待确认）；(b) 每笔 SOCSO 付款都必须 `START_AND_END`（官方文件是否印终点未知，B-1）；(c) 记录到时刻 | 实施授权前 |
| D-S1-7 | 表名 | (a) **来信用的名字**：`Official_Evidence` / `Contribution_Plan_Lines` / `Official_Payments` / `Payment_Links`（默认，待确认）；(b) 沿用上一轮的单数名 | **建表前**（建了就是迁移） |
| D-S1-8 | 建表路线 | (a) **零改动**：S1 自己的建表函数（默认，待确认）；(b) 登记进 `buildSheetSchemas_()`（要改 `108`、`109:25–28`，并需要 Freeze 例外；不改 `109` 则该断言会失败） | 实施授权前 |
| **D-S1-9** | TruthWriter 方案 | (a) **批准 Freeze 例外 → 方案 A**（默认，待确认）；(b) 不批准 → 方案 B1 + 守则 G1–G5；(c) 先 B1，V3–V5 验证后再决定是否升级为 A。**与 Decision Note 的 DT-1 同一个问题**（DT-2 结果类型、DT-3 `flush`、DT-4 ADR 也在那里） | 实施授权前 |
| D-S1-10 | 证据种类 | (a) **两个通用值** `SOCSO_PAYMENT_RECORD` / `EPF_PAYMENT_RECORD`（默认，待确认）；(b) 细分收据 / 对账单 / 门户（需要你给真实文件样本才能定值） | V8 / V9 之后 |
| D-S1-11 | `entry_source` 栏位 | (a) **推迟**（默认，待确认；S1 只有手动录入，D6）；(b) 现在就加（一个永远只有一个值的栏位） | 实施授权前 |
| D-S1-12 | 表头预检 | (a) **放在原语之外，写入前做一次**（默认，待确认）；(b) 给访问器与原语增加读第 1 行的能力（要改 `115` 更多）；(c) 不预检，只靠行宽检查（表头改名但宽度不变的漂移检不出来） | 实施授权前 |
| D-S1-13 | 业务日期的时区 | (a) **明确 `Asia/Kuala_Lumpur`**（默认，待确认）；(b) 用项目时区 `Asia/Singapore`（`appsscript.json:2`）。两者现行都是 UTC+8（一般常识，本轮**未核实**）；选 (a) 是为了业务日期不绑在项目设置上 | 实施授权前 |
| D-S1-14 | 身份栏位不可变（含付款的 `evidence_id`、`line_no`） | (a) **不可变，改身份 = `VOID` + 重新登记**（默认，待确认）；(b) 允许 `CORRECTION` 改它们（键也得变，违背"键 = 事实"，需要"键改名"机制——不建议） | 实施授权前 |
| D-S1-15 | ADR | (a) **保持 DRAFT**（`ADR-DRAFT-CPR-1…5`），由你指定正式编号（默认，待确认）；(b) 你现在给编号（我不会自行编号）。`ADR-DRAFT-CPR-1` 里关于写入原语的措辞，在你确认 TruthWriter 方案后需要修订 | 治理文件同步时 |

### 13.2 与上一轮 D-1 … D-18 的对应

| 上一轮 | 去向 |
|---|---|
| D-1 Freeze 例外 | → D-S1-9（并入 Decision Note DT-1） |
| D-2 证据登记方案（E1 / E2 / E3） | 沿用 E2（来信暂定表清单含 `Official_Evidence`），不再作为独立决定 |
| D-3 TruthWriter 路线（P1 / P2 / P3） | → D-S1-9（P2 ≈ 方案 A，P3 ≈ B1，P1 = 现状） |
| D-4 S1 范围 | 已由来信回答（SOCSO + EPF 缴款记录；Tax 排除） |
| D-5 通用备用栏位 | 沿用默认"不加"（S1 没有备用栏位） |
| D-6 建表时机 | → D-S1-1（"断言表推迟"一项）与 D-S1-8 |
| D-7 `160` 里 SOCSO 固定值与 EPF / Tax 存根 | 不在 S1（S1 不碰 `160`），之后的切片再答 |
| D-8 日历集成方案 | 推迟（D-S1-3） |
| D-9 SOCSO 覆盖期约定 | → D-S1-6 |
| D-10 金额位数 | → D-S1-5 |
| D-11 税务两个日期 | 不在 S1（Tax） |
| D-12 凭证要求 | → D-S1-4（更严：证据必填） |
| D-13 ADR 编号 | → D-S1-15 |
| D-14 `150:72` UTC 日期分量 | 不在 S1（另案）；S1 自己的日期规则避开它（D-S1-13） |
| D-15 Phase P 修复范围 | 独立，不在 S1 |
| D-16 / D-17 / D-18 | 不在 S1（Tax 自备预算 / Grab 事件 / 日历提醒天数） |

---

## 14. 不在范围

| 类别 | 内容 |
|---|---|
| **来信明确排除** | Tax / CP500 完整流程；EPF 激励的自动计算或资格判定；Grab 报销自动化；Calendar 集成；PDF / LLM 自动导入；Phase P 重复 `Verified_Income` 修复；其他债务 / 信用卡 |
| **本设计推迟（后续阶段）** | 断言表（`Scheme_Status_Log`）与 `Policy_Rule`；`due_date` / `Overdue`；SOCSO 覆盖时间线（缺口 / 重叠）与跨付款汇总；`plan_set` 多方案比较；退款 / 反向结清；`payer_channel`、`entry_source`；两个通用值以外的证据种类 |
| **本轮没做** | 任何实现（含对 `115` 的修改）；编写或运行任何测试；真实 GAS 验证；创建 Sheet；治理文件更新（`MODULE_CATALOG`、File Map、Verification Status、ADR 索引）；ADR 编号分配 |
| **未设计** | **录入入口的形态**（控制台表单 / 菜单 / 直接调用脚本函数）：本文定义的是"写入函数的契约"（输入 → 校验 → 受保护追加 → 类型化结果）。**没有入口，S1 就只有契约、没有人能点的东西**——这是下一阶段要单独决定的事（A-8） |
| **未关闭的 UNVERIFIED** | B-1 官方文件真实格式；B-2 真实 GAS 锁 / `flush`；B-3 Date 读回根因；B-5 UCR6 原文；B-6 基线是否最新 |

---

## 15. 下一阶段需要的独立授权（设计完整 ≠ 实施授权）

下列每一项都需要你**另行明确授权**；本文交付后我就停止，不开始其中任何一项。

| # | 授权 | 内容 |
|---|---|---|
| A-1 | Freeze 例外决定 | 批准 / 拒绝改 `115`（决定走方案 A 还是 B1；D-S1-9） |
| A-2 | S1 实现授权 | 新增 S1 文件（纯函数 + 边缘适配器）；若选 A 含 `115` 的增量；Node 测试可写可跑，**结果不得描述成真实 GAS 验证** |
| A-3 | 真实 GAS 验证授权 | 在 Spreadsheet **副本** + 临时 Script Property 上做 V0–V7、V10；不碰生产数据；由你执行、我根据你贴回的日志判断 |
| A-4 | 建表授权 | 在真实 Spreadsheet 上创建 S1 的四张表（由 `cprSetupSheets()` 执行；先在副本上做完 V1） |
| A-5 | 治理文件同步授权 | `MODULE_CATALOG`、File Map、Data Ownership、Verification Status、ADR 正式编号 |
| A-6 | Phase P 修复（独立） | 与 S1 互不依赖；不在本轮、也不在 S1 里 |
| A-7 | 首份真实官方记录核对 | 你提供一份真实 SOCSO、一份真实 EPF 记录，逐字段核对（V8、V9），据此校准证据种类与覆盖期模型（D-S1-10、D-S1-6） |
| A-8 | 录入入口形态 | 控制台表单 / 菜单 / 脚本函数的设计与授权（若涉及 `170`，需要 Freeze 例外） |
| A-9 | 后续切片 | 断言表与政策规则、时间维度与日历、覆盖时间线、Tax、Grab 报销、EPF 激励——**每一项单独设计、单独授权** |

---

## 16. 证据索引

- **源码行号**：见 §11.1 的 SF-1 … SF-22（每条都写了文件与行号）。所有行号指向 B-6 所说的 10-21 基线副本，**不是**你当前的工作副本。
- **来信与授权信**：2026-10-29 来信「Compliance OS — S1 Final Design 收敛任务」（附件 `1c6d65f4-attachment.txt`）；2026-10-21 授权信（附件 `605f082a-attachment.txt`，D1–D6）。
- **上一轮产物**（同一目录，只读引用）：`Contribution_Planning_Design_2026-10-26.md`（7 表 / 129 列的起点设计；本文 §10 的"旧栏位"出处）；`ADR_Drafts_Contribution_Planning_2026-10-26.md`（`ADR-DRAFT-CPR-1…5`，仍是 DRAFT）；`Official_Policy_Register_2026-10-23.md`（政策登记表，待你抽查）；`PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md`（Phase P，独立）。
- **本轮同批文件**：`TruthWriter_Decision_Note_2026-10-31.md`（§9 的完整分析）；`S1_Test_Plan_2026-10-31.md`（测试与 V0–V10 验证计划；**本轮一项也没有执行**）。

---

## 附录 A：备选——断言表的规格（仅当你在 D-S1-1 选 (b)）

> 这是**备选规格**，不是本设计的一部分。选它则 S1 = 5 张表 / 55 列（44 + 11）。

**用途**：以**可追溯**的方式记录"你声明的某个制度状态"（例如"某日起我已登记 / 尚未登记某计划"）。**只存用户状态，不存政策事实**——资格、金额、生效日期、规则版本属于 UP 类，仍不进 S1（R-F6），留给 S3 的 `Policy_Rule`。S1 里**没有任何函数读它**；它只提供"可追溯地记录"。

表名暂定 `Scheme_Status_Assertions`（文本栏位 10、数字栏位 1；`entry_seq` 是唯一的数字栏位）：

| # | 栏位 | 类型 | 必填 | 允许值 / 规则 | 事实类 |
|---|---|---|---|---|---|
| 1 | `assertion_key` | 文本 | ✓ | `CMP-AST-{SUBJECT}-{YYYYMMDD}`（`YYYYMMDD` = `as_of_date`） | M |
| 2 | `entry_seq` | 数字 | ✓ | 同 §5.1 | M |
| 3 | `entry_type` | 文本 | ✓ | `ORIGINAL` / `REVISION` / `CORRECTION` / `VOID` | M |
| 4 | `subject` | 文本 | ✓ | 闭集：`EPF_I_SARAAN_PLUS_REGISTRATION` / `SOCSO_SELF_EMPLOYED_REGISTRATION`（名字取自 10-21 授权信的用语，**官方名称本轮未核实**） | UD |
| 5 | `status_value` | 文本 | ✓ | `REGISTERED` / `NOT_REGISTERED` / `UNKNOWN` | UD 或 OD（按 `basis`） |
| 6 | `as_of_date` | 文本 | ✓ | 严格日期：你声明这个状态"从哪天起"成立 | UD |
| 7 | `basis` | 文本 | ✓ | `USER_STATED` / `EVIDENCE_BACKED`；系统**永不**自动把 `USER_STATED` 升级 | UD |
| 8 | `evidence_id` | 文本 | 条件 | `basis = EVIDENCE_BACKED` 时必填，且必须指向有效证据；否则必须为空 | M（外键） |
| 9 | `note` | 文本 | 可选 | ≤ 500 | UD |
| 10 | `reason` | 文本 | 条件 | 非 `ORIGINAL` 必填 | UD |
| 11 | `recorded_at` | 文本 | ✓ | 同 §5.1 | M |

- **身份** = (`subject`, `as_of_date`)；同一 `subject` 在同一 `as_of_date` 只有一条链。某日的有效状态 = `as_of_date` 不晚于该日的**最新**一条的有效条目；**没有任何断言 ≠ `NOT_REGISTERED`**（返回 `UNKNOWN`）。
- 选它需要**额外**把 `Official_Evidence.evidence_kind` 的允许值扩充（登记确认类各一个）——只涉及允许值，不增列。
- 重复 / 历史 / 失败语义与 §4、§8、§9 相同（同一套追加链与类型化结果）。
- 它**不**含：政策值、费率、资格、生效日期、规则版本、激励金额。

---

## 附录 B：虚构示例（用来演示规则，**不代表任何官方规则、费率或政策**，也不是任何真实记录）

> 所有金额、日期、参考号都是虚构的。本附录描述的是设计预期，**没有运行任何代码**。

### B.1 证据（1 行）

| evidence_id | seq | type | kind | official_reference | document_date | drive_file_id | file_hash_sha256 |
|---|---|---|---|---|---|---|---|
| `CMP-EVD-F-A1B2C3D4E5F60718` | 1 | ORIGINAL | `SOCSO_PAYMENT_RECORD` | `EX-0001` | `2026-07-05` | `EXAMPLE_DRIVE_FILE_ID_0001` | `a1b2c3d4e5f607180123456789abcdef0123456789abcdef0123456789abcdef` |

（`accessible_location` 空；`H16` = 哈希前 16 位转大写 = `A1B2C3D4E5F60718`。）

### B.2 计划行（3 行，每行 100.00，虚构）

`CMP-PLN-MAIN-SOCSO_CONTRIBUTION-2026-07`、`…-2026-08`、`…-2026-09`；各自 `entry_seq = 1`、`ORIGINAL`、`line_kind = SOCSO_CONTRIBUTION`、`planned_amount = 100.00`。

### B.3 付款（1 行：一次缴 300.00，覆盖期只有起点）

| 栏位 | 值 |
|---|---|
| `payment_key` | `CMP-PAY-SOCSO_CONTRIBUTION-F-A1B2C3D4E5F60718-L1` |
| `entry_seq` / `entry_type` | 1 / `ORIGINAL` |
| `payment_kind` / `amount` / `payment_date` / `line_no` | `SOCSO_CONTRIBUTION` / `300.00` / `2026-07-05` / `1` |
| `evidence_id` | `CMP-EVD-F-A1B2C3D4E5F60718` |
| `coverage_statement` / `coverage_start` / `coverage_end` / `coverage_basis` | `START_ONLY` / `2026-07-05` / （空——**终点未知，不推断**） / `PRINTED_ON_EVIDENCE` |

### B.4 链接（3 行：这一笔付款分给三个计划月）

`link_key` = `CMP-LNK-CMP-PAY-SOCSO_CONTRIBUTION-F-A1B2C3D4E5F60718-L1~CMP-PLN-MAIN-SOCSO_CONTRIBUTION-2026-07`（以及 `-08`、`-09`），每条 `allocated_amount = 100.00`。锁内检查：付款有效、计划行有效、种类相同、分配总额 300.00 ≤ 付款 300.00。

### B.5 对照结果

| 计划行 | P | S | 状态 |
|---|---|---|---|
| 2026-07 | 100.00 | 100.00 | `Paid` |
| 2026-08 | 100.00 | 100.00 | `Paid` |
| 2026-09 | 100.00 | 100.00 | `Paid` |

`unallocatedPayments`：空（300.00 − 300.00 = 0）。`flags`：`COVERAGE_END_UNKNOWN`（这笔付款只有起点）。

### B.6 覆盖期查询（针对 B.3 这一笔付款的记录）

| 查询日期 | 结果 | 说明 |
|---|---|---|
| `2026-07-04` | `NOT_COVERED_BY_THIS_PAYMENT`（`PRINTED_ON_EVIDENCE`） | 早于起点 |
| `2026-07-05` | `UNKNOWN` | 起点当天及之后：终点未知，**永远不会是 `COVERED`** |
| `2026-10-31` | `UNKNOWN` | 同上；系统不会用"缴款日 + 3 个月"去补终点 |

另一笔**虚构**付款若记录为 `START_AND_END`（`2026-08-01` 至 `2026-08-31`，`USER_STATED`）：`2026-08-31` → `COVERED`；`2026-09-01` → `NOT_COVERED_BY_THIS_PAYMENT`。

### B.7 更正的顺序（演示跨记录规则）

你发现付款金额抄错，官方记录其实是 250.00：

1. 直接提交付款 `CORRECTION`（`entry_seq = 2`，`amount = 250.00`）→ 锁内判定：该付款有效分配总额 300.00 > 250.00 → **`Rejected(ALLOCATION_EXCEEDS_AMOUNT)`**，没有写入。
2. 先把 `…-2026-09` 那条链接 `VOID`（`entry_seq = 2`，内容 = 原内容的完整副本，`reason` 必填）→ 有效分配总额 200.00。
3. 再提交付款 `CORRECTION`（250.00）→ 200.00 ≤ 250.00 → `Appended`。
4. 对照变为：2026-07 `Paid`、2026-08 `Paid`、2026-09 `Planned`；`unallocatedPayments` 有一行 `Not_Planned`（未分配 50.00）。**旧的结果不会被当成当前事实**，因为对照永远按当前有效条目重算。

### B.8 失败后的重试

提交 B.3 的付款时在 `APPEND` 阶段出错 → `Failed{APPEND, MAYBE}`（不知道写没写）。**原样重发**：①若第一次其实已落地 → 同序号、相同内容 → `Already_Recorded`（没有第二行）；②若没落地 → `Appended`。

### B.9 校验失败

提交 `amount = "300.005"` → `Invalid[AMOUNT_TOO_MANY_DECIMALS]`：没有读写任何 Sheet，也**不会**被静默四舍五入成 300.01 或 300.00。
