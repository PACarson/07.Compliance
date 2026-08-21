/**
 * 112_DocumentTextExtractor.js
 * Compliance OS — DocumentTextExtractor（UCR7 Adapter：PDF → 文字/结构化候选）
 *
 * 2026-08-21 起不再是纯占位——provider 已经选定 LLM-based extraction
 * （127_LLMExtractor.js，默认走 Gemini），Drive OCR 保留一个明确存在但还
 * 没接实作的 fallback/diagnostic 槽位（Steven 决定：不需要现在就是主要
 * production 路径）。
 *
 * Adapter 本身完全不变——Compliance OS 不需要知道底层是哪个 provider，
 * 只透过 extract(document) 拿结果。换 provider（Gemini 换代、或换成
 * OpenAI/Claude、或真的接上 Drive OCR）只需要在 selectExtractorProvider_
 * 里加一个分支或换掉对应实现，DocumentImportEngine 跟其他呼叫方完全
 * 不用动。
 *
 * extract(document) 的回传形状是一个 envelope，不再是裸字符串（LLM 路径
 * 回传的是「结构化候选」，不是「文字」——110_DocumentImport.js 的
 * runImportPipeline_ 根据 mode 决定走哪一条后续路径）：
 *   { mode: 'text', text: string, evidence: null }
 *     —— OCR fallback 路径：文字还是要交给 GrabWeeklyParser 的正则解析,
 *        这条路径的行为、含义跟 2026-08-21 之前完全一样
 *   { mode: 'structured', candidate: Object, evidence: Object }
 *     —— LLM 路径：candidate 要先经过 125_ExtractionValidation.js 验证
 *        才能变成 parsedStatement，不是直接采信
 */

if (typeof require === 'function') {
  var { createLLMExtractor_, realLLMExtractor_ } = require('./127_LLMExtractor.js');
}

function createDocumentTextExtractor_(extractor) {
  return {
    /**
     * @param {{fileId: string, mimeType: string, documentId: (string|null)}} document
     * @return {{mode: string, text: (string|undefined), candidate: (Object|undefined), evidence: (Object|null)}}
     */
    extract(document) {
      return extractor.extract(document);
    }
  };
}

/** Drive OCR：保留为 fallback/diagnostic 的明确槽位，还没接实作——不假装能用，一样明确抛错。 */
function placeholderOcrExtractor_() {
  return {
    extract(document) {
      const msg = `[Drive OCR fallback 尚未实作——目前的 production 路径是 LLM extraction（provider='llm'），这个槽位只是保留给未来需要 fallback/diagnostic 时用] fileId=${document && document.fileId}`;
      if (typeof AlertService !== 'undefined' && typeof AlertService.log === 'function') {
        AlertService.log('WARN', 'DocumentTextExtractor', 'extract(ocr)', document, msg);
      } else {
        console.warn(`[DocumentTextExtractor.extract] ${msg}`);
      }
      throw new Error('Drive OCR fallback extractor 尚未接上实作（CMP-P10：不猜，显性失败）——目前请使用默认的 provider=\'llm\'');
    }
  };
}

/**
 * 惰性包一层——GAS 会在每一次函式呼叫前载入整个专案（不是只载入要用到的
 * 那个文件），如果 module 顶层就急着 realLLMExtractor_()（读 Script
 * Properties、没设定好就抛错），Script Properties 还没设定 GEMINI_API_KEY/
 * EXTRACTION_EVIDENCE_FOLDER_ID 的时候，会让整个专案在载入阶段就失败——
 * 牵连到 consoleGetDashboard、setupComplianceOsSheets 等完全不需要用到
 * LLM extractor 的其他函式，不是只有真的呼叫抽取的时候才受影响。真的去读
 * Script Properties、检查有没有设定好，延后到第一次真的呼叫 .extract()
 * 才做（用一次模拟「PropertiesService 存在但没有任何 Script Property」的
 * 完整载入检查实测出来过这个问题）。
 */
function lazyLLMExtractor_() {
  let cached = null;
  return {
    extract(document) {
      if (!cached) cached = realLLMExtractor_();
      return cached.extract(document);
    }
  };
}

/**
 * 选 provider。目前只有 'llm' 真的接了实作；'ocr' 是明确存在但还没实作的
 * 槽位（Steven 决定：Drive OCR 保留为 fallback/diagnostic，不是现在就要
 * 做的主要路径）。不认得的 provider 名字直接抛错，不 fallback 到别的（CMP-P10）。
 * @param {string} providerName 'llm'（默认）或 'ocr'
 * @param {Object} [llmDeps] 只有 providerName==='llm' 且要注入假 deps 时才用（测试用）；
 *   GAS 环境下不传就是 lazyLLMExtractor_()（真正的 realLLMExtractor_() 延后到
 *   第一次 extract() 呼叫才建构）
 * @return {{extract: function(Object): Object}}
 */
function selectExtractorProvider_(providerName, llmDeps) {
  const name = providerName || 'llm';
  if (name === 'llm') {
    if (llmDeps) return llmDeps; // 测试注入的假 extractor，直接用
    if (typeof PropertiesService !== 'undefined') return lazyLLMExtractor_();
    // Node 环境、没有注入假 deps：不是真的要用，是 module 载入时的默认值，
    // 真正呼叫 extract() 前测试一定会换成假实现或直接测 createLLMExtractor_
    return { extract() { throw new Error('selectExtractorProvider_: Node 环境下呼叫真的 LLM extractor 需要注入假 deps，不能用真实 provider'); } };
  }
  if (name === 'ocr') {
    return placeholderOcrExtractor_();
  }
  throw new Error(`selectExtractorProvider_: 不认得的 provider "${name}"（目前只支援 'llm' / 'ocr'）`);
}

var DocumentTextExtractor = createDocumentTextExtractor_(selectExtractorProvider_('llm'));

if (typeof module !== 'undefined') {
  module.exports = {
    createDocumentTextExtractor_,
    placeholderOcrExtractor_,
    selectExtractorProvider_,
    DocumentTextExtractor
  };
}
