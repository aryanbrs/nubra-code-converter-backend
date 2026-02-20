"use strict";

function cloneSerializable(value) {
  return JSON.parse(JSON.stringify(value));
}

class InMemorySessionStore {
  constructor() {
    this.sessions = new Map();
  }

  async getSession(sessionId) {
    const raw = this.sessions.get(sessionId);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async setSession(sessionId, session) {
    // Persist as JSON to guarantee serializability.
    this.sessions.set(sessionId, JSON.stringify(session));
  }

  async deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  async listSessions() {
    return Array.from(this.sessions.values()).map((raw) => JSON.parse(raw));
  }
}

function wrapChromeStorageMethod(storageArea, methodName, ...args) {
  return new Promise((resolve, reject) => {
    const method = storageArea[methodName];
    if (typeof method !== "function") {
      reject(new Error(`Invalid chrome storage method: ${methodName}`));
      return;
    }

    // Supports callback-based chrome.storage API.
    method.call(storageArea, ...args, (result) => {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result);
    });
  });
}

class ChromeStorageSessionStore {
  constructor({ storageArea, rootKey = "nubra_chat_sessions" }) {
    if (!storageArea) {
      throw new Error("storageArea is required for ChromeStorageSessionStore.");
    }
    this.storageArea = storageArea;
    this.rootKey = rootKey;
  }

  async readAll() {
    const payload = await wrapChromeStorageMethod(this.storageArea, "get", [this.rootKey]);
    const all = payload && payload[this.rootKey];
    if (!all || typeof all !== "object") return {};
    return cloneSerializable(all);
  }

  async writeAll(allSessions) {
    await wrapChromeStorageMethod(this.storageArea, "set", { [this.rootKey]: allSessions });
  }

  async getSession(sessionId) {
    const all = await this.readAll();
    return all[sessionId] ? cloneSerializable(all[sessionId]) : null;
  }

  async setSession(sessionId, session) {
    const all = await this.readAll();
    all[sessionId] = cloneSerializable(session);
    await this.writeAll(all);
  }

  async deleteSession(sessionId) {
    const all = await this.readAll();
    const existed = Object.prototype.hasOwnProperty.call(all, sessionId);
    if (existed) {
      delete all[sessionId];
      await this.writeAll(all);
    }
    return existed;
  }

  async listSessions() {
    const all = await this.readAll();
    return Object.values(all).map((session) => cloneSerializable(session));
  }
}

module.exports = {
  InMemorySessionStore,
  ChromeStorageSessionStore,
  cloneSerializable,
};
