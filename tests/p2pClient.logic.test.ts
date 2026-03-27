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

describe("client mode restrictions", () => {
  function makeClientWithError(errMsg: string) {
    const c = new P2PDhtClient({
      peerId: "12D3KooTestPeer",
      addrs: ["/ip4/127.0.0.1/tcp/1234"]
    });

    (c as any).rpc = async () => ({ err: errMsg });
    return c;
  }

  it("putObject rejects in restricted node mode", async () => {
    const c = makeClientWithError("putObject not allowed in this node mode");
    await expect(c.putObject(new Uint8Array([1, 2, 3])))
      .rejects.toThrow(/node mode/i);
  });

  it("retainObject rejects in restricted node mode", async () => {
    const c = makeClientWithError("retainObject not allowed in this node mode");
    await expect(c.retainObject("sha256:" + "a".repeat(64), 60))
      .rejects.toThrow(/node mode/i);
  });

  it("pinObject rejects in restricted node mode", async () => {
    const c = makeClientWithError("pinObject not allowed in this node mode");
    await expect(c.pinObject("sha256:" + "a".repeat(64)))
      .rejects.toThrow(/node mode/i);
  });

  it("unpinObject rejects in restricted node mode", async () => {
    const c = makeClientWithError("unpinObject not allowed in this node mode");
    await expect(c.unpinObject("sha256:" + "a".repeat(64)))
      .rejects.toThrow(/node mode/i);
  });

  it("announceDiscovery rejects in restricted node mode", async () => {
    const c = makeClientWithError("announceDiscovery not allowed in this node mode");
    await expect(c.announceDiscovery("key", "ref", 60))
      .rejects.toThrow(/node mode/i);
  });

  it("getCapabilities includes canRetainObject", async () => {
    const c = new P2PDhtClient({ peerId, addrs });

    (c as any).rpc = async () => ({
      value: new TextEncoder().encode(JSON.stringify({
        mode: "edge",
        canPutObject: true,
        canRetainObject: true,
        canPinObject: false,
        canUnpinObject: false,
        canAnnounceDiscovery: false,
        provideFetchedObjects: false,
        relayServiceEnabled: false,
      }))
    });

    await expect(c.getCapabilities()).resolves.toEqual({
      mode: "edge",
      canPutObject: true,
      canRetainObject: true,
      canPinObject: false,
      canUnpinObject: false,
      canAnnounceDiscovery: false,
      provideFetchedObjects: false,
      relayServiceEnabled: false,
    });
    await expect(c.canRetainObject()).resolves.toBe(true);
  });
});