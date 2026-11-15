-- Trò chuyện, Lớp học (thầy cô) và Quản trị (admin) cho "Câu Cá Học Giỏi".
-- Phòng chat:
--   zone:<khu>                 chat chung ở hồ (mọi người cùng khu)
--   class:<MÃ LỚP>             chat của lớp (thầy cô xem và quản lý)
--   match:<MÃ TRẬN>            chat trong trận thi đấu (chủ trận quản lý)
--   dm:<MÃ LỚP>:<id1>:<id2>    nhắn riêng 1-1 giữa hai bạn CÙNG LỚP (thầy cô của lớp xem được)
-- Mọi tin nhắn qua bộ lọc ở máy chủ: che từ tục, số điện thoại, đường link, email; giới hạn tốc độ;
-- 3 tin bị lọc trong 10 phút → tự cấm chat 10 phút; 3 bạn báo cáo một tin → tin tự ẩn.
-- Bảng khoá bằng RLS (không có policy); chỉ truy cập qua các hàm security definer bên dưới.

-- ------------------------------------------------------------------ bảng
create table public.fishing_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.fishing_settings (key, value) values ('chat_all', 'true'), ('chat_public', 'true'), ('chat_dm', 'true');

create table public.fishing_admins (
  code_hash text primary key,          -- sha256 của mã quản trị
  label text not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.fishing_chat_users (
  player_key uuid primary key,
  public_id text not null unique check (public_id ~ '^[a-z0-9]{6,24}$'),
  nickname text not null check (char_length(nickname) between 2 and 16),
  banned_until timestamptz,
  ban_reason text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table public.fishing_classes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 60),
  teacher_key uuid not null,
  chat_on boolean not null default true,
  dm_on boolean not null default true,
  created_at timestamptz not null default now()
);
create index fishing_classes_teacher on public.fishing_classes (teacher_key);

create table public.fishing_class_members (
  class_code text not null references public.fishing_classes(code) on delete cascade,
  player_key uuid not null,
  public_id text not null,
  nickname text not null check (char_length(nickname) between 2 and 16),
  progress jsonb not null default '{}'::jsonb,
  muted_until timestamptz,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (class_code, player_key)
);
create unique index fishing_class_members_nick on public.fishing_class_members (class_code, lower(nickname));
create index fishing_class_members_player on public.fishing_class_members (player_key);

create table public.fishing_chat (
  id bigint generated always as identity primary key,
  room text not null check (char_length(room) <= 80),
  player_key uuid not null,
  public_id text not null,
  nickname text not null,
  body text not null check (char_length(body) between 1 and 400),
  flagged boolean not null default false,
  hidden boolean not null default false,
  hidden_by text,
  created_at timestamptz not null default now()
);
create index fishing_chat_room on public.fishing_chat (room, id);
create index fishing_chat_player on public.fishing_chat (player_key, created_at);
create index fishing_chat_created on public.fishing_chat (created_at);

create table public.fishing_chat_reports (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.fishing_chat(id) on delete cascade,
  reporter_key uuid not null,
  reason text not null default '',
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_key)
);
create index fishing_chat_reports_open on public.fishing_chat_reports (status, message_id);

do $$ declare t text; begin
  foreach t in array array['fishing_settings','fishing_admins','fishing_chat_users','fishing_classes',
                           'fishing_class_members','fishing_chat','fishing_chat_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ tiện ích nội bộ
create or replace function public.fishing_setting(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::text = 'true' from public.fishing_settings where key = p_key), true);
$$;

create or replace function public.fishing_new_code()
returns text language plpgsql volatile set search_path = public as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text := ''; i integer;
begin
  for i in 1..6 loop c := c || substr(a, 1 + floor(random() * 32)::integer, 1); end loop;
  return c;
end $$;

-- Bỏ dấu tiếng Việt (giữ nguyên độ dài chuỗi).
create or replace function public.fishing_fold(p text)
returns text language sql immutable set search_path = public as $$
  select translate(lower(p),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd');
$$;

-- Bộ lọc tin nhắn. Trả về {body, flagged, bad}: bad = có từ tục (tính vào lần vi phạm),
-- flagged = có gì bị che (kể cả số điện thoại / link).
create or replace function public.fishing_chat_filter(p_body text)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  s text; before text; toks text[]; out text[] := '{}'; i integer; k text; k2 text; f text; nxt text;
  bad boolean := false; masked boolean := false; mask_next boolean := false;
  words text := '^(dm|dcm|dkm|dmm|đm|đcm|đkm|đmm|vl|vcl|vkl|vlz|cl|clm|clgt|cmm|ml|địt|đit|dit|đụ|đéo|lồn|loz|lìn|buồi|buoi|cặc|đĩ|cứt|khốn|fuck\w*|fck|shit\w*|bitch\w*|dick|pussy|bastard|asshole|stfu|wtf)$';
  pairs text[] := array['oc cho','me may','bo may','do cho','thang cho','con cho cai','du ma','dit me','dit con','do ngu','thang ngu','con ngu','oc lon','mat lon','vai lon','vai ca','con di','do khon','thang khon','im mom','cut di','cut me'];
begin
  s := regexp_replace(coalesce(p_body, ''), '[\u0001-\u001f<>]', '', 'g');
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));
  if s = '' then return jsonb_build_object('body', '', 'flagged', false, 'bad', false); end if;
  before := s;
  -- email, link, tên miền, số điện thoại → ***
  s := regexp_replace(s, '\S+@\S+\.\S+', '***', 'gi');
  s := regexp_replace(s, '(https?://|www\.)\S+', '***', 'gi');
  s := regexp_replace(s, '\S+\.(com|vn|net|org|io|me|xyz|ly|gg|tk|info|link|site)(/\S*)?', '***', 'gi');
  s := regexp_replace(s, '\+?\d[\d .\-]{7,}\d', '***', 'g');
  masked := s <> before;
  toks := string_to_array(s, ' ');
  for i in 1..coalesce(array_length(toks, 1), 0) loop
    k := lower(regexp_replace(toks[i], '[[:punct:]…“”‘’]', '', 'g'));
    k2 := regexp_replace(k, '(.)\1+', '\1', 'g');
    f := fishing_fold(k2);
    nxt := case when i < array_length(toks, 1) then fishing_fold(regexp_replace(lower(regexp_replace(toks[i + 1], '[[:punct:]…“”‘’]', '', 'g')), '(.)\1+', '\1', 'g')) else null end;
    if mask_next then
      out := out || repeat('*', greatest(1, char_length(toks[i])));
      mask_next := false;
    elsif k <> '' and (k ~ words or k2 ~ words or k ~ '^cc+$' or (k ~ '^[a-z0-9]+$' and f ~ words)) then
      out := out || repeat('*', greatest(1, char_length(toks[i]))); bad := true;
    elsif nxt is not null and (f || ' ' || nxt) = any (pairs) then
      out := out || repeat('*', greatest(1, char_length(toks[i]))); bad := true; mask_next := true;
    else
      out := out || toks[i];
    end if;
  end loop;
  s := array_to_string(out, ' ');
  return jsonb_build_object('body', left(s, 200), 'flagged', bad or masked, 'bad', bad);
end $$;

-- Ai được đọc / viết phòng nào. Trả về null nếu được phép, ngược lại là mã lỗi.
create or replace function public.fishing_chat_access(p_key uuid, p_room text, p_write boolean)
returns text language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_room, ':'); me public.fishing_chat_users%rowtype; c public.fishing_classes%rowtype; m public.fishing_class_members%rowtype;
begin
  select * into me from public.fishing_chat_users where player_key = p_key;
  if p_write then
    if not fishing_setting('chat_all') then return 'chat is turned off'; end if;
    if me.player_key is null then return 'say hello first'; end if;
    if me.banned_until is not null and me.banned_until > now() then return 'you are muted'; end if;
  end if;
  if parts[1] = 'zone' and array_length(parts, 1) = 2 and parts[2] ~ '^[a-z]{2,16}$' then
    if p_write and not fishing_setting('chat_public') then return 'lake chat is off'; end if;
    return null;
  elsif parts[1] = 'class' and array_length(parts, 1) = 2 then
    select * into c from public.fishing_classes where code = parts[2];
    if not found then return 'class not found'; end if;
    select * into m from public.fishing_class_members where class_code = c.code and player_key = p_key;
    if not found then return 'join the class first'; end if;
    if p_write and not c.chat_on then return 'class chat is off'; end if;
    if p_write and m.muted_until is not null and m.muted_until > now() then return 'you are muted'; end if;
    return null;
  elsif parts[1] = 'match' and array_length(parts, 1) = 2 then
    if exists (select 1 from public.fishing_match_players where match_code = parts[2] and player_key = p_key)
       or exists (select 1 from public.fishing_matches where code = parts[2] and owner_key = p_key) then return null; end if;
    return 'join the match first';
  elsif parts[1] = 'dm' and array_length(parts, 1) = 4 and parts[3] < parts[4] then
    select * into c from public.fishing_classes where code = parts[2];
    if not found then return 'class not found'; end if;
    select * into m from public.fishing_class_members where class_code = c.code and player_key = p_key;
    if not found or m.public_id not in (parts[3], parts[4]) then return 'not your conversation'; end if;
    if (select count(*) from public.fishing_class_members where class_code = c.code and public_id in (parts[3], parts[4])) < 2 then
      return 'not your conversation'; end if;
    if p_write and (not c.dm_on or not fishing_setting('chat_dm')) then return 'private chat is off'; end if;
    if p_write and m.muted_until is not null and m.muted_until > now() then return 'you are muted'; end if;
    return null;
  end if;
  return 'bad room';
end $$;

-- Người có quyền quản lý phòng: thầy cô của lớp (phòng lớp và tin riêng trong lớp) hoặc chủ trận.
create or replace function public.fishing_chat_moderates(p_key uuid, p_room text)
returns boolean language sql stable security definer set search_path = public as $$
  select case split_part(p_room, ':', 1)
    when 'class' then exists (select 1 from public.fishing_classes where code = split_part(p_room, ':', 2) and teacher_key = p_key)
    when 'dm'    then exists (select 1 from public.fishing_classes where code = split_part(p_room, ':', 2) and teacher_key = p_key)
    when 'match' then exists (select 1 from public.fishing_matches where code = split_part(p_room, ':', 2) and owner_key = p_key)
    else false end;
$$;

create or replace function public.fishing_msg_json(c public.fishing_chat, p_key uuid, p_full boolean)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', c.id, 'pid', c.public_id, 'name', c.nickname, 'body', c.body, 'at', c.created_at,
                            'mine', c.player_key = p_key)
      || case when p_full then jsonb_build_object('room', c.room, 'flagged', c.flagged, 'hidden', c.hidden, 'hidden_by', c.hidden_by,
            'reports', (select count(*) from public.fishing_chat_reports r where r.message_id = c.id and r.status = 'open')) else '{}'::jsonb end;
$$;

do $$ declare f text; begin
  foreach f in array array['fishing_setting(text)','fishing_new_code()','fishing_fold(text)','fishing_chat_filter(text)',
    'fishing_chat_access(uuid,text,boolean)','fishing_chat_moderates(uuid,text)','fishing_msg_json(public.fishing_chat,uuid,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ------------------------------------------------------------------ học sinh: chat
create or replace function public.fishing_chat_hello(p_player uuid, p_public_id text, p_nickname text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g')); u public.fishing_chat_users%rowtype; f jsonb;
begin
  if p_player is null or coalesce(p_public_id, '') !~ '^[a-z0-9]{6,24}$' then raise exception 'bad player'; end if;
  f := fishing_chat_filter(n);
  if char_length(n) < 2 or (f->>'bad')::boolean or n ~* '(https?:|www\.|\.com|\.vn)' then raise exception 'bad nickname'; end if;
  n := left(n, 16);
  if exists (select 1 from public.fishing_chat_users where public_id = p_public_id and player_key <> p_player) then
    raise exception 'public id taken'; end if;
  insert into public.fishing_chat_users (player_key, public_id, nickname) values (p_player, p_public_id, n)
  on conflict (player_key) do update set nickname = excluded.nickname, public_id = excluded.public_id, last_seen = now()
  returning * into u;
  return jsonb_build_object('pid', u.public_id, 'name', u.nickname,
    'muted_until', case when u.banned_until > now() then u.banned_until end, 'reason', u.ban_reason,
    'chat_all', fishing_setting('chat_all'), 'chat_public', fishing_setting('chat_public'), 'chat_dm', fishing_setting('chat_dm'));
end $$;

create or replace function public.fishing_chat_send(p_player uuid, p_room text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; u public.fishing_chat_users%rowtype; f jsonb; nick text; c public.fishing_chat%rowtype; recent integer;
begin
  err := fishing_chat_access(p_player, p_room, true);
  if err is not null then raise exception '%', err; end if;
  select * into u from public.fishing_chat_users where player_key = p_player;
  if char_length(coalesce(p_body, '')) > 200 then raise exception 'message too long'; end if;
  f := fishing_chat_filter(p_body);
  if f->>'body' = '' then raise exception 'empty message'; end if;
  if exists (select 1 from public.fishing_chat where player_key = p_player and created_at > now() - interval '1.5 seconds')
     or (select count(*) from public.fishing_chat where player_key = p_player and created_at > now() - interval '1 minute') >= 12
     or exists (select 1 from public.fishing_chat where player_key = p_player and room = p_room and body = f->>'body' and created_at > now() - interval '20 seconds')
  then raise exception 'slow down'; end if;
  nick := u.nickname;
  if p_room like 'class:%' or p_room like 'dm:%' then
    select m.nickname into nick from public.fishing_class_members m where m.class_code = split_part(p_room, ':', 2) and m.player_key = p_player;
  elsif p_room like 'match:%' then
    select coalesce((select p.nickname from public.fishing_match_players p where p.match_code = split_part(p_room, ':', 2) and p.player_key = p_player), '👩‍🏫 ' || left(u.nickname, 13)) into nick;
  end if;
  insert into public.fishing_chat (room, player_key, public_id, nickname, body, flagged)
  values (p_room, p_player, u.public_id, nick, f->>'body', (f->>'flagged')::boolean) returning * into c;
  update public.fishing_chat_users set last_seen = now() where player_key = p_player;
  -- 3 tin có từ tục trong 10 phút → tự cấm chat 10 phút
  if (f->>'bad')::boolean then
    select count(*) into recent from public.fishing_chat where player_key = p_player and flagged and created_at > now() - interval '10 minutes'
      and body ~ '\*\*';
    if recent >= 3 then
      update public.fishing_chat_users set banned_until = now() + interval '10 minutes', ban_reason = 'Tự động: dùng từ ngữ không phù hợp'
      where player_key = p_player;
    end if;
  end if;
  if random() < 0.02 then delete from public.fishing_chat where created_at < now() - interval '30 days'; end if;
  return fishing_msg_json(c, p_player, false) || jsonb_build_object('filtered', (f->>'flagged')::boolean);
end $$;

-- Lấy tin mới của nhiều phòng một lần. p_cursors = {"zone:pond": 0, "class:ABCDEF": 123}
create or replace function public.fishing_chat_poll(p_player uuid, p_cursors jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; res jsonb := '{}'::jsonb; msgs jsonb; hid jsonb; n integer := 0; u public.fishing_chat_users%rowtype;
begin
  if jsonb_typeof(p_cursors) <> 'object' then raise exception 'bad cursors'; end if;
  for r in select key, value from jsonb_each(p_cursors) loop
    n := n + 1;
    exit when n > 12;
    if fishing_chat_access(p_player, r.key, false) is not null then
      res := res || jsonb_build_object(r.key, jsonb_build_object('error', fishing_chat_access(p_player, r.key, false)));
      continue;
    end if;
    select coalesce(jsonb_agg(fishing_msg_json(x, p_player, false) order by x.id), '[]'::jsonb) into msgs from (
      select * from public.fishing_chat c where c.room = r.key and not c.hidden
        and c.id > coalesce((r.value)::text::bigint, 0) and c.created_at > now() - interval '7 days'
      order by c.id desc limit 40) x;
    select coalesce(jsonb_agg(c.id), '[]'::jsonb) into hid from public.fishing_chat c
      where c.room = r.key and c.hidden and c.created_at > now() - interval '2 hours';
    res := res || jsonb_build_object(r.key, jsonb_build_object('messages', msgs, 'hidden', hid));
  end loop;
  update public.fishing_chat_users set last_seen = now() where player_key = p_player returning * into u;
  update public.fishing_class_members set last_seen = now() where player_key = p_player;
  return jsonb_build_object('rooms', res, 'server_now', now(),
    'muted_until', case when u.banned_until > now() then u.banned_until end,
    'chat_all', fishing_setting('chat_all'), 'chat_public', fishing_setting('chat_public'), 'chat_dm', fishing_setting('chat_dm'));
end $$;

create or replace function public.fishing_chat_report(p_player uuid, p_message bigint, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare c public.fishing_chat%rowtype; n integer;
begin
  select * into c from public.fishing_chat where id = p_message;
  if not found then raise exception 'message not found'; end if;
  if fishing_chat_access(p_player, c.room, false) is not null then raise exception 'not your conversation'; end if;
  if c.player_key = p_player then raise exception 'cannot report yourself'; end if;
  insert into public.fishing_chat_reports (message_id, reporter_key, reason)
  values (p_message, p_player, left(coalesce(p_reason, ''), 60)) on conflict do nothing;
  select count(*) into n from public.fishing_chat_reports where message_id = p_message;
  if n >= 3 and not c.hidden then update public.fishing_chat set hidden = true, hidden_by = 'báo cáo' where id = p_message; end if;
  return n;
end $$;

-- ------------------------------------------------------------------ học sinh: lớp học
create or replace function public.fishing_class_join(p_player uuid, p_public_id text, p_code text, p_nickname text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; u jsonb;
begin
  u := fishing_chat_hello(p_player, p_public_id, p_nickname);
  select * into c from public.fishing_classes where code = upper(p_code);
  if not found then raise exception 'class not found'; end if;
  if (select count(*) from public.fishing_class_members where class_code = c.code) >= 80 then raise exception 'class is full'; end if;
  begin
    insert into public.fishing_class_members (class_code, player_key, public_id, nickname)
    values (c.code, p_player, p_public_id, u->>'name')
    on conflict (class_code, player_key) do update set nickname = excluded.nickname, public_id = excluded.public_id, last_seen = now();
  exception when unique_violation then raise exception 'nickname already used in this class';
  end;
  return fishing_class_me(p_player, c.code);
end $$;

create or replace function public.fishing_class_me(p_player uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; m public.fishing_class_members%rowtype;
begin
  select * into c from public.fishing_classes where code = upper(p_code);
  if not found then raise exception 'class not found'; end if;
  select * into m from public.fishing_class_members where class_code = c.code and player_key = p_player;
  if not found then raise exception 'join the class first'; end if;
  update public.fishing_class_members set last_seen = now() where class_code = c.code and player_key = p_player;
  return jsonb_build_object('code', c.code, 'name', c.name, 'chat_on', c.chat_on, 'dm_on', c.dm_on and fishing_setting('chat_dm'),
    'me', jsonb_build_object('pid', m.public_id, 'name', m.nickname, 'muted_until', case when m.muted_until > now() then m.muted_until end),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('pid', x.public_id, 'name', x.nickname,
                  'online', x.last_seen > now() - interval '2 minutes',
                  'level', coalesce((x.progress->>'level')::integer, 1)) order by lower(x.nickname)), '[]'::jsonb)
                from public.fishing_class_members x where x.class_code = c.code),
    -- các cuộc nhắn riêng của mình (để báo tin mới)
    'dms', (select coalesce(jsonb_agg(jsonb_build_object('room', d.room, 'last_id', d.last_id) order by d.last_id desc), '[]'::jsonb)
            from (select room, max(id) last_id from public.fishing_chat
                  where room like 'dm:' || c.code || ':%' and (split_part(room, ':', 3) = m.public_id or split_part(room, ':', 4) = m.public_id)
                    and not hidden group by room order by max(id) desc limit 8) d));
end $$;

create or replace function public.fishing_class_leave(p_player uuid, p_code text)
returns void language sql security definer set search_path = public as $$
  delete from public.fishing_class_members where class_code = upper(p_code) and player_key = p_player;
$$;

-- Tiến độ học tập gửi cho thầy cô (chỉ các số liệu đã biết, giới hạn kích thước).
create or replace function public.fishing_class_progress(p_player uuid, p_code text, p_progress jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; clean jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_progress) <> 'object' then raise exception 'bad progress'; end if;
  foreach k in array array['level','xp','coins','fish','species','casts','correct','wrong','streak','best_streak','quests','legendary','review'] loop
    if jsonb_typeof(p_progress->k) = 'number' then
      clean := clean || jsonb_build_object(k, least(greatest((p_progress->>k)::numeric, 0), 1e9)::bigint); end if;
  end loop;
  foreach k in array array['zone','best_fish','rod','title'] loop
    if jsonb_typeof(p_progress->k) = 'string' then clean := clean || jsonb_build_object(k, left(p_progress->>k, 40)); end if;
  end loop;
  if jsonb_typeof(p_progress->'subjects') = 'object' and char_length((p_progress->'subjects')::text) < 1500 then
    clean := clean || jsonb_build_object('subjects', p_progress->'subjects'); end if;
  update public.fishing_class_members set progress = clean, last_seen = now()
  where class_code = upper(p_code) and player_key = p_player;
  if not found then raise exception 'join the class first'; end if;
end $$;

-- ------------------------------------------------------------------ thầy cô
create or replace function public.fishing_teacher_check(p_teacher uuid, p_code text)
returns public.fishing_classes language plpgsql stable security definer set search_path = public as $$
declare c public.fishing_classes%rowtype;
begin
  select * into c from public.fishing_classes where code = upper(p_code);
  if not found then raise exception 'class not found'; end if;
  if c.teacher_key <> p_teacher then raise exception 'not the teacher of this class'; end if;
  return c;
end $$;
revoke all on function public.fishing_teacher_check(uuid, text) from public, anon, authenticated;

create or replace function public.fishing_class_create(p_teacher uuid, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare c text; tries integer := 0; n text := btrim(regexp_replace(coalesce(p_name, ''), '[\u0001-\u001f<>]', '', 'g'));
begin
  if p_teacher is null then raise exception 'bad teacher'; end if;
  if n = '' then raise exception 'class name required'; end if;
  if (select count(*) from public.fishing_classes where teacher_key = p_teacher) >= 30 then raise exception 'too many classes'; end if;
  loop
    c := fishing_new_code(); tries := tries + 1;
    exit when not exists (select 1 from public.fishing_classes where code = c)
          and not exists (select 1 from public.fishing_matches where code = c);
    if tries > 20 then raise exception 'try again'; end if;
  end loop;
  insert into public.fishing_classes (code, name, teacher_key) values (c, left(n, 60), p_teacher);
  return c;
end $$;

create or replace function public.fishing_class_list(p_teacher uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name, 'chat_on', c.chat_on, 'dm_on', c.dm_on, 'created_at', c.created_at,
    'members', (select count(*) from public.fishing_class_members m where m.class_code = c.code),
    'online', (select count(*) from public.fishing_class_members m where m.class_code = c.code and m.last_seen > now() - interval '2 minutes'),
    'reports', (select count(distinct r.message_id) from public.fishing_chat_reports r join public.fishing_chat x on x.id = r.message_id
                where r.status = 'open' and (x.room = 'class:' || c.code or x.room like 'dm:' || c.code || ':%'))
  ) order by c.created_at desc), '[]'::jsonb)
  from public.fishing_classes c where c.teacher_key = p_teacher;
$$;

create or replace function public.fishing_class_dashboard(p_teacher uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  return jsonb_build_object('code', c.code, 'name', c.name, 'chat_on', c.chat_on, 'dm_on', c.dm_on, 'created_at', c.created_at, 'server_now', now(),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('pid', m.public_id, 'name', m.nickname, 'progress', m.progress,
        'joined_at', m.joined_at, 'last_seen', m.last_seen, 'online', m.last_seen > now() - interval '2 minutes',
        'muted_until', case when m.muted_until > now() then m.muted_until end,
        'messages', (select count(*) from public.fishing_chat x where x.player_key = m.player_key and (x.room = 'class:' || c.code or x.room like 'dm:' || c.code || ':%')),
        'flagged', (select count(*) from public.fishing_chat x where x.player_key = m.player_key and x.flagged and (x.room = 'class:' || c.code or x.room like 'dm:' || c.code || ':%'))
      ) order by lower(m.nickname)), '[]'::jsonb) from public.fishing_class_members m where m.class_code = c.code),
    'dms', (select coalesce(jsonb_agg(jsonb_build_object('room', d.room, 'count', d.n, 'last_at', d.last_at,
        'a', (select nickname from public.fishing_class_members where class_code = c.code and public_id = split_part(d.room, ':', 3)),
        'b', (select nickname from public.fishing_class_members where class_code = c.code and public_id = split_part(d.room, ':', 4)),
        'flagged', d.flagged) order by d.last_at desc), '[]'::jsonb)
      from (select room, count(*) n, max(created_at) last_at, count(*) filter (where flagged) flagged from public.fishing_chat
            where room like 'dm:' || c.code || ':%' group by room) d),
    'reports', (select coalesce(jsonb_agg(fishing_msg_json(x, p_teacher, true) order by x.id desc), '[]'::jsonb)
      from public.fishing_chat x where (x.room = 'class:' || c.code or x.room like 'dm:' || c.code || ':%')
        and exists (select 1 from public.fishing_chat_reports r where r.message_id = x.id and r.status = 'open'))
  );
end $$;

create or replace function public.fishing_class_update(p_teacher uuid, p_code text, p_name text, p_chat_on boolean, p_dm_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; n text := btrim(regexp_replace(coalesce(p_name, ''), '[\u0001-\u001f<>]', '', 'g'));
begin
  c := fishing_teacher_check(p_teacher, p_code);
  update public.fishing_classes set name = case when n = '' then name else left(n, 60) end,
    chat_on = coalesce(p_chat_on, chat_on), dm_on = coalesce(p_dm_on, dm_on) where code = c.code;
end $$;

-- action: mute (p_minutes) | unmute | kick
create or replace function public.fishing_class_member(p_teacher uuid, p_code text, p_pid text, p_action text, p_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  if p_action = 'mute' then
    update public.fishing_class_members set muted_until = now() + make_interval(mins => least(greatest(coalesce(p_minutes, 10), 1), 60 * 24 * 30))
    where class_code = c.code and public_id = p_pid;
  elsif p_action = 'unmute' then
    update public.fishing_class_members set muted_until = null where class_code = c.code and public_id = p_pid;
  elsif p_action = 'kick' then
    delete from public.fishing_class_members where class_code = c.code and public_id = p_pid;
  else raise exception 'bad action'; end if;
  if not found then raise exception 'student not found'; end if;
end $$;

create or replace function public.fishing_class_delete(p_teacher uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  delete from public.fishing_chat where room = 'class:' || c.code or room like 'dm:' || c.code || ':%';
  delete from public.fishing_classes where code = c.code;
end $$;

-- Thầy cô / chủ trận xem tin (kể cả tin đã ẩn và bị lọc) của phòng mình quản lý.
create or replace function public.fishing_mod_messages(p_key uuid, p_room text, p_before bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not fishing_chat_moderates(p_key, p_room) then raise exception 'not allowed'; end if;
  return (select coalesce(jsonb_agg(fishing_msg_json(x, p_key, true) order by x.id), '[]'::jsonb) from (
    select * from public.fishing_chat c where c.room = p_room and (p_before is null or c.id < p_before) order by c.id desc limit 100) x);
end $$;

create or replace function public.fishing_mod_hide(p_key uuid, p_message bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.fishing_chat%rowtype;
begin
  select * into c from public.fishing_chat where id = p_message;
  if not found then raise exception 'message not found'; end if;
  if not fishing_chat_moderates(p_key, c.room) then raise exception 'not allowed'; end if;
  update public.fishing_chat set hidden = p_hidden, hidden_by = case when p_hidden then 'thầy cô' end where id = p_message;
  update public.fishing_chat_reports set status = 'done' where message_id = p_message;
end $$;

create or replace function public.fishing_mod_report_done(p_key uuid, p_message bigint)
returns void language plpgsql security definer set search_path = public as $$
declare c public.fishing_chat%rowtype;
begin
  select * into c from public.fishing_chat where id = p_message;
  if not found then raise exception 'message not found'; end if;
  if not fishing_chat_moderates(p_key, c.room) then raise exception 'not allowed'; end if;
  update public.fishing_chat_reports set status = 'done' where message_id = p_message;
end $$;

-- ------------------------------------------------------------------ admin
create or replace function public.fishing_admin_check(p_admin text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_admin is null or char_length(p_admin) < 12 or not exists (
    select 1 from public.fishing_admins where code_hash = encode(sha256(convert_to(p_admin, 'UTF8')), 'hex')) then
    raise exception 'not admin';
  end if;
end $$;
revoke all on function public.fishing_admin_check(text) from public, anon, authenticated;

create or replace function public.fishing_admin_overview(p_admin text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  return jsonb_build_object(
    'players', (select count(*) from public.fishing_scores),
    'chatters', (select count(*) from public.fishing_chat_users),
    'online', (select count(*) from public.fishing_chat_users where last_seen > now() - interval '2 minutes'),
    'classes', (select count(*) from public.fishing_classes),
    'students', (select count(*) from public.fishing_class_members),
    'matches', (select count(*) from public.fishing_matches),
    'sets', (select count(*) from public.fishing_sets),
    'messages_24h', (select count(*) from public.fishing_chat where created_at > now() - interval '24 hours'),
    'flagged_24h', (select count(*) from public.fishing_chat where flagged and created_at > now() - interval '24 hours'),
    'open_reports', (select count(distinct message_id) from public.fishing_chat_reports where status = 'open'),
    'banned', (select count(*) from public.fishing_chat_users where banned_until > now()),
    'settings', (select jsonb_object_agg(key, value) from public.fishing_settings),
    'server_now', now());
end $$;

create or replace function public.fishing_admin_messages(p_admin text, p_filter text, p_search text, p_before bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  return (select coalesce(jsonb_agg(fishing_msg_json(x, null, true) order by x.id desc), '[]'::jsonb) from (
    select * from public.fishing_chat c
    where (p_before is null or c.id < p_before)
      and case coalesce(p_filter, 'all')
            when 'reported' then exists (select 1 from public.fishing_chat_reports r where r.message_id = c.id and r.status = 'open')
            when 'flagged' then c.flagged
            when 'hidden' then c.hidden
            else true end
      and (coalesce(p_search, '') = '' or c.body ilike '%' || p_search || '%' or c.nickname ilike '%' || p_search || '%'
           or c.public_id = p_search or c.room ilike '%' || p_search || '%')
    order by c.id desc limit 100) x);
end $$;

create or replace function public.fishing_admin_hide(p_admin text, p_message bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  update public.fishing_chat set hidden = p_hidden, hidden_by = case when p_hidden then 'quản trị' end where id = p_message;
  update public.fishing_chat_reports set status = 'done' where message_id = p_message;
end $$;

create or replace function public.fishing_admin_report_done(p_admin text, p_message bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  update public.fishing_chat_reports set status = 'done' where message_id = p_message;
end $$;

create or replace function public.fishing_admin_users(p_admin text, p_search text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  return (select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.last_seen desc), '[]'::jsonb) from (
    select u.public_id pid, u.nickname name, u.created_at, u.last_seen,
      case when u.banned_until > now() then u.banned_until end banned_until, u.ban_reason,
      (select count(*) from public.fishing_chat c where c.player_key = u.player_key) messages,
      (select count(*) from public.fishing_chat c where c.player_key = u.player_key and c.flagged) flagged,
      (select count(*) from public.fishing_chat_reports r join public.fishing_chat c on c.id = r.message_id where c.player_key = u.player_key) reported,
      (select string_agg(m.class_code, ', ') from public.fishing_class_members m where m.player_key = u.player_key) classes
    from public.fishing_chat_users u
    where coalesce(p_search, '') = '' or u.nickname ilike '%' || p_search || '%' or u.public_id = p_search
    order by u.last_seen desc limit 200) x);
end $$;

-- p_hours = 0 → bỏ cấm. p_purge → ẩn toàn bộ tin của người này.
create or replace function public.fishing_admin_ban(p_admin text, p_pid text, p_hours integer, p_reason text, p_purge boolean)
returns void language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  perform fishing_admin_check(p_admin);
  select player_key into k from public.fishing_chat_users where public_id = p_pid;
  if k is null then raise exception 'player not found'; end if;
  update public.fishing_chat_users set
    banned_until = case when coalesce(p_hours, 0) > 0 then now() + make_interval(hours => least(p_hours, 24 * 365)) end,
    ban_reason = case when coalesce(p_hours, 0) > 0 then left(coalesce(nullif(p_reason, ''), 'Vi phạm quy định trò chuyện'), 80) end
  where player_key = k;
  if p_purge then update public.fishing_chat set hidden = true, hidden_by = 'quản trị' where player_key = k; end if;
end $$;

create or replace function public.fishing_admin_classes(p_admin text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  return (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name, 'chat_on', c.chat_on, 'dm_on', c.dm_on, 'created_at', c.created_at,
    'members', (select count(*) from public.fishing_class_members m where m.class_code = c.code),
    'messages', (select count(*) from public.fishing_chat x where x.room = 'class:' || c.code or x.room like 'dm:' || c.code || ':%')
  ) order by c.created_at desc), '[]'::jsonb) from public.fishing_classes c);
end $$;

create or replace function public.fishing_admin_class_delete(p_admin text, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  delete from public.fishing_chat where room = 'class:' || p_code or room like 'dm:' || p_code || ':%';
  delete from public.fishing_classes where code = p_code;
end $$;

-- Bảng xếp hạng: xoá biệt danh không phù hợp. handle = 12 ký tự đầu md5 của mã người chơi.
create or replace function public.fishing_admin_scores(p_admin text, p_search text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  return (select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.xp desc), '[]'::jsonb) from (
    select left(md5(s.player_key::text), 12) handle, s.nickname name, s.xp, s.level, s.species, s.correct, s.updated_at,
      (fishing_chat_filter(s.nickname)->>'bad')::boolean suspicious
    from public.fishing_scores s
    where coalesce(p_search, '') = '' or s.nickname ilike '%' || p_search || '%'
    order by s.xp desc limit 200) x);
end $$;

create or replace function public.fishing_admin_score_delete(p_admin text, p_handle text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  delete from public.fishing_scores where left(md5(player_key::text), 12) = p_handle;
  if not found then raise exception 'player not found'; end if;
end $$;

create or replace function public.fishing_admin_setting(p_admin text, p_key text, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fishing_admin_check(p_admin);
  if p_key not in ('chat_all', 'chat_public', 'chat_dm') then raise exception 'bad setting'; end if;
  insert into public.fishing_settings (key, value) values (p_key, to_jsonb(p_value))
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- ------------------------------------------------------------------ quyền gọi hàm công khai
do $$ declare f text; begin
  foreach f in array array[
    'fishing_chat_hello(uuid,text,text)', 'fishing_chat_send(uuid,text,text)', 'fishing_chat_poll(uuid,jsonb)',
    'fishing_chat_report(uuid,bigint,text)',
    'fishing_class_join(uuid,text,text,text)', 'fishing_class_me(uuid,text)', 'fishing_class_leave(uuid,text)',
    'fishing_class_progress(uuid,text,jsonb)',
    'fishing_class_create(uuid,text)', 'fishing_class_list(uuid)', 'fishing_class_dashboard(uuid,text)',
    'fishing_class_update(uuid,text,text,boolean,boolean)', 'fishing_class_member(uuid,text,text,text,integer)',
    'fishing_class_delete(uuid,text)', 'fishing_mod_messages(uuid,text,bigint)', 'fishing_mod_hide(uuid,bigint,boolean)',
    'fishing_mod_report_done(uuid,bigint)',
    'fishing_admin_overview(text)', 'fishing_admin_messages(text,text,text,bigint)', 'fishing_admin_hide(text,bigint,boolean)',
    'fishing_admin_report_done(text,bigint)', 'fishing_admin_users(text,text)', 'fishing_admin_ban(text,text,integer,text,boolean)',
    'fishing_admin_classes(text)', 'fishing_admin_class_delete(text,text)', 'fishing_admin_scores(text,text)',
    'fishing_admin_score_delete(text,text)', 'fishing_admin_setting(text,text,boolean)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- Tạo mã quản trị (chạy riêng trong SQL editor, thay MÃ_BÍ_MẬT bằng chuỗi dài ≥ 12 ký tự):
--   insert into public.fishing_admins (code_hash, label)
--   values (encode(sha256(convert_to('MÃ_BÍ_MẬT', 'UTF8')), 'hex'), 'admin chính');
