-- Optional English names for English certificates (fall back to the Korean name when empty).
ALTER TABLE app_users ADD COLUMN name_en TEXT;
ALTER TABLE courses ADD COLUMN title_en TEXT;
