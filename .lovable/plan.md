

# Remover Controles de Páginas Públicas & Alterar CTA da Landing

O usuário quer garantir que visitantes não autenticados tenham apenas acesso de visualização/navegação — sem botões de configuração, criação de eventos ou alteração de temas. Além disso, o botão "Começar agora" na página principal (/) deve mudar para "Conhecer eventos" (mantendo a seta).

## Análise da Situação Atual

**Páginas públicas identificadas:**
1. **Landing (`/`)** — src/pages/Landing.tsx  
   - Atualmente mostra botões "Começar agora" → precisa mudar para "Conhecer eventos"
   - Navbar com "Entrar" e "Criar conta" → OK (são CTAs de autenticação, não de configuração)
   - Não possui botões de configuração visíveis
   
2. **PublicEvents (`/events`)** — src/pages/PublicEvents.tsx  
   - Já tem controle correto: usuários não logados veem "Entrar" e "Criar conta"
   - Usuários logados veem "Meu painel"
   - Não possui botões de configuração
   
3. **CompanyPage (`/company/:slug`)** — src/pages/CompanyPage.tsx  
   - Página pública que exibe perfil de empresa e eventos
   - Precisa verificar se há botões de edição/configuração

4. **Register (`/register/:slug`)** — src/pages/Register.tsx  
   - Formulário de inscrição — não possui controles administrativos
   - Footer "Powered by Centerfrios" → OK

## Problemas Identificados

Após análise, as páginas públicas já estão relativamente limpas, mas precisamos:

1. **Landing.tsx (linha 484):** Alterar o texto do botão de "Começar agora" para "Conhecer eventos" e ajustar o destino do link de `/auth` para `/events`

2. **Verificar CompanyPage.tsx:** Garantir que não existam botões de edição/configuração visíveis para visitantes não autenticados

## Mudanças Necessárias

### 1. src/pages/Landing.tsx (linha 484)
**Atual:**
```tsx
<Button size="lg" className="text-base font-semibold px-8 h-12" asChild>
  <Link to="/auth">Começar agora <ArrowRight className="ml-2 w-4 h-4" /></Link>
</Button>
```

**Novo:**
```tsx
<Button size="lg" className="text-base font-semibold px-8 h-12" asChild>
  <Link to="/events">Conhecer eventos <ArrowRight className="ml-2 w-4 h-4" /></Link>
</Button>
```

### 2. Verificar CompanyPage.tsx
Preciso visualizar mais do arquivo para confirmar se há botões de edição que precisam ser removidos ou condicionados ao status de autenticação.

