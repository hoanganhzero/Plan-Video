import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, scenesFromTemplate, buildScenePrompt, buildAllPrompts, exportText, totalDuration } from '../js/prompt-builder.js';
import { parseStoryboard, generateStoryboard, transcribeAndTranslate, synthesizeSpeech } from '../js/gemini.js';
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
  assert.equal(scenesFromTemplate(project, 99).length, 30);
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
  assert.match(prompt, /speaks in Vietnamese with a natural Northern Vietnamese \(Hanoi\) accent.*: "Mời 'bạn'"/);
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

test('voice lines describe singing, narration and accent', () => {
  const south = createProject({ voiceLanguage: 'vi-south' });
  assert.match(buildScenePrompt(south, { camera: 'c', action: 'a', voiceType: 'sing', dialogue: 'Con cò bé bé' }),
    /sings in Vietnamese with a natural Southern Vietnamese \(Saigon\) accent.*Lyrics: "Con cò bé bé"/);
  assert.match(buildScenePrompt(south, { camera: 'c', action: 'a', voiceType: 'narration', dialogue: 'Ngày xửa ngày xưa' }),
    /Voice-over narration in Vietnamese/);
  assert.doesNotMatch(buildScenePrompt(south, { camera: 'c', action: 'a', voiceType: 'sing', dialogue: '' }), /Lyrics/);
});

test('new genre templates exist with defaults and singing scenes', () => {
  for (const id of ['story', 'musicvideo', 'animation', 'kidsong']) {
    const t = TEMPLATES.find((x) => x.id === id);
    assert.ok(t, id);
    assert.ok(t.defaults.styleId);
  }
  const kids = scenesFromTemplate(createProject({ templateId: 'kidsong', idea: 'con vịt' }));
  assert.ok(kids.some((s) => s.voiceType === 'sing'));
  assert.equal(kids.at(-1).dialogue, 'Tạm biệt các bé nhé!');
});

function okResponse(json) {
  return { ok: true, json: async () => json, headers: new Map() };
}

test('generateStoryboard retries on 429 then succeeds', async () => {
  let calls = 0;
  const waits = [];
  const fakeFetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, text: async () => '{"retryDelay": "7s"}' };
    const body = { title: 'T', character: '', setting: '', scenes: [{ title: 'A', goal: '', camera: 'c', action: 'a', voiceType: 'sing', dialogue: 'la la', sound: '' }] };
    return okResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] });
  };
  const sb = await generateStoryboard({ apiKey: 'k', project: createProject({ idea: 'x' }), sceneCount: 1, fetchImpl: fakeFetch, sleep: async (ms) => waits.push(ms) });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [7000]);
  assert.equal(sb.scenes[0].voiceType, 'sing');
});

test('transcribeAndTranslate sends small video inline', async () => {
  let sent;
  const fakeFetch = async (url, init) => {
    sent = JSON.parse(init.body);
    return okResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify({ sourceLanguage: 'Tiếng Anh', segments: [{ start: 1, end: 2, speaker: 'A', gender: 'male', original: 'Hi', vietnamese: 'Chào' }] }) }] } }] });
  };
  const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
  const res = await transcribeAndTranslate({ apiKey: 'k', file, fetchImpl: fakeFetch });
  assert.equal(res.segments[0].vietnamese, 'Chào');
  assert.equal(sent.contents[0].parts[0].inlineData.mimeType, 'video/mp4');
  assert.equal(sent.contents[0].parts[0].inlineData.data, 'AQID');
});

test('synthesizeSpeech decodes PCM audio and asks for the accent', async () => {
  let sent;
  const pcm = Buffer.from(new Int16Array([0, 16384, -32768]).buffer).toString('base64');
  const fakeFetch = async (url, init) => {
    sent = JSON.parse(init.body);
    return okResponse({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm } }] } }] });
  };
  const out = await synthesizeSpeech({ apiKey: 'k', text: 'Xin chào', voice: 'Puck', voiceLanguage: 'vi-central', fetchImpl: fakeFetch });
  assert.equal(out.sampleRate, 24000);
  assert.deepEqual([...out.samples], [0, 0.5, -1]);
  assert.equal(sent.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Puck');
  assert.match(sent.contents[0].parts[0].text, /Central Vietnamese \(Hue\)[\s\S]*Xin chào$/);
});
