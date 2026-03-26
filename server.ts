import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json());

const dbPath = path.join(process.cwd(), 'database.db');
const db = new Database(dbPath);

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    documentId INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT
  );

  CREATE TABLE IF NOT EXISTS annotations (
    annotationId INTEGER PRIMARY KEY AUTOINCREMENT,
    documentId INTEGER,
    startInt INTEGER NOT NULL,
    endInt INTEGER NOT NULL,
    FOREIGN KEY(documentId) REFERENCES documents(documentId)
  );

  CREATE TABLE IF NOT EXISTS comments (
    commentId INTEGER PRIMARY KEY AUTOINCREMENT,
    annotationId INTEGER,
    answerId INTEGER,
    content TEXT NOT NULL,
    FOREIGN KEY(annotationId) REFERENCES annotations(annotationId),
    FOREIGN KEY(answerId) REFERENCES comments(commentId)
  );

  CREATE TABLE IF NOT EXISTS docdoc (
    docdocId INTEGER PRIMARY KEY AUTOINCREMENT,
    documentId INTEGER,
    linkId INTEGER,
    startInt INTEGER NOT NULL,
    endInt INTEGER NOT NULL,
    startlink INTEGER NOT NULL,
    endlink INTEGER NOT NULL,
    FOREIGN KEY(documentId) REFERENCES documents(documentId),
    FOREIGN KEY(linkId) REFERENCES documents(documentId)
  );
`);

try {
  db.exec('ALTER TABLE documents ADD COLUMN summary TEXT');
} catch (e) {
  // Column might already exist
}

// Insert initial data if empty
const count = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
if (count.count === 0) {
  const Faust = `Habe nun, ach! Philosophie,
355
Juristerey und Medicin,
Und leider auch Theologie!
Durchaus studirt, mit heißem Bemühn.
Da steh’ ich nun, ich armer Thor!
Und bin so klug als wie zuvor;

360
Heiße Magister, heiße Doctor gar,
Und ziehe schon an die zehen Jahr,
Herauf, herab und quer und krumm,
Meine Schüler an der Nase herum –

[34]
Und sehe, daß wir nichts wissen können!

365
Das will mir schier das Herz verbrennen.
Zwar bin ich gescheidter als alle die Laffen,
Doctoren, Magister, Schreiber und Pfaffen;
Mich plagen keine Scrupel noch Zweifel,
Fürchte mich weder vor Hölle noch Teufel –

370
Dafür ist mir auch alle Freud’ entrissen,
Bilde mir nicht ein was rechts zu wissen,
Bilde mir nicht ein, ich könnte was lehren,
Die Menschen zu bessern und zu bekehren.
Auch hab’ ich weder Gut noch Geld,

375
Noch Ehr’ und Herrlichkeit der Welt.
Es möchte kein Hund so länger leben!
Drum hab’ ich mich der Magie ergeben,
Ob mir durch Geistes Kraft und Mund
Nicht manch Geheimniß würde kund;

380
Daß ich nicht mehr mit sauerm Schweiß,
Zu sagen brauche, was ich nicht weiß;
Daß ich erkenne, was die Welt
Im Innersten zusammenhält,
Schau’ alle Wirkenskraft und Samen,

385
Und thu’ nicht mehr in Worten kramen`;

  const Grundgesetz = `Im Bewußtsein seiner Verantwortung vor Gott und den Menschen,
von dem Willen beseelt, als gleichberechtigtes Glied in einem vereinten Europa dem Frieden der Welt zu dienen, hat sich das Deutsche Volk kraft seiner verfassungsgebenden Gewalt dieses Grundgesetz gegeben.
Die Deutschen in den Ländern Baden-Württemberg, Bayern, Berlin, Brandenburg, Bremen, Hamburg, Hessen, Mecklenburg-Vorpommern, Niedersachsen, Nordrhein-Westfalen, Rheinland-Pfalz, Saarland, Sachsen, Sachsen-Anhalt, Schleswig-Holstein und Thüringen haben in freier Selbstbestimmung die Einheit und Freiheit Deutschlands vollendet. Damit gilt dieses Grundgesetz für das gesamte Deutsche Volk.`;

  const insertDoc = db.prepare('INSERT INTO documents (name, content) VALUES (?, ?)');
  const infoGrundgesetz = insertDoc.run('Grundgesetz', Grundgesetz);
  const infoFaust = insertDoc.run('Faust', Faust);

  const insertAnno = db.prepare('INSERT INTO annotations (documentId, startInt, endInt) VALUES (?, ?, ?)');
  const infoAnno = insertAnno.run(infoFaust.lastInsertRowid, 112, 116);

  const insertComment = db.prepare('INSERT INTO comments (annotationId, answerId, content) VALUES (?, ?, ?)');
  insertComment.run(infoAnno.lastInsertRowid, -1, "Wat meint der da?");

  const insertLink = db.prepare('INSERT INTO docdoc (documentId, linkId, startInt, endInt, startlink, endlink) VALUES (?, ?, ?, ?, ?, ?)');
  insertLink.run(infoFaust.lastInsertRowid, infoGrundgesetz.lastInsertRowid, 21, 31, 1, -1);
}

// API Routes
app.get('/api/search', (req, res) => {
  const query = req.query.q as string || '';
  const stmt = db.prepare('SELECT documentId, name FROM documents WHERE name LIKE ? LIMIT 10');
  const results = stmt.all(`%${query}%`);
  res.json(results);
});

app.get('/api/documents/:id', (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare('SELECT * FROM documents WHERE documentId = ?');
  const doc = stmt.get(id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(doc);
});

app.get('/api/documents/:id/annotations', (req, res) => {
  const id = req.params.id;
  const annotations = db.prepare('SELECT * FROM annotations WHERE documentId = ?').all(id) as any[];
  for (const anno of annotations) {
    anno.comments = db.prepare('SELECT * FROM comments WHERE annotationId = ? ORDER BY commentId ASC').all(anno.annotationId);
  }
  res.json(annotations);
});

app.get('/api/documents/:id/links', (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare(`
    SELECT d.*, doc.name as linkName 
    FROM docdoc d
    JOIN documents doc ON d.linkId = doc.documentId
    WHERE d.documentId = ?
  `);
  const links = stmt.all(id);
  res.json(links);
});

app.post('/api/annotations', (req, res) => {
  try {
    const { documentId, startInt, endInt, comment } = req.body;
    const insertAnno = db.prepare('INSERT INTO annotations (documentId, startInt, endInt) VALUES (?, ?, ?)');
    const info = insertAnno.run(documentId, startInt, endInt);
    
    if (comment) {
      const insertComment = db.prepare('INSERT INTO comments (annotationId, answerId, content) VALUES (?, ?, ?)');
      insertComment.run(info.lastInsertRowid, null, comment);
    }
    
    res.json({ success: true, annotationId: info.lastInsertRowid });
  } catch (error) {
    console.error('Error creating annotation:', error);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

app.post('/api/links', (req, res) => {
  try {
    const { documentId, linkId, startInt, endInt, startlink, endlink } = req.body;
    const insertLink = db.prepare('INSERT INTO docdoc (documentId, linkId, startInt, endInt, startlink, endlink) VALUES (?, ?, ?, ?, ?, ?)');
    const info = insertLink.run(documentId, linkId, startInt, endInt, startlink, endlink);
    res.json({ success: true, docdocId: info.lastInsertRowid });
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ error: 'Failed to create link' });
  }
});

app.post('/api/comments', (req, res) => {
  try {
    const { annotationId, answerId, content } = req.body;
    const insert = db.prepare('INSERT INTO comments (annotationId, answerId, content) VALUES (?, ?, ?)');
    const info = insert.run(annotationId, answerId && answerId !== -1 ? answerId : null, content);
    res.json({ success: true, commentId: info.lastInsertRowid });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

app.post('/api/documents/:id/summary', async (req, res) => {
  const id = req.params.id;
  const doc = db.prepare('SELECT * FROM documents WHERE documentId = ?').get(id) as any;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-preview',
      contents: `Fasse den folgenden Text prägnant zusammen:\n\n${doc.content}`
    });
    const summary = response.text;
    db.prepare('UPDATE documents SET summary = ? WHERE documentId = ?').run(summary, id);
    res.json({ summary });
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
