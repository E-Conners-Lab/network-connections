// Pure subnetting helpers. No DOM access so they can be tested on their own.

export function ipToInt(ip) {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

export function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function parseCidr(cidr) {
  const [ip, len] = cidr.split('/');
  const prefix = Number(len);
  const start = ipToInt(ip);
  return { start, prefix, size: blockSize(prefix) };
}

export function blockSize(prefix) {
  return 2 ** (32 - prefix);
}

// kind: 'lan' needs network + broadcast, so usable = size - 2 (/31 and /32 unusable).
// kind: 'link' is point-to-point, where RFC 3021 allows a /31 with both addresses usable.
export function usableHosts(prefix, kind = 'lan') {
  if (kind === 'link') {
    if (prefix === 31) return 2;
    if (prefix === 30) return 2;
    return prefix < 30 ? blockSize(prefix) - 2 : 0;
  }
  return prefix <= 30 ? blockSize(prefix) - 2 : 0;
}

// Smallest block (largest prefix number) that still holds `hosts`.
export function prefixForHosts(hosts, kind = 'lan') {
  for (let p = 31; p >= 1; p--) {
    if (usableHosts(p, kind) >= hosts) return p;
  }
  return 1;
}

export function isAligned(start, prefix) {
  return start % blockSize(prefix) === 0;
}

export function overlaps(a, b) {
  return a.start < b.start + b.size && b.start < a.start + a.size;
}

export function describeBlock(start, prefix) {
  const size = blockSize(prefix);
  return {
    cidr: `${intToIp(start)}/${prefix}`,
    network: intToIp(start),
    broadcast: intToIp(start + size - 1),
    first: intToIp(start + 1),
    last: intToIp(start + size - 2),
    size,
  };
}

// Can a block of `prefix` still be placed inside `parent` without hitting `used` blocks?
export function findFreeSlot(parent, used, prefix) {
  const size = blockSize(prefix);
  for (let s = parent.start; s + size <= parent.start + parent.size; s += size) {
    const cand = { start: s, size };
    if (!used.some((u) => overlaps(cand, u))) return s;
  }
  return -1;
}
