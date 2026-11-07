// Telefon va planshet boshqaruvi: chapda joystik, ekranni surib kamera, o‘ngda tugmalar.
export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
}

const BUTTONS = [
  { code: 'KeyH', label: '?', title: 'Yordam' },
  { code: 'KeyM', label: '🗺', title: 'Xarita' },
  { code: 'KeyT', label: '💬', title: 'Chat' },
  { code: 'KeyV', label: '👁', title: 'Kamera' },
  { code: 'KeyB', label: '🎤', title: 'Gapirish (bosib turing)' },
  { code: 'KeyG', label: '📻', title: 'Ovoz rejimi' },
  { code: 'Space', label: '⤒', title: 'Sakrash / tormoz', cls: 'mid' },
  { code: 'KeyE', label: 'E', title: 'Harakat', cls: 'big' },
];
const RADIUS = 52;

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.axis = { x: 0, y: 0 };
    this.root = document.getElementById('touch');
    this.stick = this.root.querySelector('.stick');
    this.knob = this.root.querySelector('.knob');
    this.surrenderBtn = document.getElementById('touch-surrender');
    this.stickId = null;
    this.lookId = null;
    this.last = { x: 0, y: 0 };

    const box = document.getElementById('touch-btns');
    for (const b of BUTTONS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `tbtn ${b.cls || ''}`;
      el.textContent = b.label;
      el.setAttribute('aria-label', b.title);
      el.dataset.code = b.code;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.add('on'); game.press(b.code); }, { passive: false });
      const up = (e) => { e.preventDefault(); el.classList.remove('on'); game.release(b.code); };
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      box.appendChild(el);
    }
    this.surrenderBtn.addEventListener('click', () => game.press('KeyY'));

    // Joystik
    this.stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.stickId = t.identifier;
      this.moveStick(t);
    }, { passive: false });
    // Kamera: o‘yin maydonining istalgan joyini surish
    game.renderer.domElement.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.lookId !== null) return;
      const t = e.changedTouches[0];
      this.lookId = t.identifier;
      this.last.x = t.clientX; this.last.y = t.clientY;
    }, { passive: false });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) this.moveStick(t);
        else if (t.identifier === this.lookId) {
          game.look((t.clientX - this.last.x) * 0.006, (t.clientY - this.last.y) * 0.006);
          this.last.x = t.clientX; this.last.y = t.clientY;
        }
      }
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) { this.stickId = null; this.axis.x = this.axis.y = 0; this.knob.style.transform = ''; }
        if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    addEventListener('touchend', end);
    addEventListener('touchcancel', end);
  }

  moveStick(t) {
    const r = this.stick.getBoundingClientRect();
    let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
    this.axis.x = dx / RADIUS;
    this.axis.y = -dy / RADIUS;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  update() {
    const g = this.game;
    this.surrenderBtn.hidden = !(g.police.pendingCase && !g.jailed);
  }
}
