package com.quebramaldicao.model;

/**
 * Estado possível de um lote (chunk) de trabalho.
 */
public enum ChunkStatus {
    /** Aguardando atribuição a um worker. */
    PENDENTE,

    /** Atribuído a um worker e em processamento. */
    EM_PROCESSAMENTO,

    /** Worker concluiu o processamento deste lote. */
    CONCLUIDO
}
