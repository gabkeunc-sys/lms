// Sample English names for members and courses (used on English certificates). Re-runnable.
// Usage: node scripts/seed-english.cjs /tmp/english-seed.sql && npx wrangler d1 execute lms --remote --file /tmp/english-seed.sql
const fs = require('fs');
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const users = {'gabkeunc@gmail.com': 'Gabkeun Choi', 'teacher01@example.com': 'Hyunwoo Cho', 'teacher02@example.com': 'Sujin Lee',
 'learner01@example.com': 'Dohyun Kim', 'learner02@example.com': 'Harin Lee', 'learner03@example.com': 'Seojun Park', 'learner04@example.com': 'Yuna Jung',
 'learner05@example.com': 'Minjae Choi', 'learner06@example.com': 'Jiwoo Han', 'learner07@example.com': 'Serin Oh', 'learner08@example.com': 'Taeo Yoon',
 'learner09@example.com': 'Daeun Jang', 'learner10@example.com': 'Gunwoo Song', 'learner11@example.com': 'Soyul Lim', 'learner12@example.com': 'Junhyuk Bae',
 'student01@example.com': 'Minjun Kim', 'student02@example.com': 'Seoyeon Lee', 'student03@example.com': 'Jiho Park', 'student04@example.com': 'Haeun Choi',
 'student05@example.com': 'Doyun Jung', 'student06@example.com': 'Subin Kang', 'student07@example.com': 'Yejun Jang', 'student08@example.com': 'Jimin Yoon',
 'student09@example.com': 'Yejun Jang', 'student10@example.com': 'Chaewon Lim', 'sky.kim@example.com': 'Haneul Kim', 'jihu.moon@example.com': 'Jihu Moon'};
const courses = {'풀스택 웹 개발 기초': 'Full-Stack Web Development Basics', '데이터베이스 기초': 'Database Fundamentals', 'AI 서비스 개발 입문': 'Introduction to AI Service Development',
 '데이터분석 실무': 'Practical Data Analysis', '피지컬 AI 입문': 'Introduction to Physical AI', '인공지능 기초': 'Fundamentals of Artificial Intelligence',
 '인공지능 기초 2기': 'Fundamentals of Artificial Intelligence (Cohort 2)', '파이썬 프로그래밍 기초': 'Python Programming Basics', '웹 서비스 기초': 'Web Service Fundamentals'};
const out = [
 ...Object.entries(users).map(([e, n]) => `UPDATE app_users SET name_en=${q(n)} WHERE email=${q(e)} AND (name_en IS NULL OR name_en='');`),
 ...Object.entries(courses).map(([t, n]) => `UPDATE courses SET title_en=${q(n)} WHERE title=${q(t)} AND (title_en IS NULL OR title_en='');`),
];
fs.writeFileSync(process.argv[2] || 'english-seed.sql', out.join('\n') + '\n');
