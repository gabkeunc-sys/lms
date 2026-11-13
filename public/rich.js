// Rich question text: LaTeX math ($inline$, $$block$$) rendered with KaTeX, and images written as
// ![caption|50%](/api/images/ID). Inputs get a math symbol bar, a live preview and (for instructors) image upload.
function richMath(tex,display){
 if(typeof katex==='undefined')return `<code>${escape(tex)}</code>`;
 try{return katex.renderToString(tex,{displayMode:display,throwOnError:false,strict:'ignore',output:'html'});}catch{return `<code>${escape(tex)}</code>`;}
}
function rich(text){
 const src=String(text??'');
 const re=/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|!\[([^\]]*)\]\((\/api\/images\/[a-f0-9-]{36})\)/g;
 let out='',last=0,m;
 const plain=t=>escape(t).replace(/\n/g,'<br>');
 while((m=re.exec(src))){
  out+=plain(src.slice(last,m.index));last=re.lastIndex;
  if(m[1]!=null||m[2]!=null)out+=`<span class="math-block">${richMath(m[1]??m[2],true)}</span>`;
  else if(m[3]!=null||m[4]!=null)out+=richMath(m[3]??m[4],false);
  else{const [cap,size]=m[5].split('|');const w=/^(\d{2,3})%$/.test(size||'')?Math.min(100,Number(size.slice(0,-1))):null;out+=`<figure class="q-figure"${w?` data-w="${w}"`:''}><img src="${m[6]}" alt="${escape(cap||'문제 이미지')}" loading="lazy">${cap?`<figcaption>${escape(cap)}</figcaption>`:''}</figure>`;}
 }
 return out+plain(src.slice(last));
}
// Image widths come from data-w; applied through the CSSOM.
function applyRichSizes(root=document){root.querySelectorAll('.q-figure[data-w]').forEach(f=>f.style.width=f.dataset.w+'%');}
new MutationObserver(()=>applyRichSizes()).observe(document.documentElement,{childList:true,subtree:true});

const MATH_SNIPPETS=[
 ['수식','$ $','$','$'],['블록 수식','$$ $$','$$','$$'],
 ['a/b','분수','\\frac{a}{b}'],['√','제곱근','\\sqrt{x}'],['ⁿ√','n제곱근','\\sqrt[n]{x}'],['x²','거듭제곱','x^{2}'],['xᵢ','아래첨자','x_{i}'],
 ['Σ','합','\\sum_{i=1}^{n}'],['∫','적분','\\int_{a}^{b} f(x)\\,dx'],['lim','극한','\\lim_{x \\to 0}'],['log','로그','\\log_{a} x'],
 ['±','플러스마이너스','\\pm'],['×','곱하기','\\times'],['÷','나누기','\\div'],['≤','이하','\\le'],['≥','이상','\\ge'],['≠','같지 않음','\\ne'],['≈','근사','\\approx'],
 ['π','파이','\\pi'],['θ','세타','\\theta'],['α','알파','\\alpha'],['∞','무한대','\\infty'],['→','화살표','\\to'],['vec','벡터','\\vec{v}'],['()','괄호','\\left( x \\right)'],['[ ]','행렬','\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}']];
function insertAtCursor(el,text,{wrap}={}){
 const s=el.selectionStart??el.value.length,e=el.selectionEnd??el.value.length,v=el.value;
 let ins=text;
 // Inside math already? insert bare LaTeX; otherwise wrap it in $...$.
 const before=v.slice(0,s),inMath=(before.split('$').length-1)%2===1;
 if(wrap)ins=wrap[0]+(v.slice(s,e)||' ')+wrap[1];
 else if(!inMath)ins='$'+text+'$';
 el.value=v.slice(0,s)+ins+v.slice(e);
 const pos=s+ins.length-(wrap?wrap[1].length:inMath?0:1);
 el.focus();el.setSelectionRange(pos,pos);el.dispatchEvent(new Event('input',{bubbles:true}));
}
async function uploadQuestionImage(file){
 if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw new Error('PNG·JPEG·WebP·GIF 이미지만 올릴 수 있습니다.');
 const bmp=await createImageBitmap(file);
 const scale=Math.min(1,1400/Math.max(bmp.width,bmp.height));
 const c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);
 const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bmp,0,0,c.width,c.height);
 let data='';for(const q of [.9,.8,.7,.55,.4]){data=c.toDataURL('image/webp',q);if(!data.startsWith('data:image/webp'))data=c.toDataURL('image/jpeg',q);if(data.length<560000)break;}
 if(data.length>=580000)throw new Error('이미지가 너무 큽니다. 더 작은 이미지를 사용하세요.');
 return (await api('/instructor/images',{method:'POST',body:JSON.stringify({data})})).url;
}
function enhanceRichInputs(els,{images=false}={}){
 for(const el of els){
  if(!el||el.dataset.rich)continue;el.dataset.rich='1';
  const bar=document.createElement('div');bar.className='rich-bar';
  bar.innerHTML=MATH_SNIPPETS.map(([label,title,tex,end],i)=>`<button type="button" class="rich-btn${i<2?' rich-wrap':''}" data-i="${i}" title="${escape(title)}${end?'':' · '+escape(tex)}">${escape(label)}</button>`).join('')+(images?`<span class="rich-sep"></span><button type="button" class="rich-btn rich-img" title="이미지 넣기 (끌어놓기·붙여넣기도 가능)">🖼 이미지</button><select class="rich-size" title="다음에 넣을 이미지 크기"><option value="">원본 크기</option><option>100%</option><option>75%</option><option selected>50%</option><option>33%</option></select><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>`:'');
  const preview=document.createElement('div');preview.className='rich-preview';preview.setAttribute('aria-live','polite');
  el.before(bar);el.after(preview);
  const draw=()=>{const v=el.value;preview.hidden=!/[$\\]|!\[/.test(v);if(!preview.hidden)preview.innerHTML=`<span class="rich-preview-label">미리보기</span>${rich(v)}`;};
  el.addEventListener('input',draw);draw();
  bar.querySelectorAll('.rich-btn[data-i]').forEach(b=>b.onclick=()=>{const [,,tex,end]=MATH_SNIPPETS[b.dataset.i];end?insertAtCursor(el,'',{wrap:[tex.split(' ')[0],end]}):insertAtCursor(el,tex);});
  if(!images)continue;
  const file=bar.querySelector('input[type=file]'),size=bar.querySelector('.rich-size');
  const add=async f=>{if(!f)return;const note=document.createElement('span');note.className='rich-uploading';note.textContent='이미지 올리는 중…';bar.append(note);try{const url=await uploadQuestionImage(f);const cap=(f.name||'그림').replace(/\.[a-z0-9]+$/i,'').slice(0,40);const token=`\n![${cap}${size.value?'|'+size.value:''}](${url})\n`;const s=el.selectionStart??el.value.length;el.value=el.value.slice(0,s)+token+el.value.slice(el.selectionEnd??s);el.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){toast(e.message);}finally{note.remove();}};
  bar.querySelector('.rich-img').onclick=()=>file.click();
  file.onchange=()=>{add(file.files[0]);file.value='';};
  el.addEventListener('dragover',e=>{if([...e.dataTransfer.items].some(i=>i.kind==='file')){e.preventDefault();el.classList.add('drop-over');}});
  el.addEventListener('dragleave',()=>el.classList.remove('drop-over'));
  el.addEventListener('drop',e=>{const f=[...e.dataTransfer.files].find(f=>f.type.startsWith('image/'));el.classList.remove('drop-over');if(f){e.preventDefault();add(f);}});
  el.addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));if(f){e.preventDefault();add(f);}});
 }
}
