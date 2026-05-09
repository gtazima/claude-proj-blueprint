# ADR-005: Estratégia de Integração Bancária

## Status
Accepted

## Context
O módulo Financeiro precisa importar transações bancárias para classificação automática e cálculo de custo por cultura. A propriedade usa C6 Bank hoje, com possível migração para Caixa Econômica Federal.

Existem três abordagens técnicas possíveis para obter os dados bancários:

1. **Open Finance Brasil** — API regulamentada pelo Banco Central, acesso direto com consentimento do usuário
2. **Importação manual de extrato** — arquivo OFX ou CSV exportado pelo internet banking
3. **Leitura de e-mails de notificação** — parsing dos e-mails de notificação de transação enviados pelo banco

Cada abordagem tem tradeoffs significativos de complexidade, tempo de implementação e experiência do usuário. A decisão impacta diretamente o cronograma do MVP.

## Decision

Adotar **estratégia em camadas com prioridade de simplicidade no MVP**, implementando as três abordagens como adapters independentes — da mais simples para a mais completa:

**Fase 1 (MVP):** OFX/CSV + E-mail
**Fase 2 (pós-MVP):** Open Finance

### Fase 1 — OFX/CSV e E-mail

#### Adapter OFX/CSV
O produtor exporta o extrato do internet banking e importa no sistema. Suportado por todos os bancos brasileiros.

```
Fluxo:
1. Produtor acessa internet banking → exporta extrato OFX ou CSV
2. No app: Financeiro → Importar extrato → seleciona arquivo
3. Sistema parseia, deduplicar transações já importadas (por hash de id+data+valor)
4. Transações novas entram na fila de classificação por IA
```

Parsing OFX é padronizado (SGML/XML). CSV varia por banco — implementar parsers específicos para C6 e Caixa com fallback para formato genérico.

#### Adapter E-mail (C6 e Caixa)
C6 e Caixa enviam notificações por e-mail a cada transação. O sistema lê esses e-mails e extrai os dados da transação via parsing + IA.

```
Fluxo:
1. Produtor autoriza acesso à conta de e-mail (OAuth Gmail/Outlook)
2. Worker monitora caixa de entrada por e-mails dos domínios bancários configurados
3. Parser extrai: valor, tipo (débito/crédito), descrição, data
4. Transação entra na fila de classificação por IA
5. Deduplicação por hash antes de inserir
```

O parsing de e-mail é frágil por natureza — bancos mudam o formato sem aviso. Mitigação: usar IA para extrair dados do e-mail quando o parser estruturado falhar, com log de confiança da extração.

Nota: o projeto anterior (`old/fazenda-dashboard`) já tinha um módulo de leitura de e-mails do C6 (`modules/gmail.py`). Avaliar reaproveitamento da lógica de autenticação OAuth e parsing.

### Fase 2 — Open Finance Brasil

Open Finance Brasil requer (para acesso a dados de transações — leitura):
- Certificado digital ICP-Brasil
- Registro como **Provedor de Serviço de Informação de Conta (AISP)** no Banco Central — papel correto para ler dados de transações de clientes que autorizam o acesso. ITP (Instituição Iniciadora de Transação de Pagamento) é para iniciar pagamentos, escopo diferente
- Processo de homologação técnica e aprovação regulatória que pode levar meses
- Infraestrutura de segurança específica (mTLS, FAPI 1.0 Advanced)
- Custo recorrente de infraestrutura e certificação significativo (a confirmar com pesquisa atualizada)

**Decisão:** não bloquear o MVP por Open Finance. Iniciar o processo de certificação em paralelo com o desenvolvimento do MVP. Quando aprovado, implementar o adapter de Open Finance como terceira opção sem alterar os outros.

```python
# src/api/modules/financeiro/bank_adapters/
├── base.py           → interface BankAdapter (similar ao AIProvider)
├── ofx_csv.py        → parsing de arquivos OFX e CSV
├── email_parser.py   → parsing de e-mails de notificação
└── open_finance.py   → Open Finance Brasil (Fase 2)
```

### Interface BankAdapter

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

@dataclass
class BankTransaction:
    external_id: str        # id único no banco (para deduplicação)
    date: datetime
    amount: float           # positivo = crédito, negativo = débito
    description: str        # descrição original do banco
    bank: str               # "c6" | "caixa" | "outro"
    source: str             # "ofx" | "csv" | "email" | "open_finance"

class BankAdapter(ABC):
    
    @abstractmethod
    async def fetch_transactions(
        self,
        since: datetime
    ) -> list[BankTransaction]: ...
    
    @abstractmethod
    async def test_connection(self) -> bool: ...
```

### Deduplicação

Transações são deduplicadas por `(external_id, bank)` antes de inserir. Para e-mails onde `external_id` não está disponível, usar hash de `(date, amount, description[:50])`.

Transações duplicadas são silenciosamente ignoradas — não geram erro, apenas log de debug.

### Configuração por instalação

```yaml
# config/banking.yaml
banks:
  - name: C6
    adapter: email_parser
    email_domain: "c6bank.com.br"
    
  - name: Caixa
    adapter: ofx_csv      # fallback manual até Open Finance
    
# Quando Open Finance estiver disponível:
  - name: C6
    adapter: open_finance
    client_id: ${C6_OPEN_FINANCE_CLIENT_ID}
```

## Alternatives considered

1. **Open Finance como única estratégia** — pros: automação completa, sem ação manual do usuário; cons: processo de certificação bloqueia o MVP por 3-6 meses, custo de certificado e infraestrutura, complexidade técnica alta. Descartado para o MVP.

2. **Screen scraping do internet banking** — pros: funciona sem API; cons: ilegal nos termos de uso da maioria dos bancos, frágil a mudanças de layout, risco jurídico sério. Descartado.

3. **Apenas importação manual OFX/CSV** — pros: simples, zero risco; cons: experiência ruim — o produtor precisa lembrar de exportar e importar manualmente. Minimiza o valor da integração. Aceito apenas como fallback, não como estratégia principal.

4. **OFX/CSV + E-mail no MVP, Open Finance pós-MVP (decisão atual)** — pros: lança rápido, cobre os casos de uso reais com boa automação via e-mail, evolui para Open Finance sem breaking change; cons: parsing de e-mail é frágil. Aceito — a fragilidade do e-mail é mitigada pela IA como fallback de parsing e pela deduplicação robusta.

## Consequences

- **Positivo:** MVP não é bloqueado por processo burocrático de certificação Open Finance.
- **Positivo:** lógica de autenticação OAuth do Gmail já existe no projeto anterior (`old/fazenda-dashboard`) — reaproveitamento reduz tempo de desenvolvimento.
- **Positivo:** arquitetura de adapters permite adicionar Open Finance no futuro sem alterar código de negócio.
- **Negativo:** parsing de e-mail é frágil — bancos mudam templates sem aviso. Requer monitoramento ativo e atualização do parser quando o formato mudar.
- **Negativo:** importação OFX/CSV exige ação manual do produtor. Frequência de importação depende da disciplina do usuário.
- **Risco:** Open Finance pode nunca ser aprovado ou pode ser excessivamente custoso para uma startup. Mitigação: e-mail + OFX funcionam indefinidamente como solução permanente para clientes menores.

## Impact on specs

- **Security:** tokens OAuth de acesso ao Gmail devem ser armazenados criptografados. Acesso à caixa de entrada de e-mail é superfície sensível — o sistema deve acessar apenas e-mails dos domínios bancários configurados, nunca varrer a caixa inteira.
- **Compliance:** Open Finance requer conformidade com regulamentações do Banco Central (Resolução Conjunta nº 1/2020). Iniciar análise de requisitos em paralelo com o MVP. Registrar em ADR separado quando o processo de certificação iniciar.
- **Observability:** monitorar taxa de sucesso do parsing de e-mail por banco. Alertar quando a taxa de falha de parsing subir acima de 10% — indica mudança de template do banco.
- **Data Architecture:** transações são append-only — nunca deletar, apenas estornar. `external_id` e `source` são campos obrigatórios para rastreabilidade e deduplicação.
- **Financeiro (feat-financeiro.md):** AC-1 a AC-4 dependem diretamente deste ADR.

## References
- PRD: `docs/product/feat-financeiro.md`
- Referência de código: `old/fazenda-dashboard/modules/gmail.py` (lógica OAuth reutilizável)
- Regulamentação: Resolução Conjunta BCB/CMN nº 1, de 4 de maio de 2020 (Open Finance)
