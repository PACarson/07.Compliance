/**
 * 901_System_Architecture.js
 * Compliance OS — System Architecture（Compliance OS 自己的「Blueprint」）
 *
 * 定位：Universal Domain OS Blueprint catalog 的是「整个生态有没有证据支撑
 * 的共用能力」，Tier 1/2/3 specifically 衡量「几个独立项目做出同一个模式」。
 * 这份文件反过来——只看 Compliance OS 自己内部的模块，用 Compliance OS
 * 自己的进度状态（Designed/Built/Tested/Production），跟生态级的 Tier 是
 * 两个不同维度，不要混用同一套词汇。
 *
 * 跟universal Blueprint 的关系（对应 BP-6）：Compliance OS 自己的 Pipeline
 * / 模块划分 / Sheet 命名 / Event 格式，都是 Compliance OS 自己的
 * Architecture，Blueprint 从来不规定这些——这份文件才是负责这些具体决定
 * 的地方。下面 §2 是这个项目自己做的「Architecture-Layers-to-Blueprint
 * 映射」（跟 Rider OS 在它自己 Constitution 里做的是同一件事，per BP-6）。
 */

var COMPLIANCE_OS_ARCHITECTURE = {
  verificationHistory: [
    {
      date: '2026-08-01',
      method: 'Node vm 模块模拟合并执行（按 GAS 文件名字母序，沙盒内没有 require/module/process）',
      result: '第一次跑发现真实 bug（122/141 的 const SAMPLE_RAW_TEXT 撞名，GAS 里会是 SyntaxError），修复后（105_TestUtils.js）重跑通过'
    },
    {
      date: '2026-08-01',
      method: '真实 Google Apps Script 项目，实际执行 runAllTruthWriterTests / runAllGrabWeeklyParserTests / runAllRiderOSAdapterTests / runAllReconciliationTests / runAllVerifiedIncomeTests',
      result: 'Steven 确认全部通过——这是目前唯一在真实 GAS 环境跑过的证据，比 Node 模拟更直接'
    },
    {
      date: '2026-08-01',
      method: 'Node vm 模块模拟合并执行，扩大到全部 16 个文件（含新加入的 110/111）',
      result: '通过——没有新的撞名或加载顺序问题'
    },
    {
      date: '2026-08-01',
      method: 'Node vm 模块模拟合并执行，扩大到全部 18 个文件（新增 DocumentTextExtractor 相关两个文件），改用目录扫描（不是手动列文件名）确保真的照 GAS 实际的字母序',
      result: '通过'
    },
    {
      date: '2026-08-01',
      method: '补齐 Compliance Calendar 测试（27 项）+ 新增 Contract Tests（12 项，采纳评审建议的新测试类别）；Node vm 模拟扩大到全部 21 个文件',
      result: '通过；11/12 模块 Tested，唯一未测的 AI Extraction 是按 Blueprint BP-3 刻意保留的 Tier 3 占位，不是核心 Runtime 缺测试'
    },
    {
      date: '2026-08-01',
      method: '真实 GAS 项目，Steven 确认 runAllComplianceCalendarTests / runAllContractTests 也跑过',
      result: '通过——8 组 runAllXTests() 现在全部都有真实 GAS 环境的直接证据，不只是 Node 模拟'
    },
    {
      date: '2026-08-17',
      method: 'ADR-003（Reconciliation 与 Verified Income 解耦）实作后，Node vm 模块模拟合并执行全部 22 个文件（含 900/901 本身）',
      result: '通过，没有新的撞名或加载顺序问题；10 组 runAllXTests() 全部通过（Reconciliation 24 项、Verified Income 15 项、Document Import 32 项，均含新增的 ADR-003 行为测试）。真实 GAS 环境的重跑仍待 Steven 手动执行（人工验证清单见 111/131 文件底部）'
    },
    {
      date: '2026-08-17',
      method: 'Real Data Pilot 第一步：112_DocumentTextExtractor.js 接上真的 Drive OCR（driveOcrExtractor_ + realDriveOcrService_），Node vm 模拟重跑全部文件',
      result: '通过，10 组 runAllXTests() 全部过（DocumentTextExtractor 3→15 项，新增对 driveOcrExtractor_ 编排逻辑的测试——用假 driveService，不是真的 DriveApp/Drive/DocumentApp）。真的调用 Google API 那一步（getOrCreateFolder/copyWithOcr/readDocText/trashFile 的真实实现）无法在 Node 验证，是这次新增的人工验证清单里份量最重的一项，待 Steven 拿真实 PDF 在 GAS 里跑'
    },
    {
      date: '2026-08-18',
      method: 'Real Data Pilot 第二步：Operator Console 整套（SheetReader 新模块、110 重构出 runImportPipeline_、140 新增发布幂等检查、170 Console 后端 + HTML 前端），Node vm 模拟合并执行全部 28 个 .js 文件',
      result: '通过，没有撞名或加载顺序问题；12 组 runAllXTests() 全部通过，共 229 项断言。既有测试（Reconciliation/VerifiedIncome/DocumentImport）全部照旧通过，确认 runImportPipeline_ 重构、幂等检查都是可加行为、没有破坏既有契约。真的调用 DriveApp（folder 扫描、批次汇入、Retry）跟真的打开 doGet 部署页面，Node 环境验证不到，是这次份量最重的人工验证清单（见 171 文件底部）'
    },
    {
      date: '2026-08-20',
      method: 'Web Console 首次真实 GAS 调用：Steven 发现两个 Real Data Pilot 阶段没测到的真实 bug——(1) gasSheetAccessor_ 用 SpreadsheetApp.getActive()，standalone script 永远拿不到东西，改用 openById+Script Property；(2) google.script.run 叫不到结尾带下划线的私有函数（官方文件明载），170 全部 consoleXxx_ 都要补一层不带下划线的公开 wrapper。新增 108_SheetSetup.js（一次建好五张表的表头+plain-text 格式）',
      result: '两个都是真实环境才会踩到、Node 测试结构上测不到的问题（前者是 GAS 独有的「standalone script 没有 active spreadsheet」语意，后者是 google.script.run 的私有函数可见性规则）。修完后 Steven 确认 Drive 扫描+批次汇入在真实 GAS 跑通'
    },
    {
      date: '2026-08-21',
      method: 'LLM-based Extraction 正式实作：Steven 决定放弃 Drive OCR、改用 LLM extraction + deterministic validation（PDF → LLM Extraction → Structured Candidate → Schema/Period/Arithmetic Validation → normalize → Verified Income）。新增 125_ExtractionValidation.js（三层验证，纯逻辑）、127_LLMExtractor.js（Gemini generateContent provider，PDF inline_data + responseSchema 结构化输出）；112_DocumentTextExtractor.js 改成 provider factory（llm 默认、ocr 保留未实作的 fallback 槽位）；110 的 runImportPipeline_ 按 extractor 回传的 envelope.mode 分流（text→原本 regex parser 不变；structured→先过验证才能 normalize 成 parsedStatement，没过就是 Extraction_Failed/Needs_Review，candidate 跟证据原样保留不丢弃）；140 新增 source_document_id/extractor_id 两个可追溯栏位（additive，MonthlyProjection 等既有消费者不受影响）',
      result: '**发现文件本身跟实际代码不一致**：这份文件（下面 112 的模块条目）先前记着 driveOcrExtractor_/realDriveOcrService_「已经真的实作」（2026-08-17 那次变更），但这次拿到的 07.Compliance-main.zip 里 112_DocumentTextExtractor.js 实际内容只有 placeholderExtractor_ 占位、没有任何 Drive OCR 代码——appsscript.json 的 Drive Advanced Service（v2）manifest 变更确实在，但对应的实作代码不在这份 zip 里。原因不明（可能治理文件在代码真正落地前就先更新了，或中途被回退过），Steven 没有另外提起，这里如实记录、不假装没发生。下面 112 条目已经改成描述这次实际验证过的真实状态（LLM extraction），不是延续先前那笔可能有误的记录。Node vm 模拟合并执行全部 32 个 .js 文件（含 195_Tests_GasLoadSimulation.js 本身，新增；PropertiesService 存在但完全没设定任何 Script Property 的状态下模拟载入），过程中额外抓到两个新问题：108_SheetSetup.js 的 SHEET_SCHEMAS_ 原本顶层就求值、字母序排在 110/130/140/150 前面会读到 undefined（改成惰性函数）；112 的 DocumentTextExtractor 原本顶层就急着建构 realLLMExtractor_()，Script Properties 没设定好时会让整个专案载入失败（改成惰性，延后到第一次真的 extract() 呼叫）。16 组 runAllXTests() 全部通过，真的调用 Gemini API、真的看到 evidence 档案写进 Drive，只能等 Steven 设定好 Script Properties（GEMINI_API_KEY/EXTRACTION_EVIDENCE_FOLDER_ID）后在真实 GAS 验证'
    }
  ],

  pipeline: [
    'Google Drive（指定 Folder）',
    'Operator Console（HTMLService，扫描未汇入 PDF + 批次汇入 + Retry——见 170_OperatorConsole.js/.html）',
    'Document Import Engine',
    'LLM Extraction（127_LLMExtractor.js，Structured Candidate）→ Extraction Validation（125_ExtractionValidation.js，schema/period/arithmetic）',
    'Document Parsing Engine（regex 路径：手动贴文字 / 未来的 OCR fallback，两条路径汇流成同一个 parsedStatement 形状）',
    'Structured Statement Data',
    'Compliance OS Truth Layer（Verified Income 在此发布——ADR-003，不等 Reconciliation；LLM 只是 Extraction Engine，不是 Truth Engine，Extraction Validation 才是进这层前的强制关卡）',
    'Event Bus',
    '→ Finance OS (Verified Income) / Reminder OS (Compliance Calendar)'
  ],
  /** ADR-003（v0.7，已签字）：Reconciliation 不在主线上，是独立、可选、非阻断的旁支——有 Rider OS 数据才跑，跑完只在 Reconciliation_Log 留下 reconciliation_status 注解，从不影响上面主线是否发布 */
  optionalPlugins: ['Reconciliation Engine（对账 Rider OS，见 130_Reconciliation.js）'],
  /** compliance-os-console.jsx（v1/v2 的浏览器端重新实现）已被 Operator Console 取代退役——逻辑现在只有真正的 GAS 模块这一份（UCR5），不再有浏览器端的平行副本 */
  retiredArtifacts: ['compliance-os-console.jsx'],

  /**
   * §1 Compliance OS 自己的模块目录。
   * status：Designed（只有设计，没有代码）／Built（代码写了）／
   *         Tested（自动化测试通过）／Production（在真实 GAS + 真实数据上跑过）
   */
  modules: [
    {
      name: 'TestUtils（共用测试 helper + 固定样本）',
      file: '105_TestUtils.js',
      status: 'Tested',
      note: '透过 Node vm 模块把所有交付文件按 GAS 实际文件名字母序合并执行才抓到：122 跟 141 各自用 const 宣告同名 SAMPLE_RAW_TEXT，GAS 单一全局作用域下这会是 SyntaxError，整个项目会加载失败。抽成共用文件后，也顺便把 5 个测试文件里各自重复定义的 assertEqual_/fakeStore_/fakeSheetAccessor_/fakeLockProvider_（function 重复宣告虽不报错但一样脆弱）收成一份'
    },
    {
      name: 'DocumentParser + ParserRegistry',
      file: '120_DocumentParsing.js',
      status: 'Tested',
      note: 'IIFE + UCR2/3 补齐；透过 GAS 合并加载模拟验证过能正常运作'
    },
    {
      name: 'TruthWriter（UCR6 Sheet 写入唯一出口）',
      file: '115_TruthWriter.js',
      status: 'Tested',
      note: '栏位校验 + 加锁写入，5 项测试通过。Sheet 本身的建立/plain-text 格式设置不在它的职责内——2026-08-20 由 108_SheetSetup.js 补上，不是这个文件自己做'
    },
    {
      name: 'SheetReader（新增，Sheet 读取唯一出口，TruthWriter 的对称读取层）',
      file: '117_SheetReader.js / 118_Tests_SheetReader.js',
      status: 'Tested',
      note: 'Real Data Pilot（v0.7）需要读现有 Sheet 内容才能做——existingHashes 这类输入过去一直是外部手动传入，没有真的读过 Sheet。刻意不塞进 TruthWriter（名字/职责本来就限定在「写」），改成对称的新模块，共用同一个 sheetAccessor（115 的 gasSheetAccessor_/fakeSheetAccessor_ 都加了 getAllRows）。readAll() 原样回传欄位值，不做任何猜测性转换（不会把空字串猜回 null）。7 项测试通过'
    },
    {
      name: 'GrabWeeklyParser',
      file: '121_GrabWeeklyParser.js',
      status: 'Tested',
      note: '对重建样本文字跑过测试；还没对接真实 Document Import Engine 抽出来的文字'
    },
    {
      name: 'RiderOSAdapter',
      file: '123_RiderOSAdapter.js',
      status: 'Tested',
      note: 'UCR7 占位实现；Rider OS 还没建好真正的发布能力'
    },
    {
      name: 'Document Import Engine',
      file: '110_DocumentImport.js / 111_Tests_DocumentImport.js',
      status: 'Tested',
      note: '去重、document_id 生成、真实 SHA-256、Documents 写入都是真实实作。Sheet 存 drive_file_id（权威引用）+ drive_path（人类可读缓存，明确不是真相来源）而不是存 URL；新增建议文件名/目录路径的纯函数（{SOURCE}_{TYPE}_{PERIOD}.pdf，Compliance OS/{source}/{year}/{标签}）。ADR-003（v0.7）后再一次重构（Real Data Pilot）：拆出共用核心 runImportPipeline_()——不丢例外，结构化回传每一步的 stage（Skipped_Duplicate/Extraction_Failed/Parse_Failed/Verify_Failed/Verified/Already_Verified），Operator Console 的批次汇入靠这个才能一个文件失败不中断整批；processGrabStatement_() 变成薄封装，维持既有「失败就 throw」的契约不变（UCR5：序列只有一份，不是两份平行逻辑）。skipImport 参数支援 Retry：文件已经有 Documents 记录时跳过重新 import，不会被 file_hash 去重挡住，2026-08-21 修正原本 Retry 时 document_id 固定回传 null 的缺口（呼叫方现在会把查到的既有 document_id 一并带上，Verified_Income 的 source_document_id 才追溯得回去）。2026-08-21 新增：extraction 回传的 envelope 依 mode 分流——text（regex parser，行为不变）／structured（LLM candidate，先过 125_ExtractionValidation.js 才能 normalize 成 parsedStatement，没过是新增的 Needs_Review 阶段，不是 Extraction_Failed，candidate 跟证据原样保留）。57 项测试通过'
    },
    {
      name: 'DocumentTextExtractor（PDF→文字/结构化候选 Adapter）',
      file: '112_DocumentTextExtractor.js',
      status: 'Tested',
      note: '2026-08-21 更新：provider factory，selectExtractorProvider_ 选 \'llm\'（默认，接 127_LLMExtractor.js）或 \'ocr\'（明确保留但还没实作的 fallback/diagnostic 槽位）。⚠️ 这份文件先前（2026-08-17）记着 driveOcrExtractor_/realDriveOcrService_ 已经实作——重新读这次 zip 里的实际代码后发现只有 placeholderExtractor_ 占位，没有对应实作，appsscript.json 的 Drive Advanced Service manifest 变更倒是真的在，但代码不在。已改成描述现在验证过的真实状态，不确定先前记录为何脱节，如实标注。真实 GAS 环境下 DocumentTextExtractor 的建构是惰性的（lazyLLMExtractor_）——不惰性的话，Script Properties 没设定 GEMINI_API_KEY 时会让整个专案在载入阶段就失败，牵连所有其他函式。7 项测试通过'
    },
    {
      name: 'ExtractionValidation（新增，LLM candidate 进 Verified Income 前的强制关卡）',
      file: '125_ExtractionValidation.js / 126_Tests_ExtractionValidation.js',
      status: 'Tested',
      note: '「LLM 是 Extraction Engine，不是 Truth Engine」这个边界的具体实现——纯逻辑、不碰任何 GAS 服务。三层检查：schema（形状/必要栏位/类型）→ period（只信拆开的年/月/日整数，UCR4；week 永远由这里的代码从 period_start_parts 重新算，从不采用 candidate 自己给的任何 week 值）→ arithmetic（summary/income_breakdown 彼此的数学关系，±0.01 容差）。schema 没过是 Extraction_Failed，period/arithmetic 没过是 Needs_Review（candidate 跟错误原样保留，不丢弃）。含明确的 hallucination 负向测试（数字各自看起来合理但兜不起来，必须被拒绝）。24 项测试通过'
    },
    {
      name: 'LLMExtractor（新增，DocumentTextExtractor 的 provider=\'llm\' 具体实现）',
      file: '127_LLMExtractor.js / 128_Tests_LLMExtractor.js',
      status: 'Tested',
      note: 'Provider 选 Gemini generateContent（PDF inline_data + responseSchema 结构化输出）——不是较新的 interactions API，理由：请求/回应形状目前比较有把握（多个独立来源互相印证），换 provider 只需要改这个文件的 buildXxxRequestBody_/parseXxxResponse_，其他文件不用动。model/API key 从 Script Properties 读，不写死。证据留存：不管这次 candidate 有没有通过验证都会把 raw response/candidate/prompt 写成 Drive 里的 JSON 档，档名带 document_id+extraction version。真的调用 Gemini API/DriveApp 那几行（realLLMExtractorDeps_）Node 环境测不到，纯函数（request 组装/response 解析/证据记录）跟编排逻辑（假 driveService/httpClient）都有测。23 项测试通过'
    },
    {
      name: 'Reconciliation Engine（ADR-003：独立、可选、非阻断的旁支，对 140_VerifiedIncome.js 零依赖）',
      file: '130_Reconciliation.js',
      status: 'Tested',
      note: '纯逻辑（reconcileStatement_，status 词汇 v0.7 改成 Matched/Discrepancy_Flagged）+ 编排层（runReconciliationForWeek_，「两边到齐才跑」只决定 Reconciliation 自己跑不跑，不再决定 Verified Income 发不发布；没有 Rider OS 数据时也照样写 Not_Performed 的 Reconciliation_Log，不是整个跳过不留痕）+ 新增 getCurrentReconciliationStatus_()（查询时从 Reconciliation_Log 取最新一笔算，不是存在别处等着被更新——TruthWriter/UCR6 只支援 append）；24 项测试通过'
    },
    {
      name: 'Verified Income 发布',
      file: '140_VerifiedIncome.js',
      status: 'Tested',
      note: 'ADR-003（v0.7，Steven 已签字）：buildVerifiedIncomeRecord_/verifyAndPublishIncome_ 不再需要 reconciliationResult——net/amount 直接来自 parsedStatement.summary.weekly_net（陈述值，CMP-P5），解析成功即可发布，不等对账。Real Data Pilot 再加一层：verifyAndPublishIncome_ 新增可选的 existingIncomeIds 参数，发布前检查这个 income_id 是不是已经存在，存在就跳过（skipped: true），不重复写——「已导入文件不能因为重复点击而重复产生 Verified Income」这个要求落在发布本身，不是靠上层各自小心；不传这个参数时行为完全不变（既有呼叫方不用改）。2026-08-21 新增 source_document_id/extractor_id 两个可追溯栏位（additive，接在既有栏位后面，MonthlyProjection 等既有消费者不受影响）——extractor_id 直接读 parsedStatement._parser_id，GrabWeeklyParser 的 regex 路径、LLMExtractor 经验证 normalize 出来的路径都会在这个欄位留下自己的身份。EventBus 发布仍是 EventPublisher 占位实现，真实调用方式还没确认；21 项测试通过'
    },
    {
      name: 'Compliance Calendar',
      file: '150_ComplianceCalendar.js / 151_Tests_ComplianceCalendar.js',
      status: 'Tested',
      note: '按 EP4 设计：Upcoming/Due_Soon/Overdue 查询时即时算，不存欄位；"完成"是 append-only 的 Compliance_Completions 记录，不是 UPDATE 既有行（配合 TruthWriter 目前只支援 append，也更贴近生态的 event-sourcing 风格）。27 项测试通过。故意留着没解决：连续多天都是 Due_Soon 会不会重复发通知太吵——没有实际使用证据前不猜方案'
    },
    {
      name: 'Monthly Projection Engine（新增，评估结论：属于 Compliance OS，不存储，即时算）',
      file: '160_MonthlyProjection.js / 161_Tests_MonthlyProjection.js',
      status: 'Tested',
      note: '纯函数消费 Verified_Income 记录聚合成月度/YTD 汇总，标示 _source: "Projection"，不产生新的 Verified 记录。2026-08-22 改版：月份归属不再用"该周星期四所在月份"整笔归属（原本的简化，人工验证清单当时就留了待确认项）——改成逐笔用 computeMonthlyAllocation_ 读 period_start/period_end（同版新增进 VERIFIED_INCOME_COLUMNS，见 140）判断，完全落在一个月的全额归属，横跨两个月的不猜、不拆，明确标成 Needs_Allocation，两个月份都列出来但金额不计入任一个月的 net，避免静默错误归属。YTD 由月度汇总加总而来，不重复一次判断逻辑（单一真相来源）。isoWeekToYearMonth_ 保留、向下相容，但不再被这两个汇总函数用来做归属判断。同版新增 computeComplianceProjection_：SOCSO 用 Steven 已确认的 Plan 4 固定金额（RM49.40/月），EPF/Tax 在计算规则确认前明确回传 Not_Configured，不产生数字（需求 §10，CMP-P10 不猜的延伸）——三项都标 status: \"Projection\"，跟以后真正的官方缴费 Official Record 区分开。44 项测试通过（含需求文件明列的 6 项场景：整月/同月多笔/跨月/重复计算/连续重算一致/缺期间，以及 computeComplianceProjection_ 自己的断言）。可以直接消费历史 Verified_Income 回填，不需要重新解析 PDF'
    },
    {
      name: 'Operator Console（Real Data Pilot，v0.7，取代 compliance-os-console.jsx）',
      file: '170_OperatorConsole.js / .html / 171_Tests_OperatorConsole.js',
      status: 'Tested',
      note: '真正的 HTMLService 页面（doGet 入口），前端用 google.script.run 直接呼叫下面这些真实的 GAS 函数——逻辑只有一份（UCR5），不是浏览器端重新实现一次 121/130/160 的平行副本（那是旧 .jsx 的做法，已退役）。consoleScanFolder_ 用 drive_file_id 对照 Documents 现有记录去重（CMP-P11 第一次真的拿来当去重键，不只是存着，且不用先下载/算 hash）；consoleBatchImport_ 逐一处理未汇入文件，靠 110 的 runImportPipeline_ 让单一文件失败不中断整批；consoleRetryFile_ 用 skipImport 跳过重复 import，2026-08-21 起会把既有 document_id 一并带上（见 110 条目）；consoleManualImport_ 是 Debug/Fallback（不是主要流程，Steven 明确要求）；consoleRebuildProjections_ 批次结束自动重建 Monthly/YTD（160 本来就是即时算，这里没有新架构，只是编排）。⚠️ 2026-08-20 发现：google.script.run 叫不到结尾带下划线的私有函数（Apps Script 官方文件明载）——这是这次 Real Data Pilot 真正卡住的根因，不是先前假设的 GAS 环境细节问题。补上一层不带下划线的公开 wrapper（consoleGetDashboard/consoleScanFolder/consoleBatchImport/consoleRetryFile/consoleManualImport/consoleSaveLastFolderId/consoleGetLastFolderId），170_OperatorConsole.html 的七个呼叫点也同步改名，实作细节全部留在原本的 _ 版本不变。低层 Drive 操作透过 folderScanner 注入，Node 环境测编排逻辑，真的调 DriveApp 那几行只能在真实 GAS 验证（见 171 人工验证清单）。appsscript.json 新增 webapp 部署设定（access: MYSELF）。2026-08-22 新增「月度总览」UI（需求 §5-§8）：consoleRebuildProjections_ 现在给每个月度摘要都附上 compliance_projection（160 新增的 computeComplianceProjection_）；新增 consoleGetIncomeDetail_/consoleGetIncomeDetail 做 Drill Down——从月度汇总一路查回单笔 Verified_Income 及其对应 Documents 记录的 drive_file_id，前端组标准 Drive 检视网址，不复制/搬动 PDF 本身（需求 §8）。170_OperatorConsole.html 新增年份/月份导览（按 needs_allocation 是否非空标 ⚠）、月度摘要卡片、Compliance Projection 卡片（Not_Configured 项目明确用斜体次要文字呈现，不是塞一个假数字）、Included Statements 清单 + 追溯来源按钮。34 项测试通过'
    },
    {
      name: 'Utils（生产代码共用工具，新增）',
      file: '106_Utils.js',
      status: 'Tested',
      note: '把原本在 130/160 各自重复宣告的 round2_() 收成一份——function 重复宣告不会像 const 那样直接崩溃，但一样是脆弱模式，跟 105_TestUtils.js 同样的理由清理掉'
    },
    {
      name: 'SheetSetup（新增，一次建好五张表的表头+plain-text 格式）',
      file: '108_SheetSetup.js / 109_Tests_SheetSetup.js',
      status: 'Tested',
      note: '回应 115_TruthWriter.js 原本留的「建表/迁移是另一个还没写的关注点（ensureSheetSchema_ 风格）」。栏位定义直接引用各自来源文件的 *_COLUMNS 常数（单一事实来源，不复制）；ID/日期字符串栏位强制 plain-text 格式，防止 Sheets 静默转成日期序数值。手动执行入口 setupComplianceOsSheets()（不带下划线，跟 runAllXTests() 系列同惯例，要出现在编辑器下拉菜单）。⚠️ SHEET_SCHEMAS_ 原本写成文件顶层就求值的阵列，字母序排在 110/130/140/150（定义各 *_COLUMNS 常数的文件）前面会读到 undefined——改成惰性函数 buildSheetSchemas_()。13 项测试通过'
    },
    {
      name: 'GAS Load Simulation（新增，整个专案照 GAS 载入方式跑一次）',
      file: '195_Tests_GasLoadSimulation.js',
      status: 'Tested',
      note: '跟其他 NN_Tests 不同维度：不测某个模块的行为，测「把所有正式代码档案按文件名字母序串起来，在干净的 VM context 里跑一次载入（不呼叫任何函式）会不会出事」——Node 的 require 是显式指定顺序，测不出 GAS 单一共享 scope 的载入模型本身的问题。这次新增 LLM extraction 时连续抓到两个这类问题（108 的顶层求值、112 的顶层急着建构 realLLMExtractor_）后才正式补上，PropertiesService 刻意模拟成「存在但没有任何 Script Property」（风险最高的真实状态）。另外附带检查有没有重复宣告的顶层 function 名字（不会报错，但会静默互相覆盖）。2 项测试通过'
    },
    {
      name: 'Contract Tests（新增测试类别，采纳评审建议）',
      file: '190_Tests_Contracts.js',
      status: 'Tested',
      note: '跟 NN_Tests_<FeatureId>.js 不同维度：测的是"所有实现某 Adapter 契约的东西形状对不对"（ParserRegistry 里每个 Parser 是否满足 DocumentParser 的 4 个方法、每个 createXxx_() 工厂是否产出文档承诺的方法），不是"这个模块自己的行为对不对"。Real Data Pilot 新增 SheetReader 的契约检查（readAll）'
    },
    {
      name: 'AI Extraction / 差异解释',
      file: '906_AI_Integration.js',
      status: 'Designed',
      note: '按 Blueprint BP-3，Intelligence 是 Tier 3（生态级无证据），故意只留 name+purpose，不展开'
    }
  ],

  /**
   * §2 Architecture-Layers-to-Blueprint 映射（本项目自己做，不进 Blueprint 本身）。
   */
  blueprintMapping: {
    governance: '指针见 900_Constitution.js',
    foundation: {
      schema: 'Documents / Parsed_Statements / Reconciliation_Log / Verified_Income / Compliance_Calendar（Blueprint Tier 1）',
      eventDefinitions: 'INCOME_VERIFIED / COMPLIANCE_DUE_SOON 等（Blueprint Tier 1）',
      identity: 'CMP- 命名空间 ID 规则（Blueprint Tier 2）',
      versioning: 'Parsed_Statements 从不覆盖（Blueprint Tier 1）'
    },
    runtime: {
      decision: 'Reconciliation 的容差判断（Blueprint Tier 2）',
      event: '事件发布（Blueprint Tier 1）',
      projection: 'Verified_Income（Blueprint Tier 2）',
      query: 'Finance/Reminder 读取（Blueprint Tier 1）'
    },
    intelligence: '2026-08-21 前：全部 Tier 3，按 BP-3 预留不展开。2026-08-21 起：LLM Extraction（127_LLMExtractor.js）是第一个真的落地的 Intelligence 能力——但边界明确（LLM 是 Extraction Engine 不是 Truth Engine），deterministic validation（125_ExtractionValidation.js）才是真正的 acceptance gate，不是 LLM 自己的 confidence。差异解释（906）仍然是 Tier 3 预留，不受影响',
    integration: {
      bridge: 'CoreBridge（比现有生态 Tier 2 的「共用 Sheet 非正式桥接」更结构化的事件契约）',
      importExport: 'Document Import Engine + Operator Console——生态级 Tier 3（目前唯一的具体实现），Real Data Pilot（v0.7）之前只是「以后会是第一个」，现在是真的第一个跑 Drive 扫描 + 批次汇入的实现',
      externalSystems: 'Grab——生态级 Tier 2（"常被提到但没人真正对接过"），GrabWeeklyParser 是第一次真正处理 Grab 数据'
    },
    testing: '122_Tests_GrabWeeklyParser.js / 124_Tests_RiderOSAdapter.js，跟 NN_Tests_<FeatureId>.js + runAllXTests() 惯例一致（Blueprint Tier 1）',
    crossCutting: {
      observability: '目前只有 Audit_Log / Compliance_Events_Log 两张表，比 Rider OS 已验证的 5 文件 Observability 模式薄——先记录，不在这版展开（EP3）',
      security: '§3.3（治理文档），对应 Blueprint Cross-Cutting Security，生态级 Tier 3 保留，不展开通用方案'
    }
  },

  /** 对照 UEF 默认 Reference Architecture（Truth→State→Event→Service→Observability→Operational Intelligence→Reminder→Intelligence-stub） */
  referenceArchitectureDeviation: {
    reminder: '刻意不在 Compliance OS 内部做 Reminder 层，直接对接既有的 Reminder OS——理由：Reminder OS 已是生态共用服务，重复造一层没有意义'
  }
};

/**
 * Engineering Metrics / Project Health（采纳评审建议新增）。
 * 故意写成"从 modules 算出来的函数"，不是另外手动维护的一组数字——
 * 手动维护的汇总数字会跟 modules 实际内容脱钩、需要两边同步更新，这正是
 * EP4 想避免的那种「可推导却被存成第二份真相」。要看最新数字，呼叫这个
 * 函数，不要抄一份写死的数字到别的地方。
 * @return {{fileCount: number, moduleCount: number, tested: number, designed: number, knownLimitations: string[]}}
 */
function computeComplianceOsEngineeringMetrics_() {
  const modules = COMPLIANCE_OS_ARCHITECTURE.modules;
  const tested = modules.filter((m) => m.status === 'Tested').length;
  const designed = modules.filter((m) => m.status === 'Designed').length;
  const knownLimitations = modules
    .filter((m) => /占位|还没|未确认|Reserved/.test(m.note))
    .map((m) => `${m.name}: ${m.note}`);
  return { moduleCount: modules.length, tested, designed, knownLimitations };
}

if (typeof module !== 'undefined') {
  module.exports = { COMPLIANCE_OS_ARCHITECTURE, computeComplianceOsEngineeringMetrics_ };
}
