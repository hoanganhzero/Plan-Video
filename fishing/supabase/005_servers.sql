-- Server lớp học: mỗi lớp của thầy cô là một "server" với thế giới riêng.
-- - Học sinh vào server bằng MÃ SERVER + TÊN + PIN (4–6 số): tự đăng ký (nếu thầy cô cho phép) hoặc dùng tài khoản thầy cô tạo sẵn.
-- - Mỗi tài khoản server có tiến trình chơi riêng, lưu trên máy chủ → máy nào cũng chơi tiếp được.
-- - PIN lưu dạng băm SHA-256 (muối = mã bí mật của tài khoản); sai 5 lần → khoá 5 phút. Thầy cô đặt lại được PIN.
-- Dựa trên bảng fishing_classes / fishing_class_members (004_chat_classes.sql).

alter table public.fishing_classes
  add column if not exists description text not null default '',
  add column if not exists allow_join boolean not null default true,
  add column if not exists set_code text;

alter table public.fishing_class_members
  add column if not exists pin_hash text,
  add column if not exists save jsonb,
  add column if not exists save_at timestamptz,
  add column if not exists fails integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists by_teacher boolean not null default false;

create or replace function public.fishing_pin_hash(p_key uuid, p_pin text)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(p_key::text || ':' || p_pin, 'UTF8')), 'hex');
$$;

create or replace function public.fishing_new_pid()
returns text language plpgsql volatile set search_path = public as $$
declare a text := 'abcdefghijkmnpqrstuvwxyz23456789'; c text; i integer;
begin
  loop
    c := 's';
    for i in 1..9 loop c := c || substr(a, 1 + floor(random() * 32)::integer, 1); end loop;
    exit when not exists (select 1 from public.fishing_chat_users where public_id = c)
          and not exists (select 1 from public.fishing_class_members where public_id = c);
  end loop;
  return c;
end $$;

-- PIN 6 số lấy từ bộ sinh ngẫu nhiên mạnh (gen_random_uuid), không dùng random().
create or replace function public.fishing_new_pin()
returns text language sql volatile set search_path = public as $$
  select lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::integer) % 1000000)::text, 6, '0');
$$;

create or replace function public.fishing_server_public(c public.fishing_classes)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', c.code, 'name', c.name, 'description', c.description, 'allow_join', c.allow_join, 'set_code', c.set_code,
    'members', (select count(*) from public.fishing_class_members m where m.class_code = c.code),
    'online', (select count(*) from public.fishing_class_members m where m.class_code = c.code and m.last_seen > now() - interval '2 minutes'));
$$;

do $$ declare f text; begin
  foreach f in array array['fishing_pin_hash(uuid,text)', 'fishing_new_pid()', 'fishing_new_pin()', 'fishing_server_public(public.fishing_classes)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Thông tin công khai của server (màn hình "Vào server").
create or replace function public.fishing_server_info(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype;
begin
  select * into c from public.fishing_classes where code = upper(p_code);
  if not found then raise exception 'class not found'; end if;
  return fishing_server_public(c);
end $$;

-- Vào server: tên đã có → kiểm tra PIN (đăng nhập); tên mới → tạo tài khoản (nếu server cho tự đăng ký).
-- Trả về mã bí mật của tài khoản (key) để máy này dùng tiếp, kèm bản lưu tiến trình.
create or replace function public.fishing_server_enter(p_code text, p_name text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; m public.fishing_class_members%rowtype; n text; k uuid; pid text; created boolean := false;
begin
  select * into c from public.fishing_classes where code = upper(p_code);
  if not found then raise exception 'class not found'; end if;
  n := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 16);
  if char_length(n) < 2 then raise exception 'bad nickname'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,6}$' then raise exception 'pin must be 4-6 digits'; end if;
  select * into m from public.fishing_class_members where class_code = c.code and lower(nickname) = lower(n);
  if found then
    if m.locked_until is not null and m.locked_until > now() then raise exception 'too many tries'; end if;
    if m.pin_hash is null then raise exception 'ask teacher for pin'; end if;
    if m.pin_hash <> fishing_pin_hash(m.player_key, p_pin) then
      -- Không "raise" ở đây: lỗi sẽ huỷ luôn việc đếm số lần sai. Trả về kết quả lỗi thay vào đó.
      update public.fishing_class_members set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
        locked_until = case when fails + 1 >= 5 then now() + interval '5 minutes' else locked_until end
      where class_code = c.code and player_key = m.player_key;
      return jsonb_build_object('error', case when m.fails + 1 >= 5 then 'too many tries' else 'wrong pin' end,
                                'tries_left', greatest(0, 4 - m.fails));
    end if;
    update public.fishing_class_members set fails = 0, locked_until = null, last_seen = now()
    where class_code = c.code and player_key = m.player_key;
  else
    if not c.allow_join then raise exception 'server is invite only'; end if;
    if (fishing_chat_filter(n)->>'bad')::boolean or n ~* '(https?:|www\.|\.com|\.vn)' then raise exception 'bad nickname'; end if;
    if (select count(*) from public.fishing_class_members where class_code = c.code) >= 80 then raise exception 'class is full'; end if;
    k := gen_random_uuid(); pid := fishing_new_pid();
    insert into public.fishing_class_members (class_code, player_key, public_id, nickname, pin_hash)
    values (c.code, k, pid, n, fishing_pin_hash(k, p_pin)) returning * into m;
    created := true;
  end if;
  insert into public.fishing_chat_users (player_key, public_id, nickname) values (m.player_key, m.public_id, m.nickname)
  on conflict (player_key) do update set nickname = excluded.nickname, last_seen = now();
  return jsonb_build_object('key', m.player_key, 'pid', m.public_id, 'name', m.nickname, 'created', created,
    'save', m.save, 'save_at', m.save_at, 'server', fishing_server_public(c));
end $$;

-- Tải tiến trình (máy đã đăng nhập trước đó).
create or replace function public.fishing_server_load(p_player uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; m public.fishing_class_members%rowtype;
begin
  select * into c from public.fishing_classes where code = upper(p_code);
  if not found then raise exception 'class not found'; end if;
  select * into m from public.fishing_class_members where class_code = c.code and player_key = p_player;
  if not found then raise exception 'join the class first'; end if;
  update public.fishing_class_members set last_seen = now() where class_code = c.code and player_key = p_player;
  return jsonb_build_object('save', m.save, 'save_at', m.save_at, 'name', m.nickname, 'pid', m.public_id, 'server', fishing_server_public(c));
end $$;

-- Lưu tiến trình + cập nhật bảng tiến độ cho thầy cô.
create or replace function public.fishing_server_save(p_player uuid, p_code text, p_save jsonb, p_progress jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if jsonb_typeof(p_save) <> 'object' or octet_length(p_save::text) > 400000 then raise exception 'save too large'; end if;
  update public.fishing_class_members set save = p_save, save_at = t, last_seen = t
  where class_code = upper(p_code) and player_key = p_player;
  if not found then raise exception 'join the class first'; end if;
  if jsonb_typeof(p_progress) = 'object' then perform fishing_class_progress(p_player, p_code, p_progress); end if;
  return t;
end $$;

-- Bảng xếp hạng trong server (chỉ thành viên xem).
create or replace function public.fishing_server_top(p_player uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.fishing_class_members where class_code = upper(p_code) and player_key = p_player) then
    raise exception 'join the class first'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('name', m.nickname, 'me', m.player_key = p_player,
      'online', m.last_seen > now() - interval '2 minutes',
      'level', coalesce((m.progress->>'level')::integer, 1), 'xp', coalesce((m.progress->>'xp')::bigint, 0),
      'fish', coalesce((m.progress->>'fish')::integer, 0), 'species', coalesce((m.progress->>'species')::integer, 0),
      'correct', coalesce((m.progress->>'correct')::integer, 0))
    order by coalesce((m.progress->>'xp')::bigint, 0) desc, m.joined_at), '[]'::jsonb)
    from public.fishing_class_members m where m.class_code = upper(p_code));
end $$;

-- ------------------------------------------------------------------ thầy cô
create or replace function public.fishing_server_config(p_teacher uuid, p_code text, p_description text, p_allow_join boolean, p_set_code text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; sc text := nullif(upper(btrim(coalesce(p_set_code, ''))), '');
begin
  c := fishing_teacher_check(p_teacher, p_code);
  if sc is not null and not exists (select 1 from public.fishing_sets where code = sc) then raise exception 'set not found'; end if;
  update public.fishing_classes set
    description = left(btrim(regexp_replace(coalesce(p_description, description), '[\u0001-\u001f<>]', '', 'g')), 200),
    allow_join = coalesce(p_allow_join, allow_join),
    set_code = case when p_set_code is null then set_code else sc end
  where code = c.code;
end $$;

-- Tạo sẵn tài khoản cho danh sách học sinh. Trả về [{name, pin}] (PIN chỉ hiện MỘT lần để in / phát).
create or replace function public.fishing_server_add_students(p_teacher uuid, p_code text, p_names text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; n text; raw text; k uuid; pin text; res jsonb := '[]'::jsonb;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  if coalesce(array_length(p_names, 1), 0) > 80 then raise exception 'too many names'; end if;
  foreach raw in array coalesce(p_names, '{}') loop
    n := left(btrim(regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g')), 16);
    continue when char_length(n) < 2;
    if exists (select 1 from public.fishing_class_members where class_code = c.code and lower(nickname) = lower(n)) then
      res := res || jsonb_build_object('name', n, 'status', 'exists'); continue; end if;
    if (select count(*) from public.fishing_class_members where class_code = c.code) >= 80 then
      res := res || jsonb_build_object('name', n, 'status', 'full'); continue; end if;
    k := gen_random_uuid();
    pin := fishing_new_pin();
    insert into public.fishing_class_members (class_code, player_key, public_id, nickname, pin_hash, by_teacher, last_seen)
    values (c.code, k, fishing_new_pid(), n, fishing_pin_hash(k, pin), true, now() - interval '1 day');
    res := res || jsonb_build_object('name', n, 'pin', pin, 'status', 'created');
  end loop;
  return res;
end $$;

-- Đặt lại PIN (học sinh quên PIN). Trả về PIN mới.
create or replace function public.fishing_server_reset_pin(p_teacher uuid, p_code text, p_pid text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; m public.fishing_class_members%rowtype; pin text;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  select * into m from public.fishing_class_members where class_code = c.code and public_id = p_pid;
  if not found then raise exception 'student not found'; end if;
  pin := fishing_new_pin();
  update public.fishing_class_members set pin_hash = fishing_pin_hash(m.player_key, pin), fails = 0, locked_until = null
  where class_code = c.code and player_key = m.player_key;
  return pin;
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'fishing_server_info(text)', 'fishing_server_enter(text,text,text)', 'fishing_server_load(uuid,text)',
    'fishing_server_save(uuid,text,jsonb,jsonb)', 'fishing_server_top(uuid,text)',
    'fishing_server_config(uuid,text,text,boolean,text)', 'fishing_server_add_students(uuid,text,text[])',
    'fishing_server_reset_pin(uuid,text,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- Bảng điều khiển thầy cô: thêm thông tin server (mô tả, tự đăng ký, bộ đề) và tài khoản (có PIN, ai tạo, lần lưu cuối, đang bị khoá).
create or replace function public.fishing_class_dashboard(p_teacher uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  return jsonb_build_object('code', c.code, 'name', c.name, 'chat_on', c.chat_on, 'dm_on', c.dm_on, 'created_at', c.created_at, 'server_now', now(),
    'description', c.description, 'allow_join', c.allow_join, 'set_code', c.set_code,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('pid', m.public_id, 'name', m.nickname, 'progress', m.progress,
        'joined_at', m.joined_at, 'last_seen', m.last_seen, 'online', m.last_seen > now() - interval '2 minutes',
        'muted_until', case when m.muted_until > now() then m.muted_until end,
        'account', m.pin_hash is not null, 'by_teacher', m.by_teacher, 'saved_at', m.save_at,
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
