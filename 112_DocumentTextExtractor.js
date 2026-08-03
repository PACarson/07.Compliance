/**
 * 112_DocumentTextExtractor.js
 * Compliance OS — DocumentTextExtractor（UCR7 Adapter：PDF → 文字）
 *
 * 采纳的建议：不要把抽取方式写死——Compliance OS 不需要知道底层是 Drive
 * OCR、Gemini、OpenAI、Claude 还是别的服务，只透过这个 Adapter 拿文字。
 * 目前是占位（UCR7：依赖没确认就不要猜签名硬上），换底层实现只需要改
 * createDocumentTextExtractor_() 里传的 extractor 参数，DocumentImportEngine
 * 跟其他调用方完全不用动。
 */

function createDocumentTextExtractor_(extractor) {
  return {
    /**
     * @param {{fileId: string, mimeType: string}} document 要抽取的文件
     * @return {string} 抽取出来的纯文字
     */
    extract(document) {
      return extractor.extract(document);
    }
  };
}

/** 占位实现：还没确认要用 Drive OCR 还是 LLM API，先明确抛错，不要猜。 */
function placeholderExtractor_() {
  return {
    extract(document) {
      const msg = `[占位实现，抽取方式还没确认（Drive OCR？Gemini/OpenAI/Claude？）] fileId=${document && document.fileId}`;
      if (typeof AlertService !== 'undefined' && typeof AlertService.log === 'function') {
        AlertService.log('WARN', 'DocumentTextExtractor', 'extract', document, msg);
      } else {
        console.warn(`[DocumentTextExtractor.extract] ${msg}`);
      }
      throw new Error('DocumentTextExtractor 尚未接上真实抽取实现——需要先确认用哪种方式（CMP-P10：不猜，显性失败）');
    }
  };
}

var DocumentTextExtractor = createDocumentTextExtractor_(placeholderExtractor_());

if (typeof module !== 'undefined') {
  module.exports = { createDocumentTextExtractor_, DocumentTextExtractor };
}
