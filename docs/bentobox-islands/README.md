# BentoBox / BSkyBlock — аудит и правка генерации островов

Дата аудита: 2026-11-22. Сервер: `C:\Server_Skyblock` (Mohist 1.16.5, BentoBox 1.16.2, BSkyBlock 1.14.4).

> **Актуальность (2026-11-22).** Числовые параметры сетки в этом файле (раздел 4) уточнены концептом — см. **раздел 13** в [SESSION_HANDOFF.md](file:///C:/Users/LEO/AppleLauncher/SESSION_HANDOFF.md). Под «СкайБлок Деревня» принят шаг **`distance-between-islands = 64`** при `protection-range = 24` (участок 48×48, видимость с запасом). Кроме того, зафиксировано: обе схемы (`1.schem` — спавн, `2.schem` — стартовый остров) подлежат замене. Механика BentoBox, описанная ниже, остаётся справедливой; при числовом конфликте приоритет у раздела 13.

## 1. Что требовалось

- Размещение новых островов «по спирали» вокруг центрального спавна, в пределах зоны видимости.
- Строгая проверка коллизий: новые острова не пересекаются с существующими и не затрагивают территорию спавна.

## 2. Ключевой вывод по архитектуре

`BentoBox` здесь — плагин Bukkit (не мод), исходников в проекте нет, только jar.
Остров определяется по **сетке**: ключ ячейки вычисляется из координаты, делённой на `distance-between-islands`.
Поэтому:

- «спираль» реализуется как **порядок обхода ячеек сетки** от `start-x/start-z` наружу — это прямо описано в комментарии к самому конфигу ([config.yml](file:///C:/Server_Skyblock/plugins/BentoBox/addons/BSkyBlock/config.yml#L59-L64): *«Islands develop around this location both positively and negatively in a square grid»*);
- произвольная (не-сеточная) спираль с непрерывным радиусом ломает определение владельца территории, protection, Level, Border — для этого нужен отдельный аддон или форк BentoBox;
- строгая не-пересекаемость на сетке достигается только условием `protection-range <= distance-between-islands / 2`.

## 3. Что найдено в текущем состоянии

| Факт | Значение | Источник |
|---|---|---|
| `distance-between-islands` | 48 | [config.yml](file:///C:/Server_Skyblock/plugins/BentoBox/addons/BSkyBlock/config.yml#L54) |
| `protection-range` | **30 → перекрытие 6 блоков** | [config.yml](file:///C:/Server_Skyblock/plugins/BentoBox/addons/BSkyBlock/config.yml#L58) |
| `start-x / start-z` | -50 / 120 (не центр мира) | [config.yml](file:///C:/Server_Skyblock/plugins/BentoBox/addons/BSkyBlock/config.yml#L65-L67) |
| `max-islands` | -1 (безлимит, спираль ничем не ограничена) | [config.yml](file:///C:/Server_Skyblock/plugins/BentoBox/addons/BSkyBlock/config.yml#L86) |
| `view-distance` | 8 чанков = 128 блоков | [server.properties](file:///C:/Server_Skyblock/server.properties#L51) |
| Живой остров в БД | 1 шт., центр `(-50, 120)` | [Island JSON](file:///C:/Server_Skyblock/plugins/BentoBox/database/Island/BSkyBlock5f135ae5-f6d8-45f4-bf74-49641fa4da48.json#L4-L14) |
| Мир `bskyblock_world` | **отсутствует на диске** (будет пересоздан при старте) | `Test-Path` → False; лог `[BSkyBlock] Creating BSkyBlock world ...` |

### Доказательство реальных коллизий (исторические данные)

Все координаты островов выгружены в [islands-current.csv](file:///C:/Users/LEO/AppleLauncher/docs/bentobox-islands/islands-current.csv) (35 записей из `database` + `database_backup`).

1. **Одна и та же точка занята четырьмя островами** — координаты `(46,120)` и `(53,119)`:

   | Центр | protection | Box по X | Box по Z |
   |---|---|---|---|
   | 46, 120 | 30 | 16…76 | 90…150 |
   | 53, 119 | 30 | 23…83 | 89…149 |
   | 53, 119 | 50 | 3…103 | 69…169 |
   | 53, 119 (spawn island) | 800 | −747…853 | −681…919 |

   Все четыре пересекаются. Это и есть «новый остров наехал на соседний».

2. **Минимум четыре разных начала сетки** (остатки разных `start-x/start-z`):

   - `x ≡ 0 (mod 48)` → (0,0), (0,96), (96,96)
   - `x ≡ 5 (mod 48)` → (53,119), (53,215), (149,23)
   - `x ≡ 12 (mod 48)` → (300,300)
   - `x ≡ 6 (mod 48)` → (150,150)

   Острова из разных «эпох» не выравнены между собой, поэтому часть из них перекрывается, а Free-cell поиск работает непредсказуемо.

3. **Менялись и другие параметры:** `protection` встречается со значениями 30 (10 шт.), 50 (24 шт.), 800 (1 шт.); `y` центра — 56, 58, 75, 79, 120 (менялся `island-height`).
4. У всех 35 записей `deleted: false`, но 34 из них в живой БД отсутствуют → БД пересоздавалась, а мир удалён.

## 4. Принятые параметры

| Параметр | Было | Стало | Почему |
|---|---|---|---|
| `distance-between-islands` | 48 | 48 | сохраняем плотность: шаг 48 даёт 3 кольца в зоне видимости |
| `protection-range` | 30 | **24** | `24 + 24 = 48` — боксы соседей соприкасаются, но не пересекаются |
| `start-x` / `start-z` | -50 / 120 | **0 / 0** | центр мира = центр спирали |
| `max-islands` | -1 | **21** | число ячеек (шаг 48), целиком попадающих в 128 блоков от центра |

### Координаты всех 21 ячейки в зоне видимости (R = 128)

```
Кольцо 0 (1):  (0,0)
Кольцо 1 (8):  (±48,0), (0,±48), (±48,±48)
Кольцо 2 (12): (±96,0), (0,±96), (±96,±48), (±48,±96)
```
16 ячеек кольца 2 с диагональю √2·96 ≈ 135.8 > 128 исключены. Центральную ячейку `(0,0)` занимает спавн-остров, игрокам остаётся 20.

## 5. Как применить

Файлы:

- [BSkyBlock-config.patched.yml](file:///C:/Users/LEO/AppleLauncher/docs/bentobox-islands/BSkyBlock-config.patched.yml) — целевой конфиг (4 правки, diff проверен);
- [BSkyBlock-config.original.yml](file:///C:/Users/LEO/AppleLauncher/docs/bentobox-islands/BSkyBlock-config.original.yml) — исходник для сравнения/отката;
- [apply-bentobox-island-grid.ps1](file:///C:/Users/LEO/AppleLauncher/docs/bentobox-islands/apply-bentobox-island-grid.ps1) — применение на сервере.

Порядок:

1. **Остановить сервер** (скрипт сам откажется работать, если процесс `mohist` запущен — сейчас он запущен, PID 5196).
2. Запустить скрипт:

   ```powershell
   cd C:\Users\LEO\AppleLauncher\docs\bentobox-islands
   powershell -ExecutionPolicy Bypass -File .\apply-bentobox-island-grid.ps1
   ```

   Что он делает (ничего не удаляет, только копирует/перемещает):
   - создаёт `C:\Server_Skyblock\_archive\bentobox-reset-<дата>\`;
   - копирует туда текущий `BSkyBlock/config.yml` и `database_backup`;
   - **перемещает** живой `plugins\BentoBox\database` в архив (BentoBox создаст пустую БД);
   - перемещает туда же `bskyblock_world*`, если они появятся;
   - копирует патченный конфиг на место живого;
   - печатает итоговые значения пяти ключей для проверки.
3. Запустить сервер — `bskyblock_world` сгенерируется заново.
4. **Назначить центральную ячейку `(0,0)` спавн-островом** через админ-команду BSkyBlock (точную подкоманду посмотреть в `/bsbadmin help`). После этого первый игрок получит кольцо 1, и спираль пойдёт наружу.
5. Создать 2–3 тестовых острова и убедиться: центры лежат на сетке 48, привязанной к `0,0`; боксы защиты 24 не пересекаются.

## 6. Проверка результата

```powershell
# значения в живом конфиге
Select-String -Path C:\Server_Skyblock\plugins\BentoBox\addons\BSkyBlock\config.yml `
              -Pattern '^(distance-between-islands|protection-range|start-x|start-z|max-islands):'
```

В игре: `/bbox version`, `/bsbadmin island info <игрок>` — центр острова должен попадать в список из раздела 4.

## 7. Откат

```powershell
# конфиг
Copy-Item C:\Server_Skyblock\_archive\bentobox-reset-<дата>\BSkyBlock-config.yml.before `
          C:\Server_Skyblock\plugins\BentoBox\addons\BSkyBlock\config.yml -Force
# БД
Remove-Item C:\Server_Skyblock\plugins\BentoBox\database -Recurse -Force
Move-Item   C:\Server_Skyblock\_archive\bentobox-reset-<дата>\database.live `
            C:\Server_Skyblock\plugins\BentoBox\database
```

## 8. Ограничения и что осталось за рамками

- **Свободная спираль невозможна без кода.** Реализован порядок обхода сетки BentoBox; непрерывная спираль с плавным радиусом требует аддона (вариант A) или форка `NewIsland` (вариант C) — отдельная задача, нужен BentoBox API 1.16.2 и сборка Gradle.
- **Геометрическая проверка bbox** внутри BentoBox не настраивается конфигом. Непересекаемость здесь обеспечена *математически* (`protection = distance/2`), а не проверкой при создании.
- **Три системы границ конфликтуют:** Border-аддон [Border/config.yml](file:///C:/Server_Skyblock/plugins/BentoBox/addons/Border/config.yml#L11) (`use-wbapi: true`), `WorldBorderPlugin-1.165.0.jar`, `EssentialsXSpawn-2.22.0.jar`. Не трогал; рекомендую оставить одну — иначе «зона видимости» трактуется по-разному.
- **`max-islands: 21` — жёсткий лимит.** При изменении `view-distance` (или если спавн-остров учитывается в счётчике) значение нужно пересчитать. Вернуть безлимит: `max-islands: -1`.
- `protection-range: 24` уменьшает площадь острова примерно на 36 % относительно 30. Если приоритет — площадь, а не плотность, альтернатива: `distance: 64` + `protection: 30`.
- Скрипт `.ps1` намеренно содержит только ASCII, потому что PowerShell 5.1 читает файлы без BOM как ANSI и портит кириллицу в сообщениях.
