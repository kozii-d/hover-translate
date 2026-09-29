import { describe, expect, it } from "vitest";
import {
  TranslatorError,
  TranslatorErrorCode,
  isTranslatorError,
  serializeTranslatorError,
  unwrapTranslatorResponse,
} from "../../src/common/translators/translatorError.ts";

const CODES: TranslatorErrorCode[] = [
  "api-key-missing",
  "api-key-invalid",
  "quota-exceeded",
  "rate-limited",
  "permission-missing",
  "unsupported-language",
  "network",
  "service-unavailable",
];

/** What reaches the other side: `sendResponse` carries a structured clone. */
const acrossContexts = <T>(value: T): T => structuredClone(value);

const thrownBy = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
};

describe("the error envelope between the background and its callers", () => {
  it.each(CODES)("%s survives the trip with its code and message", (code) => {
    const response = acrossContexts(serializeTranslatorError(new TranslatorError(code, `failed: ${code}`)));
    expect(response).toEqual({ translatorError: { code, message: `failed: ${code}` } });

    const error = thrownBy(() => unwrapTranslatorResponse(response));
    expect(isTranslatorError(error)).toBe(true);
    expect(error).toMatchObject({ name: "TranslatorError", code, message: `failed: ${code}` });
  });

  it("an error without a code comes back as a plain Error", () => {
    const response = acrossContexts(serializeTranslatorError(new TypeError("Failed to fetch")));
    expect(response).toEqual({ translatorError: { code: undefined, message: "Failed to fetch" } });

    const error = thrownBy(() => unwrapTranslatorResponse(response));
    expect(error).toBeInstanceOf(Error);
    expect(isTranslatorError(error)).toBe(false);
    expect((error as Error).message).toBe("Failed to fetch");
  });

  it("anything thrown that is not an Error keeps its text", () => {
    expect(serializeTranslatorError("boom").translatorError.message).toBe("boom");
    expect(serializeTranslatorError(new Error("")).translatorError.message).toBe("Error");
  });

  it("an answer that is not an envelope passes through untouched", () => {
    const answer = { availableLanguages: { sourceLanguages: [], targetLanguages: [] } };
    expect(unwrapTranslatorResponse(answer)).toBe(answer);
    expect(unwrapTranslatorResponse(null)).toBeNull();
    expect(unwrapTranslatorResponse("text")).toBe("text");
  });
});
