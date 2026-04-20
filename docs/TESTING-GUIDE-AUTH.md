# 🧪 Guia de Teste Manual - Sistema de Autenticação

## 📋 Preparação para Testes

### 1. **Configuração de Ambiente**
```bash
# 1. Copiar e configurar variáveis de ambiente
cp apps/api/.env.auth.example apps/api/.env

# 2. Garantir que Redis está rodando
docker run -d --name redis-auth -p 6379:6379 redis:alpine

# 3. Aplicar migrações do banco
cd apps/api && npx prisma generate && npx prisma db push

# 4. Iniciar servidor de desenvolvimento
npm run dev
```

### 2. **Ferramentas Recomendadas**
- **Postman** ou **Insomnia** para testes de API
- **Browser DevTools** para inspecionar cookies/headers
- **Redis CLI** para inspecionar sessões

## 🚀 Cenários de Teste

### **Cenário 1: Registro de Usuário**
```bash
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "name": "João da Silva",
  "email": "joao.silva@exemplo.com",
  "password": "MinhaSenh@123",
  "telefone": "(11) 99999-9999",
  "cpf": "12345678901"
}
```

**✅ Resultado Esperado:**
- Status: 201 Created
- Response: tokens + dados do usuário
- Headers de rate limit presentes

### **Cenário 2: Login com Credenciais Válidas**
```bash
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "joao.silva@exemplo.com",
  "password": "MinhaSenh@123",
  "rememberMe": false
}
```

**✅ Resultado Esperado:**
- Status: 200 OK
- Access token (válido por 15 min)
- Refresh token (válido por 7 dias)
- Dados do usuário sem senha

### **Cenário 3: Acesso a Rota Protegida**
```bash
GET http://localhost:3000/auth/profile
Authorization: Bearer [ACCESS_TOKEN]
```

**✅ Resultado Esperado:**
- Status: 200 OK
- Dados completos do perfil
- Sessão ativa registrada

### **Cenário 4: Renovação de Tokens**
```bash
POST http://localhost:3000/auth/refresh
Content-Type: application/json

{
  "refreshToken": "[REFRESH_TOKEN]"
}
```

**✅ Resultado Esperado:**
- Status: 200 OK
- Novos access e refresh tokens
- Token anterior invalidado

### **Cenário 5: Alteração de Senha**
```bash
PATCH http://localhost:3000/auth/change-password
Authorization: Bearer [ACCESS_TOKEN]
Content-Type: application/json

{
  "currentPassword": "MinhaSenh@123",
  "newPassword": "NovaSenha@456"
}
```

**✅ Resultado Esperado:**
- Status: 200 OK
- Todos os tokens invalidados
- Sessões antigas removidas

### **Cenário 6: Esqueci Minha Senha**
```bash
POST http://localhost:3000/auth/forgot-password
Content-Type: application/json

{
  "email": "joao.silva@exemplo.com"
}
```

**✅ Resultado Esperado:**
- Status: 200 OK
- Mensagem genérica (por segurança)
- Token de reset gerado (verificar logs)

### **Cenário 7: Logout Completo**
```bash
POST http://localhost:3000/auth/logout
Authorization: Bearer [ACCESS_TOKEN]
```

**✅ Resultado Esperado:**
- Status: 200 OK
- Todos os tokens invalidados
- Sessões removidas do Redis

## 🛡️ Testes de Segurança

### **Teste 1: Rate Limiting**
```bash
# Enviar 6 tentativas de login em sequência
for i in {1..6}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

**✅ Resultado Esperado:**
- Primeiras 5: Status 401 (Unauthorized)
- 6ª tentativa: Status 429 (Too Many Requests)
- Headers: X-RateLimit-* presentes

### **Teste 2: Senha Fraca**
```bash
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "name": "Teste",
  "email": "teste@exemplo.com",
  "password": "123456"
}
```

**✅ Resultado Esperado:**
- Status: 400 Bad Request
- Mensagem detalhando critérios não atendidos

### **Teste 3: Token Expirado**
```bash
# Usar um access token antigo ou inválido
GET http://localhost:3000/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid
```

**✅ Resultado Esperado:**
- Status: 401 Unauthorized
- Mensagem de token inválido

### **Teste 4: Email Duplicado**
```bash
# Tentar registrar o mesmo email duas vezes
POST http://localhost:3000/auth/register
# (usar dados do Cenário 1 novamente)
```

**✅ Resultado Esperado:**
- Status: 409 Conflict
- Mensagem: "Email já está em uso"

## 🔍 Verificações no Redis

### **Verificar Sessões Ativas**
```bash
redis-cli
> KEYS session:*
> KEYS user_sessions:*
> GET session:[SESSION_ID]
```

### **Verificar Refresh Tokens**
```bash
redis-cli
> KEYS refresh_token:*
> KEYS user_refresh_tokens:*
> GET refresh_token:[USER_ID]:[HASH]
```

### **Verificar Rate Limiting**
```bash
redis-cli
> KEYS rate_limit:*
> ZRANGE rate_limit:[KEY] 0 -1 WITHSCORES
```

## 📊 Verificações no Banco

### **Verificar Usuários Criados**
```sql
SELECT id, name, email, ativo, "emailVerificado", "createdAt"
FROM "User" 
ORDER BY "createdAt" DESC;
```

### **Verificar Logs de Sistema** (se implementado)
```sql
SELECT * FROM logs 
WHERE context LIKE '%auth%' 
ORDER BY created_at DESC 
LIMIT 10;
```

## 🎯 Checklist Final de Validação

### **Funcionalidades Básicas**
- [ ] Registro de usuário funciona
- [ ] Login com credenciais válidas funciona
- [ ] Acesso a rotas protegidas funciona
- [ ] Refresh de tokens funciona
- [ ] Logout funciona

### **Segurança**
- [ ] Rate limiting bloqueia tentativas excessivas
- [ ] Senhas fracas são rejeitadas  
- [ ] Tokens expirados são rejeitados
- [ ] Emails duplicados são bloqueados
- [ ] Logs de segurança são gerados

### **Experiência do Usuário**
- [ ] Respostas JSON bem formatadas
- [ ] Mensagens de erro claras
- [ ] Headers informativos presentes
- [ ] Documentação Swagger acessível

### **Performance**
- [ ] Respostas rápidas (<500ms)
- [ ] Sessões persistem no Redis
- [ ] Cleanup automático funciona
- [ ] Múltiplas sessões suportadas

## 🚨 Troubleshooting

### **Problemas Comuns**

1. **Redis não conecta:**
   - Verificar se Redis está rodando
   - Conferir configurações de conexão

2. **JWT secret missing:**
   - Verificar arquivo .env
   - Definir JWT_SECRET válido

3. **Banco de dados não conecta:**
   - Verificar Prisma configurações
   - Rodar migrações pendentes

4. **Rate limit não funciona:**
   - Verificar middleware configurado
   - Testar com IP real

### **Logs Importantes**
```bash
# Ver logs do servidor
npm run dev

# Ver logs específicos de auth
grep "AuthService" logs/application.log

# Ver logs de segurança
grep "SecurityAudit" logs/security.log
```

## ✅ Resultado Final

Após executar todos os testes, você deve ter:

- ✅ Sistema de autenticação funcionando
- ✅ Tokens JWT válidos sendo gerados
- ✅ Sessões gerenciadas no Redis
- ✅ Rate limiting protegendo endpoints
- ✅ Logs de auditoria sendo gerados
- ✅ Validações de segurança ativas

**O Item 4 estará 100% validado e funcional!**