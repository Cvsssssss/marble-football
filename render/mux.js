'use strict';
// Loudness-normalise the soundtrack (two-pass EBU R128 loudnorm, target -14 LUFS), mux with the video,
// verify with ffprobe and extract sample frames from beginning / middle / end.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static').path;
const ROOT = path.join(__dirname, '..');
const B = (p) => path.join(ROOT, 'build', p);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(ROOT, process.argv[i + 1]) : d; };
// usage: node render/mux.js [--out output/demo_v2_1080p.mp4] [--shots output/screenshots_v2]
const OUT = arg('--out', path.join(ROOT, 'output', 'demo_v2_1080p.mp4'));
const SHOTS = arg('--shots', path.join(ROOT, 'output', 'screenshots_v2'));
const VIDEO = arg('--video', B('video_noaudio.mp4'));
const TAG = (() => { const i = process.argv.indexOf('--tag'); return i > 0 ? process.argv[i + 1] : ''; })(); // 'preview' -> sample_*_preview.png

// pass 1: measure
const p1 = spawnSync(ffmpeg, ['-hide_banner', '-i', B('audio_raw.wav'), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const js = p1.stderr.slice(p1.stderr.lastIndexOf('{'), p1.stderr.lastIndexOf('}') + 1);
const m = JSON.parse(js);
console.log('measured', m.input_i, 'LUFS, TP', m.input_tp);
// pass 2: apply
const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo`;
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', B('audio_raw.wav'), '-af', af, '-ar', '48000', '-ac', '2', B('audio_norm.wav')]);
const chk = spawnSync(ffmpeg, ['-hide_banner', '-i', B('audio_norm.wav'), '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const I = (chk.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop();
const TP = (chk.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop();
console.log('normalised', I, TP);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', VIDEO, '-i', B('audio_norm.wav'), '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', OUT]);

const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', OUT]).toString());
const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio');
const info = {
  file: OUT, sizeMB: +(probe.format.size / 1048576).toFixed(1), duration: +(+probe.format.duration).toFixed(2),
  video: { codec: v.codec_name, profile: v.profile, width: v.width, height: v.height, fps: v.r_frame_rate, pix_fmt: v.pix_fmt, frames: v.nb_frames },
  audio: a ? { codec: a.codec_name, sample_rate: a.sample_rate, channels: a.channels, bitrate: a.bit_rate } : null,
  loudness: { integrated: I, truePeak: TP },
};
fs.writeFileSync(B(TAG ? `ffprobe_${TAG}.json` : 'ffprobe.json'), JSON.stringify(info, null, 2));
console.log(JSON.stringify(info, null, 2));

// sample frames from beginning / middle / end
const shots = SHOTS;
fs.mkdirSync(shots, { recursive: true });
for (const [name, t] of [['sample_begin', 3], ['sample_middle', info.duration / 2], ['sample_end', info.duration - 2.5]]) {
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', String(t.toFixed(2)), '-i', OUT, '-frames:v', '1', path.join(shots, name + (TAG ? '_' + TAG : '') + '.png')]);
}
console.log('samples written');
