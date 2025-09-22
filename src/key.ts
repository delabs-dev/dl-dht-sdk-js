export type Group = 'ns' | 'cert' | 'agent' | 'netstats';

/** Builds a well-formed key: /<group>/<root>/<path...> */
export function makeKey(group: Group, root: string, ...path: string[]) {
  if (!group) throw new Error('group required');
  if (!root) throw new Error('root required');
  const joined = ['/', group, '/', root, '/', path.join('/')].join('');
  // collapse any accidental "//"
  return joined.replace(/\/+/g, '/');
}