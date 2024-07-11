const puppeteer = require('puppeteer');
const readline = require('readline');


let browser;

async function launchBrowser() {
  if (!browser) {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
       executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('Browser launched.');
  }
  
  return browser;
}

async function openPage(url) {
  console.log(`Opening page: ${url}`);
  const page = await browser.newPage();
  const width = 1010;
  const height = 1080;
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('body', { timeout: 60000 });
  console.log('Page opened and loaded.');
  return page;
}

async function scrollPage(page) {
  console.log('Scrolling the page...');
  await page.evaluate(async () => {
        $(".grafana-app").attr({style: 'height: 50000px'});
        let lastPanel = $(".grafana-app").find('[data-panelid]').last();
        $(".grafana-app").attr({style: 'height: '+(lastPanel.offset().top + lastPanel.height()+50)+'px'});
        
        var totalHeight = 0;
        var distance = 200;
        var timer = setInterval(() => {
            var scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if(totalHeight >= scrollHeight){
                clearInterval(timer);
            }
        }, 50);
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Scrolling completed.');
}

async function checkPanels(page) {
  console.log('Checking panels status...');
  return await page.evaluate(() => {
    const panelData = grafanaRuntime.getPanelData(); 
    let panelsDone = 0;
    let panelsErrored = 0;

    for (const key in panelData) {
      if (panelData[key] === undefined) {
        panelsErrored++;
      } else if (panelData[key].state === "Done") {
        panelsDone++;
      }
    }

    return { panelsDone, panelsErrored };
  });
}

async function waitForPanels(page, panelsCount, timeout) {
  const startTime = new Date().getTime();
  while (true) {
    const { panelsDone, panelsErrored } = await checkPanels(page);
    console.log(`Panels done: ${panelsDone}, Panels errored: ${panelsErrored}`);
    if (panelsDone >= panelsCount) {
      if (panelsErrored > 0) {
        console.log('Panels done but with errors.');
      }
      return true;
    }
    if (new Date().getTime() - startTime > timeout) {
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function saveAsPDF(page, path) {
  console.log(`Saving page as PDF: ${path}`);
  await page.pdf({
    path: path,
    format: 'A4',
    printBackground: true,
    margin: { top: '0.0in', right: '0.0in', bottom: '0.0in', left: '0.0in' },
    scale: 0.79,
    preferCSSPageSize: false,
  });
  console.log(`PDF "${path}" generated successfully.`);
}

async function loadAndSave(url, filename) {
  await launchBrowser();
  const page = await openPage(url);
  try {
    await scrollPage(page);

    const panelsCount = 20;
    const panelsLoaded = await waitForPanels(page, panelsCount, 60000);
    if (!panelsLoaded) {
      console.error('Timeout: Not all panels loaded successfully.');
      throw new Error('Timeout: Not all panels loaded successfully.');
    } else {
      console.log(`${panelsCount} panels loaded successfully.`);
    }

    await saveAsPDF(page, filename);
    await page.close();
  } catch (error) {
    console.error('Error:', error);
    await page.close();
  }
}

async function waitForUserInput() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Please log in and then press "y" to continue: ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y') {
        resolve();
      } else {
        console.log('User did not confirm. Exiting...');
        process.exit(1);
      }
    });
  });
}

(async () => {
  await launchBrowser();
  const initialPage = await openPage('https://grafana.andrewa.co.uk/login');
  console.log('Please log in using the opened browser window.');
  
  await waitForUserInput();
  
  console.log('Continuing with the rest of the script...');

  await initialPage.close();

  var countTest = 0;
  while(countTest < 50){
    await loadAndSave('https://grafana.andrewa.co.uk/d/IfgdXjtns-a4/proxmox-overview-a4-report?orgId=3&refresh=30s&kiosk', `filename-${countTest}.pdf`);
    countTest++;
  }

  if (browser) {
    await browser.close();
  }
})();
