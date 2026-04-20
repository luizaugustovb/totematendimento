# 📸 Dicas para Melhorar a Captura OCR

## 🎯 Problemas Comuns e Soluções

### ❌ Problema: Texto bagunçado/ilegível
**Causas:**
- Iluminação ruim (sombras, reflexos)
- Documento torto/inclinado
- Imagem fora de foco
- Distância inadequada

**Soluções:**
1. **Iluminação**: Use luz natural ou iluminação uniforme sem reflexos
2. **Posicionamento**: Mantenha documento plano e paralelo à câmera
3. **Distância**: 15-30cm da câmera
4. **Estabilidade**: Segure firme ou use suporte

### ✅ Melhorias Implementadas

O sistema agora inclui:

1. **Pré-processamento de Imagem**
   - Aumento automático de contraste (+40%)
   - Melhora legibilidade do texto

2. **Extração Inteligente**
   - Múltiplos padrões de CPF
   - Busca por RG alternativo
   - Limpeza automática de texto

3. **Debug Visual**
   - Mostra texto original capturado
   - Mostra texto limpo
   - Destaca CPF/RG extraído

## 📋 Tipos de Documento Suportados

### CNH (Carteira Nacional de Habilitação)
- ✅ Frente: Nome, CPF, RG, Data Nascimento, Filiação
- ⚠️ Verso: Não necessário

### RG (Registro Geral)
- ✅ Frente: Nome, RG, CPF (se tiver), Data Nascimento
- ⚠️ Verso: Pode ter CPF

## 🔧 Como Testar

### 1. Modo Normal (com câmera)
```
1. Clique em "Iniciar Atendimento"
2. Permita acesso à câmera
3. Posicione documento na frente da câmera
4. Clique em "Capturar"
5. Clique em "Confirmar"
6. Veja o texto extraído na área DEBUG
```

### 2. Modo Teste (sem câmera)
```
1. Clique em "Modo Teste"
2. Sistema usa CPF de teste: 200.044.604-30
3. Pula direto para confirmação de dados
```

## 🐛 Debug

### Ver logs no console do navegador:
1. Pressione F12
2. Vá na aba "Console"
3. Veja logs detalhados:
   - 📝 OCR RAW: texto original
   - ✨ OCR LIMPO: texto normalizado
   - 🆔 CPF: CPF extraído
   - 🆔 RG: RG extraído (se não achar CPF)

### Mensagens de Erro

| Erro | Causa | Solução |
|------|-------|---------|
| "CPF/RG não encontrado" | OCR não identificou números | Melhorar iluminação, reposicionar |
| "Cliente não encontrado" | CPF não está no banco | Usar balcão de atendimento |
| "Permita o acesso à câmera" | Permissão negada | Permitir câmera nas configurações do navegador |

## 🎯 Padrões de Extração

### CPF
```regex
Padrão 1: 123.456.789-00
Padrão 2: 12345678900
Padrão 3: 123 456 789 00
Busca: Qualquer sequência de 11 dígitos
```

### RG
```regex
Padrão 1: RG: 12.345.678-9
Padrão 2: REGISTRO: 123456789
Padrão 3: IDENTIDADE: 1234567890
Busca: 7-12 dígitos após palavras-chave
```

## 📊 Exemplos Reais

### CNH Capturada (Exemplo da Imagem)
```
ORIGINAL:
RI,I'UHIICA FLDERATIVA DO BRASIL
MINISTÉRIO DA INFRAL STRUTURA
DEPARTAMENTO NACIONAL DE TRÂNSITO
...

LIMPO:
REPUBLICA FEDERATIVA DO BRASIL
MINISTERIO DA INFRAESTRUTURA
DEPARTAMENTO NACIONAL DE TRANSITO
NOME LUIZ AUGUSTO VALE BATISTA
DOC 001972590 SSP RN
CPF 013 983 734 51
...

EXTRAÍDO:
CPF: 013.983.734-51 ✅
```

## 🚀 Próximos Passos

Para melhorar ainda mais:

1. **Google Vision API** (melhor precisão que Tesseract)
2. **Crop automático** (detectar bordas do documento)
3. **Rotação automática** (alinhar documento)
4. **OCR especializado em CNH** (treinado especificamente)

## 💡 Dicas Específicas para CNH

### Campos que o sistema busca:
- ✅ CPF (principal identificador)
- ✅ RG/Registro
- ✅ Nome completo
- ✅ Data de nascimento
- ✅ Filiação (nome da mãe/pai)

### O que NÃO é necessário capturar:
- ❌ Validade
- ❌ Categoria
- ❌ Permissão
- ❌ Observações

### Formato ideal de captura:
```
┌─────────────────────────────┐
│                             │
│    [CÂMERA 15-30cm]         │
│           ↓                 │
│  ┌─────────────────┐        │
│  │  CNH - FRENTE   │        │
│  │  ═══════════════ │        │
│  │  Foto + Dados   │        │
│  └─────────────────┘        │
│                             │
│  Iluminação uniforme        │
│  Sem reflexos               │
│  Documento plano            │
└─────────────────────────────┘
```

## 📞 Suporte

Se mesmo após seguir as dicas o OCR não funcionar:

1. **Use o Modo Teste** para verificar se o restante do sistema funciona
2. **Verifique no console (F12)** os logs detalhados
3. **Capture screenshot** do documento + texto extraído
4. **Contacte suporte técnico** com essas informações
