// Student tools: 오늘의 학습, 오답 노트, 연습 모드, 피드백·이의 신청, 성취·연속 학습, 학습 리포트.
// Plus the instructor's 이의 신청 inbox. No AI calls happen here.
const lIntro = (title, text, actions = '', eyebrow = 'MY SPACE') => opIntro(eyebrow, title, text, actions);
const lDday = v => { if (!v) return ''; const d = Math.ceil((new Date(v) - Date.now()) / 864e5); return d <= 0 ? '오늘' : 'D-' + d; };
const lStore = {get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
const BADGE_ICON = {flag: 'M5 21V4M5 4h11l-2 4 2 4H5', cube: 'M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10', stack: 'M12 2l10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5', target: 'M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 12h.01', trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4', star: 'M12 2l3 7 7 .5-5.5 4.5L18 21l-6-3.8L6 21l1.5-7L2 9.5 9 9z', flame: 'M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8a7 7 0 0 0 7 7', fire: 'M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8a7 7 0 0 0 7 7M12 18a3 3 0 0 0 3-3c0-2-2-3-3-5-1 2-3 3-3 5a3 3 0 0 0 3 3', refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', dumbbell: 'M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12', check: 'M20 6L9 17l-5-5'};
const lIcon = k => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${BADGE_ICON[k] || BADGE_ICON.star}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const lRing = (done, target, size = 92) => { const r = size / 2 - 8, c = 2 * Math.PI * r, p = Math.min(1, target ? done / target : 0); return `<svg class="lt-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="lt-ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="lt-ring-fg ${p >= 1 ? 'full' : ''}" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="48%" text-anchor="middle" class="lt-ring-n">${done}</text><text x="50%" y="66%" text-anchor="middle" class="lt-ring-t">/ ${target}</text></svg>`; };

// ---------- 오늘의 학습 ----------
async function renderLearnToday() {
 shell(); startLoading('오늘의 학습을 준비하고 있습니다…');
 try {
  const d = await api('/student/today');
  const urgent = d.exams.filter(x => x.closes_at && new Date(x.closes_at) - Date.now() < 2 * 864e5);
  const todayKey = 'lt-tasks-' + new Date().toISOString().slice(0, 10), checked = lStore.get(todayKey) || [];
  const hour = new Date().getHours();
  $('#main').innerHTML = lIntro(`${hour < 12 ? '좋은 아침이에요' : hour < 18 ? '오늘도 힘내요' : '오늘 하루 수고했어요'}, ${escape(user.name)}님`, d.streak.current ? `${d.streak.current}일째 연속으로 학습하고 있어요. 오늘도 이어가 볼까요?` : '오늘 한 문제라도 풀면 연속 학습이 시작돼요.', '', 'TODAY') +
   (urgent.length ? `<div class="lt-alert"><b>마감 임박</b>${urgent.map(x => `<span>${escape(x.title)} · ${lDday(x.closes_at)} 마감</span>`).join('')}<button class="primary" data-view="assessments">응시하러 가기</button></div>` : '') +
   opKpis([['이번 주 시험', d.exams.length, d.exams.length ? '아직 응시하지 않은 평가' : '예정된 평가 없음'], ['마감 임박', urgent.length, '48시간 안', urgent.length ? 'op-k-high' : ''], ['복습할 오답', d.wrong_count, d.wrong_concepts.join(', ') || '모두 복습했어요'], ['연속 학습', d.streak.current + '<small>일</small>', `최고 기록 ${d.streak.best}일`]]) +
   `<div class="td-grid lt-grid">
   <section class="panel op-card td-card"><div class="td-head"><span class="td-icon td-exam"></span><div><h3>이번 주 응시할 시험</h3><small class="muted">7일 안에 열리거나 진행 중인 평가</small></div></div>${d.exams.map(x => `<div class="td-row"><div><strong>${escape(x.title)}</strong><small>${escape(x.course_title)} · ${x.kind === 'exam' ? '시험' : '미니퀴즈'} ${x.duration}분 · ${x.opens_at && new Date(x.opens_at) > Date.now() ? `${new Date(x.opens_at).getMonth() + 1}/${new Date(x.opens_at).getDate()} 열림` : '응시 가능'}</small></div><span class="td-badge">${lDday(x.closes_at || x.opens_at) || '진행 중'}</span></div>`).join('') || '<div class="td-empty">✓ 이번 주에 볼 시험이 없어요</div>'}<div class="td-foot"><button class="secondary" data-view="assessments">시험·미니퀴즈</button></div></section>
   <section class="panel op-card td-card"><div class="td-head"><span class="td-icon td-guide"></span><div><h3>오늘 할 일</h3><small class="muted">강사님이 써 준 학습 방향에서 가져왔어요</small></div></div><div class="lt-tasks">${d.tasks.map((t, i) => `<label class="lt-task"><input type="checkbox" data-task="${i}" ${checked.includes(i) ? 'checked' : ''}><span><b>${escape(t.text)}</b><small>${escape(t.course_title)}</small></span></label>`).join('') || '<div class="td-empty">아직 공개된 학습 방향이 없어요</div>'}</div><div class="td-foot"><button class="secondary" data-view="guidance">학습 방향 전체</button></div></section>
   <section class="panel op-card td-card"><div class="td-head"><span class="td-icon td-risk lt-target"></span><div><h3>3년차 기준까지</h3><small class="muted">응시한 주차의 평균과 현업 3년차 기준 비교</small></div></div>${d.distance.map(c => `<div class="lt-dist"><div class="lt-dist-top"><strong>${escape(c.course_title)}</strong>${c.gap == null ? '<small class="muted">기록 없음</small>' : c.gap <= 0 ? `<span class="lt-ok">기준 +${Math.abs(c.gap)}점</span>` : `<span class="lt-gap">${c.gap}점 남음</span>`}</div><div class="lt-bench"><span class="lt-mine" data-w="${c.mine || 0}"></span><i class="lt-mark" data-left="${c.benchmark || 0}"></i></div><small class="muted">내 평균 ${c.mine ?? '-'} · 기준 ${c.benchmark ?? '-'}${c.next_week ? ` · 다음 ${c.next_week}주차 기준 ${c.next_benchmark}` : ''}</small></div>`).join('')}<div class="td-foot"><button class="secondary" data-view="path">러닝 패스</button></div></section>
   <section class="panel op-card td-card"><div class="td-head"><span class="td-icon td-ai"></span><div><h3>약한 개념 연습</h3><small class="muted">성적에 반영되지 않는 연습 문제</small></div></div>${d.weak.map(c => `<a class="td-row" href="/learn/practice?concept=${encodeURIComponent(c.concept)}" data-go="/learn/practice?concept=${encodeURIComponent(c.concept)}"><div><strong>${escape(c.concept)}</strong><small>${escape(c.course_title)} · 정답률 ${c.rate}%</small></div><span class="td-badge">연습 ›</span></a>`).join('') || '<div class="td-empty">✓ 약한 개념이 없어요</div>'}<div class="td-foot"><button class="primary" data-view="learn-practice">연습 시작</button> <button class="secondary" data-view="learn-wrong">오답 노트 ${d.wrong_count}</button></div></section>
   <section class="panel op-card td-card"><div class="td-head"><span class="td-icon td-bell"></span><div><h3>주간 목표</h3><small class="muted">이번 주 풀이한 문항 수</small></div></div><div class="lt-goal">${lRing(d.goal.done, d.goal.target)}<div>${d.goal.done >= d.goal.target ? '<b class="lt-ok">이번 주 목표 달성!</b>' : `<b>${d.goal.target - d.goal.done}문항 남았어요</b>`}${d.next_badge ? `<p class="muted">다음 배지 <b>${escape(d.next_badge.name)}</b> · ${d.next_badge.progress}/${d.next_badge.target}</p>` : ''}<div class="lt-badges-mini">${d.badges.map(b => `<span class="lb-mini" title="${escape(b.name)}">${lIcon(b.icon)}</span>`).join('')}</div></div></div><div class="td-foot"><button class="secondary" data-view="learn-badges">성취·연속 학습</button></div></section>
   <section class="panel op-card td-card"><div class="td-head"><span class="td-icon td-grade"></span><div><h3>새 피드백</h3><small class="muted">최근 7일 안에 확정된 주관식 채점</small></div></div>${d.fresh_feedback.map(f => `<a class="td-row" href="/learn/feedback" data-go="/learn/feedback"><div><strong>${escape(f.title)}</strong><small>${escape(f.course_title)}</small></div><span class="td-badge">${f.percent}점</span></a>`).join('') || '<div class="td-empty">새 피드백이 없어요</div>'}<div class="td-foot"><button class="secondary" data-view="learn-feedback">피드백 상세</button></div></section>
   </div>`;
  $('#main').querySelectorAll('[data-task]').forEach(c => c.onchange = () => { const v = [...$('#main').querySelectorAll('[data-task]:checked')].map(x => Number(x.dataset.task)); lStore.set(todayKey, v); });
  $('#main').querySelectorAll('[data-left]').forEach(el => el.style.left = Math.min(100, el.dataset.left) + '%');
  opApply(); tBindLinks(); bindViews();
 } catch (e) { opFail(e); }
}

// ---------- 오답 노트 ----------
let wrongFilter = '';
async function renderWrongNotes() {
 shell(); startLoading('오답을 모으고 있습니다…');
 try {
  const {items} = await api('/student/wrong-notes');
  const concepts = [...items.reduce((m, w) => m.set(w.concept, (m.get(w.concept) || 0) + 1), new Map()).entries()].sort((a, b) => b[1] - a[1]);
  const list = items.filter(w => !wrongFilter || (wrongFilter === '__open' ? !w.mastered : w.concept === wrongFilter));
  $('#main').innerHTML = lIntro('오답 노트', '틀린 문항이 개념별로 자동으로 모입니다. 다시 풀어서 맞히면 「정복」으로 표시돼요. 다시 풀기는 성적에 반영되지 않습니다.') +
   opKpis([['모은 오답', items.length], ['아직 복습 전', items.filter(w => !w.mastered).length, '', items.some(w => !w.mastered) ? 'op-k-high' : ''], ['다시 풀어 정복', items.filter(w => w.mastered).length], ['가장 많이 틀린 개념', escape(concepts[0]?.[0] || '-'), concepts[0] ? `${concepts[0][1]}문항` : '']]) +
   `<section class="panel m-panel"><div class="m-toolbar"><div class="m-seg op-seg-wrap">${[['', '전체', items.length], ['__open', '복습 전', items.filter(w => !w.mastered).length], ...concepts.slice(0, 8).map(([c, n]) => [c, c, n])].map(([k, l, n]) => `<button type="button" data-wf="${escape(k)}" class="${wrongFilter === k ? 'selected' : ''}">${escape(l)}<span>${n}</span></button>`).join('')}</div></div>
   <div class="wn-list">${list.map((w, i) => `<article class="wn-item ${w.mastered ? 'mastered' : ''}" data-i="${i}"><div class="wn-head"><span class="op-scope">${escape(w.concept)}</span><small class="muted">${escape(w.course_title)} · ${escape(w.title)}</small><span class="op-spacer"></span>${w.mastered ? '<span class="op-act op-a-grade">✓ 정복</span>' : w.retried_at ? '<span class="op-act op-a-warn">다시 틀림</span>' : '<span class="op-act op-a-auth">복습 전</span>'}</div><div class="wn-prompt">${rich(w.prompt)}</div>${w.type === 'text' ? `<div class="wn-text"><div><small>내 답안 · ${w.score}/${w.points}점</small><p>${escape(String(w.my_answer || '빈 답안'))}</p></div>${w.feedback ? `<div><small>피드백</small><p>${escape(w.feedback)}</p></div>` : ''}</div><div class="wn-actions"><button class="secondary wn-model" data-i="${i}">모범 답안 보기</button></div><div class="wn-result" hidden></div>` : `<ol class="wn-opts">${w.options.map((o, k) => `<li><button type="button" class="wn-opt ${k === w.my_answer ? 'mine' : ''}" data-i="${i}" data-k="${k}"><span>${k + 1}</span>${rich(o)}${k === w.my_answer ? '<em>내가 고른 답</em>' : ''}</button></li>`).join('')}</ol><div class="wn-result" hidden></div><p class="muted wn-hint">보기를 다시 골라 보세요. 고르면 바로 정답과 해설이 나와요.</p>`}</article>`).join('') || '<div class="m-empty"><strong>오답이 없어요</strong><span>평가를 보면 틀린 문항이 여기에 모입니다.</span></div>'}</div></section>`;
  $('#main').querySelectorAll('[data-wf]').forEach(b => b.onclick = () => { wrongFilter = b.dataset.wf; renderWrongNotes(); });
  $('#main').querySelectorAll('.wn-opt').forEach(b => b.onclick = async () => {
   const w = list[b.dataset.i], art = b.closest('.wn-item'), k = Number(b.dataset.k);
   try { const r = await api('/student/retry', {method: 'POST', body: JSON.stringify({result_id: w.result_id, index: w.index, answer: k})});
    art.querySelectorAll('.wn-opt').forEach(x => { const kk = Number(x.dataset.k); x.disabled = true; x.classList.toggle('right', kk === r.answer); x.classList.toggle('wrong', kk === k && !r.correct); });
    const box = art.querySelector('.wn-result'); box.hidden = false; box.className = 'wn-result ' + (r.correct ? 'ok' : 'bad'); box.innerHTML = `<b>${r.correct ? '정답이에요! 정복 완료' : '아쉬워요. 해설을 읽고 다음에 다시 도전해요'}</b>${r.explanation ? `<p>${rich(r.explanation)}</p>` : ''}`; art.querySelector('.wn-hint')?.remove();
   } catch (e) { toast(e.message); }
  });
  $('#main').querySelectorAll('.wn-model').forEach(b => b.onclick = async () => { const w = list[b.dataset.i], art = b.closest('.wn-item'); const r = await api('/student/retry', {method: 'POST', body: JSON.stringify({result_id: w.result_id, index: w.index})}); const box = art.querySelector('.wn-result'); box.hidden = false; box.className = 'wn-result ok'; box.innerHTML = `<b>모범 답안</b><p>${rich(r.model_answer)}</p><b>채점 기준</b><p>${rich(r.rubric)}</p>`; b.remove(); });
 } catch (e) { opFail(e); }
}

// ---------- 연습 모드 ----------
let practice = null;
async function renderPractice() {
 shell(); startLoading('연습 문제를 고르고 있습니다…');
 try {
  const concept = tParam('concept') || '';
  const d = await api('/student/practice' + (concept ? '?concept=' + encodeURIComponent(concept) : ''));
  practice = {d, concept, i: 0, answers: [], results: []};
  drawPractice();
 } catch (e) { opFail(e); }
}
function drawPractice() {
 const {d, concept, i, results} = practice, qs = d.questions, q = qs[i], done = i >= qs.length;
 const rateCls = v => v < 50 ? 'op-bad' : v < 80 ? 'op-warn' : 'op-good';
 $('#main').innerHTML = lIntro('연습 모드', '수강 중인 과정에서 골고루, 약한 개념 위주로 5문항을 뽑았어요(한 개념은 최대 2문항). <b>성적에는 반영되지 않으니</b> 마음 편히 풀어 보세요.', '<button class="secondary" id="pr-new">새 문제 5개</button>') +
  `<div class="op-grid pr-grid"><section class="panel op-card pr-card">${!qs.length ? '<div class="m-empty"><strong>연습할 문항이 아직 없어요</strong><span>강사님이 문제 은행에 문항을 추가하면 풀 수 있어요.</span></div>' : done ? `<div class="pr-done">${lRing(results.filter(Boolean).length, qs.length, 120)}<h2>${results.filter(Boolean).length === qs.length ? '모두 맞혔어요!' : '수고했어요'}</h2><p class="muted">틀린 개념은 오답 노트와 해설로 한 번 더 보면 좋아요.</p><div class="quick-actions"><button class="primary" id="pr-again">한 세트 더</button><button class="secondary" data-view="learn-wrong">오답 노트</button></div></div>` : `<div class="pr-top"><span class="op-scope">${escape(q.concept)}</span><span class="op-level ${tDiff[q.difficulty][1]}">${tDiff[q.difficulty][0]}</span>${q.course_title ? `<small class="muted">${escape(q.course_title)}</small>` : ''}<span class="op-spacer"></span><div class="pr-dots">${qs.map((_, k) => `<i class="${k < i ? (results[k] ? 'ok' : 'bad') : k === i ? 'cur' : ''}"></i>`).join('')}</div><small class="muted">${i + 1} / ${qs.length}</small></div><div class="pr-prompt">${rich(q.prompt)}</div><ol class="wn-opts">${q.options.map((o, k) => `<li><button type="button" class="wn-opt pr-opt" data-k="${k}"><span>${k + 1}</span>${rich(o)}</button></li>`).join('')}</ol><div class="wn-result" hidden></div><div class="pr-next" hidden><button class="primary" id="pr-next">${i + 1 < qs.length ? '다음 문제' : '결과 보기'} ›</button></div>`}</section>
  <section class="panel op-card"><h3>개념별 정답률</h3><p class="muted">평가 기록 기준 · 누르면 그 개념만 연습</p>${d.concepts.slice(0, 12).map(c => `<a class="an-concept pr-concept ${concept === c.concept ? 'sel' : ''}" href="/learn/practice?concept=${encodeURIComponent(c.concept)}" data-go="/learn/practice?concept=${encodeURIComponent(c.concept)}"><span>${escape(c.concept)}</span><div class="op-bar"><span class="${rateCls(c.rate)}" data-w="${c.rate}"></span></div><b>${c.rate}%</b></a>`).join('')}${concept ? '<button class="secondary pr-all" data-go="/learn/practice">약한 개념 섞어서 풀기</button>' : ''}<div class="an-help"><b>최근 7일 연습</b><p>${d.week.n}문항 풀이 · ${d.week.n ? Math.round(d.week.ok * 100 / d.week.n) : 0}% 정답</p></div></section></div>`;
 $('#pr-new').onclick = renderPractice; $('#pr-again')?.addEventListener('click', renderPractice);
 $('#main').querySelectorAll('.pr-opt').forEach(b => b.onclick = async () => {
  const k = Number(b.dataset.k);
  try { const r = await api('/student/practice/check', {method: 'POST', body: JSON.stringify({bank_id: q.id, answer: k})}); results[i] = r.correct;
   $('#main').querySelectorAll('.pr-opt').forEach(x => { const kk = Number(x.dataset.k); x.disabled = true; x.classList.toggle('right', kk === r.answer); x.classList.toggle('wrong', kk === k && !r.correct); });
   const box = $('#main').querySelector('.wn-result'); box.hidden = false; box.className = 'wn-result ' + (r.correct ? 'ok' : 'bad'); box.innerHTML = `<b>${r.correct ? '정답!' : '오답'}</b>${r.explanation ? `<p>${rich(r.explanation)}</p>` : ''}`;
   $('#main').querySelector('.pr-next').hidden = false; $('#pr-next').onclick = () => { practice.i++; drawPractice(); }; $('#pr-next').focus();
  } catch (e) { toast(e.message); }
 });
 opApply(); tBindLinks(); bindViews();
}

// ---------- 피드백 상세 · 이의 신청 ----------
async function renderFeedback() {
 shell(); startLoading('피드백을 불러오고 있습니다…');
 try {
  const {items} = await api('/student/feedback');
  const st = {open: ['검토 중', 'op-a-ai'], accepted: ['반영됨', 'op-a-grade'], rejected: ['답변 완료', 'op-a-auth']};
  const conf = items.filter(x => x.confirmed), avg = conf.length ? Math.round(conf.reduce((a, x) => a + x.score * 100 / x.points, 0) / conf.length) : null;
  $('#main').innerHTML = lIntro('피드백 상세', '주관식 답안의 점수를 채점 기준별로 보여 줍니다. 채점이 이상하면 이의 신청을 남겨 주세요. 강사님이 확인하고 답변합니다.') +
   opKpis([['주관식 답안', items.length], ['평균 득점률', avg != null ? avg + '<small>%</small>' : '-'], ['채점 대기', items.filter(x => !x.confirmed).length], ['이의 신청', items.reduce((a, x) => a + x.appeals.length, 0), `검토 중 ${items.reduce((a, x) => a + x.appeals.filter(p => p.status === 'open').length, 0)}`]]) +
   `<div class="fb-list">${items.map((x, i) => { const open = x.appeals.find(a => a.status === 'open'); return `<section class="panel fb-item"><div class="fb-head"><div><span class="op-scope">${escape(x.concept || '주관식')}</span> <b>${escape(x.title)}</b> <small class="muted">${escape(x.course_title)} · ${opDate(x.submitted_at)}</small></div>${x.confirmed ? `<div class="fb-score"><b>${x.score}</b><small>/ ${x.points}점</small></div>` : '<span class="op-act op-a-ai">채점 중</span>'}</div><div class="fb-prompt">${rich(x.prompt)}</div>
    <div class="fb-body"><div class="fb-answer"><small>내 답안</small><p>${escape(String(x.answer || '빈 답안'))}</p></div>
    ${x.confirmed ? `<div class="fb-crit"><small>채점 기준별 점수${x.estimated ? ' <em title="강사가 총점만 입력해 기준 배점 비율로 나눠 보여 줍니다">· 배점 비율로 나눈 값</em>' : ''}</small>${(x.criteria || []).map(c => `<div class="fb-c"><span>${escape(c.label)}</span><div class="op-bar"><span class="${c.score >= c.points * 0.8 ? 'op-good' : c.score >= c.points * 0.5 ? 'op-warn' : 'op-bad'}" data-w="${c.points ? c.score * 100 / c.points : 0}"></span></div><b>${c.score}<small>/${c.points}</small></b></div>`).join('') || `<p class="muted">${escape(x.rubric || '')}</p>`}<div class="fb-feedback"><small>피드백 ${x.ai_assisted ? `<span class="op-act op-a-ai">${AI_MARK} 초안 · 강사 확인</span>` : '<span class="op-act op-a-grade">강사 채점</span>'}</small><p>${escape(x.feedback || '피드백이 없습니다.')}</p></div></div>` : '<div class="fb-crit"><p class="muted">강사님이 채점하고 있어요. 확정되면 기준별 점수가 보여요.</p></div>'}</div>
    ${x.confirmed ? `<details class="fb-model"><summary>모범 답안 보기</summary><p>${rich(x.model_answer || '')}</p></details>` : ''}
    ${x.appeals.map(a => `<div class="fb-appeal"><span class="op-act ${st[a.status][1]}">이의 신청 · ${st[a.status][0]}</span><p><b>내 사유</b> ${escape(a.reason)}</p>${a.response ? `<p><b>강사 답변</b> ${escape(a.response)}</p>` : ''}<small class="muted">${opDate(a.created_at)}${a.resolved_at ? ' → ' + opDate(a.resolved_at) : ''}</small></div>`).join('')}
    ${x.confirmed && !open ? `<div class="fb-actions"><button class="secondary fb-appeal-btn" data-i="${i}">이의 신청</button></div>` : ''}</section>`; }).join('') || '<section class="panel"><div class="m-empty"><strong>주관식 답안이 없어요</strong></div></section>'}</div>`;
  $('#main').querySelectorAll('.fb-appeal-btn').forEach(b => b.onclick = () => { const x = items[b.dataset.i]; opDialog(`<h2>이의 신청</h2><p class="muted">${escape(x.title)} · ${x.score}/${x.points}점. 어느 기준에서 왜 점수가 달라야 하는지 구체적으로 적어 주세요.</p><textarea name="reason" rows="6" maxlength="2000" required></textarea>`, '보내기', async f => { await api('/student/appeals', {method: 'POST', body: JSON.stringify({result_id: x.result_id, index: x.index, reason: f.reason})}); toast('이의 신청을 보냈어요. 강사님 답변은 공지·알림으로 알려 드려요.'); renderFeedback(); }); });
  opApply();
 } catch (e) { opFail(e); }
}

// ---------- 성취 · 연속 학습 ----------
async function renderBadges() {
 shell(); startLoading('성취 기록을 불러오고 있습니다…');
 try {
  const d = await api('/student/achievements');
  const earned = d.badges.filter(b => b.earned);
  const lvl = n => n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
  const weeks = []; for (let i = 0; i < d.heat.length; i += 7) weeks.push(d.heat.slice(i, i + 7));
  $('#main').innerHTML = lIntro('성취·연속 학습', '평가, 연습, 오답 복습을 한 날은 학습한 날로 셉니다. 배지를 모으고 주간 목표를 채워 보세요.') +
   `<div class="op-grid lb-top"><section class="panel op-card lb-streak"><div class="lb-flame">${lIcon('flame')}</div><div><small class="muted">연속 학습</small><b>${d.streak.current}<small>일</small></b><p class="muted">최고 기록 ${d.streak.best}일 · 배지 ${earned.length}/${d.badges.length}</p></div><div class="lb-heat-wrap"><div class="lb-heat">${weeks.map(w => `<div class="lb-wk">${w.map(x => `<i class="h${lvl(x.n)}" title="${x.day} · ${x.n}회"></i>`).join('')}</div>`).join('')}</div><small class="muted">최근 12주 · 진할수록 많이 학습한 날</small></div></section>
   <section class="panel op-card lb-goal"><h3>주간 목표</h3><div class="lt-goal">${lRing(d.goal.done, d.goal.target, 110)}<div><p>이번 주 <b>${d.goal.done}문항</b>을 풀었어요.</p><form id="lb-goal" class="op-inline"><label for="lb-target">목표</label><input id="lb-target" type="number" min="1" max="50" value="${d.goal.target}"><span>문항 / 주</span><button class="primary">저장</button></form><small class="muted">평가 문항, 연습 문제, 오답 다시 풀기를 모두 셉니다.</small></div></div></section></div>
   <section class="panel op-card"><h3>배지</h3><div class="lb-grid">${d.badges.map(b => `<div class="lb-badge ${b.earned ? 'on' : ''}"><div class="lb-icon">${lIcon(b.icon)}</div><strong>${escape(b.name)}</strong><small>${escape(b.desc)}</small>${b.earned ? `<em>${b.at ? opDate(b.at).split(' ').slice(0, 2).join(' ') + ' 획득' : '획득'}</em>` : `<div class="op-bar"><span data-w="${b.progress * 100 / b.target}"></span></div><em>${b.progress} / ${b.target}</em>`}</div>`).join('')}</div></section>
   ${d.modules.length ? `<section class="panel op-card"><h3>완료한 모듈</h3><div class="lb-mods">${d.modules.map(m => `<span class="lb-mod ${m.reached ? 'reached' : ''}" title="${escape(m.title)}">${m.week}주 ${escape(m.title)} · ${m.percent}점${m.benchmark != null ? (m.reached ? ' ✓ 기준 도달' : ` / 기준 ${m.benchmark}`) : ''}</span>`).join('')}</div></section>` : ''}`;
  $('#lb-goal').onsubmit = async e => { e.preventDefault(); try { await api('/student/goal', {method: 'POST', body: JSON.stringify({target: Number($('#lb-target').value)})}); toast('주간 목표를 저장했어요.'); renderBadges(); } catch (err) { toast(err.message); } };
  opApply();
 } catch (e) { opFail(e); }
}

// ---------- 학습 리포트 (PDF) ----------
async function renderLearnReport() {
 shell(); startLoading('학습 리포트를 만들고 있습니다…');
 try {
  const [{paths}, ach, pr, {results}] = await Promise.all([api('/student/learning-path'), api('/student/achievements'), api('/student/practice'), api('/student/results')]);
  const courseBlock = p => {
   const steps = p.steps.map(s => { const done = s.assessments.filter(a => a.percent != null); return {...s, pct: done.length ? Math.round(done.reduce((a, x) => a + x.percent, 0) / done.length * 10) / 10 : null}; });
   const scored = steps.filter(s => s.pct != null), avg = scored.length ? Math.round(scored.reduce((a, s) => a + s.pct, 0) / scored.length * 10) / 10 : null;
   const bw = scored.filter(s => s.benchmark != null), bench = bw.length ? Math.round(bw.reduce((a, s) => a + s.benchmark, 0) / bw.length * 10) / 10 : null;
   const first = scored[0]?.pct, last = scored[scored.length - 1]?.pct;
   return `<section class="rp-course"><div class="rp-course-head"><h3>${escape(p.course_title)}</h3><small class="muted">${escape(p.course_start || '')} ~ ${escape(p.course_end || '')}</small></div><div class="rp-stats"><div><small>평균</small><b>${avg ?? '-'}</b></div><div><small>3년차 기준</small><b>${bench ?? '-'}</b></div><div><small>완료 주차</small><b>${scored.length}/${steps.length}</b></div><div><small>성장</small><b>${first != null && last != null ? (last - first >= 0 ? '+' : '') + Math.round((last - first) * 10) / 10 : '-'}</b></div></div>${trendSvg(scored.map(s => ({label: s.title, short: s.week + '주', mine: s.pct, cls: s.benchmark})))}<table class="rp-table"><thead><tr><th>주차</th><th>모듈</th><th class="num">점수</th><th class="num">3년차 기준</th><th>평가</th></tr></thead><tbody>${steps.map(s => `<tr><td>${s.week}</td><td>${escape(s.title)}</td><td class="num"><b>${s.pct ?? '-'}</b></td><td class="num">${s.benchmark ?? '-'}</td><td><small>${s.assessments.map(a => escape(a.title)).join(', ')}</small></td></tr>`).join('')}</tbody></table></section>`;
  };
  const strong = pr.concepts.filter(c => c.rate >= 90 && c.n >= 2).slice(-6).reverse(), weak = pr.concepts.filter(c => c.rate < 70).slice(0, 6);
  $('#main').innerHTML = lIntro('학습 리포트', '내 성적, 러닝 패스, 성장 추이를 한 장으로 정리했어요. 「PDF로 저장」을 누르고 인쇄 창에서 PDF로 저장하면 포트폴리오로 쓸 수 있어요.', '<div class="quick-actions op-no-print"><button class="primary" id="rp-print">PDF로 저장</button></div>') +
   `<article class="panel rp-doc" id="rp-doc"><div class="rp-head"><div><span class="eyebrow">LEARNING REPORT</span><h2>${escape(user.name)} 학습 리포트</h2><p class="muted">배움길 LMS · ${new Date().toLocaleDateString('ko-KR')} 기준</p></div><div class="rp-sum"><div><small>응시 평가</small><b>${results.length}</b></div><div><small>연습 문항</small><b>${ach.counts.practiced}</b></div><div><small>완료 모듈</small><b>${ach.counts.modules}</b></div><div><small>최고 연속 학습</small><b>${ach.streak.best}일</b></div></div></div>
   ${paths.map(courseBlock).join('')}
   <section class="rp-two"><div><h3>강점 개념</h3>${strong.map(c => `<span class="rp-chip ok">${escape(c.concept)} ${c.rate}%</span>`).join('') || '<p class="muted">-</p>'}</div><div><h3>보완할 개념</h3>${weak.map(c => `<span class="rp-chip bad">${escape(c.concept)} ${c.rate}%</span>`).join('') || '<p class="muted">-</p>'}</div></section>
   <section><h3>획득한 배지</h3><div class="rp-badges">${ach.badges.filter(b => b.earned).map(b => `<span class="rp-badge">${lIcon(b.icon)} ${escape(b.name)}</span>`).join('') || '<p class="muted">-</p>'}</div></section>
   <div class="rp-foot muted">점수는 100점 환산 평균입니다. 3년차 기준은 강사가 주차별로 정한 현업 3년차 개발자 기대 점수입니다.</div></article>`;
  $('#rp-print').onclick = () => window.print();
 } catch (e) { opFail(e); }
}

// ---------- 강사: 이의 신청 ----------
async function renderTeachAppeals() {
 shell(); startLoading('이의 신청을 불러오고 있습니다…');
 try {
  const {appeals} = await api('/instructor/appeals');
  const st = {open: ['검토 대기', 'op-a-warn'], accepted: ['반영', 'op-a-grade'], rejected: ['유지', 'op-a-auth']};
  $('#main').innerHTML = tIntro('이의 신청', '학생이 주관식 채점에 이의를 신청하면 여기에 모입니다. 점수를 바꿔 반영하거나, 이유를 답하고 유지하세요. 결과는 학생에게 알림으로 갑니다.') +
   opKpis([['검토 대기', appeals.filter(a => a.status === 'open').length, '', appeals.some(a => a.status === 'open') ? 'op-k-high' : ''], ['반영', appeals.filter(a => a.status === 'accepted').length], ['유지', appeals.filter(a => a.status === 'rejected').length], ['전체', appeals.length]]) +
   `<div class="fb-list">${appeals.map((a, i) => `<section class="panel fb-item"><div class="fb-head"><div><span class="op-act ${st[a.status][1]}">${st[a.status][0]}</span> <b>${escape(a.student_name)}</b> <small class="muted">${escape(a.course_title)} · ${escape(a.title)} · ${opDate(a.created_at)}</small></div><div class="fb-score"><b>${a.score ?? '-'}</b><small>/ ${a.question.points}점</small></div></div><div class="fb-prompt">${rich(a.question.prompt || '')}</div><div class="fb-body"><div class="fb-answer"><small>학생 답안</small><p>${escape(String(a.answer || ''))}</p></div><div class="fb-crit"><small>채점 기준</small><p>${escape(a.question.rubric || '')}</p><small>기존 피드백</small><p>${escape(a.feedback || '')}</p></div></div><div class="fb-appeal"><p><b>이의 사유</b> ${escape(a.reason)}</p>${a.response ? `<p><b>답변</b> ${escape(a.response)}</p>` : ''}</div>${a.status === 'open' ? `<div class="fb-actions"><button class="secondary ap-act" data-i="${i}" data-s="rejected">점수 유지</button><button class="primary ap-act" data-i="${i}" data-s="accepted">점수 바꿔 반영</button></div>` : ''}</section>`).join('') || '<section class="panel"><div class="m-empty"><strong>이의 신청이 없습니다</strong></div></section>'}</div>`;
  $('#main').querySelectorAll('.ap-act').forEach(b => b.onclick = () => { const a = appeals[b.dataset.i], acc = b.dataset.s === 'accepted'; opDialog(`<h2>${acc ? '점수 바꿔 반영' : '점수 유지'}</h2>${acc ? `<label>새 점수 (0~${a.question.points})</label><input name="score" type="number" min="0" max="${a.question.points}" value="${a.score ?? 0}" required>` : ''}<label>학생에게 보낼 답변</label><textarea name="response" rows="5" required></textarea>`, acc ? '반영하기' : '답변 보내기', async f => { await api('/instructor/appeals/' + a.id, {method: 'POST', body: JSON.stringify({status: b.dataset.s, response: f.response, ...(acc ? {score: Number(f.score)} : {})})}); toast('처리하고 학생에게 알렸습니다.'); renderTeachAppeals(); }); });
 } catch (e) { opFail(e); }
}
