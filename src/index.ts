import fs from 'fs/promises';
import process from 'process';

const URLS = {
  users: 'https://challenge.sunvoy.com/api/users',
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

async function main(): Promise<void> {
  try {
    let userArray: Object[] = await fetchUsers();

    await fs.writeFile('users.json', JSON.stringify(userArray, null, 2));
  } catch(err) {
    console.error('Error in main:', err);
    process.exit(1);
  }
}

main();
