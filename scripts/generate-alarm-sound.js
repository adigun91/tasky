// One-off generator for assets/sounds/alarm.wav — a synthesized beeping alarm tone (no external audio license needed).
// Run with: node scripts/generate-alarm-sound.js
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 2; // one loop cycle; the app repeats this with AudioPlayer loop=true
const TONE_HZ = 880;
const BEEP_MS = 180;
const GAP_MS = 120;

function buildSamples() {
  const totalSamples = Math.floor(SAMPLE_RATE * DURATION_SECONDS);
  const samples = new Int16Array(totalSamples);
  const beepSamples = Math.floor((BEEP_MS / 1000) * SAMPLE_RATE);
  const gapSamples = Math.floor((GAP_MS / 1000) * SAMPLE_RATE);
  const cycle = beepSamples + gapSamples;

  for (let i = 0; i < totalSamples; i++) {
    const posInCycle = i % cycle;
    if (posInCycle < beepSamples) {
      const t = i / SAMPLE_RATE;
      // envelope to avoid clicks at beep start/end
      const fadeSamples = Math.floor(SAMPLE_RATE * 0.005);
      let amp = 1;
      if (posInCycle < fadeSamples) amp = posInCycle / fadeSamples;
      else if (posInCycle > beepSamples - fadeSamples) amp = (beepSamples - posInCycle) / fadeSamples;
      samples[i] = Math.round(Math.sin(2 * Math.PI * TONE_HZ * t) * 32000 * amp);
    } else {
      samples[i] = 0;
    }
  }
  return samples;
}

function writeWav(filePath, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (SAMPLE_RATE * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

const outPath = path.join(__dirname, '..', 'assets', 'sounds', 'alarm.wav');
writeWav(outPath, buildSamples());
console.log(`Wrote ${outPath}`);
