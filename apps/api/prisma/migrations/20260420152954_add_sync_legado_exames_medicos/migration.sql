-- CreateEnum
CREATE TYPE "PerfilAdmin" AS ENUM ('ADMIN', 'SUPERVISOR', 'RECEPCAO', 'CONFIGURACAO');

-- CreateEnum
CREATE TYPE "StatusAtendimento" AS ENUM ('AGUARDANDO_COLETA', 'EM_ANDAMENTO', 'PROCESSANDO', 'FINALIZADO', 'CANCELADO', 'PENDENTE_REVISAO');

-- CreateEnum
CREATE TYPE "OrigemAtendimento" AS ENUM ('TOTEM', 'RECEPCAO');

-- CreateEnum
CREATE TYPE "StatusProcessamento" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "EscopoSinonimo" AS ENUM ('GLOBAL', 'MEDICO', 'CONVENIO');

-- CreateEnum
CREATE TYPE "TipoMatch" AS ENUM ('EXATO', 'CONTEM', 'REGEX', 'FUZZY', 'IA');

-- CreateEnum
CREATE TYPE "StatusMatch" AS ENUM ('PENDENTE', 'IDENTIFICADO', 'BAIXA_CONFIANCA', 'NAO_IDENTIFICADO', 'REVISAO_NECESSARIA', 'APROVADO');

-- CreateEnum
CREATE TYPE "StatusPendencia" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'IGNORADO');

-- CreateEnum
CREATE TYPE "NivelLog" AS ENUM ('ERROR', 'WARN', 'INFO', 'DEBUG');

-- CreateEnum
CREATE TYPE "StatusExecucao" AS ENUM ('PENDENTE', 'EXECUTANDO', 'CONCLUIDO', 'ERRO', 'TIMEOUT', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusMensagem" AS ENUM ('PENDENTE', 'ENVIANDO', 'ENVIADO', 'ERRO', 'FALHOU_DEFINITIVO');

-- CreateTable
CREATE TABLE "usuarios_admin" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "PerfilAdmin" NOT NULL DEFAULT 'ADMIN',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convenios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "exige_carteirinha" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "config_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicos" (
    "id" TEXT NOT NULL,
    "cod_medico_legado" INTEGER,
    "nome" TEXT NOT NULL,
    "crm" TEXT NOT NULL,
    "uf_crm" TEXT NOT NULL,
    "conselho" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "cpf" TEXT,
    "data_nascimento" TIMESTAMP(3),
    "rg" TEXT,
    "cnh" TEXT,
    "nome_mae" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "convenio_id" TEXT NOT NULL,
    "medico_id" TEXT,
    "unidade_id" TEXT,
    "status" "StatusAtendimento" NOT NULL DEFAULT 'AGUARDANDO_COLETA',
    "origem" "OrigemAtendimento" NOT NULL DEFAULT 'TOTEM',
    "telefone_confirmado" TEXT,
    "observacoes" TEXT,
    "dados_carteirinha_json" JSONB,
    "cliente_confirmado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_capturados" (
    "id" TEXT NOT NULL,
    "atendimento_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome_arquivo" TEXT,
    "caminho_arquivo" TEXT NOT NULL,
    "tamanho_bytes" INTEGER,
    "texto_ocr" TEXT,
    "metadados_json" JSONB,
    "score_confianca" DOUBLE PRECISION,
    "provider_ocr" TEXT,
    "status" "StatusProcessamento" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_capturados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carteirinhas_convenio" (
    "id" TEXT NOT NULL,
    "atendimento_id" TEXT NOT NULL,
    "numero_carteira" TEXT NOT NULL,
    "nome_beneficiario" TEXT NOT NULL,
    "validade" TIMESTAMP(3),
    "plano" TEXT,
    "json_extraido" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carteirinhas_convenio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exames" (
    "id" TEXT NOT NULL,
    "cod_exame_legado" INTEGER,
    "nome_padrao" TEXT NOT NULL,
    "codigo_interno" TEXT,
    "codigo_tuss" TEXT,
    "setor" TEXT,
    "material" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinonimos_exames" (
    "id" TEXT NOT NULL,
    "exame_id" TEXT NOT NULL,
    "escopo" "EscopoSinonimo" NOT NULL DEFAULT 'GLOBAL',
    "medico_id" TEXT,
    "convenio_id" TEXT,
    "descricao_variacao" TEXT NOT NULL,
    "tipo_match" "TipoMatch" NOT NULL DEFAULT 'EXATO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_usuario_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sinonimos_exames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento_exames" (
    "id" TEXT NOT NULL,
    "atendimento_id" TEXT NOT NULL,
    "exame_id" TEXT,
    "texto_original" TEXT NOT NULL,
    "texto_normalizado" TEXT,
    "origem_match" TEXT,
    "score_confianca" DOUBLE PRECISION,
    "status_match" "StatusMatch" NOT NULL DEFAULT 'PENDENTE',
    "revisado_manualmente" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atendimento_exames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendencias_aprendizado" (
    "id" TEXT NOT NULL,
    "atendimento_exame_id" TEXT NOT NULL,
    "texto_original" TEXT NOT NULL,
    "contexto" TEXT,
    "sugestao_ia" TEXT,
    "score_confianca" DOUBLE PRECISION,
    "status" "StatusPendencia" NOT NULL DEFAULT 'PENDENTE',
    "resolvido_por" TEXT,
    "resolvido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pendencias_aprendizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_sistema" (
    "id" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "nivel" "NivelLog" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "contexto_json" JSONB,
    "usuario_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_sistema" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripts_python" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "parametros_permitidos_json" JSONB NOT NULL,
    "timeout_segundos" INTEGER NOT NULL DEFAULT 60,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scripts_python_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucoes_python" (
    "id" TEXT NOT NULL,
    "atendimento_id" TEXT NOT NULL,
    "script_id" TEXT NOT NULL,
    "convenio_id" TEXT,
    "parametros_json" JSONB NOT NULL,
    "status" "StatusExecucao" NOT NULL DEFAULT 'PENDENTE',
    "stdout" TEXT,
    "stderr" TEXT,
    "codigo_retorno" INTEGER,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execucoes_python_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_viicio" (
    "id" TEXT NOT NULL,
    "atendimento_id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "resposta_json" JSONB,
    "status" "StatusMensagem" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultima_tentativa" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mensagens_viicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "telefone" TEXT,
    "cpf" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "email_verificado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tipo_mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "tipo" TEXT,
    "descricao" TEXT,
    "tags" TEXT[],
    "metadados" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "texto_extraido" TEXT,
    "interpretacao" TEXT,
    "thumbnail_path" TEXT,
    "pdf_path" TEXT,
    "compressed_path" TEXT,
    "virus_scan_result" TEXT,
    "categoria" TEXT,
    "confianca_classificacao" DOUBLE PRECISION,
    "usuario_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_history" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "job_data" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "duration" INTEGER,
    "success" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sincronizacoes_legado" (
    "id" TEXT NOT NULL,
    "tabela" TEXT NOT NULL,
    "ultimo_codigo_sync" INTEGER NOT NULL,
    "total_registros" INTEGER NOT NULL DEFAULT 0,
    "ultima_sincronizacao" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sincronizacoes_legado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "pdf_path" TEXT,
    "excel_path" TEXT,
    "usuario_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message_id" TEXT,
    "attachments" TEXT,
    "prioridade" TEXT,
    "usuario_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_admin_email_key" ON "usuarios_admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_codigo_key" ON "unidades"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "convenios_codigo_key" ON "convenios"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "medicos_cod_medico_legado_key" ON "medicos"("cod_medico_legado");

-- CreateIndex
CREATE UNIQUE INDEX "medicos_crm_uf_crm_key" ON "medicos"("crm", "uf_crm");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_cpf_key" ON "pacientes"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "atendimentos_protocolo_key" ON "atendimentos"("protocolo");

-- CreateIndex
CREATE UNIQUE INDEX "exames_cod_exame_legado_key" ON "exames"("cod_exame_legado");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_sistema_chave_key" ON "configuracoes_sistema"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "scripts_python_nome_key" ON "scripts_python"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "sincronizacoes_legado_tabela_key" ON "sincronizacoes_legado"("tabela");

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_capturados" ADD CONSTRAINT "documentos_capturados_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carteirinhas_convenio" ADD CONSTRAINT "carteirinhas_convenio_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinonimos_exames" ADD CONSTRAINT "sinonimos_exames_exame_id_fkey" FOREIGN KEY ("exame_id") REFERENCES "exames"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinonimos_exames" ADD CONSTRAINT "sinonimos_exames_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinonimos_exames" ADD CONSTRAINT "sinonimos_exames_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinonimos_exames" ADD CONSTRAINT "sinonimos_exames_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios_admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_exames" ADD CONSTRAINT "atendimento_exames_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_exames" ADD CONSTRAINT "atendimento_exames_exame_id_fkey" FOREIGN KEY ("exame_id") REFERENCES "exames"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendencias_aprendizado" ADD CONSTRAINT "pendencias_aprendizado_atendimento_exame_id_fkey" FOREIGN KEY ("atendimento_exame_id") REFERENCES "atendimento_exames"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendencias_aprendizado" ADD CONSTRAINT "pendencias_aprendizado_resolvido_por_fkey" FOREIGN KEY ("resolvido_por") REFERENCES "usuarios_admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_sistema" ADD CONSTRAINT "logs_sistema_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios_admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_python" ADD CONSTRAINT "execucoes_python_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_python" ADD CONSTRAINT "execucoes_python_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts_python"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_python" ADD CONSTRAINT "execucoes_python_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_viicio" ADD CONSTRAINT "mensagens_viicio_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
