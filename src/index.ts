import fs from 'fs/promises';
import process from 'process';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';

const URLS = {
  users: 'https://challenge.sunvoy.com/api/users',
  tokens: 'https://challenge.sunvoy.com/settings/tokens',
  settings: 'https://challenge.sunvoy.com/settings',
};

const COOKIE = 'JSESSIONID=d147e1d1-8559-4a7b-8d3b-73e54f4ba1b8;';

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

function createSignedRequest(t: Object): Object {
  const e = Math.floor(Date.now() / 1e3);
  const i: { [key: string]: any } = {
    ...t,
    timestamp: e.toString()
  }
  const o = crypto.createHmac('sha1', 'mys3cr3t');
  const n =  Object.keys(i).sort().map(t => `${t}=${encodeURIComponent(i[t])}`).join("&");
  o.update(n);
  const h = o.digest("hex").toUpperCase();
  
  return {
    payload: n,
    checkcode: h,
    fullPayload: `${n}&checkcode=${h}`,
    timestamp: e
  }
}

async function getAuthorizedToken(): Promise<Object> {
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
    const token: Object = await getAuthorizedToken();

    return [];
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
