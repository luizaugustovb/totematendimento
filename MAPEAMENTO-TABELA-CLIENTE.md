# Mapeamento da Tabela Cliente - SQL Server

## 📋 Estrutura Real da Tabela

A tabela `cliente` no SQL Server possui as seguintes colunas:

### Identificação Principal
- ✅ **cod_cliente** - INT PRIMARY KEY - Código único do cliente
- ✅ **nome_cliente** - VARCHAR - Nome completo do cliente
- ✅ **cpf_cliente** - VARCHAR - CPF (pode ter ou não formatação)
- 📝 **identidade_cliente** - VARCHAR - RG/Identidade
- 📝 **nome_social** - VARCHAR - Nome social
- 📝 **CNS_beneficiario** - VARCHAR - Cartão Nacional de Saúde

### Dados Pessoais
- 📝 **nascimento_cliente** - DATE/DATETIME - Data de nascimento
- 📝 **sexo_cliente** - CHAR/VARCHAR - Sexo (M/F)
- 📝 **tipo_sang** - VARCHAR - Tipo sanguíneo
- 📝 **raca_cor** - VARCHAR - Raça/Cor
- 📝 **cod_nacionalidade** - INT - Código da nacionalidade
- 📝 **numero_passaporte** - VARCHAR - Número do passaporte

### Contato
- 📝 **fone_cliente** - VARCHAR - Telefone fixo
- 📝 **celular_cliente** - VARCHAR - Telefone celular
- 📝 **email_cliente** - VARCHAR - E-mail
- 📝 **fone_mae** - VARCHAR - Telefone da mãe

### Endereço
- 📝 **endereco_cliente** - VARCHAR - Logradouro
- 📝 **endereco_numero_cliente** - VARCHAR - Número
- 📝 **complemento_cliente** - VARCHAR - Complemento
- 📝 **bairro_cliente** - VARCHAR - Bairro
- 📝 **cidade_cliente** - VARCHAR - Cidade
- 📝 **estado_cliente** - VARCHAR(2) - UF
- 📝 **cep_cliente** - VARCHAR - CEP
- 📝 **endereco_tipo_logradouro** - VARCHAR - Tipo de logradouro
- 📝 **codigo_municipio_ibge** - VARCHAR - Código IBGE do município

### Filiação
- 📝 **nome_mae** - VARCHAR - Nome da mãe
- 📝 **nome_pai** - VARCHAR - Nome do pai
- 📝 **nome_responsavel** - VARCHAR - Nome do responsável
- 📝 **tipo_responsavel** - VARCHAR - Tipo de responsável

### Documentos Adicionais
- 📝 **titulo_cliente** - VARCHAR - Título de eleitor
- 📝 **cartao_entregue** - VARCHAR/BIT - Cartão entregue?
- 📝 **ric** - VARCHAR - RIC (?)

### Dados Administrativos
- 📝 **data_cadastro** - DATETIME - Data de cadastro
- 📝 **usu_cliente** - VARCHAR - Usuário que cadastrou
- 📝 **posto_cliente** - VARCHAR - Posto de cadastro
- 📝 **status_cliente** - VARCHAR - Status do cliente
- 📝 **senha_cliente** - VARCHAR - Senha (hash)
- 📝 **obs_geral** - TEXT/VARCHAR - Observações gerais
- 📝 **quantidade_pedidos** - INT - Quantidade de pedidos

### Dados Empresariais (opcional para PJ)
- 📝 **cnpj_cliente** - VARCHAR - CNPJ
- 📝 **inscricao_municipal_cliente** - VARCHAR - Inscrição municipal

### Outros
- 📝 **cod_origem** - INT - Código de origem
- 📝 **cod_cliente_busca** - VARCHAR - Código para busca
- 📝 **localizador** - VARCHAR - Localizador
- 📝 **status_localizador** - VARCHAR - Status do localizador
- 📝 **nao_identificado** - BIT - Não identificado
- 📝 **data_modificacao_senha** - DATETIME - Data de modificação da senha
- 📝 **raca_cor_etnia_indigena** - VARCHAR - Raça cor etnia indígena

## 🔄 Mapeamento no Sistema

O serviço `sql-server.service.ts` mapeia os campos assim:

### Campos Retornados pela API

```typescript
{
  id: string;                    // cod_cliente
  codigo_cliente: number;        // cod_cliente
  nome: string;                  // nome_cliente
  nome_social?: string;          // nome_social
  cpf?: string;                  // cpf_cliente (sem formatação)
  rg?: string;                   // identidade_cliente
  data_nascimento?: string;      // nascimento_cliente (formato DD/MM/YYYY)
  sexo?: string;                 // sexo_cliente
  telefone?: string;             // fone_cliente
  celular?: string;              // celular_cliente
  email?: string;                // email_cliente
  endereco?: string;             // endereco_cliente + numero + complemento
  bairro?: string;               // bairro_cliente
  cidade?: string;               // cidade_cliente
  estado?: string;               // estado_cliente
  cep?: string;                  // cep_cliente
  nome_mae?: string;             // nome_mae
  nome_pai?: string;             // nome_pai
  tipo_sanguineo?: string;       // tipo_sang
  data_cadastro?: Date;          // data_cadastro
}
```

## 🔍 Consultas Suportadas

### 1. Busca por CPF (Principal)
```sql
SELECT * FROM cliente 
WHERE cpf_cliente = '12345678900'
   OR cpf_cliente = '123.456.789-00'
```

### 2. Busca por RG
```sql
SELECT * FROM cliente 
WHERE identidade_cliente = '123456789'
```

### 3. Busca por Nome (Aproximada)
```sql
SELECT TOP 1 * FROM cliente 
WHERE nome_cliente LIKE '%JOAO SILVA%'
ORDER BY data_cadastro DESC
```

## ✅ Legenda

- ✅ = Campo obrigatório/essencial
- 📝 = Campo opcional (usado se disponível)

## 📝 Notas Importantes

1. **CPF Flexível**: O sistema aceita CPF com ou sem formatação (123.456.789-00 ou 12345678900)

2. **Campos Opcionais**: Nem todos os campos precisam estar preenchidos. O sistema se adapta aos dados disponíveis.

3. **Endereço Composto**: O endereço completo é montado a partir de:
   - `endereco_cliente` + `endereco_numero_cliente` + `complemento_cliente`

4. **Data de Nascimento**: Convertida automaticamente para formato brasileiro (DD/MM/YYYY)

5. **Múltiplos Critérios**: O sistema busca por CPF primeiro, depois RG, depois Nome.

## 🔧 Personalização

Se sua tabela tiver nomes diferentes de colunas, edite:
```
apps/api/src/modules/totem/services/sql-server.service.ts
```

Procure pelas queries SQL e ajuste os nomes das colunas conforme necessário.

## 🧪 Teste

Para testar se a estrutura está correta:

```powershell
# 1. Inicie a API
cd apps\api
npm run dev

# 2. Teste a conexão
curl http://localhost:3000/api/totem/teste-sql-server

# 3. Teste uma consulta real
curl -X POST http://localhost:3000/api/totem/processar-documento `
  -H "Content-Type: application/json" `
  -d '{"dados_ocr":{"cpf":"20004460430"}}'
```

Use um CPF que existe na sua base para validar!
