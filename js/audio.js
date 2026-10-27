// Small original synthesized motifs; sound starts only after the player's click.
export class AudioGuide {
  constructor() { this.enabled = false; this.context = null; this.note = 0; }
  async toggle() {
    if (this.enabled) { this.enabled = false; clearInterval(this.timer); await this.context?.suspend(); return false; }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Áudio indisponível');
    this.context ||= new AudioContext();
    await this.context.resume(); this.enabled = true;
    this.timer = setInterval(() => {
      if (document.hidden) return;
      const melody = [60, 67, 72, 76, 74, 67, 64, 71, 72, 67, 62, 69, 67, 64, 60, 55];
      this.tone(melody[this.note++ % melody.length], .65, .018, 'sine');
      if (this.note % 4 === 0) this.tone([48, 45, 53, 55][Math.floor(this.note / 4) % 4], 1.3, .014, 'triangle');
    }, 520);
    this.play('confirm'); return true;
  }
  tone(midi, duration = .15, volume = .025, type = 'triangle', delay = 0) {
    if (!this.enabled || !this.context || document.hidden) return;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    const start = this.context.currentTime + delay;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .02);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(start); oscillator.stop(start + duration + .05);
  }
  play(kind) {
    const notes = kind === 'victory' || kind === 'capture' || kind === 'level' ? [67, 72, 76, 79] : kind === 'attack' ? [48, 43] : kind === 'heal' ? [64, 69, 76] : [72, 76];
    notes.forEach((note, index) => this.tone(note, .16, .035, 'triangle', index * .09));
  }
}
