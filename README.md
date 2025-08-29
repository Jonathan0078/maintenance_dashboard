# Dashboard de Manutenção - Versão Completa

## 📋 Descrição

Dashboard completo para análise de dados de manutenção com interface moderna, filtros avançados e gráficos interativos.

## 🚀 Como Usar

### Versão Melhorada (Recomendada)
- **index.html** - Arquivo principal com todas as melhorias
- **styles.css** - Estilos modernos e responsivos
- **dashboard.js** - JavaScript com filtros e funcionalidades avançadas

### Versão Original (Corrigida)
- **dashboard.html** - Versão original com correções
- **styles.css** - Estilos básicos
- **dashboard.js** - JavaScript básico corrigido

## 📁 Estrutura de Arquivos

```
dashboard_completo/
├── index.html              # Dashboard melhorado (PRINCIPAL)
├── styles.css              # Estilos melhorados
├── dashboard.js            # JavaScript melhorado
├── dashboard.html          # Versão original corrigida
├── MELHORIAS_IMPLEMENTADAS.md  # Documentação das melhorias
└── README.md               # Este arquivo
```

## 🔧 Configuração

### 1. Firebase (Opcional)
Para usar persistência de dados, configure o Firebase em `index.html`:

```javascript
const firebaseConfig = {
    apiKey: "sua-api-key",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto-id",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "seu-app-id"
};
```

### 2. Formato do CSV
O arquivo CSV deve conter as seguintes colunas:

- `Data Manutenção` (DD/MM/YYYY ou YYYY-MM-DD)
- `Tipo de Manutenção` (7=Corretiva, 10=Preventiva, 22=Preditiva, 12=Melhoria)
- `Equipamento` ou `Nome Equipamento`
- `Estado` (Não Iniciada, Requisitada, Iniciada, Liberada, Suspensa)
- `Valor Material` (formato monetário)
- `Valor Mão de Obra` (formato monetário)
- `Criticidade`
- `Nome do Analista`

## ✨ Funcionalidades

### Dashboard Principal
- ✅ 9 KPIs principais com indicadores de tendência
- ✅ 9 gráficos interativos (MTTR, MTBF, custos, etc.)
- ✅ Filtros rápidos (mês, trimestre, ano)
- ✅ Interface responsiva para mobile e desktop

### Filtros Avançados
- ✅ Filtro por período (data início/fim)
- ✅ Filtro por tipo de manutenção
- ✅ Filtro por equipamento específico
- ✅ Filtro por analista
- ✅ Filtro por status da ordem

### Análises
- ✅ Análise por equipamento (top 10 por custo)
- ✅ Análise preditiva (score de risco)
- ✅ Exportação de relatórios em TXT

### Interface
- ✅ Sidebar responsiva com navegação
- ✅ Alertas automáticos para situações críticas
- ✅ Indicadores de carregamento
- ✅ Tema escuro profissional

## 🎯 Melhorias Implementadas

### Correções de Bugs
- ✅ Gráficos não sendo gerados - **CORRIGIDO**
- ✅ Processamento de datas inconsistente - **CORRIGIDO**
- ✅ Cálculos de KPIs incorretos - **CORRIGIDO**
- ✅ Tratamento de erros insuficiente - **CORRIGIDO**

### Novas Funcionalidades
- ✅ Sistema de filtros avançados
- ✅ Alertas automáticos
- ✅ Indicadores de tendência nos KPIs
- ✅ Interface responsiva melhorada
- ✅ Navegação lateral moderna

### Melhorias Técnicas
- ✅ Código modular e organizado
- ✅ Tratamento robusto de erros
- ✅ Validação de dados aprimorada
- ✅ Performance otimizada

## 🌐 Como Executar

1. **Localmente**: Abra `index.html` em qualquer navegador moderno
2. **Servidor Web**: Coloque os arquivos em um servidor web (Apache, Nginx, etc.)
3. **GitHub Pages**: Faça upload para um repositório e ative o GitHub Pages

## 📊 Gráficos Disponíveis

1. **MTTR** - Tempo Médio de Reparo (por trimestre)
2. **MTBF** - Tempo Médio Entre Falhas (mensal)
3. **Custos Mensais** - Gastos com manutenção
4. **Corretivas Mensais** - Evolução das ordens corretivas
5. **Status das Ordens** - Distribuição por status
6. **Tipos de Manutenção** - Distribuição por tipo
7. **Criticidade** - Ordens por nível de criticidade
8. **Top 5 Equipamentos** - Equipamentos com mais ordens
9. **Ordens por Analista** - Distribuição por responsável

## 🔍 Análises Disponíveis

### Por Equipamento
- Top 10 equipamentos por custo
- Total de ordens por equipamento
- Distribuição entre corretivas e preventivas
- Custo total por equipamento

### Preditiva
- Score de risco por equipamento
- Equipamentos com maior probabilidade de falha
- Baseado na proporção de ordens corretivas

## 📈 KPIs Calculados

- **Corretivas**: Total de manutenções corretivas
- **Preventivas**: Total de manutenções preventivas
- **Preventivas Vencidas**: Preventivas com data vencida
- **Preditivas**: Total de manutenções preditivas
- **Melhorias**: Total de melhorias implementadas
- **Equipamentos**: Número único de equipamentos
- **O.S Total**: Total de ordens de serviço
- **Disponibilidade**: Calculada baseada em corretivas
- **Custo Total**: Soma de materiais e mão de obra

## 🎨 Personalização

### Cores
As cores podem ser alteradas no arquivo `styles.css`:

```css
:root {
    --kpi-main: #30395e;    /* Cor principal */
    --kpi-dark: #262f4e;    /* Cor escura */
    --kpi-accent: #00f6ff;  /* Cor de destaque */
    --success: #10b981;     /* Verde */
    --warning: #f59e0b;     /* Amarelo */
    --danger: #ef4444;      /* Vermelho */
}
```

### Layout
O

