ALTER TABLE app_users DROP CONSTRAINT app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK(role IN ('student','instructor','admin'));
CREATE TABLE courses (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app_users(id),
 title varchar(160) NOT NULL, description text NOT NULL DEFAULT '',
 start_date date, end_date date, status text NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','active','ended')),
 student_ids jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_date IS NULL OR start_date IS NULL OR end_date>=start_date)
);
CREATE INDEX courses_owner_idx ON courses(owner_id);
CREATE TABLE assessments (
 id uuid PRIMARY KEY, course_id uuid NOT NULL REFERENCES courses(id),
 title varchar(160) NOT NULL, kind text NOT NULL CHECK(kind IN ('exam','quiz')),
 week integer NOT NULL DEFAULT 1 CHECK(week BETWEEN 1 AND 100),
 duration integer NOT NULL DEFAULT 30 CHECK(duration BETWEEN 1 AND 240),
 opens_at timestamptz, closes_at timestamptz,
 questions jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(closes_at IS NULL OR opens_at IS NULL OR closes_at>opens_at)
);
CREATE INDEX assessments_course_idx ON assessments(course_id);
