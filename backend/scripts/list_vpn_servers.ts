import { db } from "../src/db";

async function main() {
    try {
        const servers = await db.vpnServer.findMany({
            where: { status: "online" }
        });
        console.log("Online servers:");
        servers.forEach(s => {
            console.log(`- ${s.ip}:${s.port} (${s.hostname}) - Type: ${s.serverType}, Protocols: ${s.supportedProtocols}`);
        });
    } catch (e) {
        console.error("Failed to list servers:", e);
    } finally {
        process.exit(0);
    }
}

main();
