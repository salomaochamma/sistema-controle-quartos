const socket = io();

let timer;
const longPressDuration = 600;

let campoAtivo = null; 
let valorTemp = "";    

document.querySelectorAll('.card').forEach(card => {

    ['mousedown', 'touchstart'].forEach(evt => {
        card.addEventListener(evt, (e) => {
            if (e.type === 'touchstart') e.preventDefault();

            const numero = card.dataset.quarto;
            const status = card.classList.contains('ocupado') ? 'ocupado' : 
                           card.classList.contains('disponivel') ? 'disponivel' :
                           card.classList.contains('limpeza') ? 'limpeza' : 'saiu';
            
            const observacao = card.getAttribute('data-obs') || "";
            const hospedes = card.querySelector('.val-hospedes').innerText.trim();
            const cafeTexto = card.querySelector('.cafe-horario').innerText.replace('café:', '').trim();

            timer = setTimeout(() => {
                timer = null;
                abrirMenuEdicao(numero, status, hospedes, cafeTexto, observacao);
            }, longPressDuration);
        }, { passive: false });
    });

    ['mouseup', 'touchend'].forEach(evt => {
        card.addEventListener(evt, (e) => {
            if (e.type === 'touchend') e.preventDefault();

            if (timer) {
                clearTimeout(timer);
                const numero = card.dataset.quarto;
                alterarStatusRapido(numero);
                timer = null;
            }
        }, { passive: false });
    });
    

    ['mouseleave', 'touchcancel'].forEach(evt => {
        card.addEventListener(evt, () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        });
    });
});

function alterarStatusRapido(numero) {
    fetch(`/atualizar_status/${numero}`, { method: 'POST' });
}

function resetarTudo() {
    if (confirm("Tem certeza que deseja liberar TODOS os quartos?")) {
        fetch('/resetar', { method: 'POST' });
    }
}

function atualizarContadores() {

    const ocupados = document.querySelectorAll('.card.ocupado').length;
    const saiu = document.querySelectorAll('.card.saiu').length;
    const disponiveis = document.querySelectorAll('.card.disponivel').length;
    const limpeza = document.querySelectorAll('.card.limpeza').length;

    if(document.getElementById('cnt-ocupados')) document.getElementById('cnt-ocupados').innerText = ocupados;
    if(document.getElementById('cnt-saiu')) document.getElementById('cnt-saiu').innerText = saiu;
    if(document.getElementById('cnt-disponiveis')) document.getElementById('cnt-disponiveis').innerText = disponiveis;
    if(document.getElementById('cnt-limpeza')) document.getElementById('cnt-limpeza').innerText = limpeza;
}

socket.on('quarto_atualizado', function(data) {
    const card = document.querySelector(`.card[data-quarto="${data.numero}"]`);
    if (!card) return;

    if (data.tipo === 'status_rapido') {
        card.classList.remove('disponivel', 'ocupado', 'saiu', 'limpeza');
        card.classList.add(data.status);
        

        atualizarContadores();
    } 
    else if (data.tipo === 'detalhes') {
        card.querySelector('.val-hospedes').innerText = data.hospedes || '0';
    
        const cafeDiv = card.querySelector('.cafe-horario');
        if (data.cafe && data.cafe.trim() !== "") {
            cafeDiv.innerText = 'café: ' + data.cafe;
            cafeDiv.classList.remove('vazio');
        } else {
            cafeDiv.innerHTML = '&nbsp;';
            cafeDiv.classList.add('vazio');
        }

        card.setAttribute('data-obs', data.obs);
        const alertaExistente = card.querySelector('.alerta-obs');
        
        if (data.obs && data.obs.trim() !== "") {
            if (!alertaExistente) {
                const alerta = document.createElement('div');
                alerta.className = 'alerta-obs';
                alerta.innerText = '!';
                card.appendChild(alerta);
            }
        } else if (alertaExistente) {
            alertaExistente.remove();
        }
    }
});

socket.on('reset_geral', function() {
    document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('ocupado', 'saiu', 'limpeza');
        card.classList.add('disponivel');

        card.querySelector('.val-hospedes').innerText = '0';

        const cafeDiv = card.querySelector('.cafe-horario');
        cafeDiv.innerHTML = '&nbsp;';
        cafeDiv.classList.add('vazio');

        card.setAttribute('data-obs', '');
        const alerta = card.querySelector('.alerta-obs');
        if (alerta) alerta.remove();
    });
    

    atualizarContadores();
});

document.getElementById('form-edicao').onsubmit = function(e) {
    e.preventDefault();
    const formData = new FormData(this);

    fetch('/salvar_detalhes', {
        method: 'POST',
        body: formData
    }).then(res => {
        if(res.ok) fecharTudo();
    });
};

function abrirMenuEdicao(numero, status, hospedes, cafe, observacao) {
    document.getElementById('titulo-quarto').innerText = "Quarto " + numero;
    document.getElementById('input-numero').value = numero;
    
    const display = document.getElementById('status-display');
    display.innerText = status.toUpperCase();
    display.className = 'status-display ' + status;

    document.getElementById('display-hospedes').value = hospedes || 0;
    const cafeLimpo = (cafe === '-' || cafe === 'None' || cafe === 'café:') ? '' : cafe;
    document.getElementById('display-cafe').value = cafeLimpo.trim();

    const obsFinal = (observacao === 'None' || observacao === 'null') ? '' : observacao;
    document.getElementById('input-obs').value = obsFinal;

    document.getElementById('modal-edicao').classList.add('active');
    document.getElementById('modal-overlay').classList.add('active');
}

function fecharTudo() {

    if (document.activeElement) {
        document.activeElement.blur();
    }

    setTimeout(() => {
        document.getElementById('modal-edicao').classList.remove('active');
        document.getElementById('teclado-numerico').classList.remove('active');
        document.getElementById('modal-overlay').classList.remove('active');
        

        window.scrollTo(0, 0);
        
        campoAtivo = null;
    }, 100);
}

function abrirTeclado(tipo) {
    campoAtivo = tipo;
    const label = document.getElementById('teclado-contexto');
    label.innerText = (tipo === 'cafe') ? "HORÁRIO DO CAFÉ" : "NÚMERO DE HÓSPEDES";

    if (tipo === 'cafe') {
        valorTemp = document.getElementById('display-cafe').value.replace(':', '');
    } else {
        const val = document.getElementById('display-hospedes').value;
        valorTemp = (val === "0" || val === "--") ? "" : val;
    }

    atualizarVisores();
    document.getElementById('teclado-numerico').classList.add('active');
}

function fecharTeclado() {
    document.getElementById('teclado-numerico').classList.remove('active');
}

function digitar(num) {
    const limite = (campoAtivo === 'cafe') ? 4 : 2;
    if (valorTemp.length < limite) {
        valorTemp += num;
        atualizarVisores();
    }
}

function apagarDigito() {
    valorTemp = valorTemp.slice(0, -1);
    atualizarVisores();
}

function atualizarVisores() {
    let formatado = valorTemp;
    const visorAmarelo = document.getElementById('teclado-visor-valor');
    
    if (campoAtivo === 'cafe') {
        if (valorTemp.length > 2) {
            formatado = valorTemp.slice(0, 2) + ':' + valorTemp.slice(2);
        }
        document.getElementById('display-cafe').value = formatado;
        visorAmarelo.innerText = formatado || "--:--";
    } else {
        document.getElementById('display-hospedes').value = valorTemp || "0";
        visorAmarelo.innerText = valorTemp || "0";
    }
}