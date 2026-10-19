# Tarefa 07 — Cadastro da organização

- **Marco:** M1 — Cadastro e acesso
- **Status:** ⬜
- **Objetivo:** `POST /organizations` criando tudo numa transação.
- **Entrega:** organização (slug gerado), licença de 30 dias, filial Matriz, OWNER, departamento padrão "Atendimento".
- **Como conferir:** testes de criação completa; rollback quando uma etapa falha; validações (CPF/CNPJ, telefone, senhas diferentes, termos não aceitos); conflitos de CPF/CNPJ e e-mail (`409`); slug repetido recebe sufixo.
- **Depende de:** 03, 04, 05, 06.
- **Tamanho:** grande.
