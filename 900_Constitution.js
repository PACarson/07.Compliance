/**
 * 900_Constitution.js
 * Compliance OS — Constitution（Compliance OS 自己的「Engineering Framework」）
 *
 * 定位：这不是重写 UEF——按 BP-1，Governance 节点只指向 UEF，不复制内容。
 * 这个文件放的是「UEF 的抽象原则，具体到 Compliance OS 这个 domain 要怎么
 * 落地」，以及 Compliance OS 自己独有、UEF 没有涵盖的规则。跟 Rider OS 自己
 * 的 00_Project_Constitution.txt / 00_Business_Rules.txt 是同一个角色。
 *
 * 治理指针：受 Universal Engineering Framework v1.5 与
 * Universal Domain OS Blueprint v1.2 约束；这两份文档本身的内容不在这里
 * 复制第二份（EP2：文档一致性，重复副本只会造成漂移）。
 */

var COMPLIANCE_OS_CONSTITUTION = {
  domain: 'Compliance OS',
  constitutionVersion: '1.1',
  governedBy: { uef: 'v1.5', blueprint: 'v1.2' },

  /**
   * 变更记录——只记「这份文件本身」的变更，不是 901 那份记录代码/测试状态的
   * changelog（两份文件职责不同，901 的 changelog 不应该跟着搬过来）。
   */
  changelog: [
    {
      date: '2026-08-21',
      change: 'CMP-CR5 补完整（原本只写了 IDE 下拉选单那个理由，漏了 google.script.run 看不到带下划线后缀函数这件——2026-08-20 真实 GAS 环境踩过）；新增 CMP-P14（AI/LLM 产生的候选事实必须先过独立于该 AI 本身的 deterministic validation 才能变成 Truth）。两条都是「真实运行暴露出 Constitution 层没说完整/没覆盖到的东西」，不是重新设计——900/901 其余内容不动，Architecture Freeze 维持',
      approvedBy: 'Steven'
    },
    {
      date: '2026-08-25',
      change: 'Daily Order-Level Allocation（跨月 Grab Statement 逐日/逐单归属，取代整周粗颗粒的 Needs_Allocation）Phase 1-4 设计与实作完成，新增 ADR-004（四层数据模型）、ADR-005（Butiran Tempahan 抽取方式：Gemini Extraction Adapter + 确定性验证，取代 Phase 2 一度倾向的纯确定性文字解析）、CMP-CR6（Sekaligus 合法性判准，2026-08-25 用真实 W33 PDF 原件核对过）。142/143（Daily Order Allocation 引擎+测试）为新文件；125/126、127/128 为既有文件的加法性扩充（新增 Butiran Tempahan 相关的 schema/validation/extraction 函数，既有 statement 层级功能一行未改）。140/150/160/108/110/170/900/901 本身、Architecture Freeze、Governance 既有内容均未变动或重开——这是 Freeze 既有例外条款（ADR-003 建立的先例：真实数据/真实需求可以在不重开整层设计的前提下新增 ADR）的延续，不是第二次重新讨论 Freeze 本身。⚠️ 明确未完成：ADR-004/ADR-005 的代码在 Node 模拟环境全部测试通过，但从未对真实 Gemini API 或真实 GAS runtime 验证过（这个开发环境本身没有到 Google API 的网络路由、也没有真的 GAS 环境）——status 标注刻意写成「Decided（设计与方向）＋未验证（真实环境）」两段式，不是「Production」，完整清单见同一天的 checkpoint/handoff 文件',
      approvedBy: 'Steven'
    },
    {
      date: '2026-09-02',
      change: 'ADR-005 的 status 更新，不是新决定：Steven 要求暂停 Gemini 工作、专门用真实 W01/W33 PDF 测试「deterministic 抽取能否取代 Gemini」这个 ADR-005 从设计时就存在、但从未真的拿证据核对过的问题——结论是维持原决定（Gemini primary），但这次是真实证据支撑，不是延续 Phase 4 时的方向性判断。同一段时间内，127/142 也第一次真的打通了真实 Gemini API 调用（Gate 1 通过，见 901 verificationHistory），但完整链路（Gate 2）跟要不要正式换预设 model 都还没有结论，status 字段刻意保留这个「部分验证、部分待定」的两段式，不写成整条链路已验证。900/901 其余内容、Architecture Freeze 均未变动或重开',
      approvedBy: 'Steven'
    }
  ],

  /** Domain Ownership（对应 UEF Domain Ownership 检查 / ADR-000） */
  scope: {
    owns: [
      '官方 / 法定收入证明（Grab/Foodpanda/... Statement、未来 EA Form）',
      '税务（LHDN、PCB、申报、减免、缴税）',
      '社会保障（EPF、SOCSO、EIS）',
      '其他政府事项（路税、JPJ、身份证件、护照、保险续保）'
    ],
    excludes: [
      '财富管理、净值、目标（Finance OS 的范围）',
      '日常营运、接单、油耗、保养（Rider OS 的范围）',
      '通知发送的时机与渠道（Reminder OS 的范围，Compliance OS 只决定内容）'
    ]
  },

  /**
   * CMP-P：Compliance OS 自己的原则。
   * 有些是 UEF 抽象原则在这个 domain 的具体落地（标注对应的 UEF 条目），
   * 有些是 Compliance OS 独有、UEF 没有涵盖的规则。
   */
  principles: [
    {
      id: 'CMP-P1',
      name: 'Official Truth Principle',
      statement:
        '所有官方 / 法定文件只能由 Compliance OS 解析并发布 Verified Result；其他 Domain 不得自行解析这些文件，也不得自行推导一个「官方性质」的结果——只能引用 Compliance OS 发布的 Verified Result。其他 Domain 用 Verified Result 做自己的下游计算不受此限制。',
      adr: 'ADR-002'
    },
    {
      id: 'CMP-P2',
      name: '收入来源对下游不透明',
      statement:
        'Finance OS 读到的 Verified Income 事件里，source 字段固定是 "Compliance OS"，不是 "Grab"／"Foodpanda" 等具体平台——即使未来收入来源改变，Finance OS 的代码完全不用改。'
    },
    {
      id: 'CMP-P3',
      name: 'Parser 可插拔，不写死',
      statement:
        '任何新的官方文件来源，只需要新增一个实现 DocumentParser 契约的 Parser 并自我注册；ParserRegistry、Reconciliation Engine、Event Bus、Finance OS 契约都不需要因为新增来源而修改。'
    },
    {
      id: 'CMP-P4',
      name: '原始文件不可变，版本只增不改',
      statement:
        '原始官方文件一经导入不可修改或删除；重新解析产生新版本的 Parsed_Statements，旧版本保留、标记 Superseded，从不覆盖。'
    },
    {
      id: 'CMP-P5',
      name: '陈述值优先于计算值',
      statement:
        '官方文件上写的数字（陈述值）永远是权威来源；Compliance OS 自己重新算一遍的结果只是一致性检查（_consistency_check），检查有差异时要显性标注出来，绝不能用计算值静默覆盖陈述值。'
    },
    {
      id: 'CMP-P6',
      name: '可推导的状态不存储',
      statement:
        '任何能从其他已存字段 + 当下时间完整推导出来的状态，查询时即时算，不另外写一个字段维护（例如 Compliance_Calendar 的 Upcoming/Due_Soon/Overdue）。只有真正的事实（例如 completed_at）才存储。',
      uefRef: 'EP4'
    },
    {
      id: 'CMP-P7',
      name: '外部依赖收拢成单一 Adapter',
      statement:
        'Domain 逻辑（Reconciliation Engine 等）不直接碰外部或共享基础设施（Rider OS、Event Bus）；一律透过唯一一个 Adapter 函数（RiderOSAdapter、publishComplianceEvent_()）。依赖还没确认时，Adapter 内部先放占位 + log，不猜签名硬上。',
      uefRef: 'UCR7'
    },
    {
      id: 'CMP-P8',
      name: '多页官方文件的字段搜索要限定范围',
      statement:
        '官方文件常见在后段（例如术语表）重新提到同样的字词；在文件里找一个字段的值时，要先界定所属区块的边界（例如 Ringkasan/Butiran pendapatan 之间），只在该区块内搜索，不对整份文件做全文搜索，避免抓到无关段落的诱饵数字。',
      note: '来自 GrabWeeklyParser 实作与测试中发现的真实风险，不是假设性的'
    },
    {
      id: 'CMP-P9',
      name: '金额精度统一',
      statement: '所有金额一律四舍五入到小数点后 2 位（MYR 最小单位），全流程（Parser、Reconciliation、Event）一致，不在中间步骤累积浮点误差。'
    },
    {
      id: 'CMP-P10',
      name: '异常要显性，不能静默',
      statement:
        '解析失败或对账差异超出容差，必须落到一个明确状态（Failed_Parse / Needs_Review），绝不能默默用默认值、跳过，或悄悄发布一个可能是错的 Verified Income。'
    },
    {
      id: 'CMP-P11',
      name: '平台稳定 ID 优先于路径/显示名',
      statement:
        '涉及外部平台（目前是 Google Drive）的记录，一律保存平台自己的稳定 ID（drive_file_id）当权威引用；路径、显示名这类可能因为整理/重新命名而改变的东西，只当人类可读的缓存，明确标注不是真相来源，需要准确信息时应该向平台重新查询。这是 EP4（Fact vs Projection）在这个 domain 的具体应用；目前只有 Compliance OS 一个实例，还没到能推广成生态规则的证据门槛（BP-2/UEF §0.9），先记在这里。'
    },
    {
      id: 'CMP-P12',
      name: 'Reconciliation is an annotation, not a publication gate',
      statement:
        'Verified Income 的发布只取决于官方文件是否解析成功并通过现有验证逻辑；Rider OS 对账（或未来任何其他交叉验证来源）只能在事后为已发布的记录附加状态注解（reconciliation_status：Not_Performed / Matched / Discrepancy_Flagged），永远不能决定该记录发不发布或延迟发布，Discrepancy_Flagged 也不得撤销或阻断已经 Verified 的官方收入。跟 CMP-P5（陈述值优先于计算值）是同一种「检查用来标注、不用来否决」的模式，只是这次的检查来源在 Compliance OS 外部（Rider OS）而不是内部重新计算。',
      adr: 'ADR-003'
    },
    {
      id: 'CMP-P13',
      name: '发布类操作必须幂等——同一个身份只能被公开写入一次',
      statement:
        '任何「公开发布一笔真相记录」的操作（目前是 Verified Income，income_id 当身份），重复触发（使用者重复点击、批次汇入重跑、Retry 单一文件）必须侦测到已经存在就跳过，不能因为操作重复执行就产生第二笔记录。这不是靠呼叫方自己小心，是发布函数本身在写入前检查一次（Operator Console 的 Real Data Pilot 阶段，consoleBatchImport_/consoleRetryFile_ 都可能对同一份文件重复触发）。目前只有 Verified Income 一个实例，还没到能推广成生态规则的证据门槛（BP-2/UEF §0.9），先记在这里；如果未来其他 Domain OS 也出现「批次/重试可能重复触发同一次发布」的场景，这条可以是候选。'
    },
    {
      id: 'CMP-P14',
      name: 'AI/LLM 产生的候选事实，永远不能自己授权自己成为 Truth',
      statement:
        '任何由 AI/LLM 产生的候选事实——不限于 LLM Extraction，未来的 AI 分类、AI 对账差异解释、AI 文件判读、AI 生成的合规建议等都受这条约束——在成为任何 Verified 记录之前，必须先通过一层独立于该 AI/LLM 本身的 deterministic validation（例如 schema、期间、金额一致性）。「独立」是这条的关键：验证逻辑不能由产生候选的同一个 AI/provider 执行或背书——不能是另一个 AI 说「我检查过了，没问题」就算数，必须是不带任何概率性判断的确定性代码。AI 自己回传的 confidence 或其他不确定性讯号只能记录成 metadata，不能取代这层验证、也不能成为发布与否的判断依据。\n\n这条不要求人工审核每一笔 AI 产生的候选——那会让自动化失去意义，也不是这条的目的。正确的形状是：AI Candidate → Deterministic Validation → 通过就自动发布成 Verified，没通过就自动落到明确的失败状态（CMP-P10「异常要显性」在「候选是 AI 产生的」这个情境下的具体延伸）。人只需要处理验证没通过、被明确标注出来的那一小部分，不是每一笔都要看。\n\n906_AI_Integration.js 是 Compliance OS 第一次真的有 AI/LLM 组件进入 Truth-producing 主线（127_LLMExtractor.js），2026-08-21 用真实数据验证过 AI Candidate → Deterministic Validation → Verified 这条链路，也验证过验证没通过时正确落到 Needs_Review、不会被静默接受。'
    }
  ],

  /**
   * CMP-CR：Compliance OS 自己的编码规则，建立在 UEF 的 UCR1-7 之上，
   * 是这个 domain 特有、UEF 没有细到这个程度的规则。
   */
  codingRules: [
    {
      id: 'CMP-CR1',
      statement:
        '每个 DocumentParser 实现必须提供 canParse/parse/parserId/schemaVersion 四个方法，并在自己的文件底部调用 ParserRegistry.register(new XxxParser()) 自我注册；不允许在任何中心文件里写死 Parser 清单。'
    },
    {
      id: 'CMP-CR2',
      statement:
        '从官方文件文字里抽取金额一律透过共用的 findAmountAfterLabel_()（或未来的等价工具函数），找不到就抛错，不允许任何 Parser 自己另起一套抽取逻辑或给默认值 0。'
    },
    {
      id: 'CMP-CR3',
      statement: '每个 Parser 的输出必须带 _consistency_check，比对文件陈述的小计跟独立重新算一遍的差异——不是可选项。'
    },
    {
      id: 'CMP-CR4',
      statement:
        '非英文来源文件的日期解析，一律先拆成整数年/月/日，再用 Date.UTC() 组装；不允许把日期字符串直接交给 Date 构造函数（UCR4 在这个 domain 的具体落地——马来文/未来其他语言的月份名对照表必须显式维护，不能依赖 Date.parse() 猜测）。'
    },
    {
      id: 'CMP-CR5',
      statement:
        '私有函数命名用 GAS 平台惯例的后缀下划线 functionName_()，不是 UEF 原文字面的前缀——这是 Language Convention Override（见治理文档）在 Compliance OS 里的具体声明，理由是两个独立的平台事实：(1) 后缀下划线在 Apps Script 编辑器里会隐藏于「选取要执行的函数」下拉选单；(2) google.script.run 看不到、也叫不动带这个后缀的函数（Apps Script 官方文件明载，不是这个专案自己的假设或某次 bug 的临时补丁）。第二点的直接后果：任何要给 HTMLService 前端（google.script.run）当入口呼叫的 server 函数，一律不能把 xxx_() 直接暴露出去，必须额外提供一个不带下划线的公开函数当薄壳，内部呼叫真正的 xxx_() 实作——内部逻辑永远留在 _ 版本里（继续享有隐藏于下拉选单、可以放心重构的好处），公开层只做参数原样转发，不重复任何逻辑。2026-08-20 在真实 GAS 环境证实过：漏掉这层公开 wrapper，前端会卡在「呼叫中」不会有任何回应，不是快速报错，容易被误判成别的问题。'
    },
    {
      id: 'CMP-CR6',
      statement:
        'Grab Weekly Statement 的 "Pesanan Sekaligus"（合并订单）行，合法条件是至少 1 个可识别订单号，不是至少 2 个——2026-08-25 用真实 2026-W33 PDF 原件第 14 页肉眼核对过：同一页里，一笔 Sekaligus 只印 1 个订单号、没有 "and N" 说明，金额仍跟当日 Grab 印出的 subtotal 精确对上，紧邻着一笔 2 个订单号的 Sekaligus 跟一笔带 "and N" 的 Sekaligus 可以直接对照——这是 Grab 模板本身的真实行为，不是解析缺陷，因此不能拿「订单号数量」当合法性判准，只能拿「至少有 1 个可识别订单号，或者有 "and N" 说明」当判准；真正一个订单号都识别不出来的情况才是 Needs_Review，不是订单号数量本身。'
    }
  ],

  /**
   * 已记录的 ADR，完整内容见治理文档 compliance-os-governance-draft.md
   * §1/§3.2/§4.2/§2.5/§2.7/§2.8——909_ADR.js 从未真的建过（一直只是文件地图里的
   * 占位引用），这里改指向实际存在、一直在用的地方，不是新的决定，只是
   * 修正一个从没被抓到的旧指针（跟本次 ADR-003 本身无关，顺手修的）。
   */
  adrs: [
    { id: 'ADR-000', title: '为什么 Compliance OS 是独立 GAS 项目', status: 'Decided' },
    { id: 'ADR-001', title: 'Reconciliation Engine 如何读取 Rider OS 数据', status: 'Decided' },
    { id: 'ADR-002', title: 'Official Truth Principle', status: 'Decided' },
    { id: 'ADR-003', title: 'Reconciliation 与 Verified Income 解耦（Reconciliation is an annotation, not a publication gate）', status: 'Decided' },
    { id: 'ADR-004', title: 'Daily Order-Level Allocation：四层数据模型（Order_Allocation / Non_Order_Income_Allocation / Daily_Allocation / Monthly_Allocation）与 Fact/Projection 边界', status: 'Decided（架构与设计层级；142/143 已实作并通过 Node 测试；未接入 108/110/170，未在真实 GAS 验证——见 checkpoint 文件）' },
    { id: 'ADR-005', title: 'Butiran Tempahan（订单层级）PDF 抽取方式：Gemini 作为 Extraction Adapter + 142 确定性验证，取代原本 Phase 2 倾向的纯确定性文字解析', status: 'Decided，且这个方向本身已用真实证据重新核对过一次（2026-08-29～09-02，见 checkpoint）：Steven 明确要求先暂停 Gemini 工作、专门测试「deterministic 抽取能不能取代 Gemini」这个问题本身——真实 W01/W33 PDF 用坐标级文字抽取测出 319/324 笔可精确重建，证明确定性解析逻辑本身没问题；但唯一能在真实 GAS 产生文字的原生管道（Drive OCR，`{ocr:true}`）真的跑过一次后，出现跨订单边界的错位、没有单一规则能救回——这是这条 ADR 从未有过的、针对「反方案」本身的真实环境证据，结论是维持 Gemini primary，deterministic 收窄到 checksum 验证层。另外，127/125/142 现在为止最完整的真实环境证据：Gate 1（真实 Gemini API 呼叫，完全未改的既有 schema/prompt）首次成功——finishReason=STOP、173 笔、无 schema mismatch；用的是 gemini-3.5-flash（默认 gemini-3.7-flash 连续 3 次真实呼叫都是 503，诊断为该模型刚上市不久、需求过载，非代码缺陷）。Gate 2（125/142 完整链路的 checksum 结果）因为测试脚本自身的 GAS 执行时间预算问题还没跑完，是否要正式改预设 model 尚未决定——完整证据与「决定 vs 尚待确认」的区分见 2026-09-02 checkpoint 文件，不要把 Gate 1 通过直接当成整条链路已验证' }
  ]
};

if (typeof module !== 'undefined') {
  module.exports = { COMPLIANCE_OS_CONSTITUTION };
}
