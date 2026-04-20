import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpar dados existentes (apenas em desenvolvimento)
  if (process.env.NODE_ENV !== 'production') {
    await prisma.mensagemViicio.deleteMany();
    await prisma.execucaoPython.deleteMany();
    await prisma.scriptPython.deleteMany();
    await prisma.pendenciaAprendizado.deleteMany();
    await prisma.atendimentoExame.deleteMany();
    await prisma.sinonimoExame.deleteMany();
    await prisma.carteirinhaConvenio.deleteMany();
    await prisma.documentoCapturado.deleteMany();
    await prisma.atendimento.deleteMany();
    await prisma.exame.deleteMany();
    await prisma.medico.deleteMany();
    await prisma.paciente.deleteMany();
    await prisma.convenio.deleteMany();
    await prisma.unidade.deleteMany();
    await prisma.logSistema.deleteMany();
    await prisma.configuracaoSistema.deleteMany();
    await prisma.usuarioAdmin.deleteMany();
  }

  // 1. CRIAR USUÁRIO ADMIN INICIAL
  const senhaHash = await bcrypt.hash('Luiz2012@', 12);
  const adminUser = await prisma.usuarioAdmin.create({
    data: {
      nome: 'Administrador',
      email: 'contato@luizaugusto.me',
      senhaHash,
      perfil: 'ADMIN',
      ativo: true,
    },
  });
  console.log('✅ Usuário administrador criado');

  // 2. CRIAR UNIDADES
  const unidadePrincipal = await prisma.unidade.create({
    data: {
      nome: 'Unidade Principal',
      codigo: 'PRINCIPAL',
      ativo: true,
    },
  });
  
  const unidadeFilial = await prisma.unidade.create({
    data: {
      nome: 'Filial Centro',
      codigo: 'FILIAL_CENTRO',
      ativo: true,
    },
  });
  console.log('✅ Unidades criadas');

  // 3. CRIAR CONVÊNIOS
  const particular = await prisma.convenio.create({
    data: {
      nome: 'Particular',
      codigo: 'PARTICULAR',
      exigeCarteirinha: false,
      ativo: true,
      configJson: {
        desconto: false,
        autorizacao_automatica: true,
        mensagem_padrao: 'Atendimento particular processado com sucesso!',
      },
    },
  });

  const unimed = await prisma.convenio.create({
    data: {
      nome: 'Unimed',
      codigo: 'UNIMED',
      exigeCarteirinha: true,
      ativo: true,
      configJson: {
        desconto: true,
        autorizacao_automatica: false,
        mensagem_padrao: 'Atendimento Unimed em análise. Você receberá retorno em breve.',
        script_autorizacao: 'autorizar_unimed.py',
      },
    },
  });

  const hapvida = await prisma.convenio.create({
    data: {
      nome: 'Hapvida',
      codigo: 'HAPVIDA',
      exigeCarteirinha: true,
      ativo: true,
      configJson: {
        desconto: true,
        autorizacao_automatica: false,
        mensagem_padrao: 'Atendimento Hapvida processado.',
      },
    },
  });

  const convenioXPTO = await prisma.convenio.create({
    data: {
      nome: 'Convênio XPTO',
      codigo: 'XPTO',
      exigeCarteirinha: true,
      ativo: true,
      configJson: {
        desconto: false,
        autorizacao_automatica: true,
        mensagem_padrao: 'Seu atendimento foi processado com sucesso!',
        script_autorizacao: 'autorizar_padrao.py',
      },
    },
  });
  console.log('✅ Convênios criados');

  // 4. CRIAR EXAMES PADRÃO
  const exameGlicose = await prisma.exame.create({
    data: {
      nomePadrao: 'Glicose',
      codigoInterno: 'GLI001',
      codigoTuss: '40304051',
      setor: 'Bioquímica',
      material: 'Soro',
      ativo: true,
    },
  });

  const exameHemograma = await prisma.exame.create({
    data: {
      nomePadrao: 'Hemograma Completo',
      codigoInterno: 'HEM001',
      codigoTuss: '40301010',
      setor: 'Hematologia',
      material: 'Sangue Total com EDTA',
      ativo: true,
    },
  });

  const exameHemoglobinaGlicada = await prisma.exame.create({
    data: {
      nomePadrao: 'Hemoglobina Glicada',
      codigoInterno: 'HGL001',
      codigoTuss: '40304361',
      setor: 'Bioquímica',
      material: 'Sangue Total com EDTA',
      ativo: true,
    },
  });

  const exameUreia = await prisma.exame.create({
    data: {
      nomePadrao: 'Ureia',
      codigoInterno: 'URE001',
      codigoTuss: '40301435',
      setor: 'Bioquímica',
      material: 'Soro',
      ativo: true,
    },
  });

  const exameCreatinina = await prisma.exame.create({
    data: {
      nomePadrao: 'Creatinina',
      codigoInterno: 'CRE001',
      codigoTuss: '40301123',
      setor: 'Bioquímica',
      material: 'Soro',
      ativo: true,
    },
  });
  console.log('✅ Exames criados');

  // 5. CRIAR SINÔNIMOS GLOBAIS
  const sinonimoGlicose = [
    { descricao: 'glicose', tipo: 'EXATO' as const },
    { descricao: 'g', tipo: 'EXATO' as const },
    { descricao: 'gli', tipo: 'EXATO' as const },
    { descricao: 'glic', tipo: 'EXATO' as const },
    { descricao: 'glicemia', tipo: 'CONTEM' as const },
  ];

  for (const sinonimo of sinonimoGlicose) {
    await prisma.sinonimoExame.create({
      data: {
        exameId: exameGlicose.id,
        escopo: 'GLOBAL',
        descricaoVariacao: sinonimo.descricao,
        tipoMatch: sinonimo.tipo,
        ativo: true,
        criadoPorUsuarioId: adminUser.id,
      },
    });
  }

  const sinonimoHemograma = [
    { descricao: 'hemograma', tipo: 'EXATO' as const },
    { descricao: 'hemo', tipo: 'EXATO' as const },
    { descricao: 'h-e-m-o', tipo: 'EXATO' as const },
    { descricao: 'hemograma completo', tipo: 'EXATO' as const },
    { descricao: 'hemograma com plaquetas', tipo: 'CONTEM' as const },
  ];

  for (const sinonimo of sinonimoHemograma) {
    await prisma.sinonimoExame.create({
      data: {
        exameId: exameHemograma.id,
        escopo: 'GLOBAL',
        descricaoVariacao: sinonimo.descricao,
        tipoMatch: sinonimo.tipo,
        ativo: true,
        criadoPorUsuarioId: adminUser.id,
      },
    });
  }

  const sinonimoHemoglobinaGlicada = [
    { descricao: 'hemoglobina glicada', tipo: 'EXATO' as const },
    { descricao: 'hbgl', tipo: 'EXATO' as const },
    { descricao: 'a1c', tipo: 'EXATO' as const },
    { descricao: 'hba1c', tipo: 'EXATO' as const },
    { descricao: 'glicohemoglobina', tipo: 'CONTEM' as const },
  ];

  for (const sinonimo of sinonimoHemoglobinaGlicada) {
    await prisma.sinonimoExame.create({
      data: {
        exameId: exameHemoglobinaGlicada.id,
        escopo: 'GLOBAL',
        descricaoVariacao: sinonimo.descricao,
        tipoMatch: sinonimo.tipo,
        ativo: true,
        criadoPorUsuarioId: adminUser.id,
      },
    });
  }
  console.log('✅ Sinônimos de exames criados');

  // 6. CRIAR SCRIPTS PYTHON DE EXEMPLO
  const scriptAutorizacaoUnimed = await prisma.scriptPython.create({
    data: {
      nome: 'Autorização Unimed',
      caminho: './python-scripts/autorizar_unimed.py',
      parametrosPermitidosJson: {
        atendimento_id: 'string',
        convenio_codigo: 'string',
        exames: 'array',
        paciente_cpf: 'string',
        numero_carteira: 'string',
      },
      timeoutSegundos: 120,
      ativo: true,
    },
  });

  const scriptAutorizacaoPadrao = await prisma.scriptPython.create({
    data: {
      nome: 'Autorização Padrão',
      caminho: './python-scripts/autorizar_padrao.py',
      parametrosPermitidosJson: {
        atendimento_id: 'string',
        convenio_codigo: 'string',
        exames: 'array',
      },
      timeoutSegundos: 60,
      ativo: true,
    },
  });
  console.log('✅ Scripts Python criados');

  // 7. CRIAR CONFIGURAÇÕES INICIAIS
  await prisma.configuracaoSistema.createMany({
    data: [
      {
        chave: 'totem.timeout_minutos',
        valorJson: { valor: 10 },
      },
      {
        chave: 'totem.auto_advance',
        valorJson: { valor: true },
      },
      {
        chave: 'ocr.provider_padrao',
        valorJson: { valor: 'google-vision' },
      },
      {
        chave: 'ia.provider_padrao',
        valorJson: { valor: 'claude' },
      },
      {
        chave: 'viicio.habilitado',
        valorJson: { valor: true },
      },
      {
        chave: 'aprendizado.score_minimo_confianca',
        valorJson: { valor: 0.7 },
      },
      {
        chave: 'sistema.versao',
        valorJson: { valor: '1.0.0' },
      },
      {
        chave: 'integracao.legacy_habilitado',
        valorJson: { valor: false },
      },
    ],
  });
  console.log('✅ Configurações do sistema criadas');

  // 8. CRIAR MÉDICOS DE EXEMPLO
  const medico1 = await prisma.medico.create({
    data: {
      nome: 'Dr. João Silva',
      crm: '12345',
      ufCrm: 'SP',
    },
  });

  const medico2 = await prisma.medico.create({
    data: {
      nome: 'Dra. Maria Santos',
      crm: '67890',
      ufCrm: 'RJ',
    },
  });
  console.log('✅ Médicos de exemplo criados');

  console.log('\\n🎉 Seed concluído com sucesso!');
  console.log('\\n📋 Dados criados:');
  console.log(`👤 Usuário Admin: contato@luizaugusto.me / Luiz2012@`);
  console.log(`🏢 Unidades: ${2}`);
  console.log(`🏥 Convênios: ${4}`);
  console.log(`🧪 Exames: ${5}`);
  console.log(`🔄 Sinônimos: ${15}`);
  console.log(`🐍 Scripts Python: ${2}`);
  console.log(`⚙️  Configurações: ${8}`);
  console.log(`👨‍⚕️ Médicos: ${2}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });