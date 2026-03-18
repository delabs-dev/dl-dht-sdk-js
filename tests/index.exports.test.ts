import { describe, it, expect } from "vitest";
import * as mod from "../src/index.js";

describe("index exports", () => {
  it("exports runtime API surface", () => {
    expect(typeof mod.createClient).toBe("function");
    expect(typeof mod.autoAttach).toBe("function");
    expect(typeof mod.P2PDhtClient).toBe("function");
  });

  it("does not export internal helpers", () => {
    expect((mod as any).validateObjectId).toBeUndefined();
  });
});