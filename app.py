import os
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import psycopg2 

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

DATABASE_URL = os.environ.get('postgresql://banco_pousada_user:FJaEupMVI0lF0rlUfIx3IR7F8lhi896r@dpg-d5m4e7kmrvns73et0i0g-a/banco_pousada')

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Erro ao conectar: {e}")
        return None

def criar_tabela():
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quartos (
                numero VARCHAR(10) PRIMARY KEY,
                status VARCHAR(20),
                hospedes INT DEFAULT 0,
                horario_cafe VARCHAR(10),
                observacao TEXT
            );
        """)
        
        cursor.execute("SELECT COUNT(*) FROM quartos")
        if cursor.fetchone()[0] == 0:
            for i in range(1, 13):
                num = f"{i:02d}" 
                cursor.execute("INSERT INTO quartos (numero, status, hospedes) VALUES (%s, 'disponivel', 0)", (num,))
        
        conn.commit()
        cursor.close()
        conn.close()


with app.app_context():
    try:
        criar_tabela()
    except:
        pass 

@app.route('/')
def index():
    conn = get_db_connection()
    if not conn:
        return "Erro de conexão com o banco de dados."
    
    cursor = conn.cursor()
    cursor.execute('SELECT numero, status, hospedes, horario_cafe, observacao FROM quartos ORDER BY numero')
    dados = cursor.fetchall()
    
    quartos = []
    contagem = {'ocupados': 0, 'saiu': 0, 'disponiveis': 0, 'limpeza': 0}
    
    for linha in dados:
        status_db = linha[1].lower() if linha[1] else 'disponivel'
        status_css = status_db.replace('í', 'i').replace('ç', 'c').replace('ã', 'a')
        
        quartos.append({
            'numero': linha[0],
            'status': status_css,
            'hospedes': linha[2] if linha[2] else 0,
            'horario_cafe': linha[3],
            'observacao': linha[4]
        })
        
        if 'ocupado' in status_css: contagem['ocupados'] += 1
        elif 'saiu' in status_css: contagem['saiu'] += 1
        elif 'disponivel' in status_css: contagem['disponiveis'] += 1
        elif 'limpeza' in status_css: contagem['limpeza'] += 1

    cursor.close()
    conn.close()
    return render_template('index.html', quartos=quartos, resumo=contagem)

@app.route('/atualizar_status/<numero>', methods=['POST'])
def atualizar_status(numero):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM quartos WHERE numero = %s", (numero,))
    resultado = cursor.fetchone()
    
    if not resultado:
        return 'Quarto não encontrado', 404
        
    status_atual = resultado[0].lower()
    ciclo = {
        'disponivel': 'ocupado',
        'ocupado': 'saiu',
        'saiu': 'limpeza',
        'limpeza': 'disponivel'
    }
    chave_busca = status_atual.replace('í', 'i').replace('ç', 'c').replace('ã', 'a')
    if chave_busca not in ciclo: chave_busca = 'disponivel' 
    
    novo_status = ciclo.get(chave_busca, 'disponivel')
    
    cursor.execute("UPDATE quartos SET status = %s WHERE numero = %s", (novo_status, numero))
    conn.commit()
    cursor.close()
    conn.close()

    socketio.emit('quarto_atualizado', {
        'numero': numero,
        'status': novo_status,
        'tipo': 'status_rapido'
    })
    return '', 204

@app.route('/salvar_detalhes', methods=['POST'])
def salvar_detalhes():
    numero = request.form.get('numero')
    hospedes = request.form.get('hospedes')
    cafe = request.form.get('cafe')
    obs = request.form.get('obs')

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE quartos 
        SET hospedes = %s, horario_cafe = %s, observacao = %s 
        WHERE numero = %s
    """, (hospedes, cafe, obs, numero))
    
    conn.commit()
    cursor.close()
    conn.close()

    socketio.emit('quarto_atualizado', {
        'numero': numero,
        'hospedes': hospedes,
        'cafe': cafe,
        'obs': obs,
        'tipo': 'detalhes'
    })
    return '', 204

@app.route('/resetar', methods=['POST'])
def resetar():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE quartos SET status = 'disponivel', hospedes = 0, horario_cafe = NULL, observacao = NULL")
    conn.commit()
    cursor.close() 
    conn.close()

    socketio.emit('reset_geral') 
    return '', 204

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)