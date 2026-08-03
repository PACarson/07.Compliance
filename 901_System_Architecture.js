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
    }
  ],

  pipeline: [
    'Document Import Engine',
    'Document Parsing Engine',
    'Structured Statement Data',
    'Reconciliation Engine',
    'Compliance OS Truth Layer',
    'Event Bus',
    '→ Finance OS (Verified Income) / Reminder OS (Compliance Calendar)'
  ],

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
      note: '真实逻辑：去重、document_id 生成、写入 Documents、真实 SHA-256（Utilities.computeDigest，不是占位）。诚实的缺口：Drive 存档位置、PDF→文字抽取方式都还没确认，目前是呼叫方要提供 originalFileUrl / extractedText，不是这个引擎自己做。processGrabStatement_() 把 Import→Parse→Reconciliation→VerifiedIncome 串成一条链，20 项测试通过，含完整链路 + 重复文件在 Import 阶段就正确短路'
    },
    {
      name: 'Reconciliation Engine',
      file: '130_Reconciliation.js',
      status: 'Tested',
      note: '纯逻辑（reconcileStatement_）+ 编排层（runReconciliationForWeek_，含「两边到齐才跑」）+ 真的透过 TruthWriter 写 Reconciliation_Log；19 项测试通过，含端到端 Auto_Verified / Needs_Review 两条路径'
    },
    {
      name: 'Verified Income 发布',
      file: '140_VerifiedIncome.js',
      status: 'Tested',
      note: 'buildVerifiedIncomeRecord_/writeVerifiedIncome_/publishComplianceEvent_ 都写了并跟 Reconciliation Engine 串起来测过（14+19 项测试）；publishComplianceEvent_ 仍是占位——EventBus 真实调用方式还没确认'
    },
    {
      name: 'Compliance Calendar',
      file: '150_ComplianceCalendar.js',
      status: 'Designed',
      note: 'Schema 已按 EP4 重新设计（status 不存），还没写代码'
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

if (typeof module !== 'undefined') {
  module.exports = { COMPLIANCE_OS_ARCHITECTURE };
}
