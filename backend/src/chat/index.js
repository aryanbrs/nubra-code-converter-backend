"use strict";

const { StatelessLlmApiLayer } = require("./apiLayer");
const { sharedChatController } = require("./chatController");
const { DEFAULT_CHAT_SYSTEM_PROMPT, RECENT_RAW_TURN_WINDOW, SUMMARY_TRIGGER_TURN } = require("./constants");
const { MemoryManager } = require("./memoryManager");
const { ConversationOrchestrator } = require("./orchestrator");
const { buildChatPrompt, buildSummarizationPrompt } = require("./promptBuilder");
const { SessionManager, assertValidSessionId, createEmptySession } = require("./sessionManager");
const { InMemorySessionStore, ChromeStorageSessionStore } = require("./sessionStore");
const { parseAndValidateSummary, validateSummaryShape } = require("./summarySchema");

module.exports = {
  StatelessLlmApiLayer,
  sharedChatController,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  RECENT_RAW_TURN_WINDOW,
  SUMMARY_TRIGGER_TURN,
  MemoryManager,
  ConversationOrchestrator,
  buildChatPrompt,
  buildSummarizationPrompt,
  SessionManager,
  assertValidSessionId,
  createEmptySession,
  InMemorySessionStore,
  ChromeStorageSessionStore,
  parseAndValidateSummary,
  validateSummaryShape,
};
