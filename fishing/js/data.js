import { ALL_SUBJECTS } from './curriculum.js';
// Dữ liệu trò chơi "Câu Cá Học Giỏi": độ hiếm, khu câu, cá, cần câu, mồi, vật phẩm, nhiệm vụ.

// Độ hiếm tăng dần. Cá càng hiếm thì câu hỏi càng khó và giá càng cao.
export const RARITIES = [
  { id: 'common', name: 'Thường', color: '#9ca3af', difficulty: 1, xp: 5 },
  { id: 'uncommon', name: 'Khá', color: '#22c55e', difficulty: 1, xp: 10 },
  { id: 'rare', name: 'Hiếm', color: '#3b82f6', difficulty: 2, xp: 20 },
  { id: 'epic', name: 'Quý', color: '#a855f7', difficulty: 2, xp: 40 },
  { id: 'legendary', name: 'Huyền thoại', color: '#f59e0b', difficulty: 3, xp: 80 },
  { id: 'mythic', name: 'Thần thoại', color: '#ef4444', difficulty: 3, xp: 160 },
];

export const rarityIndex = (id) => RARITIES.findIndex((r) => r.id === id);
export const rarityOf = (id) => RARITIES[rarityIndex(id)];

// weights: tỉ lệ ra từng độ hiếm theo thứ tự RARITIES.
export const ZONES = [
  {
    id: 'pond', name: 'Ao làng', icon: '🏡', level: 1, price: 0,
    weights: [60, 28, 10, 2, 0, 0],
    sky: ['#bfe6ff', '#e9f7ff'], water: ['#4fa3c7', '#1f5f7a'],
    desc: 'Ao nhỏ sau nhà, cá dễ câu – nơi bắt đầu.',
  },
  {
    id: 'river', name: 'Sông quê', icon: '🌾', level: 3, price: 300,
    weights: [40, 32, 18, 8, 2, 0],
    sky: ['#ffd9a8', '#fff1dc'], water: ['#6aa58a', '#2c5e4b'],
    desc: 'Dòng sông hiền hoà, có cá lăng, cá chiên và cá anh vũ quý hiếm.',
  },
  {
    id: 'mangrove', name: 'Rừng ngập mặn', icon: '🌿', level: 4, price: 700,
    weights: [35, 30, 22, 10, 3, 0],
    sky: ['#cfe8c4', '#f1f7e6'], water: ['#6f8f5a', '#2f4a2a'],
    desc: 'Rừng đước ven biển miền Tây – nước lợ, cá thòi lòi nhảy trên bùn, cá cung thủ bắn nước.',
  },
  {
    id: 'lake', name: 'Hồ trên núi', icon: '⛰️', level: 6, price: 1200,
    weights: [25, 30, 25, 14, 5, 1],
    sky: ['#c7d2fe', '#eef2ff'], water: ['#3b82a6', '#16324f'],
    desc: 'Hồ nước lạnh trong vắt – truyền thuyết kể có cá chép hoá rồng.',
  },
  {
    id: 'sea', name: 'Biển xanh', icon: '🌊', level: 10, price: 4000,
    weights: [15, 25, 28, 20, 10, 2],
    sky: ['#7dd3fc', '#e0f2fe'], water: ['#0284c7', '#0c2f55'],
    desc: 'Biển khơi rộng lớn với cá ngừ đại dương và cá cờ xanh.',
  },
  {
    id: 'coral', name: 'Rạn san hô', icon: '🪸', level: 12, price: 7000,
    weights: [10, 22, 28, 24, 13, 3],
    sky: ['#67e8f9', '#ecfeff'], water: ['#2dd4bf', '#0e7490'],
    desc: 'Rạn san hô biển đảo – nước trong vắt, cá mó, cá mao tiên, cá Napoleon rực rỡ sắc màu.',
  },
  {
    id: 'abyss', name: 'Vực sâu huyền bí', icon: '🌌', level: 15, price: 12000,
    weights: [5, 15, 25, 28, 20, 7],
    sky: ['#312e81', '#1e1b4b'], water: ['#1e3a8a', '#020617'],
    desc: 'Đáy biển tối đen – nơi Cá Rồng Thiêng ẩn mình.',
  },
  {
    id: 'ice', name: 'Biển băng', icon: '🧊', level: 18, price: 20000,
    weights: [4, 12, 24, 30, 22, 8],
    sky: ['#dbeafe', '#f8fafc'], water: ['#7dd3fc', '#0c4a6e'],
    desc: 'Biển băng phương Bắc – tảng băng trôi, cực quang, và Băng Long Vương ngủ dưới lớp băng.',
  },
  {
    id: 'volcano', name: 'Hồ dung nham', icon: '🌋', level: 22, price: 35000,
    weights: [2, 10, 22, 32, 24, 10],
    sky: ['#7c2d12', '#fdba74'], water: ['#ea580c', '#450a0a'],
    desc: 'Hồ nước nóng dưới chân núi lửa – chỉ cần thủ giỏi nhất mới câu được Thần Hoả Long Vương.',
  },
];

export const zoneById = (id) => ZONES.find((z) => z.id === id);

// value: giá gốc (xu). Cân nặng càng lớn giá càng cao (×0,7 → ×1,3).
export const FISH = [
  // Ao làng (19 loài)
  { id: 'ro', name: 'Cá rô đồng', emoji: '🐟', zone: 'pond', rarity: 'common', value: 8, kg: [0.1, 0.4] },
  { id: 'sac_ran', name: 'Cá sặc rằn', emoji: '🐟', zone: 'pond', rarity: 'common', value: 9, kg: [0.05, 0.3] },
  { id: 'bong_cat', name: 'Cá bống cát', emoji: '🐟', zone: 'pond', rarity: 'common', value: 9, kg: [0.03, 0.15] },
  { id: 'chach', name: 'Cá chạch bùn', emoji: '🐍', zone: 'pond', rarity: 'common', value: 9, kg: [0.03, 0.2] },
  { id: 'diec', name: 'Cá diếc', emoji: '🐟', zone: 'pond', rarity: 'common', value: 10, kg: [0.1, 0.5] },
  { id: 'keo', name: 'Cá kèo', emoji: '🐟', zone: 'pond', rarity: 'common', value: 10, kg: [0.02, 0.1] },
  { id: 'bay_mau', name: 'Cá bảy màu', emoji: '🐠', zone: 'pond', rarity: 'common', value: 11, kg: [0.01, 0.05] },
  { id: 'ro_phi', name: 'Cá rô phi', emoji: '🐟', zone: 'pond', rarity: 'common', value: 12, kg: [0.2, 1] },
  { id: 'tre', name: 'Cá trê', emoji: '🐟', zone: 'pond', rarity: 'uncommon', value: 25, kg: [0.3, 1.5] },
  { id: 'luon', name: 'Lươn đồng', emoji: '🐍', zone: 'pond', rarity: 'uncommon', value: 28, kg: [0.1, 0.6] },
  { id: 'chep', name: 'Cá chép', emoji: '🐠', zone: 'pond', rarity: 'uncommon', value: 30, kg: [0.5, 3] },
  { id: 'vang', name: 'Cá vàng ba đuôi', emoji: '🐠', zone: 'pond', rarity: 'uncommon', value: 30, kg: [0.05, 0.3] },
  { id: 'xiem', name: 'Cá xiêm (cá chọi)', emoji: '🐠', zone: 'pond', rarity: 'uncommon', value: 32, kg: [0.01, 0.06] },
  { id: 'tai_tuong', name: 'Cá tai tượng', emoji: '🐠', zone: 'pond', rarity: 'uncommon', value: 34, kg: [0.5, 3] },
  { id: 'loc', name: 'Cá lóc', emoji: '🐟', zone: 'pond', rarity: 'rare', value: 70, kg: [0.8, 4] },
  { id: 'tram_den', name: 'Cá trắm đen', emoji: '🐟', zone: 'pond', rarity: 'rare', value: 80, kg: [1, 8] },
  { id: 'koi_ngu_sac', name: 'Cá koi ngũ sắc', emoji: '🎏', zone: 'pond', rarity: 'rare', value: 90, kg: [0.5, 3] },
  { id: 'chep_do', name: 'Cá chép đỏ', emoji: '🎏', zone: 'pond', rarity: 'epic', value: 180, kg: [1, 4] },
  { id: 'huyet_long', name: 'Cá rồng huyết long', emoji: '🐉', zone: 'pond', rarity: 'epic', value: 210, kg: [1, 4] },
  // Sông quê (21 loài)
  { id: 'linh', name: 'Cá linh', emoji: '🐟', zone: 'river', rarity: 'common', value: 18, kg: [0.02, 0.1] },
  { id: 'me', name: 'Cá mè', emoji: '🐟', zone: 'river', rarity: 'common', value: 20, kg: [0.5, 3] },
  { id: 'chot', name: 'Cá chốt', emoji: '🐟', zone: 'river', rarity: 'common', value: 20, kg: [0.1, 0.5] },
  { id: 'he_vang', name: 'Cá he vàng', emoji: '🐟', zone: 'river', rarity: 'common', value: 22, kg: [0.2, 1] },
  { id: 'me_vinh', name: 'Cá mè vinh', emoji: '🐟', zone: 'river', rarity: 'common', value: 22, kg: [0.2, 1] },
  { id: 'tram', name: 'Cá trắm cỏ', emoji: '🐟', zone: 'river', rarity: 'common', value: 24, kg: [1, 6] },
  { id: 'tra', name: 'Cá tra', emoji: '🐟', zone: 'river', rarity: 'uncommon', value: 45, kg: [1, 8] },
  { id: 'chay_mat_do', name: 'Cá chày mắt đỏ', emoji: '🐟', zone: 'river', rarity: 'uncommon', value: 48, kg: [0.3, 2] },
  { id: 'basa', name: 'Cá basa', emoji: '🐠', zone: 'river', rarity: 'uncommon', value: 50, kg: [1, 5] },
  { id: 'et_moi', name: 'Cá ét mọi', emoji: '🐟', zone: 'river', rarity: 'uncommon', value: 52, kg: [0.5, 4] },
  { id: 'that_lat', name: 'Cá thát lát', emoji: '🐟', zone: 'river', rarity: 'uncommon', value: 55, kg: [0.3, 2] },
  { id: 'lang', name: 'Cá lăng', emoji: '🐟', zone: 'river', rarity: 'rare', value: 120, kg: [2, 10] },
  { id: 'leo', name: 'Cá leo', emoji: '🐟', zone: 'river', rarity: 'rare', value: 130, kg: [1, 10] },
  { id: 'bong', name: 'Cá bống tượng', emoji: '🐡', zone: 'river', rarity: 'rare', value: 140, kg: [0.5, 2] },
  { id: 'chay', name: 'Cá cháy', emoji: '🐟', zone: 'river', rarity: 'rare', value: 150, kg: [0.5, 3] },
  { id: 'lang_do', name: 'Cá lăng đuôi đỏ', emoji: '🐟', zone: 'river', rarity: 'rare', value: 160, kg: [1, 8] },
  { id: 'chien', name: 'Cá chiên', emoji: '🐠', zone: 'river', rarity: 'epic', value: 350, kg: [2, 12] },
  { id: 'ho', name: 'Cá hô', emoji: '🐟', zone: 'river', rarity: 'epic', value: 420, kg: [10, 80] },
  { id: 'su_vang', name: 'Cá sủ vàng', emoji: '🐠', zone: 'river', rarity: 'epic', value: 480, kg: [5, 40] },
  { id: 'kim_long', name: 'Cá kim long', emoji: '🐉', zone: 'river', rarity: 'legendary', value: 950, kg: [1, 5] },
  { id: 'anh_vu', name: 'Cá anh vũ', emoji: '🐠', zone: 'river', rarity: 'legendary', value: 1000, kg: [1, 5] },
  // Rừng ngập mặn (15 loài)
  { id: 'doi_muc', name: 'Cá đối mục', emoji: '🐟', zone: 'mangrove', rarity: 'common', value: 26, kg: [0.2, 1.5] },
  { id: 'thoi_loi', name: 'Cá thòi lòi', emoji: '🐸', zone: 'mangrove', rarity: 'common', value: 28, kg: [0.02, 0.1] },
  { id: 'bong_sao', name: 'Cá bống sao', emoji: '🐟', zone: 'mangrove', rarity: 'common', value: 30, kg: [0.05, 0.3] },
  { id: 'cang', name: 'Cá căng', emoji: '🐟', zone: 'mangrove', rarity: 'common', value: 30, kg: [0.05, 0.3] },
  { id: 'dia', name: 'Cá dìa', emoji: '🐟', zone: 'mangrove', rarity: 'common', value: 32, kg: [0.1, 0.6] },
  { id: 'kim', name: 'Cá kìm', emoji: '🐟', zone: 'mangrove', rarity: 'uncommon', value: 60, kg: [0.05, 0.2] },
  { id: 'nau', name: 'Cá nâu', emoji: '🐠', zone: 'mangrove', rarity: 'uncommon', value: 65, kg: [0.1, 0.5] },
  { id: 'chem', name: 'Cá chẽm', emoji: '🐟', zone: 'mangrove', rarity: 'uncommon', value: 70, kg: [1, 8] },
  { id: 'ngat', name: 'Cá ngát', emoji: '🐟', zone: 'mangrove', rarity: 'uncommon', value: 75, kg: [0.3, 2] },
  { id: 'cung_thu', name: 'Cá cung thủ', emoji: '🏹', zone: 'mangrove', rarity: 'uncommon', value: 80, kg: [0.05, 0.3] },
  { id: 'mu_bun', name: 'Cá mú bùn', emoji: '🐡', zone: 'mangrove', rarity: 'rare', value: 190, kg: [0.5, 4] },
  { id: 'chinh_bong', name: 'Cá chình bông', emoji: '🐍', zone: 'mangrove', rarity: 'rare', value: 220, kg: [0.5, 5] },
  { id: 'bon_cat', name: 'Cá bơn cát', emoji: '🐟', zone: 'mangrove', rarity: 'epic', value: 450, kg: [0.3, 3] },
  { id: 'rong_duoc', name: 'Cá rồng đước', emoji: '🐉', zone: 'mangrove', rarity: 'epic', value: 520, kg: [1, 5] },
  { id: 'than_duoc', name: 'Cá Thần Rừng Đước', emoji: '🌳', zone: 'mangrove', rarity: 'legendary', value: 1900, kg: [3, 12] },
  // Hồ trên núi (21 loài)
  { id: 'chach_suoi', name: 'Cá chạch suối', emoji: '🐍', zone: 'lake', rarity: 'common', value: 36, kg: [0.05, 0.3] },
  { id: 'chat', name: 'Cá chát', emoji: '🐟', zone: 'lake', rarity: 'common', value: 38, kg: [0.1, 0.6] },
  { id: 'suoi', name: 'Cá suối', emoji: '🐟', zone: 'lake', rarity: 'common', value: 40, kg: [0.2, 1] },
  { id: 'mang_ho', name: 'Cá măng hồ', emoji: '🐟', zone: 'lake', rarity: 'common', value: 42, kg: [0.5, 3] },
  { id: 'bong_suoi', name: 'Cá bỗng', emoji: '🐟', zone: 'lake', rarity: 'common', value: 45, kg: [0.3, 2] },
  { id: 'hoi_van', name: 'Cá hồi vân', emoji: '🐟', zone: 'lake', rarity: 'uncommon', value: 90, kg: [1, 4] },
  { id: 'vuoc_ho', name: 'Cá vược hồ', emoji: '🐟', zone: 'lake', rarity: 'uncommon', value: 95, kg: [0.5, 4] },
  { id: 'chep_guong', name: 'Cá chép gương', emoji: '🐠', zone: 'lake', rarity: 'uncommon', value: 100, kg: [1, 10] },
  { id: 'hoi_dtd', name: 'Cá hồi Đại Tây Dương', emoji: '🐟', zone: 'lake', rarity: 'uncommon', value: 110, kg: [2, 8] },
  { id: 'tam', name: 'Cá tầm', emoji: '🐟', zone: 'lake', rarity: 'rare', value: 250, kg: [3, 20] },
  { id: 'tram_vang', name: 'Cá trắm vàng', emoji: '🐟', zone: 'lake', rarity: 'rare', value: 260, kg: [2, 15] },
  { id: 'cho_bac', name: 'Cá chó phương bắc', emoji: '🐟', zone: 'lake', rarity: 'rare', value: 280, kg: [2, 12] },
  { id: 'koi_tancho', name: 'Cá koi tancho', emoji: '🎏', zone: 'lake', rarity: 'rare', value: 300, kg: [1, 5] },
  { id: 'chinh', name: 'Cá chình hoa', emoji: '🐍', zone: 'lake', rarity: 'epic', value: 600, kg: [2, 15] },
  { id: 'hoi_chinook', name: 'Cá hồi Chinook', emoji: '🐟', zone: 'lake', rarity: 'epic', value: 650, kg: [5, 30] },
  { id: 'hoi_cau_vong', name: 'Cá hồi vân cầu vồng', emoji: '🌈', zone: 'lake', rarity: 'epic', value: 680, kg: [2, 8] },
  { id: 'tam_trang', name: 'Cá tầm trắng', emoji: '🐟', zone: 'lake', rarity: 'epic', value: 700, kg: [10, 80] },
  { id: 'hoi_vang', name: 'Cá hồi vàng', emoji: '🐠', zone: 'lake', rarity: 'legendary', value: 1800, kg: [2, 8] },
  { id: 'rong_bach_kim', name: 'Cá rồng bạch kim', emoji: '🐉', zone: 'lake', rarity: 'legendary', value: 2200, kg: [1, 6] },
  { id: 'ky_lan_bang', name: 'Cá Kỳ Lân Băng', emoji: '🦄', zone: 'lake', rarity: 'mythic', value: 5500, kg: [3, 12] },
  { id: 'chep_rong', name: 'Cá chép hoá rồng', emoji: '🐲', zone: 'lake', rarity: 'mythic', value: 6000, kg: [5, 20] },
  // Biển xanh (23 loài)
  { id: 'com', name: 'Cá cơm', emoji: '🐟', zone: 'sea', rarity: 'common', value: 50, kg: [0.05, 0.2] },
  { id: 'trich', name: 'Cá trích', emoji: '🐟', zone: 'sea', rarity: 'common', value: 55, kg: [0.05, 0.3] },
  { id: 'doi', name: 'Cá đối', emoji: '🐟', zone: 'sea', rarity: 'common', value: 58, kg: [0.2, 1.5] },
  { id: 'nuc', name: 'Cá nục', emoji: '🐟', zone: 'sea', rarity: 'common', value: 60, kg: [0.1, 0.5] },
  { id: 'bac_ma', name: 'Cá bạc má', emoji: '🐟', zone: 'sea', rarity: 'common', value: 60, kg: [0.1, 0.5] },
  { id: 'thia_xanh', name: 'Cá thia đá xanh', emoji: '🐠', zone: 'sea', rarity: 'common', value: 65, kg: [0.02, 0.1] },
  { id: 'he_bien', name: 'Cá hề', emoji: '🐠', zone: 'sea', rarity: 'uncommon', value: 140, kg: [0.05, 0.2] },
  { id: 'thu', name: 'Cá thu', emoji: '🐟', zone: 'sea', rarity: 'uncommon', value: 150, kg: [1, 8] },
  { id: 'noc', name: 'Cá nóc', emoji: '🐡', zone: 'sea', rarity: 'uncommon', value: 150, kg: [0.2, 2] },
  { id: 'bo_hom', name: 'Cá bò hòm', emoji: '🐡', zone: 'sea', rarity: 'uncommon', value: 160, kg: [0.2, 1] },
  { id: 'buom', name: 'Cá bướm', emoji: '🦋', zone: 'sea', rarity: 'rare', value: 360, kg: [0.1, 0.5] },
  { id: 'hong', name: 'Cá hồng', emoji: '🐟', zone: 'sea', rarity: 'rare', value: 380, kg: [1, 10] },
  { id: 'mu', name: 'Cá mú', emoji: '🐡', zone: 'sea', rarity: 'rare', value: 400, kg: [2, 15] },
  { id: 'than_tien', name: 'Cá thần tiên biển', emoji: '🐠', zone: 'sea', rarity: 'rare', value: 420, kg: [0.3, 1.5] },
  { id: 'duoi_dien', name: 'Cá đuối điện', emoji: '⚡', zone: 'sea', rarity: 'epic', value: 950, kg: [5, 40] },
  { id: 'ngu', name: 'Cá ngừ đại dương', emoji: '🐟', zone: 'sea', rarity: 'epic', value: 1000, kg: [20, 150] },
  { id: 'map_vay_trang', name: 'Cá mập vây trắng', emoji: '🦈', zone: 'sea', rarity: 'epic', value: 1100, kg: [20, 120] },
  { id: 'manta', name: 'Cá đuối manta', emoji: '🛸', zone: 'sea', rarity: 'legendary', value: 2600, kg: [300, 1500] },
  { id: 'kiem', name: 'Cá kiếm', emoji: '🗡️', zone: 'sea', rarity: 'legendary', value: 2800, kg: [50, 400] },
  { id: 'co_xanh', name: 'Cá cờ xanh', emoji: '🗡️', zone: 'sea', rarity: 'legendary', value: 3000, kg: [50, 300] },
  { id: 'map_voi', name: 'Cá mập voi', emoji: '🦈', zone: 'sea', rarity: 'legendary', value: 3200, kg: [500, 9000] },
  { id: 'phuong_bien', name: 'Cá Phượng Hoàng Biển', emoji: '🔥', zone: 'sea', rarity: 'mythic', value: 8500, kg: [1, 5] },
  { id: 'bay_sac', name: 'Cá Thuỷ Tinh Bảy Sắc', emoji: '🌈', zone: 'sea', rarity: 'mythic', value: 9000, kg: [1, 3] },
  // Rạn san hô (15 loài)
  { id: 'thia_duoi_vang', name: 'Cá thia đuôi vàng', emoji: '🐠', zone: 'coral', rarity: 'common', value: 160, kg: [0.02, 0.1] },
  { id: 'bang_chai', name: 'Cá bàng chài', emoji: '🐠', zone: 'coral', rarity: 'common', value: 170, kg: [0.1, 0.8] },
  { id: 'duoi_gai', name: 'Cá đuôi gai xanh', emoji: '🐠', zone: 'coral', rarity: 'common', value: 200, kg: [0.2, 0.8] },
  { id: 'mo', name: 'Cá mó', emoji: '🦜', zone: 'coral', rarity: 'common', value: 220, kg: [1, 6] },
  { id: 'bo_giay', name: 'Cá bò giấy', emoji: '🐡', zone: 'coral', rarity: 'uncommon', value: 400, kg: [0.3, 2] },
  { id: 'mao_tien', name: 'Cá mao tiên', emoji: '🦁', zone: 'coral', rarity: 'uncommon', value: 420, kg: [0.2, 1] },
  { id: 'lich_bien', name: 'Cá lịch biển', emoji: '🐍', zone: 'coral', rarity: 'uncommon', value: 450, kg: [1, 8] },
  { id: 'hoang_de', name: 'Cá hoàng đế', emoji: '👑', zone: 'coral', rarity: 'uncommon', value: 480, kg: [0.5, 2] },
  { id: 'mu_cham', name: 'Cá mú chấm xanh', emoji: '🐡', zone: 'coral', rarity: 'rare', value: 950, kg: [1, 8] },
  { id: 'map_ran', name: 'Cá mập rạn san hô', emoji: '🦈', zone: 'coral', rarity: 'rare', value: 1050, kg: [10, 40] },
  { id: 'napoleon', name: 'Cá Napoleon', emoji: '🐟', zone: 'coral', rarity: 'rare', value: 1100, kg: [20, 150] },
  { id: 'o_sao', name: 'Cá ó sao', emoji: '🛸', zone: 'coral', rarity: 'epic', value: 3200, kg: [50, 200] },
  { id: 'hai_long', name: 'Cá hải long', emoji: '🐉', zone: 'coral', rarity: 'epic', value: 3500, kg: [0.1, 0.5] },
  { id: 'than_tien_vang', name: 'Cá Thần Tiên Hoàng Kim', emoji: '✨', zone: 'coral', rarity: 'legendary', value: 9000, kg: [1, 4] },
  { id: 'ngoc_san_ho', name: 'Cá Ngọc San Hô', emoji: '💎', zone: 'coral', rarity: 'mythic', value: 15000, kg: [1, 5] },
  // Vực sâu huyền bí (21 loài)
  { id: 'den_long', name: 'Cá đèn lồng', emoji: '🏮', zone: 'abyss', rarity: 'common', value: 150, kg: [0.5, 5] },
  { id: 'ran_sau', name: 'Cá rắn biển sâu', emoji: '🐍', zone: 'abyss', rarity: 'common', value: 160, kg: [0.1, 0.5] },
  { id: 'rang_nanh', name: 'Cá răng nanh', emoji: '👹', zone: 'abyss', rarity: 'common', value: 170, kg: [0.05, 0.3] },
  { id: 'den_pin', name: 'Cá đèn pin', emoji: '🔦', zone: 'abyss', rarity: 'common', value: 180, kg: [0.05, 0.2] },
  { id: 'riu_bac', name: 'Cá rìu bạc', emoji: '🔪', zone: 'abyss', rarity: 'uncommon', value: 300, kg: [0.05, 0.3] },
  { id: 'mieng_tui', name: 'Cá miệng túi', emoji: '🐍', zone: 'abyss', rarity: 'uncommon', value: 300, kg: [0.5, 3] },
  { id: 'mat_ong', name: 'Cá mắt ống', emoji: '👁️', zone: 'abyss', rarity: 'uncommon', value: 320, kg: [0.1, 0.5] },
  { id: 'bon_sau', name: 'Cá bơn biển sâu', emoji: '🐟', zone: 'abyss', rarity: 'uncommon', value: 330, kg: [0.5, 4] },
  { id: 'giot_nuoc', name: 'Cá giọt nước', emoji: '💧', zone: 'abyss', rarity: 'rare', value: 850, kg: [2, 10] },
  { id: 'rong_den', name: 'Cá rồng đen', emoji: '🐉', zone: 'abyss', rarity: 'rare', value: 880, kg: [0.1, 0.5] },
  { id: 'mat_trang', name: 'Cá mặt trăng', emoji: '🌕', zone: 'abyss', rarity: 'rare', value: 900, kg: [50, 500] },
  { id: 'map_sang', name: 'Cá mập phát sáng', emoji: '🦈', zone: 'abyss', rarity: 'rare', value: 950, kg: [0.5, 1] },
  { id: 'vay_chan', name: 'Cá vây chân', emoji: '🦎', zone: 'abyss', rarity: 'epic', value: 2300, kg: [1, 5] },
  { id: 'yeu_tinh', name: 'Cá mập yêu tinh', emoji: '👺', zone: 'abyss', rarity: 'epic', value: 2400, kg: [100, 200] },
  { id: 'mai_cheo', name: 'Cá mái chèo', emoji: '🎐', zone: 'abyss', rarity: 'epic', value: 2500, kg: [20, 200] },
  { id: 'ma_bien', name: 'Cá ma (chimera)', emoji: '👻', zone: 'abyss', rarity: 'epic', value: 2600, kg: [2, 15] },
  { id: 'vay_tay', name: 'Cá vây tay', emoji: '🦕', zone: 'abyss', rarity: 'legendary', value: 7000, kg: [30, 90] },
  { id: 'bang_pha_le', name: 'Cá Băng Pha Lê', emoji: '❄️', zone: 'abyss', rarity: 'legendary', value: 7500, kg: [1, 8] },
  { id: 'megalodon', name: 'Cá mập Megalodon', emoji: '🦈', zone: 'abyss', rarity: 'legendary', value: 9000, kg: [2000, 9000] },
  { id: 'long_vuong', name: 'Cá Long Vương Thuỷ Tề', emoji: '🐲', zone: 'abyss', rarity: 'mythic', value: 20000, kg: [80, 300] },
  { id: 'rong_thieng', name: 'Cá Rồng Thiêng', emoji: '🐉', zone: 'abyss', rarity: 'mythic', value: 25000, kg: [100, 400] },
  // Biển băng (15 loài)
  { id: 'trich_bac', name: 'Cá trích Bắc Cực', emoji: '🐟', zone: 'ice', rarity: 'common', value: 380, kg: [0.1, 0.5] },
  { id: 'tuyet', name: 'Cá tuyết', emoji: '🐟', zone: 'ice', rarity: 'common', value: 420, kg: [1, 10] },
  { id: 'bang_trong', name: 'Cá băng trong suốt', emoji: '🧊', zone: 'ice', rarity: 'common', value: 450, kg: [0.5, 2] },
  { id: 'hoi_bac', name: 'Cá hồi Bắc Cực', emoji: '🐟', zone: 'ice', rarity: 'common', value: 480, kg: [1, 6] },
  { id: 'vay_chi', name: 'Cá vây chỉ Nam Cực', emoji: '🐟', zone: 'ice', rarity: 'uncommon', value: 850, kg: [0.5, 3] },
  { id: 'bon_green', name: 'Cá bơn Greenland', emoji: '🐟', zone: 'ice', rarity: 'uncommon', value: 900, kg: [2, 20] },
  { id: 'mu_lan', name: 'Cá mù làn', emoji: '🐡', zone: 'ice', rarity: 'uncommon', value: 920, kg: [0.2, 2] },
  { id: 'soi', name: 'Cá sói', emoji: '🐺', zone: 'ice', rarity: 'uncommon', value: 950, kg: [3, 20] },
  { id: 'rang_soi', name: 'Cá răng sói băng', emoji: '🐍', zone: 'ice', rarity: 'rare', value: 2400, kg: [2, 10] },
  { id: 'tuyet_den', name: 'Cá tuyết đen', emoji: '🐟', zone: 'ice', rarity: 'rare', value: 2600, kg: [5, 60] },
  { id: 'map_green', name: 'Cá mập Greenland', emoji: '🦈', zone: 'ice', rarity: 'rare', value: 2800, kg: [200, 1000] },
  { id: 'cuc_quang', name: 'Cá Cực Quang', emoji: '🌌', zone: 'ice', rarity: 'epic', value: 8500, kg: [1, 5] },
  { id: 'kiem_bang', name: 'Cá Kiếm Băng', emoji: '🗡️', zone: 'ice', rarity: 'epic', value: 9000, kg: [40, 300] },
  { id: 'map_tuyet', name: 'Cá Mập Tuyết Khổng Lồ', emoji: '🦈', zone: 'ice', rarity: 'legendary', value: 22000, kg: [800, 3000] },
  { id: 'bang_long', name: 'Băng Long Vương', emoji: '🐲', zone: 'ice', rarity: 'mythic', value: 35000, kg: [100, 400] },
  // Hồ dung nham (15 loài)
  { id: 'da_bazan', name: 'Cá đá bazan', emoji: '🪨', zone: 'volcano', rarity: 'common', value: 650, kg: [0.5, 3] },
  { id: 'tro_bay', name: 'Cá tro bay', emoji: '🐟', zone: 'volcano', rarity: 'common', value: 680, kg: [0.1, 0.8] },
  { id: 'than_hong', name: 'Cá than hồng', emoji: '🔥', zone: 'volcano', rarity: 'common', value: 700, kg: [0.2, 1] },
  { id: 'luu_huynh', name: 'Cá lưu huỳnh', emoji: '🐟', zone: 'volcano', rarity: 'common', value: 720, kg: [0.2, 1.5] },
  { id: 'luon_lua', name: 'Lươn dung nham', emoji: '🐍', zone: 'volcano', rarity: 'uncommon', value: 1400, kg: [1, 6] },
  { id: 'suoi_nong', name: 'Cá suối nóng', emoji: '♨️', zone: 'volcano', rarity: 'uncommon', value: 1450, kg: [0.1, 0.6] },
  { id: 'vay_lua', name: 'Cá vảy lửa', emoji: '🐠', zone: 'volcano', rarity: 'uncommon', value: 1500, kg: [1, 5] },
  { id: 'nham_thach', name: 'Cá nham thạch', emoji: '🌋', zone: 'volcano', rarity: 'uncommon', value: 1600, kg: [2, 10] },
  { id: 'duoi_lua', name: 'Cá đuối lửa', emoji: '🛸', zone: 'volcano', rarity: 'rare', value: 4000, kg: [20, 120] },
  { id: 'map_nui_lua', name: 'Cá mập núi lửa', emoji: '🦈', zone: 'volcano', rarity: 'rare', value: 4200, kg: [30, 200] },
  { id: 'hoa_ky_lan', name: 'Cá Hoả Kỳ Lân', emoji: '🦄', zone: 'volcano', rarity: 'rare', value: 4500, kg: [3, 15] },
  { id: 'phuong_lua', name: 'Cá Phượng Lửa', emoji: '🐦‍🔥', zone: 'volcano', rarity: 'epic', value: 12000, kg: [2, 8] },
  { id: 'kim_cuong_do', name: 'Cá Kim Cương Đỏ', emoji: '💎', zone: 'volcano', rarity: 'epic', value: 13000, kg: [1, 4] },
  { id: 'hoa_long', name: 'Cá Hoả Long', emoji: '🐉', zone: 'volcano', rarity: 'legendary', value: 28000, kg: [50, 300] },
  { id: 'than_hoa', name: 'Thần Hoả Long Vương', emoji: '☀️', zone: 'volcano', rarity: 'mythic', value: 50000, kg: [200, 800] },
];

export const fishById = (id) => FISH.find((f) => f.id === id);

// luck: tăng tỉ lệ ra cá hiếm.
export const RODS = [
  { id: 'bamboo', name: 'Cần tre', icon: '🎋', luck: 0, price: 0, level: 1, skill: 'calm', fx: '#d9f99d' },
  { id: 'reed', name: 'Cần trúc vàng', icon: '🎋', luck: 0.5, price: 150, level: 1, skill: 'calm', fx: '#bef264' },
  { id: 'fiber', name: 'Cần sợi thuỷ tinh', icon: '🎣', luck: 1, price: 400, level: 2, skill: 'wave', fx: '#38bdf8' },
  { id: 'steel', name: 'Cần inox rút gọn', icon: '🎣', luck: 1.5, price: 900, level: 3, skill: 'storm', fx: '#94a3b8' },
  { id: 'carbon', name: 'Cần carbon', icon: '🎣', luck: 2, price: 1500, level: 5, skill: 'gust', fx: '#e2e8f0' },
  { id: 'jade', name: 'Cần ngọc bích', icon: '💚', luck: 2.5, price: 3000, level: 7, skill: 'jade', fx: '#34d399' },
  { id: 'gold', name: 'Cần vàng', icon: '✨', luck: 3, price: 5000, level: 9, skill: 'gold', fx: '#fbbf24' },
  { id: 'thunder', name: 'Cần sấm sét', icon: '⚡', luck: 4, price: 9000, level: 12, skill: 'thunder', fx: '#a78bfa' },
  { id: 'dragon', name: 'Cần rồng', icon: '🐉', luck: 5, price: 15000, level: 14, skill: 'dragon', fx: '#f97316' },
  { id: 'phoenix', name: 'Cần phượng hoàng', icon: '🔥', luck: 6, price: 30000, level: 18, skill: 'phoenix', fx: '#fb7185' },
];

export const rodById = (id) => RODS.find((r) => r.id === id);

// Thùng đựng cá: sức chứa và thưởng giá bán (thùng giữ lạnh giữ cá tươi → bán đắt hơn).
export const BUCKETS = [
  { id: 'bag', name: 'Túi lưới', cap: 15, bonus: 0, price: 0, level: 1, color: '#a3a3a3', desc: 'Túi lưới nhỏ, đựng được 15 con.' },
  { id: 'basket', name: 'Giỏ tre', cap: 25, bonus: 0, price: 300, level: 2, color: '#d6a75c', desc: 'Giỏ tre đan tay, đựng 25 con.' },
  { id: 'wood', name: 'Thùng gỗ', cap: 40, bonus: 0.05, price: 1200, level: 4, color: '#a16207', desc: 'Đựng 40 con, cá tươi hơn: bán +5% giá.' },
  { id: 'cooler', name: 'Thùng giữ lạnh', cap: 60, bonus: 0.1, price: 4000, level: 8, color: '#38bdf8', desc: 'Đựng 60 con, giữ lạnh: bán +10% giá.' },
  { id: 'aquarium', name: 'Bể kính sống', cap: 100, bonus: 0.2, price: 12000, level: 12, color: '#22d3ee', desc: 'Đựng 100 con, cá còn sống: bán +20% giá.' },
];
export const bucketById = (id) => BUCKETS.find((b) => b.id === id) || BUCKETS[0];

// Kỹ năng câu cá của từng cần – dùng khi đang kéo cá.
// Mỗi trận có 1 lượt; mỗi câu trả lời đúng nạp thêm 1 lượt (tối đa 2).
export const SKILLS = {
  calm: { name: 'Thả dây khéo', icon: '🌿', desc: 'Giảm 50% độ căng dây ngay lập tức.' },
  wave: { name: 'Sóng xanh', icon: '🌊', desc: 'Giảm 70% độ căng dây và làm cá ngừng vùng vẫy.' },
  gust: { name: 'Lốc xoáy', icon: '🌪️', desc: 'Cuốn cá lại gần 25% quãng đường mà không làm căng dây.' },
  gold: { name: 'Ánh vàng', icon: '✨', desc: 'Làm cá choáng 3 giây: không vùng vẫy, dây gần như không căng.' },
  dragon: { name: 'Rồng cuộn', icon: '🐉', desc: 'Kéo cá lại gần 35%, xả hết độ căng và làm cá choáng 2 giây.' },
  storm: { name: 'Gió giật', icon: '💨', desc: 'Kéo cá lại gần 15%, giảm 60% độ căng, cá choáng 1 giây.' },
  jade: { name: 'Ngọc hồi sinh', icon: '💚', desc: 'Hồi 1 ❤️ độ bền dây và giảm 50% độ căng.' },
  thunder: { name: 'Sấm sét', icon: '⚡', desc: 'Kéo cá lại gần 30%, giảm 80% độ căng, cá choáng 1,5 giây.' },
  phoenix: { name: 'Lửa phượng hoàng', icon: '🔥', desc: 'Kéo cá lại gần 45%, xả hết căng, hồi 1 ❤️, cá choáng 3 giây.' },
};

// Dây câu: thêm ❤️ độ bền (số câu được phép trả lời sai) và sức chịu căng khi kéo cá.
export const LINES = [
  { id: 'nylon', name: 'Dây cước', icon: '➰', color: '#e5e7eb', lives: 2, strength: 0, price: 0, level: 1 },
  { id: 'braid', name: 'Dây dù bện', icon: '➰', color: '#4ade80', lives: 3, strength: 0.1, price: 600, level: 3 },
  { id: 'kevlar', name: 'Dây kevlar', icon: '➰', color: '#fbbf24', lives: 3, strength: 0.25, price: 2500, level: 7 },
  { id: 'titan', name: 'Dây titan', icon: '➰', color: '#60a5fa', lives: 4, strength: 0.4, price: 8000, level: 12 },
];

export const lineById = (id) => LINES.find((l) => l.id === id);

// Vật phẩm tiêu hao. kind 'bait' dùng mỗi lần thả câu; 'helper' dùng khi trả lời.
// Mồi: luck = may mắn gặp cá hiếm; kg = cá to hơn (+%); zones = thêm may mắn ở các khu đó.
export const ITEMS = {
  worm: { name: 'Giun đất', icon: '🐛', kind: 'bait', luck: 0, desc: 'Mồi miễn phí, dùng không giới hạn.' },
  bread: { name: 'Mồi bánh mì', icon: '🍞', kind: 'bait', luck: 0.5, desc: 'Rẻ, cá Thường và cá Khá rất thích.' },
  cricket: { name: 'Mồi dế', icon: '🦗', kind: 'bait', luck: 1, kg: 0.1, desc: 'Cá ở ao, sông đớp mạnh; cá to hơn 10%.', zones: { pond: 0.5, river: 0.5, mangrove: 0.5 } },
  shrimp: { name: 'Mồi tôm', icon: '🦐', kind: 'bait', luck: 1, desc: 'Tăng nhẹ cơ hội gặp cá hiếm.' },
  minnow: { name: 'Mồi cá con', icon: '🐟', kind: 'bait', luck: 1.5, kg: 0.3, desc: 'Dụ cá săn mồi: cá to hơn 30%.' },
  squid: { name: 'Mồi mực', icon: '🦑', kind: 'bait', luck: 2, desc: 'Rất hợp ở Biển xanh, Rạn san hô và Vực sâu.', zones: { sea: 1, coral: 1, abyss: 1 } },
  golden: { name: 'Mồi vàng', icon: '🟡', kind: 'bait', luck: 3, desc: 'Tăng mạnh cơ hội gặp cá hiếm.' },
  glow: { name: 'Mồi phát sáng', icon: '🌟', kind: 'bait', luck: 4, kg: 0.1, desc: 'Toả sáng dưới nước sâu – rất dễ gặp cá Sử thi.', zones: { lake: 0.5, abyss: 1.5, ice: 1, volcano: 1 } },
  rainbow: { name: 'Mồi cầu vồng', icon: '🌈', kind: 'bait', luck: 5, kg: 0.2, desc: 'Mồi huyền thoại: cơ hội gặp cá Huyền thoại cao nhất.' },
  hint: { name: 'Phao gợi ý 50/50', icon: '💡', kind: 'helper', desc: 'Bỏ bớt 2 đáp án sai.' },
  time: { name: 'Đồng hồ cát', icon: '⏳', kind: 'helper', desc: 'Thêm 15 giây suy nghĩ.' },
  charm: { name: 'Bùa may mắn', icon: '🍀', kind: 'charm', desc: 'Lần câu tới chắc chắn gặp cá Hiếm trở lên.' },
  tea: { name: 'Trà gừng', icon: '🍵', kind: 'boost', desc: 'Trận kéo cá kế tiếp: dây căng chậm hơn 35%.' },
  net: { name: 'Vợt vàng', icon: '🥅', kind: 'boost', desc: 'Con cá câu được ở lượt kế tiếp bán giá gấp đôi.' },
};

export const BAITS = Object.keys(ITEMS).filter((id) => ITEMS[id].kind === 'bait');

export const SHOP = [
  { id: 'bread10', item: 'bread', qty: 10, price: 30, level: 1 },
  { id: 'cricket5', item: 'cricket', qty: 5, price: 45, level: 1 },
  { id: 'shrimp5', item: 'shrimp', qty: 5, price: 60, level: 1 },
  { id: 'minnow5', item: 'minnow', qty: 5, price: 140, level: 3 },
  { id: 'squid5', item: 'squid', qty: 5, price: 200, level: 5 },
  { id: 'golden5', item: 'golden', qty: 5, price: 250, level: 4 },
  { id: 'glow5', item: 'glow', qty: 5, price: 600, level: 8 },
  { id: 'rainbow3', item: 'rainbow', qty: 3, price: 1500, level: 12 },
  { id: 'hint3', item: 'hint', qty: 3, price: 100, level: 1 },
  { id: 'time3', item: 'time', qty: 3, price: 80, level: 1 },
  { id: 'charm1', item: 'charm', qty: 1, price: 200, level: 3 },
  { id: 'tea3', item: 'tea', qty: 3, price: 90, level: 2 },
  { id: 'net1', item: 'net', qty: 1, price: 150, level: 3 },
];

// Tất cả môn lớp 1–12 (xem curriculum.js) + bộ đề của thầy cô.
export const SUBJECTS = [...ALL_SUBJECTS, { id: 'custom', name: 'Bộ đề của thầy cô', icon: '📝' }];

export const subjectById = (id) => SUBJECTS.find((s) => s.id === id);

// (cũ) nhóm lớp – vẫn giữ để đọc bản lưu cũ; nay dùng số lớp 1–12.
export const GRADES = [
  { id: 'g1', name: 'Lớp 1–2', mathOffset: 0 },
  { id: 'g3', name: 'Lớp 3–5', mathOffset: 1 },
  { id: 'g6', name: 'Lớp 6–9', mathOffset: 2 },
];

// Chuỗi nhiệm vụ: luôn mở 3 nhiệm vụ đầu tiên chưa nhận thưởng.
// goal.type: catch | correct | streak | sell | level | coinsEarned | species
export const QUESTS = [
  { id: 'q1', title: 'Mẻ cá đầu tiên', goal: { type: 'catch', n: 1 }, reward: { coins: 50, items: { shrimp: 2 } } },
  { id: 'q2', title: 'Học trò chăm chỉ', goal: { type: 'correct', n: 5 }, reward: { items: { hint: 2 }, xp: 30 } },
  { id: 'q3', title: 'Nhà toán học nhí', goal: { type: 'correct', n: 5, subject: 'math' }, reward: { coins: 60, items: { time: 2 } } },
  { id: 'q4', title: 'Thùng cá đầy ắp', goal: { type: 'catch', n: 8 }, reward: { coins: 100 } },
  { id: 'q5', title: 'Mang cá ra chợ', goal: { type: 'sell', n: 5 }, reward: { coins: 80, xp: 50 } },
  { id: 'q6', title: 'Chuỗi 5 câu đúng', goal: { type: 'streak', n: 5 }, reward: { items: { charm: 1 } } },
  { id: 'q7', title: 'Mở đường ra sông', goal: { type: 'level', n: 3 }, reward: { zone: 'river', coins: 50 } },
  { id: 'qz1', title: 'Khám phá rừng đước', goal: { type: 'level', n: 4 }, reward: { zone: 'mangrove', coins: 80 } },
  { id: 'q8', title: 'Giỏi Tiếng Việt', goal: { type: 'correct', n: 6, subject: 'vi' }, reward: { items: { shrimp: 5 } } },
  { id: 'q9', title: 'Săn cá hiếm', goal: { type: 'catch', n: 3, minRarity: 'rare' }, reward: { rod: 'fiber' } },
  { id: 'q10', title: 'Nhà sưu tầm', goal: { type: 'species', n: 8 }, reward: { coins: 300, line: 'braid' } },
  { id: 'q11', title: 'Nhà khoa học nhỏ', goal: { type: 'correct', n: 8, subject: 'sci' }, reward: { items: { golden: 3 } } },
  { id: 'q12', title: 'Chuỗi 10 câu đúng', goal: { type: 'streak', n: 10 }, reward: { items: { charm: 2, hint: 3 } } },
  { id: 'q13', title: 'Lên núi tìm hồ', goal: { type: 'level', n: 6 }, reward: { zone: 'lake' } },
  { id: 'q14', title: 'Cá quý trong tay', goal: { type: 'catch', n: 3, minRarity: 'epic' }, reward: { rod: 'carbon' } },
  { id: 'q15', title: 'Thông thạo Tiếng Anh', goal: { type: 'correct', n: 10, subject: 'en' }, reward: { coins: 600, items: { tea: 3, net: 1 } } },
  { id: 'q16', title: 'Hiểu biết Sử – Địa', goal: { type: 'correct', n: 10, subject: 'his' }, reward: { coins: 800, items: { golden: 3 } } },
  { id: 'q17', title: 'Triệu phú làng chài', goal: { type: 'coinsEarned', n: 5000 }, reward: { zone: 'sea' } },
  { id: 'qz2', title: 'Lặn ngắm san hô', goal: { type: 'level', n: 12 }, reward: { zone: 'coral', items: { squid: 5 } } },
  { id: 'q18', title: 'Chạm tay huyền thoại', goal: { type: 'catch', n: 1, minRarity: 'legendary' }, reward: { rod: 'gold' } },
  { id: 'q19', title: 'Bách khoa toàn thư', goal: { type: 'correct', n: 150 }, reward: { items: { golden: 10, charm: 3 } } },
  { id: 'q20', title: 'Xuống vực sâu', goal: { type: 'level', n: 15 }, reward: { zone: 'abyss' } },
  { id: 'qz3', title: 'Vượt biển băng', goal: { type: 'level', n: 18 }, reward: { zone: 'ice', coins: 3000 } },
  { id: 'q21', title: 'Truy tìm Cá Rồng Thiêng', goal: { type: 'catch', n: 1, minRarity: 'mythic' }, reward: { rod: 'dragon', coins: 10000 } },
  { id: 'qz4', title: 'Chinh phục núi lửa', goal: { type: 'level', n: 22 }, reward: { zone: 'volcano', coins: 8000 } },
  { id: 'q22', title: 'Đại sư câu cá', goal: { type: 'species', n: FISH.length }, reward: { coins: 50000, title: 'Đại sư câu cá' } },
];

// ---------------------------------------------------------------------------
// Diện mạo nhân vật: giới tính, màu da, tóc, trang phục, mũ (tủ đồ).
// Trang phục / mũ có giá xu và cấp tối thiểu; món giá 0 có sẵn cho mọi người.
// ---------------------------------------------------------------------------
export const GENDERS = [{ id: 'nam', name: 'Nam', icon: '👦' }, { id: 'nu', name: 'Nữ', icon: '👧' }];
export const SKINS = ['#f6d3b0', '#e8b88a', '#c98f5f', '#8d5a3b'];
export const HAIR_COLORS = ['#1f1a17', '#4a2f1d', '#8b5a2b', '#d6a14a', '#b91c1c', '#6b7280'];
export const HAIRS = [
  { id: 'short', name: 'Tóc ngắn', gender: 'nam' },
  { id: 'spiky', name: 'Tóc dựng', gender: 'nam' },
  { id: 'buzz', name: 'Đầu đinh', gender: 'nam' },
  { id: 'long', name: 'Tóc dài', gender: 'nu' },
  { id: 'ponytail', name: 'Đuôi ngựa', gender: 'nu' },
  { id: 'braids', name: 'Tóc hai bím', gender: 'nu' },
  { id: 'bun', name: 'Tóc búi', gender: 'nu' },
];
// top/bottom: màu áo/quần; extra: chi tiết riêng (khăn quàng, áo phao, tà áo dài…)
export const OUTFITS = [
  { id: 'tee', name: 'Áo thun xanh', icon: '👕', top: '#2f6db5', bottom: '#2b2b38', price: 0, level: 1 },
  { id: 'school', name: 'Đồng phục học sinh', icon: '🎒', top: '#f8fafc', bottom: '#1e3a8a', extra: 'scarf', price: 0, level: 1 },
  { id: 'baba', name: 'Áo bà ba', icon: '🌾', top: '#7c4a2a', bottom: '#1f1f1f', price: 150, level: 2 },
  { id: 'vest', name: 'Áo phao câu cá', icon: '🦺', top: '#0f766e', bottom: '#475569', extra: 'vest', trim: '#f97316', price: 400, level: 3 },
  { id: 'raincoat', name: 'Áo mưa ngư dân', icon: '🧥', top: '#facc15', bottom: '#ca8a04', price: 800, level: 5 },
  { id: 'aodai', name: 'Áo dài', icon: '👘', top: '#dc2626', bottom: '#ffffff', extra: 'aodai', trim: '#facc15', price: 1500, level: 6 },
  { id: 'sailor', name: 'Đồ thuỷ thủ', icon: '⚓', top: '#ffffff', bottom: '#1e3a8a', extra: 'collar', trim: '#1e3a8a', price: 2500, level: 9 },
  { id: 'diver', name: 'Đồ lặn biển', icon: '🤿', top: '#0f172a', bottom: '#0f172a', extra: 'stripes', trim: '#22d3ee', price: 5000, level: 13 },
  { id: 'royal', name: 'Hoàng bào', icon: '🐉', top: '#eab308', bottom: '#b91c1c', extra: 'belt', trim: '#fde68a', glow: true, price: 15000, level: 18 },
  { id: 'dragonsuit', name: 'Giáp Rồng Thần', icon: '🛡️', top: '#991b1b', bottom: '#1f2937', extra: 'armor', trim: '#fbbf24', glow: true, price: 40000, level: 22 },
];
export const HATS = [
  { id: 'none', name: 'Không đội mũ', icon: '🙂', price: 0, level: 1 },
  { id: 'nonla', name: 'Nón lá', icon: '👒', price: 0, level: 1 },
  { id: 'cap', name: 'Mũ lưỡi trai', icon: '🧢', color: '#dc2626', price: 100, level: 1 },
  { id: 'bow', name: 'Nơ cài tóc', icon: '🎀', color: '#ec4899', price: 150, level: 1 },
  { id: 'bucket', name: 'Mũ tai bèo', icon: '🪖', color: '#4d7c0f', price: 300, level: 2 },
  { id: 'straw', name: 'Mũ rơm', icon: '👒', color: '#e9c46a', price: 500, level: 4 },
  { id: 'beanie', name: 'Mũ len', icon: '🧶', color: '#7c3aed', price: 700, level: 6 },
  { id: 'captain', name: 'Mũ thuyền trưởng', icon: '⚓', color: '#ffffff', price: 3000, level: 10 },
  { id: 'crown', name: 'Vương miện', icon: '👑', color: '#fbbf24', price: 20000, level: 18 },
];
export const DEFAULT_LOOK = { gender: 'nam', skin: 0, hair: 'short', hairColor: 0, outfit: 'tee', hat: 'nonla' };
export const wearById = (id) => OUTFITS.find((o) => o.id === id) || HATS.find((h) => h.id === id);
