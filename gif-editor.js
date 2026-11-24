/* Parse GIF blocks and let the browser decode each individual image's LZW data. */
(() => {
  'use strict';
  const el = id => document.getElementById('ge' + id);
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), {width:w, height:h});
  const word = (bytes, i) => bytes[i] | bytes[i+1] << 8;
  async function decode(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let pos = 0;
    function take(n) {
      if (pos+n > bytes.length) throw Error('Incomplete GIF');
      const part = bytes.subarray(pos,pos+n);
      pos += n;
      return part;
    }
    function blocks() {
      let n;
      while ((n = take(1)[0])) take(n);
    }
    const header = take(13);
    if (!/^GIF8[79]a$/.test(String.fromCharCode(...header.slice(0,6)))) throw Error('GIF');
    const w = word(header,6), h = word(header,8);
    const paletteSize = flags => flags & 128 ? 3 << ((flags & 7)+1) : 0;
    const global = take(paletteSize(header[10]));
    const surface = canvas(w,h), ctx = surface.getContext('2d');
    const frames = [], delays = [];
    let gce = new Uint8Array(4), loops = null;
    for (;;) {
      const marker = take(1)[0];
      if (marker === 59) break;
      if (marker === 33) {
        const kind = take(1)[0], start = pos;
        blocks();
        if (kind === 249 && bytes[start] === 4) gce = bytes.slice(start+1,start+5);
        if (kind === 255 && String.fromCharCode(...bytes.slice(start+1,start+12)) === 'NETSCAPE2.0') loops = word(bytes,start+14);
        continue;
      }
      if (marker !== 44) throw Error('GIF block');
      const desc = take(9), x = word(desc,0), y = word(desc,2), fw = word(desc,4), fh = word(desc,6);
      const start = pos;
      take(paletteSize(desc[8])); take(1); blocks();
      const localHead = header.slice(), localDesc = desc.slice();
      localHead.set(desc.slice(4,8),6); localDesc.fill(0,0,4);
      const blob = new Blob([localHead,global,Uint8Array.of(33,249,4),gce,Uint8Array.of(0,44),localDesc,bytes.slice(start,pos),Uint8Array.of(59)], {type:'image/gif'});
      const url = URL.createObjectURL(blob), img = new Image();
      const disposal = (gce[0] >> 2) & 7;
      const previous = disposal === 3 ? ctx.getImageData(0,0,w,h) : null;
      const bg = header[11]*3;
      function background(left,top,width,height) {
        if ((gce[0]&1) || bg+2 >= global.length) ctx.clearRect(left,top,width,height);
        else {
          ctx.fillStyle = 'rgb('+global.slice(bg,bg+3).join(',')+')';
          ctx.fillRect(left,top,width,height);
        }
      }
      if (!frames.length) background(0,0,w,h);
      try { img.src = url; await img.decode(); ctx.drawImage(img,x,y); }
      finally { URL.revokeObjectURL(url); }
      const frame = canvas(w,h);
      frame.getContext('2d').drawImage(surface,0,0);
      frames.push(frame); delays.push(word(gce,1)/100);
      if (disposal === 2) background(x,y,fw,fh);
      if (previous) ctx.putImageData(previous,0,0);
      gce = new Uint8Array(4);
    }
    if (!frames.length) throw Error('Empty GIF');
    return {w,h,frames,delays,loops,blob:file};
  }

  let original, current, tool, busy = false, revision = 0;
  const tools = {Resize:'⤢', Crop:'✂', Downsizing:'↘', 'Format Convert':'⇄', Rotate:'↻', Optimize:'⚙', Reverse:'⇆', Speed:'⏱', Cut:'✂', Cover:'▣'};
  const sizeText = blob => blob.size.toLocaleString()+' B';
  const seconds = n => Number(n.toFixed(3))+'초';
  function info(id, entries) {
    el(id).replaceChildren(...entries.map(([key,value]) => {
      const row = document.createElement('div');
      for (const [tag,text] of [['dt',key],['dd',value]]) {
        const node = document.createElement(tag); node.textContent = text; row.append(node);
      }
      return row;
    }));
  }
  function preview(id, blob) {
    const img = el(id);
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob);
  }
  const confirmReplacement = () => history.length <= 1 || window.confirm('지금까지 편집한 결과가 사라져요. 바꿀까요?');
  async function upload(files, dropped = false) {
    const version = ++revision;
    try {
      if (files.length !== 1) throw Error('Single GIF required');
      const data = await decode(files[0]);
      if (version !== revision) return;
      if (dropped && !confirmReplacement()) return;
      for (const step of history.slice(1)) {
        cancelAnimationFrame(step.tick);
        URL.revokeObjectURL(step.url);
      }
      el('Cards').replaceChildren();
      el('Original').open = true;
      
      menu();
      el('Status').textContent = '';
      original = current = data;
      history.length = 0; data.ext = 'gif'; data.label = '원본'; history.push(data);
      preview('Source',data.blob); data.url = el('Source').src; renderHistory();
      const total = data.delays.reduce((a,b)=>a+b,0);
      const varying = data.delays.some(d=>d!==data.delays[0]);
      info('Info',[['파일 이름',data.blob.name],['크기',data.w+' × '+data.h],['용량',sizeText(data.blob)],['장면 수',data.frames.length],['전체 길이',seconds(total)],['한 장당 시간',(varying?'평균 ':'')+seconds(total/data.frames.length)]]);
      el('Name').value = data.blob.name.replace(/\.gif$/i,'')+'_ed.gif';
      el('Error').hidden = el('Upload').hidden = true; el('Work').hidden = false;
    } catch {
      if (version !== revision) return;
      if (original) window.alert('편집할 수 없는 파일이에요. GIF만 올릴 수 있어요.');
      else el('Error').hidden = false;
    }
  }
  el('Replace').onclick = event => {
    event.preventDefault();
    if (!busy && confirmReplacement()) el('File').click();
  };
  el('Pick').onclick = () => el('File').click();
  el('File').onchange = e => { const files = Array.from(e.target.files); e.target.value=''; if(files.length) upload(files); };
  el('Drop').ondragover = e => e.preventDefault();
  el('Drop').ondrop = e => { e.preventDefault(); upload(e.dataTransfer.files); };
  document.addEventListener('drop', event => {
    if (!original || !el('Work').getClientRects().length || !event.dataTransfer.files.length) return;
    event.preventDefault();
    event.stopPropagation();
    if (!busy) upload(event.dataTransfer.files, true);
  }, true);

  function menu() {
    closePreview();
    el('Title').textContent = 'Editor Tools'; el('Form').hidden = true; el('Tools').hidden = false;
    el('Settings').hidden = true;
  }
  const field = (label,id,type,min,max,value,step=1) => '<label class="field">'+label+'<input id="ge'+id+'" type="'+type+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'" required></label>';
  function openTool(name) {
    tool = name; el('Title').textContent = name; el('Status').textContent='';
    el('Tools').hidden = el('Settings').hidden = true; el('Form').hidden = false;
    const {w,h,frames} = current, n = frames.length;
    const settings = {
      Resize:field('가로 (X)','X','range',Math.max(1,Math.round(w*.05)),w*3,w)+'<output id="geXSize"></output><button class="btn" type="button" id="geLock" aria-label="비율 잠금" aria-pressed="true">🔒</button>'+field('세로 (Y)','Y','range',Math.max(1,Math.round(h*.05)),h*3,h)+'<output id="geYSize"></output>',
      Crop: choices('Ratio',['1:1','4:3','16:9','9:16']) + choices('Fit',['단색으로 채우기','확대해서 꽉 채우기'])+'<label class="field" id="geColorLabel">채우기 색<input id="geColor" type="color" value="#ffffff"></label>',
      Downsizing:['크기 줄이기','장면 줄이기','해상도 낮추기'].map((label,i)=>'<label><input type="checkbox" id="geReduce'+i+'" '+(i===0?'checked':'')+'> '+label+'</label>').join('')+'<output id="geEstimate"></output>',
      'Format Convert':choices('Format',['MP4','JPG']),
      Rotate:choices('Angle',['90°','180°','270°','좌우 뒤집기','상하 뒤집기']),
      Optimize:'<output id="geEstimate"></output>',
      Reverse:choices('Reverse',['거꾸로만','갔다가 돌아오기'])+'<canvas id="geReversePreview" aria-label="재생 방향 미리보기"></canvas>',
      Cover:'<strong id="geCoverLabel"></strong><canvas id="geCoverImage" aria-labelledby="geCoverLabel"></canvas><div id="geCoverStrip" role="group" aria-label="표지 장면 선택"></div><button type="button" class="btn" id="geCoverDownload">표지 사진 받기</button>',
      Speed:field('재생 속도','Speed','range',0.25,4,1,0.05)+'<output id="geRate"></output><div class="chips">'+[0.5,1,2].map(v=>'<button type="button" class="btn small" data-rate="'+v+'">'+v+'배</button>').join('')+'</div>',
      Cut:'<div id="geStrip"><div id="geThumbs"></div><div id="geSelection"></div>'+['Start','End'].map((id,i)=>'<input aria-label="'+(i?'마지막':'첫')+' 장면" id="ge'+id+'" type="range" min="1" max="'+n+'" value="'+(i?n:1)+'">').join('')+'</div><output id="geRange"></output>'    };
    el('Fields').innerHTML = settings[name];
    setupFields(name);
    openPreview();
    if (name !== 'Resize') return;
    function sync(axis) {
      if (el('Lock').getAttribute('aria-pressed')==='true') el(axis==='X'?'Y':'X').value = Math.round(num(axis)*(axis==='X'?h/w:w/h));
    }
    for (const axis of ['X','Y']) el(axis).oninput = () => sync(axis);
    el('Lock').onclick = () => {
      const locked = el('Lock').getAttribute('aria-pressed') !== 'true';
      el('Lock').setAttribute('aria-pressed',locked); el('Lock').textContent = locked?'🔒':'🔓';
      sync('X');
    };
  }
  const num = id => Number(el(id).value);
  for (const [name,icon] of Object.entries(tools)) {
    const button = document.createElement('button'); button.className='tool-btn';
    button.innerHTML='<span class="tool-ic" aria-hidden="true">'+icon+'</span>'+name;
    button.onclick=()=>openTool(name); el('Tools').append(button);
  }
  el('Back').onclick = menu;
  const history = [];
  const titles = {Resize:'Resized',Crop:'Cropped',Downsizing:'Downsized','Format Convert':'Converted',Rotate:'Rotated',Optimize:'Optimized',Reverse:'Reversed',Speed:'Speed',Cut:'Cut',Cover:'Cover'};
  function choices(id,options) {
    return '<div class="chips">'+options.map((v,i)=>'<label class="ge-choice"><input type="radio" name="ge'+id+'" value="'+v+'" '+(i?'':'checked')+'><span>'+v+'</span></label>').join('')+'</div>';
  }
  const choice = id => el('Fields').querySelector('input[name="ge'+id+'"]:checked').value;
  const checked = i => el('Reduce'+i).checked;

  function setupFields(name) {
    const fields=el('Fields');
    fields.oninput=null; fields.onclick=null; 
    if(name==='Cover') setupCover();
    if(name==='Crop') fields.oninput=()=>{el('ColorLabel').hidden=choice('Fit')!=='단색으로 채우기';};
    if(name==='Speed'){
      fields.oninput=()=>el('Rate').textContent=num('Speed')+'배';
      fields.onclick=e=>{if(e.target.dataset.rate){el('Speed').value=e.target.dataset.rate;fields.oninput();}};
      fields.oninput();
    }
    if(name==='Cut'){
      const n=current.frames.length;
      for(let i=0;i<Math.min(12,n);i++){
        const thumb=canvas(60,48);
        thumb.getContext('2d').drawImage(current.frames[Math.floor(i*n/Math.min(12,n))],0,0,60,48);
        el('Thumbs').append(thumb);
      }
      fields.oninput=e=>{
        if(num('Start')>num('End')) el(e?.target===el('Start')?'End':'Start').value=e.target.value;
        el('Range').textContent=num('Start')+' ~ '+num('End')+'장 / '+n+'장';
        el('Selection').style.left=(num('Start')-1)/n*100+'%';
        el('Selection').style.right=(n-num('End'))/n*100+'%';
      };
      fields.oninput();
    }
  }
  function drawCoverFrame(target,frame,limit){
    const scale=Math.min(1,limit/Math.max(frame.width,frame.height));
    target.width=Math.max(1,Math.round(frame.width*scale));
    target.height=Math.max(1,Math.round(frame.height*scale));
    target.getContext('2d').drawImage(frame,0,0,target.width,target.height);
  }
  function jpegFrame(frame){
    const photo=canvas(frame.width,frame.height),ctx=photo.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,photo.width,photo.height);ctx.drawImage(frame,0,0);
    return new Promise((resolve,reject)=>photo.toBlob(blob=>blob?resolve(blob):reject(Error('표지 사진을 만들지 못했어요.')),'image/jpeg',0.95));
  }
  function setupCover(){
    const frames=current.frames,strip=el('CoverStrip');
    frames.forEach((frame,i)=>{
      const label=document.createElement('label'),radio=document.createElement('input');
      radio.type='radio';radio.name='geCover';radio.value=i;radio.checked=i===0;
      radio.setAttribute('aria-label',(i+1)+'번 장면');
      const thumb=document.createElement('canvas');drawCoverFrame(thumb,frame,72);
      label.append(radio,thumb);strip.append(label);
    });
    function select(){
      const i=Number(choice('Cover'));
      el('CoverLabel').textContent='표지 '+(i+1)+'번 장면';
      drawCoverFrame(el('CoverImage'),frames[i],480);
    }
    strip.oninput=select;select();
    el('CoverDownload').onclick=async()=>{
      const name=original.blob.name.replace(/\.gif$/i,'')+'_cover.jpg';
      try{
        const blob=await jpegFrame(frames[Number(choice('Cover'))]);
        const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;
        link.click();setTimeout(()=>URL.revokeObjectURL(link.href),60000);
      }catch(err){el('Status').textContent=err.message;}
    };
  }
  function renderHistory(){
    el('History').replaceChildren();
    if (history.length < 2) return;
    history.forEach((step,i)=>{
      const button=document.createElement('button');
      button.type='button';button.textContent=step.label;
      button.setAttribute('aria-current',String(step===current));
      const future=i>history.indexOf(current);
      button.className='chip'+(step===current?' on':'')+(future?' ge-future':'');
      if(step.card)step.card.classList.toggle('ge-future',future);
      button.onclick=()=>{
        if(busy)return;
        current=step;menu();renderHistory();syncName();
        el('Original').open=step===original;el('Status').textContent='';
      };
      if(i)el('History').append(' → ');
      el('History').append(button);
    });
  }
  function syncName(){el('Name').value=el('Name').value.replace(/\.[^.]+$/,'')+'.'+current.ext;}
  function pixels(frame){return frame.getContext('2d').getImageData(0,0,frame.width,frame.height);}
  function editPlan(){
    const base=current, action=tool;
    let {w,h,loops}=base, frames=[...base.frames], delays=[...base.delays];
    let angle=0,flipX=false,flipY=false,cover=false,color=null,low=false;
    if(action==='Resize'){w=num('X');h=num('Y');}
    if(action==='Crop'){
      const [a,b]=choice('Ratio').split(':').map(Number);
      const unit=Math.max(1,Math.round(Math.min(w/a,h/b)));
      w=a*unit;h=b*unit;cover=choice('Fit')==='확대해서 꽉 채우기';color=el('Color').value;
    }
    if(action==='Rotate'){
      const rot=choice('Angle');angle=parseInt(rot)||0;
      flipX=rot==='좌우 뒤집기';flipY=rot==='상하 뒤집기';
      if(angle%180)[w,h]=[h,w];
    }
    if(action==='Downsizing'){
      if(checked(0)){w=Math.max(1,Math.round(w*.75));h=Math.max(1,Math.round(h*.75));}
      if(checked(1)){
        frames=frames.filter((_,i)=>i%2===0);
        delays=delays.flatMap((d,i)=>i%2?[]:[d+(delays[i+1]||0)]);
      }
      low=checked(2);
    }
    if(w>65535||h>65535)throw Error('GIF 크기 범위를 초과했어요.');
    const transformed=w!==base.w||h!==base.h||angle||flipX||flipY||color||low;
    function paint(frame,out){
      const ctx=out.getContext('2d');
      ctx.save();ctx.clearRect(0,0,out.width,out.height);ctx.scale(out.width/w,out.height/h);
      if(color){
          const scale=(cover?Math.max:Math.min)(w/base.w,h/base.h);
          if(!cover){ctx.fillStyle=color;ctx.fillRect(0,0,w,h);}
          const fw=base.w*scale,fh=base.h*scale;ctx.drawImage(frame,(w-fw)/2,(h-fh)/2,fw,fh);
        }else if(low){
          const small=canvas(Math.max(1,Math.round(out.width/2)),Math.max(1,Math.round(out.height/2)));
          small.getContext('2d').drawImage(frame,0,0,small.width,small.height);
          ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,w,h);
        }else if(angle||flipX||flipY){
          ctx.translate(w/2,h/2);ctx.rotate(angle*Math.PI/180);ctx.scale(flipX?-1:1,flipY?-1:1);
          ctx.drawImage(frame,-base.w/2,-base.h/2);
        }else ctx.drawImage(frame,0,0,w,h);
      ctx.restore();
    }
    if(action==='Reverse'){
      if(choice('Reverse')==='거꾸로만'){frames.reverse();delays.reverse();}
      else {
        frames=frames.concat(frames.slice(1,-1).reverse());
        delays=delays.concat(delays.slice(1,-1).reverse());
      }
    }
    if(action==='Cover'){
      const start=Number(choice('Cover'));
      frames=frames.slice(start).concat(frames.slice(0,start));
      delays=delays.slice(start).concat(delays.slice(0,start));
    }
    if(action==='Speed')delays=delays.map(d=>Math.max(0.02,Math.min(655.35,Math.round(d*100/num('Speed'))/100)));
    if(action==='Cut'){
      frames=frames.slice(num('Start')-1,num('End'));delays=delays.slice(num('Start')-1,num('End'));
    }
    return {base,action,w,h,loops,frames,delays,paint,transformed,cover,low};
  }
  let draft=null, previewTimer=0, previewTick=0, previewVersion=0;
  let layoutTick=0, dragPointer=null, previewStart=0;
  function closePreview(){
    cancelAnimationFrame(layoutTick);layoutTick=0;dragPointer=null;
    clearTimeout(previewTimer);
    cancelAnimationFrame(previewTick);
    previewVersion++;
    draft?.remove();draft=null;
  }
  function openPreview(){
    closePreview();
    draft=document.createElement('section');draft.className='panel ge-draft';
    draft.innerHTML='<h2>미리보기</h2><div class="ge-pair"><div>현재 GIF<div class="ge-view"><canvas></canvas><i hidden></i></div></div><div>설정 적용 후<div class="ge-view"><canvas></canvas></div></div></div><p class="ge-receipt"></p>';
    el('Cards').prepend(draft);
    previewStart=performance.now();
    if(tool==='Resize'){
      draft.classList.add('ge-resizing');
      const label=document.createElement('span');
      label.className='ge-size-label';
      draft.querySelector('.ge-view').append(label);
      resizeLayout();
    }
    refreshPreview();
  }
  function resizeLayout(){
    const w=num('X'),h=num('Y'),fit=Math.max(current.w,current.h,w,h);
    const [left,right]=draft.querySelectorAll('canvas');
    const outline=draft.querySelector('i'),label=draft.querySelector('.ge-size-label');
    left.style.width=100*current.w/fit+'%';left.style.height=100*current.h/fit+'%';
    right.style.width=outline.style.width=100*w/fit+'%';
    right.style.height=outline.style.height=100*h/fit+'%';
    label.style.top='max(0px, calc('+((1-h/fit)*50)+'% - 1.6rem))';
    label.textContent='바뀔 크기 '+w+'×'+h;
    el('XSize').textContent=w+' px';el('YSize').textContent=h+' px';
  }
  el('Fields').addEventListener('pointerdown',event=>{
    if(tool!=='Resize'||!event.target.matches('input[type=range]'))return;
    clearTimeout(previewTimer);dragPointer=event.pointerId;
    event.target.setPointerCapture(event.pointerId);
  });
  el('Fields').addEventListener('lostpointercapture',event=>{
    if(dragPointer!==event.pointerId)return;
    dragPointer=null;queuePreview();
  });
  function queuePreview(){
    if(!draft)return;
    clearTimeout(previewTimer);previewVersion++;
    if(tool==='Resize'){
      if(!layoutTick)layoutTick=requestAnimationFrame(()=>{layoutTick=0;resizeLayout();});
      if(dragPointer!==null||draft.dataset.size===num('X')+'x'+num('Y'))return;
    }
    previewTimer=setTimeout(refreshPreview,100);
  }
  el('Fields').addEventListener('input',queuePreview);
  el('Fields').addEventListener('click',event=>{if(event.target.closest('button'))queuePreview();});
  const approx=n=>'약 '+(n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':Math.round(n)+' B');
  function refreshPreview(){
    if(!draft)return;
    cancelAnimationFrame(previewTick);
    const version=++previewVersion,receipt=draft.querySelector('.ge-receipt');
    let plan;
    try{plan=editPlan();}catch(error){receipt.textContent=error.message;return;}
    const {base,w,h}=plan;
    const [left,right]=draft.querySelectorAll('canvas'),outline=draft.querySelector('i');
    const resize=tool==='Resize',crop=tool==='Crop';
    const size=(screen,width,height)=>{
      const scale=Math.min(1,240/Math.max(width,height));
      screen.width=Math.max(1,Math.round(width*scale));screen.height=Math.max(1,Math.round(height*scale));
      const fit=resize?Math.max(base.w,w,base.h,h):Math.max(width,height);
      screen.style.width=100*width/fit+'%';screen.style.height=100*height/fit+'%';
    };
    if(!resize||!draft.dataset.size)size(left,base.w,base.h);
    size(right,w,h);
    if(resize)draft.dataset.size=w+'x'+h;
    outline.hidden=!(resize||crop);
    if(!outline.hidden){
      const frameScale=crop?(plan.cover?Math.max(w/base.w,h/base.h):Math.min(w/base.w,h/base.h)):1;
      outline.style.width=parseFloat(left.style.width)*Math.min(crop?1:Infinity,w/(frameScale*base.w))+'%';
      outline.style.height=parseFloat(left.style.height)*Math.min(crop?1:Infinity,h/(frameScale*base.h))+'%';
    }
    const tracks=[timing(base),timing(plan)], start=resize?previewStart:performance.now();
    const mini=tool==='Reverse'?el('ReversePreview'):null;
    if(mini){mini.width=right.width;mini.height=right.height;}
    let prevLeft=-1,prevRight=-1;
    function animate(now){
      const indices=tracks.map(t=>{
        const position=t.duration?((now-start)/1000)%t.duration:0;
        const i=t.ends.findIndex(end=>end>position);
        return i<0?t.ends.length-1:i;
      });
      if(indices[0]!==prevLeft){
        const ctx=left.getContext('2d');ctx.clearRect(0,0,left.width,left.height);
        ctx.drawImage(base.frames[indices[0]],0,0,left.width,left.height);prevLeft=indices[0];
      }
      if(indices[1]!==prevRight){
        plan.paint(plan.frames[indices[1]],right);prevRight=indices[1];
        if(mini){const ctx=mini.getContext('2d');ctx.clearRect(0,0,mini.width,mini.height);ctx.drawImage(right,0,0);}
      }
      previewTick=requestAnimationFrame(animate);
    }
    animate(performance.now());
    const format=tool==='Format Convert'?(choice('Format')==='JPG'?'JPG (ZIP)':window.MediaRecorder?.isTypeSupported('video/mp4')?'MP4':'WEBM'):'GIF';
    const compression=tool==='Optimize'||tool==='Downsizing';
    const empty=tool==='Downsizing'&&![0,1,2].some(checked);
    function describe(bytes){
      if(version!==previewVersion)return;
      const sizes=approx(base.blob.size)+' → '+approx(bytes);
      receipt.textContent=(format==='GIF'?'':format+' / ')+base.w+'×'+base.h+' → '+w+'×'+h+' / '+sizes+' / 길이 '+seconds(tracks[0].duration)+' → '+seconds(tracks[1].duration);
      if(compression){
        const percent=(1-bytes/base.blob.size)*100;
        const summary=document.createElement('strong');
        summary.textContent=empty?'줄일 방법을 선택해 주세요.':sizes+' · '+Math.abs(percent).toFixed(1)+'% '+(percent>=0?'줄임':'증가');
        receipt.prepend(summary);el('Estimate').textContent=summary.textContent;
      }
    }
    const area=w*h/(base.w*base.h), fraction=plan.frames.length/base.frames.length;
    const rough=Math.max(1,base.blob.size*area*fraction*(plan.low ? 0.65 : 1));
    describe(rough);
    // Sample a single small frame; video recording and ZIP creation are export-only.
    const sample=canvas(right.width,right.height);
    plan.paint(plan.frames[Math.floor(plan.frames.length/2)],sample);
    if(format!=='GIF'){
      sample.toBlob(blob=>{
        if(!blob)return;
        const jpeg=blob.size*w*h/(sample.width*sample.height);
        describe(format==='JPG (ZIP)'?(jpeg+120)*plan.frames.length:Math.max(1024,jpeg*(1+tracks[1].duration*2)));
      },'image/jpeg',.95);
    }else if(compression&&!empty){
      GifEncoder.encode({width:sample.width,height:sample.height,count:1,transparent:true,delays:[.1],getFrame:()=>pixels(sample)}).then(bytes=>{
        const projected=32+Math.max(1,bytes.length-32)*w*h/(sample.width*sample.height)*plan.frames.length;
        describe(tool==='Optimize'?Math.min(projected,base.blob.size):projected);
      }).catch(()=>{});
    }
  }
  async function makeGif(){
    const {base,action,w,h,loops,frames:inputs,delays,paint,transformed}=editPlan();
    const frames=transformed?inputs.map(frame=>{const out=canvas(w,h);paint(frame,out);return out;}):inputs;
    const bytes=await GifEncoder.encode({width:w,height:h,loops,delays,count:frames.length,transparent:true,getFrame:i=>pixels(frames[i])});
    const blob=new Blob([bytes],{type:'image/gif'});
    if(action==='Optimize' && base.ext==='gif' && blob.size>=base.blob.size)
      return {w,h,frames,delays,loops,blob:base.blob,ext:'gif'};
    const decoded=await decode(blob);
    if(action==='Optimize' && base.ext==='gif'){
      const changed=frames.some((f,i)=>{const before=pixels(f).data, after=pixels(decoded.frames[i]).data;return before.some((v,j)=>v!==after[j]);});
      if(changed)return {w,h,frames,delays,loops,blob:base.blob,ext:'gif'};
    }
    return {...decoded,ext:'gif'};
  }
  async function convert(){
    const {frames,w,h,delays,loops}=current;
    const result={frames,w,h,delays,loops};
    if(choice('Format')==='JPG'){
      const files=[];
      for(const [i,frame] of frames.entries()){
        const jpg=await jpegFrame(frame);
        files.push({name:'frame-'+String(i+1).padStart(4,'0')+'.jpg',data:new Uint8Array(await jpg.arrayBuffer())});
      }
      return {...result,blob:await Zip.zip(files),ext:'zip'};
    }
    if(!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)throw Error('이 브라우저는 동영상을 만들 수 없어요.');
    const surface=canvas(w,h),ctx=surface.getContext('2d');
    const stream=surface.captureStream(60);
    try {
      for(const ext of ['mp4','webm']){
        const mimeType='video/'+ext;
        if(!MediaRecorder.isTypeSupported(mimeType))continue;
        let recorder;
        try{recorder=new MediaRecorder(stream,{mimeType});recorder.start();}catch{continue;}
        const chunks=[];
        const done=new Promise((resolve,reject)=>{
          recorder.ondataavailable=e=>chunks.push(e.data);
          recorder.onstop=()=>resolve(new Blob(chunks,{type:mimeType}));
          recorder.onerror=e=>reject(e.error||Error('동영상 변환 실패'));
        });
        const playback=async()=>{
          for(let i=0;i<frames.length;i++){
            if(recorder.state!=='recording')break;
            ctx.clearRect(0,0,w,h);ctx.drawImage(frames[i],0,0);
            await new Promise(r=>setTimeout(r,Math.max(20,delays[i]*1000)));
          }
          if(recorder.state==='recording')recorder.stop();
        };
        try {
          const [blob]=await Promise.all([done,playback()]);
          if(blob.size)return {...result,blob,ext};
        } catch(error) {
          if(ext==='webm')throw error;
        } finally {
          if(recorder.state==='recording')recorder.stop();
        }
      }
      throw Error('이 브라우저는 MP4와 WEBM 출력을 지원하지 않아요.');
    } finally {stream.getTracks().forEach(track=>track.stop());}
  }
  function timing(data){
    let duration=0;
    const ends=data.delays.map(d=>duration+=d);
    return {ends,duration};
  }
  function displayFrame(ctx,data,time,elapsed){
    const position = time.duration ? elapsed % time.duration : 0;
    const index = elapsed === 0 ? 0 : time.ends.findIndex(end=>end>position);
    ctx.clearRect(0,0,data.w,data.h);ctx.drawImage(data.frames[index<0?data.frames.length-1:index],0,0);
  }
  function compare(section,result){
    section.hidden=!section.hidden;
    if(section.hidden){cancelAnimationFrame(result.tick);return;}
    section.replaceChildren();
    const pair=document.createElement('div');pair.className='ge-pair';section.append(pair);
    const tracks=[original,result].map((data,i)=>{
      const label=document.createElement('div'),screen=canvas(data.w,data.h);
      label.append(i?'편집 결과':'원본',screen);pair.append(label);
      return {ctx:screen.getContext('2d'),data,time:timing(data)};
    });
    const delta=100*(1-result.blob.size/original.blob.size);
    const receipt=document.createElement('p');receipt.className='ge-receipt';
    const receiptSize = blob => blob.size < 1024 ? sizeText(blob) : (blob.size/1024).toFixed(1)+' KB';
    const [before,after] = tracks.map(t=>t.time.duration);
    const rate = before>0 && after>0 && original.frames.length===result.frames.length
      ? Number((before/after).toFixed(2)) : 1;
    const speed = rate===1 ? '' : ' · '+rate+'배'+(rate>1?' 빠름':' 속도');
    receipt.textContent=receiptSize(original.blob)+' → '+receiptSize(result.blob)+' · '+Math.abs(delta).toFixed(1)+'% '+(delta>=0?'줄임':'증가')+' / '+original.w+'×'+original.h+' → '+result.w+'×'+result.h+' / '+original.frames.length+'장 → '+result.frames.length+'장 / 길이 '+seconds(before)+' → '+seconds(after)+speed;
    section.append(receipt);
    const start=performance.now();
    function draw(now){
      const elapsed=(now-start)/1000;
      tracks.forEach(t=>displayFrame(t.ctx,t.data,t.time,elapsed));result.tick=requestAnimationFrame(draw);
    }
    draw(start);
  }
  function addCard(result){
    const prefix=tool==='Reverse'&&choice('Reverse')==='갔다가 돌아오기'?'Boomerang':titles[tool];
    const stem=original.blob.name.replace(/\.gif$/i,'');
    const card=document.createElement('section');card.className='panel';
    const heading=document.createElement('h2');heading.textContent=prefix+' '+(result.ext==='zip'?'JPG (ZIP)':result.ext.toUpperCase());
    let media;
    if(result.ext==='gif'){media=new Image();media.src=result.url;media.alt=heading.textContent;}
    else if(result.ext==='zip'){media=canvas(result.w,result.h);media.getContext('2d').drawImage(result.frames[0],0,0);}
    else{media=document.createElement('video');media.controls=true;media.playsInline=true;media.src=result.url;}
    media.className='ge-preview';
    const stats=document.createElement('p');stats.textContent=result.w+' × '+result.h+' · '+sizeText(result.blob)+' · '+result.frames.length+'장';
    const link=document.createElement('a');link.className='btn primary';link.href=result.url;link.download=prefix+'_'+stem+'.'+result.ext;link.textContent='받기';
    const toggle=document.createElement('button');toggle.className='btn';toggle.textContent='원본과 비교';
    const section=document.createElement('div');section.hidden=true;toggle.onclick=()=>compare(section,result);
    card.append(heading,media,stats,link,' ',toggle,section);
    el('Cards').prepend(card);result.card=card;
  }
  async function edit(){
    const source = original;
    if(tool==='Downsizing'&&![0,1,2].some(checked))throw Error('줄일 방법을 선택해 주세요.');
    const result=await (tool==='Format Convert'?convert():makeGif());
    if (source !== original) return;
    for(const removed of history.splice(history.indexOf(current)+1)){
      cancelAnimationFrame(removed.tick);removed.card.remove();URL.revokeObjectURL(removed.url);
    }
    result.url=URL.createObjectURL(result.blob);result.label=tool;
    current=result;history.push(result);addCard(result);renderHistory();syncName();
    el('Original').open=false;menu();
    el('Status').textContent=result.ext==='webm'?'MP4 대신 WEBM 동영상으로 만들었어요.':'편집을 마쳤어요.';
  }  el('Form').onsubmit=async e=>{
    e.preventDefault(); if(busy)return;
    busy=true; el('Form').inert=el('Save').disabled=true;el('Settings').hidden=true;
    try {await edit();}
    catch(err){el('Status').textContent=err.message;}
    finally{busy=false;el('Form').inert=el('Save').disabled=false;}
  };
  el('Save').onclick=()=>{el('Settings').hidden=!el('Settings').hidden;if(!el('Settings').hidden)el('Name').focus();};
  el('Settings').onsubmit=async e=>{
    e.preventDefault();
    const blob=current.blob, name=el('Name').value.trim();
    if(!name)return;
    try {
      if(window.showSaveFilePicker){
        const handle=await window.showSaveFilePicker({suggestedName:name});
        const stream=await handle.createWritable();await stream.write(blob);await stream.close();
      } else {
        const link=document.createElement('a');link.href=current.url;link.download=name;link.click();
      }
    } catch(err){if(err.name!=='AbortError')el('Status').textContent='저장하지 못했어요. '+err.message;}
  };
})();
