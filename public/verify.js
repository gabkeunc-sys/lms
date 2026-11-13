// Draws the certificate preview on the public verification page from the server-rendered data-* values.
(function () {
 const cv = document.getElementById('vf-cert'); if (!cv) return;
 const d = cv.dataset;
 drawCertificate(cv, {cert_no: d.no, student_name: d.name, course_title: d.course, completed_on: d.date, grade: d.grade, average: d.average, revoked_at: d.revoked || null}).catch(() => cv.remove());
})();
