export { dist, sqdist, sqnorm, rotate, easeInSq, wrap };

const rotate = (x1, x2, ang) => {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const x = x1 * cos - x2 * sin;
  const y = x1 * sin + x2 * cos;
  return [x, y];
};

const sqnorm = (a, b) => a * a + b * b;

const sqdist = (p, q) => {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  return sqnorm(dx, dy);
};

const dist = (p, q) => Math.sqrt(sqdist(p, q));
const easeInSq = (x) => {
  return 1 - Math.sqrt(1 - x * x);
};

const wrap = (thing, a) => {
  if (thing.x > a.wmax) {
    thing.x = a.wmin;
  }
  if (thing.y > a.hmax) {
    thing.y = a.hmin;
  }
  if (thing.x < a.wmin) {
    thing.x = a.wmax;
  }
  if (thing.y < a.hmin) {
    thing.y = a.hmax;
  }
};

const wrapo = (thing, app) => {
  if (thing.pos.x > app.renderer.width) {
    thing.pos.x = 0;
  }
  if (thing.pos.y > app.renderer.height) {
    thing.pos.y = 0;
  }
  if (thing.pos.x < 0) {
    thing.pos.x = app.renderer.width;
  }
  if (thing.pos.y < 0) {
    thing.pos.y = app.renderer.height;
  }
};
