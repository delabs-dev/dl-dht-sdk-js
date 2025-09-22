import { P2PDhtClient, type CreateClientOptions } from "./p2pClient.js";

export async function createClient(opts: CreateClientOptions) {
  const c = new P2PDhtClient(opts);
  await c.start();
  return c;
}

export { autoAttach } from "./autoAttach.js";
export { P2PDhtClient } from "./p2pClient.js";
export type { CreateClientOptions } from "./p2pClient.js";

// new: convenience exports
export { makeKey } from "./key.js";
export { KeyShapeError, NotFoundError, ValueTooLargeError } from "./errors.js";