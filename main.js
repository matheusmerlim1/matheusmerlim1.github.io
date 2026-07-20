const GITHUB_USER = 'matheusmerlim1';

// ── COMMIT DATES ──────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff   = Date.now() - new Date(dateStr).getTime();
  const mins   = Math.floor(diff / 60000);
  const hours  = Math.floor(diff / 3600000);
  const days   = Math.floor(diff / 86400000);
  const months = Math.floor(days / 30);
  const years  = Math.floor(days / 365);
  if (mins  < 60)  return `há ${mins}min`;
  if (hours < 24)  return `há ${hours}h`;
  if (days  === 1) return 'ontem';
  if (days  < 7)   return `há ${days} dias`;
  if (days  < 30)  return `há ${Math.floor(days / 7)} sem.`;
  if (months < 12) return `há ${months} mes${months > 1 ? 'es' : ''}`;
  return `há ${years} ano${years > 1 ? 's' : ''}`;
}

function applyCommitData(repoMap) {
  document.querySelectorAll('[data-repo]').forEach(card => {
    const repo  = repoMap[card.getAttribute('data-repo')];
    const badge = card.querySelector('.commit-badge');
    if (!badge) return;
    if (!repo)  { badge.style.display = 'none'; return; }
    const date   = repo.pushed_at || repo.updated_at;
    badge.textContent = timeAgo(date);
    badge.classList.remove('loading');
    const recent = Date.now() - new Date(date).getTime() < 7 * 86400000;
    if (recent) badge.classList.add('recent');
  });
}

async function loadProjects() {
  let repoMap     = {};
  let previousMap = null;

  try {
    const cached = localStorage.getItem('portfolio_repos');
    if (cached) previousMap = JSON.parse(cached);
  } catch (_) {}

  // Tenta projects-data.json (gerado pelo GitHub Actions)
  try {
    const res = await fetch('projects-data.json?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      data.projects.forEach(p => { repoMap[p.name] = p; });
      document.getElementById('last-updated').textContent =
        'Dados atualizados em ' + new Date(data.updated).toLocaleString('pt-BR');
    }
  } catch (_) {}

  // Fallback: API do GitHub
  if (!Object.keys(repoMap).length) {
    try {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`);
      if (res.ok) {
        const repos = await res.json();
        repos.forEach(r => { repoMap[r.name] = r; });
        document.getElementById('last-updated').textContent =
          'Dados carregados ao vivo da API do GitHub';
      }
    } catch (_) {}
  }

  applyCommitData(repoMap);
  showNewCommitsBanner(repoMap, previousMap);

  try { localStorage.setItem('portfolio_repos', JSON.stringify(repoMap)); } catch (_) {}
}

function showNewCommitsBanner(current, previous) {
  if (!previous) return;
  const updated = Object.entries(current)
    .filter(([name, r]) => previous[name] && previous[name].pushed_at !== r.pushed_at)
    .map(([name]) => name);
  if (!updated.length) return;

  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;bottom:1.5rem;right:1.5rem;z-index:300;
    background:#161b22;border:1px solid #3fb950;border-radius:10px;
    padding:.8rem 1.1rem;font-size:.83rem;color:#e6edf3;
    box-shadow:0 4px 20px rgba(0,0,0,.5);max-width:280px;cursor:pointer`;
  banner.innerHTML = `<strong style="color:#3fb950">Commits novos!</strong><br>${updated.join(', ')}`;
  banner.addEventListener('click', () => banner.remove());
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 9000);
}

// ── SEARCH ────────────────────────────────────────────────────
const PROJECTS = [
  { repo: 'CNC_ROUTER',                 icon: '🛠️', name: 'CNC Router — Configurador & Orçamento', lang: 'JavaScript', desc: 'App web para solicitação de CNC routers sob medida: landing, configurador de custo 3D e formulário do cliente.' },
  { repo: 'previsao-do-tempo',          icon: '🌤️', name: 'Previsão do Tempo',        lang: 'JavaScript', desc: 'Site de previsão do tempo com geolocalização automática por IP.' },
  { repo: 'Verificador-de-texto-IA',    icon: '🤖', name: 'Verificador de Texto IA',   lang: 'JavaScript', desc: 'Verifica o percentual de conteúdo gerado por IA em artigos.' },
  { repo: 'Construtora',                icon: '🏗️', name: 'Construtora',               lang: 'JavaScript', desc: 'Sistema de cadastro de clientes, construtoras e projetos de construção.' },
  { repo: 'Cafeteria',                  icon: '☕', name: 'Cafeteria',                 lang: 'JavaScript', desc: 'Site para uma cafeteria com cardápio e interface visual.' },
  { repo: 'DLM-PDF-API',               icon: '📄', name: 'DLM PDF API',               lang: 'HTML',       desc: 'Interface web para geração e manipulação de PDFs via API.' },
  { repo: 'DLM-PDF-encriptador',        icon: '🔒', name: 'DLM PDF Encriptador',       lang: 'JavaScript', desc: 'Encriptação de arquivos PDF diretamente no navegador.' },
  { repo: 'api-Filmes',                 icon: '🎬', name: 'API de Filmes',             lang: 'JavaScript', desc: 'Busca e exibe informações de filmes consumindo API REST.' },
  { repo: 'Catalogo_filmes',            icon: '🎭', name: 'Catálogo de Filmes',        lang: 'JavaScript', desc: 'Catálogo visual de filmes com listagem e filtros.' },
  { repo: 'Api-Piadas',                 icon: '😂', name: 'API de Piadas',             lang: 'JavaScript', desc: 'Exibe piadas aleatórias consumindo API REST.' },
  { repo: 'lab-api',                    icon: '🧪', name: 'Laboratório de API',        lang: 'JavaScript', desc: 'Laboratório de aprendizado de APIs REST com JavaScript.' },
  { repo: 'simulado-pcw',               icon: '📝', name: 'Simulado — Programação Cliente Web', lang: 'JavaScript', desc: 'Simulado interativo da disciplina de Programação de Clientes Web do CEFET/RJ.' },
  { repo: 'simulado-teste-manutencao-software', icon: '🧪', name: 'Simulado — Teste & Manutenção de Software', lang: 'JavaScript', desc: 'Simulado interativo sobre Teste e Manutenção de Software com JUnit 5 e Katalon.' },
  { repo: 'Despesas-pessoais',          icon: '💰', name: 'Despesas Pessoais',         lang: 'Flutter',    desc: 'App mobile para controle de despesas pessoais em Flutter.' },
  { repo: 'comparador_de_preco',        icon: '🏷️', name: 'Comparador de Preço',      lang: 'Flutter',    desc: 'App Flutter para comparar preços de produtos em lojas.' },
  { repo: 'flutter-programa-de-perguntas', icon: '❓', name: 'Programa de Perguntas', lang: 'Flutter',    desc: 'App quiz em Flutter com questionário interativo e feedback.' },
  { repo: 'dart-fundamental',           icon: '🎯', name: 'Dart Fundamental',          lang: 'Dart',       desc: 'Programas básicos para aprendizado dos fundamentos do Dart.' },
  { repo: 'LaboratorioArray',           icon: '📋', name: 'Laboratório de Arrays',     lang: 'JavaScript', desc: 'Exercícios de manipulação de arrays em JavaScript.' },
  { repo: 'String-Data',                icon: '📅', name: 'String & Data',             lang: 'JavaScript', desc: 'Manipulação de strings e datas em JavaScript.' },
  { repo: 'ProgramacaoClienteWeb',      icon: '💻', name: 'Programação Cliente Web',   lang: 'HTML',       desc: 'Estudos de programação client-side: HTML, formulários e eventos.' },
  { repo: 'Diagramacao_MatheusRaposo',  icon: '🎨', name: 'Diagramação — Web',         lang: 'CSS',        desc: 'Exercícios de layout e estilização com HTML e CSS.' },
  { repo: 'Momentos-perfeitos',         icon: '📷', name: 'Momentos Perfeitos',        lang: 'HTML',       desc: 'Site de galeria fotográfica com layout elegante.' },
  { repo: 'diagrama-o-3',               icon: '📐', name: 'Diagramação 3',             lang: 'HTML',       desc: 'Terceiro projeto de diagramação com estrutura visual.' },
  { repo: 'trabalho-nilson',            icon: '📝', name: 'Trabalho Nilson',           lang: 'HTML',       desc: 'Projeto acadêmico de desenvolvimento front-end em HTML.' },
  { repo: 'portifolio',                 icon: '🗂️', name: 'Portfólio Original',        lang: 'HTML',       desc: 'Versão anterior do portfólio pessoal em HTML.' },
];

function highlight(text, query) {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

function renderResults(query) {
  const q = query.trim().toLowerCase();
  const container = document.getElementById('search-results');
  const countEl   = document.getElementById('search-count');
  container.innerHTML = '';

  const matches = q
    ? PROJECTS.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.lang.toLowerCase().includes(q) ||
        p.repo.toLowerCase().includes(q)
      )
    : PROJECTS;

  countEl.textContent = `${matches.length} resultado${matches.length !== 1 ? 's' : ''}`;

  if (!matches.length) {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text2);font-size:.9rem">Nenhum resultado encontrado.</p>';
    return;
  }

  matches.forEach(p => {
    const url  = `https://github.com/${GITHUB_USER}/${p.repo}`;
    const item = document.createElement('a');
    item.className = 'search-result-item';
    item.href      = url;
    item.target    = '_blank';
    item.rel       = 'noopener';
    item.innerHTML = `
      <span class="sr-icon">${p.icon}</span>
      <div style="min-width:0">
        <div class="sr-name">${highlight(p.name, query.trim())}</div>
        <div class="sr-desc">${highlight(p.desc, query.trim())}</div>
        <div class="sr-lang">${p.lang}</div>
      </div>`;
    item.addEventListener('click', closeSearch);
    container.appendChild(item);
  });
}

function openSearch() {
  document.getElementById('search-overlay').classList.add('open');
  document.getElementById('search-input').focus();
  renderResults('');
}
function closeSearch() {
  document.getElementById('search-overlay').classList.remove('open');
  document.getElementById('search-input').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');

  document.getElementById('nav-search-btn').addEventListener('click', openSearch);

  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });

  input.addEventListener('input', () => renderResults(input.value));

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') closeSearch();
  });
});

// ── COUNT-UP DE NÚMEROS ───────────────────────────────────────
function animateCount(el) {
  const raw    = el.textContent.trim();
  const target = parseInt(raw.replace(/\D/g, ''), 10);
  if (!target) return;
  const suffix = raw.replace(/[0-9]/g, '');
  const dur    = 1100;
  const start  = performance.now();
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── ANIMATIONS ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08 });
  document.querySelectorAll('.fade-in').forEach(el => io.observe(el));

  // count-up dos números dos stats (só uma vez)
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { animateCount(e.target); countIO.unobserve(e.target); }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-num').forEach(el => countIO.observe(el));

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  loadProjects();
});

// ── EFEITOS INTERATIVOS ───────────────────────────────────────
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // barra de progresso de scroll
  const bar = document.getElementById('scroll-progress');
  function onScroll() {
    const h = document.documentElement;
    const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
    if (bar) bar.style.width = (scrolled * 100) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (reduce) return;

  // glow que segue o cursor
  const glow = document.getElementById('cursor-glow');
  // spotlight nos cards (variáveis CSS --mx / --my)
  const glowCards = '.exp-card, .proj-card';

  window.addEventListener('pointermove', e => {
    if (glow) {
      glow.style.opacity = '1';
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    }
    const card = e.target.closest && e.target.closest(glowCards);
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top)  + 'px');
    }
  }, { passive: true });
})();
