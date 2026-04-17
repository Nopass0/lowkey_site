import { Client } from 'ssh2';

const config = {
  host: '89.169.54.87',
  port: 22,
  username: 'root',
  password: 'pvSr02KmQYYc'
};

const conn = new Client();

conn.on('ready', () => {
  console.log('Checking JOPA connection logs...');
  const cmd = `pm2 logs jopa-standard --lines 100 --nostream | grep -v "rules refreshed"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', (d) => process.stdout.write(d))
          .stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect(config);
