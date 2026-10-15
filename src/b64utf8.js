// UTF-8 text <-> base64, for blobs the server stores opaquely (the gear script,
// the triggers): every rpc string passes utf-8 -> koi8-u on the way in, which
// would eat what KOI8 has no slot for, and base64 is plain ASCII.

export function utf8ToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), size: bytes.length };
}

export function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
