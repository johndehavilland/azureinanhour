const express = require('express');
const bodyParser= require('body-parser')
const MongoClient = require('mongodb').MongoClient
const app = express();
var fs = require("fs");
var http = require('http');
var uuid = require('node-uuid');
var request = require('request');
var azureSearch = require('azure-search');

var db;


var searchClient = azureSearch({
    url: "https://<azure-search-name>.search.windows.net",
    key:"<azure-search-key>"
});

app.set('cogsvcurl', 'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0');
app.set('cogsvckey', '<cog-svc-key>');
app.set('port', process.env.PORT || 3000);
app.set('dbconn', '<docdb-conn-string>');
app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({extended: true}))

app.get('/meme', (req, res) => {

   request('<azure-function-hook-url>&quote='+req.query.quote, function (error, response, body) {
	if (!error && response.statusCode == 200) {
		console.log(body)
	}
	})
	res.redirect('/')
})


app.get('/', (req, res) => {
    var query = { state: 'OK' };
    var n =100;
    var r = Math.floor(Math.random() * n);
    db.collection('quotes').find().limit(1).skip(r).toArray(function(err, results) {
    res.render('index.ejs', {quotes: results})
    })
})

app.get('/quotes', (req, res) => {
    
    res.render('quotes.ejs')
   
})

app.get('/search', (req, res) => {
     var query = req.query.q;
    console.log(query);
      
     searchClient.search("quotes", {search: query}, function(err, results) {
                                                            console.log(results);
                                                            res.setHeader('Content-Type', 'application/json');
                                                            res.send(JSON.stringify(results));
                                                                       
                                                            if(err){
                                                                console.log("error  " + err);
                                                            }
                                                        });
   
   
})

app.post('/quotes', (req, res) => {

//check sentiment
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

//bulk load function to populate the db with some quotes
app.get('/loadme', (req, res) => {

    var contents = fs.readFileSync("init.json");
    // Define to JSON type
    var jsonContent = JSON.parse(contents);
    createNewEntries(db, jsonContent, function () {
        console.log("done");
        res.redirect('/')
    });

})

MongoClient.connect(app.get('dbconn'), (err, database) => {
    if (err) return console.log(err)
    db = database
   
     http.createServer(app).listen(app.get('port'), function () {
        console.log('Express server listening on port ' + app.get('port'));
    });
})

var createNewEntries = function(db, entries, callback) {

    var collection = db.collection('quotes');   
    var bulkOp = collection.initializeOrderedBulkOp();
    var counter = 0;    

    entries.forEach(function(obj) {         
        bulkOp.insert(obj);           
        counter++;
        //batches of 1000 execute the job
        if (counter % 1000 == 0 ) {
            bulkOp.execute(function(err, result) {  
                // re-initialise batch operation           
                bulkOp = collection.initializeOrderedBulkOp();
                callback();
            });
        }
    });             

    if (counter % 1000 != 0 ){
        bulkOp.execute(function(err, result) {
            callback();             
        }); 
    } 
};