# Gastos Itaú 💳

Dashboard mobile para acompanhar gastos do cartão Itaú em tempo real.

## Como funciona

- Autentica via Microsoft 365 (conta corporativa)
- Lê os dados da planilha **GastosCartao.xlsx** no OneDrive/SharePoint
- Exibe total do mês, gastos de hoje, ticket médio e lista de transações

## Acesso

🌐 https://luizrafaelvm.github.io/gastos-itau/

## Tecnologias

- HTML + CSS + JavaScript (vanilla)
- MSAL.js 2.x para autenticação Microsoft
- Microsoft Graph API para leitura do Excel no OneDrive
- GitHub Pages para hospedagem
# Saldo Livre — Gastos 2.0

Evolução do dashboard pessoal Itaú para mostrar **quanto ainda posso gastar no mês e por dia**. Mantém Excel/OneDrive, login Microsoft e a automação existente.

- Orçamento por mês, saldo grande e disponível/dia, sem barras.
- Lançamentos manuais, estornos, categorias, notas e exportação CSV.
- Parcelamentos com centavos exatos, datas completas e recuperação de falhas.
- PWA com leitura offline em IndexedDB e ícones para iPhone.
- Widget Scriptable com login Microsoft próprio e tokens no Keychain.

[Instalação no iPhone](https://luizrafaelvm.github.io/gastos-itau/docs/INSTALACAO.html) · [Operação e limitações](docs/OPERACAO.md) · [Script do widget](widget/Saldo-Livre.js)

A conexão do app é importada de um JSON local. A configuração da conexão do widget está no guia de instalação entregue separadamente. Nenhuma senha ou segredo deve ser adicionado ao repositório. Não define R$ 5.000 automaticamente nem altera dados históricos sem ação do usuário.

Testes: `npm install` → `npm test` → `npm run test:ui`. Teste adicional em Chromium: `npm run test:browser` (requer `npx playwright install chromium`). Regerar widget: `python widget/build-widget.py`.

---
