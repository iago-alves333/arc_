package com.quebramaldicao.model;

import java.time.Instant;

/**
 * Representa um lote de trabalho (chunk) na fila de processamento.
 * Cada chunk cobre um intervalo [inicio, fim] do espaço de procura.
 * Usa long porque o espaço de procura para palavras de 8 caracteres (26^8)
 * excede o limite de int.
 */
public class WorkChunk {

    private final int id;
    private final long inicio;
    private final long fim;
    private ChunkStatus status;
    private String alunoIdAtribuido;
    private Instant atribuidoEm;

    public WorkChunk(int id, long inicio, long fim) {
        this.id = id;
        this.inicio = inicio;
        this.fim = fim;
        this.status = ChunkStatus.PENDENTE;
        this.alunoIdAtribuido = null;
        this.atribuidoEm = null;
    }

    // --- Getters ---

    public int getId() {
        return id;
    }

    public long getInicio() {
        return inicio;
    }

    public long getFim() {
        return fim;
    }

    public ChunkStatus getStatus() {
        return status;
    }

    public String getAlunoIdAtribuido() {
        return alunoIdAtribuido;
    }

    public Instant getAtribuidoEm() {
        return atribuidoEm;
    }

    // --- Setters ---

    public void setStatus(ChunkStatus status) {
        this.status = status;
    }

    public void setAlunoIdAtribuido(String alunoIdAtribuido) {
        this.alunoIdAtribuido = alunoIdAtribuido;
    }

    public void setAtribuidoEm(Instant atribuidoEm) {
        this.atribuidoEm = atribuidoEm;
    }

    /**
     * Marca este chunk como atribuído a um aluno específico.
     */
    public void atribuirPara(String alunoId) {
        this.status = ChunkStatus.EM_PROCESSAMENTO;
        this.alunoIdAtribuido = alunoId;
        this.atribuidoEm = Instant.now();
    }

    /**
     * Retorna este chunk ao estado PENDENTE (para reatribuição).
     */
    public void resetar() {
        this.status = ChunkStatus.PENDENTE;
        this.alunoIdAtribuido = null;
        this.atribuidoEm = null;
    }

    /**
     * Marca este chunk como concluído.
     */
    public void concluir() {
        this.status = ChunkStatus.CONCLUIDO;
    }

    @Override
    public String toString() {
        return String.format("WorkChunk{id=%d, [%d-%d], status=%s, aluno=%s}",
                id, inicio, fim, status, alunoIdAtribuido);
    }
}
