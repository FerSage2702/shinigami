/* Укажите URL проекта и anon/public key Supabase. service_role key в браузер не вставлять. */
const SUPABASE_URL = 'ВСТАВЬТЕ_URL_ВАШЕГО_SUPABASE_ПРОЕКТА';
const SUPABASE_ANON_KEY = 'ВСТАВЬТЕ_ANON_PUBLIC_KEY';
const POSITIONS = {
  shinigami: [
    'Ашерон',
    'Дасэйдзин',
    'Датенши',
    'Гитенши',
    'Тенши'
  ],
  death: [
    'Архангел',
    'Всадник',
    'Жнец',
    'Вестник',
    'Искуситель'
  ]
};
const RANKS = ['Mizunoto','Mizunoe','Kanoto','Kanoe','Tsuchinoto','Tsuchinoe','Hinoto','Hinoe','Kinoto','Kinoe','Hashira'];
const DIVISIONS = { shinigami: 'Шинигами', death: 'Смерть' };
const POSITION_ORDER = POSITIONS;
let supabaseClient = null, membersCache = [], adminPassword = null, editingId = null, currentDivision = 'shinigami';
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setupSelects() {
  const div=$('member-division'), pos=$('member-position');
  function fill(){ pos.innerHTML=POSITIONS[div.value].map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''); }
  $('member-rank').innerHTML=RANKS.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  div.addEventListener('change',fill); fill();
}
function updateAdminUI(){
  $('admin-status').textContent=adminPassword?'Режим редактирования включён':'Режим просмотра';
  $('admin-login').hidden=!!adminPassword; $('admin-logout').hidden=!adminPassword;
  document.querySelectorAll('[data-open-form]').forEach(b=>b.hidden=!adminPassword);
  renderAll();
}
async function loginAdmin(){
  if(!supabaseClient){alert('Сначала настройте Supabase в sostav.js.');return;}
  const pass=prompt('Введите пароль администратора:'); if(pass===null)return;
  const {data,error}=await supabaseClient.rpc('check_roster_admin_password',{p_password:pass});
  if(error){alert('Не удалось проверить пароль. Проверьте, что выполнили обновлённый supabase.sql.');return;}
  if(data!==true){alert('Неверный пароль.');return;}
  adminPassword=pass; updateAdminUI();
}
function logoutAdmin(){adminPassword=null; updateAdminUI();}
function openModal(division, member=null){
  if(!adminPassword){alert('Сначала войдите в режим редактирования.');return;}
  $('member-form').reset(); editingId=member?.id ?? null;
  $('member-division').value=member?.division || division; $('member-division').dispatchEvent(new Event('change'));
  if(member){ $('member-name').value=member.name||''; $('member-position').value=member.position; $('member-rank').value=member.rank; $('member-steam').value=member.steam_id||''; $('member-breathing').value=member.breathing||''; }
  $('form-title').textContent=editingId?'Изменение участника':'Добавление в состав';
  $('save-member').textContent=editingId?'Сохранить изменения':'Сохранить участника';
  $('form-error').hidden=true; $('member-modal').hidden=false; document.body.style.overflow='hidden'; $('member-name').focus();
}
function closeModal(){ $('member-modal').hidden=true; document.body.style.overflow=''; editingId=null; }
function renderDivision(division){
  const target=$(division==='shinigami'?'shinigami-groups':'death-groups');
  const members=membersCache.filter(m=>m.division===division);
  target.innerHTML=POSITION_ORDER[division].map(position=>{
    const group=members.filter(m=>m.position===position).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    const rows=group.length?group.map(m=>`<tr><td><strong>${escapeHtml(m.name)}</strong></td><td><span class="rank-chip">${escapeHtml(m.rank)}</span></td><td>${m.steam_id?escapeHtml(m.steam_id):'—'}</td><td>${m.breathing?escapeHtml(m.breathing):'—'}</td>${adminPassword?`<td class="admin-actions"><button type="button" class="secondary-button" data-edit-id="${m.id}">Изменить</button><button type="button" class="secondary-button danger-button" data-delete-id="${m.id}">Удалить</button></td>`:''}</tr>`).join(''):`<tr><td class="empty-row" colspan="${adminPassword?5:4}">В этой должности пока нет участников</td></tr>`;
    return `<section class="position-group"><h3 class="position-title"><span>${escapeHtml(position)}</span><small>${group.length}</small></h3><div class="table-scroll"><table class="roster-table"><thead><tr><th>Имя</th><th>Ранг</th><th>Steam ID</th><th>Дыхание</th>${adminPassword?'<th>Действия</th>':''}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join('');
  $(division==='shinigami'?'shinigami-count':'death-count').textContent=members.length;
  $(division==='shinigami'?'shinigami-section-count':'death-section-count').textContent=`${members.length} ${pluralize(members.length,'участник','участника','участников')}`;
}
function pluralize(n,one,few,many){const a=n%10,b=n%100;return a===1&&b!==11?one:a>=2&&a<=4&&(b<12||b>14)?few:many;}
function renderAll(){renderDivision('shinigami');renderDivision('death');$('total-count').textContent=membersCache.length;}
async function loadMembers(){
  if(!supabaseClient){$('status-message').textContent='Добавьте URL и anon/public key Supabase в файл sostav.js, чтобы загрузить состав.';$('status-message').classList.add('error');membersCache=[];renderAll();return;}
  $('status-message').textContent='Загрузка состава…';$('status-message').classList.remove('error');
  const {data,error}=await supabaseClient.from('members').select('id,name,division,position,rank,steam_id,breathing,created_at').order('created_at',{ascending:true});
  if(error){$('status-message').textContent=`Не удалось загрузить состав: ${error.message}. Проверьте SQL и политики доступа.`;$('status-message').classList.add('error');membersCache=[];}
  else{membersCache=data||[];$('status-message').textContent=membersCache.length?'Состав успешно загружен из Supabase.':'Состав пока пуст.';}
  renderAll();
}
function payloadFromForm(){const f=new FormData($('member-form'));return {name:String(f.get('name')||'').trim(),division:String(f.get('division')||''),position:String(f.get('position')||''),rank:String(f.get('rank')||''),steam_id:String(f.get('steam_id')||'').trim()||null,breathing:String(f.get('breathing')||'').trim()||null};}
async function saveMember(event){
  event.preventDefault(); if(!adminPassword){$('form-error').textContent='Войдите в режим редактирования.';$('form-error').hidden=false;return;}
  const p=payloadFromForm();if(!p.name)return;const btn=$('save-member');btn.disabled=true;btn.textContent='Сохранение…';$('form-error').hidden=true;
  const args={p_password:adminPassword,p_name:p.name,p_division:p.division,p_position:p.position,p_rank:p.rank,p_steam_id:p.steam_id,p_breathing:p.breathing};
  const result=editingId?await supabaseClient.rpc('update_member_with_password',{...args,p_id:editingId}):await supabaseClient.rpc('add_member_with_password',args);
  btn.disabled=false;btn.textContent=editingId?'Сохранить изменения':'Сохранить участника';
  if(result.error){$('form-error').textContent=`Не удалось сохранить: ${result.error.message}`;$('form-error').hidden=false;return;}
  closeModal();await loadMembers();
}
async function deleteMember(id){if(!adminPassword)return;const member=membersCache.find(m=>String(m.id)===String(id));if(!member||!confirm(`Удалить участника «${member.name}»?`))return;
  const {error}=await supabaseClient.rpc('delete_member_with_password',{p_password:adminPassword,p_id:id});
  if(error){alert(`Не удалось удалить участника: ${error.message}`);return;}await loadMembers();
}
document.addEventListener('DOMContentLoaded',()=>{
  setupSelects();document.querySelectorAll('[data-open-form]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.openForm)));
  $('admin-login').addEventListener('click',loginAdmin);$('admin-logout').addEventListener('click',logoutAdmin);
  $('close-modal').addEventListener('click',closeModal);$('cancel-form').addEventListener('click',closeModal);$('member-form').addEventListener('submit',saveMember);
  $('member-modal').addEventListener('click',e=>{if(e.target===$('member-modal'))closeModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('member-modal').hidden)closeModal();});
  document.body.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-id]');const del=e.target.closest('[data-delete-id]');if(edit){const m=membersCache.find(x=>String(x.id)===edit.dataset.editId);if(m)openModal(m.division,m);}if(del)deleteMember(del.dataset.deleteId);});
  if(window.supabase&&SUPABASE_URL.startsWith('https://rnppekauytrfgropgrlz.supabase.co/rest/v1/members')&&SUPABASE_ANON_KEY&&!SUPABASE_ANON_KEY.startsWith('sb_publishable_Ji8uD6ZUynIsF93nyRdFcQ_OGRK24vE'))supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  updateAdminUI();loadMembers();
});
