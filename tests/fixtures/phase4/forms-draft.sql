alter table cali_workspace.forms add column description text not null default '',
  add column audience text not null default 'cali',add column confirm_email boolean not null default true,
  add column created_by uuid,add unique (slug);

alter table cali_workspace.forms add column stages jsonb;
alter table cali_workspace.form_responses add column submitted_at timestamptz not null default now(),
  add column respondent_name text,add column respondent_email text,add column stage text,add column owner text,
  add column answers jsonb not null default '{}';
