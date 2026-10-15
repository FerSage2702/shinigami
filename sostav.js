/*
 * Перед запуском вставьте URL проекта Supabase и anon/public key из
 * Supabase → Project Settings → API. Никогда не вставляйте service_role key в браузер.
 */
const SUPABASE_URL = 'ВСТАВЬТЕ_URL_ВАШЕГО_SUPABASE_ПРОЕКТА';
const SUPABASE_ANON_KEY = 'ВСТАВЬТЕ_ANON_PUBLIC_KEY';

const POSITIONS = {
  shinigami: [
    { value: 'Столп', label: 'Ашерон — Столп дыхания' },
    { value: 'Цугуко / Приёмник', label: 'Дасэйдзин — Цугуко / Приёмник' },
    { value: 'Инструктор', label: 'Датенши — Инструктор' },
    { value: 'Истребитель', label: 'Гитэнши — Истребитель' },
    { value: 'Ученик', label: 'Тенши — Ученик' }
  ],
  death: [
    { value: 'Столп', label: 'Архангел смерти — Столп' },
    { value: 'Цугуко / Преемник', label: 'Всадник смерти — Цугуко / Преемник' },
    { value: 'Инструктор', label: 'Жнец смерти — Инструктор' },
    { value: 'Истребитель', label: 'Вестник смерти — Истребитель' },
    { value: 'Ученик', label: 'Искуситель смерти — Ученик' }
  ]
};
const RANKS = ['Midzunoto', 'Midzunoe', 'Kanoto', 'Kanoe', 'Tsuchinoto', 'Tsuchinoe', 'Hinoto', 'Hinoe', 'Kinoto', 'Kinoe'];
const DIVISIONS = { shinigami: 'Шинигами', death: 'Смерть' };
const POSITION_ORDER = {
  shinigami: ['Столп', 'Цугуко / Приёмник', 'Инструктор', 'Истребитель', 'Ученик'],
  death: ['Столп', 'Цугуко / Преемник', 'Инструктор', 'Истребитель', 'Ученик']
};

let supabaseClient = null;
let membersCache = [];

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function setupSelects() {
  const divisionSelect = $('member-division');
  const positionSelect = $('member-position');
  const rankSelect = $('member-rank');

  function fillPositions() {
    const division = divisionSelect.value;
    positionSelect.innerHTML = POSITIONS[division]
      .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
      .join('');
  }
  positionSelect.innerHTML = '';
  rankSelect.innerHTML = RANKS.map((rank) => `<option value="${escapeHtml(rank)}">${escapeHtml(rank)}</option>`).join('');
  divisionSelect.addEventListener('change', fillPositions);
  fillPositions();
}

function openModal(division) {
  $('member-form').reset();
  $('member-division').value = division;
  $('member-division').dispatchEvent(new Event('change'));
  $('form-error').hidden = true;
  $('member-modal').hidden = false;
  document.body.style.overflow = 'hidden';
  $('member-name').focus();
}
function closeModal() {
  $('member-modal').hidden = true;
  document.body.style.overflow = '';
}

function positionLabel(division, position) {
  return POSITIONS[division]?.find((item) => item.value === position)?.label || position;
}

function renderDivision(division) {
  const target = $(division === 'shinigami' ? 'shinigami-groups' : 'death-groups');
  const members = membersCache.filter((member) => member.division === division);
  const positions = POSITION_ORDER[division];
  target.innerHTML = positions.map((position) => {
    const groupMembers = members.filter((member) => member.position === position)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    const rows = groupMembers.length ? groupMembers.map((member) => `
      <tr>
        <td><strong>${escapeHtml(member.name)}</strong></td>
        <td><span class="rank-chip">${escapeHtml(member.rank)}</span></td>
        <td>${member.steam_id ? escapeHtml(member.steam_id) : '—'}</td>
        <td>${member.breathing ? escapeHtml(member.breathing) : '—'}</td>
      </tr>`).join('') : '<tr><td class="empty-row" colspan="4">В этой должности пока нет участников</td></tr>';
    return `<section class="position-group">
      <h3 class="position-title"><span>${escapeHtml(positionLabel(division, position))}</span><small>${groupMembers.length}</small></h3>
      <div class="table-scroll"><table class="roster-table">
        <thead><tr><th>Имя</th><th>Ранг</th><th>Steam ID</th><th>Дыхание</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
  }).join('');
  $(division === 'shinigami' ? 'shinigami-count' : 'death-count').textContent = members.length;
  $(division === 'shinigami' ? 'shinigami-section-count' : 'death-section-count').textContent =
    `${members.length} ${pluralize(members.length, 'участник', 'участника', 'участников')}`;
}
function pluralize(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
function renderAll() {
  renderDivision('shinigami');
  renderDivision('death');
  $('total-count').textContent = membersCache.length;
}

async function loadMembers() {
  if (!supabaseClient) {
    $('status-message').textContent = 'Добавьте URL и anon/public key Supabase в файл sostav.js, чтобы загрузить состав.';
    $('status-message').classList.add('error');
    membersCache = [];
    renderAll();
    return;
  }
  $('status-message').textContent = 'Загрузка состава…';
  $('status-message').classList.remove('error');
  const { data, error } = await supabaseClient.from('members')
    .select('id, name, division, position, rank, steam_id, breathing, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    $('status-message').textContent = `Не удалось загрузить состав: ${error.message}. Проверьте SQL-таблицу и политики доступа.`;
    $('status-message').classList.add('error');
    membersCache = [];
  } else {
    membersCache = data || [];
    $('status-message').textContent = membersCache.length ? 'Состав успешно загружен из Supabase.' : 'Состав пока пуст — добавьте первого участника.';
  }
  renderAll();
}

async function saveMember(event) {
  event.preventDefault();
  if (!supabaseClient) {
    $('form-error').textContent = 'Сначала настройте SUPABASE_URL и SUPABASE_ANON_KEY в sostav.js.';
    $('form-error').hidden = false;
    return;
  }
  const form = new FormData($('member-form'));
  const payload = {
    name: String(form.get('name') || '').trim(),
    division: String(form.get('division') || ''),
    position: String(form.get('position') || ''),
    rank: String(form.get('rank') || ''),
    steam_id: String(form.get('steam_id') || '').trim() || null,
    breathing: String(form.get('breathing') || '').trim() || null
  };
  if (!payload.name) return;
  const button = $('save-member');
  button.disabled = true;
  button.textContent = 'Сохранение…';
  $('form-error').hidden = true;
  const { error } = await supabaseClient.from('members').insert(payload);
  button.disabled = false;
  button.textContent = 'Сохранить участника';
  if (error) {
    $('form-error').textContent = `Не удалось сохранить участника: ${error.message}`;
    $('form-error').hidden = false;
    return;
  }
  closeModal();
  await loadMembers();
}

document.addEventListener('DOMContentLoaded', () => {
  setupSelects();
  document.querySelectorAll('[data-open-form]').forEach((button) =>
    button.addEventListener('click', () => openModal(button.dataset.openForm)));
  $('close-modal').addEventListener('click', closeModal);
  $('cancel-form').addEventListener('click', closeModal);
  $('member-form').addEventListener('submit', saveMember);
  $('member-modal').addEventListener('click', (event) => {
    if (event.target === $('member-modal')) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('member-modal').hidden) closeModal();
  });

  if (window.supabase && SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith('ВСТАВЬТЕ_')) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  loadMembers();
});
