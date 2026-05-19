# ADR-012: Backup Automático em Google Drive

## Status
Accepted

## Context
O AgroecologIA é projetado para virar a **memória externa da propriedade**. Perda de dados é catastrófica — significa perder histórico de manejos, ciclos de culturas, registros financeiros, fotos de campo, áudios de observações.

Cenários de risco:
1. Servidor de produção (Postgres na nuvem) cai e o provedor não consegue restaurar
2. Conta do produtor é comprometida ou banida no Supabase
3. Bug no produto deleta dados em produção (apesar do soft delete)
4. Migração futura de provedor — precisamos de export portável

A escolha durante a revisão foi clara: **Google Drive como destino de backup acessível**. O produtor já tem conta Google (usada para Gmail no ADR-005); Drive é familiar, acessível por qualquer dispositivo, e o usuário tem **controle real** sobre seus próprios backups.

## Decision

Adotar **backup automático diário em Google Drive do produtor** com export manual disponível a qualquer momento, e formato portável independente do AgroecologIA.

### O que é incluído no backup

**Backup completo (full):**
- Estado completo do banco de dados do usuário (todas as tabelas relacionadas a `user_id`)
- Operation log dos últimos 90 dias
- Snapshots arquivados (operations antes de 90 dias compactadas conforme ADR-002)
- Mídias: áudios, fotos e PDFs de manuais

**Não incluído:**
- Configurações do servidor (não pertencem ao usuário)
- Tokens OAuth (segurança)
- Caches efêmeros
- Modelos de Whisper local (re-baixáveis)

### Formato do backup

Arquivo único `.zip` com estrutura previsível:

```
agroecologia-backup-2026-05-08-030000.zip
├── manifest.json              ← versão, data, contagens, hashes
├── data/
│   ├── tasks.jsonl            ← uma entidade por linha (JSON Lines)
│   ├── cultures.jsonl
│   ├── lots.jsonl
│   ├── field_notes.jsonl
│   ├── harvests.jsonl
│   ├── financial_transactions.jsonl
│   ├── ... (uma jsonl por entidade)
│   └── operation_log.jsonl
├── media/
│   ├── audio/
│   │   └── <uuid>.opus
│   ├── photo/
│   │   └── <uuid>.webp
│   └── pdf/
│       └── <uuid>.pdf
└── README.txt                  ← instruções para restauração ou inspeção manual
```

**Por que JSONL e não SQL dump:** portabilidade. JSONL é legível por qualquer ferramenta — o usuário pode processar com `jq`, planilha, script Python — sem depender do AgroecologIA estar funcionando para ler. Em situação extrema (produto descontinuado, mudança de fornecedor), os dados continuam acessíveis.

### Frequência e retenção

- **Backup automático:** diário às 3h da manhã (horário local do produtor)
- **Retenção em Google Drive:** mantém últimos **30 backups diários** + **12 backups mensais** (snapshot do dia 1 de cada mês) + **5 backups anuais**. Backups mais antigos são deletados automaticamente
- **Backup manual:** disponível a qualquer momento via "Configurações → Backup → Exportar agora"

### Conexão com Google Drive

Reutiliza fluxo OAuth do Gmail (ADR-005 + ADR-009):

1. Onboarding pede consentimento para Drive na mesma autenticação Google que o Gmail
2. Token armazenado conforme política de criptografia do ADR-009 (AES-GCM com chave derivada por usuário)
3. App cria pasta `AgroecologIA/Backups` no Drive do usuário (escopo de pasta, não acesso completo)
4. Cada backup é um arquivo nessa pasta

**Escopo OAuth solicitado:** `https://www.googleapis.com/auth/drive.file` — permite criar e gerenciar **apenas arquivos criados pelo app**. Não dá acesso aos demais arquivos do Drive do usuário.

### Restauração

Restauração é fluxo **manual deliberado** — não é executado automaticamente em nenhum cenário, para evitar restauração acidental.

Fluxo:
1. Usuário acessa "Configurações → Backup → Restaurar"
2. Lista backups disponíveis no Drive com data e tamanho
3. Usuário seleciona um backup
4. Sistema mostra: "Atenção — restaurar substituirá os dados atuais por X (data Y). Isso é irreversível."
5. Usuário confirma digitando "RESTAURAR"
6. Sistema baixa o backup, valida hashes do manifest, aplica em transação atômica
7. Sucesso ou rollback completo — sem estado intermediário

A restauração é considerada operação de emergência. Não é fluxo cotidiano.

### Criptografia em repouso

O arquivo `.zip` no Drive é **criptografado** antes do upload com chave derivada da senha do usuário:

```
backup_key = HKDF-SHA256(user_password_hash, salt=user_id, info="backup_v1")
encrypted_zip = AES-256-GCM(backup_zip, key=backup_key)
```

Por quê: mesmo que o Drive seja comprometido, dados continuam ilegíveis sem a senha do usuário. Trade-off: **se o usuário esquecer a senha, perde acesso aos backups antigos**. Avisar isso explicitamente no fluxo de mudança de senha.

A senha **nunca trafega** para o Drive — apenas o cliente deriva a chave e criptografa. O servidor pode gerar o backup, mas o cliente é quem encripta antes do upload.

Alternativa considerada: criptografia opcional. Descartada — backups com dados financeiros e operacionais sem criptografia em serviço de terceiros é risco desnecessário. **Sempre criptografado.**

### Quando o backup falha

- Notificação no app: "Último backup falhou em DD/MM. Verificar conexão com Google Drive."
- Após 3 falhas consecutivas: alerta em destaque na home, com troubleshooting guiado
- Se o token OAuth expirou: solicitar reautenticação Google
- Se o quota do Drive está cheio: instruir o usuário a liberar espaço ou aumentar plano

Nunca fica silencioso. Backup falhou = usuário sabe.

### Validação de integridade

Cada backup gerado tem `manifest.json` com SHA-256 de cada arquivo de dados e mídia. Antes de upload e antes de restauração, hashes são validados — backup corrompido é detectado.

Job mensal: download aleatório de um backup e validação de integridade — alerta se backups antigos no Drive foram corrompidos.

### Export portável manual

Em qualquer momento, o usuário pode exportar todos os seus dados em um zip não criptografado para download local — não vai para o Drive. Útil para:
- Migração para outro produto
- Análise externa em planilha
- Backup adicional em destino próprio do usuário
- Compliance pessoal / portabilidade de dados (princípios de LGPD aplicados desde já)

## Alternatives considered

1. **Backup em S3 do AgroecologIA** — pros: controle do provedor, ferramentas maduras; cons: usuário não tem controle direto, custo aumenta linearmente com base de usuários, força confiança no provedor para preservar dados. Descartado — o princípio é que o usuário é dono dos seus dados.

2. **Apenas snapshot do banco no provedor (Supabase backups)** — pros: zero trabalho extra; cons: usuário não tem cópia, depende totalmente da Supabase manter os backups, formato proprietário. Descartado como única estratégia; mantido como camada adicional automática.

3. **Backup local em pendrive** — pros: zero dependência externa; cons: requer ação física do usuário, sem rotação automática, mídia falha. Descartado — não é prática real para um produtor focado no campo.

4. **Múltiplos destinos configuráveis (Drive, Dropbox, S3, FTP)** — pros: flexibilidade; cons: complexidade operacional alta para suportar e debugar. Descartado para o MVP. Drive cobre o caso de uso atual.

5. **Google Drive com criptografia client-side (decisão atual)** — pros: usuário tem controle real, formato portável, criptografia protege dados sensíveis, free tier do Drive cobre uso típico; cons: depende da Anthropic Google manter API estável, requer fluxo OAuth. Aceito.

## Consequences

- **Positivo:** o produtor tem controle real e auditável dos próprios dados.
- **Positivo:** formato portável (JSONL) garante longevidade dos dados além do produto.
- **Positivo:** integração simples — OAuth Google já é necessário para Gmail (ADR-005), reaproveita.
- **Positivo:** custo zero para o produto — backup roda no Drive do usuário.
- **Negativo:** se usuário esquecer a senha, backups criptografados ficam inacessíveis. Mitigação: avisar claramente e oferecer mecanismo de regeneração de chave em mudança de senha (re-criptografar backups recentes com a nova chave).
- **Risco:** Drive API tem rate limits. Backup diário de uma propriedade individual está bem dentro dos limits, mas múltiplos clientes simultâneos podem esbarrar em quotas globais — monitorar conforme escalar.
- **Risco:** mudança de termo de uso do Google pode afetar acesso. Mitigação: export manual portável funciona independentemente do Drive — o usuário pode salvar em outro destino se quiser.

## Impact on specs

- **Security spec:** política de criptografia client-side de backups deve ser detalhada. Documentar cenário de "esquecimento de senha" e como o usuário recupera.
- **Observability:** monitorar taxa de sucesso de backups, latência de upload, falhas de OAuth, erros de quota Drive.
- **Onboarding (feat-onboarding.md):** consentimento para Drive faz parte do fluxo de Google Sign-In já previsto. Ajustar texto do consentimento.
- **API:** endpoints `/api/backup/trigger` (manual), `/api/backup/list`, `/api/backup/restore` precisam ser implementados.
- **Data Architecture:** definir mapeamento entidade → JSONL para garantir reversibilidade. Toda entidade nova deve declarar como é serializada para backup.

## References

- [[adr-009-autenticacao]] — política de criptografia AES-GCM usada nos backups
- [[adr-005-integracao-bancaria]] — OAuth Google reutilizado; tokens armazenados conforme este ADR
- [[adr-002-sync-offline]] — operation log e snapshots incluídos no backup
- [[adr-013-notificacoes-multicanal]] — alerta de "Backup falhou" entregue via push/e-mail
- [[feat-onboarding]] — consentimento para Drive faz parte do fluxo Google Sign-In
- [[feat-caderno-de-campo]] — entradas (texto + áudio + foto) incluídas no backup
