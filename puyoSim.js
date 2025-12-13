/**
 * ネクストリストのHTMLを生成し、描画する
 */
function renderEditNextList() {
    const container = document.getElementById('edit-next-list-container');
    container.innerHTML = ''; // 一度クリア
    
    editNextPuyos.forEach((puyoPair, index) => {
        const [color1, color2] = puyoPair;
        
        // 1ペアのコンテナ
        const pairDiv = document.createElement('div');
        pairDiv.className = 'next-puyo-slot-pair';
        
        // 番号
        const indexSpan = document.createElement('span');
        indexSpan.textContent = `(${index + 1})`;
        pairDiv.appendChild(indexSpan);

        // ぷよの行 (next-puyo-row)
        const rowDiv = document.createElement('div');
        rowDiv.className = 'next-puyo-row';
        
        // --- 修正箇所: ぷよ1の作成と組み込み ---
        const puyo1 = document.createElement('div');
        drawPuyo(puyo1, color1);
        puyo1.classList.add('puyo'); // 必須: CSS適用のためクラス追加
        puyo1.addEventListener('click', () => handleEditNextClick(index, 0));
        
        const slot1 = document.createElement('div');
        slot1.className = 'next-puyo-slot';
        slot1.appendChild(puyo1); // slotにpuyoを格納
        rowDiv.appendChild(slot1);

        // --- 修正箇所: ぷよ2の作成と組み込み ---
        const puyo2 = document.createElement('div');
        drawPuyo(puyo2, color2);
        puyo2.classList.add('puyo'); // 必須: CSS適用のためクラス追加
        puyo2.addEventListener('click', () => handleEditNextClick(index, 1));
        
        const slot2 = document.createElement('div');
        slot2.className = 'next-puyo-slot';
        slot2.appendChild(puyo2); // slotにpuyoを格納
        rowDiv.appendChild(slot2);
        
        pairDiv.appendChild(rowDiv);
        container.appendChild(pairDiv);
    });
}
