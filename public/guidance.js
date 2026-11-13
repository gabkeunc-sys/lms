async function renderTeacherGuidance(){
 shell();startLoading('학습 지도 목록을 불러오고 있습니다…');
 try{const [{learners},{prompts}]=await Promise.all([api('/instructor/guidance'),api('/instructor/guidance/prompts')]);if(view!=='teach-guidance')return;
 $('#main').innerHTML=`<section class="intro"><span class="eyebrow">LEARNING COACHING</span><h1>학습 방향 지도 ${AI_MARK}</h1><p>학생별 학습 방향을 직접 작성하거나 AI의 도움을 받아 작성하세요.</p></section><section class="panel"><label for="guidance-learner">과정 · 학생 선택</label><select id="guidance-learner"><option value="">학생을 선택하세요</option>${learners.map((l,i)=>`<option value="${i}">${courseName(l)} · ${escape(l.student_name)}</option>`).join('')}</select>${learners.length?'':'<p>담당 과정에 배정된 학생이 없습니다.</p>'}<div id="guidance-editor"></div></section><section class="panel" id="prompt-panel"></section>`;
 renderPromptPanel(prompts,learners);
 $('#guidance-learner').onchange=()=>{const value=$('#guidance-learner').value;if(value===''){$('#guidance-editor').innerHTML='';return;}const l=learners[Number(value)];let working=false;
 $('#guidance-editor').innerHTML=`<div class="section-heading"><h2>${escape(l.student_name)}님의 학습 방향</h2><span class="pill ${l.published?'':'gray'}">${l.published?'학생에게 공개 중':'비공개'}</span></div><div class="guidance-path"><h3 class="sub-heading">러닝 패스</h3><div id="guidance-path"><div class="loading">러닝 패스를 불러오고 있습니다…</div></div></div><p>AI에는 최근 확정된 평가 최대 10건의 주차·점수·문항 유형·개념 태그·득점만 전송합니다. 이름·이메일·답안 원문은 전송하지 않습니다.</p><label class="student-choice"><input type="checkbox" id="guidance-privacy">개념 태그에 개인정보가 없는지 확인했습니다.</label><label for="guidance-prompt">적용할 지시문 ${AI_MARK}</label><select id="guidance-prompt">${prompts.filter(p=>!p.course_id||p.course_id===l.course_id).sort((a,b)=>(b.course_id===l.course_id)-(a.course_id===l.course_id)).map(p=>`<option value="${p.id}">${escape(p.title)}${p.course_id?' · 과정 전용':p.is_default?' · 기본':''}</option>`).join('')}</select><button class="secondary" id="guidance-generate">${AI_MARK} AI로 학습 방향 작성</button><label for="guidance-content">학습 방향 · 강사 의견</label><textarea id="guidance-content" maxlength="8000" rows="16" placeholder="현재 학습 상태, 잘한 점, 보완할 개념, 다음 주 학습 계획을 작성하세요.">${escape(l.content||'')}</textarea><p class="muted">AI 작성 내용도 자유롭게 수정할 수 있습니다. 저장해야 반영됩니다.</p><label class="student-choice"><input id="guidance-published" type="checkbox" ${l.published?'checked':''}>학생에게 공개</label><div class="quick-actions"><button class="primary" id="guidance-save">학습 방향 저장</button></div><p id="guidance-status" role="status"></p>`;
 api('/instructor/learning-path/'+l.student_id).then(r=>renderLearningPath($('#guidance-path'),r.paths.filter(p=>p.course_id===l.course_id),{title:false})).catch(e=>{if($('#guidance-path'))$('#guidance-path').innerHTML=`<p class="empty">${escape(e.message)}</p>`;});
 const status=$('#guidance-status'),content=$('#guidance-content'),save=$('#guidance-save'),generate=$('#guidance-generate');
 const busy=v=>{working=v;save.disabled=v;generate.disabled=v;$('#guidance-learner').disabled=v;content.disabled=v;};
 generate.onclick=async()=>{if(working)return;if(!$('#guidance-privacy').checked){status.textContent='AI 전송 항목을 확인하고 체크해 주세요.';return;}if(content.value.trim()&&!confirm('현재 편집 내용을 AI 작성 결과로 교체할까요? 저장된 내용은 저장 버튼을 누르기 전까지 유지됩니다.'))return;busy(true);status.textContent='성적을 바탕으로 학습 방향을 작성하고 있습니다…';try{const r=await api('/instructor/guidance/generate',{method:'POST',body:JSON.stringify({course_id:l.course_id,student_id:l.student_id,privacyChecked:true,prompt_id:$('#guidance-prompt').value||undefined})});content.value=r.content;status.textContent='AI 작성이 완료되었습니다. 내용을 검토·수정한 뒤 저장하세요.';}catch(e){status.textContent=e.message+' 직접 작성해 저장할 수도 있습니다.';}finally{busy(false);}};
 save.onclick=async()=>{if(working)return;if(!content.value.trim()){status.textContent='학습 방향을 입력하세요.';return;}busy(true);status.textContent='저장 중입니다…';try{const published=$('#guidance-published').checked,r=await api('/instructor/guidance',{method:'POST',body:JSON.stringify({course_id:l.course_id,student_id:l.student_id,content:content.value,published,revision:l.revision||0})});l.content=content.value;l.published=published;l.revision=r.revision;$('#guidance-editor .pill').textContent=published?'학생에게 공개 중':'비공개';status.textContent=published?'저장했습니다. 학생의 학습 방향 화면에서 확인할 수 있습니다.':'비공개로 저장했습니다.';}catch(e){status.textContent=e.message;}finally{busy(false);}};
 };
 }catch(e){if(view==='teach-guidance')$('#main').innerHTML=`<section class="panel"><p>${escape(e.message)}</p><button class="secondary" id="guidance-retry">다시 시도</button></section>`;$('#guidance-retry')?.addEventListener('click',renderTeacherGuidance);}
}
async function renderStudentGuidance(){
 shell();startLoading('학습 방향을 불러오고 있습니다…');
 try{const {guidance}=await api('/student/guidance');if(view!=='guidance')return;
 $('#main').innerHTML=`<section class="intro"><span class="eyebrow">MY NEXT STEP</span><h1>학습 방향</h1><p>강사가 안내한 복습 포인트와 다음 학습 계획을 확인하세요.</p></section>${guidance.map(g=>`<section class="panel guidance-note"><div class="section-heading"><h2>${courseName(g)}</h2><span class="pill">강사 학습 지도</span>${AI_MARK}</div><p class="muted">${escape(g.instructor_name)} · ${date(g.updated_at)} 업데이트</p><div class="guidance-content">${escape(g.content)}</div></section>`).join('')||'<section class="panel"><h2>등록된 학습 방향이 없습니다</h2><p>강사가 학습 방향을 공개하면 여기에 표시됩니다. 성적 대시보드에서 먼저 복습할 개념을 확인하세요.</p><button class="primary" data-view="grades">성적 대시보드</button></section>'}`;bindViews();
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
