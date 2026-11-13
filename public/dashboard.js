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
  const [{results},stats]=await Promise.all([api('/student/results'),api('/student/class-stats').catch(()=>({assessments:[],points:[],concepts:{},types:{}}))]);
  const detailed=await Promise.all(results.map(async r=>{if(r.grading_status!=='confirmed')return r;try{return (await api('/student/results/'+r.id)).result;}catch{return {...r,detailUnavailable:true};}}));
  if(request!==dashboardRequest||view!==expectedView)return;
  const courses=[...new Set(results.map(r=>r.course_title))];
  $('#main').innerHTML=`<section class="intro dashboard-intro"><div><span class="eyebrow">MY LEARNING INSIGHTS</span><h1>${view==='home'?escape(user.name)+'님의 학습 대시보드':'성적 대시보드'}</h1><p>평가 기록을 돌아보고 다음에 공부할 개념을 찾아보세요.</p></div><button class="primary" data-view="assessments">시험·미니퀴즈 보기</button></section><section class="dashboard-toolbar"><div><label for="dashboard-course">과정</label><select id="dashboard-course"><option value="">전체 과정</option>${courses.map(c=>`<option value="${escape(c)}">${escape(c)}</option>`).join('')}</select></div><div><label for="dashboard-kind">평가 유형</label><select id="dashboard-kind"><option value="">시험·미니퀴즈 전체</option><option value="exam">시험</option><option value="quiz">미니퀴즈</option></select></div><p>확정된 성적 기준 · 점수는 100점으로 환산</p></section><div id="dashboard-content"></div>`;
  bindViews();const draw=()=>drawStudentDashboard(detailed.filter(r=>(!$('#dashboard-course').value||r.course_title===$('#dashboard-course').value)&&(!$('#dashboard-kind').value||r.kind===$('#dashboard-kind').value)),stats);
  $('#dashboard-course').onchange=draw;$('#dashboard-kind').onchange=draw;draw();
 }catch(e){if(request!==dashboardRequest||view!==expectedView)return;$('#main').innerHTML=`<section class="panel"><h1>성적을 불러오지 못했습니다</h1><p>${escape(e.message)}</p><button id="dashboard-retry" class="primary">다시 시도</button></section>`;$('#dashboard-retry').onclick=renderStudentDashboard;}
}
// Palette validated with the dataviz validator: me = orange, class = blue (CVD ΔE 25.8, contrast ≥ 3:1).
const DV={me:'#e8710a',meSoft:'rgba(232,113,10,.12)',cls:'#3f6fc4',clsSoft:'rgba(63,111,196,.10)',peer:'rgba(63,111,196,.38)',grid:'#eef0f2',axis:'#7a8088',ink:'#1d1f20',full:'#c2570a',part:'#f4a259',zero:'#dfe2e6',ref:'#d93025'};
function dvDefaults(){
 if(typeof Chart==='undefined'||Chart.__dv)return;Chart.__dv=true;
 Object.assign(Chart.defaults,{color:DV.axis,borderColor:DV.grid});
 Chart.defaults.font.family="Inter,'Pretendard','Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";Chart.defaults.font.size=11;
 Object.assign(Chart.defaults.plugins.tooltip,{backgroundColor:'#fff',titleColor:DV.ink,bodyColor:'#4e5359',borderColor:'#d0d4d9',borderWidth:1,padding:10,cornerRadius:6,boxPadding:4,usePointStyle:true,titleFont:{weight:'700',size:12},bodyFont:{size:12}});
 Chart.defaults.plugins.legend.labels.usePointStyle=true;Chart.defaults.plugins.legend.labels.boxWidth=8;Chart.defaults.plugins.legend.labels.boxHeight=8;
 // Vertical crosshair on hover for line charts.
 Chart.register({id:'dvCrosshair',afterDatasetsDraw(chart){const a=chart.tooltip?.getActiveElements?.();if(chart.config.type!=='line'||!a?.length)return;const x=a[0].element.x,{top,bottom}=chart.chartArea,ctx=chart.ctx;ctx.save();ctx.strokeStyle='#c9cdd1';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();ctx.restore();}});
 // Value labels at the end of horizontal bars (dataset 0) when options.plugins.dvBarLabels is set.
 Chart.register({id:'dvBarLabels',afterDatasetsDraw(chart,_,o){if(!o?.on)return;const meta=chart.getDatasetMeta(0),ctx=chart.ctx;ctx.save();ctx.fillStyle='#4e5359';ctx.font='600 11px '+Chart.defaults.font.family;ctx.textBaseline='middle';meta.data.forEach((bar,i)=>{const v=chart.data.datasets[0].data[i];if(v==null)return;ctx.fillText(Math.round(v)+'%',Math.max(bar.x,chart.chartArea.left)+6,bar.y);});ctx.restore();}});
 // Optional horizontal/vertical reference line: options.plugins.dvRef={axis:'x'|'y',value,label}.
 Chart.register({id:'dvRef',afterDraw(chart,_,o){if(!o||o.value==null)return;const sc=chart.scales[o.axis],{top,bottom,left,right}=chart.chartArea,ctx=chart.ctx,p=sc.getPixelForValue(o.value);ctx.save();ctx.strokeStyle=DV.ref;ctx.globalAlpha=.55;ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();o.axis==='x'?(ctx.moveTo(p,top),ctx.lineTo(p,bottom)):(ctx.moveTo(left,p),ctx.lineTo(right,p));ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);ctx.fillStyle=DV.ref;ctx.font='600 10px '+Chart.defaults.font.family;o.axis==='x'?ctx.fillText(o.label,p+4,top+10):ctx.fillText(o.label,right-ctx.measureText(o.label).width,p-4);ctx.restore();}});
}
function drawStudentDashboard(results,stats={assessments:[],points:[],concepts:{},types:{}}){
 for(const chart of studentCharts)chart.destroy();studentCharts=[];
 const s=summarizeStudentResults(results),num=n=>n==null?'—':n.toFixed(1),weak=s.concepts.filter(c=>c.rate<70),missing=s.confirmed.some(r=>r.detailUnavailable);
 const ids=new Set(results.map(r=>r.assessment_id)),clsBy=new Map(stats.assessments.filter(a=>ids.has(a.assessment_id)).map(a=>[a.assessment_id,a]));
 const clsTrend=s.confirmed.map(r=>clsBy.get(r.assessment_id)?.class_average??null);
 const clsVals=clsTrend.filter(v=>v!=null),clsAvg=clsVals.length?clsVals.reduce((a,b)=>a+b,0)/clsVals.length:null;
 const gap=s.average!=null&&clsAvg!=null?s.average-clsAvg:null;
 // Rank: share of classmates' results the student beats on the same assessments.
 const peers=stats.points.filter(p=>ids.has(p.assessment_id)&&!p.me),mine=new Map(s.confirmed.map((r,i)=>[r.assessment_id,s.rates[i]]));
 const beat=peers.filter(p=>mine.has(p.assessment_id)&&mine.get(p.assessment_id)>=p.percent).length,top=peers.length?Math.max(1,Math.round(100-100*beat/peers.length)):null;
 const delta=(v,unit='점',suffix='')=>v==null?'':`<span class="kpi-delta ${v>0?'up':v<0?'down':'flat'}">${v>0?'▲':v<0?'▼':'■'} ${Math.abs(v).toFixed(1)}${unit}</span>${suffix}`;
 const spark=`<svg class="kpi-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">${s.rates.length>1?`<polyline fill="none" stroke="${DV.me}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="${s.rates.map((v,i)=>`${(i*100/(s.rates.length-1)).toFixed(1)},${(26-v*.24).toFixed(1)}`).join(' ')}"/>`:''}</svg>`;
 const tiles=[
  ['평균 점수',num(s.average),gap==null?`확정 평가 ${s.confirmed.length}건`:delta(gap,'점',' <small>반 평균 대비</small>'),spark],
  ['최근 점수',num(s.latest),s.change==null?'다음 평가부터 변화량 표시':delta(s.change,'점',' <small>직전 평가 대비</small>'),''],
  ['반 내 위치',top==null?'—':`상위 ${top}%`,clsAvg==null?'비교할 반 기록 없음':`<small>반 평균 ${clsAvg.toFixed(1)}점 · 비교 ${peers.length}건</small>`,''],
  ['복습할 개념',String(weak.length),`<small>득점률 70% 미만 · 채점 대기 ${s.pending}건</small>`,'']];
 const card=(title,id,desc,cls='',legend='')=>`<section class="panel chart-panel ${cls}"><div class="chart-head"><div><h2>${title}</h2><p>${desc}</p></div>${legend}</div><div class="chart-frame"><canvas id="${id}" role="img" aria-label="${title}">${desc}</canvas></div></section>`;
 const legend=(items)=>`<div class="chart-legend">${items.map(([c,t,dash])=>`<span><i class="${dash?'dash':''}" data-color="${c}"></i>${t}</span>`).join('')}</div>`;
 $('#dashboard-content').innerHTML=`<div class="dashboard-stats kpi-row">${tiles.map(([k,v,n,x])=>`<section class="panel dashboard-stat kpi"><span class="kpi-label">${k}</span><strong>${v}</strong><div class="kpi-foot">${n}</div>${x}</section>`).join('')}</div>${!s.confirmed.length?'<section class="panel dashboard-empty"><h2>성적이 쌓이면 성장 흐름이 보입니다</h2><p>시험을 제출하고 채점이 확정되면 그래프와 개념별 분석이 표시됩니다.</p></section>':`<div class="dashboard-charts dv-grid">
  ${card('점수 추이','score-trend','응시 순서별 100점 환산 점수와 같은 평가의 반 평균','chart-wide',legend([[DV.me,'나'],[DV.cls,'반 평균',true]]))}
  ${card('개념 숙련도','concept-radar','개념별 득점률 · 나와 반 평균 비교','',legend([[DV.me,'나'],[DV.cls,'반 평균',true]]))}
  ${card('점수 · 소요 시간 분포','score-scatter','평가별 응시 결과 · 반 학생은 익명으로 표시','chart-wide',legend([[DV.me,'나'],[DV.peer,'반 학생']]))}
  ${card('문항 유형별 득점률','question-types',`만점 ${s.full} · 부분 점수 ${s.partial} · 0점 ${s.zero}문항`,'',legend([[DV.me,'나'],[DV.cls,'반 평균']]))}
  ${card('개념별 득점률','concept-rates','낮은 개념부터 최대 10개 · 붉은 점선은 복습 기준 70%','chart-full',legend([[DV.me,'나'],[DV.cls,'반 평균']]))}
 </div>${missing?'<p class="dashboard-notice" role="status">일부 문항 상세를 불러오지 못했습니다. 개념·유형 분석에서 제외되었습니다.</p>':''}<section class="panel review-panel"><div class="section-heading"><div><h2>다음 복습 포인트</h2><p>누적 득점률을 기준으로 추천합니다. 답안을 열어 감점 사유를 확인하세요.</p></div><span class="pill">${weak.length}개 개념</span></div><div class="review-items">${weak.slice(0,4).map(c=>`<button class="review-item" data-result="${c.resultId}"><span><strong>${escape(c.tag)}</strong><small>${c.count}문항 · ${c.earned}/${c.total}점${stats.concepts[c.tag]!=null?` · 반 평균 ${stats.concepts[c.tag].toFixed(0)}%`:''}</small></span><b>${c.rate.toFixed(0)}%<small>답안 확인 →</small></b></button>`).join('')||'<p>현재 확인된 개념은 모두 득점률 70% 이상입니다. 부분 점수 문항의 피드백도 함께 복습하세요.</p>'}</div></section>`}<section class="panel dashboard-history"><div class="section-heading"><h2>평가별 성적과 피드백</h2><span class="pill gray">${results.length}건</span></div><div class="table-wrap"><table><thead><tr><th>평가</th><th>응시일</th><th>점수</th><th>반 평균</th><th>결과</th></tr></thead><tbody>${results.map(r=>`<tr><td><strong>${escape(r.title)}</strong><small class="history-subtitle">${courseName(r)} · ${r.week}주차 · ${r.kind==='quiz'?'미니퀴즈':'시험'}</small></td><td>${date(r.submitted_at)}</td><td><strong>${r.grading_status==='confirmed'?r.score+' / '+r.total:'채점 대기'}</strong></td><td>${clsBy.get(r.assessment_id)?clsBy.get(r.assessment_id).class_average+'점':'-'}</td><td><button class="secondary" data-result="${r.id}">제출 답안·채점 결과</button></td></tr>`).join('')||'<tr><td colspan="5">아직 응시한 평가가 없습니다.</td></tr>'}</tbody></table></div></section>`;
 document.querySelectorAll('.chart-legend i[data-color]').forEach(i=>i.style.setProperty('--c',i.dataset.color));
 document.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>openResult(b.dataset.result,false));
 if(!s.confirmed.length)return;
 if(typeof Chart==='undefined'){$('#dashboard-content').insertAdjacentHTML('afterbegin','<p role="status">차트를 불러오지 못했습니다. 아래 성적표에서 점수를 확인하세요.</p>');return;}
 dvDefaults();
 const motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const chart=(id,type,data,options={})=>{const el=document.getElementById(id);if(!el)return;studentCharts.push(new Chart(el,{type,data,options:{responsive:true,maintainAspectRatio:false,animation:motion?{duration:500}:false,plugins:{legend:{display:false},...(options.plugins||{})},...Object.fromEntries(Object.entries(options).filter(([k])=>k!=='plugins'))}}));};
 const pctAxis={min:0,max:100,ticks:{stepSize:25,callback:v=>v},grid:{color:DV.grid},border:{display:false}};
 const labels=s.confirmed.map(r=>`${r.week}주 ${r.kind==='quiz'?'퀴즈':'시험'}`);
 // 1. Trend: me (solid area) vs class average (dashed).
 const g=document.getElementById('score-trend').getContext('2d'),grad=g.createLinearGradient(0,0,0,260);grad.addColorStop(0,'rgba(232,113,10,.22)');grad.addColorStop(1,'rgba(232,113,10,0)');
 chart('score-trend','line',{labels,datasets:[
  {label:'나',data:s.rates.map(v=>Math.round(v*10)/10),borderColor:DV.me,backgroundColor:grad,fill:true,tension:.35,borderWidth:2,pointRadius:4,pointHoverRadius:6,pointBackgroundColor:'#fff',pointBorderColor:DV.me,pointBorderWidth:2},
  {label:'반 평균',data:clsTrend,borderColor:DV.cls,borderDash:[5,4],borderWidth:2,tension:.35,pointRadius:0,pointHoverRadius:5,pointBackgroundColor:DV.cls,spanGaps:true,fill:false}]},
  {interaction:{mode:'index',intersect:false},scales:{y:pctAxis,x:{grid:{display:false},border:{color:DV.grid},ticks:{maxRotation:0,autoSkipPadding:14}}},plugins:{tooltip:{callbacks:{title:items=>s.confirmed[items[0].dataIndex]?.title||'',label:c=>` ${c.dataset.label}: ${c.parsed.y==null?'-':c.parsed.y+'점'}`}}}});
 // 2. Radar: concept mastery, up to 8 concepts with class data where available.
 const radar=[...s.concepts].sort((a,b)=>b.total-a.total).slice(0,8);
 if(radar.length>=3)chart('concept-radar','radar',{labels:radar.map(c=>c.tag.length>10?c.tag.slice(0,10)+'…':c.tag),datasets:[
  {label:'나',data:radar.map(c=>Math.round(c.rate)),borderColor:DV.me,backgroundColor:DV.meSoft,borderWidth:2,pointRadius:3,pointBackgroundColor:DV.me},
  {label:'반 평균',data:radar.map(c=>stats.concepts[c.tag]??null),borderColor:DV.cls,backgroundColor:DV.clsSoft,borderDash:[5,4],borderWidth:2,pointRadius:2,pointBackgroundColor:DV.cls}]},
  {scales:{r:{min:0,max:100,ticks:{stepSize:25,display:true,backdropColor:'transparent',color:'#a8aeb5',font:{size:9}},grid:{color:DV.grid},angleLines:{color:DV.grid},pointLabels:{color:'#4e5359',font:{size:11,weight:'600'}}}},plugins:{tooltip:{callbacks:{title:items=>radar[items[0].dataIndex].tag,label:c=>` ${c.dataset.label}: ${c.raw==null?'-':c.raw+'%'}`}}}});
 else document.getElementById('concept-radar').closest('.chart-frame').innerHTML='<p class="empty">개념이 3개 이상 쌓이면 레이더 차트가 표시됩니다.</p>';
 // 3. Scatter: score vs time; classmates anonymous, me highlighted.
 const pts=stats.points.filter(p=>ids.has(p.assessment_id)),mePts=pts.filter(p=>p.me).map(p=>({x:p.minutes,y:p.percent,t:p.title})),peerPts=pts.filter(p=>!p.me).map(p=>({x:p.minutes,y:p.percent,t:p.title}));
 chart('score-scatter','scatter',{datasets:[
  {label:'반 학생',data:peerPts,backgroundColor:DV.peer,borderColor:'#fff',borderWidth:1,pointRadius:5,pointHoverRadius:7},
  {label:'나',data:mePts,backgroundColor:DV.me,borderColor:'#fff',borderWidth:2,pointRadius:7,pointHoverRadius:9,pointStyle:'circle'}]},
  {scales:{y:{...pctAxis,title:{display:true,text:'점수 (100점 환산)',color:DV.axis}},x:{min:0,grid:{color:DV.grid},border:{display:false},title:{display:true,text:'소요 시간 (분)',color:DV.axis}}},plugins:{dvRef:{axis:'y',value:clsAvg,label:clsAvg==null?'':`반 평균 ${clsAvg.toFixed(0)}`},tooltip:{callbacks:{title:items=>items[0].raw.t,label:c=>` ${c.dataset.label}: ${c.raw.y}점 · ${c.raw.x}분`}}}});
 // 4. Question types: me vs class.
 const types=Object.entries(s.types).filter(([,t])=>t.total>0);
 chart('question-types','bar',{labels:types.map(([k])=>k==='text'?'주관식':'객관식'),datasets:[
  {label:'나',data:types.map(([,t])=>Math.round(1000*t.earned/t.total)/10),backgroundColor:DV.me,borderRadius:4,borderSkipped:'start',maxBarThickness:34,categoryPercentage:.6,barPercentage:.9},
  {label:'반 평균',data:types.map(([k])=>stats.types[k]??null),backgroundColor:DV.cls,borderRadius:4,borderSkipped:'start',maxBarThickness:34,categoryPercentage:.6,barPercentage:.9}]},
  {scales:{y:pctAxis,x:{grid:{display:false},border:{color:DV.grid}}},plugins:{tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw==null?'-':c.raw+'%'}`}}}});
 // 5. Concept bars with class-average markers and the 70% review line.
 const bars=s.concepts.slice(0,10);
 document.getElementById('concept-rates').closest('.chart-frame').classList.toggle('tall',bars.length>6);
 chart('concept-rates','bar',{labels:bars.map(c=>c.tag.length>16?c.tag.slice(0,16)+'…':c.tag),datasets:[
  {label:'나',data:bars.map(c=>Math.round(c.rate*10)/10),backgroundColor:bars.map(c=>c.rate<70?DV.me:'rgba(232,113,10,.55)'),borderRadius:4,borderSkipped:'start',barThickness:14},
  {type:'scatter',label:'반 평균',data:bars.map((c,i)=>stats.concepts[c.tag]==null?null:{x:stats.concepts[c.tag],y:i}),backgroundColor:DV.cls,borderColor:'#fff',borderWidth:2,pointStyle:'rectRot',pointRadius:6,pointHoverRadius:8}]},
  {indexAxis:'y',scales:{x:{min:0,max:100,grid:{color:DV.grid},border:{display:false},ticks:{callback:v=>v+'%'}},y:{type:'category',grid:{display:false},border:{display:false},ticks:{color:'#4e5359',font:{size:12}}}},plugins:{dvBarLabels:{on:true},dvRef:{axis:'x',value:70,label:'70%'},tooltip:{callbacks:{title:items=>bars[items[0].dataIndex]?.tag||bars[items[0].raw?.y]?.tag||'',label:c=>` ${c.dataset.label}: ${(c.raw?.x??c.raw)}%`}}}});
}
