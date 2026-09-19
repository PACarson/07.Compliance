# Compliance OS — Module Catalog

逐档核对实际代码（`module.exports`/函数签名），不是凭文件名推断。测试文件（`NN_Tests_*.js`）与历史快照（`999_PhaseB_Baseline*.js`）不单独列出，除非在文中特别说明。

---

### 105_TestUtils.js
- **Responsibility**: 测试专用共用工具/fixture（`assertEqual_`、`fakeStore_`、`fakeSheetAccessor_`、`fakeLockProvider_`、共用的 Grab Statement 文字 fixture）
- **Owned data**: 无（纯测试辅助）
- **Dependencies**: 无
- **Verification status**: 自身即测试基础设施，不适用"验证"概念
- **Known limitations**: 无

### 106_Utils.js
- **Responsibility**: 生产代码共用工具（`round2_` 四舍五入、`normalizeIsoDateString_` 日期防御性转换）
- **Execution entry points**: 被多个模块 import
- **Verification status**: Node tests PASS（间接透过使用它的模块测试覆盖）

### 108_SheetSetup.js
- **Responsibility**: 一次性建立/校验全部 Sheet 的 schema（`setupComplianceOsSheets`），栏位定义直接引用各模块自己的 `*_COLUMNS` 常量，日期/ID 类栏位强制纯文字格式
- **Owned data**: Sheet 结构本身（不拥有业务数据）
- **Execution entry points**: `setupComplianceOsSheets()`（手动执行）
- **Verification status**: Node PASS；真实 GAS 执行过（Steven 已建立全部 Sheet）

### 110_DocumentImport.js
- **Responsibility**: Document Import 主流程编排（`runImportPipeline_`）：去重 → 抽取 → 校验 → Verified Income 发布 → 非阻断 Reconciliation
- **Owned data**: `Documents` 表
- **Inputs**: Drive 文件（fileId/mimeType/documentId）
- **Outputs**: `Documents` 行、（间接触发）`Verified_Income` 行
- **Dependencies**: 112（抽取）、120/121（regex 路径）、125（结构化路径校验）、130（Reconciliation）、140（发布）
- **Execution entry points**: `processGrabStatement_`、`runImportPipeline_`、由 170 的 console 函数调用
- **Persistence behavior**: 一次成功 import 写一笔 `Documents`
- **Verification status**: Node PASS；真实 GAS 部分验证（2026-08-21 consoleBatchImport 真实跑过到抽取边界）
- **Known limitations**: 2026-09-15 起明确**不**调用 142（Separate Execution Boundary，见 ADR-004），不是遗漏

### 112_DocumentTextExtractor.js
- **Responsibility**: Provider factory，`DocumentTextExtractor` 单例只往外暴露 `.extract()`（statement 层级）——**不暴露** `.extractOrders()`
- **Dependencies**: 127（llm provider，lazy 载入）
- **Verification status**: Node PASS；真实 GAS 已确认 LLM 路径可用（2026-08-21）
- **Known limitations**: OCR provider（`ocr` mode）至今仍是未实作的占位（`placeholderOcrExtractor_`），只会抛错，从未真的实作过

### 115_TruthWriter.js
- **Responsibility**: 唯一的写入出口（`createTruthWriter_`/`appendValidatedRow`），append-only（UCR6），真实 GAS 版本透过 Script Property `SPREADSHEET_ID` + `openById`（不是 `getActive()`）
- **Verification status**: Node PASS；真实 GAS 验证过

### 117_SheetReader.js
- **Responsibility**: 唯一的读取出口（`createSheetReader_`/`readAll`），TruthWriter 的对称层
- **Verification status**: Node PASS

### 120_DocumentParsing.js
- **Responsibility**: `DocumentParser`/`ParserRegistry`——可插拔 Parser 注册机制
- **Verification status**: Node PASS

### 121_GrabWeeklyParser.js
- **Responsibility**: Grab Weekly Statement 的 regex/token-matching 解析器（`GrabWeeklyParser`），statement 层级，不含逐笔订单
- **Known limitations**: 只在 `mode='text'` 路径使用；`mode='structured'`（LLM）路径不经过这里

### 123_RiderOSAdapter.js
- **Responsibility**: Rider OS 数据的唯一读取入口（ADR-001），占位实作
- **Known limitations**: Rider OS 真实的 `RIDER_WEEKLY_ESTIMATE_READY` 发布能力尚未确认存在（外部依赖，ADR-003 之后已降级为可选）

### 125_ExtractionValidation.js
- **Responsibility**: 结构化抽取候选的确定性校验（schema/period/arithmetic），CMP-P14 的落地——LLM 候选值必须通过这层才能进一步处理
- **Verification status**: Node PASS（含 hallucination 负向测试）
- **Known limitations**: 本次治理建设 Strict Scope Boundary 明确禁止修改，未重新审阅

### 127_LLMExtractor.js
- **Responsibility**: Gemini `generateContent` provider，两个方法：`extract()`（statement 层级）、`extractOrders()`（订单层级，ADR-005）；evidence 一律写入 Drive（不论校验结果）；429/5xx 指数退避重试
- **Dependencies**: Gemini API（`GEMINI_API_KEY` Script Property）
- **Verification status**: **ADR-005 CLOSED**——但仅限锁定的 W01 fixture、`extractOrders()` 路径，见 ADR-005 全文；`extract()`（statement 层级）本身没有经过同等规格的真实 PDF 独立核对
- **Known limitations**: 本次治理建设 Strict Scope Boundary 明确禁止修改，未重新审阅

### 130_Reconciliation.js
- **Responsibility**: 可选、非阻断的对账（ADR-003），`runReconciliationForWeek_`/`getCurrentReconciliationStatus_`
- **Owned data**: `Reconciliation_Log`（append-only）
- **Verification status**: Node PASS；真实 GAS 验证过（2026-08-17 前后）

### 140_VerifiedIncome.js
- **Responsibility**: Verified Income 的发布（`verifyAndPublishIncome_`），发布前检查 `existingIncomeIds` 防重复
- **Owned data**: `Verified_Income`（Finance OS 唯一读取的表）
- **Verification status**: Node PASS；真实 GAS 验证过

### 142_DailyOrderAllocation.js
- **Responsibility**: 订单层级抽取编排（`runGeminiOrderExtractionWithFallback_`，内部呼叫 `extractOrders()`）、逐日汇总与持久化（`writeDailyAllocationBatch_`）、幂等（skip-if-已 Fully_Allocated，`force:true` 可覆盖）
- **Owned data**: `Daily_Allocation`、`Non_Order_Income_Allocation`
- **Execution entry points**: 2026-09-15 前**无任何生产呼叫方**，只有自己的测试文件调用；2026-09-15 起由 170 的 `consoleRunDailyAllocation_` 调用
- **Verification status**: 见 ADR-004/005 全文——本次治理建设 Strict Scope Boundary 明确禁止修改，未重新审阅代码本身
- **Known limitations**: Order_Allocation/Monthly_Allocation 未实作；Insentif/Tip/Bayaran lain-lain 逐笔日期抽取未实作（`matchInsentifLineDate_` 等只做日期判定，判不出完整一行）

### 150_ComplianceCalendar.js
- **Responsibility**: 义务/提醒引擎（`computeObligationStatus_`/Upcoming-Due_Soon-Overdue 查询时即算，不存栏位）
- **Owned data**: `Compliance_Calendar`（定义）、`Compliance_Completions`（append-only 完成记录）
- **Verification status**: Node PASS；引擎本身设计上支援任意 category（路税/保险等已在注释里当范例）
- **Known limitations**: **目前没有任何一笔真实义务记录**；`EventPublisher` 是占位实作，真实推送到 Reminder OS 从未发生过

### 160_MonthlyProjection.js
- **Responsibility**: 月度/YTD 收入汇总（compute-on-demand，不存 rollup），Compliance Projection（SOCSO/EPF/Tax）
- **Dependencies**: 142（`getLatestDailyAllocationRowsSafe_`，2026-09-15 新增，call-time lazy require 避免循环依赖）
- **Verification status**: **真实 GAS 已验证 PASS**（2026-09-15，`161_Tests_MonthlyProjection` 全数通过）
- **Known limitations**: `unallocated_non_order_income` 在同一周横跨的两个月各自查询时都会看到（跟既有 `needs_allocation` 同一逻辑），YTD 层级已正确去重，逐月数字本身不去重（设计如此，非缺陷）

### 170_OperatorConsole.js（+ .html）
- **Responsibility**: HTMLService Console，唯一的人工操作入口（批次汇入、Retry、Dashboard、Drill-down、2026-09-15 新增 Daily Allocation 触发）
- **Execution entry points**: 全部 `consoleXxx`（公开，无底线）转发到 `consoleXxx_`（私有，CMP-CR5）
- **Verification status**: **真实 GAS 部分验证**——2026-09-15 起两轮真实 GAS 执行发现并修复了环境相容性问题（见 VERIFICATION_STATUS.md），修复后版本待重新确认
- **Known limitations**: 新增的 `consoleRunDailyAllocation_` 尚未在真实 GAS 环境实际跑过（只跑过本地 Node 假 extractor 测试）

### 190_Tests_Contracts.js
- **Responsibility**: 验证每个 Parser/Adapter 是否满足其文档化的接口形状
- **Verification status**: Node PASS

### 195_Tests_GasLoadSimulation.js
- **Responsibility**: 用 Node vm 模块模拟 GAS 按字母序把全部文件载入同一个共享全域作用域，抓撞名/载入顺序问题
- **Verification status**: 2 项已知失败（`999_PhaseB_Baseline_v2/v3/v4.js` 三份历史快照互相宣告同名 const/function）——**pre-existing，与 2026-09-15 之后的改动无关**，逐字比对确认改动前后输出完全相同，未修复（不在任何一次治理/实作授权范围内）

### 900_Constitution.js / 901_System_Architecture.js
- **Responsibility**: 专案自己的 UEF/Blueprint 等价物——原则、编码规则、ADR、changelog（900）；模块清单、架构分层映射、验证历史（901）
- **Verification status**: 本次治理建设之后，`governance/` 目录是查询入口，900/901 保留作为详细历史记录与既有 GAS 载入顺序里的一部分（**本次治理建设未删除或停用 900/901，两者继续存在于代码库中**）

### 999_LatencyReliabilityObservation.js / 999_PersistenceVerification.js
- **Responsibility**: 观测/验证专用脚本，非生产路径
- **Known limitations**: `LATENCY_OBS_W01_FILE_ID` 是 hardcode 常量，历史上出现过 9 个不同值，成因未确认（见 ADR-005）

### 999_PhaseB_Baseline.js / _v2 / _v3 / _v4
- **Responsibility**: 历史快照，Gate 1/2 早期真实环境测试脚本
- **Known limitations**: 三份 v2/v3/v4 互相宣告同名 top-level const/function，会让 195 的 GAS 载入模拟失败（见上）；**UNKNOWN — REQUIRES VERIFICATION**：是否可以安全归档/移除，本次治理建设未评估，只记录 discrepancy
