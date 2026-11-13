CREATE TABLE learning_guidance (
 course_id uuid NOT NULL REFERENCES courses(id), student_id uuid NOT NULL REFERENCES app_users(id),
 content text NOT NULL CHECK(length(content) BETWEEN 1 AND 8000), published boolean NOT NULL DEFAULT false,
 updated_by uuid NOT NULL REFERENCES app_users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 revision integer NOT NULL DEFAULT 1, PRIMARY KEY(course_id,student_id)
);
