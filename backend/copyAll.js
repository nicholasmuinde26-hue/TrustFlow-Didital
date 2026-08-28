import { MongoClient } from 'mongodb';

const localUri = 'mongodb://localhost:27017/NewRealitiesChama';
const atlasUri = 'mongodb+srv://nickhdullies3_db_user:9UxXTmK5c0RZrTzx@cluster0.hdnmwon.mongodb.net/NewRealitiesChama?retryWrites=true&w=majority&appName=Cluster0';

async function copyAll() {
  const local = new MongoClient(localUri);
  const atlas = new MongoClient(atlasUri);
  await local.connect();
  await atlas.connect();
  const localDb = local.db('NewRealitiesChama');
  const atlasDb = atlas.db('NewRealitiesChama');
  const collections = await localDb.listCollections().toArray();
  console.log('Found', collections.length, collections.map(c=>c.name));
  for (const col of collections) {
    const name = col.name;
    console.log('\nCopying', name);
    const docs = await localDb.collection(name).find().toArray();
    if(docs.length>0){
      await atlasDb.collection(name).deleteMany({});
      await atlasDb.collection(name).insertMany(docs);
      console.log('OK', name, docs.length);
    }
  }
  console.log('DONE - Atlas now has NewRealitiesChama');
  await local.close(); await atlas.close();
}
copyAll();