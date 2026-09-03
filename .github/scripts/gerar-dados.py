#!/usr/bin/env python3
"""Gera projects-data.json com os repositorios publicos do usuario.

Roda no GitHub Actions. So reescreve o arquivo quando algo de fato mudou,
para nao gerar um commit por hora sem motivo.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

USUARIO = 'matheusmerlim1'
SAIDA = 'projects-data.json'

# O proprio site e o repositorio de teste nunca entram na pagina.
IGNORAR = {'matheusmerlim1.github.io', 'repositorio_teste'}


def api(url):
    req = urllib.request.Request(url, headers={
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'portfolio-updater',
    })
    token = os.environ.get('GH_TOKEN')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def buscar_repos():
    repos, pagina = [], 1
    while True:
        url = ('https://api.github.com/users/%s/repos'
               '?per_page=100&sort=pushed&page=%d' % (USUARIO, pagina))
        lote = api(url)
        repos.extend(lote)
        if len(lote) < 100:
            return repos
        pagina += 1


def resumir(r):
    return {
        'name': r['name'],
        'description': r.get('description') or '',
        'url': r['html_url'],
        'homepage': r.get('homepage') or '',
        'has_pages': bool(r.get('has_pages')),
        'archived': bool(r.get('archived')),
        'language': r.get('language') or '',
        'topics': sorted(r.get('topics') or []),
        'updated_at': r['updated_at'],
        'pushed_at': r.get('pushed_at') or r['updated_at'],
    }


def resumo(texto):
    caminho = os.environ.get('GITHUB_STEP_SUMMARY')
    print(texto)
    if caminho:
        with open(caminho, 'a', encoding='utf-8') as f:
            f.write(texto + '\n')


def main():
    try:
        brutos = buscar_repos()
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        resumo('Falha ao consultar a API do GitHub: %s' % e)
        return 1

    projetos = [resumir(r) for r in brutos
                if r['name'] not in IGNORAR and not r.get('fork')]
    projetos.sort(key=lambda p: p['pushed_at'], reverse=True)

    anterior = None
    if os.path.exists(SAIDA):
        try:
            with open(SAIDA, encoding='utf-8') as f:
                anterior = json.load(f).get('projects')
        except (ValueError, OSError):
            anterior = None

    if anterior == projetos:
        resumo('Sem mudancas. %d projetos.' % len(projetos))
        return 0

    novos = []
    if anterior is not None:
        conhecidos = {p['name'] for p in anterior}
        novos = [p['name'] for p in projetos if p['name'] not in conhecidos]

    with open(SAIDA, 'w', encoding='utf-8') as f:
        json.dump({
            'updated': datetime.now(timezone.utc).isoformat(),
            'projects': projetos,
        }, f, ensure_ascii=False, indent=2)
        f.write('\n')

    resumo('Gravado projects-data.json com %d projetos.' % len(projetos))
    if novos:
        resumo('Projetos novos: %s' % ', '.join(novos))
    return 0


if __name__ == '__main__':
    sys.exit(main())
