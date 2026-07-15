package com.quebramaldicao.config;

import com.quebramaldicao.handler.GameWebSocketHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * Configuração do endpoint WebSocket.
 * Expõe /ghost-network como ponto de conexão para os clientes React.
 *
 * Configura idle timeout longo (10 min) para evitar desconexões
 * de abas em segundo plano. O heartbeat PING/PONG do frontend
 * mantém a conexão ativa dentro desse intervalo.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameWebSocketHandler gameWebSocketHandler;

    public WebSocketConfig(GameWebSocketHandler gameWebSocketHandler) {
        this.gameWebSocketHandler = gameWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(gameWebSocketHandler, "/ghost-network")
                .setAllowedOrigins("*"); // Em produção, restringir origens
    }

    /**
     * Aumenta o idle timeout do container WebSocket para 10 minutos.
     * Previne que o servidor feche conexões inativas (abas de fundo).
     */
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxSessionIdleTimeout(600000L);  // 10 minutos
        container.setMaxTextMessageBufferSize(16384);  // 16 KB
        container.setMaxBinaryMessageBufferSize(16384);
        return container;
    }
}
