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
    }
  ],

  pipeline: [
    'Document Import Engine',
    'Document Parsing Engine',
    'Structured Statement Data',
    'Compliance OS Truth Layer（Verified Income 在此发布——ADR-003，不等 Reconciliation）',
    'Event Bus',
    '→ Finance OS (Verified Income) / Reminder OS (Compliance Calendar)'
  ],
  /** ADR-003（v0.7，已签字）：Reconciliation 不在主线上，是独立、可选、非阻断的旁支——有 Rider OS 数据才跑，跑完只在 Reconciliation_Log 留下 reconciliation_status 注解，从不影响上面主线是否发布 */
  optionalPlugins: ['Reconciliation Engine（对账 Rider OS，见 130_Reconciliation.js）'],

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
      note: '栏位校验 + 加锁写入，5 项测试通过。Sheet 本身的建立/plain-text 格式设置不在它的职责内，还没写'
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
      note: '去重、document_id 生成、真实 SHA-256、Documents 写入都是真实实作。Sheet 存 drive_file_id（权威引用）+ drive_path（人类可读缓存，明确不是真相来源）而不是存 URL；新增建议文件名/目录路径的纯函数（{SOURCE}_{TYPE}_{PERIOD}.pdf，Compliance OS/{source}/{year}/{标签}）。ADR-003（v0.7）：processGrabStatement_() 解析成功先发布 Verified Income，Reconciliation 变成包在 try/catch 里的非阻断次要步骤（就算它丢未预期例外，已发布的 Verified Income 不受影响）；32 项测试通过'
    },
    {
      name: 'DocumentTextExtractor（PDF→文字 Adapter）',
      file: '112_DocumentTextExtractor.js',
      status: 'Tested',
      note: 'UCR7 占位实现，跟 RiderOSAdapter 同一套路——底层要用 Drive OCR 还是 LLM API 都还没定，Adapter 层先确定，之后只换内部实现。3 项测试通过'
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
      note: 'ADR-003（v0.7，Steven 已签字）：buildVerifiedIncomeRecord_/verifyAndPublishIncome_ 不再需要 reconciliationResult——net/amount 直接来自 parsedStatement.summary.weekly_net（陈述值，CMP-P5），解析成功即可发布，不等对账。EventBus 发布仍是 EventPublisher（createEventPublisher_ 工厂 + 注入）占位实现，EventBus 真实调用方式还没确认；15 项测试通过'
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
      note: '纯函数消费 Verified_Income 记录聚合成月度/YTD 汇总，标示 _source: "Projection"，不产生新的 Verified 记录。ISO 周→月份用该周星期四所在月份，已用已知真实样本（2026-W30=2026-07）核对正确。14 项测试通过。可以直接消费历史 Verified_Income 回填，不需要重新解析 PDF'
    },
    {
      name: 'Utils（生产代码共用工具，新增）',
      file: '106_Utils.js',
      status: 'Tested',
      note: '把原本在 130/160 各自重复宣告的 round2_() 收成一份——function 重复宣告不会像 const 那样直接崩溃，但一样是脆弱模式，跟 105_TestUtils.js 同样的理由清理掉'
    },
    {
      name: 'Contract Tests（新增测试类别，采纳评审建议）',
      file: '190_Tests_Contracts.js',
      status: 'Tested',
      note: '跟 NN_Tests_<FeatureId>.js 不同维度：测的是"所有实现某 Adapter 契约的东西形状对不对"（ParserRegistry 里每个 Parser 是否满足 DocumentParser 的 4 个方法、每个 createXxx_() 工厂是否产出文档承诺的方法），不是"这个模块自己的行为对不对"。12 项测试通过'
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
    intelligence: '全部 Tier 3，按 BP-3 预留不展开',
    integration: {
      bridge: 'CoreBridge（比现有生态 Tier 2 的「共用 Sheet 非正式桥接」更结构化的事件契约）',
      importExport: 'Document Import Engine——生态级 Tier 3（无任何实现），Compliance OS 一旦写出代码会是第一个实现',
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
