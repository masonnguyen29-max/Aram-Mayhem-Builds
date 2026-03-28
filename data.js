// ============================================================
//  SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = 'https://fngpjhyestdjxpxqgrmz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZ3BqaHllc3RkanhweHFncm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjgxNDEsImV4cCI6MjA5MDMwNDE0MX0.bi5UggBKKPHqbI44mV8x71CLfQP0lb7FOrGWlWvMH1g';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  AUGMENTS  (add more here as they are discovered)
// ============================================================
const AUGMENTS = {
  silver: [
    'ADAPt', 'Adamant', 'Blunt Force', 'Bread And Butter', 'Bread And Cheese',
    'Bread And Jam', 'Buff Buddies', 'Crack Open That Egg', "Crit 'n Cast",
    'Deft', 'Dive Bomber', "Don't Blink", 'Erosion', 'Escape Plan', 'EscAPADe',
    'Firefox', 'First-Aid Kit', 'Flash 2', 'Flashbang', 'Frost Wraith', 'Gash',
    'Goredrink', "Grandma's Chili Oil"
  ],
  gold: [
    'All For You', 'Apex Inventor', 'Back to Basics', 'Big Brain',
    'Biggest Snowball Ever', 'Celestial Body', 'Cheating', 'Circle of Death',
    'Courage of the Colossus', 'Critical Healing', 'Critical Missile',
    'Critical Rhythm', "Dawnbringer's Resolve", "Demon's Dance",
    'Devil on Your Shoulder', 'Divine Intervention', 'Donation', 'Double Tap',
    'Ethereal Weapon', 'Executioner', 'Firebrand', 'Flashy',
    'From Beginning to End', 'Get Excited', 'Goldrend'
  ],
  prismatic: [
    '??? (Enemy Missing)', 'Back to Basics', 'Biggest Snowball Ever', 'Blade Waltz',
    'Blunt Force', 'Bounce of the Poro King', "Can't Touch This", 'Cerberus',
    'Circle of Death', 'Clown College', 'Courage of the Colossus', 'Cruelty',
    'Dashing', 'Draw Your Sword', 'Dropkick', 'Droppybara', 'Dual Wield',
    'Earthwake', 'Eureka', 'Fan the Hammer', 'Fey Magic', 'Final Form',
    'Gash', 'Giant Slayer', 'Glass Cannon', 'Goldrend', 'Goliath'
  ]
};

// ============================================================
//  DATA DRAGON  (Riot's official static data CDN)
// ============================================================
let _ddVersion = null;
let _championsCache = null;
let _itemsCache = null;

async function getDDVersion() {
  if (_ddVersion) return _ddVersion;
  const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
  const versions = await res.json();
  _ddVersion = versions[0];
  return _ddVersion;
}

async function getChampions() {
  if (_championsCache) return _championsCache;
  const v = await getDDVersion();
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`);
  const data = await res.json();
  _championsCache = Object.values(data.data).sort((a, b) => a.name.localeCompare(b.name));
  return _championsCache;
}

async function getItems() {
  if (_itemsCache) return _itemsCache;
  const v = await getDDVersion();
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/item.json`);
  const data = await res.json();
  _itemsCache = Object.entries(data.data)
    .filter(([, item]) =>
      item.maps?.['12'] === true &&
      item.gold?.purchasable === true &&
      item.inStore !== false &&
      !item.requiredChampion &&
      item.gold?.total > 0
    )
    .map(([id, item]) => ({
      id,
      name: item.name,
      image: item.image?.full,
      gold: item.gold?.total
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _itemsCache;
}

function champImgUrl(championId) {
  return `https://ddragon.leagueoflegends.com/cdn/${_ddVersion}/img/champion/${championId}.png`;
}

function itemImgUrl(imageFilename) {
  return `https://ddragon.leagueoflegends.com/cdn/${_ddVersion}/img/item/${imageFilename}`;
}

// ============================================================
//  DATABASE HELPERS
// ============================================================
async function getBuildsForChampion(championId) {
  const { data, error } = await db
    .from('builds')
    .select('*')
    .eq('champion_id', championId)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function submitBuild(build) {
  const { data, error } = await db.from('builds').insert([build]).select();
  if (error) throw error;
  return data;
}

// ============================================================
//  RIOT API
//  Note: Dev key expires every 24 hours.
//  Get a new one at developer.riotgames.com
// ============================================================
const RIOT_API_KEY = 'RGAPI-859e29f8-5648-4123-b47a-51e0f6afbc88';

// Save account to browser after connecting
async function connectRiotAccount(riotId, cluster) {
  const parts = riotId.split('#');
  if (parts.length !== 2) throw new Error('Invalid format. Use Name#TAG (e.g. Mason#NA1)');
  const [gameName, tagLine] = parts;

  const res = await fetch(
    `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`
  );
  if (!res.ok) throw new Error('Account not found. Check your Riot ID and region.');

  const account = await res.json();
  localStorage.setItem('riot_account', JSON.stringify({
    puuid:    account.puuid,
    gameName: account.gameName,
    tagLine:  account.tagLine,
    cluster
  }));
  return account;
}

function getSavedAccount() {
  const saved = localStorage.getItem('riot_account');
  return saved ? JSON.parse(saved) : null;
}

function clearSavedAccount() {
  localStorage.removeItem('riot_account');
}

// Fetch recent match IDs for a PUUID (no queue filter — catches ARAM Mayhem + regular ARAM)
async function fetchRecentARAMMatchIds(puuid, cluster, count = 50) {
  const res = await fetch(
    `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&api_key=${RIOT_API_KEY}`
  );
  if (!res.ok) throw new Error('Failed to fetch match history. Your API key may have expired.');
  return res.json();
}

// Fetch full details for one match
async function fetchMatchDetail(matchId, cluster) {
  const res = await fetch(
    `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`
  );
  if (!res.ok) throw new Error('Failed to fetch match details.');
  return res.json();
}

// Pull out the relevant stats for a player from a match
function extractBuildFromMatch(match, puuid, itemsMap) {
  const p = match.info.participants.find(pl => pl.puuid === puuid);
  if (!p) return null;

  // Champion name from Riot API sometimes differs from Data Dragon ID
  // e.g. "FiddleSticks" vs "Fiddlesticks" — we normalise below
  const championId = p.championName;

  const itemIds = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5]
    .filter(id => id > 0);

  const items = itemIds.map(id => {
    const found = itemsMap[String(id)];
    return found
      ? { id: String(id), name: found.name, image: found.image, gold: found.gold }
      : { id: String(id), name: `Item ${id}`, image: `${id}.png`, gold: 0 };
  });

  const date     = new Date(match.info.gameStartTimestamp);
  const duration = Math.floor(match.info.gameDuration / 60);

  return { championId, items, isWin: p.win, date, duration, matchId: match.metadata.matchId };
}

// ============================================================
//  UTILITIES
// ============================================================
function starsHTML(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function timeAgo(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}
