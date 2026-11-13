CREATE TABLE app_users (
 id uuid PRIMARY KEY, name varchar(80) NOT NULL,
 email varchar(254) UNIQUE NOT NULL CHECK (email = lower(email)),
 password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_sessions_user_idx ON app_sessions(user_id);
CREATE TABLE auth_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
