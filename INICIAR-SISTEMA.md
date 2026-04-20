# 🚀 Como Iniciar o Sistema - Guia Rápido

## ⚡ Início Rápido (2 Passos)

### 1️⃣ Iniciar Apache (XAMPP) - Para Arquivos HTML

1. Abra o **XAMPP Control Panel**
2. Clique em **"Start"** ao lado de **Apache**
3. Aguarde aparecer **"Running"** em verde

✅ **Pronto!** Arquivos HTML já estão acessíveis.

---

### 2️⃣ Iniciar API Node.js - Para Endpoints REST (Opcional para testes iniciais)

Abra um **PowerShell** ou **Terminal** e execute:

```powershell
cd c:\xampp\htdocs\laboratorio-autoatendimento\apps\api
node ocr-test-server.js
```

✅ **Pronto!** API rodando na porta 3000.

---

## 🌐 Links de Acesso

Após iniciar o Apache (passo 1):

### **Portal Principal**
```
http://localhost/laboratorio-autoatendimento/apps/web-totem/portal.html
```

### **Totem de Atendimento**
```
http://localhost/laboratorio-autoatendimento/apps/web-totem/totem.html
```

### **Administração**
```
http://localhost/laboratorio-autoatendimento/apps/web-totem/admin-sinonimos.html
```

---

## 🔧 Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  NAVEGADOR (Browser)                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
         │                              │
         │ HTML/CSS/JS                  │ API Calls
         │ (Porta 80)                   │ (Porta 3000)
         ▼                              ▼
┌──────────────────┐           ┌──────────────────┐
│                  │           │                  │
│  APACHE (XAMPP)  │           │   NODE.JS API    │
│  Porta 80        │           │   Porta 3000     │
│                  │           │                  │
│  Serve arquivos: │           │  Endpoints:      │
│  - portal.html   │           │  - /api/totem/*  │
│  - totem.html    │           │  - /api/ocr/*    │
│  - admin-*.html  │           │                  │
│  - images/*      │           │                  │
│                  │           │                  │
└──────────────────┘           └──────────────────┘
                                       │
                                       │
                                       ▼
                           ┌────────────────────────┐
                           │                        │
                           │  BANCOS DE DADOS       │
                           │                        │
                           │  PostgreSQL (5432)     │
                           │  SQL Server (1433)     │
                           │                        │
                           └────────────────────────┘
```

---

## 🎯 Qual Servidor Faz O Quê?

### **Apache (XAMPP) - Porta 80**

✅ Serve todos os arquivos estáticos:
- `portal.html` - Página inicial
- `totem.html` - Interface do totem
- `admin-sinonimos.html` - Painel admin
- Arquivos CSS, JavaScript, Imagens

❌ NÃO processa lógica de negócio
❌ NÃO acessa banco de dados

### **Node.js API - Porta 3000**

✅ Processa requisições da API:
- OCR (Google Vision, AWS, Azure)
- Busca inteligente de exames
- Sincronização SQL Server
- Logs de auditoria
- Gerenciamento de sinônimos

✅ Acessa bancos de dados:
- PostgreSQL (principal)
- SQL Server (legacy)

❌ NÃO serve arquivos HTML diretamente

---

## 📋 Checklist de Inicialização

Antes de usar o sistema, verifique:

- [ ] **XAMPP Control Panel** aberto
- [ ] **Apache** com status **"Running"** (verde)
- [ ] **PostgreSQL** rodando (porta 5432)
- [ ] **SQL Server** acessível (10.1.8.7:1433)
- [ ] Portal abre em: `http://localhost/laboratorio-autoatendimento/apps/web-totem/portal.html`
- [ ] (Opcional) Node.js API rodando na porta 3000

---

## ❓ Solução de Problemas

### **Erro: "Não foi possível conectar ao servidor"**

**Causa:** Apache não está rodando.

**Solução:**
1. Abra o XAMPP Control Panel
2. Clique em "Start" no Apache
3. Aguarde ficar verde

---

### **Erro: "Cannot GET /portal.html" ou 404**

**Causa:** Tentando acessar pela porta errada.

**Solução Correta:**
```
✅ http://localhost/laboratorio-autoatendimento/apps/web-totem/portal.html
```

**NÃO use:**
```
❌ http://localhost:3000/portal.html
```

---

### **Erro: "Endpoint não encontrado" na API**

**Causa:** Node.js não está rodando.

**Solução:**
```powershell
cd c:\xampp\htdocs\laboratorio-autoatendimento\apps\api
node ocr-test-server.js
```

---

### **Apache não inicia (Porta 80 em uso)**

**Causa:** Skype, IIS ou outro serviço está usando a porta 80.

**Solução 1 - Fechar Skype:**
1. Abra Skype
2. Configurações → Avançado
3. Desmarque "Usar portas 80 e 443"

**Solução 2 - Mudar porta do Apache:**
1. XAMPP → Config → Apache (httpd.conf)
2. Buscar: `Listen 80`
3. Trocar por: `Listen 8080`
4. Acessar: `http://localhost:8080/laboratorio-autoatendimento/...`

---

## 🔄 Reiniciar Sistema

### **Reiniciar Apache:**

1. XAMPP Control Panel
2. Clique em **"Stop"** no Apache
3. Aguarde 2 segundos
4. Clique em **"Start"** no Apache

### **Reiniciar Node.js API:**

No terminal onde está rodando, pressione:
```
Ctrl + C
```

Depois execute novamente:
```powershell
node ocr-test-server.js
```

---

## 📚 Documentação Completa

Para informações detalhadas sobre endpoints, bancos de dados, e configurações, consulte:

📖 **ACESSO-SISTEMA.md** - Guia completo do sistema

---

## ✅ Sistema Pronto!

Se você consegue acessar o portal em:
```
http://localhost/laboratorio-autoatendimento/apps/web-totem/portal.html
```

**O sistema está funcionando corretamente!** 🎉

Os links para o totem e admin funcionam com navegação relativa (não precisa digitar URLs completas).

---

**Última atualização:** 20 de abril de 2026
