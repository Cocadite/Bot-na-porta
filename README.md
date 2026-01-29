# pe-na-porta-bot (Painel aprova, bot executa)

## O que ele faz
- NÃO aprova nada.
- A cada X segundos:
  - busca aprovados na API: `GET /bot/approved`
  - dá o cargo no Discord
  - manda log no canal
  - marca como concluído: `POST /bot/mark-done`

## Setup rápido
1) `npm install`
2) copie `.env.example` para `.env` e preencha
3) `npm start`

## Permissões do bot no Discord
- Manage Roles (Gerenciar cargos)
- O cargo do bot precisa estar **ACIMA** do cargo que ele vai dar.
