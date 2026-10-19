-- Verified official gym directory (2026-10-19), after enum migration committed.
-- Official source references are persisted on each row.
-- Define official brand+venue names once; upserts preserve existing UUIDs
-- and links from favourite_gyms, sessions and user records.
insert into public.gyms (name,brand,city,country,grading_system,has_bouldering,has_routes,source_url)
values
  ('Arkose Didot','ARKOSE'::public.gym_brand,'Paris 14e','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Chevaleret','ARKOSE'::public.gym_brand,'Paris 13e','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Issy Bloc','ARKOSE'::public.gym_brand,'Issy-les-Moulineaux','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Issy Voie','ARKOSE'::public.gym_brand,'Issy-les-Moulineaux','FR','ARKOSE_COLOR'::public.grade_system,false,true,'https://arkose.com/ou-grimper'),
  ('Arkose Massy','ARKOSE'::public.gym_brand,'Massy','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Montmartre','ARKOSE'::public.gym_brand,'Paris 18e','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Montreuil','ARKOSE'::public.gym_brand,'Montreuil','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Nanterre','ARKOSE'::public.gym_brand,'Nanterre','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Nation','ARKOSE'::public.gym_brand,'Paris 20e','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Pantin','ARKOSE'::public.gym_brand,'Pantin','FR','ARKOSE_COLOR'::public.grade_system,true,true,'https://arkose.com/ou-grimper'),
  ('Arkose Boulogne Pont de Sèvres','ARKOSE'::public.gym_brand,'Boulogne-Billancourt','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Saint-Denis','ARKOSE'::public.gym_brand,'Saint-Denis','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Arkose Strasbourg Saint-Denis','ARKOSE'::public.gym_brand,'Paris 10e','FR','ARKOSE_COLOR'::public.grade_system,true,false,'https://arkose.com/ou-grimper'),
  ('Block''Out Cergy','BLOCKOUT'::public.gym_brand,'Cergy','FR','FONT'::public.grade_system,true,false,'https://www.blockout.fr/ou-grimper/'),
  ('Block''Out Évry','BLOCKOUT'::public.gym_brand,'Lisses','FR','FONT'::public.grade_system,true,false,'https://www.blockout.fr/ou-grimper/'),
  ('Block''Out Paris','BLOCKOUT'::public.gym_brand,'Saint-Ouen-sur-Seine','FR','FONT'::public.grade_system,true,false,'https://www.blockout.fr/ou-grimper/'),
  ('Vertical''Art Saint-Quentin-en-Yvelines','VERTICAL_ART'::public.gym_brand,'Montigny-le-Bretonneux','FR','FONT'::public.grade_system,true,false,'https://www.vertical-art.fr/escalade-paris/'),
  ('Vertical''Art Rungis','VERTICAL_ART'::public.gym_brand,'Rungis','FR','FONT'::public.grade_system,true,false,'https://www.vertical-art.fr/escalade-paris/'),
  ('Climb Up Aubervilliers','CLIMB_UP'::public.gym_brand,'Aubervilliers','FR','FONT'::public.grade_system,true,true,'https://www.climb-up.fr/les-salles/'),
  ('Climb Up Cergy','CLIMB_UP'::public.gym_brand,'Cergy','FR','FONT'::public.grade_system,true,true,'https://www.climb-up.fr/les-salles/'),
  ('Climb Up Épinay','CLIMB_UP'::public.gym_brand,'Épinay-sur-Seine','FR','FONT'::public.grade_system,false,true,'https://www.climb-up.fr/les-salles/'),
  ('Climb Up Paris Porte d''Italie','CLIMB_UP'::public.gym_brand,'Paris 13e','FR','FONT'::public.grade_system,true,true,'https://www.climb-up.fr/les-salles/'),
  ('Climbing District Bastille','CLIMBING_DISTRICT'::public.gym_brand,'Paris 12e','FR','CLIMBING_DISTRICT_COLOR'::public.grade_system,true,false,'https://climbingdistrict.com/nos-salles/'),
  ('Climbing District Buttes-Chaumont','CLIMBING_DISTRICT'::public.gym_brand,'Paris 19e','FR','CLIMBING_DISTRICT_COLOR'::public.grade_system,true,false,'https://climbingdistrict.com/nos-salles/'),
  ('Climbing District Pont-de-Neuilly','CLIMBING_DISTRICT'::public.gym_brand,'Neuilly-sur-Seine','FR','CLIMBING_DISTRICT_COLOR'::public.grade_system,true,false,'https://climbingdistrict.com/nos-salles/'),
  ('Climbing District Saint-Lazare','CLIMBING_DISTRICT'::public.gym_brand,'Paris 8e','FR','CLIMBING_DISTRICT_COLOR'::public.grade_system,false,true,'https://climbingdistrict.com/nos-salles/'),
  ('Climbing District Batignolles','CLIMBING_DISTRICT'::public.gym_brand,'Paris 17e','FR','CLIMBING_DISTRICT_COLOR'::public.grade_system,true,false,'https://climbingdistrict.com/nos-salles/'),
  ('Climbing District Sèvres-Lecourbe','CLIMBING_DISTRICT'::public.gym_brand,'Paris 15e','FR','CLIMBING_DISTRICT_COLOR'::public.grade_system,false,true,'https://climbingdistrict.com/nos-salles/'),
  ('Climbing District Annette K.','CLIMBING_DISTRICT'::public.gym_brand,'Paris 6e','FR','CLIMBING_DISTRICT_COLOR'::public.grade_system,false,true,'https://climbingdistrict.com/salle-escalade/annette-k/')
on conflict (brand, lower(name)) where external_provider is null do update set
  city = excluded.city,
  has_bouldering = excluded.has_bouldering,
  has_routes = excluded.has_routes,
  source_url = excluded.source_url,
  active = true;

-- Legacy Arkose Issy Bloc / Nanterre / Climbing District Sèvres rows receive
-- city and correct discipline flags via the upserts above.
