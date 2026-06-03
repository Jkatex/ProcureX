import { chromium } from 'playwright';

const routes = ['/sign-in', '/register', '/dashboard', '/procurement/create-tender', '/evaluation'];
const viewports = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 360, height: 800 }
];

function intersects(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y > 1;
}

async function signIn(page) {
  await page.goto('http://localhost:5173/sign-in');
  await page.locator("button[data-demo-email='user@company.tz']").click();
  await page.locator("[data-action='sign-in'] button[type='submit']").click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

async function navigateSpa(page, route) {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, '', nextRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForTimeout(250);
}

async function checkRoute(page, route, viewportName) {
  if (route === '/sign-in' || route === '/register') {
    await page.goto(`http://localhost:5173${route}`);
  } else {
    await navigateSpa(page, route);
  }

  await page.locator('[data-procurex-language-mount="true"]').waitFor({ state: 'visible', timeout: 10000 });

  const result = await page.evaluate(() => {
    const host = document.querySelector('[data-procurex-language-mount="true"]');
    const hostRect = host?.getBoundingClientRect();
    if (!host || !hostRect) {
      return { hasHost: false, hostClass: '', hostPosition: '', overlaps: [] };
    }

    const controls = [...document.querySelectorAll('button,a,input,select,textarea,[role="button"]')];
    const visibleControls = controls.filter((control) => {
      if (host.contains(control)) return false;
      const rect = control.getBoundingClientRect();
      const style = window.getComputedStyle(control);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });

    return {
      hasHost: true,
      hostClass: host.className,
      hostPosition: window.getComputedStyle(host).position,
      hostRect: {
        left: hostRect.left,
        top: hostRect.top,
        right: hostRect.right,
        bottom: hostRect.bottom
      },
      overlaps: visibleControls
        .filter((control) => {
          const rect = control.getBoundingClientRect();
          const x = Math.max(0, Math.min(hostRect.right, rect.right) - Math.max(hostRect.left, rect.left));
          const y = Math.max(0, Math.min(hostRect.bottom, rect.bottom) - Math.max(hostRect.top, rect.top));
          return x * y > 1;
        })
        .map((control) => ({
          tag: control.tagName,
          text: control.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
          className: control.className
        }))
    };
  });

  if (!result.hasHost) {
    throw new Error(`${viewportName} ${route}: language host missing`);
  }

  if (result.hostPosition === 'fixed') {
    throw new Error(`${viewportName} ${route}: language host is fixed`);
  }

  if (result.overlaps.length) {
    throw new Error(`${viewportName} ${route}: language host overlaps controls ${JSON.stringify(result.overlaps)}`);
  }

  console.log(`${viewportName} ${route} -> ${result.hostClass}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await signIn(page);

  for (const route of routes) {
    await checkRoute(page, route, viewport.name);
  }
}

await browser.close();
