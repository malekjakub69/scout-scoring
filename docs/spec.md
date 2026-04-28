# Scout Scoring — Specifikace

Webová aplikace pro skautské závody, kde organizátor spravuje závod a hlídky, a rozhodčí na stanovištích zadávají body přes jednorázový přístup (QR/PIN) bez nutnosti účtu.

## Problem & Goal

Skautské závody (Svojsíkův závod, ZVaS atd.) dnes bodují rozhodčí typicky na papír, což vede k chybám, pomalému vyhlašování výsledků a zdlouhavému přepisování. Existující nástroje vyžadují, aby si každý rozhodčí zakládal účet nebo pamatoval heslo — to je v terénu s desítkami dobrovolníků neprůchodné.

**Cíl:** Digitalizovat bodování tak, aby rozhodčí byl produktivní do 10 sekund od otevření telefonu, bez registrace, bez školení, a aby organizátor měl po celou dobu závodu real-time přehled o průběhu.

**Success = projet jeden reálný skautský závod end-to-end bez nutnosti fallbacku na papír.**

## Users & ICP

**Primární doména:** skautské závody, konkrétně:
- Svojsíkův závod (okresní, krajská, celostátní kola)
- Závod vlčat a světlušek (ZVaS)
- Další oddílové / střediskové závody podobného formátu

**Personas:**
1. **Organizátor závodu** — vedoucí střediska / okresu. Trvalý účet (email + heslo). Spravuje závod, hlídky, stanoviště, konfiguruje bodování, sleduje průběh, exportuje výsledky.
2. **Rozhodčí na stanovišti** — dobrovolník (rodič, starší skaut, instruktor). **Nemá účet.** Dostane vytištěnou Login Card s QR kódem a PINem. Ve formuláři zadává body odbaveným hlídkám.
3. **Hlídka (soutěžící)** — tým 3–6 dětí s unikátním startovním číslem. Nezadává do systému nic; může si přes svůj kód zobrazit vlastní průběžné výsledky.

## Value Proposition

**Core value:** Nulová bariéra pro rozhodčího + real-time přehled pro organizátora.

**Diferenciace:**
- **One-Time Station Access (OTSA):** rozhodčí se přihlásí naskenováním QR kódu — žádný účet, žádné heslo, žádné školení.
- **Konfigurovatelné bodování per stanoviště:** dynamické formuláře s pod-kritérii (např. První pomoc = Resuscitace 10b + Obvazy 5b), ne jen jedno políčko "body".
- **Zaměření na skautskou doménu:** přednastavené kategorie (dívčí / chlapecké družiny + nesoutěžní), terminologie a flows odpovídající reálným závodům, ne generický "scoring tool".
- **Transparentnost pro hlídky bez spoilerů:** hlídky vidí detail vlastních bodů, ale ne pořadí — motivace bez předčasného vyzrazení výsledků před vyhlášením.
- **Použitelnost v terénu:** MVP jako optimalizovaná webová PWA, s cestou k plnému offline režimu.

## Key Features / Flows

### A. Příprava závodu (Organizátor)
1. Založí závod (název, datum, lokalita).
2. Zvolí **model bodování** (součet bodů / součet pořadí / body + čas tiebreaker) a zda se **sleduje čas** (žádný / per stanoviště / jen start–cíl).
3. Definuje **kategorie** (dívčí / chlapecké / nesoutěžní; každá má vlastní výsledkovku).
4. Přidá **stanoviště** a pro každé definuje kritéria bodování (např. `[{name: "Uzlování", max: 5}, {name: "Teorie", max: 10}]`).
   Stanoviště lze vytvořit ručně **nebo přes AI import** — organizátor nahraje
   PDF / TXT s rozpisem závodu, AI (OpenAI Responses API, default `gpt-5-mini`,
   structured outputs) vrátí draft + případné doplňující otázky. Po jejich
   zodpovězení a kontrole náhledu se stanoviště uloží hromadně přes
   `/api/races/:race_id/stations/bulk`. BE validuje formát odpovědi a při
   chybě jednou retryne; po druhém selhání vrací `422 ai_invalid_format`.
5. **Importuje hlídky** z CSV / Excelu **nebo** zadá manuálně v admin UI. Každá hlídka má startovní číslo, název, kategorii, členy.

### B. Aktivace závodu
1. Organizátor klikne **"Generovat přístupy"**.
2. Systém pro každé stanoviště vygeneruje **Login Card (PDF k tisku)** s:
   - názvem stanoviště,
   - jednorázovým ID + PINem,
   - QR kódem s tokenizovanou URL.
3. Organizátor vytiskne karty a rozdá rozhodčím spolu s pokyny.

### C. Průběh závodu (Rozhodčí)
1. Rozhodčí naskenuje QR kód → rovnou v aplikaci, žádné přihlašování.
2. Vidí dashboard "Stanoviště X — [název]" s formulářem.
3. Zadá startovní číslo hlídky → systém zobrazí pole pro všechna kritéria stanoviště (dynamicky generováno).
4. Vyplní body a (pokud závod sleduje čas) čas příchodu/odchodu.
5. Odešle → záznam je uložen a zobrazen jako odbavený.
6. **Editace je povolena po celou dobu závodu** — rozhodčí si může svůj záznam kdykoliv upravit, dokud závod nebyl uzavřen organizátorem.

### D. Monitoring (Organizátor)
1. Master dashboard s real-time pohledem:
   - **Hlídky:** kolik stanovišť prošly, průběžné body, poslední aktivita.
   - **Stanoviště:** kolik hlídek odbavilo, které ještě nemá.
   - **Leaderboard** per kategorie.
2. Organizátor může ručně opravit jakýkoliv záznam.
3. Na konci závodu kliknutím "Uzavřít závod" zamkne všechny záznamy.

### E. Výstupy
1. **Finální výsledkovka** per kategorie (PDF + CSV export).
2. **Self-service pro hlídky:** každá hlídka si přes své startovní číslo + jednoduchý kód zobrazí **detail vlastních bodů** ze všech stanovišť, kterými už prošla (včetně rozpadu na jednotlivá kritéria). **Nevidí své pořadí** v kategorii ani výsledky jiných hlídek — průběžné pořadí je výhradně v rukou organizátora až do vyhlášení.

## UX Priorities

Seřazeno podle důležitosti:

1. **Rychlost rozhodčího v terénu** — od QR skenu po odeslání prvního záznamu max. 10 sekund. Žádný onboarding, žádné zbytečné kroky.
2. **Jasnost admin UI při tlaku** — organizátor konfiguruje závod hodinu před startem ve stresu; flows musí být lineární a nezaseknutelné.
3. **Čitelnost na mobilu** — rozhodčí mají telefony všech velikostí; formuláře musí být velké, s vysokým kontrastem (čtou se na slunci).
4. **Odolnost vůči překlepům** — validace startovních čísel, varování před přepsáním existujícího záznamu, confirm na destruktivní akce.
5. **Estetická polish** — prezentovatelné před skautskou komunitou, ale až po funkčnosti.

## Technical Constraints

### Stack
- **Frontend:** Next.js (TypeScript, React)
- **Backend:** Elixir API
- **Database:** SurrealDB
- **Deploy:** TBD (preferovaně něco, kde Elixir běží bez bolesti — Fly.io / vlastní VPS)

### Architektura autentizace

**Organizátor:** klasický email + heslo, session / JWT.

**Stanoviště (OTSA):**
- `Station` entity má pole `access_token` (hashované v DB, jako heslo), `pin`, `is_active`, `expires_at`.
- QR kód obsahuje URL typu `https://app/station/:stationId?token=:jwt` kde `jwt` je krátkodobě platný podepsaný token obsahující `stationId` a expiraci = konec závodu + 24h buffer.
- Backend ověřuje token u každého API requestu (statelessness, žádná klasická session).
- Scope tokenu je omezený na: `read patrols for race`, `read station config`, `write scores for this station`.
- PIN slouží jako fallback pro případ, že QR nefunguje (ručně zadat stationId + PIN).

### Datový model (high-level)

- `Race` — název, datum, stav, config bodování (model, time tracking, kategorie)
- `Category` — název, scope v rámci Race (dívčí / chlapecké / nesoutěžní)
- `Patrol` — startovní číslo, název, Category, členové, selfservice kód
- `Station` — Race, název, pořadí, `criteria: [{name, max_points}]`, access_token, pin, is_active
- `ScoreEntry` — Station, Patrol, `scores: [{criterion, points}]`, optional `arrived_at` / `departed_at`, timestamp, submittedBy (stationId)

### Rozsah / scale
- Jeden závod: do 25 hlídek × do 15 stanovišť = ~375 score entries.
- Každý organizátor si pro každou akci zakládá nový závod (žádné znovupoužití / klonování v MVP).
- Více závodů souběžně od různých organizátorů.
- Multi-tenancy v základu (každý organizátor vidí jen své závody), ale žádný enterprise scale.

### Konektivita
- **MVP:** pouze online. Dokumentovat pro rozhodčí, že stanoviště musí mít signál.
- **v2:** PWA s offline-first režimem — lokální uložení score entries a synchronizace při obnovení připojení. IDs musí být generovatelné client-side (ULID / UUID) pro konfliktu-prostou synchronizaci.

### Security
- Access tokeny stanovišť hashované v DB.
- JWT krátce platné (expire = konec závodu + buffer), nerevokovatelné = OK pro tento scope.
- Rate-limiting na endpoint pro zadávání bodů (ochrana proti omylům / spamu).
- Organizátor může kdykoliv deaktivovat stanoviště → invaliduje tokeny.

## Success Metrics

**Primární (MVP):**
- ✅ Jeden reálný skautský závod (min. 30 hlídek, min. 8 stanovišť) proběhne end-to-end výhradně v aplikaci, bez fallbacku na papír.
- ✅ Rozhodčí nevyžadují individuální školení; stačí rozdat karty + 1 stránka instrukcí.
- ✅ Výsledkovka je vyhlášena do 30 min po doběhnutí poslední hlídky.

**Sekundární (post-MVP):**
- Adopce dalšími středisky / okresy (počet závodů / sezónu).
- Průměrná doba zadání jedné hlídky rozhodčím (target < 30 s).
- Nula support ticketů od rozhodčích typu "nemůžu se přihlásit".

## MVP Scope

**V MVP:**
- ✅ Správa závodů, hlídek, stanovišť s konfigurovatelnými kritérii
- ✅ Import hlídek z CSV + manuální zadání
- ✅ Kategorie (dívčí / chlapecké / nesoutěžní) se samostatnými výsledkovkami
- ✅ Konfigurovatelný model bodování + konfigurovatelný time tracking
- ✅ OTSA přístup pro rozhodčí (QR + PIN, Login Cards jako PDF)
- ✅ Dynamické bodovací formuláře podle konfigurace stanoviště
- ✅ Dashboard pro organizátora (REST polling, bez real-time)
- ✅ Export výsledků (JSON z BE; PDF/CSV generuje FE)
- ✅ Editace záznamů rozhodčím po celou dobu závodu, uzavření závodu uzamkne vše

**Záměrně NE v MVP (odloženo na v2+):**
- ❌ Self-service náhled vlastních bodů pro hlídky
- ❌ Real-time dashboard (WebSockets / Phoenix Channels)
- ❌ Offline režim / PWA synchronizace (MVP je online-only)
- ❌ Integrace se skautIS
- ❌ Veřejná projekce leaderboardu (pro diváky, rodiče na velkém displeji)
- ❌ Mobilní native app
- ❌ Historická analytika napříč závody
- ❌ Multi-language (jen CZ)
- ❌ Pokročilá role management (asistent organizátora, apod.)

## Technická rozhodnutí (MVP)

Upřesnění tech stacku a doménových pravidel, která platí pro MVP:

### Architektura & stack
- **API styl:** REST only, bez real-time (WebSockets/Channels až v dalších fázích). FE řeší aktualizace dashboardu pollingem.
- **Monorepo:** jeden repozitář, `apps/api` (Elixir/Phoenix) + `apps/web` (Next.js).
- **SurrealDB:** verze **3.x**. V Elixiru žádný oficiální klient — napíšeme tenký HTTP klient proti SurrealDB HTTP API.
- **PDF výstupy:** BE vrací jen data (JSON). Generování PDF (Login Cards, výsledkovka) řeší FE.
- **CSV import hlídek:** parsuje FE, na BE posílá JSON (jednodušší validace v UI).

### Autentizace organizátora
- **Invite-only.** Veřejná registrace není, email verifikace se v MVP neřeší.
- **JWT** (short-lived + refresh), žádná server-side session.
- První organizátor se vytváří přes seed / mix task; další si zve stávající organizátoři (flow doladíme v UI vrstvě).

### Doménová pravidla
- **Self-service pro hlídky NENÍ v MVP.** Hlídky nic nevidí; výsledky publikuje organizátor mimo aplikaci (offline vyhlášení). Feature E.2 ze spec odložena.
- **Identifikace hlídky rozhodčím:** FE zobrazí seznam hlídek daného závodu seřazených podle startovního čísla, rozhodčí vybere. BE vrací plný seznam, filtering/UX dělá FE.
- **Opakovaná návštěva stanoviště:** unique constraint `(station_id, patrol_id)` → nový zápis **přepisuje** stávající `ScoreEntry`. Historie se nedrží v doméně, ale **všechny akce (create/update/delete score entries, auth události, admin akce) se logují do audit logu**.
- **Scoring model MVP:** jen *součet bodů ze všech stanovišť*. Ostatní modely (součet pořadí, body+čas) odložené. Shody ve výsledcích se v MVP neřeší programově.
- **Neodbavená stanoviště:** chybějící `ScoreEntry` = **0 bodů** do celkového součtu.
- **Uzavření závodu:** pouze uzamkne editaci záznamů (rozhodčí i organizátor). Žádná automatická publikace hlídkám.

### Otevřené body (neblokují start implementace)
1. Deploy target — upřesníme před prvním reálným nasazením.
2. Formát a layout Login Cards (A4 / A6, 1 PDF vs. per-stanoviště) — řeší FE při implementaci tisku.
3. Onboarding pro organizátora (prázdný stav, nápověda) — UX věc, řeší FE.
4. Tiebreakers ve výsledkovce — doplnit až na základě reálné potřeby z prvního závodu.

## Rizika
1. **Signál v terénu:** MVP je online-only. Pokud na stanovišti vypadne internet, rozhodčí nezadává. → Mitigace: dokumentace pro organizátora, aby ověřil pokrytí; fallback = papírová tabulka, přepíše organizátor dodatečně.
2. **Chyby rozhodčích:** špatné startovní číslo, překlep v bodech. → Editace povolena celou dobu závodu + organizátor může opravit cokoliv. UI musí zobrazit "Přepisuješ existující záznam pro hlídku X".
3. **SurrealDB zralost:** méně používaná DB, menší ekosystém, žádný oficiální Elixir klient. → Přijatelné pro tento scope, ale mít plán B (Postgres + Ecto).
4. **Elixir / Next.js kombinace:** dva jazyky = vyšší nárok na dev setup. → Smysluplné jen pokud team Elixir už umí.
5. **Adopce jinými organizátory:** aplikace může skončit jako one-off nástroj pro jedno středisko. → Až po MVP; nejdřív dokázat hodnotu na jednom závodě.
