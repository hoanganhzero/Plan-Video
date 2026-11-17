-- Tài khoản học sinh dùng chung cho mọi server.
-- - Học sinh tạo MỘT tài khoản: tên đăng nhập (duy nhất) + tên hiển thị + PIN 4–6 số. Đăng nhập ở máy nào cũng được.
-- - Thế giới cá nhân lưu theo tài khoản; mỗi server vẫn có tiến trình riêng (fishing_class_members.save).
-- - Thầy cô chọn cách vào server: 'open' (tự do), 'pin' (cần mã PIN của server), 'list' (chỉ tài khoản thầy cô tạo).

create table public.fishing_accounts (
  account_key uuid primary key default gen_random_uuid(),   -- mã bí mật, chỉ máy đã đăng nhập giữ
  username text not null check (username ~ '^[a-z0-9._]{3,20}$'),
  nickname text not null check (char_length(nickname) between 2 and 16),
  pin_hash text not null,
  fails integer not null default 0,
  locked_until timestamptz,
  save jsonb,
  save_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create unique index fishing_accounts_username on public.fishing_accounts (username);
alter table public.fishing_accounts enable row level security;
revoke all on public.fishing_accounts from anon, authenticated;

alter table public.fishing_classes
  add column if not exists access text not null default 'open' check (access in ('open', 'pin', 'list')),
  add column if not exists pin_hash text;
-- Cách vào thực tế: lớp cũ đã tắt tự đăng ký (allow_join = false) được coi là 'list' – không cần sửa dữ liệu cũ.
create or replace function public.fishing_access(c public.fishing_classes)
returns text language sql immutable set search_path = public as $$
  select case when c.access = 'open' and not c.allow_join then 'list' else c.access end;
$$;
revoke all on function public.fishing_access(public.fishing_classes) from public, anon, authenticated;

alter table public.fishing_class_members add column if not exists account_key uuid references public.fishing_accounts(account_key) on delete set null;
create unique index if not exists fishing_class_members_account on public.fishing_class_members (class_code, account_key) where account_key is not null;

-- Thông tin công khai của server: thêm cách vào.
create or replace function public.fishing_server_public(c public.fishing_classes)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', c.code, 'name', c.name, 'description', c.description, 'allow_join', fishing_access(c) <> 'list', 'access', fishing_access(c),
    'set_code', c.set_code,
    'members', (select count(*) from public.fishing_class_members m where m.class_code = c.code),
    'online', (select count(*) from public.fishing_class_members m where m.class_code = c.code and m.last_seen > now() - interval '2 minutes'));
$$;
revoke all on function public.fishing_server_public(public.fishing_classes) from public, anon, authenticated;

-- ------------------------------------------------------------------ tài khoản
create or replace function public.fishing_account_json(a public.fishing_accounts)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('key', a.account_key, 'username', a.username, 'nickname', a.nickname, 'save_at', a.save_at,
    'servers', (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name, 'nick', m.nickname,
        'save_at', m.save_at, 'last_seen', m.last_seen, 'access', fishing_access(c)) order by m.last_seen desc), '[]'::jsonb)
      from public.fishing_class_members m join public.fishing_classes c on c.code = m.class_code where m.account_key = a.account_key));
$$;
revoke all on function public.fishing_account_json(public.fishing_accounts) from public, anon, authenticated;

create or replace function public.fishing_account_register(p_username text, p_nickname text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u text := lower(btrim(coalesce(p_username, ''))); n text := left(btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g')), 16);
  a public.fishing_accounts%rowtype; k uuid := gen_random_uuid();
begin
  if u !~ '^[a-z0-9._]{3,20}$' then raise exception 'bad username'; end if;
  if char_length(n) < 2 or (fishing_chat_filter(n)->>'bad')::boolean or (fishing_chat_filter(u)->>'bad')::boolean
     or n ~* '(https?:|www\.|\.com|\.vn)' then raise exception 'bad nickname'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,6}$' then raise exception 'pin must be 4-6 digits'; end if;
  if exists (select 1 from public.fishing_accounts where username = u) then raise exception 'username taken'; end if;
  insert into public.fishing_accounts (account_key, username, nickname, pin_hash) values (k, u, n, fishing_pin_hash(k, p_pin)) returning * into a;
  return fishing_account_json(a);
end $$;

-- Đăng nhập: sai PIN trả về lỗi (không "raise" để giữ được số lần sai); sai 5 lần → khoá 5 phút.
create or replace function public.fishing_account_login(p_username text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.fishing_accounts%rowtype;
begin
  select * into a from public.fishing_accounts where username = lower(btrim(coalesce(p_username, '')));
  if not found then return jsonb_build_object('error', 'account not found'); end if;
  if a.locked_until is not null and a.locked_until > now() then return jsonb_build_object('error', 'too many tries'); end if;
  if a.pin_hash <> fishing_pin_hash(a.account_key, coalesce(p_pin, '')) then
    update public.fishing_accounts set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
      locked_until = case when fails + 1 >= 5 then now() + interval '5 minutes' else locked_until end
    where account_key = a.account_key;
    return jsonb_build_object('error', case when a.fails + 1 >= 5 then 'too many tries' else 'wrong pin' end, 'tries_left', greatest(0, 4 - a.fails));
  end if;
  update public.fishing_accounts set fails = 0, locked_until = null, last_seen = now() where account_key = a.account_key returning * into a;
  return fishing_account_json(a) || jsonb_build_object('save', a.save);
end $$;

create or replace function public.fishing_account_me(p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.fishing_accounts%rowtype;
begin
  update public.fishing_accounts set last_seen = now() where account_key = p_key returning * into a;
  if not found then raise exception 'account not found'; end if;
  return fishing_account_json(a) || jsonb_build_object('save', a.save);
end $$;

create or replace function public.fishing_account_save(p_key uuid, p_save jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if jsonb_typeof(p_save) <> 'object' or octet_length(p_save::text) > 400000 then raise exception 'save too large'; end if;
  update public.fishing_accounts set save = p_save, save_at = t, last_seen = t where account_key = p_key;
  if not found then raise exception 'account not found'; end if;
  return t;
end $$;

create or replace function public.fishing_account_change_pin(p_key uuid, p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.fishing_accounts%rowtype;
begin
  select * into a from public.fishing_accounts where account_key = p_key;
  if not found then raise exception 'account not found'; end if;
  if a.pin_hash <> fishing_pin_hash(a.account_key, coalesce(p_old, '')) then raise exception 'wrong pin'; end if;
  if coalesce(p_new, '') !~ '^[0-9]{4,6}$' then raise exception 'pin must be 4-6 digits'; end if;
  update public.fishing_accounts set pin_hash = fishing_pin_hash(a.account_key, p_new) where account_key = p_key;
end $$;

-- Vào một server bằng tài khoản. Đã là thành viên → vào thẳng. Chưa → theo cách vào của server.
create or replace function public.fishing_server_join(p_key uuid, p_code text, p_server_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.fishing_accounts%rowtype; c public.fishing_classes%rowtype; m public.fishing_class_members%rowtype;
  n text; i integer := 1; k uuid; created boolean := false;
begin
  select * into a from public.fishing_accounts where account_key = p_key;
  if not found then raise exception 'account not found'; end if;
  select * into c from public.fishing_classes where code = upper(p_code);
  if not found then raise exception 'class not found'; end if;
  select * into m from public.fishing_class_members where class_code = c.code and account_key = a.account_key;
  if not found then
    if fishing_access(c) = 'list' then raise exception 'server is invite only'; end if;
    if fishing_access(c) = 'pin' then
      if a.locked_until is not null and a.locked_until > now() then raise exception 'too many tries'; end if;
      if c.pin_hash is null or c.pin_hash <> encode(sha256(convert_to(c.code || ':' || coalesce(p_server_pin, ''), 'UTF8')), 'hex') then
        update public.fishing_accounts set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
          locked_until = case when fails + 1 >= 5 then now() + interval '5 minutes' else locked_until end
        where account_key = a.account_key;
        return jsonb_build_object('error', case when a.fails + 1 >= 5 then 'too many tries' else 'wrong server pin' end, 'tries_left', greatest(0, 4 - a.fails));
      end if;
    end if;
    if (select count(*) from public.fishing_class_members where class_code = c.code) >= 80 then raise exception 'class is full'; end if;
    -- Tên trong server: tên hiển thị của tài khoản; trùng thì thêm số.
    n := a.nickname;
    while exists (select 1 from public.fishing_class_members where class_code = c.code and lower(nickname) = lower(n)) loop
      i := i + 1; n := left(a.nickname, 13) || ' ' || i;
    end loop;
    k := gen_random_uuid();
    insert into public.fishing_class_members (class_code, player_key, public_id, nickname, account_key)
    values (c.code, k, fishing_new_pid(), n, a.account_key) returning * into m;
    created := true;
  end if;
  update public.fishing_accounts set fails = 0, locked_until = null, last_seen = now() where account_key = a.account_key;
  update public.fishing_class_members set last_seen = now() where class_code = c.code and player_key = m.player_key;
  insert into public.fishing_chat_users (player_key, public_id, nickname) values (m.player_key, m.public_id, m.nickname)
  on conflict (player_key) do update set nickname = excluded.nickname, last_seen = now();
  return jsonb_build_object('key', m.player_key, 'pid', m.public_id, 'name', m.nickname, 'created', created,
    'save', m.save, 'save_at', m.save_at, 'server', fishing_server_public(c));
end $$;

-- ------------------------------------------------------------------ thầy cô: cách vào server
create or replace function public.fishing_server_access(p_teacher uuid, p_code text, p_access text, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  if p_access not in ('open', 'pin', 'list') then raise exception 'bad access'; end if;
  if p_access = 'pin' and coalesce(p_pin, '') !~ '^[0-9]{4,6}$' and c.pin_hash is null then raise exception 'pin must be 4-6 digits'; end if;
  update public.fishing_classes set access = p_access, allow_join = p_access <> 'list',
    pin_hash = case when coalesce(p_pin, '') ~ '^[0-9]{4,6}$' then encode(sha256(convert_to(c.code || ':' || p_pin, 'UTF8')), 'hex') else pin_hash end
  where code = c.code;
end $$;

-- Thầy cô đặt lại PIN tài khoản chung của học sinh trong server mình (khi em quên PIN).
create or replace function public.fishing_server_reset_account_pin(p_teacher uuid, p_code text, p_pid text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; m public.fishing_class_members%rowtype; a public.fishing_accounts%rowtype; pin text;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  select * into m from public.fishing_class_members where class_code = c.code and public_id = p_pid;
  if not found or m.account_key is null then raise exception 'student not found'; end if;
  select * into a from public.fishing_accounts where account_key = m.account_key;
  pin := fishing_new_pin();
  update public.fishing_accounts set pin_hash = fishing_pin_hash(a.account_key, pin), fails = 0, locked_until = null where account_key = a.account_key;
  return jsonb_build_object('username', a.username, 'pin', pin);
end $$;

-- Quản trị: đặt lại PIN tài khoản theo tên đăng nhập.
create or replace function public.fishing_admin_account_reset(p_admin text, p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare a public.fishing_accounts%rowtype; pin text;
begin
  perform fishing_admin_check(p_admin);
  select * into a from public.fishing_accounts where username = lower(btrim(coalesce(p_username, '')));
  if not found then raise exception 'account not found'; end if;
  pin := fishing_new_pin();
  update public.fishing_accounts set pin_hash = fishing_pin_hash(a.account_key, pin), fails = 0, locked_until = null where account_key = a.account_key;
  return pin;
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'fishing_account_register(text,text,text)', 'fishing_account_login(text,text)', 'fishing_account_me(uuid)',
    'fishing_account_save(uuid,jsonb)', 'fishing_account_change_pin(uuid,text,text)', 'fishing_server_join(uuid,text,text)',
    'fishing_server_access(uuid,text,text,text)', 'fishing_server_reset_account_pin(uuid,text,text)',
    'fishing_admin_account_reset(text,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- Vào bằng "tên + PIN riêng của server" giờ chỉ để ĐĂNG NHẬP tài khoản đã có (thầy cô tạo sẵn / đăng ký trước đây).
-- Học sinh mới phải dùng tài khoản chung (để tôn trọng cách vào server: tự do / cần PIN server / chỉ danh sách).
create or replace function public.fishing_server_enter(p_code text, p_name text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; m public.fishing_class_members%rowtype; n text;
begin
  select * into c from public.fishing_classes where code = upper(p_code);
  if not found then raise exception 'class not found'; end if;
  n := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 16);
  if char_length(n) < 2 then raise exception 'bad nickname'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,6}$' then raise exception 'pin must be 4-6 digits'; end if;
  select * into m from public.fishing_class_members where class_code = c.code and lower(nickname) = lower(n);
  if not found then return jsonb_build_object('error', 'name not in server'); end if;
  if m.locked_until is not null and m.locked_until > now() then raise exception 'too many tries'; end if;
  if m.pin_hash is null then return jsonb_build_object('error', case when m.account_key is not null then 'use account' else 'ask teacher for pin' end); end if;
  if m.pin_hash <> fishing_pin_hash(m.player_key, p_pin) then
    update public.fishing_class_members set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
      locked_until = case when fails + 1 >= 5 then now() + interval '5 minutes' else locked_until end
    where class_code = c.code and player_key = m.player_key;
    return jsonb_build_object('error', case when m.fails + 1 >= 5 then 'too many tries' else 'wrong pin' end, 'tries_left', greatest(0, 4 - m.fails));
  end if;
  update public.fishing_class_members set fails = 0, locked_until = null, last_seen = now()
  where class_code = c.code and player_key = m.player_key;
  insert into public.fishing_chat_users (player_key, public_id, nickname) values (m.player_key, m.public_id, m.nickname)
  on conflict (player_key) do update set nickname = excluded.nickname, last_seen = now();
  return jsonb_build_object('key', m.player_key, 'pid', m.public_id, 'name', m.nickname, 'created', false,
    'save', m.save, 'save_at', m.save_at, 'server', fishing_server_public(c));
end $$;

-- Bảng điều khiển: thêm cách vào server và tên đăng nhập của tài khoản chung.
create or replace function public.fishing_class_dashboard(p_teacher uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  return jsonb_build_object('code', c.code, 'name', c.name, 'chat_on', c.chat_on, 'dm_on', c.dm_on, 'created_at', c.created_at, 'server_now', now(),
    'description', c.description, 'allow_join', fishing_access(c) <> 'list', 'access', fishing_access(c), 'has_pin', c.pin_hash is not null, 'set_code', c.set_code,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('pid', m.public_id, 'name', m.nickname, 'progress', m.progress,
        'joined_at', m.joined_at, 'last_seen', m.last_seen, 'online', m.last_seen > now() - interval '2 minutes',
        'muted_until', case when m.muted_until > now() then m.muted_until end,
        'account', m.pin_hash is not null or m.account_key is not null, 'by_teacher', m.by_teacher, 'saved_at', m.save_at,
        'username', (select a.username from public.fishing_accounts a where a.account_key = m.account_key),
        'locked', m.locked_until is not null and m.locked_until > now(),
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
