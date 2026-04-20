# 🏥 Sistema de Autoatendimento - Laboratório de Análises Clínicas

Sistema completo de autoatendimento com OCR inteligente, sincronização automática e gerenciamento administrativo.

---

## 🚀 Links de Acesso

### 📋 **Portal Principal**
```
http://localhost/laboratorio-autoatendimento/apps/web-totem/portal.html
```
Página inicial com acesso aos dois sistemas

### 🖥️ **Totem de Atendimento** (Pacientes)
```
http://localhost/laboratorio-autoatendimento/apps/web-totem/totem.html
```
Interface para pacientes realizarem autoatendimento

**Funcionalidades:**
- ✅ Leitura OCR de CNH/RG (Google Cloud Vision)
- ✅ Captura de carteirinha de convênio
- ✅ Processamento de requisições médicas
- ✅ Confirmação inteligente de exames com score de confiança
- ✅ Seleção de médico (manual ou automática)
- ✅ Geração de protocolo de atendimento

**Fluxo Completo (9 Telas):**
1. Boas-vindas
2. Captura de documento
3. Confirmação de dados
4. Seleção de convênio
5. Captura de carteirinha (Unimed)
6. Captura de requisições
7. **Confirmação de exames** (com busca inteligente)
8. **Seleção de médico** (com busca por CRM/UF)
9. Protocolo de atendimento

---

### ⚙️ **Administração** (Gerenciamento)
```
http://localhost/laboratorio-autoatendimento/apps/web-totem/admin-sinonimos.html
```
Painel administrativo completo

**Funcionalidades:**
- ✅ Gerenciar sinônimos de exames
  - Adicionar, remover, listar
  - Escopo: Global, Convênio, Médico
- ✅ Sincronização com SQL Server
  - Status em tempo real
  - Trigger manual
  - Última sincronização
- ✅ Busca inteligente de exames
  - Score de confiança visual (verde/amarelo/vermelho)
  - Match exato, fuzzy, por sinônimo
- ✅ Logs de auditoria
  - Filtros por ação, data, usuário
  - Últimas 24 horas
  - Estatísticas de uso
- ✅ Listagem de médicos sincronizados

---

## 🛠️ Como Iniciar o Sistema

### **1. Iniciar Apache (XAMPP)** - Servir Arquivos HTML

1. Abra o **XAMPP Control Panel**
2. Clique em **Start** no módulo **Apache**
3. Aguarde até aparecer "Running" em verde

✅ Arquivos HTML acessíveis em: `http://localhost/laboratorio-autoatendimento/apps/web-totem/`

### **2. Iniciar API Node.js** - Endpoints REST

**Método Simples (Recomendado):**

```powershell
cd c:\xampp\htdocs\laboratorio-autoatendimento\apps\api
node ocr-test-server.js
```

Servidor roda na porta **3000** - Apenas API, sem servir HTML.

**Método NestJS Completo (Requer instalação de dependências):**

```powershell
cd c:\xampp\htdocs\laboratorio-autoatendimento\apps\api
npm install @nestjs/schedule
npm run start:dev
```

---

## 📊 Endpoints da API

### **Totem**
- `POST /api/totem/processar-documento` - OCR de CNH/RG
- `POST /api/totem/processar-carteirinha` - OCR de carteirinha
- `POST /api/totem/processar-requisicao` - OCR de requisição
- `POST /api/totem/salvar-atendimento` - Salvar atendimento completo

### **Exames**
- `POST /api/totem/exames/buscar` - Busca inteligente
- `POST /api/totem/exames/sugerir` - Sugestões alternativas
- `GET /api/totem/exames` - Listar todos

### **Médicos**
- `POST /api/totem/medicos/buscar` - Busca por nome/CRM/UF
- `GET /api/totem/medicos` - Listar todos

### **Sinônimos**
- `POST /api/totem/sinonimos` - Adicionar sinônimo
- `GET /api/totem/sinonimos/:exameId` - Listar sinônimos de exame
- `POST /api/totem/sinonimos/remover` - Remover sinônimo

### **Sincronização**
- `POST /api/totem/sync/manual` - Trigger manual
- `GET /api/totem/sync/status` - Status da sincronização

### **Logs de Auditoria**
- `POST /api/totem/logs/auditoria` - Registrar log
- `GET /api/totem/logs/auditoria` - Buscar com filtros
- `GET /api/totem/logs/auditoria/recentes` - Últimas 24h
- `GET /api/totem/logs/auditoria/estatisticas` - Estatísticas

---

## 🗄️ Bancos de Dados

### **PostgreSQL** (Principal)
```
Host: localhost:5432
Database: laboratorio
User: postgres
Password: postgres
```

**Tabelas Principais:**
- `exames` - Exames sincronizados do SQL Server
- `medicos` - Médicos sincronizados
- `sinonimos_exame` - Sinônimos para matching inteligente
- `sincronizacoes_legado` - Controle de sincronização
- `logs_auditoria` - Auditoria de ações
- `atendimentos` - Atendimentos realizados

### **SQL Server** (Legacy)
```
Host: 10.1.8.7:1433
Database: BD_SOFTLAB_P00
User: sa
Password: ndqualidade
```

**Tabelas Lidas:**
- `tipo_ex` (cod_exame, descr_exame) → `exames`
- `medico` (crm_medico, uf_medico, nome_medico) → `medicos`

**Sincronização Automática:**
- ⏰ Exames: A cada 10 minutos (:00, :10, :20...)
- ⏰ Médicos: A cada 10 minutos (:01, :11, :21...)
- 🔄 Incremental: Apenas novos registros

---

## 🧪 Testar Sincronização Manual

```bash
# Sincronizar exames e médicos
curl -X POST http://localhost:3000/api/totem/sync/manual \
  -H "Content-Type: application/json" \
  -d "{\"tipo\":\"ambos\"}"

# Ver status
curl http://localhost:3000/api/totem/sync/status
```

---

## 🔍 Busca Inteligente

### **Algoritmo de Matching:**

1. **Match Exato** (Score: 1.0)
   - Busca exata em `nomePadrao`

2. **Match por Sinônimo** (Score: 0.95)
   - Busca exata em `sinonimos_exame`

3. **Match CONTAINS** (Score: calculado)
   - Busca palavras-chave com `LIKE %palavra%`

4. **Match Fuzzy** (Score: ≥ 0.6)
   - Similaridade de Levenshtein
   - Normalização: remove acentos, pontuação, lowercase

### **Score de Confiança:**
- 🟢 **90-100%**: Alta confiança (verde)
- 🟡 **70-89%**: Média confiança (amarelo)
- 🔴 **0-69%**: Baixa confiança (vermelho)

---

## 📁 Estrutura do Projeto

```
laboratorio-autoatendimento/
├── apps/
│   ├── api/                        # Backend NestJS
│   │   ├── src/modules/totem/
│   │   │   ├── services/
│   │   │   │   ├── sync-legado.service.ts
│   │   │   │   ├── busca-inteligente.service.ts
│   │   │   │   └── log-auditoria.service.ts
│   │   │   ├── totem.controller.ts (19 endpoints)
│   │   │   └── dto/busca.dto.ts
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   ├── web-totem/                  # Frontend Totem
│   │   ├── portal.html             # 🆕 Portal de entrada
│   │   ├── totem.html              # Interface do totem
│   │   └── admin-sinonimos.html    # 🆕 Admin
│   └── web-admin/                  # Dashboard (futuro)
├── packages/
│   ├── core/
│   └── shared/
├── python-scripts/                 # Scripts de autorização
├── uploads/                        # Storage de imagens
└── docs/                           # Documentação
```

---

## 🎯 Próximos Passos Recomendados

### **1. Popular Sinônimos Iniciais**

Adicionar sinônimos comuns via API ou diretamente no banco:

```sql
INSERT INTO sinonimos_exame (exame_id, descricao_variacao, escopo, criado_por_usuario_id)
VALUES 
  ('UUID-GLICOSE', 'GLI', 'GLOBAL', 'admin'),
  ('UUID-GLICOSE', 'G', 'GLOBAL', 'admin'),
  ('UUID-GLICOSE', 'GLICEMIA', 'GLOBAL', 'admin'),
  ('UUID-HEMOGRAMA', 'HMG', 'GLOBAL', 'admin'),
  ('UUID-HEMOGRAMA', 'HEMOGRAMA COMPLETO', 'GLOBAL', 'admin');
```

### **2. Testar Workflow Completo**

1. Acesse `http://localhost:3000/totem.html`
2. Capture um documento
3. Selecione convênio Unimed
4. Capture carteirinha
5. Capture requisição médica
6. Confirme exames encontrados
7. Selecione médico
8. Verifique protocolo gerado

### **3. Configurar Ambiente de Produção**

- [ ] Configurar HTTPS
- [ ] Implementar autenticação no admin
- [ ] Backup automático do PostgreSQL
- [ ] Monitoramento de logs
- [ ] Alertas de erro

---

## 📞 Suporte Técnico

**Tecnologias Utilizadas:**
- Backend: NestJS + TypeScript
- ORM: Prisma
- Banco: PostgreSQL + SQL Server
- OCR: Google Cloud Vision API v4.0.0
- Frontend: HTML + TailwindCSS + JavaScript
- Cron Jobs: @nestjs/schedule

**Logs:**
- Aplicação: Console do servidor
- Auditoria: Tabela `logs_auditoria`
- SQL Server: mssql driver

---

## ✅ Checklist de Validação

- [x] Backend compilando sem erros
- [x] Migrations aplicadas (2 migrations)
- [x] Sincronização automática configurada
- [x] Busca inteligente implementada
- [x] Logs de auditoria funcionando
- [x] Interface do totem responsiva
- [x] Admin de sinônimos completo
- [x] Portal de entrada criado
- [ ] Testes end-to-end
- [ ] Sinônimos iniciais populados
- [ ] Validação com dados reais

---

**Sistema desenvolvido e otimizado! 🚀**
