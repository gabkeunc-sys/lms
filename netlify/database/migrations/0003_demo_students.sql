-- Synthetic student accounts for UI demonstrations only.
INSERT INTO app_users(id,name,email,password_hash,role,active) VALUES
('9bd479c5-b6bd-45cb-a5f1-7a73cb4a9e1d', '김민준 (가상)', 'student01@example.com', '2363436265c738cffe2b5c20c7e95455:e04a5f2475796231d42212f7d779c016e2fd538a1c6759cd937dcc1cff7d9563cbb650a6cc70c4b95b04306b709db0412149a8fe7fbcc039b082c012be710641', 'student', true),
('611ca32e-62a2-42c9-8adc-a0760d033208', '이서연 (가상)', 'student02@example.com', 'fde26623671858ee4728e62a61007c6c:1c08271e3b8c20e7c1ce22beb227bc8aac72d2db8255b289fd945786d66187dbf7363ba4050c54d42502a2f8190ffd9f8461eb1d7a7a5402f282674e7fcb4e79', 'student', true),
('b78f1e1a-6afa-4386-a070-94e25f165660', '박지호 (가상)', 'student03@example.com', '0641319449d64cc2bb41d6f54c01af8e:7d5ba103fc8e8d9ecc94995afbf666b09163c8a6bbc28aa4781354e7de9a6fe6bf895af5c737f6712fdb9a6f547a49df888e566988158a83f59047d3c2d84362', 'student', true),
('4b90093f-c128-4e45-8ba0-07bfa110d22b', '최하은 (가상)', 'student04@example.com', 'd9eda2cbf2506cffc4ac31ec10195fc2:db18736f9f90ae2931e665ab4a5cf91224ac273945a142f70f7f00c60a3e29a9d3e4afde8a6df1cba196eaa97b215d7acd02f88698b2f85c41f5711f547c5032', 'student', true),
('5a200407-f603-4b04-b89b-e60034e4e9ad', '정도윤 (가상)', 'student05@example.com', 'e97de4a2ddadb7ddb358192eddf10abb:4aa845a03bde521a26fc54618934ce3d6b8f5a5d2bfab27b779abadcd5149f0ddb797318a1f6e0625ed333f7d25cd5b7bfb380cc56a6439348ce2b7a1afacf13', 'student', true),
('612ad0d2-e27d-4e7d-b150-d5e08fd79efb', '강수빈 (가상)', 'student06@example.com', 'fa50c9e638f2ead2733dc151156be2d8:cb400a1f30946690e3fef2f52774a7c0387ba0700042768c5b559383c2f4ca38d86c96d1b72931b9d9a256293ee5dfb0b1f32b19a8a66b584a65b8e4c0a0a35e', 'student', true),
('2316c163-ca5b-49e3-94b2-8d0852576799', '조현우 (가상)', 'student07@example.com', '3a3a97a39700da1e7ce2b98c557f6ec1:7168f2ee4e07647181e541179653d2d4e57506a3d6a7ef957c572a3dbc286b269e508eb7ed9bebe7c81edcabe18fecf36205fdc0cdc6207d9f10bdc1d464868f', 'student', true),
('f0df9048-4128-4d60-b3d0-6fe2baaffd5d', '윤지민 (가상)', 'student08@example.com', 'a614d812504116f088245f4565519982:cdb6ffcec81c7020b01b6397604de3527e06efe8fee0e462b3330d30cc2ad78c536df8df8128f1aec8d7d2d7ab4df932120a4c9144bf63753c9d582f7aa6f11a', 'student', true),
('be36465f-7ae2-4185-b7e3-63335a019fcc', '장예준 (가상)', 'student09@example.com', '672b72fc57645fde131a30c7bba8a945:f0c55ecebc012e62f312ed93cd70019864a5d65e7ee9beecc7c1695582f9b3a10bf6b41f6ab5e2fec9a25d07966f50c4f0aeb11662a32b218313d5819ef4c165', 'student', true),
('24e630a5-95e3-4c0e-9faf-d7e787f7a618', '임채원 (가상)', 'student10@example.com', '9807db963ccfac2e4b1f5fb7926c37dd:09b658666ee9f57450558d14584b40da0bc62d28fef764bd6ce9cad84fb8b409b410dbed87cfd758420faa9083733f9e6bf853cd291df9e98fd5482788fe9075', 'student', true)
ON CONFLICT(email) DO NOTHING;

