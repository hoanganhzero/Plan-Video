// Thư viện nhiều dự án, lưu trong trình duyệt (localStorage).
// `store` là đối tượng có get/set/remove để dễ kiểm thử.

import { createProject, newId } from './prompt-builder.js';

export const LIBRARY_KEY = 'plan-video:projects';
export const CURRENT_KEY = 'plan-video:current';
export const LEGACY_KEY = 'plan-video:project'; // phiên bản cũ chỉ lưu 1 dự án

export function createLibrary(store) {
  function read() {
    try {
      const list = JSON.parse(store.get(LIBRARY_KEY));
      if (Array.isArray(list)) return list.filter((p) => p && p.id);
    } catch { /* bỏ qua dữ liệu hỏng */ }
    return [];
  }

  function write(list) {
    store.set(LIBRARY_KEY, JSON.stringify(list));
  }

  // Chuyển dự án từ phiên bản cũ sang thư viện mới (chỉ một lần).
  const legacy = store.get(LEGACY_KEY);
  if (legacy) {
    try {
      const old = JSON.parse(legacy);
      if (old && typeof old === 'object' && read().length === 0) {
        const project = createProject({ ...old, id: old.id || newId(), updatedAt: Date.now() });
        write([project]);
        store.set(CURRENT_KEY, project.id);
      }
    } catch { /* bỏ qua */ }
    store.remove(LEGACY_KEY);
  }

  return {
    list() {
      return read().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },
    get(id) {
      const found = read().find((p) => p.id === id);
      return found ? createProject(found) : null;
    },
    save(project) {
      project.updatedAt = Date.now();
      const list = read();
      const i = list.findIndex((p) => p.id === project.id);
      if (i >= 0) list[i] = project;
      else list.unshift(project);
      write(list);
      return project;
    },
    remove(id) {
      write(read().filter((p) => p.id !== id));
      if (store.get(CURRENT_KEY) === id) store.remove(CURRENT_KEY);
    },
    duplicate(id) {
      const source = this.get(id);
      if (!source) return null;
      const copy = createProject({
        ...JSON.parse(JSON.stringify(source)),
        id: newId(),
        title: `${source.title || 'Video không tên'} (bản sao)`,
      });
      return this.save(copy);
    },
    currentId() {
      return store.get(CURRENT_KEY);
    },
    setCurrent(id) {
      store.set(CURRENT_KEY, id);
    },
    // Mở dự án đang làm dở, hoặc tạo dự án mới nếu chưa có.
    openCurrent() {
      return this.get(this.currentId()) || this.list().map((p) => createProject(p))[0] || createProject();
    },
  };
}
