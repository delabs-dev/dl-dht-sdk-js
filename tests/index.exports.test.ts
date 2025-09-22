import { describe, it, expect } from "vitest";
import * as mod from "../src/index.js";

describe("package exports", () => {
  it("exports createClient and P2PDhtClient", () => {
    expect(typeof (mod as any).createClient).toBe("function");
    expect(typeof (mod as any).P2PDhtClient).toBe("function");
  });
});