# @delabs/dl-dht-sdk

JavaScript/TypeScript SDK for attaching to a running `dl-dht` node over libp2p RPC.

This SDK is for **remote-safe node operations**, including:

- object put / get / fetch / provider lookup
- object retain
- pin / unpin
- node status and capability checks
- discovery announce / lookup

This SDK does **not** expose local operator-only storage actions such as:

- list pinned objects
- list unpinned objects
- object stats
- object delete
- object GC

Those remain local-only in `dl-dht`.

---

## How dl-dht works

- Objects are **content-addressed** (`sha256:<hash>`)
- Nodes that store objects become **providers**
- Clients:
  - discover providers via DHT
  - fetch objects from them

Typical flow:

1. `putObject` → store locally + announce provider
2. `findProviders` → discover peers storing object
3. `fetchObject` → retrieve object from network
4. `retainObject` / `pinObject` → control local persistence

---

## Install

```bash
npm install @delabs/dl-dht-sdk
```

---

## Quick start

### Auto-attach to a local node

```ts
import { autoAttach } from "@delabs/dl-dht-sdk";

const dht = await autoAttach({
  httpURL: "http://127.0.0.1:46346",
});

const status = await dht.status();
console.log(status);

await dht.stop();
```

### Create a client directly

```ts
import { createClient } from "@delabs/dl-dht-sdk";

const dht = await createClient({
  peerId: "12D3Koo...",
  addrs: ["/ip4/127.0.0.1/tcp/46345"],
});

const status = await dht.status();
console.log(status);

await dht.stop();
```

---

## End-to-end example

```ts
import { createClient } from "@delabs/dl-dht-sdk";

const dht = await createClient({
  peerId: "12D3Koo...",
  addrs: ["/ip4/127.0.0.1/tcp/46345"],
});

// 1. Put object
const objectId = await dht.putObject(
  new TextEncoder().encode("hello dl-dht")
);

// 2. Find providers
const providers = await dht.findProviders(objectId);
console.log("providers:", providers);

// 3. Fetch from network
const data = await dht.fetchObject(objectId);
console.log("fetched:", new TextDecoder().decode(data));

// 4. Retain locally
await dht.retainObject(objectId, 3600);

await dht.stop();
```

---

## Object API

### Put object

```ts
const objectId = await dht.putObject(
  new TextEncoder().encode(JSON.stringify({ hello: "world" }))
);
```

### Get local object

```ts
const bytes = await dht.getObject(objectId);
```

### Fetch object from network

```ts
const bytes = await dht.fetchObject(objectId);
```

### Find providers

```ts
const providers = await dht.findProviders(objectId);
```

### Retain / pin / unpin

```ts
await dht.retainObject(objectId, 3600);
await dht.pinObject(objectId);
await dht.unpinObject(objectId);
```

---

## Discovery API

### Announce discovery

```ts
await dht.announceDiscovery("tld:xyz", "sha256:xxx", 21600);
```

### Lookup discovery

```ts
const refs = await dht.lookupDiscovery("tld:uma");
```

---

## Node roles (client vs edge vs server)

| Mode   | putObject | retainObject | pinObject | announceDiscovery | fetchObject |
|--------|----------|--------------|----------|-------------------|------------|
| client | ❌       | ❌           | ❌       | ❌                | ✅         |
| edge   | ✅       | ✅           | ❌       | ❌                | ✅         |
| server | ✅       | ✅           | ✅       | ✅                | ✅         |

---

## Single-node behavior

If you run only one node, you may see warnings like:

```
failed to find any peer in table
```

This is expected.

Provider announcements and routing require multiple peers.  
Run at least 2 nodes for full network behavior.

---

## API

### autoAttach(opts?)

Auto-discovers a local dl-dht node.

### createClient(opts)

Creates a client directly.

### Methods

- status()
- putObject()
- getObject()
- fetchObject()
- findProviders()
- retainObject()
- pinObject()
- unpinObject()
- announceDiscovery()
- lookupDiscovery()

---

## Notes

- Object IDs must look like: `sha256:<64 lowercase hex>`
- This SDK is remote-safe only
- Does not start a node
- Default RPC protocol: `/dl/api/1.0.0`
- Some operations depend on node mode

---

## License
MIT © DeLabs