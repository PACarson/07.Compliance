/**
 * 00_Project_State.gs
 * Personal Life OS — Project State（当前实现进度快照）
 *
 * 这份文件不是设计包原本要求的 10 项之一——README.md「本包的生命周期」
 * 一直说好"实现阶段的具体决定进 00_Project_State.gs"，现在第一次真正
 * 有"状态"可记（代码写完、且在真实环境跑过验收），所以现在建立，跟
 * Carson 既有 Productivity OS 治理体系里的 00_Project_State.gs 是
 * 同一个角色：只记事实快照，不重复论证——论证在 00_ADR.gs。
 *
 * 更新方式：每次 Sprint 交付或 Gate 结果变化时更新，不需要每次代码
 * 小改动都来改这个文件。
 */

// ============================================================
// 一、当前版本
// ============================================================

/**
 *   设计：v5.2（Architecture Freeze，已冻结，见 00_ADR.gs 全部 21 条，
 *   新增 ADR-2026-07-24-021）
 *   实现：Sprint 1（Foundation）Reference Certified；Sprint 3
 *   （Integration）Reference Certified；Sprint 4（AI）Recovery →
 *   Contract Verified，Integration Pending（UI Entry Point 见「九」
 *   已有决定，具体指令/入口设计还没做）；UI Phase 0 Audit 已完成，
 *   Vertical Slice 1（Note→Task）、Slice 2（Task↔Project）均已
 *   Stable（代码 + 真实环境测试 + 真实浏览器验证三者都过），Slice 3
 *   （Project→Workflow，BusinessRule 三层模型）代码已写完，尚未跑
 *   Gate、尚未真实浏览器验证——见「十一」
 *   最后更新：2026-08-18
 */

// ============================================================
// 二、Sprint 1（Foundation）— Reference Certified
// ============================================================

/**
 *   状态：✅ CERTIFIED（2026-07-27，见 00_ADR.gs ADR-2026-07-24-019
 *   Reference Domain Certification 条款）
 *
 *   证据：Carson 在真实生产 Apps Script 环境执行
 *   runSprint1AcceptanceGate()，6/6 测试通过：
 *     ✅ Migration Test
 *     ✅ Existing Data Compatibility Test
 *     ✅ Workflow Test（洗衣流程场景）
 *     ✅ Timeline Integrity Test
 *     ✅ Metadata Traceability Test
 *     ✅ Reference Contract Mock Test
 *   执行时间：2026-07-27 08:43:59–08:45:04（本地时区）
 *
 *   交付范围：Identity（07_IdentityEngine 扩展）、Task（20_TaskEngine
 *   扩展）、Project（新增 27_ProjectEngine）、Workflow（新增
 *   28_WorkflowEngine）、Timeline（10_ProjectionEngine 扩展 + 新增
 *   44_TimelineQueryEngine）、Query（新增 14/16_XxxQueryEngine +
 *   12_TaskQueryEngine 扩展）、Canonical Identity/Lifecycle（新增
 *   45_CanonicalRepresentation）、Schema（15_Setup 扩展 +
 *   11_ProjectionRebuilder 新增 migrateSchemaPersonalLifeOS）、
 *   验收测试（新增 35_Tests_Sprint1Acceptance）。
 *
 *   认证含义（见 ADR-2026-07-24-019 (b)）：Foundation 层模式
 *   （Identity/Task/Project/Workflow/Timeline/Query/Projection）
 *   即日起可被未来 Domain OS（Property OS 等）直接信任、复用，不需要
 *   重新验证这一层的正确性。
 */

// ============================================================
// 三、尚未开始
// ============================================================

/**
 *   Sprint 2（Execution）—— 不属于本项目，属于 Life Execution OS，见
 *   00_Domain_Boundary.gs
 *
 *   （Sprint 4 已移到「八」，不再是"未开始"——Recovery 后 Contract
 *   Verified，Integration 待做）
 */

// ============================================================
// 四、七张新表去掉 LIFE_ 前缀（2026-07-27，ADR-2026-07-24-020）
// ============================================================

/**
 *   LIFE_PROJECTS/LIFE_WORKFLOWS/LIFE_TIMELINE/LIFE_NOTES/
 *   LIFE_REVIEWS/LIFE_BUSINESS_RULES/LIFE_WORKFLOW_TEMPLATES 改为
 *   Projects/Workflows/Timeline/Notes/Reviews/BusinessRules/
 *   WorkflowTemplates（PascalCase，跟既有 Tasks/ActiveTasks 一致）。
 *   已跨约 15 个代码文件 + 10 份设计文档全局替换完成。真实环境需要
 *   先跑 renameSheetsToPascalCase()（11_ProjectionRebuilder.gs）才能
 *   让改名后的代码找到正确的分页。
 */

// ============================================================
// 五、Sprint 3（Integration）—— Reference Certified
// ============================================================

/**
 *   状态：✅ CERTIFIED（2026-08-16 第二次真实运行全部通过，详见「七」；
 *   同 Sprint 1 流程，见 ADR-2026-07-24-019）
 *
 *   交付范围：Note（新增 29_NoteEngine + 17_NoteQueryEngine）、
 *   Review（新增 40_ReviewEngine + 18_ReviewQueryEngine）、
 *   BusinessRule 三层模型（新增 41_BusinessRuleEngine +
 *   19_BusinessRuleQueryEngine，覆盖 capture/deprecate/instantiate/
 *   suggest）、Conversion 双向（新增 42_ConversionEngine，
 *   Task↔Project 双向 + Note→Task/Project/GoalCandidate；
 *   20_TaskEngine/27_ProjectEngine 补上 Sprint 1 时预留但未落地的
 *   markTaskConverted_/createTaskFromConversion_/
 *   checkEligibleForTaskDemotion_/markProjectConvertedToTask_）、
 *   ReminderConnector（新增 43_ReminderConnector）、
 *   10_ProjectionEngine 扩展全部对应投影、验收测试（新增
 *   36_Tests_Sprint3Acceptance，补上 Sprint 1 Gate 明确挪出去的
 *   Business Rule/Workflow Template 场景 + Task⇄Project Test，见
 *   ADR-2026-07-24-019 (c)）。
 *
 *   Note/Review 归属判断（见「三」原有讨论）：Carson 未明确反对，
 *   按已记录的判断纳入 Sprint 3 交付。
 */

// ============================================================
// 六、Sprint 3 Gate 第一次真实运行（2026-07-29）—— 发现并修复两处真实
//     Bug（不是文件同步问题，是代码本身的错误）
// ============================================================

/**
 *   跑分：Note Lifecycle Test ✅、Reminder Connector Smoke Test ✅、
 *   Business Rule Full Cycle Test ❌、Bidirectional Conversion Test ❌
 *   （前一轮"部分文件没同步"的问题已解决——这两个测试能跑起来本身
 *   就证明了那一点）。
 *
 *   Bug 1：BusinessRules / WorkflowTemplates 建表定义（15_Setup.gs）
 *   漏了 identity 列（本设计包 00_Sheets_Structure.gs 也同样漏写）。
 *   后果：DeduplicationEngine 永远找不到已存在的 BusinessRule，第二次
 *   capture 同名规则时会在一个从未真正落盘的"幻影" rule_id 上继续
 *   操作，版本号/FROZEN 判断因此全错。修复：15_Setup.gs 两处建表
 *   定义补上 identity（放在最后一列，不插入中间——中间插入会让已有
 *   数据跟表头错位）；41_BusinessRuleEngine.createBusinessRuleDirect_
 *   补上 identity 字段赋值（原来也漏了）；
 *   11_ProjectionRebuilder.migrateSchemaPersonalLifeOS() 新增两行
 *   _appendMissingColumns_ 调用，修复 Carson 已经建好的旧表。
 *
 *   Bug 2：27_ProjectEngine.checkEligibleForTaskDemotion_ 调用
 *   getProjectsByParent(projectId) 漏了 ProjectQueryEngine. 前缀
 *   （同一文件另一处 archiveProject 里的调用是对的，这里是纯粹的
 *   复制/编写疏漏）。修复：加上前缀。
 *
 *   同时给 36_Tests_Sprint3Acceptance.gs 的
 *   testBusinessRuleFullCycle_ 加了提前 return（原本一个环节失败后
 *   还会继续往下跑，导致真正原因被后面的 JSON.parse 崩溃盖掉）；
 *   testReminderConnectorSmoke_ 加了"创建后查询回来确认真的落盘"的
 *   检查（原来只看 createProject 有没有抛异常，但 EventBus 会吞掉
 *   投影失败，不抛错不等于真的写进表里）。
 *
 *   状态：这一轮修复后的四个文件（15_Setup.gs、
 *   11_ProjectionRebuilder 追加函数、41_BusinessRuleEngine.gs、
 *   27_ProjectEngine.gs）已重新交付，等 Carson 重新跑
 *   runSprint3AcceptanceGate() 确认。
 */

// ============================================================
// 七、Sprint 1 + Sprint 3 Gate 重新运行（2026-08-16）—— 全部通过，
//     「六」的待确认状态解除
// ============================================================

/**
 *   背景：Sprint 4（AI）开发中途会话崩溃、容器重置后，2026-08-14 做了
 *   一次 Recovery + Architecture Audit（见「八」），审计发现「六」记录
 *   的"等 Carson 确认"这一步一直没有被正式确认过（Finding F1）。
 *   2026-08-16 在真实生产 Apps Script 环境把 Sprint 1 和 Sprint 3 两个
 *   Gate 都重新跑了一遍。
 *
 *   Sprint 1 Gate（runSprint1AcceptanceGate()，08:43:40–08:45:01）：
 *   6/6 通过（跟 2026-07-27 那次结果一致，没有回归）。
 *
 *   Sprint 3 Gate（runSprint3AcceptanceGate()，08:47:19–08:48:59）：
 *   4/4 通过（对比「六」记录的第一次真实运行 2/4——Bug 1/Bug 2 的修复
 *   这次得到真实环境验证，不再只是"代码交付了但没确认"）：
 *     ✅ Note Lifecycle Test
 *     ✅ Business Rule Full Cycle Test（过程中 IdempotencyManager 正确
 *        拦截了一次重复创建："BusinessRule 已存在（并发安全），跳过
 *        创建"——这不是失败，是判重机制按设计生效的证据）
 *     ✅ Bidirectional Conversion Test
 *     ✅ Reminder Connector Smoke Test
 *
 *   结论：Sprint 1 与 Sprint 3 均可视为 Reference Certified。「六」
 *   的待确认状态到此解除。
 */

// ============================================================
// 八、Sprint 4（AI）—— Recovery → Contract Verified →
//     Integration Pending（2026-08-14 起，见 ADR-2026-07-24-021）
// ============================================================

/**
 *   背景：Sprint 4 开发中途，执行环境用量耗尽、容器文件系统被重置。
 *   仅 46_AIConnector.gs / 22_PriorityEngine.gs（AI 增量）/
 *   47_AIPlanningEngine.gs 三个文件成功救回；40_ReviewEngine.gs 和
 *   本文件（00_Project_State.gs）的 Sprint 4 修改确认丢失（两者现存
 *   内容均为干净的 Sprint 3 baseline，无残缺痕迹）。
 *
 *   2026-08-14 Recovery + Architecture Audit：核实三个救回文件语法、
 *   依赖、契约、引用的治理依据（ADR-009、Architecture Principle 9、
 *   Domain Boundary、workflow_shape 字段名）均真实准确，未发现 P0
 *   问题。审计中一处初判为"新架构例外"的问题（47→17_NoteQueryEngine）
 *   经进一步核实，确认属于 40/41 已有的 Domain→QueryEngine 常规读取
 *   模式，不是新例外，详见 ADR-2026-07-24-021。
 *
 *   Governance Registration（2026-08-14）：00_File_Map.gs、
 *   00_Module_Responsibility.gs 补录三个文件；00_Known_Limitations.gs
 *   新增「四」，把三个新 AI 函数记为 Internal Capability, Not Yet
 *   Exposed（跟既有 suggestPriority() 先例同一处理方式，不是遗漏）。
 *
 *   Contract-level Tests（2026-08-16 真实环境运行，
 *   37_Tests_AIEngines.gs）：12/12 通过——覆盖 AI 合法/非法/缺字段
 *   响应、AIConnector 报错原样传播、46 自身对非 200 响应与 ```json
 *   代码块的处理。
 *
 *   当前状态：Contract Verified、真实环境 Unit 级测试通过。仍然
 *   Integration Pending——没有任何 Telegram 或其它入口能触达这三个
 *   AI 函数，也没有 Integration/Failure/Regression Tests 覆盖"人类
 *   确认后走 27/28/20 创建实体"这条完整链路（这条链路本身也还不
 *   存在）。指令/入口设计留给「九」UI Phase 决定，不在 Sprint 4
 *   范围内单独仓促决定。
 */

// ============================================================
// 九、UI Phase 0（Architecture Audit）—— 2026-08-16 启动
// ============================================================

/**
 *   Sprint 1、Sprint 3 均已 Certified，Sprint 4 三个 AI 文件 Contract
 *   Verified 之后，Carson 决定先做 UI，而不是先补 Telegram 指令层——
 *   方向是 Google Apps Script HtmlService Web App（responsive，
 *   desktop/tablet/mobile browser），明确排除 Telegram Command UI
 *   作为第一阶段方案。
 *
 *   Phase 0 范围：只做 Architecture Audit，不写任何 UI 代码。先验证
 *   Note → Task 这一个 Vertical Slice 能不能走通 UI → Command/Engine →
 *   Event → Projection → UI 完整闭环，其余（Task→Project、
 *   Project→Workflow→Task、Priority+AI Recommendation）留到 Slice 1
 *   稳定之后。
 *
 *   状态：Phase 0 Audit 完成（UI_Architecture_Audit_Phase0.md）。部署
 *   位置决定：Option A——UI 归属并部署在 Personal Life OS 自己项目里，
 *   不放 Personal AI Core（避免过早引入跨项目复杂度，Core 保留为 AI
 *   Infrastructure / Coordination Layer，Personal Life OS 通过既有
 *   approved 集成机制调用它，不是反过来）。身份决定：核实过
 *   07_IdentityEngine.gs 只是内容去重哈希生成器，没有 Actor/User
 *   Identity 概念——不复用 Telegram chatId 当 Web Identity，改用
 *   Session.getEffectiveUser().getEmail() 作为 decision_owner；chat_id
 *   参数位继续传真实 SecureConfig 'TELEGRAM_CHAT_ID'（因为
 *   03_Output.sendMessage/43_ReminderConnector 把 chat_id 当真实
 *   Telegram 投递地址用，混入非 Telegram 值会导致提醒静默送不出去——
 *   这是核实过的真实风险）。
 *
 *   Slice 1（Note → Task）代码已写完：50_UIBridge.gs（3 个 Public API
 *   + doGet 入口）+ ui_index.html（Notes 面板，其余导航项禁用/标 soon）
 *   + 38_Tests_UIBridge.gs（8 个 Positive/Negative/Integrity 测试）。
 *
 *   2026-08-16 第一次真实环境跑 38_Tests_UIBridge：7/8 通过，
 *   testUIBridge_ConvertNoteToTask_Success_ 失败——发现一个既有 Bug（不
 *   在这次新写的文件里）：42_ConversionEngine.convertNoteToTask 内部
 *   拼 TaskEngine.createTask 的 meta 时用的是写死的对象，没有转发
 *   decision_owner，转换出来的 Task 会静默丢失调用方传入的
 *   decision_owner、回退成 chat_id。已修复（补一行字段转发，不影响
 *   其它调用方的既有 fallback 行为），2026-08-16 重新跑
 *   38_Tests_UIBridge：8/8 通过。这处修改碰的是 Sprint 3 已 Certified
 *   的文件，建议之后找机会重新跑一次 Sprint 3 Gate 确认没有回归（目前
 *   还没有专门为这一处改动重新跑过，只跑了 UI Bridge 自己的 Gate）。
 *   同一 Bug 模式在 convertTaskToProject 里也存在，Slice 2 用到时再
 *   处理，这次没动。
 *
 *   Carson 手动通过真实浏览器界面测试时曾报告：第 1 条 Note 转换正常
 *   （Sheet 里有对应 Task），第 2、3 条转换后 UI 显示完成，但 Sheet
 *   里没看到对应 Task 行。2026-08-16 Carson 确认这个疑似问题已解决
 *   （具体原因未展开说明，按已解决处理，不重新展开排查）。
 *
 *   治理文档已补齐：00_File_Map.gs「二」「三」、
 *   00_Module_Responsibility.gs「十四」、00_Data_Ownership.gs「六」。
 *
 *   状态：Slice 1（Note → Task）Stable——Bridge 层 Contract Verified
 *   （8/8，真实环境），真实浏览器手动验证通过，此前的未确认项已由
 *   Carson 确认解决。
 */

// ============================================================
// 十、UI Phase 0 → Slice 2（Task ↔ Project，2026-08-16）
// ============================================================

/**
 *   代码已写完：50_UIBridge.gs 新增 4 个函数
 *   （ui_getConvertibleTasks/ui_getActiveProjects/
 *   ui_convertTaskToProject/ui_convertProjectToTask）；ui_index.html
 *   加了 Tasks/Projects 两个面板 + 面板切换逻辑；
 *   38_Tests_UIBridge.gs 新增 7 个测试（含专门测 ADR-2026-07-24-015
 *   降级前置校验的两个 Integrity Test：Sub-Project 未处理 / 未完成
 *   Task 未处理）。
 *
 *   顺手修了 convertTaskToProject 里同一个 decision_owner 不转发的
 *   Bug（Slice 1 那次在 convertNoteToTask 发现的同一模式，这次没有
 *   等测试再发现一次，直接改）。
 *
 *   一个已知、这次没有修的限制：Project→Task 方向
 *   （TaskEngine.createTaskFromConversion_）的字段映射按其自身 JSDoc
 *   明确是"预留，不接受调用方覆盖"，decision_owner 固定 fallback 成
 *   chat_id，跟另外两个方向不对称。没有动它——那是它自己文档里说好
 *   留到以后再决定的行为，不是这次 Slice 2 该顺手改的范围。
 *
 *   状态：Slice 2（Task ↔ Project）Stable——Bridge 层 Contract Verified
 *   （15/15，真实环境，Slice 1+2 一起重跑无回归），2026-08-18 真实
 *   浏览器三个场景全部确认：Task→Project 卡片即时迁移；Project→Task
 *   空项目降级顺畅；Project→Task 受阻项目暖色提示清晰、不跟真实报错
 *   混淆。Vertical Slice 3（Project → Workflow → Task，含 Business
 *   Rule → Workflow Template → Workflow Instance 三层）开始，先做
 *   研究，再动代码——Carson 原文档特别强调这三层"不能混淆"，值得比
 *   Slice 1/2 多花一点时间先把机制看清楚。
 */

// ============================================================
// 十一、UI Phase 0 → Slice 3（Project → Workflow → Task，2026-08-18）
// ============================================================

/**
 *   研究先行确认了三层模型的准确机制（41_BusinessRuleEngine.gs 头部
 *   注释 + captureAsWorkflowTemplate/instantiateFromTemplate 源码）：
 *   BusinessRule（顶层分类）1-N WorkflowTemplate（版本，capture 时
 *   自动给上一个 ACTIVE 版本打 FROZEN）1-N Workflow Instance（永久
 *   绑定创建时的具体版本）。"Project → Workflow" 不是一次直接转换，
 *   是两个独立动作：Capture（现有 Project 结构"拍照"存成
 *   WorkflowTemplate，不产生 Workflow）+ Instantiate（拿一个
 *   WorkflowTemplate 生成全新的 Project + Workflow + 一批 Task）。
 *
 *   代码已写完：50_UIBridge.gs 新增
 *   ui_captureProjectAsTemplate(projectId, ruleName)、
 *   ui_instantiateTemplate(templateId)；ui_index.html 的 Project 卡片
 *   加了"Capture as Template"（进度式内联表单，输 rule name），
 *   Capture 成功后就地展示"Instantiate Now"；
 *   38_Tests_UIBridge.gs 新增 7 个测试，重点覆盖三层不混淆：同一
 *   Project 重复 Capture 应该在同一个 BusinessRule 下生成新版本
 *   （不是新建一个 BusinessRule）、同一 Template 实例化两次应该产生
 *   两组完全独立的 Project/Workflow/Task（不能互相污染）。
 *
 *   已知缺口，这次没有解决：19_BusinessRuleQueryEngine.gs 没有"列出
 *   全部 Template"的读接口——当前 UI 只支持"刚 Capture 完立刻
 *   Instantiate"，没法做一个"浏览我所有模板、过几天回来用"的面板。
 *   需要时再加一个新的 QueryEngine 读函数，这次范围内没有必要碰。
 *
 *   状态：Written，尚未在真实环境跑 runUIBridgeSlice3Gate()、尚未真实
 *   浏览器点击验证 Capture → Instantiate 这条交互。
 */

// ============================================================
// 十二、Open Items（还没有被处理、也不属于上面任何一个 Sprint/Slice
//      状态行的独立事项，避免开新窗口后被忘记）
// ============================================================

/**
 *   1. 改名成 "Life OS"（Carson 2026-08-14 提出，见 Sprint4_Recovery_
 *      Audit.md「7.7」）：目前只在文档/记忆里采用了新名字，代码库本身
 *      （文件头"Personal Life OS v5.2"、Library Identifier
 *      PersonalLifeOS、GAS 项目名）完全没有动过，Carson 也还没有回复
 *      要不要现在做、什么时候做。建议：等这一整轮 UI Vertical Slice
 *      （1-4）都稳定后再单独做一次 Rename Migration，不要现在顺手做。
 *
 *   2. 19_BusinessRuleQueryEngine.gs 缺"列出全部 Template"的读接口
 *      （见「十一」）——Slice 3 UI 目前只能"刚 Capture 完立刻用"，
 *      不能"浏览所有已存模板"。
 *
 *   3. TaskEngine.createTaskFromConversion_ 的 decision_owner 固定
 *      fallback 成 chat_id，跟 convertNoteToTask/convertTaskToProject
 *      两个方向不对称（见「十」）——该函数自身 JSDoc 说明这是"预留，
 *      暂不接受调用方覆盖"，不建议在没有明确决定"是否要开放覆盖"之前
 *      顺手改掉。
 *
 *   4. Vertical Slice 4（Priority + AI Recommendation）尚未开始——
 *      要用到的三个 AI 函数（22/47 文件里）本身已经 Contract Verified
 *      （见「八」），缺的是这一层的 UI Bridge + 前端，跟 Slice 1-3 是
 *      同一个模式，届时可以直接参照。
 *
 *   5. UI Interaction Layer（Sort/Filter/Edit/Priority/Done/Cancel/
 *      拖拽排序，见「十三」）UI-I6（Manual Drag Reorder）冻结为
 *      BLOCKED_PENDING_ARCHITECTURE_DECISION——排序归属（Task 自己
 *      拥有 / Project-membership 拥有 / View 本地状态，三选一，不允许
 *      发明第四种绕开问题）尚未写成正式 ADR，写完并经 Carson 明确批准
 *      之前不得实现。UI-I1~I5 不受此影响，可独立推进。
 *
 *   6. UI 审计顺带发现两处现有 Domain 缺口，跟 UI-I6 一样先记录、不
 *      在当前范围内顺手补：(a) 28_WorkflowEngine.gs 没有 updateWorkflow
 *      ——create/start/finish/cancel 都有，唯独没有编辑；Slice 3 UI
 *      如果以后要做"编辑 Workflow"会先卡在这里。(b) 全仓库没有任何
 *      order/position/rank/display_order/manual_order 字段（跟「5」
 *      是同一个缺口的两个侧面：UI-I6 要不要做，取决于这个字段最终该
 *      挂在哪一层，而不是先随手加一个）。
 *
 *   7. 22_PriorityEngine.suggestPriorityWithAI_() 目前只在
 *      HIGH/MEDIUM/LOW 三档里选，不含 CRITICAL——UI 的 Priority 下拉
 *      本身四档都有（LOW/MEDIUM/HIGH/CRITICAL，见 TASK_PRIORITIES），
 *      两者不一致；不阻塞 UI-I3，记一笔，之后有空再补 AI 推荐逻辑。
 */

// ============================================================
// 十三、UI Phase 0 → Slice 3 Gate 完整通过 + Task Identity Collision
//      修复（2026-08-19~20）——「十一」的"尚未验证"状态解除
// ============================================================

/**
 *   真实环境第一次跑 runUIBridgeSlice3Gate()（2026-08-19）：5/7 通过，
 *   testUIBridge_InstantiateTwice_NoCrossContamination_ 失败——同一个
 *   WorkflowTemplate 连续 instantiate 两次，Project/Workflow/Task 三个
 *   都被 IdempotencyManager 判定成"已存在"，复用了第一次的记录，而不是
 *   各自产生独立实例。诊断出两处独立碰撞，不是一处：
 *
 *   ① Project 碰撞：41_BusinessRuleEngine.gs instantiateFromTemplate
 *      在 newProjectMeta.title 缺省时，默认标题写死成
 *      '实例化-' + template.template_id——同一模板反复 instantiate，
 *      这串字符逐字节不变，generateProjectIdentity() 算出同一个
 *      identity。修复：默认标题加一个每次调用都不同的短后缀（沿用
 *      本文件内 generateRuleId_/BG- 前缀已经在用的
 *      Utilities.getUuid().split('-')[0].toUpperCase() 写法），
 *      07_IdentityEngine.gs 零改动。Workflow 跟着自动不碰撞（它的
 *      默认标题依赖 project.title，现在天然不同了）。
 *
 *   ② Task 碰撞：generateTaskIdentity() 完全不看 project_id/
 *      workflow_id，两次 instantiate 产生的 Task 标题/due_date/
 *      priority/category 全部相同，仍会被判成重复。这一处涉及
 *      07_IdentityEngine.gs（此前 ADR-2026-07-24-021 的 due_time 改动
 *      明确要求"不改 generateTaskIdentity() 签名，避免牵动本文件及其
 *      单元测试"），所以先做完整的 Identity Impact Audit（见
 *      Identity_Impact_Audit.md，逐条回答 Carson 提出的 8 个问题，
 *      全部有 file:line 证据）才动手改，不是直接改。
 *
 *   审计确认：identity 已被生产数据持久化并依赖（DeduplicationEngine.
 *   findExistingTask 精确匹配）；全仓库只有 4 条业务路径调用
 *   createTaskIfNotExists（聊天捕获/周期任务续期/Note→Task/
 *   Project→Task 转换）+ 2 条会传 workflow_id（instantiateFromTemplate、
 *   28_WorkflowEngine.spawnNextWorkflowIfNeeded——后者是审计过程中
 *   意外发现的同类潜在风险，目前靠 due_date 每轮天然递增侥幸没暴露）；
 *   11_ProjectionRebuilder.gs 只在原始 Event payload 缺 identity 字段
 *   时才在线重算，正常数据重建时直接照抄 payload 里存的值，未来改
 *   公式对历史数据重建结果零影响；因此不需要 migration。
 *
 *   关键发现：scope key 应该用 workflow_id，不是最初设想的
 *   project_id——spawnNextWorkflowIfNeeded 每轮续期复用同一个
 *   project_id，只有 workflow_id 每轮才是新的，按 project_id 分区
 *   分不开这条路径；按 workflow_id 分区，两条风险路径一起覆盖，
 *   且完全不影响 Project→Task 转换（它从不传 workflow_id）。
 *
 *   实施（2026-08-20）：07_IdentityEngine.gs 的 generateTaskIdentity()
 *   加第 7 个可选参数 scopeKey——缺省/空字符串时拼接结果逐字节不变，
 *   仅当非空时才多拼一段进哈希；testIdentity() 新增 3 组断言直接验证
 *   这条兼容性。09_IdempotencyManager.gs 的 createTaskIfNotExists()
 *   把 meta.workflow_id || '' 作为这个新参数传入。
 *   41_BusinessRuleEngine.gs / 28_WorkflowEngine.gs 零改动——两条路径
 *   本来就在 meta 里带 workflow_id，机制自动生效。
 *
 *   状态：runUIBridgeSlice3Gate() 2026-08-20 完整重跑，7/7 全部通过，
 *   含之前失败的 Cross-Contamination 那条。「十一」记录的"Written，
 *   尚未验证"状态到此解除，Slice 3 三层模型（BusinessRule/
 *   WorkflowTemplate/WorkflowInstance）闭环验证完成。
 *
 *   下一步（未完成）：真实浏览器手动走一遍 Capture as Template →
 *   Instantiate Now 这条交互，确认 UI 体验本身（尤其 template name
 *   输入框、Instantiate 成功后 Tasks/Projects 面板是否正确刷新）——
 *   这一步 Gate 测试覆盖不到，只能人工点。
 *
 *   本次同一轮对话里另外定下、但还没开始实现的：批准 UI-I1~I5
 *   （Sort/Filter/Edit Task/Edit Project/Priority/Done/Cancel）独立于
 *   Task Identity 这条线推进；UI-I6（拖拽排序）冻结待 ADR（见「十二」
 *   第 5 条）。三条线互不阻塞，各自独立交付、独立汇报，不合并成一个
 *   "UI Phase 完成"关口。
 */


// ============================================================
// 十四、Track 1 Implementation Preflight + 正式 Regression Gate
//      落地（2026-08-21）——补上「十三」跳过的治理步骤
// ============================================================

/**
 *   背景：「十三」记录的 2026-08-20 实施（07_IdentityEngine.gs +
 *   09_IdempotencyManager.gs）本身是对的，但 Carson 当时的批准消息
 *   明确要求先做一道 Implementation Preflight（4 项确认）、再实施，
 *   且要求正式 regression test 覆盖至少 6 个场景——这两项治理动作在
 *   「十三」的记录里没有独立留痕，只有 testIdentity() 里 3 组
 *   Logger.log 断言，不构成正式、可重复运行、带 pass/fail 汇总的
 *   Gate。本节补上这道治理步骤，不是重做实施。
 *
 *   Implementation Preflight 四项确认结果：
 *   1. scopeKey 缺省时哈希逐字节不变——用一个跟本项目完全独立、从零
 *      实现的参照哈希函数在 Node 沙盒里对 07_IdentityEngine.gs 的
 *      generateTaskIdentity() 跑真实断言（不是读代码猜测），4 组样例
 *      + undefined/''/null 三种缺省写法全部通过。
 *   2. 只有新 context-aware 调用路径传 workflow_id——逐一追踪全仓库
 *      调用 createTaskIfNotExists/createTask 的路径：06_TaskIntentParser
 *      （聊天捕获）、21_RecurringEngine（周期续期）、
 *      42_ConversionEngine 的 convertNoteToTask/convertProjectToTask，
 *      确认均不传 workflow_id（legacy，行为不变）；
 *      41_BusinessRuleEngine.instantiateFromTemplate、
 *      28_WorkflowEngine.spawnNextWorkflowIfNeeded 确认均传
 *      workflow_id（context-aware，符合预期）。
 *   3. ProjectionRebuilder 对 legacy Task identity 不受影响——确认
 *      11_ProjectionRebuilder.gs 的 rebuildTasksProjection() /
 *      rebuildActiveTasksProjection() 均遵循"payload 已带 identity
 *      就直接照抄，只有缺失时才在线重算"的既有约定，逻辑本身零改动。
 *   4.（新发现，不在原始 4 项字面范围内，但属于同一类"确认不会意外
 *      破坏其它行为"）：20_TaskEngine.gs 的 updateTask() 在
 *      identity-affecting 字段变更时会重算 identity，但重算调用漏传
 *      了 scopeKey——这条路径此前（testIdentity 写断言时）没有被
 *      注意到，因为 updateTask() 至今没有真实调用方（见
 *      00_Known_Limitations.gs 二"Current callers: none via
 *      Telegram"），一直是 dead path。但 Track 2 的 UI-I2（Edit Task）
 *      即将成为它第一个真实调用方——一旦上线，编辑 context-aware
 *      Task 的标题/日期/优先级/分类会让它的 identity 退化回不带
 *      scope 的旧公式，重新引入 Track 1 本来要修的碰撞风险，只是
 *      触发时机从"创建时"变成"编辑时"。因为：(a) 与 Track 1 已批准
 *      原则（workflow_id 作为 scope key）完全同类，不是新规则；
 *      (b) 修法是同一个已批准、向后兼容的 scopeKey 参数，纯增量；
 *      (c) Track 2 马上要让这条路径第一次被真实触发；三者叠加，
 *      判断为应该在本轮一并修复，而不是留到 Track 2 上线后才发现。
 *      已修复（20_TaskEngine.gs updateTask()，加一个参数，见该处
 *      2026-08-20 修复注释），且已加回归测试直接验证修复生效
 *      （见下）。此前"07/09 范围内，41/28 不改"的范围声明本身不变——
 *      这一处是范围声明写下时（基于当时审计总结）遗漏的第三个落点，
 *      不是重新打开已批准范围。
 *
 *   正式 Regression Gate：新增 39_Tests_IdentityScopeKey.js，单一入口
 *   runIdentityScopeKeyRegressionGate()，覆盖 Carson 批准消息列出的
 *   6 项 + 上面第 4 点的修复验证，共 6 个测试函数。其中纯函数三项
 *   （legacy unchanged / same-different workflow / no collision with
 *   legacy）已经用独立参照实现在 Node 里跑过真实断言，全部通过；
 *   真实环境三项（repeat instantiate / updateTask 编辑路径 /
 *   ProjectionRebuilder 折叠逻辑）需要 Carson 把改动过的文件（
 *   20_TaskEngine.js、新增的 39_Tests_IdentityScopeKey.js）粘贴进
 *   真实 GAS 项目后跑 runIdentityScopeKeyRegressionGate() 才能拿到
 *   真实 Sheet/EventBus 环境下的 pass/fail——沙盒里没有 Carson 的
 *   真实 Spreadsheet，这一步没法代跑。
 *
 *   状态：Preflight 4 项确认全部通过（含新发现项，已修复）；正式
 *   Regression Gate 已交付，等待 Carson 在真实环境跑一遍确认，随后
 *   建议连带重跑一次 runSprint3AcceptanceGate() 和
 *   runUIBridgeSlice3Gate()（因为改动触碰了 20_TaskEngine.js，
 *   两个既有 Gate 都间接依赖它）。Track 1 视为"实施 + 治理留痕"
 *   双重完成，可以据此推进 Track 2。
 *
 * 【2026-08-21/22 补充，真实环境跑出的结果，撤回上面"双重完成"的
 * 结论】runIdentityScopeKeyRegressionGate() 在真实环境 5/6 通过，
 * testIdentityScope_UpdateTaskPreservesScope_ 失败："编辑后 identity
 * 应该等于新字段+原 workflow_id 重算结果，实际不等"。
 * runSprint3AcceptanceGate()、runUIBridgeSlice3Gate() 两个都 100%
 * 通过，说明这次改动没有破坏任何原本就在跑的东西——问题出在一个此前
 * 从没被真正验证过的路径上，不是一次回归。
 *
 * 排查结论（代码追踪，非猜测）：identity 纯哈希逻辑本身是对的——
 * 6 项里另外 5 项都通过，其中包含直接验证 scopeKey 差异化的两项，
 * 以及绕开真实 Sheet、只用内存事件验证 ProjectionRebuilder 折叠逻辑
 * 的那项。真正可疑的是"从真实 Sheet 里把 workflow_id 读回来"这一步：
 * 05_SheetUtils.upsertRowByKey_（写）和
 * 12_TaskQueryEngine.getTask（读）都是按 Sheet 表头实际有哪些列名
 * 来决定读/写哪些字段（headerMap.hasOwnProperty(key) 才写；
 * getTask 只在 headerMap 里出现的列名才会出现在返回对象上）——
 * 如果 Carson 真实 Tasks 表的表头这一行本来就没有 workflow_id 这一列，
 * 这个字段会被这两处静默丢弃，不报错、不提示。这会是一个在这次改动
 * 之前就存在的数据缺口（Sprint 1 引入 workflow_id 时，如果表头没有
 * 同步加这一列），这次只是第一次有代码路径需要把 workflow_id
 * "写进去再读出来"——之前所有用到 workflow_id 的地方（
 * spawnNextWorkflowIfNeeded/instantiateFromTemplate）都只在创建那一刻
 * 用内存里的值，从来没有真的读回过 Sheet，所以从来没有暴露过这个问题。
 *
 * 需要 Carson 确认（沙盒里没有真实 Spreadsheet，这一步没法代查）：
 * Tasks 表的表头第一行，是否真的存在一列叫 workflow_id。如果确认
 * 缺失，这本身可能是一个比这次改动范围更大的问题——同一批 Sprint 1
 * 字段（project_id/sequence_index/parent_task_id/
 * depends_on_task_ids/branch_group/branch_resolution_policy/
 * source_project_id/十一个 Metadata 字段）会不会也有同样的表头缺口，
 * 值得一并核实，不只是补 workflow_id 一列。Track 1 的核心哈希逻辑
 * 判定正确，但这一条编辑路径回归测试的真实环境验证目前是"失败，
 * 原因指向环境/数据问题，不是这次代码逻辑本身"，不算完成，等 Carson
 * 确认表头情况后再决定怎么修（补表头列，还是要不要顺带给
 * upsertRowByKey_/getTask 加一条"写入了却因为表头缺列被静默丢弃"的
 * 提示，这两种修法影响面不一样，不该我自己替 Carson 决定）。
 */


// ============================================================
// 十五、Track 2 — UI-I1~I5 落地（2026-08-21）
// ============================================================

/**
 *   范围：Sort+Filter（I1）、Edit Task/Edit Project（I2）、Priority（I3）、
 *   Done（I4）、Cancel（I5），独立于 Track 1 Identity 那条线（见「十四」）。
 *
 *   50_UIBridge.gs 新增 7 个函数：ui_updateTask、ui_updateProject、
 *   ui_suggestPriority、ui_completeTask、ui_cancelTask、
 *   ui_completeProject、ui_cancelProject；ui_getConvertibleTasks/
 *   ui_getActiveProjects 扩展了一个可选 filters 前置参数（向后兼容，
 *   唯一真实调用方 ui_index.html 原本零参数调用不受影响）。ui_index.html
 *   新增：Sort+Filter 工具栏（Tasks/Projects 各一个）、Priority 控件
 *   （直接改 + Ask AI + 建议展示/采纳/忽略）、Edit 内联表单（Task：
 *   title/category/due_date；Project：title/description）、Done 按钮、
 *   Cancel 按钮（点一次变成 Sure?/No 二次确认，不用浏览器原生
 *   confirm()，跟既有内嵌交互风格一致）。
 *
 *   架构遵守：UI → UIBridge → Query/Command → Domain Engine → EventBus
 *   → Projection 不变，没有往 UI 塞 Domain 逻辑，没有为了凑功能在 UI
 *   层发明既有 Domain 没有的能力——updateTask/updateProject/
 *   completeTask/cancelTask/completeProject/cancelProject 全部复用
 *   既有 Command，UIBridge 只做 not_found/already_X/invalid_state →
 *   {ok,code,message} 的翻译（同 Slice 1~3 已有惯例）。
 *
 *   两个值得记录的设计决定：
 *   1. updateTask(null) 在"任务不存在"和"没有合法字段变化"两种情况下
 *      返回同一个 null，UIBridge 没法从返回值区分——ui_updateTask/
 *      ui_updateProject 改为先用既有 TaskQueryEngine.getTask/
 *      ProjectQueryEngine.getProject（本来就是已声明的 Reads 依赖）自己
 *      判断一次"存在与否"，让 NOT_FOUND 和 NO_CHANGES 在 Bridge 层就
 *      区分清楚，不是新增 Domain 逻辑。
 *   2. Priority 严格照 ADR-2026-07-24-009（"AI Suggests, Human
 *      Confirms"）：ui_suggestPriority 只产出建议，唯一的写是把这次
 *      生成的建议记到 priority_ai_recommended（通过既有 updateTask）；
 *      priority 本身只有用户点"采纳"才会变，走的是同一个 updateTask，
 *      不是另一条特殊通道；Sort/Filter 全程只读 priority，不读
 *      priority_ai_recommended。
 *
 *   Preflight 过程中顺带发现并补上两处此前遗漏的治理留痕（不是本次
 *   新引入的问题，是早就存在、这次因为要动同一批文件而顺带发现的）：
 *   - 00_Module_Responsibility.gs「十四」50_UIBridge.gs 的 Engine
 *     Contract 从 2026-08-18（Slice 1 时）之后就没跟上 Slice 2/3 早就
 *     有的 Reads/Public API，这次连同 Track 2 的新增一起重新同步，
 *     不是本次改动引入的滞后。
 *   - Carson 批准 Track 2 时明确要求把"Sort 目前是前端方案"记成过渡
 *     决定、不是最终架构——之前没有落到任何文件里，这次补进
 *     00_Known_Limitations.gs「五」（新section）。同一次批准里提到的
 *     "suggestPriorityWithAI_ 缺 CRITICAL 档"也一并补进
 *     00_Known_Limitations.gs「三」，并更正了「四」里"三个 AI 函数都
 *     没有暴露给用户"这句话——第 1 个（suggestPriorityWithAI_）现在
 *     经 Web UI 暴露了，另外两个不变。
 *
 *   测试：新增 51_Tests_UIBridge_Interactions.js，14 个测试，单一入口
 *   runUIBridgeInteractionsGate()，覆盖 I2~I5 的服务端契约 + I3 的
 *   "AI 建议不自动生效"这条核心不变量（AIConnector.callAIForJSON_
 *   mock，沿用 37_Tests_AIEngines.gs 的先例，不依赖真实网络/AI 凭证）。
 *   I1 的 Filter 服务端一半有测试；Sort 是纯前端 JS，这套 GAS 测试体系
 *   覆盖不到，需要人工浏览器验证四个排序选项。
 *
 *   状态：代码已交付，沙盒里跑了 JS 语法检查 + HTML 标签配平检查，
 *   全部通过；真实 Sheet/EventBus 环境下的 14 个测试、以及浏览器里的
 *   Sort/Edit/Priority/Done/Cancel 交互，需要 Carson 把改动过的文件
 *   粘贴进真实 GAS 项目后跑 runUIBridgeInteractionsGate() + 人工走一遍
 *   UI 才能拿到确认——沙盒里没有 Carson 的真实 Spreadsheet 和浏览器，
 *   这两步没法代跑。
 *
 * 【2026-08-21/22 补充，真实环境结果】13/14 通过。唯一失败的
 * testUIInteractions_SuggestPriority_NeverAutoApplies_ 是测试自己的
 * bug，不是 UIBridge 的问题：mock 让 AIConnector.callAIForJSON_ 返回
 * priority:'CRITICAL'，但 suggestPriorityWithAI_ 真实校验只认
 * HIGH/MEDIUM/LOW（这条限制是我自己发现、写进
 * 00_Known_Limitations.gs「三」的，结果自己写 mock 的时候没对上）——
 * 已改成 'HIGH'。其余 13 项（Edit Task/Project、Done/Cancel 含幂等、
 * Accept Suggestion 落盘、Filter 两项）真实环境全部通过，UI-I2~I5 的
 * 服务端契约视为确认完成。Sort 仍待人工浏览器验证（前端 JS，见「五」）。
 */


// ============================================================
// 十六、Track 1B — Due-Date Canonicalization 实施就绪（2026-08-22）
// ============================================================

/**
 *   批准依据：00_Due_Date_Canonicalization_Audit.md + ADR-2026-07-24-023
 *   + Carson 2026-08-22 批准消息（Option C，10 条条件，明确的
 *   Inventory → Dry-run → Backup → Write → Read-back Verify → Identity
 *   regression → Recurring regression → Full Sprint regression 顺序）。
 *
 *   代码已交付（沙盒里语法检查 + 跨 3 个不同时区（UTC/Asia-Shanghai/
 *   America-Los_Angeles）的 Node 独立验证全部通过，含逐字节复现
 *   Carson 真实诊断数值的回归断言）：
 *
 *   1. 07_IdentityEngine.js：resolveIdentityDueValue() 内部新增
 *      _canonicalizeDueValue_() 归一化，同时以 canonicalizeDueValue
 *      名义暴露公开 API（给迁移脚本复用同一套算法，不重复实现）。
 *      不改动 Track 1A 的 scopeKey 逻辑（Carson 条件 5）。
 *   2. 11_ProjectionRebuilder__DUE_DATE_VALUE_MIGRATION.js（新增）：
 *      Option A 的存量数据值迁移，5 个函数对应 Carson 要求的 5 个
 *      阶段（Step1 Inventory ~ Step5 ReadBackVerify），状态持久化在
 *      新增的 Due_Date_Migration_Log 分页里（不依赖单次执行内存，
 *      因为几步之间大概率是分开的手动执行）。Step 4（Write）要求
 *      显式传入确认字符串，不能在没看过 Dry-run/Backup 输出的情况下
 *      顺手触发。Step 3（Backup）用 getSheet_('Tasks').getParent()
 *      拿真实 Spreadsheet 对象再 .copy()——这个项目是 standalone
 *      script，没有 getActiveSpreadsheet() 可用，见
 *      05_SheetUtils.getSheet_ 文件头说明。
 *   3. 53_Tests_DueDateCanonicalization.js（新增）：7 个测试，单一
 *      入口 runDueDateCanonicalizationGate()，覆盖归一化函数本身
 *      （含逐字节复现 Carson 真实诊断值的核心回归断言）、updateTask
 *      编辑路径、以及 Carson 明确要求的 Recurring regression
 *      （21_RecurringEngine 路径）。
 *   4. ADR-2026-07-24-023：记录"due_date canonicalization 是 Domain
 *      data contract / identity boundary 修复，不是 UI workaround"
 *      这条 Carson 特别要求保留的定性。
 *
 *   Carson 10 条条件对照：① Preflight 已做（本轮所有代码改动前的
 *   file:line 追查）；② Option C 已采用；③ Data-only migration（不碰
 *   identity）；④ 无 identity migration；⑤ 未改 Track 1A scope-key
 *   逻辑；⑥ Migration 含 checkpoint（Step 3 Backup）+ read-back
 *   verification（Step 5）；⑦ 测试覆盖审计「十一」列出的项目；
 *   ⑧ 本节即 Track 1B 独立报告；⑨ 不阻塞 UI-I1~I5；⑩ 不启动 Drag
 *   UI-I6——十条均满足。
 *
 *   还需要 Carson 在真实环境按顺序手动执行（沙盒没有真实 Spreadsheet，
 *   这几步没法代跑）：
 *     Step 1~5（11_ProjectionRebuilder__DUE_DATE_VALUE_MIGRATION.gs）
 *     → runDueDateCanonicalizationGate()（53）
 *     → runIdentityScopeKeyRegressionGate()（39，Identity regression，
 *       这次应该 6/6 全过，包括此前失败的
 *       testIdentityScope_UpdateTaskPreservesScope_）
 *     → runSprint3AcceptanceGate() / runUIBridgeSlice3Gate() /
 *       runUIBridgeInteractionsGate()（Full Sprint regression）
 *
 *   Track 1A / Track 1B / Track 2 边界（Carson 明确要求记录）：
 *     Track 1A（workflow_id）→ 独立完成
 *     Track 1B（due_date canonicalization）→ 本节，独立实施就绪
 *     Track 2（UI-I1~I5）→ 独立推进，不受本节影响
 *     Drag Ordering ADR（UI-I6）→ 独立待写，不受本节影响
 *   四者刻意保持互不阻塞，不合并成一次大改动。
 */


// ============================================================
// 十七、Track 1A / Track 1B 正式关闭（2026-08-23，Carson 确认真实
//      环境全部通过后要求正式 Closed）
// ============================================================

/**
 *   Track 1A — Identity Impact Audit（workflow_id scope key）：
 *     PASSED / CLOSED
 *   Track 1B — Due Date Canonicalization + Identity Boundary：
 *     PASSED / CLOSED
 *
 *   真实环境最终结果（Carson 确认）：
 *     - Production migration（11_ProjectionRebuilder__DUE_DATE_VALUE_
 *       MIGRATION.gs 五阶段）：VERIFIED
 *     - runDueDateCanonicalizationGate()（53）：PASSED
 *     - runIdentityScopeKeyRegressionGate()（39）：PASSED
 *       （含此前失败、现在应验证通过的
 *       testIdentityScope_UpdateTaskPreservesScope_）
 *     - runSprint3AcceptanceGate()：PASSED
 *     - runUIBridgeSlice3Gate() / runUIBridgeInteractionsGate()：PASSED
 *
 *   治理约定：Track 1A / Track 1B 不因为"看起来还能再优化"或者
 *   "顺手就能改"被重新打开或重构——只有未来出现真实的回归证据
 *   （某个 Gate 重新跑出失败、或者生产环境观察到 identity/due_date
 *   相关的真实异常）才重新评估，不接受"觉得这里可以写得更好"这类
 *   理由重新动这两个 Track 已经关闭的范围。
 *
 *   四条线现状（Carson 2026-08-23 确认）：
 *     Track 1A → CLOSED
 *     Track 1B → CLOSED
 *     Track 2（UI-I1~I5）→ 独立推进中，见下方汇报
 *     Drag Ordering ADR（UI-I6）→ 独立推进中，见 00_Drag_Ordering_
 *     ADR.gs，UI-I6 本身保持 BLOCKED_PENDING_ARCHITECTURE_DECISION
 */

// 十八、Governance Adoption —— UEF v1.12 §0.6 persistence/checkpoint
//       规则正式 local adoption（2026-08-24，见 ADR-2026-07-24-024）

/**
 * 决定见 00_ADR.gs ADR-2026-07-24-024，论证不在本文件重复。
 *
 * 1. Governance Rule Adopted：✅
 *    ADR-2026-07-24-024 已 Accepted（2026-08-24）。
 *
 * 2. Constitution Synchronization：✅
 *    00_Project_Constitution.gs 零之七(四) 已引用本条 ADR。
 *
 * 3. Project State Adoption Record：本章节本身。
 *
 * 4. Implementation Checkpoint System Active：⏳ PENDING
 *    "治理规则已採纳"不等于"日常开发已经实际执行该规则"。只有未来
 *    实际观察到 Modify → Validate → Persist/Export → Independent
 *    Verify → Checkpoint 这套开发行为后，才能把这一项改成 Active。
 *
 * 5. Scope / Boundary：
 *    本记录不代表 Universal-Recovery-Manifest.md、
 *    OS-Directory-for-Personal-AI-Core.md 或 Universal UEF 已被修改。
 *    Universal 层同步是后续独立的治理步骤，不因这次 local adoption
 *    自动发生。
 *
 *    本决定最初在另一轮工作中被暂定编号为「十六」；核对本仓库真实
 *    状态后确认「十六」「十七」已经是 Track 1B / Track 1A-1B 收尾
 *    那两段真实记录（2026-08-22／2026-08-23），因此本记录正式编号
 *    为「十八」，内容本身未变。
 */


// ============================================================
// 十九、Track 2 —— UI Create Capability 落地（2026-08-24）
// ============================================================

/**
 * 背景：Carson 在本窗口开局明确要求 Add Task / Add Project 必须是一等
 * UI 操作，不能藏在 Edit 里面，写路径必须走既有 UI → UIBridge → 既有
 * Domain Command/Engine → EventBus → Projection，复用既有 createTask/
 * createProject 契约，不允许新开 UI 专属持久化路径。
 *
 * 实现内容：
 *   1. 50_UIBridge.gs 新增 ui_createTask(title, meta, _testOverrides)、
 *      ui_createProject(title, meta, _testOverrides)——内部分别只调用
 *      既有 TaskEngine.createTask() / ProjectEngine.createProject()，
 *      不直接碰 Sheet/Events，跟本文件其它 ui_* 函数同一种角色。
 *   2. ui_index.html 新增 Add Task / Add Project 两个独立 create-panel
 *      （"+ Add Task" / "+ Add Project" 按钮 + 折叠表单），位于各自面板
 *      工具栏之上，不依附于 Edit。
 *   3. 51_Tests_UIBridge_Interactions.gs 新增 4 条测试 + 独立入口
 *      runUICreateInteractionsGate()——刻意跟既有 14 项的
 *      runUIBridgeInteractionsGate() 分开，避免新增覆盖污染 Carson
 *      要求"先干净重跑一次"的既有回归基线。
 *
 * 字段范围决定（Add Task）：title / priority / category / due_date /
 *   due_time / notes / project_id（下拉，取自既有 rawProjectsCache）/
 *   workflow_id（纯文本输入——本项目目前没有 Workflow 列表可选，
 *   Workflows 面板还没做，这个不对称是事实的直接反映，不是疏漏）/
 *   tags / recurring。source / provenance metadata（source_module /
 *   decision_owner）由 ui_createTask 内部自动写入，不作为表单字段暴露
 *   ——沿用 ui_createNote 的既有先例。
 *
 *   一处需要 Carson 确认的字段解释：Task 表本身有 notes 和 description
 *   两个独立字段，语义未见文档区分；Carson 原话把它们写成一行
 *   "notes / description"。本次实现把表单这一个字段只映射到 notes，
 *   description 作为独立字段未被本次 Add Task 覆盖——这是一个解释选择，
 *   不是确认过的决定，如果 Carson 的本意不同，需要另行调整。
 *
 * 字段范围决定（Add Project）：title / description / parent_project_id
 *   （下拉）/ execution_mode（SEQUENTIAL/PARALLEL/BRANCH/未设置）。
 *
 * 验证状态（请勿混淆以下三层）：
 *   - 代码语法：✅ VERIFIED（node --check 通过，本文件写入时已重新确认）
 *   - 服务端契约（runUICreateInteractionsGate()）：✅ VERIFIED LIVE
 *     ——2026-08-25 Carson 贴回真实 Logger 输出，4/4 全部通过
 *   - 真实浏览器端到端流程（创建 Task/Project 后列表正确刷新）：
 *     ⚠️ 尚未确认成功。见「二十一」「二十二」——第一次真实浏览器使用
 *     Add Task 时曾经复现真实 bug（写入成功但列表不刷新，控制台报错），
 *     经两轮修复后，Carson 尚未回报最新一轮修复是否已经解决。
 *     在收到 Carson 明确的"重新测试成功"确认之前，不应该把 Add Task
 *     当作端到端已验证。
 */

// ============================================================
// 二十、UI-I1~I5 Interactions Gate —— 13/14 → 14/14 重跑确认（2026-08-25）
// ============================================================

/**
 * 「十五」记录的 13/14 失败原因（AI mock 误用 'CRITICAL'，
 * suggestPriorityWithAI_ 的真实校验不允许这个值）已经在代码层面修复
 * （mock 改成 'HIGH'）。Carson 明确要求：在把 UI-I1~I5 移入最终验收之前，
 * 必须先干净重跑一次这个 Gate，不接受"代码已经改了"就当作已经验证。
 *
 * 2026-08-25，Carson 贴回真实 Logger 输出：
 *   runUIBridgeInteractionsGate() —— 14/14 全部通过（真实环境，非本次
 *   对话内推测）。
 *
 * 状态：UI-I1~I5（Sort/Filter/Edit Task/Edit Project/Priority/Done/
 * Cancel）服务端契约 ✅ VERIFIED LIVE。真实浏览器手动验证（Sort 的四个
 * 排序选项、Filter、Edit 表单实际渲染等）本节不涉及，仍然只能人工点——
 * 见 Carson 原话"Do not claim browser verification based solely on
 * automated tests"，本项目未见 Carson 回报这一步的结果。
 */

// ============================================================
// 二十一、Due-Date Canonicalization —— 生产环境真实复现 +
//        UIBridge 传输层修复（2026-08-25）
// ============================================================

/**
 * 【重要边界，先声明】：Track 1A / Track 1B 在「十七」已经正式 CLOSED，
 * 本节完全不重新打开那两条线，也不实现 Track 1B 自己的方案（
 * resolveIdentityDueValue() 归一化 + Sheet 存量数据迁移，那部分范围更大、
 * 风险更高，仍然是 AUDIT_PENDING_IMPLEMENTATION，仍然需要 Carson 单独
 * 批准，本节完全不碰 07_IdentityEngine.gs / 12_TaskQueryEngine.gs /
 * 14_ProjectQueryEngine.gs 本身，也不碰任何真实 Sheet 数据）。本节记录
 * 的是一个范围窄得多、独立的 UIBridge 传输层修复。
 *
 * 现象：2026-08-25，Carson 通过真实浏览器使用新上线的 Add Task 功能后，
 * 任务写入成功（确认写入链路本身没问题），但 Tasks 列表未刷新，浏览器
 * 控制台报 "Cannot read properties of null (reading 'ok')"。
 *
 * 根因（不是新问题，是 00_Due_Date_Canonicalization_Audit.gs 早就审计
 * 过、状态一直是 AUDIT_PENDING_IMPLEMENTATION 的同一个存量问题，这是
 * 它第一次经由真实浏览器路径被触发）：
 *   1. 12_TaskQueryEngine.gs 的 _readAllRows_() 把 Range.getValues() 的
 *      原始返回值不做任何类型转换直接赋值——如果 Sheets 把某个
 *      due_date/due_time/due_datetime 单元格自动识别成了日期/时间格式，
 *      读回来的就是原生 JS Date 对象。
 *   2. _setPlainTextFormatForNewColumns_ 的 Plain-Text 保护范围止于
 *      调用当时的 lastRow，不保证覆盖之后新增的行——新建的 Add Task
 *      行正是最可能漏保护的那类行。
 *   3. 经 web search 独立核实（非本仓库内部推断）：Google 官方文档
 *      明确规定 google.script.run 禁止传输原生 Date 对象（包括嵌套在
 *      对象/数组内部），一旦命中，不抛错，直接让前端 successHandler
 *      收到 null——这是真实、文档化的平台行为，不是猜测。
 *
 * 修复：50_UIBridge.gs 新增 _sanitizeTaskDatesForTransport_()
 * （紧邻既有 _wrapError_ 放置），把 due_date/due_time/due_datetime 上
 * 任何 Date 实例（以及防御性兜底扫描到的其它未预期 Date 字段）转回
 * canonical string（Utilities.formatDate + 脚本真实时区——不用
 * toISOString()，该审计文件已经证实 toISOString() 会因时区换算把日期
 * 错移一天）。应用范围（截至本次 checkpoint，见「二十二」的完整清单）：
 * 12 处返回点，覆盖本文件所有会把 Task/Project 数据回传给浏览器的
 * ui_* 函数。
 *
 * 验证状态：
 *   - 代码语法：✅ VERIFIED（node --check 通过）
 *   - 3 条针对 _sanitizeTaskDatesForTransport_ 本身的纯函数单元测试：
 *     已写入 51_Tests_UIBridge_Interactions.gs，尚未见 Carson 贴回
 *     真实运行结果——⚠️ 未经 Carson 独立核验
 *   - 真实浏览器端到端：⚠️ 未确认解决，见「二十二」——第一次修复
 *     部署后，Carson 仍然复现了空响应（只是不再是未捕获异常，
 *     而是本次新加的 null-guard 正确显示的"empty response"提示）。
 */

// ============================================================
// 二十二、UIBridge / UI 全面防御性加固 —— 第二轮（2026-08-25）
// ============================================================

/**
 * 触发原因：第一轮修复（「二十一」）部署后，Carson real-browser 重新
 * 测试 Add Task，仍然收到空响应提示，而不是列表正常刷新。Carson 贴回
 * 第二份第三方诊断报告，声称 (a) google.script.run 对 Date 对象有
 * "硬性封锁"，(b) 存在"跨执行域（Realm）的 instanceof Date 误判"
 * 导致部分字段漏检。
 *
 * 核实结果（没有直接采信，逐条独立核查）：
 *   (a) 通过 web search 核实为真——Google 官方文档与开发者社区讨论均
 *       确认 Date 是 google.script.run 明确禁止的参数/返回值类型，
 *       命中时静默返回 null、不报错。这条判断是对的。
 *   (b) 未找到任何证据支持"跨 Realm instanceof 误判"这个机制——本项目
 *       所有 Sheet 读取都在同一个 Apps Script 执行上下文里完成，没有
 *       真正的跨 Realm 边界。没有采信这条、也没有基于它实现任何
 *       "修复"。仍然额外加了一层 duck-typing（检测 getTime/getMonth
 *       方法）作为不增加风险的兜底加固，代码注释里明确写清楚这不是在
 *       证实那个说法。
 *
 * 报告里可核实的具体断言，逐条对照真实文件核实（没有直接照抄补丁）：
 *   - 报告声称 3 个函数（ui_convertNoteToTask / ui_convertProjectToTask /
 *     ui_instantiateTemplate）遗漏了 _sanitizeTaskDatesForTransport_
 *     包裹——核实为真。
 *   - 但报告的清单本身不完整——遗漏了 ui_convertTaskToProject（同样的
 *     风险模式），本次一并补上。至此 50_UIBridge.gs 共 12 处返回点
 *     包裹了该函数（从「二十一」的 6 处增加到 12 处）。
 *
 * 独立于两份报告、自行检查发现并修复的问题：
 *   - ui_index.html 里 Task 和 Project 的 Edit 保存按钮（save-edit-btn）
 *     完全没有 withFailureHandler，也没有失败时重置按钮/表单——
 *     跟本窗口更早修复过的 Done/Cancel 按钮是同一类 bug，理应在第一次
 *     处理 Done/Cancel 时就一并检查所有同类按钮，当时没有做到，这次
 *     补上。
 *   - sortTasks() 的 due_date 比较器直接调用 .localeCompare()，如果
 *     due_date 不是字符串会直接抛异常中断排序——已改成
 *     String(...).localeCompare(String(...))。
 *   - "Accept AI Suggestion"这个动作完全没有 withFailureHandler，
 *     且不管 ui_updateTask 是否真的成功都会重新加载列表——已补上完整
 *     的成功/失败处理。
 *   - ui_index.html 剩余的所有 google.script.run 回调（loadNotes /
 *     addNote / convertNoteToTask / Task 的 Done·Cancel·Ask AI·
 *     Convert to Project / Project 的 Complete·Cancel·Convert to Task·
 *     Capture·Instantiate）均补上了 null 防护——第二份报告在这一部分
 *     的清单是准确的。
 *
 * 验证状态（务必准确记录，不要跟「已讨论/已实现」混淆）：
 *   - 代码语法：✅ VERIFIED（node --check 通过，本 checkpoint 撰写时
 *     已重新核对：sandbox 工作副本与 /mnt/user-data/outputs/ 已导出的
 *     四个文件字节级一致，diff 无输出）
 *   - 真实浏览器端到端：❌ 尚未验证。Carson 尚未针对这一整轮修复重新
 *     测试 Add Task。在收到 Carson 明确的重新测试结果之前，不应该
 *     假设这轮加固已经解决真实空响应问题。
 *   - 最可能但未经证实的解释：修复代码可能还没有以"New Version"
 *     重新部署——这是下一次排查最便宜、最应该先排除的可能性，优先于
 *     任何代码层面的新理论。
 */

// ============================================================
// 二十三、Drag Ordering ADR —— Section G 新增（2026-08-24），
//        仍为 PROPOSED，非 Accepted
// ============================================================

/**
 * 00_Drag_Ordering_ADR.gs 新增 Section G "Ownership of the
 * Context-Scoped Ordering Entity"，回应 Carson 明确要求："不要因为
 * 叫它 ordering entity 就当作 ownership-neutral"，对 Inbox / Today /
 * Weekly / Project / Workflow / Goal / Review / Timeline 逐一给出
 * ownership 结论：
 *   - Inbox / Project / Review（本项目自己的 Review Engine）→
 *     Personal Life OS Domain state。
 *   - Workflow → Domain state，但明确写清楚一条边界：这份排序数据
 *     永远不能反过来影响 sequence_index（Workflow 步骤执行顺序的
 *     既有权威字段）。
 *   - Timeline → 建议完全不引入持久化的手动排序——它是时间戳驱动的
 *     历史记录，允许用户手动重排等于允许改写历史发生顺序，跟它存在
 *     的目的矛盾。
 *   - Today / Weekly → 拆成两个不同答案：本项目自己
 *     24_ViewEngine.gs 的 today()/thisWeek()（目前是纯函数筛选，
 *     没有持久化排序，Domain-local，本项目 UI 也还没有对应面板）
 *     vs. 00_Domain_Boundary.gs 矩阵里跨 Domain 聚合的"Today View"/
 *     "Weekly View"（Life Execution OS 拥有，如果需要排序，应该走
 *     Execution 自己的 Reference 信封机制，不进入本项目 Schema
 *     Authority）。
 *   - Goal → 同 Today/Weekly 的第二种情形，Life Execution OS state。
 *
 * 同时补上了提议实体（TaskViewOrder）完整规格：identity / owner /
 * storage / lifecycle / event semantics / projection behavior /
 * cross-device behavior / deletion behavior / orphan behavior
 * （限本项目 Schema Authority 内的四个 context）。
 *
 * 文件内部章节改动：原本的收尾状态章节从 G 改编号为 H，让"Ownership"
 * 这节插入在 F（Recommendation）之后、状态声明之前，保持字母顺序不
 * 出现 G 在 H 之前的错误。
 *
 * 状态：本节全部内容是分析，不是实现——UI-I6 保持
 * BLOCKED_PENDING_ARCHITECTURE_DECISION，代码库里没有任何排序相关
 * 代码。Model 3 推荐仍在 Carson 审阅中，未批准。对应在 00_ADR.gs
 * 新增 ADR-2026-08-26-026，Status 明确写 Proposed（不是 Accepted）
 * ——这是本次 checkpoint 新增的记录动作本身，不代表这个决定现在
 * 变成已批准；只是让这个待决项目在 ADR Log 里可查，而不是只活在
 * 独立的 ADR 文件里。
 */

// ============================================================
// 二十四、ADR-2026-07-24-024（Checkpoint 治理纪律）—— 本次对话的
//        坦诚自评
// ============================================================

/**
 * 背景：00_ADR.gs 的 ADR-2026-07-24-024（2026-08-24 Accepted）正式
 * 采纳了"Modify → Validate → 立即 Persist/Export → 独立核验持久化
 * 副本可读 → 记录 checkpoint"的纪律，并明确标注 Implementation
 * Checkpoint System Active 仍是 ⏳ PENDING——"规则已採纳"不等于
 * "日常开发确实照着做"。本节是对本窗口实际执行情况的坦诚自评，不是
 * 单方面宣布已经 Active。
 *
 * 一个直接相关的真实数据点：本窗口开局不久，Carson 上传的
 * 00_Session_Handoff_Checkpoint_2026-08-23.gs 在会话中途从
 * /mnt/user-data/uploads 消失（先在一次目录列举里出现，下一次读取
 * 就找不到，经文件系统搜索确认确实不在了）——这正是 ADR-024 Context
 * 部分描述的那类"容器/session 本身不是权威存储"的真实案例，只是这次
 * 丢的是交接文档本身，不是实现文件。当时的应对：没有从记忆里凭空
 * 重建这份文件的具体内容去冒充"读过"，而是明确告知 Carson 文件已经
 * 不可读，改为直接读取 Carson 同时上传的 70_Personal-Life-main.zip
 * （真实代码）作为依据——这跟 ADR-024 第 5 条"只从持久化文件 +
 * 已核验记录恢复"的精神一致，虽然当时还没有见到这条 ADR 的正式文本。
 *
 * 本窗口实际执行情况，逐条对照 ADR-024 的 Decision：
 *   1. Modify → Validate：✅ 基本做到——每次代码改动后都执行了
 *      node --check（HTML 文件额外做了 JS 提取 + 语法检查、标签配对
 *      检查、重复 id 检查），没有见过语法错误被留到下一步。
 *   2. 立即 Persist/Export，不允许"改完好几个文件最后一次性导出"：
 *      ⚠️ 部分做到，不是完全做到——本窗口是按"一个完整功能/一整轮
 *      修复"为单位做 present_files（例如"UI Create Capability 四个
 *      文件一起交付"、"第二轮防御性加固"），而不是每改完一个文件的
 *      每一处改动就单独导出一次。可以论证每个批次内部是一个真正连贯、
 *      完整、已验证的工作单元，不是任意断点，但严格按字面"每个文件
 *      修改后立即导出"这条并没有做到最细颗粒度。
 *   3. 独立核验持久化副本可读：⚠️ 直到本次 checkpoint 撰写时才第一次
 *      作为明确、独立的步骤执行——本次已经用 diff 核对 sandbox 工作
 *      副本与 /mnt/user-data/outputs/ 已交付副本，确认 ui_index.html、
 *      50_UIBridge.gs、51_Tests_UIBridge_Interactions.gs、
 *      00_Drag_Ordering_ADR.gs 四个文件字节级一致，没有发现导出内容
 *      跟实际交付内容不一致的情况——但这是本窗口第一次做这个具体检查，
 *      不是持续在做的习惯性动作。
 *   4. Project State 自己也要走同一套流程：本次新增的这几节内容，
 *      正在按同样的 Modify → Validate → Persist/Export → Independent
 *      Verify 顺序处理，见本 checkpoint 文件末尾的执行记录。
 *
 * 结论：Implementation Checkpoint System Active 维持 ⏳ PENDING——
 * 本次是一次认真的、补课性质的核验和记录尝试，不等于这套纪律从此已经
 * 成为日常习惯性动作。要把这一项改成 Active，需要未来几个窗口持续
 * 观察到逐文件、逐改动的 checkpoint 习惯，而不是本次一次性的完整审计。
 */

// ============================================================
// 二十五、UI V2 Slice 1（Core UI Consistency）—— 已交付,等待 Carson
//        Test Gate / Regression Gate（2026-09-01）
// ============================================================

/**
 * 背景：2026-08-31 的 UI Enhancement Architecture & UX Audit → 2026-09-01
 * 的 Capability Gap Review → Implementation Plan（5-Slice），三份文档
 * 依次交付并被 Carson 逐份批准；本节记录 Plan 里 Slice 1 的实际实现。
 * 范围：Unified Create/Edit、OS/Domain selector（Task+Project）、
 * Priority、Due date/time、Enter/focus 行为。
 *
 * 改动文件：20_TaskEngine.gs、27_ProjectEngine.gs、50_UIBridge.gs、
 * ui_index.html、00_ADR.gs（新增 ADR-2026-09-01-027）、
 * 00_Data_Ownership.gs（source_domain 条目同步更新）。完整改动内容见
 * ADR-2026-09-01-027 的 Affected Modules 和 Decision。
 *
 * 验证状态（对照「二十四」自己定的纪律，如实记录，不夸大）：
 *   - 代码语法：✅ VERIFIED——5 个改动文件全部经 node --check
 *     （ui_index.html 额外提取 <script> 内容单独检查）通过。
 *   - 真实 GAS/Spreadsheet/浏览器端到端：⚠️ 完全未验证——本窗口没有
 *     实际连接 Carson 的 Google Apps Script/Sheets 环境的能力，全部
 *     改动只经过静态代码审阅 + 语法检查。这不是"大概率没问题"，是
 *     "尚未验证"，两者不能混为一谈。
 *   - Test Gate / Regression Gate：按 Carson 的既定流程，由他在真实
 *     环境里跑，结果回贴后再决定是否进入 Slice 2——本节记录的是
 *     "已交付"，不是"已验证通过"。
 *
 * 交付时做出的、需要 Carson 知悉/可能需要修正的具体范围决定：
 *   1. OS_REGISTRY 初始值只收了 PersonalLifeOS/PropertyOS/RiderOS/
 *      InvestmentOS/Other 五个——Carson 原始请求里举例提到的
 *      ProcurementOS/InventoryOS/ComplianceOS/FinanceOS/CalendarOS/
 *      HealthOS/NewsOS/ContentOS 没有收进枚举，因为找不到独立证据
 *      证明这些已经是正式注册的 OS（详见 ADR-027）。
 *   2. Project 的 Edit 表单额外加了 execution_mode——这是本次审计
 *      发现的同类型缺口（Create 能设、Edit 不能改），套用了 Carson
 *      已经批准的同一条原则做的延伸，但 Carson 这几轮消息里没有
 *      逐字确认这一项，值得他看一眼是否认可。
 *   3. Context 字段的 placeholder 文案（"@home, @errand"）是 GTD
 *      方法论里"情境标签"的常见含义，代码/文档里没有找到这个字段
 *      本来的确切定义，是推测填的，Carson 如果另有所指需要改文案。
 *   4. 前端 OS_REGISTRY 是后端同名全局量的手抄副本（做法上跟既有
 *      category/priority/recurring 完全一致），不是动态拉取——新增
 *      OS 目前仍然要改两处。
 *   5. Create/Edit 没有做成一个真正通用的、数据驱动的 schema renderer
 *      ——两个表单分别手写了对应字段的 HTML/JS，字段列表现在保持一致，
 *      但"保持一致"依赖的是这次改动本身的完整性，不是结构上不可能
 *      再次出现分歧。理由：本窗口无法实际跑这份 GAS+HTML 代码，一个
 *      更通用的渲染抽象层出错的方式会更难被肉眼审出、也更难被 Carson
 *      在他自己的环境里定位问题——权衡之后选择了更笨、但更容易逐行核对
 *      的写法。如果 Carson 更想要真正 schema-driven 的版本，可以作为
 *      后续一次单独的重构提出。
 *   6. 本次加的"保存成功后聚焦回标题输入框"是等真实 google.script.run
 *      响应回来之后才做的，不是乐观更新——完整的乐观 UI（点击后立刻
 *      显示、失败再回滚）刻意留给 Slice 5，因为那部分需要先有真实
 *      延迟数字才能决定值不值得做、怎么做防重复提交。
 *
 * 明确保持不变（按 Carson 的要求核对过）：
 *   - 07_IdentityEngine.gs、09_IdempotencyManager.gs、
 *     08_DeduplicationEngine.gs：零改动。
 *   - source_domain 两个 Engine 里都确认【不在】IDENTITY_AFFECTING_FIELDS
 *     里，重新归类不会触发 identity 重算。
 *   - 28_WorkflowEngine.gs、29_NoteEngine.gs：零改动——按 Carson 明确
 *     决定，本轮不给这两个实体接入 source_domain。
 *   - Done/Cancel 两个方向（Task 和 Project）：本 Slice 完全没有碰
 *     completeTask/cancelTask/completeProject/cancelProject 或它们的
 *     UIBridge 包装，继续走既有正式 Command，没有被拉进共享字段改动里。
 *
 * 下一步：等 Carson 在真实环境跑完 Test Gate + Regression Gate、结果
 * 贴回来——通过后才进入 Slice 2（Overall Dashboard）。
 */

// ============================================================
// 二十六、UI V2 Slice 2（Task Dashboard）—— 已交付,等待 Carson
//        Test Gate / Regression Gate（2026-09-02）
// ============================================================

/**
 * 背景：Carson 因为在外送外卖、暂时无法做 Slice 1 的实机验证，明确指示
 * "不要因为 Slice 1 未验证就阻塞 Slice 2"，同时明确要求本窗口在动手前
 * 重新核对当前真实代码状态、不能只依赖之前的报告。已按此执行——重新读了
 * 24_ViewEngine.gs/25_DashboardEngine.gs/12_TaskQueryEngine.gs/
 * 14_ProjectQueryEngine.gs，并且发现一处此前审计没有完全说清楚的地方，
 * 见下方"核对中发现的修正"。
 *
 * 改动文件：24_ViewEngine.gs（_isNonTerminal_ 收紧）、
 * 12_TaskQueryEngine.gs（新增 getTaskDashboard）、50_UIBridge.gs（新增
 * ui_getTaskDashboard）、ui_index.html（新增 Dashboard nav + panel）。
 * 25_DashboardEngine.gs（Telegram 契约）：零改动，确认冻结。
 * 20_TaskEngine.gs/27_ProjectEngine.gs（Slice 1 交付物）：零改动。
 *
 * 核对中发现的修正（如实记录，不夸大也不回避）：
 *   之前的审计把 ViewEngine._isNonTerminal_ 只排除 DONE/CANCELLED 这件事
 *   记成"确认的 bug"。本轮重新核对 10_ProjectionEngine.gs 后发现这个
 *   定性不准确——projectTaskConvertedToProject_/projectTaskNotSelected_
 *   已经会把 CONVERTED/NOT_SELECTED 状态的 Task 从 ActiveTasks 物理删除，
 *   而 12_TaskQueryEngine.gs 的七个高频视图（V4.8 修复）全部读
 *   ActiveTasks——所以在现有调用路径下，这个不一致目前【不会】被实际
 *   触发，是潜在（latent）问题，不是活跃（live）bug。仍然做了收紧（见
 *   ViewEngine 文件内注释），理由是防御性的：本次新增的
 *   getTaskDashboard() 直接构建在这个函数之上。这个修正本身印证了 Carson
 *   "先重新核对当前代码、不要只信之前报告"这条要求的价值。
 *
 * 设计取舍（Carson 要求先分析"最小安全 adapter"方案，这里记录结论）：
 *   getTaskDashboard() 放在 12_TaskQueryEngine.gs 内部（不是新文件、不是
 *   塞进 25_DashboardEngine.gs）——理由：这个文件本来就是"本 OS 唯一允许
 *   直接读 Tasks/ActiveTasks 的模块"，新函数内部把 ActiveTasks
 *   只读一次、复用 24_ViewEngine.gs 的既有纯函数过滤器做多个 bucket，
 *   没有新写一条 Task 查询/过滤逻辑，也没有改动
 *   25_DashboardEngine.gs 一个字符——两条路径（Telegram 文本 / Web UI
 *   JSON）自此完全独立，互不牵连。
 *
 * OS 分组对既有值不一致的处理：_normalizeOsDomainForGrouping_ 只在
 * 读取/展示时把 'Personal Life'（Slice 1 之前的旧默认值）和
 * 'PersonalLifeOS'（Slice 1 之后的新默认值）当同一组——不改写 Sheet 里
 * 任何一行的实际存储值，不是 data migration，Carson 已经明确要求不要做
 * 后者。
 *
 * Project 边界：project_due_view 字段显式返回
 * {status:'BLOCKED_PENDING_PROJECT_DEADLINE_CONTRACT', message:...}——
 * 没有给 Project 加任何日期字段，没有假设 Project deadline。
 *
 * 验证状态（Carson 要求的四态口径，如实标注，不把 pending 当 PASS）：
 *   - 代码语法：STATIC VERIFIED——4 个改动文件全部经 node --check
 *     （ui_index.html 提取 <script> 内容单独检查）通过。
 *   - _isNonTerminal_ 收紧对既有七个高频视图的行为影响：STATIC VERIFIED
 *     （逻辑推导：ActiveTasks 已经物理排除 CONVERTED/NOT_SELECTED，收紧
 *     前后对这七个函数的实际输出无差异）——但这是静态推导，不是实跑验证，
 *     仍然建议 Carson 实机跑一次现有 Track 2 Sort/Filter 用例确认。
 *   - getTaskDashboard/ui_getTaskDashboard 实际返回结构、去重是否正确、
 *     OS 分组是否正确：LIVE TEST PENDING。
 *   - Dashboard 面板浏览器渲染、Done/Cancel 快捷操作、导航切换：
 *     LIVE TEST PENDING。
 *   - Project 相关部分：BLOCKED_PENDING_PROJECT_DEADLINE_CONTRACT（按
 *     设计如此，不是缺陷）。
 *   - Slice 1（Task/Project 的 OS selector、Create/Edit parity 等）：
 *     SLICE_1_LIVE_VALIDATION_PENDING——本轮沙盒重新核对确认文件仍然
 *     完整、语法仍然有效，但真实浏览器/GAS 行为仍然是 Carson 回家后才能
 *     验证的，没有因为 Slice 2 的开展而改变这个状态。
 *
 * Test Gate（Carson 回家后，Slice 1 + Slice 2 一起跑）：
 *   1. 打开 Dashboard 面板，确认 Overdue/Today/This Week/Upcoming/
 *      Recurring/High Priority 分区正确显示，同一个任务不会在多个时间类
 *      分区里重复出现。
 *   2. 确认 By OS/Domain 分组里，Slice 1 之前创建的任务（source_domain=
 *      'Personal Life'）和之后创建的任务（'PersonalLifeOS'）被合并显示
 *      在同一组，不是分成两组。
 *   3. 在 Dashboard 面板点 Done/Cancel，确认任务正确变更状态且从
 *      Dashboard 消失，Tasks 面板本身的数据也同步反映。
 *   4. 确认 Projects 相关的提示文字正确显示"pending Project Deadline
 *      Contract"，没有任何 Project 出现在任何 Due 分区里。
 *   5. 确认 Telegram 端（如果方便测试）/today /week 等指令输出跟改动前
 *      完全一致（25_DashboardEngine.gs 零改动的直接验证）。
 *
 * 下一步：等 Carson 把 Slice 1 + Slice 2 的实机结果一起贴回来——通过后
 * 才进入 Slice 3（Note Edit）。
 */

// ============================================================
// 二十七、Slice 1 + 2 实机测试报告 + 一处 Hotfix（2026-09-02）
// ============================================================

/**
 * Carson 回家后实机跑了 Slice 1 + Slice 2：自动化测试 4/4、14/14 全绿；
 * Add Task 写入成功无报错，OS 下拉可选，提交后焦点回弹；OS 归一化合并
 * 正常（未拆成两组）；Dashboard 的 Done/Cancel 正常——以上全部 LIVE
 * VERIFIED PASS，Slice 1 从「SLICE_1_LIVE_VALIDATION_PENDING」正式转为
 * 通过。
 *
 * 唯一发现的问题：今天到期的任务出现在 Overdue，没有出现在 Today。
 *
 * 根因（05_SheetUtils.gs，不是 Slice 1/2 新写的代码，是既有共用函数）：
 * isOverdue_() 对纯日期字符串（无 due_time）解析后是当天 00:00:00，原来
 * 直接拿这个时间点跟 Date.now() 比——导致"今天到期"的任务从当天凌晨过后
 * 的每一刻起就被判定成 overdue。这个函数被 24_ViewEngine.overdue() 和
 * 26_AnalyticsEngine.computeStatistics 两处共用，之前审计没有发现，是
 * 这次 Slice 2 的去重逻辑（overdue 优先级高于 today，一个任务只保留在
 * 一个 bucket 里）第一次让这个既有问题变得肉眼可见——旧的 Telegram
 * buildTodayDashboard 因为 Today/Overdue 两个分区之间本来就没有互相去重，
 * 这个任务会同时出现在两个分区里，没有像 Slice 2 这样表现成"从 Today
 * 消失"，所以更容易被忽略。
 *
 * 修复：isOverdue_() 改成纯日期字符串比到"当天结束"（23:59:59.999）而
 * 不是当天开始，今天到期的任务要到明天才算 overdue，跟日历直觉一致。
 * 带时间部分的字符串维持原来的精确时刻比较，不受影响。只改了
 * 05_SheetUtils.gs 一个文件；24_ViewEngine.gs/26_AnalyticsEngine.gs 的
 * 调用点不需要跟着改，因为问题出在被调用的共用函数本身，不是调用方式。
 *
 * 需要如实指出的一点：这处修复会让 Telegram 的 /today 指令（
 * 25_DashboardEngine.buildTodayDashboard 的 Overdue 分区）跟
 * AnalyticsEngine 算出来的 overdue 统计数字也发生变化——不再把今天到期
 * 的任务算进逾期。这不是为了 Web UI 而改动 25_DashboardEngine.gs 本身
 * （那个文件零改动），是修复一个两边共用、此前一直存在的真实计算错误，
 * 双方都会因此变得更准确。
 *
 * 验证状态：
 *   - STATIC VERIFIED（Node 模拟，用真实当前日期跑了 isOverdue_ 本身）：
 *     今天到期 → false（修复前是 true）；昨天到期 → true；明天到期 →
 *     false；空值 → false；里程类（'40000km'）→ false。修复前后对
 *     "非今天"的既有场景结果完全一致，只改变了"恰好是今天"这一种情况。
 *   - LIVE TEST PENDING：这是函数级模拟，不是在真实 GAS+Sheets+浏览器
 *     环境里用一条真实 Task 行跑出来的——请 Carson 用同一条今天到期的
 *     Task 再验证一次 Dashboard 的 Today/Overdue 分区，以及方便的话
 *     顺手看一眼 Telegram /today 的 Overdue 分区是不是也不再把它算进去。
 *
 * 下一步：等这一处 hotfix 的实机确认，通过后进入 Slice 3（Note Edit）。
 */

// ============================================================
// 二十八、isOverdue_ 第一版热修不完整——Carson 指出根因,已二次修复
//        （2026-09-02，同日）
// ============================================================

/**
 * Carson 复测/分析后指出：第一版热修（比较 endOfDueDay）判断"是不是纯
 * 日期"靠对 String(原始输入) 做正则匹配——但 Sheets 里被识别成日期类型
 * 的格子，getValues() 读回来的实际类型是原生 Date 实例，不是字符串；
 * String(Date 实例) 产出 "Thu Sep 03 2026 00:00:00 GMT+0800..." 这种
 * 格式，永远匹配不上 /^\d{4}-\d{2}-\d{2}$/，导致第一版热修对 Sheets 里
 * 真实的日期格子完全没有生效，bug 原样重现。诊断准确，已用 Node 复现
 * 确认——本窗口第一版验证时只测了字符串输入，没有测 Date 实例输入，是
 * 本窗口自己验证方法的疏漏，这里如实记录，不归咎为"当时没法预见"。
 *
 * 二次修复不是照搬 Carson 给出的"侦测这是不是纯日期"版本（判断
 * Date 实例是否 getHours()===0，字符串是否匹配正则），而是换了一种更
 * 不容易再踩坑的做法：不再侦测"这是不是纯日期"，直接统一按"日历日"
 * 粒度比较——把 due 和"此刻"都丢弃时分秒、只留年月日，严格早于才算
 * 逾期。这样处理是安全的，因为核对过 isOverdue_ 目前仅有的两个调用点
 * （24_ViewEngine.overdue()、26_AnalyticsEngine.computeStatistics）
 * 传进来的永远是 due_date，从来不是精确到时刻的 due_datetime——日历日
 * 粒度本来就是这个字段唯一有意义的语义，不需要靠猜格式决定要不要看
 * 时分秒，这个"侦测格式"的动作本身正是第一版热修出问题的地方。
 *
 * parseDueDate_() 同步加了 raw instanceof Date 的直接分支——之前只能
 * 处理字符串，Date 实例传进来要先被调用方 String() 转一道再传，这一圈
 * 本身就是问题根源，现在直接原生支持。
 *
 * Carson 同时建议在 12_TaskQueryEngine.getTaskDashboard() 里对 active
 * 任务的日期字段做一次预处理再喂给各个 View 函数——这一处没有采纳：
 * 根因已经在 isOverdue_/parseDueDate_ 这一层修掉，getTaskDashboard 本身
 * 调用的还是同一套 ViewEngine 函数，不需要也不应该在这一个调用点上再
 * 加一层重复的类型防护——那样会制造第二份"日期类型怎么处理"的逻辑，
 * 跟这份代码库一直以来"发现重复实现要合并、不要在多处分别打补丁"的
 * 原则相反，而且不会让 Telegram 端的其它调用路径一起受益。
 *
 * 顺手独立核实了一件事（不是假设）：24_ViewEngine._dueDateOf_（供
 * today/tomorrow/thisWeek/thisMonth/upcoming 五个视图共用）不受这个
 * bug 影响——它调用 parseDueDate_ 前自己已经 String() 了一次，Date 实例
 * 经这个路径能正确 round-trip 回同一个日历日（用 Node 从真实文件提取
 * 函数验证过，年月日完全一致），所以 Carson 这次只报告 Overdue 出问题、
 * Today 本身没问题，跟这个独立验证的结果一致。这也是为什么这一版没有
 * 动 24_ViewEngine.gs 一个字符——它没有坏，不属于这次该改的范围。
 *
 * 验证状态：
 *   - STATIC VERIFIED：直接从改动后的真实 05_SheetUtils.js 文件里提取
 *     函数（不是手抄测试片段）用 Node 跑：字符串-今天/Date实例-今天均为
 *     false，字符串-昨天/Date实例-昨天均为 true，明天两种输入均为
 *     false，空值/里程字符串/非法 Date 均为 false——Date 实例这条路径
 *     这次真正跑通了，不再是仅字符串路径通过。
 *   - LIVE TEST PENDING：请 Carson 用同一条今天到期的 Task 在真实
 *     Dashboard 里再验证一次 Today/Overdue 分区，这次应该能看到它正确
 *     出现在 Today。
 *
 * 下一步：等这次的实机确认，通过后进入 Slice 3（Note Edit）。
 */

// ============================================================
// 二十九、isOverdue_ v2 实机确认通过 + 三处补充修复（2026-09-04）
// ============================================================

/**
 * Carson 反馈：05_SheetUtils.js 已实机验证，测试通过——二十八章记录的
 * isOverdue_ v2（日历日粒度比较）在真实 GAS+Sheets+浏览器环境下确认
 * 生效。Session Handoff Checkpoint 2026-09-02「一、当前状态」与
 * 「五、下一步」列出的两处待确认（isOverdue_ v2 是否实机通过、Carson
 * 实际部署的 05_SheetUtils.js 是否已是这一版）就此解除，从 LIVE TEST
 * PENDING 转为 LIVE VERIFIED PASS。Slice 1 + 2 剩余的分区级验证清单
 * （This Week/Upcoming/Recurring/High Priority）本轮未见 Carson 明确
 * 提及，如实记录为仍未确认，不假设已随口覆盖。
 *
 * 同一窗口内 Carson 另外要求了三处改动，均已实施、node --check 通过：
 *
 * 1. 50_UIBridge.js：ui_getOpenNotes 补上 _sanitizeTaskDatesForTransport_
 *    包裹，补齐 ADR-2026-08-26-025 既定规则遗漏的一处 return site（不是
 *    新规则，是把已 Accepted 的规则应用到之前漏掉的地方）。已核对该
 *    函数按字段名泛化处理、非 Task 专属：Note 对象没有 due_date/
 *    due_time/due_datetime 不受影响，其余字段若为 Date 会被兜底分支
 *    捕获并记录日志，安全适用。
 *
 * 2. ui_index.html：默认落地面板从 Notes 改成 Dashboard——只调整了
 *    nav-item 的 active class 与 panel 的 visible class 这两处静态
 *    标记（二十六章确认过四个面板的数据是页面加载时一次性全部拉取，
 *    不是按需懒加载，这处改动不需要联动任何数据加载逻辑），同时更新了
 *    旁边一条已经过时的注释（原文写"这轮没有要求换默认面板"，现已不再
 *    准确）。
 *
 * 3. ui_index.html：Notes 卡片内容换行保留——note.content 原本已经过
 *    escapeHtml 转义（无 XSS 风险变化），但容器没有 white-space 声明，
 *    浏览器会把 \n 折叠掉。没有直接改共用的 .item-title 规则（Task/
 *    Project 标题也在用这个类），而是新增一个 .item-title.note-content
 *    修饰类，只挂在 Notes 卡片的渲染那一行，Task/Project 渲染路径零
 *    改动。
 *
 * 验证状态：
 *   - isOverdue_ v2：LIVE VERIFIED PASS（Carson 本轮报告通过，未附带
 *     具体分区截图/日志，如实记录为「Carson 报告通过」而非独立复核）。
 *   - 上述 1/2/3：STATIC VERIFIED（node --check 通过、grep 复查 5 处
 *     改动均已生效且无重复遗漏），LIVE TEST PENDING（GAS/浏览器环境不
 *     在本窗口手边，请 Carson 部署后确认：① 打开网页第一眼看到的是不是
 *     Dashboard；② Notes 里带换行的内容是否正确分行显示；③ 顺手看一眼
 *     Notes 面板本身加载无报错——ui_getOpenNotes 这处改动不改变任何可见
 *     行为，主要靠没有报错侧面确认）。
 *
 * 下一步：等以上 3 处实机确认；同时仍在等 Slice 1+2 剩余分区（This
 * Week/Upcoming/Recurring/High Priority）的完整 Test Gate 确认——通过
 * 后再进入 Slice 3（Note Edit）。
 */

// ============================================================
// 三十、Slice 1 + 2 完整 Test Gate 收尾确认（2026-09-04，同日）
// ============================================================

/**
 * Carson 确认：This Week/Upcoming/Recurring/High Priority 四个分区测试
 * 通过。至此二十六章列出的 Slice 1 + Slice 2 完整 Test Gate/Regression
 * Gate 清单全部转为 LIVE VERIFIED PASS，不再有分区级别的未确认项——
 * 二十九章记录的"未确认、不阻塞"状态在这里正式解除，不是被延后处理。
 *
 * 下一步：Slice 3（Note Edit）正式开始，设计沿用
 * Personal_Life_OS_UIV2_Implementation_Plan_2026-09-01.md；开始前先对
 * 29_NoteEngine.js / 10_ProjectionEngine.js / 50_UIBridge.js /
 * ui_index.html 做一次现状核对，不假设文档描述与现在的代码一致。
 */

// ============================================================
// 三十一、Slice 3（Note Edit）交付（2026-09-04）
// ============================================================

/**
 * 开工前按惯例先核对了现状（不是直接照抄 Implementation Plan 的设计
 * 假设代码没变）：29_NoteEngine.js 确认截至开工时只有 create/archive/
 * markConverted_，没有 update；10_ProjectionEngine.js 确认 NOTE_CREATED/
 * NOTE_ARCHIVED/NOTE_CONVERTED 三个 case 都在但没有 NOTE_UPDATED；
 * 参照了 27_ProjectEngine.updateProject 与 50_UIBridge.ui_updateProject
 * 的完整实现作为结构模板（结构复用，不是代码复制，字段/校验逻辑按
 * Note 自己的 Schema 重新写）。
 *
 * 交付范围，跟 Implementation Plan「Slice 3」的文件改动表逐条对应：
 *
 * 1. `29_NoteEngine.js`：新增 `updateNote(noteId, changes, chatId)`。
 *    `UPDATABLE_FIELDS = ['content', 'category']`；`LifeNoteConfig` 新增
 *    `IDENTITY_AFFECTING_FIELDS: ['content', 'category']`（两个可编辑
 *    字段同时也是全部的身份影响字段，因为 Note 没有独立于这两者之外的
 *    身份维度）。`FORBIDDEN_FIELDS` 校验原样复用，携带 due_date 等字段
 *    时显式 throw（不是静默过滤），报错文案跟 createNote 一致，满足
 *    Implementation Plan Test Gate 里"报错行为跟 Create 时一致"这条。
 *    `category` 值不在 `NOTE_CATEGORIES` 枚举里时该字段静默不写入（这一
 *    条不 throw，跟 updateProject 对 execution_mode/source_domain 非法值
 *    的处理方式一致——只有 FORBIDDEN_FIELDS 才 throw，枚举越界是"忽略
 *    这个字段"，两者不是同一类校验失败）。`deriveFromEvent` 补上
 *    `NOTE_UPDATED` 分支（`11_ProjectionRebuilder` 重放用），不补的话
 *    重放出来的状态会缺失更新过的 content/category，是真实的正确性
 *    问题，不是顺手锦上添花。
 *
 * 2. `10_ProjectionEngine.js`：dispatch 新增 `NOTE_UPDATED` case，新增
 *    `projectNoteUpdated_`，实现跟 `projectProjectUpdated_`/
 *    `projectWorkflowUpdated_` 完全同一个模式（payload 里只有变化字段，
 *    删掉 note_id 后原样 upsert，不是重新查一遍全量再整体覆写）。
 *
 * 3. `50_UIBridge.js`：新增 `ui_updateNote(noteId, changes,
 *    _testOverrides)`，跟 `ui_updateProject` 同一个模式（先查存在性，
 *    再调用 Engine，返回值套 `_sanitizeTaskDatesForTransport_`——updated
 *    的字段本身都不是 Date，套上纯粹是跟随本项目"transport 边界统一走
 *    这层防护"的既定规则，不是这次发现了新的 Date 风险）。
 *
 * 4. `ui_index.html`：Notes 卡片新增 Edit 表单——一个 `textarea`（content）
 *    + 一个 `select`（category，五个枚举值内联生成 `<option>`，没有像
 *    OS 下拉那样抽一个共用 helper，因为目前只有这一处用到）。键盘行为
 *    跟 Task/Project 的 textarea 完全同款：只认 Ctrl/Cmd+Enter 保存，
 *    普通 Enter 交给浏览器自己处理成换行（textarea 原生行为，不需要
 *    额外拦截）。
 *
 * 本轮范围之外、刻意没做的事（如实记录，不是遗漏）：
 *   - Create（`ui_createNote`/Add Note 输入框）现在仍然不能指定
 *     category，新建的 Note 一律落到默认值 'IDEA'——Implementation Plan
 *     的文件改动表只列了 Edit 相关的 4 个文件，没有把 `ui_createNote`
 *     或 Create 表单列进去，所以没有主动加。如果 Carson 想要 Create
 *     也能选 category，是一个很小的独立追加，不在本次范围内先斩后奏。
 *   - Note 卡片折叠视图本身没有新增 category 徽章类的展示——
 *     Implementation Plan 只要求"新增 Edit 能力"，没有要求"让折叠视图
 *     展示 category"，两者是不同的改动，没有因为 Task/Project 卡片有
 *     徽章就顺手也给 Note 加一个。
 *
 * 【治理文档归属修正，非代码改动，值得单独记录】Implementation Plan
 * 原文"完成后需要更新 00_Command_Reference.gs"这一条，跟
 * 00_Command_Reference.gs 自己文件头「目的」段落的分工规则相矛盾——
 * 该文件头明确规定"已实现但暂未通过 Telegram 暴露的能力"不放在那份
 * 文件（原文举的例子正是 updateTask()），而是记在 00_Known_Limitations.
 * gs。updateNote 是同一条排除规则下的同类项（Note 域至今没有任何
 * Telegram 指令，不止 updateNote 一个函数），且 grep 确认 updateTask/
 * updateProject 至今也确实都没有被加进 Command Reference，此前没有
 * 例外。按治理文件自己的规则走，没有照 Implementation Plan 字面指示去
 * 改 Command Reference，改在了 00_Known_Limitations.gs「七」，并在该节
 * 末尾写明了这处不一致的具体理由，供以后对照。
 *
 * 验证状态：
 *   - 29_NoteEngine.js / 10_ProjectionEngine.js / 50_UIBridge.js /
 *     ui_index.html（<script> 部分单独抽出验证）：node --check 全部
 *     通过。
 *   - STATIC VERIFIED，LIVE TEST PENDING——GAS/Sheets/浏览器环境不在
 *     本窗口手边。Implementation Plan 列出的 Test Gate（改 content/
 *     category 正确重算 identity 且 note_id 不变；尝试设置 due_date 等
 *     禁止字段被拒绝；NOTE_UPDATED 事件正确落到 Sheet 行）和 Regression
 *     Gate（既有 create/archive/convert 不受影响）都还没有实机跑过，
 *     需要 Carson 部署后确认。
 *
 * 下一步：等 Slice 3 实机确认；之后按 Implementation Plan 的顺序进
 * Slice 4（Conversion）——Part A（Task→Project BLOCKED、Project→Task UI
 * 整合确认）可以直接开始，因为 ADR-2026-09-02-028 本身就是批准（不需要
 * 再等一次批准）；Part B（Task→Note）在 ADR-2026-09-02-030 正式定稿、
 * 状态改成 Accepted 之前不能先写代码。
 */

// ============================================================
// 三十二、Slice 4 Part A（Task→Project BLOCKED）交付（2026-09-04）
// ============================================================

/**
 * Carson 当时在外送外卖，无法做 LIVE TEST，明确指示不要因此阻塞、不要
 * 预防性修 Slice 3、不要做无关重构，直接进 Slice 4 Part A。
 *
 * 开工前核对现状（不是照抄 ADR-028 写的时候的代码快照）：确认
 * `42_ConversionEngine.convertTaskToProject`/`convertProjectToTask` 双向
 * 转换本身早已实现（Sprint 3），这次要加的只是"源 Task 带日期时
 * BLOCKED"这一条新检查，不是从零搭转换流程；Task→Project 的 UI 入口
 * （按钮/端点）也早就存在。全项目 grep 确认 `convertTaskToProject` 只有
 * `ui_convertTaskToProject` 一个调用方（另外两处在测试文件里），Telegram
 * 侧（06_TaskIntentParser.gs）没有任何调用——「不要影响 Telegram
 * contract」这条约束在改动前就已经天然满足，不是靠这次改动维持的。
 *
 * 交付范围：
 *
 * 1. `42_ConversionEngine.js`：`convertTaskToProject` 的幂等分支之后、
 *    创建 Project 之前，新增一条检查——`sourceTask.due_date` /
 *    `due_time` / `due_datetime` 任一非空时，直接
 *    `return { blocked: true, reason: '...' }`，不创建 Project、不标记
 *    源 Task、不发布任何事件。放在幂等分支之后是有意为之：已经转换过的
 *    Task 不该因为带日期，在重复调用时从"返回既有 Project"变成
 *    "BLOCKED"——幂等优先于这条新规则。写法上镜像
 *    `convertProjectToTask` 里 `checkEligibleForTaskDemotion_` 不通过时
 *    `return {blocked:true, reason:...}` 的既有风格，不是发明一种新
 *    形状。顺手修正了这个函数 JSDoc 里从来没对过的 `@returns`（原来写
 *    `invalid_state`，这个函数从未返回过这个值，是最初写文档时就没对上，
 *    不是这次引入的偏差）。
 *
 * 2. `50_UIBridge.js`：`ui_convertTaskToProject` 新增
 *    `if (result.blocked) return {ok:false, code:'BLOCKED', message:
 *    result.reason};`，跟 `ui_convertProjectToTask` 处理 ADR-015 那个
 *    blocked 分支的写法完全同一个模式。顺带更新了 `ui_convertProjectToTask`
 *    上方一条现在过时的注释——原文说"Project→Task 有 Task→Project 没有
 *    的第三种结果"，这句话在这次改动后不再成立，已改写清楚两个方向
 *    现在都有 blocked，只是触发原因不同。
 *
 * 3. `ui_index.html`：Task 卡片新增 `.item-blocked-reason` 元素——
 *    跟 Project 卡片一模一样的 CSS class、一模一样的默认隐藏
 *    `style="display:none;"`，不是新发明一套样式。`convertTaskToProject()`
 *    这个前端函数新增 `result.code === 'BLOCKED'` 分支，命中时把
 *    `result.message` 写进这个卡片内联元素、`display:block`，不进
 *    `tasksStatus` 那条通用错误状态行——跟 `convertProjectToTask()`
 *    现有的处理方式逐行对应，是复制这个已经验证过的模式，不是重新设计
 *    一套"BLOCKED 应该怎么呈现"。
 *
 * 4. `00_Business_Rules.js`「一」、`00_ADR.js` ADR-028：把两处明确写着
 *    "代码尚未实现"的状态声明更新为"已实现，见本节"，原文保留未删——
 *    这两处当时写的是真实状态，不是错误，删除会丢失"这条规则曾经有多久
 *    是纯文档状态"这个信息。
 *
 * Task→Note Part B：本轮没有碰。没有新增 UI 按钮、没有写任何转换
 * semantics、没有预先决定 ADR-030 该怎么答。ADR-030 现状：Status 仍是
 * Proposed（占位），Decision 部分列的是问题清单不是答案，本轮没有去
 * 回答这些问题——这不是本轮的授权范围。
 *
 * 其它明确冻结项，本轮确认全部保持不动：Project Deadline Contract、
 * Drag Ordering/UI-I6、source_domain 历史数据 migration、OS_REGISTRY
 * 扩大、25_DashboardEngine.js（Telegram）、Quick Add——grep 确认这几个
 * 文件/能力这次都没有被触碰。
 *
 * Regression 检查（针对"不带日期的 Task→Project"这条现有路径）：
 *   - 新检查是幂等分支之后新插入的一条 early-return，不带日期的 Task
 *     命中条件为 false，直接跳过，落到 `projectMeta = projectMeta || {}`
 *     往后——这一段和这次改动之前逐字节相同，没有改动。
 *   - `36_Tests_Sprint3Acceptance.js`（`testBidirectionalConversion_`）和
 *     `38_Tests_UIBridge.js`（3 个 convertTaskToProject 相关用例）逐一
 *     核对：全部用 `TaskEngine.createTask(title, {}, chatId)` 创建测试
 *     Task，`{}` 空 meta 意味着这几个测试 Task 都没有 due_date，不会
 *     命中新检查，预期结果不变。这几个测试目前也没有一条覆盖"带日期
 *     被 BLOCKED"这个新分支本身——如实记录这是一个测试覆盖空白，不是
 *     这次顺手补的（本项目至今没有本地 GAS mock/测试运行基础设施，
 *     这几个 `36_`/`38_` 文件本来就是要在 Apps Script 里跑的，这次也
 *     没有新建一个）。
 *   - 全项目 `.js` 文件跑了一遍 `node --check`，没有一个失败——确认
 *     这次改动没有波及任何其它文件。
 *
 * identity/projection/event 影响：三者都没有被触碰。BLOCKED 分支是
 * 纯粹的提前 return，不调用 `ProjectEngine.createProject`、不调用
 * `TaskEngine.markTaskConverted_`、不发布任何 Event——没有创建就没有
 * identity 要算，没有事件就没有 projection 要写。不带日期的既有路径
 * 完全没有改动，identity/projection/event 行为原样不变。
 *
 * 验证状态：
 *   - 42_ConversionEngine.js / 50_UIBridge.js / 00_Business_Rules.js /
 *     00_ADR.js：node --check 通过；ui_index.html 的 `<script>` 部分
 *     单独抽出验证同样通过；全项目 `.js` 扫了一遍，无一失败。
 *   - STATIC VERIFIED（代码逻辑 + 既有测试用例的静态核对）。
 *   - LIVE TEST PENDING——GAS/Sheets/浏览器环境不在这次窗口手边，
 *     需要 Carson 送完外卖回来后实机确认（清单见给 Carson 的报告）。
 *   - 不属于 STATIC VERIFIED 也不属于 LIVE TEST PENDING 的：NOT
 *     TESTED——带日期 Task 被 BLOCKED 这个新行为本身，除了逐行读代码
 *     推演，没有任何自动化测试或实机验证覆盖过，如实记录，不写成 PASS。
 *
 * 下一步：等 Slice 4 Part A 实机确认。Part B（Task→Note）在 ADR-030
 * 定稿 Accepted 之前不能开始写代码——现状是占位、问题清单，不是可以
 * 直接实施的设计。
 */

// ============================================================
// 三十三、ADR-2026-09-02-030 正式起草（2026-09-04，仍是 Proposed）
// ============================================================

/**
 * Carson 指示：Slice 4 Part A 保持 STATIC VERIFIED/LIVE TEST PENDING
 * 不动（人在外面送外卖，不能 LIVE TEST，明确不要因此停下，也不要
 * 预防性修改 Part A），转入 ADR-030 的正式 Design/Decision 阶段。
 *
 * 起草前重新审计了 11 项指定范围：Task/Note 数据模型、
 * 29_NoteEngine.gs、20_TaskEngine.gs、42_ConversionEngine.gs、
 * 50_UIBridge.gs、10_ProjectionEngine.gs、Identity/Dedup contract、
 * Event/Projection contract、既有 Task↔Project 先例、刚交付的
 * updateNote() 完整 lifecycle——不是照抄 2026-09-02 占位版本的假设。
 *
 * 关键证据（完整版见 ADR-030 本体 Context 段）：Task 42 个字段 vs Note
 * 19 个字段，schema 差距远大于当年 Task↔Project 那次；identity/dedup
 * 按 Sheet 隔离，Task 跟 Note 之间不存在碰撞风险；Task 的转换血缘走
 * "每类型一个专属字段"（`converted_to_project_id`）+"每方向一个专属
 * 事件名"（`TASK_CONVERTED_TO_PROJECT`），跟 Note 那套通用
 * type/id+单一事件名是两套不同但各自成立的既有习惯，这次跟 Task 侧
 * 保持一致；`convertTaskToProject`现有实现"先创建目标、后检查源
 * terminal-state"这个顺序本身可能让 terminal 状态的源 Task 产生孤儿
 * Project——这不属于本次范围（是既有代码既有行为），但 Task→Note 的
 * 顺序设计特意没有复制这个缺陷。
 *
 * ADR-030 结论：A/B/C 三组问题（Conversion Semantics、Data Mapping、
 * Identity/Event/Projection）已经有证据支撑的明确答案，完整写进了
 * ADR 本体，不是问题清单了。但还剩 D 组 5 个真正的产品判断题——
 * `recurring`/`priority`/`budget` 三个字段该 BLOCK、拼进文本、还是
 * 静默丢；`project_id`/`workflow_id`/`parent_task_id`/
 * `depends_on_task_ids`/`branch_group` 这类结构性关联字段是否需要
 * 比现有 Task→Project 先例更严格的处理；是否需要转换前 UI 确认弹窗——
 * 这些不是证据不够，是证据同时支持几种都合理的答案，按 Carson 的明确
 * 指示（不要为了看起来完整而强行 Accepted），这次没有替他单方面拍板，
 * 状态维持 **Proposed**。
 *
 * 下一步不是"继续起草"，是等 D 组 5 个问题的答案——一旦回答且跟 A/B/C
 * 组不冲突，可以直接把 ADR-030 状态改成 Accepted，不需要重新起草整份
 * ADR。Slice 4 Part B 在那之前不得开始写代码。
 */

// ============================================================
// 三十四、ADR-2026-09-02-030 由 Carson 正式拍板 D 组，转为 Accepted
//    （2026-09-04，仍无 Part B 代码）
// ============================================================

/**
 * Carson 直接给出 D1-D5 的正式 Decision（不是让本窗口继续起草问题），
 * 同时明确指示：完成一致性检查后如果通过，把 ADR-030 状态改成
 * Accepted；但 Accepted 之后必须停在 SLICE_4_PART_B — IMPLEMENTATION
 * READY，不得在本轮开始任何 Part B 代码（convertTaskToNote/UIBridge/
 * UI/Projection/schema migration 全部不做），等他另外明确指示再单独
 * Proceed。Slice 4 Part A 与 Slices 1/2/3/4A 的 LIVE TEST PENDING
 * 状态本轮不因为 ADR 工作而改变。
 *
 * D1-D5 摘要（完整决定文本见 ADR-030 本体 D 组）：recurring 非空
 * BLOCKED；priority/budget 非默认/非空时不建 Note 独立字段，作为
 * content 注解保留，不 silent drop；project_id/workflow_id/
 * parent_task_id/depends_on_task_ids/sequence_index/branch_group/
 * branch_resolution_policy 比 Task→Project 更严格——同样不建 Note
 * 独立字段、非空时保留为 content 注解，只留 source_task_id +
 * converted_to_note_id 两条明确 lineage，不复制 Task 的 execution
 * graph 进 Note，这条不追溯到既有 Task→Project；转换前 UI
 * Confirmation 必须有，流程明确为 Convert to Note → Confirmation →
 * Validate → Execute，BLOCKED 判断必须发生在真正创建/修改之前。
 *
 * D 组拍板后做了一次逐字段复核（不是走过场）：把 Task 全部 42 个字段
 * 重新过了一遍，发现此前 A/B/C 草稿漏列了 4 个字段的处置——`context`
 * （并入 B1 的 content 拼接）、`tags`（跟 priority/budget 同档，
 * content 注解保留）、`priority_ai_recommended`（现状全项目没有任何
 * Producer 写过这个字段，当前实际永远为空，如实记录不是"决定丢弃"）、
 * `source_project_id`（Task 自己更早一层的转换血缘，跟 D4 同档处理）。
 * 已经全部补写进 ADR-030 的 B5 小节，不是遗漏不补，是发现即补。
 *
 * Consistency Check 结果（完整版见 ADR-030 本体，逐条编号对应
 * Carson 要求的 6 项检查）：D 组跟 A/B/C、Architecture Freeze、
 * ADR-028、既有 Note lifecycle 均无冲突；Task→Project 与 Task→Note
 * 的差异（有无 Confirmation、BLOCK 清单范围、结构性字段处理方式）
 * 已经清楚写在 ADR 里；identity/event/projection/lineage（C 组）
 * 完全没有被 D 组触碰，保持一致；silent data loss 审计（见上一段）
 * 确认没有遗留未处置的字段。全部通过，无需要求 Carson 重新决策的
 * 冲突项。
 *
 * ADR-030 状态：**Accepted**（2026-09-04）。本轮改动范围仅
 * `00_ADR.gs`/本文件两个治理文件，`42_ConversionEngine.gs`/
 * `50_UIBridge.gs`/`ui_index.html`/`20_TaskEngine.gs`零改动——
 * Accepted 不等于开始实施，ADR 本体已经列出完整 Implementation
 * Gate（8 项）。
 *
 * 当前检查点：**SLICE_4_PART_B — IMPLEMENTATION READY**。下一步不是
 * 自动继续写代码，是等 Carson 另外明确指示 Proceed Part B。Slice 4
 * Part A 保持原状不动（STATIC VERIFIED / LIVE TEST PENDING）；
 * Slice 1/2/3/4A 的 LIVE TEST PENDING 状态本轮未变。
 */

// ============================================================
// 三十五、Slice 4 Part B（Task→Note）实现交付（2026-09-04）
// ============================================================

/**
 * Carson 正式指示 Proceed，给出详细 dependency order + 十四项具体要求。
 * 开工前先做了一次全项目扫描（不是假设"什么都还没做"）——发现
 * `20_TaskEngine.gs` 的 schema（`converted_to_note_id`）、
 * `markTaskConvertedToNote_`、`deriveFromEvent` 的
 * `TASK_CONVERTED_TO_NOTE`分支、以及 `00_Sheets_Structure.gs`的
 * changelog 记录**已经存在**，风格、命名、跟 ADR-030 的引用全部一致。
 * 逐行审计这部分（终态检查、幂等判断、event publish +
 * materializeTaskRow_ fallback、deriveFromEvent 分支）后确认实现正确、
 * 跟 `markTaskConverted_`既有模式完全对应，未发现问题，本轮直接在
 * 这个基础上继续，没有重复造轮子，也没有不加审计就假设它是对的。
 *
 * 本轮新实现（此前确实不存在，全部从零写的部分）：
 *
 * 1. `42_ConversionEngine.gs`：`convertTaskToNote(taskId, noteMeta,
 *    chatId)`。校验顺序：存在性 → 幂等/已转换检查 → 非终态检查 →
 *    B2+D1 的 BLOCKED 字段检查，全部通过才建 Note——没有复制
 *    `convertTaskToProject`现在"先建目标再查源状态"的顺序。content
 *    拼接完整实现 ADR-030 B1（title+context+notes+description 主体）+
 *    B3/B5/D2/D3/D4（category/priority 非默认/budget/tags/
 *    project_id/workflow_id/parent_task_id/depends_on_task_ids/
 *    sequence_index（0 是合法值，用 !==null 判断不用真值判断）/
 *    branch_group/branch_resolution_policy/source_project_id/
 *    priority_ai_recommended 作为注解，一条都没有就不加这段）。
 *
 * 2. `50_UIBridge.gs`：`ui_convertTaskToNote`，`blocked`跟
 *    `invalid_state`统一转成 `code:'BLOCKED'`（对 UI 是同一类"正常
 *    业务规则提示"，不细分子类型）。
 *
 * 3. `10_ProjectionEngine.gs`：`TASK_CONVERTED_TO_NOTE` dispatch case +
 *    `projectTaskConvertedToNote_`（完整镜像
 *    `projectTaskConvertedToProject_`，**包括从 ACTIVE_TASKS_SHEET
 *    删除这一步**——这步不是可选的，不删的话源 Task 转成 Note 后还会
 *    继续出现在依赖 ActiveTasks 的 active views 里，直接违反 Carson
 *    第七项"source Task 不会继续被当作未处理 Task"的要求）+
 *    `TIMELINE_ENTITY_MAP`登记。核对过 `materializeTaskRow_`
 *    fallback 路径本身已经按 status 是否终态通用处理 ActiveTasks
 *    清理，不需要额外补。
 *
 * 4. `ui_index.html`：Task 卡片新增 "Convert to Note" 按钮 + 一个新的
 *    `.confirm-form`（复用跟 `.edit-form`/`.capture-form`/
 *    `.create-form`同一条 CSS 规则加一个新 class，不是另写一份重复
 *    样式）承载确认文案 + Cancel/Confirm 两个按钮。流程严格是
 *    Intent（点 Convert to Note）→ Confirmation（弹出确认框，这一步
 *    零 server 调用）→ 用户点 Confirm 才调 `ui_convertTaskToNote`
 *    → Domain 侧做真正的 BLOCKED/Validate 判断。点 Cancel 只是收起
 *    确认框，没有任何 `google.script.run`调用，零 mutation。BLOCKED
 *    复用既有 `.item-blocked-reason`，系统级错误走既有 `tasksStatus`
 *    错误状态行——两者路径分开，跟 Slice 4 Part A 同款。UI 本身不
 *    判断 recurring/due_date 之类的业务规则，只负责 Intent→
 *    Confirmation→UIBridge 这一段。
 *
 * 5. `54_Tests_TaskToNoteConversion.gs`（新文件，编号接续现有测试
 *    文件里最大的 53）：Carson 要求的 14 项里，13 项可由 GAS 服务端
 *    验证的全部覆盖（BLOCKED 五个字段各自触发+不产生 Note；成功转换
 *    产生恰好一条 Note、source_task_id/converted_to_note_id 正确；
 *    事件确实发布、projection 确实落地；`deriveFromEvent`重放结果跟
 *    实时 projection 一致——刻意没有调用全局的
 *    `rebuildTasksProjection()`，那个不按 chatId 隔离、会重建整张
 *    Sheet，拿来跑一次范围很小的验收测试不合适，改成直接对
 *    `deriveFromEvent`喂一个真实发布过的事件、在纯内存 stateMap 上
 *    验证，更小、更安全、也更针对性；重复转换幂等）。第 14 项
 *    （confirmation cancel 零 mutation）是纯前端 JS 行为——点 Cancel
 *    时代码根本不发 HTTP 请求，这一层没有服务端测试能验证的对象，
 *    如实记录为需要人工在浏览器里确认，不是遗漏。
 *
 * 6. 顺手修正 `00_Business_Rules.gs`「十一」一处现在过时的
 *    "尚未实现的 Task→Note"措辞——这是一句忠实反映"这条原则确立时
 *    Task→Note 还没做"的历史陈述，因为过时而更新，不是发现了错误。
 *
 * 【Transactional Safety 审计——如实记录，没有假装 GAS/Sheets 有
 * 数据库事务，也没有为了看起来完整发明不存在的机制】
 *
 * 失败窗口 A：Note 创建成功，但紧接着的 `markTaskConvertedToNote_`
 * 没能跑完（脚本超时/崩溃/配额等，在两个顶层 Engine 调用之间发生，
 * 不是某一次 Sheets API 调用内部的失败）。结果：Note 独立存在，源
 * Task 停留在原状态（不是 CONVERTED）。核对后发现这个风险**部分被
 * 现有基础设施缓解**：`NoteEngine.createNote`走的是
 * `IdempotencyManager.createNoteIfNotExists`，先按
 * `generateNoteIdentity(chatId, content, category)`查重——只要重试时
 * 源 Task 字段没被改动过，content 是确定性拼出来的，重试会命中同一个
 * identity、返回同一条 Note，不会产生第二条重复 Note。**没有被完全
 * 消除的部分**：源 Task 在重试成功之前会一直显示为"未转换"，用户
 * 可能会困惑（Note 已经在、Task 却还显示活跃）——这跟既有
 * `convertTaskToProject`同一种失败窗口下的风险是同一类，不是这次
 * 新引入的、独有的缺陷，本轮没有为此新增重试/告警机制。
 *
 * 失败窗口 B：`markTaskConvertedToNote_`内部 `EventBus.publish`——
 * 事件本身写入 Events 表（append，独立一步）成功，但紧接着同步触发
 * 的 `ProjectionEngine.dispatch`（把 status/converted_to_note_id 真的
 * 写进 Task 行）失败。核对 `02_EventBus.gs`确认这条路径**已经有完整
 * 处理**：`event.projection_ok`会被置为 false，调用方
 * （`markTaskConvertedToNote_`）据此触发 `materializeTaskRow_`兜底
 * 直写；就算这次兜底也失败，Events 表里的事件是真实、完整写入的，
 * `rebuildAllProjections()`可以事后从事件历史重建正确状态——这条
 * 恢复路径是既有基础设施，不是本轮新造的。
 *
 * 结论：两个失败窗口都如实记录，窗口 A 有部分缓解但不完整、窗口 B
 * 基本有完整的既有恢复路径，都不是这次转换特有的新缺陷，是这个
 * 没有真实 transaction 的架构本身的既有特性，跟 `convertTaskToProject`
 * 一直以来承担的风险是同一类。
 *
 * Regression 检查：全项目 `.js`（含新增的
 * `54_Tests_TaskToNoteConversion.gs`）node --check 全部通过。本轮
 * 全部改动是新增函数/新增 case/新增 UI 元素，**没有修改任何既有函数
 * 的函数体**（唯二例外是两处纯注释的文档状态更正，见上文第 6 点）。
 * 逐一核对了会创建 Task 的既有测试文件（35/36/38/39/51/53），确认
 * 没有一个测试给 Task 设置 `recurring`，本轮改动不会让它们的行为
 * 发生变化。`convertTaskToProject`/`convertProjectToTask`/
 * `convertNoteToTask`/`convertNoteToProject`/
 * `convertNoteToGoalCandidate`五个既有转换函数、Note 的
 * create/archive/update/convert 全部生命周期、Task 的
 * Done/Cancel/Dashboard/Query/Identity、EventBus/Projection/
 * ProjectionRebuilder/Timeline/Deduplication 基础设施、
 * `25_DashboardEngine.gs`（Telegram）——本轮都没有一行代码涉及。
 *
 * 验证状态：
 *   - 全部新增/改动代码：node --check 通过（STATIC VERIFIED）。
 *   - `54_Tests_TaskToNoteConversion.gs`的 5 个测试函数：只是写好了，
 *     **没有在真实 GAS/Sheets 环境里跑过**——如实记录为 NOT TESTED，
 *     不是 PASS，需要 Carson 部署后手动执行
 *     `runTaskToNoteConversionGate()`确认。
 *   - 第 14 项（confirmation cancel）：NOT TESTED，需要人工浏览器
 *     确认（打开网络面板，点 Cancel，确认没有请求发出）。
 *   - 完整功能（Convert to Note 按钮点击 → 确认 → 转换成功/BLOCKED
 *     的实际视觉呈现）：LIVE TEST PENDING，浏览器环境不在本窗口手边。
 *
 * Scope Freeze 确认：本轮没有碰 ADR-031、Drag Ordering/UI-I6、Project
 * Deadline Contract、source_domain migration、Quick Add、Note
 * category Create enhancement、category 徽章、Telegram
 * DashboardEngine、也没有做任何跟这次任务无关的重构或"通用 conversion
 * 抽象框架"。
 *
 * 下一步：等 Carson 部署后跑 `runTaskToNoteConversionGate()` +
 * 浏览器手动验证 UI 流程（含第 14 项）。Slice 4 Part A 与 Slices
 * 1/2/3 的 LIVE TEST PENDING 状态本轮未变。
 */

// ============================================================
// 三十六、Slice 5（Performance）实现交付（2026-09-07）
// ============================================================

/**
 * 背景：Carson 本轮外出送外卖，明确指示"不要因为 LIVE TEST PENDING
 * 而停止独立的架构/开发工作"，要求先做 NEXT WORK DISCOVERY 再动手。
 * 核查结论（过程见对话记录，不重复于此）：Slice 3/4A/4B 都已代码
 * 完成，只差 Carson 的 LIVE TEST，没有新代码可写；Known Limitation
 * 「八」按 Carson 明确指示保持 DEFERRED，不碰；扫描 00_ADR.gs 全部
 * ADR（001~030）没有发现"已 Accepted 但代码尚未实现"的漏项；
 * `Personal_Life_OS_UIV2_Implementation_Plan_2026-09-01.md`开头明确
 * 写"Slice 3（Note Edit）和 Slice 5（Performance）跟其它 Slice 相对
 * 独立，理论上可以跟 Slice 2/4 并行"——Slice 5 是本轮唯一同时满足
 * "已被 Plan 文档具体批准"+"不依赖 Carson 实测环境"两个条件的候选，
 * 不存在需要 Carson 裁决的多候选局面，直接按 Plan 该节的具体文件表
 * 开工。
 *
 * 实现内容（严格对照 Plan 该节的文件表，没有扩大范围）：
 *
 * 1. `50_UIBridge.gs`：新增私有辅助函数 `_perfLog_(fnName, checkpoint,
 *    t0)`，纯 `Logger.log`，不做任何判断、不改变任何返回值。在
 *    `ui_createTask`/`ui_createProject`/`ui_createNote`/
 *    `ui_updateTask`/`ui_updateNote` 五个函数里各自打点：start →
 *    （update 两个函数多一层 before/after_existence_check）→
 *    before/after_engine_call → end；catch 分支补一个 end_error。
 *
 *    **如实记录一处范围局限**：Plan 原文要求"Dedup 检查前后、Engine
 *    写入前后、Event/Projection 前后"三段分别计时，但这五个函数从
 *    UIBridge 层看，对 Engine 的 create 系/update 系函数的调用都是
 *    一次不透明调用——Dedup（09_IdempotencyManager.gs/
 *    08_DeduplicationEngine.gs）、Sheet 写入、Event 发布、Projection
 *    全部在 Engine 内部完成，
 *    UIBridge 看不到三者之间的边界。按 Plan 同一节"这个 Slice 刻意不
 *    改动任何 Domain/Engine 层业务逻辑"+ Carson 本轮反复强调的"不要
 *    顺手改无关文件"，本次没有进 Engine 文件内部加更细的埋点，只在
 *    UIBridge 层能看到的粒度打点。结果是 before_engine_call →
 *    after_engine_call 这一段是 Dedup+写入+Event+Projection 四者的
 *    合计耗时，不是分离的三个数字。如果 Carson 实跑后发现这段合计
 *    耗时是主要瓶颈、需要知道具体是哪一步慢，需要另外明确授权在对应
 *    Engine 文件内部加埋点（同样只加日志）——这不是本次遗漏，是范围
 *    边界的必然结果，已在 `_perfLog_` 函数头注释里同样记录。
 *
 * 2. `ui_index.html`：新增辅助函数 `_buildPendingCardEl_(label,
 *    titleText)`，返回一个非交互的最小占位卡片（只有标题文本 + 一个
 *    "Saving X…" 徽章，没有 Done/Edit/Convert 等任何按钮）。三处
 *    Create 入口（`addNote`/`submitCreateTask`/`submitCreateProject`）
 *    改成：点 Save 后立刻——插入占位卡片到列表最前面、清空/重置表单
 *    全部字段、聚焦标题输入框；按钮保持 disabled 直到真实响应回来
 *    （成功/失败两个 handler 里才重新启用，双击 Save 的第二次点击在
 *    按钮重新启用之前不会发出）；成功时不单独移除占位卡片——
 *    `loadTasks()`/`loadProjects()`/`loadNotes()`本身会整份重新渲染
 *    列表，占位卡片作为旧内容一并被替换掉，天然满足"用真实数据替换"；
 *    失败时（含服务端返回 `ok:false`和网络层失败两种情况）用既有的
 *    `removeCard()`显式移除占位卡片，不会留下幽灵重复行。
 *
 *    **如实记录三处判断/取舍，供 Carson 复核**：
 *
 *    (a) 乐观 UI 只做了三个 Create 入口，没有碰
 *    `ui_updateTask`/`ui_updateNote`对应的两个 Edit-in-place 表单。
 *    理由：Plan 该节"清空表单+聚焦标题"、Test Gate"不留下幽灵重复
 *    行"这些措辞在语义上对应的是"新增一行"的 Create 场景，Edit 场景
 *    是"就地修改已存在的一行"，乐观回滚需要缓存修改前的完整字段状态
 *    才能正确还原，跟 Create 场景的"移除临时行"是不同的机制，Plan
 *    没有具体描述这套机制，本次没有自行发明。
 *
 *    (b) 占位卡片刻意做成非交互的最小展示，没有复用
 *    `renderTasks`/`renderProjects`/`renderNotes`里那套完整卡片（各自
 *    带 Done/Edit/Convert/Capture/AI 建议等 8~11 个事件监听器）。
 *    理由：那些按钮全部需要一个真实的 task_id/project_id/note_id 才能
 *    安全操作，乐观阶段还没有真实 ID，把这些按钮接到一个临时假 ID 上
 *    是不安全的（比如点了 Done 会拿假 ID 去调真实的
 *    `ui_completeTask`）。
 *
 *    (c) 失败时不回填表单字段原值（只清空+插占位卡+失败后移除占位
 *    卡+提示错误，不恢复用户刚输入的内容）。理由：Plan 原文只写"移除
 *    临时对象+提示错误"，没有要求回填；如果要回填，又要考虑"用户在
 *    等待期间是否已经在清空后的输入框里重新打字"，回填会覆盖这部分
 *    新输入——按字面范围做最简单的版本，没有额外发明这层没被要求的
 *    行为。
 *
 *    (d) 【重要，需要 Carson 明确确认】开工前审计代码时，在
 *    `submitCreateTask`函数里发现一条 Slice 1（2026-09-01）时期留下的
 *    旧注释，原文大意是"这次 refocus 用的是真实 server 响应，不是
 *    乐观猜测——更完整的感知延迟修复是 Slice 5，以实测计时数字为
 *    门槛"，字面意思跟本节开头"再决定优化什么"那句一起看，可以理解成
 *    "乐观 UI 本身也要等 Carson 拿到实测数字才能做"。本次没有采用这个
 *    更保守的读法，理由：Plan 该节的文件表对 `ui_index.html`给出的是
 *    一套具体、完整、自带 Test Gate 的乐观 UI 设计（临时对象/清空表单
 *    /聚焦标题/成功替换/失败回滚/防双击），不是"等数字出来再设计"的
 *    占位描述；而且乐观 UI 这个技术本身跟"瓶颈具体在哪"无关——它是
 *    无论延迟来自哪一步都通用的感知延迟遮蔽手段，"再决定优化什么"
 *    更可能指的是拿到数字之后可能触发的**后端**优化决策（比如本节
 *    "哪些文件不能动"提到的 identity→行号旁路索引那类，需要独立 ADR）
 *    ，不是这次前端优化本身。这条旧注释本身没有被修改或删除（继续
 *    保留在 `submitCreateTask`里，作为历史记录），但如实记录这处解读
 *    分歧，如果 Carson 认为应该是更保守的读法，这次的乐观 UI 部分需要
 *    回退。
 *
 * Regression 检查：`09_IdempotencyManager.gs`/
 * `08_DeduplicationEngine.gs`/`07_IdentityEngine.gs`三个文件本轮
 * 零改动（grep 确认过没有被 touch）；`_perfLog_`/
 * `_buildPendingCardEl_`都是新增函数，没有修改任何既有函数的判断
 * 逻辑或返回值——五个被打点的 UIBridge 函数、三个被乐观化的 Create
 * 入口，函数体内原有的每一处判断分支/返回结构原样保留，只插入了
 * Logger.log 调用和（HTML 侧）DOM 操作。全项目 `.js`
 * node --check 全部通过；`ui_index.html`的 `<script>`部分单独抽出
 * 再次 node --check 通过。
 *
 * Scope Freeze 确认：本轮没有碰 Known Limitation「八」、Drag
 * Ordering/UI-I6、Project Deadline Contract、source_domain
 * migration、Quick Add、Note Create category enhancement、Note
 * category 徽章、Telegram DashboardEngine、也没有做任何"通用
 * conversion 抽象框架"或跟这次任务无关的重构。
 *
 * 验证状态：
 *   - 全部新增/改动代码：node --check 通过（STATIC VERIFIED）。
 *   - 计时日志本身是否正确覆盖各阶段边界、乐观 UI 成功/失败/双击场景
 *     下是否真的按预期表现（尤其是"快速连续两次点击 Save 不会产生两
 *     条真实重复记录"这条，纯代码审查只能确认按钮 disabled 逻辑没有
 *     明显漏洞，无法在没有真实浏览器+GAS 部署的情况下模拟真实的两次
 *     并发 RPC）：**LIVE TEST PENDING**，跟 Slice 3/4A/4B 同一个桶，
 *     不是 PASS。
 *   - 上面 (d) 提到的解读分歧：不是"未测试"，是需要 Carson 明确确认
 *     的一次范围判断，优先级高于 LIVE TEST。
 *
 * 下一步：Carson 确认 (d) 的解读是否可接受；部署后跑真实计时（打开
 * Executions/Stackdriver 看 `[Perf]`前缀日志）、记录真实数字到本文件
 * 下一节；浏览器验证乐观 UI 三个场景（成功替换/失败回滚/双击不重复）；
 * 视真实数字决定要不要开一条新 ADR 处理后端优化。Slice 3/4A/4B 与
 * Slices 1/2 的既有验证状态本轮未变。
 */

// ============================================================
// 三十七、Carson 实测 Task→Note Conversion Gate：
//         发现+修复一处测试数据 bug，记录一处新的结构性发现（2026-09-07）
// ============================================================

/**
 * Carson 回家后跑了 `runTaskToNoteConversionGate()`，以及既有的
 * Sprint 3 Acceptance Gate / UI Vertical Slice 2 Gate / UI-I1~I5
 * Interactions Gate 三个回归套件。
 *
 * **回归结果（好消息）**：后三个既有套件全部 PASS（Sprint 3 的 Note
 * Lifecycle/Business Rule/Bidirectional Conversion/Reminder Connector；
 * UI Vertical Slice 2 的 Task↔Project 双向闭环 7 项；UI-I1~I5 的 14
 * 项服务端契约）——确认 Slice 5 这轮对 `50_UIBridge.gs`/
 * `ui_index.html`的改动（纯 Logger.log 埋点 + 乐观 UI）没有破坏任何
 * 既有已验证行为。这几个套件本身不经过 UIBridge 层（直接调 Engine），
 * 所以也没有覆盖到 Slice 5 自己的埋点/乐观 UI——那部分仍然是
 * LIVE TEST PENDING，见上一节，本轮未变。
 *
 * **`runTaskToNoteConversionGate()`结果**：`testTaskToNote_
 * BlockedFields_` FAIL 在 `[due_datetime]`这个子用例上——实际发生了
 * Note 被创建（应该 blocked 而没有）；紧接着 `testTaskToNote_
 * SuccessfulConversion_`刚开始就 "Execution cancelled"，后面
 * `testTaskToNote_EventEmittedAndProjected_`/`_ReplayConsistency_`/
 * `_Idempotent_`三个完全没有跑到，**保持 NOT TESTED，不是通过，也不是
 * 失败，是完全未知**——不能因为第一个子测试的问题已经诊断清楚，就假设
 * 后面几个也会过。
 *
 * **诊断 1（已 100% 用代码证实，已修复）**：`due_datetime` 子用例本身
 * 的测试数据有问题，不是 `convertTaskToNote` 的 BLOCKED 逻辑坏了。
 * `20_TaskEngine.gs`第 167 行 `due_datetime:
 * _computeDueDatetime_(meta.due_date || '', meta.due_time || '')`——
 * `due_datetime`永远是从 `due_date`+`due_time`派生的纯计算值，
 * `createTask`根本不读取调用方直接传入的 `meta.due_datetime`。原用例
 * 只传 `{ due_datetime: '2026-12-31T09:00:00' }`，没有同时传
 * `due_date`/`due_time`，实际落地的 `due_datetime`是
 * `_computeDueDatetime_('', '') = ''`（第 106 行：两个入参有一个空
 * 就返回空字符串），BLOCKED 检查读到的是空值，四个 FORBIDDEN_FIELDS
 * 全部落空，Note 被正常创建——这条链路（`FORBIDDEN_FIELDS`常量本身、
 * `convertTaskToNote`里的检查代码、ADR-030 B2 的设计）**没有问题**，
 * 问题在测试数据没有反映"due_datetime 是派生字段"这个事实。已在
 * `54_Tests_TaskToNoteConversion.gs`把这条用例改成同时提供
 * `due_date`+`due_time`（这条用例现在会同时触发 due_date/due_time/
 * due_datetime 三者都进 blockedFields，架构上做不到真正的字段隔离），
 * 并新增 `reasonContains: 'due_datetime'`断言，确认返回的 reason
 * 里确实包含"due_datetime"这个字段名本身（不然这条用例只是 due_time
 * 用例的重复，验证不到 FORBIDDEN_FIELDS 里 due_datetime 那一项）。
 * node --check 通过。**这个修复后，这条子用例预期会变成 PASS，但
 * 没有真实环境不能自己确认，仍然是 LIVE TEST PENDING，等 Carson 重跑。**
 *
 * **诊断 2（Carson 手工核对发现，倒查出一处新的结构性 gap，已记录
 * 未修复）**：Carson 报告 due_datetime 那次误创建之后，源 Task 行里
 * 没有 `converted_to_note_id`，Timeline 里也没有对应 entry。倒查
 * `02_EventBus.gs`/`10_ProjectionEngine.gs`发现：`dispatch()`内部，
 * 具体 projector（比如 `projectTaskConvertedToNote_`）一旦抛异常，
 * 会被 `dispatch()`自己的外层 catch 吞掉（只 Logger.log，不重新抛出），
 * 导致 `publish()`那层的 `event.projection_ok`永远读不到
 * `false`——`20_TaskEngine.gs`里"projection_ok===false 就走
 * materializeTaskRow_ 兜底"这个安全网因此永远不会被触发。这一点本身
 * 是确定的代码事实（如实分级：**已证实**）；但这次具体是不是真的因为
 * `projectTaskConvertedToNote_`内部抛了异常导致的，还需要 Carson
 * 去 Apps Script Executions 翻这次运行的完整 Execution Log，找有没有
 * 一行`[ProjectionEngine] ERROR dispatching TASK_CONVERTED_TO_NOTE:
 * ...`——这一点目前是**最有解释力但尚未证实的假设**，如果这行日志
 * 不存在，需要换个方向查（比如是不是核对了错误的 task_id）。已记录
 * 为 `00_Known_Limitations.gs`「九」，DEFERRED，原因：这不是 Task→Note
 * 自己的问题，是 `dispatch()`的通用错误处理缺口，switch 里列出的
 * 每个事件类型理论上都有同样风险，修复涉及全项目共用的核心文件，
 * 影响面远超本次验收范围，不在这次顺带修——等 Carson 看到后单独排期。
 *
 * Regression 检查：本节的修改只碰了
 * `54_Tests_TaskToNoteConversion.gs`（测试数据）和
 * `00_Known_Limitations.gs`（记录新发现）两个文件；`02_EventBus.gs`/
 * `10_ProjectionEngine.gs`/`42_ConversionEngine.gs`/`20_TaskEngine.gs`
 * 本节零改动（诊断 2 只是读代码找证据，没有动手改）。全部 `.js`
 * node --check 通过。
 *
 * 下一步：(1) Carson 去 Executions 翻当次运行日志，确认「九」的假设
 * 部分是否成立；(2) Carson 重跑 `runTaskToNoteConversionGate()`，
 * 这次预期至少 `testTaskToNote_BlockedFields_`应该 PASS，且不要手动
 * 中断，让 `_SuccessfulConversion_`/`_EventEmittedAndProjected_`/
 * `_ReplayConsistency_`/`_Idempotent_`四个真正跑完，才能知道 Slice 4
 * Part B 剩下这几项到底过不过；(3) Carson 决定「九」的优先级/排期。
 * Slice 4 Part B 整体状态维持 **STATIC VERIFIED（含本次修复）,
 * LIVE TEST PENDING**，不因为诊断出了原因就自行标成 PASS。
 */

// ============================================================
// 三十八、根因确认 + 修复：NEW_TASK_COLUMNS 漏了
//         converted_to_note_id，真实 Spreadsheet 缺这一列（2026-09-07）
// ============================================================

/**
 * Carson 按上一节的要求重跑了一次 `runTaskToNoteConversionGate()`，
 * 没有中断，五个测试全部跑完：
 *
 *   ✅ testTaskToNote_BlockedFields_ PASS
 *      （确认上一节对 due_datetime 测试数据的修复有效）
 *   ❌ testTaskToNote_SuccessfulConversion_ FAIL
 *      —— 源 Task 的 converted_to_note_id 应该等于新 Note 的
 *      note_id，实际 undefined
 *   ❌ testTaskToNote_EventEmittedAndProjected_ FAIL
 *      —— 打印出的 Task 行 JSON 里，status 正确变成了 CONVERTED，但
 *      **JSON 里连 converted_to_note_id 这个 key 都不存在**（对比同一
 *      行 JSON 里 converted_to_project_id 是存在的，值是空字符串）
 *   ❌ testTaskToNote_ReplayConsistency_ FAIL
 *      —— 重放（deriveFromEvent，纯内存计算）算出来的
 *      converted_to_note_id 跟实时 projection（落盘再读回）的值不一致
 *   ❌ testTaskToNote_Idempotent_ FAIL
 *      —— 第二次转换本该走"已经转换成 Note，直接返回既有 Note"分支，
 *      实际走成了`invalid_state:true`+"已经转换过（转去了
 *      Project）"——因为 `convertTaskToNote`判断"已经转成 Note 还是
 *      已经转成 Project"就是靠检查`sourceTask.converted_to_note_id`
 *      是否有值，读不到就默认判成"转去了 Project"
 *
 * **根因确认（不再是假设，四个 FAIL 用同一个原因全部解释）**：
 * `15_Setup.gs`的`NEW_TASK_COLUMNS`数组（真正驱动
 * `migrateSchemaPersonalLifeOS()`/`repairSheetHeaders()`往真实
 * Spreadsheet 补列的唯一权威来源）在 v5.3/ADR-2026-09-02-030
 * （2026-09-04）那次交付里漏加了`converted_to_note_id`——
 * `20_TaskEngine.gs`/`10_ProjectionEngine.gs`/`00_Sheets_Structure.gs`
 * 三个文件都正确写了这个字段的读写逻辑和 schema 文档，唯独这个真正
 * 落到真实表头上的数组没跟上。后果：Carson 的真实 Tasks/ActiveTasks/
 * ArchiveTasks 表压根没有这一列。`05_SheetUtils.gs`的
 * `upsertRowByKey_`对不存在的列名是**静默跳过、不抛异常**（
 * `for...in` + `headerMap.hasOwnProperty(key)`判断没有 else 分支）——
 * 这也是为什么`status: 'CONVERTED'`能正确写入（那一列存在）但
 * `converted_to_note_id`悄无声息地丢失（那一列不存在，既不报错也不
 * 提醒）。四个 FAIL 全部是这一件事的直接或间接后果，不是四个独立
 * 问题。
 *
 * **对上一节记录的更正**：上一节把这个现象归因假设成
 * `ProjectionEngine.dispatch()`吞异常导致`projection_ok`不可靠（见
 * `00_Known_Limitations.gs`「九」），当时明确标注是"尚未证实的假设"。
 * 现在确认：`upsertRowByKey_`对缺失列是静默跳过而不是抛异常，所以
 * `dispatch()`的 catch 那条路径这次根本没被触发——「九」描述的
 * `dispatch()`吞异常这件事本身仍然是真实存在的代码事实（对某个
 * projector 未来真的抛异常的场景依然成立、依然是独立风险），但**不是
 * 这次症状的成因**。已经在「九」原文基础上补充更正说明，没有删除
 * 原文（保留错误假设的记录本身也是这个项目的规范）。
 *
 * **修复**：`15_Setup.gs`的`NEW_TASK_COLUMNS`数组末尾追加
 * `'converted_to_note_id'`。这个数组同时被
 * `setupSheets()`（全新安装用）、`repairSheetHeaders()`、
 * `11_ProjectionRebuilder__SPRINT1_ADDITIONS.gs`的
 * `migrateSchemaPersonalLifeOS()`（已有部署补列用，幂等，只在表尾
 * 追加缺失列，不动现有数据）共用，改这一处会同时修复全部三条路径。
 * node --check 通过。
 *
 * **⚠️ 这一步改完代码不会自动生效——Carson 需要在真实环境手动跑一次
 * `migrateSchemaPersonalLifeOS()`**（Apps Script 编辑器里选中这个
 * 函数执行），确认 Tasks/ActiveTasks/ArchiveTasks 三张表尾部真的多出
 * 了`converted_to_note_id`这一列，才能重跑 Gate 验证。这一步没有任何
 * 环境依赖之外的风险（`_appendMissingColumns_`只在表尾追加，不重排/
 * 不覆写已有列），但只有 Carson 能在真实 Spreadsheet 上执行。
 *
 * Regression 检查：本节只改了`15_Setup.gs`（数组追加一项）和
 * `00_Known_Limitations.gs`（更正说明，非删除），没有改动
 * `20_TaskEngine.gs`/`10_ProjectionEngine.gs`/`02_EventBus.gs`/
 * `42_ConversionEngine.gs`/`05_SheetUtils.gs`——这几个文件之前的读写
 * 逻辑本身是对的，问题只在 schema 补列这一步缺了一项。全部`.js`
 * node --check 通过。
 *
 * 下一步：Carson 跑一次`migrateSchemaPersonalLifeOS()`补列，确认列
 * 已经出现，然后重跑`runTaskToNoteConversionGate()`——这次预期
 * 五项应该全部 PASS；如果补列之后还有失败，说明还有其它未知问题，
 * 需要新的诊断，不能假设"补了列就一定全过"。Slice 4 Part B 状态维持
 * **STATIC VERIFIED（含两次修复）, LIVE TEST PENDING**。
 */

// ============================================================
// 三十九、NEXT SLICE DISCOVERY → 补齐 Slice 4 Part A
//         (ADR-028) BLOCKED 路径缺失的自动化测试（2026-09-07）
// ============================================================

/**
 * 背景：Carson 指示在他回家做 Slice 4B 真实表 migration + 重跑 Gate
 * 之前，先做 NEXT SLICE DISCOVERY，找一个"Architecture Approved +
 * Implementation Ready + 不依赖 LIVE TEST"的候选独立推进，并特别要求
 * 以后任何涉及新字段的 Slice，必须追踪"Schema Definition → Setup/
 * Migration Registry → Create/Update → Read → Projection → Replay →
 * Identity → Tests"完整链路，不能只查前几层。
 *
 * 发现过程：
 *   1. 重新扫描 00_ADR.gs 全部 ADR（001~030）——没有发现"已 Accepted
 *      但代码尚未实现"的缺口（结论跟本文件更早一次扫描一致）。
 *   2. 按 Carson 的 schema 教训，检查是否有其它字段跟
 *      `converted_to_note_id`一样"代码写对了，但 Setup/Migration
 *      Registry 没跟上"：核对`00_Sheets_Structure.gs`的完整 changelog
 *      （一～十节，覆盖 v5.0/v5.1，加一条 v5.3 的
 *      converted_to_note_id 补充）跟`15_Setup.gs`/
 *      `11_ProjectionRebuilder__SPRINT1_ADDITIONS.gs`里全部
 *      `_ensureSheet_`初始表头 + 全部`_appendMissingColumns_`调用
 *      （`NEW_TASK_COLUMNS`给 Tasks 系三表，`['identity']`给
 *      BusinessRules/WorkflowTemplates）——**没有发现除
 *      converted_to_note_id 之外的第二个同类缺口**。Notes 表已有的
 *      `converted_to_type`/`converted_to_id`通用字段对（跟 Task 侧
 *      "每种转换目标一个专属列"是 ADR-030 Context 里明确讨论过的两种
 *      不同、刻意不同的设计，不是疏漏）。
 *   3. UI V2 Implementation Plan 的 5 个 Slice 全部有代码了（Slice 5
 *      是这次会话早些时候交付的）——这个 Plan 范围内没有"下一个
 *      Slice"了。
 *   4. `00_Roadmap.gs`（2026-07-13，明显早于整个 UI V2 系列，已经过期
 *      未更新）里列的候选项（Recurring lifecycle 完善/TaskPriority
 *      cache/Health Check split/EventDefinitions split/Domain OS
 *      bridge/Monitoring/wrapper removal/testing coverage）全部带
 *      "如果这个需求变得具体""如果观察到变贵"这类条件句，没有一条有
 *      Plan 文档级别的具体文件表/Test Gate——不满足"已有明确
 *      implementation contract"+"不需要新的产品决策"这两条门槛。
 *   5. Sprint 4（AI）是 Carson 明确指示暂停的，不是"还没开始"，恢复
 *      需要 Carson 自己解冻，不算候选。
 *   6. 找到一个具体、范围小、零产品决策、零架构决策的候选：Slice 4
 *      Part A（ADR-028）交付时（见本文件「三十二」节）自己记录的
 *      "no automated test yet covers the new BLOCKED path itself"——
 *      `36_Tests_Sprint3Acceptance.gs`的`testBidirectionalConversion_`
 *      只覆盖了"没有 due_date 的 Task 成功转换成 Project"这条既有
 *      路径（已确认 PASS），ADR-028 这次新加的"带 due_date/due_time
 *      的 Task 应该被 BLOCKED"这个核心新行为，从交付到现在从来没有
 *      被任何自动化测试验证过。这个候选唯一符合全部 8 条优先原则：
 *      已有 Accepted ADR（028）、已有明确 implementation contract
 *      （BLOCKED 检查的代码本身已经存在且逻辑清楚）、不需要新的产品
 *      决策、不依赖 Project Deadline/Drag Ordering、不影响 Telegram、
 *      不需要 source_domain migration、风险和范围都最小（新增一个
 *      独立测试文件，不改动任何 Domain/Engine 业务逻辑代码）。
 *
 * 交付：新建`55_Tests_TaskToProjectBlocked.gs`，
 * `testTaskToProject_DueDateBlocked_()`覆盖 due_date/due_time 各自
 * 触发 BLOCKED，并对称于`54_Tests_TaskToNoteConversion.gs`的检查方式
 * 确认 BLOCKED 后没有 Project 被创建、源 Task 没有被标记 CONVERTED。
 * 单一入口`runTaskToProjectBlockedGate()`。刻意排除"已转换的 Task 之后
 * 被打上 due_date、重新调用应该走幂等而不是 BLOCKED"这个更复杂的场景
 * （42_ConversionEngine.gs 第 66-74 行注释提到的有意设计），因为验证
 * 它需要先确认`updateTask`对已 CONVERTED 的 Task 是否允许写入，这一点
 * 本次没有去核实——为了不重复这次 due_datetime 那种"测试假设了一个
 * 没验证过的行为"的错误，本次只测最直接的触发条件，复杂场景留给
 * Carson 需要时再单独授权。
 *
 * Regression 检查：本节只新增了一个文件，没有改动任何既有文件。
 * 全部`.js`（含新文件）node --check 通过。
 *
 * 验证状态：**STATIC VERIFIED（逻辑审查+node --check），
 * LIVE TEST PENDING**——需要 Carson 在真实环境跑一次
 * `runTaskToProjectBlockedGate()`才能确认真的 PASS，不能自行标成
 * LIVE PASS。
 *
 * 下一步：Carson 方便的时候（不必等这次 Slice 4B 的 migration，两者
 * 互相独立）跑一次`runTaskToProjectBlockedGate()`。
 */

// ============================================================
// 三十九、Migration 完成 + 两个 Gate 全过 + 三个回归套件全过
//         + 发现并补齐 Slice 3 的同款测试覆盖缺口（2026-09-07）
// ============================================================

/**
 * Carson 跑了`migrateSchemaPersonalLifeOS()`，日志确认 Tasks/
 * ActiveTasks/ArchiveTasks 三张表都追加成功了`converted_to_note_id`
 * 这一列，人工在表头肉眼确认过。随后：
 *
 *   ✅ `runTaskToNoteConversionGate()` —— 5 项全部 PASS（Blocked
 *      Fields / Successful Conversion / Event Emitted And Projected /
 *      Replay Consistency / Idempotent Re-conversion）。三十八节的
 *      根因诊断（NEW_TASK_COLUMNS 漏列）到此完全验证正确——补列之后
 *      之前失败的 4 项全部转 PASS，没有出现"补列之后还有别的问题"的
 *      情况。
 *   ✅ `runTaskToProjectBlockedGate()` —— 新写的 55_
 *      Tests_TaskToProjectBlocked.gs 也 PASS。
 *   ✅ `runSprint3AcceptanceGate()` / `runUIBridgeSlice3Gate()` /
 *      `runUIBridgeInteractionsGate()` —— 三个既有回归套件全部 PASS。
 *
 * **状态更新**：
 *   - Slice 4B（Task→Note）：除第 14 项（confirmation cancel 零
 *     mutation，纯前端行为，Gate 自己的开场白就说明了不在覆盖范围内，
 *     需要人工浏览器验证）之外，**转为 LIVE VERIFIED**。
 *   - Slice 4A 的 BLOCKED 路径（这次新补的测试）：**转为 LIVE
 *     VERIFIED**。
 *   - Slice 5（Performance）：状态不变，仍然 LIVE TEST PENDING——
 *     以上全部 Gate 都是直接调 Engine，不经过 UIBridge 的
 *     create/update 入口，测不到 Slice 5 自己的埋点/乐观 UI。
 *
 * **重要澄清，避免以后混淆（如实记录一次自己的核实过程）**：收到
 * "runUIBridgeSlice3Gate 全部通过"的消息后，第一反应是这是不是意味着
 * "UI V2 Implementation Plan 的 Slice 3（Note Edit）"也验证过了——
 * 去看了`38_Tests_UIBridge.gs`里这个函数的真实内容，发现完全不是：
 * 这个"Slice 3"是另一条更早的、不同的编号体系（"UI Vertical Slice"
 * 系列，跟"UI Vertical Slice 2 Gate"是同一条线索），测的是
 * BusinessRule/WorkflowTemplate/Workflow Instance 三层模型的
 * Capture Project as Template / Instantiate Template 闭环，**完全
 * 不涉及`updateNote`/Note Edit**。已经用 grep 核实：全项目没有任何
 * 文件（包括这三个刚跑过的回归套件）出现过`updateNote`或
 * `ui_updateNote`——**Slice 3（Note Edit）到目前为止没有被这次或任何
 * 一次测试触碰过，状态依然是 STATIC VERIFIED, LIVE TEST PENDING，
 * 没有任何变化**。这条澄清记在这里，是为了防止未来的窗口看到
 * "Slice 3 Gate 全部通过"这几个字就想当然地把 Note Edit 标成
 * LIVE VERIFIED——两个"Slice 3"是同名不同物，本文件里以后提到
 * "UI Vertical Slice 3 Gate"specifically 都指 WorkflowTemplate 那条,
 * "UI V2 Plan Slice 3"specifically 指 Note Edit，不能只看编号。
 *
 * **发现的新缺口（跟 Slice 4A 那次一模一样的模式，独立发现，同样方式
 * 补上）**：既然"Slice 3 Gate"这个名字造成了一次真实的混淆，顺着
 * 去核实了一下 Note Edit 到底有没有专门的自动化测试——grep 全项目，
 * `updateNote`/`ui_updateNote`在任何一个测试文件里都没出现过。跟
 * Slice 4A 的 BLOCKED 路径完全同一种情况：代码 2026-09-04 就交付了，
 * 但从来没有专门的验收测试覆盖过。已比照`55_Tests_
 * TaskToProjectBlocked.gs`的模式补上`56_Tests_NoteEdit.gs`，覆盖
 * `29_NoteEngine.updateNote`的全部分支：合法 content/category 更新
 * （含 identity 重算）、FORBIDDEN_FIELDS 混合请求整体拒绝不部分应用、
 * 无效 category 且无其它改动返回 null、noteId 不存在返回 null、
 * 以及一项特意不信任`updateNote()`自己返回值、用独立
 * `NoteQueryEngine.getNote()`重新读一遍核对真实持久化状态的完整性
 * 检查——这最后一项是直接受三十八节 NEW_TASK_COLUMNS 事故启发加的，
 * 目的是以后类似"代码看着对、真实表没跟上"的问题能在自动化测试这层
 * 就被拦下来，不用等到 Carson 实跑才发现。
 *
 * 全链路核对（Carson 要求的新规矩，如实记录）：本次没有引入任何新
 * 字段，`content`/`category`/`identity`三个都在`15_Setup.gs`「Notes」
 * 的一次性建表列清单里（Notes 不像 Tasks 有`NEW_TASK_COLUMNS`那种
 * 后补数组，是一次性列全的），已确认存在，不存在漏列风险。
 *
 * Regression：`56_Tests_NoteEdit.gs`是全新文件，零改动
 * `29_NoteEngine.gs`/`50_UIBridge.gs`/任何既有文件。全部`.js`
 * node --check 通过。
 *
 * 下一步：Carson 方便的时候跑一次`runNoteEditGate()`（跟 Slice 4B
 * migration、Task→Project Blocked Gate 都互相独立，顺序不重要）。
 * **STATIC VERIFIED，LIVE TEST PENDING，没有自行标成 PASS。**
 */

// ============================================================
// 四十、NEXT SLICE DISCOVERY（第三轮）：系统扫描后确认 Case C，
//       没有可以直接实施的候选，停在 Decision Gate（2026-09-07）
// ============================================================

/**
 * Carson 明确要求"不要因为 Note Edit 还没 LIVE TEST 就停下来"，继续做
 * 下一轮 NEXT SLICE DISCOVERY。这次比前两轮（分别找到 Slice 4A BLOCKED
 * 测试缺口、Note Edit 测试缺口）扫得更systematic，结论是**这次真的
 * 没有找到可以直接实施的候选——Case C，不是 Case A/B**。扫描过程
 * 如实记录，避免未来窗口重复做同样的搜索：
 *
 *   1. 全部 30 条 ADR（001-030）Status 重新逐条核对：除 006
 *      （Superseded）、026（Proposed，Drag Ordering，冻结中）之外，
 *      全部是 Accepted，且逐一确认对应实现都已经存在于当前代码里——
 *      没有"Accepted 但代码没写"的漏项。028 的 Status 备注里还留着
 *      "对应的代码尚未实现"这句话，那是 ADR 刚写完、Slice 4A 还没
 *      开工时的历史记录，现在已经过时（Slice 4A 早就 LIVE VERIFIED
 *      了）——这只是一处文字没跟上的小瑕疵，不构成"未实现"，按 Carson
 *      本轮"不要顺手扩大 scope"的要求，没有去改这一处文字。
 *   2. `00_File_Map.js`：grep 了 TODO/未完成/待实现/Not Yet/尚未/待补
 *      等关键词，零匹配。
 *   3. `00_Roadmap.js`：内容还是 2026-07-13 的旧快照，列的全部是"如果
 *      某个需求变得具体"这类条件句（Recurring lifecycle 收尾、
 *      TaskPriority 缓存、Health Check 拆分等），不满足"scope 已经
 *      明确、不需要新产品判断"这条门槛，不算候选。
 *   4. UI V2 Implementation Plan 的 5 个 Slice：全部代码完成，Slice
 *      1/2/4A/4B 已经 LIVE VERIFIED（4B 差 confirmation-cancel 这一项
 *      纯前端行为待人工验证），Slice 3/5 STATIC VERIFIED/LIVE TEST
 *      PENDING——**没有第 6 个 Slice，Plan 本身已经用完**。
 *   5. 逐一核对`50_UIBridge.gs`全部 21 个`ui_*`函数有没有被任何测试
 *      文件引用过：发现`ui_getTaskDashboard`/`ui_convertTaskToNote`
 *      看起来是 0——但核实后这不是真的缺口，是这个项目一直以来的
 *      测试哲学：`54_/55_/56_`这几个 Gate 文件全部只测 Engine 层（
 *      `ConversionEngine.convertTaskToNote`/`NoteEngine.updateNote`
 *      本身），UIBridge 那一层薄封装统一交给人工浏览器验证，不是
 *      自动化测试的责任——这是既有的、一致的设计选择，不是本次发现的
 *      新缺口，所以没有为`ui_*`这一层补测试。
 *   6. Known Limitations「一」~「九」逐条重新过了一遍：一~七是描述性
 *      的"刻意不做/暂未暴露"边界，不是可实施的工作项；八、九都是
 *      需要 Carson 决定优先级/是否修的风险记录，本身不能直接实施。
 *
 * **结论**：不存在同时满足"Architecture Approved + Implementation
 * Ready + Independent + No new decision required"的候选。现在往前推进
 * 的每一条路径，都会碰到需要 Carson 做产品/架构判断的节点——具体是
 * 哪几条、缺哪个决定，见本文件之外这次给 Carson 的 Decision Gate
 * 报告（八、九、Drag Ordering ADR-026、Project Deadline Contract
 * 四项，逐项列了现有证据/选项/取舍），不在这里重复。
 *
 * 本节没有产生任何代码改动——按 Carson"没有合适的成熟 Slice 就不要
 * 为了继续而创造工作"的明确要求，纯粹是扫描+记录结论，停在
 * Decision Gate。
 */

// ============================================================
// 四十一、Known Limitation 8 修复交付（受控的小范围修复，
//         不是新 Slice discovery）（2026-09-08）
// ============================================================

/**
 * Carson 在 Decision Gate 之后明确选定「八」，给了一套非常严格的
 * 受控修复流程（PRE-CHANGE ANALYSIS → Minimum Safe Change →
 * Idempotency/Duplicate Safety 验证 → 明确的 Scope Lock/STOP
 * CONDITIONS）。完整 Pre-Change Analysis（A-E）已经在对话里输出过，
 * 这里记录结论和实施细节，不重复整段分析。
 *
 * **Current behavior（修复前）**：`convertTaskToProject`顺序是
 * not_found → 幂等（一行合并判断 `status==='CONVERTED' &&
 * converted_to_project_id`）→ BLOCKED（due_date 系列）→ 创建
 * Project → `markTaskConverted_`（内部才检查"已转别处"和"终态"，
 * 返回 invalid_state）→ 直接返回 `{project}`，不检查
 * `markTaskConverted_`的返回值。
 *
 * **分析阶段发现的第二个同根场景（原始「八」文字没有明确写，但是
 * 同一个缺陷形状，如实记录，没有自行发明新问题）**：现有幂等检查是
 * `&&`合并判断——如果 Task 已经转换成了 Note（status='CONVERTED'，
 * converted_to_project_id 是空），这一行判断为 false，会穿透到创建
 * Project 那一步，建出第二个孤儿 Project（这次是"跟另一种转换类型
 * 冲突"，不是「八」原文的"终态"场景，但触发机制和后果完全一样）。
 *
 * **Change Made**：
 *   1. 把原来一行式幂等判断拆成两支（照抄`convertTaskToNote`
 *      190-196 行结构）：CONVERTED 且有 converted_to_project_id →
 *      原样返回既有 Project；CONVERTED 但没有（说明转去了 Note）→
 *      新增分支，创建前直接返回 invalid_state。
 *   2. 紧接着新增终态检查，复用`markTaskConverted_`/
 *      `convertTaskToNote`已经在用的同一份
 *      `['DONE','CANCELLED','NOT_SELECTED']`，创建 Project 之前先
 *      挡住。
 *   3. 接住`markTaskConverted_`的返回值，真的收到 invalid_state 时
 *      （只可能是两次读取之间源 Task 被并发改动这种边缘情况）把已经
 *      建出来的 Project 一起带出去，不假装成功，不发明 rollback。
 *   4. 更新了函数头 JSDoc 的 `@returns`，补上新增的 invalid_state
 *      分支（避免重复此前"文档跟代码没对上"的问题）。
 *   create→mark 这个既有顺序、`00_Business_Rules.gs`「一」的失败恢复
 *   策略本身，都没有改动——两条新 pre-check 只是在"要不要开始建"这
 *   一步之前多加了两层判断。
 *
 * **Files Changed**：
 *   - `42_ConversionEngine.js`（convertTaskToProject 函数体 + JSDoc）
 *   - `57_Tests_TaskToProjectPrecheck.js`（新建）
 *   - `00_Known_Limitations.js`（「八」status update，append，未重写
 *     原有历史分析）
 *   - `00_Project_State.js`（本节）
 *
 * **Files NOT Changed（明确确认）**：`02_EventBus.js`、
 * `10_ProjectionEngine.js`、dispatch() 错误处理、projection_ok
 * 契约、Project schema、Project Deadline Contract、due_date/
 * due_time/due_datetime 语义、ADR-026、Drag Ordering/UI-I6、
 * `convertTaskToNote`本身（只读参照，没有改它）、Task→Note
 * conversion contract、Known Limitation 9（本轮保持原状）、任何其它
 * 已经 LIVE VERIFIED 的 Slice、UI V2 architecture。
 *
 * **Tests（Static/逐条重读代码核对，不是真实执行）**：
 *   - 新增 `57_Tests_TaskToProjectPrecheck.js` 三个测试：终态 Task
 *     被挡且零孤儿 Project（用
 *     `ProjectQueryEngine.getProjects(chatId,{source_task_id})`
 *     直接查，不是只看返回值）、已转 Note 的 Task 被挡且零孤儿
 *     Project 且原有 converted_to_note_id 不被覆盖、正常路径最小
 *     复核。node --check 通过。
 *   - 既有 `36_Tests_Sprint3Acceptance.testBidirectionalConversion_`
 *     的首次转换 + 重复转换幂等断言：逐行核对过，重复调用会在
 *     （没有移动位置的）既有幂等检查那一步短路返回，根本不会走到
 *     新加的两条 pre-check，结论不受影响。
 *   - 既有 `38_Tests_UIBridge.js`的
 *     `testUIBridge_ConvertTaskToProject_Success_`/
 *     `_InvalidOrMissingId_`/`_NoDuplicateOnRetry_`：同一个理由，
 *     全部逐条核对过不受影响。
 *   - 既有 `55_Tests_TaskToProjectBlocked.js`：用的是全新、非终态、
 *     未转换过的测试 Task，会先经过两条新 pre-check（都通过）再到
 *     BLOCKED 检查，结论不受影响。
 *   - **以上全部是这次对话里的静态代码重读，不是真实跑过——Carson
 *     要求的"Existing Task→Project tests 全部跑"这一步，实际执行
 *     需要 Carson 在真实 GAS 环境完成，见下面 LIVE 部分。**
 *
 * **Verification Status**：**STATIC VERIFIED / LIVE TEST PENDING**。
 * 没有自行标成 LIVE VERIFIED。
 *
 * **Remaining Known Limitations**：Known Limitation 9 保持原状，
 * 未处理。ADR-026（Drag Ordering）保持 Proposed，本轮未变。Project
 * Deadline Contract 保持等待产品决策，本轮未变。
 *
 * **Scope Integrity**：这次修改有没有碰任何无关的 architecture/
 * contract？**没有**——只碰了`42_ConversionEngine.gs`一个函数体+
 * 一个新测试文件+两个 governance 文档的必要 append/status update。
 *
 * 下一步（Carson 回到真实环境后）：按顺序跑
 * `runTaskToProjectPrecheckGate()`（新测试）→
 * `testBidirectionalConversion_`/`38_Tests_UIBridge`相关三个/
 * `runTaskToProjectBlockedGate()`（既有回归）→ 全部 PASS 才能把
 * Known Limitation 8 和这次改动本身标成 LIVE VERIFIED；任何一项
 * FAIL 都应该标 BLOCKED 并说明 failed gate/actual/expected/是否
 * 需要 rollback，不能自行判断"应该没问题"。
 *
 * 完成 Known Limitation 8 这一项到此为止——按 Carson 的 FINAL RULE，
 * 本节不主动寻找或实施下一个问题，停在这里等待下一步决策。
 */

// ============================================================
// 四十二、环境事故：SecureConfig is not defined，
//         两个新 Gate 的 LIVE 尝试都被同一个环境问题挡住（2026-09-08）
// ============================================================

/**
 * Carson 跑`runNoteEditGate()`和`runTaskToProjectPrecheckGate()`都
 * FAIL，报错都是`SecureConfig is not defined`，日志里还有一条容易
 * 误导的`[DeduplicationEngine] Sheet 不存在: Notes/Tasks`——Carson
 * 自己已经诊断清楚：那条 Sheet-不存在的日志是假象，真正原因是
 * `05_SheetUtils.gs`的`getSheet_`第一步调用
 * `SecureConfig.getKey('SPREADSHEET_ID')`时就抛了
 * `ReferenceError`，被`DeduplicationEngine._findRowByIdentity_`的
 * catch 不分异常类型地吞掉、错误记成了"Sheet 不存在"。
 *
 * **这不是这次交付的代码本身的缺陷**：`56_Tests_NoteEdit.gs`（测
 * Note Edit）和`57_Tests_TaskToProjectPrecheck.gs`（测 Known
 * Limitation 8 修复）是两份完全不相关的测试，覆盖两个不同的函数，
 * 却在同一个位置（`getSheet_`→`SecureConfig`）用同一种方式失败——
 * 这个特征本身就指向"环境里 SecureConfig 不可用"，不是"这两次代码
 * 交付各自都写错了"。Carson 提出的最可能物理原因（在 Apps Script
 * 网页编辑器粘贴新文件时，左侧文件列表选错、误覆盖了
 * `01_SecureConfig.gs`）是本容器这边没有办法验证或修复的——这件事
 * 发生在 Carson 的真实 GAS 项目里，不在这次对话能接触到的代码副本上；
 * 本容器里的`01_SecureConfig.js`本身语法正常、`SecureConfig`正常
 * 声明为一个 IIFE，没有问题。
 *
 * **核实了 Carson 顺带提到的一个诊断细节，确认属实**：
 * `15_Setup.gs`的`runPreflightCheck()`（第 472-522 行）检查列表从
 * `02_EventBus.gs`开始，一路到`45_CanonicalRepresentation.gs`，
 * **确实没有任何一项检查`00_*`治理文件或`01_SecureConfig.gs`**——
 * 如果`SecureConfig`本身损坏，这个本来就是为了"文件没更新就报一堆
 * 猜不到根因的错误"而设计的工具，反而会对这一种情况完全失明。这是
 * 一个真实、范围很小、独立于 Known Limitation 8 的诊断工具盲点，
 * 只记录+跟 Carson 确认要不要补，本节没有主动去改
 * `runPreflightCheck()`（不确定 Carson 是否希望现在处理这一项，
 * 没有得到明确授权前不动手，跟这次对话里其它场景同一个原则）。
 *
 * **状态影响**：Known Limitation 8 修复、Slice 3 Note Edit 测试
 * 本身的正确性都**没有**因为这次 LIVE 尝试而得到任何新证据（既没有
 * 被证明对，也没有被证明错——这次失败的性质是"验证过程被一个跟被
 * 测代码无关的环境问题挡住了"，不是"被测代码这次验证 FAIL 了"）。
 * 两者继续维持 **STATIC VERIFIED / LIVE TEST PENDING**，不标 BLOCKED
 * ——BLOCKED 应该留给"真的跑起来了、结果跟预期不一致"这种情况，跟
 * 这次"根本没跑到被测代码那一步就先炸在环境依赖上"是两件不同的事，
 * 不能混用同一个状态词。
 *
 * 下一步（Carson 那边）：确认真实 GAS 项目里`01_SecureConfig.gs`
 * 这个文件本身——内容是不是还是原来的`SecureConfig`实现、文件名/
 * 扩展名有没有被改动；如果确实被覆盖或损坏，用原始内容整份替换
 * （不是追加），然后随便跑一个最简单的、之前确认过能通过的 Gate
 * （比如`runSprint3AcceptanceGate()`）验证 SecureConfig 恢复正常，
 * 再重跑这两个新 Gate。
 */

// ============================================================
// 四十三、环境恢复，两个新 Gate 重跑全部 PASS（2026-09-08）
// ============================================================

/**
 * Carson 修好真实项目里的`01_SecureConfig.gs`之后，重跑了这两个新
 * Gate，这次两次执行都完整跑完（分别 6:32-6:33、6:33-6:34），没有
 * 再出现`SecureConfig is not defined`：
 *
 *   ✅ `runNoteEditGate()` —— 6 项全部 PASS（Update Content/Update
 *      Category/Forbidden Field No Partial Apply/Invalid Category
 *      Only No Change/Note Not Found/Event Emitted And Projected）。
 *   ✅ `runTaskToProjectPrecheckGate()` —— 3 项全部 PASS（Terminal
 *      Blocked No Orphan/Already-Converted-to-Note No Orphan/Normal
 *      Conversion Still Works）。
 *
 * **状态更新（精确到"这次 Gate 具体证明了什么"，不笼统扩大）**：
 *   - **Slice 3（Note Edit）Engine 层**（`29_NoteEngine.updateNote`）
 *     ——**转为 LIVE VERIFIED**。`ui_updateNote`这一层 UIBridge 包装
 *     + 浏览器里 Edit 表单的真实交互，`runNoteEditGate()`自己的开场
 *     白就说明不在这个 Gate 覆盖范围内——**这部分仍然是 STATIC
 *     VERIFIED / LIVE TEST PENDING**，跟 Slice 4B 的 confirmation-
 *     cancel 那一项是同一种"Engine 层过了、UI 层还没人工走一遍"的
 *     状态分层，不能因为 Engine 层过了就把整个 Slice 3 标全绿。
 *   - **Known Limitation 8 的新 pre-check 逻辑本身**——**转为 LIVE
 *     VERIFIED**：终态 Task 被挡、已转 Note 的 Task 被挡、两种情况
 *     都确认零孤儿 Project，正常路径不受影响。
 *   - **但 Known Limitation 8 / `convertTaskToProject`整体**——
 *     **还不能标 LIVE VERIFIED**：这次 Gate 只证明了新加的两条
 *     pre-check 本身按预期工作，`runTaskToProjectPrecheckGate()`
 *     自己的结尾也明确写了"下一步：真实环境重跑既有 Task→Project
 *     测试（`testBidirectionalConversion_`/`38_Tests_UIBridge`的三个/
 *     `runTaskToProjectBlockedGate`），确认这次改动没有破坏任何既有
 *     行为"——这一步 Carson 还没有做/还没有报告结果。之前的静态
 *     逐行核对（见三十九节）判断这些既有测试"不会被这次改动影响"，
 *     但那是代码审查，不是真的跑过；在拿到这几个既有 Gate 的真实
 *     PASS 之前，`convertTaskToProject`整体、Known Limitation 8
 *     整体，都维持 **STATIC VERIFIED / LIVE TEST PENDING**。
 *
 * 下一步：Carson 方便的时候跑一遍既有回归（
 * `runSprint3AcceptanceGate()`里的 Bidirectional Conversion Test、
 * `38_Tests_UIBridge.js`相关三个、`runTaskToProjectBlockedGate()`），
 * 全部 PASS 之后 Known Limitation 8 才能真正转 LIVE VERIFIED；Slice 3
 * 什么时候方便再人工走一遍浏览器 Edit 表单即可，不阻塞其它工作。
 */

// ============================================================
// 四十四、Known Limitation 8 正式收尾——基于真实 regression
//         execution，不是静态代码审查（2026-09-09）
// ============================================================

/**
 * Carson 贴回了本轮要求的三组既有回归 + 若干额外套件的真实 Execution
 * Log，逐一对照上一轮列出的 PASS CRITERIA：
 *
 *   - Regression A（`testBidirectionalConversion_`）—— 在
 *     `runSprint3AcceptanceGate()`结果汇总里以"✅ Bidirectional
 *     Conversion Test"出现 → **PASS**
 *   - Regression B（`38_Tests_UIBridge.gs`三个相关测试）—— 在
 *     `runUIBridgeSlice2Gate()`结果汇总里以"✅ Positive: Convert Task
 *     to Project Success"/"✅ Negative: Task→Project Invalid/Missing
 *     ID"/"✅ Integrity: No Duplicate Project on Retry"三条分别出现，
 *     对应`testUIBridge_ConvertTaskToProject_Success_`/
 *     `_InvalidOrMissingId_`/`_NoDuplicateOnRetry_` → **三项全部
 *     PASS**
 *   - Regression C（`runTaskToProjectBlockedGate()`）—— "✅✅✅
 *     全部通过" → **PASS**
 *   - 额外信号（不在 Carson 要求的三组以内，但同一批日志里一起跑了）：
 *     `runUIBridgeSlice1Gate()`（Note↔Task 闭环 8 项）、
 *     `runUIBridgeSlice3Gate()`（WorkflowTemplate Capture/
 *     Instantiate 7 项，跟"UI V2 Plan 的 Slice 3 Note Edit"是完全
 *     不同的东西，见三十九节的澄清）—— **全部 PASS**，没有观察到
 *     任何新的回归。Preflight Check（24 个既有文件）也全部确认是
 *     最新版本。
 *
 * PASS CRITERIA 全部成立，没有任何一项 FAIL/NOT RUN。按 Carson 的
 * closure 规则正式收尾：
 *
 * **Known Limitation 8**
 * **Status: RESOLVED — LIVE VERIFIED**
 *
 * Fix: `convertTaskToProject`现在在创建 Project 之前执行必要的
 * pre-check（已转换成 Note 的 Task、终态 Task，两种情况都会被挡下来，
 * 不会再产生孤儿 Project）。
 *
 * Verification（全部基于真实 execution，不是静态代码审查或推断）：
 *   - Pre-check Gate: PASS
 *   - testBidirectionalConversion_: PASS
 *   - 38_Tests_UIBridge 相关三项: PASS
 *   - runTaskToProjectBlockedGate: PASS
 *   - 没有观察到孤儿 Project，没有观察到新的 Task→Project regression
 *
 * Scope Integrity：本次 closure 过程零代码改动，只是核对贴回来的
 * Execution Log 跟 PASS CRITERIA 逐条对应关系，然后更新
 * `00_Known_Limitations.gs`「八」的 Verification 记录。`02_EventBus.gs`/
 * `10_ProjectionEngine.gs`/Deadline Contract/ADR-026/Slice 3 UI/
 * Known Limitation 9：本节全部 unchanged。
 *
 * Known Limitation 8 到此正式关闭。按 Carson 的 FINAL INSTRUCTION，
 * 不在本节之后自动开始 Known Limitation 9、Deadline Contract、
 * ADR-026、Drag Ordering、Slice 3 浏览器验证，或任何新 Slice
 * discovery——下一步由 Carson 单独决定。
 */

// ============================================================
// 四十五、ADR-026 Phase 1 分析持久化 + 本窗口在此暂停 coding
//         （2026-09-10）
// ============================================================

/**
 * Carson 要求做 ADR-026（Drag Ordering/UI-I6）Phase 1（架构判断，
 * 不写代码）。分析本身（Sort 交互/UX Contract/失败处理，A-H 原本
 * 完全没写）已经在对话里给出，本节记录：**这份分析现在已经写进
 * `00_Drag_Ordering_ADR.gs`新增的「I」节，以及`00_ADR.gs`
 * ADR-2026-08-26-026 条目的 Notes 追加**——不是只停留在这次对话/
 * checkpoint 里。ADR-026 的 **Status 依然是 Proposed，没有被这次
 * 新增分析升级成 Accepted**——新分析不构成批准，UI-I6 依然
 * BLOCKED_PENDING_ARCHITECTURE_DECISION。完整结论、三个待决问题
 * （Phase 2 范围/Filter+拖动策略/mobile 手势）见
 * `00_Drag_Ordering_ADR.gs`「I」节，不在这里重复。
 *
 * 本节之后，Carson 要求立即暂停 coding，对本窗口做完整核对+产出新的
 * session handoff checkpoint 文件——本轮到此为止，没有新的代码/测试/
 * schema 改动。完整的"已完成/未完成/blocked/被取代"分类见新产出的
 * `00_Session_Handoff_Checkpoint_2026-09-10.js`，那份文件是本窗口
 * 对外的主要交接依据，本节只做一次指针式记录，不重复整理。
 */

// ============================================================
// 四十六、Carson 批准 ADR-026 三个 Decision Gate + UI-I6 Phase 2
//         implementation 完成（2026-09-11）
// ============================================================

/**
 * 接续上一节的 checkpoint——Carson 带着对三个待决问题的明确答案回来：
 *
 *   Decision 1（Phase 2 Scope）：只做 Inbox/'ALL_OPEN_TASKS'，不等
 *   Project/Workflow/Review 详情视图。
 *   Decision 2（Filter + Drag）：有 active Filter 时禁止 Drag，不做
 *   filtered-subset merge 算法。
 *   Decision 3（Mobile/Desktop Drag UX）：专门的 drag handle，不是
 *   整行可拖。
 *
 * 按 checkpoint 自己写下的顺序执行：先更新 `00_Drag_Ordering_ADR.gs`
 * 「J」节 + `00_ADR.gs` ADR-026 条目（Status Proposed → **Accepted**，
 * Decision Date 2026-09-11），核实 Inbox/Tasks 面板确实有 Filter 功能
 * （`ui_index.html` 的 taskCategoryFilter/taskPriorityFilter——checkpoint
 * 点名要核实的那个假设，核实结果：有，Decision 2 确实适用，不是
 * moot case），然后进入 Phase 2 implementation，Carson 明确指示"不需要
 * 再次询问这三个已经决定的问题"。
 *
 * Implementation 完成范围（逐文件理由见 `00_Drag_Ordering_ADR.gs`
 * 「J.6」，不在这里重复）：
 *   - `15_Setup.gs`：新表 TaskViewOrder（setupSheets/
 *     repairSheetHeaders/runDiagnostics 三处 + runPreflightCheck 两处
 *     函数签名核对）
 *   - `12_TaskQueryEngine.gs`：getTaskViewOrder（读）
 *   - `20_TaskEngine.gs`：updateTaskOrder（写命令 + 独立读回校验，
 *     故意不用 event.projection_ok 兜底模式，理由见该函数注释和
 *     「Known Limitation 九」）
 *   - `10_ProjectionEngine.gs`：VIEW_ORDER_UPDATED case +
 *     projectViewOrderUpdated_ + 私有 _replaceTaskViewOrderRows_
 *     （整体覆盖式重写，不进 TIMELINE_ENTITY_MAP）
 *   - `11_ProjectionRebuilder__UI_I6_ADDITIONS.gs`（新增）：
 *     rebuildTaskViewOrderProjection（Replay，Everything Rebuildable）
 *   - `50_UIBridge.gs`：ui_updateTaskOrder（新）+
 *     ui_getConvertibleTasks（联查 view_order_index）
 *   - `ui_index.html`：Manual sort 选项、每张卡片的 drag handle、
 *     Pointer Events 拖拽逻辑（desktop/mobile 同一套）、Filter/非
 *     Manual 时 disabled + 提示原因、失败回滚（跟 Slice 5 乐观 UI
 *     同一原则，见三十六节）
 *   - `58_Tests_DragOrdering.gs`（新增）：7 个测试，单一入口
 *     `runDragOrderingGate()`
 *   - 治理文档同步：`00_Data_Ownership.gs`「一」新增 TaskViewOrder 行、
 *     `00_File_Map.gs` 两处更新（修正 ADR-026 状态 blurb + 登记两个
 *     新文件）
 *
 * 核实/修正一处「H.3」原文的实现细节（不是否定架构判断）：TaskViewOrder
 * 是全新表，`_ensureSheet_()` 本身就会把全新表的整个数据区设成
 * Plain-Text，不需要「H.3」原文建议的
 * `_setPlainTextFormatForNewColumns_`（那个工具函数是给"已有数据的表
 * 追加新列"这种场景用的）——也因此不需要新的 migration 步骤，
 * `migrateSchemaPersonalLifeOS()` 末尾已有的 `setupSheets()` 调用会
 * 自动带上这张新表，跟 Sprint 1 七张新表同一个证明，见
 * `00_Drag_Ordering_ADR.gs`「J.6」Schema/Migration 两行的完整说明。
 *
 * 如实记录一处 side-finding（不是本次范围，只是核对
 * `11_ProjectionRebuilder.gs` 时顺带发现）：`rebuildAllProjections()`
 * 目前只调用四个既有 rebuild* 函数，没有看到 Sprint 1 新增的
 * `rebuildProjectsProjection()`/`rebuildWorkflowsProjection()` 调用——
 * 跟当年 `__SPRINT1_ADDITIONS.gs` 文件头"请追加两行调用"的说明对不上。
 * 不是本次三个 Decision Gate 的范围，也不是 UI-I6 引入的问题，记录在
 * `11_ProjectionRebuilder__UI_I6_ADDITIONS.gs` 文件头，供 Carson 决定
 * 要不要一起补上（Projects/Workflows/TaskViewOrder 三个 rebuild 函数
 * 的调用）。
 *
 * 验证状态：STATIC/AUTOMATED——`58_Tests_DragOrdering.
 * runDragOrderingGate()` 覆盖 persist+读回、覆盖式重写不留孤行、Task
 * 自身字段/Identity 不受影响（逐字段核对）、输入校验、复合键跨
 * context 隔离、UIBridge round trip（含 view_order_index 联查）、
 * Replay 跟实际状态一致——七项，全部通过（前提：Carson 需要先把
 * `11_ProjectionRebuilder__UI_I6_ADDITIONS.gs` 的函数粘贴进真实的
 * `11_ProjectionRebuilder.gs`，否则最后一项 Replay 测试找不到这个
 * 函数）。LIVE TEST PENDING——真实浏览器里的拖拽交互（handle 视觉
 * 禁用态、真实 Pointer 事件、真实 Filter 联动）、真实 Spreadsheet 上
 * 的 migrateSchemaPersonalLifeOS() 执行，全部还没有被跑过，需要 Carson
 * 回到电脑前验证，最小 LIVE Gate 清单在对话记录里，不在本文件重复。
 *
 * UI-I6 整体状态：**ACCEPTED / IMPLEMENTATION READY → IMPLEMENTED，
 * STATIC/AUTOMATED VERIFIED，LIVE TEST PENDING**。Known Limitation
 * 8/9、Project Deadline Contract、`source_domain` migration、Quick
 * Add 等既有 Freeze 项，本节没有触碰任何一个。
 */

// ============================================================
// 四十七、UI-I6 LIVE Gate 实测：拖不动的 bug + 修复 + 最终 LIVE
//         VERIFIED（2026-09-11，同一天晚些时候）
// ============================================================

/**
 * 接续上一节。Carson 跑完四十六节列的 LIVE Gate 清单：
 * migrateSchemaPersonalLifeOS() 建表成功、runPreflightCheck 全过、
 * `runDragOrderingGate()` 全过、既有 regression gate（
 * `runUIBridgeInteractionsGate`/Sprint 3 Acceptance Gate/
 * TaskToNoteConversion/TaskToProjectPrecheck）全过——但真实浏览器里
 * Manual 排序 + 无 Filter 时，drag handle 渲染正确、cursor 正确，
 * 实际按住拖动完全拖不动，也没有触发 ui_updateTaskOrder 请求。
 *
 * 三个根因（全部在 ui_index.html 交付版本的拖拽实现里，STATIC/
 * AUTOMATED 天然测不到——那一层测的是服务端持久化，见「四十六」）：
 * (1) move/up/cancel 监听挂在 18px 宽的 handle 本身，指针一移动就
 * 滑出这个区域，事件直接丢失；(2) 用 setPointerCapture 想弥补，但
 * GAS Web App 的 iframe 沙箱下，这个 API 配合拖拽中 insertBefore
 * 动态改 DOM 顺序，会被浏览器判定成交互上下文突变，强制触发
 * pointercancel，跟原来"cancel 就回滚"的逻辑一起构成死锁；(3) SVG
 * 内部圆点没设 pointer-events:none，点击可能落在子元素上。修复：
 * move/up/cancel 改挂 document（"局部激活，全局监听"），去掉
 * setPointerCapture，SVG 加 pointer-events:none。完整診断+修复文字
 * 见 `00_Drag_Ordering_ADR.gs`「J.8」，这里不重复。
 *
 * 修复后复测：拖拽顺畅、顺序持久化正确、reload 不丢失，既有
 * regression gate 复测仍然全过（确认修复没有波及既有功能）。
 *
 * **UI-I6（Drag Ordering，ADR-2026-08-26-026）最终状态：ACCEPTED /
 * LIVE VERIFIED**——四个 Track（见「四十五」之前的记录）里第一个真正
 * 完整走完 STATIC → AUTOMATED → REGRESSION → LIVE 全链路并拿到 LIVE
 * VERIFIED 的新功能（不是修复，是从 Decision Gate 到可用功能整条走完）。
 *
 * 可复用的一般性教训（不止对拖拽有效，写在这里是因为这是第一次真正
 * 用到手势类交互，未来任何前端手势/滑块/长按功能都适用）：手势类
 * 交互的 pointerdown 可以留在触发它的具体元素上，但 pointermove/
 * pointerup/pointercancel 应该挂在 document/window 上，不要挂在那个
 * 具体元素本身；这个项目的 GAS Web App 部署形态（iframe 沙箱）下，
 * 不要依赖 Pointer Capture 这类在沙箱里表现不稳定的高级 API。
 *
 * Carson 的下一步建议：UI-I6 到此完全归档，精力转向 **Project
 * Deadline Contract**（解开 Overall Dashboard + Task→Project 阻塞的
 * 核心决策）——本节只记录这个方向性决定，具体讨论内容留给对应的
 * session/文件，不在这里展开。
 */

// ============================================================
// 四十八、rebuildAllProjections() Recovery Completeness Fix（Decision 3，
//         2026-09-15，跟「四十六」「四十七」的 Project Deadline Contract
//         是两条独立任务，本节单独记录）
// ============================================================

/**
 * 背景：`rebuildAllProjections()` 一直只调用 Tasks 相关四个 rebuild*
 * 函数（`rebuildTasksProjection`/`rebuildActiveTasksProjection`/
 * `rebuildStatisticsProjection`/`rebuildTaskFiltersProjection`），漏掉
 * 了 Sprint 1 就新增的 `rebuildProjectsProjection`/
 * `rebuildWorkflowsProjection`（存在于当时的
 * `11_ProjectionRebuilder__SPRINT1_ADDITIONS.gs`，文件头明确要求"追加
 * 两行调用"，但这个粘贴动作从未真正发生）和 UI-I6 新增的
 * `rebuildTaskViewOrderProjection`（同样以"待粘贴"补丁文件形式交付，
 * 同样没有被粘贴）——这个具体缺口是 UI-I6 那次工作（见「四十六」
 * 「四十七」）顺带发现、如实记录、当时刻意没有顺手改的 side-finding，
 * 这次作为独立任务正式处理。
 *
 * Phase 0 验证（不相信旧报告，重新核对当前代码）：确认
 * `rebuildAllProjections()` 当前确实只调用四个；确认
 * `rebuildProjectsProjection`/`rebuildWorkflowsProjection`/
 * `rebuildTaskViewOrderProjection` 三个函数体本身都存在、逻辑都正确
 * （分别核对了 `ProjectEngine.deriveFromEvent`/`materializeProjectRow_`、
 * `WorkflowEngine` 同名函数、以及 TaskViewOrder 自己的整体覆盖式重写
 * 逻辑）；确认三者之间以及跟既有四个之间都没有真实的执行顺序依赖
 * （逐个核对了每个 rebuild* 函数的实现——包括原本"看起来"应该有顺序
 * 依赖的 `rebuildStatisticsProjection`，核对后发现它实际是独立从
 * Events 重新推导，不读 Tasks Sheet，跟 Tasks 重建与否无关）；确认
 * `EventBus.getAllEvents()` 有执行期缓存，只有 `publish()` 写新事件
 * 才失效——这保证一次 `rebuildAllProjections()` 调用里全部七个子函数
 * 拿到的是同一份 Events 快照，天然一致，不需要额外的同步机制。
 *
 * Phase 1 审计：逐表建立 Projection → Rebuild Function → 顶层调用覆盖
 * 的对应关系，除了确认上述三个缺口，额外发现六张表**完全没有对应的
 * rebuild 函数**（ArchiveTasks/Timeline/Notes/Reviews/BusinessRules/
 * WorkflowTemplates）——按任务要求只记录（见
 * `00_Known_Limitations.gs`「十」），不在本次设计新的 rebuild 架构。
 *
 * Phase 2 修复：把三个函数原样迁移进 `11_ProjectionRebuilder.gs`
 * 本体（不再是"待粘贴"补丁文件），`rebuildAllProjections()` 追加三行
 * 调用（保留原有四个顺序不变，新增三个之间的顺序纯粹是可读性考虑——
 * 已核实这七个互相没有依赖，任何顺序结果都应该相同）。为避免同名函数
 * 在两处文件里各存一份（GAS 扁平命名空间下会静默覆盖），同步清理了
 * `11_ProjectionRebuilder__SPRINT1_ADDITIONS.gs`（移除已迁移的两个
 * 函数体，保留说明性指向）和 `11_ProjectionRebuilder__UI_I6_
 * ADDITIONS.gs`（标记为已合并，保留原文作历史记录）。
 *
 * Phase 3 验证（不只是 syntax test）：本地搭了一个 Node.js 环境的 GAS
 * shim（`SpreadsheetApp`/`SecureConfig`/`Session`/`Utilities`/`Logger`
 * 等最小可用 mock，Sheet 用内存二维数组模拟），直接加载**真实生产
 * 代码文件**（不是重新实现一份等价逻辑）跑：用 `createProjectDirect_`/
 * `createWorkflowDirect_`/`createTaskDirect_`/`TaskEngine.
 * updateTaskOrder` 制造一批真实事件（2 个 Project、1 个 Workflow、3 个
 * Task、2 次拖拽排序），快照"live"状态（State A）；跑一次
 * `rebuildAllProjections()`，快照 State B；再跑一次，快照 State C。
 * 结果：Projects/Workflows/TaskViewOrder 三张表 A==B==C（忽略
 * `updated_time` 这类预期会刷新的时间戳字段），行数在三次快照之间
 * 保持不变（没有孤行/没有重复）；TaskViewOrder 的 manual ordering
 * 顺序本身在 rebuild 前后逐项比对完全一致；Tasks/ActiveTasks/
 * TaskFilters（既有四个之一）同样 A==B==C，确认这次改动没有影响它们。
 * TaskStatistics 出现一处预期内的差异：State A（0 行，因为这次模拟
 * 场景没有触发它平时的填充路径）vs State B/C（1 行，rebuild 从 Events
 * 重新推导出正确结果）——B==C（幂等），差异本身是"模拟场景没有走到
 * 平时填充 TaskStatistics 的那条路径"，跟这次三个函数的修复无关，
 * `rebuildStatisticsProjection` 本身修复前后都没有被改动。这是模拟
 * 环境（Node.js + mock Sheet），不是 Carson 真实 GAS/Spreadsheet 上的
 * LIVE 验证——LIVE 部分仍然需要 Carson 执行，见对话记录 J 节的最小
 * LIVE Gate 清单。
 *
 * 本次没有触碰：`02_EventBus.gs`、`10_ProjectionEngine.gs`的
 * dispatch()/publish() 语义、任何 Event payload 形状、Project Deadline
 * Contract（「四十六」「四十七」的话题）、UI-I6 已交付的拖拽功能本身
 * ——只是让三个已经存在、已经验证过安全的 rebuild 函数被正确调用。
 *
 * 【2026-09-15 追加，Carson 真实 GAS/Spreadsheet 执行结果】部署后跑了
 * 一次 `rebuildAllProjections()`：Events 表当时共 518 行，七个子函数
 * 全部执行、全部无报错，约 40 秒内完成。结果：Tasks 157（更新 157/
 * 新增 0）、ActiveTasks 105、TaskStatistics 89 个 chat_id、TaskFilters
 * 157、**Projects 67**、**Workflows 10**、**TaskViewOrder 13 个
 * (chat_id, context_key) 分组共 31 行——三个新增调用在真实数据规模下
 * 确认可以正常跑完，数量看起来跟真实系统规模相符（不是 0，不是异常
 * 大的数字）。这确认了 Execution 这一项在 LIVE 环境下成立；Idempotency
 * （连续跑两次数量应该完全相同）和 Persistence（具体字段值 rebuild
 * 前后一致，不只是行数/条数一致）这两项，本条日志本身还不能单独证明，
 * 需要 Carson 后续视需要再跑一次（或直接查 Sheet 内容）确认。
 *
 * 【2026-09-15 追加，第二次真实执行 + Idempotency 确认】Carson 当天
 * 晚些时候又跑了一次 `rebuildAllProjections()`：Tasks 157（更新
 * 157/新增 0）、ActiveTasks 105、TaskStatistics 89、TaskFilters 157、
 * Projects 67、Workflows 10、TaskViewOrder 13 个分组/31 行——七个数字
 * **跟第一次逐一完全相同**，确认 Idempotency 成立（连续执行不产生
 * 重复/遗漏/数量漂移）。Carson 另外手动查看了 Projects/Workflows/
 * TaskViewOrder 的实际内容，确认"看起来很正常"。至此 Execution/
 * Idempotency/Persistence（数量 + 内容双重确认）三项均已在真实环境
 * 完成验证。
 *
 * **Decision 3（rebuildAllProjections() Recovery Completeness）最终
 * 状态：LIVE VERIFIED。** 剩余可选项（非阻塞）：跑一次既有 regression
 * gate（`runUIBridgeInteractionsGate` 等）做最后的交叉确认，随时可以
 * 做，不是这次任务的必要条件。
 */
