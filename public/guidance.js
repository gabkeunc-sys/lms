// Learning direction rendered as sectioned cards. Works for the seeded "■ 제목" style, Markdown headings and **제목** lines.
const GUIDE_KINDS=[
 [/현재|상태|요약/,'status','현재 학습 상태','M4 20V10M10 20V4M16 20v-7'],
 [/잘한|강점|잘하고/,'good','잘한 점','M5 12l4 4 10-10'],
 [/보완|부족|약점|복습할/,'weak','보완할 개념','M12 8v5M12 16.5v.5M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
 [/예측|전망|예상/,'predict','예측','M3 17l6-6 4 4 8-8M15 7h6v6'],
 [/계획|다음|목표|학습 방법/,'plan','학습 계획','M4 5h16v15H4zM4 9h16M9 3v4M15 3v4'],
 [/한마디|격려|코멘트|의견/,'note','강사 한마디','M5 5h14v10H9l-4 4z']];
function parseGuidance(text){
 const lines=String(text||'').split('\n'),sections=[];let cur={title:'',kind:'intro',lines:[]};
 const heading=l=>{const m=l.match(/^\s*(?:■|▶|#{1,4})\s*(.+?)\s*$/)||l.match(/^\s*(?:\d+\.\s*)?\*\*([^*]{1,30})\*\*\s*:?\s*$/)||l.match(/^\s*\[([^\]]{1,30})\]\s*$/);return m?m[1].replace(/\*\*/g,'').replace(/[:：]$/,''):null;};
 for(const l of lines){const h=heading(l);if(h){if(cur.lines.join('').trim()||cur.title)sections.push(cur);const k=GUIDE_KINDS.find(([re])=>re.test(h));cur={title:h,kind:k?k[1]:'other',lines:[]};}else cur.lines.push(l);}
 if(cur.lines.join('').trim()||cur.title)sections.push(cur);
 return sections;
}
function guideBody(lines){
 const out=[];let list=null;const flush=()=>{if(list){out.push(`<${list.t} class="g-list">${list.items.join('')}</${list.t}>`);list=null;}};
 for(const raw of lines){const l=raw.trim();if(!l){flush();continue;}
  let m;const inline=t=>rich(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  if((m=l.match(/^[-*•]\s+(.*)/))){if(list?.t!=='ul'){flush();list={t:'ul',items:[]};}list.items.push(`<li>${inline(m[1])}</li>`);}
  else if((m=l.match(/^\d+[.)]\s+(.*)/))){if(list?.t!=='ol'){flush();list={t:'ol',items:[]};}list.items.push(`<li>${inline(m[1])}</li>`);}
  else{flush();out.push(`<p>${inline(l)}</p>`);}}
 flush();return out.join('');
}
function renderGuidanceCards(text){
 const sections=parseGuidance(text);
 if(!sections.some(s=>s.title))return `<div class="g-card g-other g-full"><div class="g-body">${guideBody(String(text||'').split('\n'))}</div></div>`;
 return `<div class="g-grid">${sections.map(s=>{const k=GUIDE_KINDS.find(x=>x[1]===s.kind);const full=['intro','status','note','other'].includes(s.kind)||s.kind==='plan';
  return s.kind==='intro'?`<p class="g-intro">${guideBody(s.lines).replace(/<\/?p>/g,'')}</p>`:`<section class="g-card g-${s.kind}${full?' g-full':''}"><h3>${k?`<span class="g-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${k[3]}"/></svg></span>`:''}${escape(s.title)}${s.kind==='predict'?AI_MARK:''}</h3><div class="g-body">${guideBody(s.lines)}</div></section>`;}).join('')}</div>`;
}
async function renderTeacherGuidance(){
 shell();startLoading('학습 지도 목록을 불러오고 있습니다…');
 try{const [{learners},{prompts}]=await Promise.all([api('/instructor/guidance'),api('/instructor/guidance/prompts')]);if(view!=='teach-guidance')return;
 const st=l=>!l.content?['none','미작성']:l.published?['pub','공개 중']:['draft','비공개 초안'];
 const counts={pub:learners.filter(l=>l.content&&l.published).length,draft:learners.filter(l=>l.content&&!l.published).length,none:learners.filter(l=>!l.content).length};
 const courses=[...new Map(learners.map(l=>[l.course_id,l])).values()];
 $('#main').innerHTML=`<section class="intro dashboard-intro"><div><span class="eyebrow">LEARNING COACHING</span><h1>학습 방향 지도 ${AI_MARK}</h1><p>AI가 시험 기록을 바탕으로 초안을 쓰고, 강사님이 검토·확정해 학생에게 공개합니다. 직접 작성도 할 수 있습니다.</p></div></section>
 <div class="g-kpis"><div class="g-kpi"><span>공개 중</span><strong>${counts.pub}</strong></div><div class="g-kpi"><span>비공개 초안</span><strong>${counts.draft}</strong></div><div class="g-kpi"><span>미작성</span><strong>${counts.none}</strong></div><div class="g-kpi"><span>지시문 문서</span><strong>${prompts.length}</strong></div></div>
 <div class="g-layout"><div class="panel g-learners"><div class="g-learners-head"><input id="g-search" type="search" placeholder="학생 이름 검색" aria-label="학생 이름 검색"><select id="g-course" aria-label="과정"><option value="">전체 과정</option>${courses.map(c=>`<option value="${c.course_id}">${escape(c.course_title)}</option>`).join('')}</select></div><div id="g-list" class="g-list-items" role="listbox" aria-label="학생 목록"></div></div>
 <section class="panel g-editor" id="guidance-editor"><div class="g-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg><h2>학생을 선택하세요</h2><p>왼쪽 목록에서 학생을 고르면 러닝 패스와 함께 학습 방향을 작성·검토할 수 있습니다.</p></div></section></div>
 <section class="panel" id="prompt-panel"></section>`;
 renderPromptPanel(prompts,learners);
 let current=-1,working=false;
 const drawList=()=>{const q=$('#g-search').value.trim(),c=$('#g-course').value;$('#g-list').innerHTML=learners.map((l,i)=>[l,i]).filter(([l])=>(!q||l.student_name.includes(q))&&(!c||l.course_id===c)).map(([l,i])=>{const [k,t]=st(l);return `<button type="button" class="g-item${i===current?' selected':''}" data-i="${i}" role="option" aria-selected="${i===current}"><span class="g-avatar">${escape(l.student_name.slice(0,1))}</span><span class="g-item-main"><strong>${escape(l.student_name)}</strong><small>${escape(l.course_title)}</small></span><span class="g-state g-${k}">${t}</span></button>`;}).join('')||'<p class="empty">조건에 맞는 학생이 없습니다.</p>';$('#g-list').querySelectorAll('.g-item').forEach(b=>b.onclick=()=>{if(working)return;current=Number(b.dataset.i);drawList();open(learners[current]);});};
 $('#g-search').oninput=drawList;$('#g-course').onchange=drawList;drawList();
 const open=l=>{
  const [k,t]=st(l);
  $('#guidance-editor').innerHTML=`<div class="g-editor-head"><div><span class="eyebrow">${escape(l.course_title)}${escape(coursePeriod(l))}</span><h2>${escape(l.student_name)}님의 학습 방향</h2></div><span class="g-state g-${k}" id="g-state">${t}</span></div>
  <details class="g-section" open><summary>러닝 패스</summary><div id="guidance-path"><div class="loading">러닝 패스를 불러오고 있습니다…</div></div></details>
  <div class="g-ai"><div class="g-ai-head"><strong>${AI_MARK} AI 초안 작성</strong><small>최근 확정된 평가 최대 10건의 주차·점수·문항 유형·개념 태그·득점만 전송합니다. 이름·이메일·답안 원문은 보내지 않습니다.</small></div><div class="g-ai-row"><label for="guidance-prompt">적용할 지시문</label><select id="guidance-prompt">${prompts.filter(p=>!p.course_id||p.course_id===l.course_id).sort((a,b)=>(b.course_id===l.course_id)-(a.course_id===l.course_id)).map(p=>`<option value="${p.id}">${escape(p.title)}${p.course_id?' · 과정 전용':p.is_default?' · 기본':''}</option>`).join('')}</select><button class="primary" id="guidance-generate">${AI_MARK} AI로 초안 작성</button></div><label class="student-choice"><input type="checkbox" id="guidance-privacy">개념 태그에 개인정보가 없는지 확인했습니다.</label></div>
  <div class="g-tabs subtabs inline" role="tablist"><button type="button" class="selected" data-tab="edit">편집</button><button type="button" data-tab="preview">학생 화면 미리보기</button></div>
  <div class="g-edit" id="g-edit"><textarea id="guidance-content" maxlength="8000" rows="18" placeholder="■ 현재 학습 상태&#10;■ 잘한 점&#10;■ 보완할 개념&#10;■ 예측&#10;■ 다음 2주 학습 계획&#10;처럼 제목을 달면 학생 화면에서 카드로 나뉘어 보입니다.">${escape(l.content||'')}</textarea></div>
  <div class="g-preview" id="g-preview" hidden></div>
  <div class="g-actions"><label class="g-switch"><input id="guidance-published" type="checkbox" ${l.published?'checked':''}><span></span>학생에게 공개</label><span id="guidance-status" role="status"></span><button class="primary" id="guidance-save">확정·저장</button></div>`;
  api('/instructor/learning-path/'+l.student_id).then(r=>renderLearningPath($('#guidance-path'),r.paths.filter(p=>p.course_id===l.course_id),{title:false})).catch(e=>{if($('#guidance-path'))$('#guidance-path').innerHTML=`<p class="empty">${escape(e.message)}</p>`;});
  const status=$('#guidance-status'),content=$('#guidance-content'),save=$('#guidance-save'),generate=$('#guidance-generate');
  const showTab=tab=>{document.querySelectorAll('.g-tabs button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));$('#g-edit').hidden=tab!=='edit';$('#g-preview').hidden=tab!=='preview';if(tab==='preview')$('#g-preview').innerHTML=content.value.trim()?renderGuidanceCards(content.value):'<p class="empty">작성된 내용이 없습니다.</p>';};
  document.querySelectorAll('.g-tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  const busy=v=>{working=v;save.disabled=v;generate.disabled=v;content.disabled=v;};
  generate.onclick=async()=>{if(working)return;if(!$('#guidance-privacy').checked){status.textContent='AI 전송 항목을 확인하고 체크해 주세요.';return;}if(content.value.trim()&&!confirm('현재 편집 내용을 AI 초안으로 교체할까요? 저장하기 전까지는 반영되지 않습니다.'))return;busy(true);generate.classList.add('loading-btn');status.textContent='시험 기록을 바탕으로 초안을 작성하고 있습니다…';try{const r=await api('/instructor/guidance/generate',{method:'POST',body:JSON.stringify({course_id:l.course_id,student_id:l.student_id,privacyChecked:true,prompt_id:$('#guidance-prompt').value||undefined})});content.value=r.content;showTab('preview');status.textContent='AI 초안이 준비되었습니다. 검토·수정한 뒤 확정하세요.';}catch(e){status.textContent=e.message;}finally{busy(false);generate.classList.remove('loading-btn');}};
  save.onclick=async()=>{if(working)return;if(!content.value.trim()){status.textContent='학습 방향을 입력하세요.';return;}busy(true);status.textContent='저장 중입니다…';try{const published=$('#guidance-published').checked,r=await api('/instructor/guidance',{method:'POST',body:JSON.stringify({course_id:l.course_id,student_id:l.student_id,content:content.value,published,revision:l.revision||0})});l.content=content.value;l.published=published;l.revision=r.revision;const [k2,t2]=st(l);$('#g-state').className='g-state g-'+k2;$('#g-state').textContent=t2;drawList();status.textContent=published?'확정했습니다. 학생 화면에 공개됩니다.':'비공개 초안으로 저장했습니다.';}catch(e){status.textContent=e.message;}finally{busy(false);}};
 };
 }catch(e){if(view==='teach-guidance')$('#main').innerHTML=`<section class="panel"><p>${escape(e.message)}</p><button class="secondary" id="guidance-retry">다시 시도</button></section>`;$('#guidance-retry')?.addEventListener('click',renderTeacherGuidance);}
}
async function renderStudentGuidance(){
 shell();startLoading('학습 방향을 불러오고 있습니다…');
 try{const [{guidance},lp]=await Promise.all([api('/student/guidance'),api('/student/learning-path').catch(()=>({paths:[]}))]);if(view!=='guidance')return;
 $('#main').innerHTML=`<section class="intro"><span class="eyebrow">MY NEXT STEP</span><h1>학습 방향 ${AI_MARK}</h1><p>시험 기록을 바탕으로 AI가 분석하고 강사님이 확정한 나만의 학습 방향입니다.</p></section>${guidance.length>1?`<div class="subtabs inline g-course-tabs" role="tablist">${guidance.map((g,i)=>`<button type="button" data-i="${i}" class="${i===0?'selected':''}">${escape(g.course_title)}</button>`).join('')}</div>`:''}<div id="g-student"></div>`;
 const draw=i=>{const g=guidance[i];if(!g){$('#g-student').innerHTML='<section class="panel g-empty"><h2>아직 공개된 학습 방향이 없습니다</h2><p>강사님이 학습 방향을 확정하면 여기에 표시됩니다. 먼저 성적 대시보드에서 복습할 개념을 확인해 보세요.</p><button class="primary" data-view="grades">성적 대시보드</button></section>';bindViews();return;}
  $('#g-student').innerHTML=`<section class="panel g-sheet"><div class="g-sheet-head"><div><span class="eyebrow">${escape(g.course_title)}${escape(coursePeriod(g))}</span><h2>나의 학습 방향</h2></div><div class="g-meta"><span class="g-state g-pub">강사 확정</span><span>${escape(g.instructor_name)} 강사 · ${date(g.updated_at)} 업데이트</span></div></div>${guidanceVisuals(g,(lp.paths||[]).find(p=>p.course_id===g.course_id))}${renderGuidanceCards(g.content)}<div class="g-sheet-foot"><button class="secondary" data-view="path">러닝 패스 보기</button><button class="secondary" data-view="grades">성적 대시보드</button></div></section>`;applyGuidanceVisuals($("#g-student"));bindViews();};
 document.querySelectorAll('.g-course-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.g-course-tabs button').forEach(x=>x.classList.toggle('selected',x===b));draw(Number(b.dataset.i));});
 draw(0);
 }catch(e){if(view==='guidance')$('#main').innerHTML=`<section class="panel"><p>${escape(e.message)}</p><button class="secondary" id="guidance-retry">다시 시도</button></section>`;$('#guidance-retry')?.addEventListener('click',renderStudentGuidance);}
}

// Tiny Markdown preview for instruction documents (headings, bold, lists, paragraphs).
function markdownPreview(md){
 const inline=t=>escape(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`(.+?)`/g,'<code>$1</code>');
 let html='',list='';const close=()=>{if(list){html+=`</${list}>`;list='';}};
 for(const line of String(md||'').split('\n')){
  let m;
  if(m=line.match(/^(#{1,4})\s+(.*)/)){close();const n=Math.min(m[1].length+2,6);html+=`<h${n}>${inline(m[2])}</h${n}>`;}
  else if(m=line.match(/^\s*[-*]\s+(.*)/)){if(list!=='ul'){close();html+='<ul>';list='ul';}html+=`<li>${inline(m[1])}</li>`;}
  else if(m=line.match(/^\s*\d+\.\s+(.*)/)){if(list!=='ol'){close();html+='<ol>';list='ol';}html+=`<li>${inline(m[1])}</li>`;}
  else if(!line.trim())close();
  else{close();html+=`<p>${inline(line)}</p>`;}
 }
 close();return html;
}
function renderPromptPanel(prompts,learners){
 const courses=[...new Map(learners.map(l=>[l.course_id,l])).values()];
 const panel=$('#prompt-panel');
 panel.innerHTML=`<div class="section-heading"><div><h2>지시문 문서 ${AI_MARK}</h2><p>AI가 학습 방향을 쓸 때 따르는 마크다운 지시문입니다. 과정마다 다른 지시문을 등록하고, 작성할 때 골라 적용하세요.</p></div><button class="primary" id="prompt-new">+ 지시문 등록</button></div>
 <div class="table-wrap"><table><thead><tr><th>지시문</th><th>적용 범위</th><th>수정일</th><th></th></tr></thead><tbody>${prompts.map((p,i)=>`<tr><td><strong>${escape(p.title)}</strong>${p.is_default?' <span class="pill">기본</span>':''}<br><small>${escape(p.author_name||'시스템')}</small></td><td>${p.course_id?courseName(p):'모든 과정'}</td><td>${date(p.updated_at)}</td><td><button class="secondary prompt-edit" data-i="${i}">보기·수정</button>${p.is_default?'':` <button class="secondary prompt-delete" data-i="${i}">삭제</button>`}</td></tr>`).join('')}</tbody></table></div><div id="prompt-editor"></div>`;
 const reload=async msg=>{const {prompts:list}=await api('/instructor/guidance/prompts');prompts.splice(0,prompts.length,...list);renderPromptPanel(prompts,learners);if(msg)toast(msg);};
 const open=p=>{
  const ed=$('#prompt-editor');
  ed.innerHTML=`<hr><h3 class="sub-heading">${p.id?'지시문 수정':'새 지시문'}</h3><label for="prompt-title">제목</label><input id="prompt-title" maxlength="120" value="${escape(p.title||'')}"><label for="prompt-course">적용 과정</label><select id="prompt-course"><option value="">모든 과정</option>${courses.map(c=>`<option value="${c.course_id}" ${c.course_id===p.course_id?'selected':''}>${courseName(c)}</option>`).join('')}</select><label for="prompt-file">마크다운 파일 불러오기 (.md)</label><input type="file" id="prompt-file" accept=".md,.markdown,text/markdown,text/plain"><div class="prompt-grid"><div><label for="prompt-content">지시문 (Markdown)</label><textarea id="prompt-content" class="markdown-input" rows="18" maxlength="20000">${escape(p.content||'')}</textarea></div><div><label>미리보기</label><div class="markdown-preview" id="prompt-preview"></div></div></div><div class="quick-actions"><button class="primary" id="prompt-save">지시문 저장</button><button class="secondary" id="prompt-cancel">닫기</button></div><p id="prompt-status" role="status"></p>`;
  const content=$('#prompt-content'),preview=()=>$('#prompt-preview').innerHTML=markdownPreview(content.value);preview();content.oninput=preview;
  if(p.is_default)$('#prompt-course').disabled=true;
  $('#prompt-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;content.value=await f.text();if(!$('#prompt-title').value.trim())$('#prompt-title').value=f.name.replace(/\.(md|markdown|txt)$/i,'');preview();};
  $('#prompt-cancel').onclick=()=>ed.innerHTML='';
  $('#prompt-save').onclick=async()=>{try{await api('/instructor/guidance/prompts',{method:'POST',body:JSON.stringify({id:p.id,title:$('#prompt-title').value,content:content.value,course_id:p.is_default?null:($('#prompt-course').value||null)})});await reload('지시문을 저장했습니다.');}catch(e){$('#prompt-status').textContent=e.message;}};
  ed.scrollIntoView({behavior:'smooth',block:'start'});
 };
 $('#prompt-new').onclick=()=>open({});
 panel.querySelectorAll('.prompt-edit').forEach(b=>b.onclick=()=>open(prompts[b.dataset.i]));
 panel.querySelectorAll('.prompt-delete').forEach(b=>b.onclick=async()=>{const p=prompts[b.dataset.i];if(!confirm(`'${p.title}' 지시문을 삭제할까요?`))return;try{await api('/instructor/guidance/prompts',{method:'POST',body:JSON.stringify({id:p.id,delete:true})});await reload('지시문을 삭제했습니다.');}catch(e){toast(e.message);}});
}

// Visual summary above the guidance cards: benchmark ring, next-exam prediction range, module strengths and a 2-week plan.
// Values come from the learning path (scores, 3rd-year benchmark estimates); no AI call.
function guidanceVisuals(g,path){
 if(!path)return '';
 const s=lpSummarize(path),b=s.bench,taken=s.steps.filter(st=>st.score!=null);
 if(!taken.length)return '';
 const scores=taken.map(st=>st.score),mean=scores.reduce((a,c)=>a+c,0)/scores.length;
 const sd=Math.sqrt(scores.reduce((a,c)=>a+(c-mean)**2,0)/scores.length);
 const next=s.steps.find(st=>st.next)||s.steps.find(st=>st.state==='plan');
 const exp=next?.expected??Math.round(mean),spread=Math.max(5,Math.min(15,Math.round(sd/2+4)));
 const lo=Math.max(0,exp-spread),hi=Math.min(100,exp+spread);
 const ratio=b.target?Math.min(100,Math.round(b.me/b.target*100)):0;
 const R=34,C=2*Math.PI*R,dash=(C*ratio/100).toFixed(1);
 const ring=`<div class="gv-card gv-ring"><span class="gv-label">현업 3년차 기준 달성률</span><div class="gv-ring-wrap"><svg viewBox="0 0 84 84" width="96" height="96" aria-hidden="true"><circle cx="42" cy="42" r="${R}" fill="none" stroke="#eef0f3" stroke-width="9"/><circle cx="42" cy="42" r="${R}" fill="none" stroke="url(#gvg)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${dash} ${C.toFixed(1)}" transform="rotate(-90 42 42)"/><defs><linearGradient id="gvg" x1="0" x2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#f38020"/></linearGradient></defs></svg><strong>${ratio}<small>%</small></strong></div><span class="gv-sub">나 ${b.me}점 / 기준 ${b.target}점 <em>(추정)</em></span></div>`;
 const pred=next?`<div class="gv-card gv-pred"><span class="gv-label">다음 평가 예상 점수 <em class="gv-est">추정</em></span><strong class="gv-big">${lo}~${hi}<small>점</small></strong><span class="gv-sub">${next.week}주차 · ${escape(next.title)}</span><div class="gv-gauge"><span class="gv-band" data-l="${lo}" data-w="${hi-lo}"></span><span class="gv-exp" data-l="${exp}"></span>${next.benchmark!=null?`<span class="gv-bm" data-l="${next.benchmark}" title="3년차 기준 ${next.benchmark}점"></span>`:''}</div><div class="gv-gauge-axis"><span>0</span>${next.benchmark!=null?`<span class="gv-bm-label" data-l="${next.benchmark}">◆ 3년차 ${next.benchmark}</span>`:''}<span>100</span></div></div>`:'';
 const sorted=[...taken].sort((a,c)=>c.score-a.score);
 const bars=`<div class="gv-card gv-mods"><span class="gv-label">주차별 강점·보완</span>${sorted.map(st=>`<div class="gv-mod"><span class="gv-mod-name">${st.week}주차 · ${escape(st.title)}</span><div class="gv-mod-bar"><span class="${st.score>=80?'good':st.score<60?'weak':'mid'}" data-w="${st.score}"></span>${st.benchmark!=null?`<i data-l="${st.benchmark}"></i>`:''}</div><b>${st.score}</b></div>`).join('')}<div class="gv-mod-legend"><span><i class="good"></i>강점 80+</span><span><i class="mid"></i>보통</span><span><i class="weak"></i>보완 60 미만</span><span><i class="bm"></i>3년차 기준</span></div></div>`;
 // 2-week plan from the "plan" section, spread across the next 14 days.
 const plan=parseGuidance(g.content).find(x=>x.kind==='plan');
 const items=(plan?.lines||[]).map(l=>l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/,'').trim()).filter(Boolean).slice(0,6);
 const today=new Date();today.setHours(0,0,0,0);
 const key=`lms.plan.${g.course_id}.${String(g.updated_at).slice(0,10)}`;let done=[];try{done=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
 const tl=items.length?`<div class="gv-card gv-plan" data-key="${escape(key)}"><span class="gv-label">2주 학습 계획 체크리스트</span><div class="gv-tl">${items.map((t,i)=>{const d=new Date(+today+Math.round((i+1)*13/items.length)*864e5);return `<label class="gv-tl-item${done.includes(i)?' done':''}"><input type="checkbox" data-i="${i}" ${done.includes(i)?'checked':''}><span class="gv-tl-date">${d.getMonth()+1}.${String(d.getDate()).padStart(2,'0')}</span><span class="gv-tl-text">${rich(t.replace(/\*\*/g,''))}</span></label>`;}).join('')}</div><div class="gv-plan-progress"><span data-w="${Math.round(done.length*100/items.length)}"></span></div><span class="gv-sub gv-plan-count">${done.length} / ${items.length} 완료 · ${today.getMonth()+1}.${today.getDate()} ~ ${new Date(+today+13*864e5).getMonth()+1}.${new Date(+today+13*864e5).getDate()}</span></div>`:'';
 return `<div class="gv-grid">${ring}${pred}${bars}${tl}</div>`;
}
function applyGuidanceVisuals(root){
 if(!root)return;
 root.querySelectorAll('.gv-grid [data-w]').forEach(el=>el.style.width=el.dataset.w+'%');
 root.querySelectorAll('.gv-grid [data-l]').forEach(el=>el.style.left=el.dataset.l+'%');
 root.querySelectorAll('.gv-plan').forEach(card=>{
  const key=card.dataset.key,boxes=[...card.querySelectorAll('input[type=checkbox]')];
  const sync=()=>{const done=boxes.filter(b=>b.checked).map(b=>Number(b.dataset.i));try{localStorage.setItem(key,JSON.stringify(done));}catch{}
   boxes.forEach(b=>b.closest('.gv-tl-item').classList.toggle('done',b.checked));
   card.querySelector('.gv-plan-progress span').style.width=Math.round(done.length*100/boxes.length)+'%';
   const c=card.querySelector('.gv-plan-count');c.textContent=c.textContent.replace(/^\d+ \/ \d+/,`${done.length} / ${boxes.length}`);};
  boxes.forEach(b=>b.onchange=sync);
 });
}
