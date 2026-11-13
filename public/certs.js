// Completion certificate screens: student downloads, instructor issue/revoke per course, admin issued list.
const CERT_RULE = p => `과정이 끝나고, 공개된 평가를 모두 응시하고, 평균이 ${p}점 이상이면 자동으로 발급됩니다.`;
const certStatus = c => !c ? ['미발급', 'op-a-auth'] : c.revoked_at ? ['취소됨', 'op-a-warn'] : [c.method === 'manual' ? '발급 (수동)' : '발급', 'op-a-grade'];
const certD = d => d ? String(d).slice(0, 10).replace(/-/g, '.') : '-';
const dday = d => { const n = Math.round((new Date(d + 'T00:00:00+09:00') - new Date(new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10) + 'T00:00:00+09:00')) / 864e5); return n > 0 ? `D-${n}` : n === 0 ? 'D-day' : '종료'; };

function certPreview(c, extra = '') {
 const dlg = document.createElement('dialog'); dlg.className = 'student-dialog op-dialog ct-dialog';
 dlg.innerHTML = `<div class="ct-dlg-head"><div><h2>${escape(c.course_title)}</h2><p class="muted">${escape(c.student_name)} · ${escape(c.cert_no)}</p></div><button type="button" class="secondary ct-close">닫기</button></div><canvas class="ct-canvas" aria-label="수료증 미리보기"></canvas><div class="quick-actions">${extra}<button type="button" class="secondary ct-verify">검증 페이지</button><button type="button" class="secondary" data-dl="png">PNG 저장</button><button type="button" class="primary" data-dl="pdf">PDF 저장</button></div>`;
 document.body.append(dlg); dlg.showModal();
 dlg.querySelector('.ct-close').onclick = () => dlg.close();
 dlg.querySelector('.ct-verify').onclick = () => window.open('/verify/' + encodeURIComponent(c.cert_no), '_blank', 'noopener');
 dlg.addEventListener('close', () => dlg.remove());
 dlg.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => { b.disabled = true; try { await certDownload(c, b.dataset.dl); } finally { b.disabled = false; } });
 drawCertificate(dlg.querySelector('canvas'), c).catch(e => toast('수료증을 그리지 못했습니다: ' + e.message));
 return dlg;
}

// ---------- 학생: 수료증 ----------
async function renderLearnCerts() {
 shell(); startLoading('수료증을 불러오고 있습니다…');
 try {
  const d = await api('/student/certificates');
  const issued = d.courses.filter(c => c.certificate), going = d.courses.filter(c => !c.certificate);
  const check = (ok, label, sub) => `<li class="${ok ? 'ok' : ''}"><span aria-hidden="true">${ok ? '✓' : '○'}</span><div><b>${label}</b><small>${sub}</small></div></li>`;
  $('#main').innerHTML = lIntro('수료증', `${CERT_RULE(d.pass_average)} 발급된 수료증은 PDF(A4)와 이미지로 내려받을 수 있고, QR 코드로 누구나 진위를 확인할 수 있어요.`) +
   opKpis([['발급된 수료증', issued.length, issued.length ? '내려받기 가능' : ''], ['진행 중 과정', going.filter(c => !c.ended).length], ['수료 기준', `${d.pass_average}점`, '평균 이상 + 전 평가 응시']]) +
   (issued.length ? `<div class="ct-grid">${issued.map((c, i) => `<section class="panel ct-card"><button type="button" class="ct-thumb" data-open="${i}" aria-label="${escape(c.title)} 수료증 크게 보기"><canvas data-i="${i}"></canvas></button><div class="ct-meta"><h3>${escape(c.title)}</h3><p class="muted">수료일 ${certD(c.certificate.completed_on)} · 성적 <b>${escape(c.certificate.grade)}</b> (${c.certificate.average})</p><code>${escape(c.certificate.cert_no)}</code><div class="quick-actions"><button type="button" class="secondary" data-dl="png" data-i="${i}">PNG</button><button type="button" class="primary" data-dl="pdf" data-i="${i}">PDF 저장</button></div></div></section>`).join('')}</div>`
    : `<section class="panel ct-empty"><h2>아직 발급된 수료증이 없어요</h2><p class="muted">과정이 끝나고 수료 기준을 채우면 여기에 수료증이 생깁니다.</p></section>`) +
   (going.length ? `<section class="panel ct-progress"><h2>수료 진행 상황</h2>${going.map(c => `<div class="ct-row"><div class="ct-row-head"><b>${escape(c.title)}</b><small class="muted">${escape(c.start_date || '')} ~ ${escape(c.end_date || '')} · ${escape(c.instructor || '')}</small>${c.revoked ? '<span class="op-act op-a-warn">수료증 취소됨</span>' : `<span class="op-act ${c.took_all && c.passed ? 'op-a-grade' : 'op-a-auth'}">${c.took_all && c.passed ? (c.ended ? '수료 기준 충족' : '종료 후 자동 발급') : c.ended ? '수료 기준 미달' : '진행 중'}</span>`}</div><ul class="ct-checks">${check(c.ended, '과정 종료', c.ended ? `${certD(c.end_date)} 종료` : `${certD(c.end_date)} 종료 예정 · ${dday(c.end_date)}`)}${check(c.took_all, '모든 평가 응시', `${c.taken} / ${c.required}개`)}${check(c.passed, `평균 ${d.pass_average}점 이상`, `현재 ${c.average}점 · ${c.grade}`)}</ul></div>`).join('')}</section>` : '');
  const certs = issued.map(c => c.certificate);
  $('#main').querySelectorAll('canvas[data-i]').forEach(cv => drawCertificate(cv, certs[cv.dataset.i]).catch(() => {}));
  $('#main').querySelectorAll('[data-open]').forEach(b => b.onclick = () => certPreview(certs[b.dataset.open]));
  $('#main').querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => { b.disabled = true; try { await certDownload(certs[b.dataset.i], b.dataset.dl); } finally { b.disabled = false; } });
 } catch (e) { opFail(e); }
}

// ---------- 강사: 수료증 발급 ----------
async function renderTeachCerts() {
 shell(); startLoading('수료증 현황을 불러오고 있습니다…');
 try {
  const d = await api('/instructor/certificates');
  if (!d.courses.length) { $('#main').innerHTML = tIntro('수료증', '담당 과정이 없습니다.'); return; }
  const want = tParam('c'), course = d.courses.find(c => c.id === want) || d.courses.find(c => c.ended) || d.courses[0];
  const s = course.students, valid = s.filter(x => x.certificate && !x.certificate.revoked_at);
  const row = x => { const c = x.certificate, [lab, cls] = certStatus(c);
   const cond = x.eligible ? '<span class="ct-ok">충족</span>' : `<span class="muted">${[!course.ended && '과정 진행 중', !x.took_all && `미응시 ${x.required - x.taken}`, !x.passed && `평균 미달`].filter(Boolean).join(' · ')}</span>`;
   const acts = c ? `<button class="secondary" data-view-cert="${x.id}">미리보기</button>${c.revoked_at ? `<button class="secondary" data-restore="${c.id}">복구</button>` : `<button class="secondary" data-revoke="${c.id}">취소</button>`}` : `<button class="${x.eligible ? 'primary' : 'secondary'}" data-issue="${x.id}">${x.eligible ? '발급' : '수동 발급'}</button>`;
   return `<tr><td><b>${escape(x.name)}</b><br><small class="muted">${escape(x.email)}</small></td><td class="num">${x.taken}/${x.required}</td><td class="num">${x.average}</td><td>${x.grade}</td><td>${cond}</td><td><span class="op-act ${cls}">${lab}</span>${c ? `<br><code class="ct-no">${escape(c.cert_no)}</code>` : ''}</td><td class="right ct-acts">${acts}</td></tr>`; };
  $('#main').innerHTML = tIntro('수료증', `${CERT_RULE(d.pass_average)} 조건을 못 채운 학생도 사유가 있으면 수동으로 발급할 수 있고, 잘못 발급된 수료증은 취소할 수 있어요. 취소하면 검증 페이지에 「취소된 수료증」으로 표시됩니다.`) +
   `<section class="panel m-panel"><div class="m-toolbar"><select id="ct-course" aria-label="과정 선택">${d.courses.map(c => `<option value="${c.id}" ${c.id === course.id ? 'selected' : ''}>${escape(c.title)} (${c.ended ? '종료' : certD(c.end_date) + ' 종료 예정'})</option>`).join('')}</select><small class="muted">${escape(course.start_date || '')} ~ ${escape(course.end_date || '')} · 공개 평가 ${course.required}개</small></div></section>` +
   opKpis([['수강생', s.length], ['수료 기준 충족', s.filter(x => x.eligible).length, course.ended ? '' : '과정 종료 후 확정'], ['발급', valid.length, valid.filter(x => x.certificate.method === 'manual').length ? `수동 ${valid.filter(x => x.certificate.method === 'manual').length}` : ''], ['취소', s.filter(x => x.certificate?.revoked_at).length]]) +
   `<section class="panel m-panel"><div class="m-table"><table><thead><tr><th>학생</th><th class="num">응시</th><th class="num">평균</th><th>등급</th><th>수료 조건</th><th>수료증</th><th class="right">관리</th></tr></thead><tbody>${s.map(row).join('')}</tbody></table></div></section>`;
  $('#ct-course').onchange = e => tGo('/teach/certificates?c=' + e.target.value);
  const byId = id => s.find(x => x.id === id), reload = () => renderTeachCerts();
  $('#main').querySelectorAll('[data-view-cert]').forEach(b => b.onclick = () => certPreview(byId(b.dataset.viewCert).certificate));
  $('#main').querySelectorAll('[data-issue]').forEach(b => b.onclick = () => { const x = byId(b.dataset.issue);
   opDialog(`<h2>${x.eligible ? '수료증 발급' : '수동 발급'}</h2><p><b>${escape(x.name)}</b> · ${escape(course.title)}</p><p class="muted">평균 ${x.average}점 (${x.grade}) · 응시 ${x.taken}/${x.required}${x.eligible ? '' : '. 수료 기준을 채우지 않았지만 강사 판단으로 발급합니다. 활동 로그에 남습니다.'}</p>`, '발급하기', async () => { await api('/instructor/certificates/issue', {method: 'POST', body: JSON.stringify({course_id: course.id, student_id: x.id})}); toast('수료증을 발급하고 학생에게 알렸습니다.'); reload(); }); });
  $('#main').querySelectorAll('[data-revoke]').forEach(b => b.onclick = () => opDialog('<h2>수료증 취소</h2><p class="muted">취소하면 학생 화면에서 사라지고, 검증 페이지에는 취소된 수료증으로 표시됩니다. 나중에 복구할 수 있습니다.</p><label>취소 사유 (학생에게 전달됩니다)</label><textarea name="reason" rows="3" required></textarea>', '취소하기', async f => { await api(`/instructor/certificates/${b.dataset.revoke}/revoke`, {method: 'POST', body: JSON.stringify({reason: f.reason})}); toast('수료증을 취소했습니다.'); reload(); }));
  $('#main').querySelectorAll('[data-restore]').forEach(b => b.onclick = async () => { try { await api(`/instructor/certificates/${b.dataset.restore}/restore`, {method: 'POST', body: '{}'}); toast('수료증을 복구했습니다.'); reload(); } catch (e) { toast(e.message); } });
 } catch (e) { opFail(e); }
}

// ---------- 관리자: 수료증 발급 현황 ----------
let certFilter = {course: '', status: ''};
async function renderAdminCerts() {
 shell(); startLoading('수료증 발급 현황을 불러오고 있습니다…');
 try {
  const d = await api('/admin/certificates'), all = d.certificates;
  const month = new Date().toISOString().slice(0, 7);
  const list = all.filter(c => (!certFilter.course || c.course_id === certFilter.course) && (!certFilter.status || (certFilter.status === 'revoked' ? c.revoked_at : !c.revoked_at)));
  $('#main').innerHTML = opIntro('OPERATIONS', '수료증 발급 현황', `${CERT_RULE(d.pass_average)} 강사가 수동 발급하거나 취소할 수 있고, 관리자도 여기에서 취소·복구할 수 있습니다.`) +
   opKpis([['전체 발급', all.length], ['유효', all.filter(c => !c.revoked_at).length], ['취소', all.filter(c => c.revoked_at).length, '', all.some(c => c.revoked_at) ? 'op-k-high' : ''], ['이번 달 발급', all.filter(c => String(c.issued_at).slice(0, 7) === month).length]]) +
   `<section class="panel m-panel"><h2 class="ct-sec">과정별 현황</h2><div class="m-table"><table><thead><tr><th>과정</th><th>강사</th><th>종료일</th><th class="num">수강생</th><th class="num">수료 기준 충족</th><th class="num">발급</th></tr></thead><tbody>${d.courses.map(c => `<tr><td><b>${escape(c.title)}</b></td><td>${escape(c.instructor || '-')}</td><td>${certD(c.end_date)} ${c.ended ? '<span class="op-act op-a-course">종료</span>' : `<small class="muted">${dday(c.end_date)}</small>`}</td><td class="num">${c.students}</td><td class="num">${c.ended ? c.eligible : '-'}</td><td class="num"><b>${c.issued}</b></td></tr>`).join('')}</tbody></table></div></section>` +
   `<section class="panel m-panel"><div class="m-toolbar"><select id="ac-course" aria-label="과정"><option value="">모든 과정</option>${d.courses.filter(c => all.some(x => x.course_id === c.id)).map(c => `<option value="${c.id}" ${certFilter.course === c.id ? 'selected' : ''}>${escape(c.title)}</option>`).join('')}</select><select id="ac-status" aria-label="상태"><option value="">모든 상태</option><option value="valid" ${certFilter.status === 'valid' ? 'selected' : ''}>유효</option><option value="revoked" ${certFilter.status === 'revoked' ? 'selected' : ''}>취소</option></select><small class="muted">${list.length}건</small></div><div class="m-table"><table><thead><tr><th>수료증 번호</th><th>수료자</th><th>과정</th><th>등급</th><th>수료일</th><th>방식</th><th>상태</th><th class="right">관리</th></tr></thead><tbody>${list.length ? list.map((c, i) => `<tr><td><code class="ct-no">${escape(c.cert_no)}</code></td><td><b>${escape(c.student_name)}</b></td><td>${escape(c.course_title)}<br><small class="muted">${escape(c.instructor || '')}</small></td><td>${escape(c.grade)} <small class="muted">${c.average}</small></td><td>${certD(c.completed_on)}</td><td>${c.method === 'manual' ? '수동' : '자동'}</td><td><span class="op-act ${certStatus(c)[1]}">${c.revoked_at ? '취소' : '유효'}</span>${c.revoked_at ? `<br><small class="muted">${escape(c.revoke_reason || '')}</small>` : ''}</td><td class="right ct-acts"><button class="secondary" data-pv="${i}">미리보기</button>${c.revoked_at ? `<button class="secondary" data-rs="${i}">복구</button>` : `<button class="secondary" data-rv="${i}">취소</button>`}</td></tr>`).join('') : '<tr><td colspan="8" class="muted">발급된 수료증이 없습니다.</td></tr>'}</tbody></table></div></section>`;
  $('#ac-course').onchange = e => { certFilter.course = e.target.value; renderAdminCerts(); };
  $('#ac-status').onchange = e => { certFilter.status = e.target.value; renderAdminCerts(); };
  $('#main').querySelectorAll('[data-pv]').forEach(b => b.onclick = () => certPreview(list[b.dataset.pv]));
  $('#main').querySelectorAll('[data-rv]').forEach(b => b.onclick = () => opDialog('<h2>수료증 취소</h2><label>취소 사유 (학생에게 전달됩니다)</label><textarea name="reason" rows="3" required></textarea>', '취소하기', async f => { await api(`/instructor/certificates/${list[b.dataset.rv].id}/revoke`, {method: 'POST', body: JSON.stringify({reason: f.reason})}); toast('수료증을 취소했습니다.'); renderAdminCerts(); }));
  $('#main').querySelectorAll('[data-rs]').forEach(b => b.onclick = async () => { try { await api(`/instructor/certificates/${list[b.dataset.rs].id}/restore`, {method: 'POST', body: '{}'}); toast('수료증을 복구했습니다.'); renderAdminCerts(); } catch (e) { toast(e.message); } });
 } catch (e) { opFail(e); }
}
