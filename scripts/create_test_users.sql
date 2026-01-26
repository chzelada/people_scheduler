-- Check if admin user exists and create if not
-- Note: This needs to be run with proper password hashing
-- The actual user creation should happen through the API or with proper Argon2 hashing

-- For now, let's verify the people were created correctly
SELECT id, first_name, last_name FROM people LIMIT 5;
