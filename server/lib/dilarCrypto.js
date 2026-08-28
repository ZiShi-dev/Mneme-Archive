const MEDIA_PAYLOAD_INFO = "dilar.media.payload.v1";
const MEDIA_PAYLOAD_VERSION = 1;
const CLIENT_TOKEN_HEADER = "X-Client-Token";
const DH_PUB_HEADER = "X-DH-Pub";
const CRYPTO_CAPS_HEADER = "X-Crypto-Caps";
const CLIENT_FORM_HEADER = "X-Client-Form";
const TOKEN_REFRESH_BUFFER_SEC = 12 * 3600;

const envelopeHandlers = {
  1: {
    info: (epoch) => `dilar.response.ecies.v1|${epoch}`,
    salt: (clientPub, serverPub) => concatBuffers(clientPub, serverPub),
  },
  2: {
    info: (epoch) => `dilar.response.ecies.v2|${epoch}`,
    salt: (clientPub, serverPub) => concatBuffers(serverPub, clientPub),
  },
  3: {
    info: (epoch) => `dilar.response.ecies.v3|${epoch}`,
    salt: async (clientPub, serverPub) => digestSha256(concatBuffers(serverPub, clientPub)),
  },
  4: {
    info: (epoch, iv) => `dilar.response.ecies.v4|${epoch}|${b64urlFromBytes(iv)}`,
    salt: async (clientPub, serverPub, iv) => digestSha256(concatBuffers(clientPub, serverPub, iv)),
  },
  5: {
    info: (epoch) => `dilar.response.ecies.v5|${epoch}`,
    salt: async (clientPub, serverPub, iv) => hmacSha256(iv, concatBuffers(serverPub, clientPub)),
  },
  6: {
    info: (epoch, iv) => `dilar.response.ecies.v6|${epoch}|${b64urlFromBytes(iv)}`,
    salt: async (clientPub, serverPub, iv) => {
      const [clientHash, serverHash] = await Promise.all([
        digestSha256(toArrayBuffer(clientPub)),
        digestSha256(toArrayBuffer(serverPub)),
      ]);
      return digestSha256(concatBuffers(new Uint8Array(clientHash), new Uint8Array(serverHash), iv));
    },
  },
  7: {
    info: (epoch) => `dilar.response.ecies.v7|${epoch}`,
    salt: async (clientPub, serverPub, iv) => {
      const key = await crypto.subtle.importKey("raw", toArrayBuffer(iv), "HKDF", false, ["deriveBits"]);
      return crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: toArrayBuffer(serverPub), info: new TextEncoder().encode("dilar.response.ecies.v7.salt") },
        key,
        256,
      );
    },
  },
  8: {
    info: (epoch, iv) => `dilar.response.ecies.v8|${epoch}|${hexFromBytes(iv)}`,
    salt: async (clientPub, serverPub, iv) => digestSha256(packBuffers(
      u16be(clientPub.length), clientPub,
      u16be(serverPub.length), serverPub,
      u16be(iv.length), iv,
    )),
  },
  9: {
    info: async (epoch, iv) => {
      const digest = new Uint8Array(await digestSha256(toArrayBuffer(iv)));
      return `dilar.response.ecies.v9|${epoch}|${hexFromBytes(digest).slice(0, 16)}`;
    },
    salt: async (clientPub, serverPub, iv) => {
      const key = await crypto.subtle.importKey("raw", toArrayBuffer(iv), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
      const signature = await crypto.subtle.sign("HMAC", key, packBuffers(
        u16be(serverPub.length), serverPub,
        u16be(clientPub.length), clientPub,
      ));
      return signature.slice(0, 32);
    },
  },
  10: {
    hash: "SHA-512",
    info: async (epoch, iv) => {
      const digest = new Uint8Array(await digestSha512(toArrayBuffer(iv)));
      return `dilar.response.ecies.v10|${epoch}|${hexFromBytes(digest).slice(0, 24)}`;
    },
    salt: async (clientPub, serverPub, iv) => digestSha512(packBuffers(
      u16be(clientPub.length), clientPub,
      u16be(serverPub.length), serverPub,
      u16be(iv.length), iv,
    )),
  },
  11: {
    hash: "SHA-512",
    derivedNonce: true,
    info: async (epoch, iv) => {
      const digest = new Uint8Array(await digestSha384(toArrayBuffer(iv)));
      return `dilar.response.ecies.v11|${epoch}|${b64urlFromBytes(digest).slice(0, 22)}`;
    },
    salt: async (clientPub, serverPub, iv) => {
      const key = await crypto.subtle.importKey("raw", toArrayBuffer(serverPub), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
      const signature = await crypto.subtle.sign("HMAC", key, packBuffers(
        u16be(iv.length), iv,
        u16be(clientPub.length), clientPub,
      ));
      return toArrayBuffer(new Uint8Array(signature).slice(0, 32));
    },
  },
  12: {
    hash: "SHA-384",
    derivedNonce: true,
    aad: async (version, epoch, serverPub, iv, ctLength) => {
      const encoder = new TextEncoder();
      const prefix = encoder.encode("dilar.response.ecies.v12");
      const versionText = encoder.encode(String(Number(version)));
      const epochText = encoder.encode(String(Number(epoch)));
      const ctLengthBytes = u32be(ctLength);
      return digestSha256(packBuffers(
        u16be(prefix.length), prefix,
        u16be(versionText.length), versionText,
        u16be(epochText.length), epochText,
        u16be(serverPub.length), serverPub,
        u16be(iv.length), iv,
        u16be(ctLengthBytes.length), ctLengthBytes,
      ));
    },
    info: async (epoch, iv) => {
      const digest = new Uint8Array(await digestSha256(packBuffers(u16be(iv.length), iv)));
      return `dilar.response.ecies.v12|${epoch}|${b64urlFromBytes(digest).slice(0, 22)}`;
    },
    salt: async (clientPub, serverPub, iv) => {
      const key = await crypto.subtle.importKey("raw", toArrayBuffer(clientPub), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
      const signature = await crypto.subtle.sign("HMAC", key, packBuffers(
        u16be(serverPub.length), serverPub,
        u16be(iv.length), iv,
      ));
      return toArrayBuffer(new Uint8Array(signature).slice(0, 32));
    },
  },
};

export const DILAR_CRYPTO_CAPS = Object.keys(envelopeHandlers).map(Number).sort((a, b) => a - b).join(",");
export const DILAR_CLIENT_FORM = "desktop";

let dhSessionPromise = null;
let clientCredential = null;
let enrollPromise = null;

function toArrayBuffer(bytes) {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function concatBuffers(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output.buffer;
}

function packBuffers(...parts) {
  return toArrayBuffer(packBytes(...parts));
}

function packBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u16be(value) {
  return new Uint8Array([(value >> 8) & 255, value & 255]);
}

function u32be(value) {
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

function b64urlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function b64urlFromBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlFromBuffer(buffer) {
  return b64urlFromBytes(new Uint8Array(buffer));
}

function hexFromBytes(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digestSha256(input) {
  return crypto.subtle.digest("SHA-256", input);
}

async function digestSha384(input) {
  return crypto.subtle.digest("SHA-384", input);
}

async function digestSha512(input) {
  return crypto.subtle.digest("SHA-512", input);
}

async function hmacSha256(keyBytes, message) {
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, toArrayBuffer(message));
}

function isEncryptedEnvelope(value) {
  return value
    && typeof value === "object"
    && typeof value.v === "number"
    && typeof value.e === "number"
    && typeof value.epk === "string"
    && typeof value.iv === "string"
    && typeof value.ct === "string"
    && typeof value.tag === "string";
}

function isEncryptedAssets(value) {
  return value
    && typeof value === "object"
    && typeof value.v === "number"
    && typeof value.k === "string"
    && typeof value.e === "number"
    && typeof value.s === "string"
    && typeof value.iv === "string"
    && typeof value.ct === "string"
    && typeof value.tag === "string";
}

async function getDhSession() {
  if (!dhSessionPromise) {
    dhSessionPromise = crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]).then(async (keyPair) => {
      const publicRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
      return {
        keyPair,
        publicRaw: new Uint8Array(publicRaw),
        publicB64: b64urlFromBuffer(publicRaw),
      };
    });
  }
  return dhSessionPromise;
}

function credentialIsFresh(credential) {
  if (!credential?.token || typeof credential.expiresAt !== "number") return false;
  return credential.expiresAt - TOKEN_REFRESH_BUFFER_SEC > Math.floor(Date.now() / 1000);
}

export function setDilarClientCredential(credential) {
  if (!credential?.token) return;
  clientCredential = {
    token: credential.token,
    expiresAt: Number(credential.expiresAt) || 0,
    tier: credential.tier || "browser",
  };
}

export function getDilarClientCredential() {
  return credentialIsFresh(clientCredential) ? clientCredential : null;
}

export async function enrollDilarClient(apiBaseUrl) {
  const existing = getDilarClientCredential();
  if (existing) return existing.token;

  if (!enrollPromise) {
    enrollPromise = fetch(`${apiBaseUrl.replace(/\/+$/, "")}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(25_000),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.token) {
        throw new Error(payload?.message || payload?.error || `Dilar enroll a échoué (${response.status})`);
      }
      setDilarClientCredential({
        token: payload.token,
        expiresAt: payload.expires_at,
        tier: payload.tier,
      });
      return payload.token;
    }).finally(() => {
      enrollPromise = null;
    });
  }
  return enrollPromise;
}

export async function buildDilarRequestHeaders(apiBaseUrl) {
  const session = await getDhSession();
  const token = await enrollDilarClient(apiBaseUrl);
  return {
    accept: "application/json",
    [CRYPTO_CAPS_HEADER]: DILAR_CRYPTO_CAPS,
    [CLIENT_FORM_HEADER]: DILAR_CLIENT_FORM,
    [DH_PUB_HEADER]: session.publicB64,
    [CLIENT_TOKEN_HEADER]: token,
  };
}

export function applyDilarResponseToken(headers = {}) {
  const nextToken = headers["x-new-token"] || headers["X-New-Token"];
  if (typeof nextToken === "string" && nextToken.trim()) {
    const existing = getDilarClientCredential();
    setDilarClientCredential({
      token: nextToken.trim(),
      expiresAt: existing?.expiresAt || Math.floor(Date.now() / 1000) + 86400,
      tier: existing?.tier || "browser",
    });
  }
}

export async function decryptDilarEnvelope(envelope) {
  if (!isEncryptedEnvelope(envelope)) return envelope;

  const handler = envelopeHandlers[envelope.v];
  if (!handler) throw new Error(`Enveloppe Dilar inconnue (v${envelope.v})`);

  const session = await getDhSession();
  const serverPubRaw = b64urlToBytes(envelope.epk);
  const serverPubKey = await crypto.subtle.importKey("raw", toArrayBuffer(serverPubRaw), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPubKey },
    session.keyPair.privateKey,
    256,
  );
  const clientPub = session.publicRaw;
  const serverPub = serverPubRaw;
  const iv = b64urlToBytes(envelope.iv);
  const salt = await handler.salt(clientPub, serverPub, iv);
  const infoText = await handler.info(envelope.e, iv);
  const hkdfParams = {
    name: "HKDF",
    hash: handler.hash || "SHA-256",
    salt,
    info: new TextEncoder().encode(infoText),
  };

  let decryptKey;
  let decryptIv = iv;
  if (handler.derivedNonce) {
    const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits(hkdfParams, hkdfKey, 352));
    decryptKey = await crypto.subtle.importKey("raw", toArrayBuffer(derived.slice(0, 32)), { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    decryptIv = derived.slice(32, 44);
  } else {
    const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
    decryptKey = await crypto.subtle.deriveKey(hkdfParams, hkdfKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }

  const ciphertext = b64urlToBytes(envelope.ct);
  const tag = b64urlToBytes(envelope.tag);
  const payload = packBytes(ciphertext, tag);
  const aesParams = { name: "AES-GCM", iv: toArrayBuffer(decryptIv) };
  if (handler.aad) {
    aesParams.additionalData = await handler.aad(envelope.v, envelope.e, serverPub, iv, ciphertext.length);
  }
  const decrypted = await crypto.subtle.decrypt(aesParams, decryptKey, toArrayBuffer(payload));
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function decryptDilarAssets(assetsEnc, unlockHeader = "", mediaToken = "") {
  if (!isEncryptedAssets(assetsEnc) || assetsEnc.v !== MEDIA_PAYLOAD_VERSION || !unlockHeader || !mediaToken) return null;

  const saltBytes = b64urlToBytes(assetsEnc.s);
  const keyMaterial = new TextEncoder().encode(`${unlockHeader}|${mediaToken}`);
  const hkdfKey = await crypto.subtle.importKey("raw", keyMaterial, "HKDF", false, ["deriveKey"]);
  const decryptKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes,
      info: new TextEncoder().encode(`${MEDIA_PAYLOAD_INFO}|${assetsEnc.e}`),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const iv = b64urlToBytes(assetsEnc.iv);
  const ciphertext = b64urlToBytes(assetsEnc.ct);
  const tag = b64urlToBytes(assetsEnc.tag);
  const payload = packBytes(ciphertext, tag);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, decryptKey, toArrayBuffer(payload));
  const parsed = JSON.parse(new TextDecoder().decode(decrypted));
  return parsed && typeof parsed === "object" ? parsed : null;
}

export async function openDilarPayload(payload, headers = {}, unlockHeader = "") {
  if (!payload || typeof payload !== "object") return payload;
  let opened = isEncryptedEnvelope(payload) ? await decryptDilarEnvelope(payload) : payload;
  if (opened?.assets_enc) {
    const mediaToken = typeof opened.media_token === "string" ? opened.media_token : "";
    const assets = await decryptDilarAssets(opened.assets_enc, unlockHeader, mediaToken);
    if (assets) {
      opened = { ...opened, ...assets };
      delete opened.assets_enc;
    }
  }
  applyDilarResponseToken(headers);
  return opened;
}
