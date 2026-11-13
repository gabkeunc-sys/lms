// Admin operations dashboard: instructor, student and assessment operation overviews.
const fmt = v => v === null || v === undefined ? '-' : `${v}`;
const rateBar = v => v === null || v === undefined ? '<span class="muted">-</span>' : `<div class="rate"><div class="rate-track"><div class="rate-fill" data-width="${Math.min(100, v)}"></div></div><span>${v}%</span></div>`;
function gradingBar(a) {
 if (!a.takers) return '<span class="muted">응시 없음</span>';
 const part = (n, cls) => n ? `<div class="${cls}" data-flex="${n}" title="${n}건"></div>` : '';
 return `<div class="grading-bar">${part(a.confirmed, 'g-confirmed')}${part(a.review, 'g-review')}${part(a.pending, 'g-pending')}</div><small class="grading-legend">확정 ${a.confirmed} · AI 검토 ${a.review} · 대기 ${a.pending}</small>`;
}
async function renderAdminDashboard() {
 shell();
 $('#main').innerHTML = '<div class="loading">운영 현황을 불러오고 있습니다…</div>';
 try {
  const {summary: s, instructors, courses, students, assessments} = await api('/admin/overview');
  const byOwner = {};
  for (const a of assessments) (byOwner[a.owner_name] ||= []).push(a);
  const table = (head, rows, empty) => rows.length ? `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<p class="empty">${empty}</p>`;
  $('#main').innerHTML = `<section class="intro"><span class="eyebrow">ADMIN CONSOLE</span><h1>운영 현황</h1><p>강사·학생·시험 운영 상황을 한눈에 확인하세요.</p></section>
  <div class="cards admin-cards">
   <section class="panel stat"><h2>강사</h2><div class="value">${s.instructors}</div><p>개설 과정 ${s.courses}개</p></section>
   <section class="panel stat"><h2>학생</h2><div class="value">${s.students}</div><p>활성 ${s.active_students}명</p></section>
   <section class="panel stat"><h2>시험 응시율</h2><div class="value">${s.participation === null ? '-' : s.participation + '%'}</div><p>공개 평가 ${s.published_assessments}개 · 제출 ${s.submissions}건</p></section>
   <section class="panel stat highlight"><h2>채점 진행 필요</h2><div class="value">${s.pending + s.review}</div><p>채점 대기 ${s.pending} · AI 검토 ${s.review}</p></section>
  </div>
  <section class="panel admin-section"><div class="section-heading"><div><h2>강사 현황</h2><p>강사별 담당 과정, 수강생, 평가와 채점 대기 건수입니다.</p></div><button class="secondary" data-view="members">회원 관리</button></div>
   ${table(['강사', '과정', '수강생', '평가', '제출', '채점 대기'], instructors.map(i => `<tr><td><strong>${escape(i.name)}</strong><br><small>${escape(i.email)}</small></td><td>${i.courses}</td><td>${i.students}</td><td>${i.assessments}</td><td>${i.submissions}</td><td>${i.pending ? `<span class="pill status-pending">${i.pending}건</span>` : '<span class="pill status-confirmed">없음</span>'}</td></tr>`), '등록된 강사가 없습니다.')}
  </section>
  <section class="panel admin-section"><div class="section-heading"><div><h2>학생 현황</h2><p>과정별 수강 인원, 공개 평가 응시율, 확정 성적 평균(100점 환산)입니다.</p></div></div>
   ${table(['과정', '강사', '수강생', '공개 평가', '응시율', '평균'], courses.map(c => `<tr><td><strong>${escape(c.title)}</strong></td><td>${escape(c.owner_name)}</td><td>${c.enrolled}</td><td>${c.published_assessments}</td><td>${rateBar(c.participation)}</td><td>${fmt(c.average)}</td></tr>`), '개설된 과정이 없습니다.')}
   <h3 class="sub-heading">학생별</h3>
   ${table(['학생', '수강 과정', '응시 / 배정', '응시율', '평균', '상태'], students.map(st => `<tr><td><strong>${escape(st.name)}</strong><br><small>${escape(st.email)}</small></td><td>${st.courses}</td><td>${st.taken} / ${st.assigned}</td><td>${rateBar(st.assigned ? Math.round(st.taken * 1000 / st.assigned) / 10 : null)}</td><td>${fmt(st.average)}</td><td><span class="pill ${st.active ? '' : 'gray'}">${st.active ? '활성' : '비활성'}</span></td></tr>`), '등록된 학생이 없습니다.')}
  </section>
  <section class="panel admin-section"><div class="section-heading"><div><h2>강사별 시험 운영 현황</h2><p>평가별 응시·미응시 인원과 채점 진행 상황(강사 확정 / AI 제안 검토 / 대기)입니다.</p></div></div>
   ${Object.keys(byOwner).length ? Object.entries(byOwner).map(([owner, list]) => `<h3 class="sub-heading">${escape(owner)} <small>평가 ${list.length}개</small></h3>${table(['평가', '과정', '공개', '응시', '미응시', '채점 진행', '평균'], list.map(a => `<tr><td><strong>${escape(a.title)}</strong><br><small>${a.week}주차 · ${a.kind === 'exam' ? '시험' : '미니퀴즈'}${a.text_questions ? ` · 주관식 ${a.text_questions}문항` : ''}</small></td><td>${escape(a.course_title)}</td><td><span class="pill ${a.published ? '' : 'gray'}">${a.published ? '공개' : '비공개'}</span></td><td>${a.takers}</td><td>${a.not_taken}</td><td>${gradingBar(a)}</td><td>${fmt(a.average)}</td></tr>`), '')}`).join('') : '<p class="empty">등록된 평가가 없습니다.</p>'}
  </section>`;
  // CSP blocks inline style attributes, so sizes are applied through the CSSOM.
  document.querySelectorAll('[data-width]').forEach(el => el.style.width = el.dataset.width + '%');
  document.querySelectorAll('[data-flex]').forEach(el => el.style.flex = el.dataset.flex);
  bindViews();
 } catch (e) {
  $('#main').innerHTML = `<section class="panel"><h1>운영 현황을 불러오지 못했습니다</h1><p>${escape(e.message)}</p></section>`;
 }
}
