"use strict";

const { detectPromptInjectionIndicators, MAX_CODE_LENGTH } = require("../convertCore");
const { StatelessLlmApiLayer } = require("./apiLayer");
const { MemoryManager } = require("./memoryManager");
const { ConversationOrchestrator } = require("./orchestrator");
const { SessionManager, assertValidSessionId } = require("./sessionManager");
const { InMemorySessionStore } = require("./sessionStore");

function normalizeAction(value) {
  if (!value) return "chat";
  return String(value).trim().toLowerCase();
}

function normalizePrompt(prompt) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    const err = new Error("prompt is required and must be a non-empty string.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (prompt.length > MAX_CODE_LENGTH) {
    const err = new Error(
      `prompt exceeds maximum allowed length of ${MAX_CODE_LENGTH} characters. Please trim your input.`
    );
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return prompt.trim();
}

function normalizeSessionId(sessionId, { required }) {
  if (sessionId === undefined || sessionId === null || String(sessionId).trim() === "") {
    if (required) {
      const err = new Error("session_id is required for this action.");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    return null;
  }

  const normalized = String(sessionId).trim();
  try {
    assertValidSessionId(normalized);
  } catch (error) {
    const err = new Error(error.message);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return normalized;
}

function createSharedChatController() {
  const sessionStore = new InMemorySessionStore();
  const sessionManager = new SessionManager({ store: sessionStore });
  const memoryManager = new MemoryManager();
  const apiLayer = new StatelessLlmApiLayer();
  const orchestrator = new ConversationOrchestrator({ sessionManager, memoryManager, apiLayer });

  return {
    async handle(body) {
      try {
        const payload = body && typeof body === "object" ? body : {};
        const action = normalizeAction(payload.action);

        if (action === "create_session") {
          const requestedId = normalizeSessionId(payload.session_id, { required: false });
          const session = await orchestrator.createSession(requestedId || undefined);
          return {
            statusCode: 200,
            body: {
              session_id: session.session_id,
              created_at: session.created_at,
            },
          };
        }

        if (action === "load_session") {
          const sessionId = normalizeSessionId(payload.session_id, { required: true });
          const session = await orchestrator.loadSession(sessionId);
          if (!session) {
            return {
              statusCode: 404,
              body: { errorCode: "SESSION_NOT_FOUND", message: "Session not found." },
            };
          }
          return {
            statusCode: 200,
            body: {
              session_id: session.session_id,
              created_at: session.created_at,
              updated_at: session.updated_at,
              total_turns: session.total_turns,
              summary: session.summary,
              all_turns: session.all_turns,
              raw_turns: session.raw_turns,
            },
          };
        }

        if (action === "reset_session") {
          const sessionId = normalizeSessionId(payload.session_id, { required: true });
          try {
            const session = await orchestrator.resetSession(sessionId);
            return {
              statusCode: 200,
              body: {
                session_id: session.session_id,
                reset: true,
                total_turns: session.total_turns,
              },
            };
          } catch (error) {
            if (error && error.code === "SESSION_NOT_FOUND") {
              return {
                statusCode: 404,
                body: { errorCode: "SESSION_NOT_FOUND", message: "Session not found." },
              };
            }
            throw error;
          }
        }

        if (action === "delete_session") {
          const sessionId = normalizeSessionId(payload.session_id, { required: true });
          const deleted = await orchestrator.deleteSession(sessionId);
          if (!deleted) {
            return {
              statusCode: 404,
              body: { errorCode: "SESSION_NOT_FOUND", message: "Session not found." },
            };
          }
          return {
            statusCode: 200,
            body: { session_id: sessionId, deleted: true },
          };
        }

        if (action !== "chat") {
          return {
            statusCode: 400,
            body: {
              errorCode: "VALIDATION_ERROR",
              message:
                "Invalid action. Supported actions: chat, create_session, load_session, reset_session, delete_session.",
            },
          };
        }

        const sessionId = normalizeSessionId(payload.session_id, { required: false });
        const prompt = normalizePrompt(payload.prompt);

        if (detectPromptInjectionIndicators(prompt)) {
          return {
            statusCode: 400,
            body: {
              errorCode: "UNSAFE_INPUT",
              message:
                "Input appears to contain prompt-injection style instructions. Please remove such content and try again.",
            },
          };
        }

        const result = await orchestrator.processUserMessage({
          sessionId,
          userPrompt: prompt,
          ragContext: payload.rag_context,
        });

        return {
          statusCode: 200,
          body: result,
        };
      } catch (error) {
        if (error && error.code === "VALIDATION_ERROR") {
          return {
            statusCode: 400,
            body: {
              errorCode: "VALIDATION_ERROR",
              message: error.message,
            },
          };
        }
        if (error && error.code === "SESSION_ALREADY_EXISTS") {
          return {
            statusCode: 409,
            body: {
              errorCode: "SESSION_ALREADY_EXISTS",
              message: error.message,
            },
          };
        }
        if (error && error.code === "SESSION_NOT_FOUND") {
          return {
            statusCode: 404,
            body: {
              errorCode: "SESSION_NOT_FOUND",
              message: error.message,
            },
          };
        }
        throw error;
      }
    },
  };
}

// Module-scoped singleton keeps session state warm per runtime instance.
const sharedChatController = createSharedChatController();

module.exports = {
  sharedChatController,
};
