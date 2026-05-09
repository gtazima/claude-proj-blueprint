# ADR-014: Biblioteca de Mapas

## Status
Accepted

## Context
O módulo Mapa (PRD `feat-mapa.md`) precisa de uma biblioteca para renderização interativa de mapas com:

- Imagem de satélite como camada base
- Polígonos sobrepostos (talhões) com preenchimento colorido por status
- Marcadores customizados com estado em tempo real (sensores, automações)
- Edição de polígonos (criar, mover vértices, renomear)
- Importação de KML/KMZ
- Funcionamento offline com tiles cacheadas

Existem duas opções dominantes no ecossistema JavaScript: **Mapbox GL JS** e **Leaflet**. Cada uma tem trade-offs significativos. Esta decisão impacta diretamente a experiência visual do produto e o custo operacional.

## Decision

Adotar **Mapbox GL JS** como biblioteca de mapas principal.

### Justificativa

**Qualidade visual e performance:**
- Mapbox usa WebGL para renderização — performance significativamente superior ao Leaflet em mapas com muitos polígonos e marcadores
- Tiles vetoriais são leves e escaláveis — ideal para uso em PWA com cache offline
- Estilização declarativa via JSON style permite ajuste fino dos overlays sem recarregar tiles

**Imagem de satélite:**
- Mapbox Satellite Streets é um dos melhores serviços de imagem de satélite do mercado
- Atualizações periódicas das imagens incluídas no plano gratuito
- Leaflet depende de provedores de tiles externos (Esri, OpenStreetMap, Stamen) — qualidade de satélite muito inferior ao Mapbox no caso da agroecologia (talhões pequenos e detalhados)

**Funcionalidade de edição:**
- Mapbox GL Draw é biblioteca oficial para criação/edição de polígonos
- Leaflet tem `Leaflet.draw` mas é menos robusto e mantido pela comunidade

**Free tier suficiente para o caso de uso:**
- Mapbox oferece 50.000 carregamentos de mapa/mês gratuitos
- Uma propriedade individual usa muito menos do que isso — estimativa ~500-2000 carregamentos/mês para uso ativo

**Curva de aprendizado e ecossistema:**
- Documentação oficial do Mapbox é referência de qualidade
- TypeScript definitions oficiais
- Integração com React via `react-map-gl` é padrão do mercado

### Configuração escolhida

```yaml
# Stack do módulo Mapa
library: mapbox-gl
react_wrapper: react-map-gl
drawing: @mapbox/mapbox-gl-draw
geojson_parsing: @tmcw/togeojson    # para importação KML/KMZ

style:
  base: mapbox://styles/mapbox/satellite-streets-v12
  custom_layers: definidos em src/web/maps/styles/

free_tier:
  monthly_loads: 50000
  alert_threshold: 30000        # alerta interno antes de aproximar do limite
```

### Estratégia offline

Mapbox GL JS suporta cache de tiles via Service Worker. Estratégia:
- No primeiro load, sistema baixa tiles da área da propriedade em zoom 14-18
- Cache persistido no IndexedDB do navegador
- Updates de tiles acontecem em background quando há conexão
- Sem conexão, usuário vê última versão cacheada com indicador "modo offline"

Tamanho estimado do cache para uma propriedade média (~50 hectares): 30-80 MB. Aceitável para PWA.

### Importação KML/KMZ

Stack:
- `@tmcw/togeojson` para parsing KML → GeoJSON
- KMZ é simplesmente um zip contendo KML — biblioteca `jszip` para descompactar

GeoJSON é o formato canônico interno. Toda geometria armazenada no banco é GeoJSON; KML é apenas formato de entrada.

### Vendor lock-in e estratégia de saída

Mitigação do lock-in:
- Toda geometria no banco em GeoJSON (padrão aberto)
- Camada de adapter `src/web/maps/provider.ts` envolve chamadas à Mapbox — futura troca afeta apenas esta camada
- Estilo customizado (cores, marcadores) é JSON declarativo — portável para Leaflet ou MapLibre se necessário

**Alternativa de saída pronta:** MapLibre GL JS é fork open-source do Mapbox GL JS pré-mudança de licença. API praticamente idêntica. Em caso de mudança brusca de pricing da Mapbox, migração para MapLibre + tiles auto-hospedadas é estimada em 1-2 semanas.

## Alternatives considered

1. **Leaflet** — pros: open source, sem custos, comunidade enorme, simples; cons: performance inferior em mapas com muitos elementos, qualidade de satélite ruim com tiles gratuitos, edição de polígonos menos robusta. Descartado por qualidade de satélite e performance.

2. **MapLibre GL JS** — pros: fork open-source do Mapbox, API igual, sem custos de tiles; cons: requer hospedar próprias tiles ou usar provedor (custo similar ao Mapbox no fim), comunidade ainda em consolidação, menos extensões prontas. Aceito como **plano de saída** caso Mapbox mude pricing — não como escolha inicial.

3. **Google Maps JavaScript API** — pros: imagem de satélite excelente, conhecido por todos; cons: pricing agressivo após free tier, lock-in forte com Google Cloud, performance pior que Mapbox em customizações pesadas, política de uso restritiva. Descartado.

4. **OpenLayers** — pros: open source, muito poderoso para casos GIS avançados; cons: API complexa, curva de aprendizado alta, complexidade desproporcional ao caso de uso. Descartado.

5. **Mapbox GL JS (decisão atual)** — pros: melhor combinação de qualidade visual + performance + free tier + ecossistema; cons: pricing comercial agressivo se ultrapassar free tier, vendor lock-in mitigado mas presente. Aceito.

## Consequences

- **Positivo:** qualidade visual do mapa é um diferencial perceptível do produto.
- **Positivo:** performance suporta dezenas de polígonos e marcadores sem degradação.
- **Positivo:** edição de polígonos via Mapbox GL Draw é robusta e estável.
- **Positivo:** free tier cobre uso individual com folga significativa.
- **Negativo:** custo cresce caso o produto escale para muitos usuários ativos. Plano de migração para MapLibre existe.
- **Negativo:** dependência de Mapbox para imagem de satélite — se a empresa mudar políticas, precisamos migrar.
- **Risco:** mudanças de licença do Mapbox no passado (em 2020 o GL JS mudou de BSD para licença proprietária) podem se repetir. Mitigação: MapLibre é o caminho de saída pronto.
- **Risco:** cache offline grande (até 80 MB) pode incomodar usuários com pouco armazenamento no celular. Mitigação: oferecer "limpar cache de mapa" em configurações.

## Impact on specs

- **Onboarding (feat-onboarding.md):** AC-22 (importação KML) depende deste ADR. Validar `@tmcw/togeojson` com KML real do Google Earth do produtor.
- **Mapa (feat-mapa.md):** todos os ACs deste módulo dependem deste ADR.
- **Observability:** monitorar consumo mensal do free tier Mapbox. Alertar antes de aproximar do limite.
- **Data Architecture:** GeoJSON é o formato canônico interno — schema de áreas e marcadores deve usar `geometry: GEOMETRY` (PostGIS recomendado para queries geoespaciais futuras).
- **Performance:** medir tempo de primeira renderização do mapa em celular antigo (target: <3s).

## References
- PRD: `docs/product/feat-mapa.md`
- Mapbox GL JS docs: https://docs.mapbox.com/mapbox-gl-js/
- MapLibre (plano de saída): https://maplibre.org/
- KML para GeoJSON: https://github.com/placemark/togeojson
