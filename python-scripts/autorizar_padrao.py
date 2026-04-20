#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Autorização Padrão
============================

Este script simula um processo de autorização de exames baseado nos dados
do atendimento. Em produção, este script poderia integrar com sistemas
externos de autorização ou aplicar regras de negócio específicas.

Parâmetros aceitos:
- atendimento_id: ID do atendimento
- convenio_codigo: Código do convênio
- exames: Lista de exames solicitados

Retorno (JSON):
- status: "aprovado", "rejeitado", "pendente"
- motivo: Descrição do resultado
- exames_autorizados: Lista de exames autorizados
- observacoes: Observações adicionais
"""

import json
import sys
import time
from datetime import datetime


def autorizar_exames(dados):
    """
    Processa autorização dos exames
    """
    atendimento_id = dados.get('atendimento_id')
    convenio_codigo = dados.get('convenio_codigo', '').upper()
    exames = dados.get('exames', [])
    
    # Simulação de processamento
    time.sleep(2)  # Simula tempo de processamento
    
    # Regras de autorização por convênio
    if convenio_codigo == 'PARTICULAR':
        return {
            'status': 'aprovado',
            'motivo': 'Atendimento particular - autorização automática',
            'exames_autorizados': exames,
            'observacoes': 'Todos os exames foram autorizados automaticamente para atendimento particular.',
            'numero_autorizacao': f'PART_{atendimento_id}_{int(time.time())}',
        }
    
    elif convenio_codigo in ['UNIMED', 'HAPVIDA']:
        # Simular regras específicas do convênio
        exames_autorizados = []
        exames_rejeitados = []
        
        for exame in exames:
            nome_exame = exame.get('nome', '').upper()
            
            # Regras específicas (exemplo)
            if 'GLICOSE' in nome_exame or 'HEMOGRAMA' in nome_exame:
                exames_autorizados.append({
                    **exame,
                    'autorizado': True,
                    'numero_guia': f'GUI_{convenio_codigo}_{int(time.time())}',
                })
            else:
                exames_rejeitados.append({
                    **exame,
                    'autorizado': False,
                    'motivo_rejeicao': 'Exame requer autorização prévia',
                })
        
        if len(exames_rejeitados) > 0:
            return {
                'status': 'parcial',
                'motivo': f'{len(exames_autorizados)} exames autorizados, {len(exames_rejeitados)} rejeitados',
                'exames_autorizados': exames_autorizados,
                'exames_rejeitados': exames_rejeitados,
                'observacoes': 'Alguns exames requerem autorização prévia do convênio.',
            }
        else:
            return {
                'status': 'aprovado',
                'motivo': 'Todos os exames foram autorizados',
                'exames_autorizados': exames_autorizados,
                'observacoes': f'Autorização concedida pelo convênio {convenio_codigo}.',
            }
    
    else:
        # Convênio desconhecido - pendente de análise
        return {
            'status': 'pendente',
            'motivo': f'Convênio {convenio_codigo} requer análise manual',
            'exames_autorizados': [],
            'observacoes': 'Atendimento em análise. Aguarde contato da central de autorizações.',
        }


def main():
    """
    Função principal do script
    """
    try:
        # Ler dados de entrada do stdin ou argumentos
        if len(sys.argv) > 1:
            # Dados passados como argumento
            dados_entrada = json.loads(sys.argv[1])
        else:
            # Dados passados via stdin
            dados_entrada = json.load(sys.stdin)
        
        # Processar autorização
        resultado = autorizar_exames(dados_entrada)
        
        # Adicionar metadados do processamento
        resultado.update({
            'processado_em': datetime.now().isoformat(),
            'script_versao': '1.0.0',
            'success': True,
        })
        
        # Retornar resultado como JSON
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
        return 0
        
    except json.JSONDecodeError as e:
        erro = {
            'success': False,
            'erro': 'JSON inválido',
            'detalhes': str(e),
            'processado_em': datetime.now().isoformat(),
        }
        print(json.dumps(erro, ensure_ascii=False))
        return 1
        
    except Exception as e:
        erro = {
            'success': False,
            'erro': 'Erro interno do script',
            'detalhes': str(e),
            'processado_em': datetime.now().isoformat(),
        }
        print(json.dumps(erro, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    exit(main())