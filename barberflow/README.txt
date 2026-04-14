BarberFlow modular + login dev

O que entrou nesta versão:
- Login de desenvolvimento no front
- URL da API salva no navegador
- JWT salvo no localStorage para acelerar desenvolvimento
- Agenda conectada ao backend real em /api/appointments
- Estado visual de conexão no topo/rodapé

Como usar:
1. Publique os arquivos normalmente.
2. Clique em 'Login dev'.
3. Informe a URL pública do Railway, ex: https://seu-backend.up.railway.app
4. Informe o e-mail cadastrado no backend.
5. Clique em 'Entrar e salvar token'.
6. Abra o menu Agenda.

Observações:
- Este fluxo é só para desenvolvimento.
- Para produção, o ideal é migrar para cookie HttpOnly/sessão segura.
- O token fica salvo em localStorage para você não precisar logar a cada refresh.
