# ADR 草案：缴款计划与官方付款记录（EPF / Tax / SOCSO）

- **性质**：ADR 草案（5 份）+ 「批准之后才应用」的治理文件更新提案。**每份的状态都是 `PROPOSED`；没有实现、没有验证。** 本文件没有修改任何已批准的治理文件，也没有占用任何正式 ADR 编号（授权 §6：「本轮只生成设计文档和 ADR 草案，不修改已批准的治理文件」）。
- **日期**：2026-10-26。**分析对象**：你上传的 `07.Compliance-main.zip`（77 个文件，即 handoff 所说的「工作副本」，不是原始基线 zip），只读。
- **配套**：`Contribution_Planning_Design_2026-10-26.md`（设计文档：规则细节、理由、测试与真实 GAS 验证计划、18 项决定）。ADR 只记**决定**、理由、备选、后果和证据，并指向设计文档的章节。两者如有出入，以设计文档为准，请告诉我。
- **证据标签**（同设计文档）：【源码证实】= 读过源码，附 `文件:行`；【官方证实】= 官方来源上有这句话（见 `Official_Policy_Register_2026-10-23.md`，经 WebFetch 转述，待你抽查）；【设计建议】= 我的设计，未实现未验证；【待确认】= 需要你决定或提供资料；【PENDING】= 没有官方依据或要真实环境验证；【BLOCKED】= 读不到，没有绕过。

---

## 0. 先读

### 0.1 这份文件是什么、不是什么

- **是**：5 份按项目 ADR 格式（Context / Decision / Rationale / Alternatives / Consequences / Evidence，再加 Verification 与 Related）写的草案；第 6 节是各治理文件**如果**批准之后要怎么改的提案文本。
- **不是**：不是 `ADR-NNN-*.md` 文件；没有进 ADR 索引；没有改 `ARCHITECTURE.md`、`MODULE_CATALOG.md`、`DATA_OWNERSHIP.md`、`VERIFICATION_STATUS.md`、`CHANGELOG.md`、`900_Constitution.js`、`901_System_Architecture.js` 或 governance 草案。
- 按项目自己的流程（`CHANGELOG.md` 里一贯写的 Code → Verify → Governance）：治理文件的更新排在代码和验证**之后**，不在这一轮。

### 0.2 编号：我无法确认，所以不用正式编号

授权要求：「如果无法确认下一个 ADR 编号，不要猜测或覆盖现有 ADR；先在报告中说明。」已知事实：

1. ADR 索引写「下一个新 ADR 是 ADR-007」（`README-Architecture Decision Records — Index.md` L17）。压缩包里有**两份**内容逐字节相同的索引（另一份的文件名里 em dash 被转成了 `#U2014`）；`CHANGELOG.md:42` 记录过这个重复，写明「最后只留哪一份由 Steven 决定」——重复至今没有处理。【源码证实】
2. Phase P 的设计文档（2026-10-17，未被采纳）也把它的新 ADR 暂称 ADR-007（`PhaseP_Documents_Processing_State_Design_2026-10-17.md:33`；`:575–576` 写明「本阶段不起草 ADR-007」；`:586` 把 `ADR-007-…md` 列为新增文件）。【源码证实】
3. 上传的只是一个快照：我看不到你本地或别的窗口里是否已经有 ADR-007 或更高编号的草稿。

所以草案一律叫 **`ADR-DRAFT-CPR-1…5`**（CPR = Contribution Planning & Official Payment Records）。没有写任何 `ADR-NNN-*.md`，没有改索引，没有覆盖任何现有 ADR。正式编号由你指定（设计文档 §11.3 决定 D-13）：(a) 草案保持临时编号，你指定正式编号（推荐）；(b) CPR 从 ADR-007 起，Phase P 另改；(c) Phase P 保留 ADR-007，CPR 从 ADR-008 起。

### 0.3 草案、切片与依赖

| 草案 | 内容 | 对应切片（设计 §11.1、§11.4） | 依赖 |
|---|---|---|---|
| CPR-1 | 官方记录的身份、记录链、写入原语、证据登记 | S1（表按切片建） | — |
| CPR-2 | 计划与实际的对照：查询时现算、状态词汇、期限、计划集 | S1（计划集比较与税务期限规则在 S3） | CPR-1 |
| CPR-3 | SOCSO 覆盖期（A 部分）与独立的 Grab 报销（B 部分） | A 部分 S1；B 部分 S2 | CPR-1、CPR-2 |
| CPR-4 | `Policy_Rule` 与解析接口；EPF 奖励与 Tax 通知书的边界 | S3 | CPR-1、CPR-2 |
| CPR-5 | 日历集成：派生义务 | S4 | CPR-2；Calendar 自己的真实 GAS 验证 |

批准 S1 在治理上等于批准 CPR-1、CPR-2 和 CPR-3 的 A 部分（设计 §11.1 完成标准第 6 条）。CPR-3 的 B 部分可以继续保持 `PROPOSED`，等 S2；CPR-4、CPR-5 同理，每一份都可以单独批准或不批准。

### 0.4 每份草案需要你先决定什么

决定编号 D-1…D-18 的完整选项与推荐在设计文档 §11.3；这里只是对照表。

| 草案 | 开工前必须答复 | 之后的切片之前再答复 |
|---|---|---|
| CPR-1 | D-1（Architecture Freeze 例外）、D-2（证据方案）、D-3（`TruthWriter` 路线）、D-4（S1 范围）、D-5（备用栏）、D-6（建表时机）、D-10（金额位数）、D-12（凭证要求）、D-13（ADR 编号） | — |
| CPR-2 | 沿用 CPR-1 的答复 | D-7（`160` 的 SOCSO 固定 49.40 存根）、D-11（税务两个日期）、D-16（`TAX_SELF_RESERVE`） |
| CPR-3 | D-9（覆盖期约定） | D-17（Grab 事件与证据要求，S2 之前） |
| CPR-4 | — | D-6（`Policy_Rule` 建表时机，S3）、D-11、D-16；另外**政策登记表的 10 项抽查**（你的任务，不是 D 编号） |
| CPR-5 | — | D-8（日历方案）、D-14（`150:72` 的 UTC 日期分量）、D-18（提醒提前天数） |

D-15（Phase P 修复范围）与这五份都无关，单独授权。

### 0.5 怎么答复

如果接受我对 S1 的全部推荐，回复「S1 全按推荐」即可：D-1 (a)、D-2 E2、D-3 P2、D-4 (a)、D-5 (a)、D-6 (a)、D-9 (a)、D-10 (a)、D-12 (a)、D-13 (a)。想保守起步：D-1 (c) + D-3 P3，其余相同——「零改动路线」，后端不碰任何已批准文件。**答复决定不等于授权实施**：实施要你另行明确授权。

---

## 1. ADR-DRAFT-CPR-1：官方记录的身份、记录链与写入原语（含证据登记）

- **Status**: **PROPOSED**（架构方向；等你明确确认才能改 `ACCEPTED`）。实现：无。Node 验证：无。真实 GAS 验证：无。
- **Draft ID / Date**: `ADR-DRAFT-CPR-1`，2026-10-26（正式编号待定，见 0.2）
- **Slice**: S1（`Reimbursement_Event` 在 S2、`Policy_Rule` 在 S3 才建表）
- **Design reference**: 设计文档 §1、§2、§4、§9、§10
- **Decisions needed**: D-1、D-2、D-3、D-4、D-5、D-6、D-10、D-12、D-13

### Context

授权（2026-10-21）要求把 EPF、Tax、SOCSO 的缴款预算与官方付款记录放进 Compliance OS，而且：计划、实际官方付款、报销、查询时对照结果、证据引用要是**分开的实体**；**复用现有架构、不重复造表、不覆盖历史**；要有稳定的业务身份、重复提交保护、来源引用、更正记录、审计历史、TruthWriter 的使用方式、失败恢复；**一次失败的写入之后不得留下无法识别的重复记录**（授权 §3-A、§3-C）。

现有架构里的相关事实：

1. 没有任何地方存「计划」「官方付款」「报销」「政策规则」。`160_MonthlyProjection.js:422–443` 只是投影存根（SOCSO 固定 49.40，EPF/Tax `Not_Configured`），它自己的注释写明「真正的官方缴费记录以后要作为独立的 Official Record 类型」（`160:403–415`），Dashboard 上也有同样的提示（`170_OperatorConsole.html:534`）。【源码证实】
2. `TruthWriter` 是所有 Sheet 写入的唯一出口（UCR6，`115_TruthWriter.js:3`），只返回 `{ appendValidatedRow }`（`:48`）；锁只包着校验与 `appendRow`（`:31–46`，加锁在 `:33`）；锁提供者 `waitLock(10000)`（`:94`），释放锁前没有 `flush`（`:90–102`）。契约测试只断言它**有** `appendValidatedRow`（`190_Tests_Contracts.js:42`），没有断言「没有别的方法」。【源码证实】
3. 现有的「是否已存在」检查在锁外，靠调用方传入的快照（`140_VerifiedIncome.js:189–198`）；Phase P 调查报告的 R3–R5 就是死在这里。【源码证实】
4. 有几处身份的末段是 `now.getTime()`：`computeDocumentId_`（`110_DocumentImport.js:47`）、事件 id（`:210`、`150_ComplianceCalendar.js:172`）、`reconciliation_id`（`130_Reconciliation.js:103`）。稳定身份的先例是 `income_id = CMP-INCOME-{ISO 周}`（`140:88`，CMP-P11/P13）。【源码证实】
5. 没有加栏位的迁移工具：`ensureSheetSchema_` 表头不一致就抛错（`108_SheetSetup.js:140–148`），`readAll` 栏位数不一致就抛错（`117_SheetReader.js:35`）；只有「加在表尾 + 手工补表头」有先例（`140:18–28`），插在中间会让旧数据整体错位。【源码证实】
6. `Documents` 表不能直接拿来登记官方收据：`consoleGetRecoveryStatus_` 会把所有没有对应 `Verified_Income` 的 `Documents` 行列成 Pending（有失败证据档时列成 Failed）（`170_OperatorConsole.js:427–490`）。【源码证实】

### Decision

> 下面每一条都是「提议的决定」；带【待确认】的是需要你选择的分支（见 Decisions needed）。

1. **七张只追加的表**：`Official_Evidence`（19 栏）、`Scheme_Status_Log`（15）、`Plan_Line`（21）、`Official_Payment`（22）、`Payment_Link`（11）、`Reimbursement_Event`（18）、`Policy_Rule`（23），共 129 栏。**按切片建**：S1 五张（88 栏），S2 `Reimbursement_Event`，S3 `Policy_Rule`【待确认 D-6】。全部经 `TruthWriter` 写入，没有更新、没有删除。
2. **身份 = 业务键 + `entry_seq`**，不用时间戳、随机数、自增号。键只由业务事实构成（制度、种类、周期、官方参考号、文件哈希），例如 `CMP-PLN-SOCSO-MAIN-SOCSO_CONTRIBUTION-2026-11`、`CMP-PAY-{SCHEME}-{KIND}-{TOKEN}-L{n}`、`CMP-EVD-{KIND}-{H16}`（设计 §2.11）。官方参考号经 `REFNORM` 规范化（去空白、转大写、只允许 `A–Z 0–9 . _ / - #`、1–64 位），**遇到别的字符一律拒绝并提示，不静默剔除**。
3. **记录链**：每条逻辑记录有 `entry_type`（`ORIGINAL / REVISION / CORRECTION / VOID`）与递增的 `entry_seq`；每一行都是**完整快照**；**有效状态 = 序号最大的那一行**；`VOID` 之后允许再来一条 `REVISION` 复活。`Policy_Rule` 用 `version` 当序号、没有 `entry_type`；`Reimbursement_Event` 用 `event_seq` 与 `VOID_EVENT`。
4. **「相同」的定义**（幂等判断用）：同键 + 同序号 + 除 `recorded_at` 以外的所有栏位逐栏相等（比较前统一：文本去首尾空白、金额取整数分、日期取 ISO 字符串）。`recorded_at` 只用于审计。
5. **写入原语 `appendEntryIfNext`**（设计 §4.3–§4.5）：返回 `Appended / Already_Recorded / Conflict / Stale_Sequence / Rejected`（另有进锁之前的 `Invalid`，以及 `Lock_Timeout`）。**锁内**的顺序是：重新读这张表（不用调用方的快照）→ 取该键的整条链 → **先比「是否相同」**（相同 → `Already_Recorded`；同序号内容不同 → `Conflict`）→ 序号必须是 `max+1`（否则 `Stale_Sequence`）→ 条目类型约束 → `validateInLock`（只读回调，不再调用 `TruthWriter`，所以没有嵌套锁）→ 追加 → `flush` → 释放锁。实现路线：**P2**（在 `TruthWriter` 里新增这个方法，`appendValidatedRow` 及其调用方一行不动，推荐）／**P3**（外层锁 + 无锁内层 writer，不动 `115`）／**P1**（事后检查，防不住并发重复）【待确认 D-3】。
6. **证据登记表 `Official_Evidence`**：登记「哪份官方文件支持哪条记录」（文件哈希、存放位置、种类、官方参考号）；证据可被多条记录共用；`DUP_FILE_HASH` 防止同一个文件被登记两次；一笔官方付款必须有 `official_reference` 或 `evidence_id` 之一【待确认 D-2：E1 复用 `Documents` ／ **E2 新表（推荐）**／ E3 内联引用；D-12 凭证要求】。它**不是**跨 OS 的 Document Repository（那是已确认不采纳的东西，`compliance-os-governance-draft.md:241`）。
7. **第一阶段只接受人工录入**：`entry_source` 只允许 `MANUAL_ENTRY`；PDF/OCR/LLM 辅助导入是以后的独立阶段，届时候选值走**同一套**行级校验与同一个写入原语，LLM 不得直接写 Truth（CMP-P14，`900_Constitution.js:196–200`）。
8. **数值与日期**：金额 > 0 且最多 2 位小数，**超过就拒绝，不静默四舍五入**【待确认 D-10】；存数字，引擎内部用整数分；日期是 `YYYY-MM-DD` 字符串，用整数分量 + `Date.UTC` 往返校验（CMP-CR4，`900:223–226`），读回一律先经 `normalizeIsoDateString_`（`106_Utils.js:32–44`）；ID/日期/文本栏设为纯文本格式。
9. **栏位一次定好，不加通用备用栏**【待确认 D-5】：唯一保留的具名预留是 `Official_Payment.payer_channel`（记录「你自己缴」这个陈述事实）。将来真要加栏位，只走「表尾追加 + 手工补表头」这条有先例的路（设计 §2.14）。
10. **失败恢复靠「重试收敛」，不靠事务**：同样的提交重发，结果要么写入、要么 `Already_Recorded`，永远不会产生第二条认不出来的记录；多行操作（证据 → 付款 → 链接）按固定顺序逐步幂等，做到一半失败时的中间状态能被对照如实表达，整个操作重跑即收敛（设计 §4.7–§4.8）。

### Rationale

- **CMP-P5**（印刷值优先于计算值，`900:139`）、**CMP-P9**（金额 2 位，`900:166–169`）、**CMP-P10**（异常显性，`900:171–175`）、**CMP-P11**（平台稳定 ID，`900:177–181`）、**CMP-P13**（发布必须幂等，`900:190–194`）、**CMP-P14**（AI 候选值不是 Truth）、**UCR6**（只追加）：这套设计是把这些既有原则落到一类新记录上，没有引入新原则。
- **业务键而不是请求号**：请求号要多存一个栏位，而且「同一件事重新提交」时请求号不同，保护不了；业务键从事实本身算出，同一件事必得同一个键。
- **记录链而不是原地更新**：`TruthWriter` 不支持更新（UCR6），ADR-003 在对账状态上已经走过同一条路（不加 `reconciliation_status` 栏位，改成查询时现算最新一笔）。
- **检查放进锁里**：现有的「锁外 + 旧快照」检查是 Phase P 的根因；对「重复提交与失败重试之后不留下认不出来的重复记录」这条要求，只有「检查与追加在同一把锁里」能做到（P2、P3 都可以，P1 做不到）。
- **先比相同、后校验**：一次已经成功的写入被重试时，不会因为「后来证据被作废了」之类的新情况变成一次拒绝——重试永远安全。

### Alternatives

| 备选 | 否决理由 |
|---|---|
| 一张通用 `Official_Record` 表，用 `record_type` 区分 | 栏位互不相关、一半为空；每种类型的校验各不相同；授权要求「分开实体」 |
| 每个制度 × 每种实体各一张（6 张以上） | 授权「不要重复建功能相同的表」；制度一多就要建新表；对照引擎要跨表合并 |
| 把 `plan_key` 做成 `Official_Payment` 的一个栏位，不要 `Payment_Link` | 做不到一笔付款对应多个月、一个计划多笔付款；改对应关系就要改付款记录 |
| 复用 `Compliance_Calendar` / `Compliance_Completions` | 日历只存义务的定义，没有金额、修订和取消（`150:25–29`）；完成记录撤销不了，事件 id 含时间戳（`150:172`） |
| 复用 `Documents` 登记证据（E1） | Recovery Center 污染；同批多文件会撞号（`110:47`）。要改已批准的 `170` |
| 不建证据表，各表内联文件引用（E3） | 少一张表，但每张表多约 7 个栏位，没有共用证据，也没有 `DUP_FILE_HASH` 防线；我没有写 E3 版的栏位表 |
| 在行上原地改状态栏位 | 违反 UCR6；ADR-003 已否决过同样的做法 |
| 用时间戳或随机请求号当身份 | 同一件事重新提交时身份不同，保护不了；这正是 Phase P 的成因之一 |
| 政策参数放代码常量或 Script Properties | 见 CPR-4 |
| 加通用备用栏（`reserved_n`） | 省不下迁移步骤（改名同样要手工改表头），反而留下永远为空的死栏位（D-5） |
| 路线 P1／P3 | P1 防不住并发重复；P3 把锁的所有权分到两处，并要守「不得在外层锁里误调单例」的纪律（设计 §4.5） |

### Consequences

- **好处**：重复提交与失败重试收敛；历史不被改写；每条记录能追到证据；写入协议与锁继续由 `TruthWriter` 一家持有（P2）。
- **代价与风险**（设计 §11.2）：
  - R1：要改已批准文件：`115`（新增方法，`appendValidatedRow` 不动）、`108`（登记 5 张表）、`190`（2 条契约断言）、`105`/`116`（假 accessor 的 `flush`、新用例）；**另外 `109_Tests_SheetSetup.js:25–28` 断言「表名恰好是现有 7 张」，登记新表后它一定失败，必须同步改**【源码证实】。这些需要 Architecture Freeze 例外（`compliance-os-governance-draft.md:3,420`）——批不批准由你决定（D-1）；选「零改动路线」（P3 + 新模块自带建表函数）则一个已批准文件都不碰，代价见设计 §11.3 D-1。
  - R2：表一旦建好，改栏位就是迁移；**批准前请认真看设计 §2 的栏位字典**，这是批准里最难回头的部分。
  - R3：锁与并发在真实 GAS 里的行为没验证（`waitLock` 超时、`flush` 是否必要、同一次执行重复获取锁）；设计让回调只读、不嵌套，失败恢复靠重试收敛，而不依赖锁语义。
  - R10：复杂度（S1：5 表 / 88 栏 / 3 个纯函数模块 + 1 个服务层）对单人系统是真实的取舍；设计 §11.3 D-2 里有更精简的 E3。
  - R12：手工录入要逐条建立链接，金额、日期、参考号都可能抄错；更正与作废都有明确流程。
  - R13：有人直接在 Sheet 里手工改数据会绕过 `TruthWriter`；有效视图的完整性检查会标出，不会静默，但无法阻止。
- **未知**：官方参考号/收据长什么样（N6、N7、N9）——`REFNORM` 的拒绝规则是安全的失败，真实参考号超出允许字符时修法是放宽一个常量。

### Evidence

- 【源码证实】`115_TruthWriter.js:3,31–46,33,48,85,90–102,94`；`190_Tests_Contracts.js:42`；`140_VerifiedIncome.js:18–28,88,189–198`；`110_DocumentImport.js:47,210`；`130_Reconciliation.js:103`；`150_ComplianceCalendar.js:172`；`108_SheetSetup.js:140–148`；`117_SheetReader.js:35`；`109_Tests_SheetSetup.js:25–28`；`170_OperatorConsole.js:427–490`；`160_MonthlyProjection.js:403–415`；`170_OperatorConsole.html:534`；`900_Constitution.js`：CMP-P5（`:139`）、P9、P10、P11、P13、P14、CR4。
- 【官方证实·有限】Google Apps Script `Lock` 参考文档：建议释放锁前 `SpreadsheetApp.flush()`（经工具转述；我后来想再抓原页确认超时行为时返回 `PROVENANCE_REQUIRED`，没有重试、没有绕过）。【PENDING】`waitLock` 超时行为、同一次执行里重复获取锁：不在文档里，列入真实 GAS 验证 V2。
- 【PENDING】官方参考号/收据格式：登记表 N6（EPF）、N7（SOCSO）、N9（Grab）、N5（Tax）。
- Phase P 调查报告（`PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md`）：R3–R5 与修复分层，**与本设计互不依赖**。
- 完整的逐行引用见设计文档附录 A。

### Verification

| 层面 | 状态 |
|---|---|
| 静态检查（层级 1） | 设计 + 源码逐行核对（本轮，只读） |
| Node 测试（层级 2/3） | **未做**。计划：A 行级校验、B 有效视图、C 写入原语、I 契约与载入、J 重复提交与故障注入、K 禁止项；变异 M5–M11（设计 §9） |
| 真实 GAS / 真实 Sheets（层级 4/5） | **未做**。计划：V0 建表、V1 Date 对象与时区、V2 锁与 `flush`、V3 并发、V4 故障与重试、V7 规模（设计 §10） |
| 独立来源核对（层级 7） | **未做**。V8：用你的第一份真实收据核对 |

### Related

ADR-002（Official Truth Principle）；ADR-003（追加式记录与查询时现算的先例）；ADR-006 与 Phase P（相邻，但互相独立；Phase P 的修复另案授权）；CPR-2、CPR-3、CPR-4、CPR-5。

---

## 2. ADR-DRAFT-CPR-2：计划与实际的对照——查询时计算，复用现有状态词汇

- **Status**: **PROPOSED**。实现：无。Node 验证：无。真实 GAS 验证：无。
- **Draft ID / Date**: `ADR-DRAFT-CPR-2`，2026-10-26
- **Slice**: S1 引擎；计划集比较与税务期限规则在 S3
- **Design reference**: 设计文档 §3、§9（层 D）、附录 B（B1–B5、B8–B10）
- **Decisions needed**: 沿用 CPR-1 的答复；D-7、D-11、D-16（之后的切片之前）

### Context

授权需求 B 要求：对照结果是**查询时确定性计算**的状态，必须覆盖部分付款、一笔付款跨多个周期、一个计划多笔付款、一笔付款对应多个计划、退款、重复、更正，以及防止同一张收据被登记两次；SOCSO 精确到天，EPF/Tax 不能被硬套进去。

现有架构里已有三个先例：对账的「当前状态」是查询时从日志现算最新一笔（`getCurrentReconciliationStatus_`，`130:151–156`；`140:6–11` 的头注释）；日历义务状态在查询时由纯函数 `computeObligationStatus_` 算出（`150:57–83`）；月度投影带 `_source:'Projection'`（`160:313`）。已有的状态词汇：对账 `Matched / Discrepancy_Flagged / Not_Performed`（`130:89,132`）、日历 `Upcoming / Due_Soon / Overdue / Completed`（`150:76–82`）、投影 `Needs_Allocation / Missing_Period / Projection / Not_Configured`。【源码证实】

### Decision

1. **对照是纯函数，不是表**：输入是有效视图（`Plan_Line`、`Official_Payment`、`Payment_Link` 的 `SETTLES` 类、`Scheme_Status_Log`）、调用方传入的 `asOfParts`（脚本时区的今天；引擎**永远不调用 `new Date()`**）、`planSet`、可选的规则；输出每条有效计划行一个结果对象，外加 `unallocated_payments`、`other_payments`、`voided`、`integrity_issues`、`totals`，并带 `_source:'Projection'`。不落地存成 rollup 表（CMP-P6、EP4）。
2. **分配是显式的**：付款与计划行之间只通过 `Payment_Link(SETTLES)` 里你陈述的 `allocated_amount` 建立对应；**系统不自动配对、不按天数或月份拆分**。没分配完的部分是 `Not_Planned`（`unallocated_payments`），没有可链接目标的种类（`TAX_OTHER`）进 `other_payments`。
3. **已结清额**：`S = Σ 符号 × 分配额`（付款方向与计划方向相反取 −1，即退款抵减）；**只有 `payment_date ≤ asOf` 的付款计入**；链接目标不存在或已作废则不计入并记 `DANGLING_LINK`；只有 `MAIN` 计划集可以被结清，`ALT-*` 只做预算比较。
4. **状态词汇**：`Not_Planned / Planned / Partially_Paid / Paid / Overdue / Overpaid / Discrepancy_Flagged / Not_Applicable`。**复用** `Overdue`（与日历同词同义）与 `Discrepancy_Flagged`（`130:89`，CMP-P12「只标注、不阻断」）；不复用 `Upcoming / Due_Soon / Completed`（那是日历的紧迫度词汇）。
5. **判定顺序**（第一个命中的生效）：已作废 → `Not_Applicable`；存在完整性问题（含 `S < 0`）→ `Discrepancy_Flagged`（同时保留 `money_status`，不让信息丢失）；`S > P` → `Overpaid`；`S = P` → `Paid`；`0 < S < P` 且 `asOf > deadline` → `Overdue` + `PARTIAL`；`S = 0` 且 `asOf > deadline` → `Overdue`；`0 < S < P` → `Partially_Paid`；`S = 0` → `Planned`。**`asOf` 恰好等于 `deadline` 不算逾期**（与 `150:76` 的 `daysRemaining < 0` 一致）。
6. **`settled_on` 与 `PAID_LATE`**：逐笔累加，取累计额**最后一次**从 `< P` 变成 `≥ P` 的那笔付款的日期；晚于 `deadline` 则标 `PAID_LATE`（只标注）。
7. **期限**：行上有 `stated_deadline_date` → 用它；`TAX_INSTALMENT` 且规则 `tax.cp500.payment_grace_days` 有 `OFFICIAL` 版本 → `due_date + 宽限天数`；否则退回 `due_date` 并标 `DEADLINE_RULE_PENDING`；EPF/SOCSO 是你自己定日期的预算行，期限就是 `due_date`，界面必须写成「逾期（相对你自己定的日期）」。
8. **完整性问题（改变状态）与信息标注（不改变状态）分开**：`AMBIGUOUS_ENTRY`、`SEQ_GAP`、`CHAIN_START_INVALID`、`DANGLING_LINK`、`OVER_ALLOCATION`、`LINK_INCOMPATIBLE`、`LINK_TO_NON_MAIN`、`NEGATIVE_SETTLEMENT`、`EVIDENCE_MISSING` 属前者；`PARTIAL`、`PAID_LATE`、`POSSIBLE_DUPLICATE`、`DEADLINE_RULE_PENDING`、`NO_EVIDENCE`、`COVERAGE_UNSTATED`、`COVERAGE_OUTSIDE_PLAN_PERIOD`、`INCENTIVE_NOT_REGISTERED`、`NOTICE_SUPERSEDED` 属后者。
9. **汇总**：`OUT` 与 `IN` 永不相加；`Not_Planned` 与 `other_payments` 各自成桶，不并入计划总额。
10. **计划集**：`MAIN` 是真正要执行的计划，`ALT-{LABEL}` 是备选预算；预算比较是另一个纯函数，并排列出缴款、你手填的预期奖励和「预期净支出」，**不给「哪个方案更好」的结论**；采用某个备选方案 = 一次有记录的显式复制操作，不是悄悄翻转的开关（S3）。
11. **防止同一张收据登记两次**有三道防线（同键幂等 → 同 `(evidence_id, line_no)` 拒绝 → 同文件哈希拒绝）；剩下的可疑重复只标 `POSSIBLE_DUPLICATE`，由你判断。（防线在写入侧，见 CPR-1；这里列出是因为对照要如实呈现它。）
12. **确定性**：金额全程整数分；输出排序明确（并列时按键）；输入不被修改；同样输入必得同样输出。

### Rationale

- 可推导的状态不存栏位（CMP-P6，`900:145–150`），否则就是第二个事实来源；ADR-003 对对账状态已经这样决定过。
- 「只标注、不阻断」（CMP-P12，`900:183–188`）+「异常显性」（CMP-P10，`900:171–175`）：完整性问题不撤销任何已记录的事实，但也不静默。
- 复用既有词汇可以少引入概念，也让对照的 `Overdue` 与日历的 `Overdue` 是同一个意思（CPR-5 依赖这一点）。
- 显式链接是你「不推断」要求的直接结果：钱对应哪个月，是你确认的事实，不是系统猜的。

### Alternatives

| 备选 | 否决理由 |
|---|---|
| 在计划行或付款行上存状态栏位 | 违反 UCR6 与 CMP-P6；ADR-003 同理 |
| 按金额/日期自动把付款配对到计划行 | 是推断；一笔付款对应哪几个月只有你知道；设计保留「只读建议、永远由你确认才写入」的将来可能性 |
| 复用日历的 `Upcoming / Due_Soon / Completed` | 那回答的是「有多紧迫」，对照回答的是「钱与计划对得上没有」；放在同一个对象上会让人误以为是一回事 |
| 落地存「对照结果」表 | 与 EP4 冲突；两份实现会漂移 |
| 把退款当成独立的负计划行 | 退款是对某一期的抵减，应该让那一期的 `S` 如实回落（可能从 `Paid` 回到 `Overdue`），而不是另生一行 |
| 税务期限直接硬编码「应付日期 + 30 天」 | 该规则在登记表里是「OFFICIAL（待抽查）」，不是已核实；只有 `Policy_Rule` 里有 `OFFICIAL` 版本才用 |

### Consequences

- 每次查询要读全部相关行：单人使用的规模应该不是问题，但要在真实 GAS 里量一下（V7）。
- 你要为每笔付款建立链接（R12）；没建链接的钱就是 `Not_Planned`，这是有意的呈现，不是错误。
- 界面措辞影响很大：自订日期的预算行不能被读成官方逾期（R8）；Node 测试只能断言字段，页面文字要在 1b 里人工核对。
- 与 `160` 的 SOCSO 固定 49.40 存根会形成第二个数字来源（R11、决定 D-7）。
- 回看历史时用的是**当前有效的计划版本**（计划行没有生效日）；本期不重建「当时的计划」。

### Evidence

- 【源码证实】`130_Reconciliation.js:89,132,151–156`；`140_VerifiedIncome.js:6–11`；`150_ComplianceCalendar.js:49–55,57–64,65–83,69–71,76`；`160_MonthlyProjection.js:313`；`900_Constitution.js:145–150,166–169,171–175,183–188,223–226`；`DATA_OWNERSHIP.md:18,26`。
- 【官方证实】登记表 POL-SOC-07：SOCSO 雇主缴款的「次月 15 日」「6% 利息」不适用于自雇缴款，不得套用；POL-TAX-02：每期付款期限为自应付日期起 30 天（`OFFICIAL（待抽查）`）。
- 设计文档 §3 与附录 B 的手算场景：B2（部分付款 → 逾期 → 补齐）、B3（一笔付款对应多个计划）、B4（退款抵减，虚构数字）、B8（`settled_on` 取最后一次跨越）、B9（EPF 计划集比较）。

### Verification

| 层面 | 状态 |
|---|---|
| 静态检查 | 设计 + 源码核对 + 手算场景（本轮；没有写原型引擎） |
| Node 测试 | **未做**。计划：层 B、D；不变量（幂等、与行序无关、金额恒等式）；变异 M1、M2、M10、M11（设计 §9） |
| 真实 GAS | **未做**。V6 端到端（用临时数据取对照）；V7 规模 |

### Related

ADR-003；CPR-1（写入侧防线）；CPR-3（覆盖时间线是另一个独立的纯函数）；CPR-4（规则）；CPR-5（日历消费 `money_status` 与 `deadline_date`）。

---

## 3. ADR-DRAFT-CPR-3：SOCSO 覆盖期（陈述值、精确到天）与独立的 Grab 报销

- **Status**: **PROPOSED**。A 部分（覆盖期）属 S1；B 部分（Grab）属 S2，可以单独保持 `PROPOSED`。实现：无。验证：无。
- **Draft ID / Date**: `ADR-DRAFT-CPR-3`，2026-10-26
- **Design reference**: 设计文档 §2.7–§2.9、§5、附录 B（B1、B6、B7）
- **Decisions needed**: D-9（覆盖期约定）；D-17（Grab 事件与证据要求，S2 之前）

### Context

授权 D3：你自己缴 SOCSO，Grab 没有自动扣款，可能一次缴好几个月；覆盖期精确到天，不是自然月；缴款日期、覆盖起止、金额、Grab 申请/批准/收据状态、付款与报销的对应要**分开**记录；**不推断正式保险规则**；Grab 报销是独立的，付款不蕴含报销。

官方来源能证实的很少：保障「从缴款的日期和时间起」，以收据为准（POL-SOC-01/02，页面日期 NOT STATED）【官方证实·有限】；**一次缴多个月时覆盖期怎么算，官方没写**（N7）【PENDING】；2026 年一项政府配对倡议的 FAQ 写了「续保者从现有保障结束后起算，而不是缴款日」（POL-SOC-03），只对那项倡议成立、对你是否适用未确认——但它说明覆盖起点可以不等于缴款日；Grab 页面说明每月自行向 SOCSO 缴款、符合条件则按月报销（POL-GRAB-01），申请/审批/支付方式/所需文件没有官方资料（N9）【PENDING】。`160_MonthlyProjection.js:427` 里还有一个写死的 SOCSO 49.40 存根。【源码证实】

### Decision

**A. 覆盖期（S1）**

1. **覆盖期是付款上的「陈述值」**：`coverage_start`、`coverage_end`、`coverage_basis` 由你照收据或 PERKESO 官方记录抄写，**系统从不用「缴款日 + N 个月」去补**。`coverage_end` 解释为「受保障的最后一天（含）」，只到天；收据上没写覆盖期就记 `coverage_basis=NOT_STATED`，起止留空（这笔付款不参与覆盖计算，也不会被悄悄补成区间）。这是**设计约定，不是 PERKESO 的规则**【待确认 D-9】。
2. **覆盖时间线是独立的纯函数 `socsoTimeline_`**（全程整数日编号）：只有 `payment_date ≤ asOf` 的付款参与；已陈述的区间做并集，**重叠或首尾相接则合并**（`下一个.s ≤ 当前.e + 1`），两段之间是缺口；重叠只作信息标注 `COVERAGE_OVERLAP`，**不判断**覆盖是否顺延（那取决于没有官方文字的规则）；提供 `covered_on(date)`、窗口报告、`covered_today / covered_until / last_coverage_end / uncovered_days`、逐月表（自然月只是显示用的分组，不是覆盖的定义）。输出一律带 `source:'STATED'` 与固定说明「覆盖期为收据/官方记录上的陈述，系统没有判断任何保险保障规则」。
3. **与计划对照互相独立**：只有两处一致性检查（`COVERAGE_OUTSIDE_PLAN_PERIOD`、`COVERAGE_UNSTATED`），都只针对你自己陈述的事实。
4. **EPF/Tax 付款的 `coverage_*` 必须为空**：覆盖模型不被硬套到别的制度。
5. 精度限制写明：官方写的是「日期**和时间**」，本设计只到天；一天之内的时刻要看原收据。

**B. Grab 报销（S2）**

6. **每个月一个独立索偿**（`claim_key = CMP-RMB-GRAB-SOCSO-{YYYY-MM}`）；状态由 `Reimbursement_Event` 事件流**查询时折叠**得出（`CLAIM_OPENED / APPLIED / APPROVED / REJECTED / RECEIVED / VOID_EVENT`；`APPLIED/APPROVED` 可选，因为 Grab 流程没有官方资料）。索偿状态是另一个词汇族：`Opened / Applied / Approved / Rejected / Received / Partially_Received / Over_Received`，实收了但没有申请额/批准额时标 `NO_TARGET_AMOUNT`。**没有「逾期」**：Grab 的「次月 10 日前」是平台条款，不当截止日。
7. **付款 ↔ 报销只靠你明确建立的 `FUNDS_CLAIM` 链接**，分配额由你陈述，**不占用 `SETTLES` 的分配额**（一个对计划、一个对报销，是两本账）；系统**永远不按比例自动拆分**。没有链接就写「未建立报销关系」，**不写**「未报销」。每个索偿的净成本 = 已链接分配额 − 实收（没有链接则为空，不当作 0）；整个制度的合计单独列出并标注「合计，不按月对应」。
8. **S2 推迟到你给出一份真实的 Grab 记录之后**（D-17）；`Reimbursement_Event` 延后建表，所以事件模型届时要调整的话，成本为零。

### Rationale

- **CMP-P5**：印刷的/官方的陈述值优先于系统算出来的值（`900:139`）；覆盖期本来就应该来自收据。
- 官方没写的规则不替它写（授权 D3、§4；CMP-P10）。POL-SOC-03 说明覆盖起点可以不等于缴款日，所以起点必须是独立栏位。
- 「精确到天」+「不推断」同时成立的唯一办法，是把覆盖区间当成你陈述的事实，系统只做集合运算（并集、缺口、重叠）。
- 报销按月独立（POL-GRAB-01），所以一笔付款跨三个月时需要三个索偿，而不是一笔付款对一笔报销。

### Alternatives

| 备选 | 否决理由 |
|---|---|
| 用 `payment_date + 1 个月 / 30 天` 推算覆盖期 | 没有官方依据；多月预缴与续保规则都没写（N7、POL-SOC-03）；违反「不推断」 |
| 把自然月当作覆盖单位 | 你要求精确到天；自然月只做显示分组 |
| 每笔付款必须陈述覆盖期（D-9 b） | 逼你填收据上没有的信息 |
| 记录到时刻（D-9 c） | 你只要求到天；时刻没有可靠来源 |
| 一笔付款对一笔报销（付款行上存报销状态） | 与按月独立的 Grab 条款不符；违反 append-only；把两本账混在一起 |
| 按比例自动把付款拆到各个月的索偿 | 是推断；分配由你陈述 |
| 把 Grab 的「次月 10 日」当截止日去判断逾期 | 平台条款，页面无日期，没写逾期怎么办 |
| 现在就建 `Reimbursement_Event`（S1 + S2 一起，D-4 c） | 没见过真实 Grab 记录就定事件模型，风险大于收益（R7） |

### Consequences

- 你要照收据抄覆盖日期；抄错了用 `CORRECTION` 更正，以收据原件为准（R6）。
- 覆盖重叠是否让保障「顺延」，系统不回答；输出只呈现事实。
- 时刻不建模：缴款当天的先后要看原收据。
- Grab 事件模型在 S2 之前可能调整（R7）；`160` 里的 49.40 存根与新计划行并存时可能显示不同的金额（D-7）。
- 第一份真实收据出来之前，「SOCSO 覆盖期约定」只能标成 `PROPOSED`，V8 核对之后才能写成 `VERIFIED`。

### Evidence

- 【官方证实·有限】登记表 POL-SOC-01/02/03/07、POL-GRAB-01；【PENDING】N7（多月预缴的覆盖规则、收据/参考号格式）、N9（Grab 流程、所需文件、你的对账单格式）。
- 【源码证实】`160_MonthlyProjection.js:427`（固定 49.40）；`900_Constitution.js:139`（CMP-P5）、`:223–226`（CMP-CR4）。
- 设计文档 §5 与附录 B：B1（三个月一笔付款，覆盖 92 天）、B6（Grab 索偿折叠与净成本，S2）、B7（时间线：相接、缺口、重叠、未陈述）。

### Verification

| 层面 | 状态 |
|---|---|
| 静态检查 | 设计 + 手算场景（本轮） |
| Node 测试 | **未做**。计划：层 E（时间线）、层 F（索偿折叠，S2）；变异 M3（合并去掉 `+1`）、M4（`coverage_end` 当开区间）；附录 B 的 B1、B7 成为黄金测试（设计 §9） |
| 真实 GAS | **未做**。V6；**V8：拿你的第一份真实 SOCSO 收据逐字段核对** |

### Related

CPR-1（身份与写入）；CPR-2（计划对照、`COVERAGE_OUTSIDE_PLAN_PERIOD`）；`160` 存根（决定 D-7）。

---

## 4. ADR-DRAFT-CPR-4：政策规则（`Policy_Rule`）与解析接口；EPF 奖励与 Tax 通知书的边界

- **Status**: **PROPOSED**。属 S3。实现：无。验证：无。
- **Draft ID / Date**: `ADR-DRAFT-CPR-4`，2026-10-26
- **Design reference**: 设计文档 §2.10、§3.4、§6、§7、附录 B（B4、B8、B9、B10）
- **Decisions needed**: D-6（建表时机）、D-11（税务两个日期）、D-16（`TAX_SELF_RESERVE`）；**登记表 10 项抽查**（你的任务）

### Context

授权 §4：EPF/KWSP、LHDN/CP500、PERKESO/SOCSO、Grab 的规则必须从**官方来源**核实，第三方文章只是线索；无法确认就标 `PENDING`，设计成可配置的规则，**不硬编码未核实的政策数字**。授权 D4（EPF）：你没有注册 i-Saraan Plus、缴款金额还没决定；要支持注册状态与来源证据、带版本和生效日的奖励规则、跨方案预算比较、预期 vs 实际缴款、预期 vs 已确认奖励；**第一阶段没有计算器**，但要把数据模型和规则接口设计好。授权 D5（Tax）：没有收到 CP500；首个有营业收入的课税年不确定；要支持「尚未通知」状态、正式 CP500 通知书（带来源）、每期金额/到期日/适用年度、实际缴款与证明、计划 vs 实际；**永不编造 CP500 金额**；税额估算、收入归属、跨年税额计算不在范围。

官方政策现状（`Official_Policy_Register_2026-10-23.md`，经 WebFetch 转述，待你抽查）：i-Saraan 与 i-Saraan Plus 的奖励比例与上限有官方文字（POL-EPF-01/02，「OFFICIAL（待抽查）」），但「自己缴的款算不算 Plus 的奖励基数」「当年是不是日历年」等 7 项缺口都是 `PENDING`（N10）；CP500 最多六期、每期以通知书为准（POL-TAX-01/02）；首个营业收入年是否有 CP500 官方没写（N4）；修改 CP500 的截止日在两处官方文字里不一致（POL-TAX-01 对 03）；两份 LHDN 新闻稿读取失败（N3 【BLOCKED】）；缴款凭证与参考号格式没有（N5、N6）。

### Decision

1. **`Policy_Rule`（23 栏，S3）**：参考数据，**永远不参与任何记录的身份**；`rule_key`（小写点号命名）+ `version`（整数，必须是最大版本 + 1）；`verification_status ∈ OFFICIAL / PENDING / LEAD / WITHDRAWN`。`OFFICIAL` 必须带完整来源（机构、标题、可访问位置、核实日期）；第三方文章最多是 `LEAD`；`PENDING` 必须写明哪些点尚未确认。更正 = 新版本；撤回 = 追加一个 `WITHDRAWN` 的更高版本。
2. **解析接口 `resolveRule_(rules, ruleKey, asOfParts, scope)`**（纯函数，只定接口）：候选 = 生效区间包含查询日期的版本；若给了 `scope` 且候选里有同范围的行，只用这一组，**特定范围的行是 `PENDING` 时不回退到通用行**；在该组里取**版本号最大**的一行。返回：`OFFICIAL` → `{ok:true, value, rule_id, source}`；`PENDING / LEAD` → `Rule_Pending`（线索永远不提供取值）；`WITHDRAWN` 或无候选 → `Rule_Missing`；同版本多行 → `Rule_Ambiguous`；值无法解析 → `Rule_Invalid`。调用方必须处理 `ok:false`：输出「该项依赖规则 X，状态 `Rule_Pending`，未计算」，不使用默认值。
3. **第一阶段真的会用到规则的地方只有两处**：税务期限宽限天数 `tax.cp500.payment_grace_days`（CPR-2 的期限）与 CP500 最大期数 `tax.cp500.max_instalments`（上限校验）。**EPF 一条规则都不参与计算**。
4. **没有 EPF 奖励计算器**；只预留接口 `expectedIncentive_(…)`：只要它依赖的任何规则不是 `OFFICIAL`，就返回 `Rule_Pending` 并列出规则键，**永远不返回默认值**。预期奖励只接受你手填的 `EPF_INCENTIVE_EXPECTED` 行，输出里固定标注「预期，非官方确认」。
5. **EPF**：注册状态记在 `Scheme_Status_Log`（现在是 `NOT_REGISTERED`，`USER_STATED`；将来 `REGISTERED` 必须带证据）；缴款预算与备选方案用计划集（`MAIN` / `ALT-*`，CPR-2）；实际缴款是 `EPF_CONTRIBUTION` 官方付款；已确认奖励是 `EPF_INCENTIVE_CREDIT` 官方付款，**即使没有链接到预期行，它仍是官方记录**（同时出现在 `unallocated_payments`）；`INCENTIVE_NOT_REGISTERED` 只作提醒。预期与已确认奖励的差**只呈现事实**（奖励一年入账两次、视政府拨款，所以「还没入账」不等于「拿不到」）。
6. **Tax**：每个课税年一条状态链 `NOT_NOTIFIED → NOTIFIED → REVISED`；**`NOT_NOTIFIED` 是明确的陈述，不是「没有数据」**，此时没有任何计划行，也不会生成预算。`TAX_INSTALMENT` 计划行只能是 `origin=OFFICIAL_NOTICE` 且带通知书证据（校验 + 锁内检查 `NOTICE_STATUS_MISSING`）；每期的 `instalment_no`、金额、应缴日期**照通知书抄写，系统不推算、不补齐缺的期数**；「六期」「三月」不写进任何校验（只有 `tax.cp500.max_instalments` 有 `OFFICIAL` 版本时才由包装层传入上限）。修改后的通知书：登记新证据 → 状态 `REVISED` → 逐期 `REVISION / VOID / 新 ORIGINAL`；旧行与旧证据留在历史里；未更新证据的行标 `NOTICE_SUPERSEDED`（只提醒）。通知书的原标题抄进 `document_title`，代码里不写死任何表格名称。
7. **税务两个日期**：显示「通知书上的应缴日期」与「最后缴款日」，`Overdue` 以最后缴款日为准（宽限规则只有 `OFFICIAL` 才用）【待确认 D-11】。余额税款不是 CP500 分期，记为 `TAX_OTHER`，只登记不对照；系统不计算罚款（官方依据没找到，N5）。
8. **种子数据**：登记表第 8 节的 `Policy_Rule` 种子只是数据建议；**在你抽查那 10 项之前，任何种子都不应写入 `Policy_Rule`**，`OFFICIAL（待抽查）` 的规则默认不被引擎使用。

### Rationale

- **CMP-P10**（异常显性）加上授权 §4：未核实就明说「Rule_Pending」，比悄悄使用默认值安全得多；用默认值等于替规则做决定。
- 把政策值放进带版本、生效日、来源引用的表里，才能回答「当时用的是哪一版、依据是什么」；放进代码常量，改一个数要重新部署，也留不下来源。
- 「特定范围 PENDING 不回退到通用行」：不能因为特定规则没核实，就悄悄用通用规则顶上。
- 不做 EPF 计算器不是偷懒：计算所需的 8 项规则里没有一项是已核实的（设计 §6.4），任何实现都只能返回 `Rule_Pending`，这也是授权说「第一阶段没有计算器」的实质理由。
- Tax 的金额只能从通知书来：授权明令永不编造 CP500 金额，而官方又说每期金额以通知书为准。

### Alternatives

| 备选 | 否决理由 |
|---|---|
| 政策参数放代码常量或 Script Properties | 没有生效日、版本历史、来源引用和审计；改一个数要重新部署 |
| 只存「最新值」的单行配置 | 回看历史时无法知道当时的规则；撤回与更正没有痕迹 |
| 用 `PENDING` 规则的「最佳猜测」先实现计算器 | 授权明确不要；等于用未核实的数字做决定 |
| 特定范围 `PENDING` 时回退到通用规则 | 悄悄用另一条规则顶替 |
| 要求 `Policy_Rule` 的生效区间互不重叠 | 只增表里没法回头给旧版本补 `effective_to`；改为「取包含该日期的最高版本」 |
| 从缴款额自动估算 CP500 或税额 | 授权明确排除（D5） |
| 把「六期、三月起」写进校验 | 官方说以通知书为准；你抄进来的才是事实 |
| 税务只显示应缴日期、以它判断逾期（D-11 备选） | 更保守，但可能把仍在宽限期内的期次标成逾期；列为备选，由你决定 |

### Consequences

- S3 之前没有 `Policy_Rule` 表；S1/S2 不需要它（S1 里没有任何政策数字）。
- 登记表尚未经你抽查（R15）：抽查之前，期限一律退回 `due_date` 并标 `DEADLINE_RULE_PENDING`。
- 预期奖励只能手填，可能被误读成 EPF 确认（R9）：输出里固定标注。
- Tax 视图在你收到 CP500 之前几乎是空的（只有「尚未收到」的陈述），这是正确的。
- 官方文字之间有冲突（POL-TAX-01 对 03 的修改截止日）时，系统标 `PENDING` 并显示冲突，不替你选。

### Evidence

- 【官方证实】/【官方证实·有限】登记表 POL-EPF-01/02/05、POL-TAX-01/02/03/04；【PENDING】N4、N5、N6、N10；【BLOCKED】N3。
- 【源码证实】`900_Constitution.js:171–175`（CMP-P10）。
- 设计文档 §2.10、§3.4、§6、§7 与附录 B：B4（退款抵减与计划修订）、B8（`settled_on`，虚构数字）、B9（EPF 计划集比较）、B10（Tax 状态链）。

### Verification

| 层面 | 状态 |
|---|---|
| 静态检查 | 设计 + 官方来源核对（经转述，**待你抽查**） |
| Node 测试 | **未做**。计划：层 G（解析规则、严格解析 `0.20` 接受、`20%`/`1,000` 拒绝）；变异 M12（`PENDING` 回退到通用规则）（设计 §9） |
| 真实 GAS | **未做**。规则的 `OFFICIAL` 状态要你抽查（层级 7，登记表第 9 节 10 项） |

### Related

CPR-1（写入原语、`Policy_Rule` 的版本链）；CPR-2（期限、计划集）；CPR-3（SOCSO 规则属同一机制）。

---

## 5. ADR-DRAFT-CPR-5：日历集成——派生义务，不建第二套提醒

- **Status**: **PROPOSED**。属 S4（先只展示）。实现：无。验证：无。
- **Draft ID / Date**: `ADR-DRAFT-CPR-5`，2026-10-26
- **Design reference**: 设计文档 §8、§9（层 H）、§10（V5）
- **Decisions needed**: D-8（日历方案）、D-14（`150:72` 的 UTC 日期分量）、D-18（提醒提前天数）

### Context

授权需求 D：与 Compliance Calendar 集成，**不建第二套提醒系统**；说明计划变更、通知书更新、付款发生之后日历怎么更新；遵守现有架构与事件规则；本轮只做设计。

现有事实：`Compliance_Calendar` 只存义务的定义（建立时写一次、不可变），`Compliance_Completions` 记「完成了」这个事实（`DATA_OWNERSHIP.md:14–15`；列定义 `150:25–29`）；状态在查询时算，到期日**之后**才算 `Overdue`（`150:65–83`，`:76`）；只有三种事件（`150:133–150`）；**没有「取消」或「被取代」的概念，完成记录也撤销不了**；`EventPublisher` 是占位实作（`ARCHITECTURE.md:13`）；日历表里没有任何真实义务，Calendar 的真实 GAS 验证 NOT DONE（`VERIFICATION_STATUS.md:119–124`）；`150:72` 用 UTC 日期分量取「今天」，而脚本时区是 `Asia/Singapore`（`appsscript.json:2`），所以马来西亚时间每天 00:00–08:00 会差一天；事件 id 含 `now.getTime()`（`:172`）。【源码证实】

### Decision

1. **派生义务（方案 ii）**：计划行在**查询时**派生出一个义务对象，交给**现有**的 `computeObligationStatus_` / `evaluateObligation_`，发**现有**的三种事件；**不往 `Compliance_Calendar`、`Compliance_Completions` 写任何行**，不新增事件类型、不新增提醒表、不新增调度器。
2. **字段**：`obligation_id = CMP-CAL-PLN-` + `plan_key`（去掉 `CMP-PLN-` 前缀），由 `plan_key` 确定性得出；`category` 是 `EPF / SOCSO / Tax`；`due_date` 取该行的 `deadline_date`（不是 `due_date`），这样日历的 `Overdue` 与对照的 `Overdue` 是同一个意思；`hasCompletion` 取自 `money_status` 是否为 `Paid` 或 `Overpaid`（用 `money_status` 而不是 `status`，是为了不让完整性问题悄悄压住「逾期」提醒，也不让它假装「已完成」）；`linked_document_id` 留空（证据在 `Official_Evidence`，不混用两个登记表）；`reminder_lead_days` 是一个常量默认值（建议 7 天，界面偏好，不是政策）【待确认 D-18】。
3. **计划变化自然反映**：`REVISION` 用新日期重算；`VOID` 使义务消失；付款使其 `Completed`；付款被更正/作废或退款使其回到 `Upcoming / Due_Soon / Overdue`——物化方案做不到最后这一点。
4. **先只展示（方案 iii）**：S4 的第一步是控制台里的只读列表（真实日历行与派生义务合并，标 `source:'CALENDAR_ROW' / 'PLAN_DERIVED'`）；事件要等 Calendar 自己的扫描接上线。
5. **日期**：引擎与派生义务都由调用方传入「脚本时区的今天」；需要调用 `computeObligationStatus_` 时，**不改 `150` 也能得到正确日期**：传入「本地日期的 UTC 零点」`new Date(Date.UTC(本地年, 本地月−1, 本地日))`。`150:72` 本身的修正是另一个决定（D-14），不并入本设计。
6. **不顺手解决**的 Calendar 自己的问题：连续多天 `Due_Soon` 是否每次扫描都发事件（`150:19–22`）；事件 id 含时间戳是否可以接受【待确认】（要等 `EventPublisher` 真的接上 Reminder OS、看清下游怎么去重之后再定）。

### Rationale

- 可推导的状态不存（CMP-P6）：「是否已付」只有一个事实来源——付款链接；日历只是它的一个视图。
- 日历的完成记录撤销不了，所以不能用它承载「已付」：付款被更正或退款之后日历会永远显示「已完成」。
- 日历里没有取消/被取代，所以物化的义务在计划被作废或改期之后会永远留着。
- 2026-08-17 的「不做」清单明确不要为了「以后可能需要」而加的新事件类型和 Infrastructure（`compliance-os-governance-draft.md:196`）：方案 ii 恰好一个新增事件类型都没有。

### Alternatives

| 备选 | 否决理由 |
|---|---|
| (i) 物化：建计划行时写日历义务，结清时写完成记录 | ①日历不能取消：计划行 `VOID` 后义务永远 `Overdue`；②改期要新建一条、旧的取消不了；③完成记录撤销不了，付款被更正后仍显示「已完成」；④「是否已付」同时存在于完成记录和付款链接两处 |
| 新建一套「缴款提醒」表与调度 | 授权需求 D 明令不建第二套提醒 |
| 直接改 `150`（让它接受日期分量、支持取消） | 影响现有 `150`/`151` 测试，是另一个改动，单独列为 D-14 |
| 只展示、永远不接事件（iii 作为终点） | 作为 S4 的第一步是对的；是否接事件取决于 Calendar 自己的扫描上线 |

### Consequences

- 只在 S4 才有意义，前提是 Calendar 自己的真实 GAS 验证（`VERIFICATION_STATUS.md:124` NOT DONE）有人先做；`EventPublisher` 仍是占位，所以**本设计不改变「提醒是否真的送达」这件事**。
- EPF、SOCSO 的行是你自己定日期的预算，派生出的 `Overdue` 界面上要写成「逾期（相对你自己定的日期）」（R8）。
- 若调用方传「本地日期的 UTC 零点」，同一天重复扫描会得到同一个事件 id（对下游去重有好处），但 `now` 也就不再表示「现在」：是否接受要等 Reminder OS 接上之后再定。
- `150:72` 的问题在 D-14 决定之前仍然存在于真实日历行上（派生义务绕开它，不修复它）。

### Evidence

- 【源码证实】`150_ComplianceCalendar.js:19–22,25–29,49–55,65–83,72,76,133–150,156–158,167–176,172`；`DATA_OWNERSHIP.md:14–15`；`ARCHITECTURE.md:13`；`VERIFICATION_STATUS.md:119–124`；`appsscript.json:2`；`compliance-os-governance-draft.md:196`。
- 我在 Node 里验证过「本地日期的 UTC 零点」的行为：马来西亚时间 2026-10-25 00:30 时，`getUTC*()` 取出 10 月 24 日（`150:72` 的现状），UTC 零点做法取出 10 月 25 日（设计 §8.6）。这是 Node 层面的验证，不是真实 GAS 的。

### Verification

| 层面 | 状态 |
|---|---|
| 静态检查 | 设计 + 源码核对（本轮） |
| Node 测试 | **未做**。计划：层 H（派生字段、`hasCompletion` 取自 `money_status`、两种 `TZ` 下状态一致、假 accessor 断言没有向 Calendar/Completions 写入）；变异 M13（`hasCompletion` 改用 `status`） |
| 真实 GAS | **未做**。V5 时区（要在马来西亚时间 00:00–08:00 之间运行一次）；Calendar 自己的真实验证是前提 |

### Related

CPR-2（`money_status`、`deadline_date`）；CPR-1（计划行的有效视图）；`150_ComplianceCalendar.js` 现有设计；Reminder OS / `EventPublisher`（占位，未接）。

---

## 6. 批准之后才应用的治理文件更新提案（**没有应用**）

> 本节全部是**提案文本**。授权 §6/§7：本轮不修改已批准的治理文件，所以下面没有任何一条已经写进任何文件。按项目流程，它们排在代码与验证之后；每条写明「何时才改」。

### 6.1 ADR 索引（`README-Architecture Decision Records — Index.md`，及其重复副本）

提案新增行（编号待你指定，见 0.2；索引自己的规则是「三位数递增，不补空号」）：

| ID | Title | Status |
|---|---|---|
| ADR-DRAFT-CPR-1 | 官方记录的身份、记录链与写入原语（含证据登记） | PROPOSED |
| ADR-DRAFT-CPR-2 | 计划与实际的对照：查询时计算，复用现有状态词汇 | PROPOSED |
| ADR-DRAFT-CPR-3 | SOCSO 覆盖期（陈述值，精确到天）与独立的 Grab 报销 | PROPOSED |
| ADR-DRAFT-CPR-4 | 政策规则（Policy_Rule）与解析接口；EPF 奖励与 Tax 通知书的边界 | PROPOSED |
| ADR-DRAFT-CPR-5 | 日历集成：派生义务，不建第二套提醒 | PROPOSED |

何时才改：你指定正式编号并确认某份草案之后；同时由你决定索引只保留哪一份（`CHANGELOG.md:42` 留下的未决事项）。

### 6.2 File Map（`compliance-os-governance-draft.md` §6，`:348–356`）

提案文本（临时编号，排在 `170` 之后、`190_Tests_*` 之前，与现有文件不冲突）：

> **180s Official Records（提议，未写）**：180_OfficialRecords.js（常量、行级校验、键构造、有效视图与完整性检查）／181_Tests_OfficialRecords.js／182_PlanComparison.js（对照引擎）／183_Tests_PlanComparison.js／184_SocsoCoverage.js（覆盖时间线；S2 起含索偿折叠）／185_Tests_SocsoCoverage.js／186_PolicyRules.js（S3）／187_Tests_PolicyRules.js（S3）／188_OfficialRecordsService.js（服务层与公开薄壳）／189_Tests_OfficialRecordsService.js

何时才改：批准 S1 之后、代码存在之后；最终编号以 File Map 批准为准。

### 6.3 `MODULE_CATALOG.md`（沿用现有格式；测试文件按目录惯例不单独列出）

```
### 180_OfficialRecords.js（提议，Designed）
- **Responsibility**: 官方记录各表的栏位常量（纯字面量）、枚举、行级校验、业务键构造（REFNORM / H16）、有效视图与完整性检查；全部是纯函数
- **Owned data**: 无（表的归属见 DATA_OWNERSHIP 提案）
- **Dependencies**: 106（normalizeIsoDateString_、round2_）
- **Verification status**: Designed——只有设计文档，没有代码
- **Known limitations**: 官方参考号/收据格式未知（登记表 N6/N7/N9），REFNORM 对意外字符一律拒绝

### 182_PlanComparison.js（提议，Designed）
- **Responsibility**: 计划 vs 实际对照引擎（查询时现算，不读时钟、不做 I/O）；S3 起含计划集预算比较
- **Dependencies**: 180；可选 186（规则）
- **Verification status**: Designed

### 184_SocsoCoverage.js（提议，Designed）
- **Responsibility**: SOCSO 覆盖时间线（陈述值的并集、缺口、重叠、逐月表）；S2 起含 Grab 索偿折叠与净成本
- **Dependencies**: 180
- **Verification status**: Designed
- **Known limitations**: 多月预缴的覆盖规则没有官方文字（N7），系统不推算

### 186_PolicyRules.js（提议，Designed，S3）
- **Responsibility**: resolveRule_ 解析接口与 expectedIncentive_ 预留接口（只返回 Rule_Pending，直到政策规则被核实）
- **Dependencies**: 180
- **Verification status**: Designed

### 188_OfficialRecordsService.js（提议，Designed）
- **Responsibility**: 读表 → 有效视图 → 引擎；多行写入包装（证据 → 付款 → 链接，逐步幂等）；公开薄壳（无下划线，CMP-CR5）
- **Dependencies**: 115（TruthWriter）、117（SheetReader）、180/182/184（/186）
- **Execution entry points**: 公开薄壳函数（面板在 S1b 才接）
- **Verification status**: Designed
```

另有对**已批准模块**的改动提案（只在批准例外之后才写）：`115_TruthWriter.js`（新增 `appendEntryIfNext` 与 accessor 的 `flush`）、`108_SheetSetup.js`（登记 5 张表）、`109_Tests_SheetSetup.js`（**必须改** `:25–28` 的表名断言）、`190_Tests_Contracts.js`（两条契约断言）。走「零改动路线」时这四项都不发生。

何时才改：代码完成并通过 Node 测试之后。

### 6.4 `DATA_OWNERSHIP.md`（沿用现有表头；按该文件 `:29–31` 的约定标为 PROPOSED — REQUIRES APPROVAL）

| 表 | Authoritative Source | Derived | Evidence/Audit | Projection/Reporting | Temporary Execution |
|---|---|---|---|---|---|
| `Official_Evidence` | ✅（登记了哪些官方文件；文件本身在 Drive，CMP-P5） | | | | |
| `Scheme_Status_Log` | ✅（你陈述或官方记录的状态） | | | | |
| `Plan_Line` | ✅（你的计划决定；`origin=OFFICIAL_NOTICE` 时是通知书的转录） | | | | |
| `Official_Payment` | ✅（官方记录） | | | | |
| `Payment_Link` | ✅（你确认的对应关系） | | | | |
| `Reimbursement_Event` | ✅（平台报告的事实，带证据；S2） | | | | |
| `Policy_Rule` | ✅（带版本与核实状态的参考数据；S3） | | | | |
| 对照结果、覆盖时间线、索偿状态、派生义务 | | | | ✅（查询时现算，不落地存表） | |

何时才改：批准 S1 之后，建表之前。

### 6.5 `VERIFICATION_STATUS.md`（沿用现有格式；全部是计划，**没有任何结果**）

> **Contribution Planning（提议新增一节）**

| Scope | Evidence source | Date | Result | Limitations |
|---|---|---|---|---|
| Static inspection（层级 1） | 设计文档 + 源码逐行核对（只读） | 2026-10-26 | DONE（设计层面） | 没有任何代码；官方政策经转述，待抽查；独立复核的范围与结果见交付报告，不在这里宣称 |
| Node tests（层级 2/3） | — | — | NOT DONE | 代码尚不存在 |
| Real GAS execution / Real Sheets persistence（层级 4/5）：V0–V7 | — | — | NOT DONE | 要你在副本上运行（设计 §10） |
| Independent source verification（层级 7）：V8、政策登记表 10 项抽查 | — | — | NOT DONE | 需要你的第一份真实收据；登记表经转述 |
| Production integration（层级 8）：V9 | — | — | NOT DONE | 另行授权 |

何时才改：有真实结果之后才追加行；不在设计阶段写「PASS」。

### 6.6 `901_System_Architecture.js` 的 `modules` 清单（`:118` 起；项目惯例，没有测试强制）

提案文本，`status` 取现有词汇 `Designed`（只有设计，没有代码）：

```
{ name: 'OfficialRecords（官方记录：栏位、校验、键、有效视图）', file: '180_OfficialRecords.js', status: 'Designed', note: '设计见 Contribution_Planning_Design_2026-10-26.md §2；没有代码' },
{ name: 'PlanComparison（计划 vs 实际对照引擎）',           file: '182_PlanComparison.js',   status: 'Designed', note: '设计 §3；查询时现算，不落地' },
{ name: 'SocsoCoverage（SOCSO 覆盖时间线；S2 起含索偿折叠）',   file: '184_SocsoCoverage.js',    status: 'Designed', note: '设计 §5；覆盖期是陈述值，系统不推算' },
{ name: 'PolicyRules（政策规则解析接口，S3）',                file: '186_PolicyRules.js',      status: 'Designed', note: '设计 §6.3；未核实的规则只返回 Rule_Pending' },
{ name: 'OfficialRecordsService（服务层与公开薄壳）',          file: '188_OfficialRecordsService.js', status: 'Designed', note: '设计 §4.8、§11.1' }
```

何时才改：代码存在之后；`status` 随 Built → Tested → Production 的实际进度更新（`901:291–299` 的指标函数读的是这份清单）。

### 6.7 `ARCHITECTURE.md` 的「PROPOSED / NOT YET IMPLEMENTED」一节（`:71` 起）

提案文本（一条）：

> - **缴款计划与官方付款记录（EPF / Tax / SOCSO）**（`ADR-DRAFT-CPR-1…5`，编号待定）——架构仍是 `PROPOSED`（Steven 尚未确认），所以放在这一节、不放进 CURRENT IMPLEMENTATION。目前只有设计文档与 ADR 草案，**没有代码、没有建表、没有验证**。推荐的最小切片 S1（官方记录核心 + SOCSO/EPF 缴款）需要 Architecture Freeze 例外，由 Steven 决定。

何时才改：你确认方向之后。

### 6.8 本设计没有提议的东西

- **没有新增 CMP 原则**：沿用 CMP-P1/P4/P5/P6/P7/P9/P10/P11/P12/P13/P14、CMP-CR4/CR5、UCR6、EP3/EP4。
- **没有改 `900_Constitution.js` 的 `changelog` 数组、`CHANGELOG.md`**：它们记录已发生的事；设计与草案不是代码变更，批准、实现与验证真的发生时才写。
- **没有改 `README.md`、governance 草案、任何现有 ADR。**
