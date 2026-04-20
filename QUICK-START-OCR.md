# 🚀 Guia de Instalação Rápida - Sistema OCR com SQL Server

## Passo 1: Instalar Dependências

```powershell
# Navegue até a pasta da API
cd apps\api

# Instale o pacote mssql
npm install mssql @types/mssql
```

## Passo 2: Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env` em `apps/api/.env`:

```env
# Banco PostgreSQL (já existente)
DATABASE_URL="postgresql://user:password@localhost:5432/laboratorio"

# SQL Server (Sistema Legado) - ADICIONE ESTAS LINHAS
SQL_SERVER_HOST=localhost
SQL_SERVER_PORT=1433
SQL_SERVER_USER=sa
SQL_SERVER_PASSWORD=SuaSenha123!
SQL_SERVER_DATABASE=LaboratorioDB
SQL_SERVER_ENCRYPT=false
SQL_SERVER_TRUST_CERT=true

# OCR (já existente)
OCR_ENABLED=true
GOOGLE_CLOUD_PROJECT_ID=seu-projeto
GOOGLE_CLOUD_CREDENTIALS_JSON={"type":"service_account",...}
```

## Passo 3: Atualizar o Banco de Dados

```powershell
# Gerar cliente Prisma atualizado
cd apps\api
npx prisma generate

# Criar e aplicar migração
npx prisma migrate dev --name add-totem-ocr-fields
```

## Passo 4: Verificar Estrutura SQL Server

Certifique-se que a tabela `cliente` existe no SQL Server:

```sql
-- Execute no SQL Server Management Studio ou Azure Data Studio
SELECT TOP 1 * FROM cliente WHERE cpf_cliente IS NOT NULL;
```

Se a tabela não existir, crie com:

```sql
CREATE TABLE cliente (
    codigo_cliente INT PRIMARY KEY IDENTITY(1,1),
    nome_cliente VARCHAR(255) NOT NULL,
    cpf_cliente VARCHAR(14),
    rg_cliente VARCHAR(20),
    data_nascimento DATE,
    telefone_fixo VARCHAR(20),
    telefone_celular VARCHAR(20),
    email_cliente VARCHAR(255),
    endereco VARCHAR(255),
    numero VARCHAR(10),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(10),
    nome_mae VARCHAR(255),
    data_cadastro DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_cliente_cpf ON cliente(cpf_cliente);
```

## Passo 5: Atualizar AppModule

Edite `apps/api/src/app.module.ts` e adicione o `TotemModule`:

```typescript
import { TotemModule } from './modules/totem/totem.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // ... outros módulos
    TotemModule, // ← ADICIONE ESTA LINHA
  ],
})
export class AppModule {}
```

## Passo 6: Iniciar a API

```powershell
cd apps\api
npm run dev
```

## Passo 7: Testar a Integração

### Teste 1: Conexão SQL Server
```powershell
curl http://localhost:3000/api/totem/teste-sql-server
```

Resposta esperada:
```json
{
  "success": true,
  "mensagem": "Conexão com SQL Server estabelecida com sucesso"
}
```

### Teste 2: Health Check
```powershell
curl http://localhost:3000/api/totem/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "modulo": "totem"
}
```

### Teste 3: Processar Documento (simulado)

Crie um arquivo `test-ocr.json`:

```json
{
  "imagem": "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "dados_ocr": {
    "cpf": "12345678900",
    "nome": "TESTE USUARIO",
    "rg": "123456789"
  }
}
```

Execute:
```powershell
curl -X POST http://localhost:3000/api/totem/processar-documento `
  -H "Content-Type: application/json" `
  -d "@test-ocr.json"
```

## Passo 8: Testar no Frontend

1. Abra o navegador em `http://localhost:8080/apps/web-totem/index.html`
2. Clique em "Novo Atendimento"
3. Selecione um convênio
4. Capture um documento (CNH/RG)
5. O sistema automaticamente:
   - Extrai o CPF via OCR
   - Consulta no SQL Server
   - Mostra dados do cliente se encontrado

## ✅ Checklist de Validação

- [ ] Dependência `mssql` instalada
- [ ] Variáveis de ambiente SQL Server configuradas
- [ ] Migração Prisma aplicada
- [ ] SQL Server acessível e tabela `cliente` existe
- [ ] TotemModule importado no AppModule
- [ ] API iniciando sem erros
- [ ] Teste de conexão SQL Server retorna sucesso
- [ ] Frontend carregando corretamente

## 🚨 Problemas Comuns

### Erro: "Cannot find module 'mssql'"
**Solução:** Execute `npm install mssql` na pasta `apps/api`

### Erro: "Login failed for user 'sa'"
**Solução:** Verifique a senha no `.env` e se o usuário tem permissões

### Erro: "Invalid object name 'cliente'"
**Solução:** A tabela não existe. Execute o script CREATE TABLE acima

### Erro: "Network error"
**Solução:** 
- Verifique se o SQL Server está rodando
- Confirme a porta (padrão: 1433)
- Verifique firewall

### Erro: Prisma schema migration failed
**Solução:** 
```powershell
npx prisma migrate reset
npx prisma migrate dev
```

## 📖 Documentação Completa

Para mais detalhes, consulte:
- `docs/OCR-INTEGRATION-GUIDE.md` - Guia completo de integração
- `apps/api/src/modules/totem/README.md` - Documentação do módulo
- `apps/api/.env.sqlserver.example` - Exemplo de configuração

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs da API no console
2. Consulte os logs no banco: `SELECT * FROM log_sistema WHERE modulo = 'TOTEM'`
3. Teste a conexão SQL Server pelo endpoint `/api/totem/teste-sql-server`
4. Verifique se todas as variáveis de ambiente estão corretas

---

**Desenvolvido por:** LAVB Tecnologias  
**Data:** Abril 2025
