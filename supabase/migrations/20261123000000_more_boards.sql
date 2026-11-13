-- More training boards: the other Aurora boards a BoardLib logbook can come
-- from (Decoy, Grasshopper, Touchstone, So iLL, Aurora). Only the list of
-- allowed board names grows; no existing row or column changes meaning.

alter table public.sessions drop constraint sessions_board_check;
alter table public.sessions add constraint sessions_board_check
  check (board in ('KILTER', 'TENSION', 'MOON', 'DECOY', 'GRASSHOPPER', 'TOUCHSTONE', 'SOILL', 'AURORA'));

alter table public.board_ascents drop constraint board_ascents_board_check;
alter table public.board_ascents add constraint board_ascents_board_check
  check (board in ('KILTER', 'TENSION', 'MOON', 'DECOY', 'GRASSHOPPER', 'TOUCHSTONE', 'SOILL', 'AURORA'));

alter table public.board_projects drop constraint board_projects_board_check;
alter table public.board_projects add constraint board_projects_board_check
  check (board in ('KILTER', 'TENSION', 'MOON', 'DECOY', 'GRASSHOPPER', 'TOUCHSTONE', 'SOILL', 'AURORA'));
