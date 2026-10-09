import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSegments, assignVoices, segmentsFromProject, toSrt, formatSrtTime, layoutClips, encodeWav, pcm16ToFloat32, parseSampleRate, ffmpegCommand } from '../js/dubbing.js';
import { createProject } from '../js/prompt-builder.js';

test('normalizeSegments sorts, fixes bad times and drops empty lines', () => {
  const segs = normalizeSegments([
    { start: 5, end: 4, speaker: 'B', gender: 'male', original: 'Bye', vietnamese: 'Tạm biệt' },
    { start: '1.5', end: '3', speaker: '', gender: 'robot', original: 'Hi', vietnamese: ' Chào ' },
    { start: 9, end: 10, original: '', vietnamese: '' },
  ]);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].start, 1.5);
  assert.equal(segs[0].vietnamese, 'Chào');
  assert.equal(segs[0].speaker, 'Người nói 1');
  assert.equal(segs[0].gender, 'female');
  assert.equal(segs[1].end, 5.5);
});

test('assignVoices gives different speakers different voices and keeps existing ones', () => {
  const segs = [
    { speaker: 'A', gender: 'male' }, { speaker: 'B', gender: 'male' }, { speaker: 'C', gender: 'female' }, { speaker: 'A', gender: 'male' },
  ];
  const map = assignVoices(segs, { C: 'Leda' });
  assert.notEqual(map.A, map.B);
  assert.equal(map.C, 'Leda');
});

test('segmentsFromProject skips sung lines and places lines per 8s scene', () => {
  const project = createProject({ scenes: [
    { voiceType: 'dialogue', dialogue: 'Xin chào' },
    { voiceType: 'sing', dialogue: 'la la' },
    { voiceType: 'narration', dialogue: 'Ngày xưa' },
  ] });
  const segs = segmentsFromProject(project);
  assert.equal(segs.length, 2);
  assert.equal(segs[1].start, 16.5);
  assert.equal(segs[1].speaker, 'Người dẫn chuyện');
});

test('SRT formatting', () => {
  assert.equal(formatSrtTime(3725.5), '01:02:05,500');
  const srt = toSrt([{ start: 0, end: 1.25, vietnamese: 'Một' }, { start: 2, end: 3, vietnamese: '' }, { start: 4, end: 5, vietnamese: 'Hai' }]);
  assert.equal(srt, '1\n00:00:00,000 --> 00:00:01,250\nMột\n\n2\n00:00:04,000 --> 00:00:05,000\nHai\n');
});

test('layoutClips pushes overlapping lines back and reports delay', () => {
  const out = layoutClips([{ start: 0, duration: 3 }, { start: 2, duration: 1 }, { start: 10, duration: 1 }]);
  assert.deepEqual(out.map((c) => c.at), [0, 3, 10]);
  assert.equal(out[1].delay, 1);
});

test('PCM decode and WAV encode round trip header', () => {
  const samples = pcm16ToFloat32(new Uint8Array(new Int16Array([32767, -32768]).buffer));
  assert.ok(Math.abs(samples[0] - 1) < 1e-4);
  const wav = new DataView(encodeWav([samples, samples], 48000));
  assert.equal(String.fromCharCode(...new Uint8Array(wav.buffer, 0, 4)), 'RIFF');
  assert.equal(wav.getUint16(22, true), 2);
  assert.equal(wav.getUint32(24, true), 48000);
  assert.equal(wav.byteLength, 44 + 2 * 2 * 2);
  assert.equal(parseSampleRate('audio/L16;codec=pcm;rate=24000'), 24000);
});

test('ffmpeg command maps video, dubbed audio and subtitles', () => {
  assert.equal(
    ffmpegCommand('phim.mp4', 'a.wav', 'a.srt'),
    'ffmpeg -i "phim.mp4" -i "a.wav" -i "a.srt" -map 0:v -map 1:a -map 2:s -c:s mov_text -metadata:s:s:0 language=vie -c:v copy -c:a aac -shortest "phim-long-tieng-viet.mp4"',
  );
});
