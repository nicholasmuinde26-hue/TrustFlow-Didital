import dns from "dns";
import { MongoClient } from "mongodb";

// Force Node.js to use public DNS instead of 127.0.0.1
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const localUri = "mongodb://localhost:27017/NewRealitiesChama";

const atlasUri =
  "mongodb+srv://nickhdullies3_db_user:9UxXTmK5c0RZrTzx@cluster0.eqlb1bx.mongodb.net/NewRealitiesChama?retryWrites=true&w=majority&appName=Cluster0";
async function copyAll() {
  const local = new MongoClient(localUri, {
    serverSelectionTimeoutMS: 15000,
  });

  const atlas = new MongoClient(atlasUri, {
    serverSelectionTimeoutMS: 15000,
  });

  try {
    console.log("Connecting to local MongoDB...");
    await local.connect();
    console.log("✓ Local MongoDB connected");

    console.log("Connecting to MongoDB Atlas...");
    await atlas.connect();
    console.log("✓ MongoDB Atlas connected");

    const localDb = local.db("NewRealitiesChama");
    const atlasDb = atlas.db("NewRealitiesChama");

    const collections = await localDb.listCollections().toArray();

    console.log(
      `\nFound ${collections.length} collections:`,
      collections.map((c) => c.name)
    );

    for (const col of collections) {
      const name = col.name;

      console.log(`\nCopying collection: ${name}`);

      const docs = await localDb
        .collection(name)
        .find({})
        .toArray();

      console.log(`Found ${docs.length} documents`);

      if (docs.length === 0) {
        console.log(`SKIP ${name} - empty collection`);
        continue;
      }

      await atlasDb.collection(name).deleteMany({});

      await atlasDb.collection(name).insertMany(docs);

      console.log(`✓ ${name} copied successfully: ${docs.length} documents`);
    }

    console.log("\n========================================");
    console.log("DONE");
    console.log("NewRealitiesChama copied to MongoDB Atlas");
    console.log("========================================");
  } catch (error) {
    console.error("\n========================================");
    console.error("COPY FAILED");
    console.error("========================================");
    console.error("Error:", error.message);

    if (error.code) {
      console.error("Code:", error.code);
    }

    console.error(error);
  } finally {
    await local.close();
    await atlas.close();

    console.log("\nConnections closed.");
  }
}

copyAll();