export { dist, rotate }

const rotate = (x1, x2, ang) => {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const x = x1 * cos - x2 * sin;
  const y = x1 * sin + x2 * cos;
  return [x, y];
};

const dist = (p, q) => {
  const dx = q.x - p.x
  const dy = q.y - p.y
  return Math.sqrt(dx*dx+dy*dy)
}
