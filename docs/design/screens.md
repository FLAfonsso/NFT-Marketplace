# Telas e decisões (Kurio)
Prints em docs/design/. Estados não desenhados seguem o mesmo padrão visual.

## Breakpoints
Mobile < 768 (layout dos frames mobile). Tablet 768-1023 (layout desktop compacto,
filtros em Sheet). Desktop >= 1024. Auditar em 390, 768 e 1440.

## Telas
- Início: hero com EXPLORAR (rola até o catálogo), abas Todos os NFTs / Novos lançamentos / Em alta
  (param view), sidebar de filtros (Coleções, Faixa de preço com Aplicar, Rede), ordenação,
  grid 3 colunas (9 por página), paginação 1-4. Card: imagem, nome, preço, badge RARO,
  preço antigo riscado, ações no hover (carrinho, favorito, ver). Mobile: busca "Explorar coleções",
  botão de filtros abre Sheet, grid 2 colunas, barra inferior.
- Detalhe: miniaturas + imagem com zoom (dialog), nome, preço, avaliação, descrição, Edição
  (1/1, 1/10, 1/50, ABERTA), quantidade, COMPRAR, Favoritar, ID do token, coleção, atributos,
  compartilhar, abas Detalhes/Avaliações, "Mais desta coleção".
- Carrinho: tabela NFTs/Preço/Edições(quantidade)/Total + lixeira, cupom, resumo
  (Subtotal, Desconto, Taxa de rede estimada, Total), "Conectar e finalizar", "Continuar explorando".
- Pagamento: formulário do colecionador, "Seus NFTs" com totais, cupom, Carteira e rede
  (WalletConnect, MetaMask, Coinbase Wallet), Confirmar compra. Carteiras cadastradas
  (Reserva/Principal, "Trocar carteira") como no mobile, nos dois tamanhos.
- Confirmação: modal centrado em desktop e página em mobile; ID da transação, data, total,
  carteira, itens, taxa, total. Só para pedido confirmado.
- Login e Cadastro: modal sobre Início no desktop, página cheia no mobile. Campos de login:
  e-mail e senha. Cadastro: usuário, e-mail, senha, confirmar senha.
- Perfil: Nome de exibição, Nome de usuário, E-mail, Nome ENS, Apelido da carteira, Avatar
  (Alterar/Remover), Alterar senha (atual, nova, confirmar), Salvar.
- Carteiras: Carteira principal (formulário) e Carteira secundária (Adicionar, "Igual à principal").

## Fora do escopo: visível, mas sem fingir sucesso
Botão ou link desabilitado (aria-disabled) com aviso "Indisponível nesta versão":
Criadores, Aprenda, Diário da Cunhagem (Ler mais), newsletter (Enviar), rodapé de ajuda,
Continuar com Google/Facebook, Esqueceu a senha?, botão central de scan (mobile),
Atividade, Ofertas, Arquivos baixados, Suporte, aba Avaliações (só mostra a nota agregada).
Ver no Etherscan abre o link com a referência simulada (documentar).
Heart do mobile e Lista de interesse levam à lista de favoritos (/favorites).

## Inconsistências do Figma (decisão)
1. Carrinho mobile: subtotal 8.92, mas os itens somam 8.14. Usar o valor calculado.
2. ID do token difere entre carrinho e pagamento. Usar o número do nome (#314 = #0314).
3. Chips mobile repetem "1/10". Usar 1/1, 1/10, 1/50, ABERTA (desktop).
4. Um card da Home desktop está sem nome e preço. Todo card tem os dois.
5. "Ordenar por" sobrepõe o ícone da seta. Corrigir.
6. Contagens dos filtros (33, 12...) não batem entre si. Calcular pela API.
7. Pagamento desktop: primeira opção de carteira só tem uma pílula de logos. Usar as 3 do mobile.
8. Código de indicação e Nome ENS marcados obrigatórios. Seguir o layout; usuários de teste
   têm um código fictício no README.
9. Cabeçalho mostra "Entrar" mesmo logado. Logado: avatar/nome com menu e Sair.
10. Separador decimal: "0,02 - 12,30" na faixa e "1.19" nos preços. Usar ponto em tudo.
11. Avaliação: estrelas + "19 avaliações" (desktop) e "4.8 (19)" (mobile). Mostrar nota e contagem.

## Estados não desenhados (seguir o padrão)
Skeletons, vazio, erro com "Tentar de novo", pedido pendente e recusado, sessão expirada,
conexão da carteira (conectando, recusada, desconectada), preço alterado, edição esgotada,
limite de quantidade, mensagem de campo inválido.

## Assets (public/assets)
- Eape.png: Emerald Ape
- Sape.png: Sage Nomad
- Nape.png: macaco preto de blazer (Neon Vessel, Ivory Baron)
- Gape.png: macaco laranja de fone (Golden Beat, Golden Signal)
- tyou.png: ícone "Thank you" da confirmação
- Logo: texto "KURIO", sem imagem. Ícones pequenos: lucide-react.