"use strict";

const { RECENT_RAW_TURN_WINDOW, SUMMARY_TRIGGER_TURN } = require("./constants");

class MemoryManager {
  constructor({ summaryTriggerTurn = SUMMARY_TRIGGER_TURN, recentRawTurnWindow = RECENT_RAW_TURN_WINDOW } = {}) {
    this.summaryTriggerTurn = summaryTriggerTurn;
    this.recentRawTurnWindow = recentRawTurnWindow;
  }

  recordCompletedTurn(session, { userPrompt, assistantReply }) {
    const now = new Date().toISOString();
    const turn = {
      turn_index: Number(session.total_turns || 0) + 1,
      user: String(userPrompt || ""),
      assistant: String(assistantReply || ""),
      created_at: now,
    };

    if (!Array.isArray(session.all_turns)) session.all_turns = [];
    if (!Array.isArray(session.raw_turns)) session.raw_turns = [];

    session.all_turns.push(turn);
    session.raw_turns.push(turn);
    session.total_turns = turn.turn_index;
    session.updated_at = now;
  }

  shouldSummarizeAfterTurn(session) {
    return (
      Number(session.total_turns || 0) === this.summaryTriggerTurn &&
      !session.summary &&
      !session.summary_attempted
    );
  }

  getTurnsForChatContext(session) {
    const rawTurns = Array.isArray(session.raw_turns) ? session.raw_turns : [];
    if (!session.summary) {
      return {
        turns: rawTurns.slice(),
        useFullHistory: true,
      };
    }

    return {
      turns: rawTurns.slice(-this.recentRawTurnWindow),
      useFullHistory: false,
    };
  }

  getTurnsForSummarization(session) {
    return Array.isArray(session.all_turns) ? session.all_turns.slice() : [];
  }

  applySummary(session, summary) {
    session.summary = summary;
    session.summary_generated_at = new Date().toISOString();
    session.summary_attempted = true;
    session.summary_error = null;
    // Clear mutable raw context after summary, per spec.
    session.raw_turns = [];
    session.updated_at = new Date().toISOString();
  }

  markSummaryFailure(session, errorCode) {
    session.summary_attempted = true;
    session.summary_error = String(errorCode || "SUMMARY_GENERATION_FAILED");
    session.updated_at = new Date().toISOString();
  }
}

module.exports = {
  MemoryManager,
};
