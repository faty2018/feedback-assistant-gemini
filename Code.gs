const MODEL = 'gemini-3.5-flash';


function appelerGemini(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Erreur Gemini : ' + response.getContentText());
  }

  const data = JSON.parse(response.getContentText());
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

function genererFeedbacks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Réponses');
  const exercice = sheet.getRange('H2').getValue();
  const lastRow = sheet.getLastRow();

  for (let row = 2; row <= lastRow; row++) {
    const reponse = sheet.getRange(row, 3).getValue();
    const statut = sheet.getRange(row, 6).getValue();
    if (!reponse || statut === 'Traité' || statut === 'Envoyé') continue;

    const prompt = `Tu es un formateur bienveillant et encourageant.
Exercice donné : "${exercice}"
Réponse du participant : "${reponse}"

Évalue la réponse selon 3 critères, chacun noté de 0 à 10 :
- clarte : le message est-il facile à comprendre ?
- ton_pro : le ton est-il poli et professionnel ?
- concision : la longueur respecte-t-elle la consigne, sans blabla ?

Écris ensuite un feedback court (2 à 3 phrases, en français) : un point positif, puis une piste d'amélioration concrète.
Réponds uniquement avec un JSON de cette forme : {"clarte": 7, "ton_pro": 8, "concision": 6, "feedback": "..."}`;

    const r = appelerGemini(prompt);
    const note = Math.round((r.clarte + r.ton_pro + r.concision) / 3);

    sheet.getRange(row, 4).setValue(r.feedback);
    sheet.getRange(row, 5).setValue(note);
    sheet.getRange(row, 6).setValue('Traité');
    sheet.getRange(row, 10, 1, 3).setValues([[r.clarte, r.ton_pro, r.concision]]);
  }
}

function envoyerMails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Réponses');
  const lastRow = sheet.getLastRow();

  for (let row = 2; row <= lastRow; row++) {
    const nom = sheet.getRange(row, 1).getValue();
    const email = sheet.getRange(row, 2).getValue();
    const feedback = sheet.getRange(row, 4).getValue();
    const note = sheet.getRange(row, 5).getValue();
    const statut = sheet.getRange(row, 6).getValue();
    const clarte = sheet.getRange(row, 10).getValue();
    const tonPro = sheet.getRange(row, 11).getValue();
    const concision = sheet.getRange(row, 12).getValue();

    if (statut !== 'Traité') continue;

    const sujet = 'Ton feedback sur l\'exercice : ' + note + '/10';
    const corps = 'Bonjour ' + nom + ',\n\n' +
      'Merci pour ta réponse à l\'exercice. Voici ton feedback :\n\n' +
      feedback + '\n\n' +
      'Détail :\n' +
      '- Clarté : ' + clarte + '/10\n' +
      '- Ton professionnel : ' + tonPro + '/10\n' +
      '- Concision : ' + concision + '/10\n\n' +
      'Note finale : ' + note + '/10\n\n' +
      'Continue comme ça !';

    GmailApp.sendEmail(email, sujet, corps);
    sheet.getRange(row, 6).setValue('Envoyé');
  }
}

function lancerTout() {
  genererFeedbacks();
  envoyerMails();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Assistant Feedback Formation');
}

function getExercice() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Réponses');
  return sheet.getRange('H2').getValue();
}

function enregistrerReponse(nom, email, reponse) {
  if (!nom || !email || !reponse) {
    throw new Error('Tous les champs sont obligatoires.');
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Réponses');
  sheet.appendRow([nom, email, reponse]);
}