# Sistema de OCR com Integração SQL Server

Este documento explica como funciona o sistema de captura de documentos via OCR no totem de autoatendimento com integração ao banco de dados SQL Server legado.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Fluxo de Funcionamento](#fluxo-de-funcionamento)
3. [Configuração](#configuração)
4. [Estrutura da Tabela SQL Server](#estrutura-da-tabela-sql-server)
5. [Endpoints da API](#endpoints-da-api)
6. [Testes](#testes)

## 🎯 Visão Geral

O sistema implementa um fluxo completo de autoatendimento com:

- **Captura de CNH/RG** → OCR automático → Consulta no SQL Server → Confirmação de dados
- **Captura de Carteirinha** → OCR automático → Extração de dados do convênio
- **Captura de Guias** → Armazenamento para processamento posterior
- **Salvamento Completo** → Cadastro no PostgreSQL (Prisma) com referência ao cliente legado

## 🔄 Fluxo de Funcionamento

### 1. Captura de Documento (CNH/RG)

```
Usuário tira foto → OCR extrai dados → CPF identificado → Consulta SQL Server
   ↓                                                            ↓
Cliente Encontrado                                     Cliente Novo
   ↓                                                            ↓
Exibe dados para confirmação                          Continua com dados do OCR
   ↓                                                            ↓
"Confirmar" ou "Não sou eu"                           Próxima etapa
```

**Código Backend:**
```typescript
POST /api/totem/processar-documento
{
  "imagem": "data:image/jpeg;base64,...",
  "dados_ocr": { // Opcional, pode ser enviado do frontend
    "cpf": "12345678900",
    "nome": "João Silva",
    "rg": "123456789",
    "data_nascimento": "01/01/1990"
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "cliente_encontrado": true,
  "dados_cliente": {
    "id": "12345",
    "codigo_cliente": "CLI001",
    "nome": "João Silva Santos",
    "cpf": "12345678900",
    "data_nascimento": "01/01/1990",
    "telefone": "(11) 98765-4321",
    "endereco": "Rua Principal, nº 100, Centro, São Paulo, SP"
  },
  "dados_ocr": {
    "cpf": "12345678900",
    "nome": "JOAO SILVA SANTOS",
    "rg": "123456789"
  }
}
```

### 2. Captura de Carteirinha

```
Usuário tira foto → OCR extrai dados → Identifica convênio e número
```

**Código Backend:**
```typescript
POST /api/totem/processar-carteirinha
{
  "imagem": "data:image/jpeg;base64,...",
  "convenio": "unimed", // Selecionado pelo usuário
  "dados_ocr": { // Opcional
    "numero_carteirinha": "123456789012",
    "nome_titular": "João Silva",
    "validade": "12/2025"
  }
}
```

### 3. Salvamento do Atendimento

```
Dados do cliente + Documento + Carteirinha + Guias → Salva no PostgreSQL
```

**Código Backend:**
```typescript
POST /api/totem/salvar-atendimento
{
  "cliente_id": "uuid-do-cliente", // Opcional, se já existe
  "dados_cliente": {
    "nome": "João Silva Santos",
    "cpf": "12345678900",
    "data_nascimento": "01/01/1990",
    "telefone": "(11) 98765-4321"
  },
  "convenio": "unimed",
  "dados_carteirinha": {
    "numero_carteirinha": "123456789012",
    "validade": "12/2025"
  },
  "imagem_documento": "data:image/jpeg;base64,...",
  "imagem_carteirinha": "data:image/jpeg;base64,...",
  "imagem_guias": "data:image/jpeg;base64,...",
  "cliente_confirmado": true
}
```

**Resposta:**
```json
{
  "success": true,
  "protocolo": "AT250420001",
  "atendimento_id": "uuid-atendimento",
  "cliente_id": "uuid-cliente",
  "message": "Atendimento registrado com sucesso"
}
```

## ⚙️ Configuração

### 1. Instalar Dependências

```bash
cd apps/api
npm install mssql
```

### 2. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env` na pasta `apps/api`:

```env
# SQL Server (Sistema Legado)
SQL_SERVER_HOST=localhost
SQL_SERVER_PORT=1433
SQL_SERVER_USER=sa
SQL_SERVER_PASSWORD=SuaSenha123!
SQL_SERVER_DATABASE=LaboratorioDB
SQL_SERVER_ENCRYPT=false
SQL_SERVER_TRUST_CERT=true
```

### 3. Aplicar as Migrações do Prisma

```bash
cd apps/api
npx prisma generate
npx prisma migrate dev --name add-totem-fields
```

### 4. Atualizar o App Module

Certifique-se de que o `TotemModule` está importado no `AppModule`:

```typescript
import { TotemModule } from './modules/totem/totem.module';

@Module({
  imports: [
    // ... outros módulos
    TotemModule,
  ],
})
export class AppModule {}
```

## 🗄️ Estrutura da Tabela SQL Server

A tabela de clientes no SQL Server deve ter a seguinte estrutura:

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

-- Índices para melhor performance
CREATE INDEX idx_cliente_cpf ON cliente(cpf_cliente);
CREATE INDEX idx_cliente_rg ON cliente(rg_cliente);
CREATE INDEX idx_cliente_nome ON cliente(nome_cliente);
```

**IMPORTANTE:** Se sua estrutura for diferente, ajuste as queries em:
`apps/api/src/modules/totem/services/sql-server.service.ts`

## 🔗 Endpoints da API

### 1. Processar Documento (CNH/RG)
- **Endpoint:** `POST /api/totem/processar-documento`
- **Descrição:** Processa documento com OCR e consulta cliente no SQL Server
- **Auth:** Não requerida (totem público)

### 2. Processar Carteirinha
- **Endpoint:** `POST /api/totem/processar-carteirinha`  
- **Descrição:** Processa carteirinha de convênio com OCR
- **Auth:** Não requerida

### 3. Salvar Atendimento
- **Endpoint:** `POST /api/totem/salvar-atendimento`
- **Descrição:** Salva atendimento completo no banco de dados
- **Auth:** Não requerida

### 4. Testar Conexão SQL Server
- **Endpoint:** `GET /api/totem/teste-sql-server`
- **Descrição:** Testa a conexão com o SQL Server
- **Auth:** Não requerida

### 5. Health Check
- **Endpoint:** `GET /api/totem/health`
- **Descrição:** Verifica se o módulo está funcionando
- **Auth:** Não requerida

## 🧪 Testes

### 1. Testar Conexão SQL Server

```bash
curl http://localhost:3000/api/totem/teste-sql-server
```

Resposta esperada:
```json
{
  "success": true,
  "mensagem": "Conexão com SQL Server estabelecida com sucesso",
  "timestamp": "2025-04-20T12:00:00.000Z"
}
```

### 2. Testar Processamento de Documento

Você pode usar o Postman ou cURL:

```bash
curl -X POST http://localhost:3000/api/totem/processar-documento \
  -H "Content-Type: application/json" \
  -d '{
    "imagem": "data:image/jpeg;base64,...",
    "dados_ocr": {
      "cpf": "12345678900"
    }
  }'
```

### 3. Testar no Frontend

O frontend já está configurado no arquivo:
- `apps/web-totem/ocr-integration.js`

As funções principais são:
- `capturarDocumentoComOCR()` - Captura e processa CNH/RG
- `capturarCarteirinhaComOCR()` - Captura e processa carteirinha
- `finalizarAtendimentoComOCR()` - Salva tudo no banco

## 📝 Logs

Os logs são gravados em:
- Console: Desenvolvimento
- Banco de dados: Tabela `log_sistema`

Para ver os logs:
```sql
-- PostgreSQL
SELECT * FROM log_sistema 
WHERE modulo = 'TOTEM' 
ORDER BY created_at DESC 
LIMIT 20;
```

## 🚨 Troubleshooting

### Erro: "Cannot connect to SQL Server"

1. Verifique se o SQL Server está rodando
2. Confirme o host, porta e credenciais
3. Teste a conexão: `GET /api/totem/teste-sql-server`

### Erro: "CPF não identificado"

1. Melhore a iluminação ao capturar
2. Certifique-se que o documento está legível
3. Verifique se o OCR está configurado corretamente

### Erro: "Cliente não encontrado"

Isso não é um erro! Significa que é um cliente novo e será cadastrado.

## 📚 Próximos Passos

1. ✅ Implementar OCR com consulta SQL Server
2. ✅ Criar fluxo de confirmação de dados
3. ✅ Salvar atendimento completo
4. ⏳ Implementar sincronização bidirecional com SQL Server
5. ⏳ Adicionar processamento de guias médicas com IA
6. ⏳ Implementar dashboard de monitoramento

## 🤝 Suporte

Para dúvidas ou problemas:
1. Verifique os logs no banco de dados
2. Teste a conexão SQL Server
3. Revise a estrutura da tabela `cliente`
