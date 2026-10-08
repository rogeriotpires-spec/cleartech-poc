"""Test the modular PoC with synthetic data, serving files through browser routing."""
from pathlib import Path
from urllib.parse import urlparse
import json
import mimetypes
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://cleartech-poc.test'
errors = []
external = []
checks = []

def serve(route):
    url = urlparse(route.request.url)
    if url.netloc != 'cleartech-poc.test':
        external.append(route.request.url)
        route.abort()
        return
    path = (ROOT / (url.path.lstrip('/') or 'index.html')).resolve()
    if ROOT not in path.parents or not path.is_file():
        route.fulfill(status=404, body='Not found')
        return
    route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path.name)[0] or 'application/octet-stream')

def nav(page, name):
    page.evaluate('(name) => {location.hash="/"+name}', name)
    page.wait_for_timeout(120)

def click(page, action):
    page.locator('[data-action="' + action + '"]').first.click()

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
    context = browser.new_context(accept_downloads=True, viewport={'width':1440, 'height':1000})
    context.route('**/*', serve)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(ORIGIN + '/', wait_until='networkidle')
    assert page.locator('h1').inner_text().startswith('Dados melhores.')
    assert page.locator('.brand-logo').evaluate('(img) => img.complete && img.naturalWidth > 0')
    checks.append('portal_and_logo')
    for name in ['gestao','leads','campanhas','propostas','pedidos','indicadores','precos','conteudo','auditoria','validacao','cotacao','cliente']:
        nav(page, name)
        assert page.locator('h1').count() > 0, name
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), name
        checks.append('route:' + name)
    nav(page, 'cotacao')
    click(page, 'use-sample')
    result = page.evaluate('CT_TEST.getQuote().analysis')
    assert [result[k] for k in ['total','eligible','cpf','cnpj','duplicated','invalid','missing']] == [12000,10800,8100,2700,800,300,100]
    assert '1.630' in page.locator('.price-total').inner_text()
    click(page, 'quote-contact')
    page.locator('#quote-understood').check()
    click(page, 'create-proposal')
    proposal = page.evaluate('CT_TEST.getQuote().proposal')
    click(page, 'accept-proposal')
    page.locator('#accept-authorized').check()
    page.locator('#accept-verified').check()
    click(page, 'confirm-accept')
    click(page, 'contract-consent')
    page.wait_for_timeout(150)
    order = page.evaluate('(id) => CT_TEST.getState().orders.find(o => o.proposal===id)', proposal)
    assert order['status'] == 'Formalização comercial'
    nav(page, 'pedidos')
    page.locator('[data-action="order-detail"][data-id="' + order['id'] + '"]').click()
    click(page, 'formalize')
    page.locator('#formal-power').check()
    page.locator('#formal-confirm').check()
    click(page, 'confirm-formalize')
    updated = page.evaluate('(id) => CT_TEST.getState().orders.find(o => o.id===id)', order['id'])
    assert updated['contracted'] and updated['tech'] != 'Não atribuído'
    page.locator('[data-action="order-detail"][data-id="' + order['id'] + '"]').click()
    click(page, 'add-pending')
    page.locator('#pending-body').fill('Confirmar os campos da planilha sintética.')
    click(page, 'save-pending')
    click(page, 'pending-reply')
    click(page, 'save-pending-reply')
    click(page, 'pending-resolve')
    click(page, 'complete-order')
    click(page, 'confirm-complete')
    nav(page, 'cliente')
    click(page, 'client-order')
    with page.expect_download() as event:
        click(page, 'delivery-download')
    assert 'DEMONSTRACAO' in event.value.suggested_filename
    click(page, 'close-modal')
    checks.append('quote_to_delivery')
    nav(page, 'gestao')
    page.locator('#role-select').select_option('operator')
    assert page.locator('a.nav-link[href="#/precos"]').count() == 0
    assert 'Valor contratado' not in page.locator('main').inner_text()
    page.locator('#role-select').select_option('admin')
    checks.append('role_views')
    nav(page, 'campanhas')
    click(page, 'reply-select')
    click(page, 'reply-select-confirm')
    page.locator('#incoming-reply').fill('Por favor, retire meu endereço dos contatos.')
    click(page, 'classify-reply')
    assert page.locator('#reply-classification').input_value() == 'Descadastramento'
    click(page, 'approve-response')
    assert page.evaluate('CT_TEST.getState().leads.some(l => l.blocked)')
    checks.append('opt_out_and_approval')
    original_price = page.evaluate('CT_TEST.getState().proposals[0].price.totalCents')
    nav(page, 'precos')
    page.locator('.tier-price').first.fill('0.3')
    click(page, 'save-prices')
    assert page.evaluate('CT_TEST.getState().proposals[0].price.totalCents') == original_price
    nav(page, 'conteudo')
    page.locator('#cms-title').fill('Título de teste.\nPublicação local.')
    click(page, 'cms-save')
    nav(page, 'site')
    assert 'Título de teste' in page.locator('h1').inner_text()
    nav(page, 'conteudo')
    click(page, 'cms-restore')
    nav(page, 'site')
    assert 'Dados melhores' in page.locator('h1').inner_text()
    checks.append('price_and_content_versions')
    csv = page.evaluate('CTCore.toCSV(CTCore.createSample())')
    page.evaluate('CT_TEST.getQuote().step=1')
    nav(page, 'cotacao')
    page.locator('#quote-file').set_input_files({'name':'base-sintetica.csv','mimeType':'text/csv','buffer':csv.encode('utf-8')})
    page.locator('[data-action="validate-quote"]').wait_for()
    click(page, 'validate-quote')
    assert page.evaluate('CT_TEST.getQuote().analysis.eligible') == 10800
    checks.append('csv_upload')
    page.set_viewport_size({'width':390, 'height':844})
    for name in ['site','gestao']:
        nav(page, name)
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), 'mobile:' + name
    checks.append('mobile_390px')
    assert not errors, errors
    assert not external, external
    print(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors,'external_requests':external}, ensure_ascii=False, indent=2))
    browser.close()
