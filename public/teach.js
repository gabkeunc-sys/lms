// Instructor tools: 오늘 할 일, 일괄 채점, 문항 분석, 문제 은행, 학생 관리(상세·메모), 위험 학생, 과정 운영.
const tParam = k => new URLSearchParams(location.search).get(k);
const tGo = (path) => { history.pushState({}, '', path); routeUser(); };
const tIntro = (title, text, actions = '', eyebrow = 'CLASSROOM') => opIntro(eyebrow, title, text, actions);
const tDiff = {easy: ['쉬움', 'op-low'], medium: ['보통', 'op-mid'], hard: ['어려움', 'op-high']};
const tAvatars = () => $('#main').querySelectorAll('.m-avatar').forEach(el => el.style.background = AVATAR_TONES[el.dataset.tone]);
const tBindLinks = () => $('#main').querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.preventDefault(); tGo(b.dataset.go); });
const tWhen = v => { if (!v) return '-'; const d = new Date(v), days = Math.round((d - Date.now()) / 864e5); return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}${days === 0 ? ' · 오늘' : days > 0 ? ` · D-${days}` : ''}`; };
const tAgo = v => { const h = (Date.now() - new Date(v)) / 36e5; return h < 1 ? '방금' : h < 24 ? Math.round(h) + '시간 전' : Math.round(h / 24) + '일 전'; };

// ---------- 오늘 할 일 ----------
async function renderTeachToday() {
 shell(); startLoading('오늘 할 일을 모으고 있습니다…');
 try {
  const d = await api('/instructor/today');
  const lv = {high: ['높음', 'op-high'], medium: ['보통', 'op-mid'], low: ['관찰', 'op-low']};
  const empty = t => `<div class="td-empty">✓ ${t}</div>`;
  const card = (icon, title, count, sub, body, action) => `<section class="panel op-card td-card"><div class="td-head"><span class="td-icon td-${icon}"></span><div><h3>${title}</h3><small class="muted">${sub}</small></div><b class="td-count">${count}</b></div>${body}${action ? `<div class="td-foot">${action}</div>` : ''}</section>`;
  const hour = new Date().getHours(), riskList = d.risk.filter(x => x.level !== 'low');
  $('#main').innerHTML = tIntro(`${hour < 12 ? '좋은 아침입니다' : hour < 18 ? '좋은 오후입니다' : '오늘도 수고하셨습니다'}, ${escape(user.name)}님`, '지금 처리할 일을 한곳에 모았습니다. 항목을 누르면 바로 해당 화면으로 갑니다.', '', 'TODAY') +
   opKpis([['채점 대기', d.pending_count, d.oldest_pending ? `가장 오래된 제출 ${tAgo(d.oldest_pending)}` : '밀린 채점 없음', d.pending_count ? 'op-k-high' : ''], [`AI 제안 검토 ${AI_MARK}`, d.proposals, `${d.review_count}개 답안`], ['학습 방향 미작성', d.guidance_missing_count, `응시 학생 ${d.guidance_total}명 중`], ['위험 학생', d.risk_summary.high + d.risk_summary.medium, `높음 ${d.risk_summary.high} · 보통 ${d.risk_summary.medium} · 관찰 ${d.risk_summary.low}`]]) +
   `<div class="td-grid">
   ${card('grade', '채점 대기', d.pending_count, '주관식 채점이 끝나지 않은 답안', d.pending.length ? d.pending.map(x => `<a class="td-row" href="/teach/grading?a=${x.assessment_id}" data-go="/teach/grading?a=${x.assessment_id}"><div><strong>${escape(x.title)}</strong><small>${escape(x.course_title)} · ${tAgo(x.oldest)} 제출부터</small></div><span class="td-badge">${x.count}건</span></a>`).join('') : empty('밀린 채점이 없습니다'), d.pending_count ? '<button class="primary" data-go="/teach/grading">일괄 채점 시작</button>' : '')}
   ${card('ai', `AI 제안 검토 ${AI_MARK}`, d.proposals, 'AI가 점수를 제안했고 확정을 기다리는 문항', d.review.length ? d.review.map(x => `<a class="td-row" href="/teach/grading?a=${x.assessment_id}" data-go="/teach/grading?a=${x.assessment_id}"><div><strong>${escape(x.title)}</strong><small>${escape(x.course_title)}</small></div><span class="td-badge td-ai">${x.count}명</span></a>`).join('') : empty('검토할 AI 제안이 없습니다'), d.review.length ? '<button class="secondary" data-go="/teach/grading">AI 제안 한 번에 확정하기</button>' : '')}
   ${card('guide', '학습 방향 미작성', d.guidance_missing_count, '성적이 확정됐지만 학습 방향을 공개하지 않은 학생', d.guidance_missing.length ? d.guidance_missing.slice(0, 5).map(x => `<a class="td-row" href="/teach/students?s=${x.student_id}&c=${x.course_id}" data-go="/teach/students?s=${x.student_id}&c=${x.course_id}"><div class="m-user">${memberAvatar({id: x.student_id, name: x.student_name})}<div><strong>${escape(x.student_name)}</strong><small>${escape(x.course_title)}${x.updated_at ? ' · 초안 있음' : ''}</small></div></div></a>`).join('') : empty('모든 학생에게 학습 방향을 공개했습니다'), d.guidance_missing_count ? '<button class="secondary" data-view="teach-guidance">학습 방향 지도로</button>' : '')}
   ${card('risk', '위험 학생', d.risk_summary.high + d.risk_summary.medium, '미응시·점수 급락·3년차 기준 격차', riskList.length ? riskList.slice(0, 5).map(s => `<a class="td-row" href="/teach/students?s=${s.student_id}&c=${s.course_id}" data-go="/teach/students?s=${s.student_id}&c=${s.course_id}"><div class="m-user">${memberAvatar({id: s.student_id, name: s.student_name})}<div><strong>${escape(s.student_name)} <span class="op-level ${lv[s.level][1]}">${lv[s.level][0]}</span></strong><small>${escape(s.course_title)}</small><div class="op-reasons td-reasons">${s.reasons.slice(0, 2).map(r => `<span class="op-reason op-r-${r.type}">${escape(r.label)}</span>`).join('')}</div></div></div></a>`).join('') : empty('위험 신호가 있는 학생이 없습니다'), '<button class="secondary" data-view="teach-risk">위험 학생 전체 보기</button>')}
   ${card('exam', '이번 주 시험', d.exams.length, '앞으로 7일 안에 열리거나 마감되는 평가', d.exams.length ? d.exams.map(x => `<a class="td-row" href="/teach/plan" data-go="/teach/plan"><div><strong>${escape(x.title)}</strong><small>${escape(x.course_title)} · 열림 ${tWhen(x.opens_at)}</small></div><span class="td-badge ${x.published ? '' : 'td-off'}">${x.published ? `응시 ${x.taken}/${x.enrolled}` : '비공개'}</span></a>`).join('') : empty('이번 주 예정된 시험이 없습니다'), '<button class="secondary" data-view="teach-plan">과정 운영 달력</button>')}
   ${card('bell', '받은 알림', d.notifications.filter(n => !n.read_at).length, '관리자 알림·과정 배정', d.notifications.length ? d.notifications.map(n => `<a class="td-row ${n.read_at ? 'td-read' : ''}" href="/teach/notices" data-go="/teach/notices"><div><strong>${escape(n.title)}</strong><small>${escape(n.body.slice(0, 60))}</small></div><small class="muted">${tAgo(n.created_at)}</small></a>`).join('') : empty('새 알림이 없습니다'), '<button class="secondary" data-view="teach-notices">공지·알림</button>')}
   </div>`;
  tAvatars(); tBindLinks(); bindViews();
 } catch (e) { opFail(e); }
}

// ---------- 일괄 채점 ----------
let gState = null;
async function renderBulkGrading() {
 shell(); startLoading('채점할 답안을 불러오고 있습니다…');
 try {
  const {assessments} = await api('/instructor/grading');
  const aid = tParam('a') || assessments.find(a => a.open)?.id || assessments[0]?.id;
  if (!aid) { $('#main').innerHTML = tIntro('일괄 채점', '주관식 문항이 있는 평가가 아직 없습니다.'); return; }
  const d = await api('/instructor/grading/' + aid);
  const qi = Number(tParam('q') ?? d.questions[0]?.index);
  gState = {d, qi, pos: 0, assessments};
  drawBulkGrading();
 } catch (e) { opFail(e); }
}
function drawBulkGrading() {
 const {d, qi, assessments} = gState, q = d.questions.find(x => x.index === qi) || d.questions[0];
 const rows = d.answers.map(r => ({...r, g: r.grading[q.index] || {}, ans: r.answers[q.index]}));
 const open = rows.filter(r => r.g.status !== 'confirmed'), proposed = rows.filter(r => r.g.status === 'proposed');
 if (gState.pos >= rows.length) gState.pos = 0;
 const cur = rows[gState.pos];
 const st = r => r.g.status === 'confirmed' ? ['확정', 'op-a-grade'] : r.g.status === 'proposed' ? ['AI 제안', 'op-a-ai'] : ['대기', 'op-a-auth'];
 $('#main').innerHTML = tIntro('일괄 채점', '같은 문항의 답안을 한 명씩 넘기며 채점합니다. 점수를 입력하고 Enter를 누르면 저장하고 다음 답안으로 갑니다.', `<button class="primary" id="bg-accept" ${proposed.length ? '' : 'disabled'}>AI 제안 ${proposed.length}건 한 번에 확정</button>`) +
  `<section class="panel m-panel"><div class="m-toolbar"><select id="bg-exam" aria-label="평가 선택">${assessments.map(a => `<option value="${a.id}" ${a.id === d.assessment.id ? 'selected' : ''}>${escape(a.course_title)} · ${escape(a.title)} (남은 ${a.open})</option>`).join('')}</select><div class="m-seg">${d.questions.map((x, i) => `<button type="button" data-q="${x.index}" class="${x.index === q.index ? 'selected' : ''}">주관식 ${i + 1}<span>${x.points}점</span></button>`).join('')}</div><span class="op-spacer"></span><span class="muted op-sub">남은 답안 ${open.length} / ${rows.length}</span></div>
  <div class="bg-wrap"><div class="bg-list">${rows.map((r, i) => `<button type="button" class="bg-item ${i === gState.pos ? 'active' : ''}" data-pos="${i}"><span>${escape(r.student_name)}</span><span class="op-act ${st(r)[1]}">${st(r)[0]}${r.g.score != null && r.g.status !== 'pending' ? ' ' + r.g.score : ''}</span></button>`).join('')}</div>
  <div class="bg-main"><div class="bg-q"><div class="bg-q-head"><span class="op-scope">${escape(q.tag || '주관식')}</span><b>${q.points}점</b></div><div class="bg-prompt">${rich(q.prompt)}</div><details open><summary>모범 답안 · 채점 기준</summary><div class="bg-ref"><div><small>모범 답안</small>${rich(q.model_answer)}</div><div><small>채점 기준</small>${rich(q.rubric)}</div></div></details></div>
  ${cur ? `<div class="bg-answer"><div class="bg-a-head"><div class="m-user">${memberAvatar({id: cur.id, name: cur.student_name})}<div><strong>${escape(cur.student_name)}</strong><small>${opDate(cur.submitted_at)} 제출 · ${gState.pos + 1} / ${rows.length}</small></div></div><span class="op-act ${st(cur)[1]}">${st(cur)[0]}</span></div>
   <div class="bg-text">${String(cur.ans || '').trim() ? rich(cur.ans) : '<span class="muted">빈 답안</span>'}</div>
   ${cur.g.status === 'proposed' ? `<div class="bg-ai"><b>${AI_MARK} 제안 ${cur.g.score} / ${q.points}점</b><p>${escape(cur.g.feedback || '')}</p></div>` : ''}
   <form id="bg-form" class="bg-form"><div class="bg-score"><label for="bg-score">점수</label><input id="bg-score" type="number" min="0" max="${q.points}" step="1" required value="${cur.g.score ?? ''}"><span>/ ${q.points}</span><div class="bg-quick">${[0, .5, .7, 1].map(f => `<button type="button" data-s="${Math.round(q.points * f)}">${Math.round(q.points * f)}</button>`).join('')}</div></div>
   <label for="bg-feedback">피드백</label><textarea id="bg-feedback" rows="3" maxlength="8000">${escape(cur.g.feedback || '')}</textarea>
   <div class="bg-actions"><button type="button" class="secondary" id="bg-prev" ${gState.pos ? '' : 'disabled'}>‹ 이전</button><span class="op-spacer"></span><small class="muted">${cur.status === 'confirmed' ? '이미 확정된 성적입니다' : 'Enter 저장 · Alt+→ 건너뛰기'}</small><button type="button" class="secondary" id="bg-next">건너뛰기 ›</button><button class="primary" ${cur.status === 'confirmed' ? 'disabled' : ''}>저장하고 다음</button></div></form></div>` : ''}
  </div></div></section>`;
 const reload = async (msg) => { const qq = gState.qi; gState.d = await api('/instructor/grading/' + gState.d.assessment.id); gState.qi = qq; gState.assessments = (await api('/instructor/grading')).assessments; if (msg) toast(msg); drawBulkGrading(); };
 $('#bg-exam').onchange = e => tGo('/teach/grading?a=' + e.target.value);
 $('#main').querySelectorAll('[data-q]').forEach(b => b.onclick = () => { gState.qi = Number(b.dataset.q); gState.pos = 0; drawBulkGrading(); });
 $('#main').querySelectorAll('[data-pos]').forEach(b => b.onclick = () => { gState.pos = Number(b.dataset.pos); drawBulkGrading(); });
 $('#main').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { $('#bg-score').value = b.dataset.s; $('#bg-score').focus(); });
 $('#bg-prev')?.addEventListener('click', () => { gState.pos--; drawBulkGrading(); });
 $('#bg-next')?.addEventListener('click', () => { gState.pos = (gState.pos + 1) % rows.length; drawBulkGrading(); });
 $('#bg-form')?.addEventListener('keydown', e => { if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); $('#bg-next').click(); } if (e.key === 'Enter' && e.target.tagName === 'TEXTAREA' && !e.shiftKey) { e.preventDefault(); e.currentTarget.requestSubmit(); } });
 $('#bg-form')?.addEventListener('submit', async e => {
  e.preventDefault(); const score = Number($('#bg-score').value);
  try { await api('/instructor/grading/bulk', {method: 'POST', body: JSON.stringify({items: [{result_id: cur.id, revision: cur.revision, index: q.index, score, feedback: $('#bg-feedback').value}]})}); const nextOpen = rows.findIndex((r, i) => i > gState.pos && r.g.status !== 'confirmed'); gState.pos = nextOpen >= 0 ? nextOpen : gState.pos; await reload('저장했습니다.'); } catch (err) { toast(err.message); }
 });
 $('#bg-accept').onclick = async () => {
  if (!confirm(`AI 제안 ${proposed.length}건을 제안 점수 그대로 확정할까요?`)) return;
  try { const r = await api('/instructor/grading/bulk', {method: 'POST', body: JSON.stringify({items: proposed.map(x => ({result_id: x.id, revision: x.revision, index: q.index, accept_ai: true}))})}); await reload(`${r.saved}건 확정${r.finalized ? ` · 성적 ${r.finalized}건 최종 확정` : ''}${r.conflicts ? ` · 변경된 답안 ${r.conflicts}건 제외` : ''}`); } catch (err) { toast(err.message); }
 };
 tAvatars(); setTimeout(() => $('#bg-score')?.focus(), 50);
}

// ---------- 문항 분석 ----------
async function renderAnalysis() {
 shell(); startLoading('문항을 분석하고 있습니다…');
 try {
  const {assessments} = await api('/instructor/assessments');
  const list = assessments.filter(a => a.published);
  const aid = tParam('a') || (list.filter(a => a.result_count >= 5).sort((x, y) => (y.kind === 'exam') - (x.kind === 'exam') || y.questions.length - x.questions.length)[0] || list[0])?.id;
  if (!aid) { $('#main').innerHTML = tIntro('문항 분석', '공개된 평가가 아직 없습니다.'); return; }
  const d = await api('/instructor/analysis/' + aid);
  const rateCls = v => v == null ? '' : v < 40 ? 'op-bad' : v < 70 ? 'op-warn' : 'op-good';
  const discLabel = v => v == null ? '-' : v >= 0.4 ? '매우 좋음' : v >= 0.3 ? '좋음' : v >= 0.2 ? '보통' : '낮음';
  const flagged = d.questions.filter(q => q.flags.length);
  $('#main').innerHTML = tIntro('문항 분석', '문항별 정답률과 변별도(상위 27% − 하위 27% 정답률), 많이 고른 오답을 보고 어려운 개념과 손볼 문제를 찾습니다.') +
   `<section class="panel m-panel"><div class="m-toolbar"><select id="an-exam" aria-label="평가 선택">${list.map(a => `<option value="${a.id}" ${a.id === aid ? 'selected' : ''}>${escape(a.course_title)} · ${escape(a.title)}</option>`).join('')}</select></div></section>` +
   opKpis([['응시 인원', d.respondents + '<small>명</small>'], ['평균', d.average != null ? d.average + '<small>점</small>' : '-'], ['문항 수', d.questions.length], ['검토할 문항', flagged.length, flagged.length ? flagged.map(q => q.index + 1 + '번').join(', ') : '없음', flagged.length ? 'op-k-high' : '']]) +
   `<div class="op-grid an-grid"><section class="panel op-card"><h3>문항별 결과</h3><div class="table-wrap m-table"><table><thead><tr><th>#</th><th>개념 · 문항</th><th>정답률</th><th class="num">변별도</th><th>응답 분포</th><th>진단</th></tr></thead><tbody>${d.questions.map(q => `<tr><td><b>${q.index + 1}</b></td><td class="an-prompt"><span class="op-scope">${escape(q.tag || '-')}</span> <small class="muted">${q.type === 'text' ? '주관식' : '객관식'} · ${q.points}점</small><div class="an-ptext">${rich(String(q.prompt).replace(/!\[[^\]]*\]\([^)]*\)/g, '[그림]'))}</div></td><td><div class="op-metric"><b class="${rateCls(q.rate)}">${q.rate ?? '-'}<small>%</small></b><div class="op-bar"><span class="${rateCls(q.rate)}" data-w="${q.rate || 0}"></span></div></div></td><td class="num"><b>${q.discrimination ?? '-'}</b><small class="op-desc">${discLabel(q.discrimination)}</small></td><td>${q.distribution ? `<div class="an-dist">${q.distribution.map((o, i) => `<div class="an-opt ${o.correct ? 'ok' : ''}" title="${escape(o.text)}"><span>${i + 1}</span><div class="an-obar"><i data-w="${d.respondents ? o.count * 100 / d.respondents : 0}"></i></div><small>${o.count}</small></div>`).join('')}</div>` : `<small class="muted">채점 ${q.graded}명 · 빈 답안 ${q.blank}</small>`}</td><td><div class="op-reasons">${q.flags.map(f => `<span class="op-reason ${/검토|낮음/.test(f) ? 'op-r-missed' : /매력/.test(f) ? 'op-r-drop' : 'op-r-gap'}">${f}</span>`).join('') || '<span class="muted">양호</span>'}</div>${q.top_wrong && q.flags.includes('매력적인 오답') ? `<small class="op-desc">많이 고른 오답: ${escape(q.top_wrong.text.slice(0, 30))}</small>` : ''}</td></tr>`).join('')}</tbody></table></div></section>
   <section class="panel op-card"><h3>개념별 정답률</h3><p class="muted">낮은 순서 · 다음 수업에서 보충할 개념</p>${d.concepts.map(c => `<div class="an-concept"><span>${escape(c.tag)}</span><div class="op-bar"><span class="${rateCls(c.rate)}" data-w="${c.rate}"></span></div><b>${c.rate}%</b></div>`).join('') || '<p class="muted">데이터 없음</p>'}<div class="an-help"><b>읽는 법</b><p>정답률 40% 미만은 어려운 문항, 90% 초과는 너무 쉬운 문항입니다. 변별도가 0.2 미만이면 잘하는 학생과 못하는 학생을 구분하지 못하는 문항이고, 음수면 정답이나 보기를 다시 확인하세요.</p></div></section></div>`;
  $('#an-exam').onchange = e => tGo('/teach/analysis?a=' + e.target.value);
  $('#main').querySelectorAll('.an-obar i[data-w]').forEach(el => el.style.width = el.dataset.w + '%');
  opApply();
 } catch (e) { opFail(e); }
}

// ---------- 문제 은행 ----------
let bankFilter = {q: '', diff: '', type: '', course: ''};
async function renderBank() {
 shell(); startLoading('문제 은행을 불러오고 있습니다…');
 try {
  const [{items}, {courses}, {assessments}] = await Promise.all([api('/instructor/bank'), api('/instructor/courses'), api('/instructor/assessments')]);
  const f = bankFilter, s = f.q.toLowerCase();
  const list = items.filter(b => (!f.diff || b.difficulty === f.diff) && (!f.type || (b.question.type || 'choice') === f.type) && (!f.course || b.course_id === f.course) && (!s || (b.concept + ' ' + b.question.prompt).toLowerCase().includes(s)));
  const concepts = [...new Set(items.map(b => b.concept).filter(Boolean))];
  $('#main').innerHTML = tIntro(`문제 은행 ${AI_MARK}`, '문항을 개념·난이도로 저장해 두고 시험을 만들 때 골라 씁니다. AI로 비슷한 새 문항을 만들 수 있습니다.', '<div class="quick-actions"><button class="secondary" id="bk-import">시험에서 가져오기</button><button class="primary" id="bk-new">+ 문항 추가</button></div>') +
   opKpis([['저장된 문항', items.length], ['개념', concepts.length, concepts.slice(0, 3).join(', ')], ['AI 생성', items.filter(b => b.source === 'ai').length, '유사 문항'], ['시험에 사용', items.reduce((a, b) => a + b.used_count, 0), '누적 횟수']]) +
   `<section class="panel m-panel"><div class="m-toolbar"><form class="m-search" id="bk-search"><input id="bk-q" value="${escape(f.q)}" placeholder="개념·문항 검색" list="bk-concepts"><datalist id="bk-concepts">${concepts.map(c => `<option value="${escape(c)}">`).join('')}</datalist></form><select id="bk-course"><option value="">모든 과정</option>${courses.map(c => `<option value="${c.id}" ${f.course === c.id ? 'selected' : ''}>${escape(c.title)}</option>`).join('')}</select><div class="m-seg">${[['', '전체'], ['easy', '쉬움'], ['medium', '보통'], ['hard', '어려움']].map(([k, l]) => `<button type="button" data-diff="${k}" class="${f.diff === k ? 'selected' : ''}">${l}</button>`).join('')}</div><div class="m-seg">${[['', '모든 유형'], ['choice', '객관식'], ['text', '주관식']].map(([k, l]) => `<button type="button" data-type="${k}" class="${f.type === k ? 'selected' : ''}">${l}</button>`).join('')}</div><span class="op-spacer"></span><span class="muted op-sub">${list.length}개</span></div>
   <div class="bk-list">${list.slice(0, 60).map(b => { const q = b.question; return `<article class="bk-item"><div class="bk-head"><span class="op-scope">${escape(b.concept || '개념 없음')}</span><select class="bk-diff" data-id="${b.id}" aria-label="난이도">${Object.entries(tDiff).map(([k, [l]]) => `<option value="${k}" ${b.difficulty === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="op-act ${q.type === 'text' ? 'op-a-member' : 'op-a-course'}">${q.type === 'text' ? '주관식' : '객관식'} · ${q.points}점</span>${b.source === 'ai' ? `<span class="op-act op-a-ai">${AI_MARK} 생성</span>` : b.source === 'exam' ? '<span class="op-act op-a-auth">시험에서</span>' : ''}<small class="muted">${escape(b.course_title || '')}${b.used_count ? ` · ${b.used_count}회 사용` : ''}</small><span class="op-spacer"></span><button type="button" class="m-btn bk-similar" data-id="${b.id}">${AI_MARK} 유사 문항</button><button type="button" class="op-del bk-del" data-id="${b.id}">삭제</button></div><div class="bk-prompt">${rich(q.prompt)}</div>${q.type === 'text' ? `<div class="bk-model"><small>모범 답안</small> ${escape(String(q.model_answer || '').slice(0, 160))}</div>` : `<ol class="bk-opts">${(q.options || []).map((o, i) => `<li class="${i === q.answer ? 'ok' : ''}">${rich(o)}</li>`).join('')}</ol>`}</article>`; }).join('') || '<div class="m-empty"><strong>조건에 맞는 문항이 없습니다</strong></div>'}</div></section>`;
  $('#bk-search').onsubmit = e => { e.preventDefault(); bankFilter.q = $('#bk-q').value.trim(); renderBank(); };
  $('#bk-q').onchange = () => { bankFilter.q = $('#bk-q').value.trim(); renderBank(); };
  $('#bk-course').onchange = e => { bankFilter.course = e.target.value; renderBank(); };
  $('#main').querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { bankFilter.diff = b.dataset.diff; renderBank(); });
  $('#main').querySelectorAll('[data-type]').forEach(b => b.onclick = () => { bankFilter.type = b.dataset.type; renderBank(); });
  $('#main').querySelectorAll('.bk-diff').forEach(sel => sel.onchange = async () => { await api(`/instructor/bank/${sel.dataset.id}/update`, {method: 'POST', body: JSON.stringify({difficulty: sel.value})}); toast('난이도를 바꿨습니다.'); });
  $('#main').querySelectorAll('.bk-del').forEach(b => b.onclick = async () => { if (!confirm('이 문항을 문제 은행에서 삭제할까요?')) return; await api(`/instructor/bank/${b.dataset.id}/delete`, {method: 'POST', body: '{}'}); renderBank(); });
  $('#main').querySelectorAll('.bk-similar').forEach(b => b.onclick = async () => { b.disabled = true; b.textContent = '생성 중…'; try { await api(`/instructor/bank/${b.dataset.id}/similar`, {method: 'POST', body: '{}'}); toast('AI가 유사 문항을 만들어 문제 은행에 추가했습니다.'); renderBank(); } catch (e) { toast(e.message); b.disabled = false; b.innerHTML = `${AI_MARK} 유사 문항`; } });
  $('#bk-import').onclick = () => opDialog(`<h2>시험에서 가져오기</h2><p class="muted">선택한 시험의 문항을 모두 문제 은행에 저장합니다. 이미 있는 문항은 건너뜁니다.</p><label>시험</label><select name="assessment_id">${assessments.map(a => `<option value="${a.id}">${escape(a.course_title)} · ${escape(a.title)} (${a.questions.length}문항)</option>`).join('')}</select>`, '가져오기', async data => { const r = await api('/instructor/bank/import', {method: 'POST', body: JSON.stringify(data)}); toast(`${r.added}개 문항을 저장했습니다.`); renderBank(); });
  $('#bk-new').onclick = () => opDialog(`<h2>문항 추가</h2><div class="op-row"><div><label>유형</label><select name="type"><option value="choice">객관식</option><option value="text">주관식</option></select></div><div><label>배점</label><input name="points" type="number" min="1" max="100" value="10"></div></div><div class="op-row"><div><label>개념</label><input name="concept" maxlength="80" list="bk-concepts" required></div><div><label>난이도</label><select name="difficulty"><option value="easy">쉬움</option><option value="medium" selected>보통</option><option value="hard">어려움</option></select></div></div><label>과정</label><select name="course_id"><option value="">공통</option>${courses.map(c => `<option value="${c.id}">${escape(c.title)}</option>`).join('')}</select><label>문제</label><textarea name="prompt" rows="3" required></textarea><label>보기 (객관식, 한 줄에 하나 · 정답 앞에 *)</label><textarea name="options" rows="4" placeholder="*정답 보기&#10;오답 보기&#10;오답 보기&#10;오답 보기"></textarea><label>모범 답안 · 채점 기준 (주관식)</label><textarea name="model" rows="3"></textarea>`, '저장', async x => {
   const opts = x.options.split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, 4), ans = Math.max(0, opts.findIndex(o => o.startsWith('*')));
   const question = x.type === 'text' ? {type: 'text', prompt: x.prompt, points: Number(x.points), model_answer: x.model, rubric: x.model} : {type: 'choice', prompt: x.prompt, points: Number(x.points), options: opts.map(o => o.replace(/^\*/, '')).concat(['', '', '', '']).slice(0, 4), answer: ans};
   await api('/instructor/bank', {method: 'POST', body: JSON.stringify({question, concept: x.concept, difficulty: x.difficulty, course_id: x.course_id || null})}); toast('문항을 저장했습니다.'); renderBank();
  });
 } catch (e) { opFail(e); }
}
// Used by the exam editor: pick questions from the bank into the current draft.
async function pickFromBank(onPick) {
 const {items} = await api('/instructor/bank');
 opDialog(`<h2>문제 은행에서 추가</h2><input class="bk-pick-q" placeholder="개념·문항 검색"><div class="bk-pick">${items.map(b => `<label class="bk-pick-row" data-text="${escape((b.concept + ' ' + b.question.prompt).toLowerCase())}"><input type="checkbox" name="pick" value="${b.id}"><span class="op-scope">${escape(b.concept || '-')}</span><span class="op-level ${tDiff[b.difficulty][1]}">${tDiff[b.difficulty][0]}</span><span class="bk-pick-text">${escape(String(b.question.prompt).slice(0, 80))}</span></label>`).join('')}</div>`, '선택한 문항 추가', async () => {
  const ids = [...document.querySelectorAll('.bk-pick input:checked')].map(i => i.value), picked = items.filter(b => ids.includes(b.id));
  onPick(picked.map(b => structuredClone({...b.question, tag: b.question.tag || b.concept})));
  for (const b of picked) api(`/instructor/bank/${b.id}/used`, {method: 'POST', body: '{}'}).catch(() => {});
  toast(`${picked.length}개 문항을 추가했습니다.`);
 }, dlg => { dlg.querySelector('.bk-pick-q').oninput = e => dlg.querySelectorAll('.bk-pick-row').forEach(r => r.hidden = !r.dataset.text.includes(e.target.value.toLowerCase())); });
}

// ---------- 학생 관리 · 상세 ----------
async function renderTeachStudents() {
 if (tParam('s')) return renderStudentDetail(tParam('s'), tParam('c'));
 shell(); startLoading('학생 목록을 불러오고 있습니다…');
 try {
  const {students} = await api('/instructor/roster');
  const courses = [...new Map(students.map(s => [s.course_id, s.course_title])).entries()];
  const cf = tParam('course') || '';
  const list = students.filter(s => !cf || s.course_id === cf);
  const lv = {high: ['위험 높음', 'op-high'], medium: ['위험 보통', 'op-mid'], low: ['관찰', 'op-low']};
  $('#main').innerHTML = tIntro('학생 관리', '담당 과정의 학생을 한눈에 보고, 학생을 누르면 성적 추이·러닝 패스·학습 방향·답안·메모를 한곳에서 봅니다.') +
   `<section class="panel m-panel"><div class="m-toolbar"><div class="m-seg">${[['', '전체', students.length], ...courses.map(([id, t]) => [id, t, students.filter(s => s.course_id === id).length])].map(([k, l, n]) => `<button type="button" data-course="${k}" class="${cf === k ? 'selected' : ''}">${escape(l)}<span>${n}</span></button>`).join('')}</div></div>
   <div class="table-wrap m-table"><table><thead><tr><th>학생</th><th>과정</th><th class="num">응시</th><th class="num">평균</th><th>상태</th><th>최근 제출</th><th class="num">메모</th><th class="right"></th></tr></thead><tbody>${list.map(s => `<tr class="st-row" data-go="/teach/students?s=${s.id}&c=${s.course_id}"><td><div class="m-user">${memberAvatar(s)}<div><strong>${escape(s.name)}</strong><small>${escape(s.email)}</small></div></div></td><td>${escape(s.course_title)}</td><td class="num">${s.taken}</td><td class="num"><b>${s.average ?? '-'}</b></td><td>${s.risk ? `<span class="op-level ${lv[s.risk][1]}">${lv[s.risk][0]}</span>` : '<span class="m-status on">정상</span>'}</td><td><small class="m-date">${s.last_submit ? tAgo(s.last_submit) : '-'}</small></td><td class="num">${s.notes || ''}</td><td class="right"><button class="m-btn" data-go="/teach/students?s=${s.id}&c=${s.course_id}">상세 ›</button></td></tr>`).join('')}</tbody></table></div></section>`;
  $('#main').querySelectorAll('[data-course]').forEach(b => b.onclick = () => tGo('/teach/students' + (b.dataset.course ? '?course=' + b.dataset.course : '')));
  tAvatars(); tBindLinks();
 } catch (e) { opFail(e); }
}
function trendSvg(points) {
 // points: [{label, mine, cls}] values in 0..100
 const w = 560, h = 180, px = 34, py = 18, n = points.length;
 if (!n) return '<p class="muted">확정된 성적이 없습니다.</p>';
 const x = i => n === 1 ? w / 2 : px + i * (w - px * 2) / (n - 1), y = v => py + (100 - v) * (h - py * 2) / 100;
 const line = k => points.map((p, i) => p[k] == null ? '' : `${x(i)},${y(p[k])}`).filter(Boolean).join(' ');
 return `<svg class="sd-trend" viewBox="0 0 ${w} ${h}" role="img" aria-label="성적 추이">${[0, 50, 100].map(v => `<line x1="${px}" x2="${w - px}" y1="${y(v)}" y2="${y(v)}" class="sd-grid"/><text x="${px - 8}" y="${y(v) + 4}" class="sd-axis" text-anchor="end">${v}</text>`).join('')}<polyline points="${line('cls')}" class="sd-cls"/><polyline points="${line('mine')}" class="sd-mine"/>${points.map((p, i) => p.mine == null ? '' : `<circle cx="${x(i)}" cy="${y(p.mine)}" r="4" class="sd-dot"><title>${escape(p.label)} · ${p.mine}점 (반 평균 ${p.cls ?? '-'})</title></circle><text x="${x(i)}" y="${h - 2}" class="sd-axis" text-anchor="middle">${escape(p.short)}</text>`).join('')}</svg>`;
}
async function renderStudentDetail(sid, cid) {
 shell(); startLoading('학생 정보를 불러오고 있습니다…');
 try {
  const [d, {paths}] = await Promise.all([api(`/instructor/students/${sid}/detail`), api('/instructor/learning-path/' + sid)]);
  const course = d.courses.find(c => c.id === cid) || d.courses[0];
  const res = d.results.filter(r => r.course_id === course.id), conf = res.filter(r => r.grading_status === 'confirmed');
  const pctv = r => Math.round(r.score * 1000 / r.total) / 10;
  const avg = conf.length ? Math.round(conf.reduce((a, r) => a + pctv(r), 0) / conf.length * 10) / 10 : null, cls = conf.filter(r => r.class_avg != null), clsAvg = cls.length ? Math.round(cls.reduce((a, r) => a + r.class_avg, 0) / cls.length * 10) / 10 : null;
  const guide = d.guidance.find(g => g.course_id === course.id), path = paths.find(p => p.course_id === course.id);
  const notes = d.notes.filter(n => n.course_id === course.id), risk = d.risk.find(r => r.course_id === course.id);
  const lv = {high: ['위험 높음', 'op-high'], medium: ['위험 보통', 'op-mid'], low: ['관찰', 'op-low']};
  const benchmarks = path ? path.steps.filter(s => s.benchmark != null) : [];
  $('#main').innerHTML = `<div class="sd-back"><a href="/teach/students" data-go="/teach/students">‹ 학생 관리</a></div><section class="sd-head panel"><div class="m-user sd-user">${memberAvatar(d.student)}<div><h1>${escape(d.student.name)}</h1><small>${escape(d.student.email)}</small></div></div><div class="sd-tags">${risk ? `<span class="op-level ${lv[risk.level][1]}">${lv[risk.level][0]}</span>${risk.reasons.map(r => `<span class="op-reason op-r-${r.type}">${escape(r.label)}</span>`).join('')}` : '<span class="m-status on">정상</span>'}</div><div class="m-seg sd-courses">${d.courses.map(c => `<button type="button" data-go="/teach/students?s=${sid}&c=${c.id}" class="${c.id === course.id ? 'selected' : ''}">${escape(c.title)}</button>`).join('')}</div></section>` +
   opKpis([['평균', avg != null ? avg + '<small>점</small>' : '-', `확정 ${conf.length}건`], ['반 평균 대비', avg != null && clsAvg != null ? `${avg - clsAvg >= 0 ? '+' : ''}${Math.round((avg - clsAvg) * 10) / 10}<small>점</small>` : '-', `반 평균 ${clsAvg ?? '-'}`, avg != null && clsAvg != null && avg < clsAvg - 10 ? 'op-k-high' : ''], ['응시', `${res.length}<small>건</small>`, `채점 중 ${res.length - conf.length}`], ['메모·면담', notes.length, `면담 ${notes.filter(n => n.kind === 'counsel').length}회`]]) +
   `<div class="op-grid"><section class="panel op-card"><div class="op-card-head"><div><h3>성적 추이</h3><p class="muted">주차별 점수(100점 환산) · 점선은 반 평균</p></div><div class="sc-legend"><span><i class="op-sw ok"></i>${escape(d.student.name)}</span><span><i class="op-sw sd-sw-cls"></i>반 평균</span></div></div>${trendSvg(conf.map(r => ({label: r.title, short: r.week + '주', mine: pctv(r), cls: r.class_avg})))}</section>
   <section class="panel op-card"><h3>러닝 패스</h3><p class="muted">주차 모듈별 진행 · 3년차 기준과 비교</p><div class="sd-path">${path ? path.steps.map(s => { const done = s.assessments.filter(a => a.percent != null), p = done.length ? Math.round(done.reduce((a, x) => a + x.percent, 0) / done.length) : null, miss = s.assessments.some(a => a.published && !a.taken && a.opens_at && new Date(a.opens_at) < Date.now()); return `<div class="sd-step ${p == null ? (miss ? 'miss' : 'todo') : s.benchmark != null && p < s.benchmark - 15 ? 'low' : 'ok'}" title="${escape(s.title)}${s.benchmark != null ? ` · 3년차 기준 ${s.benchmark}` : ''}"><b>${s.week}</b><small>${p != null ? p : miss ? '미응시' : '-'}</small></div>`; }).join('') : '<p class="muted">모듈 없음</p>'}</div>${benchmarks.length ? `<p class="muted sd-legend"><i class="sd-k ok"></i>기준 이상·근접 <i class="sd-k low"></i>기준보다 15점 이상 낮음 <i class="sd-k miss"></i>미응시 <i class="sd-k todo"></i>예정</p>` : ''}</section></div>
   <div class="op-grid"><section class="panel op-card"><div class="op-card-head"><h3>제출 답안</h3></div>${res.slice().reverse().map(r => `<details class="sd-result"><summary><span><b>${escape(r.title)}</b><small class="muted"> · ${r.week}주차 · ${opDate(r.submitted_at)}</small></span><span class="sd-score">${r.grading_status === 'confirmed' ? `${pctv(r)}<small>점</small>` : `<span class="op-act op-a-ai">${r.grading_status === 'review' ? 'AI 제안 검토' : '채점 대기'}</span>`}</span></summary><ol class="sd-answers">${r.questions.map((q, i) => { const g = r.grading[i] || {}, a = r.answers[i]; const ok = q.type === 'text' ? (g.status === 'confirmed' ? g.score / q.points >= 0.6 : null) : a === q.answer; return `<li class="${ok == null ? '' : ok ? 'ok' : 'bad'}"><div><span class="op-scope">${escape(q.tag || '-')}</span> ${escape(String(q.prompt).replace(/!\[[^\]]*\]\([^)]*\)/g, '[그림]').slice(0, 60))}</div><small>${q.type === 'text' ? `답안: ${escape(String(a || '빈 답안').slice(0, 120))}${g.status === 'confirmed' ? ` · ${g.score}/${q.points}점` : ''}` : `선택 ${a == null ? '없음' : a + 1}번 · 정답 ${q.answer + 1}번`}</small></li>`; }).join('')}</ol></details>`).join('') || '<p class="muted">제출한 평가가 없습니다.</p>'}</section>
   <section class="panel op-card"><h3>메모 · 면담 기록</h3><p class="muted">학생에게 보이지 않는 강사 전용 기록입니다.</p><form id="sd-note" class="sd-note-form"><div class="m-seg"><button type="button" data-kind="note" class="selected">메모</button><button type="button" data-kind="counsel">면담</button></div><textarea id="sd-note-body" rows="3" maxlength="4000" placeholder="관찰한 내용이나 면담 내용을 적어 두세요." required></textarea><button class="primary">기록</button></form>${notes.map(n => `<div class="sd-note"><span class="op-act ${n.kind === 'counsel' ? 'op-a-warn' : 'op-a-auth'}">${n.kind === 'counsel' ? '면담' : '메모'}</span><div><p>${escape(n.body)}</p><small class="muted">${escape(n.author_name)} · ${opDate(n.created_at)}</small></div></div>`).join('') || '<p class="muted">기록이 없습니다.</p>'}</section></div>
   <section class="panel op-card"><div class="op-card-head"><div><h3>학습 방향 ${AI_MARK}</h3><p class="muted">${guide ? (guide.published ? '공개됨' : '초안') + ' · ' + opDate(guide.updated_at) : '아직 작성하지 않았습니다'}</p></div><button class="secondary" data-view="teach-guidance">학습 방향 지도에서 ${guide ? '수정' : '작성'}</button></div>${guide ? `<div class="sd-guide">${escape(guide.content).replace(/\n/g, '<br>')}</div>` : ''}</section>`;
  let kind = 'note';
  $('#main').querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { kind = b.dataset.kind; $('#main').querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('selected', x === b)); });
  $('#sd-note').onsubmit = async e => { e.preventDefault(); try { await api('/instructor/notes', {method: 'POST', body: JSON.stringify({student_id: sid, course_id: course.id, kind, body: $('#sd-note-body').value})}); toast('기록했습니다.'); renderStudentDetail(sid, course.id); } catch (err) { toast(err.message); } };
  tAvatars(); tBindLinks(); bindViews();
 } catch (e) { opFail(e); }
}

// ---------- 위험 학생 (강사) ----------
async function renderTeachRisk() {
 shell(); startLoading('위험 학생을 불러오고 있습니다…');
 try {
  const d = await api('/instructor/risk');
  const lv = {high: ['높음', 'op-high'], medium: ['보통', 'op-mid'], low: ['관찰', 'op-low']};
  $('#main').innerHTML = tIntro('위험 학생', '관리자가 보낸 알림과 자동으로 감지한 학생을 함께 봅니다. 면담하면 기록을 남겨 두세요.') +
   opKpis([['위험 높음', d.summary.high, '즉시 면담 권장', 'op-k-high'], ['위험 보통', d.summary.medium], ['관리자 알림', d.alerts.length, `읽지 않음 ${d.alerts.filter(a => !a.read_at).length}`], ['면담 기록', d.counsel.length, '최근 30건']]) +
   `<div class="op-notice-grid"><section class="panel m-panel"><div class="table-wrap m-table"><table><thead><tr><th>학생</th><th>과정</th><th>위험도</th><th>사유</th><th>최근 면담</th><th class="right">조치</th></tr></thead><tbody>${d.students.map((s, i) => `<tr><td><div class="m-user">${memberAvatar({id: s.student_id, name: s.student_name})}<div><strong>${escape(s.student_name)}</strong><small>${s.notified_at ? '관리자 알림 받음' : '자동 감지'}</small></div></div></td><td>${escape(s.course_title)}</td><td><span class="op-level ${lv[s.level][1]}">${lv[s.level][0]}</span></td><td><div class="op-reasons">${s.reasons.map(r => `<span class="op-reason op-r-${r.type}" title="${escape(r.detail)}">${escape(r.label)}</span>`).join('')}</div></td><td><small class="m-date">${s.counseled_at ? tAgo(s.counseled_at) : '<span class="muted">없음</span>'}</small></td><td class="right"><button class="m-btn tr-counsel" data-i="${i}">면담 기록</button> <button class="m-btn" data-go="/teach/students?s=${s.student_id}&c=${s.course_id}">상세</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="m-empty"><strong>위험 신호가 있는 학생이 없습니다</strong></div></td></tr>'}</tbody></table></div></section>
   <div class="op-side-col"><section class="panel op-card"><h3>관리자 알림</h3>${d.alerts.map(a => `<div class="op-note ${a.read_at ? '' : 'unread'}"><span class="op-note-dot op-n-risk"></span><div><strong>${escape(a.title)}</strong><p>${escape(a.body)}</p><small class="muted">${opDate(a.created_at)}</small></div></div>`).join('') || '<p class="muted">받은 알림이 없습니다.</p>'}</section>
   <section class="panel op-card"><h3>최근 면담</h3>${d.counsel.slice(0, 6).map(n => `<div class="sd-note"><span class="op-act op-a-warn">면담</span><div><strong>${escape(n.student_name)}</strong> <small class="muted">${escape(n.course_title)}</small><p>${escape(n.body)}</p><small class="muted">${opDate(n.created_at)}</small></div></div>`).join('') || '<p class="muted">면담 기록이 없습니다.</p>'}</section></div></div>`;
  $('#main').querySelectorAll('.tr-counsel').forEach(b => b.onclick = () => { const s = d.students[b.dataset.i]; opDialog(`<h2>면담 기록 · ${escape(s.student_name)}</h2><p class="muted">${escape(s.course_title)} · ${s.reasons.map(r => escape(r.label)).join(', ')}</p><textarea name="body" rows="6" required placeholder="면담 날짜, 학생이 말한 어려움, 합의한 조치를 적어 두세요."></textarea>`, '기록', async x => { await api('/instructor/notes', {method: 'POST', body: JSON.stringify({student_id: s.student_id, course_id: s.course_id, kind: 'counsel', body: x.body})}); toast('면담 기록을 남겼습니다.'); renderTeachRisk(); }); });
  tAvatars(); tBindLinks();
 } catch (e) { opFail(e); }
}

// ---------- 과정 운영 (달력 드래그 · 과정 복제) ----------
let planState = null;
async function renderCoursePlan() {
 shell(); startLoading('과정 일정을 불러오고 있습니다…');
 try {
  const {courses} = await api('/instructor/courses');
  const cid = tParam('c') || courses.find(c => c.status === 'active')?.id || courses[0]?.id;
  if (!cid) { $('#main').innerHTML = tIntro('과정 운영', '담당 과정이 없습니다.'); return; }
  const d = await api('/instructor/course-plan/' + cid);
  planState = {d, courses, moves: new Map(), mods: new Map()};
  drawCoursePlan();
 } catch (e) { opFail(e); }
}
function drawCoursePlan() {
 const {d, courses, moves, mods} = planState, c = d.course;
 const day = s => { const x = new Date(s); return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
 const start = day(c.start_date || new Date()), monday = new Date(start); monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
 const endD = day(c.end_date || new Date(start.getTime() + 8 * 7 * 864e5));
 const weeks = Math.max(1, Math.ceil((endD - monday) / (7 * 864e5)) + (endD.getDay() === 1 ? 1 : 0));
 const key = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
 const weekOf = dt => Math.floor((day(dt) - monday) / (7 * 864e5)) + 1;
 const exams = d.assessments.map(a => { const mv = moves.get(a.id); return {...a, at: mv ? mv.opens_at : a.opens_at, week: mv ? mv.week : a.week, moved: !!mv}; });
 const modules = d.modules.map(m => ({...m, week: mods.get(m.id) ?? m.week, moved: mods.has(m.id)}));
 const today = key(new Date()), dirty = moves.size + mods.size;
 let grid = '';
 for (let w = 1; w <= weeks; w++) {
  const mod = modules.find(m => m.week === w);
  grid += `<div class="cp-week" data-week="${w}"><div class="cp-mod ${mod ? '' : 'empty'} ${mod?.moved ? 'moved' : ''}" ${mod ? `draggable="true" data-mod="${mod.id}"` : ''} data-modweek="${w}"><b>${w}주차</b><span>${mod ? escape(mod.title) : '모듈 없음'}</span></div>`;
  for (let i = 0; i < 7; i++) {
   const dt = new Date(monday); dt.setDate(monday.getDate() + (w - 1) * 7 + i); const k = key(dt);
   const inCourse = dt >= start && dt <= endD;
   grid += `<div class="cp-day ${inCourse ? '' : 'out'} ${k === today ? 'today' : ''} ${i >= 5 ? 'wkend' : ''}" data-day="${k}"><small>${dt.getDate() === 1 || (w === 1 && i === 0) ? dt.getMonth() + 1 + '/' : ''}${dt.getDate()}</small>${exams.filter(a => a.at && key(day(a.at)) === k).map(a => `<div class="cp-exam ${a.kind} ${a.published ? '' : 'draft'} ${a.moved ? 'moved' : ''}" draggable="${a.taken ? 'false' : 'true'}" data-exam="${a.id}" title="${escape(a.title)}${a.taken ? ' · 응시 결과가 있어 옮길 수 없습니다' : ' · 끌어서 날짜 변경'}">${a.kind === 'exam' ? '◆' : '●'} ${escape(a.title)}</div>`).join('')}</div>`;
  }
  grid += '</div>';
 }
 const unscheduled = exams.filter(a => !a.at);
 $('#main').innerHTML = tIntro('과정 운영', '주차 모듈과 시험을 달력에서 끌어서 옮깁니다. 모듈은 다른 주차로 끌면 서로 자리를 바꾸고, 시험은 원하는 날짜로 끌면 됩니다. 다음 기수용으로 과정을 복제할 수도 있습니다.', `<div class="quick-actions"><button class="secondary" id="cp-dup">과정 복제</button><button class="primary" id="cp-save" ${dirty ? '' : 'disabled'}>변경 ${dirty}건 저장</button></div>`) +
  `<section class="panel m-panel"><div class="m-toolbar"><select id="cp-course">${courses.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${escape(x.title)}</option>`).join('')}</select><small class="muted op-sub">${escape(c.start_date || '-')} ~ ${escape(c.end_date || '-')} · 수강생 ${c.students}명</small><span class="op-spacer"></span><div class="sc-legend"><span>◆ 시험</span><span>● 미니퀴즈</span><span><i class="op-sw cp-sw-draft"></i>비공개</span><span><i class="op-sw cp-sw-moved"></i>변경됨</span></div>${dirty ? '<button type="button" class="secondary" id="cp-reset">되돌리기</button>' : ''}</div>
  <div class="cp-cal"><div class="cp-week cp-headrow"><div class="cp-mod-h">모듈</div>${['월', '화', '수', '목', '금', '토', '일'].map(x => `<div class="cp-dh">${x}</div>`).join('')}</div>${grid}</div>${unscheduled.length ? `<p class="muted op-foot">날짜가 없는 평가: ${unscheduled.map(a => escape(a.title)).join(', ')}</p>` : ''}</section>`;
 // drag & drop
 let drag = null;
 $('#main').querySelectorAll('[data-exam][draggable="true"]').forEach(el => el.ondragstart = e => { drag = {exam: el.dataset.exam}; e.dataTransfer.setData('text/plain', el.dataset.exam); el.classList.add('dragging'); });
 $('#main').querySelectorAll('[data-mod]').forEach(el => el.ondragstart = e => { drag = {mod: el.dataset.mod}; e.dataTransfer.setData('text/plain', el.dataset.mod); el.classList.add('dragging'); });
 $('#main').querySelectorAll('.cp-day').forEach(el => { el.ondragover = e => { if (drag?.exam) { e.preventDefault(); el.classList.add('over'); } }; el.ondragleave = () => el.classList.remove('over'); el.ondrop = e => { e.preventDefault(); if (!drag?.exam) return; const a = d.assessments.find(x => x.id === drag.exam), old = a.opens_at ? new Date(a.opens_at) : new Date(); const [y, mo, dd] = el.dataset.day.split('-').map(Number); const at = new Date(y, mo - 1, dd, old.getHours(), old.getMinutes()); moves.set(a.id, {id: a.id, opens_at: at.toISOString(), week: Math.max(1, weekOf(at))}); drawCoursePlan(); }; });
 $('#main').querySelectorAll('[data-modweek]').forEach(el => { el.ondragover = e => { if (drag?.mod) { e.preventDefault(); el.classList.add('over'); } }; el.ondragleave = () => el.classList.remove('over'); el.ondrop = e => { e.preventDefault(); if (!drag?.mod) return; const target = Number(el.dataset.modweek), src = modules.find(m => m.id === drag.mod), other = modules.find(m => m.week === target && m.id !== src.id); if (other) mods.set(other.id, src.week); mods.set(src.id, target); drawCoursePlan(); }; });
 $('#cp-course').onchange = e => tGo('/teach/plan?c=' + e.target.value);
 $('#cp-reset')?.addEventListener('click', () => { moves.clear(); mods.clear(); drawCoursePlan(); });
 $('#cp-save').onclick = async () => { try { await api('/instructor/course-plan/' + c.id, {method: 'POST', body: JSON.stringify({assessments: [...moves.values()], modules: [...mods.entries()].map(([id, week]) => ({id, week}))})}); toast('일정을 저장했습니다.'); renderCoursePlan(); } catch (e) { toast(e.message); } };
 $('#cp-dup').onclick = () => { const next = c.end_date ? new Date(Date.parse(c.end_date) + 14 * 864e5) : new Date(); next.setDate(next.getDate() + ((8 - next.getDay()) % 7)); opDialog(`<h2>과정 복제</h2><p class="muted">주차 모듈, 3년차 기준, 시험·미니퀴즈(문항 포함)를 그대로 복사합니다. 수강생은 비우고, 시험은 비공개로 만들며, 날짜는 새 시작일에 맞춰 옮깁니다.</p><label>새 과정 이름</label><input name="title" required value="${escape(c.title)} 2기"><label>시작일</label><input type="date" name="start_date" value="${next.toISOString().slice(0, 10)}">`, '복제하기', async x => { const r = await api(`/instructor/courses/${c.id}/duplicate`, {method: 'POST', body: JSON.stringify(x)}); toast(`복제했습니다 · 모듈 ${r.modules}개, 평가 ${r.assessments}개, 날짜 ${r.shift_days}일 이동`); tGo('/teach/plan?c=' + r.id); }); };
}
