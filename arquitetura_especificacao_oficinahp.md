# Documento de Arquitetura e Especificação Funcional: Oficina HP

## 1. Visão Geral e Propósito

### 1.1 Propósito da Aplicação
O **Oficina HP** é um sistema integrado de **Gestão Operacional de Oficinas e Frotas**, concebido para gerir o ciclo de vida completo de manutenção automóvel e industrial — desde o registo de empresas parceiras, clientes e viaturas, orçamentação dinâmica, gestão visual da oficina (Quadro Kanban em tempo real), até à emissão de Folhas de Serviço com digitalização inteligente de matrículas e peças por visão computacional (IA).

### 1.2 Arquitetura de Produção e Stack Tecnológica
A aplicação opera como uma **Single-Page Application (SPA)** leve e autónoma, alojada em servidor Linux gerido por **Easypanel**, suportada por **PocketBase** para persistência/tempo real e **Ollama** para processamento local de imagem.

```mermaid
graph TD
    subgraph Client["Dispositivos (Desktop / Tablet / Telemóvel Mecânico)"]
        UI[SPA - HTML5 / CSS3 Glassmorphism / Vanilla JS]
        Camera[Câmara do Dispositivo / Upload]
    end

    subgraph Server_Easypanel["Servidor Linux (Easypanel)"]
        WebServer[Serviço Web / Nginx - Oficina HP Frontend]
        PB[(PocketBase - Base de Dados, Auth, Ficheiros e Realtime SSE)]
        Ollama[Ollama Server - Modelo llama3.2-vision]
    end

    UI --> WebServer
    Camera --> UI
    UI -- "PocketBase JS SDK (REST / Realtime SSE)" --> PB
    UI -- "POST /api/generate (Base64)" --> Ollama