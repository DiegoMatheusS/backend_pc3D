# Cadastro e descrição técnica

Criação e edição de Produtos, Hardware, Notebooks e PCs aplicam a mesma limpeza de nome antes de persistir: retiram histórias, publicidade e sufixos comerciais, preservando modelo, variante, códigos e capacidades. Um texto sem identidade aproveitável exige nome ou modelo válido.

A busca de especificações abrange categorias cuja ficha fica em metadados. O retorno inclui `nomeTecnico` e `descricaoTecnica` como propostas para revisão. As especificações existentes, inclusive valores falsos e zero, são preservadas. Uma descrição já preenchida não é substituída ao aplicar lacunas.

Gerar descrição usa a ficha técnica persistida e suas unidades. IDs, metadados internos e textos comerciais não entram no resumo; uma ficha vazia pede pesquisa ou preenchimento antes da geração. Não é necessário pedir a um modelo de linguagem para inventar esse texto.

Este conjunto também integra o PR de likes e notificações da comunidade. A migração `20260917150000_corrigir_like_por_usuario` remove índices legados que limitavam um produto a um único like e garante a unicidade por usuário/produto. Execute `prisma migrate deploy` na implantação, pelo fluxo já usado pelo projeto.

As mudanças de nome se aplicam ao cadastrar ou salvar. Não foi executada alteração em massa nos dados existentes. Os testes de integração validam persistência do nome técnico, cadastro de PC com ofertas, sincronização de builds, autenticação e limites em PostgreSQL.
