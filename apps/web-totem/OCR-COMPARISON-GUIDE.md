# 🔍 Teste Comparativo de OCR

Este arquivo permite testar 4 motores de OCR diferentes para ver qual funciona melhor com CNH/RG brasileiros:

## 🚀 Motores Testados

### 1. **Tesseract.js v5** (Local - Gratuito)
- ✅ Roda 100% no navegador
- ✅ Sem necessidade de API
- ✅ Privacidade total (imagem não sai do dispositivo)
- ⚠️ Precisão moderada para documentos brasileiros

### 2. **Google Cloud Vision** (API - Pago)
- 🌐 Requer API Key
- ✅ Alta precisão para texto impresso
- ✅ Suporte nativo para português
- 💰 Gratuito: 1.000 requisições/mês
- 📖 [Documentação](https://cloud.google.com/vision/docs)

### 3. **AWS Textract** (API - Pago)
- ☁️ Requer credenciais AWS
- ✅ Especializado em documentos estruturados
- ✅ Detecta formulários e tabelas
- 💰 Gratuito: 1.000 páginas/mês (3 primeiros meses)
- 📖 [Documentação](https://aws.amazon.com/textract)

### 4. **Azure Computer Vision** (API - Pago)
- 🔷 Requer API Key + Endpoint
- ✅ Ótimo para documentos de identidade
- ✅ API Read otimizada para texto
- 💰 Gratuito: 5.000 transações/mês
- 📖 [Documentação](https://azure.microsoft.com/pt-br/services/cognitive-services/computer-vision)

---

## 📋 Como Usar

### 1. Abrir o arquivo
```
http://localhost/laboratorio-autoatendimento/apps/web-totem/ocr-comparison.html
```

### 2. Configurar APIs (opcional)

#### Google Cloud Vision
1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto → APIs & Services → Enable "Cloud Vision API"
3. Credentials → Create API Key
4. Cole a chave no campo "Google Vision API Key"

#### AWS Textract
1. Acesse [AWS Console](https://aws.amazon.com/console)
2. IAM → Users → Create User
3. Attach Policy: `AmazonTextractFullAccess`
4. Security Credentials → Create Access Key
5. Cole Access Key ID e Secret Access Key

#### Azure Computer Vision
1. Acesse [Azure Portal](https://portal.azure.com)
2. Create Resource → AI + Machine Learning → Computer Vision
3. Keys and Endpoint → Copie Key 1 e Endpoint
4. Cole nos campos correspondentes

**Nota:** Tesseract funciona sem configuração!

### 3. Capturar Documento
1. Clique em **"📷 Iniciar Câmera"**
2. Posicione a CNH/RG
3. Clique em **"✅ Capturar e Testar"**

### 4. Ver Resultados
- Cada motor mostra:
  - ✅ Texto extraído
  - 📊 Confiança (%)
  - ⏱️ Tempo de processamento
  - 🆔 CPF encontrado
- O vencedor é destacado com borda verde 🏆

---

## ⚙️ Configuração Backend (Opcional)

Para usar AWS Textract e processar via backend (mais seguro):

### 1. Instalar dependências
```bash
cd apps/api
npm install @aws-sdk/client-textract
```

### 2. Configurar variáveis de ambiente
```env
# .env
AWS_REGION=sa-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

GOOGLE_VISION_API_KEY=your-google-api-key

AZURE_VISION_API_KEY=your-azure-key
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com
```

### 3. Reiniciar API
```bash
npm run start:dev
```

### 4. Endpoints disponíveis

**AWS Textract (Backend)**
```http
POST http://localhost:3000/api/ocr/aws-textract
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Google Vision (Backend)**
```http
POST http://localhost:3000/api/ocr/google-vision
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Azure Vision (Backend)**
```http
POST http://localhost:3000/api/ocr/azure-vision
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

---

## 🎯 Dicas para Melhor Resultado

### Iluminação
- ✅ Use luz natural ou artificial uniforme
- ❌ Evite sombras sobre o documento
- ❌ Evite reflexos (flash direto)

### Posicionamento
- ✅ Documento reto (paralelo à câmera)
- ✅ Preencha 70-80% do quadro
- ❌ Não corte bordas do documento

### Documento
- ✅ Superfície plana
- ✅ Documento limpo e sem dobras
- ❌ Evite documentos plastificados com reflexo

### Câmera
- ✅ Segure firme (evitar tremor)
- ✅ Foco nítido
- ✅ Resolução mínima 1080p

---

## 📊 Comparação de Custos

| Motor | Gratuito | Preço Pago | Melhor Para |
|-------|----------|------------|-------------|
| **Tesseract** | ♾️ Ilimitado | - | Prototipagem, privacidade |
| **Google Vision** | 1.000/mês | $1.50/1000 | Texto geral, multilíngue |
| **AWS Textract** | 1.000/mês* | $1.50/1000 | Formulários, tabelas |
| **Azure Vision** | 5.000/mês | $1.00/1000 | Documentos de identidade |

*Apenas primeiros 3 meses

---

## 🔒 Segurança

### Frontend (Navegador)
- ✅ Tesseract: Processamento 100% local
- ⚠️ APIs Cloud: Imagem enviada para servidores externos

### Backend (NestJS)
- ✅ Credenciais protegidas (não expostas ao frontend)
- ✅ Rate limiting
- ✅ Validação de requisições
- ✅ Logs de auditoria

**Recomendação:** Para dados sensíveis, sempre use backend!

---

## 🐛 Troubleshooting

### "⚠️ Sem API Key"
→ Configure as credenciais na seção "Configuração de APIs"

### "❌ Erro CORS"
→ Adicione CORS no backend (já configurado se usar endpoints `/api/ocr/*`)

### "Nenhum OCR encontrou CPF"
→ Melhore iluminação e posicionamento
→ Teste com pré-processamento ativado (Tesseract)

### Tesseract muito lento
→ Normal! Processa 100% no navegador
→ Tempo típico: 3-8 segundos

### AWS/Azure não funcionam
→ Use os endpoints do backend (mais seguro)
→ Credenciais no frontend são arriscadas

---

## 📝 Notas

1. **Performance:** Google e Azure geralmente são mais rápidos (1-2s)
2. **Precisão:** Azure Computer Vision costuma ter melhor taxa de acerto em CNH
3. **Custo:** Tesseract é sempre gratuito, APIs têm tier gratuito generoso
4. **Privacidade:** Tesseract é único que não envia dados externos
5. **Produção:** Recomenda-se usar backend para proteger credenciais

---

## 🎓 Próximos Passos

Após identificar o melhor OCR:

1. ✅ Integrar no `totem.html` principal
2. ✅ Adicionar fallback (tentar múltiplos se falhar)
3. ✅ Implementar cache de resultados
4. ✅ Adicionar validação de CPF (algoritmo verificador)
5. ✅ Criar métricas de acurácia
6. ✅ Implementar retry com ajuste de parâmetros

---

**Criado para:** Laboratório Autoatendimento  
**Versão:** 1.0.0  
**Última atualização:** Abril 2026
