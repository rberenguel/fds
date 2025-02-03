export { dist, sqdist, sqnorm, rotate, easeInSq }

const rotate = (x1, x2, ang) => {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const x = x1 * cos - x2 * sin;
  const y = x1 * sin + x2 * cos;
  return [x, y];
};

const sqnorm = (a, b) => a*a+b*b

const sqdist = (p, q) => {
  const dx = q.x - p.x
  const dy = q.y - p.y
  return sqnorm(dx, dy)
}

const dist = (p, q) => Math.sqrt(sqdist(p, q))
const easeInSq = (x) => {
  return 1 - Math.sqrt(1 - x * x);
}


