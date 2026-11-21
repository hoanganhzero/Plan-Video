-- Bộ đề sách giáo khoa: mỗi câu có thể mang thêm t (dạng câu), l (tên bài), r (nội dung liên quan).
-- Nới giới hạn chia sẻ: tối đa 1000 câu, 1,5 MB; kiểm tra độ dài các trường mới.
create or replace function public.fishing_set_publish(p_owner uuid, p_name text, p_payload jsonb, p_code text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  nm text := left(btrim(coalesce(p_name, '')), 80);
  n integer;
  new_code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tries integer := 0;
begin
  if p_owner is null then raise exception 'missing owner key'; end if;
  if nm = '' then raise exception 'set name required'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' then raise exception 'payload must be an array'; end if;
  n := jsonb_array_length(p_payload);
  if n < 1 or n > 1000 then raise exception 'a set needs 1-1000 questions'; end if;
  if pg_column_size(p_payload) > 1500000 then raise exception 'set is too large'; end if;
  if exists (select 1 from jsonb_array_elements(p_payload) e
             where jsonb_typeof(e) <> 'object' or coalesce(e->>'q', '') = '' or coalesce(e->>'a', '') = ''
               or jsonb_typeof(e->'w') <> 'array'
               or length(coalesce(e->>'r', '')) > 600 or length(coalesce(e->>'l', '')) > 200 or length(coalesce(e->>'t', '')) > 12) then
    raise exception 'every question needs q, a and w';
  end if;

  if p_code is not null then
    update public.fishing_sets set name = nm, payload = p_payload, question_count = n, updated_at = now()
    where code = upper(p_code) and owner_key = p_owner;
    if found then return upper(p_code); end if;
  end if;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.fishing_sets where code = new_code);
    tries := tries + 1;
    if tries > 20 then raise exception 'could not allocate a code'; end if;
  end loop;
  insert into public.fishing_sets (code, name, payload, question_count, owner_key) values (new_code, nm, p_payload, n, p_owner);
  return new_code;
end $$;
