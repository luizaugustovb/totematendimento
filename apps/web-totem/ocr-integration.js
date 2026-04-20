// Configuração da API
const API_BASE_URL = 'http://localhost:3000/api/totem';

// Estado global do atendimento
let atendimentoData = {
    cliente_id: null,
    cliente_encontrado: false,
    dados_cliente: {},
    dados_documento: {},
    dados_carteirinha: {},
    imagem_documento: null,
    imagem_carteirinha: null,
    imagem_guias: null,
    convenio: null
};

// Inicializar Tesseract.js
let tesseractWorker = null;

async function initOCR() {
    if (!tesseractWorker) {
        try {
            // Tesseract v5 - criar worker corretamente
            tesseractWorker = await Tesseract.createWorker('por', 1);
            console.log('✅ OCR inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar OCR:', error);
            tesseractWorker = null;
            throw error;
        }
    }
    return tesseractWorker;
}

/**
 * Processa OCR da imagem capturada
 */
async function processarOCR(imageData, tipo = 'documento') {
    try {
        showLoading(`Processando ${tipo}...`);
        
        // Inicializar OCR se necessário
        const worker = await initOCR();
        
        // Executar OCR
        const result = await worker.recognize(imageData);
        const text = result.data.text;
        console.log('📝 Texto extraído:', text);
        
        // Processar texto extraído
        const dadosExtraidos = extrairDadosTexto(text, tipo);
        
        hideLoading();
        return dadosExtraidos;
        
    } catch (error) {
        console.error('❌ Erro no OCR:', error);
        hideLoading();
        showError('Erro ao processar imagem. Tente novamente.');
        return null;
    }
}

/**
 * Extrai dados estruturados do texto OCR
 */
function extrairDadosTexto(texto, tipo) {
    const dados = {
        texto_completo: texto
    };
    
    if (tipo === 'documento') {
        // Extrair CPF
        const cpfMatch = texto.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
        if (cpfMatch) {
            dados.cpf = cpfMatch[1].replace(/[^\d]/g, '');
        }
        
        // Extrair RG
        const rgMatch = texto.match(/RG[\s:]*(\d[\d\.\-]+)/i);
        if (rgMatch) {
            dados.rg = rgMatch[1].replace(/[^\d]/g, '');
        }
        
        // Extrair Nome
        const nomeMatch = texto.match(/NOME[\s:]+([A-ZÀ-Ú\s]+)/i);
        if (nomeMatch) {
            dados.nome = nomeMatch[1].trim();
        }
        
        // Extrair Data de Nascimento
        const dataNascMatch = texto.match(/DATA\s+NASCIMENTO[\s:]*(\d{2}\/\d{2}\/\d{4})/i);
        if (dataNascMatch) {
            dados.data_nascimento = dataNascMatch[1];
        }
        
        // Extrair Nome da Mãe
        const nomeMaeMatch = texto.match(/FILIA[ÇC][ÃA]O[\s:]+([A-ZÀ-Ú\s]+)/i);
        if (nomeMaeMatch) {
            dados.nome_mae = nomeMaeMatch[1].trim();
        }
        
    } else if (tipo === 'carteirinha') {
        // Extrair número da carteirinha
        const carteirinhaMatch = texto.match(/(?:CARTEIRA|CARD|N[ºo°])[\s:]*([0-9]{8,20})/i);
        if (carteirinhaMatch) {
            dados.numero_carteirinha = carteirinhaMatch[1];
        }
        
        // Extrair nome titular
        const nomeTitularMatch = texto.match(/(?:TITULAR|NOME)[\s:]+([A-ZÀ-Ú\s]+)/i);
        if (nomeTitularMatch) {
            dados.nome_titular = nomeTitularMatch[1].trim();
        }
        
        // Extrair validade
        const validadeMatch = texto.match(/VALIDADE[\s:]*(\d{2}\/\d{2}\/\d{4})/i);
        if (validadeMatch) {
            dados.validade = validadeMatch[1];
        }
        
        // Identificar convênio
        const convenios = ['UNIMED', 'AMIL', 'BRADESCO', 'SULAMERICA', 'NOTREDAME'];
        for (const convenio of convenios) {
            if (texto.toUpperCase().includes(convenio)) {
                dados.convenio = convenio;
                break;
            }
        }
    }
    
    return dados;
}

/**
 * Captura documento e processa com OCR
 */
async function capturarDocumentoComOCR() {
    const video = document.getElementById('document-video');
    const canvas = document.getElementById('document-canvas');
    const captured = document.getElementById('document-captured');
    
    // Capturar imagem da câmera
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Converter para base64
    const imageData = canvas.toDataURL('image/png');
    atendimentoData.imagem_documento = imageData;
    
    // Mostrar loading
    video.style.display = 'none';
    captured.innerHTML = `
        <div class="text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p class="text-gray-600 font-bold">Processando documento...</p>
            <p class="text-gray-500 text-sm">Extraindo dados via OCR</p>
        </div>
    `;
    captured.style.display = 'flex';
    
    // Processar OCR
    const dadosOCR = await processarOCR(imageData, 'documento');
    
    if (!dadosOCR || !dadosOCR.cpf) {
        captured.innerHTML = `
            <div class="text-center">
                <i class="fas fa-exclamation-triangle text-6xl text-yellow-500 mb-4"></i>
                <p class="text-yellow-600 font-bold">CPF não identificado</p>
                <p class="text-gray-600 text-sm">Capture novamente com melhor iluminação</p>
            </div>
        `;
        
        // Permitir nova captura
        setTimeout(() => {
            captured.style.display = 'none';
            video.style.display = 'block';
        }, 3000);
        return;
    }
    
    // Consultar cliente no banco de dados
    const resultadoConsulta = await consultarCliente(dadosOCR, imageData);
    
    if (resultadoConsulta.success) {
        atendimentoData.dados_documento = dadosOCR;
        
        if (resultadoConsulta.cliente_encontrado) {
            // Cliente encontrado - mostrar confirmação
            mostrarConfirmacaoCliente(resultadoConsulta.dados_cliente);
        } else {
            // Cliente novo - continuar com os dados do OCR
            atendimentoData.cliente_encontrado = false;
            atendimentoData.dados_cliente = dadosOCR;
            
            captured.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-check-circle text-6xl text-green-500 mb-4"></i>
                    <p class="text-green-600 font-bold">Documento capturado!</p>
                    <p class="text-gray-600 text-sm">Novo cliente</p>
                    <p class="text-gray-900 font-bold mt-2">${dadosOCR.nome || 'Nome não identificado'}</p>
                    <p class="text-gray-600">CPF: ${formatarCPF(dadosOCR.cpf)}</p>
                </div>
            `;
            
            // Habilitar botão continuar
            document.getElementById('capture-document').style.display = 'none';
            document.getElementById('continue-to-card').style.display = 'inline-block';
        }
    }
}

/**
 * Consulta cliente no banco de dados via API
 */
async function consultarCliente(dadosOCR, imagemBase64) {
    try {
        const response = await fetch(`${API_BASE_URL}/processar-documento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                imagem: imagemBase64,
                dados_ocr: dadosOCR
            })
        });
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('Erro ao consultar cliente:', error);
        showError('Erro ao consultar banco de dados');
        return { success: false };
    }
}

/**
 * Mostra confirmação dos dados do cliente encontrado
 */
function mostrarConfirmacaoCliente(dadosCliente) {
    atendimentoData.cliente_id = dadosCliente.id;
    atendimentoData.cliente_encontrado = true;
    atendimentoData.dados_cliente = dadosCliente;
    
    const captured = document.getElementById('document-captured');
    
    captured.innerHTML = `
        <div class="w-full p-4 overflow-y-auto" style="max-height: 400px;">
            <div class="text-center mb-4">
                <i class="fas fa-user-check text-5xl text-green-500 mb-2"></i>
                <p class="text-green-600 font-bold text-lg">Cliente Encontrado!</p>
                <p class="text-gray-600 text-sm">Confirme se os dados estão corretos</p>
            </div>
            
            <div class="bg-white rounded-lg p-4 text-left space-y-2">
                <div class="border-b pb-2">
                    <p class="text-xs text-gray-500">Nome</p>
                    <p class="text-sm font-bold text-gray-900">${dadosCliente.nome}</p>
                </div>
                <div class="border-b pb-2">
                    <p class="text-xs text-gray-500">CPF</p>
                    <p class="text-sm font-bold text-gray-900">${formatarCPF(dadosCliente.cpf)}</p>
                </div>
                <div class="border-b pb-2">
                    <p class="text-xs text-gray-500">Data de Nascimento</p>
                    <p class="text-sm font-bold text-gray-900">${dadosCliente.data_nascimento || 'Não informado'}</p>
                </div>
                <div class="border-b pb-2">
                    <p class="text-xs text-gray-500">Telefone</p>
                    <p class="text-sm font-bold text-gray-900">${dadosCliente.telefone || 'Não informado'}</p>
                </div>
                <div class="pb-2">
                    <p class="text-xs text-gray-500">Endereço</p>
                    <p class="text-sm font-bold text-gray-900">${dadosCliente.endereco || 'Não informado'}</p>
                </div>
            </div>
            
            <div class="mt-4 flex gap-2">
                <button onclick="confirmarCliente(true)" class="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-bold">
                    <i class="fas fa-check mr-2"></i>Confirmar
                </button>
                <button onclick="confirmarCliente(false)" class="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-bold">
                    <i class="fas fa-times mr-2"></i>Não sou eu
                </button>
            </div>
        </div>
    `;
}

/**
 * Confirmação do cliente
 */
function confirmarCliente(confirmado) {
    if (confirmado) {
        // Cliente confirmado - ir para captura de carteirinha
        document.getElementById('capture-document').style.display = 'none';
        document.getElementById('continue-to-card').style.display = 'inline-block';
    } else {
        // Cliente negou - recapturar documento ou cadastro manual
        const captured = document.getElementById('document-captured');
        captured.innerHTML = `
            <div class="text-center">
                <i class="fas fa-user-plus text-6xl text-blue-500 mb-4"></i>
                <p class="text-blue-600 font-bold">Novo Cadastro</p>
                <p class="text-gray-600 text-sm">Continuaremos com cadastro novo</p>
            </div>
        `;
        
        atendimentoData.cliente_id = null;
        atendimentoData.cliente_encontrado = false;
        
        setTimeout(() => {
            document.getElementById('capture-document').style.display = 'none';
            document.getElementById('continue-to-card').style.display = 'inline-block';
        }, 2000);
    }
}

/**
 * Captura carteirinha com OCR
 */
async function capturarCarteirinhaComOCR() {
    const video = document.getElementById('card-video');
    const canvas = document.getElementById('card-canvas');
    const captured = document.getElementById('card-captured');
    
    // Capturar imagem
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/png');
    atendimentoData.imagem_carteirinha = imageData;
    
    // Mostrar loading
    video.style.display = 'none';
    captured.innerHTML = `
        <div class="text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p class="text-gray-600 font-bold">Processando carteirinha...</p>
        </div>
    `;
    captured.style.display = 'flex';
    
    // Processar OCR
    const dadosOCR = await processarOCR(imageData, 'carteirinha');
    
    if (dadosOCR) {
        atendimentoData.dados_carteirinha = dadosOCR;
        
        captured.innerHTML = `
            <div class="text-center">
                <i class="fas fa-check-circle text-6xl text-green-500 mb-4"></i>
                <p class="text-green-600 font-bold">Carteirinha capturada!</p>
                <p class="text-gray-900 font-bold mt-2">Nº ${dadosOCR.numero_carteirinha || 'N/A'}</p>
                ${dadosOCR.convenio ? `<p class="text-gray-600">${dadosOCR.convenio}</p>` : ''}
            </div>
        `;
        
        document.getElementById('capture-card').style.display = 'none';
        document.getElementById('continue-to-guides').style.display = 'inline-block';
    }
}

/**
 * Formata CPF para exibição
 */
function formatarCPF(cpf) {
    if (!cpf) return '';
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Mostra loading overlay
 */
function showLoading(mensagem = 'Processando...') {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
        loading.querySelector('.loading-message').textContent = mensagem;
        loading.classList.remove('hidden');
    }
}

/**
 * Esconde loading overlay
 */
function hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
        loading.classList.add('hidden');
    }
}

/**
 * Mostra mensagem de erro
 */
function showError(mensagem) {
    alert(mensagem); // Pode ser substituído por um modal customizado
}

/**
 * Finaliza atendimento e salva no banco
 */
async function finalizarAtendimentoComOCR() {
    try {
        showLoading('Salvando atendimento...');
        
        const response = await fetch(`${API_BASE_URL}/salvar-atendimento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                cliente_id: atendimentoData.cliente_id,
                dados_cliente: atendimentoData.dados_cliente,
                convenio: atendimentoData.convenio,
                dados_carteirinha: atendimentoData.dados_carteirinha,
                imagem_documento: atendimentoData.imagem_documento,
                imagem_carteirinha: atendimentoData.imagem_carteirinha,
                imagem_guias: atendimentoData.imagem_guias
            })
        });
        
        const result = await response.json();
        
        hideLoading();
        
        if (result.success) {
            // Mostrar tela de sucesso com protocolo
            document.getElementById('protocol-number').textContent = result.protocolo;
            stopCameraStream();
            showScreen('success-screen');
        } else {
            showError(result.message || 'Erro ao salvar atendimento');
        }
        
    } catch (error) {
        console.error('Erro ao finalizar atendimento:', error);
        hideLoading();
        showError('Erro ao salvar atendimento');
    }
}

/**
 * Limpa recursos do OCR
 */
async function cleanupOCR() {
    if (tesseractWorker) {
        try {
            await tesseractWorker.terminate();
            tesseractWorker = null;
            console.log('✅ Worker do OCR terminado');
        } catch (error) {
            console.error('❌ Erro ao terminar worker:', error);
        }
    }
}
