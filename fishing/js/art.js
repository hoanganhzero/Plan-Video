// Hình minh hoạ cá dạng vector (SVG) kiểu thẻ game hoạt hình: viền đậm, đổ bóng mềm, mắt to.
// Mỗi loài có dáng (shape), màu thân (top/belly), vây (fin) và hoa văn (pattern) riêng.
import { fishById, rarityOf, rarityIndex } from './data.js';

// shape: classic | round | long | eel | flat | sword | lantern | puffer | koi | dragon | angel | shark | ray | betta
// pattern: none | stripes | spots | scales | bands | glow | rainbow | whiskers | tiger | clown | lines | dots | crown
export const LOOK = {
  ro: { shape: 'classic', top: '#6b7f3a', belly: '#d8d48a', fin: '#4e5e27', pattern: 'stripes' },
  diec: { shape: 'round', top: '#9aa3a8', belly: '#eef1e6', fin: '#7c8a90', pattern: 'scales' },
  tre: { shape: 'long', top: '#4b4038', belly: '#a9967f', fin: '#2f2722', pattern: 'whiskers' },
  chep: { shape: 'koi', top: '#b8892f', belly: '#f2d48a', fin: '#8f6420', pattern: 'scales' },
  loc: { shape: 'long', top: '#3d4a3a', belly: '#c9c7a6', fin: '#2a3228', pattern: 'spots' },
  chep_do: { shape: 'koi', top: '#e8402a', belly: '#ffd2b8', fin: '#ff8a5c', pattern: 'scales' },
  me: { shape: 'classic', top: '#8a96a0', belly: '#f1f4f6', fin: '#6d7a85', pattern: 'scales' },
  tram: { shape: 'long', top: '#6e7d4f', belly: '#e3e0bd', fin: '#525e39', pattern: 'scales' },
  basa: { shape: 'long', top: '#7d8fa3', belly: '#f4f6f8', fin: '#5d6f82', pattern: 'whiskers' },
  lang: { shape: 'long', top: '#7a6a8c', belly: '#ece6f1', fin: '#5a4c6b', pattern: 'whiskers' },
  bong: { shape: 'round', top: '#8c6b3e', belly: '#e8d3a8', fin: '#6b4e28', pattern: 'spots' },
  chien: { shape: 'long', top: '#4a5a6e', belly: '#d9dfe6', fin: '#33404f', pattern: 'spots' },
  anh_vu: { shape: 'classic', top: '#c9a24a', belly: '#fff0c2', fin: '#e6c56a', pattern: 'scales' },
  suoi: { shape: 'classic', top: '#5e8a7a', belly: '#e6f2ea', fin: '#3f6b5c', pattern: 'spots' },
  hoi_van: { shape: 'classic', top: '#5f8f9e', belly: '#ffd6cc', fin: '#467584', pattern: 'spots' },
  tam: { shape: 'sword', top: '#5b6670', belly: '#dfe4e8', fin: '#3e4952', pattern: 'bands' },
  chinh: { shape: 'eel', top: '#6a5a2e', belly: '#e8dca2', fin: '#4a3e1e', pattern: 'spots' },
  hoi_vang: { shape: 'classic', top: '#f2b81c', belly: '#fff3c4', fin: '#ff9f1c', pattern: 'scales' },
  chep_rong: { shape: 'dragon', top: '#e2322c', belly: '#ffd27a', fin: '#ffb21e', pattern: 'scales' },
  com: { shape: 'long', top: '#7fa6c4', belly: '#f2f8fc', fin: '#5c86a6', pattern: 'stripes' },
  nuc: { shape: 'classic', top: '#4f7ea8', belly: '#eef4f9', fin: '#e3c43a', pattern: 'stripes' },
  thu: { shape: 'long', top: '#2f5f8f', belly: '#e9f0f6', fin: '#1f4570', pattern: 'bands' },
  mu: { shape: 'round', top: '#8a5a3a', belly: '#f0d6b6', fin: '#6b3f24', pattern: 'spots' },
  ngu: { shape: 'classic', top: '#1f3f78', belly: '#e6eef8', fin: '#f2c230', pattern: 'none' },
  co_xanh: { shape: 'sword', top: '#1d4fa3', belly: '#e3edfa', fin: '#2a74d6', pattern: 'bands' },
  bay_sac: { shape: 'classic', top: '#8b5cf6', belly: '#fde4ff', fin: '#22d3ee', pattern: 'rainbow' },
  den_long: { shape: 'lantern', top: '#3b2f4f', belly: '#7a6a94', fin: '#2a2140', pattern: 'glow' },
  riu_bac: { shape: 'flat', top: '#a7b4c2', belly: '#f4f7fa', fin: '#8597aa', pattern: 'glow' },
  mat_trang: { shape: 'flat', top: '#9aa4b8', belly: '#eef0f6', fin: '#7a859c', pattern: 'spots' },
  mai_cheo: { shape: 'eel', top: '#d9dde6', belly: '#ffffff', fin: '#ff4d6d', pattern: 'bands' },
  vay_tay: { shape: 'classic', top: '#2c4a7a', belly: '#9fb6d9', fin: '#24406b', pattern: 'spots' },
  rong_thieng: { shape: 'dragon', top: '#16a34a', belly: '#fde68a', fin: '#facc15', pattern: 'glow' },
  sac_ran: { shape: 'classic', top: '#6d7f5a', belly: '#e8e3b8', fin: '#8c7a3e', pattern: 'lines' },
  bong_cat: { shape: 'long', top: '#b59d74', belly: '#f1e6cc', fin: '#8a7350', pattern: 'spots' },
  ro_phi: { shape: 'round', top: '#7a8a7a', belly: '#e4e7da', fin: '#5f6e5c', pattern: 'bands' },
  keo: { shape: 'long', top: '#8a7a5a', belly: '#ddd2b4', fin: '#5e5238', pattern: 'spots' },
  bay_mau: { shape: 'betta', top: '#22d3ee', belly: '#fef08a', fin: '#ec4899', pattern: 'dots' },
  chach: { shape: 'eel', top: '#6b5a3a', belly: '#cdbf98', fin: '#4a3e28', pattern: 'spots' },
  xiem: { shape: 'betta', top: '#3b4cca', belly: '#a5b4fc', fin: '#e11d48', pattern: 'none' },
  luon: { shape: 'eel', top: '#7a5a2a', belly: '#e0c070', fin: '#4a3818', pattern: 'none' },
  tai_tuong: { shape: 'round', top: '#8a8f7a', belly: '#e8e2cf', fin: '#6a6e5e', pattern: 'scales' },
  vang: { shape: 'betta', top: '#f97316', belly: '#fde68a', fin: '#fb923c', pattern: 'scales' },
  tram_den: { shape: 'long', top: '#2a2f35', belly: '#9aa3a8', fin: '#1c2024', pattern: 'scales' },
  koi_ngu_sac: { shape: 'koi', top: '#f8fafc', belly: '#ffffff', fin: '#ef4444', pattern: 'spots' },
  huyet_long: { shape: 'long', top: '#c2410c', belly: '#fed7aa', fin: '#ef4444', pattern: 'scales' },
  he_vang: { shape: 'classic', top: '#c9a24a', belly: '#fff3c4', fin: '#e05d2a', pattern: 'scales' },
  linh: { shape: 'classic', top: '#b8c4cc', belly: '#f5f7f8', fin: '#94a3ad', pattern: 'scales' },
  chot: { shape: 'long', top: '#a89a7a', belly: '#efe6cf', fin: '#7c6e50', pattern: 'whiskers' },
  me_vinh: { shape: 'round', top: '#a3acb3', belly: '#f2f4f5', fin: '#e11d48', pattern: 'scales' },
  tra: { shape: 'long', top: '#6f7f8f', belly: '#eef2f5', fin: '#4c5a68', pattern: 'whiskers' },
  that_lat: { shape: 'long', top: '#8d8f86', belly: '#e9eadf', fin: '#6b6d64', pattern: 'spots' },
  chay_mat_do: { shape: 'long', top: '#7f8f7f', belly: '#f0f3ec', fin: '#c2410c', pattern: 'scales' },
  et_moi: { shape: 'classic', top: '#2b2b2b', belly: '#4b4b4b', fin: '#111111', pattern: 'none' },
  leo: { shape: 'long', top: '#545c66', belly: '#e2e5e8', fin: '#3a4048', pattern: 'whiskers' },
  lang_do: { shape: 'long', top: '#6b7280', belly: '#f1f5f9', fin: '#dc2626', pattern: 'whiskers' },
  chay: { shape: 'classic', top: '#9fb3c3', belly: '#f5f8fa', fin: '#6b8296', pattern: 'scales' },
  ho: { shape: 'classic', top: '#5d6b5a', belly: '#e6e9de', fin: '#3f4a3d', pattern: 'scales' },
  su_vang: { shape: 'classic', top: '#d4a24a', belly: '#fff2cc', fin: '#b07a20', pattern: 'scales' },
  kim_long: { shape: 'long', top: '#eab308', belly: '#fef9c3', fin: '#f59e0b', pattern: 'scales' },
  bong_suoi: { shape: 'classic', top: '#6a7a5a', belly: '#e8eadb', fin: '#4c5a40', pattern: 'scales' },
  chat: { shape: 'classic', top: '#8a9a8a', belly: '#eef2ee', fin: '#6a7a6a', pattern: 'spots' },
  mang_ho: { shape: 'long', top: '#7a8f9a', belly: '#eef4f7', fin: '#59707c', pattern: 'none' },
  chach_suoi: { shape: 'eel', top: '#8a6a4a', belly: '#e8d4b8', fin: '#5e4630', pattern: 'tiger' },
  hoi_dtd: { shape: 'classic', top: '#7a8a9a', belly: '#ffd5c2', fin: '#5a6a7a', pattern: 'spots' },
  vuoc_ho: { shape: 'classic', top: '#5b6b3b', belly: '#e6e6c2', fin: '#3e4a26', pattern: 'bands' },
  chep_guong: { shape: 'koi', top: '#b8892f', belly: '#f6e3b0', fin: '#8f6420', pattern: 'none' },
  cho_bac: { shape: 'long', top: '#4a6b3a', belly: '#e5ecd5', fin: '#2e4724', pattern: 'spots' },
  tram_vang: { shape: 'long', top: '#b88a2a', belly: '#fbe7b0', fin: '#8a6418', pattern: 'scales' },
  koi_tancho: { shape: 'koi', top: '#fafafa', belly: '#ffffff', fin: '#ef4444', pattern: 'crown' },
  hoi_chinook: { shape: 'classic', top: '#4a6a8a', belly: '#ffe0d0', fin: '#7a4a5a', pattern: 'spots' },
  tam_trang: { shape: 'sword', top: '#8a96a0', belly: '#f0f3f5', fin: '#646f78', pattern: 'bands' },
  hoi_cau_vong: { shape: 'classic', top: '#6a8a5a', belly: '#ffd6e0', fin: '#e05a8a', pattern: 'rainbow' },
  rong_bach_kim: { shape: 'long', top: '#e5e7eb', belly: '#ffffff', fin: '#94a3b8', pattern: 'glow' },
  ky_lan_bang: { shape: 'dragon', top: '#67e8f9', belly: '#e0f2fe', fin: '#a5f3fc', pattern: 'glow' },
  trich: { shape: 'long', top: '#5a87b5', belly: '#eef4fa', fin: '#3d6a96', pattern: 'none' },
  bac_ma: { shape: 'classic', top: '#5c7fa8', belly: '#f0f4f8', fin: '#3e5f86', pattern: 'dots' },
  doi: { shape: 'long', top: '#7a8a9a', belly: '#f4f6f8', fin: '#5a6a7a', pattern: 'lines' },
  thia_xanh: { shape: 'classic', top: '#2563eb', belly: '#93c5fd', fin: '#1d4ed8', pattern: 'none' },
  he_bien: { shape: 'round', top: '#f97316', belly: '#fed7aa', fin: '#111827', pattern: 'clown' },
  bo_hom: { shape: 'puffer', top: '#facc15', belly: '#fef3c7', fin: '#1f2937', pattern: 'dots' },
  noc: { shape: 'puffer', top: '#c2a46a', belly: '#fff7e0', fin: '#8a6e3a', pattern: 'spots' },
  than_tien: { shape: 'angel', top: '#1e3a8a', belly: '#fde047', fin: '#facc15', pattern: 'lines' },
  hong: { shape: 'classic', top: '#dc2626', belly: '#fecaca', fin: '#b91c1c', pattern: 'scales' },
  buom: { shape: 'angel', top: '#fde047', belly: '#fff7cc', fin: '#111827', pattern: 'tiger' },
  duoi_dien: { shape: 'ray', top: '#8a7a6a', belly: '#e8e0d4', fin: '#5e5040', pattern: 'spots' },
  map_vay_trang: { shape: 'shark', top: '#64748b', belly: '#f1f5f9', fin: '#e2e8f0', pattern: 'none' },
  kiem: { shape: 'sword', top: '#1f2937', belly: '#cbd5e1', fin: '#374151', pattern: 'none' },
  map_voi: { shape: 'shark', top: '#1e3a5f', belly: '#e2e8f0', fin: '#25476f', pattern: 'dots' },
  manta: { shape: 'ray', top: '#111827', belly: '#f8fafc', fin: '#1f2937', pattern: 'none' },
  phuong_bien: { shape: 'betta', top: '#f97316', belly: '#fde68a', fin: '#ef4444', pattern: 'rainbow' },
  ran_sau: { shape: 'eel', top: '#1e293b', belly: '#475569', fin: '#0f172a', pattern: 'glow' },
  rang_nanh: { shape: 'round', top: '#3f2a2a', belly: '#6b4a4a', fin: '#2a1a1a', pattern: 'none' },
  den_pin: { shape: 'classic', top: '#111827', belly: '#374151', fin: '#a3e635', pattern: 'glow' },
  mat_ong: { shape: 'classic', top: '#64748b', belly: '#cbd5e1', fin: '#22d3ee', pattern: 'glow' },
  mieng_tui: { shape: 'eel', top: '#111827', belly: '#374151', fin: '#1f2937', pattern: 'none' },
  bon_sau: { shape: 'ray', top: '#6b5b4b', belly: '#d6c8b4', fin: '#4a3e30', pattern: 'spots' },
  giot_nuoc: { shape: 'puffer', top: '#f9a8d4', belly: '#fce7f3', fin: '#f472b6', pattern: 'none' },
  map_sang: { shape: 'shark', top: '#1e1b4b', belly: '#4c1d95', fin: '#22d3ee', pattern: 'glow' },
  rong_den: { shape: 'eel', top: '#0f172a', belly: '#1e293b', fin: '#38bdf8', pattern: 'glow' },
  vay_chan: { shape: 'round', top: '#9f1239', belly: '#fecdd3', fin: '#be123c', pattern: 'spots' },
  yeu_tinh: { shape: 'shark', top: '#f0abfc', belly: '#fdf4ff', fin: '#e879f9', pattern: 'none' },
  ma_bien: { shape: 'shark', top: '#94a3b8', belly: '#e2e8f0', fin: '#64748b', pattern: 'lines' },
  bang_pha_le: { shape: 'angel', top: '#a5f3fc', belly: '#ecfeff', fin: '#67e8f9', pattern: 'glow' },
  megalodon: { shape: 'shark', top: '#334155', belly: '#e2e8f0', fin: '#475569', pattern: 'none' },
  long_vuong: { shape: 'dragon', top: '#1d4ed8', belly: '#bfdbfe', fin: '#fde047', pattern: 'glow' },
  thoi_loi: { shape: 'long', top: '#7a6a4a', belly: '#d8cfae', fin: '#3f6a8a', pattern: 'dots' },
  bong_sao: { shape: 'long', top: '#6b5b3b', belly: '#e2d6b2', fin: '#2563eb', pattern: 'dots' },
  doi_muc: { shape: 'long', top: '#8a96a0', belly: '#f1f4f6', fin: '#6b7781', pattern: 'lines' },
  dia: { shape: 'classic', top: '#7c7f5a', belly: '#e8e6cc', fin: '#5a5d3e', pattern: 'spots' },
  cang: { shape: 'classic', top: '#b8b8a8', belly: '#f4f4ec', fin: '#3f3f3f', pattern: 'lines' },
  chem: { shape: 'long', top: '#8a9aa8', belly: '#eef2f5', fin: '#5d6e7c', pattern: 'scales' },
  nau: { shape: 'round', top: '#6b8f5a', belly: '#e5ecd8', fin: '#2f3f28', pattern: 'spots' },
  kim: { shape: 'sword', top: '#7aa0b8', belly: '#f0f6fa', fin: '#4a7088', pattern: 'none' },
  ngat: { shape: 'eel', top: '#3f3f46', belly: '#a1a1aa', fin: '#27272a', pattern: 'whiskers' },
  cung_thu: { shape: 'classic', top: '#d6d3c4', belly: '#fafaf5', fin: '#1f2937', pattern: 'tiger' },
  mu_bun: { shape: 'round', top: '#6b5a3a', belly: '#e0d0a8', fin: '#3e3220', pattern: 'spots' },
  chinh_bong: { shape: 'eel', top: '#5a4a2a', belly: '#d6c48a', fin: '#2f2614', pattern: 'spots' },
  bon_cat: { shape: 'ray', top: '#a8936b', belly: '#ece0c2', fin: '#6e5a38', pattern: 'spots' },
  rong_duoc: { shape: 'long', top: '#4d7c0f', belly: '#d9f99d', fin: '#a16207', pattern: 'scales' },
  than_duoc: { shape: 'dragon', top: '#3f6212', belly: '#ecfccb', fin: '#a3e635', pattern: 'glow' },
  bang_chai: { shape: 'classic', top: '#22c55e', belly: '#bbf7d0', fin: '#3b82f6', pattern: 'lines' },
  thia_duoi_vang: { shape: 'classic', top: '#1d4ed8', belly: '#bfdbfe', fin: '#facc15', pattern: 'none' },
  duoi_gai: { shape: 'round', top: '#2563eb', belly: '#93c5fd', fin: '#facc15', pattern: 'none' },
  mo: { shape: 'classic', top: '#14b8a6', belly: '#99f6e4', fin: '#ec4899', pattern: 'scales' },
  mao_tien: { shape: 'betta', top: '#b91c1c', belly: '#fecaca', fin: '#fef2f2', pattern: 'tiger' },
  bo_giay: { shape: 'round', top: '#1f2937', belly: '#fde68a', fin: '#f59e0b', pattern: 'dots' },
  lich_bien: { shape: 'eel', top: '#65a30d', belly: '#d9f99d', fin: '#3f6212', pattern: 'spots' },
  hoang_de: { shape: 'angel', top: '#1e3a8a', belly: '#fde68a', fin: '#facc15', pattern: 'lines' },
  mu_cham: { shape: 'round', top: '#dc2626', belly: '#fecaca', fin: '#2563eb', pattern: 'dots' },
  map_ran: { shape: 'shark', top: '#6b7280', belly: '#f3f4f6', fin: '#111827', pattern: 'none' },
  napoleon: { shape: 'round', top: '#0e7490', belly: '#a5f3fc', fin: '#155e75', pattern: 'lines' },
  o_sao: { shape: 'ray', top: '#1e293b', belly: '#f8fafc', fin: '#f8fafc', pattern: 'dots' },
  hai_long: { shape: 'eel', top: '#ca8a04', belly: '#fef08a', fin: '#65a30d', pattern: 'spots' },
  than_tien_vang: { shape: 'angel', top: '#fbbf24', belly: '#fef3c7', fin: '#f59e0b', pattern: 'glow' },
  ngoc_san_ho: { shape: 'betta', top: '#f472b6', belly: '#fce7f3', fin: '#22d3ee', pattern: 'rainbow' },
  tuyet: { shape: 'classic', top: '#8b7d6b', belly: '#f1ede6', fin: '#6b5d4b', pattern: 'spots' },
  trich_bac: { shape: 'long', top: '#4b6b8b', belly: '#e6eef6', fin: '#2f4b6b', pattern: 'none' },
  bang_trong: { shape: 'long', top: '#cbd5e1', belly: '#f8fafc', fin: '#94a3b8', pattern: 'none' },
  hoi_bac: { shape: 'classic', top: '#475569', belly: '#fca5a5', fin: '#f97316', pattern: 'dots' },
  bon_green: { shape: 'ray', top: '#57534e', belly: '#e7e5e4', fin: '#44403c', pattern: 'none' },
  soi: { shape: 'long', top: '#64748b', belly: '#cbd5e1', fin: '#334155', pattern: 'tiger' },
  vay_chi: { shape: 'classic', top: '#94a3b8', belly: '#f1f5f9', fin: '#64748b', pattern: 'lines' },
  mu_lan: { shape: 'round', top: '#78716c', belly: '#e7e5e4', fin: '#ea580c', pattern: 'spots' },
  map_green: { shape: 'shark', top: '#44403c', belly: '#a8a29e', fin: '#292524', pattern: 'none' },
  rang_soi: { shape: 'eel', top: '#e2e8f0', belly: '#ffffff', fin: '#7dd3fc', pattern: 'glow' },
  tuyet_den: { shape: 'classic', top: '#1f2937', belly: '#6b7280', fin: '#111827', pattern: 'none' },
  cuc_quang: { shape: 'betta', top: '#22d3ee', belly: '#ccfbf1', fin: '#a78bfa', pattern: 'rainbow' },
  kiem_bang: { shape: 'sword', top: '#bae6fd', belly: '#f0f9ff', fin: '#38bdf8', pattern: 'glow' },
  map_tuyet: { shape: 'shark', top: '#e2e8f0', belly: '#ffffff', fin: '#93c5fd', pattern: 'none' },
  bang_long: { shape: 'dragon', top: '#7dd3fc', belly: '#f0f9ff', fin: '#e0f2fe', pattern: 'glow' },
  than_hong: { shape: 'classic', top: '#451a03', belly: '#fdba74', fin: '#ea580c', pattern: 'glow' },
  da_bazan: { shape: 'round', top: '#292524', belly: '#57534e', fin: '#f97316', pattern: 'dots' },
  luu_huynh: { shape: 'long', top: '#ca8a04', belly: '#fef08a', fin: '#854d0e', pattern: 'lines' },
  tro_bay: { shape: 'classic', top: '#52525b', belly: '#a1a1aa', fin: '#f97316', pattern: 'spots' },
  vay_lua: { shape: 'classic', top: '#dc2626', belly: '#fed7aa', fin: '#f59e0b', pattern: 'scales' },
  nham_thach: { shape: 'round', top: '#7c2d12', belly: '#fb923c', fin: '#fde047', pattern: 'tiger' },
  luon_lua: { shape: 'eel', top: '#1c1917', belly: '#ea580c', fin: '#fbbf24', pattern: 'glow' },
  suoi_nong: { shape: 'betta', top: '#f472b6', belly: '#fde68a', fin: '#fb7185', pattern: 'none' },
  map_nui_lua: { shape: 'shark', top: '#292524', belly: '#f97316', fin: '#ef4444', pattern: 'glow' },
  duoi_lua: { shape: 'ray', top: '#9a3412', belly: '#fdba74', fin: '#fbbf24', pattern: 'spots' },
  hoa_ky_lan: { shape: 'koi', top: '#ef4444', belly: '#fde68a', fin: '#f59e0b', pattern: 'scales' },
  phuong_lua: { shape: 'betta', top: '#ea580c', belly: '#fef08a', fin: '#dc2626', pattern: 'rainbow' },
  kim_cuong_do: { shape: 'angel', top: '#be123c', belly: '#ffe4e6', fin: '#fb7185', pattern: 'glow' },
  hoa_long: { shape: 'dragon', top: '#b91c1c', belly: '#fdba74', fin: '#f59e0b', pattern: 'glow' },
  than_hoa: { shape: 'dragon', top: '#f97316', belly: '#fff7ed', fin: '#fde047', pattern: 'rainbow' },
};

// Đường viền thân theo dáng (khung 200×120, đầu quay sang phải).
const BODY = {
  classic: 'M30 60 C45 25 110 18 150 34 C172 43 186 52 188 60 C186 68 172 77 150 86 C110 102 45 95 30 60 Z',
  round: 'M40 60 C48 18 128 12 160 38 C176 50 182 56 182 60 C182 64 176 70 160 82 C128 108 48 102 40 60 Z',
  long: 'M22 60 C40 38 100 32 158 40 C176 44 188 54 190 60 C188 66 176 76 158 80 C100 88 40 82 22 60 Z',
  koi: 'M28 60 C42 22 112 14 152 32 C174 42 186 53 188 60 C186 67 174 78 152 88 C112 106 42 98 28 60 Z',
  eel: 'M14 64 C40 48 70 70 100 56 C130 42 160 46 186 56 C190 60 188 66 184 68 C160 72 132 66 104 78 C74 92 40 74 14 64 Z',
  flat: 'M50 60 C50 14 150 10 170 40 C178 52 180 58 180 60 C180 62 178 68 170 80 C150 110 50 106 50 60 Z',
  sword: 'M26 60 C44 34 104 28 150 40 C168 46 176 54 178 58 L198 60 L178 62 C176 66 168 74 150 80 C104 92 44 86 26 60 Z',
  lantern: 'M44 62 C44 22 132 14 166 44 C178 54 182 60 180 66 C176 76 160 90 130 96 C86 104 44 96 44 62 Z',
  puffer: 'M44 60 C44 16 156 16 170 50 C174 58 174 62 170 70 C156 104 44 104 44 60 Z',
  dragon: 'M24 62 C40 26 112 16 154 32 C176 41 190 54 192 62 C190 70 176 80 154 88 C112 104 40 98 24 62 Z',
  angel: 'M56 60 C66 30 118 24 156 40 C172 48 182 56 182 60 C182 64 172 72 156 80 C118 96 66 90 56 60 Z',
  shark: 'M22 62 C48 40 118 30 160 42 C180 48 196 56 198 62 C192 68 178 74 158 78 C114 88 50 84 22 62 Z',
  ray: 'M100 18 C140 30 182 50 192 60 C182 70 140 90 100 102 C60 90 20 70 12 60 C20 50 60 30 100 18 Z',
  betta: 'M52 60 C60 36 112 30 148 40 C166 46 178 54 180 60 C178 66 166 74 148 80 C112 90 60 84 52 60 Z',
};
// Đuôi theo dáng (đuôi quạt to cho cá xiêm / cá vàng, đuôi lưỡi liềm cho cá mập, roi cho cá đuối).
function tailPath(shape) {
  if (shape === 'flat') return 'M54 40 C34 46 34 74 54 80 C46 70 46 50 54 40 Z';
  if (shape === 'betta') return 'M58 60 C30 6 -2 4 -8 30 C0 48 -2 72 -8 92 C-2 116 30 114 58 60 Z';
  if (shape === 'shark' || shape === 'sword') return 'M34 62 C24 44 12 22 4 14 C14 36 16 50 18 62 C16 72 12 86 8 100 C18 92 26 78 34 62 Z';
  if (shape === 'ray') return 'M16 60 C6 61 -4 63 -12 66 C-4 62 6 59 16 58 Z';
  if (shape === 'angel') return 'M60 60 C46 42 36 32 30 34 C34 48 34 72 30 86 C36 88 46 78 60 60 Z';
  const x = shape === 'eel' ? 14 : 30;
  return `M${x + 6} 60 C${x - 6} 40 ${x - 20} 26 ${x - 24} 30 C${x - 16} 46 ${x - 16} 74 ${x - 24} 90 C${x - 20} 94 ${x - 6} 80 ${x + 6} 60 Z`;
}

const esc = (s) => String(s).replace(/[<>&"]/g, '');
// Pha màu: t < 0 tối hơn, t > 0 sáng hơn.
export function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function fishSVG(fishId, { size = 120, uid = fishId } = {}) {
  const fish = fishById(fishId);
  const look = LOOK[fishId] || { shape: 'classic', top: '#6b8fa8', belly: '#eef4f8', fin: '#4d6f88', pattern: 'none' };
  const tier = fish ? rarityIndex(fish.rarity) : 0;
  const id = `f${esc(uid)}`;
  const sh = look.shape;
  const body = BODY[sh] || BODY.classic;
  const outline = shade(look.top, -0.62);
  const finDark = shade(look.fin, -0.35);
  const tail = tailPath(sh);
  const eyeX = { flat: 150, eel: 172, round: 150, puffer: 150, angel: 160, shark: 172, ray: 128, betta: 158 }[sh] || 160;
  const eyeY = sh === 'eel' ? 57 : sh === 'ray' ? 52 : sh === 'shark' ? 54 : 50;
  const eyeR = sh === 'ray' ? 6 : sh === 'shark' ? 6.5 : sh === 'puffer' ? 12 : 10;

  // ---- Hoa văn (cắt theo thân) ----
  let pattern = '';
  if (look.pattern === 'stripes') {
    pattern = [70, 92, 114, 136].map((x) => `<path d="M${x} 30 C${x - 6} 50 ${x - 6} 70 ${x} 90" stroke="${look.fin}" stroke-width="7" opacity=".45" fill="none"/>`).join('');
  } else if (look.pattern === 'bands') {
    pattern = [60, 85, 110, 135].map((x) => `<path d="M${x} 32 L${x + 10} 32 L${x + 4} 88 L${x - 6} 88 Z" fill="${look.fin}" opacity=".35"/>`).join('');
  } else if (look.pattern === 'tiger') {
    pattern = [62, 88, 114, 140].map((x) => `<path d="M${x} 14 C${x - 8} 40 ${x + 8} 70 ${x - 2} 110" stroke="${look.fin}" stroke-width="12" opacity=".8" fill="none"/>`).join('');
  } else if (look.pattern === 'clown') {
    pattern = [74, 118, 158].map((x) => `<path d="M${x} 10 C${x - 8} 40 ${x - 8} 80 ${x} 110" stroke="${look.fin}" stroke-width="15" fill="none"/><path d="M${x} 10 C${x - 8} 40 ${x - 8} 80 ${x} 110" stroke="#fff" stroke-width="10" fill="none"/>`).join('');
  } else if (look.pattern === 'lines') {
    pattern = [44, 56, 68, 80].map((y) => `<path d="M20 ${y} C80 ${y - 4} 140 ${y - 4} 196 ${y}" stroke="${look.fin}" stroke-width="3.5" opacity=".55" fill="none"/>`).join('');
  } else if (look.pattern === 'dots') {
    for (let x = 62; x < 170; x += 15) for (let y = 34 + ((x / 15) % 2) * 7; y < 92; y += 14) pattern += `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" opacity=".85"/>`;
  } else if (look.pattern === 'spots') {
    pattern = [[70, 46, 5], [92, 40, 4], [112, 50, 6], [80, 66, 4], [130, 42, 4], [104, 70, 5], [136, 62, 4], [150, 50, 3], [60, 58, 3]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${look.fin}" opacity=".6"/>`).join('');
  } else if (look.pattern === 'crown') {
    pattern = '<circle cx="150" cy="38" r="13" fill="#ef4444"/>';
  } else if (look.pattern === 'scales') {
    for (let x = 64; x < 156; x += 14) for (let y = 38 + ((x / 14) % 2) * 6; y < 88; y += 12) {
      pattern += `<path d="M${x} ${y} q7 8 14 0" stroke="${shade(look.top, -0.3)}" stroke-width="2" fill="none" opacity=".55"/>`;
    }
  } else if (look.pattern === 'rainbow') {
    pattern = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'].map((c, i) => `<path d="M${46 + i * 24} 24 C${40 + i * 24} 50 ${40 + i * 24} 72 ${46 + i * 24} 96" stroke="${c}" stroke-width="10" opacity=".55" fill="none"/>`).join('');
  } else if (look.pattern === 'glow') {
    pattern = [[70, 50], [96, 64], [122, 48], [146, 66], [84, 76], [110, 82], [58, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#e0fbff"/><circle cx="${x}" cy="${y}" r="9" fill="${look.fin}" opacity=".35"/>`).join('');
  }
  // Đường bên thân + vệt bóng
  const lateral = ['ray', 'puffer'].includes(sh) ? '' : `<path d="M40 60 C80 54 130 54 ${eyeX - 20} 58" stroke="${shade(look.top, -0.25)}" stroke-width="1.6" stroke-dasharray="3 4" fill="none" opacity=".55"/>`;

  // ---- Vây (có tia) ----
  const rays = (d, n = 5) => `<path d="${d}" fill="url(#${id}f)" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>`;
  const tailRays = sh === 'ray' ? '' : Array.from({ length: 6 }, (_, i) => {
    const ty = 18 + i * 17;
    const x0 = sh === 'betta' ? 54 : sh === 'eel' ? 18 : sh === 'flat' ? 52 : 32;
    const x1 = sh === 'betta' ? -2 : sh === 'shark' || sh === 'sword' ? 14 : x0 - 20;
    return `<path d="M${x0} 60 L${x1} ${ty}" stroke="${finDark}" stroke-width="1.3" opacity=".45"/>`;
  }).join('');
  let dorsal;
  if (sh === 'eel') dorsal = `<path d="M40 56 C80 40 130 36 170 48" stroke="${look.fin}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  else if (sh === 'flat') dorsal = rays('M110 16 C122 -2 138 -2 140 20 Z') + rays('M110 104 C122 122 138 122 140 100 Z');
  else if (sh === 'angel') dorsal = rays('M86 34 C96 -20 120 -22 140 34 Z') + rays('M86 86 C96 140 120 142 140 86 Z');
  else if (sh === 'shark') dorsal = rays('M88 40 L108 4 L124 40 Z') + rays('M48 54 L54 44 L62 52 Z');
  else if (sh === 'ray') dorsal = '';
  else if (sh === 'betta') dorsal = rays('M70 40 C76 6 118 0 132 36 Z') + rays('M66 80 C70 120 118 124 128 82 Z');
  else if (sh === 'puffer') dorsal = rays('M80 22 C90 4 112 4 116 24 Z');
  else dorsal = rays('M70 32 C84 4 124 2 140 30 Z');
  const finRaysDorsal = ['eel', 'ray', 'shark'].includes(sh) ? '' : [84, 96, 108, 120].map((x) => `<path d="M${x} 34 L${x + 4} ${sh === 'angel' ? -6 : 10}" stroke="${finDark}" stroke-width="1.2" opacity=".4"/>`).join('');
  const pectoral = ['ray', 'eel'].includes(sh) ? '' : `<path d="M${eyeX - 44} 66 C${eyeX - 36} 84 ${eyeX - 20} 86 ${eyeX - 16} 76 Z" fill="url(#${id}f)" stroke="${outline}" stroke-width="2.6" stroke-linejoin="round"/>`;

  // ---- Đặc điểm riêng ----
  const whiskers = look.pattern === 'whiskers' || sh === 'koi' || sh === 'dragon'
    ? `<path d="M182 64 C196 70 200 82 194 90 M180 66 C188 76 186 88 178 94" stroke="${outline}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : '';
  const lure = sh === 'lantern'
    ? `<path d="M150 36 C152 10 176 4 184 16" stroke="${outline}" stroke-width="3" fill="none"/><circle cx="185" cy="18" r="9" fill="#fde047"/><circle cx="185" cy="18" r="18" fill="#fde047" opacity=".3"/>
       <path d="M160 74 l6 8 l5 -8 l6 8 l5 -8" stroke="#fff" stroke-width="2.5" fill="none"/>` : '';
  const crown = sh === 'dragon'
    ? `<path d="M120 26 L128 4 L136 24 L146 8 L150 30" fill="${look.fin}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>` : '';
  const spikes = sh === 'puffer'
    ? [[60, 30], [80, 20], [140, 24], [160, 40], [58, 90], [80, 100], [110, 102], [140, 96], [160, 82], [48, 60]].map(([x, y]) => `<path d="M${x} ${y} l${(x - 108) * 0.12} ${(y - 60) * 0.18}" stroke="${outline}" stroke-width="2.4" stroke-linecap="round"/>`).join('') : '';
  const gills = sh === 'shark' ? [146, 152, 158].map((x) => `<path d="M${x} 52 C${x - 3} 60 ${x - 3} 66 ${x} 72" stroke="${outline}" stroke-width="2" fill="none" opacity=".6"/>`).join('')
    : ['ray', 'eel'].includes(sh) ? '' : `<path d="M${eyeX - 22} 38 C${eyeX - 13} 54 ${eyeX - 13} 70 ${eyeX - 22} 84" stroke="${outline}" stroke-width="2.4" fill="none" opacity=".5"/>`;
  const mouth = sh === 'ray' ? '' : sh === 'shark' ? `<path d="M176 68 C184 70 190 68 194 64" stroke="${outline}" stroke-width="2" fill="none"/>`
    : `<path d="M${sh === 'eel' ? 184 : 182} ${eyeY + 13} q6 1 7 -4" stroke="${outline}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const rayWings = sh === 'ray' ? `<path d="M100 30 C110 50 110 70 100 90" stroke="${shade(look.top, -0.3)}" stroke-width="2" fill="none" opacity=".4"/><circle cx="${eyeX}" cy="68" r="${eyeR}" fill="#fff" stroke="${outline}" stroke-width="2.4"/><circle cx="${eyeX + 1}" cy="68" r="${eyeR * 0.55}" fill="${outline}"/>` : '';

  const glowFx = tier >= 4 ? `<ellipse cx="105" cy="60" rx="100" ry="56" fill="url(#${id}g)"/>` : '';
  const sparkle = tier >= 3 ? [[24, 18], [186, 22], [176, 104], [30, 100]].slice(0, tier - 1).map(([x, y]) => `<path d="M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z" fill="#fff" opacity=".9"/>`).join('') : '';
  const iris = tier >= 4 ? '#fbbf24' : shade(look.fin, 0.25);

  return `<svg class="fish-art" viewBox="-14 -26 228 172" width="${size}" height="${Math.round(size * 0.75)}" role="img" aria-label="${esc(fish?.name || '')}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(look.top, -0.22)}"/><stop offset=".38" stop-color="${look.top}"/><stop offset=".62" stop-color="${shade(look.top, 0.15)}"/><stop offset="1" stop-color="${look.belly}"/>
    </linearGradient>
    <linearGradient id="${id}f" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(look.fin, 0.15)}" stop-opacity=".95"/><stop offset="1" stop-color="${look.fin}" stop-opacity=".7"/>
    </linearGradient>
    <radialGradient id="${id}h" cx=".65" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}g"><stop offset=".45" stop-color="${rarityOf(fish?.rarity || 'common').color}" stop-opacity=".5"/><stop offset="1" stop-color="${rarityOf(fish?.rarity || 'common').color}" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}c"><path d="${body}"/></clipPath>
  </defs>
  ${glowFx}
  <ellipse cx="108" cy="${sh === 'angel' ? 134 : 120}" rx="72" ry="7" fill="#000" opacity=".18"/>
  <path d="${tail}" fill="url(#${id}f)" stroke="${outline}" stroke-width="3.2" stroke-linejoin="round"/>${tailRays}
  ${dorsal}${finRaysDorsal}${crown}
  <path d="${body}" fill="url(#${id}b)" stroke="${outline}" stroke-width="3.6" stroke-linejoin="round"/>
  <g clip-path="url(#${id}c)">${pattern}${lateral}
    <ellipse cx="118" cy="40" rx="60" ry="22" fill="url(#${id}h)"/>
    <path d="${body}" fill="none" stroke="#000" stroke-width="10" opacity=".08" transform="translate(0 4)"/>
  </g>
  ${pectoral}${gills}${mouth}${spikes}${rayWings}
  ${sh === 'ray' ? '' : `<circle cx="${eyeX}" cy="${eyeY}" r="${eyeR}" fill="#fff" stroke="${outline}" stroke-width="2.8"/>
  <circle cx="${eyeX + 1.5}" cy="${eyeY + 0.5}" r="${eyeR * 0.68}" fill="${iris}"/>
  <circle cx="${eyeX + 2}" cy="${eyeY + 1}" r="${eyeR * 0.42}" fill="#0b0f19"/>
  <circle cx="${eyeX + eyeR * 0.4}" cy="${eyeY - eyeR * 0.3}" r="${eyeR * 0.22}" fill="#fff"/>`}
  ${whiskers}${lure}${sparkle}
</svg>`;
}

export const hasArt = (fishId) => !!LOOK[fishId];
