// test-data/seed.js — засевает тестовые данные в ЛОКАЛЬНЫЙ Worker для отладки.
//
// ПРЕДВАРИТЕЛЬНО:
//   1. Скопируйте .dev.vars.example -> .dev.vars (в корне проекта)
//   2. Запустите в отдельном терминале:  npx wrangler dev
//      (ждите "Ready on http://127.0.0.1:8787")
//
// ЗАПУСК (из корня проекта):
//   node test-data/seed.js
//
// Что делает:
//   1. POST /api/tree — загружает test-data/seed-fixture.json (6 персон,
//      2 семьи: живые/умершие, с контактами/без, с недостающими данными,
//      неполная семья с одним известным родителем)
//   2. POST /api/rebuild-cache — просит Worker пересчитать relatives/
//      child_of/parent_in/grandparents из одних только nodes+families,
//      чтобы не считать их вручную и не рассинхронизировать

const fs = require('fs');
const path = require('path');

const WORKER_URL   = 'http://127.0.0.1:8787';
const ADMIN_PWD    = 'dev-admin-2026'; // должен совпадать с .dev.vars (см. .dev.vars.example)
const FIXTURE_PATH = path.join(__dirname, 'seed-fixture.json');

async function main() {
  const fixtureRaw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  JSON.parse(fixtureRaw); // fail fast если фикстура повреждена

  console.log('→ Проверяю, что Worker отвечает на', WORKER_URL, '...');
  try {
    await fetch(WORKER_URL + '/api/login', { method: 'OPTIONS' });
  } catch (e) {
    console.error('❌ Worker недоступен. Убедитесь что запущен `npx wrangler dev` в другом терминале.');
    console.error('   Ошибка:', e.message);
    process.exit(1);
  }

  console.log('→ Загружаю тестовые данные (POST /api/tree)...');
  const treeRes = await fetch(WORKER_URL + '/api/tree', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Password': ADMIN_PWD },
    body: fixtureRaw,
  });
  const treeData = await treeRes.json().catch(() => null);
  if (!treeRes.ok || !treeData || !treeData.ok) {
    console.error('❌ Не удалось загрузить данные:', treeData?.error || treeRes.status);
    console.error('   Проверьте, что ADMIN_PWD в этом скрипте совпадает с .dev.vars');
    process.exit(1);
  }
  console.log('✅ Данные загружены:', treeData.message || 'ok');

  console.log('→ Пересчитываю производные кэши (POST /api/rebuild-cache)...');
  const cacheRes = await fetch(WORKER_URL + '/api/rebuild-cache', {
    method: 'POST',
    headers: { 'X-Password': ADMIN_PWD },
  });
  const cacheData = await cacheRes.json().catch(() => null);
  if (!cacheRes.ok || !cacheData || !cacheData.ok) {
    console.error('❌ Не удалось пересчитать кэши:', cacheData?.error || cacheRes.status);
    process.exit(1);
  }
  console.log(`✅ Кэши пересчитаны: ${cacheData.persons} персон, ${cacheData.families} семей` +
              (cacheData.droppedFamilyRefs ? `, отброшено битых ссылок: ${cacheData.droppedFamilyRefs}` : ''));

  console.log('\n🎉 Готово. Откройте index.html через `npx wrangler pages dev .` и войдите как admin/guest');
  console.log('   (пароли — см. .dev.vars.example). Фокус по умолчанию — P3 (Пётр Тестов, есть родители');
  console.log('   P1/P2, ребёнок P4, и своя неполная семья F2 с детьми P5/P6). P6 — ветка с недостающей датой рождения.');
}

main().catch(e => {
  console.error('❌ Неожиданная ошибка:', e.message);
  process.exit(1);
});
