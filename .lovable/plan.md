

# Atualização de Copy da Primeira Dobra - Landing Page Centerfrios

O usuário solicitou mudanças específicas de copy na primeira dobra da landing page (`src/pages/Landing.tsx`), sem alterar o layout ou o design. As alterações são:

## Mudanças Necessárias

### 1. H1 - Título Principal (linhas 459-478)

**Texto atual:**
```
A plataforma de eventos
onde ideias viram [eventos.|experiências.|comunidades.|conexões.]
```

**Novo texto:**
```
A central oficial da CENTERFRIOS que impulsiona [comunidades|conexões|experiências|eventos].
```

- A alternância de palavras continua funcionando (array `rotatingWords` na linha 166)
- Atualizar o array para: `["comunidades.", "conexões.", "experiências.", "eventos."]`
- Reordenar a estrutura do H1 para o novo formato em linha única

### 2. Texto Secundário - Subtítulo (linhas 479-482)

**Texto atual:**
```
Seja qual for o seu evento — de workshops a conferências — crie páginas de inscrição
personalizadas, acompanhe participantes e faça sua comunidade crescer. Sem código.
```

**Novo texto:**
```
Dos próximos encontros aos eventos já realizados, aqui você encontra tudo em um só lugar: informações, destaques e registros para acompanhar o que vem pela frente e revisitar o que já aconteceu.
```

### 3. CTA - Botão (linha 484)

**Texto atual:**
```
Conhecer eventos
```

**Novo texto:**
```
Ver todos os eventos
```

O link continua apontando para `/events` e o ícone `<ArrowRight>` é mantido.

## Arquivos Afetados

- **src/pages/Landing.tsx**
  - Linha 166: Atualizar array `rotatingWords`
  - Linhas 459-478: Reestruturar o H1
  - Linhas 479-482: Substituir texto do parágrafo
  - Linha 484: Alterar texto do botão

## Observações Técnicas

- A funcionalidade de rotação de palavras (`wordIndex`, `AnimatePresence`, `motion.span`) permanece intacta
- O layout, espaçamento, classes CSS e animações não são modificados
- A estrutura de navegação e links permanece inalterada

