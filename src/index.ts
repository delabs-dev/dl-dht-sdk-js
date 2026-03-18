import { P2PDhtClient } from "./p2pClient.js";
import type { CreateClientOptions } from "./p2pClient.js";

export async function createClient(opts: CreateClientOptions) {
  const c = new P2PDhtClient(opts);
  await c.start();
  return c;
}

export { autoAttach } from "./autoAttach.js";
export type { AutoAttachOptions } from "./autoAttach.js";

export { P2PDhtClient } from "./p2pClient.js";
export type { CreateClientOptions } from "./p2pClient.js";
