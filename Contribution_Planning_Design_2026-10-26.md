# 缴款计划与官方付款记录：架构设计（EPF / Tax / SOCSO）

- **性质**：设计文档。内容只有架构分析、规则调查结论、设计与草案。**没有修改任何代码、测试、真实数据；没有写入 GAS、没有部署、没有调用 Gemini；没有建表；没有实现任何计算器或 PDF/LLM 提取**（授权 §1、§7）。文中出现的「伪代码/步骤」只是设计说明，不是可运行代码。
- **日期**：2026-10-26（2026-10-24 起草，10-26 定稿）。**分析对象**：你上传的 `07.Compliance-main.zip`（77 个文件，sha256 以 `2c52e947f8f0e76a` 开头），即 handoff 所说的「工作副本」（基线 zip 加上之后的修改），**不是** handoff 里记录的原始基线 zip（`e6e21a76…`，75 个成员）；handoff 附录里 17 个带哈希的文件，sha256 在这份 zip 里全部相符。解压后只读，没有改动任何文件。
- **配套文件**：`Official_Policy_Register_2026-10-23.md`（政策来源与 PENDING 清单）；`PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md`（独立只读调查，**与本设计互不依赖**）；`ADR_Drafts_Contribution_Planning_2026-10-26.md`（ADR 草案；待你决定的事项在本文 §11.3）；`tooling/phaseP_dup/`（Phase P 的一次性复现脚本，只读、用内存假对象，不联网，不属于本设计）。
- **证据标签**（沿用授权 §8）：
  - 【源码证实】= 我读了源码，附 `文件:行`。
  - 【官方证实】= 官方来源上有这句话，见政策登记表（经 WebFetch 转述，仍待你抽查）。
  - 【设计建议】= 我的设计，未实现、未验证。
  - 【待确认】= 需要你决定，或需要你提供资料。
  - 【PENDING】= 没有官方依据或需要真实环境验证；设计成可配置，不猜。
  - 【BLOCKED】= 因 robots/抓取失败读不到，没有绕过。
- **读法**：先读 §0；想看「该批准什么」直接跳到 §11。

---

## 0. 摘要

**这一轮要回答的问题**：EPF 缴款预算与实际缴款、税务分期计划与实际缴款、SOCSO 缴款预算与实际缴款（含精确到天的覆盖期、Grab 报销与对照），怎样放进现有 Compliance OS 架构，而且不重复造轮子、不覆盖历史、重复提交和失败重试时不产生分不清的重复记录。

**推荐方案（一句话）**：新增 **7 张 append-only 表**，全部经现有 `TruthWriter` 写入；每条记录用「业务键 + 序号」当身份（不是时间戳），修改只能追加新序号；计划与实际的对照、SOCSO 覆盖期、报销状态、日历提醒全部**查询时现算**，不存状态。

| # | 结论 | 标签 |
|---|---|---|
| 1 | 现有架构里没有任何地方存「计划」「官方付款」「报销」「政策规则」；`160_MonthlyProjection.js:422–443` 的 SOCSO 固定 49.40 与 EPF/Tax 的 `Not_Configured` 只是投影存根，注释自己写明「真正的官方缴费记录以后要作为独立的 Official Record 类型」（`160:410–415`），UI 里也有同样的提示（`170_OperatorConsole.html:534`）。仓库里与 EPF/Tax/SOCSO 有关的现有文字只有：`ARCHITECTURE.md:7,66`、`MODULE_CATALOG.md:97`、`ADR-000-independent-project.md:17,31`（归属：Compliance OS 拥有这类官方记录），以及 `compliance-os-daily-allocation-checkpoint-2026-08-25.md:67`「EPF/SOCSO/Tax 计算——明确排除在这次范围外，从未开始」；没有 EPF/Tax/SOCSO 专用的设计文档或表定义；相关测试只覆盖那个存根（`161_Tests_MonthlyProjection.js:331–338`、`171_Tests_OperatorConsole.js:204`）。真实 Sheet 里有没有你手工记的数据，压缩包里看不到（只有代码）【待确认】 | 【源码证实】；真实数据【待确认】 |
| 2 | **不复用 `Documents` 表存证据**：`consoleGetRecoveryStatus_` 会把**所有**没有对应 Verified_Income 的 Documents 行列成 Pending（或在有失败证据档时列成 Failed）（`170:427–490`），收据放进去会永远显示成「待处理的 PDF」；而且 `document_id` 的末段是 `now.getTime()`，同批多文件会撞号（Phase P 报告）。所以另建 `Official_Evidence`（你可选 E1/E2/E3，见 §11） | 【源码证实】【设计建议】 |
| 3 | **现有的幂等检查不够用**：存在性检查在锁外、靠调用方传入的快照（`140_VerifiedIncome.js:189–198`；Phase P 报告 R3–R5），而且 `TruthWriter` 的锁只包着「校验栏位 + `appendRow`」这一步，不包「这一行是否已经存在」的检查（`115_TruthWriter.js:31–46`，加锁在 `:33`），释放锁前也没有 `flush`（`115:90–102`），官方 Lock 文档建议释放前 flush【官方证实】。新记录要求「锁内重新读、再决定写不写」，这需要给 `TruthWriter` 加一个原语（P2 推荐；P3 不动 `115`、P1 打折，你决定，见 §4.5） | 【源码证实】【官方证实】【设计建议】 |
| 4 | **加栏位没有迁移工具，只有一条先例做法**：`ensureSheetSchema_` 表头不一致就抛错（`108:140–148`），`readAll` 栏位数不一致也抛错（`117:35`）；只有「加在表尾 + 手工补表头」有先例而且安全，插在中间会让旧数据整体错位（`140_VerifiedIncome.js:18–28`）。所以 7 张新表的栏位要**一次想清楚**，但不堆没有含义的备用栏；只保留一个具名栏位 `payer_channel` 来记录「你自己缴」这个陈述事实 | 【源码证实】【设计建议】 |
| 5 | **对照状态**：复用现有词汇 `Overdue`（`150:76–78` 同义）与 `Discrepancy_Flagged`（`130:89`，CMP-P12 的「只标注、不阻断」），新增 `Not_Planned / Planned / Partially_Paid / Paid / Overpaid / Not_Applicable`；优先序与边界见 §3 | 【设计建议】 |
| 6 | **SOCSO 覆盖期**：起止日是收据上写的、由你录入的「陈述值」（CMP-P5），系统**不推算**；官方只说「从缴款日期和时间起」，一次缴多个月怎么算官方没写（N7） | 【官方证实·有限】【PENDING】 |
| 7 | **Grab 报销独立于付款**：每个月一个「索偿」，用事件记录申请/批准/收到；与付款的对应只靠你明确建立的链接（`FUNDS` 链接），**不假设**付款就有报销 | 【设计建议】 |
| 8 | **EPF**：奖励规则放进带版本、带生效日、带核实状态的 `Policy_Rule`，没有官方依据的一律 PENDING；**第一阶段没有计算器**，预期奖励金额由你手动填 | 【设计建议】 |
| 9 | **Tax**：CP500 的每期金额与日期只能从正式通知书抄进来（带证据），从不推算；「尚未收到通知（NOT_NOTIFIED）」是一个明确状态 | 【设计建议】【官方证实·有限】 |
| 10 | **日历**：不建第二套提醒。计划行**派生**出义务，交给现有的 `evaluateObligation_` 与现有的 3 种事件；不新增事件类型，也不往 `Compliance_Calendar` 写重复行 | 【设计建议】 |
| 11 | `150_ComplianceCalendar.js:72` 用 UTC 日期分量算天数，脚本时区是 Asia/Singapore（`appsscript.json:2`），所以每天 00:00–08:00（马来西亚时间）会差一天。新引擎改成由调用方传入「脚本时区的今天」；150 本身的修正另案 | 【源码证实】【设计建议】 |
| 12 | **最小切片建议**：先做「官方记录核心 + SOCSO」（5 张表、纯函数引擎、写入原语、Node 测试、真实 GAS 验证），Grab 报销、税务通知、政策规则、日历派生分后续切片。详见 §11 | 【设计建议】 |

**需要你决定的事**（详见 §11.3）：本设计是否按 Architecture Freeze 的例外来批准（`compliance-os-governance-draft.md:420`）；证据登记用哪种方案（E1/E2/E3）；`TruthWriter` 用 P2（推荐）、P3 还是 P1；要不要通用备用栏（我推荐不要）；ADR 编号冲突；以及 Phase P 的修复范围（单独的授权）。

---

## 1. 差距分析：需要什么、现有什么、差在哪

判断列：**可复用** = 直接用；**部分可复用** = 用但有缺口；**冲突** = 不能用；**缺口** = 没有。

| # | 需要的能力 | 现有的东西 | 判断 | 本设计怎么处理 |
|---|---|---|---|---|
| 1 | 只增不改的写入出口 | `115_TruthWriter.js:31–46`：`appendValidatedRow` 在锁内校验栏位后 append | 部分可复用 | 缺两样：①「锁内重新读再决定写不写」的原语；②释放锁前 `flush`（`115:90–102`；官方 Lock 文档建议【官方证实】）→ 新原语（§4.5，决定 D-3） |
| 2 | 建表与表头校验 | `108_SheetSetup.js:48–105`（惰性 `buildSheetSchemas_`，避免 GAS 字母序载入时读到未赋值常量，`108:36–47`）；`116–163`（`ensureSheetSchema_`，表头不一致即抛错 `140–148`；textColumns 整列设 `'@'` `154–160`） | 部分可复用 | **没有加栏位迁移工具**（只有「表尾追加 + 手工补表头」的先例，`140:18–28`）；新表一次想清楚栏位；新增的栏位常量放各自模块，`buildSheetSchemas_` 里只引用 |
| 3 | 读取 | `117_SheetReader.js:32–42` `readAll`，栏位数不符即抛错（`:35`） | 可复用 | 同上；引擎只读「有效视图」，不直接用原始行 |
| 4 | 日期安全 | `106_Utils.js:32–44` `normalizeIsoDateString_`；CMP-CR4（`900_Constitution.js:223–226`）；`VERIFICATION_STATUS.md` 记录「textColumns 已设仍读回原生 Date」原因**未查明** | 可复用 | 所有日期读入一律经 `normalizeIsoDateString_`；整数日期分量 + `Date.UTC`；对外经 `sanitizeForClient_`（`170:71–94`） |
| 5 | 金额精度 | `106:12–14` `round2_`；CMP-P9（`900:166–169`） | 可复用 | 引擎内部用**整数分**。实算：JS 里 `0.2*12*250` = 600.0000000000001 |
| 6 | 稳定业务身份的先例 | `income_id = CMP-INCOME-{ISO 周}`（`140:88`）；CMP-P13（`900:190–194`） | 思路可复用，机制不够 | 先例的存在性检查靠调用方快照（`140:189–198`）；新记录把检查放进写入原语 |
| 7 | 不稳定身份（要避开） | `computeDocumentId_`（`110:39–47`）、`reconciliation_id`（`130:103`）、事件 id（`110:210`、`150:172`）末段都是 `now.getTime()` | 不得用于正式记录 | 业务键 + 序号（§4） |
| 8 | 正式文件登记 | `Documents`（`110:33–36`）+ Scan/Recovery（`170:190–208`、`427–490`） | 部分可复用，但会被污染 | 另建 `Official_Evidence`；E1 是复用 Documents 的备选（前置条件见 §11） |
| 9 | 义务与提醒 | `150_ComplianceCalendar.js`：`computeObligationStatus_`（`65–83`）、`evaluateObligation_`（`167–176`）、`recordCompletion_`（`156–158`）；EventPublisher 占位；`Compliance_Calendar` 没有任何真实义务（`VERIFICATION_STATUS.md` Calendar 一节） | 部分可复用 | 无「取消/被取代」概念；UTC 日期分量（`:72`）；扫描未接线 → 派生义务（§8） |
| 10 | 派生状态查询时算 | CMP-P6（`900:145–150`）、150 文件头注释、160 | 可复用的模式 | 对照结果、覆盖期、报销状态、提醒都是查询时现算 |
| 11 | 月度合规投影 | `160:422–443`：SOCSO 固定 49.40（标 `Projection`），EPF/Tax `Not_Configured`；Dashboard 卡片 `170_OperatorConsole.html:498,530–534,543` | **冲突**（第二个数字来源） | 决定 D-7：保留作回退并标注来源 / 改读计划行 / 并存 |
| 12 | 状态词汇 | 对账 `Matched/Discrepancy_Flagged/Not_Performed`（`130:89,132`）；日历 `Upcoming/Due_Soon/Overdue/Completed`（`150:65–83`）；160 `Needs_Allocation/Missing_Period/Projection/Not_Configured`（`160:179,185,313,426–438`） | 可复用词汇 | 复用 `Overdue`、`Discrepancy_Flagged`、`_source:'Projection'`（`160:313`）（§3.4） |
| 13 | 异常显性、注解不阻断 | CMP-P10（`900:171–175`）、CMP-P12（`900:183–188`） | 可复用 | `Discrepancy_Flagged` 只标注，不撤销已记录的事实 |
| 14 | 候选值先验证，LLM 不得直接写 Truth | CMP-P14（`900:196–200`）；`125_ExtractionValidation.js` | 可复用的原则 | 第一阶段 `entry_source` 只接受 `MANUAL_ENTRY`（§4.9） |
| 15 | 前端入口 | CMP-CR5（`900:228–231`）；`sanitizeForClient_`（`170:71–94`）；公开薄壳（`170:961–1005`） | 可复用 | 将来的面板同样走公开薄壳；UI 不在本期 |
| 16 | 测试基础设施 | `105_TestUtils.js:14–38`；契约测试 `190_Tests_Contracts.js:42`（只断言 TruthWriter **有** `appendValidatedRow`）；GAS 载入模拟 `195:38–42,96–111` | 可复用 | 新文件名含 `Tests` 才会被 195 排除；新原语和「没有更新/删除方法」都要补进契约测试（§9） |
| 17 | 政策参考数据 | 无 | 缺口 | `Policy_Rule`（§6） |
| 18 | 计划/预算 | 无（只有 160 的存根） | 缺口 | `Plan_Line` |
| 19 | 官方付款记录 | 无 | 缺口 | `Official_Payment`、`Payment_Link` |
| 20 | 报销记录 | 无 | 缺口 | `Reimbursement_Event` |
| 21 | 治理流程 | ADR 索引：下一个是 ADR-007（README L17），新 ADR 先 `PROPOSED`（L36）；Phase P 设计也暂用了 ADR-007（`PhaseP_…_2026-10-17.md:33,575`）；Architecture Freeze（`compliance-os-governance-draft.md:420`）；`MODULE_CATALOG.md:118` 提到的 `governance/` 目录不在上传的压缩包里 | 需要批准；有冲突 | `ADR-DRAFT-CPR-n` 临时编号；决定 D-1、D-13 |

**不需要新建的东西**（本设计刻意复用）：`TruthWriter` 单例与 `createTruthWriter_` 注入方式；`SheetReader`；`ensureSheetSchema_`/`setupComplianceOsSheets`；`computeObligationStatus_`/`evaluateObligation_`/三种既有事件；`normalizeIsoDateString_`/`round2_`；`sanitizeForClient_` 与公开薄壳惯例；`assertEqual_`/`fakeSheetAccessor_`/`fakeLockProvider_`。

**数据归属（提议，需批准；格式照 `DATA_OWNERSHIP.md:5–15`，并按该文件 `29–31` 的约定标为 PROPOSED）**

| 表 | Authoritative Source | Derived | Evidence/Audit | Projection |
|---|---|---|---|---|
| `Official_Evidence` | ✅（登记了哪些官方文件；文件本身在 Drive，CMP-P5） | | | |
| `Official_Payment` | ✅（官方记录） | | | |
| `Plan_Line` | ✅（你的计划决定；`origin=OFFICIAL_NOTICE` 时是通知书的转录） | | | |
| `Payment_Link` | ✅（你确认的对应关系） | | | |
| `Reimbursement_Event` | ✅（平台报告的事实，带证据） | | | |
| `Scheme_Status_Log` | ✅（你陈述或官方记录的状态） | | | |
| `Policy_Rule` | ✅（带版本与核实状态的参考数据） | | | |
| 对照结果、覆盖时间线、索偿状态、派生义务 | | | | ✅（查询时现算，不落地） |

**一页架构图**

```
 官方文件（Drive）
      │ evidence_id（文件哈希）
      ▼
 Official_Evidence ◄──────────────────────────────┐
      ▲                                           │
      │ notice_evidence_id          evidence_id   │
 Plan_Line ◄──(SETTLES)── Payment_Link ──► Official_Payment
  plan_key                  link_key         payment_key
      │                        │ (FUNDS)
      │                        ▼
 Scheme_Status_Log      Reimbursement_Event (claim_key)

 Policy_Rule ── 只被校验与展示读取，从不参与身份

 ───────────── 以下全是查询时的纯函数（不落地）─────────────
 有效视图（按序号取最新、去掉 VOID、检查完整性）
   ├─ 计划对照：每行 planned / settled / shortfall / 状态
   ├─ SOCSO 覆盖时间线：并集、缺口、重叠（精确到天）
   ├─ 索偿折叠：Opened → Applied → Approved → Received
   └─ 派生义务 → 现有 evaluateObligation_ → 现有 3 种事件
```


---

## 2. 数据模型：7 张 append-only 表

**状态**：【设计建议】全部是提议，**没有建表**（授权 §1）。表名与栏位名在批准前改动零成本；建表之后任何改动都等于迁移（`ensureSheetSchema_` 表头不一致即抛错，`108_SheetSetup.js:140–148`）。

### 2.1 授权要求的五类实体 → 表

| 授权 §3-A 的实体 | 落在哪 | 是不是表 |
|---|---|---|
| (1) 缴款/税款**计划** | `Plan_Line`（另有 `Scheme_Status_Log` 记录「尚未通知/尚未注册」这类状态） | 是（事实：你的计划决定，或通知书的转录） |
| (2) 实际**官方付款**记录 | `Official_Payment` | 是 |
| (3) **报销**记录（SOCSO） | `Reimbursement_Event`（事件流）+ `Payment_Link` 的 `FUNDS_CLAIM` 链接 | 是 |
| (4) 查询时的**对照结果** | 纯函数输出，带 `_source:'Projection'` | **不是表**（CMP-P6；`DATA_OWNERSHIP.md:18,26` 的同一规则） |
| (5) **证据/正式文件引用** | `Official_Evidence` | 是 |
| 付款↔计划、付款↔索偿的多对多关系 | `Payment_Link` | 是（需求 B：一笔付多个计划、一个计划多笔付款） |
| 政策参考数据（版本、生效日、核实状态） | `Policy_Rule` | 是（参考数据，不参与身份） |

### 2.2 为什么是这 7 张，而不是更少或更多

| 备选 | 否决理由 |
|---|---|
| 一张通用 `Official_Record` 表，用 `record_type` 区分计划/付款/链接/报销 | 栏位互相无关，一半是空的；每种类型的校验各不相同；授权 §3-A 要求「分开实体」 |
| 每个制度（EPF/Tax/SOCSO）× 每种实体各一张（6 张以上） | 授权 §3-A「不要重复建功能相同的表」；对照引擎要跨表合并；制度增加就要建新表 |
| 把 `plan_key` 直接做成 `Official_Payment` 的一个栏位，不要 `Payment_Link` | 做不到需求 B 的多对多（一笔付款对应多个月、一个计划多笔付款）；改链接就要改付款记录 |
| 复用 `Compliance_Calendar` 存计划 | 日历只存「义务的定义」（`DATA_OWNERSHIP.md:14`），没有金额、计划集、修订和取消（`150:25–29`、`133–150`）；强塞会破坏它的不可变语义 |
| 复用 `Compliance_Completions` 存付款 | 它只记「某义务完成了」，没有金额、参考号、覆盖期（`DATA_OWNERSHIP.md:15`；`150:156–158`），事件 id 还含时间戳（`150:172`） |
| 复用 `Documents` 存证据 | 见 §0 第 2 点（Recovery Center 污染 + 同批撞号）；备选 E1，见 §11 决定 D-2 |
| 政策规则放代码常量或 Script Properties | 失去生效日、版本历史、来源引用和审计，改一个数要重新部署。折中：S1/S2 不需要规则，规则表放到 S3（决定 D-6）；`resolveRule_` 接口先定好，提供者可替换 |

### 2.3 通用约定（对全部 7 张表生效，除非该表另有说明）

1. **只追加**（UCR6，见 `115_TruthWriter.js:3` 的文件头注释）：唯一写入口是 `TruthWriter`；没有更新、没有删除。注意：契约测试只断言 `TruthWriter` **有** `appendValidatedRow`（`190_Tests_Contracts.js:42`），并**没有**断言「没有别的方法」；「只增不改」目前只是现状（`createTruthWriter_` 只返回 `{ appendValidatedRow }`，`115:48`），不是被测试守住的约束。设计里建议补两条断言（§9）。【源码证实】
2. **记录链（entry chain）**：每条「逻辑记录」有一个业务键（第一栏），加 `entry_seq`（1,2,3…）和 `entry_type`。**有效状态 = 序号最大的那一行**；每一行都是**完整快照**，不是差异。
   - `ORIGINAL`：第一条（`entry_seq=1`）。
   - `REVISION`：情况变了（例如到期日改了）。
   - `CORRECTION`：之前录错了（例如金额打错）。引擎里 REVISION 与 CORRECTION 的处理完全一样，区别只用于审计。
   - `VOID`：这条逻辑记录作废（例如误登记）。带上一条有效快照 + 必填 `reason`。有效视图里被排除。若还有「有效的链接」指向它，写入时拒绝（§4）。
   - VOID 之后允许再来一条 `REVISION` 复活它（链上最后一条为准）。这样键是确定性的，也不会因为「键已被作废记录占用」而没法重新登记。
3. **业务键，不是时间戳**（CMP-P11；先例 `income_id=CMP-INCOME-{ISO 周}`，`140_VerifiedIncome.js:88`）。`recorded_at` 只用于审计，**不参与身份、也不参与「是否相同」的比较**。
4. **「相同」的定义**（幂等判断用）：同一个键 + 同一个 `entry_seq` + 除 `recorded_at` 以外所有栏位逐栏相等（比较前统一：文本去首尾空白，金额取整数分，日期取 ISO 字符串）。
5. **栏位类型**：
   - `ID/D/T/E/TS` = 文本；这些栏位全部列入 `textColumns`（整列设 `'@'`，`108:154–160`）。
   - `N/$` = 数字（`entry_seq`、`line_no`、`instalment_no`、`version`、金额）；**不**列入 `textColumns`，否则数字会变文本。
   - 日期：`YYYY-MM-DD` 字符串。校验用整数分量 + `Date.UTC` 往返比对（CMP-CR4，`900:223–226`），所以 `2026-02-30` 会被拒绝。**所有日期从 Sheet 读回一律先经 `normalizeIsoDateString_`**（`106:32–44`），因为「已设文本格式仍读回 Date 对象」的原因至今没查明（`VERIFICATION_STATUS.md`）。【源码证实】
   - 金额：必须 > 0 且最多 2 位小数；**超过 2 位直接拒绝，不静默四舍五入**（决定 D-10）。存数字，引擎内部转**整数分**——实算 `0.2*12*250` 在 JS 里是 `600.0000000000001`，用 `round2_`（`106:12–14`）只能在输出时兜底，不能当计算基础。【源码证实】
   - 空值：mapper 对每个栏位都显式给值，空的给 `null`（会写成 `''`）；`undefined` 会被 `TruthWriter` 抛错（`115:34–42`）。【源码证实】
6. **枚举是代码常量**：以后加枚举值只改代码，不需要迁移 Sheet。
7. **`entry_source`**：第一阶段只允许 `MANUAL_ENTRY`（授权 D6；CMP-P14）。任何别的值，校验层直接拒绝。
8. **备用栏位策略**（决定 D-5）——推荐：**不加**通用备用栏（`reserved_n`）。理由是核对过代码之后的结论：
   - 加栏位**没有迁移工具**：`ensureSheetSchema_` 发现表头与代码不一致就抛错（`108:140–148`），`readAll` 发现栏位数不一致也抛错（`117:35`）。【源码证实】
   - 但「**加在表尾 + 手工补表头**」有先例而且是安全的：`source_document_id`/`extractor_id` 就是这样加的，旧行读到的新栏位是空值；反过来插在中间会让旧数据整体错位，2026-08-22 因此让 Dashboard 崩溃（`140_VerifiedIncome.js:18–28`）。【源码证实】
   - 所以备用栏的价值很小：给它改名同样要手工改表头，和「表尾追加一栏」是同一个手工步骤，省不下什么，反而留下一堆永远为空、还要写校验强制为空的死栏位。
   - 唯一保留的「具名预留」是 `Official_Payment.payer_channel`：它记录授权 D3 的陈述事实（你自己缴，Grab 不自动扣款），第一阶段只允许 `SELF`；将来平台代扣（`PLATFORM_DEDUCTION`）出现时是同一个栏位，不是新栏位。
   - 如果你仍然想要备用栏，每表加 1–2 个即可，其余设计不变（决定 D-5 的另一个选项）。

### 2.4 `Official_Evidence`（19 栏）：证据与正式文件登记

键：`evidence_id`。记录链：是。

| # | 栏位 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 1 | evidence_id | ID | ✓ | `CMP-EVD-{KIND}-{H16}`（有文件）或 `CMP-EVD-{KIND}-REF-{REFNORM}`（无文件）；规则见 §2.11 |
| 2 | entry_seq | N | ✓ | |
| 3 | entry_type | E | ✓ | ORIGINAL/REVISION/CORRECTION/VOID |
| 4 | evidence_kind | E | ✓ | 初始枚举：EPF_STATEMENT / EPF_PAYMENT_RECEIPT / TAX_NOTICE_CP500 / TAX_NOTICE_REVISED / TAX_PAYMENT_RECEIPT / SOCSO_PAYMENT_RECEIPT / GRAB_STATEMENT / GRAB_REIMBURSEMENT_RECORD / BANK_RECORD / OTHER_OFFICIAL |
| 5 | scheme | E | ✓ | EPF/TAX/SOCSO/GRAB/NONE；与 `evidence_kind` 须相容 |
| 6 | issuer | T | ✓ | 出具机构，照文件印刷 |
| 7 | document_title | T | ✓ | 文件标题，照文件印刷 |
| 8 | official_reference | T | 条件 | 文件上印刷的参考号/收据号；键用 `-REF-` 形式时必填 |
| 9 | document_date | D | ✓ | 文件上印刷的日期；不得晚于「今天」（调用方传入的本地日期） |
| 10 | applicable_period | T | — | 文件适用期间/课税年，照印刷抄写，**系统不解析** |
| 11 | storage_kind | E | ✓ | DRIVE_FILE / PHYSICAL_COPY / PORTAL_ONLY |
| 12 | drive_file_id | T | 条件 | DRIVE_FILE 必填 |
| 13 | file_name | T | — | |
| 14 | file_hash_sha256 | T | 条件 | DRIVE_FILE 必填；64 位十六进制。哈希由薄壳层算好再传入（与 `110:95–99` 同做法），校验层只验格式 |
| 15 | accessible_location | T | ✓ | 将来怎么找到它：Drive 路径、门户菜单路径、抽屉里的位置 |
| 16 | entry_source | E | ✓ | 仅 MANUAL_ENTRY |
| 17 | note | T | — | |
| 18 | reason | T | 条件 | `entry_type≠ORIGINAL` 必填 |
| 19 | recorded_at | TS | ✓ | 系统写入时间，仅审计 |

文本栏 18、数字栏 1（`entry_seq`）。

### 2.5 `Scheme_Status_Log`（15 栏）：制度状态陈述

用途：记录「没有 CP500」「没有注册 i-Saraan Plus」这类**状态**（授权 D4/D5），并且保存状态变化的来源。键：`status_id`。记录链：是。

| # | 栏位 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 1 | status_id | ID | ✓ | `CMP-STS-{SCHEME}-{STATUS_KEY}-{PERIOD或ALL}-{YYYYMMDD}`（YYYYMMDD 即 `as_of_date`） |
| 2 | entry_seq | N | ✓ | |
| 3 | entry_type | E | ✓ | |
| 4 | scheme | E | ✓ | EPF/TAX/SOCSO |
| 5 | status_key | E | ✓ | 见下表 |
| 6 | period_key | T | ✓ | `YA2026` / `2026` / `ALL` |
| 7 | status_value | E | ✓ | 见下表 |
| 8 | as_of_date | D | ✓ | 这个状态「从哪天起」成立；同一 `status_key+period_key` 在某日的有效状态 = `as_of_date` 不晚于该日的最新一条 |
| 9 | basis | E | ✓ | USER_STATED / OFFICIAL_DOCUMENT |
| 10 | evidence_id | ID | 条件 | `REGISTERED/NOTIFIED/REVISED` 必填 |
| 11 | official_reference | T | — | |
| 12 | entry_source | E | ✓ | |
| 13 | note | T | — | |
| 14 | reason | T | 条件 | 非 ORIGINAL 必填 |
| 15 | recorded_at | TS | ✓ | |

初始 `status_key` / `status_value`（代码常量）：

| scheme | status_key | status_value 允许值 | 备注 |
|---|---|---|---|
| EPF | ISARAAN_PLUS_REGISTRATION | NOT_REGISTERED / REGISTERED | REGISTERED 必须带证据（授权 D4：「注册状态 + 来源证据」） |
| TAX | CP500_NOTICE（`period_key`=课税年） | NOT_NOTIFIED / NOTIFIED / REVISED | NOTIFIED/REVISED 必须带通知书证据；NOT_NOTIFIED 是明确状态，不是「没数据」 |
| SOCSO | PAYER_CHANNEL | SELF / PLATFORM_DEDUCTION | 目前陈述 SELF（授权 D3：Grab 无自动扣款）；PLATFORM_DEDUCTION 预留 |

**不存的东西**：「首个有营业收入的课税年」你自己也不确定（授权 D5），所以**不建这个状态**，系统也不会推断它；税务估算、收入归属、跨年税额都不在范围内。

文本栏 14、数字栏 1。

### 2.6 `Plan_Line`（21 栏）：计划行（预算 / 正式分期）

键：`plan_key`。记录链：是。一条计划行 = 某个计划集里、某个周期、某种项目的一笔应付/预期金额。

| # | 栏位 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 1 | plan_key | ID | ✓ | `CMP-PLN-{SCHEME}-{SET}-{KIND}-{PERIOD_KEY}` |
| 2 | entry_seq | N | ✓ | |
| 3 | entry_type | E | ✓ | |
| 4 | scheme | E | ✓ | EPF/TAX/SOCSO |
| 5 | plan_set | T | ✓ | `MAIN` 或 `ALT-{LABEL}`（用于跨方案预算比较，§6） |
| 6 | line_kind | E | ✓ | EPF_CONTRIBUTION / EPF_INCENTIVE_EXPECTED / TAX_INSTALMENT / SOCSO_CONTRIBUTION |
| 7 | scheme_option | T | — | 被比较的方案标签（例如常规自愿缴款 vs i-Saraan Plus）；纯文字，不影响计算 |
| 8 | period_key | T | ✓ | 月度 `YYYY-MM`；税务 `YA{YYYY}-I{NN}`；奖励行允许 `YYYY` 或 `YYYY-MM`（奖励怎么算尚未确认，见 §6） |
| 9 | instalment_no | N | 条件 | TAX_INSTALMENT 必填（整数 ≥ 1），且必须与 `period_key` 里的 `NN` 一致 |
| 10 | direction | E | ✓ | OUT（你付出）/ IN（预期收到，如 EPF 奖励）；与 `line_kind` 必须匹配 |
| 11 | planned_amount | $ | ✓ | > 0，≤ 2 位小数 |
| 12 | due_date | D | ✓ | 该日期前应付（预算：你自己定；正式通知：通知书上的应缴日期） |
| 13 | stated_deadline_date | D | — | 通知书明文写出的「最后期限」，只在原文有时填；**不由系统推算** |
| 14 | applicable_year | T | — | 课税年/缴款年，照来源抄写 |
| 15 | origin | E | ✓ | USER_PLAN / OFFICIAL_NOTICE |
| 16 | notice_evidence_id | ID | 条件 | `origin=OFFICIAL_NOTICE` 必填，且指向有效的 `Official_Evidence` |
| 17 | rule_id | ID | — | 你参考的 `Policy_Rule` 版本，仅供追溯，**不参与计算** |
| 18 | entry_source | E | ✓ | |
| 19 | note | T | — | |
| 20 | reason | T | 条件 | 非 ORIGINAL 必填 |
| 21 | recorded_at | TS | ✓ | |

- 文本栏 18、数字栏 3（`entry_seq`、`instalment_no`、`planned_amount`）。
- 同一周期内你打算分几次付，用「一条计划行 + 多个链接」表达，不需要两条计划行（需求 B）。
- **`TAX_INSTALMENT` 必须是 `origin=OFFICIAL_NOTICE`，且必须在 `MAIN` 计划集**：金额与日期只能从正式通知书抄进来，系统永不推算（授权 D5）。你要不要为税务另做一条**自备预算**（非官方）的行类型（例如 `TAX_SELF_RESERVE`），授权里没有提，我**没有设计**，列为待确认（§11，D-16）。

### 2.7 `Official_Payment`（22 栏）：实际官方付款记录

键：`payment_key`。记录链：是。一条 = 官方文件上的一笔付款（或收款：奖励入账、退税）。

| # | 栏位 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 1 | payment_key | ID | ✓ | `CMP-PAY-{SCHEME}-{KIND}-{TOKEN}-L{n}`，TOKEN = `REFNORM`，或无参考号时 `EVD-{H16}` |
| 2 | entry_seq | N | ✓ | |
| 3 | entry_type | E | ✓ | |
| 4 | scheme | E | ✓ | EPF/TAX/SOCSO |
| 5 | payment_kind | E | ✓ | EPF_CONTRIBUTION / EPF_INCENTIVE_CREDIT / TAX_PAYMENT / TAX_REFUND / TAX_OTHER / SOCSO_CONTRIBUTION |
| 6 | direction | E | ✓ | OUT / IN；须与 `payment_kind` 匹配（见下表） |
| 7 | amount | $ | ✓ | > 0，≤ 2 位小数 |
| 8 | payment_date | D | ✓ | 官方记录上的缴款日期；不得晚于「今天」 |
| 9 | official_reference | T | 条件 | 官方参考号/收据号，照印刷抄写 |
| 10 | reference_norm | T | 条件 | `official_reference` 的规范化形式；校验层重算并要求相等 |
| 11 | line_no | N | ✓ | 同一张官方凭据上的第几笔，从 1 起 |
| 12 | evidence_id | ID | 条件 | 指向有效的 `Official_Evidence` |
| 13 | evidence_exception_reason | T | — | 仅当你批准「允许无凭证例外」（D-12 选项 b）时可填；推荐选项 a 下必须为空 |
| 14 | payer_channel | E | ✓ | 记录授权 D3 的陈述事实「你自己缴」：第一阶段只允许 SELF；将来平台代扣时用 PLATFORM_DEDUCTION（同一个栏位） |
| 15 | coverage_start | D | 条件 | 仅 SOCSO；见下 |
| 16 | coverage_end | D | 条件 | 仅 SOCSO；**含当日**（设计约定，见下） |
| 17 | coverage_basis | E | 条件 | 仅 SOCSO：PRINTED_ON_RECEIPT / PERKESO_PORTAL_RECORD / USER_STATED / NOT_STATED |
| 18 | applicable_period | T | — | EPF/Tax 的适用期间文字（如 `2026-10`、`YA2026`），照抄不解析；SOCSO 留空 |
| 19 | entry_source | E | ✓ | |
| 20 | note | T | — | |
| 21 | reason | T | 条件 | 非 ORIGINAL 必填 |
| 22 | recorded_at | TS | ✓ | |

`payment_kind` 与方向、可链接的计划行（`SETTLES` 链接的**相容矩阵**，代码常量）：

| payment_kind | direction | 可链接的 line_kind | 对该行已结清金额的作用 |
|---|---|---|---|
| EPF_CONTRIBUTION | OUT | EPF_CONTRIBUTION | 加 |
| EPF_INCENTIVE_CREDIT | IN | EPF_INCENTIVE_EXPECTED | 加 |
| TAX_PAYMENT | OUT | TAX_INSTALMENT | 加 |
| TAX_REFUND | IN | TAX_INSTALMENT | **减**（退款抵减） |
| TAX_OTHER | OUT | （无） | 只登记、不对照：例如余额税款（官方页说它不是 CP500 分期，年度结算的税额计算不在本期范围，见政策登记表 POL-TAX-04） |
| SOCSO_CONTRIBUTION | OUT | SOCSO_CONTRIBUTION | 加 |

符号规则一句话：付款方向与计划行方向相同则加，相反则减。**不允许跨制度链接**；没有可链接目标的种类（目前只有 `TAX_OTHER`）不能建立 `SETTLES` 链接，也不会出现在 `Not_Planned` 里（§3.7）。

- **SOCSO 覆盖期**：`coverage_basis≠NOT_STATED` 时 `coverage_start`、`coverage_end` 必填且 `start ≤ end`；`NOT_STATED` 时两者必须为空，这笔付款在时间线里显示为「覆盖期未陈述」，**绝不自动补齐**（授权 D3：不推断正式保障规则）。`coverage_end` 在本设计里一律解释为「受保障的最后一天（含）」；如果官方记录的措辞含义不明，写进 `note` 并列入待确认。EPF/Tax 付款这三栏必须为空，不套用 SOCSO 覆盖模型（授权 B）。【设计建议】
- **凭证要求**（决定 D-12）：推荐选项 a——`official_reference` 与 `evidence_id` **至少有一个**；两者都没有，就没有稳定身份，也就不能登记为官方付款（你丢了收据时，这笔钱在系统里仍是「计划/逾期」，直到拿到官方记录）。选项 b 才允许 `evidence_exception_reason` 非空，并在对照里永久带 `NO_EVIDENCE` 标注。
- **重复凭据保护**：同一个 `evidence_id` + 同一个 `line_no` 只能有一条**有效**付款（写入时在锁内检查，§4）；不同键但 `(scheme, payment_kind, amount, payment_date)` 完全相同，对照时标注 `POSSIBLE_DUPLICATE`（只标注，不阻断，CMP-P12）。
- **官方参考号是身份的一部分**（有意的取舍）：同一张收据无论扫描成几个文件，参考号相同就是同一个键，这是防止「同一张收据登记两次」最强的一道防线。代价是参考号抄错了不能用 `CORRECTION` 改：要 `VOID` 这一条（先处理它的链接），用正确的参考号重新登记，再重建链接。没有参考号、只有文件时，身份取决于文件哈希（`EVD-{H16}`）：同一张收据的两份不同扫描会被当成两个身份，只能靠上面的 `POSSIBLE_DUPLICATE` 标注发现。

文本栏 19、数字栏 3（`entry_seq`、`amount`、`line_no`）。

### 2.8 `Payment_Link`（11 栏）：付款与计划/索偿的对应关系

键：`link_key`。记录链：是。链接是**事实**（你确认了哪笔钱结清了哪一行），不是推算。

| # | 栏位 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 1 | link_key | ID | ✓ | `CMP-LNK-{S或F}-{payment_key}~{target_key}`（S=SETTLES，F=FUNDS_CLAIM；`~` 不会出现在任何键里，所以拆分无歧义） |
| 2 | entry_seq | N | ✓ | |
| 3 | entry_type | E | ✓ | |
| 4 | link_kind | E | ✓ | SETTLES（付款→计划行）/ FUNDS_CLAIM（付款→索偿，仅 SOCSO） |
| 5 | payment_key | ID | ✓ | |
| 6 | target_key | ID | ✓ | SETTLES 指 `plan_key`；FUNDS_CLAIM 指 `claim_key` |
| 7 | allocated_amount | $ | ✓ | > 0，≤ 2 位小数。SETTLES：这笔付款有多少算在这行上；FUNDS_CLAIM：这笔付款的多少归到这个索偿（**系统不按比例拆分，由你陈述**） |
| 8 | entry_source | E | ✓ | |
| 9 | note | T | — | |
| 10 | reason | T | 条件 | 非 ORIGINAL 必填 |
| 11 | recorded_at | TS | ✓ | |

文本栏 9、数字栏 2（`entry_seq`、`allocated_amount`）。

写入时在锁内检查（§4.4）：付款与目标都存在且有效；制度相容；同一笔付款所有有效 SETTLES 链接的 `allocated_amount` 之和 ≤ 付款金额（超额分配）。

### 2.9 `Reimbursement_Event`（18 栏）：Grab 报销事件流

键：`claim_key` + `event_seq`。一个「索偿」= 某平台、某制度、某个月的一次报销；它的状态由事件**折叠**得出，不存状态。依据：Grab 页面写的是「每月自行向 SOCSO 缴款，符合条件则次月 10 日前报销」，等级按月决定，所以报销是**每个月一个独立项目**，不是一笔付款对一笔报销（政策登记表 POL-GRAB-01）。Grab 的申请/审批/到账流程与所需文件没有官方资料（N9）：下面的事件类型是最小假设，真实记录出现之前不建表（决定 D-17）。

| # | 栏位 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 1 | claim_key | ID | ✓ | `CMP-RMB-{PLATFORM}-{SCHEME}-{FOR_PERIOD}` |
| 2 | event_seq | N | ✓ | 同一 `claim_key` 内 1,2,3… 严格递增 |
| 3 | event_type | E | ✓ | CLAIM_OPENED / CLAIM_APPLIED / CLAIM_APPROVED / CLAIM_REJECTED / CLAIM_RECEIVED / VOID_EVENT |
| 4 | platform | E | ✓ | GRAB |
| 5 | scheme | E | ✓ | SOCSO |
| 6 | for_period | T | ✓ | `YYYY-MM`，这次报销针对哪个月 |
| 7 | platform_tier | T | — | 你的 Grab 正式记录上写的当月等级，照抄不解释（例如页面上出现过 Ultimate/Platinum/Gold 这类字样）；折叠时取最新的非空值 |
| 8 | event_date | D | ✓ | 事件发生日期（平台记录上的日期） |
| 9 | amount | $ | 条件 | APPLIED=申请额；APPROVED=批准额；RECEIVED=实收额；OPENED/REJECTED 为空 |
| 10 | application_reference | T | 条件 | 平台的申请编号/记录 |
| 11 | receipt_reference | T | 条件 | RECEIVED 的到账凭据编号 |
| 12 | evidence_id | ID | 条件 | 你的正式 Grab 报表/通知 |
| 13 | voids_event_seq | N | 条件 | 仅 VOID_EVENT：要作废第几个事件 |
| 14 | payout_method | T | — | 报销怎么到账（转账/钱包…），照实写 |
| 15 | entry_source | E | ✓ | |
| 16 | note | T | — | |
| 17 | reason | T | 条件 | VOID_EVENT 必填 |
| 18 | recorded_at | TS | ✓ | |

- 事件流**不用** ORIGINAL/REVISION：想改一个已记录的事件，就追加 `VOID_EVENT`（指向那个事件序号）再追加正确的新事件。这比「覆盖」更接近 Grab 流程本身的先后顺序，也不需要另一套更正语义。
- **`APPLIED`、`APPROVED` 都是可选的**：Grab 页面没有写需不需要「申请」，也没有写审批、支付方式、所需文件（政策登记表 POL-GRAB-01、N9）。所以 `OPENED → RECEIVED` 是合法的链；如果你的 Grab 流程有申请和批准，再记录它们。事件类型是我按你描述（申请/批准/收到）设计的，不是 Grab 的官方流程。【PENDING】
- 凭证要求的第一版：`APPLIED/APPROVED/RECEIVED` 至少有 `application_reference`、`receipt_reference`、`evidence_id` 之一；`OPENED/REJECTED` 不要求，原因写进 `note`。你的 Grab 对账单长什么样我没有见过，所以证据种类先设计成通用的（`GRAB_STATEMENT`/`GRAB_REIMBURSEMENT_RECORD`），列为待确认。【PENDING】
- `CLAIM_RECEIVED` 重复保护：同一 `claim_key` 内，`(event_date, amount, receipt_reference 或 evidence_id)` 相同的有效 RECEIVED 事件不允许第二条（锁内检查）。

文本栏 15、数字栏 3（`event_seq`、`amount`、`voids_event_seq`）。

### 2.10 `Policy_Rule`（23 栏）：政策规则（带版本与核实状态）

键：`rule_id`（= `CMP-RUL-{rule_key}@{version}`）。写入走同一个原语，但**没有 `entry_type`**：链的键是 `rule_key`，序号是 `version`（必须等于现有最大版本 + 1）；更正 = 新版本；撤回 = 追加一个 `verification_status=WITHDRAWN` 的更高版本。**解析规则**（`resolveRule_`，§6）：在「生效区间包含查询日期」的版本里取**版本号最大**的那个。这样旧版本不需要被改写——只增表里没法回头给旧版本补 `effective_to`，所以「区间不得重叠」这种规则在这里行不通。它是**参考数据**，只被校验和展示读取，**永远不参与任何记录的身份**。

| # | 栏位 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| 1 | rule_id | ID | ✓ | |
| 2 | rule_key | T | ✓ | 小写点号命名，如 `tax.cp500.payment_grace_days`；字符集 `a-z 0-9 . _ -` |
| 3 | version | N | ✓ | 整数 ≥ 1 |
| 4 | scheme | E | ✓ | EPF/TAX/SOCSO/GRAB |
| 5 | value_type | E | ✓ | INTEGER / AMOUNT / RATE / TEXT / DATE / BOOLEAN |
| 6 | value | T | 条件 | **存文本**（防止 Sheets 把 `1/2` 变成日期）；按 `value_type` 解析；PENDING 时可为空 |
| 7 | unit | E | — | MYR / PERCENT / DAYS / NONE |
| 8 | scope_key | T | — | 适用范围，如 `YA2026`、某方案名；空 = 通用 |
| 9 | effective_from | D | 条件 | OFFICIAL 必填 |
| 10 | effective_to | D | — | 空 = 至今有效 |
| 11 | applicable_year | T | — | |
| 12 | eligibility_note | T | — | 资格与条件的原文摘要 |
| 13 | verification_status | E | ✓ | OFFICIAL / PENDING / LEAD / WITHDRAWN |
| 14 | source_name | T | 条件 | OFFICIAL 必填：来源机构/文件名 |
| 15 | source_title | T | 条件 | OFFICIAL 必填：页面/文件标题 |
| 16 | source_location | T | 条件 | OFFICIAL 必填：可访问位置（网址或 Drive 路径） |
| 17 | source_published_date | D | — | 来源的发布/生效日期 |
| 18 | source_retrieved_date | D | 条件 | OFFICIAL 必填：你/我核实的日期 |
| 19 | evidence_id | ID | — | 若你已把该文件登记为证据 |
| 20 | unconfirmed_items | T | 条件 | PENDING/LEAD 必填：哪些点尚未确认 |
| 21 | entry_source | E | ✓ | |
| 22 | reason | T | 条件 | `version>1` 必填 |
| 23 | recorded_at | TS | ✓ | |

规则：`OFFICIAL` 必须带完整来源（机构、标题、可访问位置、核实日期）；第三方文章只能是 `LEAD`，不能是 `OFFICIAL`（授权 §4）；`PENDING` 必须写明哪些点尚未确认。文本栏 22、数字栏 1（`version`）。

### 2.11 业务键构造规则

**`REFNORM`（官方参考号的规范化，用于键）**：去首尾空白 → 转大写 → 删除所有空白字符 → 只允许 `A–Z 0–9 . _ / - #`，长度 1–64。**出现其他字符就拒绝并提示，不静默剔除**——静默剔除会把两个本来不同的参考号并成一个。非 ASCII 字符（如全角数字）同样拒绝。

**`H16`**：`file_hash_sha256` 的前 16 个十六进制字符，大写。不同文件撞 H16 的概率可以忽略；万一撞了，两条记录的内容必然不同，写入走 `Conflict`（§4），**不会静默合并**。

| 键 | 格式 | 示例（虚构） |
|---|---|---|
| evidence_id（有文件） | `CMP-EVD-{KIND}-{H16}` | `CMP-EVD-SOCSO_PAYMENT_RECEIPT-0123456789ABCDEF` |
| evidence_id（无文件） | `CMP-EVD-{KIND}-REF-{REFNORM}` | `CMP-EVD-TAX_NOTICE_CP500-REF-EXAMPLE-0001` |
| status_id | `CMP-STS-{SCHEME}-{STATUS_KEY}-{PERIOD或ALL}-{YYYYMMDD}` | `CMP-STS-TAX-CP500_NOTICE-YA2026-20261024` |
| plan_key | `CMP-PLN-{SCHEME}-{SET}-{KIND}-{PERIOD_KEY}` | `CMP-PLN-SOCSO-MAIN-SOCSO_CONTRIBUTION-2026-11` |
| payment_key | `CMP-PAY-{SCHEME}-{KIND}-{TOKEN}-L{n}` | `CMP-PAY-SOCSO-SOCSO_CONTRIBUTION-EXAMPLE-0001-L1` |
| link_key | `CMP-LNK-{S或F}-{payment_key}~{target_key}` | `CMP-LNK-S-CMP-PAY-…-L1~CMP-PLN-…-2026-11` |
| claim_key | `CMP-RMB-{PLATFORM}-{SCHEME}-{FOR_PERIOD}` | `CMP-RMB-GRAB-SOCSO-2026-11` |
| rule_id | `CMP-RUL-{rule_key}@{version}` | `CMP-RUL-tax.cp500.payment_grace_days@1` |

所有键都只由**业务事实**构成（制度、种类、周期、官方参考号、文件哈希），没有时间戳、没有随机数、没有自增序号（除了凭据内的行号 `L{n}` 和记录链序号），所以「同一件事提交两次」必然得到同一个键。

### 2.12 有效视图（effective view）与完整性检查

引擎和所有查询**只读有效视图**，不直接用原始行：

1. 按键分组；每组取 `entry_seq` 最大的一行；最后一行是 `VOID` → 该逻辑记录不在有效集里（另放进「已作废」列表供展示）。
2. 完整性检查（**标注，不抛错**，CMP-P12）：同一键同一序号出现两行（相同内容 = 无害重复，取后一行；内容不同 = `AMBIGUOUS_ENTRY`）；序号跳号；链上第一条不是 `ORIGINAL`。每条问题进入结果里的 `integrity_issues`，对应的计划行/付款状态变为 `Discrepancy_Flagged`（§3）。
3. 这些问题正常情况下不会出现——写入原语在锁内保证序号严格递增（§4）；它们只会来自在 Sheet 里手工改动，或将来某个写入路径的缺陷。

### 2.13 行级校验（纯函数，写入前对每一行执行）

每张表一个校验函数，输入是候选行对象 + 调用方传入的 `todayParts`（脚本时区的今天，**不在函数内取当前时间**，这样 Node 测试可以固定日期），输出 `{ok, errors[]}`，**一次返回所有错误**，不是遇到第一个就停。上面各表「必填/条件」列的规则、枚举、键的重新构造、`REFNORM` 重算、金额位数、日期真实性、制度/种类/方向相容矩阵都在这里。**跨记录的规则**（对象是否存在、超额分配、VOID 时是否还有有效链接、重叠生效区间、重复凭据行）不在这里，在锁内的回调里做（§4.4）。

### 2.14 Schema 注册与载入顺序（实施时的注意事项，现在不做）

- 新增 7 张表要改 `buildSheetSchemas_`（`108:48–105`）。这是已批准文件，需要 Architecture Freeze 例外（`compliance-os-governance-draft.md:420`）。**连带**：`109_Tests_SheetSetup.js:25–28` 断言 `buildSheetSchemas_()` 的表名**恰好**是现有 7 张，登记新表之后这条会失败，必须同步修改（这是改既有断言，不只是新增）；同文件 `:42–45` 对**每一张**表检查 `textColumns ⊆ columns`，新表必须满足；其余断言按表逐个检查（`:32–38`、`:49–90`），不受影响。走「零改动路线」（新模块自带建表函数，§11 决定 D-1 选项 c）则 `108` 与 `109` 都不用动。【源码证实】
- GAS 按文件名字母序载入成同一个全局作用域；`buildSheetSchemas_` 是惰性的，正是为了避免载入顺序读到未赋值的常量（`108:36–47`）；`195_Tests_GasLoadSimulation.js:38–42,96–111` 会模拟载入并检查重名的顶层函数。所以新文件里的栏位常量必须是**纯字面量**，不能在载入时引用别的文件的值；函数名要带模块前缀避免撞名。【源码证实】
- 临时文件编号 180–189（`180_OfficialRecords.js` 等）排在 170 之后、`190_Tests_*` 之前；最终编号等 File Map 批准（`compliance-os-governance-draft.md:348–356`）。
- 新增 `TruthWriter` 原语后，要在 `190_Tests_Contracts.js:42` 旁补两条断言：①有 `appendEntryIfNext`；②没有名字含 update/delete/remove/overwrite 的方法（把「只增不改」从现状变成可检验的约束，§9）。【源码证实】

| 表 | 栏位数 | 文本栏（设 `'@'`） | 数字栏 |
|---|---|---|---|
| Official_Evidence | 19 | 18 | 1 |
| Scheme_Status_Log | 15 | 14 | 1 |
| Plan_Line | 21 | 18 | 3 |
| Official_Payment | 22 | 19 | 3 |
| Payment_Link | 11 | 9 | 2 |
| Reimbursement_Event | 18 | 15 | 3 |
| Policy_Rule | 23 | 22 | 1 |
| 合计 | 129 | | |

**将来要加栏位时的做法**（先例：`140:18–28`；这里只是写下步骤，不是现在要做）：①在代码的 `columns`（文本栏还要加进 `textColumns`）**末尾**追加；②在 Sheet 第 1 行**手工**补上新表头；③部署；④运行 `setupComplianceOsSheets` 让新栏套上文本格式。②和③不管先做哪一个，两步之间读取都会抛错：`getAllRows` 用 `sheet.getLastColumn()` 取宽度（`115:85`），代码的栏位数和 Sheet 的栏位数暂时对不上，`readAll` 就会抛（`117:35`）。窗口只有这两步之间的时间，单人使用可以接受，但要在不用控制台的时候做。（`ensureSheetSchema_` 本身不受这个窗口影响：它只逐栏比较代码里列出的那几栏的表头，`108:140`，表尾多出来的栏位不会让它抛错。）**永远不要插在中间。** 另外同样的原因：不要在这些表的数据区右侧手写备注——任何单元格内容都会撑宽 `getLastColumn()`，让 `readAll` 抛错。【源码证实】


---

## 3. 计划与实际的对照规则（查询时计算）

**状态**：【设计建议】。没有实现，也没有写原型代码（授权 §7）；附录 B 里的数字是我手算的场景，用来检验规则本身。

### 3.1 性质、输入与输出

- **纯函数**：不读时钟、不做 I/O、不改输入、同样输入必得同样输出。依据：CMP-P6「可推导的状态查询时算，不存栏位」（`900_Constitution.js:145–150`）；先例是 `computeObligationStatus_`，同样不碰 I/O（`150:57–64`）。【源码证实】
- **输入**：
  - 有效视图（§2.12）：`Plan_Line`、`Official_Payment`、`Payment_Link`（这里只用 `SETTLES` 类）、`Scheme_Status_Log`；
  - `asOfParts = {year, month, day}`：调用方在脚本时区算好后传入。引擎内部**永远不调用 `new Date()`**，所以 Node 测试可以固定日期，也不会重蹈 `150:72` 用 UTC 取日期分量的问题（§0 第 11 点）；
  - `planSet`（默认 `MAIN`）；
  - 可选 `rules`（`resolveRule_` 的数据源，§6；没有就不使用任何规则）。
- **输出**：每条有效计划行一个结果对象；外加 `unallocated_payments`、`other_payments`、`voided`、`integrity_issues`、`totals`。

| 结果栏位 | 含义 |
|---|---|
| plan_key / scheme / line_kind / plan_set / period_key / direction | 照计划行 |
| planned_cents / settled_cents / shortfall_cents / excess_cents | 整数分。`shortfall = max(P−S, 0)`，`excess = max(S−P, 0)` |
| status | 主状态（§3.2） |
| money_status | 只按金额和日期算出的状态；`status=Discrepancy_Flagged` 时保留「没有完整性问题时会是什么」，不让信息丢失 |
| flags[] / issues[] | 标注（§3.7）；`issues` 是导致 `Discrepancy_Flagged` 的完整性问题 |
| due_date / deadline_date / deadline_basis | 见 §3.4 |
| settled_on | 把累计结清额推到 ≥ 计划额的那笔付款的日期（§3.6）；没结清则空 |
| days_to_deadline | `deadline − asOf`（天）；负数 = 已过期限；`money_status` 为 `Paid`/`Overpaid` 时为空（与 `150:69–71` 的 `Completed` 回传 `days_remaining: null` 一致） |
| payments[] | 每个贡献的付款：`payment_key, payment_date, allocated_cents, signed_cents` |
| _source | 固定 `'Projection'`（`160:313` 同做法）：提醒前端这不是官方记录本身 |

金额一律在整数分上计算；对外输出再换成两位小数（§2.3-5）。

### 3.2 状态词汇：复用与新增

先查了现有枚举（授权 §3-B）：对账 `Matched/Discrepancy_Flagged/Not_Performed`（`130:89,132`）；日历 `Upcoming/Due_Soon/Overdue/Completed`（`150:76–82`）；月度投影 `Needs_Allocation/Missing_Period/Projection/Not_Configured`（`160:179,185,313,426–438`）。【源码证实】

同时核对了治理/设计文档：`compliance-os-daily-allocation-phase2-design.md:23–29` 的现有枚举表（与上面一致，另列 `110` 的 `Imported/Already_Imported/Duplicate_Skipped`）和 `:31–34` 的「决定」——它的做法是**能沿用既有词就沿用，没有对应词才造新词**（checksum 沿用 `Matched/Discrepancy_Flagged`，完整度用新词 `Fully_Allocated/Partially_Allocated/Needs_Review`）。本设计照同一做法：复用 `Overdue`、`Discrepancy_Flagged`；其余 6 个是新词。`Not_Planned`、`Planned`、`Partially_Paid`、`Paid`、`Overpaid`、`Not_Applicable` 这 6 个词作为状态词，在整个仓库的 js/html/md 里**一个文件都没出现过**（`Paid` 只在 `160_MonthlyProjection.js:413` 的一句注释里当普通英文词出现，不是状态值），不会与现有词冲突。【源码证实】

| status | 含义 | 来源 |
|---|---|---|
| `Not_Planned` | 有付款（或付款的一部分）没有任何计划行承接 | 新增 |
| `Planned` | 还没到期限，一分钱都没结清 | 新增 |
| `Partially_Paid` | 已结清一部分，还没到期限 | 新增 |
| `Paid` | 已结清（`S = P`） | 新增 |
| `Overdue` | 过了期限仍未结清（可能是部分结清，用 `PARTIAL` 标注区分） | **复用**：与日历同词同义，到期日之后且未完成（`150:76–77`） |
| `Overpaid` | 结清额超过计划额 | 新增 |
| `Discrepancy_Flagged` | 存在完整性问题，需要人看一眼 | **复用**：`130:89` 的同一个词；CMP-P12「只标注、不阻断」，不撤销任何已记录的事实 |
| `Not_Applicable` | 逻辑记录已作废（VOID），只出现在 `voided` 列表里用于审计 | 新增 |

**没有复用 `Upcoming/Due_Soon/Completed` 的原因**：那是日历的「紧迫度」词汇（含提醒提前天数）；对照回答的是「钱与计划对得上没有」。两种词汇放在同一个对象上会让人误以为是一回事。紧迫度由 §8 的派生义务交给日历去判断：行状态 `Paid/Overpaid` ↔ 日历 `Completed`。

### 3.3 已结清金额（settled）

对计划行 `L`，`S(L) = Σ 符号 × 分配额`，求和对象是目标为 `L.plan_key` 的**有效** `SETTLES` 链接：

- 符号：付款方向与 `L.direction` 相同取 `+1`，相反取 `−1`（退款抵减，§2.7 的矩阵）。
- 分配额：链接的 `allocated_amount`（整数分）；**不是付款的全额**。付款里没被分配的部分不影响任何计划行（见 §3.7）。
- 链接指向已作废/不存在的付款或计划行 → 该链接**不计入**，同时记 `DANGLING_LINK`（完整性问题）。
- **按业务日期截至 `asOf`**：只有 `payment_date ≤ asOf` 的付款计入（所以可以回看「某一天的状况」）；记录时间 `recorded_at` 不参与。计划行没有生效日，回看历史时用的是**当前有效版本**——本期不重建「当时的计划」（那需要按 `recorded_at` 截断，而 `recorded_at` 只用于审计）。
- 只有 `MAIN` 计划集的行可以被链接结清（写入时锁内检查，§4.4）；`ALT-*` 行不结清，只做预算比较（§3.10）。

### 3.4 期限（deadline）

| 情形 | `deadline_date` | `deadline_basis` |
|---|---|---|
| 行上填了 `stated_deadline_date`（通知书明文写出的最后期限） | 该日期 | `STATED_DEADLINE` |
| `TAX_INSTALMENT`，没填，且规则 `tax.cp500.payment_grace_days` 已核实（`OFFICIAL`） | `due_date + 宽限天数` | `DUE_DATE_PLUS_RULE_GRACE` |
| `TAX_INSTALMENT`，没填，规则是 `PENDING`/缺失 | `due_date` | `DUE_DATE_ONLY_RULE_PENDING`，并带标注 `DEADLINE_RULE_PENDING` |
| `EPF_*`、`SOCSO_CONTRIBUTION`（你自己定的预算） | `due_date` | `PLANNED_DUE_DATE` |

政策登记表里该规则的取值是 30 天，但登记为「OFFICIAL（待抽查）」，所以**默认不假设它已核实**：只有 `Policy_Rule` 里真的有一条 `OFFICIAL` 版本，引擎才会用；没有就退回 `due_date` 并明说。这样「通知书上的应付日期」和「宽限后的最后缴款日」是两个不同的日期，分开呈现（政策登记表 POL-TAX-02 的设计影响）。【设计建议】

对 `EPF_*`、`SOCSO_CONTRIBUTION` 这类**你自己定日期的预算行**，`Overdue` 的意思是「超过了你自己定的日期」，不是官方逾期（官方并没有给自雇 SOCSO 或 EPF 自愿缴款设这样的期限，见政策登记表 POL-SOC-07）；界面要写成「逾期（相对你自己定的日期）」。

### 3.5 状态判定表（自上而下，第一个命中的生效）

记 `P` = 计划额（分），`S` = 已结清额（分），`asOf` = 调用方传入的今天，`deadline` = §3.4 的期限。

| 优先级 | 条件 | `status` | 备注 |
|---|---|---|---|
| 1 | 计划行已作废 | `Not_Applicable` | 不进主列表，放 `voided` |
| 2 | 该行存在完整性问题（§3.7 上半表），包括 `S < 0` | `Discrepancy_Flagged` | `money_status` 同时给出按金额算出的状态 |
| 3 | `S > P` | `Overpaid` | `excess = S − P` |
| 4 | `S = P` | `Paid` | 若 `settled_on > deadline` 则带 `PAID_LATE` |
| 5 | `0 < S < P` 且 `asOf > deadline` | `Overdue` | 带 `PARTIAL`；`shortfall = P − S` |
| 6 | `S = 0` 且 `asOf > deadline` | `Overdue` | `shortfall = P` |
| 7 | `0 < S < P` 且 `asOf ≤ deadline` | `Partially_Paid` | |
| 8 | `S = 0` 且 `asOf ≤ deadline` | `Planned` | |

边界约定：

- 比较的是**日期**，不是时刻：全程用整数日编号（`Date.UTC(y, m−1, d) / 86400000`，CMP-CR4；`150:49–55` 的 `daysBetween_` 是同一做法）。【源码证实】
- `asOf` 恰好等于 `deadline` → **没有逾期**（与 `150:76` 的 `daysRemaining < 0` 一致）。
- 校验保证 `P > 0`，所以不存在 `P = 0` 的行。
- 状态只由 `P`、`S`、`asOf`、`deadline` 和完整性问题决定，**与链接/付款的录入先后无关**。

**转换规则**（授权 §3-B 要求「准确含义及转换规则」）。状态不是存下来的，所以「转换」指的是：**什么事件改变了 `P`、`S`、`asOf`、`deadline` 或完整性问题，使下一次查询得到不同的状态**。下表列出全部会引起转换的触发；表里没有的转换不会发生。

| 触发 | 可能发生的转换 | 备注 |
|---|---|---|
| 时间推移：`asOf` 越过 `deadline` | `Planned → Overdue`；`Partially_Paid → Overdue`（带 `PARTIAL`） | 往前走的时间里，唯一不需要任何写入就会发生的转换（`payment_date` 登记时不得晚于当天，§2.7，所以没有「未来付款到点才计入」的情形）；`asOf` 恰好等于 `deadline` 时不转换 |
| 新登记付款并建立 `SETTLES` 链接，使 `S` 增加 | `Planned → Partially_Paid / Paid / Overpaid`；`Partially_Paid → Paid / Overpaid`；`Overdue`（`S=0`）`→ Overdue`（带 `PARTIAL`）`/ Paid / Overpaid` | 转成 `Paid` 时，若 `settled_on` 晚于期限则带 `PAID_LATE`（§3.6）；`payment_date` 晚于 `asOf` 的付款不计入（§3.3） |
| 退款（方向相反的链接）、`SETTLES` 链接的 `VOID` 或分配额 `REVISION`，使 `S` 减少 | 按新的 `S` 重新落入判定表。未过期限：`Overpaid → Paid / Partially_Paid / Planned`；`Paid → Partially_Paid / Planned`；`Partially_Paid → Planned`。已过期限：`Overpaid → Paid / Overdue`；`Paid → Overdue` | 如实回落，不保留「曾经付清」的假象；`S < 0` 则是 `Discrepancy_Flagged`（§3.7） |
| 付款的 `CORRECTION`（改 `payment_date`） | 付款日期在 `asOf` 前后移动时，该付款开始/不再计入 `S`，状态按 `S` 的增减落入上两行；`settled_on` 与 `PAID_LATE` 也可能变 | 只有这一条路径能在不碰链接的情况下改变 `S` |
| 付款的 `CORRECTION`（改金额）、付款的 `VOID` | **不改变任何计划行的状态**：`S` 只由链接分配额决定，改的只是 `unallocated_cents`（§3.8） | 新金额低于已分配额时被拒绝（`ALLOCATION_EXCEEDS_AMOUNT`）；付款 `VOID` 之前必须先处理全部链接（`LINKS_EXIST`，§4.4），那一步才是上一行意义的转换 |
| 计划行 `REVISION`（改金额或到期日） | 任意状态按新的 `P` 与 `deadline` 重新判定 | 例如金额调高使 `Paid → Partially_Paid` |
| `Policy_Rule` 新增版本（例如 `tax.cp500.payment_grace_days` 出现 `OFFICIAL` 版本） | 只影响没填 `stated_deadline_date` 的 `TAX_INSTALMENT` 行的 `deadline`（§3.4），状态按新期限重判；期限推后时，`Overdue` 可能回到 `Planned / Partially_Paid` | 规则登记是一次追加写入（§6），不是时间推移 |
| 计划行 `VOID` | 任意状态 `→ Not_Applicable`（只出现在 `voided`） | 还有 `SETTLES` 链接时拒绝 `VOID`；之后可以用 `REVISION` 复活，复活后按当时的 `P`、`S`、`asOf` 重新判定 |
| 完整性问题出现或消失（§3.7 上半表） | 除 `Not_Applicable` 外的任意状态 `↔ Discrepancy_Flagged`；问题消失后回到 `money_status` | 正常写入路径下不会出现，只来自手工改 Sheet |
| 回看不同的 `asOf` | 同一份数据在不同 `asOf` 得到不同状态 | 只有 `payment_date ≤ asOf` 的付款计入 |

两点说明：①**`Not_Planned` 不是计划行的状态**，它描述的是付款里「没有任何计划行认领」的那一部分（§3.8）；建立链接或新增计划行之后它自然消失。②**没有任何转换需要「迁移」或「清除」旧状态**——旧状态从来没有被存下来。

### 3.6 `settled_on` 与 `PAID_LATE`

把贡献这行的所有付款按 `(payment_date, payment_key)` 升序排好，逐笔累加带符号的分配额；每当累计额从 `< P` 变成 `≥ P`，记下那笔付款的日期。最终 `S ≥ P` 时，**最后一次**这样的跨越日期就是 `settled_on`（先付满、退款、再补付的情形取最后那次）。`settled_on` 晚于 `deadline` → `PAID_LATE`（只标注，不改变 `Paid/Overpaid`）。

### 3.7 完整性问题与标注

**上半：完整性问题（`status` 变为 `Discrepancy_Flagged`）**

| 代码 | 含义 | 通常的来源 |
|---|---|---|
| `AMBIGUOUS_ENTRY` | 同一键同一序号有内容不同的两行 | 手工改过 Sheet；或将来某个写入路径的缺陷（P1 下并发时也可能出现） |
| `SEQ_GAP` / `CHAIN_START_INVALID` | 序号跳号；链的第一条不是 `ORIGINAL` | 手工删行 |
| `DANGLING_LINK` | 链接指向不存在/已作废的付款或计划行 | 手工改 Sheet |
| `OVER_ALLOCATION` | 同一笔付款的有效 `SETTLES` 分配额之和 > 付款额 | 手工改 Sheet |
| `LINK_INCOMPATIBLE` / `LINK_TO_NON_MAIN` | 违反 §2.7 的相容矩阵，或链到了 `ALT-*` 行 | 手工改 Sheet |
| `NEGATIVE_SETTLEMENT` | `S < 0`（退款链接比付款还多） | 数据录错 |
| `EVIDENCE_MISSING` | 付款或 `OFFICIAL_NOTICE` 计划行引用的证据不存在或已作废 | 手工改 Sheet |

这些在正常写入路径下不会出现（写入时锁内已拒绝，§4.4）；它们的意义是：**万一出现，不会被静默吞掉**（CMP-P10）。

**下半：信息标注（`status` 不变）**

| 代码 | 含义 |
|---|---|
| `PARTIAL` | `Overdue` 且已结清一部分 |
| `PAID_LATE` | 已结清，但晚于期限 |
| `POSSIBLE_DUPLICATE` | 有链接到这行的付款，与另一笔付款的 `(scheme, kind, amount, payment_date)` 完全相同、键不同 |
| `DEADLINE_RULE_PENDING` | 期限只能用 `due_date`，因为宽限规则没核实 |
| `NO_EVIDENCE` | 付款是用「无凭证例外」登记的（仅 D-12 选项 b） |
| `COVERAGE_UNSTATED` | SOCSO 付款的覆盖期是 `NOT_STATED` |
| `COVERAGE_OUTSIDE_PLAN_PERIOD` | SOCSO 付款已链接到 `YYYY-MM` 的计划行，但它陈述的覆盖区间与那个月完全不相交（对你自己陈述的事实做一致性检查，不是推断覆盖期） |
| `INCENTIVE_NOT_REGISTERED` | `MAIN` 里有 `EPF_INCENTIVE_EXPECTED` 行，但最新的 i-Saraan Plus 注册状态是 `NOT_REGISTERED` 或没有记录 |
| `NOTICE_SUPERSEDED` | 税务分期行的 `notice_evidence_id` 不是该课税年最新通知书（状态已变为 `REVISED`）的证据（§7.4） |

### 3.8 未分配的付款与「只登记」的付款

- **`unallocated_payments`**：每笔 `payment_date ≤ asOf` 的有效付款计算 `未分配 = 付款额 − Σ 有效 SETTLES 分配额`；`> 0` 时出现在这里，状态 `Not_Planned`，附 `unallocated_cents`。意思是「钱付了，但没有任何计划行认领这一部分」。`FUNDS_CLAIM` 链接**不**占用 `SETTLES` 的分配额（两者是不同的账：一个对计划，一个对报销）。
- **`other_payments`**：没有可链接目标的种类（目前只有 `TAX_OTHER`）。它们是官方记录，但不参与对照，所以单独列出，**不**算 `Not_Planned`，避免制造噪音。

### 3.9 授权需求 B 的场景逐条对应

| 场景 | 机制 | 结果 |
|---|---|---|
| 部分付款 | `S < P` | 期限前 `Partially_Paid`；期限后 `Overdue` + `PARTIAL` + `shortfall` |
| 一笔付款跨多个周期 | 一笔付款 → 多个 `SETTLES` 链接，每个链接写明分配额；`Σ 分配额 ≤ 付款额` 由锁内检查保证 | 每个周期各自结清；没分配完的部分是 `Not_Planned`。**系统不按天数或月份替你拆**，由你陈述 |
| 一个计划多笔付款 | 多个链接指向同一行 | `S` 是各笔带符号分配额之和 |
| 一笔付款对应多个计划 | 同上 | 同上 |
| 退款 | `TAX_REFUND`（方向 IN）链接到 `TAX_INSTALMENT`（方向 OUT），符号为负 | 行的 `S` 减少；可能从 `Paid` 回到 `Partially_Paid`/`Overdue`，如实反映 |
| 真的付了两次（两张收据） | 两笔付款都登记，都链接到同一行 | `Overpaid`；之后退款或另行处理 |
| 金额抄错 | 对该付款 `CORRECTION`（seq+1，写明原因）；若新金额低于已分配额，锁内拒绝（`ALLOCATION_EXCEEDS_AMOUNT`），要先改小链接 | 有效视图自动用最新值 |
| 同一张收据登记两次 | 三道防线（§4.2 末表）：同键幂等 → 同凭据同行号拒绝 → 同文件哈希拒绝；剩下的可疑重复只标注 | 不会静默产生第二条有效记录 |
| SOCSO 精确到天 | 覆盖期是付款上的陈述栏位，时间线是独立的纯函数（§5） | 与计划对照互不干扰 |
| EPF/Tax 不套用 SOCSO 覆盖模型 | EPF/Tax 付款的 `coverage_*` 必须为空（§2.13 校验） | 它们只有「对计划」这一种对照 |

### 3.10 计划集（plan_set）与跨方案预算比较

- **`MAIN`** 是真正要执行、要结清的计划；**`ALT-{LABEL}`** 是备选预算（例如「i-Saraan Plus 方案」对「常规自愿缴款方案」），**不被链接、不结清**。
- 预算比较是一个独立的纯函数：并排列出各计划集的 `(scheme, 周期) → 计划缴款额（OUT）、预期奖励额（IN）`、各自的合计，以及一行「预期净支出 = 缴款合计 − 预期奖励合计」。**预期奖励只来自你手填的 `EPF_INCENTIVE_EXPECTED` 行**（第一阶段没有计算器，授权 D4）；每条都带 `origin`/`rule_id`/`note`，并在输出里标明「预期，非官方确认」。**函数不给出「哪个方案更好」的结论**。
- 想把某个备选方案变成正式方案：用**显式的复制操作**把它的各行写成 `MAIN` 行（新键就 `ORIGINAL`，旧键就 `REVISION`，必填 `reason`）。这是一次有记录的数据操作，不是一个会悄悄翻转的开关。【设计建议】

### 3.11 汇总（totals）

- `OUT` 与 `IN` **永不相加**：EPF 缴款（OUT）与奖励（IN）分开列；
- 按 `(scheme, plan_set, applicable_year 或周期)` 汇总 `planned / settled / shortfall / excess`；
- `Not_Planned` 与 `other_payments` 各自单独成桶，**不并入计划总额**。

### 3.12 明确不做的事

不自动把付款配对到计划行（链接是你确认的事实；将来可以做「建议」，但永远由你确认才写入）；不按天数/月份自动拆分付款；不推算税额或应缴金额；不替你判断「该不该付」；不改写任何已记录的内容。

---

## 4. 幂等、审计、更正与失败恢复（授权需求 C）

### 4.1 需求 C 逐项对应

| 授权要求 | 机制 | 在哪一节 |
|---|---|---|
| 稳定的业务身份（不用不稳定的时间戳） | 业务键：制度/种类/周期/官方参考号/文件哈希 | §2.11 |
| 重复提交保护 | 记录链 + 锁内检查：同键同序号同内容 → `Already_Recorded` | §4.3 |
| 来源文件引用 | `Official_Evidence`，各表的 `evidence_id` | §2.4 |
| 更正/补偿记录 | `CORRECTION` / `REVISION` / `VOID` / `VOID_EVENT`，从不改写 | §4.2 |
| 审计历史 | 每个条目保留；`recorded_at`、`reason`、`entry_source` | §4.6 |
| TruthWriter 使用 | 新原语 `appendEntryIfNext`（P2，推荐；P3、P1 为备选） | §4.5 |
| 失败恢复 | 重试收敛：同样的提交重发，要么写入，要么 `Already_Recorded` | §4.7 |
| 一次失败的写入后，不得留下无法识别的重复正式记录 | 同上；多行操作按固定顺序，每一步各自幂等 | §4.7、§4.8 |

### 4.2 「发生了什么 → 写什么」

| 发生的事 | 你写什么 | 系统怎么呈现 |
|---|---|---|
| 计划金额或到期日变了 | 对该计划行写 `REVISION`（seq+1，完整快照，写明原因） | 有效视图用最新一行；历史全部保留 |
| 取消某条计划 | 写 `VOID`；若还有有效 `SETTLES` 链接指向它，锁内拒绝（`LINKS_EXIST`），要先作废/改走链接 | 进 `voided`，状态 `Not_Applicable` |
| 收到新版 CP500（修改后） | `Scheme_Status_Log` 写 `REVISED`（带新通知书证据）；对每期计划行写 `REVISION`/`VOID`/新的 `ORIGINAL`（`notice_evidence_id` 指向新证据） | 旧通知书的行保留在历史里；对照只看有效行 |
| 付款金额/日期抄错 | 对该付款写 `CORRECTION` | 同上 |
| 参考号抄错 | `VOID` 这条付款（先处理链接），用正确参考号重新登记，重建链接——参考号是身份的一部分，见 §2.7 | 历史里能看到两条，有效的只有新的 |
| 误登记了一张不属于这里的凭据 | `VOID` | 同上 |
| 税局退款 | 新登记一笔 `TAX_REFUND` 付款并链接到相应分期 | 该行 `S` 减少 |
| 链接建错了 | 对该链接写 `VOID`（或 `REVISION` 改分配额），再建新的 | 同上 |
| Grab 报销事件录错了 | 追加 `VOID_EVENT`（指向那个事件序号）再追加正确的事件 | 折叠时跳过被作废的事件 |
| 同一提交发了两次（双击、超时重试） | 什么都不用做 | 第二次返回 `Already_Recorded`，不写新行 |
| 两个页面同时改同一条 | 慢的那个会收到 `Conflict` 或 `Stale_Sequence` | 没有写入；重新读最新状态再提交 |

**「同一张收据登记两次」的防线**（对应授权 §3-B 最后一句）：

| 情形 | 发生什么 |
|---|---|
| 同一张凭据、同一参考号，再提交一次 | 同键同序号同内容 → `Already_Recorded`，不写新行 |
| 同一参考号，但金额/日期等不同 | 同键同序号不同内容 → `Conflict`，不写；要改就提交 `REVISION`（seq+1，必填原因） |
| 同一个文件（哈希相同）被登记成另一种证据种类 | 锁内 `DUP_FILE_HASH` 拒绝（报出已有的 `evidence_id`） |
| 同一个 `evidence_id` + 同一个 `line_no` 想登记成另一个 `payment_key`（参考号抄错了） | 锁内 `DUP_EVIDENCE_LINE` 拒绝 |
| 不同参考号、不同文件，但 `(scheme, kind, amount, payment_date)` 相同 | 都登记（可能是真的付了两次）；对照时标注 `POSSIBLE_DUPLICATE`，由你判断；确实重复就 `VOID` 其中一条 |

### 4.3 写入原语的算法与返回值

**为什么用业务键当幂等键，而不是请求号**：请求号（UUID）要多存一个栏位，而且「同一件事重新提交」时请求号不同，保护不了；业务键从事实本身算出，同一件事必得同一个键。这也是 CMP-P11/P13 的既有思路（`income_id`）。

**调用前（纯函数，不碰 Sheet）**：行级校验（§2.13）→ 构造业务键和整行 → 失败则返回 `Invalid`（列出全部错误），**不进锁**。

**锁内（整段在 `TruthWriter` 的同一个锁里，§4.5）**：

1. 重新读这张表的全部行（**不用调用方带来的快照**——Phase P 报告里的 R3–R5 就死在用旧快照做存在性检查）。
2. 取出该键的整条链。
3. 若链里已有相同 `entry_seq` 的行：
   - 与候选行逐栏相等（§2.3-4 的定义）→ 返回 **`Already_Recorded`**，并带上链头信息（让界面能说「已登记，但当前是作废状态」）；
   - 否则 → 返回 **`Conflict`**，什么都不写。
4. `max_seq = 链里最大序号（没有则 0）`。候选的 `entry_seq ≠ max_seq + 1` → 返回 **`Stale_Sequence`**（带当前链头），什么都不写。
5. 条目类型约束：`seq=1` 只能是 `ORIGINAL`；`seq>1` 不能是 `ORIGINAL`；第一条不能是 `VOID`。
6. 调用 `validateInLock(上下文)`（§4.4）：任何一条不通过 → **`Rejected`**（带原因代码列表），什么都不写。
7. 追加这一行，然后 `flush()`，然后才释放锁 → 返回 **`Appended`**。

顺序有意义：**先比较「是否相同」，再做校验**。这样一次已经成功的写入被重试时，不会因为「后来证据被作废了」之类的新情况变成一次拒绝——重试永远是安全的。

| 返回值 | 写了没有 | 含义 | 调用方该做什么 |
|---|---|---|---|
| `Appended` | 写了 | 新条目已落盘 | 完成 |
| `Already_Recorded` | 没写 | 之前已经写过一模一样的 | 当作成功（幂等） |
| `Conflict` | 没写 | 同键同序号，但内容不同 | 人来决定：想改就以 seq+1 提交 `REVISION` 并写明原因 |
| `Stale_Sequence` | 没写 | 序号不是下一个（别处已经写过） | 重新读最新状态，再提交 |
| `Rejected` | 没写 | 跨记录规则不通过 | 按原因代码处理 |
| `Invalid` | 没写 | 行级校验不通过（没进锁） | 修正输入 |
| `Lock_Timeout` | 没写 | `waitLock` 超时（`115:94` 用的是 10 秒） | 稍后重试，安全。按 Lock 类的文档，超时应抛异常，这一点列入真实 GAS 验证（§10）【待验证】 |

### 4.4 锁内的跨记录检查（`validateInLock`）

回调拿到的上下文：本表的全部行、该键的链、以及一个「读其他表的原始行」的函数（读的也是锁内的最新状态；回调用 180 模块里同一个纯函数把原始行映射成对象，并走同样的列数检查）。**回调只读，不写**，也**不会再去调用 `TruthWriter`**，所以没有嵌套锁（官方文档没有写同一次执行里重复获取同一个锁会怎样，所以设计上绕开它，见 §4.5）。

| 表 | 条件 | 原因代码 |
|---|---|---|
| Official_Evidence | `ORIGINAL`：已有另一个有效证据 `file_hash_sha256` 相同、键不同 | `DUP_FILE_HASH` |
| Official_Evidence | `VOID`：还有有效的付款/计划行/状态/报销事件/规则引用它 | `EVIDENCE_IN_USE` |
| Scheme_Status_Log | 引用的 `evidence_id` 不存在、已作废、或其 `scheme`/种类不符（`NOTIFIED/REVISED` 必须是税务通知书类：`TAX_NOTICE_CP500` 或 `TAX_NOTICE_REVISED`） | `EVIDENCE_NOT_FOUND` / `EVIDENCE_KIND_MISMATCH` |
| Plan_Line | `OFFICIAL_NOTICE`：`notice_evidence_id` 不存在、已作废、或不是税务通知书类（`TAX_NOTICE_CP500`/`TAX_NOTICE_REVISED`） | `EVIDENCE_NOT_FOUND` / `EVIDENCE_KIND_MISMATCH` |
| Plan_Line | `TAX_INSTALMENT`：同课税年的最新 `CP500_NOTICE` 状态不是 `NOTIFIED`/`REVISED` | `NOTICE_STATUS_MISSING` |
| Plan_Line | `VOID`：还有有效 `SETTLES` 链接指向它 | `LINKS_EXIST` |
| Official_Payment | 引用的 `evidence_id` 不存在、已作废、或种类与制度不相容 | `EVIDENCE_NOT_FOUND` / `EVIDENCE_KIND_MISMATCH` |
| Official_Payment | `ORIGINAL`：已有另一条有效付款用同一个 `(evidence_id, line_no)` | `DUP_EVIDENCE_LINE` |
| Official_Payment | `REVISION/CORRECTION`：新金额 < 已有有效 `SETTLES` 分配额之和 | `ALLOCATION_EXCEEDS_AMOUNT` |
| Official_Payment | `VOID`：还有有效链接指向它 | `LINKS_EXIST` |
| Payment_Link | 付款或目标不存在/已作废 | `PAYMENT_NOT_FOUND` / `TARGET_NOT_FOUND` |
| Payment_Link | `SETTLES`：违反 §2.7 相容矩阵（跨制度、方向/种类不符、目标种类不符，含 `TAX_OTHER`） | `LINK_INCOMPATIBLE` |
| Payment_Link | `SETTLES`：目标行不在 `MAIN` 计划集 | `LINK_TO_NON_MAIN` |
| Payment_Link | `FUNDS_CLAIM`：付款不是 `SOCSO_CONTRIBUTION`，或该索偿还没有 `CLAIM_OPENED` 事件 | `LINK_INCOMPATIBLE` / `CLAIM_NOT_OPENED` |
| Payment_Link | 该付款的同类有效分配额之和（含本条的新金额、不含本条自己的旧版本）> 付款额 | `OVER_ALLOCATION` |
| Reimbursement_Event | 该索偿的第一个事件不是 `CLAIM_OPENED` | `FIRST_EVENT_MUST_BE_OPENED` |
| Reimbursement_Event | `VOID_EVENT`：`voids_event_seq` 指向的事件不存在、已被作废、或本身是 `VOID_EVENT` | `VOIDS_TARGET_INVALID` |
| Reimbursement_Event | `CLAIM_RECEIVED`：同索偿内已有有效的 `(event_date, amount, receipt_reference 或 evidence_id)` 相同的 RECEIVED | `RECEIVED_DUPLICATE` |
| Reimbursement_Event | 引用的证据不存在或已作废 | `EVIDENCE_NOT_FOUND` |
| Policy_Rule | `version` 不是该 `rule_key` 的最大版本 + 1 | 走 §4.3 第 4 步的 `Stale_Sequence` |

### 4.5 TruthWriter：三条实现路线（决定 D-3）

**现状**【源码证实】：`appendValidatedRow` 把「校验栏位、转数组、`appendRow`」整段放在锁里（`115:31–46`），但**检查「这一行是否已经存在」不在锁里**（现有调用方在锁外用旧快照检查：Phase P 报告的 R3–R4 死在批次内快照过期，R5 死在检查与写入之间没有锁）；锁提供者在释放锁前**不做 `flush`**（`115:90–102`，`waitLock(10000)` 在 `:94`）；契约测试只断言 `TruthWriter` 有 `appendValidatedRow`（`190:42`）。

**官方 Lock 文档**（https://developers.google.com/apps-script/reference/lock/lock ，经工具转述）【官方证实·有限】：建议在释放锁**之前**调用 `SpreadsheetApp.flush()`，「to commit all pending changes to the spreadsheet while you still have exclusive access」；`tryLock` 在已持有锁时「has no effect」；脚本结束时锁自动释放。同一次执行里重复获取同一个锁会怎样：文档**没有写**【PENDING】。Phase P 报告把「flush 是否必要」标为待验证；现在的状态是「官方建议要做，实际是否必要仍待真实 GAS 验证」。

| | **P2（推荐）**：在 `TruthWriter` 里新增 `appendEntryIfNext` | **P3**：外层锁 + 无锁内层 writer，不动 `115` | **P1**：不动 `TruthWriter`，现有 `appendValidatedRow` + 事后检查 |
|---|---|---|---|
| 做法 | §4.3 的整套逻辑放进 `createTruthWriter_` 的锁里；accessor 新增 `flush()` | 新模块自己 `waitLock`，在锁里用 SheetReader 重新读、判断，再用一个**传入空操作锁**的 `createTruthWriter_` 实例追加，`flush` 后释放 | 锁外先读链并判断；调用 `appendValidatedRow`；写完再读一遍，发现同键同序号有多行就报警 |
| 并发下能防重复吗 | **能**：检查和追加在同一个锁里，中间没有空隙 | **能**：同样在一个锁里 | **不能完全防**：两个重叠的请求都能通过事前检查，各写一行；只能事后发现，多出的那行永远留着（有效视图靠 §2.12 吸收，内容不同则标 `AMBIGUOUS_ENTRY`） |
| 跨记录规则（超额分配、`VOID` 时有链接） | 锁内，没有竞态 | 锁内，没有竞态 | 锁外，有竞态 |
| `flush` | 追加后、释放锁前，符合官方建议 | 由外层在释放前调用 | 沿用现有的无 `flush` 行为 |
| 嵌套锁风险 | **没有**：回调只读，不再调用 `TruthWriter` | 构造上没有；但**将来谁在外层锁里误调单例 `TruthWriter`，就会在同一次执行里嵌套获取同一个脚本锁**——文档没写这会怎样 | 没有 |
| 改动面 | `115`（已批准文件）+ `190` 契约测试（补断言）+ `105` 的假 accessor 要有 `flush`；**现有 `appendValidatedRow` 及其调用方一行不动** | 只有新模块；`115` 不动 | 只有新模块 |
| 与现有原则 | 符合 CMP-P7「单一适配器」：锁与写入协议都由 `TruthWriter` 一家持有 | 追加仍经 `createTruthWriter_`，但**锁的所有权分到了两个地方**（单例管旧表，外层管新表），契约测试管不到外层 | 写入仍经 `TruthWriter`，但把「防重复」放在了一个它保证不了的地方 |
| 需要的批准 | Architecture Freeze 例外（决定 D-1） | 登记新表要改 `108` 的 `buildSheetSchemas_`，所以仍需例外，但少碰一个已批准文件（`115`）。若连 `108` 也不想碰：新模块可以**自带建表函数**（调用现有的 `ensureSheetSchema_`，`108:116`），代价是 Sheet Schema 注册表分成两处、`setupComplianceOsSheets` 不会建这些表（「零改动路线」，见 §11 决定 D-1 选项 c） | 同上；幂等保护是打折的 |
| 与 Phase P 的关系 | Phase P 报告的 T2（原子 check-then-write）可以复用同一个原语的思路——**另案授权，本设计不碰 Phase P** | 无 | 无 |

**为什么推荐 P2**：这 7 张表的核心要求是「重复提交与失败重试之后不留下认不出来的重复记录」，P2 和 P3 都能做到，P1 做不到。P2 把「锁 + 写入协议」继续放在 `TruthWriter` 一处，不分叉；代价是改一个已批准文件。如果你不想动 `115`，P3 是能接受的退路，但要接受「锁的所有权分到两处」和「不能在外层锁里误调单例」这两条纪律，并在真实 GAS 验证里确认无锁内层 writer 的行为。**不选**的做法：在新模块里用 `LockService` 包一层、再调用**带锁的** `appendValidatedRow`——那会在同一次执行里嵌套获取同一个脚本锁。

### 4.6 审计

- 每个条目保留：`recorded_at`（系统时间，仅审计）、`reason`（非 `ORIGINAL` 必填）、`entry_source`、`entry_seq`。**没有任何一行被改写或删除**——`TruthWriter` 现在只返回 `appendValidatedRow`（`115:48`），没有更新/删除方法；但这一点目前**没有**被测试守住（`190:42` 只断言有 `appendValidatedRow`），所以建议补一条「没有 update/delete/remove/overwrite 类方法」的契约断言（§9）。
- 历史查询 `history(key)`：纯函数，按序号返回整条链；`diffEntries_(a, b)`：纯函数，逐栏对比相邻两个快照，列出「什么变了」。
- 证据链：计划行/付款/状态/报销事件都带 `evidence_id`，证据登记里有哈希与存放位置；原始文件在 Drive，按 CMP-P4 不可改。
- 可测试的不变量：①只有 `TruthWriter` 写这 7 张表（搜索代码）；②`TruthWriter` 没有更新/删除类方法（需要先补上这条契约断言）；③每条链序号连续、首条是 `ORIGINAL`。

### 4.7 失败恢复

核心性质：**同样的提交重发，结果要么是写入，要么是 `Already_Recorded`，永远不会产生第二条无法识别的记录**——因为身份是业务键 + 序号，而不是写入时刻。

| 失败发生在 | 此时 Sheet 的状态 | 重试同样的提交会怎样 |
|---|---|---|
| 进锁之前（校验不通过） | 没有写入 | 修正输入后重新提交 |
| 等锁超时 | 没有写入 | 安全重试 |
| 锁内、追加之前出错（例如读取失败） | 没有写入 | 安全重试 |
| 追加这一步出错，结果不确定（可能写了也可能没写） | 0 或 1 行 | 没写 → `Appended`；写了 → `Already_Recorded`。**不会 2 行** |
| 追加成功，但 `flush` 失败或执行被终止，调用方不知道结果 | 1 行（可能尚未对其他执行可见，官方建议 `flush` 的原因） | `Already_Recorded` |
| 浏览器重发/双击 | 同上两种之一 | 同上 |
| 多行操作做到一半（见 §4.8） | 前几行已写，后几行没写 | 整个操作重跑，已写的各步 `Already_Recorded`，没写的补上 |
| Sheet 被人手工改乱（删行、改序号） | 视改法而定 | 读取时由 §2.12 的完整性检查标出，**不自动修复** |

### 4.8 一次多行操作的例子：登记一笔 SOCSO 付款，覆盖三个月，链接三条计划行

固定顺序：①证据（`Official_Evidence` `ORIGINAL`）→ ②付款（`Official_Payment` `ORIGINAL`）→ ③三条 `SETTLES` 链接。每一步都是一次独立的、幂等的 `appendEntryIfNext`。

- 做到第③步的第二条链接时失败了：付款已在，第一条链接已在，第二、三条没有。此时对照会显示这笔付款**部分分配**（余下部分 `Not_Planned`），这是**可见且无害**的中间状态，不是错误。
- 重跑整个操作：①②各自 `Already_Recorded`，第一条链接 `Already_Recorded`，第二、三条 `Appended`。最终状态与一次成功完全一样。
- 链接不可能先于付款存在（锁内检查 `PAYMENT_NOT_FOUND`），所以不会出现「悬空的链接」。
- 这个例子里**没有任何一步需要事务**：因为每一步的中间状态都能被对照引擎如实表达，而且重跑收敛。

### 4.9 本期不做、留给后续的事

- 辅助导入（PDF/OCR/LLM 提取）：授权 D6 明确是以后的独立阶段。届时要求候选值走**同一套**行级校验与同一个写入原语，`entry_source` 才会新增取值；LLM 不得直接写 Truth（CMP-P14）。
- 证据再核验：重新计算 Drive 文件的哈希与登记值比对，是一个只读检查，可以以后做；现在文件按 CMP-P4 视为不可变。
- 自动「建议链接」：只读建议，永远不自动写入。


---

## 5. SOCSO：精确到天的覆盖期，以及 Grab 报销

**状态**：【设计建议】。授权 D3 的要求逐条落点如下。

| D3 的要求 | 落在哪 |
|---|---|
| 你自己缴，Grab 没有自动扣款；可能一次缴好几个月 | `Official_Payment.payer_channel=SELF`；一笔付款可以对应任意长度的覆盖区间、多条计划行（§3.9） |
| 缴款日期、保障起、保障止、缴款金额分开 | `payment_date`、`coverage_start`、`coverage_end`、`amount` 四个独立栏位 |
| 精确到天，不假设自然月 | 覆盖期是陈述的闭区间（含首尾），引擎里全程用整数日编号（§5.2） |
| 不推断正式保险保障规则 | 覆盖起止由你照收据/官方记录录入；允许 `NOT_STATED`；输出里每个覆盖数据都标明「陈述值」 |
| Grab 报销的申请/批准/收到状态 | `Reimbursement_Event` 事件流折叠（§5.4） |
| 付款与报销的对应关系 | `Payment_Link` 的 `FUNDS_CLAIM` 链接，由你明确建立（§5.5） |
| 报销独立，付款不蕴含报销 | 没有链接就没有关系；界面写「未建立报销关系」，**不写**「未报销」（§5.5） |

### 5.1 覆盖期是「陈述值」，系统不推算（约定见决定 D-9）

官方来源能证实的只有这几句（政策登记表 POL-SOC-01/02/03）：

- 保障「从缴款的日期和时间起」生效，以缴款收据为准【官方证实·有限】（页面日期 NOT STATED）。
- **一次缴多个月时覆盖期怎么算：官方没写**（N7）【PENDING】。
- 另一项 2026 年的政府配对倡议的 FAQ 写了：保障 12 个月，续保者从**现有保障结束后**起算，而不是缴款日（POL-SOC-03）。这条只对那项倡议成立，对普通的提前多缴是否同样成立未确认，也未确认你是否适用——但它证明了「覆盖起点可以不等于缴款日」，所以起点必须是**独立录入的栏位**。

所以：

1. `coverage_start`、`coverage_end` 由你**照收据或 PERKESO 官方记录**抄写（`coverage_basis` 说明来源）。系统从不用「缴款日 + N 个月」去补。
2. 收据上没写覆盖期怎么办：`coverage_basis=NOT_STATED`，起止留空。这笔付款在时间线里列在「覆盖期未陈述」，**不参与覆盖计算**，也不会被偷偷补成某个区间。
3. `coverage_end` 在本设计里统一解释为「受保障的最后一天（含）」。如果官方记录的措辞含义不明（例如「至某日止」是否含当日），写进 `note`，并以原件为准；这是一个设计约定，不是 PERKESO 的规则。
4. **精度限制**：官方写的是「日期**和时间**」，本设计只到天（你要求精确到天）。如果某一天里的时刻重要（例如缴款当天、缴款时刻之前发生的事），要看原收据，系统不替你判断。

### 5.2 覆盖时间线（纯函数 `socsoTimeline_`，不落地）

**输入**：有效的 `SOCSO_CONTRIBUTION` 付款（§2.12）、`asOfParts`、可选窗口 `[W0, W1]`。**输出全部是查询时现算**。

算法（全部在整数日编号上做，`Date.UTC(y, m−1, d) / 86400000`，CMP-CR4）：

0. **只有 `payment_date ≤ asOf` 的付款参与**（与 §3.3 同一条规则：回看某一天时，当天还没发生的付款不算）。
1. 把付款分成两组：已陈述覆盖期的、`NOT_STATED` 的。后一组原样列入 `coverage_unstated[]`，不进入下面的计算。
2. 每笔已陈述的付款得到一个闭区间 `[s, e]`，天数 `e − s + 1`。
3. 按 `(s, e, payment_key)` 排序。
4. **并集**：依次扫描，若 `下一个.s ≤ 当前.e + 1`（重叠或首尾相接）就并入同一段连续覆盖；否则两段之间是一个**缺口** `[当前.e + 1, 下一个.s − 1]`，天数 `下一个.s − 当前.e − 1`。
5. **重叠**：逐对求交集 `[max(s), min(e)]`，非空就报告（两笔付款的键 + 重叠天数）。这是**信息标注**（`COVERAGE_OVERLAP`）：提前又缴一笔时，覆盖到底会不会顺延取决于 PERKESO 的规则，而那条规则没有官方文字可依，所以只呈现事实，不替规则做决定。
6. `covered_on(date)`：返回是否落在某个陈述区间内，以及是哪几笔付款。
7. **窗口报告**：对 `[W0, W1]`，给出已覆盖天数、未覆盖天数、每个未覆盖的区间。
8. **截至今天**：`covered_today`；若是，则 `covered_until`（所在连续段的终点）；若不是且曾有覆盖，则 `last_coverage_end` 与 `uncovered_days = asOf − last_end`；若一笔陈述都没有，则 `no_coverage_recorded`。
9. **逐月表**：对窗口内每个自然月，给出该月天数、已覆盖天数、未覆盖天数。这是为了让你一眼看到「按月的预算」与「按天的覆盖」之间的差异（自然月只是显示用的分组，**不是**覆盖的定义）。

每个覆盖相关的输出对象都带 `source: 'STATED'` 和一句固定说明：「覆盖期为收据/官方记录上的陈述，系统没有判断任何保险保障规则」。

**不做**：不推算覆盖起止；不判断「某天发生的事故是否受保」；不用缴款日期推出任何区间；不引入自然月或 30 天这类假设。

### 5.3 与计划对照的关系

两者互相独立：计划对照回答「钱与计划对得上没有」（§3），覆盖时间线回答「你陈述的覆盖区间覆盖了哪些天」。它们之间只有两处交叉，且**都只是对你自己陈述的事实做一致性检查**：

- `COVERAGE_OUTSIDE_PLAN_PERIOD`（§3.7）：付款已链接到 `YYYY-MM` 的计划行，但它的覆盖区间与那个月完全不相交；
- 逐月表（§5.2 第 9 步）里同时显示该月计划行的状态，让「Paid 但这个月有 N 天没覆盖」一眼可见。

SOCSO 计划行的 `due_date` 是**你自己定的预算日期**（政策登记表 POL-SOC-07：雇主缴款的「次月 15 日」「6% 利息」**不适用**于你的自雇缴款，不得套用）。所以对 SOCSO 行，`Overdue` 的意思是「超过了你自己定的日期」，界面上要写成「逾期（相对你自己定的日期）」，不能让人误以为是 PERKESO 的官方逾期。

### 5.4 Grab 报销：索偿的折叠

一个**索偿**（claim）= 平台 `GRAB` 在制度 `SOCSO` 下、针对某个月 `for_period` 的一次报销，键 `CMP-RMB-GRAB-SOCSO-{YYYY-MM}`。它的状态由事件折叠得出（不存状态）：

- **有效事件** = 没有被后来的 `VOID_EVENT` 指向的事件；`VOID_EVENT` 本身不算阶段。
- `stage` = 有效的 `OPENED/APPLIED/APPROVED/REJECTED` 事件里 `event_seq` 最大的那个。
- `applied_cents` / `approved_cents` = 最新的有效 `APPLIED` / `APPROVED` 事件的金额（没有则空）。
- `received_cents` = 所有有效 `RECEIVED` 事件金额之和。
- `target_cents` = `approved_cents`，没有则 `applied_cents`，再没有则空。

**索偿状态**（独立于 §3 的对照状态，是另一个词汇族）：

| 条件 | 状态 |
|---|---|
| `received_cents = 0`，`stage = OPENED` | `Opened` |
| `received_cents = 0`，`stage = APPLIED` | `Applied` |
| `received_cents = 0`，`stage = APPROVED` | `Approved` |
| `received_cents = 0`，`stage = REJECTED` | `Rejected` |
| `received_cents > 0`，`target` 为空 | `Received` + 标注 `NO_TARGET_AMOUNT`（实收了，但没有记录申请额/批准额，无法对比；Grab 流程里到底有没有「申请」是未确认的，所以这是合法情形） |
| `received_cents > 0`，`= target` | `Received` |
| `received_cents > 0`，`< target` | `Partially_Received`（`shortfall = target − received`） |
| `received_cents > 0`，`> target` | `Over_Received` |

**为什么没有「逾期」**：Grab 页面写的「次月 10 日前报销」是平台条款（页面无日期），不是政府规则，也没有写逾期怎么办。本设计不把它当作截止日期去判断；将来如果你想要「批准后 N 天仍未到账」的提醒，那是日历（§8）的事，而且要先有你确认的规则。

**标注**：`NO_LINKED_PAYMENT`（这个索偿没有任何 `FUNDS_CLAIM` 链接，净成本无法计算）；`COVERAGE_OUTSIDE_CLAIM_MONTH`（它所链接的付款陈述的覆盖区间与这个月不相交，只是一致性提醒）；完整性问题 `DANGLING_LINK`（链接指向已作废的付款）。

`platform_tier`：取最新的非空值，照你的 Grab 记录抄写，系统不解释它、也不用它算金额。

### 5.5 付款 ↔ 报销的链接与净成本

- `FUNDS_CLAIM` 链接把某笔 `SOCSO_CONTRIBUTION` 付款的一部分（`allocated_amount`，**由你陈述**）归到某个月的索偿。同一笔付款的 `FUNDS_CLAIM` 分配额之和 ≤ 付款额（锁内检查）。**它不占用 `SETTLES` 的分配额**——一个对计划、一个对报销，是两本账。
- 一笔付款覆盖三个月，就建三条 `FUNDS_CLAIM` 链接分别归到三个月的索偿；**系统永远不按比例自动拆分**。
- **每个索偿的净成本** = `Σ 已链接的分配额 − received_cents`。没有链接则净成本为空并标 `NO_LINKED_PAYMENT`，**不当作 0**。
- **整个制度的合计**（明确标注「合计，不按月对应」）：`总付款 = Σ 所有有效 SOCSO 付款`，`总实收 = Σ 所有有效索偿的 received`，`总净额 = 总付款 − 总实收`。这个合计不依赖链接是否完整，所以任何时候都能看；按月对应的净成本则依赖你建立的链接。
- 界面语言：没有链接 → 「未建立报销关系」；有索偿但没实收 → 对应的索偿状态；永远不出现「这笔付款应该有报销」这种推断。

### 5.6 官方政策与待确认项（SOCSO / Grab）

| 点 | 状态 | 对设计的影响 |
|---|---|---|
| 保障自缴款日期和时间起，以收据为准 | 【官方证实·有限】（POL-SOC-01/02，页面日期 NOT STATED） | 覆盖期取自收据；只到天 |
| 多月预缴的覆盖期规则 | 【PENDING】（N7） | 允许任意长度区间；系统不推算 |
| 续保从现有保障结束后起算（2026 配对倡议 FAQ） | 【官方证实·有限】；对普通预缴是否适用未确认 | `coverage_start` 独立于 `payment_date` |
| SKSPS 收据/参考号格式、怎么取得收据 | 【PENDING】（N7，页面没写） | 官方参考号长什么样未知 → `REFNORM` 规则 + `Conflict` 路径（§2.11、§4） |
| Plan 1–4 的月缴/年缴额 | 【官方证实】（页面日期 NOT STATED） | 进 `Policy_Rule` 种子；**计划行的金额仍由你填**，系统不自动取 Plan 4 的 49.40（`160:427` 写死的 49.40 与 Plan 4 月缴额相同，但选哪档是你的决定） |
| 2026 政府配对（70:30 / 50:50） | 【官方证实·有限】；是否适用于你【待确认】（按字面，客运/配送属被排除的强制行业，要看 PERKESO 原文） | 不建模。若你确实参加，你实付的金额就是 `amount`，在 `note` 里记录配对；要单独记政府出资部分，将来在 `Official_Payment` 表尾追加栏位（§2.14） |
| Act 872 平台自动扣缴（每笔 1.25%） | 【官方证实】；生效日【PENDING】 | 将来出现时用 `payer_channel=PLATFORM_DEDUCTION`（同一栏位）；现在全部 `SELF` |
| SOCSO 雇主缴款期限（次月 15 日、6% 利息） | 【官方证实】但**不适用** | 不得套用；SOCSO 计划行的 `due_date` 只是你自己定的日期 |
| Grab 补贴条款（2026 年 6–12 月、每月、按等级） | 平台条款，页面无日期 | 报销按月独立；金额与等级照你的 Grab 记录陈述，系统不计算应得金额 |
| Grab 申请/审批/支付方式/所需文件 | 【PENDING】（N9） | 事件类型最小化，`APPLIED/APPROVED` 可选；你的 Grab 对账单格式我没有见过 |
| Budget 2027 的 PERKESO 配对（35%/50%） | 宣布性措施，【PENDING】 | 不建模 |

### 5.7 示例（数字全部是虚构的，只用来说明栏位怎么用）

- **计划行**（`MAIN`，`SOCSO_CONTRIBUTION`，`USER_PLAN`）：`2026-11`、`2026-12`、`2027-01` 各 49.40，到期日 `2026-11-05`、`2026-12-05`、`2027-01-05`。
- **付款 P1**：金额 148.20，`payment_date=2026-11-02`，`coverage_basis=PRINTED_ON_RECEIPT`，覆盖 `2026-11-02 … 2027-02-01`（这是**假设收据上这样写**，不是任何规则的结果）。
- **链接**：P1 → 三条计划行，各分配 49.40（`SETTLES`）。
- **对照**（`asOf=2026-11-05`）：三行 `S = P`，`Paid`，`settled_on=2026-11-02`，都没有 `PAID_LATE`；`unallocated = 0`。
- **时间线**：一个区间，92 天；`covered_today` 为真，`covered_until=2027-02-01`；逐月表：2026-11 覆盖 29/30 天（11 月 1 日未覆盖）、2026-12 覆盖 31/31、2027-01 覆盖 31/31、2027-02 覆盖 1/28。
- **索偿**：`2026-11`：`OPENED`（2026-12-01）→ `RECEIVED` 10.00（2026-12-10，带 `receipt_reference`）→ 状态 `Received` + `NO_TARGET_AMOUNT`。`2026-12`：`OPENED` → `APPROVED` 10.00 → `RECEIVED` 6.00 → `Partially_Received`，`shortfall=4.00`。
- **`FUNDS_CLAIM` 链接**：P1 → 两个索偿各归 49.40（共 98.80 ≤ 148.20）。
- **净成本**：`2026-11`：49.40 − 10.00 = 39.40；`2026-12`：49.40 − 6.00 = 43.40；`2027-01` 还没有索偿。制度合计（标注「不按月对应」）：付款 148.20，实收 16.00，净额 132.20。

这个例子和附录 B 的场景 B1、B6 是同一组数字。


---

## 6. EPF：缴款预算、实际缴款、政府奖励，以及可配置的政策规则接口

**状态**：【设计建议】。授权 D4：你没有注册 i-Saraan Plus、缴款金额还没决定；第一阶段**没有 EPF 计算器**，但要把数据模型和规则接口设计好。

### 6.1 D4 的要求逐条落点

| D4 的要求 | 落在哪 |
|---|---|
| 注册状态 + 来源证据 | `Scheme_Status_Log`：`EPF/ISARAAN_PLUS_REGISTRATION`。现在是 `NOT_REGISTERED`（`USER_STATED`）；将来 `REGISTERED` 必须带证据（§2.5） |
| 缴款预算 | `Plan_Line`：`EPF_CONTRIBUTION`（OUT），按计划集和周期 |
| 跨方案预算比较 | `plan_set`（`MAIN` / `ALT-*`）+ `scheme_option`；比较函数见 §3.10 |
| 预期奖励 | `Plan_Line`：`EPF_INCENTIVE_EXPECTED`（IN）。**第一阶段只接受你手填的金额** |
| 实际缴款 | `Official_Payment`：`EPF_CONTRIBUTION`（OUT）+ 证据 |
| 已确认奖励 | `Official_Payment`：`EPF_INCENTIVE_CREDIT`（IN）+ 证据 |
| 预期 vs 实际缴款；预期 vs 已确认奖励 | §3 的对照 + §6.5 的 EPF 汇总 |
| 版本化、有生效日的奖励规则 | `Policy_Rule`（§6.3；放在切片 S3） |
| 从官方来源核实资格、计算、上限、条件，不硬编码未核实数字 | 政策登记表 + `Policy_Rule` 的 `verification_status`；代码里没有任何政策数字 |
| 证明/正式记录的引用 | `Official_Evidence` |

### 6.2 预算模型：计划集与两个典型方案

政策登记表 POL-EPF-02 的设计影响写明：最大的不确定项是「自己缴的款算不算 i-Saraan Plus 的奖励基数」，所以设计上必须**能同时保存**「方案 A：全部自己缴」「方案 B：经平台缴」的预算和预期奖励，而且预期奖励在规则未确认前只接受人工输入。

做法：

- `MAIN`：你实际要执行的计划（缴款额未定时，可以先不建，或先建一个暂定的）。
- `ALT-{LABEL}`：备选方案，例如 `ALT-SELF`（全部自己缴）和 `ALT-PLATFORM`（经平台缴）。每个备选方案里各自有 `EPF_CONTRIBUTION` 行和（如果你想比较）`EPF_INCENTIVE_EXPECTED` 行；`scheme_option` 写方案名。
- **备选方案不结清**（§3.10）；比较函数并排给出每个方案的：缴款合计（OUT）、预期奖励合计（IN，**标明「你手填的预期，非 EPF 确认」**）、预期净支出，以及每条预期奖励行的 `note`/`rule_id`，**不给「哪个更好」的结论**。
- 决定采用某个方案后，用显式复制操作把它的各行写成 `MAIN` 行（§3.10）。

比较输出的版面（数字留空，只示意结构）：

| | `ALT-SELF` | `ALT-PLATFORM` |
|---|---|---|
| 计划缴款合计（OUT） | （你填的各行之和） | （你填的各行之和） |
| 预期奖励合计（IN，你手填） | （可为 0 或空） | （你手填；标注 `Rule_Pending`：自缴是否计入等规则未核实） |
| 预期净支出 | 缴款合计 − 预期奖励合计 | 同左 |
| 规则状态提示 | 列出所依赖且处于 `PENDING` 的规则键 | 同左 |

### 6.3 `Policy_Rule` 与解析接口 `resolveRule_`（只定接口，不实现）

**目的**：任何用到政策数字、日期、资格的地方，都通过一个统一入口取值；取不到可靠的值时，**明确说「Rule_Pending」，不使用默认值**（CMP-P10；授权 §4）。

`resolveRule_(rules, ruleKey, asOfParts, scope)`（纯函数；`rules` 是 `Policy_Rule` 的全部版本）：

1. 候选 = `rule_key` 相同、生效区间包含 `asOf` 的版本（`effective_from` 为空的 `PENDING/LEAD` 行视为「一直适用」；`OFFICIAL` 行 `effective_from` 必填）。
2. 作用范围：若给了 `scope` 且候选里有 `scope_key` 等于它的，只用这一组；否则只用 `scope_key` 为空的通用组。**特定范围的行是 `PENDING` 时不回退到通用行**——不能因为特定规则没核实，就悄悄用通用规则顶上。
3. 在该组里取**版本号最大**的一行。
4. 按它的 `verification_status` 返回：

| 该行状态 | 返回 |
|---|---|
| `OFFICIAL` | `{ok:true, value:<按 value_type 严格解析>, status:'OFFICIAL', rule_id, source:{name,title,location,published,retrieved}}` |
| `PENDING` | `{ok:false, status:'Rule_Pending', rule_id, unconfirmed_items}` |
| `LEAD` | `{ok:false, status:'Rule_Pending', lead:true, rule_id}`——线索永远不提供取值 |
| `WITHDRAWN` | `{ok:false, status:'Rule_Missing'}` |
| 无候选 | `{ok:false, status:'Rule_Missing'}` |
| 同一最大版本号出现多行（手工改动的结果） | `{ok:false, status:'Rule_Ambiguous'}` |
| 值无法按 `value_type` 解析 | `{ok:false, status:'Rule_Invalid'}`（同时记为完整性问题） |

调用方**必须**处理 `ok:false`：典型做法是在输出里写「该项依赖规则 X，状态 `Rule_Pending`，未计算」，并跳过依赖它的数字。任何由规则得到的输出都带上 `rule_id`，让人能追到来源。

**第一阶段哪些地方真的会用到规则**：只有 §3.4 的税务期限宽限天数（`tax.cp500.payment_grace_days`）和 §7 里 CP500 最大期数（`tax.cp500.max_instalments`）的上限校验；EPF 方面**一条规则都不参与计算**，因为没有计算器。

### 6.4 为什么第一阶段不能做 EPF 奖励计算器，以及预留的接口

要算「预期奖励」至少需要下面这些规则，登记表里**全部是 `PENDING` 或只有部分核实**（政策登记表 POL-EPF-02、N10）：

| 需要知道的 | 状态 |
|---|---|
| 自己用 i-Akaun/网银缴的款，算不算 Plus 的奖励基数（页面既写「必须通过平台提供者缴款」又写「也可以通过现有渠道缴款以争取奖励」） | 【PENDING】`epf.i_saraan_plus.self_paid_counts` |
| 「当年」是不是日历年 | 【PENDING】`epf.incentive.year_basis` |
| i-Saraan 与 i-Saraan Plus 的缴款基数是否合并、「一年只给一次奖励」的范围 | 【PENDING】`epf.incentive.max_per_year` 的作用范围 |
| 2026 年以前、或注册之前的缴款是否计入 | 【PENDING】 |
| 终身上限按「自 2024 年起已收到的奖励」计算：你的历史奖励记录 | 需要你的 EPF 记录 |
| 司机身份如何被 EPF 确认 | 【PENDING】 |
| i-Saraan Plus 的精确生效日期（只写了「2026 年」） | 【PENDING】`epf.i_saraan_plus.exact_effective_date` |
| Budget 2027 对条款的改动 | 【PENDING】`epf.budget2027.changes`（宣布不等于执行细则） |

**预留的接口（不实现）**：`expectedIncentive_(contributionsByYear, registration, rules, asOfParts)` → `{status:'Rule_Pending', pending_rules:[…]}` 或 `{status:'Computed', …}`。契约：纯函数；只要它依赖的任何规则是 `Rule_Pending/Rule_Missing/Rule_Ambiguous/Rule_Invalid`，就必须返回 `Rule_Pending` 并列出是哪些规则键；**永远不返回默认值**。在上表的 `PENDING` 清除之前，它的任何实现都只能返回 `Rule_Pending`——这也是授权说「第一阶段没有计算器」的实质理由。

### 6.5 EPF 汇总输出

按年度（以 `applicable_year`；年度口径本身是 PENDING，所以输出里标明「按你填写的年份分组，不是 EPF 的年度口径」）给出：

| 栏目 | 来源 |
|---|---|
| 计划缴款 / 已结清缴款 / 缺口 / 超额 | §3 对 `EPF_CONTRIBUTION` 行的结果 |
| 预期奖励（你手填） | `MAIN` 里 `EPF_INCENTIVE_EXPECTED` 行的 `planned` 之和 |
| 已确认奖励 | 所有有效 `EPF_INCENTIVE_CREDIT` 付款之和（不依赖是否链接到预期行；**没有链接的入账仍然是官方记录**，同时出现在 `unallocated_payments`） |
| 预期 vs 已确认的差 | 两者之差，**只呈现事实**：奖励一年入账两次、视政府拨款（政策登记表 POL-EPF-01），所以「还没入账」不等于「拿不到」 |
| 注册状态 | `Scheme_Status_Log` 最新状态 + 证据；`INCENTIVE_NOT_REGISTERED`（§3.7）若适用 |
| 规则状态提示 | 所依赖且处于 `PENDING` 的规则键 |

### 6.6 登记表里与 EPF 有关的官方点（数值是登记表里的值，待你抽查，**不在任何代码里**）

| 点 | 登记表里的内容 | 状态 |
|---|---|---|
| i-Saraan 奖励 | 当年自愿缴款的 20%，每年最多 RM500；终身 RM5,000 或到 60 岁（「takes effect from 2024」） | 【官方证实】（待抽查）POL-EPF-01 |
| i-Saraan Plus 奖励 | 当年自愿缴款总额的 20%，每年最多 RM600；终身 RM6,000 或到 60 岁；「introduced starting 2026」 | 【官方证实·有限】POL-EPF-02 |
| 奖励入账 | 一年两次，以政府拨款到位为前提 | 【官方证实】POL-EPF-01/02 |
| 自愿缴款上限 | 每年累计 RM100,000，每笔最低 RM1 | 【官方证实】POL-EPF-01/02 |
| 缴款凭证形式、奖励证明形式 | 页面没写（N6） | 【PENDING】 |
| Budget 2027 的 EPF 措施 | 宣布 | 【PENDING】（POL-EPF-05） |

由于凭证形式未知，EPF 的 `official_reference` 长什么样我不知道：`REFNORM` 规则（§2.11）对出现意外字符的参考号会**拒绝并提示**，而不是静默改写，等你拿到第一份真实凭据后再看是否需要放宽字符集。

---

## 7. Tax：CP500 正式分期、实际缴款、对照

**状态**：【设计建议】。授权 D5：没有收到 CP500；首个有营业收入的课税年不确定。要支持「尚未通知」状态、正式通知书（带来源）、每期金额/到期日/适用年度、实际缴款 + 证明、计划与实际的差异。**永不编造 CP500 金额；不做税额估算、收入归属、跨年税额计算。**

### 7.1 D5 的要求逐条落点

| D5 的要求 | 落在哪 |
|---|---|
| 「尚未收到通知」状态 | `Scheme_Status_Log`：`TAX/CP500_NOTICE`，`period_key=YA{YYYY}`，`status_value=NOT_NOTIFIED`（§7.2） |
| 正式 CP500 通知书 + 来源引用 | `Official_Evidence`（`TAX_NOTICE_CP500`，带文件哈希或参考号） |
| 每期金额、到期日、适用年度 | `Plan_Line`：`TAX_INSTALMENT`，`origin=OFFICIAL_NOTICE`，`instalment_no`、`planned_amount`、`due_date`、`applicable_year`（§7.3） |
| 实际缴款 + 证明 | `Official_Payment`：`TAX_PAYMENT` + `evidence_id` |
| 计划 vs 实际差异 | §3 对照 |
| 不编造金额 | `TAX_INSTALMENT` 只能是 `OFFICIAL_NOTICE` 且必须带通知书证据（校验 + 锁内检查） |

### 7.2 状态：`NOT_NOTIFIED → NOTIFIED → REVISED`

- 每个课税年一条状态链（键含 `YA{YYYY}` 与 `as_of_date`）。**`NOT_NOTIFIED` 是一个明确的陈述，不是「没有数据」**：它表示「截至 `as_of_date`，你陈述还没有收到这一年的 CP500」。没有任何状态记录则表示「你还没陈述过」，界面上显示「未记录」，与 `NOT_NOTIFIED` 区分。
- `NOTIFIED`：必须带通知书证据。`REVISED`：必须带修改后通知书的证据。
- 当前有效状态 = 该课税年 `as_of_date` 不晚于今天的最新一条；同一天多条以记录链序号为准。
- 状态顺序异常（例如出现 `REVISED` 但此前没有 `NOTIFIED`）只在税务视图里标注 `status_issues`，不阻断（CMP-P12）。
- 登记表 POL-TAX-01：官方页没有写新开业者的规则（N4）【PENDING】。所以**系统不推断**「你这一年该不该有 CP500」，也不会因为「应该有」就生成任何一期。

### 7.3 转录一份 CP500 通知书（一个多行操作，每一步幂等）

固定顺序，每一步都是独立的 `appendEntryIfNext`（§4.8 的同一套收敛性）：

1. **证据**：登记通知书文件（`TAX_NOTICE_CP500`，`storage_kind`、哈希、存放位置、通知书上印的标题与日期）。
2. **状态**：`TAX/CP500_NOTICE`，`NOTIFIED`，`as_of_date` 取你陈述的收到/通知日，`evidence_id` 指向第 1 步。
3. **逐期计划行**：每一期一条 `TAX_INSTALMENT`：
   - `instalment_no`、`planned_amount`、`due_date`（通知书上的**应缴日期**）**都是照通知书抄写，系统不推算、不补齐缺的期数**；
   - `stated_deadline_date` 只在通知书**明文**写了最后期限时才填；
   - `applicable_year` 写通知书上的课税年；`notice_evidence_id` 指向第 1 步；
   - `period_key=YA{YYYY}-I{NN}`，`NN` 是 `instalment_no` 补零到两位。

登记表 POL-TAX-01/02 说 CP500 最多六期、每两个月一期、从每年三月起、每期金额由 LHDN 估算且**以通知书为准**【官方证实】。这里**不把「六期」「三月」写进任何校验**：期数上限只有在 `tax.cp500.max_instalments` 有 `OFFICIAL` 版本时才由包装层传给校验函数，没有就只要求 `instalment_no ≥ 1`。通知书上有几期、哪几个日期，永远以你抄进来的为准。

### 7.4 修改后的通知书

登记表 POL-TAX-03 说明 CP500 的金额可以申请修改（CP502），但修改的截止日期在两处官方文字里写法不一致（「每个日历年 6 月 30 日之前」对「30 Jun / 31 Oktober 2026」，N3、`tax.cp500.revision_deadline`）【PENDING】，修改后通知书的正式名称（登记表怀疑是 CP503X）也**未确认**。所以：

- 证据种类用通用的 `TAX_NOTICE_REVISED`，通知书上印的**原标题**抄进 `document_title`，不在代码里写死任何表格名称；
- 流程：登记新证据 → 状态链写一条 `REVISED`（`as_of_date` 取新通知书的日期，带新证据）→ 对每一期写 `REVISION`（改金额/日期，`notice_evidence_id` 换成新证据）、不再存在的期写 `VOID`、新增的期写 `ORIGINAL`；每一条都写明 `reason`。
- 旧通知书的行和证据**保留在历史里**；对照只看有效行。
- 若状态已变为 `REVISED`，但某一期的 `notice_evidence_id` 仍指向旧通知书，对照时标注 `NOTICE_SUPERSEDED`（只提醒，不阻断）。

### 7.5 实际缴款、退款与其他税款

- 缴款：`TAX_PAYMENT`（OUT）+ 证据（`TAX_PAYMENT_RECEIPT`）；通过 `SETTLES` 链接到对应的分期行；一笔付多期或一期分多笔都由链接表达（§3.9）。
- 退款：`TAX_REFUND`（IN）链接到分期行，符号为负（§2.7）。
- 其他税款：余额税款**不是** CP500 分期（POL-TAX-04：有生意收入者的余额税款在评税年次年缴交；纸质 6 月 30 日、电子申报 7 月 15 日），所以记为 `TAX_OTHER`，**只登记、不对照**（§3.8 的 `other_payments`）。年度结算的税额计算不在本期范围。
- 缴款凭证（例如 ByrHASiL 收据）的格式和参考号形态**登记表里没有**（N5）【PENDING】：同样依靠 `REFNORM` 的拒绝规则和 `Conflict` 路径，不预设格式。

### 7.6 期限：显示两个日期，用最后期限判断逾期（决定 D-11）

登记表 POL-TAX-02：「每期付款期限为自**应付日期**起 30 天」（`tax.cp500.payment_grace_days = 30`，`OFFICIAL（待抽查）`）。所以每一期有两个不同的日期：

- **通知书上的应缴日期**：`due_date`（你抄的）；
- **最后缴款日**：`stated_deadline_date`（若通知书明文写了），否则是 `due_date + 宽限天数`（§3.4；只有规则是 `OFFICIAL` 才用，否则退回 `due_date` 并标 `DEADLINE_RULE_PENDING`）。

对照输出**两个日期都显示**，`Overdue` 以最后缴款日为准。这是推荐方案；备选是只显示 `due_date` 并以它判断逾期（更保守，但可能把还在宽限期内的期次也标成逾期）。逾期罚款的官方依据没有找到（N5，`tax.cp500.late_payment_penalty` 是 `PENDING/LEAD`），所以**系统不计算任何罚款**。

### 7.7 「尚未通知」时的展示

- 当前状态是 `NOT_NOTIFIED`：税务视图顶部显示「截至 {as_of_date}，你陈述尚未收到 {YA} 的 CP500」，**没有任何计划行，也不会生成预算**。
- 此时如果已经有 `TAX_PAYMENT` 付款（例如你主动缴过一笔）：它们没有计划行承接，出现在 `unallocated_payments`（`Not_Planned`）；`TAX_OTHER` 出现在 `other_payments`。
- 登记表 POL-TAX-01 提到「没有在二月底前收到 CP500 的人」可以通过 MyTax 或 HASiL 联络中心取得副本。这只是官方页的一条说明，**本期不据此生成任何提醒**。

### 7.8 本期不做

税额估算、收入归属、判断首个有营业收入的课税年、跨年税额计算、逾期罚款计算、CP502 的 30%/10% 公式（登记表 POL-TAX-03，`OFFICIAL（待抽查）`，但属于计算器范围）、年度结算与 Form B 申报。

### 7.9 登记表里与 Tax 有关的官方点

| 点 | 内容 | 状态 |
|---|---|---|
| CP500 的期数与时间 | 最多六期，每两个月一期，从每年三月起；通知书年初寄出；金额由 LHDN 估算，以通知书为准 | 【官方证实】POL-TAX-01/02 |
| 每期付款期限 | 自应付日期起 30 天 | 【官方证实】（待抽查）POL-TAX-02 |
| 首个有营业收入的课税年是否有 CP500 | 官方页没写 | 【PENDING】N4 → 所以有 `NOT_NOTIFIED` |
| 修改 CP500 的截止日 | 两处官方文字不一致 | 【PENDING】（冲突）POL-TAX-01 vs 03 |
| 修改后通知书的名称 | 未确认 | 【PENDING】 |
| 逾期罚款 | 官方页没写；第三方线索称 10% | 【PENDING】/【线索】N5 |
| 缴款凭证与参考号格式 | 没写 | 【PENDING】N5 |
| 余额税款 | 不是 CP500 分期；纸质 6/30、电子 7/15 | 【官方证实】POL-TAX-04 → `TAX_OTHER` |
| LHDN 2025-10-07 与 2026-01-05 两份新闻稿 | 抓取失败，内容未读 | 【BLOCKED】N3，不作依据 |


---

## 8. 与 Compliance Calendar 的集成（只做设计）

**状态**：【设计建议】。授权需求 D：不建第二套提醒系统；说明计划变更、通知书更新、付款发生后日历怎么更新；遵守现有架构与事件规则。

### 8.1 现有事实（都读过源码）

| 事实 | 出处 |
|---|---|
| `Compliance_Calendar` 只存「义务的定义」，建立时写一次、不可变；`Compliance_Completions` 记「完成了」这个事实 | `DATA_OWNERSHIP.md:14–15`；列定义 `150:25–29` |
| 状态在查询时算：`computeObligationStatus_(obligation, hasCompletion, now)` → `Completed / Overdue / Due_Soon / Upcoming`；到期日**之后**才算 `Overdue`（`daysRemaining < 0`） | `150:65–83`（逾期判断在 `:76`） |
| `evaluateObligation_` 对非 `Upcoming` 的状态通过 `EventPublisher` 发事件；只有三种事件：`COMPLIANCE_DUE_SOON / COMPLIANCE_OVERDUE / COMPLIANCE_COMPLETED`；`Upcoming` 不发 | `150:133–150`、`167–176` |
| 日历里**没有「取消」或「被取代」的概念**；`Completions` 也没有「撤销完成」 | 整个 `150` 没有这类函数 |
| `EventPublisher` 是占位实作，从未真实推送；`Compliance_Calendar` 里没有任何真实义务；Calendar 的真实 GAS 验证 NOT DONE | `ARCHITECTURE.md:13`；`VERIFICATION_STATUS.md:119–124` |
| 「同一个义务连续几天都是 `Due_Soon`，每次扫描都发事件会不会太吵」是明确留着没解决的问题 | `150:20–22`；`151` 文件末尾的人工验证清单 |
| 用 `now.getUTC*()` 取日期分量，而脚本时区是 `Asia/Singapore`（UTC+8）：马来西亚时间每天 00:00–08:00，UTC 日期还是前一天，算出来差一天 | `150:72`；`appsscript.json:2` |

### 8.2 三个方案（决定 D-8）

| 方案 | 做法 | 评价 |
|---|---|---|
| **(i) 物化** | 建计划行时往 `Compliance_Calendar` 写一条义务；付款结清时往 `Compliance_Completions` 写一条完成 | **不推荐**。①日历不能取消：计划行被 `VOID` 后，那条义务会永远留着、永远 `Overdue`；②计划行改了到期日，要新建一条义务，旧的取消不了，同一件事出现两条；③`Completions` 撤销不了，付款被更正或退款后日历仍显示「已完成」；④「是否已付」同时存在于完成记录和付款链接两处，变成两个事实来源 |
| **(ii) 派生义务（推荐）** | 计划行在**查询时**派生出一个义务对象；`hasCompletion` 由行的金额状态决定；交给**现有**的 `computeObligationStatus_` / `evaluateObligation_`，发**现有**的三种事件；不往日历表写任何行 | 没有第二套提醒，也没有第二个事实来源；计划变了、作废了、付款被更正了，下一次查询自然反映，不会留下过期的行 |
| **(iii) 只展示** | (ii) 的子集：控制台里列出派生义务和状态，先不接事件 | 切片 S4 的第一步；事件本身要等扫描任务接上线（那是 Calendar 自己的待办） |

### 8.3 派生义务的定义（方案 ii）

| 义务栏位 | 取值 |
|---|---|
| `obligation_id` | `CMP-CAL-PLN-` + `plan_key` 去掉 `CMP-PLN-` 前缀后的部分；由 `plan_key` 确定性得出，所以稳定。代码 `PLN` 保留给派生义务，`computeObligationId_` 不得再用 |
| `category` | `EPF` / `SOCSO` / `Tax` |
| `title` | 查询时由计划行拼出（含制度、周期、计划额），所以永远是最新的 |
| `due_date` | 该行的 **`deadline_date`**（§3.4），**不是** `due_date`——这样日历的 `Overdue` 与对照的 `Overdue` 是同一个意思 |
| `recurrence` | `None`（每条计划行是独立的义务） |
| `reminder_lead_days` | 一个常量默认值（建议 7 天，这是界面偏好，不是政策；决定 D-18） |
| `linked_document_id` | 留空（这一栏指向 `Documents` 表；证据在 `Official_Evidence`，不混用两个登记表）；证据 id 作为派生对象上的额外属性展示，不落地 |
| `hasCompletion` | 该行的 **`money_status`**（§3.1）是否为 `Paid` 或 `Overpaid`。用 `money_status` 而不是 `status`，是为了不让完整性问题悄悄压住「逾期」提醒，也不让它假装「已完成」 |

`EPF`、`SOCSO` 的行是你自己定日期的预算，派生出的 `Overdue` 在界面上要写成「逾期（相对你自己定的日期）」。

### 8.4 计划变更、通知书更新、付款发生之后，日历怎么变

| 发生了什么 | 日历（派生义务）的变化 |
|---|---|
| 计划行 `REVISION`（改金额/到期日） | 下一次查询用新的 `due_date`/金额重新算；没有旧行要处理 |
| 计划行 `VOID` | 该行不在有效集里，派生义务随之消失 |
| 收到修改后的 CP500（状态 `REVISED`，各期 `REVISION/VOID/新 ORIGINAL`） | 同上：有效行变了，派生出的义务就变了 |
| 新登记一笔付款并链接，使 `S = P` | `money_status=Paid` → `hasCompletion` 为真 → 状态 `Completed` |
| 付款被 `CORRECTION`/`VOID`，或登记了退款，使 `S` 回到 `< P` | `hasCompletion` 回到假 → 状态按日期回到 `Upcoming/Due_Soon/Overdue`。**物化方案做不到这一点** |
| 付款超额（`Overpaid`） | 仍算 `Completed`；超额部分在对照里提示 |

### 8.5 事件规则（遵守现有的，不新增）

- **不新增事件类型**，不新增「提醒」表，不新增调度器（授权需求 D：不建第二套提醒系统）。
- `Upcoming` 不发事件；`Due_Soon/Overdue/Completed` 通过现有的 `evaluateObligation_` → `EventPublisher.publish`。`EventPublisher` 目前是占位，所以**本设计不改变「事件是否真的送达」这件事**，它只保证：当扫描接上线时，派生义务走的是同一条路。
- **事件 id**：现有的 `CMP-EVT-{obligation_id}-{now.getTime()}`（`150:172`）含时间戳。若调用方传入的 `now` 是下一节那个「本地日期的 UTC 零点」，同一天重复扫描会得到**同一个**事件 id（对下游去重有好处），但这也等于让 `now` 不再表示「现在」。是否接受，要等 `EventPublisher` 真的接上 Reminder OS、看清下游怎么去重之后再定【待确认】；本设计不替它做决定。
- 「每次扫描都重复发 `Due_Soon` 会不会太吵」仍然是 Calendar 自己的未决问题，本设计**不顺手解决它**。

### 8.6 日期处理

引擎和派生义务都由调用方传入「脚本时区的今天」（`asOfParts`）。需要调用 `computeObligationStatus_` 时，不改 `150` 也能得到正确的日期：传入 `new Date(Date.UTC(本地年, 本地月−1, 本地日))`（「本地日期的 UTC 零点」），这样 `getUTC*()` 取出来的就是本地日期。我在 Node 里验证过这个做法的行为：马来西亚时间 2026-10-25 00:30 时，`getUTC*()` 取出的是 10 月 24 日（`150:72` 的现状），而「本地日期的 UTC 零点」取出的是 10 月 25 日。

`150` 本身的修正（让它接受日期分量，或按脚本时区取日期）是**另一个**改动，影响现有的 `150` 与 `151` 测试，所以单独列为决定 D-14，不并入本设计。

### 8.7 控制台与「不做」

- 控制台只增加一个**只读**列表：真实日历行（目前没有）与派生义务合并显示，每条带 `source`（`CALENDAR_ROW` / `PLAN_DERIVED`），按最后缴款日排序，显示状态和 `days_remaining`。
- 不往 `Compliance_Calendar`、`Compliance_Completions` 写任何东西；不接 Reminder OS；不建调度；不自动「标记完成」。
- 切片 S4 同时是这些事的前提：Calendar 本身的真实 GAS 验证（`VERIFICATION_STATUS.md:124` NOT DONE）要有人先做，S4 才有意义。

---

## 9. 测试计划（只写计划，没有写测试文件）

**状态**：【设计建议】。授权 §7 禁止修改测试代码；这里只规定将来实现时要测什么。

### 9.1 原则

- 新文件按项目惯例命名为 `NNN_Tests_*.js`，紧跟在模块后面（180 → 181 …），在 Node 里运行，文件末尾带「人工验证清单」注释段（`151` 的做法）；名字含 `Tests` 才会被 `195` 的载入模拟排除（`195:38–42`）。【源码证实】
- **Node PASS 不等于 Real GAS PASS**（`VERIFICATION_STATUS.md:3`）：Node 能测的是逻辑；锁、`flush`、Sheets 读回的 Date 对象、脚本时区这些只有真实 GAS 才能验证，列在 §10。
- 日期一律注入，**不读时钟**；每个测试文件各在 `TZ=UTC` 和 `TZ=Asia/Kuala_Lumpur` 下各跑一遍，专门暴露 `150:72` 那类 UTC/本地日期分量问题。
- **变异检验**（手工做，不引入新工具）：对关键判断逐个做人为改动，确认至少有一个测试变红（清单见 §9.5）。
- 固定随机种子的模型测试：随机生成操作序列、重放、检查不变量（§9.3）。

### 9.2 测试层与要覆盖的内容

| 层（提议的文件） | 要覆盖 |
|---|---|
| **A 行级校验**（181） | 每张表的必填/条件必填；枚举；键重新构造；`REFNORM` 的接受与拒绝（小写、含空格、含 `*`、全角数字、空串、65 字符）；`H16`；金额（49.4、49.40、49.404 拒绝、0、负数、NaN、字符串）；日期真实性（2026-02-30 拒绝，2028-02-29 接受，2027-02-29 拒绝）；SOCSO 覆盖规则（起止顺序、`NOT_STATED` 必须为空、EPF/Tax 必须为空）；种类/方向矩阵；`entry_source`；非 `ORIGINAL` 必须有 `reason`；`undefined` 与 `null` 的映射 |
| **B 有效视图与完整性**（181） | 取序号最大；`VOID` 排除；`VOID` 后 `REVISION` 复活；同键同序号内容相同/不同；跳号；首条不是 `ORIGINAL`；从 Sheet 读回的 Date 对象被归一化 |
| **C 写入原语**（116 的扩充或新文件） | `Appended / Already_Recorded / Conflict / Stale_Sequence / Rejected`；「相同」的定义（忽略 `recorded_at`；数字与字符串归一）；**用假 accessor 在「调用方快照」和「拿到锁」之间偷偷追加一行，验证锁内用的是新读的数据**；追加 → `flush` → 释放锁的顺序（假锁记录调用顺序）；追加时抛错后重试不留半行；`validateInLock` 拒绝时不追加；先比相同、后校验的顺序 |
| **D 对照引擎**（183） | §3.5 判定表八行；边界（`asOf` = 期限当天不逾期）；符号规则与退款；多链接；`unallocated_payments`；`other_payments`；悬空链接；超额分配被标注；`settled_on` 取最后一次跨越；`PAID_LATE`；`plan_set` 过滤；`ALT-*` 不结清；期限的四种来源（含规则 `PENDING`）；`Discrepancy_Flagged` 下 `money_status` 保留；确定性排序；输入被深度冻结后不被修改；整数分的精确性（`0.2*12*250` 这种用例）；`OUT` 与 `IN` 不相加；`payment_date > asOf` 的付款不计入 |
| **E SOCSO 时间线**（185） | 单区间；首尾相接合并（`e + 1 = 下一个 s`）；恰好 1 天的缺口；重叠；包含关系；单日区间；乱序输入；`NOT_STATED` 被排除；闰年二月；逐月表的计数；`covered_on` 的首/末日及前后一天；窗口截取；`asOf` 早于第一个区间；366 天的长区间；两种 `TZ` 下结果相同；引擎不得调用 `new Date()`（把 `Date` 换成会抛错的替身） |
| **F 索偿折叠**（185 或 187） | `OPENED→RECEIVED`；`OPENED→APPLIED→APPROVED→RECEIVED` 的部分/足额/超额；`REJECTED` 之后重新 `APPLIED`；`VOID_EVENT` 作废一个 `RECEIVED`；重复 `RECEIVED` 的拒绝；有无链接时的净成本；制度合计带标注；`FUNDS_CLAIM` 不占用 `SETTLES` 分配额 |
| **G 规则解析**（187） | 版本号最大者胜；特定范围优先、`PENDING` 不回退通用行；`LEAD` 永不返回取值；`WITHDRAWN` → `Rule_Missing`；重复版本 → `Rule_Ambiguous`；值无法解析 → `Rule_Invalid`；`INTEGER/AMOUNT/RATE/DATE` 的严格解析（`0.20` 接受，`20%`、`1,000` 拒绝） |
| **H 日历派生**（183 或 189） | 派生字段；`hasCompletion` 取自 `money_status`；期限取最后缴款日；用「本地日期的 UTC 零点」在本地 00:30 与 23:30、两种 `TZ` 下状态一致；计划 `REVISION` 改变到期日、`VOID` 使义务消失、付款使其 `Completed`、退款使其回退；**假 accessor 断言没有向 Calendar/Completions 写入任何行** |
| **I 契约与载入**（190、195 的补充；登记路线还要动 109） | `TruthWriter` 有 `appendEntryIfNext`；`TruthWriter` 没有名字含 update/delete/remove/overwrite 的方法；载入模拟通过（无重名顶层函数、载入时不依赖后载入的文件）；`buildSheetSchemas_()` 含新表且 `textColumns ⊆ columns`；各表栏位数与本设计 §2.14 的表一致；**`109:25–28` 现在断言表名恰好是 7 张，登记新表的同一次改动里必须把它改成新的期望值，否则那一刻它就会失败**（走「零改动路线」则不涉及，新模块的建表函数自带一条等价检查） |
| **J 重复提交与失败重试的端到端**（Node，向假 accessor 注入故障） | 7 张表各自：同样提交两次 → 1 行；同键同序号不同内容 → `Conflict`；在追加处注入故障后重试 → 恰好 1 行；多行操作（§4.8）在每一步注入故障后重跑都收敛；交错执行 |
| **K 禁止项的负向测试** | 引擎只读不写；`entry_source` 不是 `MANUAL_ENTRY` 被拒；除 `TruthWriter` 外没有任何代码对这 7 张表调用 `appendRow`（静态搜索测试）；没有任何模块在载入时读 `Date.now()` |

### 9.3 不变量（固定种子的模型测试）

- **幂等**：把同一批合法条目重放两次，Sheet 内容与只放一次完全相同。
- 任意合法操作序列之后：每笔付款的有效 `SETTLES` 分配额之和 ≤ 付款额；每条链序号连续且首条是 `ORIGINAL`；每个 `VOID` 目标都没有有效链接。
- **与行序无关**：把不同键的输入行顺序打乱，对照输出不变（并列时按 `payment_key` 排序是明确规定的）。
- **金额恒等式**：对 `MAIN` 里方向为 `OUT` 的行，`Σ P − Σ S = Σ shortfall − Σ excess`（整数分，精确相等）。
- **覆盖天数**：时间线的并集天数，等于「用暴力法把每个区间展开成日期集合再数」的结果（小范围的穷举对照）。

### 9.4 测试数据

附录 B 的场景就是第一批黄金数据；所有数字、参考号、文件哈希都是虚构的，不使用任何真实收据、通知书或账号。

### 9.5 变异检验清单（每一条都应让至少一个测试失败）

| # | 人为改动 | 应被哪层抓到 |
|---|---|---|
| M1 | 逾期判断 `asOf > deadline` 改成 `>=` | D（边界用例） |
| M2 | 退款的符号反过来 | D、B4 场景 |
| M3 | 区间合并去掉 `+1`（首尾相接不再合并） | E |
| M4 | `coverage_end` 当作开区间（不含末日） | E |
| M5 | 「相同」比较里把 `recorded_at` 算进去 | C（重试变成 `Conflict`） |
| M6 | 把「先比相同」与「先做校验」顺序对调 | C（证据被作废后的重试） |
| M7 | 序号检查 `max+1` 改成 `max` | C |
| M8 | 去掉锁内的 `flush` | C（调用顺序） |
| M9 | 锁内改用调用方的快照 | C、J（偷偷追加的用例） |
| M10 | 有效视图把 `VOID` 当成有效 | B、D |
| M11 | 超额分配检查 `≤` 改成 `<` | C（B5 场景） |
| M12 | `PENDING` 规则回退到通用规则 | G |
| M13 | `hasCompletion` 改用 `status` 而不是 `money_status` | H |

### 9.6 Node 测试证明不了的事（转 §10）

真实 `LockService` 的语义与 `waitLock` 超时行为；`flush` 是否必要；Sheets 读回的 Date 对象（`VERIFICATION_STATUS.md:107` 的未解问题）；脚本时区；`getLastColumn` 的实际行为；`google.script.run` 的序列化；真实并发；配额与耗时。

---

## 10. 真实 GAS 验证计划（只写计划，没有执行）

**状态**：【设计建议】。沿用项目的 8 个验证层级（`VERIFICATION_STATUS.md:5–14`）；原则同样沿用：Node PASS ≠ Real GAS PASS；真实 GAS 函数 PASS ≠ 生产流程 PASS（`:3`）。我在这个环境里**没有**到 script.google.com 的网络路径，也没有 OAuth，所以下面所有步骤都是**你来跑**，我可以根据你贴回的日志判断。

**层级对照**

| 层级 | 本设计的对应 |
|---|---|
| 1 Static inspection | 本轮：设计 + 源码逐行核对（只读）；独立复核的范围与结果见交付报告 |
| 2 Node tests / 3 Mock tests | 实现阶段（§9） |
| 4 Real GAS execution / 5 Real Google Sheets persistence | V0–V7 |
| 6 Real Gemini API | **不适用**（授权：本轮与第一阶段都不调用 Gemini） |
| 7 Independent source verification | V8：拿真实文件逐字段对照原件；政策登记表的 10 项抽查 |
| 8 Production integration | V9：端到端 |

**安全措施**：全部在**临时副本**里做——复制一份 Spreadsheet，再复制一份 Apps Script 项目（或同一个项目但把 Script Property `SPREADSHEET_ID` 指向副本）；证据文件用临时 Drive 文件夹里的**虚拟 PDF**，不用任何真实文件。生产的 `Verified_Income` 等表一概不碰。

| 步骤 | 做什么 | 通过标准 | 要贴回的证据 |
|---|---|---|---|
| **V0 建表** | 部署实现 → 在副本里跑 `setupComplianceOsSheets()` | 新表全部 `created+header`；表头文字与 §2 一致；文本栏整列是纯文本格式、数字栏是自动格式；已有的表显示「header 已一致」 | 函数返回值日志 + 表头截图 |
| **V1 Date 对象探测** | 用新原语写几行（日期是 `YYYY-MM-DD` 字符串），再用 `readAll` 读回，对每个日期栏记录 `typeof` / `instanceof Date`；**同时记录** `Session.getScriptTimeZone()` 与 Spreadsheet 自己的时区（`getSpreadsheetTimeZone()`）是否相同；`period_key` 这类形如 `2026-11` 的文本栏也要检查读回后是否仍是字符串（防止被当成日期） | 读回的是字符串。**如果出现 Date 对象**：这正是 `VERIFICATION_STATUS.md:107` 里未解决的现象；记录下来，确认读入边界的 `normalizeIsoDateString_` 能处理——注意它用 `getFullYear/getMonth/getDate`（脚本时区，`106:35–37`）取分量，若 Spreadsheet 时区与脚本时区不同，是否差一天要靠这一步实测，我没有官方依据可以断言 | 每个日期栏的类型日志；两个时区的值 |
| **V2 锁与 `flush`** | ①一次执行写入、另一次独立执行读取，行是否立即可见；②一次执行持锁并睡眠 20 秒，另一次执行尝试写入：10 秒后的行为（预期抛异常 → `Lock_Timeout`，且**没有写入**）；③（仅在考虑 P3 时）同一次执行里重复获取同一个锁，记录行为 | ①可见；②异常且无写入；③记录事实（不是通过/失败） | 日志 + 写入前后行数 |
| **V3 并发** | 用两个浏览器页签、或脚本连发 5 次 `google.script.run`，提交**同样**的条目；再提交**同键同序号不同内容**的条目 | 同样内容 → 恰好 1 行（1 个 `Appended`，其余 `Already_Recorded`）；不同内容 → 恰好 1 行，其余 `Conflict`/`Stale_Sequence` | 各次返回值 + 表内容 |
| **V4 故障与重试** | 临时函数在 `appendRow` 之后抛错；随后用同样的提交重试 | 重试得到 `Already_Recorded`，表里仍是 1 行 | 日志 + 表内容 |
| **V5 时区** | 确认 `Session.getScriptTimeZone()`；在马来西亚时间 00:00–08:00 之间运行一次，比对包装层算出的「本地今天」与实际本地日期；用「本地日期的 UTC 零点」调用 `computeObligationStatus_` | 日期一致；状态与预期一致（也可用显式传入的 `now` 先模拟，但真实钟点那一次不能省） | 日志 |
| **V6 端到端（临时数据）** | 登记一笔虚拟 SOCSO 付款 + 虚拟证据 + 3 条链接；通过真实包装函数取对照与时间线；检查 `sanitizeForClient_` 之后经 `google.script.run` 返回的对象（`170:71`） | 没有 Date 对象、没有 `undefined`；数字与附录 B1 的黄金值一致 | 返回对象 JSON |
| **V7 规模与耗时** | 往每张表灌虚拟数据，计时 `appendEntryIfNext`（锁内要读 2–4 张表）；其中一张表灌到**超过**该工作表的 `getMaxRows()`（新建工作表的默认行数以实测为准），再检查**越界之后新追加的行**，文本栏的格式是否仍是纯文本、`period_key` 之类的值是否仍是字符串 | 单次写入耗时远小于 `waitLock` 的 10 秒；越界后新行格式不变（若变了，记录并评估——现有表有同样的潜在问题，因为 `108:159` 只给 `getMaxRows()` 那么多行设了 `'@'`）；记录实际数字 | 耗时日志；越界行的格式检查 |
| **V8 独立来源核对**（层级 7） | 拿**真实的**第一份 SOCSO 收据（以及将来的 CP500、EPF 对账单）逐字段对照原件；记录真实的参考号长什么样 | 你逐字段确认；**关闭或更新** N6、N7、N9 与 `REFNORM` 字符集；政策登记表 §9 的 10 项抽查有结论 | 你的核对记录 |
| **V9 生产集成**（层级 8） | 在另一次授权里，先对生产跑 `setupComplianceOsSheets()`（只会新建表，已有表不受影响），再走一遍真实流程 | 现有流程（导入 → Verified Income）行为不变；新功能在真实数据上通过 | 另行约定 |

**记录方式**：每一步的结果按 `VERIFICATION_STATUS.md` 的格式（Scope / Evidence source / Date / Result / Limitations）追加成行——**这是实现之后、你批准时才做的治理更新，本轮不改任何已批准文件**。


---

## 11. 建议批准什么、风险，以及需要你决定的事

**状态**：【设计建议】【待确认】。这一节是给你做决定用的：先看 11.1（建议先批准的最小范围），再看 11.3（每个决定我推荐什么）。**答复这些决定 ≠ 授权实施**：本轮授权只到设计文档与 ADR 草案；实施要你另行明确授权。

### 11.1 推荐的最小架构切片：S1「官方记录核心」

**请批准的是 S1，不是整套设计。** S1 之后的每个切片都可以单独批准，也可以在任何一个切片停下。

| 项 | S1 的内容 |
|---|---|
| 表（5 张，共 88 栏） | `Official_Evidence`（19）、`Scheme_Status_Log`（15）、`Plan_Line`（21）、`Official_Payment`（22）、`Payment_Link`（11） |
| 启用的种类（代码常量） | 计划行与付款：`SOCSO_CONTRIBUTION`、`EPF_CONTRIBUTION`（都是 OUT）；链接：`SETTLES`；证据：全部种类（只是登记文件）；状态：全部键（只是陈述）。其余种类留给后续切片启用——加枚举值只改代码，不动 Sheet（§2.3-6） |
| 纯函数模块（临时编号） | `180_OfficialRecords.js`（常量、行级校验、键构造、有效视图与完整性检查）、`182_PlanComparison.js`（对照引擎 §3，不含计划集比较）、`184_SocsoCoverage.js`（覆盖时间线 §5.2） |
| 写入 | `TruthWriter` 新原语 `appendEntryIfNext`（P2，决定 D-3）+ `flush`；Node 里用假 accessor 测 |
| 服务层（临时编号 `188`） | 读表 → 有效视图 → 引擎；写入包装（「证据 → 付款 → 链接」这类多行操作逐步幂等，§4.8）；公开薄壳（CMP-CR5） |
| 1a / 1b | **1a**：后端 + Node 测试 + 副本上的真实 GAS 验证 V0–V7。**1b**：控制台最小面板（录入表单 + 对照表 + SOCSO 时间线 + 状态陈述），在 1a 通过 V0–V4 之后另行批准 |
| 你马上能用到的 | 把 SOCSO 与 EPF 的缴款计划（你自己定的预算）和真实收据录进去，随时看「计划 vs 实际」；SOCSO 覆盖期精确到天，一次缴好几个月也行；记录「i-Saraan Plus 未注册」「某课税年的 CP500 尚未收到」这两类陈述（带日期与来源） |

**为什么先做 S1**

1. **它是地基**：身份规则、写入原语、有效视图、完整性检查都在这里。S2–S4 只是加表、加枚举值、加纯函数，不改这些。
2. **它不依赖任何未确认的政策事实**：S1 里没有政策数字、没有计算器、没有规则表。
3. **它直接回答你最初问题里最确定的一块**：SOCSO 与 EPF 缴款的「预算以及真实记录」。
4. **它把最大的技术风险放在最前面**：锁与写入原语、Sheets 读回的 Date、重复提交（V1–V4）。这些在 Node 里测不出来（§9.6）。
5. **每个切片都能在这里停下**：S1 单独就有用，不会留下半成品的表。

**S1 刻意不包含**

| 不含 | 在哪个切片 | 原因 |
|---|---|---|
| Grab 报销事件、净成本 | S2 | Grab 的申请/审批/到账流程没有官方资料（N9）；先看到一份真实的 Grab 记录再建事件模型（D-17）。`Reimbursement_Event` 延后建表，调整成本为零 |
| Tax 计划行（`TAX_INSTALMENT`）、税款/退款付款、CP500 转录流程 | S3 | 你还没收到 CP500；S1 只能记录「尚未收到」这个陈述 |
| EPF 预期奖励行、奖励入账、计划集比较、`Policy_Rule` | S3 | 奖励规则全是 PENDING，没有计算器；S1 只能记录「未注册」陈述与实际缴款 |
| 日历派生义务与只读列表 | S4 | 依赖 Calendar 自己的真实 GAS 验证（`VERIFICATION_STATUS.md:124` NOT DONE）与决定 D-8、D-14 |
| PDF/OCR/LLM 辅助导入 | S5（单独授权） | 授权 D6：之后的独立阶段 |
| Phase P 的修复 | 独立 | 授权 §5：另案，等授权 |

**S1 会碰哪些已批准文件**（需要 Architecture Freeze 例外，`compliance-os-governance-draft.md:420`；列出来是为了让你判断范围）

| 已批准文件 | S1 的改动 | 性质 | 若不批准例外（决定 D-1 选项 c） |
|---|---|---|---|
| `115_TruthWriter.js` | 新增 `appendEntryIfNext`；GAS accessor 增加 `flush`；`createTruthWriter_` 多返回一个方法 | 只增；`appendValidatedRow` 及其调用方一行不动（P2） | 走 P3：不改 `115` |
| `108_SheetSetup.js` | `buildSheetSchemas_` 增加 5 个条目（栏位常量放在新模块里，且是纯字面量，§2.14） | 只增；**连带必须改 `109:25–28`**（见下一行） | 新模块自带建表函数：不改 `108`，也不用改 `109` |
| `190_Tests_Contracts.js` | 增加两条契约断言（有 `appendEntryIfNext`；没有 update/delete/remove/overwrite 类方法） | 只增 | 断言改放新测试文件 |
| `105_TestUtils.js` | `fakeSheetAccessor_` 增加 `flush`（记录调用顺序）；也可以在新测试文件里自带一个带 `flush` 的假 accessor，省掉这处改动 | 只增 | 同左 |
| `116_Tests_TruthWriter.js` | 新原语的用例（也可以另建新测试文件） | 只增 | 另建新文件 |
| `109_Tests_SheetSetup.js` | 它以 `buildSheetSchemas_()` 为数据源（`109:10,21`），并且**断言表名恰好是现有的 7 张**（`109:25–28`）【源码证实】——登记 5 张新表之后这条断言一定失败，必须改。同文件 `:42–45` 对每张表检查 `textColumns ⊆ columns`（新表要满足）；其余断言按表逐个检查（`:32–38`、`:49–90`），不受影响 | **改既有断言**（例如期望值加上 5 个新表名，或改成「原 7 张仍在」），不只是新增；这是对已批准测试的修改，要在例外里一并列明 | 不受影响（新表不进 `buildSheetSchemas_`） |
| `170_OperatorConsole.js` / `.html`、`171` | 仅 1b：公开薄壳与面板 | 只增 | 1b 做不了 |
| `900_Constitution.js`、`901_System_Architecture.js`、`governance` 类文件 | 按项目惯例同步 ADR、changelog、模块清单（`901:118` 起的 `modules`）、验证历史 | **批准之后才改**；本轮只在 ADR 草案文件里给出 PROPOSED 文本 | 同左 |

**S1 完成的标准**

1. Node 测试 A、B、C、D、E、I、J、K 层全部通过（§9），每个测试文件在 `TZ=UTC` 与 `TZ=Asia/Kuala_Lumpur` 下各跑一遍；变异清单 M1–M11 每一条都让至少一个测试变红（M12 属于 S3，M13 属于 S4）。
2. `195` 的 GAS 载入模拟通过；`buildSheetSchemas_()`（或自带建表函数）含 5 张新表，栏位数与 §2.14 一致；若走登记路线，`109:25–28` 的表名断言已同步修改并通过。
3. 副本上的真实 GAS 验证 V0–V7 通过（你来跑，我根据你贴回的日志判断）；V8 用你的第一份真实 SOCSO 收据逐字段核对之后，才能把「SOCSO 覆盖期约定」标成 VERIFIED。
4. 附录 B 里属于 S1 的场景（B1、B2、B3、B5、B7，以及 B10 里的状态陈述部分）成为 Node 黄金测试，数值逐项相等。
5. 实现阶段要跑现有测试的全量回归，确认现有行为不变——**本轮没有跑，也不该跑**（授权 §7）。
6. 治理：ADR-DRAFT-CPR-1…3 经你批准为 `ACCEPTED`，实现后标 `IMPLEMENTED`，真实验证之后才标 `VERIFIED`；File Map、Module Catalog、Data Ownership、Verification Status 的更新在批准之后才做。

### 11.2 风险清单

「缓解」是设计里已经有的做法；「剩余风险」是实现之后仍然要靠验证或靠你来关闭的部分。

| # | 风险 | 缓解 | 剩余风险与怎么关闭 |
|---|---|---|---|
| R1 | 要改已批准文件：`115` 是所有表的唯一写入口，改它的影响面是整个系统；另外登记新表会让 `109:25–28`（断言表名恰好是 7 张）失败，那条已批准测试必须同步改 | P2 只新增方法，`appendValidatedRow` 一行不动，现有 3 个用例原样跑（`116`）；P3 与「零改动路线」可退（后者连 `108`、`109` 都不碰）；按切片批准 | 新旧方法共用同一个脚本锁，并发行为要靠 V2、V3 在真实 GAS 验证 |
| R2 | 表一旦建好，改栏位就是迁移（没有迁移工具：`108:140–148`、`117:35`） | S1 只建 5 张，另外 2 张延后建；7 张表的栏位字典在批准前改动零成本；不加备用栏；「表尾追加 + 手工补表头」有先例（`140:18–28`），步骤已写（§2.14） | **你要在批准前认真看 §2 的栏位字典**——这是批准里最难回头的一部分 |
| R3 | 锁与并发在真实 GAS 里的行为没验证（`waitLock` 超时、`flush` 是否必要、同一次执行重复获取锁） | P2 的回调只读、不嵌套；失败恢复靠「重试收敛」而不是靠锁语义（§4.7）；单人使用，暴露面小 | V2–V4；现有的 `116` 末尾已经有一条没打勾的同类人工验证项（`116:60–61`） |
| R4 | Sheets 读回 Date 对象的问题至今没查明（`VERIFICATION_STATUS.md:107`） | 读入边界一律 `normalizeIsoDateString_`（`106:32–44`）；日期存字符串；V1 实测并记录两个时区 | 若 V1 发现 Spreadsheet 时区与脚本时区不同，可能需要额外处理 |
| R5 | 官方参考号/收据格式未知（N6、N7、N9） | `REFNORM` 遇到意外字符一律**拒绝并提示**，不静默改写；同键不同内容走 `Conflict`（§2.11、§4.3） | 真实参考号含允许范围外的字符时会被拒绝——这是安全的失败，修法是放宽一个代码常量；V8 用第一份真实收据确认 |
| R6 | SOCSO 多月预缴的覆盖规则没有官方文字（N7） | 覆盖期是你陈述的值，系统不推算；允许 `NOT_STATED`；`COVERAGE_OUTSIDE_PLAN_PERIOD` 只做一致性提醒（§3.7） | 你可能抄错覆盖日期：用 `CORRECTION` 更正，以收据原件为准 |
| R7 | Grab 报销流程没有官方资料（N9） | 事件类型最小化，`APPLIED/APPROVED` 可选；S2 推迟到你给出真实 Grab 记录之后（D-17） | 到时事件模型可能要调整——`Reimbursement_Event` 延后建表，调整成本为零 |
| R8 | `Overdue` 对「你自己定日期」的预算行不是官方逾期 | 界面必须写「逾期（相对你自己定的日期）」（§3.4、§5.3）；税务的最后缴款日只有规则为 `OFFICIAL` 才使用，否则标 `DEADLINE_RULE_PENDING` | 措辞靠 UI 实现；Node 测试只能断言字段，不能断言页面文字——1b 要人工核对 |
| R9 | EPF 奖励规则全部未核实 | 没有计算器；`expectedIncentive_` 只能返回 `Rule_Pending`；预期奖励只收你手填（§6.4） | 你手填的预期可能被误读成 EPF 确认——输出里固定标「预期，非官方确认」 |
| R10 | 复杂度：7 张表 / 129 栏 / 4 个纯函数模块 / 11 层测试，对一个单人系统是否过重 | 只批准 S1（5 表 / 88 栏 / 3 个纯模块 + 1 个服务层）；每个切片都可以在这里停下；D-2 里有更精简的 E3 | 这是真实的取舍：越精简，防重复与审计越弱。我推荐的是「重复提交与失败重试不留下认不出来的重复记录」这条要求所需要的最小集合，不是最小的表数 |
| R11 | 第二个数字来源：`160` 的 SOCSO 49.40 存根与新计划行（`160:422–443`） | D-7；S1 不碰 `160`；新面板与 Dashboard 卡片各自标注来源（`Projection` 对计划行） | 在 D-7 决定之前，两处可能同时显示不同的 SOCSO 金额 |
| R12 | 手工录入的负担与出错：付款要逐条建立链接；金额、日期、参考号都可能抄错 | 1b 把「证据 → 付款 → 链接」合成一个表单操作（内部仍是逐步幂等写入）；更正与作废都有明确流程（§4.2）；不提供自动配对（§3.12） | 链接要你来确认是有意的取舍：防止系统替你猜钱对应哪个月 |
| R13 | 有人直接在 Sheet 里手工改数据，绕过 `TruthWriter` | 有效视图的完整性检查会标出（`AMBIGUOUS_ENTRY`、`SEQ_GAP`、`DANGLING_LINK` 等），不会静默（§2.12、§3.7） | 无法阻止；Sheet 保护（只让脚本写入）是可选的加固，本设计没有展开 |
| R14 | 日历：`150:72` 的 UTC 日期分量、`EventPublisher` 占位、事件 id 含时间戳（`150:172`） | 派生义务不写日历表；调用方传入「本地日期的 UTC 零点」绕开；`150` 的修正另案（D-14） | Calendar 本身的真实 GAS 验证 NOT DONE（`VERIFICATION_STATUS.md:124`），S4 要等它 |
| R15 | 政策登记表依赖 WebFetch 转述，还没有经过你抽查；两份 LHDN 新闻稿读取失败（N3） | 全部带标签；`OFFICIAL（待抽查）` 的规则默认不被引擎使用（§3.4）；有 10 项抽查清单 | 抽查之前，任何规则种子都不应写入 `Policy_Rule` |
| R16 | 治理：Freeze 写明「只有真实数据跑出来的证据才能再开例外」「不因为讨论起来合理就继续加」（`compliance-os-governance-draft.md:420`），Steven 2026-08-17 还列过「为了以后可能需要而加的 Infrastructure」不做（`:196`）；7 张表可能被看成提前建设 | 理由是**现在的真实需求**（授权 §2）；项目自己早已预留这个位置（`160:410–415`、`170_OperatorConsole.html:534`）；不新增事件类型；不抽跨 OS 模块；按切片只建当前用得上的表；E3 与「零改动路线」是更精简的退路 | 批不批准例外是你的治理决定，我只负责把理由和范围列清楚。如果你认为 S1 仍然超出「真实需求」，选 D-4 (b)、D-2 的 E3，或先走 D-1 (c) |

### 11.3 需要你决定的事（D-1 … D-18）

**每个决定里排第一的是我的推荐。** 分三组：开工前必须答复的（S1）、之后的切片之前再答复的、独立事项。

#### 开工前必须答复（S1）

**D-1　Architecture Freeze 例外**（`compliance-os-governance-draft.md:3,420`）

背景【源码证实】：Freeze 自己写了例外条款，v0.7 的 ADR-003 是目前唯一跑过的例外；原话是「Freeze 继续有效，只有真实数据跑出来的证据才能再开例外」，并且「不因为『讨论起来合理』就继续加」（`:420`）。所以这个决定不只是技术选择，也是治理选择。我的理由是**现在就有的真实需求**（授权 §2：登记真实的 SOCSO/EPF/税务付款），而且项目自己早就把这个位置预留了（`160:410–415` 的注释、`170_OperatorConsole.html:534` 的提示）；设计里**没有新增事件类型**、没有抽出跨 OS 的共用模块、按切片只建当前用得上的表。但批不批准例外由你决定。

- (a) **按切片分别批准**（推荐）：每个切片批准一次；每次只列出该切片要碰的已批准文件与函数（S1 的清单见 11.1），而且都是只增不改。
- (b) 一次性批准整套设计：省事，但把后面切片的细节也一并放行了。
- (c) **不批准例外——「零改动路线」**：写入走 P3，新模块自带建表函数（调用现有的 `ensureSheetSchema_`，`108:116`），契约断言放进新测试文件。1a 后端可以完整做完，**不碰任何已批准文件**（连 `108`、`109` 都不用改）。代价：Sheet Schema 注册表分成两处（`setupComplianceOsSheets` 不会建这些表）；锁的所有权分成两处；没有 UI（1b 要改 `170`）；日后若要改成 P2，要把写入原语搬进 `TruthWriter` 并再批准一次例外。
- 为什么推荐 (a)：这套设计的核心要求——重复提交与失败重试不留下认不出来的重复记录——在 P2 下最干净。**但如果你对改 `115` 不放心，(c) 是个真实可行、更保守的起步方式**：先在真实 GAS 里把引擎和写入原语验证完，再决定要不要做 1b。

**D-2　证据登记方案**（§0 第 2 点）

- E1　复用 `Documents`。好处：已有登记表。问题：`consoleGetRecoveryStatus_` 会把没有对应 Verified_Income 的 Documents 行都列成 Pending（有失败证据档时列成 Failed）（`170:427–490`），收据放进去会永远显示成「待处理的 PDF」，要改 Recovery Center（已批准的 `170`）；`computeDocumentId_` 同批多文件会撞号（`110:47`；Phase P 报告）。
- E2　**新建 `Official_Evidence`**（推荐）。多一张 19 栏的表；与现有导入流程互不影响；证据可以被多条记录共用；有「同一个文件被登记两次」的防线（`DUP_FILE_HASH`，§4.4）。注意：它**不是**跨 OS 的 Document Repository（那是已确认不采纳的东西，`compliance-os-governance-draft.md:241`）；它只是 Compliance OS 内部登记「哪份官方文件支持哪条记录」的一张表，与 `Documents`（导入流水账）并列。但 Steven 在 2026-08-17 明确列过「为了『以后可能需要』而加的 Infrastructure」不做（`:196`），所以选 E2 的理由必须是**现在就需要**：同一张收据不被登记两次、证据被多条记录共用、不污染 Recovery Center——这三条是我认为成立的理由，是否成立由你判断。
- E3　不建证据表，各表内联文件引用。少一张表，但每张表要多约 7 个栏位，没有共用证据，也没有 `DUP_FILE_HASH` 防线；§2 的栏位表要改写（**我没有写 E3 版的栏位表**，你选它我再补）。

**D-3　`TruthWriter` 路线**（§4.5）：**P2**（推荐：新增 `appendEntryIfNext`）／P3（外层锁 + 无锁内层 writer，不动 `115`）／P1（事后检查，防不住并发重复）。一句话：P2 把「锁 + 写入协议」继续放在一处；P3 的代价是锁的所有权分到两处，并要守一条「不得在外层锁里误调单例」的纪律；P1 做不到本设计最核心的要求。

**D-4　S1 的范围**：(a) **如 11.1**（推荐）；(b) 只做 SOCSO，EPF 缴款推到 S3——EPF 缴款几乎没有额外成本（只是多启用两个枚举值），所以不推荐；(c) S1 与 S2 一起做——要等你提供真实的 Grab 记录（D-17）。

**D-5　通用备用栏位**：(a) **不加**（推荐）；(b) 每表加 1–2 个。理由见 §2.3-8：加栏位没有迁移工具，但「表尾追加 + 手工补表头」有先例（`140:18–28`），备用栏省不下什么，还会留下永远为空的死栏位。

**D-6　建表时机**：(a) **按切片建**（推荐）：S1 建 5 张，S2 建 `Reimbursement_Event`，S3 建 `Policy_Rule`；(b) 一次建 7 张；(c) `Scheme_Status_Log` 也推迟到 S3（S1 只有 4 张）。理由：栏位一旦在 Sheet 里建好，改动就是迁移；晚建的表可以按你的真实使用经验调整。`Scheme_Status_Log` 放进 S1，是因为授权 D4/D5 要求支持「尚未注册／尚未通知」这类陈述，让它们从第一天起就带日期与来源地记录下来，而且它与另外 4 张表共用同一套校验和写入原语，额外成本很小；但 S1 里没有任何计算依赖它，所以 (c) 也说得通。

**D-9　SOCSO 覆盖期约定**（§5.1）：(a) **`coverage_end` 含当日；允许 `NOT_STATED`；只到天**（推荐）；(b) 不允许 `NOT_STATED`（每笔付款都必须陈述覆盖期）；(c) 记录到时刻。理由：官方只写「从缴款日期和时间起」，多月预缴怎么算没写（N7）；(a) 最贴合你「精确到天、不推断」的要求，又不强迫你填收据上没有的信息。这是一个**设计约定**，不是 PERKESO 的规则。

**D-10　金额位数**：(a) **超过 2 位小数就拒绝**（推荐）；(b) 静默 `round2_`。理由：CMP-P9 要求 2 位，CMP-P10 要求异常显性；静默四舍五入会让抄错的金额悄悄变成另一个数。

**D-12　凭证要求**（§2.7）：(a) **`official_reference` 与 `evidence_id` 至少有一个，否则不能登记为官方付款**（推荐）；(b) 允许「无凭证例外」，永久带 `NO_EVIDENCE` 标注。理由：没有参考号也没有文件就没有稳定身份。丢了收据时，这笔钱在系统里仍是「计划／逾期」，直到你拿到官方记录——这是有意的。

**D-13　ADR 编号**：index 写「下一个新 ADR 是 ADR-007」（README L17）；Phase P 的设计文档也暂称 ADR-007（`PhaseP_Documents_Processing_State_Design_2026-10-17.md:33,575`，未被采纳）。授权要求不得猜测编号。(a) **草案先用 `ADR-DRAFT-CPR-1…5`，由你指定正式编号**（推荐）；(b) CPR 占用 ADR-007 起，Phase P 另改；(c) Phase P 保留 ADR-007，CPR 从 ADR-008 起。

#### 之后的切片之前再答复

| 编号 | 问题 | 选项（推荐在前） | 需要在……之前 |
|---|---|---|---|
| D-7 | `160` 里的 SOCSO 固定 49.40 与 EPF/Tax `Not_Configured` 存根（`160:422–443`）怎么办 | (a) 保留，作为带标注的回退；该月有计划行时改读计划行；(b) 一开始就改读计划行；(c) 不处理，两个来源并存 | 1b 之前（改 `160`/`170` 要例外） |
| D-8 | 日历集成方案（§8） | (ii) 派生义务，先只展示 (iii)；(i) 物化（不推荐：日历没有取消/被取代，完成记录撤销不了） | S4 之前 |
| D-11 | 税务两个日期怎么用（§7.6） | 两个都显示，以最后缴款日判断逾期；或只显示应缴日期、以它判断逾期（更保守，可能把还在宽限期内的期次标成逾期） | S3 之前 |
| D-14 | `150:72` 用 UTC 日期分量，导致每天 00:00–08:00（马来西亚时间）差一天 | 另案单独授权修；或并入 S4；或不修（调用方永远传「本地日期的 UTC 零点」）。改 `150`/`151` 要例外 | S4 之前 |
| D-16 | 税务「自备预算」行类型 `TAX_SELF_RESERVE`（§2.6） | 不做（授权没有提，且 D5 不要税额估算）；或做（只收你手填金额，永不推算） | S3 之前 |
| D-17 | Grab 事件与证据要求（§2.9、N9） | 等你给一份真实的 Grab 报销记录/对账单再定；或先按最小事件集建 | S2 之前 |
| D-18 | 提醒提前天数的默认值（§8.3） | 7 天（界面偏好，不是政策）；或其他 | S4 之前 |

#### 独立事项

**D-15　Phase P 修复范围**（与本设计互不依赖，单独授权）。我的建议顺序（Phase P 报告 §7.1）：T1-a + T1-b 一起做（最小、最高价值、不改 Sheet 结构）→ 先用报告 §6 的只读方法核对真实数据里有没有历史重复，再决定 T1-c → T2 只有在你认为并发值得保护时才做（若 D-3 选了 P2，可复用同一个原语的思路）→ T3 跟随 Phase P 的设计。S1 与 Phase P 谁先谁后都可以。

**如果你接受我对 S1 的全部推荐**：D-1 (a)、D-2 E2、D-3 P2、D-4 (a)、D-5 (a)、D-6 (a)、D-9 (a)、D-10 (a)、D-12 (a)、D-13 (a)——回复「S1 全按推荐」即可（仍需单独授权实施）。想保守起步：D-1 (c) + D-3 P3，其余相同。

### 11.4 下一阶段可以单独授权的范围

每一项都需要你另行明确授权；本轮授权到设计文档与 ADR 草案为止。

| 阶段 | 内容 | 前置 | 会碰的已批准文件 | 新增 | 能达到的验证层级 |
|---|---|---|---|---|---|
| **S1a** | 官方记录核心后端：SOCSO 与 EPF 缴款的计划 vs 实际、SOCSO 覆盖时间线、状态陈述 | D-1…D-6、D-9、D-10、D-12、D-13 | 见 11.1 的清单（P3 路线：无） | 5 张表；`180/182/184/188` + 测试 | 1–3；副本上 4–5（V0–V7）；V8 = 7 |
| S1b | 控制台最小面板 | S1a 通过 V0–V4；D-7 | `170` js/html、`171` | — | 1–3；真实 GAS 里的 UI 要你操作 |
| S2 | Grab 报销事件、净成本 | S1；D-17 | `108`（登记 `Reimbursement_Event`） | 1 张表（18 栏）；`184` 增加索偿折叠 | 同上 |
| S3 | Tax 通知书与分期、`Policy_Rule`、EPF 奖励行与计划集比较 | S1；你抽查政策登记表的 10 项；D-11、D-16 | `108`（登记 `Policy_Rule`） | 1 张表（23 栏）；`186`；`182` 增加计划集比较 | 同上；规则的 `OFFICIAL` 状态要你抽查（层级 7） |
| S4 | 日历派生义务（先只展示）与只读列表 | S1（S3 可选）；D-8、D-14、D-18；Calendar 自己的真实 GAS 验证 | 视 D-7、D-14：`150`、`160`、`170` | — | 同上 |
| S5 | 辅助导入（PDF/OCR/LLM 提取） | 单独授权；S1 的校验与写入原语；CMP-P14 | 抽取相关模块 | — | 需要层级 6（真实 Gemini） |
| 独立 | Phase P 修复（D-15） | 单独授权 | `110`、`170`（T1）；`115`（T2） | — | 报告 §7.2 |
| 独立 | `150:72` 修正（D-14） | 单独授权 | `150`、`151` | — | 1–3；真实 GAS 时区（V5） |
| 你来做 | 政策登记表 10 项抽查；V0–V9；第一份真实收据的核对（V8） | — | — | — | 层级 4、5、7 |

**所有切片之外、本设计永远不做的事**：税额估算、收入归属、跨年税额计算（授权 D5）；EPF 奖励计算器（在 §6.4 的 PENDING 清零且你另行授权之前）；个人贷款、信用卡与一般负债（授权 D2）；自动把付款配对到计划行；用缴款日推算覆盖期或任何推断的保险保障规则；其他 OS 的改动。


---

## 附录 A：证据索引（源码、文档、外部来源）

「位置」是 `文件:行`。**源码行号全部在本轮用只读方式逐条核对过**（打印出被引用的那几行，对照文中的说法）。分析对象：你上传的 `07.Compliance-main.zip`（handoff 所说的「工作副本」，77 个文件；handoff 里 17 个带 sha256 的文件，哈希全部相符）。

### A.1 源码（`07.Compliance-main`）

| 文件 | 位置 | 内容 | 用在 |
|---|---|---|---|
| `108_SheetSetup.js` | `36–47` | `buildSheetSchemas_` 的注释：必须写成惰性函数——GAS 按文件名字母序把所有文件载入同一个全局作用域，顶层求值会读到未赋值的常量 | §1 #2、§2.14 |
| | `48–105` | `buildSheetSchemas_`：现有 7 张表的登记（含 `textColumns`；金额这类数字栏刻意不列，`102`） | §1 #2、§2.3-5、§2.14、§11.1 |
| | `116–163` | `ensureSheetSchema_`：建表、写表头、套文本格式 | §1 #2、§11 D-1 |
| | `140–148` | 表头与代码不一致就抛错；`140` 只逐栏比较代码里列出的那几栏 | §0 #4、§2.3-8、§2.14 |
| | `154–160` | `textColumns` 整列（`getMaxRows()` 行）设 `'@'` | §2.3-5、§10 V7 |
| | `171–176` | `setupComplianceOsSheets`：用 `buildSheetSchemas_()` 逐表 `ensureSheetSchema_` | §10 V0、§11 D-1(c) |
| `109_Tests_SheetSetup.js` | `10`、`21` | 以 `buildSheetSchemas_()` 为数据源 | §2.14、§11.1 |
| | `25–28` | 断言表名**恰好**是现有 7 张；登记新表之后这条一定失败，必须同步修改 | §2.14、§11.1、R1、D-1 |
| | `42–45` | 对每张表检查 `textColumns ⊆ columns`（新表要满足） | §2.14、§11.1 |
| | `32–38`、`49–90` | 其余断言按表逐个检查，不受新增表影响 | §11.1 |
| `115_TruthWriter.js` | `3` | 文件头：UCR6——所有 Sheet 写入的唯一出口 | §2.3-1 |
| | `31–46` | `appendValidatedRow`：锁内校验栏位后 `appendRow`；`33` 加锁；`34–42` `undefined` 抛错、`null` 写成空串 | §1 #1、§2.3-5、§4.5 |
| | `48` | `createTruthWriter_` 只返回 `{ appendValidatedRow }` | §2.3-1、§4.6 |
| | `65–71` | `getTargetSpreadsheet_`：Script Property `SPREADSHEET_ID` + `openById` | §10 安全措施 |
| | `73–88` | `gasSheetAccessor_`；`85` 读取宽度用 `getLastColumn()` | §2.14 |
| | `90–102` | `gasLockProvider_`：`waitLock(10000)`（`94`）；释放锁前没有 `flush` | §0 #3、§4.3、§4.5 |
| | `106–108` | 单例 `TruthWriter` 只在 GAS 环境初始化 | §4.5 |
| `116_Tests_TruthWriter.js` | `55–63` | 人工验证清单：「真实 GAS 环境下确认 `waitLock(10000)` 在并发写入时真的会排队」尚未打勾 | §10 V2/V3、§11.2 R3 |
| `117_SheetReader.js` | `32–42` | `readAll`；`35` 栏位数与 `columnOrder` 不一致就抛错 | §0 #4、§2.14 |
| `105_TestUtils.js` | `14–38` | `assertEqual_`、`fakeStore_`、`fakeSheetAccessor_`（没有 `flush`）、`fakeLockProvider_` | §1 #16、§9、§11.1 |
| `106_Utils.js` | `12–14` | `round2_` | §2.3-5 |
| | `32–44` | `normalizeIsoDateString_`：Date 对象用 `getFullYear/getMonth/getDate`（`35–37`）取分量 | §2.3-5、§10 V1 |
| `110_DocumentImport.js` | `33–36` | `DOCUMENTS_COLUMNS` | §0 #2 |
| | `39–48` | `computeDocumentId_`：日期分量用 UTC（`43–45`），末段是 `now.getTime()`（`47`） | §0 #2、§1 #7 |
| | `95–99` | `computeFileHash_` 依赖 GAS 的 `Utilities` | §2.4（哈希由薄壳层算好再传入） |
| | `208–212` | 事件 id 含 `now.getTime()`（`210`） | §1 #7 |
| `130_Reconciliation.js` | `86–89` | 状态 `Matched` / `Discrepancy_Flagged`；注释写明 CMP-P12：只标注、不阻断 | §1 #12–13、§3.2 |
| | `102–107` | `reconciliation_id` 含 `now.getTime()`（`103`） | §1 #7 |
| | `130–133` | `Not_Performed` | §3.2 |
| | `151–156` | `getCurrentReconciliationStatus_`：当前状态查询时现算 | §3.1（先例） |
| `140_VerifiedIncome.js` | `6–11` | 头注释：TruthWriter 只支持 append；「当前状态」查询时算，不存栏位 | §2.3-1 |
| | `18–28` | 2026-08-22 教训：加栏位必须加在表尾，插在中间让旧数据整体错位、Dashboard 崩溃 | §0 #4、§2.3-8、§2.14 |
| | `88` | `income_id = CMP-INCOME-{week}`（稳定业务身份的先例） | §1 #6、§2.3-3 |
| | `189–198` | `verifyAndPublishIncome_`：用调用方传入的 `existingIncomeIds` 快照判断是否已存在 | §0 #3、§1 #6 |
| `150_ComplianceCalendar.js` | `19–22` | 留着没解决的问题：连续多天 `Due_Soon` 是否每次扫描都发事件 | §8.5 |
| | `25–29` | 日历表与完成表的栏位 | §2.2、§8.1 |
| | `49–55` | `daysBetween_`：整数分量 + `Date.UTC` | §3.5 |
| | `57–64` | `computeObligationStatus_` 的文档：不碰 I/O | §3.1 |
| | `65–83` | 状态计算：`69–71` `Completed` 回传 `days_remaining: null`；`72` 用 `getUTC*` 取日期分量；`76` `daysRemaining < 0` 才是 `Overdue` | §3.1、§3.2、§3.5、§8 |
| | `133–150` | 事件构造：只有三种事件类型 | §8.1、§8.5 |
| | `156–158` | `recordCompletion_` | §2.2、§8.2 |
| | `167–176` | `evaluateObligation_`；`172` 事件 id 含 `now.getTime()` | §8.5 |
| `151_Tests_ComplianceCalendar.js` | `126` 起 | 人工验证清单 | §8.1 |
| `160_MonthlyProjection.js` | `176–185` | 月份归属状态 `Missing_Period` / `Full` / `Needs_Allocation` | §1 #12 |
| | `311–315` | `_source: 'Projection'`（`313`） | §3.1 |
| | `403–415` | 注释：真正的官方缴费记录以后要作为独立的 Official Record 类型进 Compliance OS | §0 #1、§11 D-1 |
| | `422–443` | `computeComplianceProjection_`：SOCSO 固定 `49.40`（`427`）；EPF/Tax `Not_Configured`（`433–441`） | §0 #1、§1 #11、§11 D-7 |
| `170_OperatorConsole.js` | `71` | `sanitizeForClient_` | §1 #15、§10 V6 |
| | `190–208` | `consoleScanFolder_` | §0 #2 |
| | `427–490` | `consoleGetRecoveryStatus_`：没有对应 Verified_Income 的 Documents 行 → Pending（有失败证据档时 Failed） | §0 #2、§11 D-2 |
| | `961–1005` | 公开薄壳函数（CMP-CR5） | §1 #15、§11.1 |
| `170_OperatorConsole.html` | `498`、`528–534` | Compliance Projection 卡片；`534` 的提示：「真正的 SOCSO/EPF/LHDN 缴费记录以后会作为独立的 Official Record 存进来对照」 | §0 #1、§1 #11 |
| | `543` | `Not_Configured` 的显示 | §1 #11 |
| `190_Tests_Contracts.js` | `42` | 对 TruthWriter 只断言有 `appendValidatedRow` | §2.3-1、§4.6、§9 |
| `195_Tests_GasLoadSimulation.js` | `38–42` | 载入模拟只纳入名字不含 `Tests`、不以 `900_`/`901_` 开头的 `.js` | §2.14、§9 |
| | `96–111` | 重名顶层函数检测 | §2.14、§9 |
| `900_Constitution.js` | `114` | CMP-P1 Official Truth Principle | §1 |
| | `133` / `139` | CMP-P4 原始文件不可变 / CMP-P5 陈述值优先于计算值 | §2.4、§5.1 |
| | `145–150` | CMP-P6 可推导的状态不存储 | §3.1、§8 |
| | `152` | CMP-P7 外部依赖收拢成单一 Adapter | §4.5 |
| | `166–169` / `171–175` | CMP-P9 金额 2 位 / CMP-P10 异常显性 | §2.3-5、§6.3 |
| | `177–181` / `183–188` | CMP-P11 平台稳定 ID / CMP-P12 注解不是闸门 | §2.3-3、§3.2 |
| | `190–194` / `196–200` | CMP-P13 发布必须幂等 / CMP-P14 AI 候选值不是 Truth | §1 #6、#14 |
| | `223–226` / `228–231` | CMP-CR4 整数分量 + `Date.UTC` / CMP-CR5 私有函数后缀下划线 | §2.3-5、§3.5 |
| `901_System_Architecture.js` | `118` 起；`291–299` | `modules` 清单（项目惯例，没有测试强制）；`computeComplianceOsEngineeringMetrics_` | §11.1 |
| `appsscript.json` | `2` | `timeZone: Asia/Singapore` | §0 #11、§8.1 |
| | `13`、`14–17` | `runtimeVersion: V8`；`webapp`：`access: MYSELF`、`executeAs: USER_DEPLOYING` | §10 |

### A.2 文档

| 文件 | 位置 | 内容 | 用在 |
|---|---|---|---|
| `DATA_OWNERSHIP.md` | `14`、`15` | 日历表（义务的定义）与完成表（完成这件事本身）是事实 | §2.2 |
| | `18`、`26` | Monthly/YTD 汇总查询时现算、不落地存表；Projection 的定义（EP4） | §2.1 |
| | `29–31` | 「PROPOSED — REQUIRES APPROVAL」的标注方式 | §1（数据归属提议） |
| `ARCHITECTURE.md` | `7` | Compliance OS 拥有全部 Official Records | §1 |
| | `13` | Reminder OS 消费日历事件；`EventPublisher` 是占位、尚未真实串接 | §8.1 |
| | `66` | 月度/YTD 汇总 + Compliance Projection（SOCSO 固定值、EPF/Tax 明确 `Not_Configured`） | §1 #1 |
| `VERIFICATION_STATUS.md` | `3` | 核心原则：Node PASS ≠ Real GAS PASS | §9、§10 |
| | `5–14` | 8 个验证层级 | §10 |
| | `107` | 「textColumns 已设仍读回原生 Date」尚未查明 | §2.3-5、§10 V1 |
| | `119–124` | Calendar 的真实 GAS 验证 NOT DONE | §8.1、§11.2 R14 |
| ADR 索引（`README-Architecture Decision Records — Index.md`） | `17` | 「下一个新 ADR 是 ADR-007」 | §1 #21、§11 D-13 |
| | `36` | 新 ADR 先标 `PROPOSED`，等你确认后改 `ACCEPTED` | §1 #21 |
| `compliance-os-governance-draft.md` | `3`、`420` | Architecture Freeze；ADR-003 是 Freeze 自己写的例外条款；只有真实数据跑出来的证据才能再开例外 | §11 D-1、§11.2 R16 |
| | `196` | Steven 2026-08-17 明确列的「不做」清单（Document Repository、新的 Compliance Event types、为以后可能需要而加的 Infrastructure） | §11 D-2、R16 |
| | `241` | Document Repository：已确认不采纳 | §11 D-2 |
| | `348–356` | File Map | §2.14 |
| | `360–395` | Sheet Schema：`378` 日历义务 id `CMP-CAL-{CODE}-{YYYY}`；`391` 完成记录做成 append-only 的理由；`395` ISO 日期读回不保证仍是字符串 | §8.3、§2.3-5 |
| `MODULE_CATALOG.md` | `97` | 月度汇总与 Compliance Projection（SOCSO/EPF/Tax）的职责说明 | §1 #1 |
| | `118` | 提到的 `governance/` 目录不在上传的压缩包里 | §1 #21 |
| `ADR-000-independent-project.md` | `17`、`31` | 官方文件解析（Grab/EPF/SOCSO/LHDN）属于独立 domain；Compliance OS 拥有全部 Official Records（含 tax、EPF/SOCSO/EIS） | §1 #1 |
| `compliance-os-daily-allocation-checkpoint-2026-08-25.md` | `67` | 「EPF/SOCSO/Tax 计算——明确排除在这次范围外，从未开始」（与第一阶段不做计算器一致） | §0、§1 #1 |
| `compliance-os-daily-allocation-phase2-design.md` | `23–29`、`31–34` | 现有状态枚举表；「能沿用既有词就沿用，没有对应词才造新词」 | §3.2 |
| `PhaseP_Documents_Processing_State_Design_2026-10-17.md` | `33`、`575` | 暂称 ADR-007（未被采纳） | §11 D-13 |

### A.3 官方来源与外部材料

- **官方政策**（EPF/KWSP、LHDN/HASiL、PERKESO、Grab 页面）：逐条登记在 `Official_Policy_Register_2026-10-23.md` 第 2–5 节，每条带来源名称、页面/文件标题、可访问位置、页面日期（常为 NOT STATED）、适用范围与未确认项。**全部经 WebFetch/WebSearch 转述，不保证逐字一致，待你按登记表第 9 节的 10 项清单抽查。**
- **Google Apps Script `Lock` 参考文档**（`https://developers.google.com/apps-script/reference/lock/lock`）：§4.5 引用的「释放锁前建议 `flush`」等内容来自工具转述【官方证实·有限】。我后来想再抓取原页面来确认 `waitLock` 超时行为时，WebFetch 返回 `PROVENANCE_REQUIRED`（权限请求没有被答复）；我没有重试，也没有用别的办法绕过。所以 `waitLock` 超时行为与「同一次执行里重复获取同一个锁」保持【待验证】，列入 V2。
- **第三方来源**：全部只是线索，不作依据（登记表第 6 节）。LHDN 的两份新闻稿抓取失败，内容没有读到，不作依据【BLOCKED】（登记表 N3）。

---

## 附录 B：手算场景（黄金数据的第一批）

**这些场景的用途**：把 §3–§7 的规则落到可以逐项核对的数字上；实现之后它们成为 Node 黄金测试（§9.4）。

**它们是什么、不是什么**

- 是我**手算**的预期结果。我**没有**写原型引擎来跑它们——那等于在实现（授权 §7）。日期差与金额合计用一次性的小脚本核对过（只做加减和日期差，不做任何状态判定，也不是引擎）。
- 全部**虚构**：参考号 `EXAMPLE-…`、文件哈希、金额、日期，都不代表任何真实收据、通知书或账号。B4、B8、B10 里的税务数字尤其不是任何真实的 CP500。
- 每个场景标了所属切片。
- 键用简写：`PAY-R001` = `CMP-PAY-SOCSO-SOCSO_CONTRIBUTION-EXAMPLE-R001-L1`；`PLN-2026-11` = `CMP-PLN-SOCSO-MAIN-SOCSO_CONTRIBUTION-2026-11`；其余同理。

### B1　SOCSO：三个月一笔付款（S1；§5.7，§3.9「一笔付款跨多个周期」）

**设定**

| 计划行（`MAIN`，`SOCSO_CONTRIBUTION`，`USER_PLAN`，OUT） | `period_key` | `planned_amount` | `due_date` |
|---|---|---|---|
| `PLN-2026-11` | 2026-11 | 49.40 | 2026-11-05 |
| `PLN-2026-12` | 2026-12 | 49.40 | 2026-12-05 |
| `PLN-2027-01` | 2027-01 | 49.40 | 2027-01-05 |

- 证据 `EV-R001`：`SOCSO_PAYMENT_RECEIPT`，`DRIVE_FILE`，文件哈希 `0123456789ABCDEF…`，`official_reference=EXAMPLE-R001`。
- 付款 `PAY-R001`：`SOCSO_CONTRIBUTION`，OUT，**148.20**，`payment_date=2026-11-02`，`line_no=1`，`payer_channel=SELF`；覆盖 **2026-11-02 … 2027-02-01**，`coverage_basis=PRINTED_ON_RECEIPT`（**假设**收据上这样写，不是任何规则的结果）。
- 链接（`SETTLES`）：`PAY-R001` → 三条计划行，各分配 49.40。

**结果（`asOf = 2026-11-05`）**

| 计划行 | P | S | 状态 | 标注 | `settled_on` | 期限（依据） | `days_to_deadline` |
|---|---|---|---|---|---|---|---|
| `PLN-2026-11` | 49.40 | 49.40 | `Paid` | — | 2026-11-02 | 2026-11-05（`PLANNED_DUE_DATE`） | 空（已结清） |
| `PLN-2026-12` | 49.40 | 49.40 | `Paid` | — | 2026-11-02 | 2026-12-05 | 空 |
| `PLN-2027-01` | 49.40 | 49.40 | `Paid` | — | 2026-11-02 | 2027-01-05 | 空 |

- `unallocated_payments`：无（148.20 − 3 × 49.40 = 0）。
- **时间线**：一个陈述区间 `[2026-11-02, 2027-02-01]`，**92 天**；`covered_today=true`，`covered_until=2027-02-01`。窗口 `[2026-11-01, 2027-02-28]`（120 天）：已覆盖 92，未覆盖 28（2026-11-01 一天，加 2027-02-02 … 02-28 共 27 天）。

| 月 | 天数 | 已覆盖 | 未覆盖 |
|---|---|---|---|
| 2026-11 | 30 | 29 | 1（11-01） |
| 2026-12 | 31 | 31 | 0 |
| 2027-01 | 31 | 31 | 0 |
| 2027-02 | 28 | 1 | 27 |

- `COVERAGE_OUTSIDE_PLAN_PERIOD`：无（覆盖区间与三个计划月份都相交）。

**变体：`asOf = 2026-11-01`**：`payment_date=2026-11-02 > asOf`，这笔付款整笔不计入（§3.3）→ 三行都是 `Planned`（`S=0`，`asOf ≤` 期限），时间线 `no_coverage_recorded`，付款也不出现在 `unallocated_payments` 里。

**检验的规则**：§3.3 的 as-of 规则；§5.2 的区间天数与逐月表；变异 M3/M4（区间端点）。

### B2　部分付款 → 逾期 → 补齐（S1；§3.5、§3.6）　EPF 缴款

**设定**：计划行 `CMP-PLN-EPF-MAIN-EPF_CONTRIBUTION-2026-11`（`USER_PLAN`，OUT）：**300.00**，`due_date=2026-11-30`，期限 = `due_date`（`PLANNED_DUE_DATE`）。付款 `X1`：`EPF_CONTRIBUTION` **100.00**，`payment_date=2026-11-10`（`EXAMPLE-E021`）；`X2`：**200.00**，`payment_date=2026-12-03`（`EXAMPLE-E022`）。两笔都全额链接到这一行。

| `asOf` | 计入的付款 | S | 状态 | 标注 | 缺口 | `days_to_deadline` |
|---|---|---|---|---|---|---|
| 2026-11-09 | 无（`X1` 的付款日是 11-10） | 0.00 | `Planned` | — | 300.00 | 21 |
| 2026-11-20 | `X1` | 100.00 | `Partially_Paid` | — | 200.00 | 10 |
| 2026-11-30 | `X1` | 100.00 | `Partially_Paid`（`asOf` = 期限当天，**没有**逾期） | — | 200.00 | 0 |
| 2026-12-01 | `X1` | 100.00 | `Overdue` | `PARTIAL` | 200.00 | −1 |
| 2026-12-02 | `X1`（`X2` 的付款日是 12-03，还不算） | 100.00 | `Overdue` | `PARTIAL` | 200.00 | −2 |
| 2026-12-03 | `X1` + `X2` | 300.00 | `Paid` | `PAID_LATE`（`settled_on=2026-12-03`，晚 3 天） | 0.00 | 空 |

**检验的规则**：期限当天不逾期（变异 M1：`>` 改成 `>=`，第 3 行会变成 `Overdue`）；§3.3 的 as-of 规则（第 1、5 行）；`PAID_LATE`（§3.6）。

### B3　一笔付款对应多个计划，剩余部分不被悄悄分配（S1；§3.8、§3.9）　EPF 缴款

**设定**：计划行 `2026-11`：100.00，`due_date=2026-11-30`；`2026-12`：100.00，`due_date=2026-12-31`。付款 `X`：`EPF_CONTRIBUTION` **250.00**，`payment_date=2026-11-15`（`EXAMPLE-E010`，`line_no=1`；EPF 付款的 `coverage_*` 三栏必须为空）。链接：`X` → `2026-11` 100.00；`X` → `2026-12` 100.00。

**结果（`asOf = 2026-11-20`）**

| 项 | 结果 |
|---|---|
| `2026-11` 行 | S = 100.00 = P → `Paid`，`settled_on=2026-11-15` |
| `2026-12` 行 | S = 100.00 = P → `Paid`（提前付清），`settled_on=2026-11-15` |
| `unallocated_payments` | `X`：250.00 − 200.00 = **50.00**，状态 `Not_Planned`，`unallocated_cents=5000` |
| totals | 计划 200.00、已结清 200.00、缺口 0、超额 0；`Not_Planned` 的 50.00 **单独成桶，不并入计划总额** |

**后续**：你决定剩下的 50.00 是给 2027-01 的：新增计划行 `2027-01`（50.00，`due_date=2027-01-31`，`ORIGINAL`），再建链接 `X` → `2027-01` 50.00 → 未分配归零，`2027-01` 行 `Paid`。**系统不会替你猜这 50.00 属于哪个月**；如果它其实是多缴，保持 `Not_Planned` 就是如实的呈现。

### B4　退款抵减与计划修订（S3；§3.3、§3.6、§7.4–§7.5）　Tax，**虚构数字**

**设定**：状态 `TAX/CP500_NOTICE/YA2026` = `NOTIFIED`（证据 `N1`）。计划行 `PLN-I01`：`TAX_INSTALMENT`，`origin=OFFICIAL_NOTICE`，`instalment_no=1`，**500.00**，`due_date=2026-12-15`，没有 `stated_deadline_date`；规则 `tax.cp500.payment_grace_days` 在 `Policy_Rule` 里**不是** `OFFICIAL` → 期限 = 2026-12-15，依据 `DUE_DATE_ONLY_RULE_PENDING`，带标注 `DEADLINE_RULE_PENDING`。付款 `T1`：`TAX_PAYMENT` **500.00**，`payment_date=2026-12-10`（`EXAMPLE-T001`）。退款 `R1`：`TAX_REFUND`（IN）**80.00**，`payment_date=2027-01-20`（`EXAMPLE-T002`）。两者都链接到 `PLN-I01`（`R1` 方向相反，符号为负）。

| `asOf` | S | 状态 | 标注 | 缺口 | `days_to_deadline` | `settled_on` |
|---|---|---|---|---|---|---|
| 2026-12-12 | 500.00 | `Paid` | `DEADLINE_RULE_PENDING` | 0.00 | 空 | 2026-12-10 |
| 2027-02-15 | 500.00 − 80.00 = 420.00 | `Overdue` | `PARTIAL`、`DEADLINE_RULE_PENDING` | 80.00 | −62 | 空 |

**然后**：收到修改后的通知书 `N2`（`TAX_NOTICE_REVISED`）。你写：状态 `REVISED`（证据 `N2`）；`PLN-I01` 的 `REVISION`（seq 2）：**420.00**，`notice_evidence_id=N2`，reason 写明。

| `asOf` | S | P | 状态 | 标注 | `settled_on` |
|---|---|---|---|---|---|
| 2027-02-15 | 420.00 | 420.00 | `Paid` | `DEADLINE_RULE_PENDING` | 2026-12-10（累计在 12-10 第一次 ≥ 420.00；之后退款使累计恰好等于 420.00，没有再跌破，所以没有新的跨越）；12-10 ≤ 期限 12-15，没有 `PAID_LATE` |

**检验的规则**：退款符号（变异 M2：符号反了会得到 S = 580.00 → `Overpaid`）；计划修订不改写历史；期限规则 `PENDING` 时的退回与标注。

### B5　写入原语的返回值（S1；§4.2–§4.4）

**前提**：接 B1 的数据（`PAY-R001` 与三条计划行已存在；另有一条 `PLN-2027-02` 计划行）。按顺序发生：

| # | 提交 | 此时的状态 | 返回 | 写入 |
|---|---|---|---|---|
| 1 | `PAY-R001` `ORIGINAL`（seq 1，148.20） | 链上没有这个键 | `Appended` | +1 行 |
| 2 | 完全相同的提交再发一次（双击／超时重试） | seq 1 已有，且逐栏相同（忽略 `recorded_at`） | `Already_Recorded` | 不写 |
| 3 | 同键 seq 1，但金额写成 150.00 | seq 1 已有，内容不同 | `Conflict` | 不写 |
| 4 | 同键 seq 3（跳过了 2） | 链上最大序号是 1 | `Stale_Sequence`（期望 2） | 不写 |
| 5 | 三条链接已建（共 148.20）之后：`CORRECTION` seq 2，金额改成 100.00 | 有效分配额 148.20 > 新金额 100.00 | `Rejected`：`ALLOCATION_EXCEEDS_AMOUNT` | 不写 |
| 6 | `CORRECTION` seq 2，金额不变，`payment_date` 改为 2026-11-03，reason 写明 | 通过 | `Appended` | +1 行；有效视图用 seq 2 |
| 7 | 再建一条链接：`PAY-R001` → `PLN-2027-02`，分配 10.00 | 已分配 148.20 = 付款额 | `Rejected`：`OVER_ALLOCATION` | 不写 |
| 8 | 对 `PAY-R001` 写 `VOID`（seq 3） | 还有 3 条有效 `SETTLES` 链接 | `Rejected`：`LINKS_EXIST` | 不写 |
| 9 | 另登记一笔付款，参考号抄成 `EXAMPLE-R0O1`（把数字 0 写成了字母 O），指向同一份证据、`line_no=1` | 同一个 `(evidence_id, line_no)` 已有有效付款 | `Rejected`：`DUP_EVIDENCE_LINE` | 不写 |
| 10 | 登记一笔付款，金额写成 49.404 | 行级校验不通过（超过 2 位小数，D-10） | `Invalid`（一次列出全部错误，**没有进锁**） | 不写 |

另外还有 `Lock_Timeout`：等锁超过 10 秒，没有写入，可安全重试；真实 GAS 里的行为列在 V2。

**顺序有意义**：先比较「是否相同」，再做校验（§4.3）。所以一次已经成功的提交被重试时，永远不会因为后来发生的事（例如证据后来被作废）变成拒绝——它返回 `Already_Recorded`，并带上链头信息，让界面能说「已登记，但当前是作废状态」。变异 M6 就是把这个顺序对调。

**检验的规则**：§4.3 的六个返回值；§4.4 的锁内检查；变异 M5、M7、M11。

### B6　Grab 索偿折叠与净成本（S2；§5.4、§5.5）

**设定**：沿用 B1 的付款 `PAY-R001`（148.20）。有两个索偿（2027-01 还没有）：

| 索偿 | `event_seq` | 事件 | 日期 | 金额 | 引用 |
|---|---|---|---|---|---|
| `CMP-RMB-GRAB-SOCSO-2026-11` | 1 | `CLAIM_OPENED` | 2026-12-01 | — | — |
| | 2 | `CLAIM_RECEIVED` | 2026-12-10 | 10.00 | `receipt_reference=EXAMPLE-G001` |
| `CMP-RMB-GRAB-SOCSO-2026-12` | 1 | `CLAIM_OPENED` | 2027-01-02 | — | — |
| | 2 | `CLAIM_APPROVED` | 2027-01-08 | 10.00 | `application_reference=EXAMPLE-A002` |
| | 3 | `CLAIM_RECEIVED` | 2027-01-10 | 6.00 | `receipt_reference=EXAMPLE-G002` |

`FUNDS_CLAIM` 链接：`PAY-R001` → 2026-11 索偿 49.40；`PAY-R001` → 2026-12 索偿 49.40（合计 98.80 ≤ 148.20；**不占用** `SETTLES` 的分配额）。

**折叠结果**

| 索偿 | `stage` | 批准额 | 实收 | 目标 | 状态 | 标注 | 净成本 |
|---|---|---|---|---|---|---|---|
| 2026-11 | `OPENED` | — | 10.00 | 空 | `Received` | `NO_TARGET_AMOUNT` | 49.40 − 10.00 = **39.40** |
| 2026-12 | `APPROVED` | 10.00 | 6.00 | 10.00 | `Partially_Received`（缺 **4.00**） | — | 49.40 − 6.00 = **43.40** |

- 制度合计（标注「合计，不按月对应」）：总付款 148.20；总实收 16.00；总净额 **132.20**。
- 2027-01 没有索偿 → 没有这一行，也没有净成本；B1 里 2027-01 的付款状态仍是 `Paid`——两本账互不影响。

**变体**

| 变体 | 结果 |
|---|---|
| (a) 同一笔到账再登记一次：2026-12 索偿，`CLAIM_RECEIVED`，2027-01-10，6.00，`EXAMPLE-G002` | `Rejected`：`RECEIVED_DUPLICATE` |
| (b) 6.00 其实是 8.00：追加 seq 4 `VOID_EVENT`（`voids_event_seq=3`，reason），再追加 seq 5 `CLAIM_RECEIVED` 8.00 | 折叠跳过被作废的事件：实收 8.00，目标 10.00 → `Partially_Received`，缺 2.00；净成本 49.40 − 8.00 = 41.40 |
| (c) 实收 12.00、批准 10.00 | `Over_Received`（超出 2.00） |
| (d) 一个新索偿的第一个事件就是 `CLAIM_RECEIVED` | `Rejected`：`FIRST_EVENT_MUST_BE_OPENED` |
| (e) 对一个还没有 `CLAIM_OPENED` 的索偿建 `FUNDS_CLAIM` 链接 | `Rejected`：`CLAIM_NOT_OPENED` |

### B7　SOCSO 覆盖时间线：相接、缺口、重叠、未陈述（S1；§5.2）

**设定**：5 笔 SOCSO 付款（全部 `SELF`，虚构）：

| 付款 | `payment_date` | 陈述的覆盖区间（含首尾） | 天数 |
|---|---|---|---|
| Pa | 2026-01-10 | 2026-01-10 … 2026-02-09 | 31 |
| Pb | 2026-02-10 | 2026-02-10 … 2026-03-11 | 30 |
| Pc | 2026-03-20 | 2026-03-20 … 2026-04-19 | 31 |
| Pd | 2026-04-10 | 2026-04-10 … 2026-05-09 | 30 |
| Pe | 2026-05-12 | `NOT_STATED`（收据上没写覆盖期） | — |

`asOf = 2026-05-20`；窗口 `[2026-01-01, 2026-05-31]`（151 天）。

**结果**

- **连续覆盖段**：`[2026-01-10 … 2026-03-11]`，**61 天**（Pa 与 Pb **首尾相接**：Pa 的末日 + 1 = Pb 的起日，合并）；`[2026-03-20 … 2026-05-09]`，**51 天**（Pc 与 Pd 重叠后合并）。
- **缺口**：`2026-03-12 … 2026-03-19`，**8 天**。
- **重叠**（信息标注 `COVERAGE_OVERLAP`）：Pc 与 Pd，`2026-04-10 … 2026-04-19`，**10 天**。系统不判断重叠是否会让覆盖「顺延」——那取决于 PERKESO 的规则，没有官方文字（§5.1）。
- **覆盖期未陈述**：Pe 列在 `coverage_unstated[]`，不参与计算，也不会被补成任何区间。
- **窗口报告**：已覆盖 **112** 天，未覆盖 **39** 天（2026-01-01…01-09 共 9 天 + 03-12…03-19 共 8 天 + 05-10…05-31 共 22 天）。
- **截至 `asOf`**：`covered_today=false`；`last_coverage_end=2026-05-09`；`uncovered_days=11`。

| 月 | 天数 | 已覆盖 | 未覆盖 |
|---|---|---|---|
| 2026-01 | 31 | 22 | 9 |
| 2026-02 | 28 | 28 | 0 |
| 2026-03 | 31 | 23 | 8 |
| 2026-04 | 30 | 30 | 0 |
| 2026-05 | 31 | 9 | 22 |
| 合计 | 151 | 112 | 39 |

**`covered_on(date)`**

| 日期 | 结果 |
|---|---|
| 2026-01-09 | 否 |
| 2026-01-10 | 是（Pa） |
| 2026-03-11 | 是（Pb） |
| 2026-03-12 | 否 |
| 2026-03-19 | 否 |
| 2026-03-20 | 是（Pc） |
| 2026-04-15 | 是（Pc 与 Pd） |
| 2026-05-09 | 是（Pd） |
| 2026-05-10 | 否 |

**检验的规则**：变异 M3（合并去掉 `+1` → Pa 与 Pb 不再合并，61 天的连续段会拆成两段）、M4（`coverage_end` 当开区间 → 03-11 变成「否」）；`NOT_STATED` 被排除。

### B8　`settled_on` 取最后一次跨越；`PAID_LATE`（S3；§3.6）　Tax，**虚构数字**

**设定**：`TAX_INSTALMENT` 行 **100.00**，`due_date=2026-06-30`，没有 `stated_deadline_date`；规则未核实 → 期限 = 2026-06-30（`DEADLINE_RULE_PENDING`）。付款 `T1` **+100.00**，2026-06-20；退款 `R1` **−30.00**，2026-07-05；付款 `T2` **+30.00**，2026-07-10。三笔都链接到这一行。

| `asOf` | 计入 | S | 状态 | 标注 | `settled_on` | `days_to_deadline` |
|---|---|---|---|---|---|---|
| 2026-07-01 | `T1` | 100.00 | `Paid` | `DEADLINE_RULE_PENDING` | 2026-06-20 | 空 |
| 2026-07-06 | `T1` + `R1` | 70.00 | `Overdue`（缺 30.00） | `PARTIAL`、`DEADLINE_RULE_PENDING` | 空 | −6 |
| 2026-07-15 | `T1` + `R1` + `T2` | 100.00 | `Paid` | `PAID_LATE`、`DEADLINE_RULE_PENDING` | **2026-07-10**（晚 10 天） | 空 |

**`settled_on` 的推导**：累计 100.00（06-20，第一次 ≥ P）→ 70.00（07-05，回到 < P）→ 100.00（07-10，再次 ≥ P）。取**最后一次**跨越，所以是 07-10，不是 06-20。这一行就是「最后一次跨越」的黄金用例：改成「第一次」之后，第 3 行不再 `PAID_LATE`。

### B9　EPF 两个计划集的预算比较（S3；§3.10、§6.2）　**虚构数字**

**设定**

- `ALT-SELF`（`scheme_option=SELF-PAID`）：`EPF_CONTRIBUTION` `2026-11`：200.00（`due_date=2026-11-30`）；`2026-12`：200.00（`due_date=2026-12-31`）。没有预期奖励行。
- `ALT-PLATFORM`（`scheme_option=VIA-PLATFORM`）：同样两行缴款，再加一行 `EPF_INCENTIVE_EXPECTED`：`period_key=2026`，IN，**80.00**，`due_date=2027-06-30`（你自己定的预期日期），`note`：「虚构示例：手填，不是 EPF 确认的数字；依赖的规则 PENDING」。（80.00 取 400.00 的 20% 只是为了得到一个看得出来的数；**系统没有算它**。）

**比较输出**

| | `ALT-SELF` | `ALT-PLATFORM` |
|---|---|---|
| 计划缴款合计（OUT） | 400.00 | 400.00 |
| 预期奖励合计（IN，你手填） | 未填（0.00） | 80.00（预期，**非 EPF 确认**） |
| 预期净支出（= 缴款 − 预期奖励） | 400.00 | 320.00 |
| 规则状态提示 | — | `Rule_Pending`：`epf.i_saraan_plus.self_paid_counts`、`epf.incentive.year_basis`（§6.4 的 PENDING 清单） |

函数**不**给出「哪个方案更好」的结论。

**采纳 `ALT-PLATFORM` 之后**：用显式复制操作把各行写成 `MAIN` 行（新键 `ORIGINAL`，reason 写「采纳 ALT-PLATFORM」）。此时若最新的 i-Saraan Plus 状态仍是 `NOT_REGISTERED`，`MAIN` 里那一行预期奖励会带 `INCENTIVE_NOT_REGISTERED` 标注——你需要先登记 `REGISTERED`（带证据）。将来 EPF 入账奖励 60.00（虚构）：登记 `EPF_INCENTIVE_CREDIT`（IN）+ 证据，链接到那一行预期奖励：S = 60.00 < P = 80.00，`asOf` 在 2027-06-30 之前 → `Partially_Paid`（对 IN 方向的行，「已结清」指已收到）；EPF 汇总里「预期 vs 已确认」差 20.00，**只呈现事实**——奖励一年入账两次、视政府拨款（登记表 POL-EPF-01），所以「还没入账」不等于「拿不到」。如果没有建立链接，这笔入账仍是官方记录，并出现在 `unallocated_payments`（`Not_Planned`，60.00）。

### B10　Tax 状态链：`NOT_NOTIFIED → NOTIFIED → REVISED`（状态陈述 S1，计划行 S3；§7.2–§7.4）　**虚构数字**

| 日期 | 动作 | 结果 |
|---|---|---|
| 2026-10-24 | `Scheme_Status_Log` 写 `TAX / CP500_NOTICE / YA2026` = `NOT_NOTIFIED`，`USER_STATED`，`as_of_date=2026-10-24`（键 `CMP-STS-TAX-CP500_NOTICE-YA2026-20261024`） | 税务视图顶部：「截至 2026-10-24，你陈述尚未收到 YA2026 的 CP500」；没有计划行；**不生成任何预算** |
| 同日 | 试图写一条 `TAX_INSTALMENT` 计划行 | `Rejected`：`NOTICE_STATUS_MISSING`（最新状态是 `NOT_NOTIFIED`） |
| 2026-11-20 | 登记通知书 `N1`（`TAX_NOTICE_CP500`，通知书上印的日期 2026-11-15，`EXAMPLE-N001`）；状态链写 `NOTIFIED`（`as_of_date=2026-11-20`，证据 `N1`）；逐期**抄写** I01：500.00，应缴日期 2026-12-15；I02：500.00，应缴日期 2027-02-15（`OFFICIAL_NOTICE`，`notice_evidence_id=N1`） | `asOf=2026-11-25`：I01 `Planned`（距期限 20 天），I02 `Planned`（82 天）；两行都带 `DEADLINE_RULE_PENDING`（宽限规则未核实，期限 = 应缴日期） |
| 2027-01-10 | 收到修改后的通知书 `N2`（`TAX_NOTICE_REVISED`）；状态链写 `REVISED`（`as_of_date=2027-01-10`，证据 `N2`） | I01、I02 的 `notice_evidence_id` 仍是 `N1` → 两行都带 `NOTICE_SUPERSEDED`（只提醒，不阻断） |
| 2027-01-11 | I02 `REVISION`（seq 2）：金额改为 400.00，`notice_evidence_id=N2`，reason 写明；I01 `REVISION`（seq 2）：金额不变，`notice_evidence_id=N2`，reason「按修改后通知书重新确认」 | `NOTICE_SUPERSEDED` 消失——这个标注只能靠登记来清除，系统不会自动换证据 |
| `asOf=2027-01-25`（I01 仍未付） | — | I01 `Overdue`（−41 天）；I02 `Planned`，400.00（距期限 21 天） |

**如果规则 `tax.cp500.payment_grace_days` 有 `OFFICIAL` 版本（值 30）**：期限变成 I01 = 2027-01-14（`DUE_DATE_PLUS_RULE_GRACE`）、I02 = 2027-03-17；`asOf=2027-01-25` 时 I01 仍是 `Overdue`（−11 天），I02 `Planned`（51 天）；页面上「应缴日期」与「最后缴款日」两个日期分开显示（§7.6）。这只是演示规则被使用时的样子——规则在你抽查之前不会被写进 `Policy_Rule`（R15）。

---

## 附录 C：本轮触碰了什么

- **读取**：你上传的 handoff 与授权文件；`07.Compliance-main.zip`（解压在临时目录，只读，没有改动任何文件）；官方网页（WebFetch/WebSearch，只读）。
- **授权 §1 点名的文档，在这个仓库里对应什么**：「00_Constitution」→ `900_Constitution.js`；「ADR」→ `ADR-000…006` 与索引；「File Map」→ governance 草案 §6（`compliance-os-governance-draft.md:348–356`；草案里规划的 `907_File_Map.js` 在仓库里没有）；「Project State」→ governance 草案 §9（`:418` 起；规划的 `908_Project_State.js` 在仓库里也没有）；「VERIFICATION_STATUS」→ `VERIFICATION_STATUS.md`；「Review History」→ **没有找到同名文件或章节**，我读了 `CHANGELOG.md` 里与 ADR 索引有关的条目；本设计没有引用 `PhaseA_Design_Review.md`、`ArchitectureDecisionConfirmation_2026-09-15.md` 这类历史评审文档（与本设计的数据模型无直接关系）。如果你指的 Review History 是它们或别的东西，请告诉我。
- **写入**：仅 `/home/claude/deliverables/` 下的文档（本设计文档、ADR 草案、政策登记表、Phase P 调查报告）与 Phase P 的一次性复现脚本（在 repo **副本**上用内存假对象跑，不联网）；临时目录里的中间文件与一次性算术核对脚本（附录 B 用，只做加减与日期差，不是引擎）。
- **没有做**：修改生产代码；修改测试代码；修改真实数据；写入真实 GAS；部署；调用真实 Gemini；实现 PDF/LLM 自动提取；实现 EPF/Tax 计算器；涉及个人贷款或信用卡还款；修复 Phase P；重跑无关的 Compliance OS 全量回归；制作 ZIP；把 Node 结果当成真实环境验证；扩大到其他 OS；修改任何已批准的治理文件。建表、写 Schema、写原型引擎也都**没有**做（授权 §1）。

