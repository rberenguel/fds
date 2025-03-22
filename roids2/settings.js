export { settings };

const shake = (app, minShake = -2) => {
  const maxShake = -minShake;
  const span = maxShake - minShake;
  const rx = minShake + Math.floor(Math.random() * span);
  const ry = maxShake + Math.floor(Math.random() * span);
  app.canvas.style.translate = `${rx}px ${ry}px`;
};

const isSecondary = (w) => {
  return w.kind === "kPhotonTorpedoLauncher" || w.kind === "kGaussCannon";
};

const isKinetic = (w) => {
  return w.kind === "kMassDriverGun" || w.kind === "kGaussCannon";
};

const settings = {
  explosions: {
    asteroids: {
      split: {
        minCount: 30,
        randCount: 20,
      },
      destroy: {
        count: 50,
      },
      explode: {
        count: 50,
      },
      flame: {
        scale: () => {
          0.8 + Math.random() * 0.8;
        },
      },
    },
    ships: {
      explode: {
        baseCount: 20,
      },
      flame: {
        scale: () => {
          0.8 + Math.random() * 0.8;
        },
      },
      hitFlame: {
        count: 3,
      },
    },
    player: {
      flame: {
        scale: () => {
          0.8 + Math.random() * 0.8;
        },
      },
      hitFlame: {
        count: 3,
      },
    },
  },
  hitSleepMs: 10,
  shake: {
    onHit: (app) => {
      shake(app, -6);
      document.body.style.backgroundColor = "#644";
    },
    onFire: (app) => {
      shake(app, -1);
    },
    onSecondaryFire: (app) => {
      shake(app, -3);
    },
  },
  fire: {
    muzzle: {
      minCount: (w) => {
        if (isSecondary(w)) {
          return 10;
        }
        if (isKinetic(w)) {
          return 7;
        }
        return 3;
      },
      scale: (w) => {
        if (isSecondary(w)) {
          return 0.8 + Math.random() * 0.5;
        }
        return 0.6 + Math.random() * 0.3;
      },
      energy: (w) => {
        if (isSecondary(w)) {
          return 6;
        }
        if (isKinetic(w)) {
          return 4;
        }
        return 3;
      },
      fill: (w) => {
        if (isKinetic(w)) {
          return 0xffcc00;
        }
        return w.color;
      },
    },
  },
  showHitMs: 10, // ms to show a blank frame
};
