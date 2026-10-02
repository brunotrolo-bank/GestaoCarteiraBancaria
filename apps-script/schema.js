/* GERADO por scripts/gerar-schema-apps-script.ts — não editar à mão (npm run schema:apps-script). */
var ESQUEMA = {
  "ref_segmentos": {
    "pk": [
      "codigo"
    ],
    "colunas": [
      {
        "nome": "codigo",
        "tipo": "string"
      },
      {
        "nome": "nome",
        "tipo": "string"
      },
      {
        "nome": "ordem",
        "tipo": "number"
      }
    ]
  },
  "ref_produtos": {
    "pk": [
      "codigo"
    ],
    "colunas": [
      {
        "nome": "codigo",
        "tipo": "string"
      },
      {
        "nome": "nome",
        "tipo": "string"
      }
    ]
  },
  "dim_agencias": {
    "pk": [
      "id_agencia"
    ],
    "colunas": [
      {
        "nome": "id_agencia",
        "tipo": "string"
      },
      {
        "nome": "nome",
        "tipo": "string"
      },
      {
        "nome": "cidade",
        "tipo": "string"
      }
    ]
  },
  "dim_posicoes": {
    "pk": [
      "id_posicao"
    ],
    "colunas": [
      {
        "nome": "id_posicao",
        "tipo": "string"
      },
      {
        "nome": "nome_posicao",
        "tipo": "string"
      },
      {
        "nome": "id_agencia",
        "tipo": "string"
      },
      {
        "nome": "segmento_especialidade",
        "tipo": "string"
      },
      {
        "nome": "capacidade_max_contas",
        "tipo": "number"
      },
      {
        "nome": "status",
        "tipo": "string"
      }
    ]
  },
  "dim_gerentes": {
    "pk": [
      "id_gerente"
    ],
    "colunas": [
      {
        "nome": "id_gerente",
        "tipo": "string"
      },
      {
        "nome": "nome_completo",
        "tipo": "string"
      },
      {
        "nome": "email_corporativo",
        "tipo": "string"
      },
      {
        "nome": "perfil",
        "tipo": "string"
      },
      {
        "nome": "status",
        "tipo": "string"
      }
    ]
  },
  "bridge_ocupacao_posicao": {
    "pk": [
      "id_ocupacao"
    ],
    "colunas": [
      {
        "nome": "id_ocupacao",
        "tipo": "string"
      },
      {
        "nome": "id_posicao",
        "tipo": "string"
      },
      {
        "nome": "id_gerente",
        "tipo": "string"
      },
      {
        "nome": "data_inicio",
        "tipo": "string"
      },
      {
        "nome": "data_fim",
        "tipo": "string"
      },
      {
        "nome": "tipo_vinculo",
        "tipo": "string"
      }
    ]
  },
  "fct_delegacoes": {
    "pk": [
      "id_delegacao"
    ],
    "colunas": [
      {
        "nome": "id_delegacao",
        "tipo": "string"
      },
      {
        "nome": "id_posicao_origem",
        "tipo": "string"
      },
      {
        "nome": "id_gerente_delegado",
        "tipo": "string"
      },
      {
        "nome": "data_inicio",
        "tipo": "string"
      },
      {
        "nome": "data_fim",
        "tipo": "string"
      },
      {
        "nome": "motivo",
        "tipo": "string"
      },
      {
        "nome": "escopo",
        "tipo": "string"
      },
      {
        "nome": "status_aprovacao",
        "tipo": "string"
      },
      {
        "nome": "criada_por",
        "tipo": "string"
      },
      {
        "nome": "criada_em",
        "tipo": "string"
      },
      {
        "nome": "decidida_por",
        "tipo": "string"
      },
      {
        "nome": "decidida_em",
        "tipo": "string"
      },
      {
        "nome": "revogada_em",
        "tipo": "string"
      }
    ]
  },
  "dim_clientes": {
    "pk": [
      "id_cliente"
    ],
    "colunas": [
      {
        "nome": "id_cliente",
        "tipo": "string"
      },
      {
        "nome": "nome_razao_social",
        "tipo": "string"
      },
      {
        "nome": "cpf_cnpj",
        "tipo": "string"
      },
      {
        "nome": "segmento_cliente",
        "tipo": "string"
      },
      {
        "nome": "faixa_renda_faturamento",
        "tipo": "number"
      },
      {
        "nome": "volume_aum",
        "tipo": "number"
      },
      {
        "nome": "score_risco",
        "tipo": "number"
      },
      {
        "nome": "id_posicao_carteira",
        "tipo": "string"
      },
      {
        "nome": "data_carteirizacao",
        "tipo": "string"
      },
      {
        "nome": "status",
        "tipo": "string"
      }
    ]
  },
  "bridge_vinculo_carteira": {
    "pk": [
      "id_vinculo"
    ],
    "colunas": [
      {
        "nome": "id_vinculo",
        "tipo": "string"
      },
      {
        "nome": "id_cliente",
        "tipo": "string"
      },
      {
        "nome": "id_posicao",
        "tipo": "string"
      },
      {
        "nome": "inicio_em",
        "tipo": "string"
      },
      {
        "nome": "fim_em",
        "tipo": "string"
      }
    ]
  },
  "fct_produtos_cliente": {
    "pk": [
      "id_cliente",
      "codigo_produto"
    ],
    "colunas": [
      {
        "nome": "id_cliente",
        "tipo": "string"
      },
      {
        "nome": "codigo_produto",
        "tipo": "string"
      },
      {
        "nome": "status",
        "tipo": "string"
      },
      {
        "nome": "data_contratacao",
        "tipo": "string"
      }
    ]
  },
  "fct_interacoes_crm": {
    "pk": [
      "id_interacao"
    ],
    "colunas": [
      {
        "nome": "id_interacao",
        "tipo": "string"
      },
      {
        "nome": "id_cliente",
        "tipo": "string"
      },
      {
        "nome": "id_posicao",
        "tipo": "string"
      },
      {
        "nome": "canal",
        "tipo": "string"
      },
      {
        "nome": "data",
        "tipo": "string"
      },
      {
        "nome": "nota",
        "tipo": "string"
      }
    ]
  },
  "fct_movimentacao_carteira": {
    "pk": [
      "id_movimentacao"
    ],
    "colunas": [
      {
        "nome": "id_movimentacao",
        "tipo": "string"
      },
      {
        "nome": "id_lote",
        "tipo": "string"
      },
      {
        "nome": "id_cliente",
        "tipo": "string"
      },
      {
        "nome": "id_posicao_origem",
        "tipo": "string"
      },
      {
        "nome": "id_posicao_destino",
        "tipo": "string"
      },
      {
        "nome": "motivo",
        "tipo": "string"
      },
      {
        "nome": "ator",
        "tipo": "string"
      },
      {
        "nome": "instante",
        "tipo": "string"
      },
      {
        "nome": "tipo",
        "tipo": "string"
      }
    ]
  },
  "log_auditoria": {
    "pk": [
      "id_log"
    ],
    "colunas": [
      {
        "nome": "id_log",
        "tipo": "string"
      },
      {
        "nome": "instante",
        "tipo": "string"
      },
      {
        "nome": "ator",
        "tipo": "string"
      },
      {
        "nome": "acao",
        "tipo": "string"
      },
      {
        "nome": "entidade",
        "tipo": "string"
      },
      {
        "nome": "id_entidade",
        "tipo": "string"
      },
      {
        "nome": "detalhe",
        "tipo": "string"
      }
    ]
  },
  "log_eventos": {
    "pk": [
      "id_evento"
    ],
    "colunas": [
      {
        "nome": "id_evento",
        "tipo": "string"
      },
      {
        "nome": "instante",
        "tipo": "string"
      },
      {
        "nome": "tipo",
        "tipo": "string"
      },
      {
        "nome": "payload",
        "tipo": "string"
      }
    ]
  }
};
