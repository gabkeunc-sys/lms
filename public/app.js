const $=s=>document.querySelector(s);
let user=null,mode='login',page=1,search='',view='home';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coursePeriod=x=>{const s=x.course_start||x.start_date,e=x.course_end||x.end_date;if(!s&&!e)return '';const f=d=>d?String(d).slice(0,10).replaceAll('-','.'):'미정';return ` (${f(s)} ~ ${f(e)})`;};
// Marks every AI-powered feature with the same badge.
const AI_MARK='<span class="ai-mark" title="AI 기능" aria-label="AI 기능">AI</span>';
const AI_VIEWS=['ai-settings','ai-usage','teach-grading','teach-bank','teach-guidance','guidance','results'];
const courseName=x=>escape(x.course_title)+escape(coursePeriod(x));
const date=s=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul'}).format(new Date(s));
async function api(path,options={}){
 const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
 let data;try{data=await response.json();}catch{throw new Error('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도하세요.');}
 if(!response.ok){const e=new Error(data.error||'요청을 처리하지 못했습니다.');e.status=response.status;throw e;}return data;
}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,3500);}
const menuLabels={home:'오늘의 학습','learn-wrong':'오답 노트','learn-practice':'연습 모드','learn-feedback':'피드백 상세','learn-badges':'성취·연속 학습','learn-report':'학습 리포트','learn-certs':'수료증',certs:'수료증 발급',assessments:'시험·미니퀴즈',grades:'성적 대시보드',path:'러닝 패스',guidance:'학습 방향',assignments:'과제',profile:'내 정보',password:'비밀번호 변경',dashboard:'운영 현황',schedule:'운영 일정','learn-schedule':'학습 일정',members:'회원 관리','ai-settings':'AI 채점 설정','admin-courses':'과정 개설·배정',risk:'위험 학생',quality:'강사 운영 품질','ai-usage':'AI 사용량·비용',notices:'공지·알림',reports:'보고서 내보내기',activity:'활동 로그','learn-notices':'공지·알림'};
const ICONS={'learn-certs':'M4 4h16v12H4zM8 8h8M8 11h5M14 15l2 2 2-2v6l-2-1-2 1z','teach-certs':'M4 4h16v12H4zM8 8h8M8 11h5M14 15l2 2 2-2v6l-2-1-2 1z',certs:'M4 4h16v12H4zM8 8h8M8 11h5M14 15l2 2 2-2v6l-2-1-2 1z','learn-wrong':'M4 4h12l4 4v12H4zM9 10l6 6M15 10l-6 6','learn-practice':'M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12','learn-feedback':'M4 4h16v12H8l-4 4zM8 9h8M8 12h5','learn-badges':'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M8.5 14l-1.5 7 5-3 5 3-1.5-7','learn-report':'M6 2h9l5 5v15H6zM14 2v6h6M9 17v-3M12 17v-6M15 17v-4','teach-appeals':'M4 4h16v12H8l-4 4zM12 7v4M12 13v.01','teach-plan':'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h3v3H8zM14 14h2','teach-bank':'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6','teach-grading':'M9 11l3 3 8-8M4 6h4M4 12h4M4 18h12','teach-analysis':'M3 3v18h18M7 15l4-4 3 3 5-6','teach-students':'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1','teach-risk':'M12 3l10 18H2zM12 10v5M12 18v.01','admin-courses':'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5M12 7v6M9 10h6',risk:'M12 3l10 18H2zM12 10v5M12 18v.01',quality:'M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.8zM4 21h16','ai-usage':'M4 20V10M9 20V4M14 20v-7M19 20v-12M2 20h20',notices:'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0','teach-notices':'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0','learn-notices':'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',reports:'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6M9 9h2',activity:'M3 12h4l3-8 4 16 3-8h4',schedule:'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M7 14h5M9 17h7','teach-schedule':'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M7 14h5M9 17h7','learn-schedule':'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M7 14h5M9 17h7',dashboard:'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',home:'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',assessments:'M9 4h6M8 3h8v4H8zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8 12h8M8 16h5',grades:'M4 20V10M10 20V4M16 20v-7M22 20H2',path:'M5 6a2 2 0 1 0 0 .01M19 18a2 2 0 1 0 0 .01M7 6h6a3 3 0 0 1 0 6h-2a3 3 0 0 0 0 6h6',guidance:'M12 2l3 7 7 .5-5.5 4.5L18 21l-6-3.8L6 21l1.5-7L2 9.5 9 9z',assignments:'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',members:'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8','ai-settings':'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2','teach-home':'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',courses:'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h8',exams:'M9 4h6M8 3h8v4H8zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8 12h8M8 16h5',results:'M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11','teach-guidance':'M12 2l3 7 7 .5-5.5 4.5L18 21l-6-3.8L6 21l1.5-7L2 9.5 9 9z'};
const navIcon=key=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[key]||ICONS.home}"/></svg>`;
async function loadNavCounts(teaching){
 const set=(key,n)=>{const el=document.querySelector(`[data-count="${key}"]`);if(el){el.textContent=n;el.hidden=!n;}};
 try{
  if(teaching){const {results}=await api('/instructor/results');set('results',results.filter(r=>r.grading_status!=='confirmed').length);}
  else if(user?.role==='student'){const {assessments}=await api('/student/assessments');set('assessments',assessments.filter(a=>!a.result_id).length);}
 }catch{}
}
// URL routing: every screen has its own path, so refresh and back/forward keep the current screen.
const ROUTES={dashboard:'/admin',schedule:'/admin/schedule','teach-schedule':'/teach/schedule','learn-schedule':'/learn/schedule',members:'/admin/members','ai-settings':'/admin/ai-settings','admin-courses':'/admin/courses',risk:'/admin/risk',quality:'/admin/quality','ai-usage':'/admin/ai-usage',notices:'/admin/notices',reports:'/admin/reports',activity:'/admin/activity','teach-notices':'/teach/notices','teach-plan':'/teach/plan','teach-bank':'/teach/bank','teach-grading':'/teach/grading','teach-analysis':'/teach/analysis','teach-students':'/teach/students','teach-risk':'/teach/risk','learn-notices':'/learn/notices','learn-wrong':'/learn/wrong','learn-practice':'/learn/practice','learn-feedback':'/learn/feedback','learn-badges':'/learn/badges','learn-report':'/learn/report','learn-certs':'/learn/certificates','teach-certs':'/teach/certificates',certs:'/admin/certificates','teach-appeals':'/teach/appeals','teach-home':'/teach',courses:'/teach/courses',exams:'/teach/exams',results:'/teach/results','teach-guidance':'/teach/guidance',home:'/learn',assessments:'/learn/assessments',grades:'/learn/grades',path:'/learn/path',guidance:'/learn/guidance',assignments:'/learn/assignments',profile:'/account',password:'/account/password',login:'/login',register:'/register'};
const PATH_VIEWS=Object.fromEntries(Object.entries(ROUTES).map(([k,v])=>[v,k]));
const currentTarget=()=>PATH_VIEWS[location.pathname.replace(/\/+$/,'')]||'';
function navigate(target,{replace=false}={}){const path=ROUTES[target]||'/';if(location.pathname!==path)history[replace?'replaceState':'pushState']({},'',path);routeUser();}
// Older code and links still set location.hash; turn those into path navigation.
window.addEventListener('hashchange',()=>{const target=location.hash.substring(1);if(!target)return;history.replaceState({},'',ROUTES[target]||'/');routeUser();});
window.addEventListener('popstate',()=>routeUser());
// Keep the current screen visible while new data loads instead of blanking the page.
function startLoading(message){const main=$('#main');if(!main.children.length||main.querySelector('.boot-loading')){main.innerHTML=`<div class="loading">${message||'불러오고 있습니다…'}</div>`;return;}main.classList.add('busy');document.body.classList.add('is-loading');}
new MutationObserver(()=>{$('#main')?.classList.remove('busy');document.body.classList.remove('is-loading');}).observe(document.getElementById('main')||document.body,{childList:true});
let navSignature=null;
function bindViews(){document.querySelectorAll('[data-view]').forEach(b=>b.onclick=e=>{e.preventDefault();navigate(b.dataset.view);});}
function routeUser(){
 destroyStudentCharts();
 if(!user){renderPublic();return;}
 const target=currentTarget();
 if(['admin','instructor'].includes(user.role)&&Object.hasOwn(teacherLabels,target)){view=target;return teacherPage();}
 if(user.role==='instructor'&&!Object.hasOwn(menuLabels,target)){view='teach-home';return teacherPage();}
 const learnerOnly=['home','assessments','grades','path','guidance','assignments','learn-schedule','learn-notices','learn-wrong','learn-practice','learn-feedback','learn-badges','learn-report','learn-certs'];
 view=Object.hasOwn(menuLabels,target)&&!(['dashboard','schedule','members','ai-settings','admin-courses','risk','quality','ai-usage','notices','reports','activity','certs'].includes(target)&&user.role!=='admin')&&!(user.role==='admin'&&learnerOnly.includes(target))?target:(user.role==='admin'?'dashboard':'home');
 if(view==='ai-settings'){if(user.role!=='admin'){view='home';return renderHome();}return renderAISettings();}
 if(view==='dashboard')return renderAdminDashboard();
 if(view==='schedule')return renderAdminSchedule();
 if(view==='members')return renderMembers();
 if(view==='admin-courses')return renderAdminCourses();
 if(view==='risk')return renderRisk();
 if(view==='quality')return renderQuality();
 if(view==='ai-usage')return renderAIUsage();
 if(view==='notices'||view==='learn-notices')return renderNotices();
 if(view==='reports')return renderReports();
 if(view==='activity')return renderActivity();
 if(view==='certs')return renderAdminCerts();
 if(view==='home')return user.role==='student'?renderLearnToday():renderHome();
 if(view==='learn-wrong')return renderWrongNotes();
 if(view==='learn-practice')return renderPractice();
 if(view==='learn-feedback')return renderFeedback();
 if(view==='learn-badges')return renderBadges();
 if(view==='learn-report')return renderLearnReport();
 if(view==='learn-certs')return renderLearnCerts();
 if(view==='profile')return renderProfile();
 if(view==='password')return renderPassword();
 if(view==='assessments')return renderAvailableAssessments();
 if(view==='guidance')return renderStudentGuidance();
 if(view==='grades')return renderStudentDashboard();
 if(view==='path')return renderStudentPath();
 if(view==='learn-schedule')return renderSchedule('student');
 renderLearningPage();
}
function shell(){
 document.body.classList.toggle('public-page',!user);document.body.classList.remove('landing-page');
 const teaching=user&&(user.role==='instructor'||(user.role==='admin'&&Object.hasOwn(teacherLabels,view)));
 const groups=teaching?[['teach-home','teach-notices'],['courses','teach-plan','teach-schedule'],['exams','teach-bank','teach-analysis'],['results','teach-grading','teach-guidance'],['teach-students','teach-risk','teach-appeals','teach-certs']]:user?.role==='admin'?[['dashboard','schedule','notices'],['admin-courses','members','risk'],['quality','reports','certs','activity'],['ai-settings','ai-usage']]:[['home','learn-notices'],['assessments','grades','path'],['learn-wrong','learn-practice','learn-feedback'],['guidance','learn-schedule','assignments'],['learn-badges','learn-report','learn-certs']];
 const menus=groups.flat();
 const signature=user?`${user.id}|${user.role}|${teaching}|${menus.join()}`:'public';
 if(signature!==navSignature){navSignature=signature;
 const item=key=>`<button data-view="${key}" title="${teacherLabels[key]||menuLabels[key]}" class="${view===key?'active':''}" ${view===key?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${navIcon(key)}</span><span class="nav-text">${teacherLabels[key]||menuLabels[key]}${AI_VIEWS.includes(key)?AI_MARK:''}</span><span class="nav-count" data-count="${key}" hidden></span></button>`;
 $('#nav').innerHTML=user?groups.map(g=>g.map(item).join('')).join('<hr class="nav-sep">'):'';
 if(user)loadNavCounts(teaching);
 $('#account').innerHTML=user?`${user.role==='admin'?`<button class="secondary" data-view="${teaching?'dashboard':'teach-home'}">${teaching?'관리자 화면':'강사 화면'}</button>`:''}<span class="pill ${user.role==='admin'?'admin':''}">${roleLabel(user.role)}</span><details class="account-menu"><summary>${escape(user.name)} <span aria-hidden="true">⌄</span></summary><div class="account-options"><button data-view="profile">내 정보</button>${['admin','instructor'].includes(user.role)?'<button data-view="teach-home">강사 화면으로 전환</button>':''}${user.role==='admin'?'<button data-view="members">관리자 화면으로 전환</button>':''}<button data-view="password">비밀번호 변경</button><button id="logout">로그아웃</button></div></details>`:'';
 $('#logout')?.addEventListener('click',async()=>{try{await api('/logout',{method:'POST',body:'{}'});user=null;navSignature=null;mode='login';page=1;search='';history.replaceState({},'','/');renderPublic();}catch(e){toast(e.message);}});
 }
 document.querySelectorAll('#nav [data-view],.side-link[data-view]').forEach(b=>{const on=b.dataset.view===view;b.classList.toggle('active',on);on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');});
 if(user&&ROUTES[view]&&location.pathname!==ROUTES[view])history.replaceState({},'',ROUTES[view]);
 if(!user&&!['/login','/register'].includes(location.pathname)&&location.pathname!=='/')history.replaceState({},'','/');
 document.title=(user?(teacherLabels[view]||menuLabels[view])+' · ':'')+'배움길 LMS';
 const label=key=>teacherLabels[key]||menuLabels[key]||'';
 const scope=!user?'배움길':teaching?'강의실':user.role==='admin'?'관리자 콘솔':'학습 공간';
 $('#breadcrumb').innerHTML=`<span class="crumb-scope">${scope}</span><svg class="crumb-sep" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><strong>${user?escape(label(view)):'시작하기'}</strong>`;
 bindViews();
}
function renderAuth(){shell();const signup=mode==='register';$('#main').innerHTML=`<div class="auth-grid"><section class="hero"><span class="eyebrow">YOUR LEARNING JOURNEY</span><h1>배움의 기록이,<br>성장의 방향이 됩니다.</h1><p>한 걸음씩 쌓아 가는 학습.<br>나의 다음 가능성을 배움길에서 시작하세요.</p><div class="path-card"><small>배움길이 향하는 학습 과정</small><div class="path-line"><span>01</span>나의 이해도 확인하기</div><div class="path-line"><span>02</span>부족한 부분 발견하기</div><div class="path-line"><span>03</span>다음 학습 방향 정하기</div></div></section><section class="panel auth-panel"><a class="back-link" href="#">← 처음 화면</a><div class="tabs"><button data-mode="login" class="${!signup?'selected':''}">로그인</button><button data-mode="register" class="${signup?'selected':''}">회원가입</button></div><h2>${signup?'배움길의 첫걸음':'다시 만나 반갑습니다'}</h2><p class="muted">${signup?'학생 계정을 만들고 학습을 준비하세요.':'등록한 계정으로 학습 공간에 접속하세요.'}</p><form id="authform">${signup?'<label for="name">이름</label><input id="name" name="name" autocomplete="name" maxlength="80" required placeholder="이름을 입력하세요">':''}<label for="email">${signup?'이메일':'이메일 또는 아이디'}</label><input id="email" name="email" type="${signup?'email':'text'}" maxlength="254" autocomplete="username" required placeholder="${signup?'name@example.com':'이메일 또는 아이디'}"><label for="password">비밀번호</label><input id="password" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="10" maxlength="128" required placeholder="10자 이상 입력하세요">${signup?'<label for="confirm">비밀번호 확인</label><input id="confirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="비밀번호를 다시 입력하세요">':''}<div id="formerror" class="error" role="alert"></div><button class="primary full" type="submit">${signup?'학생으로 가입하기':'로그인'}</button></form><p class="muted">${signup?'가입 시 이름과 이메일이 강사에게 표시됩니다.':'계정 이용에 문제가 있다면 담당 강사에게 문의하세요.'}</p></section></div>`;
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.mode;}));
 $('#authform').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');$('#formerror').textContent='';if(signup&&$('#password').value!==$('#confirm').value){$('#formerror').textContent='비밀번호가 일치하지 않습니다.';return;}button.disabled=true;try{const result=await api(signup?'/register':'/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});if(signup){mode='login';location.hash='login';renderAuth();toast('가입되었습니다. 이메일과 비밀번호로 로그인하세요.');}else{user=result.user;history.replaceState(null,'',location.pathname+location.search);routeUser();}}catch(err){$('#formerror').textContent=err.message;}finally{button.disabled=false;}});
}
function renderHome(){
 view='home';shell();$('#main').innerHTML=`<section class="intro"><span class="eyebrow">MY LEARNING SPACE</span><h1>${escape(user.name)}님, 안녕하세요.</h1><p>해야 할 학습을 확인하고, 다음 배움을 준비하세요.</p></section>
 <section class="panel todo-panel"><div class="section-heading"><h2>지금 해야 할 학습</h2><span class="pill gray">학습 안내</span></div><p>공개된 시험·미니퀴즈를 확인하고 답안을 제출하세요.</p><div class="quick-actions"><button class="primary" data-view="assessments">시험·미니퀴즈 살펴보기</button><button class="secondary" data-view="assignments">과제 살펴보기</button></div></section>
 <div class="student-grid"><section class="panel"><div class="section-heading"><h2>최근 성적</h2><button class="secondary" data-view="grades">성적·오답</button></div><div class="learning-empty" id="recent-result"><p>성적을 불러오고 있습니다…</p></div></section><section class="panel"><div class="section-heading"><h2>강사 피드백</h2><button class="secondary" data-view="guidance">학습 방향</button></div><div class="learning-empty"><strong>학습 지도 준비 중</strong><p>강사의 피드백과 추천 학습 자료를 이곳에서 확인하도록 준비하고 있습니다.</p></div></section></div>`;bindViews();loadRecentResult();
}
function renderLearningPage(){
 shell();const content={
 assessments:['ASSESSMENTS','주간 시험과 짧은 퀴즈로 학습 내용을 점검합니다.',['예정된 평가','진행 중인 평가','완료한 평가'],'시험·미니퀴즈 기능을 준비하고 있습니다.','응시 일정, 문제 풀이, 제출 후 해설을 이 화면에서 확인하게 됩니다.'],
 grades:['MY RESULTS','평가 결과와 오답을 돌아보며 이해도를 확인합니다.',['주차별 성적','문항별 오답','부족한 개념'],'성적·오답 조회 기능을 준비하고 있습니다.','실제 평가 결과가 연결되면 성적 변화와 복습할 개념을 표시합니다.'],
 guidance:['LEARNING DIRECTION','강사의 피드백으로 다음 학습 방향을 정합니다.',['학습 목표','추천 자료','완료한 학습'],'학습 방향 안내 기능을 준비하고 있습니다.','강사가 제시한 목표와 자료를 확인하고 학습 완료를 기록하게 됩니다.'],
 assignments:['ASSIGNMENTS','실습 결과를 제출하고 강사의 피드백을 확인합니다.',['진행 중인 과제','제출한 과제','피드백'],'과제 제출 기능을 준비하고 있습니다.','과제 안내와 마감일을 확인하고 GitHub·배포 링크를 제출하게 됩니다.']
 }[view];
 $('#main').innerHTML=`<section class="intro"><span class="eyebrow">${content[0]}</span><h1>${menuLabels[view]}</h1><p>${content[1]}</p></section><section class="panel"><div class="learning-categories">${content[2].map(t=>`<span>${t}</span>`).join('')}</div><div class="learning-empty feature-empty"><span class="pill gray">제공 예정</span><h2>${content[3]}</h2><p>${content[4]}</p><button class="secondary" data-view="home">나의 학습 공간으로</button></div></section>`;bindViews();
}
function renderProfile(){
 shell();$('#main').innerHTML=`<section class="intro"><span class="eyebrow">MY ACCOUNT</span><h1>내 정보</h1><p>나의 계정 정보를 확인하세요. 이름과 이메일 수정은 담당 강사에게 요청하세요.</p></section><section class="panel account-panel">${[['이름',user.name],['이메일',user.email],['회원 구분',roleLabel(user.role)],['계정 상태','활성'],['가입일',date(user.created_at)]].map(([k,v])=>`<div class="detail"><span>${k}</span><strong>${escape(v)}</strong></div>`).join('')}<button class="primary" data-view="password">비밀번호 변경</button></section>`;bindViews();
}
function renderPassword(){
 shell();$('#main').innerHTML=`<section class="intro"><span class="eyebrow">ACCOUNT SECURITY</span><h1>비밀번호 변경</h1><p>변경 후 모든 기기에서 로그아웃되며 새 비밀번호로 다시 로그인해야 합니다.</p></section><section class="panel account-panel"><form id="password-form"><label for="current-password">현재 비밀번호</label><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" maxlength="128" required><label for="new-password">새 비밀번호</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="10~128자 입력"><label for="new-confirm">새 비밀번호 확인</label><input id="new-confirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required><div class="error" id="password-error" role="alert"></div><button class="primary" type="submit">비밀번호 변경</button></form></section>`;
 $('#password-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),error=$('#password-error');error.textContent='';if($('#new-password').value!==$('#new-confirm').value){error.textContent='새 비밀번호가 일치하지 않습니다.';return;}button.disabled=true;try{await api('/me/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});user=null;mode='login';location.hash='login';renderAuth();toast('비밀번호를 변경했습니다. 새 비밀번호로 로그인하세요.');}catch(err){error.textContent=err.message;}finally{button.disabled=false;}};
}
let memberRole='',memberStatus='';
const AVATAR_TONES=['#f38020','#e0a100','#3f6fc4','#2f9e6f','#9b59b6','#d6455d'];
function memberAvatar(u){let h=0;for(const ch of u.id)h=(h*31+ch.charCodeAt(0))>>>0;return `<span class="m-avatar" data-tone="${h%AVATAR_TONES.length}">${escape((u.name||'?').trim().slice(0,1))}</span>`;}
function relTime(v){if(!v)return '<span class="muted">기록 없음</span>';const d=(Date.now()-new Date(v))/864e5;return d<1?'오늘':d<2?'어제':d<30?Math.floor(d)+'일 전':date(v);}
async function renderMembers(){view='members';shell();startLoading('회원 목록을 불러오고 있습니다…');try{const data=await api('/admin/users?q='+encodeURIComponent(search)+'&page='+page+'&role='+memberRole+'&status='+memberStatus);const c=data.counts||{};
 const roleTabs=[['','전체',c.total],['student','학생',c.students],['instructor','강사',c.instructors],['admin','관리자',c.admins]];
 const from=data.total?(page-1)*10+1:0,to=Math.min(page*10,data.total),pages=Math.max(1,Math.ceil(data.total/10));
 const actions=u=>{const items=[];
  if(u.role==='student')items.push(`<button type="button" class="edit-user" data-id="${u.id}">정보 수정</button>`,`<button type="button" class="reset-password" data-id="${u.id}">비밀번호 초기화</button>`,`<button type="button" class="role-change" data-id="${u.id}" data-role="instructor">강사로 지정</button>`,`<hr>`,`<button type="button" class="toggle ${u.active?'danger':''}" data-id="${u.id}" data-active="${!u.active}">${u.active?'계정 비활성화':'계정 활성화'}</button>`);
  else if(u.role==='instructor')items.push(`<button type="button" class="role-change" data-id="${u.id}" data-role="student">학생으로 변경</button>`);
  return items.length?`<div class="m-actions">${u.role==='student'?`<button type="button" class="m-btn edit-user" data-id="${u.id}">수정</button>`:''}<details class="m-menu"><summary aria-label="더 보기" title="더 보기">⋯</summary><div class="m-menu-list">${items.join('')}</div></details></div>`:'<span class="muted m-none">—</span>';};
 $('#main').innerHTML=`<section class="intro m-intro"><div><span class="eyebrow">ADMIN CONSOLE</span><h1>회원 관리</h1><p>학생·강사 계정을 등록하고 역할과 이용 상태를 관리합니다.</p></div><button id="addstudent" class="primary">+ 학생 등록</button></section>
 <div class="g-kpis m-kpis"><div class="g-kpi"><span>전체 회원</span><strong>${c.total??data.total}</strong><small>최근 30일 +${c.recent??0}명</small></div><div class="g-kpi"><span>학생</span><strong>${c.students??'-'}</strong><small>수강 가능한 계정</small></div><div class="g-kpi"><span>강사</span><strong>${c.instructors??'-'}</strong><small>과정 담당 계정</small></div><div class="g-kpi"><span>비활성 계정</span><strong>${c.inactive??0}</strong><small>로그인 차단 상태</small></div></div>
 <section class="panel m-panel"><div class="m-toolbar"><form id="searchform" class="m-search"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input aria-label="이름 또는 이메일 검색" id="search" value="${escape(search)}" placeholder="이름 또는 이메일로 검색"></form>
 <div class="m-seg" role="tablist">${roleTabs.map(([k,l,n])=>`<button type="button" data-role-filter="${k}" class="${memberRole===k?'selected':''}">${l}<span>${n??''}</span></button>`).join('')}</div>
 <select id="status-filter" aria-label="상태 필터"><option value="">모든 상태</option><option value="active" ${memberStatus==='active'?'selected':''}>활성</option><option value="inactive" ${memberStatus==='inactive'?'selected':''}>비활성</option></select></div>
 <div class="table-wrap m-table"><table><thead><tr><th>회원</th><th>역할</th><th>상태</th><th class="num">과정</th><th>가입일</th><th>최근 로그인</th><th class="right">관리</th></tr></thead><tbody>${data.users.map(u=>`<tr class="${u.active?'':'m-off'}"><td><div class="m-user">${memberAvatar(u)}<div><strong>${escape(u.name)}</strong><small>${escape(u.email)}</small></div></div></td><td><span class="m-role ${u.role}">${roleLabel(u.role)}</span></td><td><span class="m-status ${u.active?'on':'off'}">${u.active?'활성':'비활성'}</span></td><td class="num">${u.role==='admin'?'<span class="muted">—</span>':`${u.courses}<small>${u.role==='student'?' 수강':' 담당'}</small>`}</td><td><small class="m-date">${date(u.created_at)}</small></td><td><small class="m-date">${relTime(u.last_login)}</small></td><td class="right">${actions(u)}</td></tr>`).join('')||`<tr><td colspan="7"><div class="m-empty"><strong>조건에 맞는 회원이 없습니다</strong><span>검색어나 필터를 바꿔 보세요.</span></div></td></tr>`}</tbody></table></div>
 <div class="m-pager"><span>${data.total?`${from}–${to}`:'0'} / 총 ${data.total}명</span><div><button id="prev" class="secondary" ${page<=1?'disabled':''}>‹ 이전</button><span class="m-page">${page} / ${pages}</span><button id="next" class="secondary" ${page>=pages?'disabled':''}>다음 ›</button></div></div></section>`;
 $('#main').querySelectorAll('.m-avatar').forEach(el=>el.style.background=AVATAR_TONES[el.dataset.tone]);
 $('#main').querySelectorAll('[data-role-filter]').forEach(b=>b.onclick=()=>{memberRole=b.dataset.roleFilter;page=1;renderMembers();});
 $('#status-filter').onchange=e=>{memberStatus=e.target.value;page=1;renderMembers();};
 if(!window.__memberMenus){window.__memberMenus=1;document.addEventListener('click',e=>{document.querySelectorAll('.m-menu[open]').forEach(m=>{if(!m.contains(e.target))m.open=false;});});}
 document.querySelectorAll('.role-change').forEach(b=>b.onclick=async()=>{if(!confirm('회원 권한을 '+roleLabel(b.dataset.role)+'로 변경하시겠습니까? 해당 회원은 다시 로그인해야 합니다.'))return;b.disabled=true;try{await api('/admin/role',{method:'PATCH',body:JSON.stringify({id:b.dataset.id,role:b.dataset.role})});await renderMembers();toast('권한을 변경했습니다.');}catch(e){toast(e.message);b.disabled=false;}});
 $('#addstudent').onclick=()=>openStudentDialog('create'); document.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>openStudentDialog('edit',data.users.find(u=>u.id===b.dataset.id))); document.querySelectorAll('.reset-password').forEach(b=>b.onclick=()=>openStudentDialog('password',data.users.find(u=>u.id===b.dataset.id)));
 $('#searchform').addEventListener('submit',e=>{e.preventDefault();search=$('#search').value.trim();page=1;renderMembers();});$('#prev').onclick=()=>{page--;renderMembers();};$('#next').onclick=()=>{page++;renderMembers();};document.querySelectorAll('.toggle').forEach(b=>b.onclick=async()=>{if(!confirm(`이 학생 계정을 ${b.dataset.active==='true'?'활성화':'비활성화'}하시겠습니까?`))return;b.disabled=true;try{await api('/admin/users/'+b.dataset.id,{method:'PATCH',body:JSON.stringify({active:b.dataset.active==='true'})});await renderMembers();toast('계정 상태를 변경했습니다.');}catch(e){toast(e.message);b.disabled=false;}});
 }catch(e){if(e.status===401){user=null;renderAuth();toast('다시 로그인하세요.');}else{$('#main').innerHTML='<section class="panel"><h2>목록을 불러오지 못했습니다</h2><p>'+escape(e.message)+'</p><button id="retry" class="secondary">다시 시도</button></section>';$('#retry').onclick=renderMembers;}}}
(async()=>{try{user=(await api('/me')).user;routeUser();}catch(e){renderPublic();if(e.status!==401)toast(e.message);}finally{document.body.classList.remove('booting');}})();

function openStudentDialog(action,student={}) {
 const previousFocus=document.activeElement;
 const dialog=document.createElement('dialog');dialog.className='student-dialog';
 const creating=action==='create',reset=action==='password';
 const title=creating?'학생 등록':reset?'비밀번호 초기화':'학생 정보 수정';
 dialog.innerHTML=`<form id="student-editor"><div class="section-heading"><h2 id="dialog-title">${title}</h2><button class="secondary dialog-close" type="button" aria-label="닫기">닫기</button></div><p class="muted">${creating?'등록한 학생은 입력한 이메일과 비밀번호로 로그인할 수 있습니다.':reset?escape(student.name)+' 학생의 새 비밀번호를 설정합니다. 기존 로그인은 모두 해제됩니다.':'이름과 로그인 이메일을 변경합니다. 저장하면 학생은 다시 로그인해야 합니다.'}</p>${!reset?`<label for="edit-name">이름</label><input id="edit-name" name="name" maxlength="80" value="${escape(student.name||'')}" autocomplete="off" required><label for="edit-email">이메일</label><input id="edit-email" name="email" type="email" maxlength="254" value="${escape(student.email||'')}" autocomplete="off" required>`:''}${creating||reset?'<label for="edit-password">새 비밀번호</label><input id="edit-password" name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required placeholder="10~128자"><label for="edit-confirm">비밀번호 확인</label><input id="edit-confirm" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><p class="muted">새 비밀번호는 학생에게 별도로 전달하세요. 이메일은 자동 발송되지 않습니다.</p>':''}<div class="error" id="editor-error" role="alert"></div><div class="dialog-actions"><button type="button" class="secondary dialog-close">취소</button><button class="primary" id="editor-save">${creating?'학생 등록':reset?'비밀번호 변경':'저장'}</button></div></form>`;
 dialog.setAttribute('aria-labelledby','dialog-title');document.body.append(dialog);dialog.showModal();
 let busy=false;
 dialog.querySelectorAll('.dialog-close').forEach(b=>b.onclick=()=>{if(!busy)dialog.close();});
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 dialog.addEventListener('close',()=>{dialog.remove();if(previousFocus?.isConnected)previousFocus.focus();});
 dialog.querySelector('form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const error=dialog.querySelector('#editor-error');error.textContent='';
  const body=Object.fromEntries(new FormData(e.currentTarget));
  if((creating||reset)&&body.password!==dialog.querySelector('#edit-confirm').value){error.textContent='비밀번호가 일치하지 않습니다.';return;}
  busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
  try {
   await api(creating?'/admin/users':'/admin/users/'+student.id+(reset?'/password':''),{method:creating||reset?'POST':'PATCH',body:JSON.stringify(body)});
   dialog.close();if(creating){search='';page=1;}await renderMembers();toast(creating?'학생을 등록했습니다.':reset?'비밀번호를 변경하고 기존 로그인을 해제했습니다.':'학생 정보를 수정했습니다.');
  } catch(err){error.textContent=err.message;}
  finally{busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
 });
}


function renderPublic(){
 if(user)return;
 const target=currentTarget();mode=target==='register'?'register':'login';
 if(target==='login'||target==='register'){renderAuth();return;}
 renderLanding();
}
function renderLanding(){
 shell();document.body.classList.add('landing-page');
 $('#main').innerHTML=`<section class="landing-hero" aria-labelledby="landing-title">
 <span class="eyebrow">LEARNING PATH · 배움길</span>
 <h1 id="landing-title">배움의 기록이,<br><em>성장의 방향</em>이 됩니다.</h1>
 <p class="landing-description">매주의 평가로 이해도를 확인하고,<br>나에게 맞는 학습 방향을 찾아갑니다.</p>
 <div class="landing-actions"><a class="primary" href="#register">회원가입하고 시작하기 <span aria-hidden="true">→</span></a><a class="secondary" href="#login">로그인</a></div>
 <p class="landing-note">시험·미니퀴즈, 주관식 AI 채점, 성적 대시보드, AI 학습 방향 안내를 제공합니다.</p>
 </section>
 <section class="learning-preview" aria-labelledby="preview-title"><div class="preview-heading"><div><span class="eyebrow">한 걸음씩, 나의 속도로</span><h2 id="preview-title">배움길에서 할 수 있는 것</h2></div><span class="upcoming">지금 이용 가능</span></div>
 <div class="learning-steps"><article><span class="step-number">01</span><h3>주간 시험</h3><p>한 주 동안 배운 내용을 점검하고<br>이해도를 확인합니다.</p></article><article><span class="step-number">02</span><h3>미니퀴즈</h3><p>짧은 문제로 핵심 개념을 돌아보고<br>배운 내용을 다집니다.</p></article><article><span class="step-number">03</span><h3>학습 방향 안내</h3><p>평가 기록을 바탕으로 부족한 부분과<br>다음 학습 목표를 찾아갑니다.</p></article></div>
 </section>`;
}




// Collapsible sidebar: icons only when collapsed; the choice is remembered per browser.
(function(){
 const KEY='lms.sidebar.collapsed',btn=document.getElementById('side-toggle');if(!btn)return;
 const apply=on=>{document.body.classList.toggle('side-collapsed',on);btn.setAttribute('aria-expanded',String(!on));const t=on?'사이드 메뉴 펼치기':'사이드 메뉴 접기';btn.setAttribute('aria-label',t);btn.title=t;const txt=btn.querySelector('.nav-text');if(txt)txt.textContent=on?'메뉴 펼치기':'메뉴 접기';window.dispatchEvent(new Event('resize'));};
 let saved=false;try{saved=localStorage.getItem(KEY)==='1';}catch{}
 apply(saved);
 btn.addEventListener('click',()=>{const on=!document.body.classList.contains('side-collapsed');apply(on);try{localStorage.setItem(KEY,on?'1':'0');}catch{}});
})();
