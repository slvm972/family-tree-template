// Вход в демо с витрины. Те же ключи хранилища, что у основного проекта:
// sessionStorage: tree_pwd, tree_role; localStorage (по галочке): tree_pwd_saved, tree_role_saved.
(function () {
  var API = '__API__';
  var TREE_URL = '/tree';
  var add = {
    ru: { 'demo-title': 'Попробуйте демо',
      'demo-sub': 'Это демонстрация на вымышленной семье — личных данных здесь нет. Введите пароль, чтобы увидеть, как выглядят вход и дерево. В купленном продукте этой страницы нет: у вас будет ваше дерево и ваши пароли.',
      'demo-label': 'Пароль', 'demo-hint': 'Пароли для демо:',
      'demo-guest': 'гость: просмотр, поиск, печать',
      'demo-admin': 'администратор: ещё и редактирование, управление',
      'demo-remember': 'Запомнить на этом устройстве', 'demo-btn': 'Войти в демо',
      'demo-continue': 'Вы уже вошли — открыть дерево →',
      'demo-bad': 'Неверный пароль. Подсказка выше.', 'demo-net': 'Нет связи с сервером. Попробуйте ещё раз.', 'demo-wait': 'Проверяю…' },
    en: { 'demo-title': 'Try the demo',
      'demo-sub': 'This is a demonstration with a fictional family — there is no personal data here. Enter a password to see what sign-in and the tree look like. The product you buy does not include this page: you get your own tree and your own passwords.',
      'demo-label': 'Password', 'demo-hint': 'Demo passwords:',
      'demo-guest': 'guest: browse, search, print',
      'demo-admin': 'admin: also editing and management',
      'demo-remember': 'Remember me on this device', 'demo-btn': 'Enter the demo',
      'demo-continue': 'You are already signed in — open the tree →',
      'demo-bad': 'Wrong password. See the hint above.', 'demo-net': 'Cannot reach the server. Please try again.', 'demo-wait': 'Checking…' },
    he: { 'demo-title': 'נסו את ההדגמה',
      'demo-sub': 'זוהי הדגמה על משפחה בדיונית — אין כאן נתונים אישיים. הזינו סיסמה כדי לראות איך נראים הכניסה והעץ. במוצר שתרכשו אין עמוד זה: יהיה לכם העץ שלכם והסיסמאות שלכם.',
      'demo-label': 'סיסמה', 'demo-hint': 'סיסמאות להדגמה:',
      'demo-guest': 'אורח: צפייה, חיפוש, הדפסה',
      'demo-admin': 'מנהל: גם עריכה וניהול',
      'demo-remember': 'זכור אותי במכשיר זה', 'demo-btn': 'כניסה להדגמה',
      'demo-continue': 'כבר התחברתם — פתחו את העץ ←',
      'demo-bad': 'סיסמה שגויה. ראו את הרמז למעלה.', 'demo-net': 'אין חיבור לשרת. נסו שוב.', 'demo-wait': 'בודק…' }
  };
  for (var lang in add) { for (var key in add[lang]) { UI[lang][key] = add[lang][key]; } }

  var form = document.getElementById('demo-form');
  var input = document.getElementById('demo-pwd');
  var err = document.getElementById('demo-err');
  var go = document.getElementById('demo-go');
  var cont = document.getElementById('demo-continue');

  Array.prototype.forEach.call(document.querySelectorAll('[data-fill]'), function (b) {
    b.addEventListener('click', function () { input.value = b.getAttribute('data-fill'); input.focus(); });
  });
  try { if (sessionStorage.getItem('tree_pwd')) cont.hidden = false; } catch (e) {}

  function reset() { go.disabled = false; go.textContent = t('demo-btn'); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pwd = input.value;
    if (!pwd) return;
    err.textContent = ''; go.disabled = true; go.textContent = t('demo-wait');
    fetch(API + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) { return { r: r, d: d }; });
    }).then(function (x) {
      if (x.d && x.d.ok) {
        sessionStorage.setItem('tree_pwd', pwd);
        sessionStorage.setItem('tree_role', x.d.role);
        try {
          if (document.getElementById('demo-rem').checked) {
            localStorage.setItem('tree_pwd_saved', pwd);
            localStorage.setItem('tree_role_saved', x.d.role);
          } else {
            localStorage.removeItem('tree_pwd_saved');
            localStorage.removeItem('tree_role_saved');
          }
        } catch (z) {}
        location.replace(TREE_URL);
        return;
      }
      err.textContent = (x.r.status === 401) ? t('demo-bad') : t('demo-net');
      reset();
    }).catch(function () { err.textContent = t('demo-net'); reset(); });
  });
})();
