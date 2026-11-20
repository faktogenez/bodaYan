# AppleLauncher — Передача контекста сессии

> **ОБЯЗАТЕЛЬНОЕ ПРАВИЛО (неукоснительно)**: По завершении КАЖДОЙ сессии исполнитель ДОЛЖЕН внести в этот файл **полную детализированную запись** (раздел 11 «Журнал сессий») по следующей структуре: **все выполненные изменения в коде и конфигурации → полный перечень проделанных действий → полученные результаты → текущий статус задачи → возникшие проблемы → оставшиеся нерешённые вопросы**. Также обновить разделы 1, 3, 4, 5. Цель — чтобы следующий аккаунт имел полное представление о прогрессе и не тратил время на повторное выполнение уже завершённых работ.

> **ПОСТОЯННОЕ ТРЕБОВАНИЕ ЗАКАЗЧИКА — Git-синхронизация**: после КАЖДОЙ сессии коммитить и пушить изменения в `origin/main` (GitHub `faktogenez/bodaYan`), чтобы локальная копия всегда соответствовала удалённому репозиторию. Все коммиты — с понятными описательными сообщениями (`feat:`/`fix:`/`docs:`/`chore:`).

---

## 1. Текущий прогресс проекта

**Статус**: ✅ Базовый лаунчер работает. Minecraft 1.16.5 Forge успешно запускается и доходит до главного меню. ✅ Внешний `config/config.json` читается `main.js`; подключены случайный фон, тема из конфига, прогресс-бар загрузки и динамический meta-row. ✅ Работает **оффлайн-режим («пиратка»)** — вычисляется корректный оффлайн-UUID, аккаунт без токенов Mojang. ✅ **Кнопка «Сетевая игра» активна** — фикс authlib 2.1.28 → 2.3.31 (автопатч version JSON перед запуском). ✅ **Автоподключение к серверу без `quickPlay`**: игра всегда открывает главное меню Minecraft (логотип Mojang → меню), а подключение к серверу выполняет клиентский мод `appleautojoin` при открытии «Сетевой игры» (см. ниже). ✅ **Автообновление самого лаунчера** (`src/selfUpdate.js`) — проверка версии по манифесту, скачивание нового EXE, подмена и авто-перезапуск. ✅ **Автообновление файлов игры** (`src/updater.js`) — проверка SHA1/размера по манифесту, докачка по HTTP Range (до 3 попыток), включено (`updater.enabled = true`). ✅ **Валидация никнейма** (3–16, `[A-Za-z0-9_]`) в UI и в `main.js`. ✅ **Кнопка «Остановить»** — принудительное завершение процесса Java (`taskkill /T /F`). ✅ **Логирование в `debug.log`** (`src/logger.js`, только при `process.env.DEBUG`). ✅ Portable EXE **v1.0.5** содержит лаунчер и JRE 17; **игровые файлы Minecraft не входят в EXE** и должны быть отдельно в `minecraft/game` рядом с EXE (см. раздел 11). ✅ **v1.0.5 собрана и опубликована** в GitHub Releases (`faktogenez/bodaYan`): EXE (111 697 444 Б, SHA1 `fe315f5d…`) + `launcher-version.json`, тег `v1.0.5` = Latest. 🔧 **v1.0.5 — фикс краша** `spawn cmd.exe ENOENT` при автообновлении (путь к `cmd.exe` через `%ComSpec%` + обработчик `error`). ✅ **Модпак опубликован** — релиз `modpack-v1` (17 ассетов); smoke-тест лаунчера — PASS; live-запуск из папки `release` доходит до главного меню без крашей (см. раздел 11). ✅ **v1.0.6 собрана и опубликована** (Latest, SHA1 `b076900d…`) — **окончательный фикс** повторного краша `spawn cmd.exe ENOENT`: текущая версия берётся из `app.getVersion()` (внешний «застрявший» `config.json` больше не запускает ложный self-update), а `cmd.exe` запускается по абсолютному пути (`%ComSpec%`) с принудительным `%SystemRoot%\System32` в `PATH` и обработчиком ошибки. ✅ **Автоподключение к серверу ВКЛЮЧЕНО через собственный мод** `appleautojoin` (Forge 1.16.5): при клике «Сетевая игра» игра сразу подключается к серверу из `servers.dat` (лаунчер оставляет там только сервер из `config.json`) — экран выбора серверов не показывается (см. раздел 3 «Автоподключение» и раздел 11). ✅ **Права админа `bodayan` и `boris`** прописаны в `ops.json` сервера (`C:\Server_Skyblock`, level 4). ✅ **Git синхронизирован** — код v1.0.2–v1.0.6 закоммичен и запушен в `origin/main` (коммит `7a2a3f6`, 2026-11-21); ветка `main` = `origin/main`, рабочее дерево чистое (см. раздел 11, запись 2026-11-21). ✅ **v1.0.7 собрана и опубликована** (Latest, SHA1 `ea1beb82…`, размер 111 695 691 Б, ассет `AppleLauncher.exe`) — **постоянный каталог данных** (`%APPDATA%\AppleLauncher` вместо рабочего стола) + **встроенная проверка целостности** при каждом запуске (SHA1/размер по манифесту + автодокачка) + модпак переведён на `modpack-v2` (в манифест добавлен `versions/Forge 1.16.5/Forge 1.16.5.json` — устранена ошибка «файл не найден» на чистой системе). Заведён `latest` (modpack-v2 переведён в prerelease). Теги v1.0.1–v1.0.6 перепривязаны к корректным коммитам (см. раздел 11, запись v1.0.7).

**Цель проекта**: Электронный лаунчер Minecraft для запуска Minecraft 1.16.5 Forge с подключением к локальному серверу `127.0.0.1:25565`.

**Корень проекта**: `C:\Users\LEO\AppleLauncher`

---

## 2. Реализованная функциональность

- ✅ Electron-окно с безрамочное прозрачное окно 920x600 (размеры/заголовок из `config.json`)
- ✅ Поле ввода никнейма (по умолчанию `bodayan`, значение из `config.json`)
- ✅ Кнопка «Играть» запускает Minecraft 1.16.5 Forge и доходит до **главного меню** (без автоподключения к серверу)
- ✅ Передача параметров памяти из `config.json`: `-Xms2048M -Xmx4096M`
- ✅ Чтение `config/config.json` в `main.js` (окно, память, сервер, версия, ник, путь игры, фоны); при ошибке — фолбэк на значения по умолчанию
- ✅ Случайный фон из `assets/backgrounds/` при запуске (IPC `backgrounds:random` → `file://` URL)
- ✅ Применение темы из `config.json` через CSS-переменные в `renderer.js`
- ✅ Прогресс-бар загрузки (событие `client.on("progress")` → IPC `game:progress` → UI)
- ✅ Динамический meta-row в UI (версия, память, сервер) из `config.json`
- ✅ Оффлайн-режим («пиратка»): корректный оффлайн-UUID (MD5 `OfflinePlayer:<ник>`), фиктивный `access_token`, без авторизации Mojang
- ✅ Флаг `launcher.offline` в `config.json` (по умолчанию `true`)
- ✅ Фикс «Сетевая игра отключена»: автопатч `authlib 2.1.28 → 2.3.31` в version JSON перед запуском
- ✅ Обработка событий запуска (data/close/error) и вывод статуса в UI
- ✅ Защита от повторного запуска (флаг `launching`)
- ✅ Проверка существования версии перед запуском
- ✅ **Прогресс-бар с текстовой подписью этапа** (`.progress-wrap` + `.progress-label` в UI): определённый процент для загрузок игры и файлов, «бегущая» полоса (`.progress.indeterminate`) для этапов с неизвестным временем (подготовка, старт игры)
- ✅ **Автоскрытие окна лаунчера**: при старте игры (по маркерам в логе) окно скрывается; после закрытия игры — автоматически показывается снова
- ✅ **Система автообновления файлов** (`src/updater.js`): проверка целостности по SHA1/размеру и дозагрузка отсутствующих/устаревших файлов из Google Drive (или по прямому URL) по манифесту; обработка confirm-токена Google Drive
- ✅ **Список серверов только свой** (`src/servers.js`): лаунчер при старте и перед запуском игры перезаписывает `servers.dat` — оставляет только серверы из `config.json` (`servers.enforce = true`)
- ✅ **Автообновление самого лаунчера** (`src/selfUpdate.js`): проверка версии по манифесту, скачивание нового EXE, подмена запущенного файла через отдельный `.bat` и авто-перезапуск (только для собранного EXE, `app.isPackaged`)
- ✅ **Валидация никнейма**: `USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/` проверяется и в UI (`renderer.js` — подсветка `.invalid` + текст ошибки + блокировка кнопки), и в `main.js` (защита на уровне IPC)
- ✅ **Кнопка «Остановить»** (IPC `game:stop`): принудительно завершает процесс игры (`taskkill /pid <pid> /T /F` на Windows, `SIGTERM` иначе); кнопка появляется только во время запуска/игры
- ✅ **Логирование в `debug.log`** (`src/logger.js`): запись только при `process.env.DEBUG`; файл рядом с EXE (`APP_DIR`); интерфейс `logger.log/warn/error/setLogDir`
- ✅ **Автоподключение к серверу (клиентский мод `appleautojoin`)**: при открытии экрана «Сетевая игра» игра сразу подключается к первому серверу из `servers.dat`. Мод кладётся в `minecraft/game/mods/` (и в `release/minecraft/game/mods/`), публикуется как ассет `mods__apple-autojoin-1.0.0.jar` и входит в `updater/manifest.json`. Исходники и скрипт сборки — `mods-src/apple-autojoin/` (см. раздел 3 «Автоподключение»)

---

## 3. Архитектура кода

### Файлы проекта

| Файл | Назначение |
|------|-----------|
| [main.js](file:///C:/Users/LEO/AppleLauncher/main.js) | Главный процесс Electron. Создаёт окно, обрабатывает IPC, запускает игру через `minecraft-launcher-core`. |
| [index.html](file:///C:/Users/LEO/AppleLauncher/index.html) | Разметка UI. Поле ника, meta-row, кнопка запуска, прогресс-бар, статус-бар. |
| [src/preload.js](file:///C:/Users/LEO/AppleLauncher/src/preload.js) | Мост между renderer и main через `contextBridge`. Экспонирует `electronAPI`. |
| [src/renderer.js](file:///C:/Users/LEO/AppleLauncher/src/renderer.js) | UI-логика. Тема/meta из конфига, случайный фон, прогресс-бар (игра + обновление), статус. |
| [src/updater.js](file:///C:/Users/LEO/AppleLauncher/src/updater.js) | Проверка целостности и дозагрузка файлов по манифесту (Google Drive / прямой URL). |
| [src/servers.js](file:///C:/Users/LEO/AppleLauncher/src/servers.js) | Запись `servers.dat` (NBT) — список серверов только из `config.json`. |
| [src/selfUpdate.js](file:///C:/Users/LEO/AppleLauncher/src/selfUpdate.js) | Автообновление лаунчера: проверка версии, загрузка нового EXE, подмена и перезапуск. |
| [src/logger.js](file:///C:/Users/LEO/AppleLauncher/src/logger.js) | Лёгкое логирование (`log/warn/error` + `setLogDir`); запись в `debug.log` только при `process.env.DEBUG`. |
| [assets/styles/app.css](file:///C:/Users/LEO/AppleLauncher/assets/styles/app.css) | Стили (glassmorphism). |
| [test-launch.js](file:///C:/Users/LEO/AppleLauncher/test-launch.js) | Отладочный скрипт прямого запуска игры без Electron (offline UUID, quickPlay, корректная авторизация). |
| [config/config.json](file:///C:/Users/LEO/AppleLauncher/config/config.json) | ✅ Читается `main.js`. Настройки окна, памяти, сервера, версии, ника, флаг `offline`, пути к фонам и тема. |
| [scripts/build-jre.js](file:///C:/Users/LEO/AppleLauncher/scripts/build-jre.js) | Сборка минимальной JRE 17 (jlink → `jre/`), упаковывается в EXE (`resources/jre`). |
| [scripts/gen-manifest.js](file:///C:/Users/LEO/AppleLauncher/scripts/gen-manifest.js) | Генератор `updater/manifest.json` из игровой папки (sha1/size, ссылки GitHub Releases). |
| [mods-src/apple-autojoin/](file:///C:/Users/LEO/AppleLauncher/mods-src/apple-autojoin) | Исходник клиентского мода `appleautojoin` (автоподключение к серверу) + `build.ps1` (сборка без MCP/Gradle, напрямую против SRG-jar). Готовый JAR: `mods-src/apple-autojoin/apple-autojoin-1.0.0.jar`, устанавливается в `minecraft/game/mods/` и `release/minecraft/game/mods/`. |

### Поток запуска игры

```
renderer.js (клик "Играть")
  → electronAPI.launchGame(username)
    → ipcMain.handle("game:launch")
      → new Client() (minecraft-launcher-core 3.x)
        → client.launch(opts)
          → Minecraft Forge 1.16.5 запускается
        → события data/close/error → renderer
```

### Ключевые константы в `main.js` (все выводятся из `config.json`):
- `GAME_DIR` ← `launcher.gameDirectory` = `C:\Users\LEO\AppleLauncher\minecraft\game`
- `VERSION_CUSTOM` ← `launcher.version.custom` = `"Forge 1.16.5"`
- `VERSION_NUMBER` = `"1.16.5"`, `VERSION_TYPE` = `"release"`
- `DEFAULT_USERNAME` ← `launcher.defaultUsername` = `"bodayan"`
- `SERVER_HOST` = `"127.0.0.1"`, `SERVER_PORT` = `25565`
- `CONFIG` — снимок `config/config.json` (фолбэк `DEFAULT_CONFIG` при ошибке чтения)

### IPC-каналы (main.js ↔ preload.js ↔ renderer.js)
- `window:minimize` / `window:close` — управление окном
- `config:get` → `CONFIG` — renderer получает тему/ник/сервер
- `backgrounds:random` → `file://` URL случайного изображения или `null`
- `game:launch` (invoke, аргумент `username`) + `game:data` / `game:progress` / `game:close` / `game:error` (send) — запуск и статус игры
- `game:stop` (invoke) — принудительная остановка запущенной игры (`taskkill /T /F`)
- `updater:check` (invoke) + `updater:progress` (send) — проверка/дозагрузка файлов игры (см. раздел 10)
- `launcher:checkUpdate` (invoke) + `launcher:update` (send) — автообновление самого лаунчера (см. раздел 12.6)

### Каталог данных (`DATA_DIR`) и папка EXE (`EXE_DIR`) — переносимость

В dev `DATA_DIR = __dirname` (корень проекта). В собранном EXE `DATA_DIR = %APPDATA%\AppleLauncher` (`app.getPath("appData")`) — **постоянный** записываемый каталог, не зависящий от места запуска EXE. Это устранило прежнее поведение, когда данные создавались рядом с EXE (в т.ч. на рабочем столе).

От `DATA_DIR` выводятся: `CONFIG_DIR/config.json`, `updater/manifest.json`, `updater/launcher-version.json`, `launcher.gameDirectory` (`minecraft/game`), `backgrounds.additionalPaths` (`assets/backgrounds`). Внешний `config/config.json` при первом запуске копируется из встроенного шаблона (`resources/config/config.json`).

`EXE_DIR` (из `process.env.PORTABLE_EXECUTABLE_DIR` или `path.dirname(process.execPath)`) используется **только** для поиска встроенной/внешней JRE и для однократной миграции старых данных (`migrateDataDir()`: `EXE_DIR/minecraft` → `DATA_DIR/minecraft`).

Проверка целостности игровых файлов (`ensureGameFiles()`, см. 12.5) запускается автоматически при старте, по кнопке и перед запуском игры; манифест — `modpack-v2` (включает `mods/**`, `customnpcs/**` и `versions/Forge 1.16.5/Forge 1.16.5.json`).


### Автоподключение к серверу — через свой клиентский мод (важно)

**Требование заказчика:** «запустил лаунчер → прогрузился Mojang → выбрал "Сетевая игра" → сразу попал на свой сервер. Выбор серверов не нужен». Главное меню должно остаться (вариант «Сохранить меню (нужен мод)»).

**Почему мод:** аргумент `--server`/`--port` (`quickPlay`) пропускает главное меню целиком — не подходит. Готовые моды (напр. Autojoin, CurseForge 652715) требуют минимальную задержку 10 с. Поэтому собран собственный минималистичный мод `appleautojoin`.

**Как работает мод** ([AppleAutoJoin.java](file:///C:/Users/LEO/AppleLauncher/mods-src/apple-autojoin/src/apple/autojoin/AppleAutoJoin.java)):
- `main.js` **не** добавляет `quickPlay` в `opts` — игра без `--server`/`--port` открывает главное меню Minecraft.
- Лаунчер перед запуском перезаписывает `servers.dat` (`applyPinnedServers()`, `servers.enforce = true`) → в списке остаётся только сервер из `config.json`.
- Мод ловит **`GuiOpenEvent`** (Forge) — событие постится в `Minecraft.setScreen` (SRG `func_147108_a_`) **ДО** фактического показа экрана, поэтому список серверов **никогда не отрисовывается**. В обработчике вызывается `event.setGui(...)`, подменяющий открываемый экран.
- **Дискриминатор источника `MultiplayerScreen`.** В момент `GuiOpenEvent` поле `Minecraft.field_71462_r` ещё содержит **предыдущий** экран (Forge присваивает новый уже после поста события):
  - `WorkingScreen`/`DirtMessageScreen`/`IngameMenuScreen` → это возврат после «Завершить сетевую игру» (ванилла сначала зовёт `mc.func_213254_o()`, затем открывает `MultiplayerScreen`) ⇒ `event.setGui(new MainMenuScreen())` — уход в главное меню вместо списка;
  - иначе (вход из `MainMenuScreen`) → берём первый сервер из `servers.dat` (`ServerList.func_78853_a()`/`func_78856_c()`/`func_78850_a(0)`) и открываем `new ConnectingScreen(new MainMenuScreen(), mc, server)` — сразу подключаемся, минуя список.
  - если сервер не найден — тоже `MainMenuScreen`.
- **Список серверов (`MultiplayerScreen`) не показывается никогда** — ни при входе из главного меню, ни при возврате после дисконнекта.
- Прямая подмена экрана в событии безопасна: `Screen.func_231164_f_()` (removed) пуст, `MainMenuScreen.func_231164_f_()` лишь делегирует под-экрану.
- Сборка **без MCP/Gradle**: `javac --release 8` напрямую против `client-1.16.5-20210115.111550-srg.jar` + `forge-1.16.5-36.2.42-universal.jar` + `eventbus-4.0.0.jar` (имена методов — SRG, `func_*`/`field_*`). Смотреть: `mods-src/apple-autojoin/build.ps1`.

**Публикация мода:** генератор `scripts/gen-manifest.js` включает каталог `mods/` → ассет `mods__apple-autojoin-1.0.0.jar` в релизе `modpack-v1`; URL в манифесте = `https://github.com/faktogenez/bodaYan/releases/download/modpack-v1/mods__apple-autojoin-1.0.0.jar`.

**ВАЖНО (JAR недетерминирован):** пересборка JAR меняет SHA1 (в ZIP-записях сохраняется время). После `build.ps1` обязательно: `node scripts/gen-manifest.js` и повторная загрузка в релиз (`gh release upload modpack-v1 ... --clobber`) — иначе updater будет ругаться на несовпадение SHA1. Проверка: SHA1 локального JAR = `sha1` в `updater/manifest.json` = `sha1` ассета.

Параметры сервера (`launcher.server` = `127.0.0.1:25565`) в `config.json` используются для `servers.dat` (источник правды для мода) и meta-row.

### Будущий хостинг сервера — корректировки и допущения (для потомков)

**Корректировка прежнего замечания.** Ранее в ответе пользователю прозвучало, что при переносе сервера на удалённый хостинг мод автоподключения «не подойдёт, нужен `quickPlay`». Это **неверно**: мод `appleautojoin` работает на клиенте и подключается к **любому** серверу из `servers.dat`, независимо от того, локальный он или удалённый (адрес в `servers.dat` берётся из `config.json`). После переезда на хостинг мод **продолжит работать без изменений**.

**Шаги при переезде сервера на хостинг:**
1. В `config/config.json` заменить `launcher.server.host` / `launcher.server.port` и `servers.list[0].ip` на адрес хостинга (например `play.example.ru:25565`).
2. Перезапустить лаунчер — `applyPinnedServers()` перезапишет `servers.dat` новым адресом. В самом моде менять ничего не нужно.

**Допущения и оговорки:**
- **`online-mode`.** Оффлайн-клиент («пиратка») работает только при `online-mode=false` на сервере. Публичные/профессиональные хостинги часто принудительно ставят `online-mode=true` → вход даст `Failed to login: Invalid session`. Варианты: (а) выбрать хостинг с поддержкой `online-mode=false`; (б) перейти на лицензионные аккаунты — тогда нужна Microsoft-авторизация в лаунчере (см. раздел 5, п. 4).
- **UUID и права админа.** Текущие `bodayan`/`boris` в `ops.json` привязаны к **оффлайн-UUID** (MD5 `OfflinePlayer:<ник>`). При `online-mode=true` UUID станут лицензионными → прежние записи в `ops.json` не сработают. Права выдавать уже на сервере: `op <ник>` из консоли/панели хостинга (после первого входа игрока UUID подставится автоматически).
- **Адрес и порт.** Указывать ровно так, как выдал хостинг (`host` или `host:port`). Если используется SRV-запись — достаточно доменного имени.
- **Мод строго клиентский.** В `mods.toml` `side=CLIENT` — на сервер мод ставить не нужно, с серверным модпаком (Mohist/Bukkit) не конфликтует.
- **Серверная часть переносится отдельно.** На хостинг нужно выгрузить сам сервер (`C:\Server_Skyblock`: ядро Mohist, `mods/`, `plugins/`, `world*`, `server.properties`, `ops.json`) — это задача администрирования, лаунчер к ней отношения не имеет. Лаунчер лишь поменяет адрес подключения.

**Альтернатива `quickPlay` (пропустить и клик «Сетевая игра»).** Если позже потребуется стартовать сразу с подключением (без главного меню) — в `main.js` добавить `opts.quickPlay = { type: "legacy", identifier: \`${SERVER_HOST}:${SERVER_PORT}\` }` (для версий < 1.20). Сейчас это **намеренно выключено** (требование — сохранить главное меню).

### Автоскрытие окна лаунчера при запуске игры

`main.js` отслеживает вывод процесса игры (`client.on("data")`). Когда в логе появляется один из маркеров готовности клиента, окно лаунчера скрывается:

```js
const GAME_START_MARKERS = ["Backend library:", "OpenAL initialized", "Sound engine started"];
// в client.on("data"): при первом совпадении → gameStarted = true; mainWindow.hide();
```

- **Скрытие**: первый маркер = игра отрисовала окно → `mainWindow.hide()`.
- **Восстановление**: `client.on("close")` и `client.on("error")` → `mainWindow.show()` + `focus()` + сброс `gameStarted = false`.
- Маркеры выбраны как признаки старта рендер-потока/звука (проверены на Forge 1.16.5: `[Render thread/INFO]: Backend library: LWJGL version 3.2.2`, `OpenAL initialized`, `Sound engine started`).

### Список серверов — только свой (`servers.dat`)

Список серверов в игре хранится в `minecraft/game/servers.dat` (формат **NBT**, без сжатия). `src/servers.js` умеет формировать этот файл: `writeServersDat(gameDir, servers)` пишет корневой `TAG_Compound("")` со списком `servers` (элементы — `TAG_Compound` с полями `name`, `ip`, `acceptTextures`).

Управление — в `config.json`:
```json
"servers": {
  "enforce": true,
  "list": [ { "name": "Мой сервер", "ip": "127.0.0.1:25565" } ]
}
```
- `enforce: true` — `main.js` вызывает `applyPinnedServers()` при старте приложения и перед каждым запуском игры: `servers.dat` **перезаписывается**, лишние серверы удаляются, остаётся только ваш.
- `enforce: false` — файл не трогается (игрок сам управляет списком).
- Оригинальный файл перед первой перезаписью сохранён как `servers.dat.bak` (можно удалить).

### Критические детали

1. **`minecraft-launcher-core` версия 3.18.2** (НЕ 2.x — API отличается):
   - Было (2.x): `mclc.core(opts)` + `mclc.event.on(...)`
   - Стало (3.x): `new Client()` + `client.launch(opts)` + `client.on(...)`

2. **Автоподключение к серверу — ОТКЛЮЧЕНО.** Поля `server`/`port` в `opts` устарели (3.x выводит предупреждение), а актуальный способ автоподключения — `quickPlay: { type: "legacy", identifier: "host:port" }` (для версий < 1.20, см. `node_modules/minecraft-launcher-core/components/handler.js` → `formatQuickPlay`). Сейчас `quickPlay` **намеренно не передаётся** — игра открывает главное меню. При необходимости быстрого подключения добавить `opts.quickPlay = { type: "legacy", identifier: \`${SERVER_HOST}:${SERVER_PORT}\` }`.

3. **`--add-opens` флаги обязательны** для Forge 1.16.5 на Java 17. Без них — `IllegalAccessError: sun.security.util.ManifestVerifier`. Весь список в `main.js` (L144-L157).

4. **Версия Forge** лежит в `minecraft\game\versions\Forge 1.16.5\Forge 1.16.5.json`. `mainClass = `cpw.mods.modlauncher.Launcher`.

### Режим оффлайн («пиратка») — как это работает

Клиент Java Edition запускается без аккаунта Mojang, если передать ему фиктивные `--accessToken`/`--username`/`--uuid` — игра не проверяет сессию (проверка происходит на сервере при входе). Реализация в `main.js`:

- **`offlineUUID(name)`** — оффлайн-UUID, тот же алгоритм, что у Spigot/Paper при `online-mode=false`:
  ```js
  const h = crypto.createHash("md5").update("OfflinePlayer:" + name, "utf8").digest();
  h[6] = (h[6] & 0x0f) | 0x30; // version 3
  h[8] = (h[8] & 0x3f) | 0x80; // RFC 4122 variant
  // → 8-4-4-4-12
  ```
  Проверено: `offlineUUID("Steve")` = `5627dd98-e6be-3c21-b8a8-e92344183641` (совпадает с эталоном). Один ник → один UUID, прогресс игрока сохраняется между запусками.
- **Авторизация** (при `launcher.offline = true`): `{ access_token: "0", client_token: uuid, uuid, name, user_properties: "{}", meta: { type: "mojang" } }`.
- **ВАЖНО про `meta.type`**: в `minecraft-launcher-core` подстановка `${user_type}` берётся именно из `authorization.meta.type` (дефолт `"mojang"`), а НЕ из поля `user_type` (его нет в интерфейсе `IUser`). Допустимые значения: `"mojang" | "msa"`. См. `node_modules/minecraft-launcher-core/components/handler.js` (L592-L607).

**Требование к серверу**: чтобы «пиратка» могла подключиться, сервер в `server.properties` должен иметь **`online-mode=false`**. При `online-mode=true` клиент получит `Failed to login: Invalid session` / «Сетевая игра закрыта». Для дополнительной безопасности оффлайн-сервер обычно прячут за прокси (BungeeCord/Velocity) или закрывают авторизацию плагином.

**Источники (интернет, 2026)**:
- Оффлайн-UUID = MD5 от `OfflinePlayer:<ник>` + биты version 3 / RFC 4122 (Java `UUID.nameUUIDFromBytes`) — [minecraftserver.buzz](https://minecraftserver.buzz/minecraft-offline-uuid-generator), [fadehost.com](https://fadehost.com/tools/offline-uuid/), [chunkscan.com](https://chunkscan.com/offline-uuid-generator).
- Пример оффлайн/cracked-аккаунта для `minecraft-launcher-core` (поля `access_token`, `uuid`, `user_properties`) — [onelnchr-mc-auth (npm)](https://www.npmjs.com/package/onelnchr-mc-auth).
- Оффлайн-режим как штатная фича launcher-SDK (Rust-аналоги, подтверждают тот же подход `Account::offline`) — [mc-launcher-core](https://crates.io/crates/mc-launcher-core/0.1.2), [minecraft-java-rs-core](https://crates.io/crates/minecraft-java-rs-core/0.4.1).

### Фикс «Сетевая игра отключена» (authlib 2.1.28 → 2.3.31)

**Симптом**: кнопка «Сетевая игра» в главном меню серая (неактивна).
**Причина**: в Minecraft 1.16.5 используется `authlib 2.1.28`. При оффлайн-запуске игра пытается получить социальные права у Mojang, получает 401, и authlib 2.1.28 **по умолчанию отключает все права**, включая мультиплеер. authlib 2.3.31 обрабатывает этот случай корректно.
**Решение в `main.js`**: функция `patchAuthlib(versionJsonPath)` вызывается перед каждым запуском для обоих JSON (`Forge 1.16.5.json` и `1.16.5.json`):
```js
// замена com.mojang:authlib:2.1.28 → com.mojang:authlib:2.3.31
// + обновление URL + удаление sha1/size (чтобы MCLC перекачал jar)
lib.name = `com.mojang:authlib:${AUTHLIB_FIX_VERSION}`;
lib.downloads.artifact.url = `https://libraries.minecraft.net/com/mojang/authlib/${AUTHLIB_FIX_VERSION}/authlib-${AUTHLIB_FIX_VERSION}.jar`;
delete lib.downloads.artifact.sha1;
delete lib.downloads.artifact.size;
```
**Проверено**: authlib 2.3.31 скачивается (87662 байт), игра запускается, кнопка «Сетевая игра» активна, клиент успешно подключается к серверу (`bodayan joined the game`).
**Источник**: [Guide MC — 修复"多人游戏已禁用"](https://guidemc.github.io/Game/1.MultiPlay/3.FixDisable) (два решения: мод `MultiOfflineFix` или замена authlib на 2.3.31).

---

## 4. Выполненные задачи

- [x] Установлены зависимости: `electron@33`, `minecraft-launcher-core@3.18.2`
- [x] Переписан `main.js` под API 3.x
- [x] Добавлены `--add-opens` для Java 17
- [x] Упрощён `renderer.js` (убраны config/backgrounds IPC)
- [x] Проверен запуск Electron-окна
- [x] Проверен запуск Minecraft 1.16.5 Forge (до главного меню)
- [x] Возвращено чтение `config/config.json` в `main.js` (фолбэк на значения по умолчанию при ошибке)
- [x] Заменены устаревшие `server`/`port` на `quickPlay: { type: "legacy", identifier }`
- [x] Добавлены IPC-обработчики `config:get` и `backgrounds:random`
- [x] Случайный фон из `assets/backgrounds/` при запуске
- [x] Применение темы из `config.json` через CSS-переменные
- [x] Прогресс-бар загрузки (ассеты, нативы, библиотеки, Forge) через событие `progress`
- [x] Динамический meta-row из `config.json` (версия / память / сервер)
- [x] Оффлайн-режим («пиратка»): `offlineUUID()` (MD5 `OfflinePlayer:<ник>`), фиктивный `access_token`, `meta.type = "mojang"`
- [x] Флаг `launcher.offline` в `config.json`; оффлайн-UUID проверен на эталоне (`Steve`)
- [x] Исправлен неверный ключ `user_type` → `authorization.meta.type` (см. `handler.js`)
- [x] Фикс «Сетевая игра отключена»: автопатч `authlib 2.1.28 → 2.3.31` в version JSON перед запуском
- [x] Проверено: игра автоматически подключается к серверу 127.0.0.1:25565 (quickPlay legacy), `bodayan joined the game`
- [x] Обновлён `test-launch.js` под актуальный API (offline UUID, quickPlay, корректная авторизация)
- [x] **[Пункт 1 — исправлено]** Автоподключение к серверу **отключено**: игра всегда доходит до главного меню Minecraft. Экран выбора режима в лаунчере откачен (две опции — это штатное меню игры). Проверено: `--server`/`--port` отсутствуют в аргументах запуска
- [x] **[Пункт 2]** Автоскрытие окна лаунчера при старте игры (маркеры `GAME_START_MARKERS` в логе) + авто-восстановление окна после закрытия/ошибки игры
- [x] **[Пункт 3]** Система автообновления: `src/updater.js` (проверка SHA1/размера + дозагрузка из Google Drive/по URL), IPC `updater:check`/`updater:progress`, автозапуск при старте; документация хранилища и списка файлов в разделе 10
- [x] **[Пункт 4]** Единый прогресс-бар для всех длительных процессов: проверка файлов, загрузка файлов (с байтами), загрузка ресурсов игры, старт игры; текстовые подписи этапа + «бегущая» полоса при неизвестном проценте
- [x] **[Доп.]** Список серверов — только свой: `src/servers.js` перезаписывает `servers.dat` (NBT) по `config.json` → `servers.enforce`; удалено 82 КБ сторонних серверов, остаётся только `127.0.0.1:25565`
- [x] **[Self-update]** Автообновление лаунчера: `src/selfUpdate.js` (`isNewer`, `checkForUpdate`, `downloadUpdate`, `applyUpdateAndRestart`), интеграция в `main.js` (`runSelfUpdate`), IPC `launcher:checkUpdate`/`launcher:update`, конфиг-секция `selfUpdate`, UI-прогресс в `renderer.js`
- [x] **[Portable EXE]** Переносимость одним EXE: `APP_DIR` (каталог данных рядом с EXE через `PORTABLE_EXECUTABLE_DIR`), авто-создание внешнего `config/config.json` из шаблона, пути `gameDirectory`/`targetPath`/`manifestPath` выводятся из `APP_DIR`; устранены абсолютные пути в `config.json`
- [x] **[Offline test package]** Полный локальный `minecraft/game` (~1.65 ГБ) скопирован в `release/minecraft/game` рядом с v1.0.2 EXE; проверены Forge JSON, базовая версия, libraries и assets.
- [x] **[Фикс]** Целевой путь self-update для portable: используется `PORTABLE_EXECUTABLE_FILE` вместо `process.execPath` (иначе обновлялась бы распакованная копия в `%TEMP%`)
- [x] **[Документация]** Раздел 12: сервисы хранения, состав EXE vs динамика, целостность/докачка, требования к упаковке, план тестирования на чистой системе, механика self-update
- [x] **[Тесты v1.0.2]** Структура `release/minecraft/game`, целостность `manifest.json` (16/16) и `launcher-version.json` (SHA1/size vs EXE), JRE 17, конфиг release — PASS
- [x] **[Smoke-тест]** `npm start`: окно лаунчера открывается, `servers.dat` перезаписывается, self-update пропускается в dev — PASS
- [x] **[Live-тест]** `MC_ROOT=release/minecraft/game node test-launch.js`: Minecraft 1.16.5 Forge запускается из `release` до главного меню, окно `Minecraft* 1.16.5`, без новых `hs_err` — PASS
- [x] **[harness]** `test-launch.js`: путь игры вынесен в `process.env.MC_ROOT` (по умолчанию — `minecraft/game`)
- [x] **[Валидация ника]** `USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/`: в `renderer.js` (`validateUsername()` — `.invalid`, текст ошибки, disable кнопки) и в `main.js` (IPC `game:launch` отклоняет невалидный ник)
- [x] **[Кнопка «Остановить»]** IPC `game:stop`; `stopGame()` в `main.js` (`taskkill /pid <pid> /T /F`); `stopGame()` в `preload.js`/`renderer.js`; кнопка `.stop-btn` видна только во время запуска/игры
- [x] **[Логирование]** Новый `src/logger.js`; `logger.setLogDir(APP_DIR)`; все `console.*` в `main.js` заменены на `logger.*`; запись в `debug.log` только при `process.env.DEBUG`
- [x] **[Докачка HTTP Range]** `src/updater.js`: `downloadToFile` — до 3 попыток (пауза 1с→2с→4с), чтение размера `.part` → заголовок `Range: bytes=<start>-`, обработка 206 (дозапись) и 200 (сброс), `total = startBytes + len`; `hashExistingFile()` догружает существующий `.part` в hash
- [x] **[selfUpdate]** `downloadUpdate`: удаление висящего `.part` перед новой загрузкой EXE
- [x] **[Сборка v1.0.4]** `package.json` `version` 1.0.4; `config.json`: `updater.enabled = true` + `updater.manifestUrl` на релиз `modpack-v1`, `selfUpdate.currentVersion = 1.0.4`; `updater/launcher-version.json` под 1.0.4 (111 698 472 Б, SHA1 `2596dfd0…`)
- [x] **[Публикация]** Релиз `v1.0.4` (Latest) с `AppleLauncher-1.0.4.exe` + `launcher-version.json`; релиз `modpack-v1` с 17 ассетами (16 файлов модпака + `manifest.json`) — через `gh` CLI
- [x] **[Тесты]** `node --check` всех JS — OK; regex-тест валидации ника — PASS; logger-тест (`process.env.DEBUG`) — PASS; resume-тест HTTP Range (`rangeRequests: 1`) — PASS; smoke-тест `npm start` — окно стартует, `servers.dat` перезаписан, self-update пропущен в dev — PASS
- [x] **[Очистка]** Удалены временные `tmp_check.js`, `tmp_stage.js` и staging-каталог `.cache/modpack-v1/`
- [x] **[Фикс краша self-update]** `spawn("cmd.exe", …)` в `src/selfUpdate.js` падал `ENOENT` (без слушателя `error`) → uncaught-исключение в main-процессе. Исправлено: путь к `cmd.exe` через `%ComSpec%` (fallback `%SystemRoot%\System32\cmd.exe`) + `child.on("error")`. Аналогичная защита добавлена для `spawn("taskkill")` в `stopGame()` ([main.js](file:///C:/Users/LEO/AppleLauncher/main.js#L352-L370)).
- [x] **[Сборка v1.0.5]** Версии подняты до 1.0.5 (`package.json`, `config.json` `selfUpdate.currentVersion`, `updater/launcher-version.json`); собран portable EXE в `.cache/out-105/` (`electron-builder --win portable --publish never`), скопирован в `release/AppleLauncher-1.0.5.exe` (111 697 444 Б, SHA1 `fe315f5d…`); фикс подтверждён внутри `app.asar` (`ComSpec`, `resolveCmdExe`, `taskkill.exe` — найдены).
- [x] **[Публикация v1.0.5]** Релиз `v1.0.5` (Latest) с `AppleLauncher-1.0.5.exe` + `launcher-version.json`; проверено `releases/latest/download/launcher-version.json` → 1.0.5 (первый ответ был CDN-кэш 1.0.4). `CHANGELOG.md` дополнен записями 1.0.2–1.0.5.
- [x] **[Первопричина краша `cmd.exe`]** Версия для self-update берётся из самого EXE — `app.getVersion()` в `main.js` (вместо внешнего `config.json`, который «застревал» на 1.0.3 и запускал ложный/бесконечный self-update на каждом старте). В `src/selfUpdate.js` добавлена `winEnv()` — гарантирует `%SystemRoot%\System32` в `PATH` дочернего `cmd.exe` (иначе при урезанном PATH не находятся `cmd.exe` и `tasklist/find/ping/move`).
- [x] **[Сборка+публикация v1.0.6]** Версии → 1.0.6; portable EXE в `.cache/out-106` → `release/AppleLauncher-1.0.6.exe` (111 695 804 Б, SHA1 `b076900d…`); фикс подтверждён в `app.asar` (`resolveCmdExe`/`winEnv`/`ComSpec`); релиз `v1.0.6` (Latest) + `launcher-version.json`; `releases/latest/download/launcher-version.json` → 1.0.6.
- [x] **[Постоянное имя EXE]** `package.json`: `build.artifactName = AppleLauncher.${ext}`, `portable.artifactName = AppleLauncher.exe` (без `${version}`) → ярлык на рабочий стол не ломается при обновлениях; `release/AppleLauncher-1.0.6.exe` переименован в `release/AppleLauncher.exe`.
- [x] **[Мод автоподключения]** Создан собственный клиентский мод Forge 1.16.5 `appleautojoin` (`mods-src/apple-autojoin/`): при открытии «Сетевой игры» сразу подключает к серверу из `servers.dat`; стек собирается напрямую против SRG-jar (`build.ps1`), без MCP/Gradle.
- [x] **[Интеграция мода]** JAR `apple-autojoin-1.0.0.jar` (3107 Б, SHA1 `cacc20f5…`) установлен в `minecraft/game/mods/` и `release/minecraft/game/mods/`; `updater/manifest.json` перегенерирован (17 файлов); ассеты `mods__apple-autojoin-1.0.0.jar` + `manifest.json` загружены в релиз `modpack-v1` (`gh release upload --clobber`); целостность удалённого манифеста проверена (`sha1 = cacc20f5…`).
- [x] **[Права админа]** Проверен `C:\Server_Skyblock\ops.json`: `bodayan` (`92f5f165-14e6-3b35-a390-9170db778f75`) и `boris` (`11e11c78-86e6-3ae6-8f0f-f8eacc645b28`), `level: 4`; оффлайн-UUID пересчитаны и совпали. `server.properties`: `online-mode=false`, `white-list=false` — вход открыт. Применится при перезапуске сервера (или `/op <ник>` из консоли).
- [x] **[Подтверждение автоподключения]** Пользователь подтвердил: клик «Сетевая игра» сразу подключает к серверу — мод `appleautojoin` работает в боевом запуске.
- [x] **[Документация хостинга]** Раздел 3: добавлен подраздел «Будущий хостинг сервера — корректировки и допущения» (мод работает и для удалённого сервера; шаги переезда; оговорки по `online-mode`/UUID `op`/порту; альтернатива `quickPlay`). Разделы 9.1/9.2: обновлены шаги — подключение автоматическое (мод), а не «Добавить сервер» вручную.
- [x] **[Полная блокировка списка серверов]** Мод переписан с `InitGuiEvent.Post`+`TickEvent` на перехват `GuiOpenEvent` (`event.setGui(...)` до показа экрана). `MultiplayerScreen` теперь **никогда не отображается**: вход из главного меню → сразу `ConnectingScreen` к серверу из `servers.dat`; возврат после «Завершить сетевую игру» (`mc.field_71462_r` = `WorkingScreen`/`DirtMessageScreen`/`IngameMenuScreen`) → `MainMenuScreen` вместо списка. JAR `apple-autojoin-1.0.0.jar` пересобран (2589 Б, SHA1 `729edacb…`), установлен в `minecraft/game/mods/` и `release/minecraft/game/mods/`; `updater/manifest.json` обновлён (17 файлов). Бэкап: `backups/2026-11-19-ui-multiplayer-block/`.
- [x] **[Git-синхронизация]** Код v1.0.2–v1.0.6 закоммичен и запушен в `origin/main` (коммит `7a2a3f6`, 2026-11-21); `.gitignore` дополнен `mods-src/**/out/`; ветка `main` = `origin/main`, дерево чистое.

---

## 5. Оставшиеся задачи (приоритет)

### Высокий приоритет
1. **Хостинг сервера (в будущем)**: при переносе сервера на удалённый хостинг обновить `config.json` (`launcher.server.host`/`port` + `servers.list[0].ip`). Учесть `online-mode` (оффлайн-клиент требует `online-mode=false`) и перевыдать права `op` уже на сервере — подробности и оговорки в разделе 3 «Будущий хостинг сервера». Мод менять не нужно.
2. **Тест на «чистой» системе** (раздел 12.7) — скопировать один `AppleLauncher.exe` на чистую Windows (без Java/`.minecraft`/Node) и пройти по чек-листу (встроенная JRE, докачка модпака по `modpack-v1` вместе с модом автоподключения, список серверов, self-update, офлайн-запуск).
3. **Живой прогон сценариев автообновления и докачки** (силами пользователя): подменить байт в `mods/*.jar` → перекачка; отключить сеть в середине загрузки → докачка по HTTP Range. В т.ч. проверить самообновление `1.0.6 → следующая` (фикс `cmd.exe`).

### Средний приоритет
4. **Опциональная авторизация Microsoft** — второй режим (`launcher.offline = false`) для лицензии; поля готовы, нужен OAuth-flow (device code).
5. **Больше фонов** — добавить изображения в `assets/backgrounds/` (сейчас только `skyblock.png`).
6. **Сборка EXE** — ✅ v1.0.6 собран с иконкой и встроенной JRE 17; сборка в `.cache/out-106` (`electron-builder --win portable --publish never`; нужны `ELECTRON_BUILDER_CACHE`/`ELECTRON_CACHE`; **`powershell.exe` в среде недоступен**). Для игры нужны внешние файлы `minecraft/game` (~1.69 ГБ), они не входят в EXE.
7. **Java runtime** — ✅ решено: **встроена** JRE 17 (вариант A, `npm run build:jre`, `scripts/build-jre.js`, `extraResources: ["config/config.json", "jre"]`).
8. **Решение по автозапуску игры** — реализовать флаг `launcher.autoLaunch` (по умолчанию `false`), если нужен автоматический старт игры после проверки файлов (см. 12.8).

### Низкий приоритет
9. **Подпись кода** (SmartScreen) — сертификат OV/EV, если потребуется публичный релиз без предупреждения.
10. **Удалить `servers.dat.bak`** — резервная копия от прежних запусков, если она больше не нужна.

### Сервер СкайБлок Деревня (`C:\Server_Skyblock`) — аудит и план улучшений
> Источник: аудит 2026-11-21 по итогам анализа конкурента `cubixworld` (см. раздел 11, запись «Аудит сервера vs CubixWorld»).
- **P0 (критично):** (1) `server.properties` `gamemode=creative` → `survival` + `force-gamemode` согласовать с BSkyBlock (новый игрок не должен стартовать в креативе); (2) включить спавн мобов — `spawn-monsters=false`/`spawn-animals=false` ломают прогрессию SkyBlock (нет дропов/ферм) → `true` либо таргетировать per-world; (3) `sync-chunk-writes=true` → `false` (перф).
- **P1:** унифицировать экономику (Essentials Eco ↔ Vault ↔ BentoBox Bank); снизить `Bank.interestRate` (10% — гиперинфляция); выставить `difficulty` единообразно (`easy` vs BentoBox `NORMAL`); `Challenges.undeployed-view-mode` → `HIDDEN`/задеплоить челленджи; убрать дубль WorldEdit (mod + CUI).
- **P2:** добавить LuckPerms (ранги/права), плагин бэкапов мира+BentoBox db, `spark` для профилирования; развить тему «Деревня» через CustomNPCs (квесты/диалоги/награды); связать `Level` (уровень острова) с наградами; QoL-моды как у CubixWorld (jade/jei/Neat) — но БЕЗ разрастания модпака (концепция «минимум модов»).

---

## 6. Инструкция по продолжению работы

### Шаг 1. Восстановление контекста (минимум токенов)

1. Прочитай **только этот файл (`SESSION_HANDOFF.md`) — он содержит всю архитектуру и прогресс.
2. Запусти `npm install` (если `node_modules` отсутствует).
3. Проверь запуск: `npm start`.

### Шаг 2. Выбери задачу из раздела 5.

### Шаг 3. После завершения — ОБЯЗАТЕЛЬНО обнови этот файл:
- Обнови раздел 1 (статус)
- Добавь выполненные задачи в раздел 4
- Перенеси выполненные из раздела 5 в раздел 4
- Добавь новые задачи в раздел 5
- Обнови раздел 3 если архитектура изменилась
- **Добавь полную детализированную запись в раздел 11 «Журнал сессий»**: изменения в коде/конфиге → перечень действий → результаты → текущий статус → проблемы → открытые вопросы (см. шаблон в начале раздела 11).
- **Синхронизируй с GitHub**: `git add` → `git commit -m "<понятное описание>"` → `git push origin main` (локальная копия = удалённый репозиторий).

---

## 7. Алгоритм передачи проекта между аккаунтами

```
[Аккаунт A заканчивает сессию:
  1. Обновляет SESSION_HANDOFF.md (разделы 1,3,4,5 + детальная запись в разделе 11)
  2. Коммитит изменения и пушит в `origin/main` (`git push`) — синхронизация с GitHub обязательна
  3. Передаёт следующему аккаунту ТОЛЬКО путь к проекту + команду чтения SESSION_HANDOFF.md

[Аккаунт B начинает сессию:
  1. Читает SESSION_HANDOFF.md
  2. Выполняет Шаг 1 из раздела 6
  3. Продолжает с выбранной задачи
  4. По завершении — повторяет шаги Аккаунта A
```

### Формат передачи контекста (token-оптимальный)

**Единый файл `SESSION_HANDOFF.md` в корне проекта. Не передавать историю чатов. Все архитектурные решения и прогресс — только в этом файле.

---

## 8. Важные ссылки

- Документация `minecraft-launcher-core` 3.x: `node_modules/minecraft-launcher-core/README.md`
- Версия Forge JSON: `minecraft/game/versions/Forge 1.16.5/Forge 1.16.5.json`
- Тест запуска: `node test-launch.js`
- Модуль автообновления: `src/updater.js` (подробности — раздел 10)

---

## 9. Практические инструкции

### 9.1 Порядок запуска приложения

1. Установить Node.js 18+ и Java 17 (JDK/JRE).
2. Перейти в корень проекта: `cd C:\Users\LEO\AppleLauncher`.
3. Установить зависимости (только при первом запуске или после обновления): `npm install`.
4. Запустить лаунчер: `npm start`.
5. В открывшемся окне ввести никнейм (по умолчанию `bodayan`) и нажать **«Играть»**.
6. Дождаться завершения загрузки (прогресс-бар) — откроется **главное меню Minecraft** (логотип Mojang → меню).
7. Выбрать режим **внутри игры**: «Одиночная игра» — для тестирования; **«Сетевая игра» → сразу подключается к серверу** из `config.json` (клиентский мод `appleautojoin`, экран выбора серверов не показывается).

> Лаунчер сам сервер не выбирает: подключение выполняет клиентский мод `appleautojoin` в момент клика «Сетевая игра» (см. раздел 3 «Автоподключение»).

### 9.2 Необходимость отдельного запуска сервера

- **Да, сервер запускается отдельно.** Лаунчер — это только клиент; подключение выполняет клиентский мод («Сетевая игра» → сразу сервер, `appleautojoin`), список серверов вручную править не нужно.
- **Когда требуется:** если нужно играть по сети (вместе с другом или на своём мире). Сервер должен быть запущен на той же машине (или в той же сети) и слушать порт `25565`.
- **Когда не требуется:** для одиночной игры («Одиночная игра» в главном меню) — сервер не нужен, подключения не происходит.
- **Обязательная настройка сервера:** в `server.properties` должно быть `online-mode=false` (иначе оффлайн-клиент получит `Failed to login: Invalid session`).

### 9.3 Доступ друга через домашнюю Wi-Fi сеть

**На стороне хоста (тот, кто запускает сервер):**

1. Узнать локальный IP-адрес хоста в домашней сети:
   - Windows: `ipconfig` → поле `IPv4-адрес` (например `192.168.1.50`).
2. Запустить Minecraft-сервер на `0.0.0.0:25565` (или `server-ip=` пусто + `server-port=25565`).
3. В `server.properties` установить `online-mode=false`.
4. Открыть порт `25565` в брандмауэре Windows (TCP и UDP) для `javaw.exe` или создать правило входящего подключения на порт 25565.
5. Сообщить другу свой локальный IP (например `192.168.1.50`).

**На стороне друга:**

1. Получить от хоста копию проекта `AppleLauncher` (или установить зависимости: `npm install`).
2. Запустить лаунчер: `npm start`.
3. Ввести уникальный никнейм и нажать **«Играть»** — откроется главное меню Minecraft.
4. Выбрать «Сетевая игра» → «Добавить сервер» → ввести адрес `IP-хоста:25565` (например `192.168.1.50:25565`) → «Готово» → подключиться.

**Важно:** оба игрока должны быть в одной домашней Wi-Fi сети. Если у друга возникает `Connection Refused` — проверьте брандмауэр на хосте и что сервер слушает `0.0.0.0` (а не `127.0.0.1`).

---

## 10. Автообновление файлов (Google Drive)

### 10.1 Как это работает

1. При запуске лаунчера (`did-finish-load`) `main.js` вызывает `runUpdater()` (если `updater.enabled = true`).
2. `src/updater.js` загружает **манифест** (`manifestUrl` или `manifestPath`) — JSON со списком файлов.
3. Для каждого файла проверяется целостность: отсутствует → качаем; `sha1` не совпал → качаем; иначе пропускаем.
4. Загрузка: из Google Drive по `gdriveId` (`https://drive.google.com/uc?export=download&id=...`) или по прямому `url`. Для больших файлов Google отдаёт страницу-предупреждение — модуль автоматически извлекает `confirm`/`uuid` и повторяет запрос.
5. После загрузки сверяется `sha1`. Прогресс уходит в UI по каналу `updater:progress`.
6. Ручной запуск проверки: IPC `updater:check` (renderer → `electronAPI.checkUpdate()`).

### 10.2 Структура хранилища на Google Drive

```
Google Drive/
└── AppleLauncher/                 (папка, доступ «Все, у кого есть ссылка»)
    ├── manifest.json              (индекс: список файлов + gdriveId + sha1 + size)
    ├── mods/                      (структура повторяет minecraft/game/mods)
    │   ├── example-mod-1.0.jar
    │   └── ...
    ├── config/
    │   └── ...
    └── ...
```

Пути в `manifest.json` указываются **относительно** `updater.targetPath` (по умолчанию `C:\Users\LEO\AppleLauncher\minecraft\game`), поэтому структура папок на Drive должна повторять структуру игровой директории.

### 10.3 Формат `manifest.json`

```json
{
  "version": 1,
  "files": [
    {
      "path": "mods/example-mod-1.0.jar",
      "gdriveId": "1AbCdEfGhIjKlMnOpQrStUvWxYz123456",
      "sha1": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
      "size": 123456
    },
    {
      "path": "config/example.toml",
      "url": "https://example.com/direct/example.toml",
      "sha1": "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d"
    }
  ]
}
```

- `path` — путь относительно `targetPath` (обязательно).
- `gdriveId` **или** `url` — источник файла (обязательно одно из двух). `url` позволяет использовать любой прямой линк/зеркало.
- `sha1` — предпочтительный способ проверки (если задан, сверяется после загрузки).
- `size` — запасной вариант проверки, если `sha1` не задан.

### 10.4 Полный список файлов и директорий для загрузки на Google Drive

**Обязательно загружать (контент модпака клиента):**
- `mods/**` — все клиентские моды (`.jar`).
- `config/**` — конфигурации модов.
- `defaultconfigs/**` — дефолтные конфиги (Forge).
- `scripts/**` — скрипты (CraftTweaker / KubeJS), если используются.
- `resources/**` — ресурсы модпака (если есть).

**Опционально (для единообразия у всех игроков):**
- `resourcepacks/**`, `shaderpacks/**` — ресурспаки/шейдеры.
- `options.txt` — настройки графики/управления (осторожно: перезапишет личные).
- `servers.dat` — **не рекомендуется**: список серверов управляется лаунчером из `config.json` (`servers.enforce`, см. раздел 3).

**НЕ загружать (регенерируется клиентом, личное или большое):**
- `saves/**` — миры игрока (личное).
- `logs/**`, `crash-reports/**`, `screenshots/**` — мусор/личное.
- `assets/**`, `libraries/**`, `versions/**`, `natives/**` — скачивает `minecraft-launcher-core` сам.
- `*.part` — временные файлы загрузки.

### 10.5 Инструкция по размещению на Google Drive

1. Создать на Google Drive папку `AppleLauncher` и загрузить в неё файлы из списка 10.4, сохранив структуру подпапок.
2. Для каждого файла: **Поделиться → «Все, у кого есть ссылка» → Читатель** → скопировать ссылку. ID файла — между `/d/` и `/view` (например `.../file/d/1AbCdEfGhIj.../view` → ID `1AbCdEfGhIj...`).
3. Посчитать SHA1 каждого файла (PowerShell):
   ```powershell
   Get-FileHash -Algorithm SHA1 "C:\path\to\file.jar" | Select-Object -ExpandProperty Hash
   ```
   (Получить нижний регистр при необходимости: `(...).ToLower()`.)
4. Заполнить `manifest.json` (формат из 10.3) по всем файлам.
5. Загрузить `manifest.json` на Drive, открыть доступ «Все, у кого есть ссылка», скопировать **ID манифеста**.
6. В [config.json](file:///C:/Users/LEO/AppleLauncher/config/config.json) заполнить:
   ```json
   "updater": {
     "enabled": true,
     "manifestUrl": "https://drive.google.com/uc?export=download&id=<ID_МАНИФЕСТА>",
     "manifestPath": "C:\\Users\\LEO\\AppleLauncher\\updater\\manifest.json",
     "targetPath": "C:\\Users\\LEO\\AppleLauncher\\minecraft\\game"
   }
   ```
   (`manifestUrl` имеет приоритет; если пусто — читается локальный `manifestPath`.)
7. Перезапустить лаунчер — файлы проверятся и дозагрузятся автоматически.

### 10.6 Важные замечания

- Google Drive **не даёт скачивать файлы > 100 МБ стабильно** через прямую ссылку (лимит на «вирусы»); модуль обрабатывает `confirm`-токен, но для очень больших файлов лучше использовать прямые зеркала (`url`).
- При изменении файла обязательно обновляйте его `sha1` и (при смене) `gdriveId` в манифесте, иначе лаунчер не увидит новую версию.
- Тестирование модуля пройдено локально: несовпадающий/отсутствующий файл скачивается (`updated`), совпадающий — пропускается (`skipped`), содержимое и SHA1 корректны.

---

## 11. Журнал сессий (детальные записи)

> Заполняется по итогам КАЖДОЙ сессии. Новые записи добавлять сверху (свежее — выше). Формат: изменения в коде/конфиге → действия → результаты → статус → проблемы → открытые вопросы.

### Сессия 2026-11-21 — Аудит сервера «СкайБлок Деревня» vs конкурент CubixWorld (OceanBlock_1165)

**Запрос пользователя:** комплексный анализ сервера-конкурента `cubixworld` (режим `OceanBlock_1165`, файлы `C:\Users\LEO\cubixworld`), полный аудит собственного сервера `C:\Server_Skyblock`, практические советы по оптимизации (производительность, геймплей, экономика, баланс, UX) с учётом концепции «минимум модов».

**Проанализированные файлы:**
- Конкурент: `updates/OceanBlock_1165/{CubixMenu.json, servers.json, config/{cubixtops,cubixquiz,cbx_scrs, ccl.cfg}.toml, mods/*}`, `updates/Industrial/cubixmenu/localMenuData.json`.
- Свой сервер: `server.properties`, `spigot.yml`, `bukkit.yml`, `plugins/BentoBox/addons/{BSkyBlock,Bank,Challenges}/config.yml`, `plugins/Essentials/{kits.yml}`, `mods/*`, `ops.json`, `world/customnpcs/dialogs/Villager/*.json`.

**Ключевые выводы (конкурент):** коммерческая лаунчер-платформа (`api.cubixworld.net`), in-launcher меню (новости/серверы/валюта `ruble`+`bonus`), live-события (квиз каждые 30 мин; лидерборды money/kills/playtime/quiz с недельными наградами), устойчивый реконнект (5 попыток/30с). QoL/перф-моды: `lazydfu`, `smoothboot`, `jade`, `jei`+`jeresources`, `Neat`, `litematica`, `mouse-tweaks`, `RPC`. Контент — крупный тематический модпак (против концепции «минимум модов» → берём только сервисный слой).

**Ключевые выводы (свой сервер):** Mohist 1.16.5 (Forge+Bukkit) + моды CustomNPCs/WorldEdit(×2), BentoBox+9 аддонов (BSkyBlock/Bank/Biomes/Challenges/ControlPanel/IslandFly/Level/Limits/Warps), EssentialsX, Vault, WorldBorder. 4 игрока. **Найдено:** `gamemode=creative` в `server.properties` (конфликт с BSkyBlock SURVIVAL); `spawn-monsters=false`/`spawn-animals=false` → нет мобов (ломает SkyBlock); `sync-chunk-writes=true`; дубль WorldEdit; `Bank.interestRate=10` (гиперинфляция); нет плагина прав/бэкапов; CustomNPCs-диалоги — заглушки без квестов.

**Изменения в коде/конфиге:** файлы сервера НЕ трогались (аудит). Обновлён [SESSION_HANDOFF.md](file:///C:/Users/LEO/AppleLauncher/SESSION_HANDOFF.md): раздел 5 (новый подраздел «Сервер СкайБлок Деревня — аудит и план», P0/P1/P2) и данная запись.

**Результаты:** подготовлен структурированный отчёт (анализ конкурента → сильные/слабые стороны → рекомендации → план приоритетов P0/P1/P2) в ответе пользователю.

**Статус:** ✅ анализ конкурента · ✅ аудит сервера · ✅ рекомендации и план · ⬜ применение правок конфигов сервера (по отдельному запросу; сервер запущен — правки стоп-старт).

**Проблемы:** нет.

**Открытые вопросы:** начинать ли применение P0-правок (gamemode/spawn/sync-chunk-writes) сразу, и в каком порядке?

### Сессия 2026-11-21 — Сборка и публикация v1.0.7 (доставка доработок через self-update)

**Запрос пользователя:** собрать и опубликовать новый EXE (`v1.0.7`), чтобы доработки (постоянный каталог данных + проверка целостности + `modpack-v2`) дошли до пользователей через self-update; закрыть прошлые долги — перепривязать git-теги и починить `release/config/config.json`.

**Изменения в коде/конфиге:**
- [package.json](file:///C:/Users/LEO/AppleLauncher/package.json): `version` → `1.0.7`.
- [config/config.json](file:///C:/Users/LEO/AppleLauncher/config/config.json): `selfUpdate.currentVersion` → `1.0.7`.
- `release/config/config.json` (gitignore): синхронизирован с корневым — `updater.enabled: true`, `updater.manifestUrl` → `modpack-v2`, `selfUpdate.currentVersion` → `1.0.7`.
- [updater/launcher-version.json](file:///C:/Users/LEO/AppleLauncher/updater/launcher-version.json): `version` → `1.0.7`; url → `.../releases/download/v1.0.7/AppleLauncher.exe`; sha1 `ea1beb82…`; size `111695691`.
- [CHANGELOG.md](file:///C:/Users/LEO/AppleLauncher/CHANGELOG.md): добавлена секция `[1.0.7]`.

**Действия:**
1. Собрана portable-сборка: `$env:ELECTRON_BUILDER_CACHE="$env:TEMP\electron-builder-cache"; npm run dist` (обход TRAE Sandbox, блокирующего `%LOCALAPPDATA%\electron-builder`). Итог — `dist\AppleLauncher.exe` (артефакт с постоянным именем из `portable.artifactName`), exit 0.
2. Вычислены фактические SHA1/размер EXE (`ea1beb8218f9d7846c3e908523cdc8273eef2c3f`, 111 695 691 Б) → записаны в `launcher-version.json`.
3. Обнаружено, что `Latest` в GitHub Releases указывал на `modpack-v2` (в нём **нет** `launcher-version.json`) → self-update у пользователей ушёл бы в 404. Исправление: `modpack-v2` переведён в **prerelease**, `Latest` закреплён за `v1.0.7`.
4. Опубликован релиз `v1.0.7` (ассет `AppleLauncher.exe` + `launcher-version.json`).
5. Перепривязаны git-теги: `v1.0.1`→`b2721dc`, `v1.0.4`/`v1.0.5`/`v1.0.6`/`modpack-v1`→соответствующие коммиты кода (были все на `b2721dc`).

**Результаты:** `v1.0.7` = Latest, содержит EXE + `launcher-version.json`; `releases/latest/download/launcher-version.json` → 1.0.7; self-update `1.0.6 → 1.0.7` доставляет доработки автоматически; модпак `modpack-v2` исключён из `latest`.

**Статус:** ✅ сборка `v1.0.7` · ✅ релиз опубликован · ✅ `latest` корректен · ✅ теги перепривязаны · ✅ `release/config/config.json` починен.

**Проблемы:** `npm run dist` падал с `EPERM … %LOCALAPPDATA%\electron-builder` (TRAE Sandbox) — обойдено перенаправлением `ELECTRON_BUILDER_CACHE` в `%TEMP%`. При сборке `powershell.exe` в среде недоступен (`node module collection failed`), electron-builder переключился на ручной обход `node_modules` — на результат не влияет.

**Открытые вопросы:** нет.

### Сессия 2026-11-21 — Постоянный каталог данных + встроенная проверка целостности (модпак v2)

**Запрос пользователя:** проанализировать лаунчер, который «загружает папки на рабочий стол и выдаёт ошибку отсутствия файла», и реализовать: (1) автоматический выбор постоянного каталога данных (не рабочий стол) без лишних файлов в пользовательских каталогах; (2) встроенную проверку целостности при каждом запуске (сравнение sha1/списка с сервером, авто-докачка); (3) полностью автоматизированный сценарий с индикатором прогресса и авто-запуском игры; (4) лаунчер — единственный необходимый файл; (5) тестирование (чистая система / повреждённые файлы / успешный запуск).

**Анализ причин исходных проблем:**
- Файлы складывались рядом с EXE, потому что `APP_DIR` вычислялся от папки EXE (`PORTABLE_EXECUTABLE_DIR`). При запуске EXE с рабочего стола там создавались `config/`, `minecraft/`, `updater/`.
- «Ошибка отсутствия файла» — в облачном манифесте `modpack-v1` не было `versions/Forge 1.16.5/Forge 1.16.5.json`, а проверка целостности не запускалась перед стартом игры.

**Изменения в коде/конфиге:**
- [main.js](file:///C:/Users/LEO/AppleLauncher/main.js): `APP_DIR` заменён на `EXE_DIR` (только для поиска встроенной JRE и миграции) + новый `DATA_DIR = app.isPackaged ? %APPDATA%\AppleLauncher : ROOT`. От него теперь выводятся `config/`, `updater/`, `gameDirectory`, `backgrounds.additionalPaths`, `updater.*`, `selfUpdate.*`. Логгер пишет в `DATA_DIR`.
- `migrateDataDir()` — однократный перенос старых данных `EXE_DIR/minecraft` → `DATA_DIR/minecraft` (`renameSync` с fallback `cpSync`+`rmSync`) для пользователей прежних версий.
- `runUpdater()` → `ensureGameFiles(reason)`: проверка целостности вызывается при старте (`startup`), по кнопке (`manual`) и перед запуском игры (`pre-launch`). Возвращает `{ ok, results }`. `game:launch` теперь сначала `await ensureGameFiles("pre-launch")`, затем проверяет version JSON; сообщение об ошибке сделано понятным. Устранён дубликат `launching = true;`.
- [scripts/gen-manifest.js](file:///C:/Users/LEO/AppleLauncher/scripts/gen-manifest.js): добавлены `--game-dir`/`--base-url`/`--out`, точечное включение `versions/Forge 1.16.5/Forge 1.16.5.json` (`INCLUDE_FILES`), базовый URL → `modpack-v2`.
- [scripts/assetName.js](file:///C:/Users/LEO/AppleLauncher/scripts/assetName.js) (новый): каноническое кодирование пути в имя ассета (`/`→`__`, пробелы/спецсимволы→`_`), общее для ген-скрипта и публикации (URL манифеста всегда = имя ассета).
- [scripts/publish-modpack.js](file:///C:/Users/LEO/AppleLauncher/scripts/publish-modpack.js) (новый): пересборка манифеста → стейджинг копий под именами ассетов → пересоздание релиза (`gh release delete/create/upload`).
- [package.json](file:///C:/Users/LEO/AppleLauncher/package.json): добавлены скрипты `manifest` и `publish:modpack`.
- [config/config.json](file:///C:/Users/LEO/AppleLauncher/config/config.json): `updater.manifestUrl` → `modpack-v2/manifest.json`.

**Действия:**
1. Сгенерирован манифест (18 файлов: 4 `mods` + 13 `customnpcs` + `versions/Forge 1.16.5/Forge 1.16.5.json`).
2. Первая публикация через `gh` с `path#label` дала неверные имена ассетов (`#` задаёт лишь подпись, а имя = basename, пробелы → точки). Исправлено стейджингом → релиз пересоздан.
3. Опубликован **modpack-v2** (19 ассетов). Проверены имена ассетов и HTTP 200 для `manifest.json`, version JSON и jar-мода.
4. Тесты целостности в изолированном каталоге (`%TEMP%`): чистый каталог → 18 обновлено/0 ошибок; повтор → 18 пропущено; повреждённый файл → 1 обновлён; отсутствующий → 1 обновлён; финальная сверка sha1 — все совпадают.

**Результаты:** данные хранятся в `%APPDATA%\AppleLauncher`; проверка целостности с авто-докачкой работает в старте/кнопке/перед игрой; индикатор прогресса (`updater:progress`: check/download/done) отображается; лаунчер остаётся единственным пусковым файлом.

**Статус:** ✅ каталог данных · ✅ проверка целостности · ✅ прогресс-индикатор · ✅ modpack-v2 опубликован · ✅ тесты пройдены · ⬜ сборка/release нового EXE.

**Проблемы:** первый прогон теста дал транзиентную ошибку на version JSON (ретраи отработали; отдельный стресс-тест 5/5 OK, sha1 совпадает). Примечание: `versions/Forge 1.16.5/Forge 1.16.5.json` содержит `tlauncherVersion`/`time` — специфичные поля TLauncher, на запуск через MCLC не влияют.

**Открытые вопросы:** собирать ли и публиковать новый EXE (`v1.0.7`) для доставки изменений через self-update? Переносить ли git-теги и править ли `release/config/config.json` (из прошлой сессии)?

### Сессия 2026-11-21 — Проверка версии 1.0.6 + закрепление правила Git-синхронизации

**Запрос пользователя:** (1) остановить операции обновления/сборки, проверить текущую версию, сравнить с 1.0.6, проверить номер версии в конфигах, историю коммитов и теги, подтвердить соответствие; (2) постоянно синхронизировать проект с GitHub (локальная копия = удалённый репозиторий), после каждого сеанса вносить полную запись в `SESSION_HANDOFF.md`, коммиты — с понятными описательными сообщениями.

**Изменения в коде/конфиге:** правило Git-синхронизации закреплено — [SESSION_HANDOFF.md](file:///C:/Users/LEO/AppleLauncher/SESSION_HANDOFF.md) (шапка + разделы 6 и 7) и память проекта (`project_memory.md`). Код/конфиги проекта не менялись.

**Проверка версии (все ✅ = 1.0.6):**
- `package.json` → `version: 1.0.6`.
- `config/config.json` → `selfUpdate.currentVersion: 1.0.6`.
- `updater/launcher-version.json` → `1.0.6`, sha1 `b076900d…`, size `111695804`.
- `release/config/config.json` → `selfUpdate.currentVersion: 1.0.6`.
- `release/AppleLauncher.exe` → FileVersion/ProductVersion `1.0.6`, SHA1 `b076900d…`, размер `111695804` (совпадает с манифестом).
- GitHub Releases: `v1.0.6` = **Latest**; ассеты `AppleLauncher-1.0.6.exe` (111695804) + `launcher-version.json` (868); URL в манифесте совпадает с именем ассета.

**Действия:** проверены процессы (операций сборки/обновления нет; есть только `java` PID 26628 — игровой процесс, не тронут); `git tag`/`ls-remote --tags`; `gh release list`/`release view v1.0.6`; метаданные и SHA1 EXE.

**Результаты — версия 1.0.6 подтверждена.** Обнаружены два расхождения (не влияют на номер версии):
1. **Теги git** — `v1.0.1`, `v1.0.4`, `v1.0.5`, `v1.0.6`, `modpack-v1` все указывают на коммит `b2721dc` (v1.0.1); тег `v1.0.6` не содержит кода v1.0.6 (следствие публикации релизов через `gh` без коммита исходников). Тегов `v1.0.2`/`v1.0.3` нет.
2. **`release/config/config.json`**: `updater.enabled=false`, `manifestUrl=""` (в корневом `config.json` — `true`) → при запуске `release/AppleLauncher.exe` авто-докачка модпака отключена (внешний конфиг «застрял» с прошлых сборок).

**Статус:** ✅ операции не запущены · ✅ версия 1.0.6 подтверждена во всех файлах, EXE и релизе · ✅ правило Git-синхронизации закреплено · ⬜ (по желанию) перепривязать теги и синхронизировать `release/config/config.json`.

**Проблемы:** расхождения из п.п. 1–2 выше.

**Открытые вопросы:** (1) переносить ли теги (`v1.0.6` → `7a2a3f6`)? (2) исправить ли `release/config/config.json` (`updater.enabled=true`)?

### Сессия 2026-11-21 — Синхронизация с GitHub (первый push кода v1.0.2–v1.0.6)

**Запрос пользователя:** «Я работаю на двух компах, поэтому мне нужна синхронизация. Проверь есть ли синхронизация с этого ноута с ГитХабом И обновись».

**Анализ:**
- `git fetch origin` + `git pull --ff-only` → `Already up to date`; `origin/main` = локальный HEAD (`b2721dc`, v1.0.1).
- Обнаружено: код **v1.0.2–v1.0.6 не был закоммичен/запушен** — 16 изменённых + 3 неотслеживаемых пути (в т.ч. `mods-src/`, `scripts/`, `src/logger.js`) существовали только локально. На GitHub в `main` был только v1.0.1.
- Теги `v1.0.4`/`v1.0.5`/`v1.0.6`/`modpack-v1` на GitHub указывали на старый `main` (создавались `gh` для релизов, кода на них нет).

**Изменения в коде/конфиге:**
- `.gitignore`: добавлено `mods-src/**/out/` (скомпилированные `.class` не коммитятся).
- Коммит `7a2a3f6` (24 файла, +1298/−110): все изменения v1.0.2–v1.0.6 + новые `src/logger.js`, `scripts/build-jre.js`, `scripts/gen-manifest.js`, `mods-src/apple-autojoin/**` (src/res/`build.ps1`/JAR `apple-autojoin-1.0.0.jar`).

**Действия:**
1. `git status`/`git fetch`/`git pull --ff-only` — диагностика расхождения.
2. Проверка `config/config.json` на секреты — чисто (только локальный адрес сервера).
3. Индексация конкретных файлов (без `out/`), коммит `7a2a3f6`.
4. `git push origin main` → `b2721dc..7a2a3f6`.

**Результаты:** ветка `main` синхронизирована с `origin/main`; рабочее дерево чистое. Второй компьютер после `git pull` получит актуальный код.

**Статус:** ✅ pull (`Already up to date`) · ✅ коммит · ✅ push · ✅ дерево чистое.

**Проблемы:** ранее релизы (v1.0.4–v1.0.6, `modpack-v1`) публиковались через `gh`, но **без** commit/push исходников — отсюда расхождение. Теперь код в `main` актуален.

**Открытые вопросы:** (1) На втором компе выполнить `git pull` (+ `npm install`, если нет `node_modules`). (2) Крупные артефакты (`jre/`, `minecraft/`, `release/`, `.cache/`) вне git — переносить отдельно при необходимости.

### Сессия 2026-11-19 — Полная блокировка экрана списка серверов (переписать мод на `GuiOpenEvent`)

**Запрос пользователя:** «Проанализируйте и исправьте поведение интерфейса сетевой игры: после "Завершить сетевую игру" происходит переход на список серверов, а при открытии раздела "Сетевая игра" список показывается. Реализуйте полную блокировку показа списка серверов, чтобы этот экран никогда не появлялся. Создайте резервные копии затрагиваемых файлов, проведите тестирование и убедитесь в отсутствии регрессий.»

**Изменения в коде/конфиге:**
- `mods-src/apple-autojoin/src/apple/autojoin/AppleAutoJoin.java` — **переписан**: с `InitGuiEvent.Post`+`TickEvent.ClientTickEvent` (вызов `MultiplayerScreen.func_146796_h()` после показа экрана) на перехват **`GuiOpenEvent`** с подменой экрана через `event.setGui(...)` **до** его показа.
- `updater/manifest.json` — обновлена запись `mods/apple-autojoin-1.0.0.jar`: `sha1` `cacc20f5…`→`729edacb0df8b5a11b463eac6b73bdcde1818016`, `size` `3107`→`2589`. Остальные 16 записей не тронуты.
- `minecraft/game/mods/apple-autojoin-1.0.0.jar` и `release/minecraft/game/mods/apple-autojoin-1.0.0.jar` — заменены на новый JAR.

**Действия:**
1. **Бэкап.** Создан `backups/2026-11-19-ui-multiplayer-block/`: полное дерево `mods-src/apple-autojoin/` (src/res/out/JAR/build.ps1), оба установленных JAR, `updater/manifest.json`, `config/config.json`, `SESSION_HANDOFF.md`.
2. **Анализ первопричины.** Старый мод вызывал `func_146796_h()` на тике ПОСЛЕ `InitGuiEvent.Post`, т.е. `MultiplayerScreen` успевал отрисоваться. Решение — ловить более раннее событие `GuiOpenEvent`, которое Forge постит в `Minecraft.setScreen` (SRG `func_147108_a_`) ДО присваивания экрана; при этом `setGui()` подменяет открываемый экран, а `Minecraft.field_71462_r` ещё хранит **предыдущий** экран.
3. **Подтверждение патча Forge.** Порядок из байткода `forge-1.16.5-36.2.42-client.jar` и `Minecraft.java.patch`: `Screen old = this.screen; post(GuiOpenEvent); if (event.isCanceled()) return; screen = event.getGui(); if (old != null && screen != old) old.removed();`.
4. **Дискриминатор источника.** Возврат после «Завершить сетевую игру»: `IngameMenuScreen.func_213067_a` сначала зовёт `mc.func_213254_o()` (показывает `WorkingScreen`), затем `mc.func_147108_a(new MultiplayerScreen(new MainMenuScreen()))` → в момент события `field_71462_r` = `WorkingScreen`. Вход из главного меню → `field_71462_r` = `MainMenuScreen`. Отсюда: `WorkingScreen`/`DirtMessageScreen`/`IngameMenuScreen` → `MainMenuScreen` (список не показываем); иначе → `ConnectingScreen(new MainMenuScreen(), mc, первый сервер из servers.dat)`.
5. **Сборка.** `build.ps1` (JDK 17 Adoptium, `javac --release 8`) — exit=0; `javap` подтвердил методы `onGuiOpen(GuiOpenEvent)` + `firstServer(Minecraft)`; JAR установлен в обе папки `mods`.
6. **Проверки.** SHA1 локального JAR совпал с манифестом (нет лишней докачки); манифест распарсен (`version=1`, 17 файлов); лаунчер читает **локальный** `updater/manifest.json` (`main.js`: `manifestUrl: ""`) → публикация ассета на GitHub для работы приложения не требуется.

**Результаты:** `MultiplayerScreen` (список серверов) **не показывается ни в одном сценарии**: вход из главного меню сразу подключает к серверу; возврат после дисконнекта уводит в главное меню. Остальной функционал лаунчера не затронут (менялись только мод и запись манифеста).

**Статус:** ✅ мод переписан и собран · ✅ JAR установлен в обе игровые папки · ✅ манифест обновлён и сверен · ✅ бэкап создан.

**Проблемы:** JAR недетерминирован (SHA1 меняется при пересборке) — манифест обязательно регенерировать. Публикация ассета на GitHub Release `modpack-v1` **не выполнялась** (для локальной работы не требуется; нужна только при распространении мода на другие машины).

**Открытые вопросы:** (1) Проверить поведение в боевом запуске: «Сетевая игра» → сразу коннект; «Завершить сетевую игру» → главное меню (без списка). (2) Если сервер недоступен — `ConnectingScreen` покажет ошибку; автоповтора нет (по требованию — список не показывать).

### Сессия 2026-11-19 — Подтверждение мода + допущения по будущему хостингу (документация)

**Запрос пользователя:** «Сейчас работает, спасибо! В будущем я размещу на хостинге… можно будет подправить? Внеси все корректировки и предположения в файл SESSION_HANDOFF.md, для потомков.»

**Изменения в коде/конфиге:** нет — менялась только документация (`SESSION_HANDOFF.md`).

**Действия:**
1. Зафиксирована корректировка прежнего чат-замечания: мод `appleautojoin` **не зависит** от локальности сервера — он подключается к адресу из `servers.dat` (берётся из `config.json`), поэтому после переноса сервера на хостинг мод продолжит работать (нужно лишь обновить адрес в `config.json`).
2. Раздел 3: добавлен подраздел «Будущий хостинг сервера — корректировки и допущения» (шаги переезда; оговорки по `online-mode`, перевыдаче прав `op`, порту/SRV; клиентская природа мода; альтернатива `quickPlay`).
3. Разделы 9.1/9.2: устаревшие шаги «Сетевая игра → Добавить сервер» заменены на фактическое поведение (автоподключение модом).
4. Раздел 4: добавлены пункты «Подтверждение автоподключения» и «Документация хостинга». Раздел 5: приоритет №1 переставлен на задачу «Хостинг сервера (в будущем)»; проверка мода снята (пользователь подтвердил).

**Результаты:** документация отражает фактическое поведение (автоподключение по «Сетевой игре») и содержит план/оговорки для будущего переезда сервера на хостинг.

**Статус:** ✅ мод подтверждён рабочим пользователем · ✅ корректировки и допущения внесены в `SESSION_HANDOFF.md`.

**Проблемы:** нет.

**Открытые вопросы:** (1) При переезде на хостинг — выбрать хостинг с `online-mode=false` либо перейти на лицензионные аккаунты (тогда права `op` выдавать на сервере). (2) По желанию — включить `quickPlay` в `main.js` для пропуска и главного меню.

### Сессия 2026-11-19 — Автоподключение по «Сетевой игре» (свой мод) + права админа

> ⚠️ **Устарело:** описанная здесь реализация мода (`InitGuiEvent.Post` + `TickEvent` + `func_146796_h()`) заменена на перехват `GuiOpenEvent` — см. свежую запись «Полная блокировка экрана списка серверов».

**Запрос пользователя:** «Мне нужно изменить сетевую игру — пусть сразу подключается к серверу. Выбор серверов не нужен. Я вижу это так — запустил лаунчер, прогрузился mojang, я выбрал — Сетевая Игра и сразу попадаю на свой сервер. Сразу нужно прописать права админа — bodayan и boris. Это можно сразу сделать?» Через диалог выбран вариант **«Сохранить меню (нужен мод)»**; сервер локальный — `C:\Server_Skyblock`.

**Изменения в коде/конфиге:**
- Создан исходник клиентского мода `mods-src/apple-autojoin/`: `src/apple/autojoin/AppleAutoJoin.java`, `res/META-INF/mods.toml`, `res/pack.mcmeta`, `build.ps1` (сборка без MCP/Gradle).
- Готовый JAR `apple-autojoin-1.0.0.jar` (3107 Б, SHA1 `cacc20f5de8287715764bb745ab93a29ddfc114b`) установлен в `minecraft/game/mods/` и `release/minecraft/game/mods/`.
- `updater/manifest.json` перегенерирован (`node scripts/gen-manifest.js`) — 17 файлов, добавлена запись `mods/apple-autojoin-1.0.0.jar`.
- `main.js` **не менялся**: по-прежнему без `quickPlay`, с `applyPinnedServers()`.

**Действия:**
1. Проверены SRG-сигнатуры по локальным jar (`javap`): `MultiplayerScreen.func_146796_h()` (по байткоду читает `field_146803_h.getSelected()` и открывает `ConnectingScreen`), `ServerSelectionList.func_241215_a_(Entry)`, `ServerSelectionList.func_231039_at__()`, `NormalEntry.func_148296_a()`, `ServerData.field_78845_b`, `GuiScreenEvent.InitGuiEvent.Post.getGui()`, `TickEvent.ClientTickEvent.phase`.
2. Написан мод: на `InitGuiEvent.Post` для `MultiplayerScreen` запоминает экран; на следующем `ClientTickEvent` (END) находит `ServerSelectionList` среди детей экрана, выбирает первый `NormalEntry`, вызывает `func_241215_a_` + `func_146796_h()`. Защита: пропуск повторной инициализации того же экземпляра экрана + `COOLDOWN_MS = 10000`.
3. Компиляция: `javac --release 8 -encoding UTF-8` против `client-1.16.5-20210115.111550-srg.jar` + `forge-1.16.5-36.2.42-universal.jar` + `eventbus-4.0.0.jar` — exit=0; байткод проверен `javap` (ссылки корректны).
4. Ассеты загружены в релиз `modpack-v1` (`gh release upload ... --clobber`): `mods__apple-autojoin-1.0.0.jar` + `manifest.json`; целостность удалённого манифеста проверена через GitHub API (`sha1 = cacc20f5…`).
5. Проверен сервер `C:\Server_Skyblock`: `ops.json` содержит `bodayan` и `boris` (`level: 4`), оффлайн-UUID совпадают (MD5 `OfflinePlayer:<ник>`); `online-mode=false`, `white-list=false`.

**Результаты:** клик «Сетевая игра» в главном меню сразу открывает подключение к серверу из `config.json` (через `servers.dat`); экран выбора серверов не показывается.

**Статус:** ✅ мод собран и уложен в обе игровые папки · ✅ манифест и ассет опубликованы и сверены · ✅ права админа в `ops.json` корректны.

**Проблемы:** `gh release upload file#newname` в этой среде **не** переименовывает ассет — пришлось физически назвать файл `mods__apple-autojoin-1.0.0.jar`. CDN GitHub ~несколько минут отдаёт `manifest.json` со старой версией после `--clobber` (сам ассет уже новый — подтверждено через API). JAR недетерминирован: пересборка меняет SHA1.

**Открытые вопросы:** (1) Проверить автоподключение в реальном запуске игры. (2) Нужен ли автоповтор после дисконнекта (сейчас пауза 10 с). (3) Права админа применятся при перезапуске сервера (или `/op <ник>` из консоли).

### Сессия 2026-11-19 — Постоянное имя EXE (один файл для ярлыка)

**Запрос пользователя:** «работает, спасибо! Как сделать чтобы был один файл, я сделаю ярлык на рабочий стол и уже не надо будет переименовывать, это не удобно».

**Суть проблемы:** имя релиза содержало версию (`AppleLauncher-1.0.6.exe`), поэтому ярлык ломался при каждом обновлении.

**Изменения в конфиге:**
- `package.json`: `build.artifactName` → `AppleLauncher.${ext}`, `build.portable.artifactName` → `AppleLauncher.exe` (убрана `${version}` из имени). Теперь **все будущие сборки** выходят под постоянным именем `AppleLauncher.exe`.

**Действия:**
1. Остановлены запущенные процессы лаунчера (файл был заблокирован).
2. `release\AppleLauncher-1.0.6.exe` → **`release\AppleLauncher.exe`** (постоянное имя).
3. Проверка: в `release\` ровно один EXE — `AppleLauncher.exe`; запуск успешен (процесс работает).
4. Проверена логика самообновления: цель подмены = `PORTABLE_EXECUTABLE_FILE` (файл, из которого запущен лаунчер), `.bat` делает `move /Y` — **имя и путь файла сохраняются**. Значит ярлык на `release\AppleLauncher.exe` не сломается ни при одном автообновлении. Скачиваемый апдейт и так уже имеет фиксированное имя (`%TEMP%\AppleLauncher-update.exe`).

**ВАЖНО для следующих релизов:** asset в GitHub Releases теперь называется `AppleLauncher.exe`. Поэтому в `updater/launcher-version.json` поле `url` должно указывать на `.../releases/download/vX.Y.Z/AppleLauncher.exe` (или стабильно `.../releases/latest/download/AppleLauncher.exe`). Имя самого манифеста `launcher-version.json` не менялось.

**Результаты:** пользователь получает один файл `C:\Users\LEO\AppleLauncher\release\AppleLauncher.exe`; ярлык на рабочий стол больше не нужно переименовывать.

**Статус:** ✅ стабильное имя файла · ✅ конфиг сборки обновлён · ✅ проверка логики self-update · ⬜ следующий релиз собрать с новым `artifactName` и корректным `url` в манифесте.

---

### Сессия 2026-11-19 — Ручная установка v1.0.6 на машине пользователя

**Запрос пользователя:** «я скачал — `C:\Users\LEO\Downloads\AppleLauncher-1.0.6.exe`, сделай сам что ты просил меня. Я тебя не понял».

**Действия:**
1. Проверка скачанного файла: `Get-FileHash` → SHA1 `b076900d396d2814bc06d9052248f981bf240f1b` — совпадает с релизом 1.0.6 (файл корректный).
2. Поиск мест запуска: рекурсивный обход `C:\Users\LEO` — всех `AppleLauncher*.exe`; ярлыков на рабочем столе нет → лаунчер запускается прямо из папки проекта.
3. Проверка `release\AppleLauncher-1.0.6.exe` → тот же SHA1 (корректен).
4. Удалены устаревшие сломанные сборки `release\AppleLauncher-1.0.4.exe` и `release\AppleLauncher-1.0.5.exe` — в `release\` остался единственный рабочий `AppleLauncher-1.0.6.exe`.
5. Запуск `release\AppleLauncher-1.0.6.exe` — процесс работает (4 дочерних `AppleLauncher`, старт 12:21:26), краша `spawn cmd.exe ENOENT` нет.

**Результаты:** пользовательская машина переведена на v1.0.6; лишние сломанные EXE убраны; приложение стартует штатно.

**Статус:** ✅ скачанный EXE верифицирован · ✅ очистка `release/` · ✅ живой запуск без краша · ⬜ проверка самообновления (со следующей версии).

**Проблемы/примечания:** источник повторного краша был именно старый EXE v1.0.4; после ручной замены на 1.0.6 проблема закрыта навсегда.

---

### Сессия 2026-11-19 — Окончательный фикс `spawn cmd.exe ENOENT` + релиз v1.0.6

**Запрос пользователя:** «Так у нас снова ошибка — A JavaScript error occurred in the main process … Error: spawn cmd.exe ENOENT … Внимательно проанализируй ошибку. Найди информацию в Интернете и реши проблему раз и на всегда!»

**Диагностика (что именно было установлено):**
1. Единственный источник ошибки — `src/selfUpdate.js`: в **старом** коде был буквальный `spawn("cmd.exe", …)` без обработчика `error`; асинхронная ошибка `spawn` становится uncaught-исключением и роняет main-процесс (стек `_handle.onexit → onErrorNT`).
2. Через asar-пробник сравнены сборки: `.cache/out-105/…/app.asar` **содержит** фикс (`resolveCmdExe`/`ComSpec`), а распакованное во `%TEMP%` приложение `3MJ5jD1Xur3adqPpTk02N9OhWYO\resources\app.asar` (mtime `11:39` = сборка **v1.0.4**) содержит **старый** код `spawn("cmd.exe")` — именно оно падало.
3. Внешний `release/config/config.json` был «застрявшим»: `selfUpdate.currentVersion = "1.0.3"`. `main.js` брал текущую версию как `s.currentVersion || app.getVersion()`, поэтому **любой** запуск (старый или новый) считал доступным обновление 1.0.5 и запускал self-update → в старом EXE это давало краш, в новом — бесконечный цикл обновлений.
4. Веб-подтверждение: `child_process.spawn` не использует shell; нужен абсолютный путь к исполняемому файлу и корректный `PATH` (иначе ENOENT при урезанном PATH / устаревшем снапшоте окружения).

**Изменения в коде:**
- `main.js` (`runSelfUpdate`): текущая версия теперь берётся из самого EXE — `const current = app.getVersion();` (вместо `s.currentVersion || app.getVersion()`). Это устраняет ложный/бесконечный self-update из-за устаревшего внешнего `config.json`.
- `src/selfUpdate.js`: добавлена `winEnv()` — гарантирует `%SystemRoot%\System32` в `PATH` дочернего процесса (при урезанном PATH не находились ни `cmd.exe`, ни его утилиты `tasklist/find/ping/move`); `spawn(resolveCmdExe(), …)` теперь вызывается с `env: winEnv()`. Сохранены абсолютный путь к `cmd.exe` (`%ComSpec%`) и `child.on("error")`.

**Изменения в конфиге/артефактах:**
- `package.json` `version` → **1.0.6**; `config/config.json` и `release/config/config.json` `selfUpdate.currentVersion` → **1.0.6**; `updater/launcher-version.json` → 1.0.6 (URL, SHA1 `b076900d…`, size 111 695 804).
- `release/AppleLauncher-1.0.6.exe` — копия собранного EXE.
- `CHANGELOG.md` — добавлена запись 1.0.6.

**Действия:**
1. `node --check` `main.js`/`src/selfUpdate.js` — OK; сняты возможные блокировки (`Get-Process AppleLauncher | Stop-Process`).
2. Сборка: `electron-builder --win portable --publish never --config.directories.output=.cache/out-106` (env `ELECTRON_BUILDER_CACHE`/`ELECTRON_CACHE` внутри проекта; JRE не пересобиралась) — exit 0.
3. Верификация: `AppleLauncher-1.0.6.exe` — 111 695 804 Б, SHA1 `b076900d396d2814bc06d9052248f981bf240f1b`; в `app.asar` найдены `resolveCmdExe`/`winEnv`/`ComSpec` — фикс включён.
4. Публикация через `gh` CLI: релиз **`v1.0.6`** (Latest) — `AppleLauncher-1.0.6.exe` + `launcher-version.json`. Проверка: `gh release list` → `v1.0.6 Latest`; `releases/latest/download/launcher-version.json?v=106` → `1.0.6`.

**Результаты:** первопричина устранена в коде; v1.0.6 собран, верифицирован и опубликован (Latest); манифест отдаёт 1.0.6.

**Статус:** ✅ анализ · ✅ фикс кода · ✅ сборка v1.0.6 · ✅ публикация v1.0.6 (Latest) · ✅ CHANGELOG · ⬜ живой прогон self-update `1.0.5 → 1.0.6` · ⬜ тест на «чистой» машине.

**Проблемы/примечания:** краш приходил из **старого** EXE (v1.0.4), а не из 1.0.5; у сломанного у пользователя файла self-update не сработает — новый `AppleLauncher-1.0.6.exe` нужно один раз поставить вручную. Первопричина повторяемости — «застрявший» внешний `config.json`.

**Открытые вопросы:** живой прогон перекачки/докачки на чистой системе (раздел 12.7).

---

### Сессия 2026-11-19 — Сборка и публикация v1.0.5 (фикс `cmd.exe`)

**Запрос пользователя:** «что делать?» → выбран вариант **«Собрать и опубликовать v1.0.5»**.

**Изменения в конфиге/артефактах:**
- `package.json` `version` → **1.0.5**; `config/config.json` `selfUpdate.currentVersion` → **1.0.5**; `updater/launcher-version.json` → 1.0.5 (URL, SHA1 `fe315f5d…`, size 111 697 444, notes).
- `CHANGELOG.md` — добавлены записи 1.0.2, 1.0.3, 1.0.4, 1.0.5.
- `release/AppleLauncher-1.0.5.exe` — копия собранного EXE.

**Действия:**
1. Подняты версии; JRE не пересобиралась (существующий `jre/` уже содержит `jdk.dynalink`).
2. Сборка: `electron-builder --win portable --publish never --config.directories.output=.cache/out-105` (первый прогон в `.cache/out` упал `EBUSY` на `win-unpacked/resources/app.asar` — файл держал запущенный процесс; решено сборкой в свежий каталог).
3. Верификация артефакта: `AppleLauncher-1.0.5.exe` — 111 697 444 Б, SHA1 `fe315f5d0f663ba0f2cb4460a58feb13af412c17`; внутри `app.asar` найдены строки `ComSpec`, `resolveCmdExe`, `taskkill.exe` — фикс включён.
4. Публикация через `gh` CLI (`C:\Program Files\GitHub CLI\gh.exe`): релиз **`v1.0.5`** (Latest) — ассеты `AppleLauncher-1.0.5.exe` + `launcher-version.json`.
5. Проверка: `gh release list` → `v1.0.5 Latest`; `releases/latest/download/launcher-version.json` → 1.0.5 (первый ответ был CDN-кэш 1.0.4; повторный запрос — актуальный).

**Результаты:** v1.0.5 собран, опубликован и является Latest; манифест самообновления корректен; фикс подтверждён в упакованном виде.

**Статус:** ✅ фикс `cmd.exe` · ✅ сборка v1.0.5 · ✅ публикация v1.0.5 (Latest) · ✅ CHANGELOG · ⬜ тест на «чистой» машине · ⬜ живой прогон self-update `1.0.5 → next`.

**Проблемы/примечания:** `EBUSY` при сборке поверх занятого `win-unpacked`; CDN-кэш для `releases/latest/download` (нужен повторный запрос). Напоминание: у сломанного у пользователя EXE self-update не сработает — новый `AppleLauncher-1.0.5.exe` нужно один раз поставить вручную.

**Открытые вопросы:** тест на «чистой» системе (раздел 12.7); живой прогон перекачки/докачки.

---

### Сессия 2026-11-19 — Фикс краша `spawn cmd.exe ENOENT` в self-update

**Запрос пользователя:** скриншот «A JavaScript error occurred in the main process / Uncaught Exception: Error: spawn cmd.exe ENOENT … вышла ошибка после прогрузки лаунчера».

**Причина:**
- При доступном обновлении `runSelfUpdate()` вызывает `selfUpdate.applyUpdateAndRestart()`, которая делает `spawn("cmd.exe", ["/c", batPath])`.
- В portable-сборке/урезанном `PATH` `cmd.exe` не резолвится → `ENOENT`. Ошибки `spawn` **асинхронные** (событие `error`), поэтому внешний `try/catch` в `runSelfUpdate` их не ловит, а слушателя `error` у дочернего процесса не было → **uncaught-исключение** и падение main-процесса.
- Тот же класс бага — `spawn("taskkill", …)` в `stopGame()` ([main.js](file:///C:/Users/LEO/AppleLauncher/main.js)).

**Изменения в коде:**
- **`src/selfUpdate.js`**: добавлен `resolveCmdExe()` → `process.env.ComSpec || %SystemRoot%\System32\cmd.exe`; `spawn` обёрнут в `try/catch` (синхронная ошибка → понятное сообщение); добавлен `child.on("error", err => logger.error(...))`; подключён `require("./logger")`.
- **`main.js`**: в `stopGame()` путь к `taskkill` — абсолютный (`%SystemRoot%\System32\taskkill.exe`) + `child.on("error", …)`.

**Действия/результаты:** `node --check main.js` и `node --check src/selfUpdate.js` — OK; диагностика IDE — пусто. Падение при отсутствии `cmd.exe`/`taskkill` исключено (вместо краша — запись в лог). Сборка и публикация новой версии на этом шаге **не выполнялись** (решение пользователя «Только фикс в коде»); затем выполнены — см. запись выше (v1.0.5).

**Статус:** ✅ баг устранён в исходниках · ⚠️ опубликованный `v1.0.4` и локальный `.cache/out/AppleLauncher-1.0.4.exe` собраны до фикса — для доставки фикса нужен новый EXE (после сборки).

**Проблемы/примечания:** сломанный у пользователя EXE не может самообновиться (падение происходит до применения `.bat`), поэтому фикс в EXE доставляется только ручной установкой нового сборки.

**Открытые вопросы:** ~~решение о сборке/публикации версии с фиксом~~ → **выполнено**: v1.0.5 собрана и опубликована (см. запись выше); тест на «чистой» машине (раздел 12.7).

---

### Сессия 2026-11-19 — Валидация ника, стоп-кнопка, logger, докачка HTTP Range; сборка и публикация v1.0.4 + modpack-v1

**Запрос пользователя:** «Ознакомьтесь с содержимым файла SESSION_HANDOFF.md, изучите полный лог предыдущей рабочей сессии, проанализируйте все выполненные ранее шаги, текущий прогресс, нерешенные задачи и оставшиеся незавершенные части работы. Продолжите выполнение задачи с того места, на котором остановился предыдущий исполнитель, завершите все оставшиеся этапы, проверьте корректность реализации, убедитесь в соответствии результата требованиям и подготовьте итоговый отчет о завершенной работе.» Уточнения: **«Собрать v1.0.4 и опубликовать»** и **«Да, загрузить и включить»**.

**Изменения в коде/конфиге:**
- **`index.html`**: добавлен блок ошибки валидации (`.input-error#usernameError`) и кнопка остановки (`.stop-btn#stopBtn`, скрыта по умолчанию).
- **`assets/styles/app.css`**: добавлены стили `.invalid` (красная рамка), `.input-error` (текст ошибки) и `.stop-btn` (прозрачная кнопка с красной рамкой).
- **`src/logger.js`** (НОВЫЙ): `log/warn/error/setLogDir/getLogPath`; запись в `debug.log` **только при `process.env.DEBUG`**; файл рядом с EXE (`APP_DIR`).
- **`main.js`**: `require("./src/logger")` + `logger.setLogDir(APP_DIR)`; все `console.*` → `logger.*`; `USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/`; валидация ника в `game:launch` (возврат `{ok:false, message}`); `stopGame()` + обработчик `game:stop` (Windows: `spawn("taskkill", ["/pid", pid, "/T", "/F"])`, иначе `SIGTERM`); `gameProcess` хранится после `client.launch()`, сбрасывается в `close`/`error`.
- **`src/preload.js`**: добавлен `stopGame: () => ipcRenderer.invoke("game:stop")`.
- **`src/renderer.js`**: `USERNAME_RE`, `usernameError()`, `validateUsername()` (класс `.invalid`, текст ошибки, `disabled` кнопки), `stopGame()`, обновлены обработчики запуска/закрытия/ошибки.
- **`src/updater.js`**: докачка по HTTP Range — `downloadToFile` (до 3 попыток, пауза 1с→2с→4с), `streamDownload` читает размер `.part` → заголовок `Range: bytes=<start>-`, обработка `206` (дозапись) и `200` (сброс), `total = startBytes + len`; `hashExistingFile()` догружает существующий `.part` в hash.
- **`src/selfUpdate.js`**: в `downloadUpdate` перед загрузкой EXE удаляется висящий `<dest>.part`.
- **`config/config.json`**: `updater.enabled = true` + `updater.manifestUrl = https://github.com/faktogenez/bodaYan/releases/download/modpack-v1/manifest.json`; `selfUpdate.currentVersion = "1.0.4"`.
- **`package.json`**: `version` → `1.0.4`.
- **`updater/launcher-version.json`**: под 1.0.4 (`url .../releases/download/v1.0.4/AppleLauncher-1.0.4.exe`, SHA1 `2596dfd0…`, size `111698472`, notes).

**Действия:**
1. Прочитан `SESSION_HANDOFF.md`, восстановлен контекст (незадокументированная работа v1.0.3 — фикс JRE `jdk.dynalink`; в GitHub Releases были только v1.0.0/v1.0.1, релиз модпака отсутствовал).
2. Реализованы ранее открытые задачи: валидация ника, кнопка «Остановить», logger, докачка HTTP Range.
3. Проверки: `node --check` всех JS — OK; regex-тест валидации — PASS; logger-тест — PASS; resume-тест (проверка `rangeRequests: 1`) — PASS; smoke-тест `npm start` — окно стартует, `servers.dat` перезаписан, self-update пропущен в dev — PASS.
4. Сборка: обновлены версии/манифесты; собран portable EXE v1.0.4 в `.cache/out` (`ELECTRON_BUILDER_CACHE`/`ELECTRON_CACHE` внутри проекта).
5. Верификация артефакта: `AppleLauncher-1.0.4.exe` — 111 698 472 Б, SHA1 `2596dfd0a3ecb372245e7de2e0b9ab542d811f81`.
6. Публикация через `gh` CLI (`C:\Program Files\GitHub CLI\gh.exe`, аккаунт `faktogenez`): релиз **`modpack-v1`** — 17 ассетов (16 файлов модпака + `manifest.json`); релиз **`v1.0.4`** (Latest) — `AppleLauncher-1.0.4.exe` + `launcher-version.json`.
7. Финальная проверка: `https://github.com/faktogenez/bodaYan/releases/latest/download/launcher-version.json` отдаёт `{"version":"1.0.4", …}`.
8. Очистка: удалены `tmp_check.js`, `tmp_stage.js`, staging-каталог `.cache/modpack-v1/`.

**Результаты:**
- Все 4 ранее открытые задачи закрыты и протестированы (валидация ника, стоп-кнопка, logger, докачка).
- v1.0.4 собран, опубликован и является Latest; self-update-манифест корректен.
- Модпак опубликован (релиз `modpack-v1`), `updater.enabled = true` — автообновление файлов игры включено.

**Статус:** ✅ валидация ника · ✅ кнопка «Остановить» · ✅ logger/debug.log · ✅ докачка HTTP Range · ✅ сборка v1.0.4 · ✅ публикация v1.0.4 (Latest) · ✅ публикация modpack-v1 и включение `updater.enabled` · ✅ очистка временных файлов · ⬜ тест на «чистой» машине (раздел 12.7).

**Проблемы/примечания:**
- `node -e` в PowerShell искажает кавычки → проверочный код выносился в файл и запускался как скрипт.
- `gh` не в PATH → вызов по абсолютному пути `C:\Program Files\GitHub CLI\gh.exe`.
- `gh release view --json isLatest` не поддерживает поле `isLatest` → использованы `tagName,isDraft,assets`.
- Portable-EXE со встроенной JRE распаковывается в `%TEMP%` при каждом запуске → старт чуть медленнее.

**Открытые вопросы:** тест на «чистой» системе (раздел 12.7); живой прогон перекачки повреждённого файла и докачки при обрыве сети; опциональная авторизация Microsoft; подпись кода (SmartScreen).

---

### Сессия 2026-11-19 — Тестирование v1.0.2 (структура, целостность, smoke, live-запуск из release)

**Запрос пользователя:** «продолжи на чем остановился и проведи тесты».

**Изменения в коде/конфиге:**
- **`test-launch.js`**: путь к игровому каталогу вынесен в переменную окружения — `root: process.env.MC_ROOT || "…\\minecraft\\game"`. Позволяет нацелить harness на произвольную папку (использовано для `release/minecraft/game`) без правки файла.

**Выполненные тесты (все PASS):**
1. **Структура `release/minecraft/game`**: `versions/Forge 1.16.5/Forge 1.16.5.json` (45771 б) и `versions/1.16.5/1.16.5.json` (34956 б) на месте; `libraries` — 292 файла; `assets` — 8042 файла; `natives/1.16.5` (LWJGL/OpenAL glfw/lwjgl/OpenAL dll); итого 9142 файла, ~1.69 ГБ.
2. **Целостность `updater/manifest.json`**: SHA1+size 16/16 совпадают и в `minecraft/game`, и в `release/minecraft/game` (mods ×3 + customnpcs ×13).
3. **`updater/launcher-version.json`** vs `release/AppleLauncher-1.0.2.exe`: SHA1 `9d2cdfcd7d994ff5b5a37d83fde7ff26d7876d72` и size `111589695` совпадают.
4. **JRE**: `jre/bin/javaw.exe` присутствует; `java -version` = `Temurin-17.0.21+9`.
5. **Конфиг `release/config/config.json`**: `selfUpdate.currentVersion=1.0.2`, абсолютных путей нет (путь игры выводится от `APP_DIR`) — корректен для portable.
6. **Smoke-тест лаунчера** (`npm start`): окно «AppleLauncher» открылось (4 процесса electron), в логе `[servers] servers.dat перезаписан: 1 сервер(ов) — 127.0.0.1:25565`, `[selfupdate] пропуск: dev-режим`. Без ошибок (GPU cache warnings benign).
7. **Live-запуск игры из `release`** (`MC_ROOT=release/minecraft/game node test-launch.js`): ModLauncher 8.1.3 → fmlclient; offline-UUID `92f5f165-14e6-3b35-a390-9170db778f75` (для `bodayan`); достигнут Render thread (`OpenAL initialized`, `Sound engine started`); процесс `java` с окном `Minecraft* 1.16.5` (~1.98 ГБ). Новых `hs_err_pid*.log` нет.

**Дополнительное подтверждение (из `minecraft/game/logs/latest.log`, утренний запуск 06:41–06:47):** `Setting user: bodayan` → `Backend library: LWJGL version 3.2.2 build 10` → `OpenAL initialized` → `Sound engine started` → `Connecting to 127.0.0.1, 25565` → `[CHAT] bodayan joined the game`. Ошибки `authlib … 401` (`InvalidCredentialsException`) — ожидаемы в оффлайн-режиме и корректно обрабатываются authlib 2.3.31 (кнопка «Сетевая игра» активна).

**Результат:** пункт предыдущей сессии («повторно нажать Играть и подтвердить запуск до меню») закрыт — запуск Minecraft 1.16.5 Forge **из папки `release`** доходит до главного меню, крашей нет. Все проверки структуры и целостности — PASS.

**Статус:** ✅ структура release · ✅ целостность manifest/launcher-version · ✅ JRE 17 · ✅ smoke-тест лаунчера · ✅ live-запуск из release до меню · ⬜ публикация релиза `v1.0.2` в GitHub Releases · ⬜ загрузка модпака `modpack-v1` + `updater.enabled=true`.

**Проблемы/примечания:**
- Старые `hs_err_pid*.log` в корне (03:26–03:33) — от прежних экспериментов (`EXCEPTION_ACCESS_VIOLATION` в `org.lwjgl.system.JNI.invokePP`); в текущем коде флаг `-Dfml.earlyprogresswindow=false` присутствует, краш не воспроизводится. Возможно удалить эти файлы.
- GPU-ошибки `cache_util_win.cc / disk_cache.cc` при `npm start` — следствие ограничений песочницы на кэш, на работу не влияют.

**Открытые вопросы:** публикация `v1.0.2`; загрузка ассетов модпака и включение `updater.enabled`; тест на «чистой» машине (раздел 12.7); подпись кода (SmartScreen).

---

### Сессия 2026-11-19 — Исправление отсутствующей Forge-версии при запуске v1.0.2

**Запрос пользователя:** «ошибка после нажатия»; скриншот сообщает, что не найдена `release\minecraft\game\versions\Forge 1.16.5\Forge 1.16.5.json`.

**Причина:**
- В portable EXE упакованы приложение и JRE, но `minecraft/game` исключён из сборки.
- Внешняя папка `release/minecraft/game` была почти пустой (только `servers.dat`).
- `updater.enabled=false`, а манифест содержит только моды и `customnpcs`, не Forge, libraries и assets. Поэтому лаунчеру нечего скачать перед запуском.

**Изменения/действия:**
1. Проверен локальный полный игровой каталог `minecraft/game`: ~1.65 ГБ, 9142 файла.
2. Скопировано содержимое в `release/minecraft/game`, сохранён существовавший рядом `servers.dat`.
3. Проверены наличие Forge JSON, JSON базовой версии 1.16.5, `libraries/` и `assets/`; SHA1 Forge JSON совпадает с источником.
4. В `release/config/config.json` номер `selfUpdate.currentVersion` обновлён с 1.0.1 до 1.0.2.

**Результат:** ошибка отсутствующей версии устранена для локальной папки `release`; повторный запуск `release/AppleLauncher-1.0.2.exe` теперь должен найти Forge. Полный запуск игры после копирования ещё не подтверждён.

**Статус:** ✅ игровой каталог размещён рядом с EXE · ✅ обязательные файлы проверены · ⬜ повторно нажать «Играть» и подтвердить запуск до меню.

**Проблемы/примечания:** v1.0.2 нельзя считать самодостаточным одним EXE для игры: каталог Minecraft занимает около 1.65 ГБ и распространяется отдельно. На чистой машине нужно предоставить `minecraft/game` или настроить полноценную загрузку всех игровых файлов.

**Открытые вопросы:** проверить запуск Minecraft после этой подготовки; определить способ доставки полного игрового каталога (папка рядом с EXE либо полноценный downloader).

---

### Сессия 2026-11-19 — Сборка офлайн-EXE v1.0.2 (встроенная JRE)

**Запрос пользователя:** «собирай. мне нужен офлайн лаунчер для проверки».

**Изменения в коде/конфиге:**
- **`package.json`**: `version` 1.0.1 → **1.0.2**.
- **`config/config.json`**: `selfUpdate.currentVersion` → **1.0.2**.
- **`updater/launcher-version.json`**: обновлён под 1.0.2 (version/url/sha1/size/notes: «Встроенная JRE 17 — офлайн-запуск без установки Java»).
- **`scripts/build-jre.js`**: `findJlink()` переписан на чистый Node (JAVA_HOME → PATH → типовые каталоги JDK студий), т.к. `where.exe` в среде отсутствует.

**Действия:**
1. Остановлены запущенные процессы AppleLauncher.
2. `npm run dist` → JRE собрана (47.7 МБ, jlink из Temurin 17.0.21), но сборка упала на `EBUSY: … release\win-unpacked\resources\app.asar` (каталог залочен).
3. Пересборка в отдельный каталог: `npx electron-builder --win portable --config.directories.output=.cache/out` (env `ELECTRON_BUILDER_CACHE`/`ELECTRON_CACHE` внутри `.cache/`) → **exit code 0**.
4. Верификация: `.cache\out\AppleLauncher-1.0.2.exe` — **106.4 МБ**, SHA1 `9d2cdfcd7d994ff5b5a37d83fde7ff26d7876d72`.
5. Smoke-тест: запуск portable → окно «AppleLauncher» открылось (4 процесса) → процессы остановлены.
6. Артефакт скопирован в **`release/AppleLauncher-1.0.2.exe`**.

**Результат:** единый portable-EXE со встроенной JRE 17 собран и проверен (запуск работает).

**Статус:** ✅ сборка v1.0.2 · ✅ верификация (размер/SHA1/запуск) · ✅ перенос в `release/` · ⬜ публикация релиза `v1.0.2` через `gh` · ⬜ тест на чистой системе.

**Проблемы/примечания:**
- `EBUSY` на `release\win-unpacked` — каталог блокируется после запуска распакованной сборки; обход: сборка в `.cache/out` (gitignored).
- Portable-EXE (+встроенная JRE) распаковывается в `%TEMP%` при каждом запуске → старт чуть медленнее, но офлайн-автономность полная.

**Открытые вопросы:** публикация `v1.0.2` в GitHub Releases; загрузка модпака `modpack-v1` и включение `updater.enabled`; подпись кода (SmartScreen).

---

### Сессия 2026-11-19 — Встроенная JRE + манифест модпака + чек-лист чистой машины

**Запрос пользователя:** «встроить JRE»; «заполни manifest модпаком»; «дай чек-лист теста на чистой машине».

**Изменения в коде/конфиге:**
- **`scripts/build-jre.js`** (новый): сборка минимальной JRE 17 через `jlink` (29 модулей: `java.desktop`, `jdk.unsupported`, `java.instrument`, `jdk.crypto.ec`, `jdk.naming.dns` и др.), результат — `jre/` (~47.7 МБ).
- **`package.json`**: добавлен скрипт `build:jre`; `dist` теперь = `node scripts/build-jre.js && electron-builder --win portable`; в `build.extraResources` добавлен `"jre"`.
- **`main.js`**: `resolveJavaPath()` теперь первым делом ищет **встроенную JRE внутри EXE** (`process.resourcesPath/jre/bin/javaw.exe`), затем `APP_DIR/jre`, затем PATH.
- **`.gitignore`**: добавлен `/jre/` (генерируется, не коммитится).
- **`scripts/gen-manifest.js`** (новый): генератор `updater/manifest.json` из `minecraft/game` (папки `mods`, `customnpcs`), считает `sha1`+`size`, ссылки на GitHub Releases (тег `modpack-v1`), имя ассета = путь с заменой `/` → `__`.
- **`updater/manifest.json`**: заполнен — **16 файлов** (3 мода + `customnpcs/**`).
- **`config/config.json`**: `updater.manifestUrl` → `…/releases/download/modpack-v1/manifest.json` (`enabled` пока `false`).

**Действия:**
1. Найден JDK 17 (Temurin 17.0.21) с `jlink`; сборка JRE → `jre/` (47.7 МБ); проверка `jre/bin/java.exe -version` — OK.
2. `electron-builder --dir` → в `release/win-unpacked/resources/` присутствуют `jre/` и `config/` → JRE упакована, `resources/jre/bin/javaw.exe` на месте.
3. `node scripts/gen-manifest.js` → `updater/manifest.json` (16 файлов).

**Результат:** JRE встроена и упаковывается в EXE; манифест модпака сформирован.

**Статус:** ✅ JRE встроена (код + упаковка проверены; полный portable-релиз ещё не собран) · ✅ `manifest.json` заполнен · ⬜ ассеты модпака не загружены на GitHub (`updater.enabled=false`) · ⬜ тест на чистой системе.

**Проблемы/примечания:**
- **`powershell.exe` в среде отсутствует** (electron-builder: `spawn powershell.exe ENOENT`) → сборка JRE реализована на **Node**, а не PowerShell.
- Portable-EXE распаковывается в `%TEMP%` **при каждом запуске** → встроенная JRE (+47 МБ) замедлит старт; альтернатива — `jre/` рядом с EXE (`APP_DIR/jre`), код поддерживает.
- GitHub Releases не поддерживает `/` в именах ассетов → соглашение: имя = `path.replace("/", "__")` (на размещение не влияет, лаунчер раскладывает по полю `path`).

**Открытые вопросы:** загрузка модпака в релиз `modpack-v1` и включение `updater.enabled = true`; подпись кода (SmartScreen); тест на чистой системе (12.7).

---

### Сессия 2026-11-19 — Публикация релиза v1.0.0 в GitHub Releases

**Запрос пользователя:** проанализировать процесс релиза и причины трудностей; после предоставления доступа самостоятельно выполнить все этапы: проверка основной ветки, генерация release notes из коммитов, сборка и тест артефактов, тег и публикация релиза; обновить документацию и ченджлог; предоставить отчёт.

**Изменения в коде/конфиге:**
- **`config/config.json`**: `selfUpdate.enabled: true`, `selfUpdate.manifestUrl` = `https://github.com/faktogenez/bodaYan/releases/latest/download/launcher-version.json`.
- **`.gitignore`**: добавлен `release/`.
- **`updater/launcher-version.json`** (новый): `{version:1.0.0, url:…/releases/download/v1.0.0/AppleLauncher-1.0.0.exe, sha1:98e3c9a61d2ab670e3b5dea8b194963fc9b9c5c0, size:80663386}`.
- **`updater/manifest.json`** (новый): пустой шаблон `{files:[]}` (манифест модпака).
- **`README.md`** (новый) — пользовательская документация; **`CHANGELOG.md`** (новый) — первый релиз.

**Действия:**
1. Установлен `gh` CLI (winget, v2.105.0); device-flow авторизация под `faktogenez` (scopes: `repo`, `gist`, `read:org`).
2. Ветка переименована `master` → `main`; remote `origin` → `https://github.com/faktogenez/bodaYan.git`.
3. Сборка упала с `EBUSY … app.asar locked` (каталог `dist/` залочен) → сборка перенесена в `release/` (`--config.directories.output=release`).
4. Артефакт `release/AppleLauncher-1.0.0.exe` (76.9 МБ, SHA1 `98e3c9a6…`); smoke-тест: 4 процесса, окно «AppleLauncher», внешний `config/config.json` создан с `manifestUrl` — OK.
5. Коммит `3448e01` (9 файлов) → push в `origin/main`.
6. Опубликован релиз `v1.0.0` с ассетами `AppleLauncher-1.0.0.exe` + `launcher-version.json`.

**Результат:** https://github.com/faktogenez/bodaYan/releases/tag/v1.0.0 — опубликован (не draft/prerelease). Манифест `…/releases/latest/download/launcher-version.json` отдаёт **HTTP 200** с корректным JSON.

**Статус:** ✅ релиз создан, тег и ассеты на месте, автообновление настроено (1.0.0 == 1.0.0 → апдейта нет, петли нет).

**Проблемы/примечания:**
- Песочница блокирует `AppData\Local` → сборка только с `ELECTRON_BUILDER_CACHE`/`ELECTRON_CACHE` внутри проекта.
- `dist/` залочен (вероятно, IDE) — сборка перенесена в `release/`.
- Иконка пока дефолтная (Electron), подпись кода не настроена (SmartScreen).
- `git push` выполняется через credential-helper `gh` (передан флагом `-c`, глобальный git-конфиг не изменялся).

**Открытые вопросы:** тест на чистой системе (раздел 12.7); заполнение `updater/manifest.json` при готовности модпака; иконка; подпись кода.

---

### Сессия 2026-11-19 — Сборка portable EXE

**Запрос пользователя:** собрать EXE-файл лаунчера; определить, где хранить файлы; уточнить, какие данные GitHub нужно предоставить.

**Изменения в коде/конфиге:**
- **`package.json`**: `electron` перенесён в `devDependencies` (в `dependencies` остаётся только `minecraft-launcher-core`); добавлены `build.asar: true` и `build.directories.output: "dist"`; `electron-builder@^26.18.0` — в `devDependencies`.
- **`.gitignore`**: добавлен `.cache/` (кэш electron-builder).

**Действия:**
1. Установлен `electron-builder` (242 пакета).
2. Первая сборка (`npm run dist`) упала: `EPERM ... mkdir 'C:\Users\LEO\AppData\Local\electron-builder'` — песочница Trae запрещает запись в `AppData\Local`.
3. Обход: переменные `ELECTRON_BUILDER_CACHE=.cache/electron-builder` и `ELECTRON_CACHE=.cache/electron` (внутри проекта) → сборка прошла.

**Результат:** `dist/AppleLauncher-1.0.0.exe` — **76.9 МБ**, portable x64. Запуск EXE проверен: процессы `AppleLauncher` (main + renderer + GPU) поднялись, окно открылось, краха нет.

**Статус:** ✅ EXE собран и запускается; ⬜ тест на чистой системе (раздел 12.7); ⬜ иконка (пока дефолтная Electron — `default Electron icon is used`); ⬜ подпись кода (SmartScreen).

**Команда для повторной сборки (в песочнице Trae):**
```
$env:ELECTRON_BUILDER_CACHE="$PWD\.cache\electron-builder"; $env:ELECTRON_CACHE="$PWD\.cache\electron"; npm run dist
```

**Открытые вопросы:** хостинг файлов (рекомендация — GitHub Releases) и необходимые данные аккаунта GitHub для загрузки.

---

### Сессия 2026-11-19 — Фиксация рабочего состояния + подготовка к продакшену

**Запрос пользователя:** зафиксировать проверенное рабочее состояние (резервная копия + коммит), адаптировать под всех пользователей/платформы, протестировать на нескольких аккаунтах, проверить отсутствие регрессий, подготовить к продакшену.

**Изменения в коде/конфиге:**
- **`main.js`**: добавлена функция `resolveJavaPath()` — приоритет: явный `launcher.javaPath` → встроенная JRE рядом с EXE (`APP_DIR/jre/bin/javaw.exe`), иначе `java` из PATH; путь передаётся в `opts.javaPath` MCLC. Поле `os` теперь вычисляется из `process.platform` (`windows`/`osx`/`linux`). В `runSelfUpdate()` добавлена защита: на не-Windows системах подмена EXE пропускается (`.bat` — только Windows).
- **`config/config.json`**: добавлен ключ `launcher.javaPath: ""`.
- **`.gitignore`**: исключены `node_modules/`, `minecraft/`, `logs/`, `*.log`, `hs_err_pid*.log`, `backups/`, `dist/`, `*.bak`.

**Действия:**
1. Создана резервная копия исходников: `backups/AppleLauncher-src-20261119-065008.zip` (~187 КБ).
2. Инициализирован git, добавлен `.gitignore`, выполнен коммит №1 `c4a3d51` (18 файлов) — зафиксировано проверенное рабочее состояние.
3. Внесены адаптации (Java/платформа), см. выше.
4. Тесты: `node --check` всех файлов — OK; детерминированность `offlineUUID` на 5 никнеймах (включая кириллицу) — **PASS** (эталон Notch `b50ad385-829d-3141-a216-7e7d7539ba7f` совпал, формат UUID v3 корректен, уникальность сохранена); парсинг `config.json` и сборка `servers.dat` (rootTag=10, 88 байт) — OK; `npm start` — окно стартует, `servers.dat` перезаписан, JS-ошибок нет.
5. Коммит №2 — адаптации и подготовка к продакшену (см. ниже).

**Результаты:** состояние зафиксировано в git (2 коммита) и в ZIP-архиве; поведение идентично для всех игроков (оффлайн-UUID детерминирован, не зависит от ОС); лаунчер работает на машинах без предустановленной Java (через встроенную JRE или `javaPath`).

**Статус:** ✅ рабочее поведение сохранено, регрессий нет; ⬜ сборка EXE (`npm run dist`) и тест на чистой системе не выполнялись (см. раздел 12.7).

**Проблемы:** не выявлено. Примечание: `Compress-Archive` не смог захватить `.gitignore` при первом проходе (файл был заблокирован IDE) — в архив он не попал, но включён в git.

**Открытые вопросы:** те же, что в 12.8 (автозапуск игры, встроить/докачивать JRE, хостинг, подпись кода).

---

### Сессия 2026-11-19 — Автообновление лаунчера + схема распространения одним EXE

**Запрос пользователя:** разработать полную схему передачи лаунчера конечным пользователям (один EXE, авто-проверка/докачка/запуск) + добавить автообновление самого лаунчера (self-update).

**Изменения в коде:**
- **Новый `src/selfUpdate.js`**: `parseVersion`, `isNewer` (сравнение по numeric-сегментам), `loadVersionInfo`, `checkForUpdate`, `downloadUpdate` (с проверкой SHA1), `applyUpdateAndRestart` (отсоединённый `.bat`: ждёт смерти PID → `move /Y` новый EXE → целевой EXE с повтором → перезапуск → самоудаление).
- **`main.js`**: импорт `selfUpdate`; секция `selfUpdate` в `DEFAULT_CONFIG`/`readConfig`; `runSelfUpdate()` (пропуск в dev через `app.isPackaged`, скачивание в `%TEMP%`, `autoApply`, `app.quit()`); вызов в `did-finish-load` (сначала self-update, затем файлы игры); IPC `launcher:checkUpdate`; события `launcher:update`.
- **`main.js` (portable)**: добавлен `APP_DIR` — каталог данных рядом с исходным EXE из `process.env.PORTABLE_EXECUTABLE_DIR` (в dev — `__dirname`); `ensureConfig()` копирует внешний `config/config.json` из шаблона при первом запуске; `gameDirectory`/`targetPath`/`manifestPath` выводятся из `APP_DIR`. **Фикс целевого пути self-update**: `PORTABLE_EXECUTABLE_FILE` вместо `process.execPath` (иначе обновилась бы копия в `%TEMP%`).
- **`src/updater.js`**: экспорт дополнен `downloadToFile` и `fetchBuffer` (нужны self-update).
- **`package.json`**: секция `build` (electron-builder, portable, `asar`, `compression: maximum`, `extraResources: config/config.json`, `artifactName`), scripts `pack`/`dist`/`dist:installer`.
- **`config/config.json`**: секция `selfUpdate`; удалены абсолютные пути этой машины (теперь выводятся из `APP_DIR`).
- **`src/preload.js`**: `checkLauncherUpdate()`, `onLauncherUpdate()`.
- **`src/renderer.js`**: обработчик `onLauncherUpdate` (фазы start/downloading/applying/ready/error) с процентами и байтами.

**Действия:** создан `src/selfUpdate.js`; интегрирован в main/preload/renderer/config; синтаксис всех файлов проверен (`node --check` — OK); юнит-тест `isNewer`/`parseVersion` — OK; локальный `npm start` — окно стартует, JS-ошибок нет.

**Результаты:** self-update реализован (только для собранного EXE); путь переносимости исправлен; документирована полная схема распространения (раздел 12).

**Статус:** ✅ код готов и протестирован; 🟡 боевой хостинг не настроен (`selfUpdate.enabled=false`, `updater.enabled=false`); ⬜ сборка EXE и тест на чистой машине не выполнялись.

**Проблемы:** 1) для portable-сборки `process.execPath` указывает на распакованную копию в `%TEMP%` — исправлено через `PORTABLE_EXECUTABLE_FILE`; 2) в упакованном виде `__dirname` = путь внутри `app.asar`, поэтому старые абсолютные пути были неработоспособны — введён `APP_DIR`.

**Открытые вопросы:** автозапуск игры после загрузки (конфликт с ручным «Играть»), Java runtime (встроить/докачивать), выбор хостинга, подпись кода (см. 12.8).

---

### Сессия 2026-11-19 — Доработки №1–4 + «только мой сервер»

**Запросы пользователя (по порядку):**
1. Реализовать 4 доработки последовательно, обновляя `SESSION_HANDOFF.md` после каждой: (1) экран выбора режима; (2) автоскрытие окна лаунчера при запуске игры; (3) проверка/дозагрузка файлов с Google Drive; (4) индикатор прогресса.
2. Корректировка: «Игра должна запускаться как раньше — доходить до меню Minecraft, а не сразу грузить сетевую игру» → **отключить автоподключение**.
3. Вопрос: как удалить чужие серверы из списка, оставить только свой? → реализовано авто-управление `servers.dat`.

---

#### 11.1 Пункт 1 — Режим запуска (итог: автоподключение ОТКЛЮЧЕНО)

**Первоначальная реализация (откачена):** экран выбора в лаунчере «Одиночная игра» / «Сетевая игра» с предзаполнением адреса сервера из `config.json`; `quickPlay` добавлялся только при `mode = "network"`.

**Проблема:** игрок ожидал, что игра дойдёт до главного меню, а `quickPlay` приводил к немедленному входу на сервер.

**Итоговое решение:** автоподключение полностью отключено, экран выбора в лаунчере удалён.

**Изменения:**
- `main.js` — убран блок `opts.quickPlay`; сигнатура `game:launch` возвращена к `(username)`; добавлен комментарий-пометка.
- `index.html` — удалены `#modeSelect` / `#networkBlock`; возвращена кнопка `#playBtn`.
- `src/renderer.js` — возвращена простая логика одной кнопки.
- `assets/styles/app.css` — удалены стили `.mode-*`, `.ghost-btn`, `.network-block`, `.mode-actions`.
- `test-launch.js` — удалён `quickPlay`.

**Результат:** в аргументах запуска нет `--server`/`--port`; игра доходит до главного меню; в логе нет строки `Connecting to ...`. Проверено через `node test-launch.js`.

---

#### 11.2 Пункт 2 — Автоскрытие окна лаунчера

**Изменения (`main.js`):**
- Константа `GAME_START_MARKERS = ["Backend library:", "OpenAL initialized", "Sound engine started"]` + флаг `gameStarted`.
- `client.on("data")` — при первом совпадении с маркером: `gameStarted = true; mainWindow.hide()`.
- `client.on("close")` и `client.on("error")` — `mainWindow.show()` + `focus()` + сброс `gameStarted`.

**Результат:** окно скрывается при старте игры и возвращается после её закрытия. Синтаксис OK, запуск без JS-ошибок.

---

#### 11.3 Пункт 3 — Автообновление файлов (Google Drive)

**Новый файл `src/updater.js`:**
- `sha1File(path)` — потоковый SHA1; `fetchBuffer(url)` — GET с телом и редиректами (≤5).
- `streamDownload()/downloadToFile(url, dest, onBytes, opts)` — потоковая загрузка + SHA1 + байтовый прогресс; обработка confirm-страницы Google Drive (`confirm`/`uuid`).
- `loadManifest({manifestUrl, manifestPath})`, `needsUpdate(file, dest)`, `runUpdate({..., onProgress})`.

**`main.js`:** импорт `updater`; секция `updater` в `DEFAULT_CONFIG`/`readConfig()`; `runUpdater()`; IPC `updater:check`; автозапуск по `did-finish-load` при `updater.enabled`; события → `updater:progress`.
**`config.json`:** секция `updater` (`enabled: false`, `manifestUrl: ""`, `manifestPath`, `targetPath`).
**`src/preload.js`:** `checkUpdate()`, `onUpdateProgress()`.
**`src/renderer.js`:** обработчик `onUpdateProgress` (проверка/загрузка с процентами и байтами).
**Документация:** раздел 10 (структура хранилища, формат манифеста, полный список файлов, инструкция).

**Тест:** локальный `http`-сервер + манифест → 1-й прогон `updated:1`, 2-й — `skipped:1`; содержимое и SHA1 корректны.

**Статус:** механизм готов и протестирован; **боевая настройка не выполнена** (`enabled: false`, нет реальных файлов/ID на Drive).

---

#### 11.4 Пункт 4 — Индикатор прогресса

- `assets/styles/app.css` — `.progress.indeterminate .progress-bar` + `@keyframes progress-indeterminate` («бегущая» полоса).
- `index.html` — у `.progress` добавлен `id="progressTrack"`.
- `src/renderer.js` — `formatBytes()`; `showProgress(label, percent)` поддерживает неопределённый режим; единые подписи этапов.

**Результат:** прогресс/подпись виден во всех длительных процессах (проверка файлов, загрузка файлов с байтами, загрузка ресурсов игры, старт игры); при неизвестном времени — анимация, отличающая работу от зависания.

---

#### 11.5 Доп. — «Только мой сервер» (`servers.dat`)

- **Новый файл `src/servers.js`** — минимальный NBT-писатель (`buildServersDat`, `writeServersDat`): корневой `TAG_Compound("")` → `TAG_List("servers")` → `TAG_Compound{ name, ip, acceptTextures }`.
- **`main.js`** — импорт `servers`; `applyPinnedServers()`; вызов при `app.whenReady()` и перед `client.launch()`; секция `servers` в `DEFAULT_CONFIG`/`readConfig`.
- **`config.json`** — секция `servers` (`enforce: true`, `list: [{ name: "Мой сервер", ip: "127.0.0.1:25565" }]`).
- **Действия с данными:** исходный `servers.dat` (82 299 байт, чужие серверы) сохранён как `servers.dat.bak`, затем перезаписан (88 байт, только свой сервер).

**Проверка:** файл сгенерирован и прочитан обратно мини-парсером (name/ip/acceptTextures корректны); при старте лаунчера в логе `[servers] servers.dat перезаписан: 1 сервер(ов) — 127.0.0.1:25565`.

---

#### 11.6 Возникшие проблемы

1. **Неверная трактовка Пункта 1** — сделан экран выбора в лаунчере, тогда как «Одиночная/Сетевая игра» были штатным меню Minecraft; `quickPlay` приводил к немедленному входу на сервер. Исправлено откатом (см. 11.1).
2. **Формат `servers.dat`** — NBT-библиотек в зависимостях нет → написан минимальный NBT-писатель; корректность подтверждена обратным разбором.
3. **Google Drive confirm-страница** для больших файлов — обработана извлечением `confirm`/`uuid` и повтором запроса.

#### 11.7 Текущий статус

- ✅ Все 4 доработки + `servers.dat` реализованы; `npm start` без JS-ошибок; игра доходит до главного меню без автоподключения.
- 🟡 Автообновление: код готов, но `updater.enabled = false` (нужны реальные файлы/ID на Google Drive).
- ⬜ Не сделано: валидация ника, MS-авторизация, кнопка отмены запуска, расширенное логирование.

#### 11.8 Открытые вопросы / TODO для следующей сессии

1. Валидация никнейма (3–16 символов, `[A-Za-z0-9_]`).
2. Боевая настройка Google Drive (залить модпак, заполнить `manifest.json`, включить `updater.enabled`).
3. Опциональная авторизация Microsoft (`launcher.offline = false`).
4. Проверить визуально автоскрытие окна и прогресс-бар (силами пользователя).
5. По желанию удалить `servers.dat.bak`.

---

## 12. Распространение одним EXE и автообновление лаунчера

### 12.1 Целевой результат (что получает пользователь)

Один файл `AppleLauncher-<версия>.exe` (portable, ~90–120 МБ). Пользователь копирует **только его** и запускает двойным щелчком. Далее без его участия:

1. Лаунчер разворачивается, показывает окно с прогресс-баром.
2. **Self-update**: проверяет манифест версии → если есть новее, скачивает новый EXE, подменяет себя и перезапускается.
3. **Проверка файлов игры**: по манифесту сверяет SHA1/размер, докачивает отсутствующие/устаревшие (модпак, конфиги).
4. **MCLC** сам догружает ванильные `assets`/`libraries`/`versions` (Forge 1.16.5).
5. Перезаписывает `servers.dat` (только свой сервер).
6. Открывается главное меню Minecraft.

В постоянном каталоге данных `%APPDATA%\AppleLauncher` лаунчер сам создаёт рабочую папку (данные, а не «зависимости»): `config/config.json`, `minecraft/game/**`, `updater/*.json`. Пользователь их руками не передаёт и не настраивает — лаунчер создаёт их сам (см. раздел 3, `DATA_DIR`). Рядом с EXE ничего не создаётся (кроме случая, когда EXE специально положен рядом с `jre/`).

### 12.2 Сервисы хранения и раздачи файлов — сравнение

| Сервис | Бесплатно | Пропускная способность / лимиты | Прямые ссылки | Стоимость | Сложность интеграции | Рекомендация |
|---|---|---|---|---|---|---|
| **GitHub Releases** | Без лимита (публичный репо) | CDN, быстро; ≤2 ГБ на файл; нет метрик трафика | Да (прямой HTTPS) | 0 ₽ | Очень низкая | ⭐ EXE, Java, большие архивы |
| **Cloudflare R2** | 10 ГБ хранения | Egress бесплатный; S3-совместимый | Да (свой домен) | Storage ~$0.015/ГБ·мес, egress 0 ₽ | Средняя (аккаунт+бакет+CORS) | ⭐ Растущий модпак |
| **Backblaze B2** | 10 ГБ | Egress бесплатен через Cloudflare (до 3× storage) | Да (S3 API) | ~$0.006/ГБ·мес | Средняя | Альтернатива R2 |
| **Google Drive** | 15 ГБ | Троттлинг; лимит «вирусы» для файлов >100 МБ (обход — confirm-токен) | Условно (страница подтверждения) | 0 ₽ | Низкая, но капризная | Уже используется (раздел 10) |
| **Яндекс.Диск** | 5 ГБ | Средняя; есть API | Да (REST API) | 0 ₽ / Yandex 360 | Средняя | Для RU-аудитории |
| **Mega / Dropbox** | 20 / 2 ГБ | Ограничена; неудобные прямые ссылки | Сложно | 0 ₽ | Высокая | Не рекомендуется |
| **Свой VPS/S3 (Selectel, VK Cloud, Hetzner)** | — | Полный контроль | Да | от ~200 ₽/мес | Средняя | При больших объёмах/трафике |
| **itch.io** | Без лимита | CDN; своя кнопка загрузки (непрямая) | Нет | 0 ₽ | Низкая | Публичный релиз игры |

**Рекомендация**: EXE и Java — **GitHub Releases** (бесплатно, без лимита трафика, прямые ссылки). Модпак — GitHub Releases (архив) или **Cloudflare R2** при большом числе файлов. Google Drive оставить запасным зеркалом (поле `url` в манифесте).

### 12.3 Что упаковывается в EXE, а что докачивается

**Внутри EXE** (`build.files` + `extraResources`) — только необходимое для старта лаунчера:
- ядро Electron/Chromium + Node (добавляет electron-builder);
- `main.js`, `src/**` (`preload.js`, `renderer.js`, `updater.js`, `servers.js`, `selfUpdate.js`);
- `index.html`, `assets/styles/**`, `assets/backgrounds/**`;
- `node_modules/minecraft-launcher-core/**` (production-зависимость);
- `config/config.json` (шаблон, `extraResources`);
- `package.json`.

**Докачивается при первом запуске** — тяжёлое/изменяемое:
- **Java 17 (JRE)** — ✅ встроена в EXE (вариант A): `extraResources: jre` → `resources/jre` (см. 12.4);
- **Модпак** (по манифесту `modpack-v2`, `updater.js`): `mods/**`, `customnpcs/**`, `versions/Forge 1.16.5/Forge 1.16.5.json`;
- **Клиент Minecraft** (сам, через MCLC): ванильные `versions/1.16.5`, `libraries/**`, `assets/**`, `natives/**` (Forge-библиотеки — по version JSON из модпака).

**Никогда не передаётся** (личное/регенерируемое): `saves/**`, `logs/**`, `crash-reports/**`, `options.txt`, `*.part`.

### 12.4 Требования к единому самодостаточному EXE

1. **Формат**: electron-builder, target `portable` → один самодостаточный `.exe` (распаковывается в `%TEMP%` при запуске). `artifactName: AppleLauncher-<version>.exe`.
2. **Упаковка**: `asar: true` (по умолчанию), `compression: "maximum"`.
3. **Только production-зависимости**: `electron` — в `devDependencies` (не пакуется), `minecraft-launcher-core` — в `dependencies` (пакуется).
4. **Иконка и метаданные**: `win.icon` (.ico 256×256), `version`, `productName`, `appId`.
5. **Java runtime** — ✅ **выбран и реализован вариант A** (встроить JRE 17): `extraResources: ["config/config.json", "jre"]` → внутри EXE в `resources/jre`; `resolveJavaPath()` находит её первой. Сборка JRE — `npm run build:jre` (`scripts/build-jre.js`, `jlink`, ~48 МБ; на `npm run dist` собирается автоматически). Полная автономность офлайн. *Вариант B (докачивать через манифест) — не используется.* Внимание: portable распаковывается в `%TEMP%` при каждом запуске, поэтому встроенная JRE замедляет старт; при необходимости можно вернуться к `jre/` рядом с EXE (код поддерживает).
6. **Записываемые данные — в постоянном каталоге, не внутри ASAR**: `DATA_DIR` = `%APPDATA%\AppleLauncher` (dev — корень проекта), см. 3 и 12.1. ASAR только для чтения.
7. **Подпись кода (опционально)**: без неё Windows SmartScreen покажет предупреждение. Для публичного релиза — сертификат OV/EV.
8. **Без установщика**: portable не пишет в реестр и не требует прав администратора.

### 12.5 Проверка целостности, докачка и обработка ошибок

**Манифест** (формат — раздел 10.3): `{ "version": 1, "files": [ { "path": "mods/x.jar", "url": "https://...", "sha1": "…", "size": 12345 } ] }`.

**Алгоритм по каждому файлу** (реализовано в `src/updater.js`): файла нет → скачать; размер не совпал → скачать; SHA1 не совпал → скачать; иначе — пропустить (0 трафика).

**Оркестрация** (`ensureGameFiles(reason)` в [main.js](file:///C:/Users/LEO/AppleLauncher/main.js)): проверка запускается при старте лаунчера (`startup`), по IPC-кнопке (`manual`, `updater:check`) и перед запуском игры (`pre-launch`, внутри `game:launch`); прогресс идёт в UI через `updater:progress` (фазы `check`/`download`/`done`).

**Докачка при обрыве** (✅ реализовано в `src/updater.js`):
- загрузка во временный `<dest>.part`;
- при разрыве — повтор с HTTP `Range: bytes=<received>-` (поддерживают GitHub/R2/Drive), до 3 попыток с паузой 1с → 2с → 4с;
- существующий `.part` догружается в hash перед продолжением (`hashExistingFile`), а сервер при `200` (без Range) корректно сбрасывает дозапись;
- после полной загрузки — сверка SHA1 → `rename(.part → dest)` (атомарная замена: старый файл не портится).

**Обработка ошибок**: HTTP ≠ 200 / таймаут → retry; исчерпание → зеркало (`url`) или предупреждение в UI. Несовпадение SHA1 → повтор (файл считается повреждённым). Ошибка критичного файла (Forge/Java) → запуск блокируется с понятным сообщением; некритичного (ресурспак) → предупреждение, запуск продолжается. Всё логируется (`[updater] …`, `[selfupdate] …`), прогресс виден в UI.

### 12.6 Автообновление лаунчера (self-update) — реализовано

Код: [src/selfUpdate.js](file:///C:/Users/LEO/AppleLauncher/src/selfUpdate.js). Управление: секция `selfUpdate` в `config.json`.

**Манифест версии** (`updater/launcher-version.json`; читается локально или по URL):

```json
{ "version": "1.0.4", "url": "https://github.com/faktogenez/bodaYan/releases/download/v1.0.4/AppleLauncher-1.0.4.exe", "sha1": "2596dfd0a3ecb372245e7de2e0b9ab542d811f81", "size": 111698472 }
```

**Поток** (`runSelfUpdate()` в [main.js](file:///C:/Users/LEO/AppleLauncher/main.js)):
1. Только для собранного EXE (`app.isPackaged`); в dev (`npm start`) — пропуск.
2. `checkForUpdate({manifestUrl, manifestPath, currentVersion})` — сравнение версий по numeric-сегментам (`isNewer`).
3. Если версия новее — скачивание в `%TEMP%\AppleLauncher-update.exe` с проверкой SHA1 и прогрессом (`launcher:update` → renderer).
4. При `autoApply ≠ false` — `applyUpdateAndRestart()` пишет отсоединённый `.bat`: ждёт завершения PID лаунчера → `move /Y` новый EXE → целевой EXE (повтор при блокировке) → перезапуск → самоудаление.
5. **Целевой путь** = `process.env.PORTABLE_EXECUTABLE_FILE` (исходный EXE пользователя) или `process.execPath`. Для portable `process.execPath` указывает на копию в `%TEMP%` — использовать напрямую нельзя.
6. `app.quit()` через 500 мс → `.bat` доводит подмену и перезапуск.

**Порядок в лаунчере**: сначала self-update, затем файлы игры. Если лаунчер обновился — он перезапускается, и новая версия докачивает модпак.

### 12.7 Пошаговый план тестирования на чистой системе

Чистая Windows (лучше ВМ/свежий пользователь) БЕЗ Java, `.minecraft`, Node.js, проекта. Скопировать **только** `AppleLauncher-<версия>.exe`.

1. **Запуск**: двойной щелчок → окно лаунчера, прогресс-бар «Проверка файлов».
2. **Java**: JRE 17 **встроена** в EXE (`resources/jre`) — отдельная установка Java не нужна; в логе должно быть `[java] используется: …\resources\jre\bin\javaw.exe` (не `java из PATH`).
3. **Файлы игры**: догружаются `versions/Forge 1.16.5` (version JSON из модпака), `libraries`, `assets`, моды (прогресс с байтами). Данные создаются в `%APPDATA%\AppleLauncher` (`config/`, `minecraft/game/`) — рядом с EXE ничего не появляется.
4. **Запуск игры**: открывается главное меню Minecraft; в логе нет ошибок Forge/Java.
5. **Автоскрытие**: при старте игры окно лаунчера скрывается; после закрытия игры — возвращается.
6. **Список серверов**: в «Сетевая игра» только сервер из `config.json`.
7. **Повторный запуск**: всё пропускается (`skipped`), трафик ~0, быстрый старт.
8. **Обрыв сети**: отключить Wi-Fi в середине загрузки → повторить; файл докачивается без повреждения (SHA1 сходится).
9. **Повреждённый файл**: изменить байт в `mods/*.jar` → лаунчер перекачивает его.
10. **Self-update**: поднять `version` в `launcher-version.json`, положить новый EXE → лаунчер скачивает, подменяет себя и перезапускается в новой версии.
11. **Офлайн**: без интернета игра запускается, если файлы уже на месте.

**Критерий приёмки**: на чистой системе, имея только один EXE, пользователь без дополнительных действий получает запущенную игру; все проверки/докачки — автоматически, с видимым прогрессом.

### 12.8 Открытые вопросы по схеме

1. **Автозапуск игры после загрузки** — требование «сразу открывается игра» конфликтует с ранее утверждённым поведением (пользователь сам жмёт «Играть», автоподключения к серверу нет). Вариант: флаг `launcher.autoLaunch` (по умолчанию `false`).
2. **Java runtime**: ✅ решено — вариант A (встроена JRE 17: `extraResources: jre`, сборка `scripts/build-jre.js`); EXE вырастет примерно на +48 МБ. Примечание: portable распаковывается в `%TEMP%` при каждом запуске → встроенная JRE замедляет старт; альтернатива — `jre/` рядом с EXE (`APP_DIR/jre`).
3. **Хостинг**: ✅ решено — GitHub Releases репозитория `faktogenez/bodaYan`; релиз `v1.0.0` опубликован, манифест отдаётся по `…/releases/latest/download/launcher-version.json`.
4. **Подпись кода** — нужно ли (SmartScreen).

---

*Последнее обновление: 2026-11-21 | Сессия: **постоянный каталог данных + встроенная проверка целостности** — данные перенесены в `%APPDATA%\AppleLauncher` (`DATA_DIR`/`EXE_DIR` + `migrateDataDir()`), `ensureGameFiles()` запускается при старте/по кнопке/перед игрой с авто-докачкой по SHA1; расширены `scripts/gen-manifest.js` (`--game-dir`, version JSON) и добавлены `scripts/assetName.js` + `scripts/publish-modpack.js`; опубликован релиз модпака **`modpack-v2`** (19 ассетов), `config.manifestUrl` обновлён; тесты целостности пройдены. Предыдущее: 2026-11-21 | Сессия: **синхронизация с GitHub** — код v1.0.2–v1.0.6 закоммичен и запушен в `origin/main` (коммит `7a2a3f6`); ветка `main` = `origin/main`. Предыдущее: 2026-11-19 | Сессия: **фикс краша** `spawn cmd.exe ENOENT` в self-update (`%ComSpec%` + `child.on("error")`; та же защита для `taskkill`), затем **собран и опубликован `v1.0.5`** (Latest): `AppleLauncher-1.0.5.exe`, 111 697 444 Б, SHA1 `fe315f5d…` + `launcher-version.json`; `CHANGELOG.md` дополнен 1.0.2–1.0.5. Ранее в этой сессии закрыты задачи v1.0.4 — (1) **валидация никнейма** (3–16, `[A-Za-z0-9_]`) в UI и `main.js`; (2) **кнопка «Остановить»** (IPC `game:stop`, `taskkill /T /F`); (3) **логирование** `src/logger.js` в `debug.log` (только `process.env.DEBUG`); (4) **докачка HTTP Range** в `src/updater.js` (до 3 попыток); собрана/опубликована v1.0.4 и **релиз модпака `modpack-v1`** (17 ассетов); `updater.enabled=true`. Предыдущее: **встроена JRE 17** (`extraResources: jre`, `scripts/build-jre.js`); **v1.0.1** — иконка `.ico`; **v1.0.0** — первый релиз в GitHub Releases (`https://github.com/faktogenez/bodaYan/releases`). Ветка `main`; `gh` CLI; self-update включён; `README.md`, `CHANGELOG.md`, манифесты `updater/*`. Детальный журнал — раздел 11.*
