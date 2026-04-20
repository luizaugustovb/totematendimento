/**
 * Servidor de Teste OCR - Standalone
 * Execute: node ocr-test-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 3000;

// Configurar variáveis de ambiente
process.env.GOOGLE_APPLICATION_CREDENTIALS = './totemcacim-45358352cab5.json';

// ============================================
// ESTADO DA SINCRONIZAÇÃO (em memória)
// ============================================
let statusSincronizacao = {
  exames: {
    totalSincronizados: 0,
    ultimaSincronizacao: null,
    ultimoCodigoSync: 0
  },
  medicos: {
    totalSincronizados: 0,
    ultimaSincronizacao: null,
    ultimoCodigoSync: 0
  }
};

// ============================================
// DADOS EM MEMÓRIA (simulando banco PostgreSQL)
// ============================================
let examesCache = []; // Exames sincronizados do SQL Server
let medicosCache = []; // Médicos sincronizados do SQL Server
let sinonimos = []; // Sinônimos criados pelo admin
let logsAuditoria = []; // Logs de ações do admin

// ============================================
// LISTAS DE EXCLUSÃO (persistidas em arquivo)
// ============================================
const EXCLUSOES_FILE = path.join(__dirname, 'exclusoes.json');

let examesExcluidos = new Set(); // cod_exame excluídos
let medicosExcluidos = new Set(); // crm_medico excluídos

function carregarExclusoes() {
  try {
    if (fs.existsSync(EXCLUSOES_FILE)) {
      const data = JSON.parse(fs.readFileSync(EXCLUSOES_FILE, 'utf8'));
      examesExcluidos = new Set((data.exames || []).map(String));
      medicosExcluidos = new Set((data.medicos || []).map(String));
      console.log(`📋 Exclusões carregadas: ${examesExcluidos.size} exames, ${medicosExcluidos.size} médicos`);
    }
  } catch (e) {
    console.warn('⚠️  Não foi possível carregar exclusoes.json:', e.message);
  }
}

function salvarExclusoes() {
  try {
    fs.writeFileSync(EXCLUSOES_FILE, JSON.stringify({
      exames: [...examesExcluidos],
      medicos: [...medicosExcluidos]
    }, null, 2));
  } catch (e) {
    console.error('❌ Erro ao salvar exclusoes.json:', e.message);
  }
}

// Carregar exclusões ao iniciar
carregarExclusoes();

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // AWS Textract
  if (req.url === '/api/ocr/aws-textract' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { image } = JSON.parse(body);
        const resultado = await processarAWSTextract(image);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sucesso: true, ...resultado }));
      } catch (erro) {
        console.error('❌ Erro AWS Textract:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sucesso: false, erro: erro.message }));
      }
    });
    return;
  }

  // Google Vision
  if (req.url === '/api/ocr/google-vision' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { image } = JSON.parse(body);
        const resultado = await processarGoogleVision(image);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sucesso: true, ...resultado }));
      } catch (erro) {
        console.error('❌ Erro Google Vision:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sucesso: false, erro: erro.message }));
      }
    });
    return;
  }

  // Azure Vision
  if (req.url === '/api/ocr/azure-vision' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { image } = JSON.parse(body);
        const resultado = await processarAzureVision(image);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sucesso: true, ...resultado }));
      } catch (erro) {
        console.error('❌ Erro Azure Vision:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sucesso: false, erro: erro.message }));
      }
    });
    return;
  }

  // Buscar Cliente (Totem)
  if (req.url === '/api/totem/processar-documento' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { dados_ocr, imagem_base64 } = JSON.parse(body);
        const cpf = dados_ocr.cpf || dados_ocr.rg;
        
        console.log('🔍 Buscando cliente no SQL Server - CPF:', cpf);
        
        // Buscar no SQL Server REAL
        const cliente = await buscarClienteSQLServer(cpf);
        
        if (cliente) {
          console.log('✅ Cliente encontrado:', cliente.nome);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            sucesso: true,
            clienteEncontrado: true,
            cliente_encontrado: true,
            dados_cliente: cliente,
            cliente
          }));
        } else {
          console.log('❌ Cliente não encontrado no banco');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            sucesso: true,
            clienteEncontrado: false,
            cliente_encontrado: false,
            mensagem: 'Cliente não encontrado no sistema'
          }));
        }
      } catch (erro) {
        console.error('❌ Erro ao buscar cliente:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ erro: erro.message }));
      }
    });
    return;
  }

  // Status da Sincronização (Admin)
  if (req.url === '/api/totem/sync/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true,
      exames: statusSincronizacao.exames,
      medicos: statusSincronizacao.medicos
    }));
    return;
  }

  // Sincronização Manual (Admin)
  if (req.url === '/api/totem/sync/manual' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { tipo } = JSON.parse(body || '{}');
        
        console.log('🔄 Sincronização manual iniciada - Tipo:', tipo || 'ambos');
        
        const resultados = {
          exames: { sucesso: false, quantidade: 0 },
          medicos: { sucesso: false, quantidade: 0 }
        };
        
        // Sincronizar EXAMES
        if (tipo === 'exames' || tipo === 'ambos' || !tipo) {
          try {
            const exames = await sincronizarExamesSQLServer();
            resultados.exames.sucesso = true;
            resultados.exames.quantidade = exames.length;
            console.log(`✅ ${exames.length} exames sincronizados`);
            
            // Atualizar status global
            statusSincronizacao.exames.totalSincronizados = exames.length;
            statusSincronizacao.exames.ultimaSincronizacao = new Date().toISOString();
            if (exames.length > 0) {
              statusSincronizacao.exames.ultimoCodigoSync = exames[0].cod_exame || 0;
            }
          } catch (erro) {
            console.error('❌ Erro ao sincronizar exames:', erro.message);
            resultados.exames.erro = erro.message;
          }
        }
        
        // Sincronizar MÉDICOS
        if (tipo === 'medicos' || tipo === 'ambos' || !tipo) {
          try {
            const medicos = await sincronizarMedicosSQLServer();
            resultados.medicos.sucesso = true;
            resultados.medicos.quantidade = medicos.length;
            console.log(`✅ ${medicos.length} médicos sincronizados`);
            
            // Atualizar status global
            statusSincronizacao.medicos.totalSincronizados = medicos.length;
            statusSincronizacao.medicos.ultimaSincronizacao = new Date().toISOString();
            if (medicos.length > 0) {
              statusSincronizacao.medicos.ultimoCodigoSync = medicos[0].crm_medico || 0;
            }
          } catch (erro) {
            console.error('❌ Erro ao sincronizar médicos:', erro.message);
            resultados.medicos.erro = erro.message;
          }
        }
        
        const total = resultados.exames.quantidade + resultados.medicos.quantidade;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          sucesso: true,
          mensagem: `Sincronização concluída: ${total} registros`,
          registrosSincronizados: total,
          detalhes: resultados
        }));
      } catch (erro) {
        console.error('❌ Erro na sincronização:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          sucesso: false,
          mensagem: 'Erro na sincronização: ' + erro.message
        }));
      }
    });
    return;
  }

  // ============================================
  // ENDPOINTS DO ADMIN
  // ============================================

  // Buscar Exames (para admin)
  if (req.url === '/api/totem/exames/buscar' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { textoOcr, limit = 20 } = JSON.parse(body);
        
        if (!textoOcr || textoOcr.length < 2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, mensagem: 'Texto muito curto' }));
          return;
        }
        
        const query = textoOcr.toLowerCase();
        
        // Buscar nos exames em cache
        const resultados = examesCache
          .map(ex => {
            const nomeExame = (ex.descr_exame || '').toLowerCase();
            const codExame = (ex.cod_exame || '').toString().toLowerCase();
            
            // Calcular score de correspondência
            let score = 0;
            let matchTipo = 'nenhum';
            
            if (nomeExame === query || codExame === query) {
              score = 1.0;
              matchTipo = 'exato';
            } else if (nomeExame.includes(query) || codExame.includes(query)) {
              score = 0.8;
              matchTipo = 'parcial';
            } else if (query.split(' ').some(palavra => nomeExame.includes(palavra))) {
              score = 0.6;
              matchTipo = 'palavra';
            }
            
            if (score > 0) {
              return {
                score,
                matchTipo,
                exame: {
                  id: ex.cod_exame,
                  codExameLegado: ex.cod_exame,
                  nomePadrao: ex.descr_exame,
                  codigoInterno: ex.cod_exame,
                  codigoTuss: ex.cod_exame,
                }
              };
            }
            return null;
          })
          .filter(r => r !== null)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true,
          exames: resultados 
        }));
      } catch (erro) {
        console.error('❌ Erro ao buscar exames:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, erro: erro.message }));
      }
    });
    return;
  }

  // Obter Sinônimos de um Exame
  if (req.url.match(/^\/api\/totem\/sinonimos\/(.+)$/) && req.method === 'GET') {
    const exameId = req.url.match(/^\/api\/totem\/sinonimos\/(.+)$/)[1];
    
    const sinonimoDoExame = sinonimos.filter(s => String(s.exameId) === String(exameId));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true,
      sinonimos: sinonimoDoExame
    }));
    return;
  }

  // Adicionar Sinônimo
  if (req.url === '/api/totem/sinonimos' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { exameId, sinonimo, descricaoVariacao } = JSON.parse(body);
        const textoSinonimo = sinonimo || descricaoVariacao;
        
        if (!exameId || !textoSinonimo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, mensagem: 'Dados incompletos' }));
          return;
        }
        
        // Verificar se já existe
        const existe = sinonimos.find(s => 
          String(s.exameId) === String(exameId) && s.sinonimo.toLowerCase() === textoSinonimo.toLowerCase()
        );
        
        if (existe) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, mensagem: 'Sinônimo já existe' }));
          return;
        }
        
        const novoSinonimo = {
          id: Date.now(),
          exameId: String(exameId),
          sinonimo: textoSinonimo.trim(),
          descricaoVariacao: textoSinonimo.trim(),
          escopo: 'GLOBAL',
          ativo: true,
          criadoEm: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        
        sinonimos.push(novoSinonimo);
        
        console.log(`✅ Sinônimo adicionado: "${textoSinonimo}" para exame ${exameId}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true,
          mensagem: 'Sinônimo adicionado com sucesso',
          sinonimo: novoSinonimo
        }));
      } catch (erro) {
        console.error('❌ Erro ao adicionar sinônimo:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, erro: erro.message }));
      }
    });
    return;
  }

  // Remover Sinônimo
  if (req.url === '/api/totem/sinonimos/remover' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { sinonimoId } = JSON.parse(body);
        
        const index = sinonimos.findIndex(s => s.id === sinonimoId);
        
        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, mensagem: 'Sinônimo não encontrado' }));
          return;
        }
        
        sinonimos.splice(index, 1);
        
        console.log(`🗑️  Sinônimo removido: ID ${sinonimoId}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true,
          mensagem: 'Sinônimo removido com sucesso'
        }));
      } catch (erro) {
        console.error('❌ Erro ao remover sinônimo:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, erro: erro.message }));
      }
    });
    return;
  }

  // Listar Exames (para admin)
  if (req.url === '/api/admin/exames' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true,
      exames: examesCache,
      total: examesCache.length
    }));
    return;
  }

  // Excluir Exame (remove do cache e impede reimportação)
  if (req.url.match(/^\/api\/admin\/exames\/(.+)$/) && req.method === 'DELETE') {
    const codExame = req.url.match(/^\/api\/admin\/exames\/(.+)$/)[1];
    const antes = examesCache.length;
    examesCache = examesCache.filter(ex => String(ex.cod_exame) !== String(codExame));
    examesExcluidos.add(String(codExame));
    salvarExclusoes();
    console.log(`🗑️  Exame excluído permanentemente: ${codExame} (cache: ${antes} → ${examesCache.length}, excluídos: ${examesExcluidos.size})`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, mensagem: 'Exame excluído e não será reimportado' }));
    return;
  }

  // Listar Médicos (para admin)
  if (req.url === '/api/admin/medicos' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true,
      medicos: medicosCache,
      total: medicosCache.length
    }));
    return;
  }

  // Editar Médico
  if (req.url.match(/^\/api\/admin\/medicos\/(.+)$/) && req.method === 'PUT') {
    const medicoId = req.url.match(/^\/api\/admin\/medicos\/(.+)$/)[1];
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const dadosAtualizados = JSON.parse(body);
        
        const index = medicosCache.findIndex(m => m.crm_medico === medicoId);
        
        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, mensagem: 'Médico não encontrado' }));
          return;
        }
        
        medicosCache[index] = { ...medicosCache[index], ...dadosAtualizados };
        
        console.log(`✏️  Médico atualizado: CRM ${medicoId}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true,
          mensagem: 'Médico atualizado com sucesso',
          medico: medicosCache[index]
        }));
      } catch (erro) {
        console.error('❌ Erro ao editar médico:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, erro: erro.message }));
      }
    });
    return;
  }

  // Excluir Médico (remove do cache e impede reimportação)
  if (req.url.match(/^\/api\/admin\/medicos\/(.+)$/) && req.method === 'DELETE') {
    const medicoId = req.url.match(/^\/api\/admin\/medicos\/(.+)$/)[1];
    const antes = medicosCache.length;
    medicosCache = medicosCache.filter(m => String(m.crm_medico) !== String(medicoId));
    medicosExcluidos.add(String(medicoId));
    salvarExclusoes();
    console.log(`🗑️  Médico excluído permanentemente: CRM ${medicoId} (cache: ${antes} → ${medicosCache.length}, excluídos: ${medicosExcluidos.size})`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, mensagem: 'Médico excluído e não será reimportado' }));
    return;
  }

  // Listar Logs de Auditoria
  if (req.url.startsWith('/api/totem/logs/auditoria') && req.method === 'GET') {
    const urlParams = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const acao = urlParams.get('acao');
    const dataInicio = urlParams.get('dataInicio');
    const limit = parseInt(urlParams.get('limit') || '100');
    
    let logs = logsAuditoria;
    
    if (acao) {
      logs = logs.filter(log => log.acao === acao);
    }
    
    if (dataInicio) {
      logs = logs.filter(log => log.timestamp >= dataInicio);
    }
    
    logs = logs.slice(0, limit);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true,
      logs,
      total: logs.length
    }));
    return;
  }

  // Criar Log de Auditoria
  if (req.url === '/api/totem/logs/auditoria' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { acao, detalhes, resultado } = JSON.parse(body);
        
        const log = {
          id: Date.now(),
          acao,
          detalhes,
          resultado,
          timestamp: new Date().toISOString(),
          usuario: 'admin'
        };
        
        logsAuditoria.unshift(log);
        
        // Manter apenas os últimos 1000 logs
        if (logsAuditoria.length > 1000) {
          logsAuditoria = logsAuditoria.slice(0, 1000);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, log }));
      } catch (erro) {
        console.error('❌ Erro ao criar log:', erro.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, erro: erro.message }));
      }
    });
    return;
  }

  // Servir arquivos estáticos (HTML, CSS, JS, imagens)
  if (req.method === 'GET') {
    try {
      // Mapear URLs para arquivos
      let filePath;
      
      if (req.url === '/' || req.url === '/portal.html') {
        filePath = path.join(__dirname, '..', 'web-totem', 'portal.html');
      } else if (req.url === '/totem.html') {
        filePath = path.join(__dirname, '..', 'web-totem', 'totem.html');
      } else if (req.url === '/admin-sinonimos.html') {
        filePath = path.join(__dirname, '..', 'web-totem', 'admin-sinonimos.html');
      } else if (req.url === '/index.html') {
        filePath = path.join(__dirname, '..', 'web-totem', 'index.html');
      } else if (req.url.startsWith('/images/')) {
        filePath = path.join(__dirname, '..', 'web-totem', req.url);
      } else {
        // Tentar servir arquivo da pasta web-totem
        filePath = path.join(__dirname, '..', 'web-totem', req.url);
      }

      // Verificar se arquivo existe
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.webp': 'image/webp'
        };
        
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const content = fs.readFileSync(filePath);
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      }
    } catch (erro) {
      console.error('❌ Erro ao servir arquivo:', erro.message);
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ erro: 'Endpoint não encontrado' }));
});

// === Processadores OCR ===

async function processarGoogleVision(base64Image) {
  const inicio = Date.now();
  
  try {
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();

    const imageContent = base64Image.includes(',') 
      ? base64Image.split(',')[1]
      : base64Image;

    const [result] = await client.textDetection({
      image: { content: Buffer.from(imageContent, 'base64') }
    });

    const detections = result.textAnnotations || [];
    const texto = detections[0]?.description || '';
    
    // Calcular confiança média
    const fullTextAnnotation = result.fullTextAnnotation;
    let confiancaMedia = 0;
    let totalPalavras = 0;

    if (fullTextAnnotation?.pages) {
      fullTextAnnotation.pages.forEach(page => {
        page.blocks?.forEach(block => {
          block.paragraphs?.forEach(paragraph => {
            paragraph.words?.forEach(word => {
              if (word.confidence) {
                confiancaMedia += word.confidence;
                totalPalavras++;
              }
            });
          });
        });
      });
    }

    confiancaMedia = totalPalavras > 0 ? (confiancaMedia / totalPalavras) * 100 : 95;
    const tempo = (Date.now() - inicio) / 1000;

    console.log(`✅ Google Vision: ${tempo.toFixed(2)}s, confiança: ${confiancaMedia.toFixed(1)}%`);

    return {
      texto: texto.trim(),
      confianca: confiancaMedia,
      tempo,
      palavras: detections.length - 1
    };
  } catch (erro) {
    console.error('❌ Google Vision erro:', erro.message);
    throw new Error(`Google Vision falhou: ${erro.message}`);
  }
}

async function processarAWSTextract(base64Image) {
  const inicio = Date.now();
  
  try {
    const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
    
    const imageBytes = base64Image.includes(',') 
      ? Buffer.from(base64Image.split(',')[1], 'base64')
      : Buffer.from(base64Image, 'base64');

    const client = new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new DetectDocumentTextCommand({
      Document: { Bytes: imageBytes }
    });

    const response = await client.send(command);
    
    let textoCompleto = '';
    let confiancaMedia = 0;
    let totalBlocos = 0;

    response.Blocks?.forEach(block => {
      if (block.BlockType === 'LINE') {
        textoCompleto += (block.Text || '') + '\n';
        confiancaMedia += block.Confidence || 0;
        totalBlocos++;
      }
    });

    confiancaMedia = totalBlocos > 0 ? confiancaMedia / totalBlocos : 0;
    const tempo = (Date.now() - inicio) / 1000;

    console.log(`✅ AWS Textract: ${tempo.toFixed(2)}s, confiança: ${confiancaMedia.toFixed(1)}%`);

    return {
      texto: textoCompleto.trim(),
      confianca: confiancaMedia,
      tempo,
      blocos: response.Blocks?.length || 0
    };
  } catch (erro) {
    console.error('❌ AWS Textract erro:', erro.message);
    throw new Error(`AWS Textract falhou: ${erro.message}`);
  }
}

async function processarAzureVision(base64Image) {
  const inicio = Date.now();
  
  try {
    const fetch = require('node-fetch');
    const apiKey = process.env.AZURE_VISION_API_KEY;
    const endpoint = process.env.AZURE_VISION_ENDPOINT;
    
    if (!apiKey || !endpoint) {
      throw new Error('AZURE_VISION_API_KEY ou AZURE_VISION_ENDPOINT não configurados');
    }

    const imageBytes = base64Image.includes(',')
      ? Buffer.from(base64Image.split(',')[1], 'base64')
      : Buffer.from(base64Image, 'base64');

    const analyzeUrl = `${endpoint}/vision/v3.2/read/analyze?language=pt`;
    
    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: imageBytes
    });

    if (!analyzeResponse.ok) {
      const errorData = await analyzeResponse.json();
      throw new Error(errorData.error?.message || 'Erro ao analisar imagem');
    }

    const operationLocation = analyzeResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('Operation-Location não retornado');
    }

    // Polling para resultado
    let resultado;
    let tentativas = 0;
    const maxTentativas = 30;

    while (tentativas < maxTentativas) {
      await sleep(500);
      
      const resultResponse = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey }
      });

      resultado = await resultResponse.json();
      
      if (resultado.status === 'succeeded') break;
      if (resultado.status === 'failed') throw new Error('Azure OCR falhou');
      
      tentativas++;
    }

    if (resultado.status !== 'succeeded') {
      throw new Error('Timeout aguardando resultado');
    }

    let textoCompleto = '';
    let totalLinhas = 0;

    resultado.analyzeResult?.readResults?.forEach(page => {
      page.lines?.forEach(line => {
        textoCompleto += line.text + '\n';
        totalLinhas++;
      });
    });

    const tempo = (Date.now() - inicio) / 1000;
    const confianca = 92;

    console.log(`✅ Azure Vision: ${tempo.toFixed(2)}s, ${totalLinhas} linhas`);

    return {
      texto: textoCompleto.trim(),
      confianca,
      tempo,
      linhas: totalLinhas
    };
  } catch (erro) {
    console.error('❌ Azure Vision erro:', erro.message);
    throw new Error(`Azure Vision falhou: ${erro.message}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === Busca no SQL Server ===

async function buscarClienteSQLServer(cpf) {
  let pool = null;
  
  try {
    const sql = require('mssql');
    
    // Configuração do SQL Server (do .env)
    require('dotenv').config();
    
    const config = {
      user: process.env.SQL_SERVER_USER || 'sa',
      password: process.env.SQL_SERVER_PASSWORD || '',
      server: process.env.SQL_SERVER_HOST || 'localhost',
      database: process.env.SQL_SERVER_DATABASE || 'LaboratorioDB',
      port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
    
    console.log('📡 Conectando ao SQL Server:', config.server);
    
    pool = await new sql.ConnectionPool(config).connect();
    
    console.log('✅ Conexão SQL Server estabelecida');
    
    // Limpar CPF
    const cpfLimpo = cpf.replace(/[^\d]/g, '');
    
    // Query real da tabela cliente
    const query = `
      SELECT TOP 1
        cod_cliente,
        nome_cliente,
        cpf_cliente,
        identidade_cliente,
        nascimento_cliente,
        sexo_cliente,
        fone_cliente,
        celular_cliente,
        email_cliente,
        endereco_cliente,
        endereco_numero_cliente,
        complemento_cliente,
        bairro_cliente,
        cidade_cliente,
        estado_cliente,
        cep_cliente,
        nome_mae,
        nome_pai,
        data_cadastro
      FROM cliente
      WHERE cpf_cliente = @cpf
        OR cpf_cliente = @cpfFormatado
    `;
    
    const result = await pool
      .request()
      .input('cpf', sql.VarChar(11), cpfLimpo)
      .input('cpfFormatado', sql.VarChar(14), formatarCPF(cpfLimpo))
      .query(query);
    
    if (result.recordset && result.recordset.length > 0) {
      const c = result.recordset[0];
      
      // Formatar data de nascimento
      let dataNasc = null;
      if (c.nascimento_cliente) {
        const d = new Date(c.nascimento_cliente);
        dataNasc = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
      
      // Montar endereço completo
      let endereco = c.endereco_cliente || '';
      if (c.endereco_numero_cliente) endereco += ', ' + c.endereco_numero_cliente;
      if (c.complemento_cliente) endereco += ' - ' + c.complemento_cliente;
      if (c.bairro_cliente) endereco += ' - ' + c.bairro_cliente;
      if (c.cidade_cliente) endereco += ' - ' + c.cidade_cliente;
      if (c.estado_cliente) endereco += '/' + c.estado_cliente;
      
      return {
        id: c.cod_cliente?.toString(),
        codigo_cliente: c.cod_cliente,
        nome: c.nome_cliente,
        cpf: cpfLimpo,
        rg: c.identidade_cliente,
        data_nascimento: dataNasc,
        sexo: c.sexo_cliente,
        telefone: c.fone_cliente,
        celular: c.celular_cliente,
        email: c.email_cliente,
        endereco: endereco.trim(),
        bairro: c.bairro_cliente,
        cidade: c.cidade_cliente,
        estado: c.estado_cliente,
        cep: c.cep_cliente,
        nome_mae: c.nome_mae,
        nome_pai: c.nome_pai,
      };
    }
    
    return null;
    
  } catch (erro) {
    console.error('❌ Erro ao buscar no SQL Server:', erro.message);
    throw erro;
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Conexão SQL Server fechada');
    }
  }
}

function formatarCPF(cpf) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// === SINCRONIZAÇÃO SQL SERVER (SOMENTE SELECT) ===

/**
 * Sincroniza EXAMES do SQL Server
 * ATENÇÃO: SOMENTE SELECT - Não modifica o SQL Server!
 */
async function sincronizarExamesSQLServer() {
  let pool = null;
  
  try {
    const sql = require('mssql');
    require('dotenv').config();
    
    const config = {
      user: process.env.SQL_SERVER_USER || 'sa',
      password: process.env.SQL_SERVER_PASSWORD || '',
      server: process.env.SQL_SERVER_HOST || 'localhost',
      database: process.env.SQL_SERVER_DATABASE || 'LaboratorioDB',
      port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000,
      },
    };
    
    console.log('📡 Conectando ao SQL Server para sincronizar EXAMES...');
    
    pool = await new sql.ConnectionPool(config).connect();
    
    console.log('✅ Conexão estabelecida');
    
    // Sincronização INCREMENTAL - buscar TODOS os exames (não apenas 1000)
    // Se já temos exames, buscamos apenas os novos
    let query = '';
    const ultimoCodigo = statusSincronizacao.exames.ultimoCodigoSync;
    
    if (ultimoCodigo && examesCache.length > 0) {
      // Buscar apenas exames NOVOS (código > último sincronizado)
      query = `
        SELECT 
          cod_exame,
          descr_exame
        FROM tipo_ex
        WHERE cod_exame > @ultimoCodigo
        ORDER BY cod_exame ASC
      `;
      
      const result = await pool.request()
        .input('ultimoCodigo', sql.VarChar, ultimoCodigo)
        .query(query);
      
      const novosExamesRaw = result.recordset || [];
      const novosExames = novosExamesRaw.filter(ex => !examesExcluidos.has(String(ex.cod_exame)));
      
      if (novosExames.length > 0) {
        // Adicionar novos exames ao cache (excluídos já filtrados)
        examesCache = [...examesCache, ...novosExames];
        console.log(`📥 ${novosExames.length} NOVOS exames adicionados (total: ${examesCache.length})`);
      } else {
        console.log(`✅ Nenhum exame novo encontrado`);
      }
      
      return novosExames;
    } else {
      // Primeira sincronização - buscar TUDO
      query = `
        SELECT 
          cod_exame,
          descr_exame
        FROM tipo_ex
        ORDER BY cod_exame ASC
      `;
      
      const result = await pool.request().query(query);
      
      // Substituir cache completo, filtrando excluídos
      const todos = result.recordset || [];
      examesCache = todos.filter(ex => !examesExcluidos.has(String(ex.cod_exame)));
      const filtrados = todos.length - examesCache.length;
      
      console.log(`📥 ${todos.length} exames no SQL Server → ${examesCache.length} carregados (${filtrados} excluídos ignorados)`);
      
      return examesCache;
    }
    
  } catch (erro) {
    console.error('❌ Erro ao sincronizar exames:', erro.message);
    throw erro;
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Conexão SQL Server fechada (exames)');
    }
  }
}

/**
 * Sincroniza MÉDICOS do SQL Server
 * ATENÇÃO: SOMENTE SELECT - Não modifica o SQL Server!
 */
async function sincronizarMedicosSQLServer() {
  let pool = null;
  
  try {
    const sql = require('mssql');
    require('dotenv').config();
    
    const config = {
      user: process.env.SQL_SERVER_USER || 'sa',
      password: process.env.SQL_SERVER_PASSWORD || '',
      server: process.env.SQL_SERVER_HOST || 'localhost',
      database: process.env.SQL_SERVER_DATABASE || 'LaboratorioDB',
      port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000,
      },
    };
    
    console.log('📡 Conectando ao SQL Server para sincronizar MÉDICOS...');
    
    pool = await new sql.ConnectionPool(config).connect();
    
    console.log('✅ Conexão estabelecida');
    
    // Sincronização INCREMENTAL - buscar TODOS os médicos
    let query = '';
    const ultimoCRM = statusSincronizacao.medicos.ultimoCodigoSync;
    
    if (ultimoCRM && medicosCache.length > 0) {
      // Buscar apenas médicos NOVOS
      query = `
        SELECT 
          crm_medico,
          uf_medico,
          nome_medico,
          conselho_medico
        FROM medico
        WHERE crm_medico IS NOT NULL
          AND uf_medico IS NOT NULL
          AND nome_medico IS NOT NULL
          AND crm_medico > @ultimoCRM
        ORDER BY crm_medico ASC
      `;
      
      const result = await pool.request()
        .input('ultimoCRM', sql.VarChar, ultimoCRM)
        .query(query);
      
      const novosMedicosRaw = result.recordset || [];
      const novosMedicos = novosMedicosRaw.filter(m => !medicosExcluidos.has(String(m.crm_medico)));
      
      if (novosMedicos.length > 0) {
        // Adicionar novos médicos ao cache (excluídos já filtrados)
        medicosCache = [...medicosCache, ...novosMedicos];
        console.log(`📥 ${novosMedicos.length} NOVOS médicos adicionados (total: ${medicosCache.length})`);
      } else {
        console.log(`✅ Nenhum médico novo encontrado`);
      }
      
      return novosMedicos;
    } else {
      // Primeira sincronização - buscar TUDO
      query = `
        SELECT 
          crm_medico,
          uf_medico,
          nome_medico,
          conselho_medico
        FROM medico
        WHERE crm_medico IS NOT NULL
          AND uf_medico IS NOT NULL
          AND nome_medico IS NOT NULL
        ORDER BY crm_medico ASC
      `;
      
      const result = await pool.request().query(query);
      
      // Substituir cache completo, filtrando excluídos
      const todos = result.recordset || [];
      medicosCache = todos.filter(m => !medicosExcluidos.has(String(m.crm_medico)));
      const filtrados = todos.length - medicosCache.length;
      
      console.log(`📥 ${todos.length} médicos no SQL Server → ${medicosCache.length} carregados (${filtrados} excluídos ignorados)`);
      
      return medicosCache;
    }
    
  } catch (erro) {
    console.error('❌ Erro ao sincronizar médicos:', erro.message);
    throw erro;
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Conexão SQL Server fechada (médicos)');
    }
  }
}

// Iniciar servidor
server.listen(PORT, async () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('   Servidor OCR Test rodando!');
  console.log('🚀 ========================================');
  console.log('');
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Endpoints disponíveis:');
  console.log('   ✅ GET  /health');
  console.log('   🔤 POST /api/ocr/google-vision');
  console.log('   ☁️  POST /api/ocr/aws-textract');
  console.log('   🔷 POST /api/ocr/azure-vision');
  console.log('');
  console.log('⚙️  Configuração:');
  console.log(`   Google: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅' : '❌'}`);
  console.log(`   AWS: ${process.env.AWS_ACCESS_KEY_ID ? '✅' : '❌'}`);
  console.log(`   Azure: ${process.env.AZURE_VISION_API_KEY ? '✅' : '❌'}`);
  console.log('');
  console.log('🧪 Teste: http://localhost/laboratorio-autoatendimento/apps/web-totem/ocr-comparison.html');
  console.log('');
  console.log('⏹️  Para parar: Ctrl+C');
  console.log('========================================');

  // ============================================
  // SINCRONIZAÇÃO AUTOMÁTICA AO INICIAR
  // ============================================
  console.log('');
  console.log('🔄 Iniciando sincronização automática com SQL Server...');
  try {
    const exames = await sincronizarExamesSQLServer();
    statusSincronizacao.exames.totalSincronizados = exames.length;
    statusSincronizacao.exames.ultimaSincronizacao = new Date().toISOString();
    if (exames.length > 0) statusSincronizacao.exames.ultimoCodigoSync = exames[exames.length - 1].cod_exame || 0;
    console.log(`✅ ${examesCache.length} exames carregados`);
  } catch (e) {
    console.warn('⚠️  Não foi possível sincronizar exames:', e.message);
  }
  try {
    const medicos = await sincronizarMedicosSQLServer();
    statusSincronizacao.medicos.totalSincronizados = medicos.length;
    statusSincronizacao.medicos.ultimaSincronizacao = new Date().toISOString();
    if (medicos.length > 0) statusSincronizacao.medicos.ultimoCodigoSync = medicos[medicos.length - 1].crm_medico || 0;
    console.log(`✅ ${medicosCache.length} médicos carregados`);
  } catch (e) {
    console.warn('⚠️  Não foi possível sincronizar médicos:', e.message);
  }
  console.log('');
  console.log('🟢 Sistema pronto!');
});
