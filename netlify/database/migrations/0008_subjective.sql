CREATE TABLE ai_settings (
 id integer PRIMARY KEY CHECK(id=1), encrypted_key text NOT NULL, model text NOT NULL,
 enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE assessments ADD COLUMN published boolean NOT NULL DEFAULT false;
ALTER TABLE assessment_results ADD COLUMN grading jsonb NOT NULL DEFAULT '[]';
ALTER TABLE assessment_results ADD COLUMN grading_status text NOT NULL DEFAULT 'confirmed' CHECK(grading_status IN ('pending','review','confirmed'));
ALTER TABLE assessment_results ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TABLE assessment_attempts (
 assessment_id uuid REFERENCES assessments(id), student_id uuid REFERENCES app_users(id),
 started_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(assessment_id,student_id)
);
ALTER TABLE assessment_results ALTER COLUMN submitted_at SET DEFAULT now();
