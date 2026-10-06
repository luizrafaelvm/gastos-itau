# Saldo Livre — regras e validação

## Cálculo

Valores monetários são calculados em centavos inteiros. Saldo = orçamento mensal menos gastos líquidos do mês. Estornos negativos restauram o saldo. Disponível/dia = saldo positivo dividido pelos dias restantes, incluindo hoje, arredondado para baixo. O cálculo usa America/Sao_Paulo.

O último orçamento configurado se repete nos meses seguintes, até ser alterado. Sobras e déficits não são transferidos. O limite inicial deve ser definido pelo usuário. Datas sem ano e valores inválidos ocultam o saldo até a conferência. Possíveis duplicatas são sinalizadas sem exclusão automática.

## Parcelamentos

As parcelas preservam o total em centavos e usam datas completas. O dia é limitado ao último dia de cada mês. Operações interrompidas podem ser retomadas no mesmo aparelho, conferindo as parcelas gravadas antes de repetir. Durante uma operação parcial, o saldo é ocultado. Não recupere a mesma operação em dois aparelhos simultaneamente.

## Offline e widget

O app consulta a última cópia offline. Gravações exigem conexão. O widget mostra somente o saldo e o disponível/dia, adaptados ao tamanho escolhido. Atualização depende do iOS. Uma cópia antiga é marcada como desatualizada; dados do mês anterior não são apresentados como saldo do mês novo.

A configuração da conexão da conta está no guia de instalação fornecido separadamente ao proprietário.

## Desenvolvimento

Execute `npm install`, `npm test` e `npm run test:ui`. Os testes usam dados simulados. O teste Chromium adicional usa `npm run test:browser` e exige instalar o navegador Playwright. O download do Chromium não ficou disponível no ambiente desta rodada.

Regenere o script único com `python widget/build-widget.py` após alterar finance-core.js. Ao atualizar os arquivos do app, incremente a versão do service worker.

Validação real pendente: login no app instalado, conexão da conta ao widget e atualização do widget no iPhone.
