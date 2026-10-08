# Cleartech | Plataforma comercial de dados

Prova de conceito v0.1 para validar a jornada comercial e operacional com a diretoria, antes de concluir o planejamento detalhado e implantar o sistema real.

**Demonstração:** https://rogeriotpires-spec.github.io/cleartech-poc/

## Começar a apresentação

1. Abra o portal e clique em **Simular uma cotação → Usar exemplo**.
2. Confira os 12.000 registros sintéticos, os 10.800 documentos válidos e únicos e o preço progressivo demonstrativo.
3. Gere uma proposta de teste, simule o aceite e a concordância contratual.
4. Em **Acessar gestão → Pedidos e entregas**, simule a formalização comercial, o acompanhamento e a entrega.
5. Em **Validação da diretoria**, registre a avaliação e exporte as observações.

O [roteiro de apresentação](docs/roteiro-diretoria.txt) detalha a sequência. Os [limites desta versão](docs/escopo-e-limites.md) distinguem o que funciona localmente do que ainda depende de implantação.

## Limites importantes

Esta demonstração é pública. Não possui autenticação, banco de dados, servidor de negócios ou isolamento de produção entre empresas. Os perfis de acesso são ilustrativos.

Não envia nem lê e-mails, não executa IA conectada, não consulta bases de enriquecimento e não realiza assinatura, contratação, faturamento ou pagamento reais. Preços e capacidade operacional são fictícios; a minuta jurídica definitiva não foi fornecida.

Use somente dados de teste. A planilha de leads, mensagens originais e documentos internos não integram este repositório. A importação de leads é temporária, na memória do navegador, e é descartada ao recarregar. As alterações no cenário de demonstração e as avaliações ficam no armazenamento local de cada navegador, sem sincronização entre usuários. Exporte a avaliação antes de compartilhar seus resultados.

O conteúdo editado pelo painel de demonstração não modifica os arquivos deste repositório nem o site institucional da Cleartech.

## Arquivos

- `index.html`: entrada do GitHub Pages, com caminhos relativos.
- `src/`: aplicação, estilos, validação, precificação e leitura local de planilhas.
- `assets/cleartech-logo.svg`: cópia local da logomarca do site institucional.
- `tests/core.test.js`: 33 testes das regras locais.
- `tests/browser.test.py`: navegação e jornada de ponta a ponta com dados sintéticos.
- `docs/`: roteiro e delimitação da demonstração.
- `build.py`: gera, opcionalmente, uma versão HTML independente em `dist/index.html`.

A versão hospedada carrega seus recursos no mesmo domínio, sem bibliotecas externas. A política de conteúdo bloqueia conexões de dados com servidores. Isso não substitui os controles de segurança exigidos no produto definitivo.

## Testar localmente

```sh
python3 -m http.server 8080
```

Abra `http://localhost:8080/` no navegador. Para executar os testes das regras:

```sh
node tests/core.test.js
```

Os testes de navegador exigem Python, Playwright 1.57.0 e Chrome/Chromium. Também são executados pelo workflow `Validar PoC`.

Para gerar o HTML independente:

```sh
python3 build.py
```

## Publicação

O Pages utiliza a branch `main`, pasta `/(root)`, com `.nojekyll`. Alterações no repositório devem preservar a ausência de dados reais e a identificação de prova de conceito. O endereço do Pages é temporário para validação; o subdomínio oficial da Cleartech não foi configurado.

A identidade visual pertence à Cleartech. Este repositório não concede licença de uso da marca a terceiros.
