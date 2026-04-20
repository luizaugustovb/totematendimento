# 📦 Instalação de Dependências OCR

## Instalar SDK da AWS (para AWS Textract)

```bash
cd apps/api
npm install @aws-sdk/client-textract
```

## Configurar variáveis de ambiente

Copie `.env.ocr.example` para `.env` ou adicione as variáveis ao seu `.env` existente:

```bash
# AWS Textract
AWS_REGION=sa-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Google Cloud Vision
GOOGLE_VISION_API_KEY=your-google-key

# Azure Computer Vision
AZURE_VISION_API_KEY=your-azure-key
AZURE_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com
```

## Reiniciar servidor

```bash
npm run start:dev
```

## Testar endpoints

### AWS Textract
```bash
curl -X POST http://localhost:3000/api/ocr/aws-textract \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,..."}'
```

### Google Vision
```bash
curl -X POST http://localhost:3000/api/ocr/google-vision \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,..."}'
```

### Azure Vision
```bash
curl -X POST http://localhost:3000/api/ocr/azure-vision \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,..."}'
```

## Verificar logs

O backend registra cada processamento:

```
✅ AWS Textract: 1.23s, confiança: 92.5%
✅ Google Vision: 0.85s, 47 palavras
✅ Azure Vision: 1.10s, 12 linhas
```
