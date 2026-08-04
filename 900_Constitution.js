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
  constitutionVersion: '1.0',
  governedBy: { uef: 'v1.5', blueprint: 'v1.2' },

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
        '私有函数命名用 GAS 平台惯例的后缀下划线 functionName_()，不是 UEF 原文字面的前缀——因为后缀下划线在 Apps Script 里有隐藏于「选取要执行的函数」下拉选单的实际平台好处。这是 Language Convention Override（见治理文档）在 Compliance OS 里的具体声明。'
    }
  ],

  /** 已记录的 ADR，完整内容见治理文档 909_ADR.js（对应 compliance-os-governance-draft.md §1/§3.2/§4.2） */
  adrs: [
    { id: 'ADR-000', title: '为什么 Compliance OS 是独立 GAS 项目', status: 'Decided' },
    { id: 'ADR-001', title: 'Reconciliation Engine 如何读取 Rider OS 数据', status: 'Decided' },
    { id: 'ADR-002', title: 'Official Truth Principle', status: 'Decided' }
  ]
};

if (typeof module !== 'undefined') {
  module.exports = { COMPLIANCE_OS_CONSTITUTION };
}
