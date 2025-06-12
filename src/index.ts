import fs from 'fs/promises';
import process from 'process';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';

const URLS = {
  users: 'https://challenge.sunvoy.com/api/users',
  tokens: 'https://challenge.sunvoy.com/settings/tokens',
  settings: 'https://api.challenge.sunvoy.com/api/settings',
  login: 'https://challenge.sunvoy.com/login',
};

async function fetchWithCookie(
  url: string,
  params: {
    method?: string,
    headers?: Record<string, string>,
    body?: string,
    redirect?: RequestRedirect,
  }): Promise<Response> {
  const {
    method  = 'GET',
    headers = {},
    body,
    redirect = 'follow',
  } = params;

  const jSessionId = await getJSessionID();
  
  const finalHeaders = {
    'Cookie': jSessionId,
    ...headers
  }

  const res = await fetch(url, {
    method: method,
    headers: finalHeaders,
    body: body,
    redirect: redirect
  });

  if (![200, 302].includes(res.status)) {
    throw new Error(`${method} ${url} failed with status: ${res.status}`);
  }

  return res;
}

async function login(): Promise<string> {
  const res = await fetchWithCookie(URLS.login, {
    method: 'GET',
    redirect: 'manual'
  });

  const loginPage = await res.text();
  const dom = new JSDOM(loginPage);
  const nonceElement = dom.window
                          .document
                          .querySelector<HTMLInputElement>(
                            'input[type="hidden"][name="nonce"]'
                          );
  const nonce = (<HTMLInputElement>nonceElement).value;

  if (!nonce) {
    throw new Error(`Nonce not found`);
  }

  const loginRes = await fetchWithCookie(URLS.login, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `nonce=${nonce}&username=demo%40example.org&password=test`,
    redirect: 'manual'
  });

  const jSessionId = loginRes.headers.getSetCookie()[0];

  await fs.writeFile('jsessionid.txt', jSessionId);

  return getJSessionIDPair(jSessionId)[0];
}

function getJSessionIDPair(jSessionTxt: string): any[] {
  const jSessionArr = jSessionTxt.split('; ');
  const jSessionID = jSessionArr[0];
  
  const expiry = new Date(jSessionArr[3].split('=')[1]);

  return [jSessionID, expiry];
}

async function getJSessionID(): Promise<string> {
  const jSessionTxt  = await fs.readFile('jsessionid.txt', 'utf8');
  const now = new Date();

  let [jSessionID, expiry] = getJSessionIDPair(jSessionTxt);

  if (expiry < now) {
    jSessionID = await login();
  }

  return jSessionID;
}

async function fetchUsers(): Promise<Object[]> {
  const res = await fetchWithCookie(URLS.users, { method: 'POST' });

  const data = await res.json();
  
  return data;
}

function createSignedRequest(t: Object): string {
  const e = Math.floor(Date.now() / 1e3);
  const i: { [key: string]: any } = {
    ...t,
    timestamp: e.toString()
  }
  const o = crypto.createHmac('sha1', 'mys3cr3t');
  const n =  Object.keys(i).sort().map(t => `${t}=${encodeURIComponent(i[t])}`).join("&");
  o.update(n);
  const h = o.digest("hex").toUpperCase();
  
  return `${n}&checkcode=${h}`;
}

async function getAuthorizedToken(): Promise<string> {
  let token: { [key: string]: any } = {};

  const res = await fetchWithCookie(URLS.tokens, { method: 'GET' });

  const data = await res.text();
  const dom = new JSDOM(data);
  dom.window.document.querySelectorAll('input[type="hidden"]')
    .forEach((element) => {
      token[element.id] = (<HTMLInputElement>element).value;
    });

  return createSignedRequest(token);
}

async function fetchAuthenticatedUsers(): Promise<Object[]> {
  const requestBody: string = await getAuthorizedToken();

  const res = await fetchWithCookie(URLS.settings, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: requestBody
  });

  const data = await res.text();
  
  return [JSON.parse(data)];
}

async function main(): Promise<void> {
  try {
    let userArray: Object[] = await fetchUsers();

    const authUserArray: Object[] = await fetchAuthenticatedUsers();
    userArray.push(...authUserArray);

    await fs.writeFile('users.json', JSON.stringify(userArray, null, 2));
  } catch(err) {
    console.error('Error in main:', err);
    process.exit(1);
  }
}

main();
