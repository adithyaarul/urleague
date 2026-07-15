function getDefaultCricketHouseRules() {
  return Object.fromEntries(HOUSE_RULES_CONFIG.map(rule => [rule.id, rule.default]));
}

const COMMENTARY_OPTIONS = {
  cricket: [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'Hindi' },
    { value: 'ta', label: 'Tamil' },
    { value: 'kn', label: 'Kannada' },
  ],
  football: [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
  ],
  badminton: [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'Hindi' },
  ],
};

const COMMENTARY_PACKS = {
  cricket: {
    en: { six: ['⬆ MASSIVE SIX by {bat}! That ball is in ORBIT! {bowl} looks stunned.'], four: ['• FOUR! {bat} finds the gap and sends it racing to the boundary!'], wicket: ['✕ OUT! {bat} falls to {bowl}!'], dot: ['{bowl} bowls a tight line. Dot ball.'], run1: ['Quick single by {bat}.'], run2: ['Two runs for {bat}.'], run3: ['Three runs! {bat} runs hard.'], wide: ['Wide from {bowl}.'], noball: ['No-ball from {bowl}.'], default: ['{bat} keeps the pressure on.'] },
    hi: { six: ['⬡ {bat} ने शानदार छक्का लगाया!'], four: ['• चौका! {bat} ने गेंद को सीमा तक भेजा!'], wicket: ['✕ आउट! {bat} का विकेट गिरा, {bowl} खुश हुआ!'], dot: ['{bowl} ने कड़ी लाइन फेंकी, डॉट बॉल।'], run1: ['{bat} ने एक रन लिया।'], run2: ['दो रन! {bat} ने रन जुटाए।'], run3: ['तीन रन! {bat} ने तेजी से रन लिए।'], wide: ['वाइड! {bowl} ने गेंद बाहर फेंकी।'], noball: ['नो बॉल! {bowl} ने ओवरस्टेप किया।'], default: ['{bat} दबाव बनाए रख रहे हैं।'] },
    ta: { six: ['⬡ {bat} மிகப்பெரிய சிக்சரை விளாசினார்!'], four: ['• ஃபோர்! {bat} இடைவெளியை கண்டுபிடித்தார்!'], wicket: ['✕ அவுட்! {bat} விக்கெட்டை இழந்தார், {bowl} மகிழ்ச்சியுடன் இருக்கிறார்!'], dot: ['{bowl} துல்லியமாக வீசி டாட் பந்தை உருவாக்கினார்.'], run1: ['{bat} ஒரே ரன் எடுத்தார்.'], run2: ['இரண்டு ரன்கள்! {bat} ரன்களை எடுத்தார்.'], run3: ['மூன்று ரன்கள்! {bat} வேகமாக ஓடினார்.'], wide: ['வைட்! {bowl} லெக் சைடில் பந்தை வீசினார்.'], noball: ['நோ பால்! {bowl} ஓவர்ஸ்டெப் செய்துள்ளார்.'], default: ['{bat} நிலைத்தன்மையை காக்கிறார்.'] },
    kn: { six: ['⬡ {bat} ಬಿಗಿ ಸಿಕ್ಸ್ ಹೊಡೆದು ಉಡಾಯಿಸಿದರು!'], four: ['• ಫೋರ್! {bat} ಗೆ ಗ್ಯಾಪ್ ಸಿಕ್ಕಿದೆ!'], wicket: ['✕ ಔಟ್! {bat} ವಿಕೆಟ್ ಉಡಾಯಿಸಲಾಯಿತು, {bowl} ಸಂತೋಷದಿಂದ ನಲಿಯುತ್ತಾನೆ!'], dot: ['{bowl} ಕಠಿಣ ಲೈನ್ ಬೌಲ್ ಮಾಡಿದ, ಡಾಟ್ ಬಾಲ್.'], run1: ['{bat} ಒಂದು ರನ್ ತೆಗೆದುಕೊಂಡರು.'], run2: ['ಎರಡು ರನ್! {bat} ರನ್ ಗಳಿಸಿದರು.'], run3: ['ಮೂರು ರನ್! {bat} ವೇಗವಾಗಿ ಓಡಿ ರನ್ ಗಳಿಸಿದರು.'], wide: ['ವೈಡ್! {bowl} ಬೌಲ್‌ನಲ್ಲಿ ತಪ್ಪು ಎಸೆದರು.'], noball: ['ನೋ-ಬಾಲ್! {bowl} ಓವರ್ಸ್ಟೆಪ್ ಮಾಡಿದ.'], default: ['{bat} ಸ್ಥಿರ ಆಟ ಮುಂದುವರಿಸುತ್ತಿದ್ದಾರೆ.'] },
  },
  football: {
    en: { goal: ['⬤ Goal! {team} finds the net.'], yellow: ['◆ Yellow card shown to {team}.'], red: ['◆ Red card for {team}.'], foul: ['! Foul by {team}.'], start: ['Kickoff! Live commentary is on.'], end: ['Full time — the final whistle has blown.'], default: ['{team} are keeping the tempo high.'] },
    es: { goal: ['⬤ ¡Gol! {team} marca.'], yellow: ['◆ Tarjeta amarilla para {team}.'], red: ['◆ Tarjeta roja para {team}.'], foul: ['! Foul de {team}.'], start: ['¡Arranca el partido!'], end: ['Final del partido — suena el silbato.'], default: ['{team} mantiene el ritmo alto.'] },
  },
  badminton: {
    en: { point: ['• Point to {player}!'], set: ['• Set {set} is underway.'], match: ['• Match point for {player}.'], default: ['{player} is controlling the rally.'] },
    hi: { point: ['• {player} ने यह पॉइंट जीता!'], set: ['• सेट {set} शुरू हुआ।'], match: ['• {player} के लिए मैच पॉइंट!'], default: ['{player} रैली पर नियंत्रण रख रहे हैं।'] },
  },
};

function getCommentarySport() {
  return S.sport || 'cricket';
}

function getCommentaryLanguage() {
  return S.commentaryLanguageBySport?.[getCommentarySport()] || COMMENTARY_OPTIONS[getCommentarySport()]?.[0]?.value || 'en';
}

function applyCommentarySettings() {
  const select = document.getElementById('commentary-language-select');
  if (!select) return;
  const sport = getCommentarySport();
  const options = COMMENTARY_OPTIONS[sport] || COMMENTARY_OPTIONS.cricket;
  select.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  select.value = getCommentaryLanguage();
  const label = document.getElementById('settings-commentary-label');
  if (label) label.textContent = `Currently: ${options.find(o => o.value === select.value)?.label || select.value}`;
}

function setCommentaryLanguage(lang) {
  const sport = getCommentarySport();
  const valid = (COMMENTARY_OPTIONS[sport] || COMMENTARY_OPTIONS.cricket).some(o => o.value === lang);
  if (!valid) return;
  S.commentaryLanguageBySport[sport] = lang;
  save();
  applyCommentarySettings();
  toast(`Commentary language set to ${(COMMENTARY_OPTIONS[sport] || COMMENTARY_OPTIONS.cricket).find(o => o.value === lang)?.label || lang}`);
}

function getCommentaryTemplate(sport, type) {
  const lang = getCommentaryLanguage();
  const pack = COMMENTARY_PACKS[sport]?.[lang] || COMMENTARY_PACKS[sport]?.en || {};
  return pack[type] || pack.default || [''];
}

function getCommentaryText(sport, type, vars = {}) {
  const arr = getCommentaryTemplate(sport, type);
  const template = Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr;
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || '');
}

function addCommentary(sport, type, vars = {}) {
  const feed = document.getElementById(`${sport}-commentary-feed`);
  if (!feed) return;
  const item = document.createElement('div');
  item.className = 'commentary-item';
  item.textContent = getCommentaryText(sport, type, vars);
  const empty = feed.querySelector('.commentary-empty');
  if (empty) empty.remove();
  feed.prepend(item);
  while (feed.children.length > 6) feed.removeChild(feed.lastChild);
}

// ═══════════════════════════════════════════════════════
// SPORT GATEWAY
// ═══════════════════════════════════════════════════════
// Stored pending sport for room entry flow
let _pendingSport = null;
