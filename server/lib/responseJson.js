export function responseJson(status, body) {
  return { kind: "json", status, body };
}
