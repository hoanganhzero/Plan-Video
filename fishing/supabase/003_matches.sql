-- Thi đấu "Câu Cá Học Giỏi": 1vs1, Đội vs Đội (tối đa 8 người/đội), Lớp học (2–6 đội).
-- Trực tiếp (phòng chờ → chủ trận bấm Bắt đầu → đồng hồ chung) hoặc không cần cùng lúc (hạn chót).
-- Máy chủ giữ đáp án và CHẤM ĐIỂM – trình duyệt không bao giờ nhận đáp án đúng trước khi trả lời.
-- Bảng khoá bằng RLS (không có policy); chỉ truy cập qua các hàm security definer bên dưới.

create table public.fishing_matches (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  owner_key uuid not null,
  mode text not null check (mode in ('duel', 'teams', 'class')),
  title text not null check (char_length(title) between 1 and 80),
  team_names text[] not null,
  team_size integer not null check (team_size between 1 and 8),
  questions jsonb not null,           -- [{q, a, w: [...], e, d}]
  q_count integer not null,
  live boolean not null,
  duration_sec integer not null,      -- trực tiếp: thời lượng trận; không cùng lúc: hạn chót
  status text not null default 'lobby' check (status in ('lobby', 'running', 'done')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.fishing_matches enable row level security;
revoke all on public.fishing_matches from anon, authenticated;

create table public.fishing_match_players (
  match_code text not null references public.fishing_matches(code) on delete cascade,
  player_key uuid not null,
  nickname text not null check (char_length(nickname) between 2 and 16),
  team integer not null,
  score integer not null default 0,
  correct integer not null default 0,
  answered integer not null default 0,
  fish_bonus integer not null default 0,
  best_rarity smallint not null default 0,
  answers jsonb not null default '[]'::jsonb,   -- [{i, ok, ms, pts}]
  finished boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_code, player_key)
);
create unique index fishing_match_players_nick on public.fishing_match_players (match_code, lower(nickname));
alter table public.fishing_match_players enable row level security;
revoke all on public.fishing_match_players from anon, authenticated;

-- Hết giờ → kết thúc trận (gọi trong các hàm đọc/ghi).
create or replace function public.fishing_match_tick(p_code text)
returns void language sql security definer set search_path = public as $$
  update public.fishing_matches set status = 'done'
  where code = p_code and status = 'running' and ends_at is not null and ends_at < now();
$$;
revoke all on function public.fishing_match_tick(text) from public, anon, authenticated;

-- Thông tin trận cho người chơi: câu hỏi KHÔNG kèm đáp án đúng; phương án xáo trộn giống nhau cho mọi người.
create or replace function public.fishing_match_public(p_code text, p_player uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.fishing_matches%rowtype; me public.fishing_match_players%rowtype; qs jsonb := null;
begin
  perform public.fishing_match_tick(p_code);
  select * into m from public.fishing_matches where code = p_code;
  if not found then raise exception 'match not found'; end if;
  select * into me from public.fishing_match_players where match_code = m.code and player_key = p_player;
  if m.status <> 'lobby' then
    select jsonb_agg(jsonb_build_object(
      'q', e.value->>'q', 'd', coalesce((e.value->>'d')::integer, 1),
      'options', (select jsonb_agg(o order by md5(m.code || e.ordinality::text || o))
                  from jsonb_array_elements_text(jsonb_build_array(e.value->>'a') || (e.value->'w')) o)
    ) order by e.ordinality) into qs
    from jsonb_array_elements(m.questions) with ordinality e;
  end if;
  return jsonb_build_object(
    'code', m.code, 'title', m.title, 'mode', m.mode, 'live', m.live, 'status', m.status,
    'team_names', to_jsonb(m.team_names), 'team_size', m.team_size, 'q_count', m.q_count,
    'duration_sec', m.duration_sec, 'starts_at', m.starts_at, 'ends_at', m.ends_at, 'server_now', now(),
    'is_owner', false,
    'team_counts', (select coalesce(jsonb_agg(c order by t), '[]'::jsonb) from (
        select t, (select count(*) from public.fishing_match_players p where p.match_code = m.code and p.team = t) c
        from generate_series(0, array_length(m.team_names, 1) - 1) t) x),
    'me', case when me.player_key is null then null else jsonb_build_object(
        'nickname', me.nickname, 'team', me.team, 'score', me.score, 'finished', me.finished,
        'answered', (select coalesce(jsonb_agg((a->>'i')::integer), '[]'::jsonb) from jsonb_array_elements(me.answers) a)) end,
    'questions', qs
  );
end $$;
revoke all on function public.fishing_match_public(text, uuid) from public, anon, authenticated;

create or replace function public.fishing_match_create(
  p_owner uuid, p_mode text, p_title text, p_teams text[], p_team_size integer,
  p_questions jsonb, p_live boolean, p_minutes integer
) returns text language plpgsql security definer set search_path = public as $$
declare c text; n integer; teams text[] := '{}'; nteams integer; tries integer := 0; i integer;
begin
  if p_owner is null then raise exception 'missing owner key'; end if;
  if p_mode not in ('duel', 'teams', 'class') then raise exception 'invalid mode'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then raise exception 'questions must be an array'; end if;
  n := jsonb_array_length(p_questions);
  if n < 3 or n > 50 then raise exception 'a match needs 3-50 questions'; end if;
  if pg_column_size(p_questions) > 300000 then raise exception 'questions are too large'; end if;
  if exists (select 1 from jsonb_array_elements(p_questions) e
             where coalesce(e->>'q', '') = '' or coalesce(e->>'a', '') = '' or jsonb_typeof(e->'w') <> 'array'
               or jsonb_array_length(e->'w') < 1) then
    raise exception 'every question needs q, a and w';
  end if;
  nteams := case p_mode when 'class' then least(greatest(coalesce(array_length(p_teams, 1), 2), 2), 6) else 2 end;
  for i in 1..nteams loop
    teams := teams || left(coalesce(nullif(btrim(p_teams[i]), ''), case when p_mode = 'duel' then 'Người chơi ' else 'Đội ' end || i), 24);
  end loop;
  if p_live and (p_minutes < 1 or p_minutes > 60) then raise exception 'live matches last 1-60 minutes'; end if;
  if not p_live and (p_minutes < 10 or p_minutes > 10080) then raise exception 'deadline must be 10 minutes to 7 days'; end if;
  loop
    c := public.fishing_gen_code(6);
    exit when not exists (select 1 from public.fishing_matches where code = c);
    tries := tries + 1;
    if tries > 20 then raise exception 'could not allocate a code'; end if;
  end loop;
  insert into public.fishing_matches (code, owner_key, mode, title, team_names, team_size, questions, q_count, live, duration_sec, status, starts_at, ends_at)
  values (c, p_owner, p_mode, left(coalesce(nullif(btrim(p_title), ''), 'Trận đấu'), 80), teams,
          case when p_mode = 'duel' then 1 else least(greatest(coalesce(p_team_size, 8), 1), 8) end,
          p_questions, n, p_live, p_minutes * 60,
          case when p_live then 'lobby' else 'running' end,
          case when p_live then null else now() end,
          case when p_live then null else now() + make_interval(mins => p_minutes) end);
  return c;
end $$;

create or replace function public.fishing_match_join(p_code text, p_player uuid, p_nickname text, p_team integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.fishing_matches%rowtype; nick text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
        existing public.fishing_match_players%rowtype; cnt integer;
begin
  perform public.fishing_match_tick(upper(btrim(p_code)));
  select * into m from public.fishing_matches where code = upper(btrim(p_code));
  if not found then raise exception 'match not found'; end if;
  if p_player is null then raise exception 'missing player key'; end if;
  if char_length(nick) < 2 or char_length(nick) > 16 then raise exception 'nickname must be 2-16 characters'; end if;
  if p_team is null or p_team < 0 or p_team >= array_length(m.team_names, 1) then raise exception 'invalid team'; end if;
  select * into existing from public.fishing_match_players where match_code = m.code and player_key = p_player;
  if found then
    -- Đã tham gia: chỉ được đổi đội / biệt danh khi trận còn ở phòng chờ.
    if m.status = 'lobby' and (existing.team <> p_team or existing.nickname <> nick) then
      select count(*) into cnt from public.fishing_match_players where match_code = m.code and team = p_team and player_key <> p_player;
      if cnt >= m.team_size then raise exception 'team is full'; end if;
      update public.fishing_match_players set team = p_team, nickname = nick, updated_at = now() where match_code = m.code and player_key = p_player;
    end if;
  else
    if m.status = 'done' then raise exception 'match has ended'; end if;
    select count(*) into cnt from public.fishing_match_players where match_code = m.code and team = p_team;
    if cnt >= m.team_size then raise exception 'team is full'; end if;
    begin
      insert into public.fishing_match_players (match_code, player_key, nickname, team) values (m.code, p_player, nick, p_team);
    exception when unique_violation then raise exception 'nickname already used in this match';
    end;
  end if;
  return public.fishing_match_public(m.code, p_player);
end $$;

create or replace function public.fishing_match_info(p_code text, p_player uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := public.fishing_match_public(upper(btrim(p_code)), p_player);
  if exists (select 1 from public.fishing_matches where code = upper(btrim(p_code)) and owner_key = p_player) then
    r := r || jsonb_build_object('is_owner', true);
  end if;
  return r;
end $$;

create or replace function public.fishing_match_start(p_code text, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.fishing_matches%rowtype;
begin
  select * into m from public.fishing_matches where code = upper(btrim(p_code)) and owner_key = p_owner;
  if not found then raise exception 'not the owner of this match'; end if;
  if m.status <> 'lobby' then raise exception 'match already started'; end if;
  if (select count(*) from public.fishing_match_players where match_code = m.code) < 1 then raise exception 'no players yet'; end if;
  -- Đếm ngược 5 giây để mọi người cùng sẵn sàng.
  update public.fishing_matches set status = 'running', starts_at = now() + interval '5 seconds',
         ends_at = now() + interval '5 seconds' + make_interval(secs => duration_sec)
  where code = m.code;
  return public.fishing_match_info(m.code, p_owner);
end $$;

create or replace function public.fishing_match_end(p_code text, p_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.fishing_matches set status = 'done', ends_at = least(coalesce(ends_at, now()), now())
  where code = upper(btrim(p_code)) and owner_key = p_owner;
  if not found then raise exception 'not the owner of this match'; end if;
end $$;

-- Chấm một câu. Điểm: đúng = 100 + 25×(độ khó − 1) + tối đa 50 điểm tốc độ (trả lời trong 30 giây).
create or replace function public.fishing_match_answer(p_code text, p_player uuid, p_index integer, p_choice text, p_ms integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.fishing_matches%rowtype; p public.fishing_match_players%rowtype; q jsonb; ok boolean; pts integer := 0; d integer;
begin
  perform public.fishing_match_tick(upper(btrim(p_code)));
  select * into m from public.fishing_matches where code = upper(btrim(p_code));
  if not found then raise exception 'match not found'; end if;
  if m.status <> 'running' or now() < m.starts_at - interval '2 seconds' or now() > m.ends_at + interval '15 seconds' then
    raise exception 'match is not running';
  end if;
  select * into p from public.fishing_match_players where match_code = m.code and player_key = p_player for update;
  if not found then raise exception 'join the match first'; end if;
  if p_index < 0 or p_index >= m.q_count then raise exception 'invalid question'; end if;
  if exists (select 1 from jsonb_array_elements(p.answers) a where (a->>'i')::integer = p_index) then raise exception 'already answered'; end if;
  q := m.questions -> p_index;
  d := least(greatest(coalesce((q->>'d')::integer, 1), 1), 3);
  ok := btrim(coalesce(p_choice, '')) = btrim(q->>'a');
  if ok then pts := 100 + 25 * (d - 1) + floor(50 * greatest(0, 1 - least(greatest(coalesce(p_ms, 30000), 0), 30000) / 30000.0))::integer; end if;
  update public.fishing_match_players set
    score = score + pts, correct = correct + ok::integer, answered = answered + 1,
    answers = answers || jsonb_build_array(jsonb_build_object('i', p_index, 'ok', ok, 'ms', least(greatest(coalesce(p_ms, 0), 0), 600000), 'pts', pts)),
    finished = (answered + 1 >= m.q_count), updated_at = now()
  where match_code = m.code and player_key = p_player;
  return jsonb_build_object('correct', ok, 'answer', q->>'a', 'explain', coalesce(q->>'e', ''), 'points', pts,
                            'score', p.score + pts, 'finished', p.answered + 1 >= m.q_count);
end $$;

-- Thưởng khi câu được cá trong trận (cá càng hiếm càng nhiều điểm, tối đa 300 điểm mỗi người).
create or replace function public.fishing_match_fish(p_code text, p_player uuid, p_tier integer)
returns integer language plpgsql security definer set search_path = public as $$
declare m public.fishing_matches%rowtype; bonus integer; got integer;
begin
  select * into m from public.fishing_matches where code = upper(btrim(p_code));
  if not found or m.status <> 'running' or now() > m.ends_at + interval '15 seconds' then return 0; end if;
  bonus := least(greatest(coalesce(p_tier, 0), 0), 5) * 10;
  update public.fishing_match_players set
    fish_bonus = least(300, fish_bonus + bonus),
    score = score + (least(300, fish_bonus + bonus) - fish_bonus),
    best_rarity = greatest(best_rarity, least(greatest(coalesce(p_tier, 0), 0), 5)), updated_at = now()
  where match_code = m.code and player_key = p_player
  returning least(300, fish_bonus) into got;
  return coalesce(got, 0);
end $$;

-- Bảng điểm trực tiếp (không lộ mã người chơi).
create or replace function public.fishing_match_board(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.fishing_matches%rowtype;
begin
  perform public.fishing_match_tick(upper(btrim(p_code)));
  select * into m from public.fishing_matches where code = upper(btrim(p_code));
  if not found then raise exception 'match not found'; end if;
  return jsonb_build_object(
    'code', m.code, 'title', m.title, 'mode', m.mode, 'live', m.live, 'status', m.status,
    'team_names', to_jsonb(m.team_names), 'team_size', m.team_size, 'q_count', m.q_count,
    'starts_at', m.starts_at, 'ends_at', m.ends_at, 'server_now', now(),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'nickname', p.nickname, 'team', p.team, 'score', p.score, 'correct', p.correct, 'answered', p.answered,
        'finished', p.finished, 'best_rarity', p.best_rarity) order by p.score desc, p.updated_at)
      from public.fishing_match_players p where p.match_code = m.code), '[]'::jsonb)
  );
end $$;

-- Báo cáo chi tiết cho chủ trận (giáo viên): đáp án đúng + từng câu của từng học sinh.
create or replace function public.fishing_match_report(p_code text, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.fishing_matches%rowtype;
begin
  select * into m from public.fishing_matches where code = upper(btrim(p_code)) and owner_key = p_owner;
  if not found then raise exception 'not the owner of this match'; end if;
  return jsonb_build_object(
    'questions', m.questions,
    'players', coalesce((select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'team', p.team, 'score', p.score,
        'correct', p.correct, 'answered', p.answered, 'answers', p.answers) order by p.score desc)
      from public.fishing_match_players p where p.match_code = m.code), '[]'::jsonb)
  );
end $$;

revoke all on function public.fishing_match_create(uuid, text, text, text[], integer, jsonb, boolean, integer) from public;
revoke all on function public.fishing_match_join(text, uuid, text, integer) from public;
revoke all on function public.fishing_match_info(text, uuid) from public;
revoke all on function public.fishing_match_start(text, uuid) from public;
revoke all on function public.fishing_match_end(text, uuid) from public;
revoke all on function public.fishing_match_answer(text, uuid, integer, text, integer) from public;
revoke all on function public.fishing_match_fish(text, uuid, integer) from public;
revoke all on function public.fishing_match_board(text) from public;
revoke all on function public.fishing_match_report(text, uuid) from public;
grant execute on function public.fishing_match_create(uuid, text, text, text[], integer, jsonb, boolean, integer) to anon, authenticated;
grant execute on function public.fishing_match_join(text, uuid, text, integer) to anon, authenticated;
grant execute on function public.fishing_match_info(text, uuid) to anon, authenticated;
grant execute on function public.fishing_match_start(text, uuid) to anon, authenticated;
grant execute on function public.fishing_match_end(text, uuid) to anon, authenticated;
grant execute on function public.fishing_match_answer(text, uuid, integer, text, integer) to anon, authenticated;
grant execute on function public.fishing_match_fish(text, uuid, integer) to anon, authenticated;
grant execute on function public.fishing_match_board(text) to anon, authenticated;
grant execute on function public.fishing_match_report(text, uuid) to anon, authenticated;
