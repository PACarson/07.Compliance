# Phase P 调查报告：重复 Documents / Verified_Income 风险（只读）

- **性质**：独立的只读调查，与 EPF / Tax / SOCSO 设计工作分开。**没有修改任何生产代码、测试代码、真实数据；没有删除记录；没有迁移；没有写入真实 GAS。** 实验只在 repo 副本上用内存假对象跑（不联网），脚本与原始输出见 `tooling/phaseP_dup/`。
- **调查日期**：2026-10-23
- **代码基线**：`07.Compliance-main.zip`（sha256 `2c52e947…`；17 个 handoff 文件 sha256 全部与 `HANDOFF_MANIFEST_2026-10-18.md` 相符）。
- **与既有文档的关系**：你自己的 `PhaseP_Documents_Processing_State_Design_2026-10-17.md` §4.1 / §4.2 已经记录了这两个风险（实验 N22–N27）。本报告**没有沿用它的脚本或结论**，而是按授权的 7 点独立重新核对，并补上它没有覆盖的部分（第 3、4、6、7 节与「新增发现」）。
- **证据标签**：【源码证实】= 读源码得到（附 `文件:行`）；【Node 复现】= 我在 repo 副本上实际跑出来的观察；【设计建议】= 我的建议，未验证；【待确认】= 缺证据；【BLOCKED】= 本环境做不到；【PENDING】= 等你决定或等真实环境。
- **重要限制**：Node 假对象的结果不等于真实 GAS / 真实 Sheets 的行为。真实并发、真实 Sheet 里是否已经有历史重复，本环境都无法确认（见第 6、8 节）。

---

## 0. 摘要（先读这里）

| # | 结论 | 标签 |
|---|---|---|
| 1 | 同一次 `consoleBatchImport_` 里，所有「新」文件拿到**同一个** `document_id`。实验：3 份文件 → Documents 3 行、唯一 id 数 1。 | 【源码证实】【Node 复现 S1】 |
| 2 | 后果之一（**最严重**）：同批里某份文件抽取失败，会被 Scan 和 Recovery Center 当成「已完成」，之后不再被自动重试——这一周的收入**静默缺席**，没有任何信号。实验 S2：失败的 A 被标 `alreadyImported=true`、`needsRetry=false`，Recovery Center 把 A 列进 completed。 | 【Node 复现 S2】 |
| 3 | 后果之二：Drill-down 与 Daily Allocation 会指向**错的 PDF**。实验 S1：W30 的 Drill-down 回传 `F1`（应为 `F3`）；S2：回传 `A`（应为 `B`）。 | 【Node 复现 S1/S2】 |
| 4 | 批次内的快照是旧的：同批两份**同一周**的文件、或两份**相同内容**的文件，都会各写一行 `Verified_Income`。实验 S3 / S4（对照：分两次执行时第二份正确被挡下）。 | 【Node 复现 S3/S4】 |
| 5 | 160 按 `income_id` 去重（先出现者胜），所以金额不会重复计，但**留下的是先写入的那份**；`consoleRebuildProjections_.totalVerifiedCount` 数的是原始行数。实验 S3：两行 net 450 / 460，月汇总取 450，`totalVerifiedCount`=2。 | 【源码证实】【Node 复现 S3】 |
| 6 | 跨执行并发（双页签 / 双触发）：写入前的检查在锁外，锁只包 `appendRow`。S5 用「冻结旧快照」模拟读写交错，得到 2 行 Documents、2 行 Verified_Income。UI 在忙碌时会禁用按钮，所以**主要触发是「同批」而不是「并发」**。 | 【源码证实】【Node 模拟 S5】【待确认：真实 GAS 并发】 |
| 7 | **新发现**：同一周的第二份不同内容文件（例如对账单更正重发）永远不会变成「完成」——每次 Batch 都当 `needsRetry` 重新处理（真实环境 = 每次都再打一次 Gemini），且每次都追加一行 `Reconciliation_Log`。实验 S6：3 次执行后 Reconciliation_Log 3 行、该文件仍 `needsRetry=true`。 | 【Node 复现 S6】 |
| 8 | 真实 Sheet 里**可能已经有历史重复**（任何一次含 ≥2 份新文件的批次都会产生）。本环境无法确认；第 6 节给出只读核对方法。 | 【待确认】 |
| 9 | 与你记录的 2026-W06 现象一致：「Documents 有记录，却一直没出现在 Included Statements，要手动删 Documents 记录才能重新汇入」。S2 复现的正是这一类（Scan 判已汇入 → 永远不重试）。是否就是 W06 的真因，要看真实 Documents 里 W06 那行的 `document_id` 是否与别的行相同。 | 【待确认】 |

**建议修复范围**见第 7 节（分三层，等待你授权；本报告不修复）。

---

## 1. `document_id` 重复（Phase P §4.1）

**机制**【源码证实】

1. `computeDocumentId_(source, documentType, now)` 只由 `source`、`documentType`、`now` 三个值决定，末段是 `now.getTime()`（`110_DocumentImport.js:39–48`）。
2. `deps.now` 在 `buildConsoleDeps_()` 里**每次执行取一次**：`now: new Date()`（`170_OperatorConsole.js:162`）。
3. `consoleBatchImport_` 用同一个 `d`（`170:305`）逐一处理文件（`170:323–336`），每个文件的 `importInput` 都是 `source:'Grab'`、`documentType:'Weekly Statement'`（`170:249`）。
4. `importDocument_` 用 `deps.now` 生成 id（`110:114`）。所以同一批里每份**新**文件拿到完全相同的字符串。

**复现**【Node 复现 S1】：三份文件（W28 / W29 / W30）同批导入，全部 `Verified`：

```
documentsRows: 3      distinctDocumentIds: 1
CMP-DOC-20261001-Grab-WeeklyStatement-1790848800000   （三行共用）
verifiedIncomeRows: 3，三行的 source_document_id 全部是上面这个 id
```

**触发面**：只要一次 Batch 里有 ≥2 份新文件就会发生；`consoleBatchImport_` 自己的注释就写着它用于「整年回填」（`170:291–293`）。Retry 路径（`skipImport`）不生成新 id，不受影响；`consoleManualImport_` 一次一份，也不受影响。

**连锁后果**（都以 `document_id` 当关联键）：

| 位置 | 做了什么 | 碰撞时的结果 |
|---|---|---|
| `consoleScanFolder_`（`170:194–205`） | 把所有 Verified_Income 的 `source_document_id` 收进集合，用 `existingDoc.document_id` 查 | 同 id 的兄弟文件只要有一份验证成功，失败的那份也被当成「已验证」→ `alreadyImported=true`、不重试 |
| `consoleGetRecoveryStatus_`（`170:431–454`） | 同样按 `document_id` 找对应的 Verified_Income | 失败的那份被列进 `completed` |
| `consoleGetIncomeDetail_`（`170:649–654`） | `find` 取**第一个**同 id 的 Documents 行 | Drill-down 指向第一份文件的 PDF |
| `consoleRunDailyAllocation_`（`170:822–834`） | 同样 `find` 取第一行，再用它的 `drive_file_id` 去读 PDF | 把**别的周的 PDF**送去抽取订单；之后的逐日校验（checksum）通常对不上 → `Needs_Review`（fail-closed，不会静默写错数，但白白浪费一次 Gemini 调用并产生让人困惑的失败） |
| 证据档名前缀（`170:467`，`127` 写档名 `${documentId}__…`） | 用 `document_id` + `__` 当前缀列举 | 同批文件的证据档互相混在一起（Phase P N24 已记录） |

**S2 复现**（A 抽取失败、B 成功，同批）：

```
documents:  A -> CMP-DOC-...-1790848800000     B -> CMP-DOC-...-1790848800000
verified:   CMP-INCOME-2026-W30  source_document_id = CMP-DOC-...-1790848800000
scan:       A: alreadyImported=true needsRetry=false     ← 错：A 其实没有 Verified_Income
recovery:   completed = [A, B]                           ← 错
drill-down(W30) -> A                                      ← 错（应为 B）
```

**为什么这是最严重的一项**：它会让一份收入**静默消失**——没有错误、没有 Needs_Review、Recovery Center 也显示「完成」。这违反 CMP-P10「异常要显性，不能静默」的精神（`900_Constitution.js:171–174`），虽然不是哪一行代码主动静默，而是身份冲突造成的效果。Gemini 偶发 503（你在 W06 真实遇到过）正是触发它的现实条件。

> 另一个不一致【源码证实】：`consoleScanFolder_` 建 `documentsByFileId` 时同一个 `drive_file_id` 出现多行会是**最后一行胜**（`170:193`），而 `consoleImportOneDriveFile_` 找既有 Documents 行用 `find` 是**第一行胜**（`170:236`）。同一个文件有两行 Documents 时，这两处会拿到不同的 `document_id`。

---

## 2. 批次内陈旧快照造成重复 Verified_Income（Phase P §4.2）

**机制**【源码证实】

1. `consoleBatchImport_` 开头读一次 Documents 与 Verified_Income 当快照（`170:314–315`）。
2. 逐一处理时，每个文件的 `existingHashes`（`170:247`）和 `existingIncomeIds`（`170:237`）都从这份快照算出；批次中前面文件写入的行**不会**反映到后面的文件。
3. 注释把「快照不更新」写成刻意（`170:309–313`），理由是「后面的文件判断该不该 retry，用的是批次开始时的状态」——这个理由对**重试分类**成立，但同一份快照也被拿去做**去重**（file_hash、income_id），那部分就变成漏洞。
4. `verifyAndPublishIncome_` 的检查是 `existingIncomeIds.indexOf(record.income_id) !== -1`（`140:191`）；`existingIncomeIds` 是调用方给的数组，不给就**完全不检查**（`140:174–179`、`189–193`）。
5. `consoleRetrySelectedFiles_` 同样一次性读快照（`170:533–534`）。

**复现**

- 【Node 复现 S3】同批两份「同一周、内容不同」（G1 net 450、G2 net 460）：两份都 `Verified`；Verified_Income 2 行、`income_id` 唯一数 1；Reconciliation_Log 2 行、`reconciliation_id` 唯一数 1。
- 【Node 复现 S4】同批两份「相同内容（相同 file_hash）」：两份都 `Verified`（hash 去重被绕过），Documents 2 行、Verified_Income 2 行。**对照**：同样两份分两次执行 → `Verified` / `Skipped_Duplicate`，Documents 1 行、Verified_Income 1 行。

对照组说明：**幂等检查本身没写错**，它只在「读快照」与「写入」之间没有新鲜度保证时才失效。

---

## 3. 现有幂等检查的身份范围与生命周期

| 检查 | 身份键 | 检查所用数据 | 数据的生命周期 | 它看不到什么 | 证据 |
|---|---|---|---|---|---|
| 文件内容去重 | `file_hash`（SHA-256） | 调用方传入的 `existingHashes` | 批次开始时读一次；`consoleManualImport_` 每次调用读一次（`170:575`） | 同批前面文件的写入；并发执行；Retry 路径整个跳过 | `110:50–53,110–113`；`170:247` |
| Drive 文件去重 | `drive_file_id` | Scan 时读 Documents | 每次 Scan 重算 | 新文件在写入前**不会**再按 `drive_file_id` 检查一次（只有 Retry 才用 `find`） | `170:190–208,236` |
| 发布幂等 | `income_id = CMP-INCOME-{ISO 周}` | 调用方传入的 `existingIncomeIds`；**不传就不检查** | 同 file_hash | **身份是「周」不是「文件」**：同一周的第二份文件、同批的前一份都看不到 | `140:88,174–179,189–198`；`170:237` |
| 关联键 | `document_id` | 不是幂等键，但被 Scan / Recovery / Drill-down / Daily Allocation 当关联键 | 永久 | 一旦重复就失去唯一性（第 1 节） | `170:194–205,431–436,649–654,822–824` |
| 锁 | Script Lock | 只包 `appendRow` 这一步 | 单次写入 | 读快照、检查都在锁外；**没有 check-then-write 的原子性** | `115_TruthWriter.js:33` |
| 读侧掩盖 | `income_id` | 160 `dedupeByIncomeId_`：先出现者胜 | 每次查询重算 | 不阻止重复写入；留下的是**先写入**的那份 | `160:196–206` |
| 对账记录 | `reconciliation_id = CMP-REC-{周}-{now.getTime()}` | 无检查 | — | 同批同周同 id；`runImportPipeline_` 对 `Already_Verified` 也照样跑对账，每次追加一行 | `130:103,151–156`；`110:221–227` |

---

## 4. 受影响的下游模块（遇到重复时各自怎么选）

| 模块 | 遇到重复 Verified_Income / Documents 行时 | 选择 | 证据 | 观察 |
|---|---|---|---|---|
| 160 月度 / YTD 汇总 | 按 `income_id` 去重 | **先出现者胜**；金额不重复，但可能保留较旧或较错的那份 | `160:196–206,243,334` | S3：取 450（忽略 460） |
| 170 `consoleRebuildProjections_` | `totalVerifiedCount` = 原始行数 | 计重复行 | `170:630` | S3：2（唯一 income_id 只有 1） |
| 170 `consoleGetIncomeDetail_` | Verified_Income 与 Documents 都用 `find` | 第一行 | `170:649,652–654` | S1 → F1；S2 → A（错） |
| 170 `consoleRunDailyAllocation_` | 同上，再用该 Documents 行的 `drive_file_id` 读 PDF | 第一行 → 可能读错 PDF | `170:804–805,822–834` | N25（Phase P）；checksum 会拦下，但浪费调用 |
| 170 `consoleScanFolder_` | 按 `source_document_id` 判「已验证」 | 同 id 即视为已验证 | `170:194–205` | S2：失败的 A 被判已汇入 |
| 170 `consoleGetRecoveryStatus_` | 同上 | 同 id 即 completed | `170:431–454` | S2：A 在 completed |
| 142 Daily Allocation | 以 `verified_income_id` 为键 | 同 income_id 的重复行共用一组 Daily_Allocation | `142`（`getLatestDailyAllocationRows_`）；`170:870–871` | 未单独复现；同样是「读在锁外再写」的模式【待确认】 |
| 130 对账 | `getCurrentReconciliationStatus_` 取最大 `reconciliation_id` | 同周同 id 时无法区分先后 | `130:151–156` | S3：2 行、1 个唯一 id |
| 事件发布 | `eventId = CMP-EVT-{周}-{now.getTime()}` | 同批同周同 id | `110:210` | S3 日志里两个 INCOME_VERIFIED 事件 id 相同；EventPublisher 目前是占位实现，无真实下游【源码证实】 |
| Finance OS（repo 之外） | 读 Verified_Income | 不知道是否自己去重 | — | 【待确认】超出本 repo |

---

## 5. 最小复现条件

| 编号 | 最小条件 | 结果 | 实验 |
|---|---|---|---|
| R1 | 一次 `consoleBatchImport_` 有 ≥2 份新文件 | `document_id` 全部相同 | S1 |
| R2 | R1 + 其中一份抽取失败（Gemini 503 / 解析失败） | 失败文件被 Scan / Recovery 判为已完成，不再重试；Drill-down 指错 PDF | S2 |
| R3 | 同批 ≥2 份对应**同一 ISO 周**的文件（内容可以不同） | Verified_Income 重复；对账、事件 id 重复 | S3 |
| R4 | 同批 ≥2 份**内容相同**的文件（例如同一份 PDF 被存了两个文件名） | file_hash 去重被绕过 | S4 |
| R5 | 两个执行的「读」都发生在对方「写」之前（双页签 / 双触发） | Documents、Verified_Income 都重复 | S5（模拟） |
| R6 | 同一周第二份内容不同的文件，分次执行（**没有**同批或并发） | 永远 `needsRetry`；每次 Batch 重新处理；Reconciliation_Log 持续增长 | S6 |

**怎么跑**（只读、只用假对象）：

```
cd <任意 repo 之外的目录>
node tooling/phaseP_dup/repro_dup.js <Compliance repo 副本目录>
```

完整观察输出已存：`tooling/phaseP_dup/repro_dup.observed.txt`。

**R5 的诚实说明**：S5 用「冻结的旧快照」模拟「B 的读发生在 A 的写之前」，证明的是**如果交错发生，现有代码没有任何保护**；它不能证明真实 GAS 里这种交错多久发生一次。UI 在忙碌时会禁用按钮（`170_OperatorConsole.html:668–675` 的 `setBusy`），所以同一个页面里的双击已被挡；是否覆盖**所有**触发入口、以及跨页签是否可能，我没有逐一核对【待确认】。结论：**同批（R1–R4）是现实的主要触发；并发（R5）属低概率**。

---

## 6. 历史重复是否可能，以及只读核对方法

**可能性**【设计推断，非证实】：任何一次含 ≥2 份新文件的 Batch 都会让这些 Documents 行共用一个 `document_id`。如果你用 Batch Import 做过整批回填（注释本身就写着这个用途），真实 Sheet 里**很可能已经有**成组共用 id 的 Documents 行。是否真的发生、有多少，**本环境无法确认**【待确认】。

**只读核对（不改真实数据）**：先在 Google Sheets 里「文件 → 创建副本」，**只在副本上**操作；在副本里新建一个临时分页，贴入下面的公式（我没有在 Sheets 里跑过这些公式【未验证】）。

| 检查 | 公式（贴到副本的临时分页） | 怎么读 |
|---|---|---|
| Documents 里重复的 `document_id` | `=QUERY(Documents!A2:I,"select A, count(A) where A is not null group by A having count(A) > 1",0)` | 有结果 = 存在碰撞；count = 共用这个 id 的文件数 |
| Documents 里重复的 `file_hash` | `=QUERY(Documents!A2:I,"select F, count(F) where F is not null group by F having count(F) > 1",0)` | 同一内容被导入多次 |
| Documents 里重复的 `drive_file_id` | `=QUERY(Documents!A2:I,"select G, count(G) where G is not null group by G having count(G) > 1",0)` | 同一个 Drive 文件有多行（Scan 取最后一行、Import 取第一行） |
| Verified_Income 里重复的 `income_id` | `=QUERY(Verified_Income!A2:R,"select A, count(A) where A is not null group by A having count(A) > 1",0)` | 某一周被写入多次 |
| 被多笔 Verified_Income 共用的 `source_document_id` | `=QUERY(Verified_Income!A2:R,"select O, count(A) where O is not null group by O having count(A) > 1",0)` | 与第一条交叉：某个 id 在 Documents 有 k 行、在这里只有 j<k 行 → 有 k−j 份文件可能是「被隐藏的失败」，需要到 Drive 里逐一确认 |
| Reconciliation_Log 里重复的 `reconciliation_id` | `=QUERY(Reconciliation_Log!A2:K,"select A, count(A) where A is not null group by A having count(A) > 1",0)` | 对账记录同 id |

列字母来源：`DOCUMENTS_COLUMNS`（`110:33–36`：A=document_id … F=file_hash、G=drive_file_id、I=status）、`VERIFIED_INCOME_COLUMNS`（`140:30–37`：A=income_id、O=source_document_id）、`RECONCILIATION_LOG_COLUMNS`（`130:37–41`）。

**与 2026-W06 的对照**【待确认】：在副本的 Documents 里找 W06 那行（用 `drive_file_id` 或 `drive_path`），看它的 `document_id` 是否出现在第一条公式的结果里。如果是，S2 的机制就是它「一直没出现在 Included Statements」的原因；如果不是，原因另有。

---

## 7. 最小修复、回归测试与迁移风险（仅建议，等待授权）

**不要把这一节与 EPF / Tax / SOCSO 的设计混在一起。** 两条线互不依赖：新设计的身份与幂等机制不使用 `computeDocumentId_`，也不依赖本节任何修复。

### 7.1 修复分三层（由小到大）

| 层 | 内容 | 触及文件 | 解决 | 风险 |
|---|---|---|---|---|
| **T1-a** 唯一的 `document_id` | 让同一批里每份文件的 id 不同：例如在现有格式末尾加 `-{file_hash 前 8 码}`（保留 `CMP-DOC-{日期}-{来源}-{类型}-{时间戳}` 前缀）。依赖 id 的读取点没有解析它的内部格式（grep：只有前缀查询 `${document_id}__` 与整串比较），新旧 id 的证据档前缀互不覆盖（新 id 在旧 id 之后接的是 `-` 不是 `__`）。 | `110`（`computeDocumentId_`、`importDocument_`）+ 测试 | 第 1 节全部连锁后果（对**新**记录） | 改变持久化契约（`source_document_id`、证据档名）；历史行不受影响也不会被修复 |
| **T1-b** 批次内新鲜度 | 分离两个概念：「分类用快照」（保持静态，保留 `170:309–313` 的本意）与「去重账本」（每次成功写入后立即把 `file_hash` / `income_id` / `drive_file_id` 记进内存账本，后面的文件用它）。`consoleRetrySelectedFiles_` 同样处理。 | `170` + 测试 | R3、R4（同批同周 / 同内容） | 低；不改 Sheet 结构 |
| **T1-c** 读侧防御 | `consoleScanFolder_` / `consoleGetRecoveryStatus_` 在判「已验证」前检查该 `document_id` 是否被多个 Documents 行共用；共用则标成**需要身份核对**，不再当完成；`consoleGetIncomeDetail_` / `consoleRunDailyAllocation_` 选 Documents 行时要求 `drive_file_id` 一致或标记歧义。 | `170` + 测试 | **历史重复**造成的误判（T1-a 不能修历史） | 需要决定「歧义」在 UI 怎么显示；Recovery Center UI 只经 Node 测试，未真实验证（`MODULE_CATALOG.md` 的 170 条目） |
| **T2** 原子的 check-then-write | 在**同一个锁内**重新读取并检查再 append（需要一个 TruthWriter 层的新方法，或用「外层锁 + 无锁内层 writer」包装，见 EPF/Tax 设计文档 §4 的方案对比）。 | `115` 或新包装 + 契约测试（190） | R5（跨执行并发） | 要在真实 GAS 验证：同一执行内嵌套 `LockService` 的行为、`SpreadsheetApp.flush()` 在释放锁前是否必要【PENDING】 |
| **T3** 同周第二份文件的终态 | 为「这份文件对应的周已经被别的文件验证」找一个**持久化的终态**，避免 S6 的无限重试与对账增长。这需要一个能记录「文件处理结果」的持久化位置——正是你 Phase P 设计文档（processing-state 日志）要解决的问题。 | 属于 Phase P 设计 | S6 | 不在本报告建议的最小范围；等 Phase P 设计的决定（它的 §10 D2 / D3） |

**我的建议顺序**：T1-a + T1-b 一起（最小、最高价值、都不改 Sheet 结构）→ 先**只读核对**第 6 节，看历史重复的规模，再决定是否做 T1-c → T2 只有在你判断并发值得保护时再做 → T3 跟随 Phase P 设计。

### 7.2 回归测试清单（对应每一层）

- T-P1：一批 3 份新文件 → 3 个互不相同的 `document_id`（T1-a）。
- T-P2：同批两份同一周 → Verified_Income 恰好 1 行，第二份结果为 `Already_Verified`（T1-b）。
- T-P3：同批两份相同 `file_hash` → Documents 恰好 1 行，第二份 `Skipped_Duplicate`（T1-b）。
- T-P4：同批 A 失败 B 成功 → 之后的 Scan 把 A 标 `needsRetry=true`（T1-a + T1-c；S2 的反向断言）。
- T-P5：Drill-down 与 Daily Allocation 取到的 `drive_file_id` 属于该 Verified_Income 对应的文件（S1/S2 的反向断言）。
- T-P6：模拟交错（冻结旧快照）→ 只写 1 行（T2）。
- T-P7：`Already_Verified` 路径不再无条件追加对账行，或对账 id 不再随 `now` 碰撞（S6）。
- 变异测试（项目既有做法）：移除 T1-b 的账本更新，T-P2 / T-P3 必须失败；把 T1-a 的后缀去掉，T-P1 必须失败。
- **真实 GAS 验证计划**：在**副本 Spreadsheet**（不是生产数据）上跑一次含 2 份新文件的 Batch，核对 `Documents` 的 id；再用两个页签交错触发，核对 T2。这些步骤本轮**不执行**。

### 7.3 迁移风险

1. **append-only**：已写入的 Documents / Verified_Income 行不能原地改，也没有授权删除。T1-a 只让**新**记录唯一；历史共用 id 的行保持原样。
2. **历史关联无法单靠 id 还原**：`Verified_Income.source_document_id` 指向共用 id 时，无法只凭这个字符串知道对应哪一份 PDF；可能的补充线索是 Documents 的 `drive_file_id` 对应的证据档内容（证据档内是否含 `drive_file_id` 我没有核对【待确认】）。因此历史数据的任何修复都需要**单独授权**，并应采用追加补偿记录的方式，而不是删除。
3. **读侧防御（T1-c）改变 Recovery Center 的分类**，要先做第 6 节核对，避免上线后一次性把大量历史记录翻成「需要核对」。
4. 新 id 比旧 id 长：依赖整串比较与前缀 `__` 的读取点不受影响（本节 T1-a 已核对）；任何未来想解析 id 内部的代码都不能假设固定长度。

---

## 8. 未能判定 / 限制

- 真实 Sheet 里是否已有历史重复：**未验证**（本环境没有数据）。
- 真实 GAS 的并发行为（两个 `google.script.run` 同时进入）：**未验证**；Node 的 `fakeLockProvider_` 不代表 `LockService`。
- `writeDailyAllocationBatch_` 的幂等守卫与并发：只读到调用方式（`170:870–871`）与 `MODULE_CATALOG.md` 描述，没有深入逐行核对；**不属于 Verified_Income 的重复**，但属于同样的「读在锁外」模式【待确认】。
- Finance OS 是否会对重复的 `income_id` 去重：**repo 之外，无法核对**。
- UI 是否在所有入口都于忙碌时禁用按钮：只核对到 `setBusy` 的定义（`170_OperatorConsole.html:668–675`）。
- 所有 Sheets 公式未在 Sheets 里实际运行过。

---

## 附：本调查触碰了什么

- 读取：repo 内的源码与文档。
- 写入：仅 `/home/claude/deliverables/`（本报告、`tooling/phaseP_dup/repro_dup.js`、`repro_dup.observed.txt`、README）；以及 scratchpad 里的 repo 副本（未修改任何文件，`diff -rq` 与原始解压目录一致）。
- 未做：生产代码修改、测试修改、真实数据修改、删除、迁移、GAS 写入、部署、Gemini 调用、全量回归。
