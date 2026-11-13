// Completion certificate renderer: draws the uploaded template (navy design) and overlays
// name, course, date, grade, certificate number, signature and a QR code to /verify/<no>.
// Two languages: 'en' (the original template) and 'ko' (same design, English text removed and Korean drawn).
const CERT_TEMPLATES = {en: '/images/certificate-template.jpg', ko: '/images/certificate-template-ko.jpg'}, CERT_SIGNATURE = '/images/signature.png';
const CERT_W = 1055, CERT_H = 1491, CERT_SCALE = 2; // template pixels; drawn at 2x for print
const CERT_INK = '#13305f', CERT_MUTED = '#6b7385';
const certImage = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
const certFace = (file, weight) => (async () => { try { const f = new FontFace('CertSerifKR', `url(/vendor/fonts/${file})`, {weight}); await f.load(); document.fonts.add(f); } catch {} })();
let certCommon; const certTpl = {};
function certLoad(lang) {
 certCommon ||= Promise.all([certImage(CERT_SIGNATURE).catch(() => null), certFace('cert-serif-kr.woff2', '700'), certFace('cert-serif-kr-400.woff2', '400')]).then(([sig]) => sig);
 certTpl[lang] ||= certImage(CERT_TEMPLATES[lang]);
 return Promise.all([certTpl[lang], certCommon]).then(([img, sig]) => ({img, sig}));
}
const CERT_LANG_KEY = 'lms.cert.lang';
function certLang(v) { try { if (v) localStorage.setItem(CERT_LANG_KEY, v); return localStorage.getItem(CERT_LANG_KEY) === 'en' ? 'en' : 'ko'; } catch { return v || 'ko'; } }
const certVerifyUrl = no => `${location.origin}/verify/${encodeURIComponent(no)}`;
const certDate = d => String(d || '').slice(0, 10).replace(/-/g, '. ') + '.';
const CERT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const certDateEn = d => { const [y, m, dd] = String(d || '').slice(0, 10).split('-'); return y && m ? `${CERT_MONTHS[Number(m) - 1]} ${Number(dd)}, ${y}` : ''; };
const certFont = (px, w = 700) => `${w} ${px}px CertSerifKR, "Noto Serif KR", "Nanum Myeongjo", "AppleMyungjo", serif`;
function certFit(x, text, px, max, w) { let s = px; do { x.font = certFont(s, w); if (x.measureText(text).width <= max) break; s -= 1; } while (s > 10); }
const certSpacing = (x, v) => { if ('letterSpacing' in x) x.letterSpacing = v; };

async function drawCertificate(canvas, c, lang = 'en') {
 lang = lang === 'ko' ? 'ko' : 'en';
 const {img, sig} = await certLoad(lang);
 canvas.width = CERT_W * CERT_SCALE; canvas.height = CERT_H * CERT_SCALE;
 const x = canvas.getContext('2d');
 x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingQuality = 'high';
 x.drawImage(img, 0, 0, canvas.width, canvas.height);
 x.scale(CERT_SCALE, CERT_SCALE);
 x.fillStyle = CERT_INK; x.textBaseline = 'alphabetic'; x.textAlign = 'center';
 const ko = lang === 'ko';
 const name = String((ko ? c.student_name : c.student_name_en || c.student_name) || '');
 const course = String((ko ? c.course_title : c.course_title_en || c.course_title) || '');
 if (ko) { // title block replacing "Certificate of Completion / THIS CERTIFIES THAT"
  certSpacing(x, '34px'); x.font = certFont(66); x.fillText('수료증', CERT_W / 2 + 17, 324);
  certSpacing(x, '6px'); x.fillStyle = CERT_MUTED; x.font = certFont(15, 400); x.fillText('CERTIFICATE OF COMPLETION', CERT_W / 2 + 3, 377); x.fillStyle = CERT_INK;
 }
 // Student name, centered above the divider line.
 const hangul = /[가-힣]/.test(name);
 certSpacing(x, hangul ? '10px' : '2px');
 certFit(x, name, 58, 640); x.fillText(name, CERT_W / 2 + (hangul ? 5 : 1), 508);
 certSpacing(x, '0px');
 if (ko) { // body sentence replacing "has successfully completed the course ..."
  const line1 = `위 사람은 「${course}」 과정을`, line2 = '성실히 이수하였기에 이 증서를 수여합니다.';
  certFit(x, line1, 23, 680, 400); x.fillText(line1, CERT_W / 2, 607);
  certFit(x, line2, 23, 680, 400); x.fillText(line2, CERT_W / 2, 643);
  x.textAlign = 'left'; x.font = certFont(17, 400);
  [['과정명', 146, 1011], ['수료일', 557, 1011], ['성적', 146, 1110], ['증서번호', 557, 1110]].forEach(([t, l, b]) => x.fillText(t, l, b));
  x.textAlign = 'center'; x.font = certFont(20); certSpacing(x, '6px'); x.fillText('최갑근', 786 + 3, 1286); certSpacing(x, '4px');
  x.fillStyle = CERT_MUTED; x.font = certFont(12, 400); x.fillText('대표 · 강사', 786 + 2, 1309);
  certSpacing(x, '0px'); x.textAlign = 'left'; x.font = certFont(12, 400); x.fillText('QR 코드로', 146, 1315); x.fillText('진위 확인', 146, 1331); x.fillStyle = CERT_INK;
 }
 // Field values on the four underlined slots.
 x.textAlign = 'left';
 const field = (text, left, base, max) => { certFit(x, text, 22, max, 600); x.fillText(text, left, base); };
 field(course, 146, 1043, 350);
 field(ko ? certDate(c.completed_on) : certDateEn(c.completed_on), 557, 1043, 350);
 field(`${c.grade}  (${Number(c.average).toFixed(1)})`, 146, 1134, 350);
 field(String(c.cert_no || ''), 557, 1134, 350);
 // Instructor signature, sitting on the signature line (line spans x 655-917 at y 1253).
 if (sig) { const sw = 172, sh = sw * sig.height / sig.width; x.drawImage(sig, 786 - sw / 2 + 6, 1262 - sh, sw, sh); }
 // QR code over the template's placeholder.
 x.fillStyle = '#f9f9fc'; x.fillRect(141, 1208, 86, 84);
 if (typeof qrcode === 'function' && c.cert_no) {
  const qr = qrcode(0, 'M'); qr.addData(certVerifyUrl(c.cert_no)); qr.make();
  const n = qr.getModuleCount(), size = 72, cell = size / n, ox = 147, oy = 1214;
  x.fillStyle = '#fff'; x.fillRect(ox - 3, oy - 3, size + 6, size + 6);
  x.fillStyle = CERT_INK;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect(ox + k * cell, oy + r * cell, cell + 0.25, cell + 0.25);
 }
 if (c.revoked_at) { // voided certificates get a stamp
  x.save(); x.translate(CERT_W / 2, CERT_H / 2); x.rotate(-0.42); x.strokeStyle = 'rgba(200,30,30,.75)'; x.fillStyle = 'rgba(200,30,30,.75)'; x.lineWidth = 6;
  x.strokeRect(-260, -70, 520, 140); x.textAlign = 'center'; x.font = certFont(64); x.fillText(ko ? '취소됨 · VOID' : 'VOID · 취소됨', 0, 22); x.restore();
 }
 return canvas;
}

function certPdfBlob(jpeg, pxW, pxH, title) {
 const W = 595.28, H = 841.89, enc = new TextEncoder(), parts = [], offs = [];
 let len = 0; const put = v => { const b = typeof v === 'string' ? enc.encode(v) : v; parts.push(b); len += b.length; };
 const obj = (n, head, stream) => { offs[n] = len; put(`${n} 0 obj\n${head}\n`); if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); } put('endobj\n'); };
 const content = enc.encode(`q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ\n`);
 put('%PDF-1.4\n%âãÏÓ\n');
 obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
 obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
 obj(4, `<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
 obj(5, `<< /Length ${content.length} >>`, content);
 obj(6, `<< /Title (${String(title).replace(/[^A-Za-z0-9 .-]/g, '')}) /Producer (Baeumgil LMS) >>`);
 const xref = len;
 put(`xref\n0 7\n0000000000 65535 f \n${offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 return new Blob(parts, {type: 'application/pdf'});
}
const certBlob = (canvas, type, q) => new Promise(ok => canvas.toBlob(ok, type, q));
function certSave(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function certDownload(c, kind, lang = certLang()) {
 const canvas = await drawCertificate(document.createElement('canvas'), c, lang);
 const base = `certificate-${c.cert_no}-${lang}`;
 if (kind === 'png') return certSave(await certBlob(canvas, 'image/png'), base + '.png');
 const jpeg = new Uint8Array(await (await certBlob(canvas, 'image/jpeg', 0.93)).arrayBuffer());
 certSave(certPdfBlob(jpeg, canvas.width, canvas.height, `Certificate ${c.cert_no}`), base + '.pdf');
}
