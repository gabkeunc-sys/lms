// 면담·상담일지: students request meetings; instructors accept/reschedule/decline and write a counseling log
// (private note for instructors, summary + agreed to-dos shared with the student). No AI.
const MT_KIND = {study: '학습', career: '진로', attendance: '출결', life: '생활', other: '기타'};
const MT_STATUS = {requested: ['신청 대기', 'op-a-warn'], scheduled: ['예정', 'op-a-course'], done: ['완료', 'op-a-grade'], declined: ['거절', 'op-a-auth'], cancelled: ['취소', 'op-a-auth']};
const mtPad = n => String(n).padStart(2, '0');
const mtLocal = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : `${d.getFullYear()}-${mtPad(d.getMonth() + 1)}-${mtPad(d.getDate())}T${mtPad(d.getHours())}:${mtPad(d.getMinutes())}`; };
const mtIso = v => v ? new Date(v).toISOString() : null;
const mtWhen = v => v ? new Date(v).toLocaleString('ko-KR', {month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'}) : '-';
const mtBadge = st => `<span class="op-act ${MT_STATUS[st][1]}">${MT_STATUS[st][0]}</span>`;
const mtKindSel = (v = 'study') => `<select name="kind">${Object.entries(MT_KIND).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
const mtSoon = (h = 26) => { const d = new Date(Date.now() + h * 36e5); d.setMinutes(0, 0, 0); return mtLocal(d); };
const mtGuideLink = (sid, cid) => `/teach/guidance?s=${sid}&c=${cid}`;

// Counseling log dialog. target: an existing meeting, or {student_id, student_name, course_id, course_title} for a new one.
function meetingLogDialog(target, onDone) {
 const mt = target.id ? target : null, acts = (mt?.actions || []).map(a => (a.done ? '✓ ' : '') + a.text).join('\n');
 opDialog(`<h2>상담일지 · ${escape(target.student_name)}</h2><p class="muted">${escape(target.course_title)}${mt?.request_note ? ` · 학생 요청: ${escape(mt.request_note)}` : ''}</p>
  <div class="op-row"><div><label>면담 일시</label><input name="held_at" type="datetime-local" value="${mtLocal(mt?.held_at || mt?.scheduled_at || new Date())}" required></div><div><label>유형</label>${mtKindSel(mt?.kind)}</div></div>
  <label>주제</label><input name="topic" maxlength="200" value="${escape(mt?.topic || '')}" placeholder="예: 중간 평가 이후 학습 계획">
  <div class="mt-split"><div class="mt-pub"><label>학생 공개 요약</label><textarea name="summary" rows="4" maxlength="4000" placeholder="학생과 함께 정리한 내용 (학생이 볼 수 있습니다)">${escape(mt?.summary || '')}</textarea><label>합의한 할 일 (한 줄에 하나)</label><textarea name="actions" rows="3" placeholder="매일 30분 SQL 문제 풀기&#10;금요일까지 3주차 과제 다시 제출">${escape(acts)}</textarea></div>
  <div class="mt-priv"><label>🔒 강사 비공개 메모</label><textarea name="private_note" rows="8" maxlength="8000" placeholder="학생에게 보이지 않습니다. 관찰한 점, 배경 사정, 다음에 확인할 것">${escape(mt?.private_note || '')}</textarea></div></div>
  <div class="op-row"><div><label>다음 면담일 (선택)</label><input name="next_at" type="datetime-local" value="${mtLocal(mt?.next_at)}"></div><div class="mt-checks"><label class="mt-check"><input type="checkbox" name="published" ${!mt || mt.published || mt.status !== 'done' ? 'checked' : ''}> 요약·할 일을 학생에게 공개</label><label class="mt-check"><input type="checkbox" name="guide"> 저장 후 학습 방향 바로 수정</label></div></div>
  ${mt?.status !== 'done' ? '<p class="muted">다음 면담일을 넣으면 후속 면담이 일정에 자동으로 잡힙니다.</p>' : ''}`, '상담일지 저장', async x => {
  let id = mt?.id;
  if (!id) id = (await api('/instructor/meetings', {method: 'POST', body: JSON.stringify({course_id: target.course_id, student_id: target.student_id, topic: x.topic || '면담', scheduled_at: mtIso(x.held_at), kind: x.kind, notify: false})})).id;
  const actions = x.actions.split('\n').map(s => s.trim()).filter(Boolean).map(s => ({text: s.replace(/^✓\s*/, ''), done: s.startsWith('✓')}));
  const r = await api(`/instructor/meetings/${id}/log`, {method: 'POST', body: JSON.stringify({held_at: mtIso(x.held_at), kind: x.kind, topic: x.topic, summary: x.summary, private_note: x.private_note, actions, next_at: mtIso(x.next_at), published: x.published === 'on'})});
  toast(r.follow_up ? '상담일지를 저장하고 후속 면담을 잡았습니다.' : '상담일지를 저장했습니다.');
  if (x.guide === 'on') return tGo(mtGuideLink(target.student_id, target.course_id));
  onDone?.();
 });
}
// Instructor books a meeting for a student.
function meetingNewDialog(roster, preset, onDone) {
 const opts = roster.map((s, i) => `<option value="${i}" ${preset && s.student_id === preset.student_id && s.course_id === preset.course_id ? 'selected' : ''}>${escape(s.student_name)} · ${escape(s.course_title)}</option>`).join('');
 opDialog(`<h2>면담 잡기</h2><label>학생</label><select name="who">${opts}</select><div class="op-row"><div><label>일시</label><input name="at" type="datetime-local" value="${mtSoon()}" required></div><div><label>유형</label>${mtKindSel()}</div></div><label>주제</label><input name="topic" maxlength="200" required placeholder="예: 최근 미응시와 학습 계획 점검"><p class="muted">학생에게 일정 알림이 갑니다.</p>`, '면담 잡기', async x => {
  const s = roster[x.who]; await api('/instructor/meetings', {method: 'POST', body: JSON.stringify({course_id: s.course_id, student_id: s.student_id, topic: x.topic, scheduled_at: mtIso(x.at), kind: x.kind})}); toast('면담을 잡고 학생에게 알렸습니다.'); onDone?.();
 });
}
function meetingScheduleDialog(mt, onDone) {
 const req = mt.status === 'requested';
 opDialog(`<h2>${req ? '면담 수락' : '일정 변경'} · ${escape(mt.student_name)}</h2><p class="muted">${escape(mt.course_title)} · ${escape(mt.topic)}${mt.preferred_at ? ` · 희망 ${mtWhen(mt.preferred_at)}` : ''}</p><label>면담 일시</label><input name="at" type="datetime-local" value="${mtLocal(mt.scheduled_at || mt.preferred_at) || mtSoon()}" required><label>학생에게 한마디 (선택)</label><input name="message" maxlength="300" placeholder="예: 강의실 옆 상담실에서 만나요">`, req ? '수락하고 알림' : '변경하고 알림', async x => {
  await api(`/instructor/meetings/${mt.id}/schedule`, {method: 'POST', body: JSON.stringify({scheduled_at: mtIso(x.at), message: x.message})}); toast(req ? '면담을 확정했습니다.' : '일정을 바꿨습니다.'); onDone?.();
 });
}
// Read-only body of a meeting card (shared by the instructor and student detail screens).
function meetingBody(mt, teacher) {
 const acts = mt.actions || [];
 return `${mt.request_note ? `<p class="mt-req">“${escape(mt.request_note)}”</p>` : ''}${mt.decline_reason ? `<p class="muted">답변: ${escape(mt.decline_reason)}</p>` : ''}
  ${mt.status === 'done' ? `${mt.summary ? `<div class="mt-sum"><small>${teacher ? (mt.published ? '학생 공개 요약' : '요약 (비공개)') : '강사님 요약'}</small><p>${escape(mt.summary).replace(/\n/g, '<br>')}</p></div>` : ''}${acts.length ? `<ul class="mt-acts">${acts.map((a, i) => `<li><label><input type="checkbox" data-act="${i}" ${a.done ? 'checked' : ''} ${teacher ? 'disabled' : ''}> <span>${escape(a.text)}</span></label></li>`).join('')}</ul>` : ''}${teacher && mt.private_note ? `<div class="mt-note"><small>🔒 비공개 메모</small><p>${escape(mt.private_note).replace(/\n/g, '<br>')}</p></div>` : ''}${mt.next_at ? `<small class="muted">다음 면담 ${mtWhen(mt.next_at)}</small>` : ''}` : ''}`;
}

// ---------- 강사: 면담·상담일지 ----------
let mtFilter = 'open';
async function renderTeachMeetings() {
 shell(); startLoading('면담 목록을 불러오고 있습니다…');
 try {
  const {meetings, roster, students} = await api('/instructor/meetings');
  const since = Date.now() - 30 * 864e5, recent = v => v && new Date(v) >= since;
  const risk = roster.filter(s => s.level !== 'low'), riskOk = risk.filter(s => recent(s.counseled_at)), need = risk.filter(s => !recent(s.counseled_at) && !s.pending).sort((a, b) => (a.level === 'high' ? 0 : 1) - (b.level === 'high' ? 0 : 1));
  const groups = {open: m => ['requested', 'scheduled'].includes(m.status), requested: m => m.status === 'requested', done: m => m.status === 'done', all: () => true};
  const list = meetings.filter(groups[mtFilter]).sort((a, b) => mtFilter === 'open' ? (a.status === 'requested' ? -1 : 0) - (b.status === 'requested' ? -1 : 0) || new Date(a.scheduled_at || a.preferred_at || a.created_at) - new Date(b.scheduled_at || b.preferred_at || b.created_at) : 0);
  const lv = {high: ['높음', 'op-high'], medium: ['보통', 'op-mid']};
  $('#main').innerHTML = tIntro('면담·상담일지', '학생 면담 신청을 받고, 면담마다 상담일지를 남깁니다. 학생 공개 요약과 강사 비공개 메모는 따로 저장됩니다.', '<div class="quick-actions"><button class="primary" id="mt-new">+ 면담 잡기</button></div>') +
   opKpis([['신청 대기', meetings.filter(groups.requested).length, '수락·일정 조정 필요', meetings.some(groups.requested) ? 'op-warn' : ''], ['예정된 면담', meetings.filter(m => m.status === 'scheduled').length, (() => { const n = meetings.filter(m => m.status === 'scheduled').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0]; return n ? `다음 ${mtWhen(n.scheduled_at)}` : '없음'; })()], ['최근 30일 완료', meetings.filter(m => m.status === 'done' && recent(m.held_at)).length, `누적 ${meetings.filter(groups.done).length}회`], ['위험 학생 면담률', risk.length ? Math.round(riskOk.length * 100 / risk.length) + '<small>%</small>' : '-', `${riskOk.length} / ${risk.length}명 (30일)`, risk.length && riskOk.length / risk.length < 0.5 ? 'op-bad' : '']]) +
   `<div class="op-notice-grid"><section class="panel m-panel"><div class="m-toolbar"><div class="m-seg">${[['open', '진행 중'], ['requested', '신청 대기'], ['done', '완료'], ['all', '전체']].map(([k, l]) => `<button type="button" data-mf="${k}" class="${mtFilter === k ? 'selected' : ''}">${l}</button>`).join('')}</div><span class="op-spacer"></span><span class="muted op-sub">${list.length}건</span></div>
   <div class="mt-list">${list.map(mt => `<article class="mt-item mt-${mt.status}"><div class="mt-head"><div class="m-user">${memberAvatar({id: mt.student_id, name: mt.student_name})}<div><strong>${escape(mt.student_name)}</strong><small>${escape(mt.course_title)}</small></div></div>${mtBadge(mt.status)}<span class="op-scope">${MT_KIND[mt.kind]}</span><span class="mt-when">${mt.status === 'requested' ? `희망 ${mtWhen(mt.preferred_at)}` : mtWhen(mt.held_at || mt.scheduled_at)}</span><span class="op-spacer"></span>
    ${mt.status === 'requested' ? `<button class="m-btn primary-lite" data-acc="${mt.id}">수락</button><button class="m-btn" data-acc="${mt.id}">일정 조정</button><button class="op-del" data-dec="${mt.id}">거절</button>` : ''}
    ${mt.status === 'scheduled' ? `<button class="m-btn primary-lite" data-log="${mt.id}">상담일지 작성</button><button class="m-btn" data-acc="${mt.id}">일정 변경</button>` : ''}
    ${mt.status === 'done' ? `<button class="m-btn" data-log="${mt.id}">상담일지 수정</button><button class="m-btn" data-go="${mtGuideLink(mt.student_id, mt.course_id)}">학습 방향 수정</button>` : ''}
    <button class="m-btn" data-go="/teach/students?s=${mt.student_id}&c=${mt.course_id}">학생 상세</button></div><div class="mt-topic"><b>${escape(mt.topic)}</b>${mt.requested_by === 'student' ? '<small class="muted"> · 학생 신청</small>' : ''}</div>${meetingBody(mt, true)}</article>`).join('') || '<div class="m-empty"><strong>해당하는 면담이 없습니다</strong></div>'}</div></section>
   <div class="op-side-col"><section class="panel op-card"><h3>면담이 필요한 위험 학생</h3><p class="muted">최근 30일 면담이 없고 잡힌 면담도 없는 학생</p>${need.slice(0, 8).map(s => `<div class="mt-need"><div class="m-user">${memberAvatar({id: s.student_id, name: s.student_name})}<div><strong>${escape(s.student_name)}</strong><small>${escape(s.course_title)} · ${escape(s.reasons.slice(0, 2).join(', '))}</small></div></div><span class="op-level ${lv[s.level][1]}">${lv[s.level][0]}</span><button class="m-btn" data-need="${roster.indexOf(s)}">면담 잡기</button></div>`).join('') || '<p class="muted">✓ 모든 위험 학생과 면담했습니다.</p>'}</section>
   <section class="panel op-card"><h3>이번 주 면담</h3>${meetings.filter(m => m.status === 'scheduled' && new Date(m.scheduled_at) - Date.now() < 7 * 864e5).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).map(m => `<div class="mt-week"><b>${mtWhen(m.scheduled_at)}</b><span>${escape(m.student_name)} · ${escape(m.topic)}</span></div>`).join('') || '<p class="muted">예정된 면담이 없습니다.</p>'}<button class="secondary mt-cal" data-go="/teach/schedule">강의 일정에서 보기</button></section></div></div>`;
  const byId = id => meetings.find(m => m.id === id), again = () => renderTeachMeetings();
  $('#main').querySelectorAll('[data-mf]').forEach(b => b.onclick = () => { mtFilter = b.dataset.mf; renderTeachMeetings(); });
  $('#main').querySelectorAll('[data-acc]').forEach(b => b.onclick = () => meetingScheduleDialog(byId(b.dataset.acc), again));
  $('#main').querySelectorAll('[data-log]').forEach(b => b.onclick = () => meetingLogDialog(byId(b.dataset.log), again));
  $('#main').querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const mt = byId(b.dataset.dec); opDialog(`<h2>면담 신청 거절 · ${escape(mt.student_name)}</h2><p class="muted">${escape(mt.topic)}</p><label>학생에게 보낼 답변</label><textarea name="reason" rows="3" maxlength="500" placeholder="예: 이번 주는 어려워요. 수업 후 질문 시간에 이야기해요."></textarea>`, '거절하고 알림', async x => { await api(`/instructor/meetings/${mt.id}/decline`, {method: 'POST', body: JSON.stringify(x)}); toast('답변을 보냈습니다.'); again(); }); });
  $('#main').querySelectorAll('[data-need]').forEach(b => b.onclick = () => meetingNewDialog(roster, roster[b.dataset.need], again));
  $('#mt-new').onclick = () => meetingNewDialog(students, null, again);
  tAvatars(); tBindLinks();
 } catch (e) { opFail(e); }
}

// ---------- 학생: 면담 신청 ----------
async function renderLearnMeetings() {
 shell(); startLoading('면담 내역을 불러오고 있습니다…');
 try {
  const {courses, meetings} = await api('/student/meetings');
  const open = meetings.filter(m => ['requested', 'scheduled'].includes(m.status)), done = meetings.filter(m => m.status === 'done'), rest = meetings.filter(m => ['declined', 'cancelled'].includes(m.status));
  const todo = done.flatMap(m => m.actions || []), left = todo.filter(a => !a.done).length;
  const card = mt => `<article class="mt-item mt-${mt.status}" data-mid="${mt.id}"><div class="mt-head">${mtBadge(mt.status)}<span class="op-scope">${MT_KIND[mt.kind]}</span><span class="mt-when">${mt.status === 'requested' ? `희망 ${mtWhen(mt.preferred_at)}` : mtWhen(mt.held_at || mt.scheduled_at)}</span><small class="muted">${escape(mt.course_title)} · ${escape(mt.instructor_name)} 강사님</small><span class="op-spacer"></span>${['requested', 'scheduled'].includes(mt.status) ? `<button class="op-del" data-cancel="${mt.id}">취소</button>` : ''}</div><div class="mt-topic"><b>${escape(mt.topic)}</b>${mt.status === 'requested' ? '<small class="muted"> · 강사님 확인을 기다리고 있어요</small>' : mt.status === 'scheduled' ? `<small class="muted"> · ${mt.requested_by === 'instructor' ? '강사님이 잡은 면담이에요' : '면담이 확정됐어요'}</small>` : ''}</div>${meetingBody(mt, false)}${mt.status === 'done' && !mt.summary && !(mt.actions || []).length ? '<p class="muted">공유된 요약이 아직 없어요.</p>' : ''}</article>`;
  $('#main').innerHTML = lIntro('면담 신청', '강사님께 면담을 신청하고, 면담 뒤에 강사님이 정리해 준 요약과 함께 정한 할 일을 확인해요.') +
   opKpis([['예정·대기', open.length, open.find(m => m.status === 'scheduled') ? `다음 ${mtWhen(open.filter(m => m.status === 'scheduled').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0].scheduled_at)}` : '확정된 면담 없음'], ['지난 면담', done.length, '요약 공유 ' + done.filter(m => m.summary).length + '회'], ['남은 할 일', left, `${todo.length}개 중`, left ? 'op-warn' : '']]) +
   `<div class="op-grid mt-learn"><section class="panel m-panel"><div class="m-toolbar"><h3 class="mt-h">내 면담</h3></div><div class="mt-list">${[...open, ...done, ...rest].map(card).join('') || '<div class="m-empty"><strong>아직 면담 기록이 없어요</strong><span>오른쪽에서 강사님께 면담을 신청해 보세요.</span></div>'}</div></section>
   <section class="panel op-card mt-form-card"><h3>면담 신청하기</h3><p class="muted">강사님이 확인하면 일정이 확정되고 알림이 와요.</p><form id="mt-form" class="mt-form"><label>과정</label><select name="course_id" required>${courses.map(c => `<option value="${c.id}">${escape(c.title)} · ${escape(c.instructor_name)} 강사님</option>`).join('')}</select><label>주제</label><input name="topic" maxlength="200" required placeholder="예: SQL 조인이 계속 헷갈려요"><div class="op-row"><div><label>유형</label>${mtKindSel()}</div><div><label>희망 일시</label><input name="preferred_at" type="datetime-local" value="${mtSoon(48)}"></div></div><label>미리 전할 말 (선택)</label><textarea name="note" rows="3" maxlength="2000" placeholder="상담하고 싶은 내용을 간단히 적어 주세요."></textarea><button class="primary" ${courses.length ? '' : 'disabled'}>신청하기</button></form></section></div>`;
  $('#mt-form').onsubmit = async e => { e.preventDefault(); const x = Object.fromEntries(new FormData(e.target)); try { await api('/student/meetings', {method: 'POST', body: JSON.stringify({...x, preferred_at: mtIso(x.preferred_at)})}); toast('면담을 신청했어요. 강사님께 알림이 갔어요.'); renderLearnMeetings(); } catch (err) { toast(err.message); } };
  $('#main').querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { if (!confirm('이 면담을 취소할까요?')) return; await api(`/student/meetings/${b.dataset.cancel}/cancel`, {method: 'POST', body: '{}'}); toast('면담을 취소했어요.'); renderLearnMeetings(); });
  $('#main').querySelectorAll('.mt-item [data-act]').forEach(cb => cb.onchange = async () => { const id = cb.closest('[data-mid]')?.dataset.mid; if (!id) return; try { await api(`/student/meetings/${id}/action`, {method: 'POST', body: JSON.stringify({index: Number(cb.dataset.act), done: cb.checked})}); toast(cb.checked ? '할 일을 완료했어요.' : '완료를 취소했어요.'); } catch (err) { toast(err.message); cb.checked = !cb.checked; } });
 } catch (e) { opFail(e); }
}
