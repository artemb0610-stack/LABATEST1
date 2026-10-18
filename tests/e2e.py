"""
Сквозные тесты прототипа в браузере (Chromium, мобильная эмуляция).
Запуск: python3 -m http.server 8765 (в папке проекта) и затем python3 tests/e2e.py [папка_для_скриншотов]
"""
import asyncio, sys, os
from playwright.async_api import async_playwright

URL = os.environ.get('KB_URL', 'http://localhost:8765/index.html')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
FAILS, PASSES = [], []

def check(cond, name, extra=''):
    (PASSES if cond else FAILS).append(name + ((' — ' + str(extra)) if (extra and not cond) else ''))

async def collect_errors(pg, errs):
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)

async def set_amount(pg, v):
    await pg.click('#demoFab'); await pg.fill('#demoAmount', str(v)); await pg.click('#demoSet')
    await pg.wait_for_timeout(500)

async def overflow(pg):
    """Горизонтальное переполнение активного экрана и выход суммы за карточку."""
    return await pg.evaluate("""() => {
      const s = document.querySelector('.screen.is-active');
      const res = { screen: s.dataset.screen, scroll: s.scrollWidth - s.clientWidth };
      const a = document.getElementById('amount'), h = document.querySelector('.hero');
      if (s.dataset.screen === 'piggy') {
        const ar = a.getBoundingClientRect(), hr = h.getBoundingClientRect();
        res.amountOut = Math.max(0, hr.left - ar.left, ar.right - hr.right);
      }
      return res;
    }""")

async def scenario_layouts(b):
    for (w, h) in [(360, 740), (390, 844), (430, 932), (844, 390)]:
        ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        pg = await ctx.new_page(); errs = []; await collect_errors(pg, errs)
        await pg.goto(URL); await pg.wait_for_timeout(900)
        o = await overflow(pg); check(o['scroll'] <= 0, f'{w}x{h} главный без гориз. прокрутки', o)
        await pg.click('.tab[data-tab=piggies]'); await pg.wait_for_timeout(300)
        o = await overflow(pg); check(o['scroll'] <= 0, f'{w}x{h} копилки без гориз. прокрутки', o)
        for theme in ['auto', 'strict', 'banknote', 'cubes', 'shimmer', 'mirror', 'green']:
            for v in [7, 1234, 12321, 999999, 99999999]:
                await set_amount(pg, v)
                await pg.evaluate("t => { localStorage.setItem('kb.digits.theme', t); }", theme)
                await pg.click('#styleBtn'); await pg.wait_for_timeout(120)
                await pg.click(f'[data-theme="{theme}"]'); await pg.click('.sheet__panel [data-close-sheet]'); await pg.wait_for_timeout(120)
                o = await overflow(pg)
                check(o['scroll'] <= 0 and o.get('amountOut', 0) <= 1, f'{w}x{h} сумма {v} в стиле {theme} помещается', o)
        await pg.click('.screen.is-active [data-back]'); await pg.wait_for_timeout(350)
        await pg.click('.tab[data-tab=home]'); await pg.click('text=Посмотреть историю'); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('.screen.is-active').scrollTop = 1e9"); await pg.wait_for_timeout(1000)
        o = await overflow(pg); check(o['scroll'] <= 0, f'{w}x{h} история с планетой без гориз. прокрутки', o)
        await pg.click('.screen.is-active [data-back]'); await pg.click('.tab[data-tab=piggies]'); await pg.click('[data-piggy="0"]'); await pg.wait_for_timeout(400)
        await pg.click('#styleBtn'); await pg.wait_for_timeout(200)
        sheet_over = await pg.evaluate("() => { const p = document.querySelector('.sheet__panel'); return p.scrollWidth - p.clientWidth; }")
        check(sheet_over <= 0, f'{w}x{h} шторка оформлений без гориз. прокрутки', sheet_over)
        await pg.screenshot(path=f'{OUT}/qa_{w}x{h}_sheet.png')
        await pg.click('.sheet__panel [data-close-sheet]')
        await pg.click('#demoFab'); await pg.wait_for_timeout(150)
        demo_over = await pg.evaluate("() => { const d = document.getElementById('demo'); return d.scrollWidth - d.clientWidth; }")
        check(demo_over <= 0, f'{w}x{h} демо-панель без гориз. прокрутки', demo_over)
        await pg.click('#demoClose')
        await pg.click('text=Пополнить копилку'); await pg.wait_for_timeout(400)
        o = await overflow(pg); check(o['scroll'] <= 0, f'{w}x{h} пополнение без гориз. прокрутки', o)
        check(not errs, f'{w}x{h} без ошибок в консоли', errs)
        await ctx.close()

async def scenario_flows(b):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
    pg = await ctx.new_page(); errs = []; await collect_errors(pg, errs)
    await pg.goto(URL); await pg.wait_for_timeout(900)
    bal = await pg.inner_text('#homeBalance'); check('3' in bal and ',40' in bal, 'баланс с копейками', bal)

    # пополнение: валидация
    await pg.click('.tab[data-tab=piggies]'); await pg.click('[data-piggy="0"]'); await pg.wait_for_timeout(400)
    await pg.click('text=Пополнить копилку'); await pg.wait_for_timeout(400)
    await pg.click('#topupGo'); check(await pg.is_visible('#topupError'), 'пустая сумма → ошибка')
    await pg.fill('#topupInput', 'абв'); await pg.click('#topupGo'); check(await pg.is_visible('#topupError'), 'буквы → ошибка')
    await pg.fill('#topupInput', '999999'); await pg.click('#topupGo')
    check('нет' in (await pg.inner_text('#topupError')), 'больше баланса → ошибка')
    # двойной тап «Отложить» — деньги списываются один раз
    await pg.fill('#topupInput', '20')
    await pg.click('#topupGo'); await pg.click('#topupGo', force=True, no_wait_after=True)
    await pg.wait_for_timeout(1600)
    st = await pg.evaluate("() => document.querySelector('.screen.is-active').dataset.screen")
    check(st == 'piggy', 'после «Отложить» — экран копилки', st)
    amt = await pg.get_attribute('#amount', 'data-text')
    check(amt and amt.replace(' ', '').startswith('1000'), 'двойной тап: 980 + 20 = 1000, списано один раз', amt)
    check(await pg.get_attribute('#amount', 'data-pattern') == 'guilloche', '1000 после пополнения — купюра')

    # спам тапов по сумме — плашки не копятся
    for _ in range(12): await pg.click('#amount', no_wait_after=True)
    await pg.wait_for_timeout(200)
    n = await pg.evaluate("document.querySelectorAll('.toast').length")
    check(n <= 2, 'спам тапов: не больше 2 плашек', n)

    # уход на оплату во время эффекта — слой гаснет
    await pg.click('#amount'); await pg.wait_for_timeout(100)
    await pg.click('.screen.is-active [data-back]'); await pg.wait_for_timeout(350)
    await pg.click('.tab[data-tab=home]'); await pg.wait_for_timeout(200)
    await pg.click('text=Скинуть денег'); await pg.wait_for_timeout(350)
    n = await pg.evaluate("document.querySelectorAll('.toast').length")
    check(n == 0, 'на экране оплаты нет плашек', n)
    blank = await pg.evaluate("""() => { const c = document.getElementById('fxCanvas'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; }""")
    check(blank, 'на экране оплаты холст эффектов пуст')

    # двойной тап «назад» в одну точку (как пальцем): уходим ровно на один экран
    await pg.click('.screen.is-active [data-back]'); await pg.wait_for_timeout(400)   # с оплаты на главный
    await pg.click('.tab[data-tab=piggies]'); await pg.click('[data-piggy="0"]'); await pg.wait_for_timeout(400)
    await pg.click('text=Пополнить копилку'); await pg.wait_for_timeout(400)
    box = await pg.locator('.screen.is-active [data-back]').bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    await pg.mouse.click(x, y); await pg.mouse.click(x, y)
    await pg.wait_for_timeout(500)
    st = await pg.evaluate("() => [...document.querySelectorAll('.screen.is-active')].map(s => s.dataset.screen)")
    check(st == ['piggy'], 'двойной тап «назад»: с пополнения ровно на копилку', st)
    await pg.click('.screen.is-active [data-back]'); await pg.click('.tab[data-tab=home]'); await pg.wait_for_timeout(300)

    # системная кнопка «назад» браузера / Android
    await pg.click('.tab[data-tab=piggies]'); await pg.click('[data-piggy="1"]'); await pg.wait_for_timeout(400)
    await pg.click('text=Пополнить копилку'); await pg.wait_for_timeout(400)
    await pg.go_back(); await pg.wait_for_timeout(500)
    st = await pg.evaluate("() => document.querySelector('.screen.is-active').dataset.screen")
    check(st == 'piggy' and pg.url.endswith('index.html'), 'системный «назад» с пополнения → копилка, со страницы не уходим', (st, pg.url))
    await pg.go_back(); await pg.wait_for_timeout(500)
    st = await pg.evaluate("() => document.querySelector('.screen.is-active').dataset.screen")
    check(st == 'piggies', 'системный «назад» с копилки → список', st)

    # достижение цели: сапоги 450 из 500 → +50
    await pg.click('[data-piggy="1"]'); await pg.wait_for_timeout(400)
    await pg.click('text=Пополнить копилку'); await pg.wait_for_timeout(400)
    await pg.fill('#topupInput', '50'); await pg.click('#topupGo'); await pg.wait_for_timeout(1500)
    toasts = await pg.evaluate("[...document.querySelectorAll('.toast')].map(t => t.textContent)")
    check(any('Цель' in t or 'купюр' in t for t in toasts), 'цель 500 достигнута: плашка', toasts)
    await pg.wait_for_timeout(2500)
    await pg.click('.screen.is-active [data-back]'); await pg.wait_for_timeout(400)
    check(await pg.locator('.pcard--done').count() >= 1, 'в списке карточка «Ура! Ты накопил»')
    await pg.click('.pcard--done'); await pg.wait_for_timeout(400)
    st = await pg.evaluate("() => document.querySelector('.screen.is-active').dataset.screen")
    check(st == 'piggy', 'карточка достигнутой цели открывается', st)

    # главная: суммы обновились
    await pg.click('.screen.is-active [data-back]'); await pg.click('.tab[data-tab=home]'); await pg.wait_for_timeout(400)
    saved = await pg.inner_text('#homeSaved'); check(saved.replace(' ', '').startswith('6130'), 'плашка «в копилках» пересчиталась (6060+20+50)', saved)
    bal = await pg.inner_text('#homeBalance'); check(bal.replace(' ', '').startswith('3180'), 'баланс уменьшился на 70', bal)

    # битый конфиг: приложение живо, затем сброс
    await pg.click('#demoFab'); await pg.click('summary.demo__label'); await pg.click('#demoBreak'); await pg.click('#demoClose')
    await set_amount(pg, 1234)
    check(await pg.get_attribute('#amount', 'data-pattern') is None, 'битый конфиг: эффекты выключены, сумма показана')
    await pg.click('#styleBtn'); await pg.wait_for_timeout(200)
    check(await pg.is_hidden('#styleSheet'), 'битый конфиг: меню оформлений не открывается и не падает')
    await pg.click('#amount')
    await pg.click('#demoFab'); await pg.click('#demoReset'); await pg.click('#demoClose'); await pg.wait_for_timeout(200)
    await set_amount(pg, 1234)
    check(await pg.get_attribute('#amount', 'data-pattern') is not None, 'после сброса конфига всё снова работает')

    # редактор CMS: выключить/включить, добавить/удалить
    await pg.click('#demoFab')
    idx = await pg.evaluate("[...document.querySelectorAll('#cmsRules .cms__name')].findIndex(e => e.textContent === 'Цифры по порядку')")
    await pg.click(f'[data-toggle="{idx}"]'); await pg.click('#demoClose')
    await pg.evaluate("localStorage.setItem('kb.digits.theme','auto')")
    await pg.click('#styleBtn'); await pg.click('[data-theme="auto"]'); await pg.click('.sheet__panel [data-close-sheet]')
    await set_amount(pg, 1234)
    check(await pg.get_attribute('#amount', 'data-pattern') is None, 'CMS: лесенка выключена → 1234 обычное')
    await pg.click('#demoFab'); await pg.click(f'[data-toggle="{idx}"]'); await pg.fill('#cmsNum', '2026'); await pg.click('#cmsAdd')
    await pg.wait_for_timeout(1300)
    check(await pg.get_attribute('#amount', 'data-pattern') is not None, 'CMS: добавленное 2026 оформлено')
    await pg.click('#demoFab'); await pg.click('[data-del]'); await pg.click('#cmsNum'); await pg.click('#cmsAdd')
    check('больше нуля' in await pg.inner_text('#cmsMsg'), 'CMS: пустое число → понятная ошибка')
    await pg.click('#demoClose')

    # клавиатурный ввод суммы «1 000» с пробелом
    await pg.click('text=Пополнить копилку'); await pg.wait_for_timeout(400)
    await pg.fill('#topupInput', '1 0'); await pg.click('#topupGo'); await pg.wait_for_timeout(300)
    st = await pg.evaluate("() => document.querySelector('.screen.is-active').dataset.screen")
    check(st == 'piggy', 'ввод «1 0» с пробелом принимается как 10', st)

    check(not errs, 'сценарии без ошибок в консоли', errs)
    await ctx.close()

async def scenario_offline(b):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = await ctx.new_page(); errs = []; await collect_errors(pg, errs)
    await pg.goto(URL); await pg.evaluate("navigator.serviceWorker.ready"); await pg.wait_for_timeout(1200)
    await ctx.set_offline(True)
    for i in range(2):
        await pg.reload(); await pg.wait_for_timeout(1000)
        check('₽' in await pg.inner_text('#homeBalance'), f'офлайн перезагрузка #{i+1}: главный открылся')
    await pg.click('.tab[data-tab=piggies]'); await pg.click('[data-piggy="0"]'); await pg.wait_for_timeout(400)
    await set_amount(pg, 7777)
    check(await pg.get_attribute('#amount', 'data-pattern') is not None, 'офлайн: конфиг из кэша, 7777 оформлено')
    await pg.click('#amount'); await pg.wait_for_timeout(300)
    check(await pg.locator('.toast').count() >= 1, 'офлайн: эффект по тапу работает')
    await pg.click('#styleBtn'); await pg.wait_for_timeout(200)
    check(await pg.locator('.theme').count() >= 7, 'офлайн: меню оформлений работает')
    await pg.click('.sheet__panel [data-close-sheet]')
    await pg.click('text=Пополнить копилку'); await pg.fill('#topupInput', '10'); await pg.click('#topupGo'); await pg.wait_for_timeout(1300)
    check((await pg.get_attribute('#amount', 'data-text')).replace(' ', '').startswith('7787'), 'офлайн: пополнение работает')
    await pg.click('.screen.is-active [data-back]'); await pg.wait_for_timeout(400); await pg.click('.tab[data-tab=home]'); await pg.wait_for_timeout(300)
    await pg.click('text=Посмотреть историю'); await pg.wait_for_timeout(500)
    check(await pg.evaluate("document.querySelectorAll('#histList li').length") == 100, 'офлайн: история открывается')
    await pg.evaluate(JS_SCROLL, [1, 5.0, 300])
    check(await pg.evaluate(FX_PIX) > 0, 'офлайн: эффект прокрутки работает (scrollfx.js в кэше)')
    # новая вкладка тоже офлайн
    pg2 = await ctx.new_page(); await pg2.goto(URL); await pg2.wait_for_timeout(900)
    check('₽' in await pg2.inner_text('#homeBalance'), 'офлайн: открытие в новой вкладке')
    check(not errs, 'офлайн без ошибок в консоли', errs)
    await ctx.close()

JS_SCROLL = """async ([dir, speed, ms]) => {
  const s = document.querySelector('.screen.is-active');
  return await new Promise(res => { let t0 = performance.now(), prev = t0, f = 0;
    function step(now) { f++; s.scrollTop += dir * speed * (now - prev); prev = now; if (now - t0 < ms) requestAnimationFrame(step); else res(f); }
    requestAnimationFrame(step); }); }"""
FX_PIX = """()=>{const c=document.querySelector('.screen.is-active canvas.sfx'); if(!c) return -1; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]) n++; return n}"""

async def scenario_history(b):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
    pg = await ctx.new_page(); errs = []; await collect_errors(pg, errs)
    await pg.goto(URL); await pg.wait_for_timeout(900)
    check(await pg.evaluate("!document.querySelector('.screen.is-active canvas.sfx')"), 'на главном эффекта прокрутки нет')
    await pg.click('.tab[data-tab=piggies]'); await pg.wait_for_timeout(300)
    check(await pg.evaluate("!document.querySelector('.screen.is-active canvas.sfx')"), 'во вкладке «Копилки» эффекта прокрутки нет')
    await pg.click('.tab[data-tab=home]'); await pg.wait_for_timeout(300)
    await pg.click('text=Посмотреть историю'); await pg.wait_for_timeout(500)
    st = await pg.evaluate("document.querySelector('.screen.is-active').dataset.screen")
    check(st == 'history', 'кнопка «Посмотреть историю» открывает историю, а не заглушку', st)
    n = await pg.evaluate("document.querySelectorAll('#histList li').length")
    check(n == 100, 'в истории 100 переводов', n)
    first = await pg.inner_text('#histList .hday')
    check(first in ('Сегодня', 'Вчера') or 'октябр' in first, 'первая группа — свежая дата', first)
    check(await pg.inner_text('#histCount') == '100', 'счётчик переводов = 100')
    # повторный вход — тот же список (не перемешивается)
    names1 = await pg.evaluate("[...document.querySelectorAll('#histList .list__title')].slice(0,10).map(e=>e.textContent).join()")
    await pg.click('.screen.is-active [data-back]'); await pg.wait_for_timeout(400)
    await pg.click('text=Посмотреть историю'); await pg.wait_for_timeout(500)
    names2 = await pg.evaluate("[...document.querySelectorAll('#histList .list__title')].slice(0,10).map(e=>e.textContent).join()")
    check(names1 == names2, 'история одинаковая при повторном открытии')
    # обычная прокрутка — без эффекта, сильная — с эффектом
    await pg.evaluate(JS_SCROLL, [1, 1.6, 300])
    check(await pg.evaluate(FX_PIX) == 0, 'обычная прокрутка: эффекта нет')
    await pg.wait_for_timeout(600)
    await pg.evaluate(JS_SCROLL, [1, 5.0, 300])
    check(await pg.evaluate(FX_PIX) > 0, 'сильная прокрутка: эффект есть')
    geo = await pg.evaluate("""()=>{const s=document.querySelector('.screen.is-active'), c=s.querySelector('canvas.sfx'); const a=c.getBoundingClientRect(), r=s.getBoundingClientRect(); return [Math.round(a.top-r.top), Math.round(a.bottom-r.bottom), Math.round(a.width-r.width)]}""")
    check(geo == [0, 0, 0], 'слой эффекта ровно по экрану при прокрутке', geo)
    # клик по переводу во время эффекта не перехватывается слоем
    hit = await pg.evaluate("""()=>{const li=document.querySelectorAll('#histList li')[40]; li.scrollIntoView({block:'center'}); const r=li.getBoundingClientRect(); const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return !!el.closest('li')}""")
    check(hit, 'карточки перевода поверх слоя эффекта')
    await pg.wait_for_timeout(800)
    check(await pg.evaluate(FX_PIX) == 0, 'после прокрутки эффект гаснет (нет нагрузки в покое)')
    # конец истории — планета и пасхалка
    check(not await pg.evaluate("document.getElementById('planet').classList.contains('is-in')"), 'планета не видна, пока не долистали')
    await pg.evaluate("document.querySelector('.screen.is-active').scrollTop = 1e9"); await pg.wait_for_timeout(1200)
    check(await pg.evaluate("document.getElementById('planet').classList.contains('is-in')"), 'в конце истории появляется планета')
    pr = await pg.evaluate("()=>{const p=document.getElementById('planet').getBoundingClientRect(), s=document.querySelector('.screen.is-active').getBoundingClientRect(); return [Math.round(p.left-s.left), Math.round(s.right-p.right), Math.round(s.bottom-p.bottom)]}")
    check(pr[0] == 0 and pr[1] == 0 and pr[2] <= 2, 'планета во всю ширину и прижата к низу', pr)
    await pg.click('#planetCoin'); await pg.wait_for_timeout(200)
    toasts = await pg.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.textContent)")
    check(any('Пасхалка' in t for t in toasts), 'тап по монете: пасхалка найдена', toasts)
    check(await pg.evaluate("document.getElementById('planetCoin').classList.contains('is-flip')"), 'монета переворачивается')
    await pg.wait_for_timeout(2500)
    await pg.click('#planetCoin'); await pg.wait_for_timeout(200)
    check(await pg.locator('.toast').count() == 0, 'повторный тап по монете: плашка не повторяется')
    await pg.click('.screen.is-active [data-back]'); await pg.wait_for_timeout(400)
    check(await pg.evaluate("document.querySelector('.screen.is-active').dataset.screen") == 'home', 'из истории назад — на главный')
    check(not errs, 'история без ошибок в консоли', errs)
    await ctx.close()

async def scenario_desktop(b):
    for (w, h) in [(1280, 720), (1920, 1080)]:
        ctx = await b.new_context(viewport={'width': w, 'height': h}, service_workers='block')
        pg = await ctx.new_page(); errs = []; await collect_errors(pg, errs)
        await pg.goto(URL); await pg.wait_for_timeout(800)
        r = await pg.evaluate("()=>{const a=document.getElementById('app').getBoundingClientRect(); return [Math.round(a.width), Math.round(a.top), Math.round(innerHeight-a.bottom)]}")
        check(r[0] == 430 and r[1] >= 0 and r[2] >= 0, f'ПК {w}x{h}: телефон целиком в окне', r)
        await pg.click('text=Посмотреть историю'); await pg.wait_for_timeout(400)
        for _ in range(5):
            await pg.mouse.move(w / 2, h / 2); await pg.mouse.wheel(0, 100); await pg.wait_for_timeout(70)
        check(await pg.evaluate(FX_PIX) == 0, f'ПК {w}x{h}: колесо мыши не включает эффект')
        await pg.evaluate("document.querySelector('.screen.is-active').scrollTop = 1e9"); await pg.wait_for_timeout(1100)
        await pg.click('#planetCoin'); await pg.wait_for_timeout(150)
        check(await pg.locator('.toast').count() == 1, f'ПК {w}x{h}: пасхалка кликается мышью')
        await pg.click('.screen.is-active [data-back]'); await pg.click('.tab[data-tab=piggies]'); await pg.click('[data-piggy="0"]'); await pg.wait_for_timeout(400)
        await pg.click('#amount'); await pg.wait_for_timeout(200)
        check(not errs, f'ПК {w}x{h}: без ошибок', errs)
        await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await scenario_flows(b)
        await scenario_history(b)
        await scenario_desktop(b)
        await scenario_offline(b)
        await scenario_layouts(b)
        await b.close()
    print(f'\n✓ пройдено: {len(PASSES)}   ✗ упало: {len(FAILS)}')
    for f in FAILS: print('  ✗', f)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
