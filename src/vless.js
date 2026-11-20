/**
 * vless.js — پارس/ساخت هدر پروتکل VLESS
 *
 * فرمت درخواست کلاینت:
 *   1 byte   version
 *   16 bytes UUID
 *   1 byte   طول addon (M)
 *   M bytes  addon (نادیده گرفته می‌شود)
 *   1 byte   command (1=TCP, 2=UDP, 3=MUX)
 *   2 bytes  port (big-endian)
 *   1 byte   نوع آدرس (1=IPv4, 2=دامنه, 3=IPv6)
 *   N bytes  address
 *   ...      payload
 *
 * فرمت پاسخ سرور: 1 byte version + 1 byte طول addon (0)
 */

export class VlessParseError extends Error {}

function formatUuid(bytes16) {
  const hex = [...bytes16].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * @param {Uint8Array} buf
 * @returns {{version:number, clientUuid:string, command:number, address:string, port:number, headerLen:number}}
 */
export function parseVlessHeader(buf) {
  if (buf.length < 24) {
    throw new VlessParseError("buffer too short for VLESS header");
  }

  let pos = 0;
  const version = buf[pos];
  pos += 1;

  const clientUuid = formatUuid(buf.subarray(pos, pos + 16));
  pos += 16;

  const addonLen = buf[pos];
  pos += 1;
  pos += addonLen; // addon نادیده گرفته می‌شود

  if (buf.length < pos + 4) {
    throw new VlessParseError("buffer too short for command/port");
  }

  const command = buf[pos];
  pos += 1;

  const port = (buf[pos] << 8) | buf[pos + 1];
  pos += 2;

  const addrType = buf[pos];
  pos += 1;

  let address;
  if (addrType === 1) {
    if (buf.length < pos + 4) throw new VlessParseError("buffer too short for IPv4 address");
    address = `${buf[pos]}.${buf[pos + 1]}.${buf[pos + 2]}.${buf[pos + 3]}`;
    pos += 4;
  } else if (addrType === 2) {
    if (buf.length < pos + 1) throw new VlessParseError("buffer too short for domain length");
    const domainLen = buf[pos];
    pos += 1;
    if (buf.length < pos + domainLen) throw new VlessParseError("buffer too short for domain");
    address = new TextDecoder().decode(buf.subarray(pos, pos + domainLen));
    pos += domainLen;
  } else if (addrType === 3) {
    if (buf.length < pos + 16) throw new VlessParseError("buffer too short for IPv6 address");
    const parts = [];
    for (let i = 0; i < 16; i += 2) {
      parts.push(((buf[pos + i] << 8) | buf[pos + i + 1]).toString(16));
    }
    address = parts.join(":");
    pos += 16;
  } else {
    throw new VlessParseError(`unknown address type ${addrType}`);
  }

  return { version, clientUuid, command, address, port, headerLen: pos };
}

export function buildResponseHeader(version = 0) {
  return new Uint8Array([version, 0]);
}
