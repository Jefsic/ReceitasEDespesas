// shared.js - Código compartilhado entre Dashboard e Gerenciador
const Shared = (function() {
    'use strict';
    
    // ========== CONSTANTES ==========
    const STORAGE_KEY = 'despesas_cartao_v2';
    const DIA_FATURA = 20;
    const CATEGORIAS = ['Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Casa', 'Assinaturas', 'Roupas', 'Viagem', 'Outros'];
    const CARTOES = ['Caixa Visa', 'Caixa Elo', 'Caixa Black', 'Nubank', 'Inter', 'Porto'];
    const DEVEDORES = ['Jefferson', 'Erika', 'Ambos'];
    
    // ========== UTILITÁRIOS GERAIS ==========
    function formatMoney(value) {
        if (isNaN(value)) return 'R$ 0,00';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    
    function toast(msg, duration = 2400) {
        let el = document.getElementById('toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            el.className = 'toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), duration);
    }
    
    function formatarDataBR(dataStr) {
        if (!dataStr) return '—';
        const [ano, mes, dia] = dataStr.split('-');
        return `${dia}/${mes}/${ano}`;
    }
    
    function formatarDataInput(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }
    
    // ========== FUNÇÕES DE DATA E FATURA ==========
    function getProximaDataFatura() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        let dataFatura = new Date(hoje.getFullYear(), hoje.getMonth(), DIA_FATURA);
        if (hoje.getDate() > DIA_FATURA) {
            dataFatura.setMonth(dataFatura.getMonth() + 1);
        }
        return dataFatura;
    }
    
    function getDataFatura(mesesAdicionais = 0) {
        const data = new Date(getProximaDataFatura());
        data.setMonth(data.getMonth() + mesesAdicionais);
        data.setHours(0, 0, 0, 0);
        return data;
    }
    
    function getRangeFatura(dataFatura) {
        const inicio = new Date(dataFatura);
        inicio.setDate(1);
        inicio.setHours(0, 0, 0, 0);
        
        const fim = new Date(dataFatura);
        fim.setMonth(fim.getMonth() + 1);
        fim.setDate(0);
        fim.setHours(23, 59, 59, 999);
        
        return { inicio, fim };
    }
    
    function formatarMesFatura(mesesAdicionais = 0) {
        const data = getDataFatura(mesesAdicionais);
        return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    
    function getProximosMesesFatura(quantidade = 6) {
        const meses = [];
        for (let i = 0; i < quantidade; i++) {
            const data = getDataFatura(i);
            meses.push({
                value: i,
                label: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                mesNome: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            });
        }
        return meses;
    }
    
    // ========== CRUD DESPESAS ==========
    function carregarDespesas() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Erro ao carregar despesas:', e);
            return [];
        }
    }
    
    function salvarDespesas(despesas) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(despesas));
            return true;
        } catch (e) {
            console.error('Erro ao salvar despesas:', e);
            return false;
        }
    }
    
    function adicionarDespesa(despesa) {
        const despesas = carregarDespesas();
        const novas = Array.isArray(despesa) ? despesa : [despesa];
        salvarDespesas([...novas, ...despesas]);
        return novas.length;
    }
    
    function atualizarDespesa(id, novosDados) {
        const despesas = carregarDespesas();
        const index = despesas.findIndex(d => d.id === id);
        if (index === -1) return false;
        despesas[index] = { ...despesas[index], ...novosDados };
        return salvarDespesas(despesas);
    }
    
    function deletarDespesa(id, removerGrupo = false) {
        let despesas = carregarDespesas();
        const alvo = despesas.find(d => d.id === id);
        if (!alvo) return false;
        
        if (removerGrupo && alvo.parcelaTotal > 1) {
            despesas = despesas.filter(d => d.grupoId !== alvo.grupoId);
        } else {
            despesas = despesas.filter(d => d.id !== id);
        }
        return salvarDespesas(despesas);
    }
    
    // ========== CÁLCULO DE PARCELAS ==========
    function calcularParcelas(valorTotal, numParcelas) {
        const valorParcela = Math.floor((valorTotal / numParcelas) * 100) / 100;
        const resto = parseFloat((valorTotal - (valorParcela * numParcelas)).toFixed(2));
        return { valorParcela, resto };
    }
    
    function somarMeses(dataStr, meses) {
        const data = new Date(dataStr);
        data.setMonth(data.getMonth() + meses);
        return formatarDataInput(data);
    }
    
    function gerarParcelas(dados) {
        const { desc, valorTotal, dataCompra, primeiraParcela, categoria, cartao, parcelas, despRecorrente, devedor } = dados;
        const grupoId = Date.now();
        const { valorParcela, resto } = calcularParcelas(valorTotal, parcelas);
        const resultado = [];
        
        for (let i = 0; i < parcelas; i++) {
            resultado.push({
                id: grupoId + i,
                grupoId: grupoId,
                desc: desc,
                valor: i === parcelas - 1 ? +(valorParcela + resto).toFixed(2) : valorParcela,
                dataCompra: dataCompra,
                data: somarMeses(primeiraParcela, i),
                categoria: categoria,
                cartao: cartao,
                parcelaAtual: i + 1,
                parcelaTotal: parcelas,
                despRecorrente: despRecorrente || false,
                devedor: devedor || 'Jefferson'
            });
        }
        return resultado;
    }
    
    // ========== FILTROS E AGRUPAMENTOS ==========
    function filtrarPorFatura(despesas, mesesAdicionais = 0) {
        const dataFatura = getDataFatura(mesesAdicionais);
        const { inicio, fim } = getRangeFatura(dataFatura);
        
        return despesas.filter(d => {
            const dataVencto = new Date(d.data);
            return dataVencto >= inicio && dataVencto <= fim;
        });
    }
    
    function agruparPorCartao(despesas) {
        const grupos = {};
        despesas.forEach(d => {
            const cartao = d.cartao || 'Outros';
            if (!grupos[cartao]) {
                grupos[cartao] = { total: 0, itens: [] };
            }
            grupos[cartao].total += d.valor;
            grupos[cartao].itens.push(d);
        });
        return grupos;
    }
    
    function calcularTotal(despesas) {
        return despesas.reduce((sum, d) => sum + (d.valor || 0), 0);
    }
    
    // ========== EXPORTAR/IMPORTAR ==========
    function exportarJSON() {
        const despesas = carregarDespesas();
        if (despesas.length === 0) {
            toast('Nenhuma despesa para exportar');
            return false;
        }
        const blob = new Blob([JSON.stringify(despesas, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `despesas_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast(`${despesas.length} despesas exportadas com sucesso!`);
        return true;
    }
    
    function importarJSON(file, callback) {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const dados = JSON.parse(e.target.result);
                if (!Array.isArray(dados)) throw new Error('Formato inválido');
                
                if (salvarDespesas(dados)) {
                    toast(`${dados.length} despesas importadas com sucesso!`);
                    if (callback) callback(dados);
                } else {
                    toast('Erro ao salvar os dados importados');
                }
            } catch (error) {
                toast('Arquivo inválido ou corrompido');
                console.error(error);
            }
        };
        reader.onerror = () => toast('Erro ao ler o arquivo');
        reader.readAsText(file);
    }
    
    // ========== API PÚBLICA ==========
    return {
        // Constantes
        STORAGE_KEY: STORAGE_KEY,
        DIA_FATURA: DIA_FATURA,
        CATEGORIAS: CATEGORIAS,
        CARTOES: CARTOES,
        DEVEDORES: DEVEDORES,
        
        // Utilitários
        formatMoney: formatMoney,
        toast: toast,
        formatarDataBR: formatarDataBR,
        formatarDataInput: formatarDataInput,
        
        // Datas e Fatura
        getProximaDataFatura: getProximaDataFatura,
        getDataFatura: getDataFatura,
        getRangeFatura: getRangeFatura,
        formatarMesFatura: formatarMesFatura,
        getProximosMesesFatura: getProximosMesesFatura,
        
        // CRUD
        carregarDespesas: carregarDespesas,
        salvarDespesas: salvarDespesas,
        adicionarDespesa: adicionarDespesa,
        atualizarDespesa: atualizarDespesa,
        deletarDespesa: deletarDespesa,
        
        // Parcelas
        calcularParcelas: calcularParcelas,
        somarMeses: somarMeses,
        gerarParcelas: gerarParcelas,
        
        // Filtros e Agrupamentos
        filtrarPorFatura: filtrarPorFatura,
        agruparPorCartao: agruparPorCartao,
        calcularTotal: calcularTotal,
        
        // Export/Import
        exportarJSON: exportarJSON,
        importarJSON: importarJSON
    };
})();
