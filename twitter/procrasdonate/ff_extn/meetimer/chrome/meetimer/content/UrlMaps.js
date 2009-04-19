function UrlMaps(meeTimer){
	this.meeTimer = meeTimer;
	this.db = meeTimer.db;
	this.sp = meeTimer.sp;
	this.initialise();
};

UrlMaps.prototype.initialise = function(){
	maps = [];
	
	var fRow = function(statement){
			var find = statement.getString(0);
			var replace = statement.getString(1);
			
			var map = {};
			map.find = find;
			map.replace = replace;
			map.regexp = new RegExp( find.replace(/(\"|\'|\\|\^|\$|\*|\+|\?|\=|\!|\:|\||\(|\)|\[|\]|\{|\})/g,"\\$1").replace(/%/g, "(.)*?"), "i");
			maps.push( map );
		};
	this.db.select("SELECT find, replace FROM url_maps", fRow);
	
	this.maps = maps;
};

UrlMaps.prototype.lookup = function(newUrl, altUrl, options){
	if( !options ) options = {};
	var url = "";
	for( var i = 0; i < this.maps.length; i++ ){
		if( this.maps[i].regexp.test(newUrl) ){
			url = this.maps[i].replace;
		}
	}
	if( !url && (altUrl || options.parseDomain) ){
		if( options.parseDomain ){
			var altUrl = newUrl.match( /\/\/(([^\/]+?\.)?([\w]+\.[\w]+))(\/|\:|$)/i );
			if( !altUrl ) return "";
			altUrl = altUrl[1];
		}
		url = altUrl.replace(/^www\./, "");
	}
	return url;
};

UrlMaps.prototype.setMenu = function(url){
	if( this.lookup(url) ){	// Active
		document.getElementById("meetimer-popup-map-add").style.display = "none";
		document.getElementById("meetimer-popup-map-remove").style.display = "";
	}else{
		document.getElementById("meetimer-popup-map-add").style.display = "";
		document.getElementById("meetimer-popup-map-remove").style.display = "none";
	}
};