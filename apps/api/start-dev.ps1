# Script para iniciar o backend em modo desenvolvimento
Set-Location $PSScriptRoot
Write-Host "Diretório atual: $(Get-Location)" -ForegroundColor Green
Write-Host "Iniciando backend NestJS com tsx..." -ForegroundColor Cyan

# Rodar com tsx do node_modules raiz (versão simplificada sem Winston)
node ..\..\node_modules\tsx\dist\cli.mjs watch src/main-simple.ts
