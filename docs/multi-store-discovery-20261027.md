# Busca de novas ofertas em outras lojas

POST /api/admin/busca-ofertas/descobrir recebe loja MERCADO_LIVRE ou MAGALU, consulta, limite e somentePromocoes. ADMIN e EDITOR podem consultar; a rota tem limitação de frequência e validação de entrada. Usa a integração interna já configurada com o ProjetoIA, sem copiar credenciais de marketplace para o navegador. A rota GET correspondente /status informa se essa integração está configurada.

Não cria ofertas durante a busca. A resposta conserva avisos e a indicação do marketplace. Falhas de acesso, timeout ou resposta inválida mostram uma mensagem utilizável. Não há migração de banco nem nova chave obrigatória.
