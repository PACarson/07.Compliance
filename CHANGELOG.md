# Compliance OS — Governance Changelog

完整叙事细节见 `900_Constitution.js` 的 `changelog` 数组（本文件不重复维护第二份完整叙事，只做分类索引 + 指向）。这份文件区分变更类型，方便快速查询"这次变了什么类别的东西"。

## 变更类型

- **Governance changes** — 治理文件本身的建立/整理，不影响代码或数据
- **Architecture changes** — 系统边界、模块职责、execution boundary 等架构层级决定
- **Schema changes** — Sheet 栏位新增/调整
- **Extraction-contract changes** — Gemini prompt/schema/model/抽取范围的变化
- **Production code changes** — 生产代码本身的新增/修改
- **Verification-only changes** — 没有改代码，只是执行了验证并记录结果

## 两种流程

- **Code → Verify → Governance**：先看/先跑代码事实，再写进治理文件。本文件多数条目属于这一种。
- **Governance → Authorized Implementation**：先有明确架构决定（通常 Steven 直接决定），据此授权实作，实作完成后把验证结果写回。2026-09-15 的 Production Wiring Slice（Separate Execution Boundary）是这个流程的例子——Steven 先做架构决定，Claude 才动手实作。

---

## 2026-10-07 — Platform 别名 "4-Hour Delivery"（真实 GAS 触发的 fail-closed gate 命中）+ 143 测试档的 GAS-scope 既有缺陷修复 + 扫描结果排序 + PDF 汇入恢复中心 UI（ADR-006）+ Recovery 后端 mutation testing

- **类型**: Production code changes（142：`PLATFORM_ALIASES_`/`normalizePlatformLabel_`/`classifyPlatform_`，生产路径与旧死代码路径共用同一个判定；170.html：扫描结果排序下拉 + 纯函数 `sortScanFiles`；**170.html：「PDF 汇入恢复中心」区块——Pending/Failed/Completed 分页、单档 Retry、选取多档 Retry、Filter、Refresh；后端 `170_OperatorConsole.js` 一行没动**）+ Verification-only changes（Node + mutation + GAS 式 scope 模拟 + 整份真实 W14 数据端到端，非真实 GAS；143 新增 17 项、171 新增 38 项：13 排序 + 21 Recovery UI + 4 项后端 mutation 缺口断言，171 是这个专案第一个会读 170.html 的自动化测试）+ 测试档缺陷修复（143 的 resolver 提到顶层）
- **流程**: Code → Verify → Governance（Steven 提供 `debug.pdf` 真实 GAS 日志、明确指示"从 debug 开始写代码/修代码"；根因先对照实际代码核实，再修，再写治理文件）。Steven 2026-10-04 的 coding 暂停已于本窗口由他解除（顺序：先读 checkpoint → 先修 debug → 之后才回到 checkpoint 的项目）；同日上传的 `Emergency_Stop_Handoff_Checkpoint_2026-10-04.md` 写明该 checkpoint 本身不授予恢复权限——恢复授权来自 Steven 本窗口的明确指示
- 详见 `ADR-005` 新增 2026-10-07 段落、`ADR-006` 实作范围表下方的一致性核对说明、`VERIFICATION_STATUS.md` 新增第 8–11 项、`900_Constitution.js` 的 `changelog` 数组同日期条目
- Schema changes: NONE　Extraction-contract changes: NONE（`127` 的 Gemini schema/prompt 完全没动——Gemini 抽得没错）
- **别名证据来自 statement 原件本身**（`2026-W14.pdf`）：印刷的「Pendapatan asas Express」53.50 = 7 笔 GrabExpress(Instant) 47.50 + 这笔 4-Hour Delivery 的 6.00；7 天印刷小计合计 = 1,297.80 = 逐笔加总。用原件核对时发现 `debug.pdf` 里外部分析把 RM207.70 当成 3 April 的小计是错的（那是 4 April 的；3 April 是 RM222.20），机制不变
- **Mutation testing（ADR-006 先前记录的缺口，本次补做）**：Recovery 后端 26 种变异，初次有 4 个幸存者——`Completed` 的 `incomeIds` 取错栏位、`Failed` 的 `lastAttemptAt` 被拿掉、`consoleRetrySelectedFiles_` 拿掉 `isRetry=true`（会让每次「重试」都新增重复的 Documents 记录，总数 2 → 4，原有断言只数「原本那两个 id 还在」所以照样通过）、回传少了 `rebuild`；补 4 条断言（只新增、没改动 Steven 原有测试）后全部被抓到。Recovery UI 30 种变异，1 个幸存（Completed 分页「不能重试」的守卫没人测到），补测试后全部被抓到
- **Recovery Center UI 的设计取舍**（Steven 尚未逐项审阅）：一律手动「刷新状态」才读取、页面载入不自动打后端；没有自动重试、没有「全部重试」；「重试选中的」只动选中 ∩ 目前看得到 ∩ 有 Drive file id 的文件；后端回传 null/格式不对时明确显示错误、不崩；ADR-006 整体架构仍是 `PROPOSED`
- **一致性核对（已解决）**：回到 handoff 时，当时上传的 repo 快照缺 handoff 描述的 `127` 3 层模型链/重试预算、`112`/`170.js` 对应呼叫、`170.js` 的 Recovery Center 后端及 `128`/`171` 对应测试，但治理文件已把它们写成已实作；同日 Steven 上传了那 5 个档案，核对后合并，全部测试通过（见 `VERIFICATION_STATUS.md` 第 11 项）
- **诚实记录**：真实 GAS 尚未重新执行确认（包括 Recovery Center UI——真实浏览器/HTML Service 的渲染、`consoleGetRecoveryStatus` 在真实 `google.script.run` 下的传输都没验证过）；端到端测试里的「Gemini」是确定性替身（pdfplumber 对原件逐笔抽出），证明管线行为、不证明真实 Gemini 抽出同一份候选；排序没在真实浏览器看过；别名表结构、共用判定函式、`platform_raw` 新增、排序下拉等实作细节 Steven 尚未逐项审阅

## 2026-10-04 — PDF Import Recovery Center：审计 + 后端实作（ADR-006 新增，UI 未开始）+ 本窗口完整核对 checkpoint

- **类型**: Governance changes（新增 ADR-006）+ Production code changes（170：`consoleGetRecoveryStatus_`/`summarizeEvidenceFailure_`/`consoleRetrySelectedFiles_`/`realEvidenceScanner_`）+ Verification-only changes（Node 测试，非真实 GAS）
- **流程**: Governance → Authorized Implementation（外部 AI 起草的 Implementation Authorization Prompt 要求先审计、Steven 采纳；后端实作完成后，Steven 2026-10-04 明确指示暂停 coding、全窗口核对、治理/ADR 持久化、产出 checkpoint）
- 详见 `ADR-006-pdf-import-recovery-center.md`（新文件，完整审计发现+决定+已知限制+实作范围逐项状态）、`VERIFICATION_STATUS.md` 新增"PDF Import Recovery Center"一节、`900_Constitution.js` 的 `changelog` 数组同日期条目
- **诚实记录**：这批新增的后端逻辑已 Node 测试（全部 PASS）但未做 mutation testing、未经真实 GAS 验证；UI（`170_OperatorConsole.html`）完全未开始；`2026-W06.pdf` 这个促成本次工作的真实案例，目前仍无法透过 Console UI 实际验证是否解决

## 2026-10-02 — 模型链两层扩成三层（Steven 要求）+ consoleBatchImport 真实被 GAS 平台硬杀，拆分批次/单笔重试预算

- **类型**: Production code changes（127/112/170）+ Verification-only changes（真实 GAS Executions 记录揭露的硬杀事故）
- **流程**: Code → Verify → Governance（Steven 真实撞到 `consoleBatchImport` 被硬杀 + 明确要求第三层模型 → 诊断 → 修复 → 持久化，本次未额外要求先动治理文件，沿用默认流程；这一条延迟到 2026-10-04 才补写进治理文件，见上方同日期条目）
- 详见 `900_Constitution.js` 的 `changelog` 数组同日期条目、`VERIFICATION_STATUS.md` 新增第 7 项、`ADR-005` 新增 2026-10-02 段落（含诚实记录的未完全解决部分）
- **本条目包含一次架构补强，不是新的 accuracy 判准**：`realLLMExtractor_` 新增 `profile` 参数区分 `'batch'`（112 用，收紧预算、不换模型）/`'single'`（170 用，维持原本的三层链+耐心预算）

## 2026-10-01 — Gemini 503 自动切模型 + 第二份真实 statement（W05）accuracy 证据 + gemini-2.5-flash 查证更正

- **类型**: Production code changes（127）+ Verification-only changes（第二份真实 statement 的 accuracy 证据）+ 查证更正（非代码）
- **流程**: Code → Verify → Governance（真实 GAS 执行触发 → 诊断 → 修复 → 持久化；本次未额外要求先动治理文件，沿用默认流程）
- 详见 `900_Constitution.js` 的 `changelog` 数组同日期条目、`VERIFICATION_STATUS.md` 新增第 4-6 项、`ADR-005` 新增 2026-10-01 段落
- 本条目包含一次对先前除错记录的更正：反复出现的"`gemini-2.5-flash` 是稳定选项"建议，经 2026-10-01 查证 Google 官方页面证实已经不适用于新专案

## 2026-09-27～29 — Gemini Schema 缺陷修复 + Dashboard Date-leak（第四次同根因）修复 + 重试加固 + Free-tier Quota 现实

- **类型**: Production code changes（127/142/170）+ Verification-only changes（真实 GAS 执行揭露 quota 现实）
- **流程**: Code → Verify → Governance（真实 GAS 执行触发/揭露 → 诊断 → 修复 → 持久化；Steven 2026-09-29 明确指示先更新治理文件再动代码）
- 详见 `900_Constitution.js` 的 `changelog` 数组同日期条目、`VERIFICATION_STATUS.md` 新增的两节（Date-object 缺陷群第 4 项、Gemini API Defects & Operational Blockers）、`ADR-005` 新增 2026-09-29 段落
- Schema changes: NONE　Extraction-contract changes: `127` 的 `printed_daily_subtotal` 欄位 `type` 写法修正（语意不变，见 VERIFICATION_STATUS.md）
- **本条目包含一次诚实更正**：2026-09-27 对 dashboard 白屏根因的诊断（归咎于 epf/tax 的 null）是错的，2026-09-28 查明更可能的真根因（Date 物件）并更正——过程写在 `VERIFICATION_STATUS.md`，不是事后删掉重写

## 2026-09-24～26 — Phase-B 历史脚本清理 + Date-object-from-Sheets 缺陷群修复 + ADR-004/005 首次真实端到端证据

- **类型**: Production code changes（142/160/170/143/161）+ Verification-only changes
- **流程**: Code → Verify → Governance（真实 GAS 执行触发 3 项缺陷 → 诊断 → 修复 → 持久化；999_PhaseB_Baseline 清理为 Steven 明确授权后执行）
- 详见 `900_Constitution.js` 的 `changelog` 数组同日期条目、`VERIFICATION_STATUS.md` 新增章节、2026-09-26 checkpoint/handoff 文件
- Schema changes: NONE　Extraction-contract changes: NONE（127/125 全程未改动）

## 2026-09-15 — Governance Foundation 建立（本次）

- **类型**: Governance changes
- **流程**: 不适用（整理既有证据，不是新决策）
- 建立 `governance/` 目录（本文件所在目录），恢复 ADR-000～005，建立 Module Catalog/Data Ownership/Verification Status/Architecture Overview
- **Production Code Changes: NONE**（本次任务严格禁止修改生产代码）

## 2026-09-15 — GAS Compatibility Fixes（`111`/`143`/`171` 测试文件）

- **类型**: Production code changes（测试文件本身，非业务逻辑）
- **流程**: Code → Verify → Governance（真实 GAS 执行失败 → 诊断 → 修复 → 记录）
- 详见 `VERIFICATION_STATUS.md` 的 "GAS Compatibility Bugs Found During Real Verification" 一节

## 2026-09-15 — Production Wiring Slice（Separate Execution Boundary）

- **类型**: Architecture changes + Production code changes（`160`/`161`/`170`/`171`）
- **流程**: **Governance → Authorized Implementation**——Steven 先确认架构（Execution A/B/C 分离），Claude 才动手
- 完整设计：`ArchitectureDecisionConfirmation_2026-09-15.md`；完整实作证据：`ProductionWiringSlice_Implementation_2026-09-15.md`
- Schema changes: NONE（沿用既有 `Daily_Allocation`/`Non_Order_Income_Allocation` schema，2026-09-05 已定案）
- Extraction-contract changes: NONE（`extractOrders()` 内部逻辑未改一行）

## 2026-09-06～2026-09-15 — ADR-005 / Gate 2 验证链（CLOSED）

- **类型**: Verification-only changes（直到 2026-09-06 修复 `resolveDateFromDayMonth_` 那一次例外，属于 Production code changes）
- **流程**: Code → Verify → Governance
- 完整时间序见 `adr/ADR-005-gemini-order-extraction.md`

## 2026-09-05～06 — Daily_Allocation/Non_Order_Income_Allocation 持久化

- **类型**: Production code changes（142 新增持久化函数）+ Schema changes（新增两张表）
- **流程**: Code → Verify → Governance
- 真实 GAS+Sheet 验证：2026-09-06（`999_PersistenceVerification.js`）

## 2026-08-24～25 — ADR-004/005 原始决策

- **类型**: Architecture changes + Extraction-contract changes
- **流程**: Governance → Authorized Implementation（Steven 决定方向，142/143/125/127 才据此实作）
- 来源：`compliance-os-governance-draft.md` v0.9

## 2026-08-17～18 — ADR-003 + Real Data Pilot

- **类型**: Architecture changes（ADR-003）+ Production code changes（110/117/140/170）
- 来源：`compliance-os-governance-draft.md` v0.7/v0.8

## Historical date unknown — ADR-000/001/002

- **类型**: Architecture changes
- 来源：`compliance-os-governance-draft.md` §1/§3.2/§4.2；原始决策日期无法从现有证据精确还原
