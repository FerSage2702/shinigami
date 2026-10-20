
/* URL проекта и публичный ключ Supabase */
const SUPABASE_URL = 'https://rnppekauytrfgropgrlz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ji8uD6ZUynIsF93nyRdFcQ_OGRK24vE';

const MANAGE_FUNCTION_URL = 'https://rnppekauytrfgropgrlz.supabase.co/functions/v1/manage-members';

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

const RANKS = [
  'Seito', 'Midzunoto', 'Midzunoe', 'Kanoto', 'Kanoe',
  'Tsuchinoto', 'Tsuchinoe', 'Hinoto', 'Hinoe',
  'Kinoto', 'Kinoe', 'Hashira'
];

const DIVISIONS = {
  shinigami: 'Шинигами',
  death: 'Смерть'
};

const POSITION_ORDER = POSITIONS;

let supabaseClient = null;
let membersCache = [];
let adminPassword = null;
let editingId = null;

const $ = (id) => document.getElementById(id);

async function callManageFunction(action, extra = {}) {
  const response = await fetch(MANAGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      action,
      password: adminPassword,
      ...extra
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Ошибка серверной функции');
  }

  return result;
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

function setupSelects() {
  const div = $('member-division');
  const pos = $('member-position');

  function fill() {
    pos.innerHTML = POSITIONS[div.value]
      .map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
      .join('');
  }

  $('member-rank').innerHTML = RANKS
    .map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
    .join('');

  div.addEventListener('change', fill);
  fill();
}

function updateAdminUI() {
  $('admin-status').textContent = adminPassword
    ? 'Режим редактирования включён'
    : 'Режим просмотра';

  $('admin-login').hidden = !!adminPassword;
  $('admin-logout').hidden = !adminPassword;

  document.querySelectorAll('[data-open-form]')
    .forEach(b => b.hidden = !adminPassword);

  renderAll();
}

async function loginAdmin() {
  if (!supabaseClient) {
    alert('Не настроено подключение к Supabase.');
    return;
  }

  const pass = prompt('Введите пароль администратора:');
  if (pass === null) return;

  adminPassword = pass;

  try {
    await callManageFunction('check');
    updateAdminUI();
  } catch (error) {
    adminPassword = null;

    alert(
      error.message.includes('Incorrect password')
        ? 'Неверный пароль.'
        : `Не удалось войти: ${error.message}`
    );
  }
}

function logoutAdmin() {
  adminPassword = null;
  updateAdminUI();
}

function openModal(division, member = null) {
  if (!adminPassword) {
    alert('Сначала войдите в режим редактирования.');
    return;
  }

  $('member-form').reset();
  $('member-souls').value = member?.souls ?? 0;
  editingId = member?.id ?? null;

  $('member-division').value = member?.division || division;
  $('member-division').dispatchEvent(new Event('change'));

  if (member) {
    $('member-name').value = member.name || '';
    $('member-position').value = member.position;
    $('member-rank').value = member.rank;
    $('member-steam').value = member.steam_id || '';
    $('member-souls').value = member.souls ?? 0;
  }

  $('form-title').textContent = editingId
    ? 'Изменение участника'
    : 'Добавление в состав';

  $('save-member').textContent = editingId
    ? 'Сохранить изменения'
    : 'Сохранить участника';

  $('form-error').hidden = true;
  $('member-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  $('member-name').focus();
}

function closeModal() {
  $('member-modal').hidden = true;
  document.body.style.overflow = '';
  editingId = null;
}

function renderDivision(division) {
  const target = $(
    division === 'shinigami'
      ? 'shinigami-groups'
      : 'death-groups'
  );

  const members = membersCache.filter(
    m => m.division === division
  );

  target.innerHTML = POSITION_ORDER[division].map(position => {
    const group = members
      .filter(m => m.position === position)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    const rows = group.length
      ? group.map(m => `
          <tr>
            <td><strong>${escapeHtml(m.name)}</strong></td>
            <td><span class="rank-chip">${escapeHtml(m.rank)}</span></td>
            <td>${Number(m.souls ?? 0)}</td>
            <td>${m.steam_id ? escapeHtml(m.steam_id) : '—'}</td>
            ${adminPassword ? `
              <td class="admin-actions">
                <button type="button" class="secondary-button" data-edit-id="${m.id}">Изменить</button>
                <button type="button" class="secondary-button danger-button" data-delete-id="${m.id}">Удалить</button>
              </td>
            ` : ''}
          </tr>
        `).join('')
      : `
          <tr>
            <td class="empty-row" colspan="${adminPassword ? 4 : 3}">
              В этой должности пока нет участников
            </td>
          </tr>
        `;

    return `
      <section class="position-group">
        <h3 class="position-title">
          <span>${escapeHtml(position)}</span>
          
        </h3>
        <div class="table-scroll">
          <table class="roster-table">
            <ead>
              <tr>
                <th>Имя</th>
                <th>Ранг</th>
                <th>Души</th>
                <th>Steam ID</th>
                ${adminPassword ? '<th>Действия</th>' : ''}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }).join('');

  $(division === 'shinigami' ? 'shinigami-count' : 'death-count')
    .textContent = members.length;

  $(
    division === 'shinigami'
      ? 'shinigami-section-count'
      : 'death-section-count'
  ).textContent =
    `${members.length} ${pluralize(members.length, 'участник', 'участника', 'участников')}`;
}

function pluralize(n, one, few, many) {
  const a = n % 10;
  const b = n % 100;

  return a === 1 && b !== 11
    ? one
    : a >= 2 && a <= 4 && (b < 12 || b > 14)
      ? few
      : many;
}

function renderAll() {
  renderDivision('shinigami');
  renderDivision('death');
  $('total-count').textContent = membersCache.length;
}

async function loadMembers() {
  if (!supabaseClient) {
    $('status-message').textContent =
      'Добавьте URL и anon/public key Supabase в файл sostav.js, чтобы загрузить состав.';

    $('status-message').classList.add('error');
    membersCache = [];
    renderAll();
    return;
  }

  $('status-message').textContent = 'Загрузка состава…';
  $('status-message').classList.remove('error');

  const { data, error } = await supabaseClient
    .from('members')
    .select('id,name,division,position,rank,souls,steam_id,created_at')
    .order('created_at', { ascending: true });

  if (error) {
    $('status-message').textContent =
      `Не удалось загрузить состав: ${error.message}. Проверьте SQL и политики доступа.`;

    $('status-message').classList.add('error');
    membersCache = [];
  } else {
    membersCache = data || [];

    $('status-message').textContent = membersCache.length
      ? 'Состав успешно загружен из Supabase.'
      : 'Состав пока пуст.';
  }

  renderAll();
}

function payloadFromForm() {
  const f = new FormData($('member-form'));

  return {
    name: String(f.get('name') || '').trim(),
    division: String(f.get('division') || ''),
    position: String(f.get('position') || ''),
    rank: String(f.get('rank') || ''),
    souls: Number(f.get('souls') || 0),
    steam_id: String(f.get('steam_id') || '').trim() || null
  };
}

async function saveMember(event) {
  event.preventDefault();

  if (!adminPassword) {
    $('form-error').textContent = 'Войдите в режим редактирования.';
    $('form-error').hidden = false;
    return;
  }

  const member = payloadFromForm();
  if (!Number.isSafeInteger(member.souls) || member.souls < 0) {
  $('form-error').textContent =
    'Количество Душ должно быть целым числом не меньше 0.';
  $('form-error').hidden = false;
  return;
}

  if (!member.name) {
    $('form-error').textContent = 'Введите имя участника.';
    $('form-error').hidden = false;
    return;
  }

  const btn = $('save-member');
  const isEditing = editingId !== null;

  btn.disabled = true;
  btn.textContent = 'Сохранение…';
  $('form-error').hidden = true;

  try {
    await callManageFunction(
      isEditing ? 'update' : 'create',
      isEditing
        ? { id: Number(editingId), member }
        : { member }
    );

    closeModal();
    await loadMembers();
  } catch (error) {
    $('form-error').textContent =
      `Не удалось сохранить: ${error.message}`;

    $('form-error').hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = editingId
      ? 'Сохранить изменения'
      : 'Сохранить участника';
  }
}

async function deleteMember(id) {
  if (!adminPassword) {
    alert('Сначала войдите в редактор.');
    return;
  }

  const member = membersCache.find(
    m => String(m.id) === String(id)
  );

  if (!member) return;

  if (!confirm(`Удалить участника «${member.name}»?`)) {
    return;
  }

  try {
    await callManageFunction('delete', {
      id: Number(id)
    });

    await loadMembers();
  } catch (error) {
    alert(`Не удалось удалить участника: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupSelects();

  document.querySelectorAll('[data-open-form]').forEach(b =>
    b.addEventListener('click', () => openModal(b.dataset.openForm))
  );

  $('admin-login').addEventListener('click', loginAdmin);
  $('admin-logout').addEventListener('click', logoutAdmin);
  $('close-modal').addEventListener('click', closeModal);
  $('cancel-form').addEventListener('click', closeModal);
  $('member-form').addEventListener('submit', saveMember);



  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('member-modal').hidden) {
      closeModal();
    }
  });

  document.body.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit-id]');
    const del = e.target.closest('[data-delete-id]');

    if (edit) {
      const m = membersCache.find(
        x => String(x.id) === edit.dataset.editId
      );

      if (m) openModal(m.division, m);
    }

    if (del) deleteMember(del.dataset.deleteId);
  });

  if (
    window.supabase &&
    SUPABASE_URL === 'https://rnppekauytrfgropgrlz.supabase.co' &&
    SUPABASE_ANON_KEY === 'sb_publishable_Ji8uD6ZUynIsF93nyRdFcQ_OGRK24vE'
  ) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }

  updateAdminUI();
  loadMembers();
});
