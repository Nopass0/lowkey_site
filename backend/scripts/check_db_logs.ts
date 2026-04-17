import { Client } from 'ssh2';

const config = {
  host: '89.169.54.87',
  port: 22,
  username: 'root',
  password: 'pvSr02KmQYYc'
};

const conn = new Client();

conn.on('ready', () => {
  console.log('Extracting Connection Logs from DB...');
  const cmd = `
    # Use the VOIDDB_USERNAME/PASSWORD to query the logs
    # Note: This assumes the logs are searchable via a simple grep or sqlite tool if use
    # But JOPA uses VoidDB via HTTP. I'll use curl to check the logs collection.
    
    curl -s -X POST https://db.lowkey.su/collection/jopa_connection_logs/find \\
      -u admin:rQRCXrFdJ22N4Z1zw21LFpY1 \\
      -H "Content-Type: application/json" \\
      -d '{"query": {}, "limit": 20, "sort": {"timestamp": -1}}' | jq .
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', (d) => process.stdout.write(d))
          .stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect(config);
