/* ============================================================
   API — ХЕЛПЕРЫ
   ============================================================ */
function getToken() {
  return sessionStorage.getItem('adminToken');
}

async function apiGet(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function apiPost(url, data, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: isFormData ? data : JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || 'Ошибка сервера', true);
      if (res.status === 401) adminLogout();
      return null;
    }
    return await res.json();
  } catch {
    showToast('Нет соединения с сервером', true);
    return null;
  }
}

async function apiDelete(url) {
  const token = getToken();
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) adminLogout();
      showToast('Ошибка удаления', true);
      return false;
    }
    return true;
  } catch {
    showToast('Нет соединения с сервером', true);
    return false;
  }
}

/* ============================================================
   ЗАГРУЗКА ДАННЫХ С СЕРВЕРА
   ============================================================ */
async function loadData() {
  const [prices, contacts] = await Promise.all([
    apiGet('/api/prices'),
    apiGet('/api/contacts'),
  ]);
  if (prices)   applyPrices(prices);
  if (contacts) applyContacts(contacts);
}

/* ============================================================
   ЦЕНЫ — применение к DOM
   ============================================================ */
function applyPrices(prices) {
  Object.entries(prices).forEach(([key, val]) => {
    document.querySelectorAll(`[data-price="${key}"]`).forEach(el => {
      el.textContent = val;
    });
  });
}

/* ============================================================
   КОНТАКТЫ — применение к DOM
   ============================================================ */
function applyContacts(contacts) {
  const raw     = contacts['phone-raw']    || '79939666272';
  const display = contacts['phone-display']|| '+7 993 966-62-72';
  const vk      = contacts['vk']           || '#';
  const tg      = contacts['tg']           || '#';
  const wa      = contacts['wa']           || '#';

  document.querySelectorAll('[data-contact="phone-display"]').forEach(el => {
    el.textContent = display;
  });
  document.querySelectorAll('[data-contact="address"]').forEach(el => {
    el.innerHTML = contacts['address'] || '';
  });
  document.querySelectorAll('[data-contact="address-short"]').forEach(el => {
    el.textContent = contacts['address-short'] || '';
  });
  document.querySelectorAll('[data-contact="hours-weekday"]').forEach(el => {
    el.textContent = contacts['hours-weekday'] || '';
  });
  document.querySelectorAll('[data-contact="hours-weekend"]').forEach(el => {
    el.textContent = contacts['hours-weekend'] || '';
  });

  const phoneHref = 'tel:+' + raw.replace(/\D/g, '');
  const setLink = (id, href, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.href = href;
    if (text) el.textContent = text;
  };
  setLink('phoneLink',       phoneHref);
  setLink('contactPhoneLink', phoneHref, display);
  setLink('footerPhoneLink',  phoneHref, display);
  setLink('vkLink',          vk);
  setLink('tgLink',          tg);
  setLink('tgLinkContacts',  tg);
  setLink('waLink',          wa);
  setLink('footerVkLink',    vk);
  setLink('footerTgLink',    tg);
  setLink('footerWaLink',    wa);
}

/* ============================================================
   ADMIN — ВХОД / ВЫХОД
   ============================================================ */
const adminBar = document.getElementById('adminBar');
let logoClickCount = 0;
let logoClickTimer = null;

document.getElementById('adminLogoTrigger').addEventListener('click', (e) => {
  e.preventDefault();
  logoClickCount++;
  clearTimeout(logoClickTimer);
  logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 2000);
  if (logoClickCount >= 5) {
    logoClickCount = 0;
    promptAdminLogin();
  }
});

async function promptAdminLogin() {
  if (getToken()) {
    if (confirm('Выйти из режима администратора?')) adminLogout();
    return;
  }
  const pass = prompt('Введите пароль администратора:');
  if (pass === null) return;

  const result = await apiPost('/api/auth', { password: pass });
  if (result && result.token) {
    sessionStorage.setItem('adminToken', result.token);
    enableAdminMode();
    showToast('Режим администратора включён');
  }
}

function adminLogout() {
  sessionStorage.removeItem('adminToken');
  disableAdminMode();
  showToast('Вы вышли из режима администратора');
}

function enableAdminMode() {
  document.body.classList.add('admin-mode');
  adminBar.classList.add('visible');
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  refreshDeleteButtons();
}

function disableAdminMode() {
  document.body.classList.remove('admin-mode');
  adminBar.classList.remove('visible');
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
}

if (getToken()) enableAdminMode();

/* ============================================================
   МОДАЛЬНЫЕ ОКНА
   ============================================================ */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (id === 'pricesModal')   fillPricesModal();
  if (id === 'contactsModal') fillContactsModal();
  if (id === 'photosModal')   fillPhotosModal();
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.open').forEach(m => {
      m.classList.remove('open');
    });
    closeLightbox();
    document.body.style.overflow = '';
  }
});

/* ============================================================
   ЦЕНЫ — МОДАЛ
   ============================================================ */
const PRICE_INPUT_MAP = {
  'mp-basic':           'basic',
  'mp-basic-label':     'basic-label',
  'mp-evening':         'evening',
  'mp-evening-label':   'evening-label',
  'mp-ps5':             'ps5',
  'mp-ps5-label':       'ps5-label',
  'mp-hookah-standard': 'hookah-standard',
  'mp-hookah-double':   'hookah-double',
  'mp-hookah-author':   'hookah-author',
  'mp-hookah-relight':  'hookah-relight',
};

async function fillPricesModal() {
  const prices = await apiGet('/api/prices');
  if (!prices) return;
  Object.entries(PRICE_INPUT_MAP).forEach(([inputId, key]) => {
    const el = document.getElementById(inputId);
    if (el) el.value = prices[key] || '';
  });
}

async function savePrices() {
  const data = {};
  Object.entries(PRICE_INPUT_MAP).forEach(([inputId, key]) => {
    const el = document.getElementById(inputId);
    if (el && el.value.trim()) data[key] = el.value.trim();
  });
  const result = await apiPost('/api/prices', data);
  if (result) {
    applyPrices(result);
    closeModal('pricesModal');
    showToast('Цены обновлены');
  }
}

/* ============================================================
   КОНТАКТЫ — МОДАЛ
   ============================================================ */
const CONTACT_INPUT_MAP = {
  'mc-phone-raw':     'phone-raw',
  'mc-phone-display': 'phone-display',
  'mc-address-short': 'address-short',
  'mc-address':       'address',
  'mc-hours-weekday': 'hours-weekday',
  'mc-hours-weekend': 'hours-weekend',
  'mc-vk':            'vk',
  'mc-tg':            'tg',
  'mc-wa':            'wa',
};

async function fillContactsModal() {
  const contacts = await apiGet('/api/contacts');
  if (!contacts) return;
  Object.entries(CONTACT_INPUT_MAP).forEach(([inputId, key]) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    let val = contacts[key] || '';
    if (key === 'address') val = val.replace(/<br\s*\/?>/gi, '\n');
    el.value = val;
  });
}

async function saveContacts() {
  const data = {};
  Object.entries(CONTACT_INPUT_MAP).forEach(([inputId, key]) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    let val = el.value.trim();
    if (!val) return;
    if (key === 'address') val = val.replace(/\n/g, '<br />');
    data[key] = val;
  });
  const result = await apiPost('/api/contacts', data);
  if (result) {
    applyContacts(result);
    closeModal('contactsModal');
    showToast('Контакты обновлены');
  }
}

/* ============================================================
   ГАЛЕРЕЯ
   ============================================================ */
const galleryGrid = document.getElementById('galleryGrid');
let galleryData = []; // [{filename, url}, ...]

async function loadGallery() {
  const data = await apiGet('/api/gallery');
  galleryData = data || [];
  renderGallery();
}

function renderGallery() {
  const existingItems = Array.from(galleryGrid.querySelectorAll('.gallery__item'));

  // Заполняем существующие слоты
  galleryData.forEach((item, idx) => {
    let slot = existingItems[idx];
    if (!slot) {
      slot = createNewSlot(idx);
      galleryGrid.appendChild(slot);
    }
    const img = slot.querySelector('img');
    img.src = item.url;
    img.alt = item.filename;
    slot.dataset.filename = item.filename;
    slot.classList.remove('empty');
  });

  // Остальные слоты — пустые
  const allItems = Array.from(galleryGrid.querySelectorAll('.gallery__item'));
  for (let i = galleryData.length; i < allItems.length; i++) {
    const slot = allItems[i];
    const img  = slot.querySelector('img');
    img.src = '';
    img.alt = '';
    delete slot.dataset.filename;
    slot.classList.add('empty');
  }

  refreshDeleteButtons();
}

function createNewSlot(idx) {
  const div = document.createElement('div');
  div.className = 'gallery__item empty';
  div.dataset.slot = idx;
  div.innerHTML = `
    <img src="" alt="" />
    <div class="gallery__empty-slot"><span>📷</span><p>Фото появится здесь</p></div>
    <div class="gallery__overlay"><button class="gallery__zoom" onclick="openLightbox(this)">⤢</button></div>
    <button class="gallery__delete admin-only" onclick="deletePhoto(this)" title="Удалить фото">✕</button>
  `;
  if (!getToken()) div.querySelector('.gallery__delete').style.display = 'none';
  return div;
}

function refreshDeleteButtons() {
  document.querySelectorAll('.gallery__item').forEach(item => {
    const btn = item.querySelector('.gallery__delete');
    if (!btn) return;
    btn.style.display = (!item.classList.contains('empty') && getToken()) ? '' : 'none';
  });
}

async function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  showToast('Загружаем фото...');
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      showToast(`"${file.name}" превышает 10 МБ`, true);
      continue;
    }
    const formData = new FormData();
    formData.append('file', file);
    const result = await apiPost('/api/gallery', formData, true);
    if (result) galleryData.push(result);
  }
  renderGallery();
  event.target.value = '';
  showToast('Фото добавлены');
}

async function deletePhoto(btn) {
  const item     = btn.closest('.gallery__item');
  const filename = item.dataset.filename;
  if (!filename) return;
  const ok = await apiDelete(`/api/gallery/${filename}`);
  if (ok) {
    galleryData = galleryData.filter(g => g.filename !== filename);
    renderGallery();
    showToast('Фото удалено');
  }
}

function fillPhotosModal() {
  const preview = document.getElementById('modalPhotoPreview');
  if (!preview) return;
  preview.innerHTML = '';
  if (!galleryData.length) {
    preview.innerHTML = '<p class="modal__empty">Фотографий пока нет</p>';
    return;
  }
  galleryData.forEach(item => {
    const div = document.createElement('div');
    div.className = 'modal-thumb';
    div.innerHTML = `
      <img src="${item.url}" alt="${item.filename}" />
      <button onclick="deletePhotoByFilename('${item.filename}', this)" title="Удалить">✕</button>
    `;
    preview.appendChild(div);
  });
}

async function deletePhotoByFilename(filename, btn) {
  const ok = await apiDelete(`/api/gallery/${filename}`);
  if (ok) {
    galleryData = galleryData.filter(g => g.filename !== filename);
    renderGallery();
    btn.closest('.modal-thumb').remove();
    if (!galleryData.length) fillPhotosModal();
    showToast('Фото удалено');
  }
}

/* ============================================================
   ABOUT — ФОТО БЛОКА «О НАС»
   ============================================================ */
let currentAboutSlot = null;

async function loadAboutPhotos() {
  const data = await apiGet('/api/about');
  if (!data) return;
  document.querySelectorAll('.visual-card[data-about-slot]').forEach(card => {
    const slot = card.dataset.aboutSlot;
    const url  = data[slot];
    const inner = card.querySelector('.visual-card__inner');
    const img   = card.querySelector('img');
    if (url) {
      img.src = url;
      inner.classList.remove('no-img');
    } else {
      img.src = '';
      inner.classList.add('no-img');
    }
  });
}

function aboutPhotoClick(card) {
  if (!document.body.classList.contains('admin-mode')) return;
  currentAboutSlot = card.dataset.aboutSlot;
  document.getElementById('aboutPhotoInput').click();
}

async function handleAboutPhoto(event) {
  const file = event.target.files[0];
  if (!file || !currentAboutSlot) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast('Файл превышает 10 МБ', true);
    return;
  }
  const formData = new FormData();
  formData.append('file', file);
  const result = await apiPost(`/api/about/${currentAboutSlot}`, formData, true);
  if (result) {
    const card  = document.querySelector(`[data-about-slot="${currentAboutSlot}"]`);
    const inner = card.querySelector('.visual-card__inner');
    const img   = card.querySelector('img');
    img.src = result.url + '?t=' + Date.now(); // сброс кэша
    inner.classList.remove('no-img');
    showToast('Фото обновлено');
  }
  currentAboutSlot = null;
  event.target.value = '';
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
const lightbox    = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

function openLightbox(btn) {
  const item = btn.closest('.gallery__item');
  const img  = item.querySelector('img');
  if (!img || !img.src || item.classList.contains('empty')) return;
  lightboxImg.src = img.src;
  lightboxImg.alt = img.alt;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
}

lightboxImg.addEventListener('click', e => e.stopPropagation());

/* ============================================================
   NAVIGATION
   ============================================================ */
const header   = document.getElementById('header');
const burger   = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
});

burger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
});

document.querySelectorAll('.nav__links a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    document.body.style.overflow = '';
  });
});

/* ============================================================
   SMOOTH SCROLL
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ============================================================
   SCROLL ANIMATIONS
   ============================================================ */
const fadeEls = document.querySelectorAll(
  '.service-card, .price-card, .feature, .contact-block, .gallery__item, ' +
  '.booking__contact, .hookah-item, .about__content, .about__visual'
);
fadeEls.forEach(el => el.classList.add('fade-in'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = Array.from(entry.target.parentElement.children).indexOf(entry.target);
      entry.target.style.transitionDelay = `${idx * 70}ms`;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

fadeEls.forEach(el => observer.observe(el));

/* ============================================================
   BOOKING FORM
   ============================================================ */
const bookingForm    = document.getElementById('bookingForm');
const bookingSuccess = document.getElementById('bookingSuccess');

const dateInput = document.getElementById('fdate');
if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

const phoneInput = document.getElementById('fphone');
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('8')) val = '7' + val.slice(1);
    if (val.length && !val.startsWith('7')) val = '7' + val;
    val = val.slice(0, 11);
    let f = '';
    if (val.length > 0)  f  = '+7';
    if (val.length > 1)  f += ' (' + val.slice(1, 4);
    if (val.length >= 4) f += ') ' + val.slice(4, 7);
    if (val.length >= 7) f += '-'  + val.slice(7, 9);
    if (val.length >= 9) f += '-'  + val.slice(9, 11);
    e.target.value = f;
  });
}

function submitBooking(e) {
  e.preventDefault();
  const btn = bookingForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Отправляем...';
  setTimeout(() => {
    bookingForm.classList.add('hidden');
    bookingSuccess.classList.add('show');
  }, 1200);
}

function resetBooking() {
  bookingForm.reset();
  bookingForm.classList.remove('hidden');
  bookingSuccess.classList.remove('show');
  const btn = bookingForm.querySelector('button[type="submit"]');
  btn.disabled = false;
  btn.textContent = 'Отправить заявку';
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer = null;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = 'toast show' + (isError ? ' toast--error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */
loadData();
loadGallery();
loadAboutPhotos();
