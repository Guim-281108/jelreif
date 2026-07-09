// PREÇOS FIXOS
const PRECOS = { cart1: 30, cart2: 20, beb: 3, sob: 5, cam: 45 };
const SENHA_EXCLUSAO = 'amanda281108';

function confirmarSenha() {
  const digitada = prompt('🔒 Digite a senha para confirmar a exclusão:');
  if (digitada === null) return false; // cancelou
  if (digitada !== SENHA_EXCLUSAO) {
    alert('❌ Senha incorreta. Nada foi apagado.');
    return false;
  }
  return true;
}

let historico = [];
let despesas = [];
let totalAtual = 0;
let pagamentoSelecionado = null;

function setSync(status) {
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('sync-text');
  if (!dot) return;
  if (status === 'loading') { dot.className = 'sync-dot loading'; txt.textContent = 'sincronizando...'; }
  else if (status === 'error') { dot.className = 'sync-dot'; dot.style.background = '#F87171'; txt.textContent = 'erro ao salvar'; }
  else { dot.className = 'sync-dot'; dot.style.background = '#6EE86E'; txt.textContent = 'sincronizado (compartilhado)'; }
}

// ── PERSISTÊNCIA COMPARTILHADA (Firebase Realtime Database — todos os usuários veem os mesmos dados) ──
const FIREBASE_URL = 'https://jelrei-fricasse-default-rtdb.firebaseio.com';

async function salvar() {
  setSync('loading');
  try {
    const r = await fetch(`${FIREBASE_URL}/historico.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(historico)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    setSync('ok');
  } catch (e) { console.error('Erro ao salvar histórico:', e); setSync('error'); }
}
async function carregar() {
  try {
    const r = await fetch(`${FIREBASE_URL}/historico.json`);
    const data = await r.json();
    historico = data || [];
  } catch (e) { console.error('Erro ao carregar histórico:', e); historico = []; }
}
async function salvarDespesas() {
  setSync('loading');
  try {
    const r = await fetch(`${FIREBASE_URL}/despesas.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(despesas)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    setSync('ok');
  } catch (e) { console.error('Erro ao salvar despesas:', e); setSync('error'); }
}
async function carregarDespesas() {
  try {
    const r = await fetch(`${FIREBASE_URL}/despesas.json`);
    const data = await r.json();
    despesas = data || [];
  } catch (e) { console.error('Erro ao carregar despesas:', e); despesas = []; }
}

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function getQt(id) { return parseInt(document.getElementById(id).value) || 0; }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function trocarAba(aba, btn) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
  document.querySelectorAll('.nav-aba').forEach(b => b.classList.remove('active'));
  document.getElementById('pg-' + aba).classList.add('ativa');
  (btn || (window.event && window.event.currentTarget)).classList.add('active');
  if (aba === 'vendas') { refrescarDados().then(renderVendas); }
  if (aba === 'despesas') { refrescarDados().then(renderDespesas); }
  if (aba === 'arrecadacao') { refrescarDados().then(renderArrecadacao); }
}

// Recarrega os dados mais recentes do armazenamento compartilhado (outros usuários podem ter lançado algo)
async function refrescarDados() {
  await Promise.all([carregar(), carregarDespesas()]);
}

function atualizar() {
  const qt1 = getQt('qt_cart1'), qt2 = getQt('qt_cart2');
  const qb = getQt('qt_beb'), qs = getQt('qt_sob'), qc = getQt('qt_cam');
  document.getElementById('sub_cart1').textContent = 'Subtotal: ' + fmt(qt1 * PRECOS.cart1);
  document.getElementById('sub_cart2').textContent = 'Subtotal: ' + fmt(qt2 * PRECOS.cart2);
  document.getElementById('sub_beb').textContent   = 'Subtotal: ' + fmt(qb * PRECOS.beb);
  document.getElementById('sub_sob').textContent   = 'Subtotal: ' + fmt(qs * PRECOS.sob);
  document.getElementById('sub_cam').textContent   = 'Subtotal: ' + fmt(qc * PRECOS.cam);
}

async function calcular() {
  const qt1 = getQt('qt_cart1'), qt2 = getQt('qt_cart2');
  const qb = getQt('qt_beb'), qs = getQt('qt_sob'), qc = getQt('qt_cam');
  const c1 = qt1 * PRECOS.cart1, c2 = qt2 * PRECOS.cart2;
  const beb = qb * PRECOS.beb, sob = qs * PRECOS.sob, cam = qc * PRECOS.cam;
  const total = c1 + c2 + beb + sob + cam;
  totalAtual = total;

  document.getElementById('r_c1').textContent = fmt(c1) + ' (' + qt1 + ' cartões)';
  document.getElementById('r_c2').textContent = fmt(c2) + ' (' + qt2 + ' cartões)';
  document.getElementById('r_beb').textContent = fmt(beb) + ' (' + qb + ' un.)';
  document.getElementById('r_sob').textContent = fmt(sob) + ' (' + qs + ' un.)';
  document.getElementById('r_cam').textContent = fmt(cam) + ' (' + qc + ' un.)';
  document.getElementById('r_total').textContent = fmt(total);
  document.getElementById('din-total').textContent = fmt(total);
  document.getElementById('pix-total').textContent = fmt(total);
  document.getElementById('din-recebido').value = '';
  resetTroco(); resetPix();
  document.getElementById('resultado').classList.add('show');
  if (pagamentoSelecionado) selecionarPagamento(pagamentoSelecionado);

  // Busca o histórico mais recente antes de adicionar, para não sobrescrever lançamentos de outras pessoas
  await carregar();

  const agora = new Date();
  const hora = agora.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  const data = agora.toLocaleDateString('pt-BR');
  historico.unshift({ data, hora, c1, c2, beb, sob, cam, total, qt1, qt2, qb, qs, qc, id: Date.now() });
  await salvar();
  renderHistorico();
}

function selecionarPagamento(tipo) {
  pagamentoSelecionado = tipo;
  document.getElementById('tab-dinheiro').classList.toggle('active', tipo === 'dinheiro');
  document.getElementById('tab-pix').classList.toggle('active', tipo === 'pix');
  document.getElementById('pag-dinheiro').classList.toggle('show', tipo === 'dinheiro');
  document.getElementById('pag-pix').classList.toggle('show', tipo === 'pix');
  if (tipo === 'dinheiro') calcularTroco();
}

function calcularTroco() {
  const recebido = parseFloat(document.getElementById('din-recebido').value) || 0;
  const box = document.getElementById('troco-box');
  const val = document.getElementById('troco-val');
  if (recebido === 0) { resetTroco(); return; }
  const troco = recebido - totalAtual;
  box.className = 'troco-box';
  if (troco > 0) {
    box.classList.add('positivo');
    box.querySelector('.tr-label').textContent = 'Troco a devolver';
    val.textContent = fmt(troco);
  } else if (troco < 0) {
    box.classList.add('negativo');
    box.querySelector('.tr-label').textContent = '⚠ Valor insuficiente';
    val.textContent = fmt(Math.abs(troco)) + ' a mais';
  } else {
    box.classList.add('neutro');
    box.querySelector('.tr-label').textContent = 'Sem troco';
    val.textContent = 'Valor exato ✓';
  }
}

function resetTroco() {
  const box = document.getElementById('troco-box');
  box.className = 'troco-box neutro';
  box.querySelector('.tr-label').textContent = 'Troco';
  document.getElementById('troco-val').textContent = '—';
}

function confirmarPix() {
  document.getElementById('btn-confirmar-pix').disabled = true;
  document.getElementById('btn-confirmar-pix').textContent = '✔ Confirmado';
  document.getElementById('pix-confirmado').classList.add('show');
}

function resetPix() {
  document.getElementById('btn-confirmar-pix').disabled = false;
  document.getElementById('btn-confirmar-pix').textContent = '✔ Confirmar Pagamento';
  document.getElementById('pix-confirmado').classList.remove('show');
}

function renderHistorico() {
  const ul = document.getElementById('historico');
  ul.innerHTML = '';
  if (historico.length === 0) {
    ul.innerHTML = '<li class="empty-hist">Nenhum lançamento registrado ainda.</li>';
    return;
  }
  historico.forEach(h => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <div style="color:var(--cream);font-weight:700;">${h.data} às ${h.hora}</div>
        <div class="hi-info">Cart1: ${h.qt1} | Cart2: ${h.qt2} | Bebidas: ${h.qb} | Sobrem.: ${h.qs} | Camis.: ${h.qc}</div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        <span class="hi-total">${fmt(h.total)}</span>
        <button class="btn-del" onclick="deletar(${h.id})">✕</button>
      </div>`;
    ul.appendChild(li);
  });
}

async function deletar(id) {
  if (!confirmarSenha()) return;
  await carregar();
  historico = historico.filter(h => h.id !== id);
  await salvar();
  renderHistorico();
}

function limpar() {
  ['qt_cart1','qt_cart2','qt_beb','qt_sob','qt_cam'].forEach(id => {
    document.getElementById(id).value = 0;
  });
  atualizar();
  document.getElementById('resultado').classList.remove('show');
  pagamentoSelecionado = null; totalAtual = 0;
}

async function zerarTudo() {
  if (!confirmarSenha()) return;
  if (!confirm('Tem certeza que deseja apagar TODO o histórico compartilhado? Essa ação afeta todos que usam o app e não pode ser desfeita.')) return;
  historico = [];
  await salvar();
  renderHistorico();
}

// ── DESPESAS ──
async function registrarDespesa() {
  const desc = document.getElementById('desp_desc').value.trim();
  const forma = document.getElementById('desp_forma').value;
  const valor = parseFloat(document.getElementById('desp_valor').value) || 0;
  if (!desc || valor <= 0) {
    alert('Preencha a descrição e um valor válido para a despesa.');
    return;
  }
  await carregarDespesas();
  const agora = new Date();
  const hora = agora.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  const data = agora.toLocaleDateString('pt-BR');
  despesas.unshift({ desc, forma, valor, data, hora, id: Date.now() });
  await salvarDespesas();
  document.getElementById('desp_desc').value = '';
  document.getElementById('desp_valor').value = '';
  renderDespesas();
}

async function deletarDespesa(id) {
  if (!confirmarSenha()) return;
  await carregarDespesas();
  despesas = despesas.filter(d => d.id !== id);
  await salvarDespesas();
  renderDespesas();
}

async function zerarDespesas() {
  if (!confirmarSenha()) return;
  if (!confirm('Tem certeza que deseja apagar TODAS as despesas compartilhadas? Essa ação afeta todos que usam o app e não pode ser desfeita.')) return;
  despesas = [];
  await salvarDespesas();
  renderDespesas();
}

function renderDespesas() {
  const ul = document.getElementById('historico-despesas');
  ul.innerHTML = '';
  if (despesas.length === 0) {
    ul.innerHTML = '<li class="empty-hist">Nenhuma despesa registrada ainda.</li>';
  } else {
    despesas.forEach(d => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <div style="color:var(--cream);font-weight:700;">${escapeHtml(d.desc)}</div>
          <div class="hi-info">${d.data} às ${d.hora} · ${escapeHtml(d.forma)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <span class="hi-total" style="color:#F87171;">${fmt(d.valor)}</span>
          <button class="btn-del" onclick="deletarDespesa(${d.id})">✕</button>
        </div>`;
      ul.appendChild(li);
    });
  }
  const total = despesas.reduce((a,d) => a + d.valor, 0);
  document.getElementById('desp-total').textContent = fmt(total);
  document.getElementById('desp-count').textContent = despesas.length + ' despesa(s) registrada(s)';
}

// ── VENDAS CARTÕES ──
function renderVendas() {
  const totQt1 = historico.reduce((a,h) => a + h.qt1, 0);
  const totQt2 = historico.reduce((a,h) => a + h.qt2, 0);
  const totValCart = historico.reduce((a,h) => a + h.c1 + h.c2, 0);

  document.getElementById('vc-qt1').textContent = totQt1;
  document.getElementById('vc-qt2').textContent = totQt2;
  document.getElementById('vc-qtTotal').textContent = totQt1 + totQt2;
  document.getElementById('vc-valTotal').textContent = fmt(totValCart);

  const empty = document.getElementById('vc-empty');
  const tabela = document.getElementById('vc-tabela');
  const tbody = document.getElementById('vc-tbody');

  if (historico.length === 0) {
    empty.style.display = 'block'; tabela.style.display = 'none'; return;
  }
  empty.style.display = 'none'; tabela.style.display = 'table';
  tbody.innerHTML = '';
  historico.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${h.data} ${h.hora}</td>
      <td class="td-num">${h.qt1}</td>
      <td class="td-num">${h.qt2}</td>
      <td class="td-num">${h.qt1 + h.qt2}</td>
      <td class="td-val">${fmt(h.c1 + h.c2)}</td>`;
    tbody.appendChild(tr);
  });
  // linha total
  const trTot = document.createElement('tr');
  trTot.className = 'td-total-row';
  trTot.innerHTML = `
    <td style="font-weight:700;color:var(--gold-light)">TOTAL</td>
    <td class="td-num" style="color:var(--gold)">${totQt1}</td>
    <td class="td-num" style="color:var(--gold)">${totQt2}</td>
    <td class="td-num" style="color:var(--gold)">${totQt1+totQt2}</td>
    <td class="td-val" style="color:var(--gold)">${fmt(totValCart)}</td>`;
  tbody.appendChild(trTot);
}

// ── ARRECADAÇÃO ──
function renderArrecadacao() {
  const totC1  = historico.reduce((a,h) => a + h.c1, 0);
  const totC2  = historico.reduce((a,h) => a + h.c2, 0);
  const totBeb = historico.reduce((a,h) => a + h.beb, 0);
  const totSob = historico.reduce((a,h) => a + h.sob, 0);
  const totCam = historico.reduce((a,h) => a + h.cam, 0);
  const totCart = totC1 + totC2;
  const grand = totCart + totBeb + totSob + totCam;

  const qtC1  = historico.reduce((a,h) => a + h.qt1, 0);
  const qtC2  = historico.reduce((a,h) => a + h.qt2, 0);
  const qtBeb = historico.reduce((a,h) => a + h.qb, 0);
  const qtSob = historico.reduce((a,h) => a + h.qs, 0);
  const qtCam = historico.reduce((a,h) => a + h.qc, 0);

  document.getElementById('arr-total').textContent = fmt(grand);
  document.getElementById('arr-lancamentos').textContent = historico.length + ' lançamento(s) registrado(s)';

  document.getElementById('arr-cartoes').textContent = fmt(totCart);
  document.getElementById('arr-cartoes-qt').textContent = (qtC1+qtC2) + ' un.';
  document.getElementById('arr-bebidas').textContent = fmt(totBeb);
  document.getElementById('arr-bebidas-qt').textContent = qtBeb + ' un.';
  document.getElementById('arr-sobremesas').textContent = fmt(totSob);
  document.getElementById('arr-sobremesas-qt').textContent = qtSob + ' un.';
  document.getElementById('arr-camisetas').textContent = fmt(totCam);
  document.getElementById('arr-camisetas-qt').textContent = qtCam + ' un.';
  document.getElementById('arr-c1').textContent = fmt(totC1);
  document.getElementById('arr-c1-qt').textContent = qtC1 + ' un.';
  document.getElementById('arr-c2').textContent = fmt(totC2);
  document.getElementById('arr-c2-qt').textContent = qtC2 + ' un.';

  // ── Resultado (Arrecadação x Despesas x Lucro) ──
  const totDespesas = despesas.reduce((a,d) => a + d.valor, 0);
  const lucro = grand - totDespesas;
  document.getElementById('arr-receita').textContent = fmt(grand);
  document.getElementById('arr-desp-total').textContent = fmt(totDespesas);
  const lucroEl = document.getElementById('arr-lucro');
  lucroEl.textContent = fmt(lucro);
  lucroEl.style.color = lucro >= 0 ? '#6EE86E' : '#F87171';

  // barras de percentual
  function pct(v) { return grand > 0 ? Math.round(v / grand * 100) : 0; }
  const pc = pct(totCart), pb = pct(totBeb), ps = pct(totSob), pm = pct(totCam);
  document.getElementById('arr-br-cart').textContent = fmt(totCart);
  document.getElementById('arr-pct-cart').textContent = pc + '%';
  document.getElementById('bar-cart').style.width = pc + '%';
  document.getElementById('arr-br-beb').textContent = fmt(totBeb);
  document.getElementById('arr-pct-beb').textContent = pb + '%';
  document.getElementById('bar-beb').style.width = pb + '%';
  document.getElementById('arr-br-sob').textContent = fmt(totSob);
  document.getElementById('arr-pct-sob').textContent = ps + '%';
  document.getElementById('bar-sob').style.width = ps + '%';
  document.getElementById('arr-br-cam').textContent = fmt(totCam);
  document.getElementById('arr-pct-cam').textContent = pm + '%';
  document.getElementById('bar-cam').style.width = pm + '%';
}

// ── EXPORTAÇÃO ──
async function exportarWord() {
  await refrescarDados();

  const totC1 = historico.reduce((a,h)=>a+h.c1,0), totC2 = historico.reduce((a,h)=>a+h.c2,0);
  const totBeb = historico.reduce((a,h)=>a+h.beb,0), totSob = historico.reduce((a,h)=>a+h.sob,0), totCam = historico.reduce((a,h)=>a+h.cam,0);
  const grand = totC1+totC2+totBeb+totSob+totCam;
  const totDesp = despesas.reduce((a,d)=>a+d.valor,0);
  const lucro = grand - totDesp;
  const agora = new Date().toLocaleDateString('pt-BR');

  const linhasLanc = historico.map(h => `
    <tr>
      <td>${h.data} ${h.hora}</td><td>${h.qt1}</td><td>${h.qt2}</td>
      <td>${h.qb}</td><td>${h.qs}</td><td>${h.qc}</td><td>${fmt(h.total)}</td>
    </tr>`).join('');

  const linhasDesp = despesas.map(d => `
    <tr><td>${d.data} ${d.hora}</td><td>${escapeHtml(d.desc)}</td><td>${escapeHtml(d.forma)}</td><td>${fmt(d.valor)}</td></tr>`).join('');

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>Relatório JELREI Fricassê</title>
    <style>
      body{font-family:Calibri,Arial,sans-serif;color:#222;}
      h1{color:#8B1A1A;} h2{color:#0aa3d6;border-bottom:1px solid #ccc;padding-bottom:4px;}
      table{border-collapse:collapse;width:100%;margin-bottom:20px;}
      th,td{border:1px solid #ccc;padding:6px 10px;font-size:12px;text-align:left;}
      th{background:#f0f0f0;}
      .total-row td{font-weight:bold;background:#fdf6e3;}
    </style></head>
    <body>
      <h1>JELREI Fricassê — Relatório do Evento</h1>
      <p>Gerado em: ${agora}</p>

      <h2>Resumo Financeiro</h2>
      <table>
        <tr><th>Categoria</th><th>Valor</th></tr>
        <tr><td>Cartão Tipo 1</td><td>${fmt(totC1)}</td></tr>
        <tr><td>Cartão Tipo 2</td><td>${fmt(totC2)}</td></tr>
        <tr><td>Bebidas</td><td>${fmt(totBeb)}</td></tr>
        <tr><td>Sobremesas</td><td>${fmt(totSob)}</td></tr>
        <tr><td>Camisetas</td><td>${fmt(totCam)}</td></tr>
        <tr class="total-row"><td>Total Arrecadado</td><td>${fmt(grand)}</td></tr>
        <tr class="total-row"><td>Total Despesas</td><td>${fmt(totDesp)}</td></tr>
        <tr class="total-row"><td>Lucro Líquido</td><td>${fmt(lucro)}</td></tr>
      </table>

      <h2>Histórico de Lançamentos</h2>
      <table>
        <tr><th>Data/Hora</th><th>Cart.1</th><th>Cart.2</th><th>Bebidas</th><th>Sobrem.</th><th>Camis.</th><th>Total</th></tr>
        ${linhasLanc || '<tr><td colspan="7">Nenhum lançamento registrado.</td></tr>'}
      </table>

      <h2>Histórico de Despesas</h2>
      <table>
        <tr><th>Data/Hora</th><th>Descrição</th><th>Forma</th><th>Valor</th></tr>
        ${linhasDesp || '<tr><td colspan="4">Nenhuma despesa registrada.</td></tr>'}
      </table>
    </body></html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dataStr = new Date().toLocaleDateString('pt-BR').replace(/\//g,'-');
  a.href = url;
  a.download = `JELREI_Fricasse_Relatorio_${dataStr}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Carrega ao iniciar
(async function init() {
  setSync('loading');
  await refrescarDados();
  renderHistorico();
  renderDespesas();
  setSync('ok');
})();