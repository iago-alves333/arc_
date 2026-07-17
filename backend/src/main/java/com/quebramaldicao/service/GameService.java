package com.quebramaldicao.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quebramaldicao.model.ChunkStatus;
import com.quebramaldicao.model.ConnectedStudent;
import com.quebramaldicao.model.GameState;
import com.quebramaldicao.model.WorkChunk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Motor do Sistema Distribuído — O "Job Tracker".
 *
 * MODO COLABORATIVO: Todos os alunos trabalham juntos para quebrar
 * UMA ÚNICA senha compartilhada. O espaço de procura é dividido
 * em chunks que são distribuídos entre todos os nós.
 *
 * Também gerencia o estado global da partida (lobby/sincronização).
 */
@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    // =====================================================
    // Charset e configuração
    // =====================================================

    /** Charset para a força bruta: letras minúsculas + dígitos (36 caracteres) */
    private static final String CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

    /** Comprimento fixo das senhas (8 caracteres alfanuméricos) */
    private static final int WORD_LENGTH = 8;

    // =====================================================
    // Configuração
    // =====================================================

    @Value("${game.num-chunks:94}")
    private int numChunks;

    @Value("${game.chunk-timeout-seconds:15}")
    private int chunkTimeoutSeconds;

    /** Tamanho total do espaço de procura: 36^8 */
    private long totalSearchSpace;

    /** Tamanho de cada chunk */
    private long chunkSize;

    // =====================================================
    // Estado Global da Partida
    // =====================================================

    /** Estado atual da partida — controlado pelo Admin. */
    private volatile GameState estadoPartida = GameState.LOBBY_INICIAL;

    // =====================================================
    // SENHA COMPARTILHADA — Uma única senha para toda a turma
    // =====================================================

    /** A senha que TODOS os alunos trabalham juntos para quebrar. */
    private volatile String senhaCompartilhada;

    /** Nome do aluno que encontrou a senha. */
    private volatile String descobertoPor;

    /** Se a senha já foi encontrada globalmente. */
    private volatile boolean senhaGlobalEncontrada = false;

    /** Fila GLOBAL de chunks — compartilhada entre todos os alunos. */
    private final CopyOnWriteArrayList<WorkChunk> chunksGlobais = new CopyOnWriteArrayList<>();

    /** Total de lotes processados globalmente (todos os alunos somados). */
    private volatile int totalLotesGlobais = 0;

    // =====================================================
    // Estado em memória (thread-safe)
    // =====================================================

    private final ConcurrentHashMap<String, ConnectedStudent> students = new ConcurrentHashMap<>();

    // =====================================================
    // Inicialização
    // =====================================================

    @PostConstruct
    public void init() {
        totalSearchSpace = (long) Math.pow(CHARSET.length(), WORD_LENGTH);
        chunkSize = totalSearchSpace / numChunks;

        // Gerar a primeira senha compartilhada
        gerarNovaSenhaCompartilhada();

        log.info("=== QUEBRA DE MALDIÇÃO API INICIADA (MODO COLABORATIVO) ===");
        log.info("Charset: a-z0-9 ({} caracteres)", CHARSET.length());
        log.info("Comprimento da senha: {}", WORD_LENGTH);
        log.info("Espaço de procura: {} combinações (36^8)", String.format("%,d", totalSearchSpace));
        log.info("Chunks globais: {}", numChunks);
        log.info("Tamanho do chunk: {} combinações", String.format("%,d", chunkSize));
        log.info("Timeout de lote: {}s", chunkTimeoutSeconds);
        log.info("Senha compartilhada: '{}'", senhaCompartilhada);
    }

    // =====================================================
    // Geração de Senha Compartilhada
    // =====================================================

    /**
     * Gera uma nova senha alfanumérica aleatória de 8 caracteres
     * e recria a fila global de chunks.
     */
    private void gerarNovaSenhaCompartilhada() {
        StringBuilder sb = new StringBuilder(WORD_LENGTH);
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        for (int i = 0; i < WORD_LENGTH; i++) {
            sb.append(CHARSET.charAt(rng.nextInt(CHARSET.length())));
        }
        senhaCompartilhada = sb.toString();
        descobertoPor = null;
        senhaGlobalEncontrada = false;
        totalLotesGlobais = 0;

        // Recriar fila global de chunks
        criarChunksGlobais();

        log.info("🔒 Nova senha compartilhada gerada: '{}'", senhaCompartilhada);
    }

    /**
     * Cria a fila global de chunks para o espaço de procura.
     */
    private void criarChunksGlobais() {
        chunksGlobais.clear();
        for (int i = 0; i < numChunks; i++) {
            long start = (long) i * chunkSize;
            long end = (i == numChunks - 1) ? totalSearchSpace - 1 : start + chunkSize - 1;
            chunksGlobais.add(new WorkChunk(i, start, end));
        }
    }

    /**
     * Converte um índice numérico para a string correspondente.
     */
    private String indiceParaPalavra(long index) {
        char[] result = new char[WORD_LENGTH];
        int base = CHARSET.length();
        for (int i = WORD_LENGTH - 1; i >= 0; i--) {
            result[i] = CHARSET.charAt((int) (index % base));
            index /= base;
        }
        return new String(result);
    }

    // =====================================================
    // Gestão de Sessões (com suporte a Admin)
    // =====================================================

    /**
     * Regista um aluno (ou Admin) no jogo.
     * @param isAdmin true se o jogador ativou o modo Admin no frontend
     */
    public String registarAluno(WebSocketSession session, String nome, boolean isAdmin) {
        String alunoId = UUID.randomUUID().toString();
        ConnectedStudent student = new ConnectedStudent(alunoId, nome, session);
        student.setAdmin(isAdmin);

        // No modo colaborativo, todos compartilham a mesma senha
        student.setTargetPassword(senhaCompartilhada);
        student.setDisplayPassword(senhaCompartilhada);

        students.put(session.getId(), student);

        log.info("✦ {} conectado: {} (ID: {}) — Senha compartilhada: '{}' — Total nós: {}",
                isAdmin ? "ADMIN" : "Aluno", nome, alunoId, senhaCompartilhada, students.size());

        // Enviar confirmação individual com o estado atual da partida
        enviarParaSessao(session, criarMensagemRegistoLobby(student));

        // Se estamos na fase distribuída, enviar também REGISTO_CONFIRMADO
        if (estadoPartida == GameState.SISTEMAS_DISTRIBUIDOS) {
            enviarParaSessao(session, criarMensagemRegisto(student));
        }

        // Broadcast atualização do lobby para todos
        broadcastLobbyAtualizado();

        return alunoId;
    }

    /** Mantém compatibilidade com o método antigo (sem flag admin). */
    public String registarAluno(WebSocketSession session, String nome) {
        return registarAluno(session, nome, false);
    }

    public void removerAluno(WebSocketSession session) {
        ConnectedStudent student = students.get(session.getId());
        if (student == null) return;

        // Na fase distribuída, o lobby WS fecha e o Phase2 WS reconecta logo a seguir.
        if (estadoPartida == GameState.SISTEMAS_DISTRIBUIDOS) {
            log.info("✦ Sessão lobby fechada (fase distribuída — não removido): {}", student.getNome());
            students.remove(session.getId());
            return;
        }

        students.remove(session.getId());
        log.info("✦ Aluno desconectado: {} — Restam: {}", student.getNome(), students.size());
        broadcastLobbyAtualizado();
    }

    public ConnectedStudent obterAluno(WebSocketSession session) {
        return students.get(session.getId());
    }

    // =====================================================
    // Atualização de Fase e Heartbeat
    // =====================================================

    public void atualizarFase(WebSocketSession session, String fase) {
        ConnectedStudent student = students.get(session.getId());
        if (student != null) {
            student.setFaseAtual(fase);
            broadcastLobbyAtualizado();
        }
    }

    public void handlePing(WebSocketSession session) {
        enviarParaSessao(session, "{\"tipo\":\"PONG\"}");
    }

    // =====================================================
    // Controle de Estado Global (Admin)
    // =====================================================

    public synchronized void iniciarMinigames(WebSocketSession adminSession) {
        ConnectedStudent admin = students.get(adminSession.getId());
        if (admin == null || !admin.isAdmin()) {
            log.warn(" Tentativa de iniciar minijogos por não-admin: {}", adminSession.getId());
            return;
        }

        if (estadoPartida != GameState.LOBBY_INICIAL) {
            log.warn(" Estado inválido para iniciar minijogos: {}", estadoPartida);
            return;
        }

        estadoPartida = GameState.JOGANDO_MINIGAMES;
        log.info(" MINIJOGOS INICIADOS pelo Admin {} — {} alunos", admin.getNome(), students.size());

        broadcastMudarEstado(GameState.JOGANDO_MINIGAMES);
    }

    public synchronized void marcarMinigamesConcluidos(WebSocketSession session) {
        ConnectedStudent student = students.get(session.getId());
        if (student == null) return;

        if (estadoPartida != GameState.JOGANDO_MINIGAMES) {
            log.warn(" Aluno {} tentou concluir minigames fora do estado correto: {}",
                    student.getNome(), estadoPartida);
            return;
        }

        student.setMinigamesConcluidos(true);
        log.info("✓ {} concluiu os minijogos — {}/{} concluíram",
                student.getNome(), contarMinigamesConcluidos(), students.size());

        enviarParaSessao(session, criarMensagemMudarEstado(GameState.LOBBY_FINAL));
        broadcastLobbyAtualizado();
    }

    public synchronized void iniciarDistribuido(WebSocketSession adminSession) {
        ConnectedStudent admin = students.get(adminSession.getId());
        if (admin == null || !admin.isAdmin()) {
            log.warn(" Tentativa de iniciar distribuído por não-admin: {}", adminSession.getId());
            return;
        }

        if (estadoPartida != GameState.JOGANDO_MINIGAMES && estadoPartida != GameState.LOBBY_FINAL) {
            log.warn(" Estado inválido para iniciar distribuído: {}", estadoPartida);
            return;
        }

        // Gerar nova senha e chunks para esta rodada
        gerarNovaSenhaCompartilhada();

        estadoPartida = GameState.SISTEMAS_DISTRIBUIDOS;
        log.info("🌐 SISTEMAS DISTRIBUÍDOS INICIADOS (COLABORATIVO) pelo Admin {} — {} alunos — Senha: '{}'",
                admin.getNome(), students.size(), senhaCompartilhada);

        broadcastMudarEstado(GameState.SISTEMAS_DISTRIBUIDOS);
    }

    public GameState getEstadoPartida() {
        return estadoPartida;
    }

    // =====================================================
    // Distribuição de Trabalho — Fila GLOBAL compartilhada
    // =====================================================

    /**
     * Atribui o próximo chunk PENDENTE da fila global ao aluno que pediu.
     * Todos os alunos puxam da mesma fila.
     */
    public synchronized void atribuirTrabalho(WebSocketSession session) {
        ConnectedStudent student = students.get(session.getId());
        if (student == null) return;

        // Se a senha já foi encontrada, notificar o aluno
        if (senhaGlobalEncontrada) {
            enviarParaSessao(session, criarMensagemFimDeJogo());
            return;
        }

        // Procurar o próximo chunk pendente na fila GLOBAL
        WorkChunk chunk = null;
        for (WorkChunk c : chunksGlobais) {
            if (c.getStatus() == ChunkStatus.PENDENTE) {
                chunk = c;
                break;
            }
        }

        if (chunk == null) {
            enviarParaSessao(session, criarMensagemSemTrabalho());
            return;
        }

        chunk.atribuirPara(student.getId());

        log.info("→ Lote {} atribuído a {} [{}..{}]",
                chunk.getId(), student.getNome(),
                indiceParaPalavra(chunk.getInicio()),
                indiceParaPalavra(chunk.getFim()));

        enviarParaSessao(session, criarMensagemNovoLote(chunk));
    }

    // =====================================================
    // Receção de Resultados — Colaborativo
    // =====================================================

    public synchronized void processarResultado(WebSocketSession session,
                                                  int chunkId,
                                                  boolean encontrou,
                                                  String senhaCandidata) {
        ConnectedStudent student = students.get(session.getId());
        if (student == null) return;

        // Se a senha já foi encontrada, ignorar resultados tardios
        if (senhaGlobalEncontrada) {
            enviarParaSessao(session, criarMensagemFimDeJogo());
            return;
        }

        // Buscar chunk da fila GLOBAL
        WorkChunk chunk = null;
        if (chunkId >= 0 && chunkId < chunksGlobais.size()) {
            chunk = chunksGlobais.get(chunkId);
        }

        if (chunk == null || chunk.getStatus() != ChunkStatus.EM_PROCESSAMENTO) {
            log.warn(" Resultado inválido do aluno {} para chunk {}", student.getNome(), chunkId);
            return;
        }

        if (encontrou && senhaCandidata != null) {
            boolean senhaValida = senhaCompartilhada.equals(senhaCandidata.trim().toLowerCase());

            if (senhaValida) {
                chunk.concluir();
                student.incrementarLotesProcessados();
                totalLotesGlobais++;
                senhaGlobalEncontrada = true;
                descobertoPor = student.getNome();

                log.info("🔑 SENHA ENCONTRADA por {} — '{}'",
                        student.getNome(), senhaCompartilhada);

                // Notificar o aluno que encontrou
                enviarParaSessao(session, criarMensagemVitoriaPessoal(student));

                // Notificar TODOS que a senha foi quebrada
                broadcastSenhaQuebrada(student);
                broadcastEstadoGlobal();
            } else {
                log.warn(" BATOTA! Aluno {} enviou '{}' (esperada: '{}')",
                        student.getNome(), senhaCandidata, senhaCompartilhada);
                chunk.concluir();
                student.incrementarLotesProcessados();
                totalLotesGlobais++;
                broadcastEstadoGlobal();
                atribuirTrabalho(session);
            }
        } else {
            chunk.concluir();
            student.incrementarLotesProcessados();
            totalLotesGlobais++;

            log.info("✓ Lote {} processado por {} — Progresso global: {}%",
                    chunkId, student.getNome(),
                    String.format("%.1f", calcularProgressoGlobal()));

            broadcastEstadoGlobal();
            atribuirTrabalho(session);
        }
    }

    // =====================================================
    // Tolerância a Falhas — Fila global
    // =====================================================

    @Scheduled(fixedRate = 5000)
    public void verificarTimeouts() {
        Instant agora = Instant.now();
        int totalReatribuidos = 0;

        if (senhaGlobalEncontrada) return;

        for (WorkChunk chunk : chunksGlobais) {
            if (chunk.getStatus() == ChunkStatus.EM_PROCESSAMENTO
                    && chunk.getAtribuidoEm() != null) {
                Duration tempo = Duration.between(chunk.getAtribuidoEm(), agora);
                if (tempo.getSeconds() >= chunkTimeoutSeconds) {
                    log.info("⏱ Timeout! Lote {} — {}s", chunk.getId(), tempo.getSeconds());
                    chunk.resetar();
                    totalReatribuidos++;
                }
            }
        }

        if (totalReatribuidos > 0) {
            log.info("↻ {} lotes órfãos retornados à fila global", totalReatribuidos);
        }
    }

    // =====================================================
    // Contadores auxiliares
    // =====================================================

    private long contarMinigamesConcluidos() {
        return students.values().stream()
                .filter(ConnectedStudent::isMinigamesConcluidos)
                .count();
    }

    // =====================================================
    // Reset do Jogo
    // =====================================================

    public synchronized void resetarJogo() {
        estadoPartida = GameState.LOBBY_INICIAL;

        // Gerar nova senha compartilhada
        gerarNovaSenhaCompartilhada();

        for (ConnectedStudent student : students.values()) {
            student.setTargetPassword(senhaCompartilhada);
            student.setDisplayPassword(senhaCompartilhada);
            student.setSenhaEncontrada(false);
            student.setMinigamesConcluidos(false);
            // Resetar lotes processados de cada aluno individualmente
            student.resetarLotes();
        }
        log.info("🔄 Jogo reiniciado — {} alunos — Nova senha: '{}'", students.size(), senhaCompartilhada);
        broadcastMudarEstado(GameState.LOBBY_INICIAL);
        broadcastLobbyAtualizado();
    }

    // =====================================================
    // Cálculos de Progresso — Global (fila compartilhada)
    // =====================================================

    private double calcularProgressoGlobal() {
        if (chunksGlobais.isEmpty()) return 0.0;
        long concluidos = chunksGlobais.stream()
                .filter(c -> c.getStatus() == ChunkStatus.CONCLUIDO)
                .count();
        return (concluidos * 100.0) / chunksGlobais.size();
    }

    // =====================================================
    // Construção de Mensagens JSON — Lobby
    // =====================================================

    private String criarMensagemRegistoLobby(ConnectedStudent student) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "REGISTO_LOBBY");
        msg.put("alunoId", student.getId());
        msg.put("nome", student.getNome());
        msg.put("isAdmin", student.isAdmin());
        msg.put("estadoPartida", estadoPartida.name());
        return msg.toString();
    }

    private String criarMensagemLobbyAtualizado() {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "LOBBY_ATUALIZADO");
        msg.put("estadoPartida", estadoPartida.name());
        msg.put("totalJogadores", students.size());
        msg.put("minigamesConcluidos", contarMinigamesConcluidos());

        ArrayNode jogadores = objectMapper.createArrayNode();
        for (ConnectedStudent s : students.values()) {
            ObjectNode jogador = objectMapper.createObjectNode();
            jogador.put("id", s.getId());
            jogador.put("nome", s.getNome());
            jogador.put("isAdmin", s.isAdmin());
            jogador.put("minigamesConcluidos", s.isMinigamesConcluidos());
            jogador.put("senhaEncontrada", s.isSenhaEncontrada());
            jogador.put("faseAtual", s.getFaseAtual());
            jogadores.add(jogador);
        }
        msg.set("jogadores", jogadores);

        return msg.toString();
    }

    private String criarMensagemMudarEstado(GameState novoEstado) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "MUDAR_ESTADO");
        msg.put("novoEstado", novoEstado.name());
        return msg.toString();
    }

    // =====================================================
    // Construção de Mensagens JSON — Jogo Distribuído Colaborativo
    // =====================================================

    private String criarMensagemRegisto(ConnectedStudent student) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "REGISTO_CONFIRMADO");
        msg.put("alunoId", student.getId());
        msg.put("nome", student.getNome());
        msg.put("totalNos", students.size());
        msg.put("charset", CHARSET);
        msg.put("comprimento", WORD_LENGTH);
        msg.put("totalChunks", numChunks);
        msg.put("totalCombinacoes", totalSearchSpace);
        return msg.toString();
    }

    private String criarMensagemNovoLote(WorkChunk chunk) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "NOVO_LOTE");
        msg.put("chunkId", chunk.getId());
        msg.put("inicio", chunk.getInicio());
        msg.put("fim", chunk.getFim());
        msg.put("alvoSenha", senhaCompartilhada);
        msg.put("charset", CHARSET);
        msg.put("comprimento", WORD_LENGTH);
        return msg.toString();
    }

    private String criarMensagemSemTrabalho() {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "SEM_TRABALHO");
        msg.put("mensagem", "Aguarde...");
        return msg.toString();
    }

    private String criarMensagemFimDeJogo() {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "FIM_DE_JOGO");
        msg.put("senha", senhaCompartilhada);
        msg.put("descobertoPor", descobertoPor != null ? descobertoPor : "turma");
        msg.put("concluido", true);
        return msg.toString();
    }

    private String criarMensagemVitoriaPessoal(ConnectedStudent student) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "SENHA_QUEBRADA_PESSOAL");
        msg.put("senha", senhaCompartilhada);
        msg.put("lotesProcessados", student.getLotesProcessados());
        msg.put("descobertoPor", student.getNome());
        return msg.toString();
    }

    /**
     * Broadcast para TODOS: a senha foi quebrada colaborativamente.
     */
    private void broadcastSenhaQuebrada(ConnectedStudent quemEncontrou) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "TODOS_CONCLUIDOS");
        msg.put("senha", senhaCompartilhada);
        msg.put("descobertoPor", quemEncontrou.getNome());
        msg.put("totalNos", students.size());
        msg.put("totalLotes", totalLotesGlobais);
        msg.put("progressoPercentagem", 100.0);
        msg.put("concluido", true);
        broadcast(msg.toString());
    }

    private String criarMensagemAtualizacaoGlobal() {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("tipo", "ATUALIZACAO_GLOBAL");
        msg.put("progressoPercentagem", Math.round(calcularProgressoGlobal() * 10.0) / 10.0);
        msg.put("totalNos", students.size());
        msg.put("totalLotesProcessados", totalLotesGlobais);
        msg.put("senhaEncontrada", senhaGlobalEncontrada);
        return msg.toString();
    }

    // =====================================================
    // Comunicação WebSocket
    // =====================================================

    private void enviarParaSessao(WebSocketSession session, String jsonMessage) {
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(jsonMessage));
            } catch (IOException e) {
                log.error("Erro ao enviar para sessão {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    private void broadcast(String jsonMessage) {
        for (ConnectedStudent student : students.values()) {
            enviarParaSessao(student.getSession(), jsonMessage);
        }
    }

    public void broadcastEstadoGlobal() {
        broadcast(criarMensagemAtualizacaoGlobal());
    }

    public void broadcastLobbyAtualizado() {
        broadcast(criarMensagemLobbyAtualizado());
    }

    private void broadcastMudarEstado(GameState novoEstado) {
        broadcast(criarMensagemMudarEstado(novoEstado));
    }

    // =====================================================
    // Getters para REST
    // =====================================================

    public Map<String, Object> getEstadoCompleto() {
        Map<String, Object> estado = new LinkedHashMap<>();
        estado.put("estadoPartida", estadoPartida.name());
        estado.put("modo", "COLABORATIVO");
        estado.put("totalAlunos", students.size());
        estado.put("senhaCompartilhada", senhaCompartilhada);
        estado.put("senhaEncontrada", senhaGlobalEncontrada);
        estado.put("descobertoPor", descobertoPor);
        estado.put("totalCombinacoes", String.format("%,d", totalSearchSpace));
        estado.put("chunksGlobais", numChunks);
        estado.put("progressoGlobal", Math.round(calcularProgressoGlobal() * 10.0) / 10.0);
        estado.put("totalLotesProcessados", totalLotesGlobais);
        estado.put("minigamesConcluidos", contarMinigamesConcluidos());

        List<Map<String, Object>> alunosList = new ArrayList<>();
        for (ConnectedStudent s : students.values()) {
            Map<String, Object> aluno = new LinkedHashMap<>();
            aluno.put("id", s.getId());
            aluno.put("nome", s.getNome());
            aluno.put("isAdmin", s.isAdmin());
            aluno.put("lotesProcessados", s.getLotesProcessados());
            aluno.put("minigamesConcluidos", s.isMinigamesConcluidos());
            alunosList.add(aluno);
        }
        estado.put("alunos", alunosList);

        return estado;
    }
}
