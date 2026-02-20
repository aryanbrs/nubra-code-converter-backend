"use strict";

const { randomUUID } = require("crypto");
const { InMemorySessionStore, cloneSerializable } = require("./sessionStore");

const MAX_SESSION_ID_LENGTH = 128;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function assertValidSessionId(sessionId) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    throw new Error("session_id must be a non-empty string.");
  }
  if (sessionId.length > MAX_SESSION_ID_LENGTH) {
    throw new Error(`session_id exceeds ${MAX_SESSION_ID_LENGTH} characters.`);
  }
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("session_id must contain only letters, digits, underscore, or hyphen.");
  }
}

function createEmptySession(sessionId) {
  const now = new Date().toISOString();
  return {
    session_id: sessionId,
    created_at: now,
    updated_at: now,
    total_turns: 0,
    // Full immutable history of every completed turn.
    all_turns: [],
    // Mutable context history used by prompt orchestration.
    raw_turns: [],
    summary: null,
    summary_generated_at: null,
    summary_attempted: false,
    summary_error: null,
  };
}

class SessionManager {
  constructor({ store } = {}) {
    this.store = store || new InMemorySessionStore();
  }

  async createSession(sessionId) {
    const id = sessionId || randomUUID();
    assertValidSessionId(id);

    const existing = await this.store.getSession(id);
    if (existing) {
      const err = new Error(`Session '${id}' already exists.`);
      err.code = "SESSION_ALREADY_EXISTS";
      throw err;
    }

    const next = createEmptySession(id);
    await this.store.setSession(id, next);
    return cloneSerializable(next);
  }

  async loadSession(sessionId) {
    assertValidSessionId(sessionId);
    const session = await this.store.getSession(sessionId);
    return session ? cloneSerializable(session) : null;
  }

  async loadOrCreateSession(sessionId) {
    if (sessionId) {
      assertValidSessionId(sessionId);
      const existing = await this.store.getSession(sessionId);
      if (existing) return cloneSerializable(existing);
      const created = createEmptySession(sessionId);
      await this.store.setSession(sessionId, created);
      return cloneSerializable(created);
    }

    const created = await this.createSession();
    return cloneSerializable(created);
  }

  async saveSession(session) {
    assertValidSessionId(session && session.session_id);
    const next = cloneSerializable(session);
    next.updated_at = new Date().toISOString();
    await this.store.setSession(next.session_id, next);
    return cloneSerializable(next);
  }

  async resetSession(sessionId) {
    assertValidSessionId(sessionId);
    const existing = await this.store.getSession(sessionId);
    if (!existing) {
      const err = new Error(`Session '${sessionId}' not found.`);
      err.code = "SESSION_NOT_FOUND";
      throw err;
    }
    const reset = createEmptySession(sessionId);
    reset.created_at = existing.created_at;
    reset.updated_at = new Date().toISOString();
    await this.store.setSession(sessionId, reset);
    return cloneSerializable(reset);
  }

  async deleteSession(sessionId) {
    assertValidSessionId(sessionId);
    return this.store.deleteSession(sessionId);
  }
}

module.exports = {
  MAX_SESSION_ID_LENGTH,
  assertValidSessionId,
  createEmptySession,
  SessionManager,
};
