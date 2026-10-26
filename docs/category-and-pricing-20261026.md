# Preço médio do Hardware

O campo opcional mediaPrecoHardware armazena em decimal o preço estimado por unidade do Hardware. Criação e edição aceitam valor positivo com duas casas decimais, ou null para remover. O campo é publicado no catálogo técnico. A migração 20261026140000_hardware_preco_medio adiciona a coluna sem alterar valores existentes; o fluxo normal prisma migrate deploy deve ser executado antes de iniciar o backend atualizado. O teste PostgreSQL cobre criação, alteração, remoção e valor inválido.
