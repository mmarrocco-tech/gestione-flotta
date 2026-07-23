const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());

// FIX 1: Aiutiamo il cloud a trovare la cartella con la grafica
app.use(express.static(path.join(__dirname, 'public')));

// FIX 2: Prendiamo la password dalla cassaforte segreta di Render invece di scriverla qui!
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let veicoliColl, utentiColl, prenotazioniColl;

async function avviaServer() {
  try {
    await client.connect();
    const db = client.db('GestioneFlotta');
    veicoliColl = db.collection('veicoli');
    utentiColl = db.collection('utenti');
    prenotazioniColl = db.collection('prenotazioni');
    console.log("✅ Connesso al Cloud (MongoDB) con successo!");

    // Crea l'utente admin principale la prima volta se non esiste
    const adminEsiste = await utentiColl.findOne({ username: 'admin' });
    if (!adminEsiste) {
      await utentiColl.insertOne({ id: Date.now(), nome: 'Admin', cognome: 'Principale', username: 'admin', password: '123', ruolo: 'admin', attivo: true });
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server avviato sulla porta ${PORT}!`));
  } catch (err) {
    console.error("❌ Errore di connessione:", err);
  }
}
avviaServer();

// ==========================================
// --- ENDPOINTS (API) ---
// ==========================================

// LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await utentiColl.findOne({ username, password, attivo: true });
  if (user) res.json({ success: true, user });
  else res.json({ success: false, message: 'Credenziali errate o utente disattivato' });
});

// VEICOLI
app.get('/api/veicoli', async (req, res) => {
  const dati = await veicoliColl.find().toArray();
  res.json(dati);
});
app.post('/api/veicoli', async (req, res) => {
  const nuovo = { ...req.body, id: Date.now(), obsoleto: false, guasto: false };
  await veicoliColl.insertOne(nuovo);
  res.json({ success: true });
});
app.put('/api/veicoli/:id', async (req, res) => {
  const id = Number(req.params.id);
  await veicoliColl.updateOne({ id: id }, { $set: req.body });
  res.json({ success: true });
});

// UTENTI
app.get('/api/utenti', async (req, res) => {
  const dati = await utentiColl.find().toArray();
  res.json(dati);
});
app.post('/api/utenti', async (req, res) => {
  const nuovo = { ...req.body, id: Date.now(), attivo: true };
  await utentiColl.insertOne(nuovo);
  res.json({ success: true });
});
app.put('/api/utenti/:id', async (req, res) => {
  const id = Number(req.params.id);
  await utentiColl.updateOne({ id: id }, { $set: req.body });
  res.json({ success: true });
});

// PRENOTAZIONI
app.get('/api/prenotazioni', async (req, res) => {
  const dati = await prenotazioniColl.find().toArray();
  res.json(dati);
});
app.post('/api/prenotazioni', async (req, res) => {
  const nuovo = { ...req.body, id: Date.now() };
  nuovo.mezzoId = Number(nuovo.mezzoId);
  nuovo.utenteId = Number(nuovo.utenteId);
  await prenotazioniColl.insertOne(nuovo);
  res.json({ success: true });
});
app.put('/api/prenotazioni/:id', async (req, res) => {
  const id = Number(req.params.id);
  const updateData = { ...req.body };
  if(updateData.mezzoId) updateData.mezzoId = Number(updateData.mezzoId);
  if(updateData.utenteId) updateData.utenteId = Number(updateData.utenteId);
  await prenotazioniColl.updateOne({ id: id }, { $set: updateData });
  res.json({ success: true });
});
app.delete('/api/prenotazioni/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prenotazioniColl.deleteOne({ id: id });
  res.json({ success: true });
});
