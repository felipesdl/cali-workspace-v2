alter table cali_workspace.forms add column description text not null default '',
  add column audience text not null default 'cali',add column confirm_email boolean not null default true,
  add column created_by uuid,add unique (slug);
