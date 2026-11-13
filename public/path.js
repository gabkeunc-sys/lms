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
  <div class="lp-legend"><span><i class="lp-line solid"></i>지나온 경로</span><span><i class="lp-line dashed"></i>예측 경로</span><span><span class="lp-dot dot-orange-ring"></span>다음 단계</span><span><span class="lp-retake static">재응시</span>다시 응시한 단계</span></div>
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
  // Small open chevron with round caps; drawn in user space so it stays the same size and follows the path tangent.
  for(const [name,color] of [['solid','#f38020'],['dashed','#a8aeb5']]){
   const m=document.createElementNS(SVGNS,'marker');m.setAttribute('id',`${id}-${name}`);m.setAttribute('viewBox','0 0 12 12');m.setAttribute('refX','10');m.setAttribute('refY','6');m.setAttribute('markerUnits','userSpaceOnUse');m.setAttribute('markerWidth','11');m.setAttribute('markerHeight','11');m.setAttribute('orient','auto');m.setAttribute('overflow','visible');
   const p=document.createElementNS(SVGNS,'path');p.setAttribute('d','M3,2.2 L10,6 L3,9.8');p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width','2');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');m.appendChild(p);defs.appendChild(m);
  }
  svg.appendChild(defs);
  const line=(d,solid)=>{const p=document.createElementNS(SVGNS,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke',solid?'#f38020':'#a8aeb5');p.setAttribute('stroke-width',solid?'2':'1.6');if(!solid)p.setAttribute('stroke-dasharray','5 5');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');p.setAttribute('marker-end',`url(#${id}-${solid?'solid':'dashed'})`);svg.appendChild(p);};
  for(let i=0;i<nodes.length-1;i++){
   const a=nodes[i],b=nodes[i+1];
   const ah=a.offsetHeight,bh=b.offsetHeight,aTop=a.offsetTop,bTop=b.offsetTop;
   // Leave and enter on the side nearer the other box so the vertical drop stays small.
   const down=bTop+bh/2>aTop+ah/2,flat=Math.abs((bTop+bh/2)-(aTop+ah/2))<4;
   const y1=flat?aTop+ah/2:down?aTop+ah*.68:aTop+ah*.32;
   const y2=flat?bTop+bh/2:down?bTop+bh*.32:bTop+bh*.68;
   const x1=a.offsetLeft+a.offsetWidth+2,x2=b.offsetLeft-2,lead=8,span=x2-lead-x1;
   // S-curve: horizontal tangents at both ends, then a short straight lead-in so the arrowhead points straight in.
   const c=span*.5;
   const solid=b.classList.contains('lp-done')||b.classList.contains('lp-progress');
   line(`M${x1},${y1} C${x1+c},${y1} ${x2-lead-c},${y2} ${x2-lead},${y2} L${x2},${y2}`,solid);
  }
  // Retake: a rounded loop that leaves the top edge, arcs over and comes back down into the box.
  nodes.filter(n=>n.querySelector('.lp-retake')).forEach(n=>{const x=n.offsetLeft,y=n.offsetTop,w=n.offsetWidth,r=x+w*.66,l=x+w*.34,h=26;line(`M${r},${y-1} C${r},${y-h} ${l},${y-h} ${l},${y-8} L${l},${y-2}`,true);});
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

// Student menu: 러닝 패스 (/learn/path)
async function renderStudentPath(){
 shell();startLoading('러닝 패스를 불러오고 있습니다…');
 try{const {paths}=await api('/student/learning-path');if(view!=='path')return;
  $('#main').innerHTML=`<section class="intro"><span class="eyebrow">LEARNING PATH</span><h1>러닝 패스 ${AI_MARK}</h1><p>학습자의 학습 경로는 강사님이 설계한 주차별 커리큘럼과 AI의 예측을 바탕으로 최적의 경로를 제시합니다. 실선은 지나온 경로, 점선은 앞으로 나아갈 예측 경로입니다.</p></section>${paths.length>1?`<section class="dashboard-toolbar"><div><label for="path-course">과정</label><select id="path-course"><option value="">전체 과정</option>${paths.map(p=>`<option value="${p.course_id}">${courseName(p)}</option>`).join('')}</select></div></section>`:''}<section class="panel learning-path-panel"><div id="learning-path"></div></section>`;
  const draw=()=>{const c=$('#path-course')?.value;renderLearningPath($('#learning-path'),paths.filter(p=>!c||p.course_id===c));};
  if($('#path-course'))$('#path-course').onchange=draw;draw();
 }catch(e){if(view==='path')$('#main').innerHTML=`<section class="panel"><p>${escape(e.message)}</p></section>`;}
}
