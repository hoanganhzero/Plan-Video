import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, buildScenePrompt, buildReferenceFramePrompt } from '../js/prompt-builder.js';
import { renderScene, runAll, estimateCost, priceTier } from '../js/auto-video.js';
import {
  pickModels, listModels, generateImage, startVideo, waitForVideo, downloadVideo, generateStoryboard,
} from '../js/gemini.js';

const ok = (json) => ({ ok: true, json: async () => json, blob: async () => new Blob(['v']) });
const noSleep = async () => {};

test('pickModels prefers Veo fast and a flash image model', () => {
  const picked = pickModels([
    { id: 'gemini-2.5-flash', methods: ['generateContent'] },
    { id: 'veo-3.1-generate-preview', methods: ['predictLongRunning'] },
    { id: 'veo-3.1-fast-generate-preview', methods: ['predictLongRunning'] },
    { id: 'imagen-4.0-generate-001', methods: ['predict'] },
    { id: 'gemini-3-pro-image', methods: ['generateContent'] },
    { id: 'gemini-3.1-flash-lite-image', methods: ['generateContent'] },
  ]);
  assert.deepEqual(picked, { video: 'veo-3.1-fast-generate-preview', image: 'gemini-3.1-flash-lite-image', omni: false });
  assert.deepEqual(pickModels([{ id: 'gemini-omni-1.1-flash', methods: ['generateContent'] }]), { video: '', image: '', omni: true });
});

test('listModels follows pagination and strips the models/ prefix', async () => {
  const pages = [
    { models: [{ name: 'models/a', supportedGenerationMethods: ['x'] }], nextPageToken: 't' },
    { models: [{ name: 'models/b' }] },
  ];
  const urls = [];
  const list = await listModels({ apiKey: 'k', fetchImpl: async (url) => { urls.push(url); return ok(pages.shift()); } });
  assert.deepEqual(list, [{ id: 'a', methods: ['x'] }, { id: 'b', methods: [] }]);
  assert.match(urls[1], /pageToken=t/);
});

test('cost estimate by model tier', () => {
  assert.equal(priceTier('veo-3.1-fast-generate-preview'), 'fast');
  assert.equal(priceTier('veo-3.1-lite-generate-preview'), 'lite');
  assert.equal(priceTier('veo-3.1-generate-preview'), 'standard');
  assert.equal(estimateCost('veo-3.1-fast-generate-preview', 4), 3.84);
});

test('generateImage sends reference photos and returns the image part', async () => {
  let body;
  const img = await generateImage({
    apiKey: 'k',
    model: 'img-model',
    prompt: 'p',
    images: [{ mimeType: 'image/jpeg', data: 'AAA' }],
    aspectRatio: '9:16',
    fetchImpl: async (url, init) => {
      body = JSON.parse(init.body);
      return ok({ candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: 'PNG' } }] } }] });
    },
  });
  assert.deepEqual(img, { mimeType: 'image/png', data: 'PNG' });
  assert.equal(body.contents[0].parts[0].inlineData.data, 'AAA');
  assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.equal(body.generationConfig.imageConfig.aspectRatio, '9:16');
  await assert.rejects(
    generateImage({ apiKey: 'k', model: 'm', prompt: 'p', fetchImpl: async () => ok({ candidates: [{ finishReason: 'SAFETY' }] }) }),
    /SAFETY/,
  );
});

test('startVideo posts an image-to-video request', async () => {
  let call;
  const name = await startVideo({
    apiKey: 'k', model: 'veo-x', prompt: 'P', image: { mimeType: 'image/png', data: 'IMG' }, aspectRatio: '9:16',
    fetchImpl: async (url, init) => { call = { url, body: JSON.parse(init.body) }; return ok({ name: 'models/veo-x/operations/1' }); },
  });
  assert.equal(name, 'models/veo-x/operations/1');
  assert.match(call.url, /models\/veo-x:predictLongRunning$/);
  assert.deepEqual(call.body.instances[0], { prompt: 'P', image: { bytesBase64Encoded: 'IMG', mimeType: 'image/png' } });
  assert.deepEqual(call.body.parameters, { aspectRatio: '9:16', personGeneration: 'allow_adult' });
});

test('waitForVideo polls until done and reports safety blocks', async () => {
  const replies = [
    { done: false },
    { done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://x/v.mp4' } }] } } },
  ];
  let ticks = 0;
  const uri = await waitForVideo({ apiKey: 'k', operation: 'op/1', sleep: noSleep, onTick: () => ticks++, fetchImpl: async () => ok(replies.shift()) });
  assert.equal(uri, 'https://x/v.mp4');
  assert.equal(ticks, 1);
  await assert.rejects(
    waitForVideo({ apiKey: 'k', operation: 'op', sleep: noSleep, fetchImpl: async () => ok({ done: true, response: { generateVideoResponse: { raiMediaFilteredReasons: ['child'] } } }) }),
    /chính sách an toàn: child/,
  );
});

test('billing errors get a clear Vietnamese message', async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, text: async () => '{"error":{"status":"FAILED_PRECONDITION","message":"Billing required"}}' });
  await assert.rejects(startVideo({ apiKey: 'k', model: 'veo', prompt: 'p', fetchImpl }), /bật thanh toán/);
});

test('downloadVideo falls back to a manual link when blocked', async () => {
  const blocked = await downloadVideo({ apiKey: 'K', uri: 'https://g/v?alt=media', fetchImpl: async () => { throw new TypeError('CORS'); } });
  assert.equal(blocked.blob, null);
  assert.equal(blocked.url, 'https://g/v?alt=media&key=K');
  const fine = await downloadVideo({ apiKey: 'K', uri: 'https://g/v', fetchImpl: async () => ok({}) });
  assert.ok(fine.blob);
});

test('storyboard request includes photos and returns product description', async () => {
  let body;
  const sb = await generateStoryboard({
    apiKey: 'k',
    project: createProject({ idea: 'son môi' }),
    sceneCount: 1,
    images: [{ role: 'person', mimeType: 'image/jpeg', data: 'P' }, { role: 'product', mimeType: 'image/jpeg', data: 'Q' }],
    fetchImpl: async (url, init) => {
      body = JSON.parse(init.body);
      return ok({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'T', character: 'woman', setting: 's', product: 'red lipstick', scenes: [{ action: 'a' }] }) }] } }] });
    },
  });
  const parts = body.contents[0].parts;
  assert.equal(parts[0].inlineData.data, 'P');
  assert.equal(parts[1].inlineData.data, 'Q');
  assert.match(parts[2].text, /#1 photo of the main character.*#2 product photo/);
  assert.equal(sb.product, 'red lipstick');
});

test('reference mode prompts keep the real person and product', () => {
  const project = createProject({ referenceMode: true, product: 'a red lipstick tube with gold cap' });
  const scene = { camera: 'Close-up', action: 'The main character applies the lipstick' };
  assert.match(buildScenePrompt(project, scene), /^Use the exact same person and product as in the reference images/);
  assert.match(buildScenePrompt(project, scene), /The product, identical in every shot: a red lipstick tube with gold cap\./);
  const frame = buildReferenceFramePrompt(project, scene, { hasPerson: true, hasProduct: true });
  assert.match(frame, /^Create a photorealistic image featuring the exact person from the person photo .* and the exact product from the product photo/);
});

test('renderScene: frame → video → download, with progress updates', async () => {
  const statuses = [];
  const calls = {};
  const result = await renderScene({
    project: createProject({ aspectRatio: '9:16', product: 'lipstick' }),
    scene: { camera: 'c', action: 'a' },
    images: { person: { mimeType: 'image/jpeg', data: 'P' }, product: { mimeType: 'image/jpeg', data: 'Q' } },
    models: { video: 'veo', image: 'img' },
    api: {
      generateImage: async (o) => { calls.image = o; return { mimeType: 'image/png', data: 'F' }; },
      startVideo: async (o) => { calls.video = o; return 'op'; },
      waitForVideo: async ({ onTick }) => { onTick(5000); return 'uri'; },
      downloadVideo: async () => ({ blob: new Blob(['v']), url: 'u' }),
    },
    onUpdate: (r) => statuses.push(r.status),
  });
  assert.equal(result.status, 'done');
  assert.equal(calls.image.images.length, 2);
  assert.equal(calls.video.image.data, 'F');
  assert.equal(calls.video.aspectRatio, '9:16');
  assert.doesNotMatch(calls.video.prompt, /reference images/);
  assert.deepEqual([...new Set(statuses)], ['image', 'video', 'download', 'done']);
});

test('renderScene reports errors and manual downloads', async () => {
  const base = {
    project: createProject(), scene: { camera: 'c', action: 'a' }, images: {}, models: { video: 'veo', image: '' },
  };
  const failed = await renderScene({ ...base, api: { startVideo: async () => { throw new Error('Cần bật thanh toán'); } } });
  assert.equal(failed.status, 'error');
  assert.equal(failed.error, 'Cần bật thanh toán');
  const manual = await renderScene({
    ...base,
    api: { startVideo: async (o) => { assert.equal(o.image, null); return 'op'; }, waitForVideo: async () => 'uri', downloadVideo: async () => ({ blob: null, url: 'link' }) },
  });
  assert.equal(manual.status, 'manual');
  assert.equal(manual.url, 'link');
});

test('runAll limits concurrency and keeps order', async () => {
  let active = 0;
  let peak = 0;
  const tasks = [30, 10, 20, 5].map((ms, i) => async () => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, ms));
    active--;
    return i;
  });
  assert.deepEqual(await runAll(tasks, 2), [0, 1, 2, 3]);
  assert.equal(peak, 2);
});
