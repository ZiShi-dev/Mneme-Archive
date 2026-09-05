import { lookup } from "node:dns";
import { Agent } from "undici";
import ipaddr from "ipaddr.js";
import { isBlockedNetworkHost } from "./urlSecurity.js";
import { assertPublicHttpUrl, configurePublicFetchTransport } from "./publicFetch.js";

export function isBlockedResolvedAddress(address = "") {
  if (isBlockedNetworkHost(address)) return true;
  try {
    if (!ipaddr.isValid(address)) return true;
    return ipaddr.parse(address).range() !== "unicast";
  } catch {
    return true;
  }
}

export function createPublicLookup(resolve = lookup) {
  return (hostname, options, callback) => {
    // Resolve once, validate every result, and hand those exact IPs to the socket.
    resolve(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error);
      if (!addresses?.length || addresses.some(({ address }) => isBlockedResolvedAddress(address))) {
        return callback(new Error("Destination DNS non autorisée"));
      }
      const family = typeof options === "number" ? options : options?.family;
      const eligible = family ? addresses.filter((entry) => entry.family === family) : addresses;
      if (!eligible.length) return callback(new Error("Aucune adresse publique compatible"));
      if (options?.all) return callback(null, eligible);
      callback(null, eligible[0].address, eligible[0].family);
    });
  };
}

export function createPublicDispatcher(resolve = lookup) {
  return new Agent({ connect: { lookup: createPublicLookup(resolve) } });
}

const dispatcher = createPublicDispatcher();

export function installPublicFetchTransport() {
  configurePublicFetchTransport((url, options) => {
    assertPublicHttpUrl(url); // Literal IPs bypass DNS lookup in the socket implementation.
    return globalThis.fetch(url, { ...options, dispatcher, redirect: "manual" });
  }, (url) => new Promise((resolve, reject) => {
    createPublicLookup()(url.hostname.replace(/^\[|\]$/g, ""), {}, (error) => {
      if (error) reject(error);
      else resolve();
    });
  }));
}
