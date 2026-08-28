export function lookup(dict, key) {
  if (!key) return undefined;
  return String(key).split(".").reduce((node, part) => (node == null ? node : node[part]), dict);
}

export function interpolate(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) => (
    vars[name] == null ? `{${name}}` : String(vars[name])
  ));
}

export function translate(dict, key, vars, fallbackDict) {
  const raw = lookup(dict, key) ?? lookup(fallbackDict, key);
  if (raw == null) return key;
  return interpolate(raw, vars);
}
