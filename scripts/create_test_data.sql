-- Create 25 test servidores with Spanish names
-- Note: Usernames and passwords will be created through the API

-- First, let's clear existing test data (optional, comment out if you want to keep existing data)
-- DELETE FROM assignments;
-- DELETE FROM service_dates;
-- DELETE FROM schedules;
-- DELETE FROM person_jobs;
-- DELETE FROM users WHERE role = 'servidor';
-- DELETE FROM people;

-- Insert 25 test servidores
INSERT INTO people (id, first_name, last_name, email, phone, preferred_frequency, max_consecutive_weeks, preference_level, active, notes)
VALUES
-- Monaguillos only (10)
('p1', 'Diego', 'García', 'diego.garcia@email.com', '5551001001', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p2', 'Sofía', 'Martínez', 'sofia.martinez@email.com', '5551001002', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p3', 'Mateo', 'López', 'mateo.lopez@email.com', '5551001003', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p4', 'Valentina', 'Rodríguez', 'valentina.rodriguez@email.com', '5551001004', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p5', 'Sebastián', 'Hernández', 'sebastian.hernandez@email.com', '5551001005', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p6', 'Camila', 'González', 'camila.gonzalez@email.com', '5551001006', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p7', 'Emiliano', 'Sánchez', 'emiliano.sanchez@email.com', '5551001007', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p8', 'María José', 'Ramírez', 'mariajose.ramirez@email.com', '5551001008', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p9', 'Santiago', 'Torres', 'santiago.torres@email.com', '5551001009', 'bimonthly', 2, 5, true, 'Monaguillo'),
('p10', 'Isabella', 'Flores', 'isabella.flores@email.com', '5551001010', 'bimonthly', 2, 5, true, 'Monaguillo'),

-- Lectores only (10)
('p11', 'Carlos', 'Rivera', 'carlos.rivera@email.com', '5551001011', 'bimonthly', 2, 5, true, 'Lector'),
('p12', 'Ana', 'Morales', 'ana.morales@email.com', '5551001012', 'bimonthly', 2, 5, true, 'Lector'),
('p13', 'Fernando', 'Reyes', 'fernando.reyes@email.com', '5551001013', 'bimonthly', 2, 5, true, 'Lector'),
('p14', 'Gabriela', 'Cruz', 'gabriela.cruz@email.com', '5551001014', 'bimonthly', 2, 5, true, 'Lector'),
('p15', 'Roberto', 'Ortiz', 'roberto.ortiz@email.com', '5551001015', 'bimonthly', 2, 5, true, 'Lector'),
('p16', 'Patricia', 'Vargas', 'patricia.vargas@email.com', '5551001016', 'bimonthly', 2, 5, true, 'Lector'),
('p17', 'Luis', 'Castillo', 'luis.castillo@email.com', '5551001017', 'bimonthly', 2, 5, true, 'Lector'),
('p18', 'Elena', 'Mendoza', 'elena.mendoza@email.com', '5551001018', 'bimonthly', 2, 5, true, 'Lector'),
('p19', 'Miguel', 'Ramos', 'miguel.ramos@email.com', '5551001019', 'bimonthly', 2, 5, true, 'Lector'),
('p20', 'Laura', 'Jiménez', 'laura.jimenez@email.com', '5551001020', 'bimonthly', 2, 5, true, 'Lector'),

-- Both Monaguillos and Lectores (5)
('p21', 'Andrés', 'Pérez', 'andres.perez@email.com', '5551001021', 'weekly', 2, 7, true, 'Monaguillo y Lector'),
('p22', 'Mariana', 'Díaz', 'mariana.diaz@email.com', '5551001022', 'weekly', 2, 7, true, 'Monaguillo y Lector'),
('p23', 'Javier', 'Aguilar', 'javier.aguilar@email.com', '5551001023', 'weekly', 2, 7, true, 'Monaguillo y Lector'),
('p24', 'Natalia', 'Vega', 'natalia.vega@email.com', '5551001024', 'weekly', 2, 7, true, 'Monaguillo y Lector'),
('p25', 'Ricardo', 'Núñez', 'ricardo.nunez@email.com', '5551001025', 'weekly', 2, 7, true, 'Monaguillo y Lector')
ON CONFLICT (id) DO NOTHING;

-- Assign jobs to people
-- Monaguillos only
INSERT INTO person_jobs (id, person_id, job_id) VALUES
('pj1', 'p1', 'monaguillos'),
('pj2', 'p2', 'monaguillos'),
('pj3', 'p3', 'monaguillos'),
('pj4', 'p4', 'monaguillos'),
('pj5', 'p5', 'monaguillos'),
('pj6', 'p6', 'monaguillos'),
('pj7', 'p7', 'monaguillos'),
('pj8', 'p8', 'monaguillos'),
('pj9', 'p9', 'monaguillos'),
('pj10', 'p10', 'monaguillos')
ON CONFLICT DO NOTHING;

-- Lectores only
INSERT INTO person_jobs (id, person_id, job_id) VALUES
('pj11', 'p11', 'lectores'),
('pj12', 'p12', 'lectores'),
('pj13', 'p13', 'lectores'),
('pj14', 'p14', 'lectores'),
('pj15', 'p15', 'lectores'),
('pj16', 'p16', 'lectores'),
('pj17', 'p17', 'lectores'),
('pj18', 'p18', 'lectores'),
('pj19', 'p19', 'lectores'),
('pj20', 'p20', 'lectores')
ON CONFLICT DO NOTHING;

-- Both Monaguillos and Lectores
INSERT INTO person_jobs (id, person_id, job_id) VALUES
('pj21a', 'p21', 'monaguillos'),
('pj21b', 'p21', 'lectores'),
('pj22a', 'p22', 'monaguillos'),
('pj22b', 'p22', 'lectores'),
('pj23a', 'p23', 'monaguillos'),
('pj23b', 'p23', 'lectores'),
('pj24a', 'p24', 'monaguillos'),
('pj24b', 'p24', 'lectores'),
('pj25a', 'p25', 'monaguillos'),
('pj25b', 'p25', 'lectores')
ON CONFLICT DO NOTHING;

-- Note: Users for servidores will be created through the API when needed
-- This is because the passwords need to be properly hashed with Argon2

-- Create schedules for January, February, and April 2026
INSERT INTO schedules (id, name, year, month, status, published_at)
VALUES
('sched_jan_2026', 'Enero 2026', 2026, 1, 'PUBLISHED', NOW()),
('sched_feb_2026', 'Febrero 2026', 2026, 2, 'PUBLISHED', NOW()),
('sched_apr_2026', 'Abril 2026', 2026, 4, 'PUBLISHED', NOW())
ON CONFLICT (year, month) DO NOTHING;

-- Create service dates (Sundays) for January 2026
INSERT INTO service_dates (id, schedule_id, service_date) VALUES
('sd_jan_4', 'sched_jan_2026', '2026-01-04'),
('sd_jan_11', 'sched_jan_2026', '2026-01-11'),
('sd_jan_18', 'sched_jan_2026', '2026-01-18'),
('sd_jan_25', 'sched_jan_2026', '2026-01-25')
ON CONFLICT DO NOTHING;

-- Create service dates for February 2026
INSERT INTO service_dates (id, schedule_id, service_date) VALUES
('sd_feb_1', 'sched_feb_2026', '2026-02-01'),
('sd_feb_8', 'sched_feb_2026', '2026-02-08'),
('sd_feb_15', 'sched_feb_2026', '2026-02-15'),
('sd_feb_22', 'sched_feb_2026', '2026-02-22')
ON CONFLICT DO NOTHING;

-- Create service dates for April 2026
INSERT INTO service_dates (id, schedule_id, service_date) VALUES
('sd_apr_5', 'sched_apr_2026', '2026-04-05'),
('sd_apr_12', 'sched_apr_2026', '2026-04-12'),
('sd_apr_19', 'sched_apr_2026', '2026-04-19'),
('sd_apr_26', 'sched_apr_2026', '2026-04-26')
ON CONFLICT DO NOTHING;

-- Create assignments for January 2026
-- January 4 - Monaguillos
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_jan4_m1', 'sd_jan_4', 'monaguillos', 'p1', 1, 'Ciriales'),
('a_jan4_m2', 'sd_jan_4', 'monaguillos', 'p2', 2, 'Naveta'),
('a_jan4_m3', 'sd_jan_4', 'monaguillos', 'p3', 3, 'Vinajeras'),
('a_jan4_m4', 'sd_jan_4', 'monaguillos', 'p4', 4, 'Libro')
ON CONFLICT DO NOTHING;

-- January 4 - Lectores
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_jan4_l1', 'sd_jan_4', 'lectores', 'p11', 1, 'Primera Lectura'),
('a_jan4_l2', 'sd_jan_4', 'lectores', 'p12', 2, 'Segunda Lectura'),
('a_jan4_l3', 'sd_jan_4', 'lectores', 'p13', 3, 'Peticiones'),
('a_jan4_l4', 'sd_jan_4', 'lectores', 'p14', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- January 11 - Monaguillos
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_jan11_m1', 'sd_jan_11', 'monaguillos', 'p5', 1, 'Ciriales'),
('a_jan11_m2', 'sd_jan_11', 'monaguillos', 'p6', 2, 'Naveta'),
('a_jan11_m3', 'sd_jan_11', 'monaguillos', 'p7', 3, 'Vinajeras'),
('a_jan11_m4', 'sd_jan_11', 'monaguillos', 'p8', 4, 'Libro')
ON CONFLICT DO NOTHING;

-- January 11 - Lectores
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_jan11_l1', 'sd_jan_11', 'lectores', 'p15', 1, 'Primera Lectura'),
('a_jan11_l2', 'sd_jan_11', 'lectores', 'p16', 2, 'Segunda Lectura'),
('a_jan11_l3', 'sd_jan_11', 'lectores', 'p17', 3, 'Peticiones'),
('a_jan11_l4', 'sd_jan_11', 'lectores', 'p18', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- January 18 - Monaguillos (using people who do both)
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_jan18_m1', 'sd_jan_18', 'monaguillos', 'p9', 1, 'Ciriales'),
('a_jan18_m2', 'sd_jan_18', 'monaguillos', 'p10', 2, 'Naveta'),
('a_jan18_m3', 'sd_jan_18', 'monaguillos', 'p21', 3, 'Vinajeras'),
('a_jan18_m4', 'sd_jan_18', 'monaguillos', 'p22', 4, 'Libro')
ON CONFLICT DO NOTHING;

-- January 18 - Lectores
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_jan18_l1', 'sd_jan_18', 'lectores', 'p19', 1, 'Primera Lectura'),
('a_jan18_l2', 'sd_jan_18', 'lectores', 'p20', 2, 'Segunda Lectura'),
('a_jan18_l3', 'sd_jan_18', 'lectores', 'p23', 3, 'Peticiones'),
('a_jan18_l4', 'sd_jan_18', 'lectores', 'p24', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- January 25 - Monaguillos
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_jan25_m1', 'sd_jan_25', 'monaguillos', 'p1', 1, 'Ciriales'),
('a_jan25_m2', 'sd_jan_25', 'monaguillos', 'p3', 2, 'Naveta'),
('a_jan25_m3', 'sd_jan_25', 'monaguillos', 'p5', 3, 'Vinajeras'),
('a_jan25_m4', 'sd_jan_25', 'monaguillos', 'p7', 4, 'Libro')
ON CONFLICT DO NOTHING;

-- January 25 - Lectores
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_jan25_l1', 'sd_jan_25', 'lectores', 'p11', 1, 'Primera Lectura'),
('a_jan25_l2', 'sd_jan_25', 'lectores', 'p13', 2, 'Segunda Lectura'),
('a_jan25_l3', 'sd_jan_25', 'lectores', 'p15', 3, 'Peticiones'),
('a_jan25_l4', 'sd_jan_25', 'lectores', 'p25', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- February assignments
-- February 1
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_feb1_m1', 'sd_feb_1', 'monaguillos', 'p2', 1, 'Ciriales'),
('a_feb1_m2', 'sd_feb_1', 'monaguillos', 'p4', 2, 'Naveta'),
('a_feb1_m3', 'sd_feb_1', 'monaguillos', 'p6', 3, 'Vinajeras'),
('a_feb1_m4', 'sd_feb_1', 'monaguillos', 'p8', 4, 'Libro'),
('a_feb1_l1', 'sd_feb_1', 'lectores', 'p12', 1, 'Primera Lectura'),
('a_feb1_l2', 'sd_feb_1', 'lectores', 'p14', 2, 'Segunda Lectura'),
('a_feb1_l3', 'sd_feb_1', 'lectores', 'p16', 3, 'Peticiones'),
('a_feb1_l4', 'sd_feb_1', 'lectores', 'p18', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- February 8
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_feb8_m1', 'sd_feb_8', 'monaguillos', 'p9', 1, 'Ciriales'),
('a_feb8_m2', 'sd_feb_8', 'monaguillos', 'p10', 2, 'Naveta'),
('a_feb8_m3', 'sd_feb_8', 'monaguillos', 'p1', 3, 'Vinajeras'),
('a_feb8_m4', 'sd_feb_8', 'monaguillos', 'p2', 4, 'Libro'),
('a_feb8_l1', 'sd_feb_8', 'lectores', 'p19', 1, 'Primera Lectura'),
('a_feb8_l2', 'sd_feb_8', 'lectores', 'p20', 2, 'Segunda Lectura'),
('a_feb8_l3', 'sd_feb_8', 'lectores', 'p21', 3, 'Peticiones'),
('a_feb8_l4', 'sd_feb_8', 'lectores', 'p22', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- February 15
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_feb15_m1', 'sd_feb_15', 'monaguillos', 'p3', 1, 'Ciriales'),
('a_feb15_m2', 'sd_feb_15', 'monaguillos', 'p5', 2, 'Naveta'),
('a_feb15_m3', 'sd_feb_15', 'monaguillos', 'p7', 3, 'Vinajeras'),
('a_feb15_m4', 'sd_feb_15', 'monaguillos', 'p23', 4, 'Libro'),
('a_feb15_l1', 'sd_feb_15', 'lectores', 'p11', 1, 'Primera Lectura'),
('a_feb15_l2', 'sd_feb_15', 'lectores', 'p13', 2, 'Segunda Lectura'),
('a_feb15_l3', 'sd_feb_15', 'lectores', 'p24', 3, 'Peticiones'),
('a_feb15_l4', 'sd_feb_15', 'lectores', 'p25', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- February 22
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_feb22_m1', 'sd_feb_22', 'monaguillos', 'p4', 1, 'Ciriales'),
('a_feb22_m2', 'sd_feb_22', 'monaguillos', 'p6', 2, 'Naveta'),
('a_feb22_m3', 'sd_feb_22', 'monaguillos', 'p8', 3, 'Vinajeras'),
('a_feb22_m4', 'sd_feb_22', 'monaguillos', 'p10', 4, 'Libro'),
('a_feb22_l1', 'sd_feb_22', 'lectores', 'p15', 1, 'Primera Lectura'),
('a_feb22_l2', 'sd_feb_22', 'lectores', 'p17', 2, 'Segunda Lectura'),
('a_feb22_l3', 'sd_feb_22', 'lectores', 'p19', 3, 'Peticiones'),
('a_feb22_l4', 'sd_feb_22', 'lectores', 'p12', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- April assignments
-- April 5
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_apr5_m1', 'sd_apr_5', 'monaguillos', 'p1', 1, 'Ciriales'),
('a_apr5_m2', 'sd_apr_5', 'monaguillos', 'p2', 2, 'Naveta'),
('a_apr5_m3', 'sd_apr_5', 'monaguillos', 'p3', 3, 'Vinajeras'),
('a_apr5_m4', 'sd_apr_5', 'monaguillos', 'p4', 4, 'Libro'),
('a_apr5_l1', 'sd_apr_5', 'lectores', 'p11', 1, 'Primera Lectura'),
('a_apr5_l2', 'sd_apr_5', 'lectores', 'p12', 2, 'Segunda Lectura'),
('a_apr5_l3', 'sd_apr_5', 'lectores', 'p13', 3, 'Peticiones'),
('a_apr5_l4', 'sd_apr_5', 'lectores', 'p14', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- April 12
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_apr12_m1', 'sd_apr_12', 'monaguillos', 'p5', 1, 'Ciriales'),
('a_apr12_m2', 'sd_apr_12', 'monaguillos', 'p6', 2, 'Naveta'),
('a_apr12_m3', 'sd_apr_12', 'monaguillos', 'p7', 3, 'Vinajeras'),
('a_apr12_m4', 'sd_apr_12', 'monaguillos', 'p8', 4, 'Libro'),
('a_apr12_l1', 'sd_apr_12', 'lectores', 'p15', 1, 'Primera Lectura'),
('a_apr12_l2', 'sd_apr_12', 'lectores', 'p16', 2, 'Segunda Lectura'),
('a_apr12_l3', 'sd_apr_12', 'lectores', 'p17', 3, 'Peticiones'),
('a_apr12_l4', 'sd_apr_12', 'lectores', 'p18', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- April 19
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_apr19_m1', 'sd_apr_19', 'monaguillos', 'p9', 1, 'Ciriales'),
('a_apr19_m2', 'sd_apr_19', 'monaguillos', 'p10', 2, 'Naveta'),
('a_apr19_m3', 'sd_apr_19', 'monaguillos', 'p21', 3, 'Vinajeras'),
('a_apr19_m4', 'sd_apr_19', 'monaguillos', 'p22', 4, 'Libro'),
('a_apr19_l1', 'sd_apr_19', 'lectores', 'p19', 1, 'Primera Lectura'),
('a_apr19_l2', 'sd_apr_19', 'lectores', 'p20', 2, 'Segunda Lectura'),
('a_apr19_l3', 'sd_apr_19', 'lectores', 'p23', 3, 'Peticiones'),
('a_apr19_l4', 'sd_apr_19', 'lectores', 'p24', 4, 'Salmo')
ON CONFLICT DO NOTHING;

-- April 26
INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name) VALUES
('a_apr26_m1', 'sd_apr_26', 'monaguillos', 'p1', 1, 'Ciriales'),
('a_apr26_m2', 'sd_apr_26', 'monaguillos', 'p3', 2, 'Naveta'),
('a_apr26_m3', 'sd_apr_26', 'monaguillos', 'p5', 3, 'Vinajeras'),
('a_apr26_m4', 'sd_apr_26', 'monaguillos', 'p25', 4, 'Libro'),
('a_apr26_l1', 'sd_apr_26', 'lectores', 'p11', 1, 'Primera Lectura'),
('a_apr26_l2', 'sd_apr_26', 'lectores', 'p13', 2, 'Segunda Lectura'),
('a_apr26_l3', 'sd_apr_26', 'lectores', 'p15', 3, 'Peticiones'),
('a_apr26_l4', 'sd_apr_26', 'lectores', 'p25', 4, 'Salmo')
ON CONFLICT DO NOTHING;
