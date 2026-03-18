import { describe, it, expect } from "vitest";
import { P2PDhtClient } from "../src/p2pClient.js";

const peerId = "12D3KooWQ111111111111111111111111111111111111111111";
const addrs = ["/ip4/127.0.0.1/tcp/46345"];

describe("P2PDhtClient logic", () => {
  it("status decodes JSON from rpc value", async () => {
    const c = new P2PDhtClient({ peerId, addrs });

    (c as any).rpc = async () => ({
      value: new TextEncoder().encode(
        JSON.stringify({
          peerId: "12D3KooWabc",
          conns: 2,
          rtSize: 7,
          dhtPrefix: "/dl",
        })
      ),
    });

    const st = await c.status();
    expect(st.peerId).toBe("12D3KooWabc");
    expect(st.conns).toBe(2);
    expect(st.rtSize).toBe(7);
    expect(st.dhtPrefix).toBe("/dl");
  });

  it("lookupDiscovery returns empty array for empty response body", async () => {
    const c = new P2PDhtClient({ peerId, addrs });

    (c as any).rpc = async () => ({
      value: new TextEncoder().encode("   "),
    });

    const refs = await c.lookupDiscovery("tld:uma");
    expect(refs).toEqual([]);
  });

  it("discovery methods can parse stubbed rpc responses", async () => {
    const c = new P2PDhtClient({ peerId, addrs });

    (c as any).rpc = async (req: any) => {
      if (req.op === "announceDiscovery") return {};
      if (req.op === "lookupDiscovery") {
        return {
          value: new TextEncoder().encode(
            JSON.stringify([
              "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            ])
          ),
        };
      }
      return {};
    };

    await expect(
      c.announceDiscovery(
        "tld:uma",
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        21600
      )
    ).resolves.toBeUndefined();

    const refs = await c.lookupDiscovery("tld:uma");
    expect(refs).toEqual([
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ]);
  });
});