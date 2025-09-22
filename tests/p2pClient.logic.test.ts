import { describe, it, expect } from "vitest";
import { P2PDhtClient } from "../src/p2pClient.js";

const peerId = "12D3KooWTestPeerIdDontCare";
const addrs = ["/ip4/127.0.0.1/tcp/46345"]; // never dialed in these tests

describe("P2PDhtClient local logic", () => {
  it("throws on invalid key shapes (validateKey)", async () => {
    const c = new P2PDhtClient({ peerId, addrs });

    await expect(async () => {
      // missing leading slash
      await (c as any).put("ur/test", new Uint8Array([1, 2, 3]), 10);
    }).rejects.toThrow();

    await expect(async () => {
      // only one segment
      await (c as any).put("/ur", new Uint8Array([1, 2, 3]), 10);
    }).rejects.toThrow();

    await expect(async () => {
      // namespace has a space
      await (c as any).put("/ur team/test", new Uint8Array([1, 2, 3]), 10);
    }).rejects.toThrow();
  });

  it("get()/status() can parse minimal rpc responses when rpc is stubbed", async () => {
    const c = new P2PDhtClient({ peerId, addrs });

    // stub rpc to avoid network:
    (c as any).rpc = async (req: any) => {
      if (req.op === "get") {
        // emulate: { value: <Uint8Array> }
        return { value: new TextEncoder().encode("ok") };
      }
      if (req.op === "status") {
        // emulate: { value: <Uint8Array(JSON)> }
        const json = JSON.stringify({ peerId: "X", conns: 1, rtSize: 2, dhtPrefix: "/dl", store: { ur: 1 } });
        return { value: new TextEncoder().encode(json) };
      }
      return {};
    };

    const v = await c.get("/dl/ur/key");
    expect(v && new TextDecoder().decode(v)).toBe("ok");

    const st = await c.status();
    expect(st).toMatchObject({ peerId: "X", conns: 1, rtSize: 2, dhtPrefix: "/dl" });
  });

  it("buildTargets appends /p2p/<peerId> when missing", () => {
    const c = new P2PDhtClient({ peerId, addrs: ["/ip4/1.2.3.4/tcp/1111"] });
    const targets = (c as any).buildTargets();
    expect(Array.isArray(targets)).toBe(true);
    const s = targets[0].toString();
    expect(s).toContain("/p2p/");
    expect(s.endsWith(`/p2p/${peerId}`)).toBe(true);
  });
});