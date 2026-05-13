import os
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import psycopg2 

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

DATABASE_URL = os.environ.get('DATABASE_URL')

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