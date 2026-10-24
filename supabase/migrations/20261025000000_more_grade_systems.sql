-- New native grading scales used by Paris networks (values only; used by the next migration).
-- Sources: blockout.fr (B1–B14), climb-up.fr/faq (7 colours), vertical-art.fr/faq (7 colours, Bleau reference).
alter type public.grade_system add value if not exists 'BLOCKOUT_LEVEL';
alter type public.grade_system add value if not exists 'CLIMB_UP_COLOR';
alter type public.grade_system add value if not exists 'VERTICAL_ART_COLOR';
