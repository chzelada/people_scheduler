-- Migración segura: Solo INSERT con ON CONFLICT DO NOTHING
-- NO hay DROP, DELETE, TRUNCATE o ALTER que afecten datos existentes

INSERT INTO jobs (id, name, description, people_required, color) VALUES
    ('monaguillos_jr', 'Monaguillos Jr.', 'Monaguillos Junior', 2, '#8B5CF6')
ON CONFLICT (id) DO NOTHING;
