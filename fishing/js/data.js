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
    id: 'abyss', name: 'Vực sâu huyền bí', icon: '🌌', level: 15, price: 12000,
    weights: [5, 15, 25, 28, 20, 7],
    sky: ['#312e81', '#1e1b4b'], water: ['#1e3a8a', '#020617'],
    desc: 'Đáy biển tối đen – nơi Cá Rồng Thiêng ẩn mình.',
  },
];

export const zoneById = (id) => ZONES.find((z) => z.id === id);

// value: giá gốc (xu). Cân nặng càng lớn giá càng cao (×0,7 → ×1,3).
export const FISH = [
  // Ao làng
  { id: 'ro', name: 'Cá rô đồng', emoji: '🐟', zone: 'pond', rarity: 'common', value: 8, kg: [0.1, 0.4] },
  { id: 'diec', name: 'Cá diếc', emoji: '🐟', zone: 'pond', rarity: 'common', value: 10, kg: [0.1, 0.5] },
  { id: 'tre', name: 'Cá trê', emoji: '🐟', zone: 'pond', rarity: 'uncommon', value: 25, kg: [0.3, 1.5] },
  { id: 'chep', name: 'Cá chép', emoji: '🐠', zone: 'pond', rarity: 'uncommon', value: 30, kg: [0.5, 3] },
  { id: 'loc', name: 'Cá lóc', emoji: '🐟', zone: 'pond', rarity: 'rare', value: 70, kg: [0.8, 4] },
  { id: 'chep_do', name: 'Cá chép đỏ', emoji: '🎏', zone: 'pond', rarity: 'epic', value: 180, kg: [1, 4] },
  // Sông quê
  { id: 'me', name: 'Cá mè', emoji: '🐟', zone: 'river', rarity: 'common', value: 20, kg: [0.5, 3] },
  { id: 'tram', name: 'Cá trắm cỏ', emoji: '🐟', zone: 'river', rarity: 'common', value: 24, kg: [1, 6] },
  { id: 'basa', name: 'Cá basa', emoji: '🐠', zone: 'river', rarity: 'uncommon', value: 50, kg: [1, 5] },
  { id: 'lang', name: 'Cá lăng', emoji: '🐟', zone: 'river', rarity: 'rare', value: 120, kg: [2, 10] },
  { id: 'bong', name: 'Cá bống tượng', emoji: '🐡', zone: 'river', rarity: 'rare', value: 140, kg: [0.5, 2] },
  { id: 'chien', name: 'Cá chiên', emoji: '🐠', zone: 'river', rarity: 'epic', value: 350, kg: [2, 12] },
  { id: 'anh_vu', name: 'Cá anh vũ', emoji: '🐠', zone: 'river', rarity: 'legendary', value: 1000, kg: [1, 5] },
  // Hồ trên núi
  { id: 'suoi', name: 'Cá suối', emoji: '🐟', zone: 'lake', rarity: 'common', value: 40, kg: [0.2, 1] },
  { id: 'hoi_van', name: 'Cá hồi vân', emoji: '🐟', zone: 'lake', rarity: 'uncommon', value: 90, kg: [1, 4] },
  { id: 'tam', name: 'Cá tầm', emoji: '🐟', zone: 'lake', rarity: 'rare', value: 250, kg: [3, 20] },
  { id: 'chinh', name: 'Cá chình hoa', emoji: '🐍', zone: 'lake', rarity: 'epic', value: 600, kg: [2, 15] },
  { id: 'hoi_vang', name: 'Cá hồi vàng', emoji: '🐠', zone: 'lake', rarity: 'legendary', value: 1800, kg: [2, 8] },
  { id: 'chep_rong', name: 'Cá chép hoá rồng', emoji: '🐲', zone: 'lake', rarity: 'mythic', value: 6000, kg: [5, 20] },
  // Biển xanh
  { id: 'com', name: 'Cá cơm', emoji: '🐟', zone: 'sea', rarity: 'common', value: 50, kg: [0.05, 0.2] },
  { id: 'nuc', name: 'Cá nục', emoji: '🐟', zone: 'sea', rarity: 'common', value: 60, kg: [0.1, 0.5] },
  { id: 'thu', name: 'Cá thu', emoji: '🐟', zone: 'sea', rarity: 'uncommon', value: 150, kg: [1, 8] },
  { id: 'mu', name: 'Cá mú', emoji: '🐡', zone: 'sea', rarity: 'rare', value: 400, kg: [2, 15] },
  { id: 'ngu', name: 'Cá ngừ đại dương', emoji: '🐟', zone: 'sea', rarity: 'epic', value: 1000, kg: [20, 150] },
  { id: 'co_xanh', name: 'Cá cờ xanh', emoji: '🗡️', zone: 'sea', rarity: 'legendary', value: 3000, kg: [50, 300] },
  { id: 'bay_sac', name: 'Cá Thuỷ Tinh Bảy Sắc', emoji: '🌈', zone: 'sea', rarity: 'mythic', value: 9000, kg: [1, 3] },
  // Vực sâu huyền bí
  { id: 'den_long', name: 'Cá đèn lồng', emoji: '🏮', zone: 'abyss', rarity: 'common', value: 150, kg: [0.5, 5] },
  { id: 'riu_bac', name: 'Cá rìu bạc', emoji: '🪓', zone: 'abyss', rarity: 'uncommon', value: 300, kg: [0.05, 0.3] },
  { id: 'mat_trang', name: 'Cá mặt trăng', emoji: '🌕', zone: 'abyss', rarity: 'rare', value: 900, kg: [50, 500] },
  { id: 'mai_cheo', name: 'Cá mái chèo', emoji: '🎐', zone: 'abyss', rarity: 'epic', value: 2500, kg: [20, 200] },
  { id: 'vay_tay', name: 'Cá vây tay', emoji: '🦕', zone: 'abyss', rarity: 'legendary', value: 7000, kg: [30, 90] },
  { id: 'rong_thieng', name: 'Cá Rồng Thiêng', emoji: '🐉', zone: 'abyss', rarity: 'mythic', value: 25000, kg: [100, 400] },
];

export const fishById = (id) => FISH.find((f) => f.id === id);

// luck: tăng tỉ lệ ra cá hiếm.
export const RODS = [
  { id: 'bamboo', name: 'Cần tre', icon: '🎋', luck: 0, price: 0, level: 1 },
  { id: 'fiber', name: 'Cần sợi thuỷ tinh', icon: '🎣', luck: 1, price: 400, level: 2 },
  { id: 'carbon', name: 'Cần carbon', icon: '🎣', luck: 2, price: 1500, level: 5 },
  { id: 'gold', name: 'Cần vàng', icon: '✨', luck: 3, price: 5000, level: 9 },
  { id: 'dragon', name: 'Cần rồng', icon: '🐉', luck: 5, price: 15000, level: 14 },
];

export const rodById = (id) => RODS.find((r) => r.id === id);

// Dây câu: thêm ❤️ độ bền (số câu được phép trả lời sai) và sức chịu căng khi kéo cá.
export const LINES = [
  { id: 'nylon', name: 'Dây cước', icon: '🧵', color: '#e5e7eb', lives: 2, strength: 0, price: 0, level: 1 },
  { id: 'braid', name: 'Dây dù bện', icon: '🧵', color: '#4ade80', lives: 3, strength: 0.1, price: 600, level: 3 },
  { id: 'kevlar', name: 'Dây kevlar', icon: '🧵', color: '#fbbf24', lives: 3, strength: 0.25, price: 2500, level: 7 },
  { id: 'titan', name: 'Dây titan', icon: '🧵', color: '#60a5fa', lives: 4, strength: 0.4, price: 8000, level: 12 },
];

export const lineById = (id) => LINES.find((l) => l.id === id);

// Vật phẩm tiêu hao. kind 'bait' dùng mỗi lần thả câu; 'helper' dùng khi trả lời.
export const ITEMS = {
  worm: { name: 'Giun đất', icon: '🪱', kind: 'bait', luck: 0, desc: 'Mồi miễn phí, dùng không giới hạn.' },
  shrimp: { name: 'Mồi tôm', icon: '🦐', kind: 'bait', luck: 1, desc: 'Tăng nhẹ cơ hội gặp cá hiếm.' },
  golden: { name: 'Mồi vàng', icon: '🟡', kind: 'bait', luck: 3, desc: 'Tăng mạnh cơ hội gặp cá hiếm.' },
  hint: { name: 'Phao gợi ý 50/50', icon: '💡', kind: 'helper', desc: 'Bỏ bớt 2 đáp án sai.' },
  time: { name: 'Đồng hồ cát', icon: '⏳', kind: 'helper', desc: 'Thêm 15 giây suy nghĩ.' },
  charm: { name: 'Bùa may mắn', icon: '🍀', kind: 'charm', desc: 'Lần câu tới chắc chắn gặp cá Hiếm trở lên.' },
  tea: { name: 'Trà gừng', icon: '🍵', kind: 'boost', desc: 'Trận kéo cá kế tiếp: dây căng chậm hơn 35%.' },
  net: { name: 'Vợt vàng', icon: '🥅', kind: 'boost', desc: 'Con cá câu được ở lượt kế tiếp bán giá gấp đôi.' },
};

export const SHOP = [
  { id: 'shrimp5', item: 'shrimp', qty: 5, price: 60, level: 1 },
  { id: 'golden5', item: 'golden', qty: 5, price: 250, level: 4 },
  { id: 'hint3', item: 'hint', qty: 3, price: 100, level: 1 },
  { id: 'time3', item: 'time', qty: 3, price: 80, level: 1 },
  { id: 'charm1', item: 'charm', qty: 1, price: 200, level: 3 },
  { id: 'tea3', item: 'tea', qty: 3, price: 90, level: 2 },
  { id: 'net1', item: 'net', qty: 1, price: 150, level: 3 },
];

export const SUBJECTS = [
  { id: 'math', name: 'Toán', icon: '🔢' },
  { id: 'vi', name: 'Tiếng Việt', icon: '📖' },
  { id: 'en', name: 'Tiếng Anh', icon: '🔤' },
  { id: 'sci', name: 'Khoa học', icon: '🔬' },
  { id: 'his', name: 'Lịch sử & Địa lý', icon: '🌏' },
  { id: 'custom', name: 'Câu hỏi của tôi', icon: '✍️' },
];

export const subjectById = (id) => SUBJECTS.find((s) => s.id === id);

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
  { id: 'q18', title: 'Chạm tay huyền thoại', goal: { type: 'catch', n: 1, minRarity: 'legendary' }, reward: { rod: 'gold' } },
  { id: 'q19', title: 'Bách khoa toàn thư', goal: { type: 'correct', n: 150 }, reward: { items: { golden: 10, charm: 3 } } },
  { id: 'q20', title: 'Xuống vực sâu', goal: { type: 'level', n: 15 }, reward: { zone: 'abyss' } },
  { id: 'q21', title: 'Truy tìm Cá Rồng Thiêng', goal: { type: 'catch', n: 1, minRarity: 'mythic' }, reward: { rod: 'dragon', coins: 10000 } },
  { id: 'q22', title: 'Đại sư câu cá', goal: { type: 'species', n: FISH.length }, reward: { coins: 50000, title: 'Đại sư câu cá' } },
];
