// Learning path: a horizontal flow of weekly modules joined by smooth arrows.
// Passed steps use solid boxes and arrows; planned steps use dashed ones and fill in as exams are taken.
let lpSeq=0;
const SVGNS='http://www.w3.org/2000/svg';
const lpDate=s=>s?String(s).slice(0,10).replaceAll('-','.'):'';
function lpSummarize(path){
 const confirmed=[];
 const steps=path.steps.map(st=>{
  const visible=st.assessments.filter(a=>a.published||a.taken);
  const taken=visible.filter(a=>a.taken);
  const scores=taken.filter(a=>a.percent!==null).map(a=>a.percent);
  scores.forEach(v=>confirmed.push(v));
  const state=!st.assessments.length?(taken.length?'done':'plan'):taken.length&&taken.length===visible.length&&visible.length===st.assessments.length?'done':taken.length?'progress':'plan';
  const last=taken.map(a=>a.submitted_at).sort().pop()||null;
  return {...st,state,taken,score:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10:null,pending:taken.some(a=>a.status!=='confirmed'),retake:taken.some(a=>a.attempts>1),last};
 });
 // Expected score for planned steps: the average of the last three confirmed scores in this course.
 const recent=confirmed.slice(-3),expected=recent.length?Math.round(recent.reduce((a,b)=>a+b,0)/recent.length):null;
 // Weeks before the latest taken step are already behind the student: weeks without exams count as passed, untaken exams as missed.
 const lastActive=steps.map(st=>st.state!=='plan').lastIndexOf(true);
 steps.forEach((st,i)=>{if(i<lastActive&&st.state==='plan'){if(st.assessments.some(a=>a.published))st.missed=true;else{st.state='done';st.passed=true;}}});
 let nextMarked=false;
 for(const [i,st] of steps.entries()){if(st.state==='done'||i<lastActive)continue;if(!nextMarked&&st.state==='plan'||!nextMarked&&st.state==='progress'){st.next=true;nextMarked=true;}if(st.state==='plan')st.expected=expected;}
 return {steps,expected,done:steps.filter(s=>s.state==='done').length};
}
function renderLearningPath(container,paths,{title=true}={}){
 if(!container)return;
 if(!paths.length){container.innerHTML='<p class="empty">배정된 과정이 없습니다.</p>';return;}
 container.innerHTML=paths.map((p,pi)=>{
  const s=lpSummarize(p);p._s=s;
  const box=(st,i)=>{
   const cls=`lp-step lp-${st.state}${st.next?' lp-next':''}${i%2?' lp-down':''}`;
   const dot=st.state==='done'?(st.pending?'dot-orange':'dot-green'):st.state==='progress'?'dot-orange':st.next?'dot-orange-ring':'dot-gray';
   const value=st.passed?'<span class="lp-expected">평가 없음</span>':st.missed?'<strong class="lp-wait">미응시</strong>':st.state==='plan'?(st.expected!=null?`<span class="lp-expected">예상 ${st.expected}점</span>`:'<span class="lp-expected">예정</span>'):st.score!=null?`<strong>${st.score}점</strong>`:'<strong class="lp-wait">채점 중</strong>';
   const meta=st.passed?'지나온 주차':st.missed?'응시하지 않음':st.state==='plan'?(st.next?'다음 단계':(st.assessments.some(a=>a.published)?'응시 가능':'공개 예정')):st.state==='progress'?`진행 중 · ${lpDate(st.last)}`:lpDate(st.last);
   return `<button type="button" class="${cls}" data-step="${i}">${st.retake?'<span class="lp-retake">재응시</span>':''}<span class="lp-week"><span class="lp-dot ${dot}"></span>${st.week}주차${st.assessments.length?` · 평가 ${st.assessments.length}`:''}</span><span class="lp-title">${escape(st.title)}</span><span class="lp-value">${value}</span><span class="lp-meta">${meta}</span></button>`;
  };
  const allDone=s.steps.length&&s.done===s.steps.length;
  return `<div class="lp-course" data-path="${pi}">${title?`<div class="lp-head"><h3>${courseName(p)}</h3><span class="lp-progress">${s.done} / ${s.steps.length} 단계 완료${s.expected!=null?` · 최근 평균 ${s.expected}점`:''}</span></div>`:''}
  <div class="lp-track"><div class="lp-row"><div class="lp-step lp-cap lp-done" data-cap="start"><span class="lp-week"><span class="lp-dot dot-green"></span>시작</span><span class="lp-title">과정 시작</span><span class="lp-meta">${lpDate(p.course_start)||'일정 미정'}</span></div>${s.steps.map(box).join('')}<div class="lp-step lp-cap ${allDone?'lp-done':'lp-plan'}${s.steps.length%2?'':' lp-down'}" data-cap="end"><span class="lp-week"><span class="lp-dot ${allDone?'dot-green':'dot-gray'}"></span>목표</span><span class="lp-title">과정 수료</span><span class="lp-meta">${lpDate(p.course_end)||'일정 미정'}</span></div></div></div>
  <div class="lp-legend"><span><i class="lp-line solid"></i>지나온 경로</span><span><i class="lp-line dashed"></i>예상 경로</span><span><span class="lp-dot dot-orange-ring"></span>다음 단계</span><span><span class="lp-retake static">재응시</span>다시 응시한 단계</span></div>
  <div class="lp-detail" hidden></div></div>`;
 }).join('');
 container.querySelectorAll('.lp-course').forEach(el=>{
  const p=paths[el.dataset.path];
  lpDraw(el,p._s);
  el.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{
   el.querySelectorAll('.lp-step.selected').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
   const st=p._s.steps[b.dataset.step],d=el.querySelector('.lp-detail');d.hidden=false;
   d.innerHTML=`<div class="section-heading"><div><h4>${st.week}주차 · ${escape(st.title)}</h4>${st.description?`<p>${escape(st.description)}</p>`:''}</div><button type="button" class="secondary lp-close">닫기</button></div>${st.assessments.length?`<div class="table-wrap"><table><thead><tr><th>평가</th><th>상태</th><th>점수</th><th>응시일</th><th>재응시</th></tr></thead><tbody>${st.assessments.map(a=>`<tr><td><strong>${escape(a.title)}</strong><br><small>${a.kind==='exam'?'시험':'미니퀴즈'}</small></td><td><span class="pill ${a.taken?(a.status==='confirmed'?'status-confirmed':'status-review'):'gray'}">${a.taken?(a.status==='confirmed'?'완료':'채점 중'):a.published?'응시 전':'공개 예정'}</span></td><td>${a.percent!=null?a.percent+'점':st.expected!=null&&!a.taken?`<span class="muted">예상 ${st.expected}점</span>`:'-'}</td><td>${a.submitted_at?lpDate(a.submitted_at):a.opens_at?`<span class="muted">${lpDate(a.opens_at)} 공개</span>`:'-'}</td><td>${a.attempts>1?`${a.attempts}회${a.first_percent!=null?` · 첫 점수 ${a.first_percent}점`:''}`:'-'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">이 주차에 연결된 평가가 아직 없습니다.</p>'}`;
   d.querySelector('.lp-close').onclick=()=>{d.hidden=true;b.classList.remove('selected');};
  });
 });
 if(!window.lpResizeBound){window.lpResizeBound=true;let t;window.addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(()=>document.querySelectorAll('.lp-course').forEach(el=>el._redraw?.()),120);});}
}
function lpDraw(el,s){
 const row=el.querySelector('.lp-row');
 const redraw=()=>{
  row.querySelector('svg')?.remove();
  const nodes=[...row.querySelectorAll('.lp-step')];
  const svg=document.createElementNS(SVGNS,'svg');svg.classList.add('lp-svg');
  svg.setAttribute('width',row.scrollWidth);svg.setAttribute('height',row.scrollHeight);
  const id='lp'+(++lpSeq);
  const defs=document.createElementNS(SVGNS,'defs');
  for(const [name,color] of [['solid','#f38020'],['dashed','#a8aeb5']]){
   const m=document.createElementNS(SVGNS,'marker');m.setAttribute('id',`${id}-${name}`);m.setAttribute('viewBox','0 0 10 10');m.setAttribute('refX','9');m.setAttribute('refY','5');m.setAttribute('markerWidth','7');m.setAttribute('markerHeight','7');m.setAttribute('orient','auto-start-reverse');
   const p=document.createElementNS(SVGNS,'path');p.setAttribute('d','M0,0 L10,5 L0,10 z');p.setAttribute('fill',color);m.appendChild(p);defs.appendChild(m);
  }
  svg.appendChild(defs);
  const line=(d,solid)=>{const p=document.createElementNS(SVGNS,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke',solid?'#f38020':'#a8aeb5');p.setAttribute('stroke-width',solid?'2':'1.6');if(!solid)p.setAttribute('stroke-dasharray','6 5');p.setAttribute('stroke-linecap','round');p.setAttribute('marker-end',`url(#${id}-${solid?'solid':'dashed'})`);svg.appendChild(p);};
  for(let i=0;i<nodes.length-1;i++){
   const a=nodes[i],b=nodes[i+1];
   const x1=a.offsetLeft+a.offsetWidth,y1=a.offsetTop+a.offsetHeight/2,x2=b.offsetLeft-3,y2=b.offsetTop+b.offsetHeight/2,dx=Math.max(24,(x2-x1)*.55);
   const solid=b.classList.contains('lp-done')||b.classList.contains('lp-progress');
   line(`M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}`,solid);
  }
  // Retake: a small loop that leaves the top of the box and comes back into it.
  nodes.filter(n=>n.querySelector('.lp-retake')).forEach(n=>{const x=n.offsetLeft,y=n.offsetTop,w=n.offsetWidth;line(`M${x+w*.72},${y} C${x+w*.72},${y-30} ${x+w*.28},${y-30} ${x+w*.28},${y-2}`,true);});
  row.prepend(svg);
  const next=row.querySelector('.lp-next'),track=el.querySelector('.lp-track');if(next&&!el._scrolled){el._scrolled=true;track.scrollLeft=Math.max(0,next.offsetLeft-track.clientWidth/2);}
 };
 el._redraw=redraw;requestAnimationFrame(redraw);
}
// Instructor: weekly module plan for a course. Assessments join the module that has the same week.
async function renderModuleEditor(course){
 startLoading('주차별 모듈을 불러오고 있습니다…');
 try{
  let {modules,assessments}=await api(`/instructor/courses/${course.id}/modules`);
  const rows=modules.map(m=>({...m}));
  const draw=()=>{
   $('#main').innerHTML=`<section class="intro"><span class="eyebrow">CURRICULUM</span><h1>주차별 모듈 설계</h1><p>${escape(course.title)}${escape(coursePeriod(course))} · 전체 학습 과정을 주차별 모듈로 설계하세요. 같은 주차의 시험·미니퀴즈가 모듈에 연결되고, 학생 러닝 패스의 예상 단계로 표시됩니다.</p></section>
   <section class="panel"><div class="table-wrap"><table class="module-table"><thead><tr><th>주차</th><th>모듈 이름</th><th>학습 내용</th><th>연결된 평가</th><th></th></tr></thead><tbody>${rows.map((m,i)=>`<tr><td><input type="number" min="1" max="100" class="mod-week" data-i="${i}" value="${m.week}"></td><td><input class="mod-title" data-i="${i}" maxlength="120" value="${escape(m.title)}" placeholder="예: SQL 기초"></td><td><input class="mod-desc" data-i="${i}" maxlength="1000" value="${escape(m.description||'')}" placeholder="이 주차에 배울 내용"></td><td>${assessments.filter(a=>a.week===Number(m.week)).map(a=>`<span class="pill ${a.published?'':'gray'}">${escape(a.title)}</span>`).join(' ')||'<small class="muted">없음</small>'}</td><td><button type="button" class="secondary mod-remove" data-i="${i}">삭제</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">아직 설계된 모듈이 없습니다. 주차를 추가하세요.</td></tr>'}</tbody></table></div>
   <div class="quick-actions"><button type="button" class="secondary" id="mod-add">+ 주차 추가</button><button type="button" class="primary" id="mod-save">모듈 저장</button><button type="button" class="secondary" id="mod-back">과정 목록</button></div><p id="mod-status" role="status"></p></section>`;
   const sync=()=>document.querySelectorAll('.mod-week').forEach(el=>{const i=el.dataset.i;rows[i].week=Number(el.value);rows[i].title=$(`.mod-title[data-i="${i}"]`).value;rows[i].description=$(`.mod-desc[data-i="${i}"]`).value;});
   document.querySelectorAll('.mod-week').forEach(el=>el.onchange=()=>{sync();draw();});
   document.querySelectorAll('.mod-remove').forEach(b=>b.onclick=()=>{sync();rows.splice(b.dataset.i,1);draw();});
   $('#mod-add').onclick=()=>{sync();rows.push({week:(Math.max(0,...rows.map(r=>r.week))+1),title:'',description:''});draw();$(`.mod-title[data-i="${rows.length-1}"]`)?.focus();};
   $('#mod-back').onclick=()=>navigate('courses');
   $('#mod-save').onclick=async()=>{sync();try{const r=await api(`/instructor/courses/${course.id}/modules`,{method:'POST',body:JSON.stringify({modules:rows.map(r=>({id:r.id,week:r.week,title:r.title,description:r.description}))})});rows.splice(0,rows.length,...r.modules.map(m=>({...m})));assessments=r.assessments;draw();toast('주차별 모듈을 저장했습니다.');}catch(e){$('#mod-status').textContent=e.message;}};
  };
  draw();
 }catch(e){$('#main').innerHTML=`<section class="panel"><p>${escape(e.message)}</p></section>`;}
}
