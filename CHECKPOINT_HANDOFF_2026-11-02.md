# Compliance OS — Checkpoint / Handoff（2026-11-02）

| 项 | 值 |
|---|---|
| **状态** | **PAUSED——没有进行中的实现**（Steven 2026-11-02 06:50 指示暂停 coding；核对后确认：本窗口从未进入过编码，见 §4） |
| 生成时间 | 指示日期 2026-11-02 06:50；本文件完成于 2026-11-03（Asia/Kuala_Lumpur；文件名沿用指示日期，因为治理文件已按这个名字引用它） |
| 覆盖范围 | 会话 `cc123bd8-c270-5522-bad7-42199c968784`，2026-10-21 04:58 → 2026-11-02；共 4 个阶段（§1.2） |
| 本窗口是否修改了仓库代码 / 测试 / 治理文件 / 配置 | **NO**。基线副本（两处）与你上传的 zip 逐文件比对：77 个文件、0 差异（§4.2） |
| 是否运行真实 GAS / 部署 / 调用 Gemini / 访问生产数据 | **NO** |
| 是否运行过任何测试 | 没有运行任何既有测试，也没有 S1 测试（S1 代码不存在）。唯一的运行是 2026-10-23 的 Phase P 复现脚本（Node 内存假对象，调查性质，不是真实 GAS） |
| 治理文件 / ADR Log | **已生成「更新后的副本 + 补丁」（仅文档、纯插入、0 行删除）；你的真实仓库尚未被改动**，需要你合入（§2.4、附录 C） |
| 本 checkpoint 的可信度限制 | 会话记录只保留 2026-11-01 21:02 起的部分；更早几轮靠磁盘上的文件、任务清单、记忆与压缩摘要重建，**可能有遗漏**（§1.5） |

**状态词（用户指定的六类）**：**已完成且已验证** / **已实现但未验证** / **正在进行** / **尚未实现** / **未解决** / **已被后续决定取代**。**「讨论过」不等于「已实现」，「已实现」不等于「已验证」。**
**证据标签**：【源码证实】= 读过那一行源码（**不等于**真实 GAS 观察）；【设计建议】= 我的提议，未批准、未实作；【已确认】= Steven 来信明文；【PENDING】= 等 Steven 决定或核对；【UNVERIFIED】= 没有证据，不得当事实；【BLOCKED】= 做不到、没有绕过；【NOT RUN】= 计划了但没有执行。

---

## 0. 一页摘要

1. **本窗口做的全是设计 / 调查 / 文档，没有实现。** 四个阶段：①读 handoff、盘点 EPF / Tax / SOCSO 现状并给出下一步建议（10-21）；②设计轮：官方政策登记、Phase P 重复写入独立调查、数据模型设计、ADR 草案、独立复核（10-21 → 10-29）；③S1 收敛轮：S1 最终设计、TruthWriter 决策说明、S1 测试计划（10-29 → 11-01）；④本次：checkpoint 与治理登记（11-02）。
2. **现在停在哪**：S1 的三份设计文档已经交付，**等你的决定与授权**；没有半成品、没有中断点。设计完整**不等于**实施授权。
3. **最关键的三个待决**：**D-S1-1**（第 2 张「断言」表放不放进 S1）、**D-S1-3**（时间维度放不放进 S1）、**D-S1-9 / DT-1**（TruthWriter：批准 Freeze 例外走方案 A，还是不批准走 B1）。其余 D-S1 与 DT 都有默认值，标「默认，待确认」，**不回答不构成同意**。
4. **已确认的只有来信明文**：10-21 授权信 D1 – D6（业务范围与规则）与 10-29 S1 收敛信（S1 范围、边界、交付要求）。**没有任何 ADR 被批准，没有任何 ADR 编号被分配，没有任何实作被授权。**
5. **治理文件 / ADR Log**：已按你的指示把「已确认 / 提议 / 待决 / 未验证 / 被取代」分别登记，全部标 PROPOSED / PENDING / UNVERIFIED；以**更新后的 5 个文件 + 一份补丁**交付（`governance_sync_2026-11-02/`）。它们是对 **10-21 基线副本**做的纯插入，**你的真实仓库当前内容我看不到**（§1.3、B-6）。
6. **新窗口第一件事**：不写代码；先让你上传 §6 的文件，核对真实仓库是否仍等于基线，再合入治理补丁，然后才问你上面三个决定（§5）。

**你要求的 7 项内容 → 章节**：①当前项目状态 = §1；②本窗口重要决定 = §2；③已完成 / 未完成 / blocked = §3；④当前 implementation checkpoint = §4；⑤下一步准确操作 = §5；⑥新窗口必须先读的文件 = §6；⑦不要重复做 / 不要假设 = §7。附录：A 原文（11-02 指示与两封来信）、B 指纹（含基线 77 个文件的 sha256，用来检测仓库漂移）、C 治理补丁明细、D 核对清单（做过 / 没做）。

---

## 1. 当前项目状态

### 1.1 项目与本窗口主题

- **项目**：Compliance OS——Google Apps Script standalone 项目（通过 Script Property `SPREADSHEET_ID` + `openById` 访问 Spreadsheet；`appsscript.json:2` 项目时区 `Asia/Singapore`）。仓库是一个平铺目录，**不是 git 仓库**（有 `.clasp.json`）。
- **本窗口主题**：Contribution Planning & Official Payment Records（本文简称 **CPR**）——EPF / SOCSO / Tax 的缴款预算计划 + 实际官方付款记录 + 两者对照（10-21 授权信 D1）。
- **本窗口实际做过的事**：架构分析、官方政策调查、Phase P 只读调查、数据模型与 ADR 草案、S1 收敛设计、TruthWriter 决策说明、S1 测试计划、治理登记、本 checkpoint。**没有实现一行代码**（§4）。

### 1.2 时间线（四个阶段；日期为 Asia/Kuala_Lumpur）

| 阶段 | 日期 | 做了什么 | 产物 | 现状 |
|---|---|---|---|---|
| R0 | 10-21 04:58 → 06:59 | 读 `HANDOFF_MANIFEST_2026-10-18.md` 与上传的 zip；盘点 EPF / Tax / SOCSO 现状；在聊天里回答「下一步建议」 | 无文件（**聊天里的建议没有落盘**） | 被 10-21 06:59 的授权信取代 |
| R1 | 10-21 → 10-29 | 按授权信 D1 – D6 做设计轮：官方政策登记（10-23）；Phase P 只读调查 + Node 内存复现（10-23）；设计报告（10-26：7 表 / 129 列的起点设计、对照规则、幂等与审计、SOCSO / Grab、EPF / Tax、日历、测试、切片、决定 D-1 … D-18）；ADR 草案 CPR-1 … 5（10-26，10-28 修订）；一次由另一个 agent 做的独立复核（10-27 → 10-29；**逐条结论没有存档**）；10-29 09:43 – 09:45 修订了政策登记表与设计报告 | 4 份文档 + `tooling/phaseP_dup/` | 已交付；D-1 … D-18 **一直没有收到答复**，视为未决 |
| R2 | 10-29 23:18 → 11-01 21:05 | 按 S1 收敛信把 S1 收窄并重新核对：S1 最终设计、TruthWriter 决策说明、S1 测试计划 | 3 份文档 | 已交付（DESIGN ONLY）；等你的决定与授权 |
| R3 | 11-02 06:50 → 11-03 | 暂停 coding；对照实际文件做完整核对；治理文件 / ADR Log 登记（更新副本 + 补丁）；本 checkpoint | `governance_sync_2026-11-02/`、本文件 | 本文件交付后**停止** |

### 1.3 仓库 / 文件状态（对照实际文件核对；2026-11-02 复跑）

| 项 | 事实 | 证据 |
|---|---|---|
| 基线 | 你 10-21 上传的 `07.Compliance-main.zip`：sha256 `2c52e947f8f0e76a5ebcb678bac54f968de124256b31fd564f655f65c96c5695`，579,174 字节，77 个文件（含 `.clasp.json`、`.claspignore`），顶层目录 `07.Compliance-main` | 复算 sha256；附录 B.1 |
| 两份只读工作副本 ↔ zip | `scratchpad/zip_new/07.Compliance-main` 与 `scratchpad/phaseP_work/repo_copy`：各 77 个文件，**0 个不同、0 缺失、0 多出** | 复跑 `filestate.py`（zip 逐成员 sha256 ↔ 磁盘文件 sha256） |
| 本窗口对仓库的修改 | **0 个文件**（上一行即证据）。治理文件的更新只存在于 `governance_sync_2026-11-02/` 的**副本**里 | 同上 |
| 与 manifest 的关系 | manifest 列出的 17 个 handoff 文件 sha256 全部相符（10-21 核对，10-27 复核 17/17）。zip 自身的 hash 与 manifest 里「baseline zip」的 hash（`e6e21a76…`）不同——manifest 的说法是「工作副本 = baseline + 修改，77 个文件」，与这个 zip 一致；各文档把这个 zip 叫「基线」是宽松说法 | 复核记录（scratchpad `review/review_log.md`，临时文件） |
| 你的真实仓库 | **看不到**（云端容器，没有链接你的电脑）。你 10-21 之后改过什么，我不知道（B-6） | 工具列表里没有 `mcp__remote-devices__*` |
| 既有测试 | 本窗口**没有运行**任何既有测试，不知道它们当前是否通过（Test Plan B-6） | — |
| 项目自己的状态记录 | `VERIFICATION_STATUS.md`、`MODULE_CATALOG.md`、`CHANGELOG.md`、`900_Constitution.js` 的 `changelog` 数组；本 checkpoint **不重复**它们 | — |

### 1.4 S1 设计要点（全部 PROPOSED；没有一项被批准，也没有一项被实现）

1. **4 表 / 44 列**：`Official_Evidence`（12）、`Contribution_Plan_Lines`（9）、`Official_Payments`（15）、`Payment_Links`（8）。来信暂定 5 表、上一轮 88 列；第 2 张「用户状态 / 政策事实断言」表**推迟**（备选规格在 FD 附录 A：11 列 → 5 表 / 55 列）。
2. **记录链**：业务键 + `entry_seq` + `entry_type`（取值见 FD §4.1），有效版本取最高序号，**不覆盖历史**；业务键只由业务事实推导，不用时间戳 / 计数器 / 随机数。
3. **金额**严格 2 位小数、超出即拒绝（D-S1-5 默认）；**日期**严格 `YYYY-MM-DD` + 日历校验；业务「今天」取 `Asia/Kuala_Lumpur`（D-S1-13 默认）。
4. **SOCSO 覆盖期** = 付款行上的四个 `coverage_*` 栏位（陈述值）；新增 1 列 `coverage_statement` ∈ {`NOT_STATED`, `START_ONLY`, `START_AND_END`}；**终点从不推断**；`coverageStatusOn_` 三值：`COVERED` / `NOT_COVERED_BY_THIS_PAYMENT` / `UNKNOWN`，终点未知时**永远不会**返回 `COVERED`；EPF 付款不套用覆盖期模型。
5. **对照只做金额维度**：`Planned` / `Partially_Paid` / `Paid` / `Overpaid` / `Not_Planned` / `Discrepancy_Flagged` / `Not_Applicable`；`due_date`、`Overdue`、覆盖时间线、日历集成**推迟**（D-S1-3）。
6. **读取失败 ≠ 「确实没有记录」**：两种不同类型的结果；任何路径都不得把异常当成空表。
7. **四类事实**（官方文件事实 / 用户申报 / 系统计算 / 未核实政策）严格分开，用户断言**不自动升级**；**S1 不含任何政策数值**（费率、资格、金额、生效日期）。
8. **付款必须挂证据**（D-S1-4 默认）；**退款不建模**（金额必须 > 0）。
9. **写入边界**：推荐方案 A（在 `115_TruthWriter.js` 新增一个通用「受保护追加」方法；**需要 Freeze 例外**）；退路 B1（外层持锁，不改任何已批准文件；须守 G1 – G5）。无论 A 或 B1，并发保护是否成立都取决于 V3 – V5 里**未验证**的 GAS 行为；S1 的安全底线 = 重试收敛 + 有效视图吸收相同重复行。
10. **建表**：S1 自己的 `cprSetupSheets()`，**不动** `buildSheetSchemas_()`，所以 `109_Tests_SheetSetup.js:25–28` 的「七张表」断言照样通过（D-S1-8 默认）；代价：`setupComplianceOsSheets()` 不会建 S1 的表。
11. **录入入口没有设计**（控制台表单 / 菜单 / 脚本函数；FD §14；A-8）：S1 目前只有「写入函数的契约」，没有人能点的东西。
12. **测试计划**：L1 静态 / L2 Node 模拟 / L3 真实 GAS（由你在副本上执行）/ L4 人工；场景组 A – H；V0 – V10；变异检查 M1 – M12；**全部 NOT RUN**。V0 隔离环境；V1 建表与格式；V2 表头不一致；V3 脚本锁语义；V4 `flush` 可见性；V5 并发重复提交；V6 `Date` 读回与时区；V7 `appendRow` 失败模式；V8 首份真实 SOCSO 记录核对；V9 首份真实 EPF 记录核对；V10 取「今天」（`Asia/Kuala_Lumpur`）。

### 1.5 记录完整性限制（诚实说明）

- 会话记录文件（jsonl）只保留最后一个片段（从 11-01 21:02 起）。更早几轮（10-21 → 11-01）是靠磁盘上的交付文件、scratchpad、任务清单、记忆与前几次压缩摘要重建的。**可能遗漏**：R0 聊天里的口头建议、中途的小决定、我对某次「继续」的具体回应。
- 因此 §2 只收**有书面来源**的决定（两封来信 + 设计文档里的决定编号）；没有书面来源的口头内容不当决定记录。
- 前四份设计文档（政策登记表、Phase P 调查、设计报告、ADR 草案）：我无法证明你收到的是哪个版本。附录 B 给出指纹；你手上的副本 hash 不同，就告诉我，我重发。
- scratchpad 里的脚本与中间文件（`make_gov_sync.py`、`filestate.py`、`s1_verify/`、`review/`、`tx/` 等）是**临时文件**，会话结束后可能消失，不是交付物。

---

## 2. 本窗口的重要决定

**读这一节的规则**：只有 §2.1 是「已确认」，而且确认的是**业务范围与边界**，**不是架构批准**。§2.2 的每一项都是 **PENDING**（「默认，待确认」的意思是：我设计时采用的默认值，你没有回答，**不构成同意**，我也不会据此开始实施）。

### 2.1 已确认（只有来信明文；逐字原文见附录 A）

| # | 内容（摘要） | 来源 | 已写入的治理文件 |
|---|---|---|---|
| C-1 | **D1 总体范围**：Budget Plan + Actual Official Payment/Contribution Records + Comparison；本阶段不做 EPF / Tax 计算器 | 10-21 信 §2 D1（L38） | CHANGELOG 2026-11-02「已确认」 |
| C-2 | **D2 记录类别**：仅 EPF 缴款、Tax 分期 / 付款、SOCSO 缴款；个人贷款、信用卡还款及其他一般负债不属于本 Slice | D2（L46） | 同上 |
| C-3 | **D3 SOCSO**：用户自行缴费；Grab 尚未自动扣缴；可一次缴多个月；覆盖期间必须精确到日；**不假设自然月**；**不得自行推断正式保险保障规则**；Grab 报销必须独立记录，不得默认缴费即代表报销完成；实际付款日期 / 覆盖开始 / 覆盖结束 / 缴费金额 / 报销状态 / 缴费与报销对应关系必须区分 | D3（L56） | CHANGELOG 2026-11-02「已确认」 |
| C-4 | **D4 EPF**：尚未登记 i-Saraan Plus、供款金额未决；政府激励的资格、计算方式、上限和条件必须经官方资料核实，**不得把未经核实的政策数字写死**；第一阶段不做正式供款计算器 | D4（L79） | CHANGELOG |
| C-5 | **D5 Tax**：尚未收到 CP500；没有正式通知书时**不得生成虚构的 CP500 金额**；税额估算、收入归属、跨年税务计算不属于本阶段 | D5（L98） | CHANGELOG |
| C-6 | **D6 数据录入**：手动录入 + 正式文件引用；PDF 自动解析、OCR、LLM 提取属于后续独立阶段；所有正式记录必须经过确定性验证；**LLM 不得直接写入 Truth** | D6（L114） | CHANGELOG |
| C-7 | **10-21 信的授权范围与禁止项**：只授权架构分析、规则调查、设计文档、ADR 草案；不改生产 / 测试代码、不改真实数据、不写真实 GAS、不部署、不调 Gemini、不做 PDF / LLM、不做计算器、不做贷款 / 信用卡、不擅自修 Phase P、不重跑无关全量回归、不制作 ZIP、不把 Node 结果当真实环境验证、不扩大到其他 OS；ADR 遵守现有编号 / 状态 / 批准流程；无法确认下一个 ADR 编号时**不要猜测或覆盖**，先在报告中说明 | 10-21 信 §0、§6、§7（L3、L244、L267） | CHANGELOG「已确认」只登记了**授权范围**；逐条禁止项**没有**逐条登记，原文在附录 A |
| C-8 | **10-29 信 S1 范围**：最小化 Official Contribution Record Core（暂定 5 张表；具体表名、字段、主键、关联键必须以证据重新核对，**无法证明属于 S1 必需范围的列入后续阶段**）；业务范围仅限 SOCSO 自雇缴款记录、EPF 缴款记录、预算计划与实际官方缴款的可追溯比较、SOCSO 保障期间精确日期（**未知结束日期不得推断**）；不纳入 Tax / CP500、EPF 激励自动计算或资格判定、Grab 报销自动化、Calendar 集成、PDF / LLM 自动导入、Phase P 修复、其他债务 / 信用卡 | 10-29 信 §3（L26） | CHANGELOG |
| C-9 | **10-29 信边界**：不改任何现有业务 / 测试代码、治理文件或正式配置；不新增 Sheet；不运行真实 GAS；不调 Gemini；不访问或修改生产数据；不部署、不迁移、不创建真实记录；不实施 Phase P 修复；**不把 Node / fake GAS 测试描述成真实 GAS 验证**；不把未核实的官方政策当事实；**不自行分配正式 ADR 编号，未获批准的 ADR 继续标 DRAFT**；不扩大已批准业务范围；缺失 / 证据不足 / 契约矛盾时标 BLOCKED / UNVERIFIED，不得推断后继续 | 10-29 信 §2（L13） | CHANGELOG（部分：不自行分配 ADR 编号、未批准的 ADR 标 DRAFT、BLOCKED / UNVERIFIED 规则）；ADR 索引草案节（不占用编号）；其余边界逐条的原文在附录 A |
| C-10 | **10-29 信对设计内容的要求**：官方事实 / 用户申报 / 系统计算 / 未核实政策四类严格区分，**不得将用户断言自动升级为已核实的官方事实**；TruthWriter 方案 A / B 在核对现有锁 / 校验 / 追加 / 失败契约**之前不得选定**；必须保留 6 项已知风险；**设计完整不等于获得实施授权**；三份文件完成后停止 | 10-29 信 §4、§5、§6（L55、L119、L128） | CHANGELOG（用户断言不自动升级、设计完整不等于实施授权）；`DATA_OWNERSHIP.md`（四类事实与「不自动升级」） |
| C-11 | **11-02 指示**（本 checkpoint 的依据）：暂停 coding；对照实际 repository / file state 完整核对；区分六类状态；**本窗口形成、确认或需要持久化的治理 / 架构 / 工程决定必须写入对应的 Governance 文件和 ADR Log，不要只写在 checkpoint 里；未最终确定的事项标 pending / proposed，不得伪装成已批准**；保存 checkpoint / handoff；完成后停止，下一窗口以持久化文件为主要依据 | 11-02 06:50 | 本次治理同步（§2.4） |

> **没有被确认的东西**：来信 B-9 已说明，10-29 信写「基于已确认的用户决策」但**没有列清单**。所以我只把上表（来信明文）当作已确认。上一轮的 **D-1 … D-18** 与本轮的 **D-S1-1 … 15**、**DT-1 … 4**、**A-1 … 9** **一项都没有收到答复**。

### 2.2 提议 / 待决（PENDING；全部「默认，待确认」）

#### 2.2.1 D-S1-1 … D-S1-15（`S1_Final_Design_2026-10-31.md` §13.1）

★ = 来信要求「尽快回答」的三个关键决定。

| # | 问题 | 默认（待确认） | 备选 | 需要在…之前 |
|---|---|---|---|---|
| ★ **D-S1-1** | 第 2 张表（用户状态 / 政策事实断言）放不放进 S1 | 推迟 | 放进 S1（FD 附录 A，11 列 → 5 表 / 55 列） | 实施授权前 |
| D-S1-2 | SOCSO 覆盖期放在哪 | 付款行上的四栏 | 单独覆盖期表 | 实施授权前 |
| ★ **D-S1-3** | 时间维度（`due_date`、`Overdue`、覆盖时间线、日历集成）放不放进 S1 | 推迟 | 把 `due_date` 与 `Overdue` 放进 S1（+1 列；引入「截至某日」输入与马来西亚日期边界规则；`Overdue` 对自雇缴款没有官方定义） | 实施授权前 |
| D-S1-4 | 付款是否必须挂证据 | 必须（取消「无凭证例外」） | 允许例外并永久标 `NO_EVIDENCE` | 实施授权前 |
| D-S1-5 | 金额超过 2 位小数 | 拒绝 | 静默 `round2_`（不推荐） | 实施授权前 |
| D-S1-6 | 覆盖期约定 | 终点含当日；只到天；允许 `START_ONLY` 与 `NOT_STATED` | 每笔 SOCSO 付款都必须 `START_AND_END`；记录到时刻 | 实施授权前 |
| D-S1-7 | 表名 | 来信用的名字（`Official_Evidence` / `Contribution_Plan_Lines` / `Official_Payments` / `Payment_Links`） | 沿用上一轮的单数名 | **建表前**（建了就是迁移） |
| D-S1-8 | 建表路线 | 零改动：S1 自己的建表函数 | 登记进 `buildSheetSchemas_()`（要改 `108`、`109:25–28`，并需要 Freeze 例外） | 实施授权前 |
| ★ **D-S1-9** | TruthWriter 方案（= Decision Note 的 DT-1） | 批准 Freeze 例外 → 方案 A | 不批准 → 方案 B1 + 守则 G1 – G5；或先 B1、V3 – V5 之后再决定是否升级为 A | 实施授权前 |
| D-S1-10 | 证据种类 | 两个通用值 `SOCSO_PAYMENT_RECORD` / `EPF_PAYMENT_RECORD` | 细分收据 / 对账单 / 门户（需要你给真实文件样本） | V8 / V9 之后 |
| D-S1-11 | `entry_source` 栏位 | 推迟 | 现在就加 | 实施授权前 |
| D-S1-12 | 表头预检 | 放在原语之外，写入前做一次 | 给访问器与原语增加读第 1 行的能力（要改 `115` 更多）；不预检 | 实施授权前 |
| D-S1-13 | 业务日期的时区 | 明确 `Asia/Kuala_Lumpur` | 项目时区 `Asia/Singapore`（`appsscript.json:2`） | 实施授权前 |
| D-S1-14 | 身份栏位不可变（含付款的 `evidence_id`、`line_no`） | 不可变；改身份 = `VOID` + 重新登记 | 允许 `CORRECTION` 改它们（不建议） | 实施授权前 |
| D-S1-15 | ADR | 保持 DRAFT（`ADR-DRAFT-CPR-1 … 5`），由你指定正式编号 | 你现在给编号（我不会自行编号） | 治理文件同步时 |

#### 2.2.2 TruthWriter Decision Note 的 DT-1 … DT-4（`TruthWriter_Decision_Note_2026-10-31.md` §12，:287–290）

| # | 问题 | 默认（待确认） | 备选 |
|---|---|---|---|
| DT-1 | 是否批准 Architecture Freeze 例外去改 `115_TruthWriter.js`（`compliance-os-governance-draft.md:420`） | 批准 → 方案 A | 不批准 → B1 + G1 – G5；先 B1，V3 – V5 之后再决定 |
| DT-2 | 受保护追加返回类型化结果，还是沿用抛异常 | 返回 `Failed{phase, written}` | 抛异常 + 异常上带 `phase` |
| DT-3 | 追加后是否调用 `flush` | 调用（无害） | 不调用，等 V4 证明必要再加 |
| DT-4 | 对应的 ADR 怎么处理 | 保持 DRAFT（`ADR-DRAFT-CPR-1`），由你指定正式编号；不分配编号、不改 ADR 索引的正式条目 | — |

#### 2.2.3 独立授权 A-1 … A-9（FD §15）——「设计完整 ≠ 实施授权」

| # | 授权 | 内容 | 现状 |
|---|---|---|---|
| A-1 | Freeze 例外决定 | 批准 / 拒绝改 `115`（决定走方案 A 还是 B1；= D-S1-9） | **未授权** |
| A-2 | S1 实现授权 | 新增 S1 文件（纯函数 + 边缘适配器）；若选 A 含 `115` 的增量；Node 测试可写可跑，**结果不得描述成真实 GAS 验证** | **未授权** |
| A-3 | 真实 GAS 验证授权 | 在 Spreadsheet **副本** + 临时 Script Property 上做 V0 – V7、V10；不碰生产数据；由你执行、我据你贴回的日志判断 | **未授权** |
| A-4 | 建表授权 | 在真实 Spreadsheet 上创建 S1 的四张表（`cprSetupSheets()`；先在副本上做 V1） | **未授权** |
| A-5 | 治理文件同步授权 | `MODULE_CATALOG`、File Map、Data Ownership、Verification Status、ADR 正式编号 | **部分**：11-02 指示授权了「仅文档的状态登记」（§2.4）；`MODULE_CATALOG`、File Map、正式 ADR 编号与任何状态升级**没有授权，没有做** |
| A-6 | Phase P 修复（独立） | 与 S1 互不依赖 | **未授权** |
| A-7 | 首份真实官方记录核对 | 你提供一份真实 SOCSO、一份真实 EPF 记录，逐字段核对（V8、V9） | **未授权**（也没有收到任何真实记录） |
| A-8 | 录入入口形态 | 控制台表单 / 菜单 / 脚本函数的设计与授权（若涉及 `170`，需要 Freeze 例外） | **未授权；入口未设计** |
| A-9 | 后续切片 | 断言表与政策规则、时间维度与日历、覆盖时间线、Tax、Grab 报销、EPF 激励——每一项单独设计、单独授权 | **未授权** |

#### 2.2.4 其他未决事项

| # | 事项 | 状态 |
|---|---|---|
| PD-1 | **ADR-007 编号冲突**：ADR 索引说「下一个新 ADR 是 ADR-007」（索引第 17 行）；Phase P 设计提案（10-17）也把它的 ADR 暂称 ADR-007（`PhaseP_Documents_Processing_State_Design_2026-10-17.md:33`、`:575–576`、`:586`）。CPR 草案用 `ADR-DRAFT-CPR-n` 标签，**没有占用任何编号** | PENDING：由你决定谁拿 ADR-007 |
| PD-2 | **两份 ADR 索引文件**（`README-Architecture Decision Records — Index.md` 与 `… #U2014 Index.md`；内容目前一致）：CHANGELOG:42 写明要你决定留哪份。本次只更新了 em dash 那份 | PENDING |
| PD-3 | **Phase P 修复范围**（T1-a / T1-b / T1-c / T2 / T3；Phase P 报告 §7）：只有建议，没有授权 | PENDING（A-6） |
| PD-4 | **政策登记表 10 项人工抽查**（`Official_Policy_Register_2026-10-23.md` §9）：EPF i-Saraan Plus 的若干 FAQ、LHDN 30 天规则、CP502 公式与名称、PERKESO 24 个月规则与强制行业排除、Act 872 s.82–83 / s.1(2)、Grab 页面等级金额 | PENDING（你手工；S1 本身不依赖政策数值） |
| PD-5 | **上一窗口遗留的待决项**：Phase N 的 3 项、Phase O 报告 §9 的 5 项、Phase P 设计提案 §10 的 D1 – D7。本窗口只在 CHANGELOG 里登记「它们存在」，**没有**处理，也没有重新核对它们当前的状态 | PENDING（细节在各自文档里） |
| PD-6 | `MODULE_CATALOG.md:44` 对 `115_TruthWriter.js` 的笼统声明「Node PASS；真实 GAS 验证过」建议改为逐项列出观察结果 | 建议已记录，**未改**（A-5） |
| PD-7 | `ADR-DRAFT-CPR-1` 的表设计与写入原语措辞需要按 D-S1-9 修订；草案本身**本次没有改** | PENDING（D-S1-15 / DT-4） |
| PD-8 | 上一轮 D-1 … D-18 中不在 S1 的：D-7（`160` 里 SOCSO 固定值与 EPF / Tax 存根）、D-8（日历集成方案）、D-11（税务两个日期）、D-14（`150:72` UTC 日期分量）、D-15（Phase P 修复范围）、D-16 / D-17 / D-18（Tax 自备预算 / Grab 事件 / 日历提醒天数） | 留给后续切片 / 另案（FD §13.2） |

### 2.3 已被后续决定取代的（取代的是**提议**，不是已批准的决定）

| 被取代 | 取代者 | 说明 |
|---|---|---|
| 10-26 设计报告的 S1 规格：5 表 / 88 列（`Official_Evidence` 19、`Scheme_Status_Log` 15、`Plan_Line` 21、`Official_Payment` 22、`Payment_Link` 11） | S1 最终设计：4 表 / 44 列 | 45 列被删除或推迟，43 列保留，新增 1 列 `coverage_statement`；逐列去向见 FD §10 |
| 上一轮 D-1 … D-18 | D-S1-1 … D-S1-15 | 对应关系见 FD §13.2；D-4（S1 范围）已由 10-29 信回答；D-2 沿用 E2（来信暂定表清单含 `Official_Evidence`） |
| 上一轮的 TruthWriter 路线 P1 / P2 / P3 | 方案 A / B1（P2 ≈ A，P3 ≈ B1，P1 = 现状） | Decision Note §6.5 |
| `ADR-DRAFT-CPR-1` 的表设计与写入原语措辞 | S1 最终设计 + Decision Note | 待 D-S1-9 后修订草案（PD-7） |
| R0 聊天里的「下一步建议」 | 10-21 授权信 | 没有落盘，不再有效 |

### 2.4 治理文件 / ADR Log 登记（你要求「不要只写在 checkpoint 里」）

**做法**：我看不到你的真实仓库，所以没有改它。基于 10-21 基线副本生成了**更新后的 5 个治理文件**，全部是**纯插入**（0 行删除；原有内容一个字没动），并生成一份可用 `patch -p1` 应用的补丁。补丁已验证：`--dry-run` 通过；在全新的基线副本上实际应用后，结果与更新版逐字节一致。位置与指纹见附录 B、C。

| 治理文件 | 登记了什么 | 位置（更新版） | 标签 |
|---|---|---|---|
| `README-Architecture Decision Records — Index.md`（**ADR Log**） | 新增一节「草案（DRAFT，未编号；尚未批准）——Contribution Planning & Official Payment Records」：`ADR-DRAFT-CPR-1 … 5` 逐项状态；草案文件清单；「业务范围已确认，架构未批准」；ADR-007 编号冲突与重复索引（都 PENDING）；被取代的前身（5 表 / 88 列 → 4 / 44，仅提议）；明确声明「下一个正式编号仍是 ADR-007——本节没有占用它」 | 文件末尾追加（+18 行） | 全部 `PROPOSED（DRAFT）` / PENDING |
| `CHANGELOG.md` | 顶部新增条目「2026-11-02 — Contribution Planning & Official Payment Records：设计轮的治理登记（仅文档）」：类型、流程、依据；**已确认**（D1 – D6 与 S1 收敛信的范围 / 边界 / 要求的**摘要**；原文在附录 A）；**提议**；**待决**；**未验证**；**观察到、未改动的既有行为**（7 条，带文件:行）；**已被取代**；`Schema changes: NONE` / `Extraction-contract changes: NONE` / `Persistence-contract changes: NONE（只有提议）` | 插在「2026-10-11 — Phase N」条目之前（+45 行） | 已确认 / 提议 / 待决分栏 |
| `VERIFICATION_STATUS.md` | 新增一节：结论先行（没有实现 → 没有第 3 – 8 层结果，没有任何 PASS）；各验证层级的状态表（静态核对 DONE（设计层面）；Node 复现 observed；其余 NOT DONE）；UNVERIFIED 清单 | 文件末尾追加（+16 行） | NOT DONE / UNVERIFIED |
| `DATA_OWNERSHIP.md` | 在「PROPOSED — REQUIRES APPROVAL」下新增 S1 四张表的**提议**归类（都是 Authoritative Source；对照 / 覆盖查询 = Projection / Reporting，不落地）与四类事实规则（用户断言不自动升级） | 该节最后一个条目之后（+13 行） | PROPOSED |
| `ARCHITECTURE.md` | 在「PROPOSED / NOT YET IMPLEMENTED」新增一条：S1 核心、`ADR-DRAFT-CPR-1 … 5`、没有代码 / 表 / 验证、方案 A 需要 Freeze 例外（DT-1）、排除项 | 该节末尾（+1 行） | PROPOSED / NOT YET IMPLEMENTED |

**故意没有动的治理文件**（以及为什么）：

| 文件 | 为什么没动 |
|---|---|
| ADR-000 … ADR-006 | 已有的 ADR；本窗口没有批准、拒绝或重开其中任何一项 |
| 任何正式 ADR 编号 | 来信禁止自行分配；D-S1-15 / PD-1 待你决定 |
| 第二份 ADR 索引（`… #U2014 Index.md`） | 重复文件的处理待你决定（PD-2）；只更新了 em dash 那份，避免把重复固化成两处都改 |
| `900_Constitution.js`、`901_System_Architecture.js` | 它们是**代码文件**（`changelog` 数组、架构描述）；本窗口禁止改代码；若要登记，需另行授权 |
| `MODULE_CATALOG.md` | 没有任何模块被实现；只记录「建议改写 :44」（PD-6）；A-5 的这一部分未授权 |
| `compliance-os-governance-draft.md`（File Map、Freeze 条款 :420） | Freeze 例外还没有决定；不能去改已批准的治理草案 |
| `README.md` | 没有理由改 |

**为什么不是「已批准」**：上面每一条登记的措辞都是 PROPOSED / PENDING / UNVERIFIED / NOT RUN；唯一写成「已确认」的是你来信明文（C-1 … C-10），并且注明了确认的是业务范围与边界，不是架构批准。

---

## 3. 已完成 / 未完成 / blocked（六类状态）

**先说一句最重要的**：本窗口没有任何「代码 / 功能层面的已验证项」。下面 (a) 里的「已验证」**只限静态 / 机械层面**，并且每一项都写了「不能据此说什么」。

### 3.1 (a) 已完成且已验证——仅限静态 / 机械层面

| # | 项 | 怎么验证的（层级） | 证据 | **不能据此说** |
|---|---|---|---|---|
| V-1 | **基线完整性**：zip ↔ 两份工作副本 77 / 77 逐字节一致；manifest 的 17 个 handoff 文件 sha256 全部相符 | L1 机械比对（10-21；10-27 复核；11-02 复跑） | 附录 B；`filestate.py` | 「你的真实仓库没变」——我看不到它（B-6） |
| V-2 | **S1 三份文档里的 `文件:行` 引用**对照基线逐条存在（`s1_verify.py` 检查了 296 个范围）。脚本给出的 22 条启发式提示已逐条看过，**全是误报**：4 条「文件未解析」其实只是 2 个引用（各出现两处），指向本窗口自己的交付文件（`PhaseP…:131–133` 是 R3 – R5 三行，`ADR_Drafts…:60` 是 `ADR-DRAFT-CPR-1` 标题行）；其余 18 条是表格里省略了文件名的行号（文件名在同表的相邻格 / 上一行）。本次另外手工核对了关键行：`115:31–46`、`:73–102`、`117:32–42`、`140:167–169`、`:189–198`、`170:233–237`、`190:42`、`109:25–28`、`150:72`、`106:12–14`、`MODULE_CATALOG.md:44`、`116:60–61`、`105:27–38`、`108:140–148`、`900:204`、`appsscript.json:2`、`governance-draft:420`、Phase P 设计 `:33`、`:575–576`、`:586` | L1 | `s1_verify/last_run.txt`（临时）；本次逐行打印核对 | 「文档对代码**行为**的描述正确」——行为描述是人读源码的结果，**没有被机械验证** |
| V-3 | **S1 三份文档的结构核对**：四张表列数 12 / 9 / 15 / 8 = 44（附录 A 另有 11）；表格单元数一致；三份头部块的四项（DESIGN ONLY / 未改代码 / 未运行真实 GAS / 未部署）与阻塞事项齐全；没有占位符；没有政策数值（`500` 只出现在「文本长度 ≤ 500」）；D-S1、A、V 编号范围连续；没有出现「已通过 / 已执行」之类字样 | L1 | `last_run.txt` §2 – §13 | 「设计是对的」 |
| V-4 | **治理同步补丁**：`patch -p1 --dry-run` 通过；在全新基线副本上实际应用，结果与更新版逐字节一致；纯插入（0 行删除）；没有 `.orig` / `.rej` | L1 | §2.4；附录 B、C | 「已合入你的真实仓库」 |

### 3.2 (b) 已实现但未验证

| # | 项 | 是什么 | 为什么算「未验证」 |
|---|---|---|---|
| I-1 | `tooling/phaseP_dup/repro_dup.js`（+ `repro_dup.observed.txt`、`README.md`） | Phase P 的 Node 内存复现脚本：假 `Documents` / `Verified_Income`、假锁、不联网、对仓库副本只读。2026-10-23 运行过，观察输出（S1 – S6）存在 `repro_dup.observed.txt`；**本窗口没有重跑** | 它是**调查脚本**，不是修复，也不是测试套件的一部分；Node 假对象的结果**不等于**真实 GAS（`fakeLockProvider_` 没有互斥）；真实 Sheet 里是否已有历史重复 = 未知 |
| I-2 | `governance_sync_2026-11-02/` 的 5 个更新版治理文件 + 补丁 | 文档层面已生成并机械验证（V-4） | **没有被你审阅**，**没有合入你的真实仓库**；全部条目标 PROPOSED / PENDING / UNVERIFIED |

> **没有 S1 代码**。FD §9.5 里的函数名（前缀 `cpr`）都是暂定名，仓库里不存在。

### 3.3 (c) 正在进行

**无。** 本窗口没有任何实现被中断（§4）。唯一被上下文压缩打断过的是本 checkpoint 的撰写，已在新上下文里完成。

### 3.4 (d) 尚未实现

| # | 项 | 需要的授权 |
|---|---|---|
| N-1 | S1 本体：纯函数 + 边缘适配器 + `cprSetupSheets()`（FD §9.5） | A-2 |
| N-2 | 对 `115_TruthWriter.js` 的任何改动（方案 A 的通用受保护追加方法） | A-1 → A-2 |
| N-3 | S1 测试（`cprTest*`，文件名须含 "Tests"）与变异检查 M1 – M12 | A-2 |
| N-4 | 真实 GAS 验证 V0 – V10 | V0 – V7、V10：A-3；V8、V9：A-7（你提供真实记录） |
| N-5 | 建表（四张 Sheet） | A-4（先在副本上做 V1） |
| N-6 | **录入入口**（控制台表单 / 菜单 / 脚本函数）——**连设计都没有** | A-8 |
| N-7 | 治理文件的正式同步：`MODULE_CATALOG`、File Map、正式 ADR 编号与任何状态升级 | A-5（本次只做了仅文档的状态登记） |
| N-8 | Phase P 修复（T1-a / T1-b / T1-c / T2 / T3） | A-6（独立） |
| N-9 | 后续切片：断言表与政策规则、时间维度与日历、覆盖时间线、Tax / CP500、Grab 报销、EPF 激励（i-Saraan Plus） | A-9（每项单独设计、单独授权） |
| N-10 | EPF / Tax 计算器；PDF / OCR / LLM 导入 | 10-21 信 D1 / D6：后续独立阶段，不在本 Slice |

### 3.5 (e) 未解决 / BLOCKED / UNVERIFIED

**阻塞事项（`S1_Final_Design` 头部 B-1 … B-9；其他两份文档各有自己的子集）**

| # | 标记 | 内容 |
|---|---|---|
| B-1 | UNVERIFIED | SOCSO / EPF 官方文件的真实样子（收据上印不印覆盖期、参考号格式、EPF 记录是一笔一张还是对账单多行）；政策登记表 N6 / N7 = NOT STATED；我没见过你的真实文件 → V8 / V9 |
| B-2 | UNVERIFIED | 真实 GAS 的锁 / `flush` / 重入行为没有任何仓库内证据；官方 Lock 文档重新抓取被拒（`PROVENANCE_REQUIRED`），**没有绕过** → V3 – V5、V7 |
| B-3 | UNVERIFIED | 已设文本格式的列读回原生 `Date` 的根因未查明（`VERIFICATION_STATUS.md:100–107`）→ V6 |
| B-4 | PENDING | 政策登记表 10 项人工抽查（PD-4）；S1 不含任何政策数值 |
| B-5 | UNVERIFIED | UCR6 原文不在仓库内（`900_Constitution.js:204`）；设计对 UCR6 的理解来自引用处 |
| B-6 | UNVERIFIED | 基线是 10-21 的 zip；你之后改过什么，我不知道 |
| B-7 | UNVERIFIED | 没有访问真实 Sheet：真实表头是否漂移、现存数据、真实并发频率均未知 |
| B-8 | PENDING | §2.2.1 的 D-S1-1 … 15 |
| B-9 | 说明 | 来信没有列出「已确认的用户决策」清单（见 §2.1 末尾） |

**其他 BLOCKED / PENDING**

| # | 事项 |
|---|---|
| BL-1 | 官方 Lock 文档重新抓取被拒（`PROVENANCE_REQUIRED`）——没有绕过；之前经工具转述的内容只算线索 |
| BL-2 | 政策登记表 N2：人力资源部 2026-03-31 新闻稿与 `mohr.gov.my` 上的 Act 872 英文 PDF 被 robots 阻挡（`robots_disallowed`）——没有绕过；Act 872 改读 `jtksm.gov.my` 的官方文本（被截断在 s.100(2)） |
| BL-3 | PD-1（ADR-007 编号冲突）、PD-2（重复 ADR 索引）、PD-3 – PD-8（§2.2.4） |
| BL-4 | 所有 D-S1、DT、A 项（§2.2） |

### 3.6 (f) 已被后续决定取代

见 §2.3。再强调一次：被取代的是**提议**，没有任何「已批准的决定」被取代。

### 3.7 本窗口发现的问题登记（P-1 … P-20）

**全部未修复**——边界禁止修改代码；这里只登记、不处理。「层级」说明证据强度：**源码** = 读过那一行（不等于真实 GAS 观察）；**Node** = 内存假对象复现（不等于真实 GAS）；**未知** = 没有证据。

| # | 问题 | 来源 | 层级 | 状态 / 去向 |
|---|---|---|---|---|
| P-1 | 同一批次导入的多个新文件共用同一个 `document_id`（id 末段是 `now.getTime()`，同批共用 `now`） | `110_DocumentImport.js:47`；Phase P 报告 §1；Node S1 | 源码 + Node | 未修复；建议 T1-a |
| P-2 | 同批某份文件抽取失败，会被 Scan / Recovery Center 当成「已完成」，这一周的收入**静默缺席** | Phase P 报告 §0 #2；Node S2 | Node | 未修复；T1-a + T1-c |
| P-3 | Drill-down / Daily Allocation 可能指向**错的 PDF** | Phase P 报告 §0 #3；Node S1 / S2 | Node | 未修复；T1-a |
| P-4 | 批次内快照陈旧：同批同一周、或同内容的两份文件，各写一行 `Verified_Income` | Phase P 报告 §0 #4；Node S3 / S4 | Node | 未修复；T1-b |
| P-5 | `160` 按 `income_id` 去重（先出现者胜），但 `consoleRebuildProjections_.totalVerifiedCount` 数的是原始行数 | Phase P 报告 §0 #5 | 源码 + Node S3 | 未修复 |
| P-6 | 「是否已存在」检查在调用方、在锁外、用调用方的旧快照；锁只包「校验栏位 + `appendRow`」；释放锁前不 `flush` | `140_VerifiedIncome.js:189–198`；`170_OperatorConsole.js:233–237`；`115_TruthWriter.js:31–46`、`:90–102` | 源码；真实 GAS 行为 **UNVERIFIED** | 未修复；T2。S1 的受保护追加是**新**代码路径，**不**修复这个 |
| P-7 | 同一周第二份内容不同的文件永远 `needsRetry`：每次 Batch 都重新处理（真实环境 = 每次再打一次 Gemini），并追加一行 `Reconciliation_Log` | Phase P 报告 §0 #7；Node S6 | Node | 未修复；T3（跟随 Phase P 设计的决定） |
| P-8 | 真实 Sheet 里**可能已有历史重复**（任何含 ≥ 2 份新文件的批次都会产生） | Phase P 报告 §6（只读核对公式，**从未在 Sheets 里运行过**） | 未知 | PENDING：你在**副本**上核对 |
| P-9 | `TruthWriter`「只追加」只是意图：契约测试只断言**存在** `appendValidatedRow`，没有断言「没有别的方法」 | `190_Tests_Contracts.js:42`；`116_Tests_TruthWriter.js:14–36` | 源码 | 未处理 |
| P-10 | `109_Tests_SheetSetup.js:25–28` 断言恰好 7 张表：把新表登记进 `buildSheetSchemas_()` 会让它失败 | 源码 | 源码 | S1 的零改动建表路线可以避开（D-S1-8） |
| P-11 | `150_ComplianceCalendar.js:72` 用 UTC 日期分量算天数，而项目时区是 `Asia/Singapore`：马来西亚时间每天 00:00 – 08:00 可能差一天 | `150:72`；`appsscript.json:2` | 源码 | 未处理（另案，D-14）；S1 自己的日期规则避开它 |
| P-12 | `106_Utils.js:12–14` 的 `round2_` 会**静默舍入** | 源码 | 源码 | S1 提议改为超过 2 位小数直接拒绝（D-S1-5） |
| P-13 | `MODULE_CATALOG.md:44` 对 `115` 写「Node PASS；真实 GAS 验证过」，没有逐项列出；`116_Tests_TruthWriter.js:60–61` 的「锁排队」人工项**未勾** | 源码 | 源码 | 建议改写，**未改**（PD-6 / A-5） |
| P-14 | 已设文本格式的列在真实 GAS 读回过原生 `Date`，根因**未查明** | `VERIFICATION_STATUS.md:100–107`（仓库既有记录） | 仓库记录；我没有独立验证 | UNVERIFIED → V6 |
| P-15 | 现有测试替身不能模拟读取失败，也不能模拟并发交错：`fakeSheetAccessor_.getAllRows` 永不抛错；`fakeLockProvider_` 没有互斥 | `105_TestUtils.js:27–38` | 源码 | S1 测试须自带失败注入 / 交错替身（Test Plan §2） |
| P-16 | 读 / 写路径**没有表头校验**：表头被改名但栏数不变，读不出来（表头只在建表 / 升级时比对） | `117_SheetReader.js:32–42`；`108_SheetSetup.js:140–148` | 源码 | S1 提议写入前预检（D-S1-12） |
| P-17 | **ADR 编号冲突**：索引说下一个是 ADR-007；Phase P 设计提案（10-17）也把它的 ADR 暂称 ADR-007 | 索引第 17 行；`PhaseP_Documents_Processing_State_Design_2026-10-17.md:33`、`:575–576`、`:586` | 源码 | PENDING（PD-1） |
| P-18 | repo 里有**两份** ADR 索引文件（em dash 版与 `#U2014` 版；内容目前一致） | `CHANGELOG.md:42` | 源码 | PENDING（PD-2） |
| P-19 | **UCR6 原文不在仓库**：`900_Constitution.js:204` 只说 CMP-CR 建立在 UEF 的 UCR1-7 之上；本窗口对 UCR6 的理解（「Sheet 写入唯一出口、只追加」）来自引用处（`115:3–5`、`901:132`、`MODULE_CATALOG.md:43`） | 同左 | UNVERIFIED | 待你提供 UCR 原文 |
| P-20 | 官方政策资料有 **10 项待人工抽查**；N1 – N10 是未找到 / 被阻挡 / 未说明 | `Official_Policy_Register_2026-10-23.md` §9、§N 表 | 官方页面经 WebFetch 转述，**不保证逐字** | PENDING（PD-4） |

---

## 4. 当前 implementation checkpoint

### 4.1 结论（先说）

**没有进行中的实现，也没有半成品。** 本窗口自始至终只做设计 / 调查 / 文档；10-21 信与 10-29 信都把范围限定在这里，我也没有越界。你 11-02 要求「暂停当前代码实现」，核对后的事实是：**当时没有代码实现在进行**。

### 4.2 实际改了哪些文件

**仓库内（`07.Compliance-main` 的 77 个文件）：0 个。**

| 证据 | 内容 |
|---|---|
| 逐文件 sha256 比对（2026-11-02 复跑） | zip ↔ `scratchpad/zip_new/07.Compliance-main`：77 / 77 相同；zip ↔ `scratchpad/phaseP_work/repo_copy`：77 / 77 相同；0 缺失、0 多出 |
| 附录 B.4 | 基线 77 个文件的 sha256 清单（可拿去和你的真实仓库比对，检测漂移） |

**本窗口创建的文件（全部在仓库之外；路径相对 `/home/claude/deliverables/`）**

| 文件 | 性质 | 最后修改（容器时钟） | 大小（字节） |
|---|---|---|---|
| `Official_Policy_Register_2026-10-23.md` | 官方政策登记表（调查；10 项待抽查） | 10-29 09:43 | 47,555 |
| `PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md` | Phase P 只读调查报告 | 10-23 05:54 | 24,585 |
| `Contribution_Planning_Design_2026-10-26.md` | 设计报告（7 表 / 129 列的起点设计；S1 部分已被 S1 最终设计取代） | 10-29 09:45 | 196,756 |
| `ADR_Drafts_Contribution_Planning_2026-10-26.md` | `ADR-DRAFT-CPR-1 … 5`（DRAFT / PROPOSED） | 10-28 06:24 | 62,564 |
| `S1_Final_Design_2026-10-31.md` | S1 最终设计（DESIGN ONLY） | 11-01 21:03 | 93,967 |
| `TruthWriter_Decision_Note_2026-10-31.md` | TruthWriter 决策说明（DESIGN ONLY） | 11-01 06:16 | 40,809 |
| `S1_Test_Plan_2026-10-31.md` | S1 测试计划（DESIGN ONLY；全部 NOT RUN） | 11-01 21:05 | 53,857 |
| `tooling/phaseP_dup/repro_dup.js`、`repro_dup.observed.txt`、`README.md` | Phase P 的 Node 内存复现脚本与观察输出（对仓库副本只读） | 10-23 05:51 – 05:54 | 16,119 / 5,571 / 1,905 |
| `governance_sync_2026-11-02/`：`ARCHITECTURE.md`、`CHANGELOG.md`、`DATA_OWNERSHIP.md`、`README-Architecture Decision Records — Index.md`、`VERIFICATION_STATUS.md`、`governance_sync_2026-11-02.patch` | 治理登记：5 个更新版（纯插入）+ 补丁 | 11-02 15:01 | 5,981 / 29,726 / 3,861 / 7,243 / 38,221 / 22,942 |
| `CHECKPOINT_HANDOFF_2026-11-02.md` | 本文件 | — | — |

### 4.3 做到哪里 / 哪里中断 / 为什么停在这里

- **做到**：S1 的**设计**已定稿（FD / DN / TP 三份）；治理登记（更新副本 + 补丁）已完成并机械验证；本 checkpoint 已完成。
- **哪里中断**：**没有实现被中断。** 唯一被打断过的是本 checkpoint 的撰写（期间上下文被压缩过，你的几次「继续」之间也隔了较长时间），现已完成；中间产物在 scratchpad，是临时文件。
- **停止点**：等你的决定（D-S1-1 / D-S1-3 / D-S1-9 等，§2.2）与独立授权（A-1 … A-9，§2.2.3）。**设计完整不等于实施授权**，所以我不会自己往下走。

### 4.4 下一步应该从哪里继续

→ **§5**。第一步不是写代码，而是核对真实仓库、合入治理补丁、拿到你的决定。

### 4.5 【设计建议】如果将来被授权实施 S1，设计里已经画好的依赖顺序（**不是授权，不要据此开工**）

这是我根据 FD §15 的授权项和 FD §9 / TP §13 推出来的依赖顺序，只是帮新窗口理解「哪一步需要哪一项授权」。

| 步 | 内容 | 前置授权 | 出处 |
|---|---|---|---|
| 1 | 回答 D-S1-1 / 3 / 9、D-S1-7（建表前）/ 8 / 12 / 13 / 14 / 15，并把答复**先登记进治理文件** | 无 | FD §13 |
| 2 | （若选方案 A）Freeze 例外获批后，在 `115_TruthWriter.js` 的 `createTruthWriter_` 返回对象里**新增**一个通用方法（暂定名 `appendGuarded`）；既有 `appendValidatedRow`、`gasLockProvider_`、单例、导出**一行不动**；约 30 – 50 行（**估计值，不是测量值**） | A-1 → A-2 | DN §9；FD §9.1、§9.6 |
| 3 | 新增 S1 文件：纯函数（`cprCanonicalizeAmount_` … `cprCoverageStatusOn_`）+ 边缘适配器（`cprReadTable_`、`cprPreflightHeader_`、`cprSubmit_`、`cprSubmitSequence_`、`cprTodayKl_`、`cprNowUtcIso_`、`cprComputeFileHash_`、`cprSetupSheets()`）。名字与文件编号**暂定**，按 File Map 规范在授权时决定；新文件里不得有与既有全局名重名的顶层函数（`195_Tests_GasLoadSimulation.js:96–111` 会检出）；测试文件名必须含 "Tests"（`:38–42`） | A-2 | FD §9.5 |
| 4 | Node 测试（L1 / L2）+ 变异检查 M1 – M12；结果只能写成「在 Node 模拟下……」 | A-2 | TP §1 – §12 |
| 5 | 真实 GAS 验证：在 Spreadsheet **副本**上做 V0 – V7、V10；你执行，我根据你贴回的日志判断 | A-3 | TP §11 |
| 6 | 建表：先在副本上做 V1，再在真实 Spreadsheet 上运行 `cprSetupSheets()` | A-4 | FD §15 |
| 7 | 治理文件正式同步：每个 V 项的**观察结果**逐项写进 `VERIFICATION_STATUS.md`（Code → Verify → Governance）；不再写笼统的「Node PASS；真实 GAS 验证过」 | A-5 | TP §1.1 |
| — | 录入入口（谁来点）**未设计** | A-8 | FD §14 |

---

## 5. 下一步准确操作（给新窗口）

**第 0 条：在你给出明确的 A-2（S1 实施授权）之前，不写任何代码。** 下面每一步都是文档 / 核对 / 提问。

| 步 | 操作 | 完成标准 |
|---|---|---|
| 1 | **读 §6 的 Tier 1 文件**，然后用一两句话向 Steven 复述当前状态（没有实现；S1 设计已交付；等决定与授权）。**不要重新调查、不要重新设计。** | Steven 确认复述无误 |
| 2 | **核对真实仓库是否仍等于基线**：请 Steven 提供真实仓库当前状态——最好整包 zip；至少要有 5 个治理文件、两份 ADR 索引、`115_TruthWriter.js`、`109_Tests_SheetSetup.js`、`MODULE_CATALOG.md`。用附录 B.4 的 77 个文件 sha256 逐个比对。**全部相同** → 补丁可直接应用。**有差异** → 先把差异清单交给 Steven；**不要**拿基线覆盖，也**不要**假设行号还对（本窗口所有行号都指向基线） | 得到「相同 / 差异清单」 |
| 3 | **合入治理补丁**（这是你 11-02 要求的「更新治理文件」）：在仓库根目录 `patch -p1 --dry-run < governance_sync_2026-11-02.patch`，通过后再去掉 `--dry-run` 应用（补丁标签以 tab 结尾，因为文件名含空格和 em dash）。若真实文件已漂移导致失败，就对照补丁把插入块**手工**合入——全部是纯插入，锚点见附录 C。合入后确认：`CHANGELOG.md` 里 2026-11-02 条目在 Phase N 条目之前；ADR 索引末尾有「草案（DRAFT，未编号；尚未批准）」一节。**这一步需要 Steven 同意放进真实仓库**，且仍然只是「仅文档的 Governance changes」 | `patch` 无 `.rej`；Steven 看过 diff |
| 4 | **向 Steven 要决定**（可以一次问完；选项在 §2.2）：① D-S1-1 ② D-S1-3 ③ D-S1-9 / DT-1（Freeze 例外）④ PD-1 / PD-2（ADR-007 归属、留哪份 ADR 索引）⑤ 其余 D-S1 默认值与 DT-2 / 3 / 4 逐项确认或修改 ⑥ 是否授权 A-7（给一份真实 SOCSO、一份真实 EPF 记录核对）、什么时候做 PD-4 的 10 项政策抽查。**把「默认」当成答复是错的**；每个答复都逐字记录 | 每项有 Steven 的明确答复，或被明确标为「仍未决」 |
| 5 | **先登记决定，再谈实现**：把 Steven 的答复同步写进（a）`S1_Final_Design` §13 的状态（或另起一份「决定记录」）；（b）ADR 索引的草案表——状态只能由 Steven 的**明确批准**改变，**编号由 Steven 指定**，我不分配；（c）`CHANGELOG.md` 新条目（类型 Governance changes，只记录决定本身）；（d）`ADR-DRAFT-CPR-1` 的表设计与写入原语措辞按 D-S1-9 修订 | 治理文件与 checkpoint 一致；没有「口头决定」 |
| 6 | **只有收到明确的 A-2 之后才写代码**。授权项互相独立：A-1 先于 A-2（若走方案 A）；建表要 A-4；真实 GAS 验证要 A-3；正式治理同步要 A-5。**不得**因为前一项被批准就默认后一项 | 每一步都有对应的授权原话 |
| 7 | **实施阶段的记录规则**：Code → Verify → Governance，反过来不行。状态词只随证据升级：PROPOSED → ACCEPTED 需要 Steven 批准；IMPLEMENTED / VERIFIED 需要对应证据；Node 通过只能写「Node 模拟通过」；不再写笼统的「真实 GAS 验证过」 | `VERIFICATION_STATUS.md` 逐项列观察结果 |
| 8 | **与 S1 无关、可以并行的独立工作**（谁做、何时做由 Steven 定）：PD-4 政策抽查（Steven 手工）；Phase P 修复（A-6，独立授权；先做 Phase P 报告 §6 的只读核对公式，**在副本上**）；PD-5 上一窗口遗留的 Phase N / O / P 待决项 | — |
| 9 | **每个窗口结束前**：更新本 checkpoint 的状态与待决，并同步治理文件——**不要只写在 checkpoint 里**（这是你 11-02 的要求） | 新 checkpoint 与治理文件一致 |

---

## 6. 新窗口必须先读取的文件

你说下一窗口「以这些持久化文件作为主要依据」。所以顺序是：**先读持久化的治理登记与本文件，再读设计文档，最后才读仓库源码。**

### Tier 1——开工前必读

| # | 文件 | 读哪里 | 为什么 |
|---|---|---|---|
| 1 | `CHECKPOINT_HANDOFF_2026-11-02.md`（本文件） | §0、§2、§3、§7、附录 A | 状态、决定、不要假设的事 |
| 2 | `governance_sync_2026-11-02/CHANGELOG.md` | 顶部 2026-11-02 条目（到「2026-10-11 — Phase N」之前） | **持久化的**已确认 / 提议 / 待决 / 未验证登记 |
| 3 | `governance_sync_2026-11-02/README-Architecture Decision Records — Index.md` | 末尾「草案（DRAFT，未编号；尚未批准）」一节 | **ADR Log**：`ADR-DRAFT-CPR-1 … 5` 的状态、ADR-007 冲突 |
| 4 | `S1_Final_Design_2026-10-31.md` | 头部 B-1 … B-9、§0、§1、§13、§14、§15 | S1 提议的形状、全部待决与授权 |
| 5 | 两封来信原文 | 附录 A（也可读原附件 `605f082a-attachment.txt`、`1c6d65f4-attachment.txt`） | **唯一已确认的决定** |
| 6 | `HANDOFF_MANIFEST_2026-10-18.md` | 全文 | 项目基线与 17 个 handoff 文件的指纹 |

### Tier 2——做具体决定 / 工作时读

| 场景 | 文件与位置 |
|---|---|
| 决定 D-S1-9 / DT-1 | `TruthWriter_Decision_Note_2026-10-31.md`：§0、§2（契约核对）、§3（存在性检查在锁外的调用路径）、§6（推荐与 G1 – G5）、§9（最小变更范围）、§12（DT-1 … 4，:287–290） |
| 测试 / 真实 GAS 验证 / 授权 A-3 | `S1_Test_Plan_2026-10-31.md`：§1（层级与声明规则）、§11（V0 – V10）、§13（通过标准、进入条件、待决事项对测试范围的影响） |
| ADR 工作 | `ADR_Drafts_Contribution_Planning_2026-10-26.md`：§0、§6（批准之后才应用的治理更新提案——**没有应用**） |
| 任何政策数值 | `Official_Policy_Register_2026-10-23.md`：§9（10 项抽查）、N1 – N10 表；**未抽查前不得固化任何数值** |
| Phase P | `PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md`：§0、§5（最小复现条件）、§6（只读核对公式）、§7（修复分层与迁移风险）；`tooling/phaseP_dup/` |
| S1 之外的切片（Tax / Grab / EPF 激励 / 日历） | `Contribution_Planning_Design_2026-10-26.md`——**注意：其中 S1 部分已被 S1 最终设计取代（提议层面）**，D-1 … D-18 已映射到 D-S1（FD §13.2） |
| 验证状态 | `governance_sync_2026-11-02/VERIFICATION_STATUS.md` 末尾「Contribution Planning」一节 |

### Tier 3——仓库内；动手前必读（先确认它们等于基线，见 §5 第 2 步）

- **治理**：`900_Constitution.js`（`changelog` 数组）、`ARCHITECTURE.md`、`DATA_OWNERSHIP.md`、`MODULE_CATALOG.md`、`VERIFICATION_STATUS.md`、`CHANGELOG.md`、ADR-000 … 006、两份 ADR 索引、`compliance-os-governance-draft.md`（File Map；Freeze 条款 :420）。
- **代码（只读；只有 S1 被授权才会触及）**：`115_TruthWriter.js`、`117_SheetReader.js`、`108_SheetSetup.js`、`109_Tests_SheetSetup.js`、`105_TestUtils.js`、`106_Utils.js`、`190_Tests_Contracts.js`、`195_Tests_GasLoadSimulation.js`、`110_DocumentImport.js`（`computeFileHash_`）。

---

## 7. 不要重复做的事情 / 不要假设的事情

### 7.1 不要重复做

| # | 不要 | 因为 |
|---|---|---|
| R-1 | 不要重新设计 S1、重新做政策调查、重新做 Phase P 调查 | 已交付；除非 Steven 明确要求修改 |
| R-2 | 不要再去抓官方 Lock 文档 / 被 robots 挡住的页面来「绕过」 | 被拒就是被拒（`PROVENANCE_REQUIRED`、`robots_disallowed`）；改走 V3 – V5 由你在副本上实测 |
| R-3 | 不要重新生成治理补丁，**除非基线变了** | 补丁是对 10-21 基线的纯插入；若真实文件已漂移，改为对照补丁手工合入 |
| R-4 | 不要再做「zip ↔ 副本」比对，**除非 Steven 上传了新的仓库** | 2026-11-02 已复跑，77 / 77 相同 |
| R-5 | 不要跑与本 Slice 无关的全量回归 | 10-21 信 §7 明确禁止；Test Plan F4：本轮未做，也不会声称「回归通过」 |
| R-6 | 不要重写 checkpoint | 追加更新；保留 §2 与附录 A |
| R-7 | 不要把已经登记的 PENDING 项再当新问题重新发现 | 它们在 §2.2 / §3.7 / CHANGELOG 里 |
| R-8 | 不要重新核对 S1 文档的 `文件:行` 引用 | 已对基线核对（V-2）；要核对的是**你的真实仓库**是否仍是基线 |
| R-9 | 不要在没有 Steven 要求时重发 §4.2 的七份设计文档 | 附录 B 给了指纹；他的副本 hash 不同才重发 |

### 7.2 不要假设

| # | 不要假设 | 事实 |
|---|---|---|
| X-1 | 任何 D-S1 / DT / D-1 … D-18 的「默认」已被批准 | 都是 PENDING；**不回答不构成同意** |
| X-2 | 「设计完整」等于「获得实施授权」 | 来信明说不是；A-1 … A-9 都未授权 |
| X-3 | Node 通过 = 真实 GAS 验证 | 不是；`fakeLockProvider_` 没有互斥；只能说「Node 模拟通过」 |
| X-4 | 你的真实仓库 = 10-21 基线 | 不知道（B-6）；先比对 |
| X-5 | 治理补丁已经合入你的真实仓库 | **没有**；只存在于 `governance_sync_2026-11-02/` |
| X-6 | ADR 编号 | 不要分配；ADR-007 有冲突（PD-1）；草案用 `ADR-DRAFT-CPR-n` |
| X-7 | 哪份 ADR 索引是正本 | 不知道（PD-2）；本次只更新了 em dash 那份 |
| X-8 | 政策数值（i-Saraan Plus 的比例 / 上限、SOCSO 费率、CP500 宽限期等） | 登记表里是「官方证实（待抽查）」或 PENDING / LEAD；**不得写进代码或设计**；S1 不含任何政策数值 |
| X-9 | SOCSO 覆盖期按自然月，或可以推断结束日期 | 来信明确禁止；终点未知就是未知（`START_ONLY`） |
| X-10 | CP500 金额 | 没有正式通知书就不能有 |
| X-11 | 用户断言 = 官方事实 | 不自动升级 |
| X-12 | `MODULE_CATALOG.md:44` 的「真实 GAS 验证过」覆盖了锁语义 | 没有逐项列出；`116:60–61` 的「锁排队」人工项未勾 |
| X-13 | 现有 `appendValidatedRow` 有幂等保护 | 没有：存在性检查在调用方、在锁外、用旧快照（P-6） |
| X-14 | `buildSheetSchemas_()` 可以随便加表 | `109:25–28` 断言恰好 7 张（P-10） |
| X-15 | 会话记录是完整的 | 只保留 11-01 21:02 之后；更早靠磁盘文件重建（§1.5） |
| X-16 | scratchpad 里的文件还在 | 临时文件；依赖它们的东西都已复制到交付目录或写进本文件 |
| X-17 | 我在聊天里的口头建议是「决定」 | 只有来信明文才是已确认（§2.1） |
| X-18 | 真实 Sheet 没有历史重复 | 未知（P-8）；先在**副本**上跑 Phase P 报告 §6 的只读公式 |
| X-19 | 「Phase P 修复」可以顺手并进 S1 | 来信明确排除；A-6 独立授权 |
| X-20 | 前一个 `PROPOSED` 的 ADR 因为「大家都同意」就算 ACCEPTED | 只有 Steven 的明确批准才改状态 |

---

## 附录 A：原文（持久化；新窗口可能拿不到原附件）

下面三段是**逐字原文**：A.1 由本脚本内嵌（来自你 11-02 06:50 的消息），A.2、A.3 由脚本直接从附件文件读入，没有经过我的转写。

### A.1 你 2026-11-02 06:50（KL）的指示

```text
请立即暂停当前代码实现，不要继续 coding。

请从头重新检查本窗口的全部讨论、决定、代码修改、测试、发现的问题和未完成事项，并对照当前实际 repository/file state 做一次完整核对。

请重点区分：

- 已完成且已验证
- 已实现但未验证
- 正在进行
- 尚未实现
- 未解决
- 已被后续决定取代

特别记录当前做到一半的 implementation：实际改了哪些文件、做到哪里、哪里中断、下一步应该从哪里继续。不要假设“讨论过”就等于“已经实现或验证”。

另外，凡是本窗口已经形成、确认或需要持久化的治理/架构/工程决定，必须同步写入对应的 Governance 文件和 ADR Log；不要只写在 checkpoint 里。对于尚未最终确定的事项，不要伪装成已批准决定，应明确标记为 pending/proposed。

然后把完整结果保存成可下载的 checkpoint/handoff 文件，至少包含：

1. 当前项目状态
2. 本窗口重要决定
3. 已完成/未完成/blocked 项目
4. 当前 implementation checkpoint
5. 下一步准确操作
6. 新窗口必须先读取的文件
7. 不要重复做的事情 / 不要假设的事情

完成 checkpoint、Governance/ADR 持久化及核对后就停止，不要继续 coding。

我们下一窗口会以这些持久化文件作为主要依据继续工作以及需要更新治理文件
```

随后 11-02 14:59、11-03 05:58 你各回复了一次「继续」。

### A.2 2026-10-21 授权信（附件 `605f082a-attachment.txt`，302 行；D1 – D6 在第 38 – 120 行）

```text
Compliance OS — Contribution Planning & Official Payment Records Architecture

0. 本轮授权

用户已明确批准以下业务范围：

- EPF：供款预算计划、实际供款记录、政府激励的计划与实际状态追踪。
- Tax：正式税务分期计划、实际缴税记录、计划与实际对照。
- SOCSO：缴费预算、实际缴费记录、精确覆盖期间、Grab 报销记录与对照。
- 三类记录均采用手动录入，并支持附上收据或正式文件引用。
- 第一阶段不实现 EPF 或 Tax 计算器。
- 第一阶段不实现 PDF 自动解析或 LLM 自动提取。

本轮只授权架构分析、规则调查、设计文档和 ADR 草案。

不授权任何代码修改、测试文件修改、Schema 实施、GAS 写入或部署。

1. 开始前的只读检查

先阅读当前工作副本中的：

- 最新 handoff。
- "00_Constitution"、ADR、Project State、File Map、Review History。
- "VERIFICATION_STATUS" 或对应验证记录。
- "160_MonthlyProjection.js"。
- "170_OperatorConsole.js"、"170_OperatorConsole.html"。
- "150_ComplianceCalendar.js"。
- 现有 Official Record、Document Import、Truth Writer、数据验证和审计机制。
- Phase P 调查报告及相关测试。
- 与 EPF、Tax、SOCSO 有关的现有设计和数据。

先确认项目已有的数据模型和治理规则。

不得因为本轮设计需要而直接创建新表或修改现有代码。

2. 业务决定

D1 — 总体范围

已批准：

Budget Plan + Actual Official Payment/Contribution Records + Comparison。

本阶段不做 EPF / Tax 计算器。

D2 — 记录类别

范围仅限：

- EPF contribution。
- Tax instalment/payment。
- SOCSO contribution。

个人贷款、信用卡还款及其他一般负债不属于本 Slice。

D3 — SOCSO

已知业务情况：

- 用户自行缴费。
- Grab 尚未实现自动扣缴。
- 用户可以选择不同缴费周期，一次缴纳多个月。
- 覆盖期间必须精确到日。
- Grab 报销必须独立记录，不得默认缴费即代表报销完成。

设计必须明确区分：

1. 实际付款日期。
2. 覆盖开始日期。
3. 覆盖结束日期。
4. 实际缴费金额。
5. Grab 报销申请、批准或到账等实际状态。
6. 缴费与报销对应关系。

不要假设覆盖期间一定按自然月划分。

不得自行推断正式保险保障规则。

D4 — EPF

用户尚未登记 i-Saraan Plus，供款金额未决定。

设计应支持：

- 登记状态及其来源证据。
- 政府激励规则的版本和生效日期。
- 不同供款方案的预算比较。
- 预计供款与实际供款的分离。
- 预计激励与已确认激励的分离。
- 实际供款凭证和官方记录引用。

政府激励的资格、计算方式、上限和条件必须通过官方资料核实。

不得把未经核实的政策数字写死在系统中。

第一阶段不实现正式供款计算器，但可以设计未来预算比较所需的数据模型与规则接口。

D5 — Tax

用户尚未收到 CP500，也不确定第一个有营业收入的 YA。

设计必须支持：

- 尚未收到通知书的状态。
- 正式 CP500 通知书及其来源引用。
- 通知书中的分期金额、到期日及适用年度。
- 实际付款与凭证。
- 计划和实际的差异对照。

没有正式通知书时，不得生成虚构的 CP500 金额。

税额估算、收入归属和跨年税务计算不属于本阶段。

D6 — 数据录入

第一阶段使用手动录入和正式文件引用。

PDF 自动解析、OCR、LLM 提取属于后续独立阶段。

所有正式记录必须经过确定性验证。LLM 不得直接写入 Truth。

3. 架构设计要求

A. 计划与实际记录分离

研究并设计以下逻辑实体：

1. Contribution/Tax Payment Plan。
2. Actual Official Payment Record。
3. Reimbursement Record（适用于 SOCSO）。
4. 计划与实际的查询时对照结果。
5. 相关证据与正式文件引用。

优先复用现有架构。如果已有实体可以满足要求，不要重复建立功能相同的新表。

计划与实际事实必须分离。

如果采用 append-only 设计，必须明确说明如何处理计划调整、取消、付款更正和重复提交。

不得覆盖历史正式记录。

B. 对照机制

定义以下状态的准确含义及转换规则：

- Not_Planned。
- Planned。
- Partially_Paid。
- Paid。
- Overdue。
- Overpaid。
- Discrepancy_Flagged。
- Not_Applicable。

这些只是候选名称，必须检查现有枚举和治理规范后再决定采用哪些状态。

对照结果原则上在查询时确定性计算，不得把旧的对照快照误当成当前事实。

必须明确：

- 如何处理部分缴费。
- 如何处理一次付款覆盖多个期间。
- 如何处理一笔计划对应多笔付款。
- 如何处理一笔付款对应多个计划。
- 如何处理退款、重复付款和更正。
- 如何避免同一张收据被重复登记。

SOCSO 必须支持精确到日的覆盖期间。

EPF 与 Tax 不得被强制套用 SOCSO 的保障期间模型。

C. 幂等和审计

设计必须说明：

- 稳定的业务身份。
- 重复提交保护。
- 来源文件引用。
- 更正和补偿记录。
- 审计历史。
- Truth Writer 的使用方式。
- 失败恢复策略。

不得直接使用不稳定的时间戳作为唯一业务身份。

不得因为一次写入失败而留下无法识别的重复正式记录。

D. Compliance Calendar

研究如何将正式到期日接入现有 Compliance Calendar。

不要建立第二套提醒系统。

计划变更、正式通知更新或付款完成后，日历应如何更新，必须符合现有架构和事件规则。

本轮只设计，不实施。

4. 官方政策核实

使用官方来源核实与本阶段直接有关的政策。

优先来源：

- EPF / KWSP 官方网站及官方文件。
- LHDN 官方网站及 CP500 正式资料。
- PERKESO / SOCSO 官方网站及正式文件。
- 与 Grab 报销直接有关的用户正式对账单或相关正式文件。

每条政策至少记录：

- 官方来源名称。
- 文件或页面标题。
- 可访问的来源位置。
- 发布或生效日期（如有）。
- 适用年度或资格条件。
- 尚未确认的事项。

第三方文章只能作为寻找官方资料的线索，不能单独成为硬编码政策的依据。

如果官方资料无法确认某项规则，标记 PENDING，并设计为可配置规则，不要猜测。

5. Phase P 重复 Verified_Income 风险：独立只读调查

这是与新缴费功能分开的工作流。

检查 Phase P 报告，重点调查：

1. §4.1 的 "document_id" 重复情况。
2. 批次内快照失效导致重复写入 "Verified_Income" 的具体路径。
3. 现有幂等检查的身份范围和有效期。
4. 重复写入可能影响的下游模块。
5. 能够重现问题的最小测试条件。
6. 是否可能出现历史重复记录。
7. 最小修复方案、回归测试和潜在迁移风险。

本轮只读调查。

即使找到明确根因，也不修改代码、不删除记录、不进行数据迁移。

最终提供单独的调查报告及建议修复范围，等待用户后续授权。

不得将 Phase P 修复混入 EPF、Tax、SOCSO 的新功能实现。

6. ADR 与交付物

建议提交：

1. 现有架构与新需求的差距分析。
2. 数据模型设计。
3. 计划与实际对照规则。
4. 幂等、审计和更正机制设计。
5. SOCSO 覆盖期间及 Grab 报销模型。
6. EPF 激励规则的可配置设计。
7. Tax 正式分期记录设计。
8. Compliance Calendar 集成方案。
9. 测试计划。
10. 真实 GAS 验证计划。
11. Phase P 重复写入只读调查报告。
12. 新 ADR 草案及需要用户决定的事项。

ADR 应遵守项目现有的编号、状态、批准流程及 File Map 规范。

如果无法确认下一个 ADR 编号，不要猜测或覆盖现有 ADR；先在报告中说明。

本轮只生成设计文档和 ADR 草案，不修改已批准的治理文件。

7. 明确禁止

- 不修改生产代码。
- 不修改测试代码。
- 不修改真实数据。
- 不写入真实 GAS。
- 不部署。
- 不调用真实 Gemini。
- 不实现 PDF/LLM 自动提取。
- 不实现 EPF/Tax 计算器。
- 不实现个人贷款或信用卡还款。
- 不擅自修复 Phase P。
- 不重跑无关的 Compliance OS 全量回归。
- 不制作 ZIP 或 reconciled ZIP。
- 不把 Node 测试结果当成真实环境验证。
- 不扩大到其他 OS。

8. 最终报告

使用中文，明确区分：

- 已由源码证实。
- 已由官方政策证实。
- 仅为设计建议。
- 尚待用户确认。
- BLOCKED。
- PENDING。

最后给出：

1. 建议批准的最小架构 Slice。
2. 尚需用户决定的事项。
3. Phase P 的独立修复建议。
4. 下一阶段可单独授权的实现范围。

完成后停止，等待用户下一步指示。
```

### A.3 2026-10-29 S1 收敛信（附件 `1c6d65f4-attachment.txt`，148 行）

```text
Compliance OS — S1 Final Design 收敛任务

1. 本轮目标

基于现有 Compliance OS 项目、上一轮的设计报告和已确认的用户决策，完成以下 3 份交付物：

1. "S1_Final_Design"
2. "TruthWriter_Decision_Note"
3. "S1_Test_Plan"

本轮只做设计、只读检查和文档交付，不进入实施阶段。

2. 必须遵守的边界

- 不修改任何现有业务代码、测试代码、治理文件或正式配置。
- 不新增 Sheet，不运行真实 GAS，不调用 Gemini，不访问或修改生产数据。
- 不部署、不执行迁移、不创建或修改真实记录。
- 不实施 Phase P 的 "Verified_Income" 重复风险修复。
- 不把 Node / fake GAS 测试描述成真实 GAS 验证。
- 不将尚未核实的官方政策当成已确认事实。
- 不自行分配正式 ADR 编号；未获批准的 ADR 继续标记为 DRAFT。
- 不扩大已批准的业务范围。

如遇到缺失文件、证据不足、权限限制或相互矛盾的契约，明确标记 "BLOCKED" 或 "UNVERIFIED"，不得自行推断后继续。

3. S1 范围

目标是建立最小化的 Official Contribution Record Core，暂定以下 5 张表：

1. "Official_Evidence"
2. 来源明确、可追溯的用户状态／政策事实断言表
3. "Contribution_Plan_Lines"
4. "Official_Payments"
5. "Payment_Links"

具体表名、字段、主键、关联键及 88 列方案必须以现有设计证据为基础重新核对。若无法证明某张表或某字段属于 S1 必需范围，列入后续阶段，不要为了凑齐 88 列而保留。

S1 当前业务范围仅限：

- SOCSO 自雇人士缴款记录
- EPF 缴款记录
- 预算计划与实际官方缴款的可追溯比较
- SOCSO 保障期间的精确日期记录，未知的结束日期不得推断

不纳入本轮实施范围：

- Tax / CP500 完整流程
- EPF 激励政策的自动计算或资格判定
- Grab 报销自动化
- Calendar 集成
- PDF / LLM 自动导入
- Phase P 重复收入修复
- 其他债务或信用卡还款

4. 设计必须回答的问题

A. 数据模型

对每张表说明：

- 业务目的
- 每一列的名称、类型、必填性、允许值
- 主键及关联键
- 来源与证据关系
- 重复记录识别规则
- 历史修正方式
- 查询失败与确实不存在记录的区别

明确区分：

- 官方文件记载的事实
- 用户主动申报的事实
- 系统计算结果
- 尚未核实的政策信息

不得将用户断言自动升级为已核实的官方事实。

B. TruthWriter 写入边界

以现有 "115_TruthWriter.js" 为主要审查对象，比较：

- 方案 A：在受控写入边界内提供幂等追加能力。
- 方案 B：外层持锁、内部复用现有写入函数。

不得在未核对现有锁、校验、追加和失败处理契约之前直接选定方案。

必须分析：

- 幂等检查与追加是否处于同一个并发保护范围
- 重试会不会产生重复记录
- 部分失败如何识别和恢复
- 是否保留历史，不覆盖原始事实
- 如何区分记录不存在与读取失败
- 是否会绕过 TruthWriter 的既有校验或治理规则

给出推荐方案、证据、风险、尚待确认事项及最小变更范围。

C. S1 测试设计

至少覆盖：

- 正常追加
- 相同请求重复提交
- 不同请求引用同一证据
- 缺少证据或来源
- 金额超过两位小数
- 无效日期及未知保障结束日期
- 关联记录不存在
- 查询失败
- 写入中途失败及安全重试
- 并发重复提交
- 历史修正与审计追溯
- 现有测试契约回归，特别是 "109_Tests_SheetSetup.js" 对现有表数量的断言

每个场景标明测试层级：静态检查、Node 模拟、真实 GAS 或人工验证。

不得声称本轮已执行尚未执行的测试。

5. 已知风险必须保留

- "TruthWriter" 的追加意图不等于其所有不变量已被测试强制保证。
- 现有存在性检查可能在锁外执行；必须核对具体调用路径。
- 时间戳不应未经分析就充当官方记录的稳定身份。
- Malaysia 日期与 UTC 日期边界可能导致日期错误。
- "109_Tests_SheetSetup.js" 当前断言 7 张表，新增表可能使旧测试失败。
- 官方政策资料仍有待独立核验的项目，不得在设计中固化未经确认的资格、金额或生效日期。

6. 交付要求

只交付上述 3 份文件。

每份文件开头注明：

- 状态："DESIGN ONLY"
- 本轮是否修改代码："NO"
- 是否运行真实 GAS："NO"
- 是否部署："NO"
- 尚未解决的阻塞事项

同时提供：

- 证据来源及精确文件／行号
- 设计决定与事实证据的区分
- 尚待用户决定的事项
- 不在本轮范围内的内容
- 下一阶段所需的独立授权

三份文件完成后停止，不自行开始实施，也不要因为设计方案已完整就视为获得实施授权。
```

---

## 附录 B：指纹（SHA-256）

用途：①你手上的副本 hash 与这里不同，说明版本不同，告诉我，我重发；②新窗口用 B.4 检测你的真实仓库相对基线的漂移。**本文件自身的 hash 不在这里**（自引用）。

### B.1 输入

| 文件 | 字节 | sha256 |
|---|---|---|
| `07.Compliance-main.zip`（上传名 `9f8eb5a3-07.Compliance-main.zip`；基线） | 579174 | 2c52e947f8f0e76a5ebcb678bac54f968de124256b31fd564f655f65c96c5695 |
| `HANDOFF_MANIFEST_2026-10-18.md` | 22442 | f7390940dda56fda1579827e0becae12cb620610fa2c17c78acf31e9a1e4e88c |
| `605f082a-attachment.txt`（10-21 授权信） | 8928 | 29bbeca341fcaf37bebc10008345e0f0d2869cb4fa0ad2e632555b73935fbbbf |
| `1c6d65f4-attachment.txt`（10-29 S1 收敛信） | 4851 | 6a0b9d7df9129651f3928ccbac0ef88114e68b3b3f5dd7c875c0314df50a2e2d |

### B.2 本窗口的设计交付物（`/home/claude/deliverables/`）

| 文件 | 字节 | sha256 |
|---|---|---|
| `Official_Policy_Register_2026-10-23.md` | 47555 | 7b138fd1aa9ffb8ac912ad10929b8d3df2249a3c9a19f51d20717a816f6a8869 |
| `PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md` | 24585 | ddd0cc648ad18e4130daca33a1ed13db04a6f06d57ab2e8dd24b1ec96547b6f7 |
| `Contribution_Planning_Design_2026-10-26.md` | 196756 | dff20cb6d72760f12f1d876077caacb7173cc0310831bee3f8cd021d87351bd4 |
| `ADR_Drafts_Contribution_Planning_2026-10-26.md` | 62564 | 1d48c6d6e2b1b19538c32e8bee381242d2cf7ce9ac7e55f8c006006c0ce1fafd |
| `S1_Final_Design_2026-10-31.md` | 93967 | 76a3f362c85a889184806d18077ac4b14b54804778cc081ae0adc98411d342e6 |
| `TruthWriter_Decision_Note_2026-10-31.md` | 40809 | b629a85cdefaa4190f58d026bb038192bb6b9f6f224768c84677c5cf8e01289f |
| `S1_Test_Plan_2026-10-31.md` | 53857 | bb461e31320d0dba14f9ef632406e5d44a89c433c987ab8a1b35f2d4aed86fd9 |
| `tooling/phaseP_dup/repro_dup.js` | 16119 | 61f8e5cc94bed4a08fecd8a72cd5624d2c15b4d26748603ed5f5df245ec8e195 |
| `tooling/phaseP_dup/repro_dup.observed.txt` | 5571 | fcb60c0956ef15a0fa8baf63e32d3a29b95a678a486c99933fe51e0c9c54af12 |
| `tooling/phaseP_dup/README.md` | 1905 | 571ba3612d5156123a01c2c7c57e703eea8c8527b7af960b60a993888739d9a4 |

> 前四份（政策登记表、Phase P 调查、设计报告、ADR 草案）：我无法证明你收到的是哪个版本（§1.5）。S1 三份是 11-01 的最终版。

### B.2b 治理同步（`governance_sync_2026-11-02/`）

| 文件 | 字节 | sha256 |
|---|---|---|
| `governance_sync_2026-11-02/ARCHITECTURE.md` | 5981 | 0e28f6f4dedc9d993d92252712673db41fd145087f06d7204f1a61ec9dff2dd8 |
| `governance_sync_2026-11-02/CHANGELOG.md` | 29726 | 878e640e041630e4d503f73f4b06c02c1ff768506b96667db89cd693e462730e |
| `governance_sync_2026-11-02/DATA_OWNERSHIP.md` | 3861 | 2747da0e813139cbb774fb8fe7dd80ac94b103df952f99c49dd271f58f1124e9 |
| `governance_sync_2026-11-02/README-Architecture Decision Records — Index.md` | 7243 | 341551be1bde4670cb4c3049cce4cbdec2818e2c535ff029d0a1c8a74837c3d2 |
| `governance_sync_2026-11-02/VERIFICATION_STATUS.md` | 38221 | 8b9434d619f7a6874a50bbc3c10e9a62d81d5ffdb6704c5f7026d16801eb5bd5 |
| `governance_sync_2026-11-02/governance_sync_2026-11-02.patch` | 22942 | 95648894654cb3f51eb49062a503a54452ce2003f57996ce1e6b01f00e37cc56 |

### B.3 五个治理文件：基线版 → 更新版

| 文件 | 基线字节 | 基线 sha256 | 更新版字节 | 更新版 sha256 |
|---|---|---|---|---|
| `ARCHITECTURE.md` | 4985 | 4041c533a32dd1c40a187ef94cc32460ef83a2bdce210985544814a6c20e4283 | 5981 | 0e28f6f4dedc9d993d92252712673db41fd145087f06d7204f1a61ec9dff2dd8 |
| `CHANGELOG.md` | 18524 | 7c3bbb0a3f51950d9b0cb1bcb93df12ddb98c396079e96e052964674b55eaa2a | 29726 | 878e640e041630e4d503f73f4b06c02c1ff768506b96667db89cd693e462730e |
| `DATA_OWNERSHIP.md` | 2292 | 2d0962b1c2343dcffe5e4b21f80b92f3cf4102b4e8772ca98e91a3f9509e195e | 3861 | 2747da0e813139cbb774fb8fe7dd80ac94b103df952f99c49dd271f58f1124e9 |
| `README-Architecture Decision Records — Index.md` | 3340 | bc32a3b930246e63ffb8a639e6b50e1d45af33b94d0f5ce0404a688588c84910 | 7243 | 341551be1bde4670cb4c3049cce4cbdec2818e2c535ff029d0a1c8a74837c3d2 |
| `VERIFICATION_STATUS.md` | 35545 | 585070443ed6c8448853da69195c8b986f145b83ac2a8fb77257d1d36ddaa5bd | 38221 | 8b9434d619f7a6874a50bbc3c10e9a62d81d5ffdb6704c5f7026d16801eb5bd5 |

### B.4 基线 77 个文件的 sha256（`sha256sum -c` 格式；检测仓库漂移）

用法：把下面整块存成 `baseline.sha256`，在**你的真实仓库根目录**运行 `sha256sum -c baseline.sha256`（`FAILED` = 与基线不同；`No such file` = 基线有而你这里没有）。**另外**用 `ls -A` 看有没有基线里没有的新文件。名字里有空格和 em dash 的文件，`sha256sum -c` 能处理。

```text
2830a35f0b7e6e1d6e64782c26123fe7d41836566f9e2f3c8997ed894cba56f2  .clasp.json
e3d5c0c505d90199bfd5652ae6f6dc7a8a14691f6840122fa6e6a9fe351b23e7  .claspignore
a50bac1e11ac9f0cea239121c4990e8361740d384d69e486dec46ff7d9f69961  105_TestUtils.js
65420a78ca9ec89c5090e7c3774d5c9641c17798b1c8671e190a8de1646eb127  106_Utils.js
452c9da5a34bd81e89642db472caf20f5e82aa2d7b743f8d813e67d3cffd8b06  108_SheetSetup.js
b3cec87a6638585fd0aced395f4d46547bddf131dc72c8ac3d43f105bb0328b8  109_Tests_SheetSetup.js
fc95693e3e1f2a1ee2d27f02d5f585033d7b1fafcda7cb22471ebf7502b953d6  110_DocumentImport.js
bb5efebef3723a76222c1207c87c5dbdb47bf8e3c4713ad773e8025c4dabb5db  111_Tests_DocumentImport.js
2e98cc78283d03216a25ee3a99ec4b5eb114ad9f3e22e3b690f1d3243ea956c0  112_DocumentTextExtractor.js
16f5d25c37a6a988060d249a9eccd6207cdfa3ef0c904b7eb7d8d079f712687b  113_Tests_DocumentTextExtractor.js
f7c30cf2e3c4779b6e1d01bc30b41f067717fa5141e26158a89994e1f205bc15  115_TruthWriter.js
89d0db85cbecfae719f48b66927ae3fac90d214469f919d903e4c848798cf2a1  116_Tests_TruthWriter.js
2ed4b9db692bb46e7c398796e7d70535c41b38b56e5db411a95d91a8d66d4b5c  117_SheetReader.js
7e7c041b3b74505816e52f6510b84e8b3ba504860cc76507f18fa6fbfe371fef  118_Tests_SheetReader.js
47cdbc13fdea5e22427cd285580795cca5a0533964a905c05fb67419385bfe51  120_DocumentParsing.js
e0af632ad34f6936a28cf46ddf1880b4e5bc870dd9df43e3f68d7deb13fa2e3b  121_GrabWeeklyParser.js
9c0b3e40d466ad59ea16914b6e386e89d000c055315845885896ce5efc47e0d9  122_Tests_GrabWeeklyParser.js
3ed92db4435afec9b5eb90bc30cfddce677f7a92b90119ee4ae7f74f4e287eea  123_RiderOSAdapter.js
d82e9f38fdeecb5ee5d5f81f420a574fee417ae1c8d3220f5d13d5a00b56cdb6  124_Tests_RiderOSAdapter.js
73189f878f39a8313180d3e6c2cf7c7f0acb06b22033b29fa8ee145a23495d81  125_ExtractionValidation.js
35d305c1325b22b878577d3be8fe9f52c5908464135367fa2c381c74904c4540  126_Tests_ExtractionValidation.js
20ea8f172bd193ef06ebdbe943d8c4994b5e2c5691201fde1c4c6d4d72ee8720  127_LLMExtractor.js
b6ffa448d2c0cf88ea745840f9820636746087c937b7a8297bba8964803c7f67  128_Tests_LLMExtractor.js
4f5b2d6b42a1f7f783bcb6ffe8704c3cc4ca7d7d86521ae34b782bbd55dd3303  130_Reconciliation.js
5ab5f8e2477195df50ade36abdbe8c3b10e6e4d7e90201b1308d2ac6c22ead03  131_Tests_Reconciliation.js
1b10883a0a2a0ff389838aaebeb1be4780a9062e63c96ca1665664b416dd60c4  140_VerifiedIncome.js
cb8e42f75f2bc9afb9fd099bbd96dd3a53a778e2e21be24f8c34c4aeb14d3845  141_Tests_VerifiedIncome.js
666d7521a27185933746749e0d1a08457b4a4c87cb42852d1bb11499573583bf  142_DailyOrderAllocation.js
2ee54e756c1febd50e6b55df3c4129e694333ecd23018c40269dc422f8807279  143_Tests_DailyOrderAllocation.js
980e8cee8b9dcda9b989cbb7379cb837b79c95a0d6ccdfeb4a96b08f4760441b  150_ComplianceCalendar.js
68386f449e40ca0c0b76f1f7e8d380bb940fd3628f5132c85bb001471890f30c  151_Tests_ComplianceCalendar.js
196992b0567401663152ceb11bd81c759b9b8cb966e80ac8968606afca403684  160_MonthlyProjection.js
3eeebe38e4d84ef6b3a7dac30494ea95aef325275383e09346120255f99c513c  161_Tests_MonthlyProjection.js
9917ef64aa373fc21b4e237c62a32dd32a662c0e4feb4fdea94f7b8e0250d9e6  170_OperatorConsole.html
35392f7d0886aba80f36dc33bdf5baa8157b7b057d1c005894635e1b94fdbeb8  170_OperatorConsole.js
30bcd7cbb85e4313e00da321dda9aeb5a11e21cdd6129e0c75970b1a3b4c6eec  171_Tests_OperatorConsole.js
c5763d36c5c94529417ddbdc002be0774e4ba043c1d32b8f0175cb49d8b6845f  190_Tests_Contracts.js
a9cbde0d33095ec87ee26a3b7ebf105433263fcc875437c39e76c497ac04186a  195_Tests_GasLoadSimulation.js
bd51f8529335b9a7d9be897646e6fb137e90ef804b34cf9693a99e874049ee2b  900_Constitution.js
53a62906da16e4fd59e2a389e3eb6eb241dd51d8cdce48a8e85efb00afbf280a  901_System_Architecture.js
003999d0a86b0e6be116851b89ebb67ab47e42f85f4534232a4224ed1e093570  999_LatencyReliabilityObservation.js
c8f7bbcc987d8a8462afa74c8647ae0a6cd0f7c43d72fd13c60fefd589873ae5  999_PersistenceVerification.js
3311b885068e430d2dfdd93b76687943d490a3d8dea315a150dde9df2dd06b11  999_PhaseB_Baseline.js
50eec07d621935df7694da8347baadd8de4535a9e91eead1226fb7904f086740  999_PhaseB_Baseline_v4.js
00eee0955cf06589bbfa40cf533a7b5ba086dd1cd1ac20a877f36bf1c894afb1  ADR-000-independent-project.md
bf0adbed9e36fa61c72c94a6697b53b35dbac61135ed7642f410bb2758fbb820  ADR-001-rider-os-adapter.md
37bca642f23832c50a3c360272ac13640a58fc6cae7e18ae1d705cb8e7edd8c9  ADR-002-official-truth-principle.md
8b2c53ff01d3aa64475f40fa218b8cb24fccf094c8470ea2429b0a769404a180  ADR-003-reconciliation-decoupled.md
6e65312728ab36f43920268d721614d6278b12aa3ce4601ceb438db23ad149e7  ADR-004-daily-order-level-allocation.md
8a28168c9f489ee2f7940f55da124a343a9b87e1881130e518a1d12af0bfe3cd  ADR-005-gemini-order-extraction.md
39bc2ab33a9791e5c46fca9550e83b274ed7d4917db26ce42a8cb5ffb2945275  ADR-006-pdf-import-recovery-center.md
4041c533a32dd1c40a187ef94cc32460ef83a2bdce210985544814a6c20e4283  ARCHITECTURE.md
2ff5a076c68d0ff341cf97327d131222110fa900f5eae9e44416562a145ca4ef  ArchitectureDecisionConfirmation_2026-09-15.md
7c3bbb0a3f51950d9b0cb1bcb93df12ddb98c396079e96e052964674b55eaa2a  CHANGELOG.md
2d0962b1c2343dcffe5e4b21f80b92f3cf4102b4e8772ca98e91a3f9509e195e  DATA_OWNERSHIP.md
de4055f957d74a23730c7bbe861e67c6b810b87e011b3e1310d1bad7e62ef5df  Gate2_Independent_Source_Verification_2026-09-14.md
aa6ca911ece63685ebccef626da42afb53356ae5a644a3fad24cc36ce23c4e62  Gate2_Independent_Source_Verification_v2_2026-09-14.md
de5f06a01500ee4e0c5fc83ab06eab160296c0f46c4ac19714c46bc49c40fde4  Gate2_ReClose_Evidence_Proposal_2026-09-10.md
cba5803d6a73faa807abc9277e8ee38f92a4166db096e2f7c8af3f7b313bd2c1  MODULE_CATALOG.md
f0323b21756308998a9128221e98ba39e707bd5f976e8d8f85dc5cd405997121  PDF_Extraction_Feasibility_POC_Report.md
684564d66218aae2af55e992a891f1077cb85cc9731d849c95b13d28849e362e  PhaseA_Design_Review.md
6191587c41fed7b47e279611f38d546be36b022c92c3b12a9671a807430d2387  PhaseO_PDF_PageCount_Investigation_2026-10-14.md
62f92c50b0d29d309fc2a9aee2cc7736fddeceb139ea4943ec694fc8f2e3bbdf  PhaseP_Documents_Processing_State_Design_2026-10-17.md
bde816b46a8245cebcaa4464c49a663bcc387d706f688f747d7812a7fecab96e  ProductionWiringSlice_Implementation_2026-09-15.md
60376f10381811494a981fae2f46fdc4fca7ceccd57db498aec541cec86b96ba  ProductionWiringSlice_Report_2026-09-15.md
bc32a3b930246e63ffb8a639e6b50e1d45af33b94d0f5ce0404a688588c84910  README-Architecture Decision Records #U2014 Index.md
bc32a3b930246e63ffb8a639e6b50e1d45af33b94d0f5ce0404a688588c84910  README-Architecture Decision Records — Index.md
83a90e7995b596613f212b4076d3e584d78b59e58c0b17d30d3bbb776609e741  README.md
585070443ed6c8448853da69195c8b986f145b83ac2a8fb77257d1d36ddaa5bd  VERIFICATION_STATUS.md
fc223e44d35b10e6764a08c032db64b9eeb249a80c67c554254567a68fd5461f  applyVerifiedAllocationFromEvidence.js
0489ea03f121e5ada383dea2a7943d4044379b046d1073e362309b2eedc8c21e  appsscript.json
d4c4f8dc10344d0d0291641d9cccb9f78ab868926e5dfe810b4ddf379b46a266  compliance-os-daily-allocation-checkpoint-2026-08-25.md
d08b32b8ea978b9cec04c5695ed9859d99004376d2cdd5801be08595321c5482  compliance-os-daily-allocation-phase2-design.md
adbe270e7cf9abe9c4c455a4752253a1f5e8a6af1fde673432b9fb724f235582  compliance-os-daily-allocation-phase4-confirmed-2026-08-27.md
1a9f96adf3cbb81cfa9ee8657825ed1727ee52ebeeb0e9be78a74e81649c931b  compliance-os-governance-draft.md
4aadc2292438c6fb6e9950e30d9b8136fed863c0d3a470e8f0e023e45027f462  compliance-os-phase2-field-analysis.md
702b7da6eb0bbea8c98fd63e8a632d323fa1c59edd6d5021beb6d9a03cacd6f7  compliance-os-phase4-gemini-extraction-design.md
```

---

## 附录 C：治理补丁明细（纯插入）

由本脚本把基线版与更新版逐行比较得到。**只允许「相同」和「插入」两种操作**；出现删除或替换，脚本会中止。

| 文件 | 插入块数 | 插入行数 | 删除 / 替换行数 |
|---|---|---|---|
| `ARCHITECTURE.md` | 1 | 1 | 0 |
| `CHANGELOG.md` | 1 | 45 | 0 |
| `DATA_OWNERSHIP.md` | 1 | 13 | 0 |
| `README-Architecture Decision Records — Index.md` | 1 | 18 | 0 |
| `VERIFICATION_STATUS.md` | 1 | 16 | 0 |

合计插入 **93** 行，删除 **0** 行。

### C.2 每个插入块的位置（基线行号；「在基线第 N 行之后插入」）

| 文件 | 位置（基线） | 行数 | 紧邻的基线行 | 插入块的第一行 |
|---|---|---|---|---|
| `ARCHITECTURE.md` | 第 79 行之后 | 1 | `- **106_AI_Integration.js**（Tier 3 Intelligence）…` | `- **缴款计划与官方付款记录（SOCSO / EPF 缴款记录；Official Contribution Recor…` |
| `CHANGELOG.md` | 第 19 行之后 | 45 | `---` | （空行） |
| `DATA_OWNERSHIP.md` | 第 32 行之后 | 13 | （空行） | `- **Contribution Planning S1 的四张表**（`Official_Evidence`、`Con…` |
| `README-Architecture Decision Records — Index.md` | 第 43 行之后 | 18 | （空行） | `## 草案（DRAFT，未编号；**尚未批准**）——Contribution Planning & Official …` |
| `VERIFICATION_STATUS.md` | 第 129 行之后 | 16 | （空行） | `## Contribution Planning & Official Payment Records（EPF / SO…` |

补丁文件 `governance_sync_2026-11-02.patch`：`diff -u` 生成，标签以 tab 结尾（因为文件名含空格和 em dash，否则 GNU `patch` 找不到文件）；`patch -p1 --dry-run` 通过；在全新基线副本上应用后，5 个文件与更新版逐字节一致。

---

## 附录 D：核对清单（做过 / 没做）

### D.1 做过的核对（全部是静态 / 机械层面；**没有运行任何 S1 代码、既有测试、真实 GAS**）

| # | 检查 | 层级 | 结果 | 时间 |
|---|---|---|---|---|
| D-1 | zip ↔ 两份只读工作副本逐文件 sha256 | L1 | 77 / 77 相同，0 缺失，0 多出 | 2026-11-02 复跑 |
| D-2 | manifest 的 17 个 handoff 文件 sha256 | L1 | 17 / 17 相符 | 10-21；10-27 复核 |
| D-3 | S1 三份文档的引用 / 结构 / 无占位符 / 无政策数值（`s1_verify.py`） | L1 | 见 §3.1 V-2、V-3；22 条启发式提示已逐条核对，均为误报 | 11-01 21:05；本次手工复核关键行 |
| D-4 | 治理补丁：dry-run + 全新基线副本上实际应用 + 与更新版逐字节比较 | L1 | 通过；无 `.orig` / `.rej` | 2026-11-02 15:01 |
| D-5 | 治理更新「纯插入」（只允许相同 / 插入） | L1 | 通过：合计插入 93 行，删除 0 行（附录 C 由脚本重新计算） | 本次 |
| D-6 | 本 checkpoint 的一致性核对（见 D.2） | L1 | 27 项通过 / 0 项未通过 | 本次 |

### D.2 本 checkpoint 的机械一致性核对（`make_checkpoint.py` 对 §0 – §7 与附录 A – C 执行）

| 结果 | 检查项 | 备注 |
|---|---|---|
| 通过 | D-S1 编号全部在 1..15 且 15 个都出现 | `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]` |
| 通过 | §2.2.1 表里有 15 行 D-S1 |  |
| 通过 | §2.2.3 表里有 A-1..A-9 |  |
| 通过 | §2.2.2 表里有 DT-1..DT-4 |  |
| 通过 | P-1..P-20 连续且各一行 | `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]` |
| 通过 | 所有表格每行单元数与表头一致 | `[]` |
| 通过 | 只出现 ADR-000…006 与（冲突说明里的）ADR-007，没有 ADR-008 及以上 | `['ADR-000', 'ADR-001', 'ADR-002', 'ADR-003', 'ADR-004', 'ADR-005', 'ADR-006', 'ADR-007']` |
| 通过 | ADR-007 只出现在冲突 / 编号说明里 | `12 处` |
| 通过 | 没有占位符 | `[]` |
| 通过 | 正文里的「文件:行」引用都落在文件行数范围内（共 51 个） | `[]` |
| 通过 | S1 要点里出现「4 表 / 44 列」 |  |
| 通过 | S1 要点里出现「12」 |  |
| 通过 | S1 要点里出现「`Contribution_Plan_Lines`（9）」 |  |
| 通过 | S1 要点里出现「`Official_Payments`（15）」 |  |
| 通过 | S1 要点里出现「`Payment_Links`（8）」 |  |
| 通过 | S1 要点里出现「`Official_Evidence`（12）」 |  |
| 通过 | 正文里反引号包着的文件名都能在磁盘 / 基线 / 已知清单里找到 | `[]` |
| 通过 | §4.2 里写的 7 份设计文档字节数与磁盘一致 |  |
| 通过 | §4.2 里写的治理同步文件字节数与磁盘一致 |  |
| 通过 | 治理 CHANGELOG 引用的 checkpoint 文件名与附录 B 都存在 |  |
| 通过 | 更新版 ADR 索引没有占用 ADR-007 以上编号（只出现在「下一个正式编号仍是 ADR-007」之类的说明里） |  |
| 通过 | 更新版 ADR 索引里 CPR 草案 5 行都是 `PROPOSED`（DRAFT） | `5` |
| 通过 | FD 里也有 D-S1-1..15 与 A-1..9 |  |
| 通过 | DN 里有 DT-1..4 |  |
| 通过 | D-S1-1 默认值与 FD §13.1 一致（含「推迟」） |  |
| 通过 | D-S1-3 默认值与 FD §13.1 一致（含「推迟」） |  |
| 通过 | D-S1-9 默认值与 FD §13.1 一致（含「方案 A」） |  |

> 这些检查只证明「编号连续、数字前后一致、引用落在文件范围内、文件名存在、没有占位符、没有占用 ADR 编号、没有把提议写成已批准」。**不证明**设计本身正确，也**不证明**对代码行为的描述正确。

### D.3 **没有**做的（不得写成「已做」）

| # | 没做的 | 状态 / 原因 |
|---|---|---|
| N-a | 运行任何既有测试 / 全量回归 | 10-21 信 §7 禁止；既有测试当前是否通过 = 未知 |
| N-b | 真实 GAS 验证（V0 – V10） | NOT RUN；需要 A-3 / A-7 |
| N-c | 访问真实 Sheet / 真实仓库 / 生产数据 | 没有链接你的电脑；也被来信禁止 |
| N-d | 政策登记表 10 项人工抽查 | PENDING（你手工） |
| N-e | 在 Sheets 里运行 Phase P 报告 §6 的只读核对公式 | 从未运行 |
| N-f | 重新运行 `tooling/phaseP_dup/repro_dup.js` | 最后一次运行是 2026-10-23；本窗口没有重跑 |
| N-g | 把治理补丁应用到**你的真实仓库** | 没有；需要你同意并先比对漂移（§5 步骤 2、3） |
| N-h | 核对 UCR6 原文、官方 Lock 文档、SOCSO / EPF 官方文件真实格式 | UNVERIFIED / BLOCKED（P-14、P-19、B-1、BL-1） |
| N-i | 核对上一窗口遗留的 Phase N / O / P 待决项当前状态 | 只登记了「存在」（PD-5） |
| N-j | 在 `.js` 层面验证对代码**行为**的描述 | 行为描述来自人读源码，没有机械验证 |

---

**本文件到此结束。** 按你的指示：完成 checkpoint、Governance / ADR 持久化及核对后停止；不继续 coding。
