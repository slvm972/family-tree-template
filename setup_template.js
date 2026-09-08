// setup.js — запустите один раз: node setup.js
// Автоматически: спрашивает пароли → создаёт KV → деплоит Worker →
// вписывает Worker URL в HTML-файл дерева. Минимум ручных действий.

const crypto    = require('crypto');
const fs        = require('fs');
const path      = require('path');
const readline  = require('readline');
const { execSync } = require('child_process');

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(res => rl.question(q, res));

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function run(cmd, opts = {}) {
  console.log('   → ' + cmd);
  return execSync(cmd, { encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
}

(async () => {
  console.log('\n🌳 Автоматическая настройка семейного дерева\n');
  console.log('Этот скрипт сделает всё сам: создаст хранилище, задеплоит');
  console.log('сервер и подключит к нему ваш файл дерева.\n');

  // ── Step 1: passwords ────────────────────────────────
  const guest = await ask('1) Пароль для родственников (простой, чтобы легко запомнить): ');
  const admin = await ask('2) Пароль администратора (только для вас, сложнее): ');

  if(!guest || !admin) { console.log('❌ Пароли не могут быть пустыми'); process.exit(1); }
  if(guest === admin)  { console.log('❌ Пароли должны отличаться'); process.exit(1); }

  const gHash = sha256(guest);
  const aHash = sha256(admin);
  console.log('✅ Пароли готовы\n');

  // ── Step 2: Cloudflare login ──────────────────────────
  console.log('3) Сейчас откроется браузер — войдите в свой аккаунт Cloudflare');
  console.log('   (если аккаунта нет — создайте бесплатно на cloudflare.com)\n');
  await ask('   Нажмите Enter когда будете готовы продолжить...');
  try {
    run('npx wrangler login');
  } catch(e) {
    console.log('⚠️  Похоже вы уже вошли — продолжаем.\n');
  }

  // ── Step 3: create KV namespace automatically ─────────
  console.log('\n4) Создаю хранилище данных для вашего дерева...');
  let kvId;
  try {
    const out = runCapture('npx wrangler kv namespace create TREE_KV');
    // wrangler prints something like: id = "abcdef1234567890"
    const m = out.match(/id\s*=\s*"([a-f0-9]+)"/i) || out.match(/"id":\s*"([a-f0-9]+)"/i);
    if(!m) throw new Error('Не удалось найти ID в выводе wrangler');
    kvId = m[1];
    console.log('✅ Хранилище создано, ID: ' + kvId);
  } catch(e) {
    console.log('⚠️  Не получилось создать автоматически. Причина:', e.message);
    kvId = await ask('   Вставьте ID хранилища вручную (или Enter чтобы пропустить): ');
  }

  // ── Step 3b: create R2 bucket for photo storage automatically ────
  console.log('\n4b) Создаю хранилище для фотографий...');
  let photosBucketName;
  try {
    // R2 bucket names must be globally unique within the account and
    // follow DNS-label rules (lowercase, digits, hyphens) — unlike the
    // KV namespace id above, which wrangler generates for us, the R2
    // bucket name has to be chosen up front and passed into the create
    // command, so we derive one instead of parsing it out of the output.
    photosBucketName = 'family-tree-photos-' + Date.now().toString(36);
    runCapture(`npx wrangler r2 bucket create ${photosBucketName}`);
    console.log('✅ Хранилище фото создано: ' + photosBucketName);
  } catch(e) {
    console.log('⚠️  Не получилось создать автоматически. Причина:', e.message);
    photosBucketName = await ask('   Введите имя бакета вручную (или Enter чтобы пропустить фото-функцию): ');
  }

  // ── Step 4: update wrangler.toml ──────────────────────
  console.log('\n5) Обновляю настройки...');
  const tomlPath = path.join(process.cwd(), 'wrangler.toml');
  let toml = fs.readFileSync(tomlPath, 'utf8');
  toml = toml.replace('PLACEHOLDER_GUEST_HASH', gHash);
  toml = toml.replace('PLACEHOLDER_ADMIN_HASH', aHash);
  if(kvId) toml = toml.replace('PLACEHOLDER_KV_ID', kvId);
  if(photosBucketName) toml = toml.replace('PLACEHOLDER_PHOTOS_BUCKET_NAME', photosBucketName);
  fs.writeFileSync(tomlPath, toml);
  console.log('✅ Настройки сохранены');

  // ── Step 5: deploy Worker, capture URL ─────────────────
  console.log('\n6) Публикую сервер вашего дерева...');
  let workerUrl = null;
  try {
    const out = runCapture('npx wrangler deploy');
    console.log(out);
    const m = out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i);
    if(m) workerUrl = m[0];
  } catch(e) {
    console.log('❌ Ошибка при публикации сервера:', e.message);
    console.log('   Попробуйте выполнить вручную: npx wrangler deploy');
  }

  // ── Step 6: inject Worker URL into tree HTML automatically ──
  if(workerUrl){
    console.log('\n7) Обнаружен адрес сервера: ' + workerUrl);
    const htmlCandidates = fs.readdirSync(process.cwd())
      .filter(f => f.endsWith('.html') && f !== 'admin.html');
    if(htmlCandidates.length === 1){
      const htmlPath = path.join(process.cwd(), htmlCandidates[0]);
      let html = fs.readFileSync(htmlPath, 'utf8');
      const before = html;
      html = html.replace(
        /const WORKER_URL = TREE_CONFIG\.workerUrl;/,
        'const WORKER_URL = TREE_CONFIG.workerUrl;' // config-driven — see TREE_CONFIG.workerUrl below
      );
      // Also patch TREE_CONFIG.workerUrl value directly if present
      html = html.replace(
        /workerUrl:\s*'https?:\/\/[^']*'/,
        `workerUrl:    '${workerUrl}'`
      );
      if(html !== before){
        fs.writeFileSync(htmlPath, html);
        console.log('✅ Файл ' + htmlCandidates[0] + ' автоматически подключён к серверу');
      } else {
        console.log('⚠️  Не нашёл строку workerUrl в файле — впишите вручную:');
        console.log('   ' + workerUrl);
      }
    } else {
      console.log('⚠️  Нашёл несколько/ни одного HTML файлов — впишите адрес вручную в TREE_CONFIG.workerUrl:');
      console.log('   ' + workerUrl);
    }
  }

  console.log('\n🎉 Готово! Что дальше:');
  console.log('   1. Загрузите HTML-файл дерева на Cloudflare Pages:');
  console.log('      npx wrangler pages deploy . --project-name my-family-tree');
  console.log('   2. Откройте полученную ссылку — дерево готово к работе!');
  console.log('   3. Пароль администратора: тот что вы ввели выше (шаг 2)');
  console.log('   4. Пароль для родственников: тот что вы ввели выше (шаг 1)\n');
  if(!photosBucketName) {
    console.log('   ⚠️  Загрузка фото не настроена (шаг с R2 был пропущен) —');
    console.log('       функция "Фото" в форме продолжит работать через URL-поле.\n');
  }

  rl.close();
})();
