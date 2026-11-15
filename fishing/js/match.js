// Tính toán thi đấu (thuần logic, dễ kiểm thử): xếp hạng đội, đồng hồ theo giờ máy chủ,
// chọn câu hỏi tiếp theo trong trận, tổng hợp báo cáo cho giáo viên.

export const MODES = {
  duel: { name: '1 vs 1', icon: '⚔️', desc: 'Hai bạn đấu trí với nhau.' },
  teams: { name: 'Đội vs Đội', icon: '🛡️', desc: 'Hai đội, mỗi đội tối đa 8 người.' },
  class: { name: 'Lớp học', icon: '🏫', desc: '2–6 đội, mỗi đội tối đa 8 người – giáo viên điều khiển.' },
};

export const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6'];
export const TEAM_ICONS = ['🦈', '🐬', '🐢', '🐙', '🦀', '🐳'];

// Xếp hạng đội theo điểm TRUNG BÌNH mỗi thành viên (công bằng khi các đội không đủ người như nhau),
// hoà thì xét tổng điểm, rồi số câu đúng.
export function teamStandings(board) {
  const names = board?.team_names || [];
  const teams = names.map((name, i) => ({ index: i, name, color: TEAM_COLORS[i % TEAM_COLORS.length], icon: TEAM_ICONS[i % TEAM_ICONS.length], members: [], total: 0, correct: 0, answered: 0 }));
  for (const p of board?.players || []) {
    const t = teams[p.team];
    if (!t) continue;
    t.members.push(p);
    t.total += p.score;
    t.correct += p.correct;
    t.answered += p.answered;
  }
  for (const t of teams) {
    t.avg = t.members.length ? Math.round(t.total / t.members.length) : 0;
    t.members.sort((a, b) => b.score - a.score);
    t.accuracy = t.answered ? Math.round((t.correct / t.answered) * 100) : 0;
  }
  const ranked = [...teams].sort((a, b) => b.avg - a.avg || b.total - a.total || b.correct - a.correct);
  ranked.forEach((t, i) => { t.rank = i > 0 && t.avg === ranked[i - 1].avg && t.total === ranked[i - 1].total ? ranked[i - 1].rank : i + 1; });
  return ranked;
}

// Người chơi xuất sắc nhất: điểm cao nhất, hoà thì đúng nhiều hơn.
export function mvp(board) {
  const ps = [...(board?.players || [])].filter((p) => p.answered > 0);
  ps.sort((a, b) => b.score - a.score || b.correct - a.correct);
  return ps[0] || null;
}

// Lệch giờ giữa máy và máy chủ (ms) – để đồng hồ đếm ngược giống nhau trên mọi máy.
export const clockSkew = (serverNow, localNow = Date.now()) => new Date(serverNow).getTime() - localNow;

// Trạng thái thời gian của trận tại thời điểm hiện tại (theo giờ máy chủ).
export function matchClock(m, skew = 0, localNow = Date.now()) {
  const now = localNow + skew;
  const starts = m?.starts_at ? new Date(m.starts_at).getTime() : null;
  const ends = m?.ends_at ? new Date(m.ends_at).getTime() : null;
  if (!m || m.status === 'lobby' || !starts) return { phase: 'lobby', left: null };
  if (m.status === 'done' || (ends && now >= ends)) return { phase: 'done', left: 0 };
  if (now < starts) return { phase: 'countdown', left: Math.ceil((starts - now) / 1000) };
  return { phase: 'running', left: ends ? Math.max(0, Math.ceil((ends - now) / 1000)) : null };
}

export function formatDuration(sec) {
  if (sec === null || sec === undefined) return '';
  const s = Math.max(0, Math.round(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (d) return `${d} ngày ${h} giờ`;
  if (h) return `${h} giờ ${String(m).padStart(2, '0')} phút`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

// Câu tiếp theo chưa trả lời (theo thứ tự). null = đã làm hết.
export function nextMatchIndex(qCount, answered = []) {
  const done = new Set(answered);
  for (let i = 0; i < qCount; i++) if (!done.has(i)) return i;
  return null;
}

// Báo cáo cho giáo viên: tỉ lệ đúng từng câu (câu khó nhất lên đầu) và bảng từng học sinh.
export function summarizeReport(report, teamNames = []) {
  const qs = report?.questions || [];
  const players = report?.players || [];
  const perQ = qs.map((q, i) => ({ i, q: q.q, a: q.a, total: 0, ok: 0 }));
  for (const p of players) {
    for (const a of p.answers || []) {
      const row = perQ[a.i];
      if (!row) continue;
      row.total += 1;
      if (a.ok) row.ok += 1;
    }
  }
  for (const r of perQ) r.rate = r.total ? Math.round((r.ok / r.total) * 100) : null;
  const hardest = [...perQ].filter((r) => r.total).sort((a, b) => a.rate - b.rate);
  const students = players.map((p) => ({
    nickname: p.nickname, team: teamNames[p.team] || '', score: p.score, correct: p.correct, answered: p.answered,
    wrong: (p.answers || []).filter((a) => !a.ok).map((a) => a.i + 1),
    avgSec: p.answers?.length ? Math.round(p.answers.reduce((s, a) => s + (a.ms || 0), 0) / p.answers.length / 100) / 10 : null,
  }));
  return { perQ, hardest, students };
}

export function reportToCSV(summary) {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [['Học sinh', 'Đội', 'Điểm', 'Số câu đúng', 'Đã trả lời', 'Câu sai', 'Giây/câu (TB)'],
    ...summary.students.map((s) => [s.nickname, s.team, s.score, s.correct, s.answered, s.wrong.join(' '), s.avgSec ?? ''])];
  rows.push([], ['Câu', 'Nội dung', 'Đáp án', 'Số lượt trả lời', 'Số lượt đúng', 'Tỉ lệ đúng (%)']);
  for (const q of summary.perQ) rows.push([q.i + 1, q.q, q.a, q.total, q.ok, q.rate ?? '']);
  return `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`;
}
