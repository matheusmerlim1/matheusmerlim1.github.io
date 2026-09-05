const GITHUB_USER = 'matheusmerlim1';

// dados vivos dos repositorios, preenchidos por loadProjects()
let REPO_DATA = {};

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

  REPO_DATA = repoMap;
  PROJECTS  = buildProjects(repoMap);

  renderAutoCards();
  renderAreaProjects();
  renderRecent(repoMap);
  renderSidebar();
  updateCounts();
  applyCommitData(repoMap);   // por último: cobre também os cards recém-criados
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

// ── PROJETOS RECENTES (faixa de destaque) ─────────────────────
const RECENT_COUNT = 6;
const LANG_CLASS = {
  JavaScript: 'lc-js', HTML: 'lc-html', CSS: 'lc-css',
  Dart: 'lc-dart', Flutter: 'lc-flutter', Python: 'lc-python',
};

function renderRecent(repoMap) {
  const grid = document.getElementById('recent-grid');
  if (!grid) return;

  const dated = PROJECTS
    .map(p => {
      const r = repoMap[p.repo];
      return r ? Object.assign({}, p, { date: r.pushed_at || r.updated_at }) : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // sem dados suficientes: mantém a lista estática do HTML
  if (dated.length < RECENT_COUNT) return;

  grid.innerHTML = '';
  dated.slice(0, RECENT_COUNT).forEach((p, i) => {
    const fresh   = Date.now() - new Date(p.date).getTime() < 7 * 86400000;
    const repoUrl = `https://github.com/${GITHUB_USER}/${p.repo}`;
    const abrir   = p.site ? `<a class="proj-link" href="${p.site}" target="_blank" rel="noopener">Abrir site →</a>` : '';
    const card    = document.createElement('article');
    card.className = 'recent-card fade-in visible' + (i === 0 ? ' is-top' : '');
    card.setAttribute('data-repo', p.repo);
    card.innerHTML = `
      <div class="recent-head">
        <span class="recent-rank">${String(i + 1).padStart(2, '0')}</span>
        <span class="recent-icon">${p.icon}</span>
        <span class="commit-badge${fresh ? ' recent' : ''}">${timeAgo(p.date)}</span>
      </div>
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <div class="recent-foot">
        <span class="lang-chip"><span class="lang-dot ${LANG_CLASS[p.lang] || 'lc-html'}"></span>${p.lang}</span>
        <span class="recent-links">
          ${abrir}
          <a class="proj-link" href="${repoUrl}" target="_blank" rel="noopener">Código →</a>
        </span>
      </div>`;
    grid.appendChild(card);
  });
}

// ── CARDS AUTOMÁTICOS ─────────────────────────────────
// Repositório que ainda não tem card escrito à mão ganha um card gerado.
// Quando alguém escrever o card dele na seção, ele sai daqui sozinho.
function renderAutoCards() {
  const wrap = document.getElementById('novos-wrap');
  const grid = document.getElementById('novos-grid');
  if (!wrap || !grid) return;

  grid.innerHTML = '';   // antes de olhar quem já tem card

  const jaTem = new Set(
    Array.from(document.querySelectorAll('#programacao [data-repo]'))
         .map(el => el.getAttribute('data-repo'))
  );
  const faltando = PROJECTS
    .filter(p => !jaTem.has(p.repo))
    .sort((a, b) => b.rel - a.rel);

  wrap.hidden = !faltando.length;
  if (!faltando.length) return;

  faltando.forEach(p => {
    const repoUrl = `https://github.com/${GITHUB_USER}/${p.repo}`;
    const card = document.createElement('div');
    card.className = 'proj-card fade-in visible';
    card.setAttribute('data-repo', p.repo);
    card.innerHTML = `
      <div class="proj-top">
        <span class="proj-icon">${p.icon}</span>
        <span style="display:flex;align-items:center;gap:.5rem">
          <span class="new-badge">Novo</span>
          <span class="lang-chip"><span class="lang-dot ${LANG_CLASS[p.lang] || 'lc-html'}"></span>${p.lang}</span>
        </span>
      </div>
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <div class="proj-footer">
        <span class="proj-links">
          ${p.site ? `<a class="proj-link" href="${p.site}" target="_blank" rel="noopener">Abrir site \u2192</a>` : ''}
          <a class="proj-link" href="${repoUrl}" target="_blank" rel="noopener">Reposit\u00f3rio \u2192</a>
        </span>
        <span class="commit-badge loading">...</span>
      </div>`;
    grid.appendChild(card);
  });
}

// contagens que dependem de quantos repositórios existem
function updateCounts() {
  const n = PROJECTS.length;
  const stat = document.getElementById('stat-repos');
  if (stat) {
    const suffix = stat.textContent.replace(/[0-9]/g, '');
    stat.dataset.target = String(n);
    if (!stat.dataset.animating) stat.textContent = n + suffix;
  }
  const sec = document.getElementById('prog-count');
  if (sec) sec.textContent = n + ' repositórios';
}

// ── PROJETOS POR ÁREA ─────────────────────────────────
// Projeto marcado com areas: ['mec'] ou ['fisica'] em PROJECT_META
// também aparece na seção daquela área, além da de Programação.
function renderAreaProjects() {
  ['mec', 'fisica'].forEach(area => {
    const wrap = document.getElementById('area-' + area + '-wrap');
    const grid = document.getElementById('area-' + area + '-grid');
    if (!wrap || !grid) return;

    const daArea = PROJECTS
      .filter(p => (PROJECT_META[p.repo]?.areas || []).includes(area))
      .sort((a, b) => b.rel - a.rel);

    grid.innerHTML = '';
    wrap.hidden = !daArea.length;
    if (!daArea.length) return;

    daArea.forEach(p => {
      const repoUrl = `https://github.com/${GITHUB_USER}/${p.repo}`;
      const card = document.createElement('div');
      card.className = 'proj-card fade-in visible';
      card.setAttribute('data-repo', p.repo);
      card.innerHTML = `
        <div class="proj-top">
          <span class="proj-icon">${p.icon}</span>
          <span class="lang-chip"><span class="lang-dot ${LANG_CLASS[p.lang] || 'lc-html'}"></span>${p.lang}</span>
        </div>
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="proj-footer">
          <span class="proj-links">
            ${p.site ? `<a class="proj-link" href="${p.site}" target="_blank" rel="noopener">Abrir site \u2192</a>` : ''}
            <a class="proj-link" href="${repoUrl}" target="_blank" rel="noopener">Reposit\u00f3rio \u2192</a>
          </span>
          <span class="commit-badge loading">...</span>
        </div>`;
      grid.appendChild(card);
    });
  });
}

// ── COLUNA LATERAL DE PROJETOS ─────────────────────────
const sbState = { q: '', cat: 'Todas', sort: 'rel' };

function sbMatches(p, q) {
  if (!q) return true;
  return (p.name + ' ' + p.desc + ' ' + p.lang + ' ' + p.repo + ' ' + p.cat)
    .toLowerCase().includes(q);
}

function sbDate(p) {
  const r = REPO_DATA[p.repo];
  return r ? (r.pushed_at || r.updated_at) : null;
}

function sbSorted(list) {
  const arr = list.slice();
  if (sbState.sort === 'name') {
    arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } else if (sbState.sort === 'recent') {
    arr.sort((a, b) => {
      const da = sbDate(a), db = sbDate(b);
      if (da && db) return new Date(db) - new Date(da);
      if (da) return -1;
      if (db) return 1;
      return b.rel - a.rel;
    });
  } else {
    arr.sort((a, b) => b.rel - a.rel);
  }
  return arr;
}

function renderSidebar() {
  const list = document.getElementById('sb-list');
  if (!list) return;

  const q       = sbState.q.trim().toLowerCase();
  const matches = sbSorted(PROJECTS.filter(p =>
    (sbState.cat === 'Todas' || p.cat === sbState.cat) && sbMatches(p, q)
  ));

  const countEl = document.getElementById('sb-count');
  if (countEl) {
    countEl.textContent = matches.length === PROJECTS.length
      ? `${PROJECTS.length} projetos`
      : `${matches.length} de ${PROJECTS.length}`;
  }

  document.querySelectorAll('.sb-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === sbState.cat);
  });

  list.innerHTML = '';

  if (!matches.length) {
    list.innerHTML = '<p class="sb-empty">Nenhum projeto encontrado.<br><button type="button" class="sb-clear" id="sb-clear">Limpar filtros</button></p>';
    document.getElementById('sb-clear').addEventListener('click', sbReset);
    return;
  }

  matches.forEach(p => {
    const date = sbDate(p);
    const a    = document.createElement('a');
    a.className = 'sb-item';
    a.href      = projectUrl(p);
    a.target    = '_blank';
    a.rel       = 'noopener';
    a.title     = p.site ? 'Abrir ' + p.name : 'Ver ' + p.name + ' no GitHub';
    a.innerHTML = `
      <span class="sb-icon">${p.icon}</span>
      <span class="sb-body">
        <span class="sb-name">${highlight(p.name, sbState.q.trim())}</span>
        <span class="sb-meta">
          <span class="sb-tag">${p.cat}</span>
          <span class="lang-dot ${LANG_CLASS[p.lang] || 'lc-html'}"></span>${p.lang}
        </span>
      </span>
      <span class="sb-right">
        ${date ? `<span class="sb-when${Date.now() - new Date(date).getTime() < 7 * 86400000 ? ' recent' : ''}">${timeAgo(date)}</span>` : ''}
        <span class="sb-go">${p.site ? 'site \u2197' : 'GitHub \u2197'}</span>
      </span>`;
    list.appendChild(a);
  });
}

function sbReset() {
  sbState.q = '';
  sbState.cat = 'Todas';
  const input = document.getElementById('sb-input');
  if (input) input.value = '';
  renderSidebar();
}

function toggleSidebar(open) {
  const sb   = document.getElementById('sidebar');
  const back = document.getElementById('sb-backdrop');
  const btn  = document.getElementById('sb-toggle');
  if (!sb) return;
  const show = open === undefined ? !sb.classList.contains('open') : open;
  sb.classList.toggle('open', show);
  if (back) back.classList.toggle('open', show);
  if (btn)  btn.setAttribute('aria-expanded', String(show));
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('sb-input');
  const sort  = document.getElementById('sb-sort');
  if (!input) return;

  input.addEventListener('input', () => { sbState.q = input.value; renderSidebar(); });
  sort.addEventListener('change', () => { sbState.sort = sort.value; renderSidebar(); });

  document.querySelectorAll('.sb-chip').forEach(chip => {
    chip.addEventListener('click', () => { sbState.cat = chip.dataset.cat; renderSidebar(); });
  });

  const toggle = document.getElementById('sb-toggle');
  if (toggle) toggle.addEventListener('click', () => toggleSidebar());
  const back = document.getElementById('sb-backdrop');
  if (back) back.addEventListener('click', () => toggleSidebar(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleSidebar(false); });

  // fecha a gaveta ao escolher um projeto no celular
  document.getElementById('sb-list').addEventListener('click', e => {
    if (e.target.closest('.sb-item')) toggleSidebar(false);
  });

  renderSidebar();
});

// ── SEARCH ────────────────────────────────────────────────────
const CATEGORIES = ['Todas', 'Web', 'Simulados', 'API', 'Mobile', 'Fundamentos'];

// site: pagina publicada (quando existe) · cat: categoria · rel: peso de relevancia
// Repositórios que nunca entram na página.
const IGNORE_REPOS = ['matheusmerlim1.github.io', 'repositorio_teste'];

// Refinamento manual, opcional e por repositório. O que não estiver aqui
// entra na página do mesmo jeito, usando os dados que vierem do GitHub.
// Campos: icon, name, lang, cat, rel (0-100), site, desc.
const PROJECT_META = {
  'editor-pdf': { icon: '📝', name: 'Editor de PDF', lang: 'Python', cat: 'Web', rel: 98, site: 'https://matheusmerlim1.github.io/editor-pdf/', desc: 'Abre um PDF, identifica o texto da página, permite reescrevê-lo no próprio lugar e salva de volta. Roda no navegador ou como programa de mesa no Windows.' },
  'transpetro-enfase-25': { areas: ['mec'], icon: '🛢️', name: 'Transpetro Ênfase 25: Engenharia Mecânica', lang: 'HTML', cat: 'Simulados', rel: 96, site: 'https://matheusmerlim1.github.io/transpetro-enfase-25/', desc: '640 questões inéditas no padrão Cesgranrio com modo estudo, simulado cronometrado, fila de erros e formulário de 268 fórmulas.' },
  'simulado-ppc': { icon: '⚙️', name: 'Simulado: Programação Paralela & Concorrente', lang: 'JavaScript', cat: 'Simulados', rel: 90, site: 'https://matheusmerlim1.github.io/simulado-ppc/', desc: '167 questões sobre threads, deadlocks, redes de Petri e OpenMP, com resumo da disciplina em 73 tópicos.' },
  'ludoteca-boardgames': { icon: '🎲', name: 'Ludoteca: Coleção de Jogos de Tabuleiro', lang: 'Flutter', cat: 'Mobile', rel: 88, desc: 'App Android para registrar partidas de board games e analisar custo por partida, por hora e por mês. Flutter com SQLite local.' },
  'CNC_ROUTER': { areas: ['mec'], icon: '🛠️', name: 'CNC Router: Configurador & Orçamento', lang: 'JavaScript', cat: 'Web', rel: 85, site: 'https://matheusmerlim1.github.io/CNC_ROUTER/', desc: 'App web para solicitação de CNC routers sob medida: landing, configurador de custo 3D e formulário do cliente.' },
  'trabalho-nilson': { icon: '📚', name: 'DLM Bookstore: Livraria Digital', lang: 'HTML', cat: 'Web', rel: 78, site: 'https://matheusmerlim1.github.io/trabalho-nilson/', desc: 'Livraria digital com catálogo, carrinho e registro de compras em blockchain simulada.' },
  'DLM-PDF-API': { icon: '📄', name: 'DLM PDF API', lang: 'HTML', cat: 'Web', rel: 76, site: 'https://matheusmerlim1.github.io/DLM-PDF-API/', desc: 'Documentação e interface web para geração e manipulação de PDFs via API.' },
  'simulado-teste-manutencao-software': { icon: '🧪', name: 'Simulado: Teste & Manutenção de Software', lang: 'JavaScript', cat: 'Simulados', rel: 72, site: 'https://matheusmerlim1.github.io/simulado-teste-manutencao-software/', desc: 'Simulado interativo sobre Teste e Manutenção de Software com JUnit 5 e Katalon.' },
  'simulado-pcw': { icon: '📑', name: 'Simulado: Programação Cliente Web', lang: 'JavaScript', cat: 'Simulados', rel: 70, site: 'https://matheusmerlim1.github.io/simulado-pcw/', desc: 'Simulado interativo da disciplina de Programação de Clientes Web do CEFET/RJ.' },
  'DLM-PDF-encriptador': { icon: '🔒', name: 'DLM PDF Encriptador', lang: 'JavaScript', cat: 'Web', rel: 66, site: 'https://matheusmerlim1.github.io/DLM-PDF-encriptador/', desc: 'Encriptação e leitura de arquivos PDF diretamente no navegador.' },
  'Verificador-de-texto-IA': { icon: '🤖', name: 'Verificador de Texto IA', lang: 'JavaScript', cat: 'Web', rel: 62, site: 'https://matheusmerlim1.github.io/Verificador-de-texto-IA/', desc: 'Verifica o percentual de conteúdo gerado por IA em artigos.' },
  'previsao-do-tempo': { icon: '🌤️', name: 'Previsão do Tempo', lang: 'JavaScript', cat: 'Web', rel: 60, site: 'https://matheusmerlim1.github.io/previsao-do-tempo/', desc: 'Site de previsão do tempo com geolocalização automática por IP.' },
  'Construtora': { areas: ['mec'], icon: '🏗️', name: 'Construtora', lang: 'JavaScript', cat: 'Web', rel: 55, site: 'https://matheusmerlim1.github.io/Construtora/', desc: 'Sistema de cadastro de clientes, construtoras e projetos de construção.' },
  'Despesas-pessoais': { icon: '💰', name: 'Despesas Pessoais', lang: 'Flutter', cat: 'Mobile', rel: 52, desc: 'App mobile para controle de despesas pessoais em Flutter.' },
  'comparador_de_preco': { icon: '🏷️', name: 'Comparador de Preço', lang: 'Flutter', cat: 'Mobile', rel: 50, desc: 'App Flutter para comparar preços do mesmo produto em lojas diferentes.' },
  'Cafeteria': { icon: '☕', name: 'Cafeteria', lang: 'JavaScript', cat: 'Web', rel: 48, site: 'https://matheusmerlim1.github.io/Cafeteria/', desc: 'Site para uma cafeteria com cardápio e interface visual.' },
  'api-Filmes': { icon: '🎬', name: 'API de Filmes', lang: 'JavaScript', cat: 'API', rel: 46, site: 'https://matheusmerlim1.github.io/api-Filmes/', desc: 'Busca e exibe informações de filmes consumindo API REST.' },
  'lab-api': { icon: '💱', name: 'Câmbio Monetário', lang: 'JavaScript', cat: 'API', rel: 44, site: 'https://matheusmerlim1.github.io/lab-api/', desc: 'Conversão de moedas em tempo real consumindo API de câmbio.' },
  'Catalogo_filmes': { icon: '🎭', name: 'Catálogo de Filmes', lang: 'JavaScript', cat: 'API', rel: 42, site: 'https://matheusmerlim1.github.io/Catalogo_filmes/', desc: 'Catálogo visual de filmes e séries com listagem e filtros.' },
  'Api-Piadas': { icon: '😂', name: 'API de Piadas', lang: 'JavaScript', cat: 'API', rel: 40, site: 'https://matheusmerlim1.github.io/Api-Piadas/', desc: 'Exibe piadas aleatórias consumindo API REST.' },
  'flutter-programa-de-perguntas': { icon: '❓', name: 'Programa de Perguntas', lang: 'Flutter', cat: 'Mobile', rel: 38, desc: 'App quiz em Flutter com questionário interativo e feedback.' },
  'Momentos-perfeitos': { icon: '📷', name: 'Momentos Perfeitos', lang: 'HTML', cat: 'Fundamentos', rel: 36, site: 'https://matheusmerlim1.github.io/Momentos-perfeitos/', desc: 'Site de galeria fotográfica com layout elegante.' },
  'ProgramacaoClienteWeb': { icon: '💻', name: 'Programação Cliente Web', lang: 'HTML', cat: 'Fundamentos', rel: 32, site: 'https://matheusmerlim1.github.io/ProgramacaoClienteWeb/', desc: 'Estudos de programação client-side: HTML, formulários e eventos.' },
  'dart-fundamental': { icon: '🎯', name: 'Dart Fundamental', lang: 'Dart', cat: 'Fundamentos', rel: 30, desc: 'Programas básicos para aprendizado dos fundamentos do Dart.' },
  'LaboratorioArray': { icon: '📋', name: 'Laboratório de Arrays', lang: 'JavaScript', cat: 'Fundamentos', rel: 28, site: 'https://matheusmerlim1.github.io/LaboratorioArray/', desc: 'Exercícios de manipulação de arrays em JavaScript.' },
  'diagrama-o-3': { icon: '📐', name: 'Diagramação 3', lang: 'HTML', cat: 'Fundamentos', rel: 26, site: 'https://matheusmerlim1.github.io/diagrama-o-3/', desc: 'Terceiro projeto de diagramação com estrutura visual.' },
  'Diagramacao_MatheusRaposo': { icon: '🎨', name: 'Diagramação · Web', lang: 'CSS', cat: 'Fundamentos', rel: 24, site: 'https://matheusmerlim1.github.io/Diagramacao_MatheusRaposo/', desc: 'Exercícios de layout e estilização com HTML e CSS.' },
  'String-Data': { icon: '📅', name: 'String & Data', lang: 'JavaScript', cat: 'Fundamentos', rel: 22, site: 'https://matheusmerlim1.github.io/String-Data/', desc: 'Manipulação de strings e datas em JavaScript.' },
  'portifolio': { icon: '🗂️', name: 'Portfólio Original', lang: 'HTML', cat: 'Fundamentos', rel: 20, site: 'https://matheusmerlim1.github.io/portifolio/', desc: 'Versão anterior do portfólio pessoal em HTML.' },
};


// ── MONTAGEM DA LISTA ───────────────────────────────────
// A página se monta a partir da lista real de repositórios. PROJECT_META
// só melhora o que o GitHub não tem como saber (nome em português, ícone,
// categoria, relevância). Repositório novo entra sozinho.

// 'analisador-de_vibracao' -> 'Analisador de Vibracao'
const MINUSCULAS = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'no', 'na'];

function prettyName(repo) {
  return repo
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i > 0 && MINUSCULAS.includes(w.toLowerCase()))
      ? w.toLowerCase()
      : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function inferCat(repo, lang) {
  const n = repo.toLowerCase();
  if (/simulado|quest|prova|concurso|enfase/.test(n))      return 'Simulados';
  if (/^api|[-_]api|api[-_]|catalogo|cambio/.test(n))      return 'API';
  if (['Dart', 'Flutter', 'Kotlin', 'Swift'].includes(lang)) return 'Mobile';
  if (/diagram|laborat|fundamental|string|array|trabalho/.test(n)) return 'Fundamentos';
  return 'Web';
}

// projeto sem relevância definida a mão: quanto mais recente, mais acima
function autoRel(r) {
  const d = r && (r.pushed_at || r.updated_at);
  if (!d) return 45;
  const dias = (Date.now() - new Date(d).getTime()) / 86400000;
  if (dias <  30) return 84;
  if (dias < 180) return 70;
  if (dias < 365) return 58;
  return 45;
}

// site publicado: o homepage declarado no repo ou o GitHub Pages padrão
function autoSite(repo, r) {
  if (r && typeof r.homepage === 'string' && /^https?:\/\//.test(r.homepage)) return r.homepage;
  if (r && r.has_pages) return `https://${GITHUB_USER}.github.io/${repo}/`;
  return null;
}

function buildProjects(repoMap) {
  const nomes = Object.keys(repoMap).filter(n =>
    !IGNORE_REPOS.includes(n) && !(repoMap[n] && repoMap[n].fork)
  );
  // mantém os refinados mesmo se a API falhar ou não listá-los
  Object.keys(PROJECT_META).forEach(n => {
    if (!IGNORE_REPOS.includes(n) && !nomes.includes(n)) nomes.push(n);
  });

  return nomes.map(repo => {
    const r = repoMap[repo] || {};
    const m = PROJECT_META[repo] || {};
    const lang = m.lang || r.language || 'HTML';
    return {
      repo,
      icon:  m.icon || '\u{1F4E6}',
      name:  m.name || prettyName(repo),
      lang,
      cat:   m.cat  || inferCat(repo, lang),
      rel:   m.rel  != null ? m.rel : autoRel(r),
      site:  m.site || autoSite(repo, r),
      desc:  m.desc || r.description || 'Projeto publicado no GitHub.',
      curado: !!PROJECT_META[repo],
    };
  });
}

// começa com o que já está refinado; é remontada quando os dados chegam
let PROJECTS = buildProjects({});

// endereco principal de um projeto: o site publicado, quando existe
function projectUrl(p) {
  return p.site || ('https://github.com/' + GITHUB_USER + '/' + p.repo);
}


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
    const url  = projectUrl(p);
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
  const raw = el.textContent.trim();
  if (!el.dataset.target) el.dataset.target = raw.replace(/\D/g, '');
  if (!parseInt(el.dataset.target, 10)) return;
  const suffix = raw.replace(/[0-9]/g, '');
  const dur    = 1100;
  const start  = performance.now();
  el.dataset.animating = '1';
  function step(now) {
    // relê o alvo a cada quadro: se a contagem real chegar no meio do
    // caminho, a animação segue para o número novo em vez do antigo
    const target = parseInt(el.dataset.target, 10) || 0;
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
    else delete el.dataset.animating;
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
  const glowCards = '.exp-card, .proj-card, .recent-card';

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
