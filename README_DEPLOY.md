# Guia de Instalação e Deploy: Oficina HP

O **Oficina HP** foi concebido para correr diretamente em servidor Linux com gestão **Easypanel** ou Docker, com integração opcional a **PocketBase** e **Ollama**.

---

## 1. Execução Local (Ambiente de Desenvolvimento)

1. Instalar as dependências:
   ```bash
   npm install
   ```

2. Iniciar o servidor de desenvolvimento Vite:
   ```bash
   npm run dev
   ```

3. Abrir o navegador em `http://localhost:3000`.

---

## 2. Deploy no Easypanel (Servidor Linux)

No seu painel **Easypanel**:

### Passo A: Criar o Serviço PocketBase
1. Adicione um serviço **PocketBase** ou use a imagem `ghcr.io/muchobien/pocketbase:latest`.
2. Mapeie a porta `8090`.
3. Na consola de administração do PocketBase (`/_/`), importe o ficheiro `pocketbase/pb_schema.json`.

### Passo B: Criar o Serviço Ollama (Opcional para IA)
1. Adicione um serviço com a imagem `ollama/ollama:latest`.
2. Mapeie a porta `11434`.
3. No terminal do contentor, descarregue o modelo de visão:
   ```bash
   ollama pull llama3.2-vision
   ```

### Passo C: Criar a Aplicação Oficina HP Frontend
1. Adicione um serviço **App** apontando para este repositório Git.
2. Selecione o **Build Type**: `Dockerfile`.
3. Exponha a porta `80` (que será mapeada para o seu domínio público, por exemplo `oficina.seudominio.pt`).
4. Aceda às **Configurações** na aplicação e introduza o URL do PocketBase e do Ollama.

---

## 3. Funcionalidades Incluídas
- **SPA Glassmorphism** ultra-rápida e responsiva (Desktop / Tablet / Smartphone de Mecânico).
- **Gestão Operacional de Frotas**: Empresas, Estaleiros, Clientes e Viaturas.
- **Folhas de Serviço / Obra**: Intervenções, tempos de mão-de-obra, peças aplicadas e histórico.
- **Quadro Kanban Interativo**: Transição visual de estados (Assistência Técnica, Oficina, A Aguardar Peças, Contratos, Faturação).
- **Orçamentos & Propostas Comerciais**: Cálculo automático de IVA e descontos, com conversão em Folha de Serviço em 1 clique.
- **Exportação PDF Oficial**: Geração de documentos em PDF de alta qualidade para Folhas de Serviço, Orçamentos e Guias de Envio.
- **Visão Computacional por IA (Ollama llama3.2-vision)**: Leitura automática de matrículas e odómetro por câmara/upload com fallback local inteligente.
- **Cópia de Segurança**: Exportação e importação de toda a base de dados em formato JSON.
