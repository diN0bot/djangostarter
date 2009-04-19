function WebsitesIgnored(meeTimer){
	this.meeTimer = meeTimer;
	this.db = meeTimer.db;
	this.sp = meeTimer.sp;
	
		
	this.initialise();
}

WebsitesIgnored.prototype.initialise = function(){
	this.urls = {};
	
	// Load up ignored
	var fRow = function(statement){
			var url = statement.getString(0);
			url = this.sp.rot13(url);
			this.urls[url] = true;
		};
	this.db.select( "SELECT url FROM ignored_urls", MTCOMMON.bind(this, fRow) );
};

WebsitesIgnored.prototype.addUrl = function(url){
	// Encode and add to DB
	this.sp.addIgnoredUrl(url);
	this.initialise();
	this.setMenu(url);
};
WebsitesIgnored.prototype.removeUrl = function(url){
	// Remove the encoded version
	this.sp.removeIgnoredUrl(url);
	this.initialise();
	this.setMenu(url);
};


WebsitesIgnored.prototype.setMenu = function(url){
	// Update the Popup menu to either 'Add' or 'Remove' this url
	var elPopup = document.getElementById("meetimer-popup-site-menupopup");
	
	var hasUrl = this.test(url);
	
	for( var i = 0; i < elPopup.childNodes.length; i++ ){
		if( !elPopup.childNodes[i].getAttribute("visibleWhenIgnored") ){
			if( hasUrl ){	// already in, remove
				elPopup.childNodes[i].style.display = "none";
			}else{
				elPopup.childNodes[i].style.display = "";				
			}
		}
	}
	if( hasUrl ){
		document.getElementById("meetimer-popup-ignore-remove").style.display = "";
	}else{
		document.getElementById("meetimer-popup-ignore-remove").style.display = "none";
		this.meeTimer.groups.setMenu(url);	// restore
	}
};

WebsitesIgnored.prototype.test = function(url){
	// REturn true if found
	return this.urls[url]? true : false;
};
