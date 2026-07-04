export { CommsSystem, generateShipName };

import { generateEliteName } from "./tinker/system.js";
import { seededRnd } from "./rnd.js";

const MAX_MESSAGES  = 5;
const DEFAULT_TTL   = 9000;   // ms message stays fully visible
const FADE_IN_MS    = 350;
const FADE_OUT_MS   = 1800;
const LABEL_WIDTH   = 18;     // padded chars for the source column

const SOURCE_STYLE = {
  trader:  { color: '#ffcc44' },
  station: { color: '#00ffcc' },
  pirate:  { color: '#ff5555' },
  police:  { color: '#5599ff' },
  system:  { color: '#aaaacc' },
};

function generateShipName() {
  const rnd = seededRnd(Math.floor(Math.random() * 1e9));
  return generateEliteName(rnd);
}

class CommsSystem {
  constructor() {
    this._messages = [];
    this._nextId   = 0;

    this._container = document.createElement('div');
    Object.assign(this._container.style, {
      position:      'fixed',
      bottom:        '1.4em',
      left:          '1.2em',
      width:         '360px',
      pointerEvents: 'none',
      zIndex:        '999',
      fontFamily:    'monospace',
      fontSize:      '0.95em',
      display:       'flex',
      flexDirection: 'column',
      gap:           '2px',
    });
    document.body.appendChild(this._container);
  }

  // Core method — all message types route through here.
  // source: key into SOURCE_STYLE ('trader'|'station'|'pirate'|'police'|'system')
  // label:  override the displayed left-column text (defaults to source)
  // text:   the message body
  // ttl:    ms until the message starts fading (default DEFAULT_TTL)
  broadcast({ source = 'system', label = null, text, ttl = DEFAULT_TTL }) {
    const style  = SOURCE_STYLE[source] ?? SOURCE_STYLE.system;
    const col    = style.color;
    const lbl    = (label ?? source).toUpperCase().slice(0, LABEL_WIDTH).padEnd(LABEL_WIDTH);

    const el = document.createElement('div');
    Object.assign(el.style, {
      color:      col,
      opacity:    '0',
      transition: `opacity ${FADE_IN_MS}ms ease-in`,
      whiteSpace: 'nowrap',
      overflow:   'hidden',
      textShadow: `0 0 8px ${col}55`,
    });
    el.textContent = `› ${lbl}  ${text}`;
    this._container.appendChild(el);

    // Trigger fade-in on next paint
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));

    const msg = {
      id:     this._nextId++,
      source,
      born:   performance.now(),
      expiry: performance.now() + ttl,
      fading: false,
      el,
    };
    this._messages.push(msg);

    // Drop oldest if over the cap (instant removal — it already had its time)
    while (this._messages.length > MAX_MESSAGES) {
      this._expire(this._messages.shift(), true);
    }

    return msg.id;
  }

  // --- Typed convenience helpers ---

  // shipName: result of generateShipName() — caller decides the name so it can be reused
  // on the actual NPC ship object later.
  trader(shipName, text, ttl) {
    return this.broadcast({ source: 'trader', label: shipName, text, ttl });
  }

  station(stationName, text, ttl) {
    return this.broadcast({ source: 'station', label: stationName, text, ttl });
  }

  pirate(callsign, text, ttl) {
    return this.broadcast({ source: 'pirate', label: callsign ?? 'UNKNOWN VESSEL', text, ttl });
  }

  police(callsign, text, ttl) {
    return this.broadcast({ source: 'police', label: callsign ?? 'POLICE', text, ttl });
  }

  // System-level / GalNet announcements (government collapses, major events)
  system(text, ttl) {
    return this.broadcast({ source: 'system', label: 'GALNET', text, ttl });
  }

  // Call every frame from the game loop
  update() {
    const now = performance.now();
    this._messages = this._messages.filter(msg => {
      if (!msg.fading && now > msg.expiry) {
        this._expire(msg, false);
        return false;
      }
      return true;
    });
  }

  _expire(msg, immediate) {
    if (immediate) {
      msg.el.remove();
      return;
    }
    msg.el.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`;
    msg.el.style.opacity    = '0';
    setTimeout(() => msg.el.remove(), FADE_OUT_MS);
  }

  destroy() {
    this._container.remove();
  }
}
