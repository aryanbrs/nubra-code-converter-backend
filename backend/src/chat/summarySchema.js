"use strict";

const { SUMMARY_SCHEMA_FIELDS } = require("./constants");

function extractJsonCandidate(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return "";

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  return text;
}

function parseJsonLoose(rawText) {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) return null;

  try {
    return JSON.parse(candidate);
  } catch (_err) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = candidate.slice(start, end + 1);
      try {
        return JSON.parse(sliced);
      } catch (_nestedErr) {
        return null;
      }
    }
    return null;
  }
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateSummaryShape(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return { ok: false, errorCode: "SUMMARY_NOT_OBJECT", message: "Summary must be a JSON object." };
  }

  for (const field of SUMMARY_SCHEMA_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(summary, field)) {
      return {
        ok: false,
        errorCode: "SUMMARY_MISSING_FIELD",
        message: `Missing required summary field '${field}'.`,
      };
    }
  }

  if (typeof summary.user_goal !== "string") {
    return { ok: false, errorCode: "SUMMARY_USER_GOAL_INVALID", message: "user_goal must be a string." };
  }

  const arrayFields = SUMMARY_SCHEMA_FIELDS.filter((field) => field !== "user_goal");
  for (const field of arrayFields) {
    if (!isStringArray(summary[field])) {
      return {
        ok: false,
        errorCode: "SUMMARY_ARRAY_FIELD_INVALID",
        message: `${field} must be an array of strings.`,
      };
    }
  }

  return { ok: true };
}

function normalizeSummary(summary) {
  return {
    user_goal: String(summary.user_goal).trim(),
    key_decisions: summary.key_decisions.map((x) => String(x).trim()),
    constraints: summary.constraints.map((x) => String(x).trim()),
    preferences: summary.preferences.map((x) => String(x).trim()),
    unresolved_questions: summary.unresolved_questions.map((x) => String(x).trim()),
  };
}

function parseAndValidateSummary(rawText) {
  const parsed = parseJsonLoose(rawText);
  if (!parsed) {
    return {
      ok: false,
      errorCode: "SUMMARY_INVALID_JSON",
      message: "Summary response is not valid JSON.",
    };
  }

  const validation = validateSummaryShape(parsed);
  if (!validation.ok) {
    return validation;
  }

  return { ok: true, summary: normalizeSummary(parsed) };
}

module.exports = {
  parseAndValidateSummary,
  validateSummaryShape,
};
