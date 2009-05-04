// ProcrasDonate is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2, or (at your option)
// any later version.
// 
// ProcrasDonate is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details

// ProcrasDonate is built on top of PageAddict, which is likewise GPL 
// licensed. Some aspects of PageAddict are used directly, enhanced, 
// rewritten or completely new.

/*******************************************************************************
 * DOCUMENTATION
 * 
 * __OVERVIEW__
 * 
 * ProcrasDonate keeps track of how long users spend on different sites. Time
 * spent on procrastination sites is summed, and then a proportional donation is
 * made to user-selected recipients.
 * 
 * In addition to setting the donation rate (cents per hour procrastinated),
 * users can set a procrasdonation goal and limit. Currently, procrastination
 * may continue after the time limit is reached, but donations are halted.
 * 
 * Payment is currently performed entirely through TipJoy, a social
 * micro-payment service that integrates with twitter.
 * 
 * For more details visit http://ProcrasDonate.com
 * 
 * __DETAILS__
 * 
 * __HTML INSERTION__ This extension stores user information locally on the
 * user's browser. The ProcrasDonate.com server serves the general website, but
 * certain user-specific pages are necessarily overwritten by the extension.
 * 
 * In particular, the settings and my impact pages are overwritten by the
 * plugin. In fact, both pages have a multiple states, or tabs, that may be
 * viewed.
 * 
 * Note that CSS is still served by the ProcrasDonate.com server
 * 
 * __POSTS SCHEDULING__ Every day (or every week?), the previous day's donation
 * amounts are donated. That is, a POST is made to TipJoy's API for the
 * aggregated donation per recipient.
 * 
 * Information is also sent to the ProcrasDonation.com server for updating the
 * sites and recipients leader boards.
 * 
 * __KNOWN PROBLEMS__
 * 
 * Almost every page loads gives the following error: Error: start_recording is
 * not defined Time recording appears to work fine, so not sure if this yields
 * any actual bugs. Would be nice to keep this from happening so as not to
 * pollute the error list.
 * 
 * 
 * 
 * __VARIABLES IN GM STORE__
 * 
 * href = something like 'bilumi_org' or 'www_google_com__search' tag = user
 * generated string like 'work' or 'games'
 * 
 * 'first_visit' = 'last_visit' -> int = absolute time of last visit in seconds
 * (glocal)
 * 
 * href+'_last' -> int = absolute time of last visit in seconds (per ref)
 * href+'_count' -> int = number of visits. wrong? it's number of seconds
 * visited.
 * 
 * 'page_addict_start' AND window.page_addict_start = True if timing
 * 
 * 'visited' = list of href's visited for < 1 second. ';' separated
 * 'tagmatch_list' = list of "pattern=tag" pairs, ';' separated 'tag_list' =
 * 
 * tag+'_times' tag+'_spent' tag+'_restricted' = use of tag is restricted
 * tag+'_max_time' = max time in minutes before content is blocked
 * 
 * 'total_times' 'total_spent'
 * 
 * 'idle_timeout_mode' = boolean. based on preferences. if hasn't been set yet,
 * is based on platform.
 * 
 * 'twitter_username' 'twitter_password' 'recipient' 'cents_per_hour'
 * 'hr_per_day_goal' = goal number of hours to donate each day 'hr_per_day_max' =
 * max number of hours from which to donate each day
 * 
 * 'settings_state' = enumeration of settings page state 
 * 
 * 'impact_state' = enumeration of impact page state
 * 
 * 'register_state' = enumeration of registration state 
 * 
 * __WINDOW STORE__
 * 
 * page_addict_start = why here and mirror GM STORE 'page_addict_start'? synch
 * issues?
 * 
 * total = tag_counts = unsort_arr =
 * 
 * idle_time = seconds idle as counted by monitor_activity(), which is called
 * every second (see start_recording)
 * 
 * user_active = boolean. set to true in record_activity(), which is triggered
 * by click, scroll and key event listeners. set to false in monitor_activity(),
 * which is called every second from start_recording
 ******************************************************************************/

function add_script(src) {
	var GM_JQ = document.createElement('script');
	GM_JQ.src = src;
	GM_JQ.type = 'text/javascript';
	document.getElementsByTagName('head')[0].appendChild(GM_JQ);
}
///////// Defined in procrasdonate.com
// Add jQuery
//add_script('http://jquery.com/src/jquery-latest.js');
// Add jQuery UI
//add_script('http://jqueryui.com/latest/ui/ui.core.js');
//add_script('http://jqueryui.com/latest/ui/ui.slider.js');

function GM_wait() {
    if(typeof unsafeWindow.jQuery == 'undefined') { window.setTimeout (GM_wait,100); }
    else { $ = unsafeWindow.jQuery; }
}
GM_wait(); 

/** *********************** GLOBAL VARIABLES ********************************* */

function CONSTANTS() {
	/*
	 * Define all global variables here. 
	 */
	PD_DOMAIN = 'http://localhost:8000'
	
	PROCRASDONATE_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/';
	START_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/start_now/';
	LEARN_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/learn_more/';
	IMPACT_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/my_impact/';
	SETTINGS_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/settings/';
	FEEDBACK_URL = PD_DOMAIN+'/twitter/twitter/feedback/procrasdonate/';
	
	COMMUNITY_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/our_community';
	PRIVACY_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/privacy_guarantee/';
	RECIPIENTS_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/recipients';
	POST_DATA_URL = PD_DOMAIN+'/twitter/twitter.procrasdonate/data/';

	// enumeration of settings page state
	SETTINGS_STATE_ENUM = ['twitter_account', 'recipients', 'donation_amounts', 'support', 'site_classifications', 'balance'];
	SETTINGS_STATE_TAB_NAMES = ['Twitter', 'Recipients', 'Donations', 'Support', 'Sites', 'Balance'];
	SETTINGS_STATE_INSERTS = [insert_settings_twitter_account, insert_settings_recipients, insert_settings_donation_amounts, insert_settings_support, insert_settings_site_classifications, insert_settings_balance];
	SETTINGS_STATE_PROCESSORS = [process_twitter_account, process_recipients, process_donation, process_support, process_site_classifications, process_balance];
	//enumeration of impact page state
	IMPACT_STATE_ENUM = ['site_ranks', 'visits', 'history'];
	IMPACT_STATE_TAB_NAMES = ['Site Rankings', 'Current Activity', 'History'];
	IMPACT_STATE_INSERTS = [insert_impact_site_ranks, insert_impact_visits, insert_impact_history];
	// enumeration of register track state
	REGISTER_STATE_ENUM = ['twitter_account', 'recipients', 'donation_amounts', 'support', 'site_classifications', 'balance', 'done'];
	REGISTER_STATE_TAB_NAMES = ['Twitter', 'Recipients', 'Donation', 'Support', 'Sites', 'Balance', 'XXX'];
	REGISTER_STATE_INSERTS = [insert_register_twitter_account, insert_register_recipients, insert_register_donation_amounts, insert_register_support, insert_register_site_classifications, insert_register_balance, insert_register_done];
	REGISTER_STATE_PROCESSORS = [process_twitter_account, process_recipients, process_donation, process_support, process_site_classifications, process_balance, process_done];
	
	DEFAULT_USERNAME = "";
	DEFAULT_PASSWORD = "";
	DEFAULT_RECIPIENTS = "Bilumi*http://bilumi.org*80;ProcrasDonate*http://ProcrasDonate.com*20')";
	DEFAULT_SUPPORT_PCT = 5;
	DEFAULT_CENTS_PER_HOUR = "95";
	DEFAULT_HOUR_PER_DAY_GOAL = "2";
	DEFAULT_HOUR_PER_DAY_MAX = "3";

	DEFAULT_SETTINGS_STATE = "twitter_account";
	DEFAULT_REGISTER_STATE = "twitter_account";
	DEFAULT_IMPACT_STATE = "visits";
	
	// then we can call CONSTANTS() whenever and it's not going to overwrite stuff 	
	CONSTANTS = function() {}
}

/** *************************************************************************** */

window.addEventListener('unload', stop_recording, true);
window.addEventListener('focus', start_recording, true);
window.addEventListener('blur', stop_recording, true);
window.addEventListener('mousemove', validate_mouse, true);
window.addEventListener('keydown', validate_mouse, true);

window.addEventListener('load', house_keeping, true);
// window.addEventListener('load',check_page_inserts, true);
check_restriction();

function register_observers() {
    /*
	 * These observers are used to determine whether a user is idle or active.
	 */
    document.addEventListener('click', record_activity, true);

    document.addEventListener('scroll', record_activity, true);
    document.addEventListener('keydown', record_activity, true);
    window.addEventListener('keydown', record_activity, true);
    // Is mousemove commented out because don't want or doesn't work?
    // speculation: mousemove does not trigger activity because movement on
	// other windows
    // still triggers call? would be good to test sometime, since mousemove
	// might
    // help with game or reading detection
    // document.addEventListener('mousemove',record_activity , true);
}

function record_activity() {
    /*
	 * Boolean used to determine whether a user is idle or not. Record activity
	 * is triggered by the above event listeners
	 */
    window.user_active = true;
}

function monitor_activity() {
    /*
	 * Called every second - see start_recording()
	 * 
	 * Decide whether to stop recording because of in-activity (30 counts of
	 * monitor_activity() = 30 seconds) or start recording because of activity
	 */
    if (window.page_addict_start) {
        if (window.user_active)
            window.idle_time = 0;
        else {
            window.idle_time += 1;
            // GM_log('idle time='+window.idle_time);
        }
        if (window.idle_time > 30) {
            // window.count_seconds+=1;
            if (window.page_addict_start) {
                stop_recording();
            }
        }

    } else {
        if (window.user_active)
            start_recording();
    }

    window.user_active = false;
    // if(window.continue_monitoring)
    // setTimeout(monitor_activity, 15000);
}

// function start_if_active() {
// if(window.user_active)
// start_recording();
// }

function house_keeping() {
    /*
	 * Called on every page load.
	 * 
	 * 0. Set setup account if necessary 
	 * 1. If loading restricted page tag and time limit is exceeded, block page
	 * 2. If loading a pageaddict page, then insert data if necessary 
	 * 3. Updated ProcrasDonate version available for download? 
	 * 4. Update daily state
	 */
    // 0.
	CONSTANTS();
    initialize_account_defaults_if_necessary();
    initialize_state_if_necessary();
    
    // 1.
    var href = window.location.host;
    href = href.replace(/\./g, '_');
    if (!(href.match(/pageaddict_com$/))) {
        check_restriction();
    }

    // 2.
    check_page_inserts();
    
    // 3.
    check_latest_version();
    // GM_setValue('page_addict_start', false);

    // 4.
    var last_global = GM_getValue('last_visit', 0);
    var first = GM_getValue('first_visit', 0);
    // chover = change over, as in change over the day ...?
    var chover = new Date();
    chover.setHours(0, 0, 0);
    chover = Math.round(chover.getTime() / 1000);
    // GM_log('chover='+chover, ' las');
    if (first < chover) {
        // alert('resetting, first='+first);
        reset_visits();
    }
    // var currentTime = new Date();
    // var t_in_s = Math.round(currentTime.getTime()/1000);

    // GM_setValue('last_visit', t_in_s);
    set_default_idle_mode();
}

function check_latest_version() {
    /*
	 * Check if user should update to newer version of page addict
	 */
    var newest_version;

    if (document.getElementById("newest_version")) {
        newest_version = parseInt(
                document.getElementById("newest_version").innerHTML, 10);
        if (newest_version > 30) { // change to a constant somehow
            var cell_text;
            cell_text = "You are running an old version of PageAddict. ";
            cell_text += 'Update <a href="https://addons.mozilla.org/firefox/3685/">here</a>';
            document.getElementById("newest_version").innerHTML = cell_text;
            document.getElementById("newest_version").style.display = "inline";
            // document.getElementById("newest_version").style.color="#EDCB09";
        }
    }
}

function start_recording(no_retry) {
    /*
	 * Start recording user time spent on a particular page.
	 */
    if (window.page_addict_start) {
        // GM_log('cant start recording: local');
        // return;
    }
    if (GM_getValue('page_addict_start', false) == true) {
        // GM_log('cant start recording: global');
        if (!no_retry) {
            setTimeout("start_recording(true)", 200);
        }
        return;
    }

    // if(no_retry)
    // GM_log('delayed start!');

    var currentTime = new Date();
    var t_in_s = Math.round(currentTime.getTime() / 1000);
    window.page_addict_start = t_in_s;
    GM_setValue('page_addict_start', true);

    GM_log('start recording ' + window.location.host + ' @ ' + t_in_s);
    // dump('start recording '+window.location.host);
    // window.page_addict_recording=1;
    if (GM_getValue('idle_timeout_mode', false)) {
        // window.continue_monitoring=true;
        window.user_active = false;
        window.idle_time = 0;
        // window.count_seconds=0;
        if (!(window.interval_id)) {
            window.interval_id = setInterval(monitor_activity, 1000);
        }
        if (!(window.registered_observers)) {
            register_observers();
            window.registered_observers = true;
        }

    }

}

function validate_mouse() {
    /*
	 * Mousemove and keydown are added as EventListeners at the top of this file
	 * Rather than immediately calling start_recording, those listeners call
	 * this method, which removes those same EventListeners.
	 * 
	 * Does that mean that only the first mouse movement or key presses resumes
	 * recording after idle time. Subsequent idles cannot be resumed from mouse
	 * movement or key presses?
	 */
    start_recording();
    // window.page_addict_valid=1;
    window.removeEventListener('mousemove', validate_mouse, true);
    window.removeEventListener('keydown', validate_mouse, true);

}

function stop_recording() {
    /*
	 * Called everytime user becomes idle (if idle timeout is True) switches
	 * tabs or clicks a link (i think).
	 */
    if (window.page_addict_start == null) {
        // GM_log('cant stop recording: local');
        // return;
    }
    if (GM_getValue('page_addict_start', false) == false) {
        // GM_log('cant stop recording: global');
        return;
    }

    // if(window.page_addict_valid==null) return;
    window.continue_monitoring = false;
    var currentTime = new Date();
    var t_in_s = Math.round(currentTime.getTime() / 1000);

    // var href = window.location.host;
    var href = get_this_url();
    // href = href.replace(/\./g, '_');
    // alert(href);
    if (href.length == 0)
        return;
    // if(unsafeWindow.page_addict_start==null) return;
    var last = GM_getValue(href + '_last', 0);
    var last_visit = GM_getValue('last_visit', 0);

    // window.continue_monitoring=false;

    if (window.page_addict_start < last_visit
            || window.page_addict_start == null) {
        // this seems to occur with some frequency in normal browse sessions...
        GM_log('fatal flaw?');
        window.page_addict_start = null;
        GM_setValue('page_addict_start', false);
        window.user_active = false;

        return;
    }

    if (t_in_s > last_visit + 1 || GM_getValue('idle_timeout_mode', false)) {
        var counts = Math.round(t_in_s - window.page_addict_start);
        // if(GM_getValue('idle_timeout_mode', false)) {
        // if(window.count_seconds)
        // counts=window.count_seconds;
        // else
        // counts=0;
        //
        // }

        GM_log('stop recording ' + window.location.host + ' for ' + counts + ' :: ' + href);

        GM_setValue(href + '_count', GM_getValue(href + '_count', 0) + counts);
        // GM_log('stopped recording '+href+', '+counts);
        if (last < 1)
            add_to_list(href, 'visited');
        GM_setValue(href + '_last', t_in_s);
        GM_setValue('last_visit', t_in_s);
        if (t_in_s % 5 == 0)
            GM_savePrefs();
        
        // SEND ANONYMOUS DATA TO PROCRASDONATE SERVER
        // cents_per_hour * 1hr/60min * 1min/60sec * seconds
        var amt = parseInt(GM_getValue('cents_per_hour', 0))/60.0/60.0 * counts;
        var recipient = GM_getValue('recipient', '');
        GM_log("amt "+amt+" counts "+counts);
        if ( amt > 0.0 && counts > 0 ) {
            // post_anonymous_info_to_procrasdonate(get_decoded_url(), counts,
			// amt, recipient);
            // @DAN we probably want to summarize this instead and do posts
			// elsewhere less frequently
        }
    }
    window.page_addict_start = null;
    GM_setValue('page_addict_start', false);
    window.user_active = false;
    setTimeout("window.user_active=false", 100);
    // if(GM_getValue('idle_timeout_mode', false))
    // clearInterval(window.interval_id);

    // window.count_seconds=0;
    
    // check_status();
    // make_payment(GM_getValue('cents_per_hour', ''));
    // create_account();
}

function post_anonymous_info_to_procrasdonate(site, time_spent, amt, recipient, time) {
    /*
	 * Posts anonymous information to procrasdonate server for community page
	 * tracking.
	 * 
	 * Site is domain of site spent time on Time is amount of time spent (in
	 * seconds) Amt is amount user will donate (in cents, based on rate)
	 * Recipient is recipient of donation
	 */
    var params = "site=" + site + "&time_spent=" + time_spent + "&amt=" + amt + "&recipient=" + recipient;
    if ( time ) {
        params += "&time=" + time;
    }

    make_request(
        POST_DATA_URL,
        params,
        'POST',
        function(r) {
            GM_log('POST TO PD worked ' + r.status + ' ' + r.responseText);
        },
        function(r) {
            GM_log('POST TO PD failed');
        }
    );
}

function make_payment(amt) {
    /*
	 * Makes payment via TipJoy
	 */
    var reason = "ProcrasDonating for a good cause";
    var text = "p " + amt + "¢ @" + GM_getValue('recipient') + " " + escape(reason);
    var username = GM_getValue('twitter_username', '')
    var password = GM_getValue('twitter_password', '')
    var params = "twitter_username=" + username + "&twitter_password=" + password + "&text=" + text;
    
    make_request(
        'http://tipjoy.com/api/tweetpayment/',
        params,
        'POST',
        function(r) {
            GM_log('PAYMENT worked ' + r.status + ' ' + r.responseText);
        },
        function(r) {
            GM_log('PAYMENT failed');
        }
    );
}

function check_balance(onload, onerror) {
    /*
	 * Determines user's current TipJoy balance
	 */
    var username = GM_getValue('twitter_username', '')
    var password = GM_getValue('twitter_password', '')
    if ( !username || !password ) {
        return false;
    }
    make_request(
        'http://tipjoy.com/api/user/balance/',
        "twitter_username=" + username + "&twitter_password=" + password,
        'POST',
        onload,
        onerror
    );
}

function make_request(url, params, method, onload, onerror) {
    /*
	 * Helper method for making XmlHttpRequests @param params: string eg,
	 * a=3&b=4 @param method: string, either 'GET' or 'POST'
	 */
    var headers = {
        "User-agent" :"Mozilla/4.0 (compatible) ProcrasDonate",
        "Content-length" :params.length
    }
    if ( method == 'POST' ) headers["Content-type"] = "application/x-www-form-urlencoded";
    // alert(url + " " +params + " "+method+ " "+headers["User-agent"]+"
	// "+headers["Content-length"]+" "+headers["Content-type"]);
    GM_xmlhttpRequest( {
        method : method,
        url : url,
        data : params,
        headers : headers, 
        onload : onload,
        onerror : onerror
    });
}

function check_status() {
    /*
	 * Checks whether user's twitter credentials match a user account on TipJoy.
	 * If so, returns TipJoy user information.
	 */
    GM_log("inside status");
    make_request(
        'http://tipjoy.com/api/user/exists/',
        'twitter_username=' + GM_getValue('twitter_username', ''),
        'GET',
        function(r) {
            GM_log('STATUS worked '+r.result);
        },
        function(r) {
            GM_log('STATUS failed');
        }
    );
    GM_log("leaving status");
}

function create_account() {
    /*
	 * Creates TipJoy account. Not sure what happens if user already exists.
	 */
    var send_to_url = 'http://tipjoy.com/api/createTwitterAccount/';
    var params = 'twitter_username=weatherizer&twitter_password=pea15nut';
    GM_xmlhttpRequest( {
        method :'POST',
        url :send_to_url,
        data :params,
        headers : {
            "User-agent" :"Mozilla/4.0 (compatible) ProcrasDonate",
            "Content-type" :"application/x-www-form-urlencoded",
            "Content-length" :params.length
        },
        onload : function(r) {
            GM_log('CREATE worked ' + r.status + ' ' + r.responseText);
        },
        onerror : function(r) {
            GM_log('CREATE failed');
        }
    });
}

function add_to_list(item, list) {
    /*
	 * Adds item to a GM_store variable called list. Specifically, list is ';'
	 * separated list of items. Item is appended. @param item: boolean, int or
	 * string (GM_store requirement) @param list: string -- name of GM_store
	 * variable.
	 */
    GM_setValue(list, GM_getValue(list, '') + item + ';');
}

function delete_all_data() {
    /*
	 * Resets plugin state.
	 */
    if (!confirm('Do you really want to permenantly delete all the data from pageaddict?'))
        return;
    GM_setValue('first_visit', -1);
    reset_visits();

    var tag_list = get_tag_list();
    var i;

    for (i = 0; i < tag_list.length; i += 1) {
        tag = tag_list[i];
        GM_delValue(tag + '_times');
        GM_delValue(tag + '_spent');
    }
    GM_delValue('ignore_list');
    GM_delValue('tag_list');
    GM_savePrefs();
}

function reset_visits() {
    /*
	 * Called by delete_all_data *and* when new day occurs. Just resets daily
	 * vars.
	 */
    var first = GM_getValue('first_visit', 0);
    if (first > 0)
        store_old_visits();
    var sites_array = GM_getValue('visited', '').split(";");
    GM_setValue('visited', '');
    var currentTime = new Date();
    var t_in_s = Math.round(currentTime.getTime() / 1000);
    GM_setValue('last_visit', t_in_s);
    GM_setValue('first_visit', t_in_s);
    var i;
    for (i = 0; i < sites_array.length; i += 1) {
        GM_delValue(sites_array[i] + '_count');
        GM_delValue(sites_array[i] + '_last');
    }
    // alert('reset addiction counts');
    GM_savePrefs();
}

function initialize_state_if_necessary() {
    /*
	 * Initialize settings and impact state enumerations. Other inits?
	 */
    if (!GM_getValue('settings_state', '')) { GM_setValue('settings_state', DEFAULT_SETTINGS_STATE); }
    if (!GM_getValue('impact_state', '')) { GM_setValue('impact_state', DEFAULT_REGISTER_STATE); }
    if (!GM_getValue('register_state', '')) { GM_setValue('register_state', DEFAULT_IMPACT_STATE); }
}

function initialize_account_defaults_if_necessary() {
    /*
	 * Set any blank account data to defaults.
	 */
    if (!GM_getValue('twitter_username', '')) { GM_setValue('twitter_username', DEFAULT_USERNAME); }
    if (!GM_getValue('twitter_password', '')) { GM_setValue('twitter_password', DEFAULT_PASSWORD); }
    if (!GM_getValue('recipients', '')) { GM_setValue('recipients', DEFAULT_RECIPIENTS); }
    if (!GM_getValue('support_pct', '')) { GM_setValue('support_pct', DEFAULT_SUPPORT_PCT); }
    if (!GM_getValue('cents_per_hour', '')) { GM_setValue('cents_per_hour', DEFAULT_CENTS_PER_HOUR); }
    if (!GM_getValue('hr_per_day_goal', '')) { GM_setValue('hr_per_day_goal', DEFAULT_HOUR_PER_DAY_GOAL); }
    if (!GM_getValue('hr_per_day_max', '')) { GM_setValue('hr_per_day_max', DEFAULT_HOUR_PER_DAY_MAX); }
}

function reset_account_to_defaults() {
    /*
	 * Overwrite existing data (if any) with account defaults
	 */
    GM_setValue('twitter_username', DEFAULT_USERNAME);
    GM_setValue('twitter_password', DEFAULT_PASSWORD);
    GM_setValue('recipients', DEFAULT_RECIPIENTS);
    GM_setValue('support_prct', DEFAULT_SUPPORT_PCT);
    GM_setValue('cents_per_hour', DEFAULT_CENTS_PER_HOUR);
    GM_setValue('hr_per_day_goal', DEFAULT_HOUR_PER_DAY_GOAL);
    GM_setValue('hr_per_day_max', DEFAULT_HOUR_PER_DAY_MAX);
}

function reset_state_to_defaults() {
    /*
	 * Overwrite existing data (if any) with state defaults
	 */
    GM_setValue('settings_state', DEFAULT_SETTINGS_STATE);
    GM_setValue('impact_state', DEFAULT_IMPACT_STATE);
    GM_setValue('register_state', DEFAULT_REGISTER_STATE);
}
 
function store_old_visits() {
    /*
	 * Store old visits in tag_times and tag_spent
	 */
    calculate_time_use();
    var tag_counts = window.tag_counts;
    var tag_list = get_tag_list();
    var i, tag;
    for (i = 0; i < tag_list.length; i += 1) {
        tag = tag_list[i];
        GM_setValue(tag + '_times', GM_getValue(tag + '_times', '')
                + GM_getValue('first_visit', 0) + ";");
        GM_setValue(tag + '_spent', GM_getValue(tag + '_spent', '')
                + tag_counts[tag] + ";");

    }

    GM_setValue('total_times', GM_getValue('total_times', '')
            + GM_getValue('first_visit', 0) + ";");
    GM_setValue('total_spent', GM_getValue('total_spent', '') + window.total
            + ";");

}

function show_hidden_links() {
    /*
	 * Display hidden menu links that only apply to users running the extension.
	 */
    if (document.getElementById("history_link")) {
        document.getElementById("history_link").style.display = "block";
    }
    if (document.getElementById("settings_link")) {
        document.getElementById("settings_link").style.display = "block";
    }

    // document.getElementById("settings_link").style.display="block";
}

function check_page_inserts() {
    /*
	 * Insert data into matching webpage
	 *    pageaddict.com and (localhost:8000 or procrasdonate.com)
	 * See PD_DOMAIN in global constants at top of page.
	 * 
	 * @SNOOPY here for developer grep purposes
	 */
    var host = window.location.host;
    var href = window.location.href;

    function is_required_account_info_missing() {
        /*
		 * Returns True if required account information is missing. Required:
		 * twitter_username twitter_password
		 */
        return !GM_getValue('twitter_username', false) || 
            !GM_getValue('twitter_password', false) ||
            !GM_getValue('recipients', false) ||
            !GM_getValue('cents_per_hour', false) || 
            !GM_getValue('hr_per_day_goal', false) || 
            !GM_getValue('hr_per_day_max', false)
    }
    function replace_start_menu_item_with_settings() {
    	/*
    	 * 
    	 */
        $("#app_menu div a").each(function() {
            var href = $(this).attr("href");
            if ( href == START_URL ) {
                href = SETTINGS_URL;
                $(this).attr("href", href);
                $(this).text("Settings");
            }
        });
    }
    function insert_registration_warning() {
    	/*
    	 * 
    	 */
    }
    function insert_based_on_state(state_name, state_enums, event_inserts) {
		/* Calls appropriate insert method based on current state
		 * 
		 * @param state_name: string. one of 'settings', 'register' or 'impact
		 * @param state_enums: array. state enumeration. one of 'SETTINGS_STATE_ENUM',
		 * 		'REGISTER_STATE_ENUM' or 'IMPACT_STATE_ENUM'
		 * @param event_inserts: array. functions corresponding to enums. one of 
		 * 		'SETTINGS_STATE_INSERTS', 'IMPACT_STATE_INSERTS', 'REGISTER_STATE_INSERTS'
		 */
    	GM_log("INSERT BASED ON "+state_name);
    	for (i = 0; i < state_enums.length; i += 1) {
    		var state = state_enums[i];
    		//GM_log("     "+state+" "+GM_getValue(state_name + '_state', '')+" "+(GM_getValue(state_name + '_state', '')==state)
    		if ( GM_getValue(state_name + '_state', '') == state ) {
    			GM_log("    current state: "+state);
    			event_inserts[i]();
    		}
    	}
    }
    
    if (host.match(/localhost:8000/) || host.match(/procrasdonate\.com/)) {

        // If done registering, change Start menu item to Settings.
    	// Else, if not working on registration track, give registration warning.
        /*if ( is_required_account_info_missing() && href != START_URL ) {
            insert_registration_warning();
        } else {
        	replace_start_menu_item_with_settings();
        }*/
        
        if ( href == START_URL ) {
        	// Page is replaced by registration track (or nothing if not
			// registered).
        	// Once registration track is 'done', Start menu item is replaced by
        	// Settings menu item, and Start page is replaced by settings pages
        	insert_based_on_state('register', REGISTER_STATE_ENUM, REGISTER_STATE_INSERTS);
        }
        // reason why not else if?
        if ( href == SETTINGS_URL ) {
        	// Page is replaced by settings options. Some Settings tabs re-use
        	// snippets inserted by registration inserts
        	insert_based_on_state('settings', SETTINGS_STATE_ENUM, SETTINGS_STATE_INSERTS);
        }
        else if ( href == IMPACT_URL ) {
        	// Page is replaced by impact tabs
        	insert_based_on_state('impact', IMPACT_STATE_ENUM, IMPACT_STATE_INSERTS);
        }
        else if ( href == FEEDBACK_URL ) {
        	reset_state_to_defaults();
        	reset_account_to_defaults();
        }
    }
    if (host.match(/pageaddict\.com$/)) {
        // if(href.match(/pageaddict/)) {
        show_hidden_links();
        if (document.getElementById("insert_statistics_here")) {
            get_results_html();
        }
        if (document.getElementById("insert_history_here")) {
            plot_history(7);
        }
        if (document.getElementById("insert_settings_here")) {
            make_settings();
        }
    }
}

/**
 * *********************** HTML INSERTION FUNCTIONS AND HELPERS
 * *********************************
 */

function make_site_box(name, url, tag) {
    /*
	 * 
	 */
    function undefined_wrap(inner) {
        return "<span class='move_to_left move_to_procrasdonate'>&lt;</span>" + 
            inner + "<span class='move_to_right move_to_timewellspent'>&gt;</span>";
    }
    function procrasdonate_wrap(inner) {
        return inner + "<span class='move_to_right move_to_undefined'>&gt;</span>";
    }
    function timewellspent_wrap(inner) {
        return "<span class='move_to_left move_to_undefined'>&lt;</span>" + inner; 
    }
    
    var text = "<div class='site'>";
    var site_text = "<span class='name'>" + name.replace(/__/g, '/').replace(/_/g,'.') + "</span>";
    if ( tag == 'undefined') text += undefined_wrap(site_text);
    else if ( tag == 'timewellspent') text += timewellspent_wrap(site_text);
    else if ( tag == 'procrasdonate') text += procrasdonate_wrap(site_text);
    text += "</div>";
    return text;
}

function activate_site_box_events() {
    var f = function(elem, tag) {
        var site_name = elem.siblings(".name").text();
        // if ( elem.hasClass("move_to_left") ) { }
        elem.parent().fadeOut("slow");
        $("#"+tag+"_col").prepend(make_site_box(site_name, site_name, tag))
        .next().hide().fadeIn("slow");
    }
    $(".move_to_timewellspent").live("click", function() {
        f($(this), "timewellspent");
    });
    $(".move_to_undefined").live("click", function() {
        f($(this), "undefined");
    });
    $(".move_to_procrasdonate").live("click", function() {
        f($(this), "procrasdonate");
    });
}

function insert_register_balance() {
    /*
	 * Inserts balance/TipJoy info.
	 */
	GM_setValue('register_state', 'balance');

    var middle = "";
    
    $("#content").html( register_wrapper_snippet(middle) );
    activate_register_tab_events();
}

function insert_register_support() {
    /*
	 * Inserts support ProcrasDonate info.
	 */
	GM_setValue('register_state', 'support');

	var pct = GM_getValue('support_pct', DEFAULT_SUPPORT_PCT);
    var middle = "" +
    "<h3>Help us grow and develop</h3>" +
    "<p>Give back to the cause that lets you help the non-profits and content-providers you care about.</p>" +
    "<tr class='above_helprow'><td><label class='right'>Support ProcrasDonate: </label></td>" +
    "<td>" +
    	"<div id='support_slider' class='slider' alt='" + pct + "'></div>" +
		"<input id='support_input' class='input' alt='" + pct + "' value='" + pct + "' size='1'/>" +
	"</td></tr>" +
    "<tr class='helprow'><td></td><td><div class='help'>% of total donation</div></td></tr>";

    $("#content").html( register_wrapper_snippet(middle) );
    activate_register_tab_events();
    
    $("#support_slider").slider({
		//animate: true,
		min: 0,
		max: 10,
		value: pct,
		step: 1,
		slide: function(event, ui) {
    		set_sliders_and_input($(this), $(this).next(), $(this).next().attr("value"), ui.value);
		}
	});

    $("#support_input").keyup(function(event) {
		set_sliders_and_input($(this).prev(), $(this), $(this).attr("alt"), $(this).attr("value"));
	});

	function set_sliders_and_input(slider, input, oldv, newv) {
		if ( newv < 0 || newv > 100 ) return false;
		var diff = oldv - newv;
		input.attr("value", newv).attr("alt", newv);
		//slider.slider('option', 'value', newv);
		slider.slider('option', 'value', newv);
		GM_setValue('support_pct', newv);
		return true;
	}
}

function insert_register_done() {
	GM_setValue('register_state', 'done');
	window.location.href = SETTINGS_URL;
}
function insert_register_site_classifications() {
    /*
	 * Inserts site classification html into page
	 */
	GM_log("irsc");
	GM_setValue('register_state', 'site_classifications');
	
    var cell_text = "<div id='thin_column'>" + register_tab_snippet();
    var procrasdonate_text = "";
    var undefined_text = "";
    var timewellspent_text = "";
    
    // var unsort_arr = [];
    // unsort_arr = window.unsort_arr;
    // var sort_arr = unsort_arr.sort(sortf);
    var sort_arr = [
                    ['www.javascriptkit.com', 'procrasdonate'],
                    ['bilumi.org', 'undefined'],
                    ['www.slashdot.com', 'procrasdonate'],
                    ['news.ycombinator.com', 'procrasdonate'],
                    ['www.ycombinator.com', 'timewellspent'],
                    ['gmail.com', 'timewellspent']
                     ];
    
    for (i = 0; i < sort_arr.length; i += 1) {
        var tag = sort_arr[i][1];
        if ( tag == 'timewellspent' ) {
        	timewellspent_text += make_site_box(sort_arr[i][0], sort_arr[i][0], tag);
        } else if ( tag == 'procrasdonate' ) {
            procrasdonate_text += make_site_box(sort_arr[i][0], sort_arr[i][0], tag);
        } else {
            undefined_text += make_site_box(sort_arr[i][0], sort_arr[i][0], tag);
        }
    }
    
    $("#content").html(cell_text +
    "<div id='site_classifications'>" +
    	"<table<tbody>" +
    		"<tr><td>Procras Donate</td><td>&lt;-- --&gt;</td><td>Time Well Spent</td></tr>" +
    		"<tr><td id='procrasdonate_col'>" +
        		procrasdonate_text + 
        	"</td><td id='undefined_col'>" +
        		undefined_text +
        	"</td><td id='timewellspent_col'>" +
        		timewellspent_text +
        	"</td></tr>" +
        "</tbody></table>" +
    "</div></div>");
    activate_register_tab_events();
    activate_site_box_events();
}

function recipient_snippet(name, url, description) {
	return "<div class='recipient'>" +
				"<div class='name'><a href='" + url + "'>" + name + "</a></div>" +
				"<div class='description'>" + description + "</div>" +
			"</div>";
}

function insert_register_recipients() {
    /*
	 * Inserts form so that user may select recipients.
	 * 
	 * Slider input's alt must contain "last" value of input, so when do keyboard presses we can compute how to alter the other tabs.
	 */
	GM_setValue('register_state', 'recipients');
	
	var user_recipients_ary = [{'name':'Bilumi','url':'http://bilumi.org','description':'Enabling the socially conscious consumer','pct':60},
	                           {'name':'CNC Mill','url':'http://cnc.org','description':'Every hacker should have one','pct':20},
							   {'name':'Save The News','url':'http://cnc.org','description':'La lallaala LAlAla','pct':20}];
	var potential_recipients_ary = [{'name':'Red Cross','url':'http://redcross.org','description':'Exploring mono-chromatic orthoganal artwork since the 1800s'},
	                                {'name':'Green Peace','url':'http://greenpeace.org','description':'Expanding greener pastures'},
	                                {'name':'Act Blue','url':'http://actblue.org','description':'Earning money for democrats and making longer, longer, much longer descriptions for profit.'}
	                                ];

	var user_recipients = "";
	for (var i = 0; i < user_recipients_ary.length; i += 1) {
		var name = user_recipients_ary[i].name;
		var url = user_recipients_ary[i].url;
		var description = user_recipients_ary[i].description;
		var pct = user_recipients_ary[i].pct;
		user_recipients += "" +
			"<div class='recipient_row'>" +
				recipient_snippet(name, url, description) +
				"<div id='slider" + i + "' class='slider' alt='" + pct + "'></div>" +
				"<input id='input"+ i + "' class='input' alt='" + pct + "' value='" + pct + "' size='1'/>" +
				"<div class='remove'>X</div>" +
			"</div>";
	}
	var add_your_own = "" +
		"<div class='recipient_row'>" +
			"<div class='recipient'>" +
				"<div class='name'><input type='text' value='Recipient twitter name'/></div>" +
				"<div class='description'>blah</div>" +
			"</div>" +
			"<div class='add'>Add</div>" +
		"</div>";
	var potential_recipients = "";
	for (var i = 0; i < potential_recipients_ary.length; i += 1) {
		var name = potential_recipients_ary[i].name;
		var url = potential_recipients_ary[i].url;
		var description = potential_recipients_ary[i].description;
		potential_recipients += "" +
			"<div class='recipient_row'>" +
				recipient_snippet(name, url, description) +
				"<div class='add potential'>Add</div>" +
			"</div>";
	}
	
	var cell_text =
        "<div id='thin_column'" +
        	register_tab_snippet() +
        	"<div id='user_recipients'>" +
        		user_recipients +
        	"</div>" +
        	"<div id='potential_recipients'>" +
        		add_your_own +
        		potential_recipients +
        	"</div>" +
        "</div>";
    
	$("#content").html(cell_text)
    activate_register_tab_events();
	
	$(".remove").click(function() {
		$(this).css("background","green");
		$(this).siblings().css("background","yellow");
	});
	
	$(".add").click(function() {
		$(this).css("background","red");
		$(this).siblings().css("background","yellow");
	});
	
	var slider_elems = [];
	for (var i = 0; i < user_recipients_ary.length; i += 1) {
		slider_elems.push($("#slider"+i));
	}
	for (var i = 0; i < slider_elems.length; i += 1) {
		var slider = slider_elems[i];
		var input = slider.next();
		// all sliders except current slider
		var not_slider = slider_elems.slice().splice(i, 0);
		slider.slider({
			//animate: true,
			min: 0,
			max: 100,
			value: $("#slider"+i).attr('alt'),
			//step: not_slider.length,
			slide: function(event, ui) {
				set_sliders_and_input(slider, input, input.attr("value"), ui.value);
			},
		});
		input.keyup(function(event) {
			set_sliders_and_input(slider, input, input.attr("alt"), input.attr("value"));
		});
	}
	function set_sliders_and_input(slider, input, oldv, newv) {
		var diff = oldv - newv;
		input.attr("value", newv).attr("alt", newv);
		slider.slider('option', 'value', newv);
		adjust_other_sliders(slider.attr("id"), diff);	
	}
	function adjust_other_sliders(id, diff) {
		for (var i = 0; i < slider_elems.length; i += 1) {
			var slider = slider_elems[i];
			var input = slider.next();
			if ( slider.attr("id") != id ) {
				var oldv = input.attr("value");
				slider.slider('option', 'value', oldv - diff);
				input.attr("value", oldv - diff).attr("alt", oldv - diff);
			}
		}
	}
}

function insert_register_donation_amounts() {
    /*
	 * Inserts form so that user may enter donation information.
	 */
	GM_setValue('register_state', 'donation_amounts');

    function update_cents_per_day_goal() {
        $("#cents_per_day_goal").text(calculate_cents_per_day_goal());
    }
    function update_cents_per_day_max() {
        $("#cents_per_day_max").text(calculate_cents_per_day_max());
    }
    var middle = "" +
	    "<tr class='above_helprow'><td><label class='right'>ProcrasDonation rate</label></td>" +
	    "<td><input class='left' type='text' name='cents_per_hour' value='"+GM_getValue('cents_per_hour','')+"'></td></tr>" +
	    "<tr class='helprow'><td></td><td><div class='help'>&cent; per hour</div></td></tr>" +
	
	    "<tr class='above_helprow'><td><label class='right'>ProcrasDonation goal</label></td>" +
	    "<td><input class='left' id='hr_per_day_goal' type='text' name='hr_per_day_goal' value='"+GM_getValue('hr_per_day_goal','')+"'></td></tr>" +
	    "<tr class='helprow'><td></td><td><div class='help'>hours per day</span><span id='cents_per_day_goal'></div></td></tr>" +
	    
	    "<tr class='above_helprow'><td><label class='right'>ProcrasDonation limit</label></td>" +
	    "<td><input class='left' id='hr_per_day_max' type='text' name='hr_per_day_max' value='"+GM_getValue('hr_per_day_max','')+"'></td></tr>" +
	    "<tr class='helprow'><td></td><td><div class='help'>hours per day</div></td></tr>";

    $("#content").html( register_wrapper_snippet(middle) );
    activate_register_tab_events();
}

function register_wrapper_snippet(form_middle) {
    var cell_text =
        "<div id='thin_column'" +
        register_tab_snippet() +
        "<form name=\"account_form\" onSubmit=\"return false\">" +
  
            "<div id='errors'></div>" +
            "<div id='success'></div>" +
            
            "<table>" +
            "<tbody>" +
            
            	form_middle +

            "</tbody>" +
            "</table>" +
        "</form>" +
        "</div>";
    return cell_text;
}

function insert_settings_twitter_account() {
	/* Inserts user's twitter account form into page */
	GM_setValue('settings_state','twitter_account');
	GM_log("twit account"+GM_getValue('settings_state','none'));
    var cell_text =
        "<div id='thin_column'" +
        settings_tab_snippet() +
        "</div>";
    
    $("#content").html(cell_text);
    activate_settings_tab_events();
}

function insert_settings_recipients() {
	GM_setValue('settings_state', 'recipients');
    var cell_text =
        "<div id='thin_column'" +
        settings_tab_snippet() +
        "</div>";
    
    $("#content").html(cell_text);
    activate_settings_tab_events();
}

function insert_settings_donation_amounts() {
	GM_setValue('settings_state', 'donation_amounts');
    var cell_text =
        "<div id='thin_column'" +
        settings_tab_snippet() +
        "</div>";
    
    $("#content").html(cell_text);
    activate_settings_tab_events();
}

function insert_settings_site_classifications() {
	GM_setValue('settings_state', 'site_classifications');
    var cell_text =
        "<div id='thin_column'" +
        settings_tab_snippet() +
        "</div>";
    
    $("#content").html(cell_text);
    activate_settings_tab_events();
}

function insert_settings_support() {
	GM_setValue('settings_state', 'support');
    var cell_text =
        "<div id='thin_column'" +
        settings_tab_snippet() +
        "</div>";
    
    $("#content").html(cell_text);
    activate_settings_tab_events();
}

function insert_settings_balance() {
	/* Inserts TipJoy balance html into page */
	GM_setValue('settings_state', 'balance');
    var cell_text =
        "<div id='thin_column'" +
        settings_tab_snippet() +
        "</div>";
    
    $("#content").html(cell_text);
    activate_settings_tab_events();
    
    // works
    // post_anonymous_info_to_procrasdonate('http://bilumi.org', 22, 5,
	// 'bilumi');
    
    /*
	 * check_balance( function(r) { GM_log("balance WORK "+r+" "r.result+"
	 * "+r.reason+" "+r.balance+" "+r.currency); }, function(r) {
	 * GM_log("balance FAIL "+r.result+" "+r.reason+" "+r.balance+"
	 * "+r.currency); } );
	 */
    
    // check_status();
        /*
		 * function(r) { GM_log('STATUS worked ' + r.result + ' ' + r.reason + ' ' +
		 * r.exists + ' ' + r.user + ' ' + r.is_private); }
		 */
    // );
}

function process_support() {
	
}

function validate_cents_input(v) {
    var cents = parseInt(v);
    var hr_per_day_goal = parseFloat($("input[name='hr_per_day_goal']").attr("value"));
    var max = 2000;
    if ( cents > 0 && cents < max ) {
        return true
    }
    if ( cents >= max ) {
        var confirm_results = confirm("Do you really want to donate " + cents + "&cent; every hour you spend procrastinating up to your daily limit of " + hr_per_day_goal + "?");
        if ( confirm_results ) {
            return true
        } else {
            return false
        }
    }
    return false
}

function validate_hours_input(v) {
    var hours = parseFloat(v);
    if ( hours > 0 ) { return true }
    else { return false }
}

function clean_cents_input(v) {
    var cents = parseInt(v);
    return cents
}

function clean_hours_input(v) {
    var hours = parseFloat(v);
    if ( hours > 24 ) { hours = 24; }
    if ( parseInt(hours) != hours ) { hours = hours.toFixed(2); }
    return hours
}

function validate_twitter_username_and_password(username, password) {
    return validate_string(username) && validate_string(password)
}

function validate_string(v) {
    return v && v != ''
}

function process_donation() {
	/*
	 * cents_per_day: pos int
	 * hr_per_day_goal: pos float < 25
	 * hr_per_day_max: pos float < 25
	 */
	var cents_per_hour = parseInt($("input[name='cents_per_hour']").attr("value"));
	var hr_per_day_goal = parseFloat($("input[name='hr_per_day_goal']").attr("value"));
	var hr_per_day_max = parseFloat($("input[name='hr_per_day_max']").attr("value"));
	
	if ( !validate_cents_input(cents_per_hour) ) {
	    $("#errors").append("<p>Please enter a valid dollar amount. For example, to donate $2.34 an hour, please enter 2.34</p>");
	} else if ( !validate_hours_input(hr_per_day_goal) ) {
	    $("#errors").append("<p>Please enter number of hours. For example, enter 1 hr and 15 minutes as 1.25</p>");
	} else if (!validate_hours_input(hr_per_day_max) ) {
	    $("#errors").append("<p>Please enter number of hours. For example, enter 30 minutes as .5</p>");
	} else {
		GM_setValue('cents_per_hour', clean_cents_input(cents_per_hour));
	    GM_setValue('hr_per_day_goal', clean_hours_input(hr_per_day_goal));
	    GM_setValue('hr_per_day_max', clean_hours_input(hr_per_day_max));
		return true;
	}
	return false;
}

function process_balance() {
	return true;
}

function process_site_classifications() {
	return true;
}

function process_recipients() {
	return true;
}

function process_done() {
	return true;
}

function process_twitter_account() {
    /*
	 * Validate account form and save. 
	 * @TODO twitter credentials and recipient twitter name should be verified. 
	 * @TODO all fields should be validated as soon as user tabs to next field.
	 */
    $("#errors").html("");
    $("#success").html("");
    
    var twitter_username = $("input[name='twitter_username']").attr("value");
    var twitter_password = $("input[name='twitter_password']").attr("value");
    
    if ( !validate_twitter_username_and_password(twitter_username, twitter_password) ) {
        $("#errors").append("<p>Please enter your twitter username and password</p>");
        return false;
    } else {
        GM_setValue('twitter_username', twitter_username);
        GM_setValue('twitter_password', twitter_password);
        return true;
    }
}

function _tab_snippet(state_name, state_enums, tab_names) {
	/* Returns menu html for the specified state.
	 * 
	 * Currently, developers must call activate_<state_name>_tab_events() whenever
	 * this html is inserted into the DOM.
	 *
	 * @param state_name: string. one of 'settings', 'register' or 'impact
	 * @param state_enums: array. state enumeration. one of 'SETTINGS_STATE_ENUM',
	 * 		'REGISTER_STATE_ENUM' or 'IMPACT_STATE_ENUM'
	 * @param tab_names: array. tab names corresponding to enums. one of 
	 * 		'SETTINGS_STATE_TAB_NAMES', 'IMPACT_STATE_TAB_NAMES', 'REGISTER_STATE_TAB_NAMES'
	 */
	var tabs_text = "<div id='" + state_name + "_tabs' class='tabs'>";
	
    var selected = GM_getValue(state_name + '_state', '');
    
    for (i = 0; i < state_enums.length; i += 1) {
    	var tab_state = state_enums[i];
    	if ( tab_names[i] == 'XXX') { continue; }
    	
    	var tab_selected_class = '';
    	if ( tab_state == selected ) { tab_selected_class = 'selected'; }
    	
    	tabs_text += "<div id='" + tab_state + "_tab' class='tab link " + tab_selected_class +"'>";
    	tabs_text += tab_names[i];
    	tabs_text += "</div>";
    }    
    tabs_text += "</div>";

    return tabs_text
}

function register_tab_snippet() {
    /* Calls _tab_snippet for register state */
	var ret = _tab_snippet('register', REGISTER_STATE_ENUM, REGISTER_STATE_TAB_NAMES);
	var next_value = "Next";
	if ( GM_getValue('register_state','') == 'tipjoy_account' ) {
		next_value = "Done!";
	}
	ret += "" +
		"<input id='prev_register_track' class='link' type='button' name='save' value='Prev'>" +
		"<input id='next_register_track' class='link' type='button' name='save' value='" + next_value + "'>";
	return ret;

}

function settings_tab_snippet() {
    /* Calls _tab_snippet for settings state */
	return _tab_snippet('settings', SETTINGS_STATE_ENUM, SETTINGS_STATE_TAB_NAMES);
}

function impact_tab_snippet() {
    /* Calls _tab_snippet for impact state */
	return _tab_snippet('impact', IMPACT_STATE_ENUM, IMPACT_STATE_TAB_NAMES);   
}

function _activate_tab_events(state_name, state_enums, event_inserts) {
	/* Attaches EventListeners to tabs
	 *
	 * @param state_name: string. one of 'settings', 'register' or 'impact
	 * @param state_enums: array. state enumeration. one of 'SETTINGS_STATE_ENUM',
	 * 		'REGISTER_STATE_ENUM' or 'IMPACT_STATE_ENUM'
	 * @param event_inserts: array. functions corresponding to enums. one of 
	 * 		'SETTINGS_STATE_INSERTS', 'IMPACT_STATE_INSERTS', 'REGISTER_STATE_INSERTS'
	 */
	for (var i = 0; i < state_enums.length; i += 1) {
		var tab_state = state_enums[i];
		var event = event_inserts[i];
		// closure
		$("#"+tab_state+"_tab").click( (function(event) {
			return event;
		})(event) );
		
		if ( state_name == 'register' ) {
			var current_state = GM_getValue(state_name+'_state', '');
			if ( tab_state == current_state ) {
				if ( i > 0 ) {
					var prev = event_inserts[i-1];
					$("#prev_register_track").show().click( (function(prev) {
						return prev;
					})(prev) );
				} else { $("#prev_register_track").hide(); }
				
				if ( i < state_enums.length ) {
					var next = event_inserts[i+1];
					$("#next_register_track").show().click( (function(next) {
						return next;
					})(next) );
				} else { $("#next_register_track").hide(); }
			}
		}
	}
}

function activate_settings_tab_events() {
    /* Attaches EventListeners to settings tabs */
    _activate_tab_events('settings', SETTINGS_STATE_ENUM, SETTINGS_STATE_INSERTS);
}

function activate_impact_tab_events() {
    /* Attaches EventListeners to impact tabs */
    _activate_tab_events('impact', IMPACT_STATE_ENUM, IMPACT_STATE_INSERTS);
}

function activate_register_tab_events() {
    /* Attaches EventListeners to register tabs */
    _activate_tab_events('register', REGISTER_STATE_ENUM, REGISTER_STATE_INSERTS);
}

function insert_register_twitter_account() {
    /*
	 * Inserts form so that user may enter account information. Required:
	 * twitter_username twitter_password Optional: recipient cents_per_hour
	 * hr_per_day_goal hr_per_day_max
	 */
	GM_setValue('register_state', 'twitter_account');
	
    function update_cents_per_day_goal() {
        $("#cents_per_day_goal").text(calculate_cents_per_day_goal());
    }
    function update_cents_per_day_max() {
        $("#cents_per_day_max").text(calculate_cents_per_day_max());
    }
    var middle = "" +
        "<tr><td><label class='right'>Twitter username </label></td>" +
        "<td><input class='left' type='text' name='twitter_username' value='"+GM_getValue('twitter_username','')+"'></td></tr>" +
        
        "<tr class='above_helprow'><td><label class='right'>Twitter password</label></td>" +
        "<td><input class='left' type='password' name='twitter_password' value='"+GM_getValue('twitter_password','')+"'></td></tr>" +
        "<tr class='helprow'><td></td><td><div class='help'><a href='" + PRIVACY_URL + "'>Privacy Guarantee</a></div></td></tr>";
    
    $("#content").html( register_wrapper_snippet(middle) );
    activate_register_tab_events();
}

function insert_impact_site_ranks() {
    /*
	 * Inserts site ranks information into impact.site_ranks page
	 */
    var sort_arr = [
                    ['www.ycombinator.com', 120, 200],
                    ['bilumi.org', 100, 100],
                    ['gmail.com', 45, 75],
                    ['www.slashdot.com', 30, 50],
                    ['www.javascriptkit.com', 30, 50],
                    ['news.ycombinator.com', 2, 2],
                    ['hulu.com', 1, 1],
                     ];
    
    var cell_text = "<div id='thin_column'>" + impact_tab_snippet();
    cell_text += "<div id='ranks'>";
    cell_text += "<table><tbody>";
    
    var max = null;
    for (i = 0; i < sort_arr.length; i += 1) {
        if ( i == 0 ) max = sort_arr[i][1];
        cell_text += "<tr class='site_rank'>";
        cell_text += "<td class='site_name'>" + sort_arr[i][0] + "</td>";
        cell_text += "<td class='rank'><div class='bar' style='width:" + parseInt( (sort_arr[i][1]/max)*100.0 ) + "%'></div></td>";
        cell_text += "<td class='rank_text'>" + sort_arr[i][1] + " min</td>";
        cell_text += "<td class='rank_text'>$" + sort_arr[i][2] + "</td>";
        cell_text += "</tr>";
    }
    cell_text += "</tbody></table>";
    
    cell_text += "</div>";
    
    $("#content").html(cell_text);
    activate_impact_tab_events();
}

function insert_impact_visits() {
    /*
	 * Inserts visits information into impact.visits page
	 */
    var cell_text = "<div id='thin_column'>" + impact_tab_snippet();
    cell_text += "<div id='procrasdonation_chart' style='width:100%;height:300px'></div>";
    cell_text += "</div>";
    $("#content").html(cell_text);
    activate_impact_tab_events();
    
    var rawdata = [ [10, 1], [17, -14], [30, 5] ];
    var data = [
        {
            // color: color or number
            data: rawdata,
            label: "Games",
            // lines: specific lines options
            // bars: specific bars options
            // points: specific points options
            // threshold: specific threshold options
            // xaxis: 1 or 2
            // yaxis: 1 or 2
            xaxis: 1,
            clickable: true,
            hoverable: true,
            // shadowSize: number
        }
    ];
    var options = {
        lines: { show: true },
        points: { show: true },
        selection: { mode: "x", },
        // crosshair: { mode: "xy", },
    };
    $.plot($("#procrasdonation_chart"), data, options);
}

function insert_impact_history() {
    /*
	 * Inserts historic information into impact.historic page
	 */
    var cell_text = "<div id='thin_column'>" + impact_tab_snippet();
    cell_text += "<div id='procrasdonation_chart' style='width:100%;height:300px'></div>";
    cell_text += "</div>";
    $("#content").html(cell_text);
    activate_impact_tab_events();
    
    var rawdata_procrasdonate = [ [1, 1], [2, 2], [3, 3] ];
    var rawdata_undefined = [ [1, 4], [2, 6], [3, 4] ];
    var rawdata_work = [ [1, 7], [2, 5], [3, 3] ];
    var data = [
        {
            data: rawdata_procrasdonate,
            label: "Procrasdonation",
        },
        {
            data: rawdata_undefined,
            label: "Undefined",
        },
        {
            data: rawdata_work,
            label: "rawdata_work",
        },
    ];
    var options = {
        lines: { show: true },
        points: { show: true },
        bars: { show: true, align: "center" },
        selection: { mode: "x", },
        // crosshair: { mode: "xy", },
    };
    $.plot($("#procrasdonation_chart"), data, options);
}

/**
 * *********************** PAGE ADDICT HTML INSERTIONS
 * *********************************
 */

function make_settings() {
    var cell_text = '<table><tr><td width="300">';
    var i;
    var ignore_list = GM_getValue('ignore_list', '').split(";");
    var tagmatch_list = GM_getValue('tagmatch_list', '').split(";");

    if (ignore_list.length > 1) {
        cell_text += '<h3>List of sites to ignore</h3><table id="ignore_list">';

        for (i = 0; i < ignore_list.length - 1; i += 1) {
            cell_text += '<tr><td>' + ignore_list[i].replace(/_/g, '.');
            cell_text += '</td><td><a href="#" id="delete_' + ignore_list[i] + '">stop ignoring</a></td></tr>';
        }

        cell_text += '</table>';
    }
    cell_text += '<h3>Tag by match</h3><table id="tagmatch_list"><thead><th>Pattern</th><th>Tag</th><th></th></thead>';
    for (i = 0; i < tagmatch_list.length - 1; i += 1) {
        cell_text += '<tr><td>' + tagmatch_list[i].split("=")[0] + '</td><td>'
                + tagmatch_list[i].split("=")[1];
        cell_text += '</td><td><a href="#" id="delete_tagmatch_' + tagmatch_list[i]
                .split("=")[0] + '">delete</a></td></tr>';
    }
    cell_text += '<tr id="tagmatch_add_row"><td></td><td></td><td><a href="#" id="add_tagmatch">+Add</a></td></tr>';
    cell_text += '<tr><td>e.g.</td><td></td></tr>';
    cell_text += '<tr><td>facebook</td><td>social';
    cell_text += '</td><td></td></tr>';
    cell_text += '<tr><td colspan="3">=> *.facebook.com tagged with "social"</td></tr>';

    cell_text += '</table></td><td>';

    cell_text += '<h3>Delete all data from pageaddict</h3>';
    cell_text += '<a href="#" id="delete_everything">delete everything</a>';
    cell_text += '<h3>Idle timeout mode</h3>';
    if (GM_getValue('idle_timeout_mode', false))
        cell_text += '<input id="idle_mode_check" type="checkbox" checked>Enable idle timeout mode';
    else
        cell_text += '<input id="idle_mode_check" type="checkbox">Enable idle timeout mode';

    cell_text += '<br />Time spent in Flash games will not be counted in this mode.';
    cell_text += '</td></tr></table>';

    document.getElementById("insert_settings_here").innerHTML = cell_text;

    for (i = 0; i < ignore_list.length - 1; i += 1) {
        document.getElementById("delete_" + ignore_list[i]).addEventListener(
                'click', delete_ignore, true);
    }
    for (i = 0; i < tagmatch_list.length - 1; i += 1) {
        document.getElementById(
                "delete_tagmatch_" + tagmatch_list[i].split("=")[0])
                .addEventListener('click', delete_tagmatch, true);
    }
    document.getElementById("delete_everything").addEventListener('click',
            delete_all_data, true);
    document.getElementById("add_tagmatch").addEventListener('click',
            add_tagmatch_first, true);
    document.getElementById("idle_mode_check").addEventListener('change',
            update_idle_mode, true);
}

function add_tagmatch_first() {
    document.getElementById("tagmatch_add_row").innerHTML = '<td><input id="match" type="text"></td><td><input id="tag" type="text"></td>';
    document.getElementById("match").addEventListener('change',
            add_tagmatch_observe, true);
    document.getElementById("tag").addEventListener('change',
            add_tagmatch_observe, true);
}

function add_tagmatch_observe() {
    var the_tag = document.getElementById("tag").value;
    var the_match = document.getElementById("match").value;
    if (the_tag && the_tag.length > 0 && the_match && the_match.length > 0) {
        GM_setValue('tagmatch_list', GM_getValue('tagmatch_list', '') + the_match + "=" + the_tag + ";");
        make_settings();
    }
}

function set_default_idle_mode() {
    /*
	 * Called in house_keeping() (everytime a page loads) Sets
	 * 'idle_timeout_mode' if not true and not false to something.
	 * 
	 */
    // alert(navigator.platform);
    if (GM_getValue('idle_timeout_mode', true)
            && !(GM_getValue('idle_timeout_mode', false))) {
        if (navigator.platform.indexOf("Mac") > -1)
            GM_setValue('idle_timeout_mode', true);
        else
            GM_setValue('idle_timeout_mode', false);
    }
}

function update_idle_mode() {
    if (document.getElementById("idle_mode_check").checked)
        GM_setValue('idle_timeout_mode', true);
    else
        GM_setValue('idle_timeout_mode', false);
}

function delete_ignore(event) {
    var site_name = event.target.id.match(/delete_(.*)/)[1];
    var ignore_list = GM_getValue('ignore_list', '').split(";");
    var new_ignore_list = '', i;
    for (i = 0; i < ignore_list.length - 1; i += 1) {
        if (site_name != ignore_list[i])
            new_ignore_list += ignore_list[i] + ';';
    }
    // alert(new_ignore_list);
    GM_setValue('ignore_list', new_ignore_list);
    make_settings();
}

function delete_tagmatch(event) {
    var site_name = event.target.id.match(/delete_tagmatch_(.*)/)[1];
    // GM_log(site_name);
    var tagmatch_list = GM_getValue('tagmatch_list', '').split(";");
    var new_tagmatch_list = '', i;
    for (i = 0; i < tagmatch_list.length - 1; i += 1) {
        if (site_name != tagmatch_list[i].split("=")[0])
            new_tagmatch_list += tagmatch_list[i] + ';';
    }
    // alert(new_ignore_list);
    GM_setValue('tagmatch_list', new_tagmatch_list);
    make_settings();
}

function change_history_cell(since_days) {
    var cell_text = '<p id="history_summary">Minutes you have spent in the past:</p>';
    cell_text += '<table><tr><td colspan="3"><div id="graph" height="300" width="500"></div>';
    cell_text += '<input id="trigger_plot" type="button" onclick="plot_data()" style="display: none">';
    cell_text += '</td><td><div id="insert_legend_here"></div></td></tr><tr><td>';
    cell_text += '<a href="#" id="plot_older">Older</a></td>';
    cell_text += '<td align="center">Days ago</td>';
    cell_text += '<td align="right"><a href="#" id="plot_newer">Newer</a></td>';
    cell_text += '</tr></table><br /><br />';
    cell_text += '<div id="insert_history_here"></div><br />';

    document.getElementById("main_table_cell").innerHTML = cell_text;
    document.getElementById("plot_older").addEventListener('click', function() {
        plot_history(since_days * 2);
    }, true);
    document.getElementById("plot_newer").addEventListener('click', function() {
        plot_history(Math.round(since_days / 2));
    }, true);
}

function new_plot_history(since_days) {
    if (since_days < 2)
        since_days = 2;
    change_history_cell(since_days);
    var t = current_time();
    var since = t - 60 * 60 * 24 * since_days;

    var data_array = [], j, tag, days_collection, times, spent, i, tday, ttime;
    var tag_list = get_tag_list();
    var tag_summary = [];
    var maxy = 0, binning = 1, xticks = [];

    var day_sum = [];

    for (i = 0; i < since_days; i += 1) {
        day_sum[i] = 0;
    }

    if (since_days > 10) {
        binning = Math.round(since_days / 10);
    }

    for (i = 0; i < tag_list.length; i += 1) {
        tag = tag_list[i];
        days_collection = [];

        times = GM_getValue(tag + '_times', '').split(";");
        spent = GM_getValue(tag + '_spent', '').split(";");
        for (j = 0; j < times.length - 1; j += 1) {
            if (parseInt(times[j], 10) < since)
                continue;
            tday = days_after(parseInt(times[j], 10), since);
            days_collection[tday] = parseInt(spent[j], 10);
            day_sum[tday] += parseInt(spent[j], 10);
            GM_log(tday);

        }
        tag_summary[i] = days_collection;
    }

    for (i = 0; i < tag_list.length; i += 1) {
        tag = tag_list[i];
        data_array[i] = [];
        for (j = 0; j < since_days - 1; j += 1) {
            if (maxy < day_sum[j])
                maxy = day_sum[j];
            if (tag_summary[i][j])
                ttime = tag_summary[i][j];
            else
                ttime = 0;
            data_array[i].push( [ j, 0 ]);
            data_array[i].push( [ j + 0.01, day_sum[j] / 60 ]);
            data_array[i].push( [ j + 0.98, day_sum[j] / 60 ]);
            data_array[i].push( [ j + 0.99, 0 ]);
            day_sum[j] -= ttime;

        }

    }

    for (j = 1; j < since_days; j += binning) {
        xticks.push( {
            label :'' + (since_days - j),
            v :j - 1 + 0.5
        });
    }

    GM_log(tag_summary);
    unsafeWindow.plot_data_array = data_array;
    unsafeWindow.pageaddict_tag_list = tag_list;
    unsafeWindow.plot_since = since;
    unsafeWindow.plot_xticks = xticks;
    unsafeWindow.plot_maxy = maxy / 60;

}

function days_after(time, since) {
    the_date = new Date();
    the_date.setTime(time * 1000);
    the_date.setHours(0, 0, 0);

    return Math.floor((the_date.getTime() / 1000 - since) / (60 * 60 * 24));

}

function plot_history(since_days) {
    new_plot_history(since_days);
    if (since_days < 2)
        since_days = 2;
    change_history_cell(since_days);
    var t = current_time();
    var since = t - 60 * 60 * 24 * since_days;
    var tag_list = get_tag_list();
    var i, tag, j, times, spent, all_times = new Object;
    var all_spent = [];
    var all_times_array = [];
    var all_spent_array = [];

    for (i = 0; i < tag_list.length; i += 1) {
        all_spent[i] = new Object;
        tag = tag_list[i];
        times = GM_getValue(tag + '_times', '').split(";");
        spent = GM_getValue(tag + '_spent', '').split(";");
        for (j = 0; j < times.length - 1; j += 1) {
            if (parseInt(times[j], 10) < since)
                continue;
            all_spent[i][times[j]] = parseInt(spent[j], 10);
            all_times[times[j]] = 1
        }
    }

    var total_times = GM_getValue('total_times', '').split(";");
    var total_spent = GM_getValue('total_spent', '').split(";");
    var total_object = new Object;
    for (i = 0; i < total_times.length - 1; i += 1) {
        total_object[total_times[i]] = parseInt(total_spent[i], 10);
    }
    var total_array = [];

    for ( var ttime in all_times)
        all_times_array.push(parseInt(ttime, 10));

    for (i = 0; i < all_times_array.length; i += 1) {
        all_spent_array[i] = [];
        for (j = 0; j < tag_list.length; j += 1) {
            if (all_spent[j]['' + all_times_array[i]])
                all_spent_array[i].push(all_spent[j]['' + all_times_array[i]]);
            else
                all_spent_array[i].push(0);

        }
        if (total_object['' + all_times_array[i]])
            total_array.push(total_object['' + all_times_array[i]]);
        else
            total_array.push(0);

    }

    var data_array = [];
    var this_array, this_sum = [];
    var binning = 1;
    var ntimes = all_times_array.length;
    var maxy = 0, xticks = [];
    var the_date;

    if (ntimes > 10) {
        binning = Math.round(ntimes / 10);
    }
    // alert(''+ntimes+' '+binning);

    for (i = 0; i < all_times_array.length; i += 1) {
        this_sum.push(0.0);
    }
    for (j = 0; j < tag_list.length; j += 1) {
        for (i = 0; i < all_times_array.length; i += 1) {
            this_sum[i] += (all_spent_array[i][j] / 60);
        }
    }
    for (i = 0; i < all_times_array.length; i += 1) {
        if (this_sum[i] > maxy) {
            maxy = this_sum[i];
        }
    }

    for (j = 0; j < tag_list.length; j += 1) {
        this_array = [];

        for (i = 0; i < all_times_array.length; i += 1) {
            the_date = new Date();
            the_date.setTime(all_times_array[i] * 1000);
            the_date.setHours(0, 0, 0);

            this_array.push( [
                    Math.floor((the_date.getTime() / 1000 - since)
                            / (60 * 60 * 24)), this_sum[i] ]);
            this_sum[i] -= (all_spent_array[i][j] / 60);
        }
        data_array.push(this_array);
    }

    var last_days_ago, this_days_ago, days_to_insert, previously_inserted = 0;

    for (i = 0; i < all_times_array.length; i += binning) {
        the_date = new Date();
        the_date.setTime(all_times_array[i] * 1000);
        the_date.setHours(0, 0, 0);
        this_days_ago = Math.floor((t - the_date.getTime() / 1000)
                / (60 * 60 * 24));
        xticks.push( {
            label :'' + this_days_ago,
            v :Math.floor((the_date.getTime() / 1000 - since) / (60 * 60 * 24))
        });

        if (i > 0) {
            days_to_insert = last_days_ago - this_days_ago - 1;
            if (days_to_insert > 0) {
                for (j = 0; j < days_to_insert; j += 1) {
                    // insert zeroin data_array and xticks at position
                    // i-1+previously_inserted
                }
                previously_inserted += days_to_insert;
            }
        }
        last_days_ago = this_days_ago;

    }

    // var line = new EasyPlot("line", {}, $('graph'), data_array);
    // unsafeWindow.plot_data_array=data_array;
    // unsafeWindow.pageaddict_tag_list=tag_list;
    // unsafeWindow.all_times_array=all_times_array;
    // unsafeWindow.plot_since=since;
    // unsafeWindow.plot_xticks=xticks;
    // unsafeWindow.plot_maxy=maxy;

    document.getElementById("trigger_plot").click();

    var page_text = '';
    page_text += '<table width="500px" id="history_table" cellspacing="0"><tr align="left"><th>Day</th>';
    for (i = 0; i < tag_list.length; i += 1) {
        page_text += '<th>' + tag_list[i] + '</th>';
    }
    page_text += '<th>all</th></tr><tbody>';
    var months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
            'Sep', 'Oct', 'Nov', 'Dec' ];

    for (i = all_times_array.length - 1; i > 0; i -= 1) {
        the_date = new Date();
        the_date.setTime(all_times_array[i] * 1000);
        // page_text+='<tr><td>'+Math.floor((t-all_times_array[i])/(60*60*24))+'</td>';
        page_text += '<tr><td>' + the_date.getDate() + '-'
                + months[the_date.getMonth()] + '-' + the_date.getFullYear()
                + '</td>';
        for (j = 0; j < tag_list.length; j += 1) {
            page_text += '<td>' + Math.round(all_spent_array[i][j] / 60) + '</td>';
        }
        page_text += '<td>' + Math.round(total_array[i] / 60) + '</td></tr>';
    }

    page_text += '</tbody></table>';

    document.getElementById("insert_history_here").innerHTML = page_text;
}

function calculate_time_use() {
    var sites_array = GM_getValue('visited', '').split(";");
    var i, count, alert_str = '', total = 0;
    var unsort_arr = [];
    var tag_counts = new Object;
    var span = GM_getValue('last_visit', 0) - GM_getValue('first_visit', 0);
    if (span < 1) {
        span = 1;
    }

    var tag_list = GM_getValue('tag_list', '').split(";");
    tag_list.pop();
    tag_list.push("undefined")
    var this_tags, j, found_tag;

    for (i = 0; i < tag_list.length; i += 1) {
        tag_counts[tag_list[i]] = 0;
    }

    for (i = 0; i < sites_array.length - 1; i += 1) {
        if (in_ignore_list(sites_array[i]) == 1) {
            continue;
        }
        // if(sites_array[i].length>1) {
        count = GM_getValue(sites_array[i] + '_count', 0);
        // alert_str+=sites_array[i]+': '+(Math.round(count*10/12)/10)+'
        // mins\n';
        unsort_arr.push( [ sites_array[i], count,
                Math.round(count * 1000 / span) / 10.0 ]);
        // }
        total += count;
        this_tags = get_tag_for_site(sites_array[i]);

        if (this_tags.length > 0)
            tag_counts[this_tags] += count;
        else
            tag_counts["undefined"] += count;

    }

    window.tag_counts = tag_counts;
    window.total = total;
    window.unsort_arr = unsort_arr;
}

function get_results_html() {
    /*
	 * Inserts user's browsing results into page!!
	 */
    var sites_array = GM_getValue('visited', '').split(";");
    var i, count, alert_str = '', total = 0;
    var unsort_arr = [];
    var tag_counts = new Object;
    var span = GM_getValue('last_visit', 0) - GM_getValue('first_visit', 0);
    if (span < 1) {
        span = 1;
    }

    var tag_list = GM_getValue('tag_list', '').split(";");
    tag_list.pop();
    tag_list.push("undefined");
    var this_tags, j, found_tag;

    calculate_time_use();

    unsort_arr = window.unsort_arr;
    total = window.total;
    tag_counts = window.tag_counts;

    var sort_arr = unsort_arr.sort(sortf);
    var page_text = '';
    var terror = GM_getValue('error', '');
    if (terror.length > 0) {
        page_text += '<div id="pa_error">' + terror + '</div>';
        GM_setValue('error', '');
    }

    page_text += '<br /><span id="total_summary">';
    page_text += 'Total time spent: ' + pretty_time(total) + '<br />'
            + Math.round(total * 100 / span) + '% of ' + pretty_time(span)
            + ' since browser started today</span><br /><br />';

    // page_text+='<p>defined tags: '+tag_list;

    page_text += '<table width="500px" id="tags_table" cellspacing="0"><tr align="left"><th>Tag</th><th>Time</th><th>% Total</th><th>Restrict?</th><th>Minutes/day</th><th></th></tr><tbody>';
    for (i = 0; i < tag_list.length; i += 1) {
        page_text += '<tr><td>' + tag_list[i] + '</td>';
        page_text += '<td>' + pretty_time(tag_counts[tag_list[i]]) + '</td>';
        page_text += '<td>' + Math.round(tag_counts[tag_list[i]] * 1000 / span) / 10.0 + '%</td>';
        if (GM_getValue(tag_list[i] + '_restricted', 0) > 0) {
            page_text += '<td align="center"><input id="check_restrict_' + tag_list[i] + '" type="checkbox" checked></td>';
            page_text += '<td><input id="number_restrict_' + tag_list[i]
                    + '" type="text" value="'
                    + GM_getValue(tag_list[i] + '_max_time', 0)
                    + '" size="5"></td>';
        } else {
            page_text += '<td align="center"><input id="check_restrict_' + tag_list[i] + '" type="checkbox"></td>';
            page_text += '<td><input id="number_restrict_' + tag_list[i] + '" type="text" disabled" size="5"></td>';
        }
        page_text += '<td><a href="#" id="delete_tag_' + tag_list[i] + '" style="color: black">delete</a></td></tr>';
    }

    page_text += '</tbody></table>';

    page_text += '<br /><span>';
    page_text += '<select id="tag_drop">';
    page_text += '<option value="_ignore">Tag...</option>';
    page_text += '<option value="_new_tag">&nbsp;&nbsp;&nbsp;New tag...</option>';
    page_text += '<option value="_remove_tags">&nbsp;&nbsp;&nbsp;Remove tags</option>';
    page_text += '<option value="_ignore_forever">&nbsp;&nbsp;&nbsp;Ignore site</option>';
    page_text += '<option value="_ignore" disabled>----</option>';
    page_text += '<option value="_ignore" disabled>Apply tag</option>';

    for (i = 0; i < tag_list.length - 1; i += 1) { // leave undefined tag out
        page_text += '<option value="' + tag_list[i] + '">&nbsp;&nbsp;&nbsp;'
                + tag_list[i] + '</option>';
    }
    page_text += '</select>';
    page_text += '</span><span>';
    page_text += '<input type="text" id="new_tag_name" style="display: none;">';
    page_text += '</span>';

    page_text += '<br /><table width="500px" id="sites_table" cellspacing="0"><tr align="left"><th></th><th>Site</th><th>Time</th><th>% Total</th><th>Tags</th></tr><tbody>';

    for (i = 0; i < sort_arr.length; i += 1) {
        page_text += '<tr><td><input id="check_' + sort_arr[i][0] + '" type="checkbox"></td>';
        page_text += '<td>' + sort_arr[i][0].replace(/__/g, '/').replace(/_/g,
                '.');
        // page_text+=' "'+sort_arr[i][0]+'" ';
        page_text += '</td>';
        page_text += '<td>' + pretty_time(sort_arr[i][1]) + '</td>';
        page_text += '<td>' + sort_arr[i][2] + '%</td><td>'
                + get_tag_for_site(sort_arr[i][0]) + '</td></tr>';
    }
    page_text += '</tbody></table>';

    document.getElementById("insert_statistics_here").innerHTML = page_text;
    var add_tag_field = document.getElementById("new_tag_name");
    add_tag_field.addEventListener('change', add_tag, true);
    var tname;
    for (i = 0; i < tag_list.length; i += 1) {
        tname = tag_list[i];
        document.getElementById("check_restrict_" + tag_list[i])
                .addEventListener('change', update_restriction_policy, true);
        document.getElementById("number_restrict_" + tag_list[i])
                .addEventListener('change', update_restriction_policy, true);
        document.getElementById("delete_tag_" + tag_list[i]).addEventListener(
                'click', delete_tag, true);
    }
    document.getElementById("tag_drop").addEventListener('change', drop_watch,
            true);
    // get_results();a
}

function delete_tag(event) {
    var tag_name = event.target.id.match(/delete_tag_(.*)/)[1];
    var tag_list = GM_getValue('tag_list', '').split(";");
    var new_tag_list = '', i;
    if (!confirm("Are you sure you want to delete the tag '" + tag_name + "'?"))
        return;
    for (i = 0; i < tag_list.length - 1; i += 1) {
        if (tag_name != tag_list[i])
            new_tag_list += tag_list[i] + ';';
    }
    // alert(new_tag_list);
    var tag_list = GM_setValue('tag_list', new_tag_list);
    get_results_html();
}

function get_tag_list() {
    var tag_list = GM_getValue('tag_list', '').split(";");
    tag_list.pop();
    tag_list.push("undefined");
    return tag_list;
}

function update_restriction_policy() {
    var tag_list = get_tag_list();
    var element, element2;
    for (i = 0; i < tag_list.length; i += 1) {
        element = document.getElementById("check_restrict_" + tag_list[i]);
        if (element && element.checked) {
            GM_setValue(tag_list[i] + '_restricted', 1);
            element2 = document
                    .getElementById("number_restrict_" + tag_list[i]);
            if (element2 && parseInt(element2.value, 10) > 0)
                GM_setValue(tag_list[i] + '_max_time', parseInt(element2.value,
                        10));
        } else {
            GM_setValue(tag_list[i] + '_restricted', 0);
        }
    }
    get_results_html();
}

function get_this_url() {
    /*
	 * Returns current domain with '.' replaced by '_' eg, bilumi_org or
	 * www_google_com
	 * 
	 * For google and google only, appends first path component to domain if one
	 * exists. eg, http://www.google.com/search?q=mosuo becomes
	 * www_google_com__search
	 * 
	 * @TODO canonicalize existence and absence of 'www'
	 */
    var site = window.location.host;

    site = site.replace(/\./g, '_');
    if (site.match(/www_google_com$/)) {
        var path_array = window.location.pathname.split('/');
        if (path_array.length > 1 && path_array[1].length > 0) {
            site = site + "__" + path_array[1];
        }
    }

    return site;
}

function get_decoded_url() {
    /*
	 * Returns exactly what get_this_url() would return, withough any character
	 * encoding.
	 * 
	 * eg, bilumi.org or www.google.com or www.google.com/search
	 * 
	 * @TODO KEEP IN SYNCH WITH GET THIS URL!
	 */
    var site = window.location.host;

    if (site.match(/www_google_com$/)) {
        var path_array = window.location.pathname.split('/');
        if (path_array.length > 1 && path_array[1].length > 0) {
            site = site + "/" + path_array[1];
        }
    }

    return site;
}

function get_tag_for_site(site) {
    var tag = GM_getValue(site + '_tags', '');
    if (tag[tag.length - 1] == ';')
        tag = tag.slice(0, -1);

    if (tag.length == 0) {
        var tagmatch_list = GM_getValue('tagmatch_list', '').split(";");
        var site2 = site.replace(/__/g, '/').replace(/_/g, '.');

        for (i = 0; i < tagmatch_list.length - 1; i += 1) {
            if (site2.indexOf(tagmatch_list[i].split("=")[0]) > -1) {
                tag = tagmatch_list[i].split("=")[1];
            }
        }
    }
    return tag;

}

function check_restriction() {
    /*
	 * If on pageaddict site, do nothing.
	 * 
	 * If on restricted website and time use has exceeded tag+'_max_time' Then
	 * enforce_restriction()
	 */
    var site = get_this_url();

    if (site.match(/pageaddict_com$/))
        return;

    var this_tags = get_tag_for_site(site);
    var i;
    var tags_to_check = [];

    // alert(site);
    if (this_tags.length == 0) {
        this_tags = 'undefined';
    }

    if (GM_getValue(this_tags + '_restricted', 0) > 0) {
        tags_to_check.push(this_tags);
    }

    if (tags_to_check.length > 0) {
        calculate_time_use();
        var tag_counts = window.tag_counts;
        for (i = 0; i < tags_to_check.length; i += 1) {
            if (tag_counts[tags_to_check[i]] > (GM_getValue(
                    tags_to_check[i] + '_max_time', 0)) * 60) {
                enforce_restriction();
            }
        }
    }
}

function enforce_restriction() {
    /*
	 * Rewrite page content to block access! This is called when visiting a site
	 * which is tagged by a tag that has a time limit set and the time limit has
	 * been exceeded.
	 */

    // document.body.bgColor='white';
    // document.body.background='none';
    // document.body.style.background='none';
    // document.body.style.color='black';

    var i;
    for (i = 0; i < document.styleSheets.length; i += 1) {
        document.styleSheets[i].disabled = true;

    }

    document.body.innerHTML = '<p />get back to work!<p />page access blocked by pageaddict';
}

function drop_watch() {
    var menu = document.getElementById("tag_drop").value;
    // alert(menu.value);
    if (menu == '_new_tag') {
        document.getElementById("new_tag_name").style.display = 'inline';
        document.getElementById("new_tag_name").focus();
        return;
    }
    document.getElementById("new_tag_name").style.display = 'inline';
    if (menu == '_remove_tags') {
        remove_tags(menu);
        return;
    }
    if (menu == '_ignore_forever') {
        ignore_forever(menu);
        return;
    }

    if (menu == '_ignore') {
        return;
    }
    apply_tag(menu);

}

function add_tag() {

    var field = document.getElementById("new_tag_name");
    var tag = field.value;

    if (!tag.match(/[a-zA-Z0-9]+/)) {
        GM_setValue('error', 'Invalid tag name');
        get_results_html();
        return;
    }

    var tag_list = GM_getValue('tag_list', '');
    GM_setValue('tag_list', tag_list + tag + ';');
    apply_tag(tag);
    get_results_html();
}

function apply_tag(tag) {
    // var tag_list=GM_getValue('tag_list', '');
    // GM_setValue('tag_list', tag_list+tag+';');
    var sites_array = GM_getValue('visited', '').split(";");
    var check;
    for (i = 0; i < sites_array.length - 1; i += 1) {
        check = document.getElementById("check_" + sites_array[i]);
        if (check && check.checked) {
            // if(in_list(tag, sites_array[i]+'_tags')==0)
            // ensure_in_list(tag, sites_array[i]+'_tags');
            GM_setValue(sites_array[i] + '_tags', tag + ';');
        }
    }
    get_results_html();

}

function ignore_forever() {
    // var tag_list=GM_getValue('tag_list', '');
    // GM_setValue('tag_list', tag_list+tag+';');
    var sites_array = GM_getValue('visited', '').split(";");
    var check;
    for (i = 0; i < sites_array.length - 1; i += 1) {
        check = document.getElementById("check_" + sites_array[i]);
        if (check && check.checked) {
            GM_setValue('ignore_list', GM_getValue('ignore_list', '')
                    + sites_array[i] + ';');
        }
    }
    get_results_html();

}

function ensure_in_list(item, list) {
    if (in_list(item, list) == 0)
        add_to_list(item, list);
}

function in_list(item, listn) {
    var list = GM_getValue(listn, '').split(";");
    for (i = 0; i < list.length - 1; i += 1) {
        if (item == list[i]) {
            return 1;
        }
    }
    return 0;
}

function in_ignore_list(site) {
    var list = GM_getValue('ignore_list', '').split(";");
    for (i = 0; i < list.length - 1; i += 1) {
        if (site == list[i]) {
            return 1;
        }
    }
    return 0;
}

function current_time() {
    var currentTime = new Date();
    return Math.round(currentTime.getTime() / 1000);

}

function insert_into_array(arr, item, position) {
    var left, right;
    left = arr.splice(0, position);
    right = arr.slice(position + 1);
    left.push(item);
    return left.concat( [ item ], right);

}

function remove_tags(tag) {
    // var tag_list=GM_getValue('tag_list', '');
    // GM_setValue('tag_list', tag_list+tag+';');
    var sites_array = GM_getValue('visited', '').split(";");
    var check;
    for (i = 0; i < sites_array.length - 1; i += 1) {
        check = document.getElementById("check_" + sites_array[i]);
        if (check && check.checked) {
            GM_setValue(sites_array[i] + '_tags', '');
        }
    }
    get_results_html();

}

function sortf(b, a) {
    return ((a[1] < b[1]) ? -1 : ((a[1] > b[1]) ? 1 : 0));
    // return a[1] - b[1];
}

function pretty_time(ts) {
    if (ts > 3600 * 2) {
        return '' + Math.floor(ts / 3600) + ' hrs '
                + Math.round((ts - Math.floor(ts / 3600) * 3600) / 60)
                + ' mins';
    } else if (ts > 60 * 2) {
        return '' + Math.round(ts / 60) + ' minutes';
    } else {
        return '' + Math.round(ts) + ' seconds';
    }
}
