/* Mejora progresiva: conserva los manejadores y permisos existentes. */
(function(){
  'use strict';
  const tableIds=['tabla-asignaciones','tabla-personal-sin-est','tabla-movimientos-hoy'];
  function labelTables(){
    tableIds.forEach(id=>{
      const table=document.getElementById(id);if(!table)return;
      const labels=Array.from(table.querySelectorAll('thead th'),th=>th.textContent.replace(/[↑↓↕]/g,'').trim());
      table.querySelectorAll('tbody tr').forEach(row=>Array.from(row.cells).forEach((cell,i)=>{
        if(cell.colSpan===1)cell.dataset.label=labels[i]||'';
      }));
      if(id==='tabla-movimientos-hoy')table.querySelectorAll('tbody tr').forEach(row=>{
        if(row.cells.length!==11)return;
        const name=row.cells[2];
        if(!name.querySelector('.t28-mov-company-inline')){
          const company=document.createElement('span');company.className='t28-mov-company-inline';
          company.textContent=' · '+row.cells[3].textContent.trim();name.appendChild(company);
        }
        row.classList.toggle('t28-mov-open',/abiert/i.test(row.cells[9].textContent));
      });
    });
  }
  ['renderizarTabla','renderPersonalSinEstacionamiento','renderizarHistorialHoy'].forEach(name=>{
    const original=window[name];if(typeof original!=='function')return;
    window[name]=function(){const result=original.apply(this,arguments);labelTables();return result;};
  });
  function refreshClock(){if(typeof actualizarFechaHoraTopbar==='function')actualizarFechaHoraTopbar();}
  window.addEventListener('focus',refreshClock);window.addEventListener('pageshow',refreshClock);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshClock();});
  let lastActivity=Date.now(),cleared=false;
  function activity(){lastActivity=Date.now();cleared=false;}
  ['pointerdown','keydown','input','scroll','touchstart'].forEach(event=>document.addEventListener(event,activity,{passive:true,capture:true}));
  setInterval(()=>{
    if(cleared||Date.now()-lastActivity<120000)return;cleared=true;
    document.querySelectorAll('input[id^="buscador"],#dash-buscar-placa,#empresa-config-buscar,#admin-usuarios-buscar').forEach(input=>{
      if(!input.value)return;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('keyup',{bubbles:true}));
    });
    document.getElementById('dash-buscar-resultados')?.classList.add('hidden');cleared=true;
  },5000);
  const menu=window.toggleMenuConfig;
  if(typeof menu==='function')window.toggleMenuConfig=function(){
    const result=menu.apply(this,arguments);
    const label=document.getElementById('cfg-agente-actual');
    if(label)label.textContent=(typeof encargadoDiaActual!=='undefined'&&encargadoDiaActual?.nombre)||'Sin asignar · Cambiar responsable';
    return result;
  };
  function init(){
    labelTables();
    const hint=document.createElement('div');hint.id='t28-nav-hint';hint.hidden=true;hint.setAttribute('role','tooltip');document.body.appendChild(hint);
    let hideTimer;
    document.querySelectorAll('#app-sidebar .sidebar-nav-btn').forEach(button=>{
      const text=button.textContent.trim();button.setAttribute('aria-label',text);
      button.removeAttribute('title');button.removeAttribute('data-tooltip');
      let pressTimer,longPress=false;
      function show(){
        const label=button.querySelector('span:last-child');
        const tablet=window.matchMedia('(min-width:769px) and (pointer:coarse)').matches;
        if(!tablet||!label||getComputedStyle(label).display!=='none'){hint.hidden=true;return;}
        clearTimeout(hideTimer);const r=button.getBoundingClientRect();hint.textContent=text;hint.hidden=false;
        hint.style.left=Math.min(r.right+8,window.innerWidth-230)+'px';hint.style.top=Math.max(8,Math.min(r.top,window.innerHeight-50))+'px';
        hideTimer=setTimeout(()=>hint.hidden=true,1800);
      }
      button.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')show();});button.addEventListener('focus',show);
      button.addEventListener('pointerdown',e=>{longPress=false;if(e.pointerType==='touch')pressTimer=setTimeout(()=>{longPress=true;show();},450);});
      ['pointerup','pointercancel','pointerleave'].forEach(type=>button.addEventListener(type,()=>clearTimeout(pressTimer)));
      button.addEventListener('click',e=>{if(longPress){e.preventDefault();e.stopImmediatePropagation();longPress=false;}},true);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
