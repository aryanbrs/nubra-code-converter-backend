"use strict";

const { chatbaseConvert } = require("../chatbaseClient");
const { parseAndValidateSummary } = require("./summarySchema");
const { buildSummarizationPrompt } = require("./promptBuilder");

class StatelessLlmApiLayer {
  constructor({ completionClient } = {}) {
    this.completionClient = completionClient || chatbaseConvert;
  }

  async requestChatCompletion({ userMessage }) {
    const result = await this.completionClient({ userMessage });
    return String(result && result.text ? result.text : "").trim();
  }

  async generateStructuredSummary({ turns }) {
    const basePrompt = buildSummarizationPrompt({ turns });
    let lastValidationError = "SUMMARY_INVALID_JSON";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retryHint =
        attempt === 0
          ? ""
          : "\n\nRetry requirement: return strictly valid JSON matching the exact schema with all fields.";
      const raw = await this.requestChatCompletion({ userMessage: `${basePrompt}${retryHint}` });
      const parsed = parseAndValidateSummary(raw);
      if (parsed.ok) {
        return {
          ok: true,
          summary: parsed.summary,
          raw_summary: raw,
        };
      }
      lastValidationError = parsed.errorCode || "SUMMARY_VALIDATION_FAILED";
    }

    return {
      ok: false,
      errorCode: lastValidationError,
    };
  }
}

module.exports = {
  StatelessLlmApiLayer,
};
