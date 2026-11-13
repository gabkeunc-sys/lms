const $=s=>document.querySelector(s);
let user=null,mode='login',page=1,search='',view='home';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul'}).format(new Date(s));
async function api(path,options={}){
 const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
 let data;try{data=await response.json();}catch{throw new Error('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도하세요.');}
 if(!response.ok){const e=new Error(data.error||'요청을 처리하지 못했습니다.');e.status=response.status;throw e;}return data;
}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,3500);}
const menuLabels={home:'나의 학습 공간',assessments:'시험·미니퀴즈',grades:'성적 대시보드',guidance:'학습 방향',assignments:'과제',profile:'내 정보',password:'비밀번호 변경',members:'회원 관리','ai-settings':'AI 채점 설정'};
function bindViews(){document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{location.hash=b.dataset.view;});}
function routeUser(){
 destroyStudentCharts();
 if(!user){renderPublic();return;}
 const target=location.hash.slice(1);
 if(['admin','instructor'].includes(user.role)&&Object.hasOwn(teacherLabels,target)){view=target;return teacherPage();}
 if(user.role==='instructor'&&!Object.hasOwn(menuLabels,target)){view='teach-home';return teacherPage();}
 view=Object.hasOwn(menuLabels,target)&&!(target==='members'&&user.role!=='admin')?target:(user.role==='admin'?'members':'home');
 if(view==='ai-settings'){if(user.role!=='admin'){view='home';return renderHome();}return renderAISettings();}
 if(view==='members')return renderMembers();
 if(view==='home')return user.role==='student'?renderStudentDashboard():renderHome();
 if(view==='profile')return renderProfile();
 if(view==='password')return renderPassword();
 if(view==='assessments')return renderAvailableAssessments();
 if(view==='guidance')return renderStudentGuidance();
 if(view==='grades')return renderStudentDashboard();
 renderLearningPage();
}
function shell(){
 document.body.classList.toggle('public-page',!user);document.body.classList.remove('landing-page');
 const teaching=user&&(user.role==='instructor'||(user.role==='admin'&&Object.hasOwn(teacherLabels,view)));
 const menus=teaching?['teach-home','courses','exams','results','teach-guidance']:user?.role==='admin'?['members','ai-settings','home','assessments','grades','guidance','assignments']:['home','assessments','grades','guidance','assignments'];
 $('#nav').innerHTML=user?menus.map((key,i)=>`<button data-view="${key}" class="${view===key?'active':''}" ${view===key?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${teacherLabels[key]||menuLabels[key]}</button>`).join(''):'';
 $('#account').innerHTML=user?`${user.role==='admin'?`<button class="secondary" data-view="${teaching?'members':'teach-home'}">${teaching?'관리자 화면':'강사 화면'}</button>`:''}<span class="pill ${user.role==='admin'?'admin':''}">${roleLabel(user.role)}</span><details class="account-menu"><summary>${escape(user.name)} <span aria-hidden="true">⌄</span></summary><div class="account-options"><button data-view="profile">내 정보</button>${['admin','instructor'].includes(user.role)?'<button data-view="teach-home">강사 화면으로 전환</button>':''}${user.role==='admin'?'<button data-view="members">관리자 화면으로 전환</button>':''}<button data-view="password">비밀번호 변경</button><button id="logout">로그아웃</button></div></details>`:'';
 $('#logout')?.addEventListener('click',async()=>{try{await api('/logout',{method:'POST',body:'{}'});user=null;mode='login';page=1;search='';location.hash='';renderPublic();}catch(e){toast(e.message);}});
 bindViews();$('#breadcrumb').textContent='학습 공간 / '+(user?(teacherLabels[view]||menuLabels[view]):'시작하기');
}
function renderAuth(){shell();const signup=mode==='register';$('#main').innerHTML=`<div class="auth-grid"><section class="hero"><span class="eyebrow">YOUR LEARNING JOURNEY</span><h1>배움의 기록이,<br>성장의 방향이 됩니다.</h1><p>한 걸음씩 쌓아 가는 학습.<br>나의 다음 가능성을 배움길에서 시작하세요.</p><div class="path-card"><small>배움길이 향하는 학습 과정</small><div class="path-line"><span>01</span>나의 이해도 확인하기</div><div class="path-line"><span>02</span>부족한 부분 발견하기</div><div class="path-line"><span>03</span>다음 학습 방향 정하기</div></div></section><section class="panel auth-panel"><a class="back-link" href="#">← 처음 화면</a><div class="tabs"><button data-mode="login" class="${!signup?'selected':''}">로그인</button><button data-mode="register" class="${signup?'selected':''}">회원가입</button></div><h2>${signup?'배움길의 첫걸음':'다시 만나 반갑습니다'}</h2><p class="muted">${signup?'학생 계정을 만들고 학습을 준비하세요.':'등록한 계정으로 학습 공간에 접속하세요.'}</p><form id="authform">${signup?'<label for="name">이름</label><input id="name" name="name" autocomplete="name" maxlength="80" required placeholder="이름을 입력하세요">':''}<label for="email">이메일</label><input id="email" name="email" type="email" maxlength="254" autocomplete="username" required placeholder="name@example.com"><label for="password">비밀번호</label><input id="password" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="10" maxlength="128" required placeholder="10자 이상 입력하세요">${signup?'<label for="confirm">비밀번호 확인</label><input id="confirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="비밀번호를 다시 입력하세요">':''}<div id="formerror" class="error" role="alert"></div><button class="primary full" type="submit">${signup?'학생으로 가입하기':'로그인'}</button></form><p class="muted">${signup?'가입 시 이름과 이메일이 강사에게 표시됩니다.':'계정 이용에 문제가 있다면 담당 강사에게 문의하세요.'}</p></section></div>`;
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
async function renderMembers(){view='members';shell();$('#main').innerHTML='<div class="loading">회원 목록을 불러오고 있습니다…</div>';try{const data=await api('/admin/users?q='+encodeURIComponent(search)+'&page='+page);$('#main').innerHTML=`<section class="intro"><span class="eyebrow">INSTRUCTOR WORKSPACE</span><h1>회원 관리</h1><p>학생을 등록하고 계정 정보와 이용 상태를 관리하세요.</p><button id="addstudent" class="primary">+ 학생 등록</button></section><div class="cards"><section class="panel stat"><span class="muted">${search?'검색된 회원':'전체 회원'}</span><div class="value">${data.total}<small> 명</small></div><p>등록된 학습 구성원</p></section><section class="panel stat"><span class="muted">나의 역할</span><div class="value">관리자</div><p>학생 등록 · 정보 수정 · 계정 관리</p></section><section class="panel stat"><span class="muted">운영 단계</span><div class="value">시작하기</div><p>회원가입 · 로그인</p></section></div><section class="panel"><div class="section-heading"><div><h2>회원 목록</h2><p>학생 정보 수정, 비밀번호 초기화, 계정 상태 변경을 할 수 있습니다.</p></div><form id="searchform" class="search"><input aria-label="이름 또는 이메일 검색" id="search" value="${escape(search)}" placeholder="이름 또는 이메일"><button class="secondary">검색</button></form></div><div class="table-wrap"><table><thead><tr><th>이름</th><th>이메일</th><th>구분</th><th>상태</th><th>가입일</th><th>관리</th></tr></thead><tbody>${data.users.map(u=>`<tr><td><strong>${escape(u.name)}</strong></td><td>${escape(u.email)}</td><td>${roleLabel(u.role)}</td><td><span class="pill ${u.active?'':'gray'}">${u.active?'활성':'비활성'}</span></td><td><small>${date(u.created_at)}</small></td><td>${u.role==='student'?`<div class="row-actions"><button class="secondary edit-user" data-id="${u.id}">수정</button><button class="secondary reset-password" data-id="${u.id}">비밀번호 초기화</button><button class="secondary toggle" data-id="${u.id}" data-active="${!u.active}">${u.active?'비활성화':'활성화'}</button></div>`:u.role==='instructor'?`<button class="secondary role-change" data-id="${u.id}" data-role="student">학생으로 변경</button>`:'—'}${u.role==='student'?` <button class="secondary role-change" data-id="${u.id}" data-role="instructor">강사 지정</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">검색 결과가 없습니다.</td></tr>'}</tbody></table></div><div class="pager"><span>페이지당 10명</span><div><button id="prev" class="secondary" ${page<=1?'disabled':''}>이전</button><span>${page} / ${Math.max(1,Math.ceil(data.total/10))}</span><button id="next" class="secondary" ${page*10>=data.total?'disabled':''}>다음</button></div></div></section>`;
 document.querySelectorAll('.role-change').forEach(b=>b.onclick=async()=>{if(!confirm('회원 권한을 '+roleLabel(b.dataset.role)+'로 변경하시겠습니까? 해당 회원은 다시 로그인해야 합니다.'))return;b.disabled=true;try{await api('/admin/role',{method:'PATCH',body:JSON.stringify({id:b.dataset.id,role:b.dataset.role})});await renderMembers();toast('권한을 변경했습니다.');}catch(e){toast(e.message);b.disabled=false;}});
 $('#addstudent').onclick=()=>openStudentDialog('create'); document.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>openStudentDialog('edit',data.users.find(u=>u.id===b.dataset.id))); document.querySelectorAll('.reset-password').forEach(b=>b.onclick=()=>openStudentDialog('password',data.users.find(u=>u.id===b.dataset.id)));
 $('#searchform').addEventListener('submit',e=>{e.preventDefault();search=$('#search').value.trim();page=1;renderMembers();});$('#prev').onclick=()=>{page--;renderMembers();};$('#next').onclick=()=>{page++;renderMembers();};document.querySelectorAll('.toggle').forEach(b=>b.onclick=async()=>{if(!confirm(`이 학생 계정을 ${b.dataset.active==='true'?'활성화':'비활성화'}하시겠습니까?`))return;b.disabled=true;try{await api('/admin/users/'+b.dataset.id,{method:'PATCH',body:JSON.stringify({active:b.dataset.active==='true'})});await renderMembers();toast('계정 상태를 변경했습니다.');}catch(e){toast(e.message);b.disabled=false;}});
 }catch(e){if(e.status===401){user=null;renderAuth();toast('다시 로그인하세요.');}else{$('#main').innerHTML='<section class="panel"><h2>목록을 불러오지 못했습니다</h2><p>'+escape(e.message)+'</p><button id="retry" class="secondary">다시 시도</button></section>';$('#retry').onclick=renderMembers;}}}
(async()=>{try{user=(await api('/me')).user;routeUser();}catch(e){renderPublic();if(e.status!==401)toast(e.message);}})();

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
 mode=location.hash==='#register'?'register':'login';
 if(location.hash==='#login'||location.hash==='#register'){renderAuth();return;}
 renderLanding();
}
window.addEventListener('hashchange',routeUser);
function renderLanding(){
 shell();document.body.classList.add('landing-page');
 $('#main').innerHTML=`<section class="landing-hero" aria-labelledby="landing-title">
 <span class="eyebrow">LEARNING PATH · 배움길</span>
 <h1 id="landing-title">배움의 기록이,<br><em>성장의 방향</em>이 됩니다.</h1>
 <p class="landing-description">매주의 평가로 이해도를 확인하고,<br>나에게 맞는 학습 방향을 찾아갑니다.</p>
 <div class="landing-actions"><a class="primary" href="#register">회원가입하고 시작하기 <span aria-hidden="true">→</span></a><a class="secondary" href="#login">로그인</a></div>
 <p class="landing-note">현재 회원가입과 로그인 서비스를 이용할 수 있습니다.</p>
 </section>
 <section class="learning-preview" aria-labelledby="preview-title"><div class="preview-heading"><div><span class="eyebrow">한 걸음씩, 나의 속도로</span><h2 id="preview-title">배움길에서 이어갈 학습</h2></div><span class="upcoming">제공 예정</span></div>
 <div class="learning-steps"><article><span class="step-number">01</span><h3>주간 시험</h3><p>한 주 동안 배운 내용을 점검하고<br>이해도를 확인합니다.</p></article><article><span class="step-number">02</span><h3>미니퀴즈</h3><p>짧은 문제로 핵심 개념을 돌아보고<br>배운 내용을 다집니다.</p></article><article><span class="step-number">03</span><h3>학습 방향 안내</h3><p>평가 기록을 바탕으로 부족한 부분과<br>다음 학습 목표를 찾아갑니다.</p></article></div>
 </section>`;
}



