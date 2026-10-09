"""End-to-end smoke test: plays the full loop in a real Chromium against dist/index.html.
Run: python3 tests/e2e/smoke.py  (after `node tools/build.mjs`). Screenshots go to tests/e2e/shots/."""
import pathlib, sys
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[2]
shots = root / 'tests/e2e/shots'; shots.mkdir(parents=True, exist_ok=True)
url = (root / 'dist/index.html').as_uri()
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['light', 'dark']:
        pg = b.new_page(viewport={'width': 1280, 'height': 900}, color_scheme=scheme)
        pg.on('console', lambda m: m.type == 'error' and not 'fonts.g' in m.text and 'ERR_TUNNEL' not in m.text and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(url)
        pg.screenshot(path=str(shots / f'1-intro-{scheme}.png'), full_page=True)
        if scheme == 'dark':
            break
        pg.click('text=Start the mission')
        pg.screenshot(path=str(shots / '2-build.png'), full_page=True)
        # over-budget check
        pg.fill('#b-batteryKwh', '1500'); pg.dispatch_event('#b-batteryKwh', 'input')
        assert pg.is_disabled('#build-next'), 'next should be disabled when over budget'
        pg.fill('#b-batteryKwh', '900'); pg.dispatch_event('#b-batteryKwh', 'input')
        assert not pg.is_disabled('#build-next')
        pg.click('#build-next')
        pg.screenshot(path=str(shots / '3-rules.png'), full_page=True)
        pg.click('text=Fly the mission')
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(shots / '4-fly-mid.png'), full_page=True)
        pg.click('text=Skip to end')
        pg.click('text=Open the debrief')
        txt = pg.inner_text('main')
        assert 'lost in the dark' in txt.lower(), txt[:400]
        assert 'greenhouse' in txt.lower()
        pg.screenshot(path=str(shots / '5-debrief-lost.png'), full_page=True)
        # fix: add the suggested rules and re-fly
        pg.click('text=Edit rules and fly again')
        for t in ['the Sun has set THEN switch greenhouse', 'the Sun has set THEN set heaters', 'battery is below 40% THEN pause science']:
            pg.click(f'button.hint:has-text("{t}")')
        pg.screenshot(path=str(shots / '6-rules-fixed.png'), full_page=True)
        pg.click('text=Fly the same record again')
        pg.click('text=Skip to end')
        pg.screenshot(path=str(shots / '7-fly-end.png'), full_page=True)
        pg.click('text=Open the debrief')
        txt = pg.inner_text('main')
        assert 'survived' in txt.lower(), txt[:400]
        pg.screenshot(path=str(shots / '8-debrief-survived.png'), full_page=True)
        code = pg.input_value('#sharecode')
        pg.fill('#loadcode', code); pg.click('text=Load')
        assert 'Loaded' in pg.inner_text('#codemsg')
        pg.fill('#loadcode', 'garbage'); pg.click('text=Load')
        assert 'not valid' in pg.inner_text('#codemsg')
        pg.click('#srcbtn')
        pg.screenshot(path=str(shots / '9-sources.png'), full_page=True)
        # phone width
        m = b.new_page(viewport={'width': 390, 'height': 844}, color_scheme='light')
        m.on('pageerror', lambda e: errors.append(str(e)))
        m.goto(url)
        sw = m.evaluate('document.documentElement.scrollWidth')
        m.screenshot(path=str(shots / '10-phone-intro.png'), full_page=True)
        m.click('text=Start the mission'); sw2 = m.evaluate('document.documentElement.scrollWidth')
        m.screenshot(path=str(shots / '11-phone-build.png'), full_page=True)
        assert sw <= 390 and sw2 <= 390, f'horizontal overflow on phone: {sw}, {sw2}'
    b.close()
if errors:
    print('ERRORS:', errors); sys.exit(1)
print('E2E OK')
