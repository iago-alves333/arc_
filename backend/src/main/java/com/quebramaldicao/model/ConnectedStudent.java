package com.quebramaldicao.model;

import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Representa um aluno conectado via WebSocket (um "Worker Node").
 * Cada aluno recebe uma palavra aleatória da lista para quebrar.
 */
public class ConnectedStudent {

    private final String id;
    private final String nome;
    private final WebSocketSession session;
    private final Instant conectadoEm;
    private int lotesProcessados;

    // --- Estado individual do jogo ---
    /** Palavra normalizada para comparação (ex: "maldicao") */
    private String targetPassword;
    /** Palavra original para exibição na UI (ex: "Maldição") */
    private String displayPassword;
    private boolean senhaEncontrada;
    private final CopyOnWriteArrayList<WorkChunk> chunks;

    public ConnectedStudent(String id, String nome, WebSocketSession session) {
        this.id = id;
        this.nome = nome;
        this.session = session;
        this.conectadoEm = Instant.now();
        this.lotesProcessados = 0;
        this.senhaEncontrada = false;
        this.chunks = new CopyOnWriteArrayList<>();
    }

    // --- Getters ---

    public String getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public WebSocketSession getSession() {
        return session;
    }

    public Instant getConectadoEm() {
        return conectadoEm;
    }

    public int getLotesProcessados() {
        return lotesProcessados;
    }

    public String getTargetPassword() {
        return targetPassword;
    }

    public String getDisplayPassword() {
        return displayPassword;
    }

    public boolean isSenhaEncontrada() {
        return senhaEncontrada;
    }

    public CopyOnWriteArrayList<WorkChunk> getChunks() {
        return chunks;
    }

    // --- Setters ---

    public void setTargetPassword(String targetPassword) {
        this.targetPassword = targetPassword;
    }

    public void setDisplayPassword(String displayPassword) {
        this.displayPassword = displayPassword;
    }

    public void setSenhaEncontrada(boolean senhaEncontrada) {
        this.senhaEncontrada = senhaEncontrada;
    }

    /**
     * Incrementa o contador de lotes processados por este aluno.
     */
    public void incrementarLotesProcessados() {
        this.lotesProcessados++;
    }

    /**
     * Verifica se a sessão WebSocket ainda está aberta.
     */
    public boolean isConectado() {
        return session != null && session.isOpen();
    }

    /**
     * Calcula a percentagem de progresso individual deste aluno.
     */
    public double calcularProgresso() {
        if (chunks.isEmpty()) return 0.0;
        long concluidos = chunks.stream()
                .filter(c -> c.getStatus() == ChunkStatus.CONCLUIDO)
                .count();
        return (concluidos * 100.0) / chunks.size();
    }

    /**
     * Conta os chunks concluídos deste aluno.
     */
    public long contarChunksConcluidos() {
        return chunks.stream()
                .filter(c -> c.getStatus() == ChunkStatus.CONCLUIDO)
                .count();
    }

    @Override
    public String toString() {
        return String.format("ConnectedStudent{id=%s, nome='%s', target='%s', lotes=%d, encontrou=%b}",
                id, nome, displayPassword, lotesProcessados, senhaEncontrada);
    }
}
