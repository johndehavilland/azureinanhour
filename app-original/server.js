const express = require('express');
const bodyParser = require('body-parser')
const MongoClient = require('mongodb').MongoClient
const app = express();
var fs = require("fs");
var http = require('http');
var azureSearch = require('azure-search');
var uuid = require('node-uuid');
var request = require('request');

var db;

app.set('port', process.env.PORT || 3000);
app.set('dbconn', process.env.CUSTOMCONNSTR_mongodb || 'mongodb://johndh:SomePass1!@ds058739.mlab.com:58739/johndemo');
app.set('cogsvcurl', process.env.COG_URL || 'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0');
app.set('cogsvckey', process.env.COG_KEY || '6b09844c01784d8e939b8c05f5985044');
app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({ extended: true }))


var searchClient = azureSearch({
    url: "https://jdhdemo.search.windows.net",
    key: "B52D232350FF8A2C235931971086D51A"
});


app.get('/', (req, res) => {
    var query = { state: 'OK' };
    var n = 100;
    var r = Math.floor(Math.random() * n);
    db.collection('quotes').find().limit(1).skip(r).toArray(function (err, results) {
        res.render('index.ejs', { quotes: results })
    })
})

app.get('/search', (req, res) => {
    var query = req.query.q;
    console.log(query);

    searchClient.search("quotes", { search: query }, function (err, results) {
        console.log(results);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(results));

        if (err) {
            console.log("error  " + err);
        }
    });
})

app.get('/quotes', (req, res) => {

    res.render('quotes.ejs')

})

app.get('/loadme', (req, res) => {

    var contents = fs.readFileSync("init.json");
    // Define to JSON type
    var jsonContent = JSON.parse(contents);
    //check sentiment

    createNewEntries(db, jsonContent, function () {
        console.log("done");
        res.redirect('/')
    });

})

app.get('/meme', (req, res) => {

   request('https://jdhdemofunc.azurewebsites.net/api/jdhdemopostcard?code=HoCarTC0uHl3xcDXr9kotrZn9NIMRn41GsM3WWPV6sDUMxY47hO77Q==&quote='+req.query.quote, function (error, response, body) {
    if (!error && response.statusCode == 200) {
        console.log(body)
    }
    })
    res.redirect('/')
})

app.post('/quotes', (req, res) => {
   
    var reqId = uuid.v4();

    request.post({
        url: app.get('cogsvcurl') + "/sentiment",
        headers: {
            "Content-Type": "application/json",
            "Ocp-Apim-Subscription-Key": app.get('cogsvckey')
        },
        json: true,
        body: {
            "documents": [
                {
                    "id": reqId,
                    "text": req.body.quote
                }
            ]
        }
    }, function (err, resp, body) {
        console.log("Response from Cog API (err, res, body)");
        console.log(JSON.stringify(err, null, " "));
        // Check to see if we succeeded.
        if (err || resp.statusCode != 200) {
            console.log(err);
        }
        
        if (body.documents[0].score < 0.6) {
            res.render('quotes.ejs', { msg: "That was not motivational enough!! Try again." })
        }
        else {
            db.collection('quotes').save(req.body, (err, result) => {
                if (err) return console.log(err)

                console.log('saved to database')
                res.redirect('/')
            })
        }
    });
})

MongoClient.connect(app.get('dbconn'), (err, database) => {
    if (err) return console.log(err)
    db = database

    http.createServer(app).listen(app.get('port'), function () {
        console.log('Express server listening on port ' + app.get('port'));
    });
})

var createNewEntries = function (db, entries, callback) {

    // Get the collection and bulk api artefacts
    var collection = db.collection('quotes'),
        bulk = collection.initializeOrderedBulkOp(), // Initialize the Ordered Batch
        counter = 0;

    // Execute the forEach method, triggers for each entry in the array
    entries.forEach(function (obj) {

        bulk.insert(obj);
        counter++;

        if (counter % 1000 == 0) {
            // Execute the operation
            bulk.execute(function (err, result) {
                // re-initialise batch operation           
                bulk = collection.initializeOrderedBulkOp();
                callback();
            });
        }
    });

    if (counter % 1000 != 0) {
        bulk.execute(function (err, result) {
            // do something with result 
            callback();
        });
    }
};

var sentimentEval = function (content) {


    var reqId = uuid.v4();

    request.post({
        url: app.get('cogsvcurl') + "/sentiment",
        headers: {
            "Content-Type": "application/json",
            "Ocp-Apim-Subscription-Key": app.get('cogsvckey')
        },
        json: true,
        body: {
            "documents": [
                {
                    "id": reqId,
                    "text": content
                }
            ]
        }
    }, function (err, res, body) {
        console.log("Response from Cog API (err, res, body)");
        console.log(JSON.stringify(err, null, " "));
        console.log(JSON.stringify(res, null, " "));
        console.log(JSON.stringify(body, null, " "));
        return body;
        // Check to see if we succeeded.
        if (err || res.statusCode != 200) {
            console.log(err);
        }
    });
};