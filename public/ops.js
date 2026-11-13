// Admin operations screens: 과정 개설·배정, 위험 학생, 강사 운영 품질, AI 사용량·비용, 공지·알림, 보고서, 활동 로그.
const opNum = v => v == null ? '-' : Number(v).toLocaleString('ko-KR');
const opUsd = v => '$' + (Number(v) || 0).toFixed(Number(v) >= 10 ? 2 : 3);
const opDate = v => v ? new Date(v).toLocaleString('ko-KR', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '-';
const opIntro = (eyebrow, title, text, actions = '') => `<section class="intro m-intro"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${text}</p></div>${actions}</section>`;
const opKpis = items => `<div class="g-kpis op-kpis">${items.map(([l, v, s, cls = '']) => `<div class="g-kpi ${cls}"><span>${l}</span><strong>${v}</strong>${s ? `<small>${s}</small>` : ''}</div>`).join('')}</div>`;
const opFail = e => { $('#main').innerHTML = `<section class="panel"><h2>불러오지 못했습니다</h2><p>${escape(e.message)}</p></section>`; };
const opApply = () => { $('#main').querySelectorAll('[data-w]').forEach(el => el.style.width = Math.max(0, Math.min(100, el.dataset.w)) + '%'); $('#main').querySelectorAll('[data-h]').forEach(el => el.style.height = Math.max(0, Math.min(100, el.dataset.h)) + '%'); };

// ---------- 과정 개설·배정 ----------
async function renderAdminCourses() {
 shell(); startLoading('과정 목록을 불러오고 있습니다…');
 try {
  const {courses, instructors} = await api('/admin/courses');
  const opts = sel => instructors.map(i => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${escape(i.name)}</option>`).join('');
  const state = {preparing: ['준비 중', 'g-none'], active: ['운영 중', 'g-pub'], ended: ['종료', 'g-draft']};
  $('#main').innerHTML = opIntro('ADMIN CONSOLE', '과정 개설·배정', '관리자가 과정을 개설하고 담당 강사를 지정한 뒤, 학생을 CSV로 한 번에 등록합니다.', '<button class="primary" id="op-new-course">+ 과정 개설</button>') +
   opKpis([['전체 과정', courses.length], ['운영 중', courses.filter(c => c.status === 'active').length], ['준비 중', courses.filter(c => c.status === 'preparing').length], ['총 수강 등록', opNum(courses.reduce((a, c) => a + c.enrolled, 0)), '과정별 등록 합계']]) +
   `<section class="panel m-panel"><div class="m-toolbar"><strong class="op-title">과정 목록</strong><span class="muted op-sub">담당 강사를 바꾸면 해당 강사에게 알림이 갑니다.</span></div><div class="table-wrap m-table"><table><thead><tr><th>과정</th><th>기간</th><th>상태</th><th>담당 강사</th><th class="num">수강생</th><th class="num">평가·모듈</th><th class="right">학생 등록</th></tr></thead><tbody>${courses.map(c => `<tr><td><strong>${escape(c.title)}</strong>${c.description ? `<small class="op-desc">${escape(c.description.length > 40 ? c.description.slice(0, 40) + '…' : c.description)}</small>` : ''}</td><td><small class="m-date">${escape(c.start_date || '-')} ~ ${escape(c.end_date || '-')}</small></td><td><span class="g-state ${state[c.status]?.[1] || ''}">${state[c.status]?.[0] || c.status}</span></td><td><select class="op-owner" data-id="${c.id}" aria-label="담당 강사">${opts(c.owner_id)}</select></td><td class="num">${c.enrolled}<small> 명</small></td><td class="num">${c.assessments}<small> / ${c.modules}주</small></td><td class="right"><button type="button" class="m-btn op-enroll" data-id="${c.id}" data-title="${escape(c.title)}">CSV 등록</button></td></tr>`).join('') || '<tr><td colspan="7"><div class="m-empty"><strong>과정이 없습니다</strong></div></td></tr>'}</tbody></table></div></section>`;
  $('#main').querySelectorAll('.op-owner').forEach(s => s.onchange = async () => { try { await api('/admin/courses/' + s.dataset.id, {method: 'PATCH', body: JSON.stringify({owner_id: s.value})}); toast('담당 강사를 변경하고 알림을 보냈습니다.'); } catch (e) { toast(e.message); renderAdminCourses(); } });
  $('#op-new-course').onclick = () => opDialog(`<h2>과정 개설</h2><label>과정 이름</label><input name="title" maxlength="160" required placeholder="예: 데이터 엔지니어링 입문"><label>영문 과정명 (영문 수료증용, 선택)</label><input name="title_en" maxlength="160" placeholder="예: Introduction to Data Engineering"><label>설명</label><textarea name="description" rows="3" maxlength="2000" placeholder="과정 소개"></textarea><div class="op-row"><div><label>시작일</label><input type="date" name="start_date"></div><div><label>종료일</label><input type="date" name="end_date"></div></div><div class="op-row"><div><label>담당 강사</label><select name="owner_id" required>${opts()}</select></div><div><label>상태</label><select name="status"><option value="preparing">준비 중</option><option value="active">운영 중</option></select></div></div>`, '개설하기', async data => { await api('/admin/courses', {method: 'POST', body: JSON.stringify(data)}); toast('과정을 개설하고 담당 강사에게 알림을 보냈습니다.'); renderAdminCourses(); });
  $('#main').querySelectorAll('.op-enroll').forEach(b => b.onclick = () => opDialog(`<h2>학생 일괄 등록</h2><p class="muted">${b.dataset.title} · 한 줄에 한 명, <code>이름,이메일</code> 형식입니다. 없는 계정은 새로 만들고(로그인 비활성), 이미 등록된 학생은 건너뜁니다.</p><input type="file" accept=".csv,text/csv,text/plain" class="op-file"><textarea name="csv" rows="9" placeholder="이름,이메일&#10;홍길동,hong@example.com&#10;김철수,kim@example.com"></textarea><p class="muted op-preview"></p>`, '등록하기', async data => { const r = await api(`/admin/courses/${b.dataset.id}/enroll`, {method: 'POST', body: JSON.stringify({csv: data.csv})}); toast(`${r.added}명 등록 (새 계정 ${r.created}명)${r.skipped.length ? ` · 학생이 아닌 계정 ${r.skipped.length}명 제외` : ''}${r.invalid.length ? ` · 형식 오류 ${r.invalid.length}줄` : ''}`); renderAdminCourses(); }, dlg => {
   const ta = dlg.querySelector('textarea'), pv = dlg.querySelector('.op-preview');
   const count = () => { const n = ta.value.split(/\r?\n/).filter(l => /@/.test(l)).length; pv.textContent = n ? `인식된 학생 ${n}명` : ''; };
   ta.oninput = count; dlg.querySelector('.op-file').onchange = async e => { const f = e.target.files[0]; if (f) { ta.value = (await f.text()).replace(/^﻿/, ''); count(); } };
  }));
  bindViews();
 } catch (e) { opFail(e); }
}
function opDialog(inner, submitLabel, onSubmit, setup) {
 const dlg = document.createElement('dialog'); dlg.className = 'student-dialog op-dialog';
 dlg.innerHTML = `<form method="dialog">${inner}<p class="error op-error" role="alert"></p><div class="quick-actions"><button type="button" class="secondary op-cancel">취소</button><button class="primary" type="submit">${submitLabel}</button></div></form>`;
 document.body.append(dlg); dlg.showModal(); setup?.(dlg);
 dlg.querySelector('.op-cancel').onclick = () => dlg.close();
 dlg.addEventListener('close', () => dlg.remove());
 dlg.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const btn = e.submitter; btn.disabled = true; try { await onSubmit(Object.fromEntries(new FormData(e.target))); dlg.close(); } catch (err) { dlg.querySelector('.op-error').textContent = err.message; btn.disabled = false; } });
}

// ---------- 위험 학생 ----------
let riskFilter = '';
async function renderRisk() {
 shell(); startLoading('위험 학생을 분석하고 있습니다…');
 try {
  const {students, summary} = await api('/admin/risk');
  const list = students.filter(s => !riskFilter || s.level === riskFilter);
  const lv = {high: ['높음', 'op-high'], medium: ['보통', 'op-mid'], low: ['관찰', 'op-low']};
  $('#main').innerHTML = opIntro('ADMIN CONSOLE', '위험 학생', '미응시 누적, 점수 급락, 현업 3년차 기준 대비 큰 격차가 있는 학생을 모았습니다. 담당 강사에게 바로 알릴 수 있습니다.') +
   opKpis([['위험 높음', summary.high, '즉시 상담 권장', 'op-k-high'], ['위험 보통', summary.medium, '이번 주 확인'], ['관찰', summary.low, '추세 지켜보기'], ['대상 학생', summary.students, '중복 제외']]) +
   `<section class="panel m-panel"><div class="m-toolbar"><div class="m-seg">${[['', '전체', students.length], ['high', '높음', summary.high], ['medium', '보통', summary.medium], ['low', '관찰', summary.low]].map(([k, l, n]) => `<button type="button" data-risk="${k}" class="${riskFilter === k ? 'selected' : ''}">${l}<span>${n}</span></button>`).join('')}</div><span class="muted op-sub">기준: 미응시 2건 이상 · 직전 평균 대비 20점 이상 하락 · 3년차 기준과 25점 이상 차이 · 평균 50점 미만</span></div>
   <div class="table-wrap m-table"><table><thead><tr><th>학생</th><th>과정 · 담당</th><th>위험도</th><th>사유</th><th class="num">평균 / 기준</th><th class="right">조치</th></tr></thead><tbody>${list.map((s, i) => `<tr><td><div class="m-user">${memberAvatar({id: s.student_id, name: s.student_name})}<div><strong>${escape(s.student_name)}</strong><small>${escape(s.email)}</small></div></div></td><td><strong class="op-course">${escape(s.course_title)}</strong><small class="op-desc">${escape(s.owner_name)} 강사</small></td><td><span class="op-level ${lv[s.level][1]}">${lv[s.level][0]}</span></td><td><div class="op-reasons">${s.reasons.map(r => `<span class="op-reason op-r-${r.type}" title="${escape(r.detail)}">${escape(r.label)}</span>`).join('')}</div></td><td class="num">${s.average ?? '-'}<small> / ${s.benchmark ?? '-'}</small></td><td class="right">${s.notified_at ? `<small class="muted op-notified">${opDate(s.notified_at)} 알림</small> ` : ''}<button type="button" class="m-btn op-notify" data-i="${i}">강사에게 알림</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="m-empty"><strong>해당하는 학생이 없습니다</strong><span>모든 학생이 안정적으로 학습하고 있습니다.</span></div></td></tr>'}</tbody></table></div></section>`;
  $('#main').querySelectorAll('[data-risk]').forEach(b => b.onclick = () => { riskFilter = b.dataset.risk; renderRisk(); });
  $('#main').querySelectorAll('.op-notify').forEach(b => b.onclick = async () => { const s = list[b.dataset.i]; b.disabled = true; try { await api('/admin/risk/notify', {method: 'POST', body: JSON.stringify({student_id: s.student_id, course_id: s.course_id, reasons: s.reasons.map(r => r.label)})}); toast(`${s.owner_name} 강사에게 알림을 보냈습니다.`); renderRisk(); } catch (e) { toast(e.message); b.disabled = false; } });
  $('#main').querySelectorAll('.m-avatar').forEach(el => el.style.background = AVATAR_TONES[el.dataset.tone]);
 } catch (e) { opFail(e); }
}

// ---------- 강사 운영 품질 ----------
async function renderQuality() {
 shell(); startLoading('강사별 운영 지표를 계산하고 있습니다…');
 try {
  const {instructors: list} = await api('/admin/quality');
  const avg = k => { const v = list.map(i => i[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const tone = (v, good, bad, lowerBetter = true) => v == null ? '' : (lowerBetter ? v <= good : v >= good) ? 'op-good' : (lowerBetter ? v >= bad : v <= bad) ? 'op-bad' : 'op-warn';
  const bar = (v, max, cls) => v == null ? '<span class="muted">-</span>' : `<div class="op-bar"><span class="${cls}" data-w="${Math.min(100, v * 100 / max)}"></span></div>`;
  $('#main').innerHTML = opIntro('ADMIN CONSOLE', '강사 운영 품질', '주관식 채점 지연, AI 제안 수정률, 학습 방향 작성률, 면담 실적을 강사별로 비교합니다.') +
   opKpis([['평균 채점 지연', avg('avg_delay_h') != null ? avg('avg_delay_h') + '<small>시간</small>' : '-', '제출 → 확정 (주관식)'], ['24시간 내 확정', avg('within_24h') != null ? avg('within_24h') + '<small>%</small>' : '-', '강사 평균'], [`AI 제안 수정률 ${AI_MARK}`, avg('ai_edit_rate') != null ? avg('ai_edit_rate') + '<small>%</small>' : '-', 'AI 제안 점수를 고친 비율'], ['학습 방향 작성률', avg('guidance_rate') != null ? avg('guidance_rate') + '<small>%</small>' : '-', '응시 학생 대비 공개'], ['위험 학생 면담률', (() => { const t = list.reduce((a, i) => a + i.risk_students, 0), ok = list.reduce((a, i) => a + i.risk_counseled, 0); return t ? Math.round(ok * 100 / t) + '<small>%</small>' : '-'; })(), `최근 30일 · 면담 ${list.reduce((a, i) => a + i.meetings_month, 0)}회`]]) +
   `<section class="panel m-panel"><div class="table-wrap m-table"><table><thead><tr><th>강사</th><th class="num">과정</th><th>평균 채점 지연</th><th class="num">24h 내</th><th class="num">대기 · 최장</th><th>AI 제안 수정률</th><th>학습 방향 작성률</th><th class="num">면담</th><th>위험 학생 면담률</th></tr></thead><tbody>${list.map(i => `<tr><td><div class="m-user">${memberAvatar(i)}<div><strong>${escape(i.name)}</strong><small>${escape(i.email)}</small></div></div></td><td class="num">${i.courses}</td><td><div class="op-metric"><b class="${tone(i.avg_delay_h, 24, 48)}">${i.avg_delay_h ?? '-'}<small>${i.avg_delay_h != null ? '시간' : ''}</small></b>${bar(i.avg_delay_h, 96, tone(i.avg_delay_h, 24, 48))}</div><small class="muted">${i.graded ? `중앙값 ${i.median_delay_h}시간 · ${i.graded}건` : '확정된 주관식 없음'}</small></td><td class="num">${i.within_24h != null ? i.within_24h + '<small>%</small>' : '-'}</td><td class="num">${i.waiting}<small>건 · ${i.oldest_wait_h != null ? Math.round(i.oldest_wait_h) + 'h' : '-'}</small></td><td><div class="op-metric"><b>${i.ai_edit_rate ?? '-'}<small>${i.ai_edit_rate != null ? '%' : ''}</small></b>${bar(i.ai_edit_rate, 100, 'op-blue')}</div><small class="muted">AI 제안 ${i.ai_used}건 확인</small></td><td><div class="op-metric"><b class="${tone(i.guidance_rate, 80, 50, false)}">${i.guidance_rate ?? '-'}<small>${i.guidance_rate != null ? '%' : ''}</small></b>${bar(i.guidance_rate, 100, tone(i.guidance_rate, 80, 50, false))}</div><small class="muted">공개 ${i.guidance_published} · 초안 ${i.guidance_drafts} / 학생 ${i.learners}</small></td><td class="num"><b>${i.meetings_done}</b><small class="op-desc">30일 ${i.meetings_month}${i.meetings_waiting ? ` · 대기 ${i.meetings_waiting}` : ''}</small></td><td><div class="op-metric"><b class="${tone(i.counsel_rate, 80, 50, false)}">${i.counsel_rate ?? '-'}<small>${i.counsel_rate != null ? '%' : ''}</small></b>${bar(i.counsel_rate, 100, tone(i.counsel_rate, 80, 50, false))}</div><small class="muted">${i.risk_students ? `${i.risk_counseled} / ${i.risk_students}명 (30일)` : '위험 학생 없음'}</small></td></tr>`).join('') || '<tr><td colspan="9"><div class="m-empty"><strong>과정을 담당한 강사가 없습니다</strong></div></td></tr>'}</tbody></table></div><p class="muted op-foot">AI 제안 수정률은 강사가 AI 제안 점수를 바꿔 확정한 비율입니다. 높으면 채점 기준이나 지시문을 손볼 필요가 있다는 신호입니다.</p></section>`;
  $('#main').querySelectorAll('.m-avatar').forEach(el => el.style.background = AVATAR_TONES[el.dataset.tone]);
  opApply();
 } catch (e) { opFail(e); }
}

// ---------- AI 사용량·비용 ----------
async function renderAIUsage() {
 shell(); startLoading('AI 사용량을 불러오고 있습니다…');
 try {
  const d = await api('/admin/ai-usage');
  const month = new Date().toISOString().slice(0, 7), cur = d.months.find(m => m.month === month) || {calls: 0, failed: 0, input: 0, output: 0, cost: 0};
  const used = d.limit ? Math.min(100, cur.cost * 100 / d.limit) : 0;
  // 30 days, zero-filled
  const days = []; for (let i = 29; i >= 0; i--) { const k = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push(d.days.find(x => x.day === k) || {day: k, calls: 0, failed: 0, cost: 0, input: 0, output: 0}); }
  const maxCalls = Math.max(1, ...days.map(x => x.calls));
  const purpose = {grading: '주관식 채점', guidance: '학습 방향 초안', test: '연결 테스트'};
  $('#main').innerHTML = opIntro('ADMIN CONSOLE', `AI 사용량·비용 ${AI_MARK}`, `AI 호출 수, 토큰, 예상 비용과 실패를 일·월 단위로 봅니다. ${d.setting ? `현재 ${escape(d.setting.provider)} · ${escape(d.setting.model || '-')}` : 'AI 설정 없음'}`) +
   opKpis([['이번 달 호출', opNum(cur.calls), `실패 ${cur.failed}건`], ['이번 달 토큰', opNum(cur.input + cur.output), `입력 ${opNum(cur.input)} · 출력 ${opNum(cur.output)}`], ['이번 달 예상 비용', opUsd(cur.cost), d.limit ? `한도 ${opUsd(d.limit)}의 ${Math.round(used)}%` : '한도 없음'], ['실패율', cur.calls ? (Math.round(cur.failed * 1000 / cur.calls) / 10) + '<small>%</small>' : '-', '이번 달']]) +
   `<div class="op-grid"><section class="panel op-card"><div class="op-card-head"><div><h3>일별 호출 · 비용</h3><p class="muted">최근 30일 · 막대는 호출 수, 빨간 부분은 실패</p></div><div class="sc-legend"><span><i class="op-sw ok"></i>성공</span><span><i class="op-sw bad"></i>실패</span></div></div><div class="op-chart">${days.map(x => `<div class="op-col" title="${x.day} · 호출 ${x.calls}건 · 실패 ${x.failed}건 · ${opUsd(x.cost)}"><div class="op-col-bar" data-h="${x.calls * 100 / maxCalls}"><span class="op-col-fail" data-h="${x.calls ? x.failed * 100 / x.calls : 0}"></span></div><small>${x.day.slice(8) === '01' || x.day === days[0].day || x.day.slice(8) % 5 === 0 ? Number(x.day.slice(5, 7)) + '.' + Number(x.day.slice(8)) : ''}</small></div>`).join('')}</div></section>
   <section class="panel op-card"><h3>월 한도</h3><p class="muted">한도에 도달하면 AI 채점·학습 방향 초안 호출이 막힙니다. 0이면 제한 없음.</p><div class="op-limit"><div class="op-limit-bar"><span class="${used >= 90 ? 'op-bad' : used >= 70 ? 'op-warn' : 'op-good'}" data-w="${used}"></span></div><div class="op-limit-text"><strong>${opUsd(cur.cost)}</strong> / ${d.limit ? opUsd(d.limit) : '무제한'}</div></div><form id="op-limit-form" class="op-inline"><label for="op-limit">월 한도 (USD)</label><input id="op-limit" type="number" min="0" step="1" value="${d.limit}"><button class="primary">저장</button></form>
   <h3 class="op-h3">용도별 (이번 달)</h3>${d.purposes.map(p => `<div class="op-purpose"><span>${purpose[p.purpose] || escape(p.purpose)}</span><b>${opNum(p.calls)}건</b><small>${opUsd(p.cost)}</small></div>`).join('') || '<p class="muted">기록 없음</p>'}</section></div>
   <div class="op-grid"><section class="panel op-card"><h3>월별 추이</h3><div class="table-wrap m-table"><table><thead><tr><th>월</th><th class="num">호출</th><th class="num">실패</th><th class="num">입력 토큰</th><th class="num">출력 토큰</th><th class="num">예상 비용</th></tr></thead><tbody>${d.months.map(m => `<tr><td><strong>${m.month}</strong></td><td class="num">${opNum(m.calls)}</td><td class="num">${opNum(m.failed)}</td><td class="num">${opNum(m.input)}</td><td class="num">${opNum(m.output)}</td><td class="num"><b>${opUsd(m.cost)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="empty">기록 없음</td></tr>'}</tbody></table></div></section>
   <section class="panel op-card"><h3>최근 실패</h3>${d.failures.map(f => `<div class="op-fail"><span class="op-reason op-r-missed">${purpose[f.purpose] || escape(f.purpose)}</span><div><strong>${escape(f.error || '오류')}</strong><small class="muted">${opDate(f.created_at)} · ${escape(f.user_name || '-')} · ${escape(f.model)}</small></div></div>`).join('') || '<p class="muted">최근 실패가 없습니다.</p>'}</section></div><p class="muted op-foot">예상 비용은 모델별 공개 단가(1M 토큰 기준)로 계산한 추정치이며 실제 청구액과 다를 수 있습니다.</p>`;
  opApply();
  $('#op-limit-form').onsubmit = async e => { e.preventDefault(); try { await api('/admin/ai-usage/limit', {method: 'POST', body: JSON.stringify({limit: Number($('#op-limit').value)})}); toast('월 한도를 저장했습니다.'); renderAIUsage(); } catch (err) { toast(err.message); } };
 } catch (e) { opFail(e); }
}

// ---------- 공지·알림 (all roles) ----------
async function renderNotices() {
 shell(); startLoading('공지와 알림을 불러오고 있습니다…');
 try {
  const d = await api('/announcements');
  const canWrite = ['admin', 'instructor'].includes(user.role);
  const kinds = {notice: ['공지', 'op-k-notice'], exam: ['시험 안내', 'op-k-exam'], urgent: ['긴급', 'op-k-urgent']};
  const scopeOpts = (user.role === 'admin' ? '<option value="">전체 (모든 사용자)</option>' : '') + d.courses.map(c => `<option value="${c.id}">${escape(c.title)}</option>`).join('');
  $('#main').innerHTML = opIntro(user.role === 'admin' ? 'ADMIN CONSOLE' : user.role === 'instructor' ? 'CLASSROOM' : 'MY SPACE', '공지·알림', user.role === 'admin' ? '전체 또는 과정별 공지를 올리고, 다가오는 시험 일정과 받은 알림을 확인합니다.' : user.role === 'instructor' ? '담당 과정에 공지를 올리고, 관리자 알림(위험 학생, 과정 배정)을 확인합니다.' : '전체·과정 공지와 다가오는 시험 일정을 확인하세요.', canWrite ? '<button class="primary" id="op-new-notice">+ 공지 작성</button>' : '') +
   `<div class="op-notice-grid"><div>
    ${d.notifications.length ? `<section class="panel op-card"><div class="op-card-head"><h3>받은 알림 ${d.unread ? `<span class="op-unread">${d.unread}</span>` : ''}</h3>${d.unread ? '<button type="button" class="secondary op-small" id="op-read">모두 읽음</button>' : ''}</div>${d.notifications.map(n => `<div class="op-note ${n.read_at ? '' : 'unread'}"><span class="op-note-dot op-n-${escape(n.kind)}"></span><div><strong>${escape(n.title)}</strong><p>${escape(n.body)}</p><small class="muted">${opDate(n.created_at)}</small></div>${n.link ? `<a class="m-btn" href="${escape(n.link)}">열기</a>` : ''}</div>`).join('')}</section>` : ''}
    <section class="panel op-card"><h3>공지</h3>${d.announcements.map(a => `<article class="op-ann"><div class="op-ann-head"><span class="op-kind ${kinds[a.kind]?.[1]}">${kinds[a.kind]?.[0] || '공지'}</span><span class="op-scope">${a.course_title ? escape(a.course_title) : '전체'}</span><small class="muted">${escape(a.author_name)} · ${opDate(a.created_at)}</small>${user.role === 'admin' || a.author_name === user.name ? `<button type="button" class="op-del" data-id="${a.id}" title="삭제">삭제</button>` : ''}</div><h4>${escape(a.title)}</h4>${a.body ? `<p>${escape(a.body).replace(/\n/g, '<br>')}</p>` : ''}</article>`).join('') || '<p class="muted">공지가 없습니다.</p>'}</section></div>
    <div class="op-side-col"><section class="panel op-card"><h3>다가오는 시험 일정</h3><p class="muted">앞으로 7일 안에 열리는 시험·미니퀴즈</p>${d.upcoming.map(u => { const days = Math.ceil((new Date(u.opens_at) - Date.now()) / 864e5); return `<div class="op-exam"><div class="op-exam-day"><b>${new Date(u.opens_at).getDate()}</b><small>${new Date(u.opens_at).getMonth() + 1}월</small></div><div><strong>${escape(u.title)}</strong><small class="muted">${escape(u.course_title)} · ${u.kind === 'exam' ? '시험' : '미니퀴즈'}</small></div><span class="op-dday">${days <= 0 ? '오늘' : 'D-' + days}</span></div>`; }).join('') || '<p class="muted">7일 안에 예정된 평가가 없습니다.</p>'}</section></div></div>`;
  $('#op-read')?.addEventListener('click', async () => { await api('/notifications/read', {method: 'POST', body: '{}'}); renderNotices(); });
  $('#main').querySelectorAll('.op-del').forEach(b => b.onclick = async () => { if (!confirm('이 공지를 삭제할까요?')) return; try { await api(`/announcements/${b.dataset.id}/delete`, {method: 'POST', body: '{}'}); renderNotices(); } catch (e) { toast(e.message); } });
  $('#main').querySelectorAll('.op-note a').forEach(a => a.onclick = e => { e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); routeUser(); });
  $('#op-new-notice')?.addEventListener('click', () => opDialog(`<h2>공지 작성</h2><div class="op-row"><div><label>대상</label><select name="course_id">${scopeOpts}</select></div><div><label>종류</label><select name="kind"><option value="notice">공지</option><option value="exam">시험 안내</option><option value="urgent">긴급</option></select></div></div><label>제목</label><input name="title" maxlength="160" required><label>내용</label><textarea name="body" rows="6" maxlength="4000"></textarea>`, '게시하기', async data => { await api('/announcements', {method: 'POST', body: JSON.stringify({...data, course_id: data.course_id || null})}); toast('공지를 게시했습니다.'); renderNotices(); }));
 } catch (e) { opFail(e); }
}

// ---------- 보고서 내보내기 ----------
async function renderReports(courseId) {
 shell(); startLoading('보고서를 준비하고 있습니다…');
 try {
  const {courses} = await api('/admin/reports');
  const cid = courseId || (courses.find(c => c.status === 'active' && c.assessments >= 5) || courses[0])?.id;
  const r = cid ? await api('/admin/reports/' + cid) : null;
  const stat = r ? {done: r.rows.filter(x => x.completion === '수료').length, warn: r.rows.filter(x => x.completion === '주의').length, avg: (() => { const v = r.rows.map(x => x.average).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; })()} : {};
  const tag = {'수료': 'g-pub', '진행 중': 'g-none', '주의': 'g-draft', '미수료': 'g-draft'};
  $('#main').innerHTML = opIntro('ADMIN CONSOLE', '보고서 내보내기', '과정별 성적과 수료 현황을 엑셀(CSV)로 받거나 PDF로 인쇄합니다. 수료 기준: 응시율 80% 이상, 평균 60점 이상.') +
   `<section class="panel m-panel"><div class="m-toolbar op-no-print"><select id="op-report-course" aria-label="과정 선택">${courses.map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${escape(c.title)} · ${escape(c.owner_name)}</option>`).join('')}</select><span class="op-spacer"></span><button type="button" class="secondary" id="op-csv">엑셀(CSV) 다운로드</button><button type="button" class="primary" id="op-print">PDF·인쇄</button></div>
   ${r ? `<div class="op-report" id="op-report"><div class="op-report-head"><div><span class="eyebrow">COURSE REPORT</span><h2>${escape(r.course.title)}</h2><p class="muted">${escape(r.course.start_date || '-')} ~ ${escape(r.course.end_date || '-')} · 담당 ${escape(r.course.owner_name)} · 생성 ${new Date(r.generated_at).toLocaleString('ko-KR')}</p></div><div class="op-report-stats"><div><small>수강생</small><b>${r.rows.length}</b></div><div><small>수료</small><b>${stat.done}</b></div><div><small>주의</small><b>${stat.warn}</b></div><div><small>평균</small><b>${stat.avg ?? '-'}</b></div></div></div>
   <div class="table-wrap m-table"><table class="op-report-table"><thead><tr><th>학생</th>${r.assessments.map(a => `<th class="num" title="${escape(a.title)}">${a.week}주${a.kind === 'exam' ? ' 시험' : ''}</th>`).join('')}<th class="num">평균</th><th class="num">응시율</th><th>수료</th></tr></thead><tbody>${r.rows.map(x => `<tr><td><strong>${escape(x.name)}</strong><small class="op-desc">${escape(x.email)}</small></td>${x.scores.map(v => `<td class="num ${v == null ? 'op-miss' : typeof v === 'number' && v < 60 ? 'op-lowv' : ''}">${v == null ? '–' : typeof v === 'number' ? v : '<small>채점 중</small>'}</td>`).join('')}<td class="num"><b>${x.average ?? '-'}</b></td><td class="num">${x.participation ?? '-'}%</td><td><span class="g-state ${tag[x.completion]}">${x.completion}</span></td></tr>`).join('')}</tbody></table></div></div>` : '<p class="empty">과정이 없습니다.</p>'}</section>`;
  $('#op-report-course')?.addEventListener('change', e => renderReports(e.target.value));
  $('#op-print')?.addEventListener('click', () => window.print());
  $('#op-csv')?.addEventListener('click', () => {
   const cell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
   const lines = [['학생', '이메일', ...r.assessments.map(a => `${a.week}주차 ${a.title}`), '평균', '응시율(%)', '수료'].map(cell).join(','), ...r.rows.map(x => [x.name, x.email, ...x.scores, x.average, x.participation, x.completion].map(cell).join(','))];
   const blob = new Blob(['﻿' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'});
   const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${r.course.title}_성적보고서_${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
 } catch (e) { opFail(e); }
}

// ---------- 활동 로그 ----------
let actFilter = '', actQ = '', actPage = 1;
const ACTIONS = {'auth.login': ['로그인', 'op-a-auth'], 'auth.login_failed': ['로그인 실패', 'op-a-warn'], 'grade.confirm': ['성적 확정', 'op-a-grade'], 'grade.ai_proposal': ['AI 채점 제안', 'op-a-ai'], 'member.role': ['권한 변경', 'op-a-member'], 'member.activate': ['계정 활성화', 'op-a-member'], 'member.deactivate': ['계정 비활성화', 'op-a-warn'], 'member.password_reset': ['비밀번호 초기화', 'op-a-member'], 'course.create': ['과정 개설', 'op-a-course'], 'course.update': ['과정 수정', 'op-a-course'], 'course.assign': ['담당 강사 지정', 'op-a-course'], 'course.enroll': ['학생 일괄 등록', 'op-a-course'], 'guidance.publish': ['학습 방향 공개', 'op-a-grade'], 'guidance.save': ['학습 방향 저장', 'op-a-grade'], 'announcement.create': ['공지 게시', 'op-a-course'], 'announcement.delete': ['공지 삭제', 'op-a-warn'], 'risk.notify': ['위험 학생 알림', 'op-a-warn'], 'ai.limit': ['AI 한도 변경', 'op-a-ai']};
async function renderActivity() {
 shell(); startLoading('활동 로그를 불러오고 있습니다…');
 try {
  const d = await api(`/admin/activity?action=${encodeURIComponent(actFilter)}&q=${encodeURIComponent(actQ)}&page=${actPage}`);
  const c = Object.fromEntries(d.counts.map(x => [x.grp, x.n])), pages = Math.max(1, Math.ceil(d.total / 20));
  const groups = [['', '전체'], ['auth', '로그인'], ['grade', '성적'], ['member', '회원'], ['course', '과정'], ['guidance', '학습 방향'], ['announcement', '공지'], ['risk', '위험 알림'], ['ai', 'AI']];
  const detail = l => { const x = l.detail || {}; const parts = []; if (x.score != null) parts.push(`점수 ${x.score}`); if (x.ai_used) parts.push(`AI 제안 ${x.ai_used}건${x.ai_changed ? ` 중 ${x.ai_changed}건 수정` : ' 그대로 확정'}`); if (x.role && l.action === 'member.role') parts.push(`→ ${roleLabel(x.role)}`); if (x.owner) parts.push(`담당 ${x.owner}`); if (x.added != null) parts.push(`${x.added}명 등록 · 새 계정 ${x.created}`); if (x.student) parts.push(`${x.student} · ${x.course}`); if (x.reasons?.length) parts.push(x.reasons.join(', ')); if (x.name) parts.push(x.name); if (x.ip) parts.push(`IP ${x.ip}`); return parts.join(' · '); };
  $('#main').innerHTML = opIntro('ADMIN CONSOLE', '활동 로그', '누가 언제 무엇을 했는지 기록합니다. 성적 확정·수정, 로그인, 권한 변경, 과정·공지 변경이 남습니다.') +
   opKpis([['최근 7일 로그인', opNum(c.auth || 0)], ['최근 7일 성적 처리', opNum(c.grade || 0), '확정 · AI 제안'], ['최근 7일 회원·권한 변경', opNum(c.member || 0)], ['전체 기록', opNum(d.total), actFilter || actQ ? '필터 적용' : '누적']]) +
   `<section class="panel m-panel"><div class="m-toolbar"><form id="op-act-search" class="m-search"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="op-act-q" value="${escape(actQ)}" placeholder="사람·대상·내용 검색"></form><div class="m-seg op-seg-wrap">${groups.map(([k, l]) => `<button type="button" data-act="${k}" class="${actFilter === k ? 'selected' : ''}">${l}</button>`).join('')}</div></div>
   <div class="table-wrap m-table"><table><thead><tr><th>시각</th><th>사용자</th><th>활동</th><th>대상 · 내용</th></tr></thead><tbody>${d.rows.map(l => { const [label, cls] = ACTIONS[l.action] || [l.action, '']; return `<tr><td><small class="m-date">${new Date(l.created_at).toLocaleString('ko-KR')}</small></td><td><strong>${escape(l.actor_name || '시스템')}</strong>${l.actor_role ? `<small class="op-desc">${roleLabel(l.actor_role)}</small>` : ''}</td><td><span class="op-act ${cls}">${label}</span></td><td><span class="op-target">${escape(String(l.target).length > 40 && /^[a-f0-9-]{36}/.test(l.target) ? l.target.slice(0, 8) + '…' : l.target)}</span><small class="op-desc">${escape(detail(l))}</small></td></tr>`; }).join('') || '<tr><td colspan="4"><div class="m-empty"><strong>기록이 없습니다</strong></div></td></tr>'}</tbody></table></div>
   <div class="m-pager"><span>${d.total ? `${(actPage - 1) * 20 + 1}–${Math.min(actPage * 20, d.total)}` : 0} / 총 ${opNum(d.total)}건</span><div><button class="secondary" id="op-prev" ${actPage <= 1 ? 'disabled' : ''}>‹ 이전</button><span class="m-page">${actPage} / ${pages}</span><button class="secondary" id="op-next" ${actPage >= pages ? 'disabled' : ''}>다음 ›</button></div></div></section>`;
  $('#main').querySelectorAll('[data-act]').forEach(b => b.onclick = () => { actFilter = b.dataset.act; actPage = 1; renderActivity(); });
  $('#op-act-search').onsubmit = e => { e.preventDefault(); actQ = $('#op-act-q').value.trim(); actPage = 1; renderActivity(); };
  $('#op-prev').onclick = () => { actPage--; renderActivity(); }; $('#op-next').onclick = () => { actPage++; renderActivity(); };
 } catch (e) { opFail(e); }
}
