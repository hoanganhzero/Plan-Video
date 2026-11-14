// Đọc chữ từ tệp giáo viên tải lên, ngay trong trình duyệt (không gửi đi đâu):
// - PDF: pdf.js (thư viện để sẵn trong vendor/, chạy được khi mất mạng)
// - Word .docx: tệp .docx là một file zip → giải nén word/document.xml bằng DecompressionStream
// - .txt / .csv / .md: đọc thẳng
// PDF scan (ảnh chụp) và ảnh SGK không có chữ để đọc → dùng chế độ AI (Gemini đọc được ảnh/PDF).

export const TEXT_EXT = /\.(txt|md|csv|tsv)$/i;

export function fileKind(file) {
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.pdf') || file?.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.doc')) return 'doc';
  if (/\.(png|jpe?g|webp|heic)$/i.test(name) || /^image\//.test(file?.type || '')) return 'image';
  if (/\.csv$|\.tsv$/i.test(name)) return 'csv';
  if (TEXT_EXT.test(name) || /^text\//.test(file?.type || '')) return 'text';
  return 'unknown';
}

// ---------- DOCX ----------
// Đọc bảng mục lục cuối file zip (central directory) để tìm word/document.xml.
async function unzipEntry(buffer, wanted) {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Tệp Word bị hỏng hoặc không phải .docx.');
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOff = view.getUint32(ptr + 42, true);
    const name = dec.decode(new Uint8Array(buffer, ptr + 46, nameLen));
    if (name === wanted) {
      const lNameLen = view.getUint16(localOff + 26, true);
      const lExtraLen = view.getUint16(localOff + 28, true);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const data = new Uint8Array(buffer, start, compSize);
      if (method === 0) return dec.decode(data);
      if (method !== 8) throw new Error('Kiểu nén trong tệp Word chưa được hỗ trợ.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('Không tìm thấy nội dung trong tệp Word.');
}

// Chuyển XML của Word thành văn bản: mỗi đoạn (w:p) một dòng, ô bảng cách nhau bằng " | ".
export function docxXmlToText(xml) {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/ \| \n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function docxText(file) {
  return docxXmlToText(await unzipEntry(await file.arrayBuffer(), 'word/document.xml'));
}

// ---------- PDF ----------
let pdfjs = null;
async function pdfText(file, onProgress) {
  if (!pdfjs) {
    pdfjs = await import('../vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Ghép chữ theo dòng: mục nào có hasEOL hoặc đổi toạ độ y thì xuống dòng.
    let line = '';
    let lastY = null;
    const lines = [];
    for (const item of content.items) {
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2 && line.trim()) { lines.push(line.trim()); line = ''; }
      line += item.str;
      if (item.hasEOL) { lines.push(line.trim()); line = ''; }
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join('\n'));
    onProgress?.(i, doc.numPages);
  }
  return { text: pages.join('\n\n'), pages: doc.numPages };
}

// Đọc tệp → { kind, text, pages?, note? }
export async function extractText(file, onProgress) {
  const kind = fileKind(file);
  if (kind === 'pdf') {
    const r = await pdfText(file, onProgress);
    const note = r.text.replace(/\s/g, '').length < 40 * r.pages
      ? 'PDF này gần như không có chữ (có thể là bản scan / ảnh chụp). Hãy dùng chế độ AI để Gemini đọc trực tiếp tệp.' : '';
    return { kind, text: r.text, pages: r.pages, note };
  }
  if (kind === 'docx') return { kind, text: await docxText(file) };
  if (kind === 'text' || kind === 'csv') return { kind, text: await file.text() };
  if (kind === 'image') return { kind, text: '', note: 'Ảnh chụp trang sách: dùng chế độ AI để Gemini đọc ảnh và tạo câu hỏi.' };
  if (kind === 'doc') throw new Error('Tệp .doc (Word đời cũ) chưa đọc được. Hãy mở bằng Word và "Lưu thành" .docx hoặc PDF.');
  throw new Error('Định dạng tệp chưa được hỗ trợ. Dùng PDF, Word (.docx), .txt, .csv hoặc ảnh.');
}

export async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
