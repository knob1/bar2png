var webshot	= require('webshot');
var fs		= require('fs');
var http	= require('http');
var dispatcher  = require('httpdispatcher');
var request	= require('request');
var events 	= require('events');

var EventEmitter= new events.EventEmitter();

const PORT	= 1337;
const index	= 'tester';

var documentCount = 0;
var documentArray = [];
var graph = fs.readFileSync('barChart.html', 'utf8');

/**
 * function: http-server
 * 
 *
 **/

dispatcher.onGet("/getbar", function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
		request({
			url : 'http://localhost:9200/tester/text/'+req.params.id+'/_termvectors',
			method : 'POST',
			body : '{"fields": ["Inhalt"],"offsets": true,"payloads": true,"positions": true,"term_statistics": true,"field_statistics": true,"filter" : {"min_term_freq" : 2}}'
		}, function (error, response, body) {
		  	if (!error && response.statusCode == 200) {
		  		var jsonData = JSON.parse(body)

		  		var inhalt = [];
					var buckets = [];
					for (key in jsonData.term_vectors.Inhalt.terms){
						var object = {};
						object.doc_count 	= jsonData.term_vectors.Inhalt.terms[key].term_freq;
						object.key 				= key;
						buckets.push(object);
					}
					buckets.sort(function(a,b){
						return b.doc_count - a.doc_count;
					})
					inhalt['buckets'] = buckets;

					graph = graph.replace(/var data = .*?\;/g, "var data = "+JSON.stringify(inhalt.buckets)+';');
					
					res.end(graph);
		  	}
		  	else {
		  		console.log(error);
		  	}
			})

}); 

function handleRequest(request, response){
    try {
        dispatcher.dispatch(request, response);
    } catch(err) {
        console.log(err);
    }
}

var server = http.createServer(handleRequest);

server.listen(PORT, function(){
    console.log("Server listening on: http://localhost:%s", PORT);
    starter();
});

/**
 * function: start
 * 
 *
 **/

var starter = function() {
	getDocumentCount();
}

var getDocumentCount = function() {
	request('http://localhost:9200/_stats', function (error, response, body) {
  	if (!error && response.statusCode == 200) {
    	var json = JSON.parse(body);
    	documentCount = json._all.total.docs.count;
    	getAllDocuments();
  	}
  	else {
  		console.log(error);
  	}
	})
}

var getAllDocuments = function() {
	request({
		url : 'http://localhost:9200/'+index+'/_search?size='+documentCount,
		method : 'GET',
		qs : {"_source" : true, "query" : {"match_all" : {}}} 
	}, function (error, response, body) {
	  	if (!error && response.statusCode == 200) {
	    	var json 					= JSON.parse(body);
	    	var data 					= json.hits.hits;

	    	for (key in data) {
	    		var tempObject = new Object();
	    		tempObject.dateiname = data[key]._source.Dateiname;
	    		tempObject.id = data[key]._id;

	    		documentArray.push(tempObject);
	    	}
	    	EventEmitter.emit('nextScreenshot', {'filename' : documentArray[0].dateiname, 'id' : documentArray[0].id});
	  	}
	  	else {
	  		console.log(error);
	  	}
		})
}

var queue = 0;
var x 		= 0; 
EventEmitter.on('finishedShot', function(){
	queue = queue - 1;

	while(queue <= 5) {
		EventEmitter.emit('nextScreenshot', {'filename' : documentArray[x].dateiname, 'id' : documentArray[x].id});
		queue = queue + 1;
	}
});

EventEmitter.on('nextScreenshot', function(object) {
	console.log('Aktuelles Dokument', x);
	x 		= x + 1;

	if(x<=documentCount){
	var options = {
		screenSize: {
			width: 650,
			height: 427
		},
		siteType : 'url'
	}
	
	webshot('http://localhost:1337/getbar?id='+object.id, 'screenshots/'+object.filename+'.png', options, function(err) {
		if(err)
			console.log('error', err);
		else
		  console.log('Screenshot', object.filename);
			EventEmitter.emit('finishedShot');
	})
	}
})
