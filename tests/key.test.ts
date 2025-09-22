import { makeKey } from "../src/key";

describe("makeKey()", () => {
  it("builds /<group>/<root>/<path...>", () => {
    const k = makeKey("ns", "ns-foo-aaaabbbbccccdddd", "a", "b", "c.txt");
    expect(k).toBe("/ns/ns-foo-aaaabbbbccccdddd/a/b/c.txt");
  });

  it("collapses accidental slashes", () => {
    const k = makeKey("cert", "cert-xyz", "/pub//", "key.pem");
    expect(k).toBe("/cert/cert-xyz/pub/key.pem");
  });

  it("throws on missing pieces", () => {
    expect(() => makeKey("ns" as any, "", "x")).toThrow();
    expect(() => makeKey("ns" as any, "ns-root")).not.toThrow(); // ok root only + no path
  });
});