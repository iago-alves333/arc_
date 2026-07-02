package com.quebramaldicao;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Ponto de entrada da aplicação Spring Boot.
 * @EnableScheduling ativa o agendador para o timeout de lotes órfãos.
 */
@SpringBootApplication
@EnableScheduling
public class QuebraMaldicaoApplication {

    public static void main(String[] args) {
        SpringApplication.run(QuebraMaldicaoApplication.class, args);
    }
}
