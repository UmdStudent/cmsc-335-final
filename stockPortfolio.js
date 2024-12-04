require("dotenv").config();
const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.vwdq8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const databaseAndCollection = {
  db: process.env.MONGO_DB_NAME,
  collection: process.env.MONGO_COLLECTION,
};
const express = require("express");
const bodyParser = require("body-parser");

const axios = require("axios");
const http = require("http");
const path = require("path");
const { MongoClient } = require("mongodb");
const app = express();
const port = 3000;

app.use(bodyParser.json());

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.use(express.static(__dirname + '/public'));

app.listen(port, () => {
  console.log(
    `Stock portfolio manager app listening at http://localhost:${port}`
  );
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
async function getNames(client, databaseAndCollection) {
  const cursor = client
    .db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .find({}, { projection: { _id: 0, name: 1 } });
  const results = await cursor.toArray();
  return results;
}
async function generatePortfoliosTable(portfolios) {
  let tableHTML = '<table border="1">';
  tableHTML += "<tr><th>Name</th><th>Tickers</th></tr>";
  portfolios.forEach((portfolio) => {
    const tickers = portfolio.tickers.join(", ");
    tableHTML += `<tr><th>${portfolio.name}</th><th>${tickers}</th></tr>`;
  });
  tableHTML += "</table>";
  return tableHTML;
}
async function getStockInfoHTML(tickers) {
  console.log(tickers);
  const options = {
    method: "GET",
    url: "https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/quotes",
    params: {
      ticker: `${tickers.join(",")}`,
    },
    headers: {
      "x-rapidapi-key": `${process.env.RAPID_API_KEY}`,
      "x-rapidapi-host": "yahoo-finance15.p.rapidapi.com",
    },
  };
  const response = await axios.request(options);
  // const url = `https://api.iextrading.com/1.0/stock/${ticker}/price`;
  let output = `<p>No stock prices found for: <br><em>${tickers.join(
    ", "
  )}</em></p>`;
  if (!response.data.body || response.data.body.length === 0) {
    return output;
  } else {
    output = "<table border='1'><tr><th>Ticker</th><th>Name</th><th>Price</th></tr>";
    output += response.data.body
      .map((stock, index) => {
        let price =
          stock.regularMarketPrice !== undefined
            ? stock.regularMarketPrice
            : "no price found";
        return `<tr><td>${tickers[index]}</td><td>${stock.shortName}</td><td>$${price}</td></tr>`;
      })
      .join("");
    output += "</table>";
    return output;
  }
}

const client = new MongoClient(uri);

app.get("/", async (req, res) => {
  try {
    await client.connect();
    const items = await getNames(client, databaseAndCollection);
    res.render("home", { items });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
});

app.get("/portfolios", async (req, res) => {
  try {
    await client.connect();
    const portfolios = await listPortfolios(client, databaseAndCollection);
    const table = await generatePortfoliosTable(portfolios);
    res.render("portfolios", { table });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
});
app.get("/insertPortfolio", (req, res) => {
  const dest = { URL: "/processPortfolio" };
  res.render("insertPortfolio", dest);
});
app.post("/processPortfolio", async (req, res) => {
  const { name, tickers } = req.body;
  const tickersList = tickers.split(",").map((ticker) => ticker.trim());
  const table = await getStockInfoHTML(tickersList);
  if (!name || !tickers) {
    return res.status(400).json({ error: "Name and tickers are required" });
  }
  try {
    await client.connect();
    await insertPortfolio(client, databaseAndCollection, { name, tickers: tickersList });
    res.render("processPortfolio", { name, tickersList, table });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
});

app.post("/removePortfolio", async (req, res) => {
  const { name } = req.body;
  console.log(name);
  try {
    await client.connect();
    const deletedCount = await removePortfolio(
      client,
      databaseAndCollection,
      name
    );
    if (deletedCount === 0) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    res.render("removedPortfolio", { name });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
});

app.post("/getPrices", async (req, res) => {
  if (!req.body.names) {
    return res.status(400).json({ error: "Tickers are required" });
  }
  const { names } = req.body;
  const name = names;
  try {
    await client.connect();
    const portfolio = await getPortfolio(client, databaseAndCollection, names);
    const table = await getStockInfoHTML(portfolio.tickers);
    res.render("getPrices", { table, name });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
});
