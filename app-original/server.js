const express = require('express');
const bodyParser= require('body-parser')
const MongoClient = require('mongodb').MongoClient
const app = express();
var fs = require("fs");
var http = require('http');
var uuid = require('node-uuid');
var request = require('request');

var db;


app.set('port', process.env.PORT || 3000);
app.set('dbconn', '<mongodb-connection-string');
app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({extended: true}))

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

app.post('/quotes', (req, res) => {
  db.collection('quotes').save(req.body, (err, result) => {
    if (err) return console.log(err)

    console.log('saved to database')
    res.redirect('/')
  })
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