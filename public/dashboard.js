let studentCharts=[];
let dashboardRequest=0;
function destroyStudentCharts(){dashboardRequest++;for(const chart of studentCharts)chart.destroy();studentCharts=[];}
function summarizeStudentResults(results){
 const confirmed=results.filter(r=>r.grading_status==='confirmed'&&Number(r.total)>0).sort((a,b)=>new Date(a.submitted_at)-new Date(b.submitted_at));
 const rates=confirmed.map(r=>100*Number(r.score)/Number(r.total));
 const concepts=new Map(),types={choice:{earned:0,total:0,count:0},text:{earned:0,total:0,count:0}};
 let full=0,partial=0,zero=0;
 for(const r of confirmed)for(const [i,q]of (r.questions||[]).entries()){
  const kind=q.type==='text'?'text':'choice',total=Number(q.points);if(!(total>0))continue;
  const earned=kind==='text'?Number(r.grading?.[i]?.score):(r.answers?.[i]===q.answer?total:0);
  if(!Number.isFinite(earned))continue;
  const score=Math.max(0,Math.min(total,earned)),tag=q.tag?.trim()||'미분류';
  const item=concepts.get(tag)||{tag,earned:0,total:0,count:0,resultId:r.id};item.earned+=score;item.total+=total;item.count++;item.resultId=r.id;concepts.set(tag,item);
  types[kind].earned+=score;types[kind].total+=total;types[kind].count++;
  if(score===total)full++;else if(score===0)zero++;else partial++;
 }
 return {confirmed,rates,average:rates.length?rates.reduce((a,b)=>a+b,0)/rates.length:null,latest:rates.at(-1)??null,change:rates.length>1?rates.at(-1)-rates.at(-2):null,pending:results.length-confirmed.length,concepts:[...concepts.values()].map(c=>({...c,rate:100*c.earned/c.total})).sort((a,b)=>a.rate-b.rate),types,full,partial,zero};
}
async function renderStudentDashboard(){
 shell();destroyStudentCharts();const request=dashboardRequest,expectedView=view;
 startLoading('나의 성적을 분석하고 있습니다…');
 try{
  const {results}=await api('/student/results');
  const detailed=await Promise.all(results.map(async r=>{if(r.grading_status!=='confirmed')return r;try{return (await api('/student/results/'+r.id)).result;}catch{return {...r,detailUnavailable:true};}}));
  if(request!==dashboardRequest||view!==expectedView)return;
  const courses=[...new Set(results.map(r=>r.course_title))];
  $('#main').innerHTML=`<section class="intro dashboard-intro"><div><span class="eyebrow">MY LEARNING INSIGHTS</span><h1>${view==='home'?escape(user.name)+'님의 학습 대시보드':'성적 대시보드'}</h1><p>평가 기록을 돌아보고 다음에 공부할 개념을 찾아보세요.</p></div><button class="primary" data-view="assessments">시험·미니퀴즈 보기</button></section><section class="dashboard-toolbar"><div><label for="dashboard-course">과정</label><select id="dashboard-course"><option value="">전체 과정</option>${courses.map(c=>`<option value="${escape(c)}">${escape(c)}</option>`).join('')}</select></div><div><label for="dashboard-kind">평가 유형</label><select id="dashboard-kind"><option value="">시험·미니퀴즈 전체</option><option value="exam">시험</option><option value="quiz">미니퀴즈</option></select></div><p>확정된 성적 기준 · 점수는 100점으로 환산</p></section><div id="dashboard-content"></div>`;
  bindViews();const draw=()=>drawStudentDashboard(detailed.filter(r=>(!$('#dashboard-course').value||r.course_title===$('#dashboard-course').value)&&(!$('#dashboard-kind').value||r.kind===$('#dashboard-kind').value)));
  $('#dashboard-course').onchange=draw;$('#dashboard-kind').onchange=draw;draw();
 }catch(e){if(request!==dashboardRequest||view!==expectedView)return;$('#main').innerHTML=`<section class="panel"><h1>성적을 불러오지 못했습니다</h1><p>${escape(e.message)}</p><button id="dashboard-retry" class="primary">다시 시도</button></section>`;$('#dashboard-retry').onclick=renderStudentDashboard;}
}
function drawStudentDashboard(results){
 for(const chart of studentCharts)chart.destroy();studentCharts=[];
 const s=summarizeStudentResults(results),num=n=>n===null?'—':n.toFixed(1),weak=s.concepts.filter(c=>c.rate<70),missing=s.confirmed.some(r=>r.detailUnavailable);
 const card=(title,id,description,cls='')=>`<section class="panel chart-panel ${cls}"><h2>${title}</h2><p>${description}</p><div class="chart-frame"><canvas id="${id}" role="img" aria-label="${title}">${description}</canvas></div></section>`;
 $('#dashboard-content').innerHTML=`<div class="dashboard-stats">${[['평균 점수',num(s.average),'확정된 평가 '+s.confirmed.length+'건'],['최근 점수',num(s.latest),s.change===null?'다음 평가부터 변화량 표시':`직전 평가 대비 ${s.change>0?'+':''}${s.change.toFixed(1)}점`],['복습할 개념',String(weak.length),'누적 득점률 70% 미만'],['채점 대기',String(s.pending),'확정 후 분석에 반영']].map(([k,v,n])=>`<section class="panel dashboard-stat"><span>${k}</span><strong>${v}</strong><small>${n}</small></section>`).join('')}</div>${!s.confirmed.length?'<section class="panel dashboard-empty"><h2>성적이 쌓이면 성장 흐름이 보입니다</h2><p>시험을 제출하고 채점이 확정되면 그래프와 개념별 분석이 표시됩니다.</p></section>':`<div class="dashboard-charts">${card('나의 점수 추이','score-trend',s.confirmed.length===1?'첫 평가 결과입니다. 다음 평가부터 변화 흐름을 확인하세요.':'응시 순서에 따른 100점 환산 점수','chart-wide')}${card('문항 성취 현황','answer-outcomes',`만점 ${s.full} · 부분 점수 ${s.partial} · 0점 ${s.zero}문항`)}${card('개념별 득점률','concept-rates','득점률이 낮은 개념부터 최대 8개 표시','chart-wide')}${card('객관식·주관식 비교','question-types','유형별 획득 점수 ÷ 유형별 총 배점')}</div>${missing?'<p class="dashboard-notice" role="status">일부 문항 상세를 불러오지 못했습니다. 개념·유형 분석에서 제외되었습니다. 페이지를 다시 열어 확인하세요.</p>':''}<section class="panel review-panel"><div class="section-heading"><div><h2>다음 복습 포인트</h2><p>누적 득점률을 기준으로 추천합니다. 답안을 열어 감점 사유를 확인하세요.</p></div><span class="pill">${weak.length}개 개념</span></div><div class="review-items">${weak.slice(0,4).map(c=>`<button class="review-item" data-result="${c.resultId}"><span><strong>${escape(c.tag)}</strong><small>${c.count}문항 · ${c.earned}/${c.total}점</small></span><b>${c.rate.toFixed(0)}%<small>답안 확인 →</small></b></button>`).join('')||'<p>현재 확인된 개념은 모두 득점률 70% 이상입니다. 부분 점수 문항의 피드백도 함께 복습하세요.</p>'}</div></section>`}<section class="panel dashboard-history"><div class="section-heading"><h2>평가별 성적과 피드백</h2><span class="pill gray">${results.length}건</span></div><div class="table-wrap"><table><thead><tr><th>평가</th><th>응시일</th><th>점수</th><th>결과</th></tr></thead><tbody>${results.map(r=>`<tr><td><strong>${escape(r.title)}</strong><small class="history-subtitle">${escape(r.course_title)} · ${r.week}주차 · ${r.kind==='quiz'?'미니퀴즈':'시험'}</small></td><td>${date(r.submitted_at)}</td><td><strong>${r.grading_status==='confirmed'?r.score+' / '+r.total:'채점 대기'}</strong></td><td><button class="secondary" data-result="${r.id}">제출 답안·채점 결과</button></td></tr>`).join('')||'<tr><td colspan="4">아직 응시한 평가가 없습니다.</td></tr>'}</tbody></table></div></section>`;
 document.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>openResult(b.dataset.result,false));
 if(!s.confirmed.length)return;
 if(typeof Chart==='undefined'){$('#dashboard-content').insertAdjacentHTML('afterbegin','<p role="status">차트를 불러오지 못했습니다. 아래 성적표에서 점수를 확인하세요.</p>');return;}
 const palette={green:'#d35f0b',blue:'#5687c5',amber:'#d8a34b',pale:'#fef4d5',red:'#cf766a'};
 const chart=(id,type,data,extra={})=>{studentCharts.push(new Chart(document.getElementById(id),{type,data,options:{responsive:true,maintainAspectRatio:false,animation:!matchMedia('(prefers-reduced-motion: reduce)').matches,plugins:{legend:{display:false},tooltip:{padding:12,backgroundColor:'#3d2b1f'}},...extra}}));};
 const scales={y:{min:0,max:100,ticks:{stepSize:25},grid:{color:'#edf1f5'},border:{display:false}},x:{grid:{display:false},border:{display:false},ticks:{color:'#718096',maxRotation:0}}};
 chart('score-trend','line',{labels:s.confirmed.map(r=>`${r.week}주차 · ${r.kind==='quiz'?'퀴즈':'시험'}`),datasets:[{label:'환산 점수',data:s.rates,borderColor:palette.green,backgroundColor:'#d35f0b15',fill:true,tension:.25,pointRadius:5,pointHoverRadius:7,pointBackgroundColor:'#fff',pointBorderWidth:3}]},{scales});
 chart('answer-outcomes','doughnut',{labels:['만점','부분 점수','0점'],datasets:[{data:[s.full,s.partial,s.zero],backgroundColor:[palette.green,palette.amber,palette.pale],borderWidth:4,borderColor:'#fff',hoverOffset:5}]},{cutout:'74%',plugins:{legend:{display:true,position:'bottom',labels:{usePointStyle:true,padding:18}},tooltip:{}}});
 const concepts=s.concepts.slice(0,8);chart('concept-rates','bar',{labels:concepts.map(c=>c.tag.length>18?c.tag.slice(0,18)+'…':c.tag),datasets:[{label:'득점률 (%)',data:concepts.map(c=>c.rate),backgroundColor:concepts.map(c=>c.rate<70?palette.amber:palette.green),borderRadius:5,maxBarThickness:24}]},{indexAxis:'y',scales:{x:{min:0,max:100,grid:{color:'#edf1f5'},ticks:{callback:v=>v+'%'}},y:{grid:{display:false},border:{display:false}}}});
 const types=Object.entries(s.types).filter(([,t])=>t.total>0);chart('question-types','bar',{labels:types.map(([k])=>k==='text'?'주관식':'객관식'),datasets:[{label:'득점률 (%)',data:types.map(([,t])=>100*t.earned/t.total),backgroundColor:[palette.green,palette.blue],borderRadius:7,maxBarThickness:58}]},{scales});
}
