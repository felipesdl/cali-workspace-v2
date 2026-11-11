\ir partner-review.sql
create table public.mapa_respostas(id uuid primary key,protocolo text,status text,created_at timestamptz default now(),
  c_email text,observacoes jsonb not null default '{}',diagnostico_v2 jsonb,
  d1_rh_hoje integer,d1_processos integer,d1_cargos_salarios integer,d2_valores integer,
  d2_lideres_preparo integer,d2_comportamento_dono integer,d2_sucessao integer,d3_indicadores integer,
  d3_decisao integer,d3_custo integer,d4_colaboradores integer,d4_unidades integer,d4_turnover integer);
