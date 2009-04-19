/*


*/




/*
	Object to efficiently get/set various Firefox options.
*/

function FFOptions(){

	this.prefService = null;
	try{
		this.prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	}
	catch(e){
		// Could not load it:
	}
}

FFOptions.prototype.getOption = function(prefType, prefKey, prefDefault){
	// Retrieve an option
	
	try{
		switch(prefType){
			case "bool":
				return this.prefService.getBoolPref(prefKey);
			case "int":
				return this.prefService.getIntPref(prefKey);
			default:
				return this.prefService.getCharPref(prefKey);
		}
	}
	catch(e){
		return prefDefault;
	}
};

FFOptions.prototype.setOption = function(prefType, prefKey, prefValue){
	// Set an option		
	
	try{
		switch(prefType){
			case "bool":
				this.prefService.setBoolPref(prefKey, prefValue);
				break;
			case "int":
				this.prefService.setIntPref(prefKey, prefValue);
				break;
			default:
				this.prefService.setCharPref(prefKey, prefValue);
				break;
		}
	}
	catch(e){}
};
