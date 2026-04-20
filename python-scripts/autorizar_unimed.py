#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Autorização Unimed
============================

Script específico para processamento de autorizações do convênio Unimed.
Implementa regras específicas e pode integrar com APIs do convênio.

Parâmetros aceitos:
- atendimento_id: ID do atendimento
- convenio_codigo: Código do convênio (deve ser UNIMED)
- exames: Lista de exames solicitados
- paciente_cpf: CPF do paciente
- numero_carteira: Número da carteirinha Unimed

Funcionalidades:
- Validação de carteirinha
- Aplicação de regras específicas Unimed
- Categorização de exames por tipo
- Geração de números de autorização
"""

import json
import sys
import time
import hashlib
from datetime import datetime, timedelta


def validar_carteirinha(numero_carteira):
    """
    Simula validação da carteirinha Unimed
    """
    # Em produção, isso faria uma consulta à API da Unimed
    if not numero_carteira or len(numero_carteira) < 10:
        return False, "Número de carteirinha inválido"
    
    # Simular algumas carteirinhas inválidas para teste
    if numero_carteira.endswith('0000'):
        return False, "Carteirinha cancelada"
    
    return True, "Carteirinha válida"


def categorizar_exames(exames):
    """
    Categoriza exames por tipo de autorização necessária
    """
    exames_liberados = []
    exames_com_cota = []
    exames_requer_autorizacao = []
    
    # Dicionário de exames com regras específicas
    regras_exames = {
        'GLICOSE': {'categoria': 'liberado', 'cota_mensal': None},
        'HEMOGRAMA': {'categoria': 'liberado', 'cota_mensal': None},
        'UREIA': {'categoria': 'liberado', 'cota_mensal': None},
        'CREATININA': {'categoria': 'liberado', 'cota_mensal': None},
        'HEMOGLOBINA GLICADA': {'categoria': 'cota', 'cota_mensal': 2},
        'COLESTEROL': {'categoria': 'cota', 'cota_mensal': 1},
        'TRIGLICERIDES': {'categoria': 'cota', 'cota_mensal': 1},
        'RESSONANCIA': {'categoria': 'autorizacao', 'cota_mensal': None},
        'TOMOGRAFIA': {'categoria': 'autorizacao', 'cota_mensal': None},
        'ULTRASSOM': {'categoria': 'cota', 'cota_mensal': 3},
    }
    
    for exame in exames:
        nome_exame = exame.get('nome', '').upper()
        
        # Buscar por correspondência parcial
        categoria_encontrada = None
        for nome_regra, regra in regras_exames.items():
            if nome_regra in nome_exame:
                categoria_encontrada = regra
                break
        
        if categoria_encontrada:
            if categoria_encontrada['categoria'] == 'liberado':
                exames_liberados.append(exame)
            elif categoria_encontrada['categoria'] == 'cota':
                exames_com_cota.append({
                    **exame,
                    'cota_mensal': categoria_encontrada['cota_mensal']
                })
            elif categoria_encontrada['categoria'] == 'autorizacao':
                exames_requer_autorizacao.append(exame)
        else:
            # Exame não mapeado - requer autorização
            exames_requer_autorizacao.append(exame)
    
    return exames_liberados, exames_com_cota, exames_requer_autorizacao


def simular_verificacao_cota(paciente_cpf, exame):
    """
    Simula verificação de cota mensal do paciente
    """
    # Em produção, consultaria histórico real do paciente
    # Para simulação, usar hash do CPF para determinar uso de cota
    hash_cpf = int(hashlib.md5(paciente_cpf.encode()).hexdigest(), 16)
    uso_atual = hash_cpf % 3  # Simular uso entre 0-2
    
    cota_mensal = exame.get('cota_mensal', 1)
    
    if uso_atual < cota_mensal:
        return True, f"Cota disponível ({uso_atual}/{cota_mensal})"
    else:
        return False, f"Cota esgotada ({uso_atual}/{cota_mensal})"


def gerar_numero_autorizacao(atendimento_id, tipo='UNI'):
    """
    Gera número de autorização único
    """
    timestamp = int(time.time())
    return f"{tipo}_{atendimento_id}_{timestamp}"


def autorizar_unimed(dados):
    """
    Processa autorização específica Unimed
    """
    atendimento_id = dados.get('atendimento_id')
    convenio_codigo = dados.get('convenio_codigo', '').upper()
    exames = dados.get('exames', [])
    paciente_cpf = dados.get('paciente_cpf', '')
    numero_carteira = dados.get('numero_carteira', '')
    
    # Validar se é realmente Unimed
    if convenio_codigo != 'UNIMED':
        return {
            'status': 'erro',
            'motivo': f'Script Unimed chamado para convênio {convenio_codigo}',
            'observacoes': 'Usar script apropriado para o convênio.',
        }
    
    # Validar carteirinha
    carteira_valida, msg_carteira = validar_carteirinha(numero_carteira)
    if not carteira_valida:
        return {
            'status': 'rejeitado',
            'motivo': f'Carteirinha inválida: {msg_carteira}',
            'observacoes': 'Verificar dados da carteirinha e tentar novamente.',
        }
    
    # Categorizar exames
    liberados, com_cota, requer_autorizacao = categorizar_exames(exames)
    
    # Processar cada categoria
    exames_autorizados = []
    exames_rejeitados = []
    exames_pendentes = []
    
    # 1. Exames liberados - autorização automática
    for exame in liberados:
        exames_autorizados.append({
            **exame,
            'autorizado': True,
            'numero_autorizacao': gerar_numero_autorizacao(atendimento_id, 'UNI_LIB'),
            'categoria': 'liberado',
        })
    
    # 2. Exames com cota - verificar disponibilidade
    for exame in com_cota:
        cota_disponivel, msg_cota = simular_verificacao_cota(paciente_cpf, exame)
        
        if cota_disponivel:
            exames_autorizados.append({
                **exame,
                'autorizado': True,
                'numero_autorizacao': gerar_numero_autorizacao(atendimento_id, 'UNI_COT'),
                'categoria': 'cota',
                'observacao_cota': msg_cota,
            })
        else:
            exames_rejeitados.append({
                **exame,
                'autorizado': False,
                'categoria': 'cota_esgotada',
                'motivo_rejeicao': f'Cota mensal esgotada: {msg_cota}',
            })
    
    # 3. Exames que requerem autorização prévia
    for exame in requer_autorizacao:
        exames_pendentes.append({
            **exame,
            'autorizado': False,
            'categoria': 'requer_autorizacao',
            'protocolo_pendencia': gerar_numero_autorizacao(atendimento_id, 'UNI_PEND'),
            'prazo_resposta': (datetime.now() + timedelta(hours=24)).isoformat(),
        })
    
    # Determinar status final
    total_exames = len(exames)
    autorizados = len(exames_autorizados)
    rejeitados = len(exames_rejeitados)
    pendentes = len(exames_pendentes)
    
    if autorizados == total_exames:
        status = 'aprovado'
        motivo = f'Todos os {autorizados} exames foram autorizados'
    elif rejeitados == total_exames:
        status = 'rejeitado'
        motivo = f'Todos os {rejeitados} exames foram rejeitados'
    else:
        status = 'parcial'
        motivo = f'{autorizados} autorizados, {rejeitados} rejeitados, {pendentes} pendentes'
    
    resultado = {
        'status': status,
        'motivo': motivo,
        'exames_autorizados': exames_autorizados,
        'exames_rejeitados': exames_rejeitados,
        'exames_pendentes': exames_pendentes,
        'resumo': {
            'total': total_exames,
            'autorizados': autorizados,
            'rejeitados': rejeitados,
            'pendentes': pendentes,
        },
        'observacoes': f'Processamento Unimed concluído. Carteirinha: {numero_carteira}',
        'numero_carteira_validada': numero_carteira,
    }
    
    return resultado


def main():
    """
    Função principal do script
    """
    try:
        # Ler dados de entrada
        if len(sys.argv) > 1:
            dados_entrada = json.loads(sys.argv[1])
        else:
            dados_entrada = json.load(sys.stdin)
        
        # Simular tempo de processamento API
        time.sleep(3)
        
        # Processar autorização Unimed
        resultado = autorizar_unimed(dados_entrada)
        
        # Adicionar metadados
        resultado.update({
            'processado_em': datetime.now().isoformat(),
            'script_versao': '1.0.0',
            'script_tipo': 'unimed_autorizacao',
            'success': True,
        })
        
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
        return 0
        
    except json.JSONDecodeError as e:
        erro = {
            'success': False,
            'erro': 'JSON inválido',
            'detalhes': str(e),
            'processado_em': datetime.now().isoformat(),
            'script_tipo': 'unimed_autorizacao',
        }
        print(json.dumps(erro, ensure_ascii=False))
        return 1
        
    except Exception as e:
        erro = {
            'success': False,
            'erro': 'Erro no processamento Unimed',
            'detalhes': str(e),
            'processado_em': datetime.now().isoformat(),
            'script_tipo': 'unimed_autorizacao',
        }
        print(json.dumps(erro, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    exit(main())