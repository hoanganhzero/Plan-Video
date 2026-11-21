-- Thêm loài cá (~100): nâng giới hạn số loài khi nộp điểm.
do $$ declare d text; begin
  d := pg_get_functiondef('public.fishing_submit'::regproc);
  if position('p_species > 64' in d) > 0 then execute replace(d, 'p_species > 64', 'p_species > 200'); end if;
end $$;
