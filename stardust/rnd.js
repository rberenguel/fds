export { seededRnd };

// Seeded deterministic random
// https://en.wikipedia.org/wiki/Xorshift#xoshiro

const xoshiro128ss = (a, b, c, d) => {
  return function () {
    var t = b << 9,
      r = a * 5;
    r = (r << 7) | (r >>> 25);
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
};

const _seededRnd = (seed) =>
  xoshiro128ss(seed, seed << 13, seed >> 9, (seed << 6) ^ (seed >> 17));
const seededRnd = (seed) => {
  const seeded = _seededRnd(seed);
  seeded();
  seeded();
  return seeded;
};
