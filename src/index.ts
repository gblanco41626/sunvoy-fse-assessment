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

const COOKIE = 'JSESSIONID=d147e1d1-8559-4a7b-8d3b-73e54f4ba1b8;';

async function login(): Promise<string> {
  const res = await fetch(URLS.login, {
    method: 'GET',
    redirect: 'manual'
  });

  if (![200, 302].includes(res.status)) {
    throw new Error(`GET ${URLS.login} failed with status: ${res.status}`);
  }

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

  const loginRes = await fetch(URLS.login, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `nonce=${nonce}&username=demo%40example.org&password=test`,
    redirect: 'manual'
  });

  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`GET ${URLS.login} failed with status: ${loginRes.status}`);
  }

  const jSessionId = loginRes.headers.getSetCookie()[0];

  await fs.writeFile('jsessionid.txt', JSON.stringify(jSessionId));

  return jSessionId;
}

async function fetchUsers(): Promise<Object[]> {
  const res = await fetch(URLS.users, {
    method: 'POST',
    headers: { 'Cookie': COOKIE },
  });

  if (!res.ok) {
    throw new Error(`POST ${URLS.users} failed with status: ${res.status}`);
  }

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

  const res = await fetch(URLS.tokens, {
    method: 'GET',
    headers: { 'Cookie': COOKIE },
  });

  if (!res.ok) {
    throw new Error(`POST ${URLS.tokens} failed with status: ${res.status}`);
  }

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

  const res = await fetch(URLS.settings, {
    method: 'POST',
    headers: {
      'Cookie': COOKIE,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: requestBody
  });

  if (!res.ok) {
    throw new Error(`POST ${URLS.settings} failed with status: ${res.status}`);
  }

  const data = await res.text();
  
  return [JSON.parse(data)];
}

async function main(): Promise<void> {
  try {
    login();
    // let userArray: Object[] = await fetchUsers();

    // const authUserArray: Object[] = await fetchAuthenticatedUsers();
    // userArray.push(...authUserArray);

    // await fs.writeFile('users.json', JSON.stringify(userArray, null, 2));
  } catch(err) {
    console.error('Error in main:', err);
    process.exit(1);
  }
}

main();
