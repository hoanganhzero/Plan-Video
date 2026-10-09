import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, scenesFromTemplate, buildScenePrompt, buildAllPrompts, exportText, totalDuration } from '../js/prompt-builder.js';
import { parseStoryboard, generateStoryboard } from '../js/gemini.js';
import { TEMPLATES } from '../js/templates.js';

test('every template produces scenes with the idea filled in', () => {
  for (const t of TEMPLATES) {
    const project = createProject({ templateId: t.id, idea: 'salted coffee' });
    const scenes = scenesFromTemplate(project);
    assert.equal(scenes.length, t.beats.length);
    assert.ok(scenes.every((s) => !s.action.includes('{idea}')));
  }
});

test('scene count pads or truncates the template', () => {
  const project = createProject({ templateId: 'product', idea: 'x' });
  assert.equal(scenesFromTemplate(project, 2).length, 2);
  const padded = scenesFromTemplate(project, 7);
  assert.equal(padded.length, 7);
  assert.equal(padded[6].title, 'Cảnh 7');
  assert.equal(scenesFromTemplate(project, 99).length, 12);
});

test('character description is repeated in every prompt', () => {
  const character = 'a young woman in a white linen shirt';
  const project = createProject({ templateId: 'travel', idea: 'Hoi An', character });
  project.scenes = scenesFromTemplate(project);
  const prompts = buildAllPrompts(project);
  const withCharacter = prompts.filter((p) => p.prompt.toLowerCase().includes(character));
  assert.equal(withCharacter.length, 4); // 4/5 beats của mẫu travel có nhân vật
  assert.ok(prompts.every((p) => !p.prompt.includes('The main character')));
});

test('prompt contains camera, style, audio, dialogue and no-text rule', () => {
  const project = createProject({ idea: 'tea', music: 'soft piano' });
  const prompt = buildScenePrompt(project, {
    camera: 'Close-up', action: 'Tea is poured', dialogue: 'Mời "bạn"', sound: 'pouring water',
  });
  assert.match(prompt, /^Close-up\. Tea is poured\./);
  assert.match(prompt, /Style: cinematic/);
  assert.match(prompt, /Audio: pouring water, soft piano\./);
  assert.match(prompt, /Dialogue: "Mời 'bạn'"/);
  assert.match(prompt, /No subtitles/);
});

test('export text lists all scenes and duration', () => {
  const project = createProject({ title: 'Demo', idea: 'pho' , templateId: 'food' });
  project.scenes = scenesFromTemplate(project);
  assert.equal(totalDuration(project), 40);
  const text = exportText(project);
  assert.match(text, /^# Demo/);
  assert.equal((text.match(/^## Cảnh/gm) || []).length, 5);
});

test('parseStoryboard handles fenced JSON and rejects empty output', () => {
  const sb = parseStoryboard('```json\n{"title":"T","character":"c","setting":"s","scenes":[{"action":"a"}]}\n```');
  assert.equal(sb.scenes[0].title, 'Cảnh 1');
  assert.equal(sb.scenes[0].action, 'a');
  assert.throws(() => parseStoryboard('{"scenes":[]}'));
  assert.throws(() => parseStoryboard('not json'));
});

test('generateStoryboard calls Gemini with the key in a header', async () => {
  let called;
  const fakeFetch = async (url, init) => {
    called = { url, init };
    const body = { title: 'T', character: '', setting: '', scenes: [{ title: 'A', goal: '', camera: 'c', action: 'a', dialogue: '', sound: '' }] };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) };
  };
  const result = await generateStoryboard({ apiKey: 'k', project: createProject({ idea: 'x' }), sceneCount: 1, fetchImpl: fakeFetch });
  assert.equal(result.scenes.length, 1);
  assert.match(called.url, /gemini-2\.5-flash:generateContent$/);
  assert.equal(called.init.headers['x-goog-api-key'], 'k');
  assert.ok(!called.url.includes('key='));
});
