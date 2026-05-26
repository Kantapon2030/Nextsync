-- Migration: Remove Teams and Simplify Roles
-- Step 1: Update user roles from team_leader to photographer to prevent constraint violations
UPDATE users SET role = 'photographer' WHERE role = 'team_leader';

-- Step 2: Recreate check constraint on user roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'photographer', 'admin'));

-- Step 3: Remove team_color column from users table
ALTER TABLE users DROP COLUMN IF EXISTS team_color;

-- Step 4: Drop team_invitations table
DROP TABLE IF EXISTS team_invitations;

-- Step 5: Drop teams table
DROP TABLE IF EXISTS teams;

-- Step 6: Drop photos_team_status_idx and team_color column from photos table
DROP INDEX IF EXISTS photos_team_status_idx;
ALTER TABLE photos DROP COLUMN IF EXISTS team_color;

-- Step 7: Remove team_color from filter_config table
ALTER TABLE filter_config DROP COLUMN IF EXISTS team_color;
