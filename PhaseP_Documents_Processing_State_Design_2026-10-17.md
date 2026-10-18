# Phase P — Documents 处理状态与失败原因：设计提案

| 项目 | 内容 |
|---|---|
| 日期 | 2026-10-17（Asia/Kuala_Lumpur） |
| 授权依据 | Steven 2026-10-11 的 N → O → P 分阶段授权；本文件只涵盖 Phase P |
| 性质 | **设计提案。没有修改任何生产文件、测试文件、治理文件，没有改动任何表结构。** 本文件是 repo 内这一阶段唯一的新增物 |
| 对象 | Documents 缺少「处理阶段 / 失败原因 / 尝试次数」——`ADR-006 L35–41` 已识别、当时明确留待之后解决的 Schema 缺口 |
| 验证层级 | 实验都是 Node + 假 GAS（假 Drive、假 Gemini 传输层、假 Sheet；其余全是 repo 的真实模块）。**真实 GAS、真实 Gemini、真实浏览器均为 PENDING**（§11） |
| 需要你决定 | 建议的方案会新增一张持久化表——属于「新的 ADR / 修改持久化契约」，按授权要求**先报告、不实作**（§10） |

证据层级标记（全文使用）：

- **【代码】** 直接读 repo 源码，附行号（行号以 Phase N 交付版本为准）。
- **【实验】** Node + 假 GAS 实验（§3、附录 A）。假的只有 Drive、Gemini 传输层和 Sheet；`170` / `110` / `115` / `117` / `125` / `127` / `130` / `140` / `142` 都是真实模块。
- **【文件】** repo 既有文档的记载。
- **【未验证】** 没有证据，只是判断，或需要真实 GAS / 真实资料才能确认。

---

## 0. 结论摘要

1. **现状：处理阶段、失败原因、尝试次数没有任何一处持久化。**【代码】`Documents` 在抽取之前写一次（`110:116`），`status` 恒为 `'Imported'`（`110:86`），TruthWriter 只增不改（`115:31–46`）；`runImportPipeline_` 的 stage 只活在回传值里（`110:154–241`、`170:270–285`）。仅有的间接痕迹是 `Verified_Income`（成功）、证据档（只有 Gemini 回了 2xx 才会写，`127:499–523`）和 `Daily_Allocation`。治理草稿 §2.3 设想过的 `Parsed` / `Failed_Parse` / `Superseded` 状态也从未被写进任何表（§2.6）。
2. **Recovery Center 的 Pending 把 6 类不同的真实原因装在一起。**【实验】Drive 读档失败、Gemini 非 2xx（503 / 429 / 400）、证据档写入失败、缺 `GEMINI_API_KEY`、执行中断、手动贴文字解析失败，在持久化层面**完全相同**（Documents 一行、无证据档），Recovery Center 一律归 Pending。`ADR-006 L26` 把 Pending 定义为「还没真的被抽取尝试过」——10 个 Pending 场景里只有 1 个（N20，中断在抽取之前）符合这个定义。
3. **Failed 把 5 种不同的真相说成同一句话。**【实验】schema 不合格（N11）、需人工审核（N12）、发布失败（N13）、同周已发布的重复文件（N17）、其实一次 statement 层级尝试都没有（N23），lastError 逐字相同：「候选资料已抽取出来，但后续验证没有通过……」。Gemini 回 2xx 却无法解析的三种情况（SAFETY / 没有 candidates / 坏 JSON，N7–N9）也是同一句。N17 点 Retry 会白花一次 Gemini 呼叫，而且永远不会好（证据档 2 → 3，仍是 Failed）。
4. **可推导性（§5）：18 个状态里，3 个可靠、3 个可重算、9 个不能、3 个只能部分推导。** 可靠的是「完成了」「Gemini 回过 2xx」「2xx 但响应无法解析」；schema 不合格、需人工审核、同周已发布这 3 个可以对证据档重算，**不需要新存储**；**9 个不能**：登记前 Drive 读取失败、登记后 Drive 读档失败、Gemini 非 2xx、缺设定、证据档写入失败、发布失败、内容重复被跳过、执行中断、手动贴文字解析失败；真实尝试次数、每次尝试的时间、「尚未处理」只能得到会出错的近似。
5. **前置发现 A（§4.1）：同一批次登记的文件会共用同一个 `document_id`。**【代码 + 实验】`computeDocumentId_` 只用 `deps.now`，而 `deps.now` 每次执行只取一次（`170:162`、`110:114`）。后果：N22（失败的兄弟被 Recovery Center 误报 Completed、扫描标 `alreadyImported`，之后不会被自动重试）、N24（证据档同名，每笔 attemptCount 显示 3，真实各 1 次）、N25（对成功那份的收入跑 Daily Allocation，送去抽取的是失败那份的 PDF）。治理草稿 §7 写的是 `{SEQ}`（`governance-draft L362`），代码实作的是时间戳。**真实 Sheet 里有没有重复的 `document_id`【未验证】**，一个只读检查就能确认（§4.1）。这是持久化契约层面的问题，我没有改，只记录，并让设计绕开它（新表以 `drive_file_id` 为键）。
6. **前置发现 B（§4.2）：批次内的快照是旧的，同批两份同周 / 同内容的文件会各写一行 Verified_Income。**【代码 + 实验 N26 / N27】`consoleBatchImport_` 开头读一次 Documents 与 Verified_Income，之后的去重都用这份旧快照（`170:314–315`）。下游的 Monthly Projection 按 `income_id` 去重（`160:189–206`），所以金额不会重复计算；但 Verified_Income 里有两行。不在 Phase P 范围，我没有改，只记录。
7. **前置发现 C（§4.3）：Recovery Center 排除 order 层级证据档的过滤条件，对真实档名无效。**【实验 N23】`170:468` 过滤 `orders:`，但 `127:579` 存档时把冒号换成了连字号（`orders-full`）；`171:797` 的测试用的是带冒号的假档名，所以测试挡不住。目前被掩盖（order 层级证据只会出现在已有 Verified_Income 的文件上），但任何新设计都不该照抄这个过滤条件。
8. **建议的最小方案（Option C，§7）**：新增一张 append-only 表 `Document_Processing_Log`（暂名），**6 个栏位**，键是 `drive_file_id`（不是 `document_id`）；每次尝试写 2 行（`started` 与一个终结事件）；`event` 是 16 个封闭值（`started` + 15 个终结事件）；状态一律在读取时由规则算出（16 个状态），不存。刻意**不存**：当前状态、尝试次数（= `started` 行数）、`document_id`、期间 / 周别、验证错误明细、候选数字、模型 id、页数——这些要么可推导，要么本来就在证据档里。`Completed` 永远由 `Verified_Income` 决定，日志只能补充、不能创造。旧数据不回填，标 `NoLog`。日志写入失败不影响导入（软失败）。
9. **套用到 §3 的 27 个场景（§7.5，推演，不是实测）**：Pending 一格装的 6 类原因落在 6 个不同的状态；Failed 里被说成同一句「验证没有通过」的 5 个场景落在 5 个不同的状态；`document_id` 碰撞造成的误报 Completed（N22）与错误的尝试次数（N24）消失。**仍然解决不了的**：N23（旧资料，没有日志）、N25（Daily Allocation 送错 PDF，是 §4.1 的契约问题）、N26 / N27（§4.2）。
10. **为什么不是在 Documents 加栏位（Option B，§6.2）**：核心原因是语意——Documents 在抽取前写一次，要放「之后才发生的事」只能回写（违反 append-only），或再追加同一份文件的第二行（会破坏「一份文件一行」的假设：`170:193` 取最后一行、`170:236` 取第一行）。「往尾端加栏位」这个机械操作本身有前例（`140:18–28`），不是问题所在。
11. **这需要新的 ADR（暂称 ADR-007）和 `DATA_OWNERSHIP` 的归类（Evidence / Audit，提议），而且超出 `ADR-006` 画下的边界**（`ADR-006 L37`：「不发明新的持久化欄位、不开新的 database、不发明新的 lifecycle」）。按授权要求，先报告给你决定；我没有动手（§10、§12）。
12. **不需要新 ADR 的小修正（Tier 0，§6.1）可以单独授权**：修正 `orders:` 过滤（连同 `171` 的假档名）、更正 Pending 的文案和 `ADR-006 L26` 的定义、对 Failed 做「重算」细分、同周已发布的文件不再提示 Retry。它们只改推导、不新增持久化；但补不上那 9 个「不能」。
13. **Option G（Documents 新增 `page_count`，Phase O 留给本阶段评估，§6.4）**：建议不并入——它是文件的属性，不是尝试的事件，而且它的前提（页数识别）还卡在 Phase O 的证据门槛。
14. 需要你决定的事项见 §10（D1–D7）；未验证事项见 §11。

---

## 1. 范围、方法与授权要求对照

| 授权要求 | 本报告章节 |
|---|---|
| 1. 追踪 Documents 生命周期、导入状态、证据档案及 Recovery Center 的判断逻辑 | §2、§3、§4 |
| 2. 列出哪些状态可由现有持久化证据可靠推导、哪些不能 | §5 |
| 3. 设计最小字段方案：含义、允许值、写入时机、状态转换规则 | §7.2、§7.4 |
| 4. 区分 Drive 读取失败、解析失败、验证失败、需要人工审核、执行中断、尚未处理，避免都归 Pending | §7.5 |
| 5. 评估旧数据兼容、重复执行、失败重试、append-only 治理 | §8 |
| 6. 不要为了改善诊断而无必要地重复保存可推导状态 | §5、§7.1、§7.3 |
| 7. 只提交设计；需要新 ADR 或修改持久化契约先报告 | §0 第 11 点、§10、§12 |

方法：读 repo（Phase N 交付版本）追踪导入流程；用 repo 的**真实模块**加上假 Drive / 假 Gemini 传输层 / 假 Sheet，在 Node 里逐一制造失败点，记录「持久化留下了什么」「现行 Recovery Center 怎么分类」；读治理文件（ADR-005 / 006、`DATA_OWNERSHIP`、治理草稿）核对既有边界。实验程序**不在 repo 里、没有交付**（附录 A）。

---

## 2. Documents 生命周期追踪（现状）

### 2.1 一次导入经过的步骤，以及每一步持久化了什么【代码】

| # | 步骤 | 位置 | 失败时 | 持久化留下的痕迹 |
|---|---|---|---|---|
| 1 | 扫描 Drive 资料夹，对照 Documents / Verified_Income 分类 | `170:190–208` | Sheet 或 Drive 读取失败 → 整个调用丢例外 | 无 |
| 2 | 批次逐一处理，4.5 分钟时间预算，超出就 `stoppedEarly` 停下 | `170:304–346`（预算 `170:318`、迴圈 `170:323–336`） | — | **没处理到的文件什么都不留**（没有 Documents，也没有任何记录） |
| 3 | 非重试路径：读 Drive 整份字节算 `file_hash` | `170:245–255`（`getFileHash` 在 `170:246`，实作 `170:109–112`） | 例外 → 外层 catch → `Unexpected_Error`（`170:259–261`） | 无（登记前） |
| 4 | hash 去重 | `110:50–53`、`110:111–113` | 命中 → `Skipped_Duplicate`（`110:159–161`） | 无 |
| 5 | 登记 Documents | `110:114–116`、`110:76–88` | 写入例外 → 例外上抛 | Documents 一行；`status` 恒 `'Imported'`；`period` 恒 `'Pending'`（`170:250`） |
| 6 | 抽取：读 Drive 字节 → Gemini → 解析 | `110:165–176`；`127:486–536` | 任何例外 → `Extraction_Failed`（`110:174–176`），只带 `err.message` | 仅当 Gemini 回了 2xx：证据档（`127:499–523`） |
| 7 | 验证（125） | `110:181–194`；`125:200–218` | schema 不合格 → `Extraction_Failed`；期间 / 算术不合格 → `Needs_Review` | 无（候选与错误只在回传值；候选原文在证据档） |
| 8 | 发布 Verified_Income（同周已存在 → 跳过） | `110:207–216`；`140:189–198`（幂等检查 `140:191`） | 例外 → `Verify_Failed`；已存在 → `Already_Verified` | 成功：Verified_Income 一行（`source_document_id` = Documents 的 `document_id`） |
| 9 | Reconciliation（非阻断、独立） | `110:218–235` | 例外 → WARN（AlertService 或 console），不影响上面的结果 | 成功：Reconciliation_Log 一行 |
| 10 | 回传 stage 给前端 | `170:270–285` | — | 无；刷新页面即消失（`170:375–380` 的注解已记录） |

步骤 3–9 全部发生在**同一次 GAS 执行**里。GAS 平台硬杀（不可 catch；真实发生过：`ADR-005 L68`，2026-10-01 20:25:11–20:31:11，360.418 秒）会让执行停在任何一步，**之后没有任何程序再运行**——所以「执行中断」本质上无法事后从结果推导，只能靠事前写下的标记（§7）。

另外，statement 导入路径（`112` 的 `'batch'` profile）**没有** Phase N 的执行预算：`112:80` 呼叫 `realLLMExtractor_('batch')` 时不传 `executionBudget`（`127:995–1008`），它只受 `consoleBatchImport_` 自己的 4.5 分钟迴圈预算（`170:318`）约束；这个 profile 还把模型链收窄成只有主模型（`127:998–1002`），所以没有「换模型」这一层。

### 2.2 stage 词汇：只存在于回传值里【代码】

- `110`：`Skipped_Duplicate`（`110:160`）、`Extraction_Failed`（`110:175`，以及 125 经 `validation.stage` 回传的 `Extraction_Failed` / `Needs_Review`，`110:188`）、`Parse_Failed`（`110:203`）、`Verify_Failed`（`110:215`）、`Already_Verified` / `Verified`（`110:238`）。
- `170`：`Unexpected_Error`（`170:260`）。
- `Extraction_Failed` 有两个来源：**extractor 丢例外**（Drive 读档、HTTP 非 2xx、缺设定、响应无法解析、证据档写入——全部合并成同一个 stage，只剩 `err.message`），以及 **125 的 schema 检查**。这是日志的 `event` 必须比 stage 更细的原因（§7.2.1）。

### 2.3 证据档何时存在【代码】

`127` 的 `extract()`：`127:490` 读 Drive 字节 → `127:492` 组请求 → `127:494` `postJsonWithModelFallback_`（非 2xx 重试用尽后丢例外）→ `127:499–523` `try { parseGeminiResponse_ } finally { 写证据档 }`。所以：

- 证据档**只在 Gemini 回了 2xx 之后**才会写；Drive 读档失败、HTTP ≥ 300（重试用尽）、缺设定，都在写证据之前丢例外，不留证据。
- 2xx 但响应无法解析（SAFETY、没有 candidates、坏 JSON）：`finally` 照写，但 `finish_reason` 与 `raw_candidate` 都是 `null`（`127:509`、`127:511`）；`raw_response` 完整保留。
- 证据档里**没有**验证结果、没有 stage、没有例外讯息。statement 层级档名 `${documentId}__${extractionVersion}.json`（`127:521`）；`extractionVersion` 是 extractor 当下的 `now`（`127:487–488`）。order 层级（Daily Allocation）档名多一段 scope tag，且冒号被换成连字号（`127:552`、`127:579`）。
- `realLLMExtractorDeps_` 的 `now` 在建构时取一次（`127:971`），而 `112` 的 `lazyLLMExtractor_` 每次执行只建一个 extractor（`112:70`、`112:80`）——**同一批次内所有文件共用同一个 `extractionVersion`**。

### 2.4 Recovery Center 与扫描怎么判断【代码】

- `consoleScanFolder_`：Documents 里有这个 `drive_file_id`，且 Verified_Income 里有 `source_document_id = document_id` → `alreadyImported`；有 Documents 没有 Verified_Income → `needsRetry`（`170:199–206`）。
- `consoleGetRecoveryStatus_`（`170:427–490`）：对每一笔 Documents ——有匹配的 Verified_Income → Completed（`170:444–454`）；否则证据资料夹没接上 → Pending（`evidenceUnavailable`，`170:463–466`）；否则列举前缀 `${document_id}__` 的证据档并排除含 `orders:` 者（`170:467–468`）：0 份 → Pending（`attemptCount: 0`）；≥ 1 份 → Failed，`attemptCount` = 证据档份数，`lastError` = `summarizeEvidenceFailure_`（最新一份）（`170:473–486`）。
- `summarizeEvidenceFailure_`（`170:502–510`）的优先序：`raw_response.error.message` > `finish_reason ≠ STOP` > `raw_candidate` 为空 > `fallback_note` > 「验证没有通过」。其中第 2 支对当前的 127 是**死分支**：只要 `finishReason` 不是 STOP，`parseGeminiResponse_` 就丢例外，`finally` 里 `parsed` 为 undefined，`finish_reason` 写成 `null`（`127:509`）；真正的 `finishReason` 只留在 `raw_response.candidates[0]` 里（N7 的 lastError 没有走到这一支，证明了这点）【实验】。第 1 支在当前 127 下只有「HTTP 2xx 却带 `error` body」才会触发（N10，假设情境）【实验】；它很可能是为更早版本的证据档写的（`170:494–496` 的注解提到 W06 真实撞到的错误讯息）——这是推测【未验证】，要看 W06 的真实证据档才能确认。

### 2.5 谁读 Documents，用什么当键【代码】

| 读取点 | 键 | 同一键有多行时 |
|---|---|---|
| `170:193`（`consoleScanFolder_`） | `drive_file_id` | **最后一行**赢 |
| `170:236`（`consoleImportOneDriveFile_`） | `drive_file_id` | **第一行**赢 |
| `170:429–487`（Recovery Center） | 每一行各自处理，用 `document_id` 去对 Verified_Income | — |
| `170:653`（`consoleGetIncomeDetail_`） | `document_id` | 第一行赢；并把 `status` 回传前端（`170:661`），前端只用 `driveFileId`（`170h:559–560`） |
| `170:823`（`consoleRunDailyAllocation_`） | `document_id` | 第一行赢；用它的 `drive_file_id` 去抽订单（`170:829–834`） |
| `170:247`、`170:575` | `file_hash` 清单 | — |

「一份文件一行、`document_id` 唯一」是各读取点各自默认的假设，**没有任何地方强制它**。§4.1 的碰撞和 §6.2 的 Option B 都会撞上这个假设。`Documents.status` 在 production 里唯一的读取点是 `170:661`，前端并不显示它。

### 2.6 治理文件设想过的文件生命周期，与实际落地的差距

- 【文件】治理草稿 §2.3 画了一条**文件层级**的生命周期：`Imported → Parsed → Verified`，解析失败走 `Failed_Parse`，重新解析是 `Verified → Superseded`（`governance-draft L106–116`）。`120_DocumentParsing.js` 的注解也写着：找不到 Parser 就抛错，「交给上层把 `Documents.status` 设成 `Failed_Parse`」（`120:108–109`）。
- 【代码】实际落地的只有第一个状态：`Documents.status` 恒为 `'Imported'`（`110:86`）。`Parsed`、`Failed_Parse`、`Verified`、`Superseded` 没有任何一个被写进任何表：TruthWriter 只增不改（`115:31–46`），而 Documents 又是先写、后抽取，没有地方回头改状态（`170:174–185` 记着这个后果）。「已 Verified」这件事实际上由 Verified_Income 里有没有对应的行来表达。草稿文件地图列了 `903_State_Model.js`（`governance-draft L350`），repo 里没有这个文件。
- **对本设计的意义**：设想的是**文件层级**的状态（这份文件现在算什么），要靠回写；本设计是**尝试层级**的事件日志（这次尝试发生了什么），只 append，状态在读取时算出来。两者不冲突、也不互相替代：本设计不碰 `Documents.status`（§7.6 R7）；`Superseded`（重新解析出新版本）没有实作，也不在本阶段范围。若你想把文件层级的生命周期也补上，需要另外的设计，而且会遇到同样的 append-only 问题。

---

## 3. 实验：每个失败点留下什么痕迹，现行 Recovery Center 怎么分类

**做法**【实验】：27 个场景（`N22` 拆成 3 行，所以表里是 29 行；`N3` 是重试路径）。每个场景用 repo 的真实模块（`170` `110` `115` `117` `125` `127` `130` `140` `142`）跑一次完整调用——`consoleImportOneDriveFile_` / `consoleBatchImport_` / `consoleManualImport_`——再读回三样东西：持久化留下了什么、`consoleGetRecoveryStatus_` 怎么分类、`consoleScanFolder_` 怎么分类。**假的只有三样**：Drive（读档、读 hash、写证据档）、Gemini 的传输层（外面包的是真的 `createRetryingPostJson_`，所以非 2xx 会真的走它的重试与丢例外逻辑）、Sheet 存取。**这是 Node + 假 GAS，不是真实 GAS 验证**；实验程序不在 repo 里（附录 A）。

`D/V/E` = Documents 行数 / Verified_Income 行数 / 证据档份数（该场景世界里的累计值）。「设定的真相」是我构造场景时的意图（注入了哪种故障），不是系统观察到的结果；N26、N27 的设定与实际回传的 stage 不一致，这正是 §4.2 的发现。

| # | 场景 | 设定的真相 | 呼叫回传的 stage（只在回传值里） | 持久化 D/V/E | RC 分类 | RC 的 lastError / attemptCount | Scan(alreadyImported/needsRetry) |
|---|---|---|---|---|---|---|---|
| N1 | 新文件·算 hash 时 Drive 读取失败 | drive_read_failed（登记前） | Unexpected_Error | D0/V0/E0 | （不在任何分页） | — | false/false |
| N2 | 新文件·抽取时 Drive 读档失败（已登记） | drive_read_failed（登记后） | Extraction_Failed | D1/V0/E0 | Pending | 尝试 0 | false/true |
| N3 | 重试·抽取时 Drive 读档失败 | drive_read_failed（重试） | Extraction_Failed | D1/V0/E0 | Pending | 尝试 0 | false/true |
| N4 | Gemini HTTP 503（重试用尽） | llm_api_failed | Extraction_Failed | D1/V0/E0 | Pending | 尝试 0 | false/true |
| N5 | Gemini HTTP 429（额度用尽） | llm_api_failed | Extraction_Failed | D1/V0/E0 | Pending | 尝试 0 | false/true |
| N6 | Gemini HTTP 400（请求被拒） | llm_api_failed | Extraction_Failed | D1/V0/E0 | Pending | 尝试 0 | false/true |
| N7 | Gemini 2xx·finishReason=SAFETY | llm_response_unparseable | Extraction_Failed | D1/V0/E1 | Failed | 没有解析出候选资料（回应格式不是预期的 JSON，或完全没有回应内容）（尝试 1） | false/true |
| N8 | Gemini 2xx·没有 candidates（promptFeedback 拦截） | llm_response_unparseable | Extraction_Failed | D1/V0/E1 | Failed | 没有解析出候选资料（回应格式不是预期的 JSON，或完全没有回应内容）（尝试 1） | false/true |
| N9 | Gemini 2xx·文字不是合法 JSON | llm_response_unparseable | Extraction_Failed | D1/V0/E1 | Failed | 没有解析出候选资料（回应格式不是预期的 JSON，或完全没有回应内容）（尝试 1） | false/true |
| N10 | Gemini 2xx·body 带 error（假设情境，用来看 RC 第一个分支何时会触发） | llm_response_unparseable | Extraction_Failed | D1/V0/E1 | Failed | LLM API 回传错误：hypothetical error body with HTTP 200（尝试 1） | false/true |
| N11 | 候选资料 schema 不合格（125 → Extraction_Failed） | validation_failed（schema） | Extraction_Failed | D1/V0/E1 | Failed | 候选资料已抽取出来，但后续验证没有通过（栏位/期间/金额对不上——建议点 Retry 重新确认）（尝试 1） | false/true |
| N12 | 候选资料算术对不上（125 → Needs_Review） | needs_review | Needs_Review | D1/V0/E1 | Failed | 候选资料已抽取出来，但后续验证没有通过（栏位/期间/金额对不上——建议点 Retry 重新确认）（尝试 1） | false/true |
| N13 | 候选资料通过验证，但写 Verified_Income 时丢例外（Verify_Failed） | publish_failed | Verify_Failed | D1/V0/E1 | Failed | 候选资料已抽取出来，但后续验证没有通过（栏位/期间/金额对不上——建议点 Retry 重新确认）（尝试 1） | false/true |
| N14 | 成功（Verified） | completed | Verified | D1/V1/E1 | Completed | — | true/false |
| N15 | Gemini 成功，但证据档写入失败 | evidence_write_failed（Gemini 结果已丢） | Extraction_Failed | D1/V0/E0 | Pending | 尝试 0 | false/true |
| N16 | 缺 GEMINI_API_KEY（设定缺失） | config_missing | Extraction_Failed | D1/V0/E0 | Pending | 尝试 0 | false/true |
| N20 | 登记后、抽取前执行中断（GAS 平台硬杀；持久化状态等同只剩一笔 Documents） | interrupted | (未返回——被杀) | D1/V0/E0 | Pending | 尝试 0 | false/true |
| N17 | 同一周的第二份文件（不同 hash）→ 周别已发布过 | already_verified（同周重复，对本文件不是失败） | Already_Verified | D2/V1/E2 | Failed | 候选资料已抽取出来，但后续验证没有通过（栏位/期间/金额对不上——建议点 Retry 重新确认）（尝试 1） | false/true |
| N18 | 同内容（相同 file_hash）的第二份文件 | duplicate_file_skipped | Skipped_Duplicate | D1/V1/E1 | （不在任何分页） | — | false/false |
| N21 | Gemini 503 + 证据资料夹没接上（evidenceScanner 缺） | llm_api_failed | Extraction_Failed | D1/V0/E0 | Pending | evidenceUnavailable | false/true |
| N19 | 手动贴文字·解析失败（Parse_Failed） | text_parse_failed | Parse_Failed | D1/V0/E0 | Pending | 尝试 0 | — |
| N22-1 | 同一批三份新文件·F1（成功） | completed | Verified | D3/V1/E1 | Completed | — | true/false |
| N22-2 | 同一批三份新文件·F2（503） | llm_api_failed | Extraction_Failed | D3/V1/E1 | Completed | — | true/false |
| N22-3 | 同一批三份新文件·F3（503） | llm_api_failed | Extraction_Failed | D3/V1/E1 | Completed | — | true/false |
| N23 | 只有 order 层级证据档（真实 127 extractOrders 写的 orders-full / orders-p1-13），没有任何 statement 层级尝试 | no_statement_attempt（statement 层级一次都没试过） | (Daily Allocation 路径，不经 runImportPipeline_) | D1/V0/E2 | Failed | 候选资料已抽取出来，但后续验证没有通过（栏位/期间/金额对不上——建议点 Retry 重新确认）（尝试 2） | — |
| N24 | 同一批三份新文件·全部 2xx 但无法解析（SAFETY）；extractor 一次执行只建一个（now 固定） | llm_response_unparseable ×3 | Extraction_Failed/Extraction_Failed/Extraction_Failed | D3/V0/E3 | Failed×3 / Pending×0 | 没有解析出候选资料（回应格式不是预期的 JSON，或完全没有回应内容）（尝试 3/3/3） | — |
| N25 | 同一批 H1(503) / H2(成功)：对 H2 的 Verified_Income 跑 Daily Allocation，extractor 实际收到哪份 PDF | H2 的收入应该用 H2 的 PDF | Extraction_Failed/Verified | D2/V1/E1 | （见 §4.1） | — | — |
| N26 | 同一批两份「不同内容、同一周」的文件，两份都 2xx 且验证通过 | already_verified（同周重复，对第二份不是失败；同一批） | Verified/Verified | D2/V2/E2 | Completed | — | true/false |
| N27 | 同一批两份「相同内容（相同 file_hash）」的文件（对照：同样两份分两次执行） | duplicate_file_skipped（同一批） | Verified/Verified | D2/V2/E2 | Completed | — | true/false |

部分场景的补充（原样取自实验输出）：

- **N17**：第一份 stage=Verified；点一次 Retry 后 stage=Already_Verified，证据档 2 → 3，RC attemptCount=2
- **N18**：第一份 stage=Verified
- **N19**：合成 `drive_file_id=MANUAL-<ts>`；之后若点 Retry，会拿这个合成 id 去 DriveApp.getFileById（读档必然失败）
- **N22-1**：Documents 的 document_id 唯一数 / 行数 = 1 / 3
- **N23**：真实证据档名=`CMP-DOC-N23__orders-full__<ts>.json` ； `CMP-DOC-N23__orders-p1-13__<ts>.json`；filter 用的是 `indexOf("orders:")`，档名里的冒号已被 127 换成连字号
- **N24**：document_id 唯一数 / 行数 = 1 / 3；证据档 3 份、档名唯一数 = 1；每一笔 RC 的 attemptCount = 3/3/3（真实只各试了 1 次）
- **N25**：Verified_Income.source_document_id=CMP-DOC-20261014-Grab-WeeklyStatement-1791939600000；Documents 两行的 document_id 是否相同=true；Daily Allocation 的 extractor 收到 fileId=file-H1（H1=失败那份，H2=成功那份）；incomeId=CMP-INCOME-2026-W31；alloc.status=Done/Needs_Review
- **N26**：Verified_Income 行数=2，income_id 唯一数=1，source_document_id 唯一数=1
- **N27**：同一批：Verified_Income 行数=2；对照（两次执行）：stage=Verified/Skipped_Duplicate，Verified_Income 行数=1
- **Daily_Allocation 层级（§4.7）**：Needs_Review 且无候选 → `{"needsReviewNoCandidate":{"rowsWritten":0,"sheetRows":0}}`

### 3.1 读这张表得到的结论

以下数字都由核对脚本从实验结果 JSON 重新算过。

1. **持久化层分不出阶段。** 10 个被现行 Recovery Center 归为 Pending 的场景（N2、N3、N4、N5、N6、N15、N16、N20、N21、N19）留下的痕迹完全一样——Documents 一行、没有 Verified_Income、没有证据档——真实原因却有 6 类：Drive 读档失败、Gemini 非 2xx、证据档写入失败、缺设定、手动贴文字解析失败、执行中断。
2. **Pending 的定义与实际不符。** `ADR-006 L26` 把 Pending 定义为「还没真的被抽取尝试过」。10 个场景里只有 N20（登记后、抽取前被杀）符合；其余 9 个都已经尝试过，只是失败点在 Gemini 回 2xx 之前（或根本不经过 Gemini）。
3. **Failed 把不同的真相说成同一句。** N11（schema 不合格）、N12（需人工审核）、N13（发布失败）、N17（同周已发布的重复文件）、N23（statement 层级一次都没试过）的 `lastError` 逐字相同：「候选资料已抽取出来，但后续验证没有通过……」。N7、N8、N9（SAFETY / 没有 candidates / 坏 JSON）也是同一句：「没有解析出候选资料……」。
4. **有两个场景不在任何分页。** N1（登记前 Drive 读取失败）和 N18（内容重复被跳过）都没有 Documents 行，而 Recovery Center 只遍历 Documents（`170:443`）。N18 是正常的；N1 是操作者完全看不到的失败——Scan 把这份文件当成一个新文件（`needsRetry: false`）。
5. **N17 点 Retry 没有用，而且每次都花一次 Gemini 呼叫。** 第二份同周文件第一次得到 `Already_Verified`；点一次 Retry，stage 仍是 `Already_Verified`，证据档 2 → 3，Recovery Center 仍是 Failed（attemptCount 2）。原因是 Retry 走 `skipImport` 路径（`170:240–244`），不会被 hash 去重挡住，会重新抽取。
6. **`attemptCount` 既会少算也会多算。** 少算：Drive 读取、HTTP 非 2xx、缺设定都不留证据（N2、N3、N4–N6、N16 全是 0）；证据档写入失败时，Gemini 的结果连同证据一起丢了（N15 也是 0）。多算：N24 同批三份、真实各试 1 次，每笔都显示 3；N23 把 order 层级的 2 份证据档算成 2 次 statement 尝试。
7. **`summarizeEvidenceFailure_` 的前两个分支对当前的 127 几乎走不到。** 它优先读 `raw_response.error.message`（`170:504–505`），但 127 只在 Gemini 回 2xx 时才写证据档（`127:499–523`）；真实 Gemini 的错误是非 2xx，在写证据之前就丢例外了。这一支只有「HTTP 200 却带 error body」才触发（N10 是我构造的假设情境）；它很可能是为更早版本的证据档写的（推测【未验证】，要看 W06 的真实证据档才能确认）。第二分支（`finish_reason ≠ STOP`）是死分支：`parseGeminiResponse_` 遇到非 STOP 会丢例外，`finally` 里 `parsed` 是 undefined，`finish_reason` 被写成 null（`127:509`），N7 的 lastError 没有走到这一支。
8. **手动贴文字（N19）之后的 Retry 没有意义。** 它的 `drive_file_id` 是合成值 `MANUAL-<ms>`（`170:572`）；对它点 Retry 会走 `skipImport` 路径（`170:240–244`），把合成值交给 Drive 读档。真实 Drive 对这种 id 的行为【未验证】，预期失败。

---

## 4. 前置发现

这几项不属于「Documents 加栏位」本身，但会改变设计该怎么做，所以先记录。**全部是现有行为；我没有改任何东西。**

### 4.1 `document_id` 在同一批次里会碰撞（N22 / N24 / N25）

【代码】`computeDocumentId_` 只用 `deps.now`（`110:39–47`，末段是 `now.getTime()`）；`deps.now` 在 `buildConsoleDeps_()` 里每次执行取一次（`170:162`）；`importDocument_` 用它产生 id（`110:114`）。所以同一次 `consoleBatchImport_` 里的每份新文件拿到**同一个** `document_id`。治理草稿 §7 写的格式是 `{SEQ}`（`governance-draft L362`），代码实作的是时间戳。

【实验】

- **N22**：一批三份新文件，`document_id` 唯一数 / 行数 = 1 / 3。F1 成功、F2 与 F3 的 Gemini 503，Recovery Center 却把 F2、F3 也报成 Completed，Scan 标 `alreadyImported: true`——它们之后不会被自动重试。
- **N24**：同批三份、Gemini 都回 2xx 但无法解析；三份证据档的档名完全相同（唯一数 1——`extractionVersion` 在同批共用，因为每次执行只建一个 extractor：`112:70`、`112:80`、`127:971`），Recovery Center 对每一笔都显示 attemptCount 3，真实各 1 次。
- **N25**：同批 H1（503）、H2（成功）。对 H2 的收入跑 Daily Allocation，送去抽取的 `fileId` 是 `file-H1`——失败的那份。原因：`Verified_Income.source_document_id` 指向共用的 id，`consoleRunDailyAllocation_` 用 `find` 取 Documents 的第一行（`170:823`），再用它的 `drive_file_id` 去读 PDF（`170:829–834`）；`consoleGetIncomeDetail_` 同理（`170:652–654`）。

**真实 Sheet 里有没有重复的 `document_id`【未验证】。** `consoleBatchImport_` 的注释说它的用途包括「整年回填」一次扫几十份（`170:291–293`），如果真的这样用过，几十份会共用一个 id。一个只读检查可以确认：对 `Documents` 的 `document_id` 栏（A 栏）算「非空数 − 不重复数」——公式 `=COUNTA(A2:A)-COUNTA(UNIQUE(FILTER(A2:A,A2:A<>"")))`，0 代表没有碰撞（这条公式我没有在 Sheets 里跑过【未验证】）。

**为什么我没有顺手修**：`document_id` 的格式被 `Verified_Income.source_document_id`、证据档档名前缀（`127:521`）、Recovery Center 的前缀查询（`170:467`）依赖，改它是持久化契约层面的变更，按授权要求先报告（§10 D2）。**对本设计的影响**：日志以 `drive_file_id`（不是 `document_id`）为键，不受碰撞影响（§7.1）。

### 4.2 批次内的快照是旧的：同批两份同周 / 同内容文件会各写一行 Verified_Income（N26 / N27）

【代码】`consoleBatchImport_` 开头读一次 Documents 和 Verified_Income 当快照（`170:314–315`），逐一处理时每个文件的 `existingHashes`（`170:247`）与 `existingIncomeIds`（`170:237`）都来自这份快照；批次中前面文件的写入不会反映到后面的文件。注释把「快照不更新」写成刻意（`170:309–313`），理由是「后面的文件判断该不该 retry 用的是批次开始时的状态」——但同一份快照也被拿去做**去重**。

【实验】

- **N26**：同一批两份「不同内容、同一周」的文件、Gemini 都回有效结果：两份都 `Verified`，Verified_Income 2 行、`income_id` 唯一数 1。
- **N27**：同一批两份「相同内容（相同 `file_hash`）」的文件：两份都 `Verified`（hash 去重被绕过），Verified_Income 2 行。**对照**：同样两份分两次执行 → `Verified` / `Skipped_Duplicate`，Verified_Income 1 行。

下游：Monthly Projection 按 `income_id` 去重、保留先出现的那行（`160:189–206`），所以金额不会重复计算；但 Verified_Income 里确实有两行，被采用的是先写入的那份。这和 `140:174–179` 写的设计意图（「已经存在就跳过，不当错误处理」）不一致。

这是现有行为，不在 Phase P 的范围，我没有改（§10 D3）。**对本设计的影响**：日志对这种情形只会如实记两个 `verified` 事件，不会也不该去修它；它影响的是「重复执行」的评估（§8.2）。

### 4.3 排除 order 层级证据档的过滤条件，对真实档名无效（N23）

【代码】`consoleGetRecoveryStatus_` 用 `f.name.indexOf('orders:') === -1` 排除 Daily Allocation 的证据档（`170:467–468`）；`realEvidenceScanner_` 的注释也写着档名带 `orders:`（`170:120–123`）。但 127 存档时把冒号换成连字号：scope tag 是 `orders:full`（`127:552`），档名是 `…__orders-full__<ts>.json`（`127:579`）。`171` 的测试夹具用的却是带冒号的假档名（`171:797`），所以测试挡不住。

【实验 N23】只有 order 层级证据档（真实 `extractOrders` 写出的 `orders-full`、`orders-p1-13`）、没有任何 statement 层级尝试的文件：Recovery Center 报 **Failed**，attemptCount 2，lastError 是「候选资料已抽取出来，但后续验证没有通过……」。

目前被掩盖：order 层级证据只会出现在已有 Verified_Income 的文件上（Daily Allocation 以 Verified_Income 为输入，`170:804–827`），那种文件在 `170:444–454` 就被判 Completed，走不到过滤。但任何沿用证据档分类的设计都得先修这一处（§6.1 T0-1）。

### 4.4 `attemptCount` 不是「尝试次数」

它数的是证据档份数（`170:485`；`ADR-006 L27`：「attemptCount 数有几份证据档」）。§3.1 第 6 点列了少算与多算的情形；`ADR-006 L39` 也承认过时间差太近时分不出「这次」与「上次」。这个数字只能叫「证据档份数」。

### 4.5 Pending 的文字定义与实际不符

`ADR-006 L26` 与 `170:408–410` 把 Pending 写成「还没真的被抽取尝试过」。UI 的 `170h:350` 写的是「证据资料夹里还没有这份文件的抽取证据」，`170h:808` 也明说「这不代表它们没被尝试过」——这两处措辞是准确的（描述证据，不描述尝试）；不准确的是 ADR 与后端注释。`ADR-006 L41` 承认了 Drive 读档失败会落进 Pending，§3.1 第 1 点显示还有五类：Gemini 非 2xx、证据档写入失败、缺设定、手动贴文字解析失败、执行中断。

### 4.6 证据列举的成本

`realEvidenceScanner_.listFilesWithPrefix` 每次呼叫都遍历整个证据资料夹（`170:130`），Recovery Center 对每一份「未完成」的 Documents 各呼叫一次（`170:467`），成本是 O(未完成文件数 × 证据档总数)。`170h:802` 已经提示操作者「文件多的话要几秒」。真实 GAS 的耗时与资料夹规模【未验证】。以日志取代列举后，分类只需读一张表（§7.5）。

### 4.7 范围外但一并记录

Daily Allocation 的 `Needs_Review` 且没有候选时，`writeDailyAllocationBatch_` 写 0 行【实验：rowsWritten 0 / sheetRows 0】——同样没有持久化痕迹。这属于 ADR-004 / 005 的范围，不是 Documents 的问题，Phase P 不处理。

---

## 5. 哪些状态能由现有持久化证据推导

判定的四个等级：

- **可靠**：现有持久化数据直接记录了这件事，读取规则明确。
- **可重算**：数据在（证据档的 `raw_candidate` / `raw_response`、Verified_Income），再跑一次确定性函数（`125` 的验证、`parseGeminiResponse_`）就得到，**不需要新存储**。重算给出的是「按现行代码的判断」，不是当时发生了什么。
- **不能**：没有任何数据能把它和别的状态区分开。
- **部分**：能得到一个近似，但会错。

| # | 状态 | 判定 | 依据 / 为什么不能 | 实验 |
|---|---|---|---|---|
| S1 | Completed（已发布 Verified_Income） | 可靠 | `Verified_Income.source_document_id` = `Documents.document_id`（`170:444–454`）。前提：`document_id` 唯一——碰撞时会误报（N22-2、N22-3） | N14、N22 |
| S2 | Gemini 至少回过一次 2xx | 可靠 | 证据档只在 2xx 之后写（`127:499–523`）。前提：`orders:` 过滤正确（§4.3）、`document_id` 唯一 | N7–N13 |
| S3 | 2xx 但响应无法解析 | 可靠 | 证据档里 `raw_candidate` 为 null、`raw_response` 完整保留（`127:509–511`）；子原因（SAFETY / 没有 candidates / 坏 JSON）对 `raw_response` 重跑 `parseGeminiResponse_`（`127:278–293`）即得 | N7–N9 |
| S4 | 候选 schema 不合格 | 可重算 | 对 `raw_candidate` 重跑 `validateExtractionCandidate_`（`125:200–204`）；现行 RC 没做，所以与 S5、S6、S12 说成同一句（`170:509`） | N11 |
| S5 | 候选需人工审核（期间 / 算术） | 可重算 | 同上（`125:206–212`） | N12 |
| S6 | 同周已发布（对本文件不是失败） | 可重算 | 候选通过验证，且 Verified_Income 已有同 `income_id`、`source_document_id` 不是本文件 | N17 |
| S7 | 登记前 Drive 读取失败 | 不能 | 完全没有痕迹——`getFileHash` 在登记之前（`170:246`），例外被外层 catch 吞成回传值（`170:259–261`） | N1 |
| S8 | 登记后 Drive 读档失败 | 不能 | Documents 一行、无证据档——与 S9–S11、S14、S15 逐字相同 | N2、N3 |
| S9 | Gemini 非 2xx（503 / 429 / 400…） | 不能 | 重试用尽后在写证据之前丢例外（`127:494`） | N4–N6、N21 |
| S10 | 缺 `GEMINI_API_KEY` / 证据资料夹设定 | 不能 | `createLLMExtractor_` 丢例外（`127:470`、`127:473`），无痕迹 | N16 |
| S11 | Gemini 成功、证据档写入失败 | 不能 | `finally` 里写失败（`127:522`），Gemini 的结果与证据一起丢了 | N15 |
| S12 | 候选有效、发布失败 | 不能 | 证据档在、候选有效、Verified_Income 无——与「发布前被杀」无法区分；RC 把它和 S4–S6 说成同一句（`170:509`） | N13 |
| S13 | 内容重复被跳过（hash 去重） | 不能 | 不写 Documents（`110:159–161`），无任何痕迹，RC 不列 | N18 |
| S14 | 执行中断（GAS 硬杀） | 不能 | 不可 catch（真实发生过：`ADR-005 L68`），之后没有程序再运行；痕迹等同「登记后无证据档」 | N20 |
| S15 | 手动贴文字解析失败 | 不能 | Documents 一行（合成 id `MANUAL-<ms>`，`170:572`），无证据档 | N19 |
| S16 | 尚未处理（Drive 里有、Documents 里没有） | 部分 | 只能知道「没有任何记录」；与 S7、「登记前被杀」分不开 | N1 |
| S17 | 真实尝试次数 | 部分 | 只有「证据档份数」：少算（S7–S11、S14、S15 不留证据）、多算（N23、N24） | N23、N24 |
| S18 | 每次尝试的时间 | 部分 | 只有证据档的 `lastUpdated`，且只有走到 Gemini 2xx 的尝试才有；同批共用同一个 `extractionVersion`（`127:487–488`） | N24 |

**18 个状态里：3 个可靠、3 个可重算、9 个不能、3 个部分。** 要点：

- 现有数据能可靠回答的，只有「完成了」和「Gemini 回过 2xx」这一端；一旦失败发生在 Gemini 回应**之前**（S7–S11）或**之后但验证之前**（S12），或发生在**任何程序都跑不到的时刻**（S14），就没有证据。
- 「可重算」的三项（S4–S6）不需要新字段，现行 RC 没做是因为 `ADR-006` 选择了「只读证据档摘要」（`170:497–498`：「125 的验证结果没有记在证据档里，只能说到这个颗粒度」）。重算的代价是读证据档并重跑 125，且证据档被删就算不出来。
- 9 个「不能」靠推导永远补不上；这是需要一份新持久化记录的理由，也是 §6 要比较的问题。

---

## 6. 方案比较

### 6.1 Tier 0（Option A）：不动任何持久化，只修推导

| 编号 | 内容 | 补上什么 | 仍然补不上 | 改动范围 |
|---|---|---|---|---|
| T0-1 | 修正 `orders:` 过滤（`170:468`），并把 `171:797` 的假档名改成真实格式（`orders-full`） | §4.3：N23 型误判；也是任何证据档分类的前提 | — | `170`、`171` |
| T0-2 | 更正 Pending 的文字定义（`ADR-006 L26`、`170:408–410`）：证据资料夹里没有这份文件的证据；可能没试过，也可能在 Gemini 回应之前就失败（Drive 读取 / Gemini 非 2xx / 缺设定 / 证据档写入失败 / 执行中断） | §4.5 | S7–S15 仍然混在 Pending | `ADR-006`、`170` 注释（UI 文案 `170h:350`、`170h:808` 已经准确，不用动） |
| T0-3 | Failed 子类重算：对最新证据档的 `raw_candidate` 重跑 `validateExtractionCandidate_`、对 `raw_response` 重跑 `parseGeminiResponse_`、对 Verified_Income 查同周 `income_id` | S3 的子原因、S4、S5、S6（§5） | S12（发布失败）仍与「发布前被杀」混在一起 | `170`（`summarizeEvidenceFailure_`）、测试、UI 文案 |
| T0-4 | 对 T0-3 判为「同周已发布」的文件不再提示 Retry | §3.1 第 5 点：每次 Retry 白花一次 Gemini 呼叫 | — | `170`、`170.html`（改变行为，需单独确认） |

**Tier 0 的上限**：§5 里 9 个「不能」它一个也补不上——那些状态在持久化层没有任何区别。

### 6.2 四个选项

| 选项 | 做法 | 能补上 | 契约变更 | 主要问题 | 评价 |
|---|---|---|---|---|---|
| **A** | Tier 0（§6.1） | S3 子原因、S4–S6 | 无 | 9 个「不能」不变 | 值得先做（单独授权），但不是答案 |
| **B** | 在 `Documents` 加 `processing_stage` / `failure_reason` / `attempt_count` 栏位 | 理论上全部 | 改 Documents 表头与所有读取点 | 见下 | 不建议 |
| **C** | 新增 append-only 表 `Document_Processing_Log`（§7） | S7–S15、S16、S17、S18 | 新增一张表 + 新 ADR | 每次尝试多 2 次 append；soft-fail 下可能漏记；旧资料没有记录 | **建议，需你批准** |
| **D** | 把「尝试记录」写成证据资料夹里的 JSON 档 | 部分 | 无新表 | 见下 | 不建议 |

**B 的问题是语意，不是机械操作。** 往一张只增表的尾端加栏位有前例，而且是安全的（`140:18–28`：`source_document_id` / `extractor_id` 加在尾端没事；`period_start` / `period_end` 插在中间让 Dashboard 崩溃，后来搬到尾端）。真正的矛盾在写入时机：`Documents` 在抽取**之前**写一次（`110:116`），阶段、失败原因、尝试次数都是**之后**才发生的事。要放进去只有两条路：回写（违反 UCR6，`115:31–46` 只有 append），或为同一份文件再追加第二行——这会破坏「一份文件一行」的假设，而读取点对多行的处理并不一致：`170:193` 取**最后**一行，`170:236` 取**第一**行，`170:653`、`170:823` 取第一行，Recovery Center（`170:443`）则每一行各处理一次，同一份文件会出现两次。所以 B 的真正成本是重写所有读取点，而不是加一个栏位。

**D 的问题**：（1）要诊断的故障里，Drive 读写失败本来就占一大块（N2、N15）——记录要写进 Drive，写不进去时记录自己也丢了；（2）列举成本 O(档案数)（§4.6）；（3）`createFile` 允许同名（`127:955–959`；N24 已经出现同名证据档）；（4）没有锁、不能原子 append；（5）证据档的语意是「Gemini 回应的证据」（`DATA_OWNERSHIP L16`），混进尝试记录会模糊它。

没有列进表里的三个想法：`PropertiesService` 做进行中标记（可改写，违反 append-only；有容量上限，具体数字我没有在这个阶段核对；使用者看不到）；`Logger` / `console.log`（保留期有限、Web App 读不到，不能当状态来源，但可以当补充）；把 `Documents` 的登记延到抽取成功之后（会推翻 `needsRetry` 依赖「先登记」的前提，见 `170:174–185` 的修正说明，并且丢掉失败尝试的所有痕迹）。

### 6.3 我的建议

1. **先做 T0-1、T0-2**（各自单独授权；不需要新 ADR、不动持久化；无论最后选不选 C 都该修）。
2. **C 是唯一能补上 9 个「不能」的做法**，但它新增一张表，超出 `ADR-006` 画下的边界（`ADR-006 L37`：「不发明新的持久化欄位、不开新的 database、不发明新的 lifecycle」；`170:402–404` 同样写明不该新增持久化欄位或新的 sheet），按授权要求先报告，由你决定（§10 D1）。
3. T0-3、T0-4 在采用 C 之后只对**旧资料**还有价值（新的尝试直接有 `schema_invalid` / `needs_review` / `already_verified` 事件）；要不要做，取决于你对 D1 的选择。

### 6.4 Option G（`Documents` 新增 `page_count`）的评估

Phase O 把它留给 Phase P 评估（`PhaseO…md` §8.6 与 §9 第 5 点）。结论：**不并入本设计。**

- 它是**文件的属性**，不是**尝试的事件**：放进日志会每次尝试重复一份；放进 `Documents` 则是一个独立的契约变更。
- 若以后要做，形式很简单：`Documents` 尾端加一个栏位（有 `140:18–28` 的前例），**在登记那一刻写一次**（所以不违反 append-only），旧行为空、回退到现行的识别路径。它与 Option C 互不依赖。
- 它的前提——页数识别——在 Phase O 里还卡在证据门槛（`PhaseO…md` §10 的 G1–G3，全部 PENDING）。门槛通过之前存一个未验证的数字，只会把猜测固化进持久化层。

所以：不并入 ADR-007 的范围；等 Phase O 的门槛通过、你决定走哪个方案之后再另议（§10 D7）。

---

## 7. 最小设计（Option C；待你批准，本阶段不实作）

### 7.1 设计原则

1. **不存可推导的状态**（EP4，也是授权要求 6）：当前状态、尝试次数、耗时、`document_id`、期间 / 周别、验证细节、候选数字、模型资讯都不存（§7.3）。
2. **只增不改**（UCR6）：每个事实一行，之后只会有新行；没有回写，也没有「关闭」旧行。
3. **以 `drive_file_id` 为键**（CMP-P11）：`document_id` 会碰撞（§4.1），`drive_file_id` 才是权威引用；日志完全不依赖 `document_id`。
4. **失败要显性**（CMP-P10）：读到未知事件显示为 `unclassified_error`；日志与 Verified_Income 不一致时显性报出，不猜。
5. **事件来自结构化来源，不解析讯息文字**（与 `isQuotaExhausted` / `isCapacityIssue` 同一个做法，`127:894`、`127:902`）。
6. **诊断不能拖垮主流程**：日志写入失败是软失败（先例：Reconciliation 失败只发 WARN，`110:228–235`）。
7. **`Completed` 永远由 Verified_Income 决定**：日志只能补充，不能创造 Completed。

### 7.2 表规格

名称（暂定）：`Document_Processing_Log`。归类建议：**Evidence / Audit**（`DATA_OWNERSHIP L25`：「留痕用，不参与业务计算本身」）——需要你批准。栏位只有 6 个：

| # | 栏位 | 含义 | 允许值 | 写入时机 | 备注 |
|---|---|---|---|---|---|
| 1 | `logged_at` | 这一行被 append 的实际时间 | ISO 8601 UTC 字符串 | 每一行 | 取真实时钟，**不用** `deps.now`（每次执行固定一个值，是 §4.1 碰撞的成因）；必须列入 `textColumns`，否则 Sheets 会把它静默转成日期（`108:152–160`；先例 `108:94` 的 `written_at`） |
| 2 | `drive_file_id` | 这次尝试针对哪份文件 | Drive file id；手动贴文字是合成的 `MANUAL-<ms>`（`170:572`） | 每一行 | 日志的键 |
| 3 | `attempt_id` | 同一次尝试的 `started` 行与终结行共用 | `ATT-<drive_file_id>-<真实时钟 ms>` | 每一行 | 唯一性来自 `drive_file_id` + 真实时钟，不是批次时间（§7.6 R6） |
| 4 | `event` | `started` 或一个终结事件 | §7.2.1 的 16 个封闭值 | `started`：尝试开始时；终结事件：尝试结束时 | 单一栏位，不另设 phase / outcome / reason：它们互相可推出，分开存会产生矛盾的组合 |
| 5 | `income_id` | 仅 `verified` / `already_verified`：这次尝试发布的、或撞到的 `CMP-INCOME-…` | 空，或 income_id | 终结事件 | 同批碰撞时是「文件 → 收入」唯一可靠的连结；也用来说明「同周已由哪一笔发布」 |
| 6 | `detail` | 给人看的补充 | ≤ 300 字、清洗后的文字 | 失败的终结事件；其余为空 | **程序不得解析**；写入前必须清洗（§7.6 R2） |

写入一律经 TruthWriter 的 `appendValidatedRow`（`115:31–46`）：任何栏位是 `undefined` 会丢例外，`null` 存成空字串，所以不适用的栏位由呼叫端传 `null`。

#### 7.2.1 `event` 词汇表（共 16 个值：`started` + 15 个终结事件）

「依据」栏说明事件由什么**结构化**来源决定；需要新增的结构化标记列在 §9。

| 事件 | 触发条件 | 结构化依据 | pipeline 回传的 stage | 推导出的状态 | 实验 |
|---|---|---|---|---|---|
| `started` | 一次尝试开始 | — | — | InProgress / Interrupted | N20 |
| `verified` | Verified_Income 已 append | `verifyResult.skipped === false`（`110:238`） | Verified | Completed | N14、N22 |
| `already_verified` | 发布被跳过（income_id 已存在） | `verifyResult.skipped === true`（`110:238`；`140:191`） | Already_Verified | Completed 或 DuplicatePeriod | N17 |
| `duplicate_file` | hash 去重命中 | `importResult.status === 'Duplicate_Skipped'`（`110:159–161`） | Skipped_Duplicate | DuplicateFile | N18 |
| `drive_read_failed` | Drive 读取丢例外（算 hash 或抽取读档） | 需在 `170:246` 与 `127:490` 两处加标记 | Unexpected_Error 或 Extraction_Failed | DriveReadFailed | N1、N2、N3 |
| `config_missing` | 缺 API key 或证据资料夹设定 | `127:470`、`127:473` 的丢例外处加标记 | Extraction_Failed | ConfigMissing | N16 |
| `llm_capacity` | 所有模型都 503 | `isCapacityIssue`（`127:902`） | Extraction_Failed | LlmCallFailed | N4、N21、N22 |
| `llm_quota` | 429 | `isQuotaExhausted`（`127:894`） | Extraction_Failed | LlmCallFailed | N5 |
| `llm_call_failed` | 其他非 2xx 或网络例外 | 在 `127:494` 包一层：不是上面两个旗标者 | Extraction_Failed | LlmCallFailed | N6 |
| `llm_response_unparseable` | 2xx，但 `parseGeminiResponse_` 丢例外 | 在 `127:500` 包一层 | Extraction_Failed | ParseFailed | N7–N10、N24 |
| `evidence_write_failed` | 证据档写入失败 | 在 `127:522` 包一层 | Extraction_Failed | EvidenceWriteFailed | N15 |
| `schema_invalid` | 125 判 `Extraction_Failed`（形状不对） | `validation.stage`（`110:187–188`；`125:202–203`） | Extraction_Failed | ValidationFailed | N11 |
| `needs_review` | 125 判 `Needs_Review` | `validation.stage`（`110:187–188`；`125:210–211`） | Needs_Review | NeedsReview | N12 |
| `publish_failed` | 发布丢例外 | `110:214–216` 的 catch | Verify_Failed | PublishFailed | N13 |
| `text_parse_failed` | 手动贴文字的 regex parser 失败 | `110:202–204` 的 catch | Parse_Failed | ParseFailed | N19 |
| `unclassified_error` | 其他任何例外（含 `importDocument_` 写入失败） | `170:259–261` 的 catch | Unexpected_Error | UnclassifiedFailure | — |

**判断顺序与叠加失败**【代码】：

- 127 的 Gemini 呼叫错误上挂着三个结构化旗标（`isBudgetExhausted`、`isQuotaExhausted`、`isCapacityIssue`；`127:894`、`127:902`、`127:808–812`），而且预算错误会把上一次错误的 `isQuotaExhausted` / `isCapacityIssue` 一并带上。所以判断顺序是：先看 `isBudgetExhausted`，再看 `isQuotaExhausted`，再看 `isCapacityIssue`，都不是才是 `llm_call_failed`。statement 导入路径目前**没有**执行预算（`112:80` 不传 `executionBudget`），`isBudgetExhausted` 现在不会出现；若以后接上，应归 `llm_call_failed` 并在 `detail` 写明，不能因为带着旧的 503 旗标就记成 `llm_capacity`。
- 同一次尝试里「响应无法解析」且「证据档写入也失败」时，`finally` 里丢的例外会盖过 `try` 里的（JS 语意；`127:499–523`），事件会记成 `evidence_write_failed`。这是读代码得到的推论，没有实验覆盖【未验证】；被盖过的那个失败不会出现在日志里。

pipeline 回传的 `Extraction_Failed` 一个 stage 现在装了 8 个事件（`drive_read_failed`、`config_missing`、`llm_capacity`、`llm_quota`、`llm_call_failed`、`llm_response_unparseable`、`evidence_write_failed`、`schema_invalid`；登记前算 hash 失败的 `drive_read_failed` 回传的是 `Unexpected_Error`）。词汇表把它们拆开，回传值里的 stage 保持不变，所以 `170.html` 和 `171` 现有的 stage 字串不受影响。

### 7.3 刻意不存什么，以及一次尝试的时间线

| 不存的东西 | 为什么 | 从哪里得到 |
|---|---|---|
| 当前状态（Pending / Failed…） | 衍生；`Interrupted` 还是时间的函数（EP4） | §7.5 的推导规则 |
| 尝试次数 | 可推导 | 该 `drive_file_id` 的 `started` 行数 |
| 最后一次尝试的时间、耗时 | 可推导 | `logged_at`；两行 `logged_at` 之差 |
| `document_id` | 会碰撞（§4.1）；而且 `drive_file_id` 已经能连到 Documents | `Documents`（以 `drive_file_id` 连结） |
| 期间 / 周别 | 权威值只在 Verified_Income（CMP-P5）；`Documents.period` 恒为 `'Pending'`（`170:250`） | `Verified_Income.period` |
| 验证错误明细、候选数字 | 证据档的 `raw_candidate` 重跑 125 就得到（确定性）；也避免把财务数字复制到第二处 | 证据档 |
| 模型 id、`finish_reason`、`raw_response` | 已在证据档与 `Verified_Income.extractor_id` | 证据档 |
| 页数（Option G） | 文件的属性，不是尝试的事件（§6.4） | — |
| 触发入口（batch / retry / 手动） | 可由尝试序号与 `MANUAL-` 前缀推出 | — |

一次尝试（同一个 `attempt_id` 的 1～2 行）的时间线：

```
consoleImportOneDriveFile_ 进入
  │
  ├─ [W1] append  started(F, attempt_id)              ← 早于任何可能失败的步骤
  │
  ├─ 读 Drive 算 hash ─────────── 失败 ──┐
  ├─ hash 去重 / 登记 Documents ── 命中 ─┤
  ├─ 抽取（Drive 读档 → Gemini → 解析 → 写证据档）─ 失败 ─┤
  ├─ 验证（125）──────────────── 不合格 ─┤
  ├─ 发布 Verified_Income ─────── 失败 ──┤
  └─ 成功 ──────────────────────────────┤
                                           ▼
                 [W2] append  <终结事件>(F, attempt_id[, income_id][, detail])

被 GAS 硬杀（不可 catch）：W2 永远不会发生
  → 读取时由「有 started、没有终结事件、超过宽限」推导 Interrupted（§7.5）
```

### 7.4 写入时机与状态转换规则

**写入规则**

| 规则 | 内容 |
|---|---|
| W1 | `started` 在每次尝试开始时写一行，**早于任何可能失败的步骤**：`consoleImportOneDriveFile_` 的 try 一开头（`170:234`，早于读 Documents 快照与 `getFileHash`（`170:246`）；批次、单档 Retry、`consoleRetrySelectedFiles_` 都经过这一个函式）；手动贴文字在 `runImportPipeline_`（`170:582`）之前。理由：硬杀不可 catch（`ADR-005 L68`），只有事前写下的标记才能让「执行中断」可观测 |
| W2 | 终结事件每次尝试**恰好一行**，写在 `consoleImportOneDriveFile_`（与 `consoleManualImport_`）的单一出口——回传值与 catch 两条路径都要写（`170:257–261`）。只有这一层写日志，不让 110 里的函式各自写：「怎么处理一个文件」只有一份逻辑（UCR5，`170:210–212`） |
| W3 | 终结事件在该次尝试的所有其他写入（Verified_Income、Reconciliation）**之后**才写；`verified` 只会在 Verified_Income 已 append 时出现。反方向的失败（Verified_Income 写成、终结事件没写成）由「Verified_Income 佐证」规则吸收（§7.5 步骤 1） |
| W4 | 不更新、不删除；更正 = 新行。晚到的终结事件（并发执行）照常 append，推导规则容忍孤儿行（§7.6 R8） |
| W5 | 所有写入经 TruthWriter（`115:31–46`），不另开写入路径（UCR6） |

**状态转换**（状态是读取时算出来的，这里列的是「事件序列允许怎样走」）

| 转换 | 内容 |
|---|---|
| T1 | `NotStarted`（只存在于扫描结果，任何表里都没有）→ 开始尝试 → `InProgress` |
| T2 | `InProgress` → 终结事件 → 该事件对应的状态（§7.2.1） |
| T3 | `InProgress` → 超过宽限仍无终结事件 → `Interrupted` |
| T4 | 任何不是 `Completed`、`DuplicateFile` 的状态 → 新一次尝试（批次汇入或 Retry）→ `InProgress`，尝试次数 +1 |
| T5 | `Completed`、`DuplicateFile` 是终态：对它们再试，得到 `already_verified` / `duplicate_file` 事件，状态不变（`Completed` 因 Verified_Income 佐证而保持） |
| T6 | `DuplicatePeriod` 事实上是终态：Verified_Income 只增不改、没有作废机制；UI 不建议 Retry（T0-4 同一个理由） |

### 7.5 推导规则，以及六个必须区分的状态落在哪

**推导规则**：对一份文件 F（以 `drive_file_id` 为键）。`L` = 日志里 `drive_file_id = F` 的行；`A` = `L` 里最后一次尝试（最后一个 `started`，连同同一 `attempt_id` 的终结行）；顺序以 `started` 行的 `logged_at`（ISO 字符串，字典序即时间序）为主、行号为辅——和 `130:154`、`142:1066` 的「字串排序即时间排序」是同一个做法，且不依赖 Sheet 没被人手动排序过。

| 步骤 | 条件 | 结果 |
|---|---|---|
| 1 | **Completed？**（任一成立）(a) `L` 里有 `verified` 事件，且 Verified_Income 里有它记录的 `income_id`；(b) Verified_Income 里有 `source_document_id` 等于 F 的某一笔 Documents 行的 `document_id`，且这个 `document_id` 在整个 Documents 里只出现一次 | `Completed` |
| 2 | `L` 为空 | Documents 里没有 F → `NotStarted`；有 → `NoLog`（旧资料） |
| 3 | `A` 有终结事件 `e` | `e = verified`（但步骤 1 (a) 不成立，即 Verified_Income 没有该 income_id）→ `UnclassifiedFailure`（日志与权威数据不一致，显性报出）；`e = already_verified` → `DuplicatePeriod`；其余 `e` → 按 §7.2.1 查出状态 |
| 4 | `A` 没有终结事件 | 读取端「现在」− `A` 的 `started.logged_at` ≤ 宽限 → `InProgress`；否则 → `Interrupted` |

步骤 1 (b) 是给旧资料的：没有日志的旧行仍然能凭 Verified_Income 判 `Completed`（和现行 Recovery Center 同一条规则，`170:444–454`），但**只在 `document_id` 唯一时**成立，所以 N22-2、N22-3 这种碰撞的失败文件不会被误报成 Completed。

**16 个推导出的状态**

| 状态 | 含义 | 判定 | Retry 建议 |
|---|---|---|---|
| `Completed` | 已发布 Verified_Income | 步骤 1 | 不需要（终态） |
| `DuplicatePeriod` | 同周已由另一份文件发布 | `already_verified` 且非 Completed | 不建议（不会变） |
| `DuplicateFile` | 内容与已导入的文件相同，已跳过 | `duplicate_file` | 不需要（终态） |
| `NotStarted` | 尚未处理 | 步骤 2 | 批次汇入会处理 |
| `InProgress` | 处理中 | 步骤 4，未超过宽限 | 等待 |
| `Interrupted` | 执行中断 / 未收尾 | 步骤 4，超过宽限 | 可以 Retry |
| `DriveReadFailed` | Drive 读取失败 | `drive_read_failed` | 确认文件与权限后 Retry |
| `ConfigMissing` | 设定缺失 | `config_missing` | 先补设定再 Retry |
| `LlmCallFailed` | Gemini 呼叫失败 | `llm_capacity` / `llm_quota` / `llm_call_failed` | 503、429：稍后 Retry；其他：先看 `detail` |
| `EvidenceWriteFailed` | 证据档写入失败 | `evidence_write_failed` | 先修资料夹权限再 Retry |
| `ParseFailed` | 解析失败 | `llm_response_unparseable` / `text_parse_failed` | 可以 Retry（模型输出不确定）；手动贴文字的要重新贴 |
| `ValidationFailed` | 验证失败（schema） | `schema_invalid` | 可以 Retry |
| `NeedsReview` | 需要人工审核 | `needs_review` | 先人工看候选，再决定 |
| `PublishFailed` | 发布失败 | `publish_failed` | 可以 Retry |
| `UnclassifiedFailure` | 未分类失败（含日志与权威数据不一致） | `unclassified_error`，或步骤 3 的不一致 | 先看 `detail` |
| `NoLog` | 旧资料，没有记录 | 步骤 2 | 沿用现行提示（Pending / Failed） |

**授权要求 4 里的六个状态落在哪**

| 必须区分的状态 | 判定 | 现行 Recovery Center | 实验 |
|---|---|---|---|
| 尚未处理 | `NotStarted`：在 Drive 资料夹里，Documents 与日志都没有 | 不在 Recovery Center（只遍历 Documents）；Scan 当新文件 | 所有场景在第一次尝试之前的起点；N1 执行后与它区分开（N1 有日志） |
| Drive 读取失败 | `DriveReadFailed`：最后一次尝试的终结事件是 `drive_read_failed`，不论发生在登记前还是后 | N1：不在任何分页；N2、N3：Pending | N1、N2、N3 |
| 解析失败 | `ParseFailed`：`llm_response_unparseable`（Gemini 2xx 但无法解析）或 `text_parse_failed`（手动贴文字） | Failed（同一句话）/ Pending（N19） | N7–N10、N19、N24 |
| 验证失败 | `ValidationFailed`：`schema_invalid` | Failed（与 4 种别的原因同一句话） | N11 |
| 需要人工审核 | `NeedsReview`：`needs_review` | Failed（同上） | N12 |
| 执行中断 | `Interrupted`：有 `started`、无终结事件、超过宽限，且没有 Verified_Income 佐证 | Pending（与 5 类别的原因混在一起） | N20 |

**把 §3 的 27 个场景套进这些规则**（推演，不是实测）：下表的「日志会留下的行」是**若设计已经实作**会写下的行——由我按 §3 每个场景的故障点标出事件（数据在 `p_mapping_data.py`，核对脚本另外用实验输出里的 stage 与错误讯息独立判断一次，两边必须一致）；「推导出的状态」由核对脚本另外写的推导函数按本节的规则重新算过，必须与这一栏逐行一致；「现行 Recovery Center」取自 §3 的实验结果。它检验的是规则本身是否自洽、能否拆开现行 Recovery Center 的混同，**不代表任何实作已经被验证**。

| # | 呼叫回传的 stage | 日志会留下的行（若设计已实作；最后一次尝试） | 推导出的状态 | 现行 Recovery Center | 备注 |
|---|---|---|---|---|---|
| N1 | Unexpected_Error | `started` → `drive_read_failed` | `DriveReadFailed` | （不在任何分页） | 现行 Recovery Center 看不到；推导看得到（要不要列出由 D6 决定） |
| N2 | Extraction_Failed | `started` → `drive_read_failed` | `DriveReadFailed` | Pending |  |
| N3 | Extraction_Failed | `started` → `drive_read_failed` | `DriveReadFailed` | Pending | 这里只列这次重试的两行 |
| N4 | Extraction_Failed | `started` → `llm_capacity` | `LlmCallFailed` | Pending |  |
| N5 | Extraction_Failed | `started` → `llm_quota` | `LlmCallFailed` | Pending |  |
| N6 | Extraction_Failed | `started` → `llm_call_failed` | `LlmCallFailed` | Pending |  |
| N7 | Extraction_Failed | `started` → `llm_response_unparseable` | `ParseFailed` | Failed（尝试 1） |  |
| N8 | Extraction_Failed | `started` → `llm_response_unparseable` | `ParseFailed` | Failed（尝试 1） |  |
| N9 | Extraction_Failed | `started` → `llm_response_unparseable` | `ParseFailed` | Failed（尝试 1） |  |
| N10 | Extraction_Failed | `started` → `llm_response_unparseable` | `ParseFailed` | Failed（尝试 1） | 假设情境 |
| N11 | Extraction_Failed | `started` → `schema_invalid` | `ValidationFailed` | Failed（尝试 1） |  |
| N12 | Needs_Review | `started` → `needs_review` | `NeedsReview` | Failed（尝试 1） |  |
| N13 | Verify_Failed | `started` → `publish_failed` | `PublishFailed` | Failed（尝试 1） |  |
| N14 | Verified | `started` → `verified` | `Completed` | Completed |  |
| N15 | Extraction_Failed | `started` → `evidence_write_failed` | `EvidenceWriteFailed` | Pending |  |
| N16 | Extraction_Failed | `started` → `config_missing` | `ConfigMissing` | Pending |  |
| N20 | (未返回——被杀) | `started`（没有终结行） | `InProgress`（宽限内）→ `Interrupted`（超过宽限） | Pending | 宽限内是 `InProgress`，超过宽限是 `Interrupted` |
| N17 | Already_Verified | F1：`started` → `verified`；F2：`started` → `already_verified` | F1 `Completed`；F2 `DuplicatePeriod` | Failed（尝试 1） | F1 是第一份（已发布），F2 是同周的第二份 |
| N18 | Skipped_Duplicate | F2：`started` → `duplicate_file` | F2 `DuplicateFile` | （不在任何分页） | 现行 Recovery Center 不列；F2 是内容相同的第二份（第一份 F1 是 Completed） |
| N21 | Extraction_Failed | `started` → `llm_capacity` | `LlmCallFailed` | Pending（evidenceUnavailable） |  |
| N19 | Parse_Failed | `started` → `text_parse_failed` | `ParseFailed` | Pending |  |
| N22-1 | Verified | F1：`started` → `verified` | F1 `Completed` | Completed |  |
| N22-2 | Extraction_Failed | F2：`started` → `llm_capacity` | F2 `LlmCallFailed` | Completed | 现行误报 Completed；`document_id` 不唯一，所以步骤 1 (b) 不成立 |
| N22-3 | Extraction_Failed | F3：`started` → `llm_capacity` | F3 `LlmCallFailed` | Completed | 同上 |
| N23 | (Daily Allocation 路径，不经 runImportPipeline_) | （没有日志） | `NoLog` | Failed（尝试 2） | 旧资料没有日志；只能沿用旧推导（先修 T0-1） |
| N24 | Extraction_Failed/Extraction_Failed/Extraction_Failed | F1、F2、F3 各：`started` → `llm_response_unparseable` | `ParseFailed` ×3 | Failed×3（尝试 3/3/3） | 每份各是第 1 次尝试（现行显示 3 / 3 / 3） |
| N25 | Extraction_Failed/Verified | H1：`started` → `llm_capacity`；H2：`started` → `verified` | H1 `LlmCallFailed`；H2 `Completed` | （见 §4.1） | 日志按 `drive_file_id` 区分 H1、H2；Daily Allocation 送错 PDF 是 §4.1 的契约问题，日志不修 |
| N26 | Verified/Verified | F1、F2 各：`started` → `verified` | `Completed` ×2 | Completed | 日志如实记两个 `verified`；批次内快照过期（§4.2）不在日志范围 |
| N27 | Verified/Verified | F1、F2 各：`started` → `verified` | `Completed` ×2 | Completed | 同上 |

读法（数字由核对脚本从结果 JSON 与上表重新算过）：

- 现行 Recovery Center 的 Pending 一格（10 个场景）装了 6 类真实原因；套用后落在 6 个不同的状态：`DriveReadFailed`、`LlmCallFailed`、`EvidenceWriteFailed`、`ConfigMissing`、`InProgress`（宽限后 `Interrupted`）、`ParseFailed`。
- Failed 里说成同一句「验证没有通过」的 5 个场景（N11、N12、N13、N17、N23）落在 5 个不同的状态：`ValidationFailed`、`NeedsReview`、`PublishFailed`、`DuplicatePeriod`、`NoLog`。
- N1 在推导上是 `DriveReadFailed`（现行 Recovery Center 只遍历 Documents，所以看不到它；要不要列出「只在日志里」的文件是 UI 决定，§10 D6）；N22-2、N22-3 不再被误报成 Completed；N24 三份各自是第 1 次尝试，而不是 3 / 3 / 3。
- 套用后**仍然不能解决的**：N23（没有日志的旧资料，`NoLog`——只能沿用旧推导，并先修 T0-1）；N25（`document_id` 碰撞造成的 Daily Allocation 送错 PDF，是 §4.1 的契约问题，日志不会修它）；N26、N27（批次内快照过期，§4.2；日志只会如实记两个 `verified`）。

### 7.6 跨场景规则

| 规则 | 内容 |
|---|---|
| R1 软失败 | 日志写入包在 try/catch 里，失败只发 WARN（`AlertService.log('WARN', …)`，没有 AlertService 就 `console.warn`，同 `110:228–235`），不改变导入结果。`started` 写失败 → 该次尝试没有日志（之后若终结事件写成，就是孤儿终结行）；终结事件写失败 → 读取时按 Interrupted 处理（除非 Verified_Income 佐证）。这两种情形与硬杀在日志里**无法区分**——`Interrupted` 的定义是「没有收尾记录」，不声称一定是硬杀 |
| R2 `detail` 清洗 | 写入前去掉 `key=` 查询参数（`127:437` 把 API key 放在 URL 的 `?key=`），截断到 300 字，不放候选数字或文件内容；程序不得解析 `detail`。真实 GAS 的例外讯息是否带 URL【未验证】 |
| R3 事件来源 | 由 §7.2.1「依据」栏的结构化来源决定；需要在 127 与 170 的几个丢例外处加上结构化标记（§9），**不解析 `err.message`**；认不出的归 `unclassified_error` |
| R4 宽限期 | `INTERRUPT_GRACE_MS` = 420 000 ms：GAS 单次执行硬上限 360 000 ms（`127:707`）加 60 秒余量；读取时的「现在」用读取端的时钟。设计参数（§10 D5） |
| R5 Retry 建议 | 由状态决定（§7.5 的表）；日志本身不阻止任何 Retry |
| R6 `attempt_id` 唯一性 | `ATT-<drive_file_id>-<真实时钟 ms>`；ms 取真实时钟（`170:317` 已有 `nowMs` 注入点的做法），**不用** `deps.now`。顺序执行下同一文件不会在同一毫秒开始两次；并发双击撞同一毫秒的机率可忽略，且推导规则对重复的 `attempt_id` 仍成立（视为同一次尝试的多行） |
| R7 不改既有表 | `Documents`（含恒为 `'Imported'` 的 `status`）、`Verified_Income`、证据档都不动；设计不依赖 `Documents.status` |
| R8 读取容错 | 孤儿终结行（没有 `started`）视为一次已开始的尝试；未知的 `event` 值显示为 `unclassified_error`；每一行的栏位数必须一致（`117:35–37` 在栏位数不符时丢例外）——日后只能往尾端加栏位（`140:18–28`） |

---

## 8. 旧数据、重复执行、失败重试与 append-only

### 8.1 旧数据兼容

- **不回填。** 回填等于把推测写成事实（CMP-P10）；能推导的部分（Completed、证据档存在）本来就不需要存（EP4）。
- **旧资料的读法**：Documents 有、日志没有 → `NoLog`（§7.5 步骤 2）；有 Verified_Income 佐证就是 `Completed`（步骤 1 (b)，只在 `document_id` 唯一时成立）；其余沿用现行的证据档推导当**提示**（先修好 T0-1），UI 必须明示「旧资料，没有记录」，不能当事实呈现。
- **现有读取点不受影响**：没有任何现有程序读新表；`Documents`、`Verified_Income`、证据档的结构都不变。
- **唯一的兼容风险是部署顺序**：新表要先在真实 spreadsheet 里建好——`setupComplianceOsSheets`（`108:171`）对不存在的表会建（`108:120–122`），对已存在但表头不符的表会丢例外（`108:140–148`）。如果先部署代码、后建表：`appendRow` 会丢「找不到 Sheet」（`115:77`），日志写入软失败（R1），导入照常，只是这段期间的尝试没有日志——不会破坏任何现有功能。
- 旧资料的真实数量与状态分布【未验证】（要在真实 Sheet 里看 Documents 的行数与证据档的数量）。

### 8.2 重复执行（同一份文件被处理不止一次）

- **来源**：批次汇入因 `stoppedEarly` 分多次执行（`170:304–346`）；操作者双击；同一份文件先后被批次与 Retry 处理。
- **日志不增加也不减少任何防重保护**：防重仍然由 hash 去重（`110:111`）、`existingIncomeIds`（`140:191`）和 `skipImport`（`170:240–244`）负责；每次执行是一次新尝试（2 行）。
- **现有防重的两个洞**（§4.1 `document_id` 碰撞、§4.2 批次内快照过期）日志都不会修，只会如实记下来：N26、N27 会出现两个 `verified`。怎么处理是 D2、D3。
- **并发**：两个执行同时处理同一份文件时，各有一行 `started`、`attempt_id` 不同，终结事件各自配对；推导取最后一次尝试，但 `verified` 是粘性的（§7.5 步骤 1 (a)）。脚本锁（`115:93–94`）只串行化单次 append，不保护整次尝试——这是现有行为，日志不改变它。

### 8.3 失败重试

- 每次 Retry 是新的一次尝试：2 行；尝试次数 = `started` 行数；旧尝试永远留着。
- Retry 建议由状态决定（§7.5）：`Completed`、`DuplicateFile`、`DuplicatePeriod` 不建议；`ConfigMissing`、`EvidenceWriteFailed` 先修环境；其余可以重试。这只是 UI 建议，日志不阻止任何重试。
- Retry 的路径不变：走 `skipImport`，不重新登记（`170:240–244`），所以日志**不会**造成新的 Documents 行（`ADR-006 L50` 的 mutation 注记：拿掉 `isRetry=true` 会让每次重试新增重复的 Documents 记录）。
- 证据档仍然是每次 2xx 的尝试写一份；证据档重名（N24）是既有问题，日志以 `attempt_id` 区分尝试，不受影响。

### 8.4 append-only 与治理

- 日志的每一行都是事实（「这时开始了」「这样结束了」），不被更新；状态是读取时算的，与 `getCurrentReconciliationStatus_`（`130:143–156`）、`getLatestDailyAllocationBatchId_`（`142:1054–1067`）同一个模式——这是本 repo 已有的「只增表 + 读取时取最新」先例。
- 新表走 `appendValidatedRow`（`115:31–46`），不绕过 TruthWriter（UCR6）。
- `Documents.status` 恒为 `'Imported'` 的现状不动（R7）。
- 归类：Evidence / Audit（提议，需批准）；它不参与业务计算——Verified_Income 不依赖它。
- 建表遵循既有流程：ADR → `108` 的 `buildSheetSchemas_` 加一项（先例：Daily_Allocation，`108:87–97`）→ `setupComplianceOsSheets` → 更新 `109:25` 的表名清单。

### 8.5 与现有 ADR 的关系

- `ADR-006` 的「真实的 Schema 缺口」一节（L35–41）明确把这个问题留下，并写明边界（L37）；L41 已承认 Drive 读档失败会被归 Pending。本设计是对那个缺口的回答，所以需要：一份新 ADR（暂称 ADR-007，状态 `PROPOSED`；`ADR-README L17` 写明下一个新 ADR 是 ADR-007，`ADR-README L36` 写明新 ADR 先标 `PROPOSED`，等你确认才改 `ACCEPTED`）规定日志的存在、归类与读取规则；ADR-007 批准后，`ADR-006` 的 Decision 一节（L26–27）要修订（Pending 的定义、`attemptCount` 的来源）。`ADR-006` 自己目前也只是 `PROPOSED`（L3）。
- 本阶段不起草 ADR-007：授权要求 7 是「先报告」。

---

## 9. 影响面与验证计划（若采用 Option C）

### 9.1 会动到的文件（现在一个都没动）

| 类别 | 文件 | 改什么 |
|---|---|---|
| 新增 | `ADR-007-…md`（`PROPOSED`） | 日志的存在、归类、读取规则 |
| 修改 | `DATA_OWNERSHIP.md` | 加一行（Evidence / Audit，提议） |
| 修改 | `ADR-006-…md` | Decision 一节与 Schema 缺口一节的修订 |
| 修改 | `108_SheetSetup.js` | `buildSheetSchemas_` 加一项，`textColumns` 列 `logged_at`、`drive_file_id`、`attempt_id`、`event`、`income_id`、`detail`（`setupComplianceOsSheets` 的注解「五张表」`108:166` 本来就已过时） |
| 修改 | `110_DocumentImport.js` | 新增 `DOCUMENT_PROCESSING_LOG_COLUMNS`、事件词汇与纯函数（事件 → 状态的推导）；`runImportPipeline_` 的回传值带结构化原因 |
| 修改 | `127_LLMExtractor.js` | 在 `127:470`、`127:473`、`127:490`、`127:494`、`127:500`、`127:522` 加结构化标记；不改行为 |
| 修改 | `170_OperatorConsole.js` | `consoleImportOneDriveFile_`、`consoleManualImport_` 写 W1 / W2；`getFileHash` 的标记（`170:246`）；`consoleScanFolder_`、`consoleGetRecoveryStatus_` 改读日志；`realEvidenceScanner_` 视情况只留给旧资料 |
| 修改 | `170_OperatorConsole.html` | 显示新状态、尝试次数、Retry 建议（D6） |
| 修改 | `109`、`111`、`128`、`171` | 七张表 → 八张（`109:25`）；新增事件词汇 / 推导 / 软失败 / 清洗 / 重放 §3 全部场景的测试；修正 `171:797` 的夹具 |
| 修改 | `CHANGELOG.md`、`VERIFICATION_STATUS.md` | 如实标记：Node 通过、真实 GAS PENDING |

### 9.2 成本

- 每份文件每次尝试多 2 次 append（锁 + `appendRow`）；真实 GAS 的延迟【未验证】。批次本来就在文件之间 `Utilities.sleep(1200)`（`170:333–335`），相对而言应属小量，但要量。
- Recovery Center 分类改读一张表，取代「每份未完成文件遍历一次证据资料夹」（§4.6），预期更快；真实数字【未验证】。
- 表的增长：每次尝试 2 行，与 Documents 同一个量级。

### 9.3 验证计划（每一层各自标 PENDING，直到有对应的实际证据）

| 层 | 内容 | 状态 |
|---|---|---|
| Node 单元 | 事件词汇、推导函数（纯函数）、清洗函数、软失败 | 实作后才能做 |
| Node 场景重放 | 把 §3 的 27 个场景在实作后的代码上重放，期望状态 = §7.5 的推演表 | 实作后才能做 |
| 变异测试 | 对推导规则（步骤 1–4）、软失败、清洗逐一改坏，确认测试抓得到 | 实作后才能做 |
| 真实 GAS ① | `setupComplianceOsSheets` 建表，确认表头与 `textColumns` | **PENDING**（需你在真实 GAS 执行） |
| 真实 GAS ② | 一次真实导入：看到 2 行，`logged_at` 没被转成日期 | **PENDING** |
| 真实 GAS ③ | 制造 Drive 读档失败（把文件移出资料夹或撤权限）、Gemini 400（无效 model id）、缺设定，各看一个事件 | **PENDING** |
| 真实 GAS ④ | 硬杀模拟：专用测试函式 `Utilities.sleep` 超过 360 秒被杀，看 `started` 无终结事件，推导为 `Interrupted` | **PENDING**（真实硬杀目前只有 `ADR-005 L68` 一次证据） |
| 真实 GAS ⑤ | 量 append 的延迟与锁开销；例外讯息是否带 `key=` 的 URL | **PENDING** |
| 真实浏览器 | UI 显示 | **PENDING** |

### 9.4 分阶段门槛（提议）

阶段 0：你决定方向（D1）→ 阶段 1：ADR-007 草稿（`PROPOSED`）→ 阶段 2：Node 实作 + 测试 + 变异 → 阶段 3：真实 GAS 建表与探针（§9.3 的 ①–⑤）→ 阶段 4：UI。每个阶段结束都报告：改了哪些文件、证据、测试结果、尚未验证事项。

---

## 10. 需要你决定

回复编号即可（可以只回你想决定的几项；都不阻塞彼此）。

| # | 决定 | 选项 | 我的建议 |
|---|---|---|---|
| D1 | **方向**：采用 Option C 吗？ADR 形式？ | (a) 采用：我起草 ADR-007（`PROPOSED`），你确认后才写代码；(b) 暂不采用，只做 Tier 0；(c) 都不做；(d) 仍倾向在 `Documents` 加栏位（Option B）：我另外出 B 的完整设计，含「一份文件多行」之后所有读取点的改写清单（§6.2）。ADR 形式也请一并决定：新增 ADR-007，还是直接修订 ADR-006 | (a)，新增 ADR-007；同时按 D4 先做 T0-1、T0-2 |
| D2 | **`document_id` 碰撞**（§4.1） | (i) 是否由你在真实 Sheet 跑只读检查（§4.1 的公式，我没有跑过）；(ii) 若确认有碰撞，处理属于持久化契约变更（新文件用新的 id 格式、旧数据不动，Verified_Income 与证据档的前缀查询要兼容两种格式）——是否要我另外出一份设计 | 先做 (i)；结果出来再谈 (ii) |
| D3 | **批次内快照过期**（§4.2） | 是否授权作为独立修复（批次内每次成功写入后更新 `existingHashes` / `existingIncomeIds`）；它不在 Phase P 范围，会改变导入的幂等行为，需要新增测试 | 授权，但与 Phase P 分开处理 |
| D4 | **Tier 0 逐项授权**（§6.1） | T0-1（`orders:` 过滤 + `171` 夹具）、T0-2（Pending 文案 + `ADR-006 L26` 的定义）、T0-3（Failed 子类重算）、T0-4（同周已发布不再提示 Retry） | 先 T0-1、T0-2；T0-3、T0-4 等 D1 之后 |
| D5 | **设计参数**（§7.6） | 宽限期 420 s；`detail` ≤ 300 字；日志写入失败是软失败，还是 fail-closed（写不进日志就中止这次尝试） | 软失败（先例 `110:228–235`），参数照列 |
| D6 | **UI 行为** | Recovery Center 保留 Pending / Failed / Completed 三个分页并给每笔加状态标签，还是改成按状态分组；「只在日志里、没有 Documents 行」的文件（N1 型）要不要列出；哪些状态隐藏 Retry | 保留三分页 + 状态标签（改动最小）；列出 N1 型；按 §7.5 的 Retry 建议隐藏 |
| D7 | **Option G**（`page_count`，§6.4） | 不并入 ADR-007，等 Phase O 的 G1–G3 通过后另议；或现在就并入 | 不并入 |

另外：Phase O 留下的 5 个决定仍然有效、尚未收到回复，不阻塞本阶段。

---

## 11. 尚未验证（PENDING）

1. **真实 GAS**：append 的延迟与锁开销；`UrlFetchApp` / Drive 例外讯息的真实样貌（是否带 `?key=` 的 URL，决定清洗规则够不够）；`DriveApp.getFileById` 对合成 `MANUAL-…` id 的真实行为；硬杀之后的真实痕迹（只有 `ADR-005 L68` 一次证据）；单次执行 6 分钟上限在你账号类型上的实际值（`127:707` 的假设）。
2. **真实 Sheet**：`document_id` 是否有重复（§4.1）；Documents 行数、证据档数量与 Recovery Center 的真实耗时（§4.6）；`logged_at` 的 `textColumns` 在新表上是否生效（先例已有，新表未验证）。
3. **W06 的真实证据档**：`summarizeEvidenceFailure_` 的前两个分支是否对应更早版本的证据（§3.1 第 7 点）。
4. **设计尚未实作**：§7.5 的推演表是我对规则的机械套用，不是实测；§7.2.1「依据」栏要求的结构化标记还没有写出来，实作时可能发现某个例外路径拿不到可靠的标记。
5. **真实 Gemini**：实验里所有 Gemini 响应都是模拟；`parseGeminiResponse_` 里「找不到 `content.parts[0].text`」那个丢例外处（`127:287`）没有被实验覆盖，只是读代码（N7、N8、N9 分别走到 `127:283`、`127:278`、`127:293`）。
6. **真实浏览器**：UI 部分没有任何验证。
7. **没有触碰的东西**：5 个 W01 legacy failures 没有改动；其他 OS 与历史基线没有触碰。

---

## 12. 修改的文件

- **没有修改任何生产文件、测试文件、治理文件，没有改动任何表结构。**
- repo 内唯一新增：本文件 `PhaseP_Documents_Processing_State_Design_2026-10-17.md`。
- 证据：实验与核对脚本不在 repo 里（附录 A）。
- 现有测试（Phase N 交付状态，没有改动）的回归结果：`run_all.py` 在**未改动**的 repo 上重跑（Node + 假 GAS，不是真实 GAS）：UTC 与 Asia/Kuala_Lumpur 各 779 PASS / 5 FAIL（17 个测试文件）；5 个 FAIL 全在 `143_Tests_DailyOrderAllocation.js`、名称都含 W01，就是已知的 W01 legacy failures，未触碰。这一步只确认工作副本没有被实验污染；本阶段没有改动任何 repo 文件，所以它不是对新代码的验证，结果与 Phase N 交付时相同。

---

## 附录 A：复现方式

实验程序**没有放进 repo、没有交付**；需要的话可以另外给。

| 程序 | 作用 |
|---|---|
| `p_scenarios.js` | §3 的 27 个场景（29 行）；`node p_scenarios.js <repoDir> <outJson>` |
| `run_all.py` | 沿用 Phase N 的回归脚本：对 repo 全部 `*_Tests_*.js` 在 UTC 与 Asia/Kuala_Lumpur 各跑一遍，逐文件列出 PASS / FAIL |
| `p_idcheck.js` | §4.1：同一批三份新文件共用同一个 `document_id` 的独立复现 |
| `p_batchdup.js` | §4.2：同一批两份同周 / 同内容文件各写一行 Verified_Income 的独立复现 |
| `p_mapping_data.py` | §7.5 对照表的输入：每个场景「若设计已实作」会有的 Documents / Verified_Income / 日志行，与期望状态 |
| `p_assemble_report.py` | 把实验输出与回归输出代入本报告的两张表（§3、§7.5）、实验备注、回归摘要与结果 JSON 的 sha256；§3 的表格取自实验程序的输出，不手抄 |
| `p_report_check.py` | 核对本报告：每个源码行号引用对照原始码、每个治理文件引用对照原文、每个数字对照结果 JSON、两张对照表对照表格定义（含另写的推导函数）、重跑实验确认结果一致；另有对核对脚本自己的变异测试 |

- 它们只 `require` repo 的真实模块；假的只有 Drive、Gemini 传输层与 Sheet 存取（沿用 `105_TestUtils.js` 的 fake），**不改 repo 的任何文件**。
- **没有模拟的东西**：真实 GAS 的配额、延迟与例外讯息；真实 Sheets 的型别转换；真实 Drive 的权限与删除行为；真实 Gemini 的响应变体。
- 结果 JSON（`phaseP_result.json`）的 sha256：`77b9137b8811a00e9fafe4b9f53631cab553c15699c13d82666d8c4dc68afa81`。重跑 `p_scenarios.js` 得到的 JSON 与它逐字一致，报告里的表格由它重新生成。
