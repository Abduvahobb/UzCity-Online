// Ovozli chat: WebRTC (o‘yinchilar bir-biriga to‘g‘ridan-to‘g‘ri ulanadi).
// Server faqat ulanish signallarini uzatadi. "Yaqin atrof" rejimida ovoz masofaga qarab pasayadi.
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const HEAR_DIST = 45; // metr

export class Voice {
  constructor(game) {
    this.game = game;
    this.peers = new Map();
    this.stream = null;
    this.track = null;
    this.talking = false;
    this.mode = 'near'; // gapirish rejimi: 'near' — yaqin atrof, 'room' — butun xona
    this.requesting = false;
  }

  get ctx() { return this.game.audioCtx; }

  async ensureMic() {
    if (this.track || this.requesting) return !!this.track;
    if (!navigator.mediaDevices?.getUserMedia) { this.game.ui.toast('Brauzer mikrofonni qo‘llab-quvvatlamaydi (HTTPS kerak).', 'danger'); return false; }
    this.requesting = true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.track = this.stream.getAudioTracks()[0];
      this.track.enabled = false;
      for (const p of this.peers.values()) p.transceiver?.sender.replaceTrack(this.track);
      this.game.ui.toast('Mikrofon ulandi. Gapirish uchun B ni bosib turing.', 'good');
    } catch {
      this.game.ui.toast('Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.', 'danger');
    }
    this.requesting = false;
    return !!this.track;
  }

  async setTalking(on) {
    if (!this.game.net?.connected) return;
    if (on && !this.track) { await this.ensureMic(); return; }
    this.talking = on && !!this.track;
    if (this.track) this.track.enabled = this.talking;
  }

  toggleMode() {
    this.mode = this.mode === 'near' ? 'room' : 'near';
    this.game.ui.toast(this.mode === 'near' ? 'Ovoz: faqat yaqin atrofdagilar eshitadi' : 'Ovoz: butun xona eshitadi (radio)');
  }

  createPeer(id) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = { id, pc, transceiver: null, gain: null, analyser: null, level: 0, el: null };
    pc.onicecandidate = (e) => { if (e.candidate) this.game.net.send({ t: 'signal', to: id, data: { ice: e.candidate } }); };
    pc.ontrack = (e) => this.attachAudio(peer, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') this.removePeer(id); };
    this.peers.set(id, peer);
    return peer;
  }

  // Yangi kelgan o‘yinchi boshqalarga o‘zi taklif yuboradi
  async connectTo(id) {
    if (typeof RTCPeerConnection === 'undefined') return;
    const peer = this.createPeer(id);
    peer.transceiver = peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
    if (this.track) await peer.transceiver.sender.replaceTrack(this.track);
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.game.net.send({ t: 'signal', to: id, data: { sdp: peer.pc.localDescription } });
  }

  async onSignal(from, data) {
    if (typeof RTCPeerConnection === 'undefined' || !data) return;
    let peer = this.peers.get(from);
    try {
      if (data.sdp) {
        if (data.sdp.type === 'offer') {
          if (peer) this.removePeer(from);
          peer = this.createPeer(from);
          await peer.pc.setRemoteDescription(data.sdp);
          peer.transceiver = peer.pc.getTransceivers()[0];
          if (peer.transceiver) {
            peer.transceiver.direction = 'sendrecv';
            if (this.track) await peer.transceiver.sender.replaceTrack(this.track);
          }
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          this.game.net.send({ t: 'signal', to: from, data: { sdp: peer.pc.localDescription } });
        } else if (peer) {
          await peer.pc.setRemoteDescription(data.sdp);
        }
      } else if (data.ice && peer) {
        await peer.pc.addIceCandidate(data.ice);
      }
    } catch (err) {
      console.warn('Ovozli ulanish xatosi', err);
    }
  }

  attachAudio(peer, stream) {
    if (!this.ctx || peer.gain) return;
    // Chrome uchun: oqim jim <audio> elementga ham ulanishi kerak
    peer.el = new Audio(); peer.el.muted = true; peer.el.srcObject = stream; peer.el.play().catch(() => {});
    const src = this.ctx.createMediaStreamSource(stream);
    peer.gain = this.ctx.createGain();
    peer.gain.gain.value = 0;
    peer.analyser = this.ctx.createAnalyser();
    peer.analyser.fftSize = 256;
    peer.buf = new Uint8Array(peer.analyser.fftSize);
    src.connect(peer.gain).connect(this.ctx.destination);
    src.connect(peer.analyser);
  }

  removePeer(id) {
    const p = this.peers.get(id);
    if (!p) return;
    try { p.pc.close(); } catch { /* yopilgan */ }
    p.gain?.disconnect();
    this.peers.delete(id);
  }

  update() {
    const g = this.game, me = g.player.car ? g.player.car.root.position : g.player.pos;
    for (const p of this.peers.values()) {
      const r = g.net.remotes.get(p.id);
      if (!p.gain || !r || !r.s) continue;
      // Gapiruvchi "butun xona" rejimida bo‘lsa — hamma eshitadi, aks holda masofaga qarab
      let vol = 1;
      if (!r.s.vm) {
        const sameCountry = r.s.k === g.country.id;
        const d = r.root.position.distanceTo(me);
        vol = sameCountry ? Math.max(0, 1 - d / HEAR_DIST) : 0;
      }
      p.gain.gain.setTargetAtTime(vol * g.volume, this.ctx.currentTime, 0.1);
      p.analyser.getByteTimeDomainData(p.buf);
      let sum = 0;
      for (let i = 0; i < p.buf.length; i += 4) { const v = (p.buf[i] - 128) / 128; sum += v * v; }
      p.level = p.level * 0.8 + Math.sqrt(sum / (p.buf.length / 4)) * 0.2;
      r.speakIcon.visible = p.level > 0.02;
    }
    g.ui.setVoice({ online: g.net.connected, talking: this.talking, mic: !!this.track, mode: this.mode });
  }
}
