import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, scenesFromTemplate, buildCharacterSheetPrompt, buildFramePrompt, progress } from '../js/prompt-builder.js';
import { createLibrary, LIBRARY_KEY, CURRENT_KEY, LEGACY_KEY } from '../js/projects.js';
import {
  computeTimeline, subtitlesFromProject, parseSrt, toSrtFromCaptions, activeCaption,
  fadeAlpha, titleAlpha, coverRect, wrapText, outputSize,
} from '../js/montage.js';
import { socialFallback } from '../js/social.js';
import { generateSocialPost } from '../js/gemini.js';
import { TEMPLATES } from '../js/templates.js';

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: (k) => (k in data ? data[k] : null),
    set: (k, v) => { data[k] = v; },
    remove: (k) => { delete data[k]; },
  };
}

// ---------- Dự án ----------
test('library saves, lists newest first, duplicates and removes projects', async () => {
  const store = memoryStore();
  const lib = createLibrary(store);
  const a = lib.save(createProject({ title: 'A' }));
  await new Promise((r) => setTimeout(r, 2));
  const b = lib.save(createProject({ title: 'B' }));
  assert.deepEqual(lib.list().map((p) => p.title), ['B', 'A']);

  const copy = lib.duplicate(a.id);
  assert.notEqual(copy.id, a.id);
  assert.equal(copy.title, 'A (bản sao)');
  assert.equal(lib.list().length, 3);

  lib.setCurrent(b.id);
  lib.remove(b.id);
  assert.equal(store.get(CURRENT_KEY), null);
  assert.equal(lib.list().length, 2);
});

test('library migrates the single project from the old version once', () => {
  const store = memoryStore({ [LEGACY_KEY]: JSON.stringify({ title: 'Cũ', scenes: [{ title: 'x' }] }) });
  const lib = createLibrary(store);
  assert.equal(lib.list().length, 1);
  assert.equal(lib.openCurrent().title, 'Cũ');
  assert.equal(store.get(LEGACY_KEY), null);
  createLibrary(store);
  assert.equal(JSON.parse(store.get(LIBRARY_KEY)).length, 1);
});

test('openCurrent falls back to a new project and survives corrupt data', () => {
  const lib = createLibrary(memoryStore({ [LIBRARY_KEY]: '{oops' }));
  const p = lib.openCurrent();
  assert.ok(p.id);
  assert.deepEqual(p.scenes, []);
});

// ---------- Ý tưởng, ảnh tham chiếu, tiến độ ----------
test('every template offers idea suggestions', () => {
  assert.ok(TEMPLATES.every((t) => Array.isArray(t.ideas) && t.ideas.length >= 2));
});

test('character sheet and frame prompts', () => {
  const project = createProject({ character: 'a fluffy yellow duckling', styleId: 'kids', aspectRatio: '9:16', setting: 'a pond' });
  assert.equal(buildCharacterSheetPrompt(createProject()), '');
  const sheet = buildCharacterSheetPrompt(project);
  assert.match(sheet, /^Character reference sheet of a fluffy yellow duckling\./);
  assert.match(sheet, /front view, side view/);
  const frame = buildFramePrompt(project, { camera: 'Close-up', action: 'The main character smiles' });
  assert.match(frame, /vertical 9:16 composition, Close-up\. A fluffy yellow duckling smiles\./);
  assert.match(frame, /Setting: a pond\./);
});

test('progress counts finished scenes', () => {
  const project = createProject({ templateId: 'kidsong', idea: 'vịt' });
  project.scenes = scenesFromTemplate(project);
  assert.deepEqual(progress(project), { done: 0, total: 5, percent: 0 });
  project.scenes[0].done = true;
  project.scenes[1].done = true;
  assert.deepEqual(progress(project), { done: 2, total: 5, percent: 40 });
  assert.equal(progress(createProject()).percent, 0);
});

// ---------- Ghép phim ----------
test('timeline applies trims and clamps bad values', () => {
  const t = computeTimeline([
    { duration: 8, trimStart: 1, trimEnd: 0.5 },
    { duration: 8 },
    { duration: 4, trimStart: 10 },
  ]);
  assert.deepEqual(t.items[0], { start: 0, end: 6.5, inPoint: 1, outPoint: 7.5, length: 6.5 });
  assert.equal(t.items[1].start, 6.5);
  assert.equal(t.items[2].length, 0);
  assert.equal(t.total, 14.5);
});

test('script subtitles follow clip order', () => {
  const project = createProject({ scenes: [{ dialogue: 'Xin chào' }, { dialogue: '' }, { dialogue: 'Tạm biệt' }] });
  const caps = subtitlesFromProject(project, computeTimeline([{ duration: 8 }, { duration: 8 }, { duration: 8 }]));
  assert.deepEqual(caps.map((c) => c.text), ['Xin chào', 'Tạm biệt']);
  assert.equal(caps[1].start, 16.3);
  assert.equal(activeCaption(caps, 17)?.text, 'Tạm biệt');
  assert.equal(activeCaption(caps, 9), null);
});

test('SRT parse and write round trip', () => {
  const srt = '1\r\n00:00:01,000 --> 00:00:02,500\r\nMột\r\n\r\n2\r\n00:01:00.25 --> 00:01:02,000\r\nHai\r\ndòng\r\n\r\nrác';
  const caps = parseSrt(srt);
  assert.deepEqual(caps, [
    { start: 1, end: 2.5, text: 'Một' },
    { start: 60.25, end: 62, text: 'Hai\ndòng' },
  ]);
  assert.deepEqual(parseSrt(toSrtFromCaptions(caps)), caps);
});

test('fade and title envelopes', () => {
  const item = { start: 10, end: 18, length: 8 };
  assert.equal(fadeAlpha(10, item, 0.5), 1);
  assert.equal(fadeAlpha(14, item, 0.5), 0);
  assert.equal(fadeAlpha(17.75, item, 0.5), 0.5);
  assert.equal(fadeAlpha(14, item, 0), 0);
  assert.equal(titleAlpha(0, 3.5), 0);
  assert.equal(titleAlpha(2, 3.5), 1);
  assert.equal(titleAlpha(4, 3.5), 0);
});

test('cover crop keeps aspect ratio for vertical output', () => {
  const r = coverRect(1280, 720, 720, 1280);
  assert.ok(Math.abs(r.sw / r.sh - 720 / 1280) < 1e-9);
  assert.equal(r.sh, 720);
  assert.equal(r.sx, (1280 - r.sw) / 2);
  assert.deepEqual(outputSize('9:16'), { width: 720, height: 1280 });
  assert.deepEqual(outputSize('weird'), { width: 1280, height: 720 });
});

test('wrapText splits long Vietnamese lines by width', () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrapText('Một con vịt xoè ra hai cái cánh', 120, measure), ['Một con vịt', 'xoè ra hai', 'cái cánh']);
  assert.deepEqual(wrapText('A\nB', 1000, measure), ['A', 'B']);
});

// ---------- Mạng xã hội ----------
test('social fallback builds title, caption and hashtags', () => {
  const post = socialFallback(createProject({ title: 'Đàn vịt con', templateId: 'kidsong', scenes: [{ dialogue: 'Một con vịt' }] }));
  assert.equal(post.youtubeTitle, 'Đàn vịt con | Nhạc thiếu nhi làm bằng AI');
  assert.ok(post.hashtags.includes('#nhacthieunhi'));
  assert.ok(post.hashtags.includes('#danvitcon'));
  assert.match(post.youtubeDescription, /“Một con vịt”/);
  assert.ok(post.tiktokCaption.length <= 150);
});

test('generateSocialPost normalizes hashtags', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      youtubeTitle: 'T', youtubeDescription: 'D', tiktokCaption: 'C', hashtags: ['nhac thieu nhi', '#vit', '#'],
    }) }] } }] }),
  });
  const post = await generateSocialPost({ apiKey: 'k', project: createProject({ title: 'x' }), fetchImpl: fakeFetch });
  assert.deepEqual(post.hashtags, ['#nhacthieunhi', '#vit']);
});
