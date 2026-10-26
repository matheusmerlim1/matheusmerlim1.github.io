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

// commit nos últimos 7 dias
function isFresh(dateStr) {
  return Date.now() - new Date(dateStr).getTime() < 7 * 86400000;
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
    if (isFresh(date)) badge.classList.add('recent');
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

  renderProjects();
  updateCounts();
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
  banner.className = 'toast';
  banner.innerHTML = `<strong>Commits novos!</strong><br>${updated.map(esc).join(', ')}`;
  banner.addEventListener('click', () => banner.remove());
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 9000);
}

// contagens que dependem de quantos repositórios existem
function updateCounts() {
  const n = String(PROJECTS.length);
  ['fact-repos', 'pl-total'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = n;
  });
}

// anos completos desde data-desde ("AAAA-MM"), ex: 1 ano e 9 meses -> "1+"
function updateYears() {
  document.querySelectorAll('[data-desde]').forEach(el => {
    const [ano, mes] = el.dataset.desde.split('-').map(Number);
    const hoje = new Date();
    const meses = (hoje.getFullYear() - ano) * 12 + (hoje.getMonth() + 1 - mes);
    const anos = Math.max(1, Math.floor(meses / 12));
    el.textContent = anos + '+';
    el.nextSibling.textContent = anos > 1 ? 'anos em engenharia' : 'ano em engenharia';
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ── LISTA DE PROJETOS ─────────────────────────────────────────
// Uma lista só, compacta: começa nos mais recentes e mostra LIST_LIMIT
// linhas; busca e categoria mostram tudo o que casar.
const LIST_LIMIT = 8;
const LIST_CATS  = ['Todas', 'Engenharia', 'Web', 'Simulados', 'Mobile', 'API', 'Fundamentos'];
const LANG_CLASS = {
  JavaScript: 'lc-js', HTML: 'lc-html', CSS: 'lc-css',
  Dart: 'lc-dart', Flutter: 'lc-flutter', Python: 'lc-python',
};
const plState = { q: '', cat: 'Todas', sort: 'recent', all: false };

// "Engenharia" junta tudo do grupo eng, de qualquer categoria
function inCat(p, cat) {
  if (cat === 'Todas') return true;
  if (cat === 'Engenharia') return p.grupo === 'eng';
  return p.cat === cat;
}

function plMatches(p, q) {
  if (!q) return true;
  return (p.name + ' ' + p.desc + ' ' + p.lang + ' ' + p.repo + ' ' + p.cat)
    .toLowerCase().includes(q);
}

function repoDate(p) {
  const r = REPO_DATA[p.repo];
  return r ? (r.pushed_at || r.updated_at) : null;
}

function plSorted(list) {
  const arr = list.slice();
  if (plState.sort === 'name') {
    arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } else if (plState.sort === 'recent') {
    arr.sort((a, b) => {
      const da = repoDate(a), db = repoDate(b);
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

function renderChips() {
  const box = document.getElementById('pl-cats');
  box.innerHTML = LIST_CATS.map(cat => {
    const n = PROJECTS.filter(p => inCat(p, cat)).length;
    if (!n) return '';
    return `<button type="button" class="pl-chip" data-cat="${cat}" aria-pressed="${cat === plState.cat}">${cat}<span class="pl-n">${n}</span></button>`;
  }).join('');
}

function projectRow(p, query) {
  const date    = repoDate(p);
  const repoUrl = `https://github.com/${GITHUB_USER}/${p.repo}`;
  return `
    <li class="pl-row">
      <span class="pl-icon" aria-hidden="true">${p.icon}</span>
      <div class="pl-main">
        <a class="pl-name" href="${projectUrl(p)}" target="_blank" rel="noopener">${highlight(esc(p.name), query)}</a>
        <p class="pl-desc">${esc(p.desc)}</p>
      </div>
      <span class="pl-meta"><span class="lang-dot ${LANG_CLASS[p.lang] || 'lc-html'}"></span>${esc(p.lang)}</span>
      <span class="pl-when${date && isFresh(date) ? ' recent' : ''}">${date ? timeAgo(date) : ''}</span>
      ${p.site
        ? `<a class="pl-code" href="${repoUrl}" target="_blank" rel="noopener" aria-label="Código de ${esc(p.name)}">código</a>`
        : '<span class="pl-code pl-code-gh">GitHub</span>'}
    </li>`;
}

function renderProjects() {
  const list = document.getElementById('pl-list');
  if (!list) return;
  renderChips();

  const query    = plState.q.trim();
  const matches  = plSorted(PROJECTS.filter(p => inCat(p, plState.cat) && plMatches(p, query.toLowerCase())));
  const filtered = !!query || plState.cat !== 'Todas';
  const shown    = (filtered || plState.all) ? matches : matches.slice(0, LIST_LIMIT);

  list.innerHTML = shown.map(p => projectRow(p, query)).join('');
  document.getElementById('pl-empty').hidden = matches.length > 0;

  const more = document.getElementById('pl-more');
  more.hidden = filtered || matches.length <= LIST_LIMIT;
  more.textContent = plState.all ? 'Mostrar menos' : `Mostrar todos os ${matches.length} projetos`;
  more.setAttribute('aria-expanded', String(plState.all));

  document.getElementById('pl-status').textContent =
    `${matches.length} projeto${matches.length !== 1 ? 's' : ''}`;
}

function setCat(cat) {
  plState.cat = cat;
  renderProjects();
}

function plReset() {
  plState.q = '';
  plState.cat = 'Todas';
  document.getElementById('pl-input').value = '';
  renderProjects();
}

function focusSearch() {
  document.getElementById('projetos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('pl-input').focus({ preventScroll: true });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('pl-input');
  const sort  = document.getElementById('pl-sort');
  if (!input) return;

  input.addEventListener('input', () => { plState.q = input.value; renderProjects(); });
  input.addEventListener('keydown', e => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); plReset(); } });
  sort.addEventListener('change', () => { plState.sort = sort.value; renderProjects(); });

  document.getElementById('pl-cats').addEventListener('click', e => {
    const chip = e.target.closest('.pl-chip');
    if (chip) setCat(chip.dataset.cat);
  });
  document.getElementById('pl-more').addEventListener('click', () => {
    plState.all = !plState.all;
    renderProjects();
    if (!plState.all) document.getElementById('pl').scrollIntoView({ block: 'nearest' });
  });
  document.getElementById('pl-clear').addEventListener('click', plReset);

  // atalhos do topo: "Engenharia Mecânica" já abre a lista filtrada
  document.querySelectorAll('[data-filter]').forEach(a => {
    a.addEventListener('click', () => setCat(a.dataset.filter));
  });

  document.getElementById('nav-search-btn').addEventListener('click', focusSearch);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); focusSearch(); }
  });

  renderProjects();
});

// site: pagina publicada (quando existe) · cat: categoria · rel: peso de relevancia
// Repositórios que nunca entram na página.
const IGNORE_REPOS = ['matheusmerlim1.github.io', 'repositorio_teste'];

// Refinamento manual, opcional e por repositório. O que não estiver aqui
// entra na página do mesmo jeito, usando os dados que vierem do GitHub.
// Campos: icon, name, lang, cat, rel (0-100), site, desc.
const PROJECT_META = {
  'analise-financeira': { icon: '💹', name: 'Análise Financeira', lang: 'JavaScript', cat: 'Web', rel: 97, site: 'https://matheusmerlim1.github.io/analise-financeira/', desc: 'Lê extratos da XP, da B3 e do IR, mostra o patrimônio e avalia cada investimento. Previsão do Ibovespa, buscador de renda fixa por plataforma e montagem de carteira, atualizados sozinhos pelo GitHub Actions.' },
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

// Ícone de projeto novo: procura palavras-chave no nome, na descrição e nos
// topics do repositório. A primeira regra que casar vence, então as mais
// específicas ficam no topo. Texto comparado sem acento e em minúsculas.
const ICON_RULES = [
  [/compilador|compiler|\bgcc\b|linguagem c\b|\bem c\b/, '🧰'],
  [/pdf/,                                          '📄'],
  [/criptograf|encript|encrypt|\bsenhas?\b|password|seguranca|security|\blogin\b/, '🔒'],
  [/\bia\b|\bai\b|\bgpt\b|\bllm|claude|inteligencia artificial|machine learning|neural/, '🤖'],
  [/simulado|\bquest|\bprovas?\b|concurso|\bquiz|enfase|\bexames?\b/, '📝'],
  [/\bcnc\b|usinag|\btorno\b|fresa/,               '🛠️'],
  [/\bviga|perfil [wiuh]\b|contravent|gusset|icament|estrutura metalica|\bvao\b|trelica|\baco\b/, '🏗️'],
  [/vibra|mecanic|engrenag|\bmotor|maquina|\beixos?\b|\bmolas?\b/, '⚙️'],
  [/solda|tubulac|caldeira|petro|\boleo\b|\bgas\b/, '🛢️'],
  [/\b3d\b|render|\bstl\b|\bcad\b/,             '🧊'],
  [/imagem|image|\bfotos?\b|photo|galeria|camera/,  '📷'],
  [/previsao do tempo|\bclima|weather|meteorolog/,   '🌤️'],
  [/\bfilmes?\b|movie|cinema/,                      '🎬'],
  [/musica|music|\baudio\b|\bsom\b/,              '🎵'],
  [/\bjogos?\b|\bgames?\b|board ?game|tabuleiro|puzzle|quebra.?cabeca|xadrez/, '🎲'],
  [/\blivros?\b|livraria|\bbooks?|biblioteca/,     '📚'],
  [/despesa|financ|\bgastos?\b|orcament|dinheiro|\bprecos?\b|cambio|\bmoedas?\b/, '💰'],
  [/\blojas?\b|\bshop|\bstore\b|carrinho|ecommerce|\bvendas?\b/, '🛒'],
  [/comida|receita|\bcafe|restaurante|cardapio|recipe/, '☕'],
  [/\bmapas?\b|\bmaps?\b|\bgeo|localiz|\brotas?\b/, '🗺️'],
  [/agenda|calend|\bdatas?\b|\bdates?\b|horario/,  '📅'],
  [/\bchat|mensag|\bmessag|\bbot\b/,               '💬'],
  [/\bbusca|search|pesquis|finder/,                 '🔎'],
  [/planilha|excel|\bcsv\b|tabela|relatorio|dashboard|grafico|chart/, '📊'],
  [/lista de corte|nesting|\bcortes?\b/,            '✂️'],
  [/calcul|matemat|\bmath|smath|formula/,           '🧮'],
  [/\bapis?\b/,                                    '🔌'],
  [/portfolio|portifolio|curriculo/,                 '🗂️'],
  [/diagram|layout|\bcss\b|design|estilo/,          '🎨'],
  [/\bguias?\b|tutorial|passo a passo|\bmanual\b/, '🧭'],
  [/estudo|\baulas?\b|disciplina|exercicio|laborat|fundament|trabalho/, '📖'],
];

// sem palavra-chave: decide pela categoria e, em último caso, pela linguagem
const ICON_BY_CAT  = { Simulados: '📝', API: '🔌', Mobile: '📱', Fundamentos: '📖' };
const ICON_BY_LANG = {
  Python: '🐍', JavaScript: '🟨', TypeScript: '🔷', HTML: '🌐', CSS: '🎨',
  C: '🧰', 'C++': '🧰', 'C#': '🟪', Java: '☕', Dart: '🎯', Flutter: '📱',
  Kotlin: '📱', Swift: '📱', Go: '🐹', Rust: '🦀', PHP: '🐘', Shell: '💻',
};

function semAcento(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// O nome e os topics dizem do que o projeto trata; a descrição costuma citar
// detalhes ("simulados", "imagem") que enganariam. Por isso o nome vem antes.
function inferIcon(repo, r, lang, cat) {
  const textos = [
    repo.replace(/[-_]+/g, ' ') + ' ' + (r.topics || []).join(' '),
    r.description || '',
  ].map(semAcento);
  for (const texto of textos)
    for (const [re, icon] of ICON_RULES) if (re.test(texto)) return icon;
  return ICON_BY_CAT[cat] || ICON_BY_LANG[lang] || '\u{1F4E6}';
}

// Engenharia x Sistemas, usado no "Ordenar" da coluna lateral.
// Vale, nesta ordem: grupo: 'eng' | 'sis' no PROJECT_META, areas marcadas
// ('mec', 'fisica') e, para repositório novo, palavras-chave de engenharia.
const ENG_RE = /engenhar|mecanic|estrutural|estruturas? (metalicas?|de aco)|\bviga|perfil [wiuh]\b|contravent|gusset|icament|trelica|\bvao\b|\bnbr\b|\bcnc\b|usinag|vibra|engrenag|solda|tubulac|caldeira|petro|smath|ftool|lista de corte|corte de chapa|chapas? e barras|\bcad\b|perfis? metalic|perfilario|parafus|barras? roscad/;

function inferGrupo(repo, r, m) {
  if (m.grupo === 'eng' || m.grupo === 'sis') return m.grupo;
  if ((m.areas || []).length) return 'eng';
  const texto = semAcento([repo.replace(/[-_]+/g, ' '), m.desc || '', r.description || ''].join(' '));
  return ENG_RE.test(texto) ? 'eng' : 'sis';
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
    const cat  = m.cat  || inferCat(repo, lang);
    return {
      repo,
      icon:  m.icon || inferIcon(repo, r, lang, cat),
      name:  m.name || prettyName(repo),
      lang,
      cat,
      grupo: inferGrupo(repo, r, m),
      rel:  m.rel  != null ? m.rel : autoRel(r),
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

// ── ANIMATIONS ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.fade-in').forEach(el => io.observe(el));

  updateYears();
  loadProjects();
});
