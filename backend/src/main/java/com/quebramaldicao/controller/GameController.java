package com.quebramaldicao.controller;

import com.quebramaldicao.service.GameService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Controlador REST para endpoints de estado (Health Checks)
 * e administração do jogo.
 *
 * Estes endpoints permitem ao professor monitorizar o estado
 * do jogo a partir de um browser sem WebSocket.
 */
@RestController
@RequestMapping("/api")
public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    /**
     * Health Check — Verifica se o servidor está a funcionar.
     * GET /api/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "UP");
        response.put("servico", "Quebra de Maldição API");
        response.put("versao", "1.0.0");
        return ResponseEntity.ok(response);
    }

    /**
     * Estado completo do jogo — Para monitorização pelo professor.
     * GET /api/estado
     */
    @GetMapping("/estado")
    public ResponseEntity<Map<String, Object>> estado() {
        return ResponseEntity.ok(gameService.getEstadoCompleto());
    }

    /**
     * Reset do jogo — Reinicia o estado para uma nova sessão.
     * POST /api/reset
     */
    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> reset() {
        gameService.resetarJogo();
        Map<String, String> response = new LinkedHashMap<>();
        response.put("status", "OK");
        response.put("mensagem", "Jogo reiniciado com sucesso");
        return ResponseEntity.ok(response);
    }
}
