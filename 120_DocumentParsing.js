/**
 * 120_DocumentParsing.js
 * Compliance OS — Document Parsing Engine: Parser 接口 + Registry
 *
 * 对应治理层 §4.1（Module Boundary / Parser Interface）。
 * 设计原则：任何新的官方文件来源，只需要新增一个继承 DocumentParser 的
 * 具体 Parser，并在该 Parser 文件底部调用 ParserRegistry.register(...) 自我
 * 注册——不需要改动这个文件、Reconciliation Engine，或任何下游逻辑。
 *
 * 遵循 UEF UCR1（IIFE）、UCR2（私有函数前缀 _）、UCR3（公开函数 try/catch
 * + AlertService.log）。AlertService 假设由 Personal AI Core 提供；本地找不到
 * 时退回 console.error，让这个文件在 GAS 之外（例如 Node 测试）也能跑。
 */

var DocumentParser = (function () {
  'use strict';

  /**
   * DocumentParser —— 所有具体 Parser 的基类/契约。
   * 不要直接实例化这个类本身；具体 Parser（例如 GrabWeeklyParser）继承它并
   * 覆写下面四个方法。GAS/JS 没有真正的 interface，这里用「未覆写就抛错」的
   * 方式做运行时约束，同时也是活文档。
   */
  class DocumentParser {
    /**
     * 这个 Parser 能不能处理传进来的这份文件。
     * @param {Object} document Documents 表的一行（含 source / document_type）
     * @return {boolean}
     */
    canParse(document) {
      throw new Error(`${this.parserId()}.canParse() 未实现`);
    }

    /**
     * 把原始文件的抽取文字解析成标准 JSON（对应 Phase 2 字段分析文档的 Schema）。
     * @param {Object} document Documents 表的一行
     * @param {string} rawText 从原始文件抽取出来的纯文字内容
     * @return {Object} ParsedStatement
     */
    parse(document, rawText) {
      throw new Error(`${this.parserId()}.parse() 未实现`);
    }

    /** @return {string} Parser 的稳定标识，写入 Parsed_Statements.parser_id */
    parserId() {
      throw new Error('parserId() 未实现');
    }

    /** @return {string} 目前输出的 Schema 版本号，写入 Parsed_Statements.parser_version */
    schemaVersion() {
      throw new Error('schemaVersion() 未实现');
    }
  }

  return DocumentParser;
})();

/** UCR3：公开函数统一的 try/catch → 记录 → 用户可读错误 出口。 */
function logAndRethrow_(moduleName, funcName, input, err) {
  const msg = err && err.message ? err.message : String(err);
  if (typeof AlertService !== 'undefined' && typeof AlertService.log === 'function') {
    AlertService.log('ERROR', moduleName, funcName, input, msg);
  } else {
    // AlertService 不可用时的退路（例如本地/Node 测试环境）——不是正式记录，
    // 只是让这个文件在 GAS 之外也能正常运作。
    console.error(`[${moduleName}.${funcName}] ${msg}`);
  }
  throw err;
}

var ParserRegistry = (function () {
  'use strict';

  const _parsers = [];

  function register_(parser) {
    if (typeof parser.canParse !== 'function' || typeof parser.parse !== 'function') {
      throw new Error('注册的 Parser 没有实现 DocumentParser 的必要方法');
    }
    _parsers.push(parser);
  }

  function getParserFor_(document) {
    const found = _parsers.find((p) => p.canParse(document));
    if (!found) {
      throw new Error(
        `找不到能处理这份文件的 Parser：source=${document && document.source}, document_type=${document && document.document_type}`
      );
    }
    return found;
  }

  return {
    /**
     * 注册一个 Parser 实例。各个 Parser 文件在自己文件底部调用这个方法自我注册，
     * 这个文件本身永远不需要知道具体有哪些 Parser。
     * @param {DocumentParser} parser
     */
    register(parser) {
      try {
        register_(parser);
      } catch (err) {
        logAndRethrow_('ParserRegistry', 'register', { parserId: parser && parser.parserId && parser.parserId() }, err);
      }
    },

    /**
     * 依 document 找到能处理它的 Parser。找不到就抛错——交给上层把
     * Documents.status 设成 Failed_Parse，而不是静默跳过。
     * @param {Object} document
     * @return {DocumentParser}
     */
    getParserFor(document) {
      try {
        return getParserFor_(document);
      } catch (err) {
        logAndRethrow_('ParserRegistry', 'getParserFor', document, err);
      }
    },

    /** @return {string[]} 目前注册了哪些 Parser，供诊断/测试用 */
    listRegistered() {
      return _parsers.map((p) => p.parserId());
    }
  };
})();

if (typeof module !== 'undefined') {
  module.exports = { DocumentParser, ParserRegistry };
}
