// Draws the certificate preview on the public verification page from the server-rendered data-* values, in Korean or English.
(function () {
 const cv = document.getElementById('vf-cert'); if (!cv) return;
 const d = cv.dataset;
 const cert = {cert_no: d.no, student_name: d.name, student_name_en: d.nameEn, course_title: d.course, course_title_en: d.courseEn, completed_on: d.date, grade: d.grade, average: d.average, revoked_at: d.revoked || null};
 const buttons = document.querySelectorAll('.vf-lang [data-lang]');
 const show = lang => { buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang))); drawCertificate(cv, cert, lang).catch(() => {}); };
 buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.lang)));
 show('ko');
})();
