-- Khối lớp (1–12) và môn học của từng server – do thầy cô chọn; học sinh trong server dùng đúng cài đặt này.
alter table public.fishing_classes
  add column if not exists grade smallint check (grade between 1 and 12),
  add column if not exists subjects text[];

create or replace function public.fishing_server_public(c public.fishing_classes)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', c.code, 'name', c.name, 'description', c.description, 'allow_join', fishing_access(c) <> 'list', 'access', fishing_access(c),
    'set_code', c.set_code, 'grade', c.grade, 'subjects', to_jsonb(c.subjects),
    'members', (select count(*) from public.fishing_class_members m where m.class_code = c.code),
    'online', (select count(*) from public.fishing_class_members m where m.class_code = c.code and m.last_seen > now() - interval '2 minutes'));
$$;
revoke all on function public.fishing_server_public(public.fishing_classes) from public, anon, authenticated;

create or replace function public.fishing_server_curriculum(p_teacher uuid, p_code text, p_grade integer, p_subjects text[])
returns void language plpgsql security definer set search_path = public as $$
declare c public.fishing_classes%rowtype; s text;
begin
  c := fishing_teacher_check(p_teacher, p_code);
  if p_grade is null or p_grade not between 1 and 12 then raise exception 'bad grade'; end if;
  if coalesce(array_length(p_subjects, 1), 0) = 0 or array_length(p_subjects, 1) > 20 then raise exception 'choose subjects'; end if;
  foreach s in array p_subjects loop
    if s !~ '^[a-z]{2,12}$' then raise exception 'bad subject'; end if;
  end loop;
  update public.fishing_classes set grade = p_grade, subjects = p_subjects where code = c.code;
end $$;
revoke all on function public.fishing_server_curriculum(uuid, text, integer, text[]) from public;
grant execute on function public.fishing_server_curriculum(uuid, text, integer, text[]) to anon, authenticated;
