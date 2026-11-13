// Admin operations dashboard: instructor, student and assessment operation overviews.
const fmt = v => v === null || v === undefined ? '-' : `${v}`;
const rateBar = v => v === null || v === undefined ? '<span class="muted">-</span>' : `<div class="rate"><div class="rate-track"><div class="rate-fill" data-width="${Math.min(100, v)}"></div></div><span>${v}%</span></div>`;
function gradingBar(a) {
 if (!a.takers) return '<span class="muted">응시 없음</span>';
 const part = (n, cls) => n ? `<div class="${cls}" data-flex="${n}" title="${n}건"></div>` : '';
 return `<div class="grading-bar">${part(a.confirmed, 'g-confirmed')}${part(a.review, 'g-review')}${part(a.pending, 'g-pending')}</div><small class="grading-legend">확정 ${a.confirmed} · ${AI_MARK} 검토 ${a.review} · 대기 ${a.pending}</small>`;
}
async function renderAdminDashboard() {
 shell();
 startLoading('운영 현황을 불러오고 있습니다…');
 try {
  const {summary: s, instructors, courses, students, assessments} = await api('/admin/overview');
  const byOwner = {};
  for (const a of assessments) (byOwner[a.owner_name] ||= []).push(a);
  const table = (head, rows, empty) => rows.length ? `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<p class="empty">${empty}</p>`;
  $('#main').innerHTML = `<section class="intro"><span class="eyebrow">ADMIN CONSOLE</span><h1>운영 현황</h1><p>강사·학생·시험 운영 상황을 한눈에 확인하세요.</p></section>
  <div class="cards admin-cards">
   <section class="panel stat"><h2>강사 · 개설 과정</h2><div class="value">${s.instructors} · ${s.courses}</div><p>진행 중 과정 ${courses.filter(c => c.status === 'active').length}개</p></section>
   <section class="panel stat"><h2>학생</h2><div class="value">${s.students}</div><p>활성 ${s.active_students}명</p></section>
   <section class="panel stat"><h2>시험 응시율</h2><div class="value">${s.participation === null ? '-' : s.participation + '%'}</div><p>공개 평가 ${s.published_assessments}개 · 제출 ${s.submissions}건</p></section>
   <section class="panel stat highlight"><h2>채점 진행 필요 ${AI_MARK}</h2><div class="value">${s.pending + s.review}</div><p>채점 대기 ${s.pending} · AI 검토 ${s.review}</p></section>
  </div>
  <section class="panel admin-section"><div class="section-heading"><div><h2>강사 현황</h2><p>강사별 담당 과정, 수강생, 평가와 채점 대기 건수입니다.</p></div><button class="secondary" data-view="members">회원 관리</button></div>
   ${table(['강사', '과정', '수강생', '평가', '제출', '채점 대기'], instructors.map(i => `<tr><td><strong>${escape(i.name)}</strong><br><small>${escape(i.email)}</small></td><td>${i.courses}</td><td>${i.students}</td><td>${i.assessments}</td><td>${i.submissions}</td><td>${i.pending ? `<span class="pill status-pending">${i.pending}건</span>` : '<span class="pill status-confirmed">없음</span>'}</td></tr>`), '등록된 강사가 없습니다.')}
  </section>
  <section class="panel admin-section"><div class="section-heading"><div><h2>개설 과정 현황</h2><p>과정별 담당 강사, 교육 기간과 상태, 수강 인원, 평가 수, 응시율, 평균(100점 환산), 채점 대기입니다.</p></div></div>
   ${table(['과정', '강사', '교육 기간', '상태', '수강생', '평가 (공개)', '응시율', '평균', '채점 대기'], courses.map(c => `<tr><td><strong>${escape(c.title)}</strong></td><td>${escape(c.owner_name)}</td><td><small>${c.start_date ? escape(c.start_date) : '미정'} ~ ${c.end_date ? escape(c.end_date) : '미정'}</small></td><td><span class="pill ${c.status === 'active' ? 'status-confirmed' : c.status === 'preparing' ? 'status-pending' : 'gray'}">${({preparing: '준비', active: '진행', ended: '종료'})[c.status] || escape(c.status)}</span></td><td>${c.enrolled}</td><td>${c.assessments} (${c.published_assessments})</td><td>${rateBar(c.participation)}</td><td>${fmt(c.average)}</td><td>${c.pending ? `<span class="pill status-pending">${c.pending}건</span>` : '<span class="pill status-confirmed">없음</span>'}</td></tr>`), '개설된 과정이 없습니다.')}
  </section>
  <section class="panel admin-section"><div class="section-heading"><div><h2>학생 현황</h2><p>학생별 수강 과정, 공개 평가 응시율, 확정 성적 평균(100점 환산)입니다.</p></div></div>
   ${table(['학생', '수강 과정', '응시 / 배정', '응시율', '평균', '상태'], students.map(st => `<tr><td><strong>${escape(st.name)}</strong><br><small>${escape(st.email)}</small></td><td>${st.courses}</td><td>${st.taken} / ${st.assigned}</td><td>${rateBar(st.assigned ? Math.round(st.taken * 1000 / st.assigned) / 10 : null)}</td><td>${fmt(st.average)}</td><td><span class="pill ${st.active ? '' : 'gray'}">${st.active ? '활성' : '비활성'}</span></td></tr>`), '등록된 학생이 없습니다.')}
  </section>
  <section class="panel admin-section"><div class="section-heading"><div><h2>강사별 시험 운영 현황</h2><p>평가별 응시·미응시 인원과 채점 진행 상황(강사 확정 / AI 제안 검토 / 대기)입니다.</p></div></div>
   ${Object.keys(byOwner).length ? Object.entries(byOwner).map(([owner, list]) => `<h3 class="sub-heading">${escape(owner)} <small>평가 ${list.length}개</small></h3>${table(['평가', '과정', '공개', '응시', '미응시', '채점 진행', '평균'], list.map(a => `<tr><td><strong>${escape(a.title)}</strong><br><small>${a.week}주차 · ${a.kind === 'exam' ? '시험' : '미니퀴즈'}${a.text_questions ? ` · 주관식 ${a.text_questions}문항` : ''}</small></td><td>${courseName(a)}</td><td><span class="pill ${a.published ? '' : 'gray'}">${a.published ? '공개' : '비공개'}</span></td><td>${a.takers}</td><td>${a.not_taken}</td><td>${gradingBar(a)}</td><td>${fmt(a.average)}</td></tr>`), '')}`).join('') : '<p class="empty">등록된 평가가 없습니다.</p>'}
  </section>`;
  // CSP blocks inline style attributes, so sizes are applied through the CSSOM.
  document.querySelectorAll('[data-width]').forEach(el => el.style.width = el.dataset.width + '%');
  document.querySelectorAll('[data-flex]').forEach(el => el.style.flex = el.dataset.flex);
  bindViews();
 } catch (e) {
  $('#main').innerHTML = `<section class="panel"><h1>운영 현황을 불러오지 못했습니다</h1><p>${escape(e.message)}</p></section>`;
 }
}

// 운영 일정: every course on one horizontally scrolling calendar, as Gantt bars with a line for today.
let scheduleZoom = 'week';
const SCHEDULE_SCOPES = {
 admin: {api: '/admin/schedule', eyebrow: 'ADMIN CONSOLE', title: '운영 일정', intro: '전체 과정의 운영 기간을 한눈에 봅니다.', empty: '등록된 과정이 없습니다.'},
 instructor: {api: '/instructor/schedule', eyebrow: 'TEACHING SCHEDULE', title: '강의 일정', intro: '내가 맡은 과정의 운영 기간을 한눈에 봅니다.', empty: '맡은 과정이 없습니다.'},
 student: {api: '/student/schedule', eyebrow: 'MY SCHEDULE', title: '학습 일정', intro: '내가 수강하는 과정의 기간과 시험 일정을 한눈에 봅니다.', empty: '수강 중인 과정이 없습니다.'},
};
function renderAdminSchedule() { return renderSchedule('admin'); }
async function renderSchedule(scope) {
 const S = SCHEDULE_SCOPES[scope];
 shell();
 startLoading(`${S.title}을 불러오고 있습니다…`);
 try {
  const {courses} = await api(S.api);
  const DAY = 864e5, day = s => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? null : d; };
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dated = courses.filter(c => day(c.start_date) && day(c.end_date));
  const state = c => !day(c.start_date) || !day(c.end_date) ? 'none' : day(c.end_date) < today ? 'done' : day(c.start_date) > today ? 'soon' : 'live';
  const counts = {live: 0, soon: 0, done: 0, none: 0};
  courses.forEach(c => counts[state(c)]++);
  const min = new Date(Math.min(today, ...dated.map(c => day(c.start_date)))), max = new Date(Math.max(today, ...dated.map(c => day(c.end_date))));
  const start = new Date(min.getFullYear(), min.getMonth(), 1), end = new Date(max.getFullYear(), max.getMonth() + 2, 0);
  const px = {day: 34, week: 14, month: 5}[scheduleZoom], days = Math.round((end - start) / DAY) + 1, width = days * px;
  const x = d => Math.round((d - start) / DAY) * px;
  const fmtD = d => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
  // Header: month row plus day or week ticks.
  let months = '', ticks = '', grid = '';
  for (let m = new Date(start); m <= end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
   const next = new Date(m.getFullYear(), m.getMonth() + 1, 1), w = x(next > end ? new Date(+end + DAY) : next) - x(m);
   months += `<div class="sc-month" data-left="${x(m)}" data-width="${w}">${m.getFullYear()}년 ${m.getMonth() + 1}월</div>`;
   grid += `<div class="sc-grid-month" data-left="${x(m)}"></div>`;
  }
  for (let d = new Date(start); d <= end; d = new Date(+d + DAY)) {
   const wk = d.getDay();
   if (scheduleZoom === 'day') { ticks += `<div class="sc-tick${wk === 0 || wk === 6 ? ' weekend' : ''}" data-left="${x(d)}" data-width="${px}">${d.getDate()}</div>`; if (wk === 6 || wk === 0) grid += `<div class="sc-weekend" data-left="${x(d)}" data-width="${px}"></div>`; }
   else if (wk === 1) { ticks += `<div class="sc-tick" data-left="${x(d)}" data-width="${px * 7}">${scheduleZoom === 'week' ? fmtD(d) : d.getDate()}</div>`; grid += `<div class="sc-grid-week" data-left="${x(d)}"></div>`; }
  }
  const labels = {live: '진행 중', soon: '예정', done: '종료', none: '기간 미정'};
  const rows = courses.map(c => {
   const st = state(c), s = day(c.start_date), e = day(c.end_date);
   let bar = '';
   if (s && e) {
    const left = x(s), w = x(new Date(+e + DAY)) - left, total = (e - s) / DAY + 1;
    const doneRatio = st === 'done' ? 100 : st === 'soon' ? 0 : Math.round(((today - s) / DAY + 1) * 100 / total);
    const weekOf = n => new Date(+s + (n - 1) * 7 * DAY);
    const modules = c.modules.map(m => `<span class="sc-mod" data-left="${x(weekOf(m.week)) - left}" title="${m.week}주차 · ${escape(m.title)}"></span>`).join('');
    const exams = c.assessments.map(a => { const d = day(a.opens_at) || weekOf(a.week); return `<span class="sc-exam ${a.kind}${a.published ? '' : ' draft'}" data-left="${x(d) - left + Math.min(px, 14) / 2}" title="${a.week}주차 ${a.kind === 'exam' ? '시험' : '미니퀴즈'} · ${escape(a.title)} (${fmtD(d)})"></span>`; }).join('');
    const meets = (c.meetings || []).map(mt => { const d = new Date(mt.at), dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return `<span class="sc-meet ${mt.status}" data-left="${x(dd) - left + Math.min(px, 14) / 2}" title="면담${mt.status === 'done' ? '(완료)' : ''} · ${escape(mt.student_name)} · ${escape(mt.topic)} (${fmtD(dd)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')})"></span>`; }).join('');
    bar = `<div class="sc-bar ${st}" data-left="${left}" data-width="${w}" title="${escape(c.title)} · ${escape(c.start_date)} ~ ${escape(c.end_date)}"><div class="sc-bar-fill" data-width-pct="${doneRatio}"></div><span class="sc-bar-label">${escape(c.title)}${st === 'live' ? ` · ${doneRatio}%` : ''}</span>${modules}${exams}${meets}</div>`;
   }
   return {side: `<div class="sc-row-head"><span class="sc-dot ${st}"></span><div><strong>${escape(c.title)}</strong><small>${escape(c.owner_name)} 강사${scope === 'student' ? '' : ` · 수강생 ${c.enrolled}명`}</small><small class="sc-period">${s && e ? `${escape(c.start_date.slice(0, 10).replaceAll('-', '.'))} ~ ${escape(c.end_date.slice(0, 10).replaceAll('-', '.'))}` : '기간 미정'}</small></div><span class="sc-state ${st}">${labels[st]}</span></div>`, track: `<div class="sc-row">${bar}</div>`};
  });
  const todayX = x(today) + px / 2;
  $('#main').innerHTML = `<section class="intro"><span class="eyebrow">${S.eyebrow}</span><h1>${S.title}</h1><p>${S.intro} 막대는 과정 기간, 세로선은 오늘, 마름모는 시험·미니퀴즈, 동그라미는 면담입니다.</p></section>
  <div class="g-kpis sc-kpis"><div class="g-kpi"><span>진행 중</span><strong>${counts.live}</strong></div><div class="g-kpi"><span>예정</span><strong>${counts.soon}</strong></div><div class="g-kpi"><span>종료</span><strong>${counts.done}</strong></div><div class="g-kpi"><span>오늘</span><strong class="sc-today-kpi">${today.getFullYear()}.${fmtD(today)}</strong></div></div>
  <section class="panel sc-panel"><div class="sc-toolbar"><div class="sc-legend"><span><i class="sc-dot live"></i>진행 중</span><span><i class="sc-dot soon"></i>예정</span><span><i class="sc-dot done"></i>종료</span><span><i class="sc-exam exam inline"></i>시험</span><span><i class="sc-exam quiz inline"></i>미니퀴즈</span><span><i class="sc-mod inline"></i>주차 모듈</span><span><i class="sc-meet inline"></i>면담</span><span><i class="sc-today-mark"></i>오늘</span></div><div class="sc-actions"><div class="tabs subtabs inline sc-zoom">${[['day', '일'], ['week', '주'], ['month', '월']].map(([k, l]) => `<button type="button" data-zoom="${k}" class="${k === scheduleZoom ? 'selected' : ''}">${l}</button>`).join('')}</div><button type="button" class="secondary" id="sc-today">오늘로 이동</button></div></div>
  ${courses.length ? `<div class="sc-wrap"><div class="sc-side"><div class="sc-side-head">과정 · 강사</div>${rows.map(r => r.side).join('')}</div><div class="sc-scroll" id="sc-scroll"><div class="sc-canvas" data-width="${width}"><div class="sc-head"><div class="sc-months">${months}</div><div class="sc-ticks">${ticks}</div></div><div class="sc-body">${grid}${rows.map(r => r.track).join('')}<div class="sc-today" data-left="${todayX}"><span>오늘 ${fmtD(today)}</span></div></div></div></div></div>` : `<p class="empty">${S.empty}</p>`}</section>`;
  // Positions are applied through the CSSOM (no inline style attributes).
  $('#main').querySelectorAll('[data-left]').forEach(el => el.style.left = el.dataset.left + 'px');
  $('#main').querySelectorAll('[data-width]').forEach(el => el.style.width = el.dataset.width + 'px');
  $('#main').querySelectorAll('[data-width-pct]').forEach(el => el.style.width = el.dataset.widthPct + '%');
  const scroller = $('#sc-scroll');
  const toToday = smooth => scroller && scroller.scrollTo({left: Math.max(0, todayX - scroller.clientWidth / 2), behavior: smooth ? 'smooth' : 'auto'});
  toToday(false);
  $('#sc-today')?.addEventListener('click', () => toToday(true));
  $('#main').querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => { scheduleZoom = b.dataset.zoom; renderSchedule(scope); }));
 } catch (e) { $('#main').innerHTML = `<p class="error">${escape(e.message)}</p>`; }
}
