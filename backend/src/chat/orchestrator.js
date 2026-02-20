"use strict";

const { DEFAULT_CHAT_SYSTEM_PROMPT } = require("./constants");
const { buildChatPrompt } = require("./promptBuilder");

class ConversationOrchestrator {
  constructor({ sessionManager, memoryManager, apiLayer, baseSystemPrompt } = {}) {
    if (!sessionManager || !memoryManager || !apiLayer) {
      throw new Error("sessionManager, memoryManager, and apiLayer are required.");
    }
    this.sessionManager = sessionManager;
    this.memoryManager = memoryManager;
    this.apiLayer = apiLayer;
    this.baseSystemPrompt = baseSystemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT;
  }

  async createSession(sessionId) {
    return this.sessionManager.createSession(sessionId);
  }

  async loadSession(sessionId) {
    return this.sessionManager.loadSession(sessionId);
  }

  async resetSession(sessionId) {
    return this.sessionManager.resetSession(sessionId);
  }

  async deleteSession(sessionId) {
    return this.sessionManager.deleteSession(sessionId);
  }

  async processUserMessage({ sessionId, userPrompt, ragContext }) {
    const session = await this.sessionManager.loadOrCreateSession(sessionId);
    const context = this.memoryManager.getTurnsForChatContext(session);

    const composedPrompt = buildChatPrompt({
      baseSystemPrompt: this.baseSystemPrompt,
      ragContext,
      conversationSummary: session.summary,
      rawTurnsForContext: context.turns,
      useFullHistory: context.useFullHistory,
      currentUserPrompt: userPrompt,
    });

    const assistantReply = await this.apiLayer.requestChatCompletion({ userMessage: composedPrompt });

    this.memoryManager.recordCompletedTurn(session, { userPrompt, assistantReply });

    let summaryStatus = "not_required";
    if (this.memoryManager.shouldSummarizeAfterTurn(session)) {
      const turns = this.memoryManager.getTurnsForSummarization(session);
      const summaryResult = await this.apiLayer.generateStructuredSummary({ turns });
      if (summaryResult.ok) {
        this.memoryManager.applySummary(session, summaryResult.summary);
        summaryStatus = "generated";
      } else {
        this.memoryManager.markSummaryFailure(session, summaryResult.errorCode);
        summaryStatus = "failed";
      }
    } else if (session.summary) {
      summaryStatus = "available";
    }

    const saved = await this.sessionManager.saveSession(session);

    return {
      session_id: saved.session_id,
      answer: assistantReply,
      memory: {
        total_turns: saved.total_turns,
        has_summary: Boolean(saved.summary),
        summary_status: summaryStatus,
        summary_error: saved.summary_error || null,
      },
    };
  }
}

module.exports = {
  ConversationOrchestrator,
};
