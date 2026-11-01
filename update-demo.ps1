# update-demo.ps1
# Собирает ДЕМО из закоммиченного main шаблона и выкладывает на Cloudflare Pages.
#   /      — витрина (welcome.html шаблона + блок входа из demo-parts)
#   /tree  — само дерево (index.html шаблона с демо-настройками и startPage='/')
# Запуск:  cd D:\worker_demo ; .\update-demo.ps1
$ErrorActionPreference = 'Stop'
$tpl   = 'D:\worker_model1'
$demo  = 'D:\worker_demo'
$parts = "$demo\demo-parts"
$api   = 'https://family-tree-demo-api.slvm972.workers.dev'
$mail  = 'slvm972@gmail.com'
$u     = New-Object System.Text.UTF8Encoding($false)

foreach ($f in 'login-section.html', 'login.css', 'login.js') {
  if (-not (Test-Path "$parts\$f")) { throw "STOP: нет файла $parts\$f" }
}

# 1. Чистая копия закоммиченного main шаблона
$tmp = Join-Path $env:TEMP 'tpl-main-demo'
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
$zip = Join-Path $env:TEMP 'tpl-main-demo.zip'
git -C $tpl archive main --format=zip -o $zip
if ($LASTEXITCODE) { throw 'STOP: git archive не удался' }
Expand-Archive $zip $tmp
Remove-Item $zip

function Rep1($s, $old, $new, $label) {
  $c = ([regex]::Matches($s, [regex]::Escape($old))).Count
  if ($c -ne 1) { throw "STOP [$label]: найдено $c раз (ожидалось 1)" }
  return $s.Replace($old, $new)
}

# 2. Дерево (tree.html)
$t = [IO.File]::ReadAllText("$tmp\index.html", $u)
if (-not $t.Contains('TREE_CONFIG.startPage')) { throw 'STOP: в main шаблона ещё нет поддержки startPage - сначала влейте ветку start-page-support' }
$t = Rep1 $t "familyNameRu: 'Ваша семья',"                       "familyNameRu: 'Демо-семья',"  'familyNameRu'
$t = Rep1 $t "familyNameEn: 'Your Family',"                       "familyNameEn: 'Demo Family',"  'familyNameEn'
$t = Rep1 $t "familyNameHe: 'המשפחה שלכם',"                       "familyNameHe: 'משפחת הדגמה',"  'familyNameHe'
$t = Rep1 $t "ownerEmail:   'CHANGE_ME@example.com',"             "ownerEmail:   '$mail',"        'ownerEmail'
$t = Rep1 $t "workerUrl:    'https://REPLACE_AFTER_DEPLOY.workers.dev'," "workerUrl:    '$api',"  'workerUrl'
$t = Rep1 $t "fileSlug:     'family',"                            "fileSlug:     'demo',"         'fileSlug'
$t = Rep1 $t "calendarUidDomain: 'family-tree',"                  "calendarUidDomain: 'demo.example'," 'calendarUidDomain'
$t = Rep1 $t "startPage:    '',"                                  "startPage:    '/',"            'startPage'

# 3. Витрина (index.html) = welcome.html шаблона + вход
$w   = [IO.File]::ReadAllText("$tmp\welcome.html", $u)
$css = [IO.File]::ReadAllText("$parts\login.css", $u)
$sec = [IO.File]::ReadAllText("$parts\login-section.html", $u)
$js  = [IO.File]::ReadAllText("$parts\login.js", $u).Replace('__API__', $api)
$w = Rep1 $w '</style>' ($css.TrimEnd() + "`n</style>") 'css'
$w = Rep1 $w '<section class="features" id="features">' ($sec.TrimEnd() + "`n`n" + '<section class="features" id="features">') 'блок входа'
$w = Rep1 $w 'href="https://family-tree-demo.pages.dev" target="_blank" rel="noopener"' 'href="#demo-login"' 'кнопка Живое демо'
$w = Rep1 $w '</body>' ("<script>`n" + $js.TrimEnd() + "`n</script>`n</body>") 'скрипт входа'

# 4. Папка dist: только нужные файлы
$scripts = [regex]::Matches($t, '<script src="([^"]+)"></script>') | ForEach-Object { $_.Groups[1].Value }
foreach ($f in $scripts) { if (-not (Test-Path "$tmp\$f")) { throw "STOP: в архиве нет $f" } }
"скрипты дерева: " + ($scripts -join ', ')
$dist = "$demo\dist"
Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $dist | Out-Null
[IO.File]::WriteAllText("$dist\index.html", $w, $u)
[IO.File]::WriteAllText("$dist\tree.html",  $t, $u)
foreach ($f in $scripts) { Copy-Item "$tmp\$f" "$dist\$f" }
if (Test-Path "$parts\favicon.ico") { Copy-Item "$parts\favicon.ico" "$dist\favicon.ico" }
else { Write-Host 'ВНИМАНИЕ: нет demo-parts\favicon.ico — демо без иконки' -ForegroundColor Yellow }
if (-not ([IO.File]::ReadAllText("$dist\index.html", $u)).Contains('demo-login')) { throw 'STOP: в витрине нет блока входа' }
if (-not ([IO.File]::ReadAllText("$dist\tree.html",  $u)).Contains("startPage:    '/'")) { throw 'STOP: в дереве не включён startPage' }

# 5. Бэкенд: совпадает ли с развёрнутым в демо?
$a = (Get-FileHash "$tmp\src\index.js").Hash
$b = (Get-FileHash "$demo\src\index.js").Hash
if ($a -ne $b) {
  Write-Host 'ВНИМАНИЕ: бэкенд шаблона отличается от развёрнутого в демо. Страницы будут выложены, но Worker надо обновить:' -ForegroundColor Yellow
  Write-Host "  Copy-Item '$tmp\src\index.js' '$demo\src\index.js' -Force ; cd $demo ; npx wrangler deploy" -ForegroundColor Yellow
}

# 6. Деплой страниц
Set-Location $demo
npx wrangler pages deploy dist --project-name family-tree-demo --branch main --commit-dirty=true
if ($LASTEXITCODE) { throw 'STOP: деплой страниц не удался' }
Write-Host 'OK: демо обновлено: https://family-tree-demo.pages.dev  (дерево: /tree)' -ForegroundColor Green
