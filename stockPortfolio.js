require("dotenv").config();
const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.vwdq8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const databaseAndCollection = {
  db: process.env.MONGO_DB_NAME,
  collection: process.env.MONGO_COLLECTION,
};
const express = require('express');
const bodyParser = require('body-parser');

const http = require("http");
const path = require("path");
const { MongoClient } = require('mongodb');
const app = express();
const port = 3000;

app.use(bodyParser.json());

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.listen(port, () => {
  console.log(`Stock portfolio manager app listening at http://localhost:${port}`);
});

async function insertPortfolio(client, databaseAndCollection, portfolio) {
  const database = client.db(databaseAndCollection.db);
  const collection = database.collection(databaseAndCollection.collection);
  await collection.insertOne(portfolio);
}

async function removePortfolio(client, databaseAndCollection, name) {
  const result = await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .deleteOne({ name: name });
  return result.deletedCount;
}

async function removeAllPortfolios(client, databaseAndCollection) {
  const result = await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .deleteMany({});
  return result.deletedCount;
}

async function getPortfolio(client, databaseAndCollection, name) {
  const query = { name: name };
  const portfolio = await client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .findOne(query);
  return portfolio;
}

async function listPortfolios(client, databaseAndCollection) {
  const cursor = client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .find({});
  const results = await cursor.toArray();
  return results;
}
const client = new MongoClient(uri);

app.get("/", (req, res) => {
  res.render("home");
});

app.get('/portfolio', async (req, res) => {
  try {
    await client.connect();
    const portfolios = await listPortfolios(client, databaseAndCollection);
    res.json(portfolios);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

app.post('/insertPortfolio', async (req, res) => {
  const { name, tickers } = req.body;
  if (!name || !tickers) {
    return res.status(400).json({ error: 'Name and tickers are required' });
  }
  try {
    await client.connect();
    await insertPortfolio(client, databaseAndCollection, { name, tickers });
    res.status(201).json({ message: 'Portfolio added' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

app.post('/getPortfolio', async (req, res) => {
  const { name } = req.body.name;
  const { tickers } = req.body.tickers;
  try {
    await client.connect();
    const portfolio = await getPortfolio(client, databaseAndCollection, name);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    portfolio.tickers = tickers;
    await removePortfolio(client, databaseAndCollection, name);
    await insertPortfolio(client, databaseAndCollection, portfolio);
    res.json({ message: 'Portfolio updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});

app.delete('/portfolio/:name', async (req, res) => {
  const { name } = req.params;
  try {
    await client.connect();
    const deletedCount = await removePortfolio(client, databaseAndCollection, name);
    if (deletedCount === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    res.json({ message: 'Portfolio removed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await client.close();
  }
});