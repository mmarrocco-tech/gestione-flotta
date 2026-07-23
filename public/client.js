let veicoliGlobali = [];
let utentiGlobali = [];
let prenotazioniGlobali = [];

let utenteCorrente = null; 
let dataCalendarioHome = new Date();
let dataCalendario = new Date();
let mezzoSelezionatoId = null;

const paletteColoriAutisti = [ "#FA640A", "#5A96F0", "#00A466", "#F3CB12", "#F3B412", "#E65100", "#00897B", "#3949AB" ];

function ottieniColoreUtente(utenteId) {
  if (!utenteId) return "#898989";
  const index = Math.abs(Number(utenteId)) % paletteColoriAutisti.length;
  return paletteColoriAutisti[index];
}

// ==========================================
// --- GESTIONE LOGIN & PERMESSI
// ==========================================
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const userTxt = document.getElementById("loginUsername").value;
  const passTxt = document.getElementById("loginPassword").value;

  const res = await fetch("/api/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: userTxt, password: passTxt })
  });

  const data = await res.json();
  if (data.success) {
    utenteCorrente = data.user;
    avviaApp();
  } else {
    alert(data.message);
  }
});

function eseguiLogout() {
  utenteCorrente = null;
  document.getElementById("appContainer").style.display = "none";
  document.getElementById("schermataLogin").style.display = "flex";
  document.getElementById("loginForm").reset();
}

function avviaApp() {
  document.getElementById("schermataLogin").style.display = "none";
  document.getElementById("appContainer").style.display = "block";
  
  if (utenteCorrente.ruolo !== "admin") {
    document.getElementById("navMezzi").style.display = "none";
    document.getElementById("navUtenti").style.display = "none";
  } else {
    document.getElementById("navMezzi").style.display = "inline-block";
    document.getElementById("navUtenti").style.display = "inline-block";
  }

  mostraSezione('home');
  caricaVeicoli();
  caricaUtenti();
}

function mostraSezione(idSezione) {
  chiudiModal();
  document.querySelectorAll('.sezione').forEach(sez => sez.classList.add('nascosto'));
  document.getElementById('sez-' + idSezione).classList.remove('nascosto');
  if (idSezione === 'home') caricaTuttoHome();
  else if (idSezione === 'prenotazione') caricaTuttoPerPrenotazioni();
}

// ==========================================
// --- SUBMIT MODULI 
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  chiudiModal();

  document.getElementById("veicoloForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editId").value;
    const data = { 
      marca: document.getElementById("marca").value, 
      modello: document.getElementById("modello").value, 
      targa: document.getElementById("targa").value.toUpperCase(),
    };
    await fetch(id ? `/api/veicoli/${id}` : "/api/veicoli", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    annullaModifica(); caricaVeicoli();
  });

  document.getElementById("utenteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editUtenteId").value;
    const data = { 
      nome: document.getElementById("nomeUtente").value, 
      cognome: document.getElementById("cognomeUtente").value,
      username: document.getElementById("usernameUtente").value,
      password: document.getElementById("passwordUtente").value,
      ruolo: document.getElementById("ruoloUtente").value
    };
    await fetch(id ? `/api/utenti/${id}` : "/api/utenti", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    annullaModificaUtente(); caricaUtenti();
  });

  document.getElementById("formModalPrenotazione").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editPrenotazioneId").value;
    const inizio = document.getElementById("modalInizio").value;
    const fine = document.getElementById("modalFine").value;
    const utenteId = document.getElementById("modalUtente").value;
    const note = document.getElementById("modalNote").value;
    
    const selectVeicolo = document.getElementById("modalVeicolo");
    const mId = selectVeicolo.style.display !== "none" ? selectVeicolo.value : mezzoSelezionatoId;

    if(!mId) { alert("⚠️ Seleziona un veicolo!"); return; }
    if(new Date(fine) <= new Date(inizio)) { alert("⚠️ Errore: La data/ora di fine deve essere successiva a quella di inizio!"); return; }

    const conflitto = controllaSovrapposizione(mId, inizio, fine, id);
    if(conflitto) {
      const u = utentiGlobali.find(x => x.id == conflitto.utenteId);
      alert(`⚠️ Impossibile prenotare! Mezzo già occupato da ${u ? u.nome+" "+u.cognome : "un collega"}.`);
      return;
    }

    const payload = { mezzoId: mId, utenteId, inizio, fine, note };
    await fetch(id ? `/api/prenotazioni/${id}` : "/api/prenotazioni", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    chiudiModal();
    caricaTuttoHome();
    if(mezzoSelezionatoId) caricaTuttoPerPrenotazioni();
  });
});

function controllaSovrapposizione(mezzoId, inizioNuovo, fineNuovo, idEscluso = null) {
  const startA = new Date(inizioNuovo).getTime();
  const endA = new Date(fineNuovo).getTime();
  return prenotazioniGlobali.find(p => {
    if (p.mezzoId != mezzoId) return false;
    if (idEscluso && p.id == idEscluso) return false;
    if (!p.inizio || !p.fine) return false;
    const startB = new Date(p.inizio).getTime();
    const endB = new Date(p.fine).getTime();
    return (startA < endB && endA > startB);
  });
}

// ==========================================
// --- FUNZIONI CARICAMENTO & GESTIONE ---
// ==========================================
async function caricaVeicoli() {
  const res = await fetch("/api/veicoli"); veicoliGlobali = await res.json();
  const tbody = document.querySelector("#tabellaVeicoli tbody");
  if(tbody) {
    tbody.innerHTML = veicoliGlobali.map(v => {
      let badgeStato = v.obsoleto ? '<span class="badge-obsoleto">OBSOLETO</span>' : (v.guasto ? '<span class="badge-guasto">GUASTO</span>' : '<span class="badge-attivo">ATTIVO</span>');
      let btnAzioni = `<button class="btn-modifica" onclick="preparaModifica(${v.id})">Modifica</button>`;
      
      if (!v.obsoleto) {
        btnAzioni += v.guasto ? `<button class="btn-ripara" onclick="impostaGuasto(${v.id}, false)">Ripara</button>` : `<button class="btn-guasto" onclick="impostaGuasto(${v.id}, true)">Guasto</button>`;
        btnAzioni += `<button class="btn-obsoleto" onclick="impostaObsoleto(${v.id})">Obsoleto</button>`;
      }
      return `<tr><td>${v.marca}</td><td>${v.modello}</td><td><strong>${v.targa}</strong></td><td>${badgeStato}</td><td>${btnAzioni}</td></tr>`;
    }).join('');
  }
}

async function caricaUtenti() {
  const res = await fetch("/api/utenti"); utentiGlobali = await res.json();
  const tbody = document.querySelector("#tabellaUtenti tbody");
  if(tbody) {
    tbody.innerHTML = utentiGlobali.map(u => `
      <tr><td><strong>${u.nome} ${u.cognome}</strong></td><td>${u.username}</td><td>${u.ruolo.toUpperCase()}</td>
      <td>${!u.attivo ? '<span class="badge-obsoleto">INATTIVO</span>' : '<span class="badge-attivo">ATTIVO</span>'}</td>
      <td><button class="btn-modifica" onclick="preparaModificaUtente(${u.id})">Modifica</button> ${u.attivo ? `<button class="btn-obsoleto" onclick="disattivaUtente(${u.id})">Disattiva</button>` : ''}</td></tr>
    `).join('');
  }
}

// --- AZIONI VEICOLI ---
function preparaModifica(id) { 
  const v = veicoliGlobali.find(x => x.id === id); 
  if(v) { 
    document.getElementById("editId").value = v.id; 
    document.getElementById("marca").value = v.marca; 
    document.getElementById("modello").value = v.modello; 
    document.getElementById("targa").value = v.targa; 
    document.getElementById("btnAnnullaMezzo").classList.remove("nascosto"); 
  } 
}
function annullaModifica() { 
  document.getElementById("veicoloForm").reset(); 
  document.getElementById("editId").value = ""; 
  document.getElementById("btnAnnullaMezzo").classList.add("nascosto"); 
}
async function impostaObsoleto(id) { if(confirm("Rendere obsoleto? (Verrà nascosto dalle prenotazioni)")) { await fetch(`/api/veicoli/${id}`, { method: "PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({obsoleto:true}) }); caricaVeicoli(); } }
async function impostaGuasto(id, stato) { const messaggio = stato ? "Segnalare questo mezzo come GUASTO? (Non sarà prenotabile)" : "Segnalare questo mezzo come RIPARATO e nuovamente disponibile?"; if(confirm(messaggio)) { await fetch(`/api/veicoli/${id}`, { method: "PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({guasto: stato}) }); caricaVeicoli(); } }

// --- AZIONI UTENTI ---
function preparaModificaUtente(id) { const u = utentiGlobali.find(x => x.id === id); if(u) { document.getElementById("editUtenteId").value = u.id; document.getElementById("nomeUtente").value = u.nome; document.getElementById("cognomeUtente").value = u.cognome; document.getElementById("usernameUtente").value = u.username || ''; document.getElementById("passwordUtente").value = u.password || ''; document.getElementById("ruoloUtente").value = u.ruolo || 'autista'; document.getElementById("btnAnnullaUtente").classList.remove("nascosto"); } }
function annullaModificaUtente() { document.getElementById("utenteForm").reset(); document.getElementById("editUtenteId").value = ""; document.getElementById("btnAnnullaUtente").classList.add("nascosto"); }
async function disattivaUtente(id) { if(confirm("Disattivare utente?")) { await fetch(`/api/utenti/${id}`, { method: "PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({attivo:false}) }); caricaUtenti(); } }

// ==========================================
// --- CALENDARI (HOME E PRENOTAZIONI) ---
// ==========================================
async function caricaTuttoHome() {
  await caricaVeicoli(); await caricaUtenti();
  const res = await fetch("/api/prenotazioni"); prenotazioniGlobali = await res.json();
  disegnaStatoMezziHome(); disegnaCalendarioHome();
}

function disegnaStatoMezziHome() {
  const ul = document.getElementById("listaStatoMezziHome"); ul.innerHTML = "";
  const adesso = new Date().toISOString(); 
  const dataOggiStr = adesso.split("T")[0];
  const mezziAttivi = veicoliGlobali.filter(v => !v.obsoleto);

  mezziAttivi.forEach(v => {
    const li = document.createElement("li"); li.className = "card-mezzo-stato";
    
    if (v.guasto) {
      li.innerHTML = `<div class="card-mezzo-titolo">${v.marca} ${v.modello} - ${v.targa}</div><span class="card-mezzo-stato-badge badge-guasto">GUASTO</span><div class="card-mezzo-dettaglio" style="color:#F44336; font-weight:bold;">In Manutenzione</div>`;
      ul.appendChild(li);
      return;
    }

    const occupatoOra = prenotazioniGlobali.find(p => {
      if (!p || !p.inizio || !p.fine) return false;
      return p.mezzoId == v.id && adesso >= p.inizio && adesso <= p.fine;
    });
    
    if (occupatoOra) {
      const u = utentiGlobali.find(x => x.id == occupatoOra.utenteId);
      li.innerHTML = `<div class="card-mezzo-titolo">${v.marca} ${v.modello} - ${v.targa}</div><span class="card-mezzo-stato-badge stato-occupato">IN USO</span><div class="card-mezzo-dettaglio">Guidata da: <strong>${u ? u.nome+" "+u.cognome : "Autista"}</strong><br>Fino al: ${occupatoOra.fine.replace("T", " ")}</div>`;
    } else {
      li.innerHTML = `<div class="card-mezzo-titolo">${v.marca} ${v.modello} - ${v.targa}</div><span class="card-mezzo-stato-badge stato-libero">DISPONIBILE</span><button class="btn-prenota-rapido" onclick="apriModalDaHome(${v.id}, '${dataOggiStr}T09:00')">+ PRENOTA MEZZO</button>`;
    }
    ul.appendChild(li);
  });
}

function cambiaMeseHome(dir) { dataCalendarioHome.setMonth(dataCalendarioHome.getMonth() + dir); disegnaCalendarioHome(); }

function disegnaCalendarioHome() {
  const grid = document.getElementById("calendarioGridHome"); grid.innerHTML = "";
  const anno = dataCalendarioHome.getFullYear(); const mese = dataCalendarioHome.getMonth();
  const realeOggi = new Date(); const stringaRealeOggi = `${realeOggi.getFullYear()}-${String(realeOggi.getMonth() + 1).padStart(2, '0')}-${String(realeOggi.getDate()).padStart(2, '0')}`;
  
  document.getElementById("meseAnnoLabelHome").innerText = new Date(anno, mese).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase();
  ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].forEach(g => { const div = document.createElement("div"); div.className = "giorno-header"; div.innerText = g; grid.appendChild(div); });

  let offset = new Date(anno, mese, 1).getDay(); offset = offset === 0 ? 6 : offset - 1;
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();

  for (let i = 0; i < offset; i++) { const div = document.createElement("div"); div.className = "giorno vuoto"; grid.appendChild(div); }

  for (let i = 1; i <= giorniNelMese; i++) {
    const div = document.createElement("div"); div.className = "giorno";
    const dataOggiStr = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    
    div.innerHTML = `<strong class="numero-giorno ${dataOggiStr === stringaRealeOggi ? 'oggi' : ''}">${i}</strong>`;
    div.onclick = (e) => { if(e.target === div || e.target.classList.contains('numero-giorno')) apriModalDaHome(null, `${dataOggiStr}T09:00`); };

    const prenoDelGiorno = prenotazioniGlobali.filter(p => {
      if(!p || !p.inizio || !p.fine) return false;
      try {
        const strInizio = p.inizio.split("T")[0];
        const strFine = p.fine.split("T")[0];
        return dataOggiStr >= strInizio && dataOggiStr <= strFine;
      } catch(err) { return false; }
    }).sort((a, b) => (a.inizio || "").localeCompare(b.inizio || ""));

    prenoDelGiorno.forEach(p => {
      const u = utentiGlobali.find(x => x.id == p.utenteId); const v = veicoliGlobali.find(x => x.id == p.mezzoId);
      const strInizio = p.inizio.split("T")[0]; const strFine = p.fine.split("T")[0];
      let etichettaOrario = (strInizio === strFine) ? `${p.inizio.split("T")[1]} - ${p.fine.split("T")[1]}` : (dataOggiStr === strInizio) ? `Inizio ore ${p.inizio.split("T")[1]}` : (dataOggiStr === strFine) ? `Fine ore ${p.fine.split("T")[1]}` : `IN USO (h24)`;
      
      const badge = document.createElement("div"); badge.className = "badge-prenotazione"; badge.style.backgroundColor = ottieniColoreUtente(p.utenteId);
      badge.innerHTML = `<span class="badge-nome">${v ? v.marca+" "+v.modello : "Veicolo rimosso"}</span><span class="badge-orari">${u ? u.nome+" "+u.cognome : "Autista rimosso"}</span><span class="badge-orari">${etichettaOrario}</span>`;
      badge.onclick = (e) => { e.stopPropagation(); apriModalModifica(p); };
      div.appendChild(badge);
    });
    grid.appendChild(div);
  }
}

async function caricaTuttoPerPrenotazioni() {
  await caricaVeicoli(); await caricaUtenti();
  const res = await fetch("/api/prenotazioni"); prenotazioniGlobali = await res.json();
  const lista = document.getElementById("listaMezziPrenotazione"); lista.innerHTML = "";
  
  const mezziValidi = veicoliGlobali.filter(v => !v.obsoleto && !v.guasto);
  
  mezziValidi.forEach(v => {
    const li = document.createElement("li"); li.innerText = `${v.marca} ${v.modello} - ${v.targa}`;
    if(v.id === mezzoSelezionatoId) li.classList.add("selezionato");
    li.onclick = () => apriCalendarioMezzo(v.id, li);
    lista.appendChild(li);
  });
  if (!mezzoSelezionatoId && mezziValidi.length > 0) apriCalendarioMezzo(mezziValidi[0].id, lista.querySelector("li"));
  else if (mezzoSelezionatoId) disegnaCalendario();
}

function apriCalendarioMezzo(id, el) {
  mezzoSelezionatoId = id; document.querySelectorAll(".lista-mezzi li").forEach(x => x.classList.remove("selezionato"));
  if(el) el.classList.add("selezionato");
  document.getElementById("areaCalendario").style.display = "block"; disegnaCalendario();
}

function cambiaMese(dir) { dataCalendario.setMonth(dataCalendario.getMonth() + dir); disegnaCalendario(); }

function disegnaCalendario() {
  const grid = document.getElementById("calendarioGrid"); grid.innerHTML = "";
  const anno = dataCalendario.getFullYear(); const mese = dataCalendario.getMonth();
  const realeOggi = new Date(); const stringaRealeOggi = `${realeOggi.getFullYear()}-${String(realeOggi.getMonth() + 1).padStart(2, '0')}-${String(realeOggi.getDate()).padStart(2, '0')}`;
  
  document.getElementById("meseAnnoLabel").innerText = new Date(anno, mese).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase();
  ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].forEach(g => { const div = document.createElement("div"); div.className = "giorno-header"; div.innerText = g; grid.appendChild(div); });

  let offset = new Date(anno, mese, 1).getDay(); offset = offset === 0 ? 6 : offset - 1;
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();

  for (let i = 0; i < offset; i++) { const div = document.createElement("div"); div.className = "giorno vuoto"; grid.appendChild(div); }

  for (let i = 1; i <= giorniNelMese; i++) {
    const div = document.createElement("div"); div.className = "giorno";
    const dataOggiStr = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    
    div.innerHTML = `<strong class="numero-giorno ${dataOggiStr === stringaRealeOggi ? 'oggi' : ''}">${i}</strong>`;
    div.onclick = (e) => { if(e.target === div || e.target.classList.contains('numero-giorno')) apriModalNuova(`${dataOggiStr}T09:00`); };

    const prenoDelGiorno = prenotazioniGlobali.filter(p => {
      if(!p || p.mezzoId != mezzoSelezionatoId || !p.inizio || !p.fine) return false;
      try {
        const strInizio = p.inizio.split("T")[0];
        const strFine = p.fine.split("T")[0];
        return dataOggiStr >= strInizio && dataOggiStr <= strFine;
      } catch(err) { return false; }
    }).sort((a, b) => (a.inizio || "").localeCompare(b.inizio || ""));

    prenoDelGiorno.forEach(p => {
      const u = utentiGlobali.find(x => x.id == p.utenteId);
      const strInizio = p.inizio.split("T")[0]; const strFine = p.fine.split("T")[0];
      let etichettaOrario = (strInizio === strFine) ? `${p.inizio.split("T")[1]} - ${p.fine.split("T")[1]}` : (dataOggiStr === strInizio) ? `Inizio ore ${p.inizio.split("T")[1]}` : (dataOggiStr === strFine) ? `Fine ore ${p.fine.split("T")[1]}` : `IN USO (h24)`;
      
      const badge = document.createElement("div"); badge.className = "badge-prenotazione"; badge.style.backgroundColor = ottieniColoreUtente(p.utenteId);
      badge.innerHTML = `<span class="badge-nome">${u ? u.nome+" "+u.cognome : "Autista rimosso"}</span><span class="badge-orari">${etichettaOrario}</span>`;
      badge.onclick = (e) => { e.stopPropagation(); apriModalModifica(p); };
      div.appendChild(badge);
    });
    grid.appendChild(div);
  }
}

// --- POPUP MODALE ---
function popolaSelectUtenti(selezionatoId = null) {
  const select = document.getElementById("modalUtente"); select.innerHTML = '<option value="">-- Seleziona Autista --</option>';
  utentiGlobali.filter(u => u.attivo).forEach(u => {
    const sel = u.id == selezionatoId ? 'selected' : '';
    select.innerHTML += `<option value="${u.id}" ${sel}>${u.nome} ${u.cognome}</option>`;
  });
  
  if (utenteCorrente && utenteCorrente.ruolo === "autista") { select.value = utenteCorrente.id; select.disabled = true; } 
  else { select.disabled = false; }
}

function popolaSelectVeicoli(selezionatoId = null) {
  const select = document.getElementById("modalVeicolo"); select.innerHTML = '<option value="">-- Seleziona Veicolo --</option>';
  veicoliGlobali.filter(v => !v.obsoleto && !v.guasto).forEach(v => {
    const sel = v.id == selezionatoId ? 'selected' : '';
    select.innerHTML += `<option value="${v.id}" ${sel}>${v.marca} ${v.modello} - ${v.targa}</option>`;
  });
}

function apriModalDaHome(mezzoId, dataOraInizioStr) {
  document.getElementById("editPrenotazioneId").value = ""; document.getElementById("modalTitolo").innerText = "Nuova Prenotazione";
  document.getElementById("labelSelectMezzoModal").style.display = "block"; document.getElementById("modalVeicolo").style.display = "block";
  popolaSelectVeicoli(mezzoId); popolaSelectUtenti();
  document.getElementById("modalInizio").value = dataOraInizioStr; document.getElementById("modalFine").value = `${dataOraInizioStr.split("T")[0]}T18:00`;
  document.getElementById("modalNote").value = "";
  document.getElementById("btnEliminaModal").classList.add("nascosto"); document.getElementById("modalPrenotazione").style.display = "flex";
}

function apriModalNuova(dataOraInizioStr) {
  document.getElementById("editPrenotazioneId").value = ""; document.getElementById("modalTitolo").innerText = "Nuova Prenotazione";
  document.getElementById("labelSelectMezzoModal").style.display = "none"; document.getElementById("modalVeicolo").style.display = "none";
  popolaSelectUtenti();
  document.getElementById("modalInizio").value = dataOraInizioStr; document.getElementById("modalFine").value = `${dataOraInizioStr.split("T")[0]}T18:00`;
  document.getElementById("modalNote").value = "";
  document.getElementById("btnEliminaModal").classList.add("nascosto"); document.getElementById("modalPrenotazione").style.display = "flex";
}

function apriModalModifica(p) {
  if (utenteCorrente && utenteCorrente.ruolo === "autista" && p.utenteId != utenteCorrente.id) { alert("Non hai i permessi per modificare la prenotazione di un collega."); return; }
  document.getElementById("editPrenotazioneId").value = p.id; document.getElementById("modalTitolo").innerText = "Modifica / Cancella Prenotazione";
  document.getElementById("labelSelectMezzoModal").style.display = "block"; document.getElementById("modalVeicolo").style.display = "block";
  
  let v = veicoliGlobali.find(x => x.id == p.mezzoId);
  if (v && v.guasto) { document.getElementById("modalVeicolo").innerHTML = `<option value="${v.id}" selected>${v.marca} ${v.modello} - ${v.targa} (GUASTO)</option>`; } 
  else { popolaSelectVeicoli(p.mezzoId); }
  
  popolaSelectUtenti(p.utenteId);
  document.getElementById("modalInizio").value = p.inizio; document.getElementById("modalFine").value = p.fine; document.getElementById("modalNote").value = p.note || "";
  document.getElementById("btnEliminaModal").classList.remove("nascosto"); document.getElementById("modalPrenotazione").style.display = "flex";
}

function chiudiModal() { const m = document.getElementById("modalPrenotazione"); if(m) m.style.display = "none"; }
async function eliminaPrenotazioneCorrente() {
  const id = document.getElementById("editPrenotazioneId").value;
  if(id && confirm("Vuoi davvero cancellare questa prenotazione?")) {
    await fetch(`/api/prenotazioni/${id}`, { method: "DELETE" });
    chiudiModal(); caricaTuttoHome(); if(mezzoSelezionatoId) caricaTuttoPerPrenotazioni();
  }
}
