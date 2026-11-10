-- Contexto descartável, com guardas de sessão/termos/Equipe da V2 sintética.
\ir ../../../tests/fixtures/team/monthly-context.sql

alter table cali_workspace.profiles add column email text;
update cali_workspace.profiles set email = case id
  when '00000000-0000-4000-8000-000000000011' then 'client-a@synthetic.invalid'
  when '00000000-0000-4000-8000-000000000012' then 'client-b@synthetic.invalid'
  when '00000000-0000-4000-8000-000000000015' then 'client-b2@synthetic.invalid'
  else null end;
grant usage on schema cali_workspace to anon, service_role;

create function cali_workspace.profile_signer_snapshot()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'full_name', 'Responsável sintética CALI',
    'job_title', 'Responsável técnica de teste',
    'avatar_url', 'https://synthetic.invalid/avatar.png',
    'avatar_position_x', 50,
    'avatar_position_y', 50,
    'avatar_zoom', 100,
    'signature_mode', 'synthetic_fixture',
    'signature_url', 'https://synthetic.invalid/signature.png',
    'signature_style', 'synthetic_fixture'
  );
$$;

CREATE OR REPLACE FUNCTION cali_workspace.profile_tally(p_answers jsonb, p_blocks integer)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select jsonb_object_agg(s.style, jsonb_build_object('raw', s.raw, 'pct', round(((s.raw + p_blocks)::numeric / (2 * p_blocks)) * 100)::int))
    from (
      select st.style,
             coalesce(sum(case when a->>'mais' = st.style then 1 when a->>'menos' = st.style then -1 else 0 end), 0)::int as raw
        from (values ('D'), ('I'), ('S'), ('C')) as st(style)
        left join jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) a on true
       group by st.style
    ) s;
$function$;
