-- Run after all migrations on a test database; no application data is changed.
begin;
set local plpgsql.check_asserts = on;

do $$
declare
  api_role text;
  operation text;
begin
  assert to_regclass('public.reports') is not null,
    'Report tickets must exist in public';
  assert to_regclass('public.report_evidences') is not null,
    'Report evidence records must exist';
  assert to_regclass('public.report_histories') is not null,
    'Report history records must exist';
  assert (select relrowsecurity from pg_class where oid = 'public.reports'::regclass),
    'Report tickets must have RLS enabled';
  assert (select relrowsecurity from pg_class where oid = 'public.report_evidences'::regclass),
    'Report evidence must have RLS enabled';
  assert (select relrowsecurity from pg_class where oid = 'public.report_histories'::regclass),
    'Report history must have RLS enabled';
  assert exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'reports_pending_duplicate_uq'
  ), 'Pending duplicate reports must be protected by a unique partial index';

  foreach api_role in array array['anon', 'authenticated'] loop
    foreach operation in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      assert not has_table_privilege(api_role, 'public.reports', operation),
        'Report tickets must remain accessible only through the backend';
      assert not has_table_privilege(api_role, 'public.report_evidences', operation),
        'Report evidence must remain accessible only through the backend';
      assert not has_table_privilege(api_role, 'public.report_histories', operation),
        'Report history must remain accessible only through the backend';
    end loop;
  end loop;
end;
$$;

select 'Report schema and access checks passed' as result;
rollback;
