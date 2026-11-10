begin;
set local lock_timeout = '5s';
drop function if exists cali_workspace.v2_read_admin_portfolio(date);
notify pgrst, 'reload schema';
commit;
