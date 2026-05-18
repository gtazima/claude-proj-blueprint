# Module: Design System

> Visual design tokens, component patterns, and UI implementation strategy.

## Design flow

**Agent flow** — PRD + design tokens → frontend agent generates UI. Figma não é usado.

## Design tokens

### Colors

```css
/* Primary — verde musgo agroecológico */
--color-primary:       #4a7c59
--color-primary-hover: #3a6248
--color-primary-light: #e8f0ea

/* Neutrals (Tailwind stone) */
--color-surface:      #fafaf9   /* stone-50 */
--color-surface-alt:  #f5f5f4   /* stone-100 */
--color-border:       #e7e5e4   /* stone-200 */
--color-text:         #1c1917   /* stone-900 */
--color-text-muted:   #78716c   /* stone-500 */

/* Semantic */
--color-error:   #e11d48   /* rose-600 */
--color-success: #4a7c59   /* = primary */
--color-warning: #d97706   /* amber-600 */
```

### Typography

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
--font-mono: ui-monospace, "JetBrains Mono", monospace

--text-xs:   0.75rem  / 1rem
--text-sm:   0.875rem / 1.25rem
--text-base: 1rem     / 1.5rem
--text-lg:   1.125rem / 1.75rem
--text-xl:   1.25rem  / 1.75rem
```

Inter deve ser carregada via `<link>` no `index.html` (Google Fonts ou self-hosted).

### Spacing

Tailwind default (escala 4px base). Sem tokens customizados.

### Radii & Shadows

```css
--radius-sm: 0.25rem
--radius-md: 0.375rem
--radius-lg: 0.5rem
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05)
--shadow-md: 0 4px 6px rgba(0,0,0,0.07)
```

## Component library

**Radix UI** (já instalado: `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-toast`).
Sem shadcn/ui — componentes são construídos diretamente sobre Radix + Tailwind.

## Icons

**Lucide React** — instalar com `pnpm add lucide-react`.
Substituir todos os SVGs inline progressivamente. Novos componentes usam Lucide obrigatoriamente.

## Dark mode

Toggle manual (botão no layout). Implementar com classe `dark` no `<html>` via `localStorage`.
Tokens `dark:` devem ser definidos junto com os tokens light acima quando implementado.

## Layout patterns

- **Sidebar + content**: sidebar de navegação fixa (esquerda) + área principal com scroll
- Sem hamburger menus — sidebar sempre visível no desktop
- Toda a largura disponível — sem `max-w-xl` estilo mobile
- Colunas Kanban com scroll independente, cabeçalhos fixos

## Agent rules

- Sempre usar tokens — nunca hardcodar cores, espaçamento ou tipografia
- Desktop-first: targets compactos (28–32px), não touch-friendly (44px+)
- Modais sempre centralizados — nunca bottom-sheet
- Hover states obrigatórios em elementos interativos
- Estados de loading, empty e error obrigatórios em todo componente de dados
- Atalhos de teclado (`N`/`Ctrl+N` nova tarefa, `Esc` fechar modal) em toda feature de Agenda

## Responsive breakpoints

Desktop-first. Mobile não é prioridade atual.

```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```
