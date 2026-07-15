package com.quebramaldicao.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quebramaldicao.model.ConnectedStudent;
import com.quebramaldicao.service.GameService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * Handler WebSocket que processa todas as mensagens dos clientes React.
 *
 * Tipos de mensagem suportados:
 *
 * --- Lobby/Sincronização ---
 * - REGISTAR:                   Aluno entra no jogo com um nome (+ flag isAdmin)
 * - ADMIN_INICIAR_MINIGAMES:    Admin inicia os minijogos (LOBBY_INICIAL → JOGANDO_MINIGAMES)
 * - MINIGAMES_CONCLUIDOS:       Aluno reporta que terminou os minijogos
 * - ADMIN_INICIAR_DISTRIBUIDO:  Admin inicia a fase distribuída (→ SISTEMAS_DISTRIBUIDOS)
 *
 * --- Jogo Distribuído ---
 * - PEDIR_TRABALHO:    Aluno pede um lote de trabalho
 * - RESULTADO_LOTE:    Aluno reporta resultado de um lote processado
 * - SENHA_ENCONTRADA:  Aluno afirma ter encontrado a senha (validado pelo servidor)
 * - RESET_JOGO:        Reinicia o jogo (para o professor)
 */
@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketHandler.class);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GameService gameService;

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    // =====================================================
    // Lifecycle do WebSocket
    // =====================================================

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("✦ Nova conexão WebSocket: {}", session.getId());
        // O registo real acontece quando o cliente envia REGISTAR com o nome
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("Conexão fechada: {} (Razão: {})", session.getId(), status);
        gameService.removerAluno(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("Erro de transporte na sessão {}: {}", session.getId(), exception.getMessage());
        gameService.removerAluno(session);
    }

    // =====================================================
    // Processamento de Mensagens
    // =====================================================

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            String payload = message.getPayload();
            JsonNode json = objectMapper.readTree(payload);

            String tipo = json.has("tipo") ? json.get("tipo").asText() : "";

            log.debug("Mensagem recebida [{}]: tipo={}", session.getId(), tipo);

            switch (tipo) {
                // --- Lobby/Sincronização ---
                case "REGISTAR"                  -> handleRegistar(session, json);
                case "ADMIN_INICIAR_MINIGAMES"   -> handleAdminIniciarMinigames(session);
                case "MINIGAMES_CONCLUIDOS"      -> handleMinigamesConcluidos(session);
                case "ADMIN_INICIAR_DISTRIBUIDO" -> handleAdminIniciarDistribuido(session);
                case "ATUALIZAR_FASE"            -> handleAtualizarFase(session, json);

                // --- Heartbeat ---
                case "PING"             -> gameService.handlePing(session);

                // --- Jogo Distribuído ---
                case "PEDIR_TRABALHO"   -> handlePedirTrabalho(session, json);
                case "RESULTADO_LOTE"   -> handleResultadoLote(session, json);
                case "SENHA_ENCONTRADA" -> handleSenhaEncontrada(session, json);
                case "RESET_JOGO"       -> handleResetJogo(session);

                default -> log.warn("⚠ Tipo de mensagem desconhecido: '{}' de {}", tipo, session.getId());
            }

        } catch (Exception e) {
            log.error("Erro ao processar mensagem de {}: {}", session.getId(), e.getMessage(), e);
        }
    }

    // =====================================================
    // Handlers — Lobby/Sincronização
    // =====================================================

    /**
     * REGISTAR — O aluno envia o seu nome para se registar no jogo.
     * Agora aceita uma flag opcional "isAdmin".
     *
     * Payload esperado:
     * { "tipo": "REGISTAR", "nome": "João", "isAdmin": false }
     */
    private void handleRegistar(WebSocketSession session, JsonNode json) {
        String nome = json.has("nome") ? json.get("nome").asText("Anónimo") : "Anónimo";
        boolean isAdmin = json.has("isAdmin") && json.get("isAdmin").asBoolean(false);
        gameService.registarAluno(session, nome, isAdmin);
    }

    /**
     * ADMIN_INICIAR_MINIGAMES — O Admin inicia os minijogos.
     *
     * Payload esperado:
     * { "tipo": "ADMIN_INICIAR_MINIGAMES" }
     */
    private void handleAdminIniciarMinigames(WebSocketSession session) {
        log.info("🎮 Admin solicitou início dos minijogos: {}", session.getId());
        gameService.iniciarMinigames(session);
    }

    /**
     * MINIGAMES_CONCLUIDOS — O aluno reporta que terminou todos os minijogos.
     *
     * Payload esperado:
     * { "tipo": "MINIGAMES_CONCLUIDOS" }
     */
    private void handleMinigamesConcluidos(WebSocketSession session) {
        log.info("✓ Aluno concluiu minigames: {}", session.getId());
        gameService.marcarMinigamesConcluidos(session);
    }

    /**
     * ADMIN_INICIAR_DISTRIBUIDO — O Admin inicia a fase de sistemas distribuídos.
     *
     * Payload esperado:
     * { "tipo": "ADMIN_INICIAR_DISTRIBUIDO" }
     */
    private void handleAdminIniciarDistribuido(WebSocketSession session) {
        log.info("🌐 Admin solicitou início dos sistemas distribuídos: {}", session.getId());
        gameService.iniciarDistribuido(session);
    }

    /**
     * ATUALIZAR_FASE — O cliente reporta em qual tela/fase se encontra.
     *
     * Payload esperado:
     * { "tipo": "ATUALIZAR_FASE", "fase": "FASE_1_CIFRA" }
     */
    private void handleAtualizarFase(WebSocketSession session, JsonNode json) {
        String fase = json.has("fase") ? json.get("fase").asText("") : "";
        gameService.atualizarFase(session, fase);
    }

    // =====================================================
    // Handlers — Jogo Distribuído
    // =====================================================

    /**
     * PEDIR_TRABALHO — O aluno pede um lote de trabalho para processar.
     *
     * Payload esperado:
     * { "tipo": "PEDIR_TRABALHO", "alunoId": "uuid-aqui" }
     */
    private void handlePedirTrabalho(WebSocketSession session, JsonNode json) {
        ConnectedStudent student = gameService.obterAluno(session);
        if (student == null) {
            log.warn("⚠ Pedido de trabalho de sessão não registada: {}", session.getId());
            return;
        }
        gameService.atribuirTrabalho(session);
    }

    /**
     * RESULTADO_LOTE — O aluno reporta que terminou de processar um lote.
     *
     * Payload esperado:
     * { "tipo": "RESULTADO_LOTE", "chunkId": 5, "encontrou": false }
     *
     * Se encontrou=true:
     * { "tipo": "RESULTADO_LOTE", "chunkId": 5, "encontrou": true, "senha": "74921" }
     */
    private void handleResultadoLote(WebSocketSession session, JsonNode json) {
        int chunkId = json.has("chunkId") ? json.get("chunkId").asInt(-1) : -1;
        boolean encontrou = json.has("encontrou") && json.get("encontrou").asBoolean(false);
        String senha = json.has("senha") ? json.get("senha").asText(null) : null;

        gameService.processarResultado(session, chunkId, encontrou, senha);
    }

    /**
     * SENHA_ENCONTRADA — O aluno afirma ter encontrado a senha diretamente.
     * O servidor VALIDA internamente (anti-batota).
     *
     * Payload esperado:
     * { "tipo": "SENHA_ENCONTRADA", "senha": "74921" }
     */
    private void handleSenhaEncontrada(WebSocketSession session, JsonNode json) {
        // Tratar como resultado de lote com encontrou=true
        // Usar chunkId=-1 pois não há chunk associado (tentativa direta)
        String senha = json.has("senha") ? json.get("senha").asText(null) : null;

        if (senha == null) {
            log.warn("⚠ SENHA_ENCONTRADA sem senha do aluno na sessão {}", session.getId());
            return;
        }

        log.info("🔍 Aluno {} afirma ter encontrado a senha: {}", session.getId(), senha);

        // Delegar para o serviço que irá validar
        gameService.processarResultado(session, -1, true, senha);
    }

    /**
     * RESET_JOGO — Reinicia o estado do jogo (normalmente usado pelo professor).
     *
     * Payload esperado:
     * { "tipo": "RESET_JOGO" }
     */
    private void handleResetJogo(WebSocketSession session) {
        log.info("🔄 Reset do jogo solicitado por {}", session.getId());
        gameService.resetarJogo();
    }
}
