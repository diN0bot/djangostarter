/* Copyright (c) 2006-2008 Pearl Crescent, LLC.  All Rights Reserved. */
/* vim: set sw=2 sts=2 ts=8 et syntax=javascript: */

/*
 * Supported from the command line:
 *    -width <pixels>     open window with width of pixels
 *    -height <pixels>    open window with height of pixels
 *    -saveimage <uri>    save image of the entire page to a default named file
 *    -savepng <uri>      synonym for -saveimage
 *    -savedelay <ms>     wait after page has finished loading before capturing
 *    -captureflash       arrange to capture Flash content
//@line 34 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
 */

var gBrowserWindow = null; // TODO: ideally there would be no global variables.
const kMinimumTimeout = 16;
const kDefaultMaxRefreshWait = 10000; // 10 seconds.
var gLastTimeout = kMinimumTimeout;


function openBrowserWindow(aURI, aSaveOptions, aWidth, aHeight)
{
  var argStr;
  if (aURI)
  {
    argStr = Components.classes["@mozilla.org/supports-string;1"]
             .getService(Components.interfaces.nsISupportsString);
    argStr.data = aURI.spec;
  }

  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefBranch);
  var browserChromeURL = prefSvc.getCharPref("browser.chromeURL");

  var wwSvc = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
              .getService(Components.interfaces.nsIWindowWatcher);
  var winFeatures = "chrome,dialog=no,all";
  if (aWidth > 0)
    winFeatures += ',width=' + aWidth;
  if (aHeight > 0)
    winFeatures += ',height=' + aHeight;
  var win = wwSvc.openWindow(null, browserChromeURL, "_blank",
                             winFeatures, argStr);
  gBrowserWindow = win;

  if (win)
  {
    gLastTimeout = kMinimumTimeout;
    win.pearlSaveOptions = aSaveOptions;
    if (aWidth > 0)
      win.pearlWidth = aWidth;
    if (aHeight > 0)
      win.pearlHeight = aHeight;
    if (aSaveOptions && ("captureFlash" in aSaveOptions))
      win.pearlCaptureFlash = aSaveOptions.captureFlash;

    win.setTimeout(finishInitialization, gLastTimeout);
  }
}


// Called within the browser window's context.
function finishInitialization()
{
  const kWebProg = Components.interfaces.nsIWebProgress;
  var notifyMask = kWebProg.NOTIFY_STATE_WINDOW + kWebProg.NOTIFY_PROGRESS;

  try
  {
    var browser = this.top.getBrowser();
    if (browser.webProgress.isLoadingDocument
        || browser.contentDocument.location == "about:blank")
    {
      resizeWindowIfNecessary(gBrowserWindow);

      // If still loading, image will be saved from progress listener.
      browser.addProgressListener(gBrowserProgressListener, notifyMask);
    }
    else
    {
      try
      {
        // NOTE: nsIRefreshURI.refreshPending was added in Firefox 3.
        const knsIRefreshURI = Components.interfaces.nsIRefreshURI;
        if (browser.docShell.QueryInterface(knsIRefreshURI).refreshPending)
        {
          // <meta> refresh is present in page; wait for the next page to load.
          if (pearlRecordPendingRefresh(gBrowserWindow,
                                        browser.contentDocument))
          {
            browser.addProgressListener(gBrowserProgressListener, notifyMask);
            return;
          }
        }
      }
      catch(e) {}

      triggerImageCapture(gBrowserWindow, true);
    }
  }
  catch (e)
  {
    if (gLastTimeout < 1000)
    {
      gLastTimeout *= 2; // double the timeout and try again soon.
      gBrowserWindow.setTimeout(finishInitialization, gLastTimeout);
    }
  }
}


//@line 143 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"


function pearlMaxRefreshWaitExceeded()
{
  if (gBrowserWindow && gBrowserWindow.pearlRefreshIsPending)
  {
    gBrowserWindow.pearlRefreshIsPending = false;
    // initiate capture now
    triggerImageCapture(gBrowserWindow, true);
    gBrowserWindow = null; // Done.
  }
}


function triggerImageCapture(aBrowserWindow, aDoDelay)
{
  resizeWindowIfNecessary(aBrowserWindow);

  var delayInMS = 0;
  var cp = 1;
//@line 166 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
  if ("pearlSaveOptions" in aBrowserWindow)
  {
    var saveOptions = aBrowserWindow.pearlSaveOptions;
    if (aDoDelay && ("delayInMS" in saveOptions))
      delayInMS = saveOptions.delayInMS;
//@line 177 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
    var options = "noInteraction";
    if ("captureFlash" in saveOptions && saveOptions.captureFlash)
      options += ",captureFlash";
    var actionWhenDoneOpt = ",closeWhenDone";
    if (aBrowserWindow.navigator.userAgent.indexOf("Macintosh") >= 0)
      actionWhenDoneOpt += ",exitWhenDone";
//@line 201 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
  }

  var jsCmd = "PageSaverCaptureImage(null," + cp
//@line 207 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
               + ",0,null,"
//@line 209 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
               + "'" + options + actionWhenDoneOpt + "')";

  aBrowserWindow.setTimeout(jsCmd, delayInMS);
}

function resizeWindowIfNecessary(aBrowserWindow)
{
  if (aBrowserWindow)
  {
    var curW = aBrowserWindow.outerWidth;
    var curH = aBrowserWindow.outerHeight;
    var newW = ("pearlWidth"  in aBrowserWindow) ? aBrowserWindow.pearlWidth
                                                 : curW;
    var newH = ("pearlHeight" in aBrowserWindow) ? aBrowserWindow.pearlHeight
                                                 : curH;
    if (curW != newW || curH != newH)
      aBrowserWindow.resizeTo(newW, newH);
  }
}


// Returns null if aFlagName is not present.
// Returns "" if no argument was provided.  Never throws.
function getCmdLineArg(aCmdLine, aFlagName)
{
  var arg = "";
  try
  {
    arg = aCmdLine.handleFlagWithParam(aFlagName, false);
  }
  catch (e) {}

  return arg;
}


// Returns true if a short refresh is pending (worth waiting for).
function pearlRecordPendingRefresh(aWindow, aContentDoc)
{
  if (!aWindow)
    return false;

  var delay = kDefaultMaxRefreshWait;
//@line 262 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"

  var doWaitForRefresh = true;
  if (aContentDoc) try  // Check document for long refresh (optimization).
  {
    var headElemlist = aContentDoc.getElementsByTagName("head");
    if (headElemlist && headElemlist.length > 0)
    {
      var headElem = headElemlist.item(0);
      var metaElemlist = headElem.getElementsByTagName("meta");
      if (metaElemlist)
      {
        for (var i = 0; i < metaElemlist.length; ++i)
        {
          var metaElem = metaElemlist.item(i);
          var httpEquiv = metaElem.getAttribute("http-equiv");
          if (httpEquiv && "refresh" == httpEquiv.toLowerCase())
          {
            // parseInt() skips leading whitespace.
            var pageDelay = parseInt(metaElem.getAttribute("content"), 10);
            doWaitForRefresh = (isNaN(pageDelay) || (1000*pageDelay) <= delay);
            break; // TODO: handle more than one <meta http-equiv="refresh"> tag
          }
        }
      }
    }
  } catch (e) {}

  if (doWaitForRefresh && !aWindow.pearlRefreshIsPending)
    aWindow.setTimeout(pearlMaxRefreshWaitExceeded, delay);

  aWindow.pearlRefreshIsPending = doWaitForRefresh;
  return doWaitForRefresh;
}


var gBrowserProgressListener = {
  kWebProgListener: Components.interfaces.nsIWebProgressListener,

  /* nsISupports implementation. */
  QueryInterface: function (aIID)
  {
    if (!aIID.equals(Components.interfaces.nsISupports) &&
        !aIID.equals(this.kWebProgListener))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  /* nsIWebProgressListener implementation */
  onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus)
  {
    if (gBrowserWindow && (aStateFlags & this.kWebProgListener.STATE_STOP) &&
        (aStateFlags & this.kWebProgListener.STATE_IS_WINDOW) &&
        (aRequest.name != "about:blank"))
    {
      try
      {
        // NOTE: nsIRefreshURI.refreshPending was added in Firefox 3.
        var browser = gBrowserWindow.top.getBrowser();
        if (browser.docShell.QueryInterface(Components.interfaces.nsIRefreshURI)
                   .refreshPending)
        {
          // <meta> refresh is present in page; wait for the next page to load.
          if (pearlRecordPendingRefresh(gBrowserWindow,
                                        browser.contentDocument))
            return;
        }
      } catch(e) {}

      try
      {
        triggerImageCapture(gBrowserWindow, true);
        gBrowserWindow = null; // Done.

        /*
         * Calling removeProgressListener() causes the browser window to
         * never finish loading the page.  PageSaverCaptureImage() closes
         * the window anyway.
         */
      } catch (e) {}
    }
  },

  onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress,
                             aMaxSelfProgress, aCurTotalProgress,
                             aMaxTotalProgress)
  {
    resizeWindowIfNecessary(gBrowserWindow);

//@line 361 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
  },

  onLocationChange: function (aWebProgress, aRequest, aLocURI) {},
  onStatusChange: function (aWebProgress, aRequest, aStatus, aMsg) {},
  onSecurityChange: function (aWebProgress, aRequest, aState) {},
  onLinkIconAvailable: function (a1, a2) {}
};


var gSavePNGCommandLineHandler = {
  kCaptureCompleteTopic: "PageSaver:CaptureComplete",

  /* nsISupports implementation. */
  QueryInterface: function (aIID)
  {
    if (!aIID.equals(Components.interfaces.nsISupports) &&
        !aIID.equals(Components.interfaces.nsIFactory) &&
        !aIID.equals(Components.interfaces.nsIObserver) &&
        !aIID.equals(Components.interfaces.nsICommandLineHandler))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  /* nsIFactory implementation. */
  createInstance: function (aOuter, aIID)
  {
    if (null != aOuter)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(aIID);
  },

  lockFactory: function (aDoLock) {},

  // nsIObserver
  observe: function (aWindow, aTopic, aParam)
  {
    var doRemove = true;
    if (aTopic == this.kCaptureCompleteTopic && aWindow)
    {
      // TODO: include the original URL?
      // TODO: include the page's HTTP result code?
      var s = aParam.replace('\n', ' ', 'g'); // Replace newlines with spaces.
      dump("PageSaver:CaptureComplete " + s + "\n");
//@line 417 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
    }

    if (doRemove)
    {
      var obsSvc = Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService);
      if (obsSvc)
        obsSvc.removeObserver(this, this.kCaptureCompleteTopic);
    }
  },

  /* nsICommandLineHandler implementation. */
  handle: function (aCmdLine)
  {
    var uriArg = getCmdLineArg(aCmdLine, "saveimage");
    if (!uriArg)
      uriArg = getCmdLineArg(aCmdLine, "savepng");

    if (null != uriArg)
    {
      if (0 == uriArg.length)
      {
        // TODO: No URL given.  Open and save the default page?
        return;
      }

      var saveOptions = {};
      var delayArg = getCmdLineArg(aCmdLine, "savedelay");
      if (null != delayArg)
      {
        saveOptions.delayInMS = parseInt(delayArg, 10);
        if (isNaN(saveOptions.delayInMS))
          saveOptions.delayInMS = 0;
      }

      try
      {
        saveOptions.captureFlash = aCmdLine.handleFlag("captureflash", false);
      } catch (e) {}

//@line 547 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"

//@line 602 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
      var uri = aCmdLine.resolveURI(uriArg);
      var width = 0;
      var height = 0;
      var tmpNum = parseInt(getCmdLineArg(aCmdLine, "width"), 10);
      if (!isNaN(tmpNum) && tmpNum > 0)
        width = tmpNum;
      var tmpNum = parseInt(getCmdLineArg(aCmdLine, "height"), 10);
      if (!isNaN(tmpNum) && tmpNum > 0)
        height = tmpNum;

      openBrowserWindow(uri, saveOptions, width, height);
      aCmdLine.preventDefault = true;

      var obsSvc = Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService);
      if (obsSvc)
        obsSvc.addObserver(this, this.kCaptureCompleteTopic, false);
    }
  },

  helpInfo : "  -saveimage url      Save image of page.\n" +
//@line 629 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/components/cmdline/cmdLineHandler.js.in"
             "  -savedelay ms       Wait after page had loaded before capturing\n"
};


var gSavePNGCommandLineHandlerModule =
{
  kCLHCategory: "m-savepng",
  kICompReg: Components.interfaces.nsIComponentRegistrar,
  kClassID: Components.ID("{bdaf0e90-14ab-4350-904c-c0a7bc0ce5a7}"),
  kContractID: "@pearlcrescent.com/SavePNGCommandLineHandler;1",

  /* nsISupports implementation. */
  QueryInterface: function (aIID)
  {
    if (aIID.equals(Components.interfaces.nsIModule) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsIModule implementation. */
  getClassObject: function (aCompMgr, aClassID, aIID)
  {
    if (!aClassID.equals(this.kClassID))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    return gSavePNGCommandLineHandler.QueryInterface(aIID);
  },

  registerSelf: function (aCompMgr, aFileSpec, aLocation, aType)
  {
    aCompMgr = aCompMgr.QueryInterface(this.kICompReg);
    aCompMgr.registerFactoryLocation(this.kClassID, "savePNGCLH",
                                 this.kContractID, aFileSpec, aLocation, aType);

    var catMgr = Components.classes["@mozilla.org/categorymanager;1"]
                 .getService(Components.interfaces.nsICategoryManager);
    catMgr.addCategoryEntry("command-line-handler", this.kCLHCategory,
                            this.kContractID, true, true);
  },

  unregisterSelf: function (aCompMgr, aFileSpec, aLocation)
  {
    aCompMgr = aCompMgr.QueryInterface(this.kICompReg);
    aCompMgr.unregisterFactoryLocation(this.kClassID, aFileSpec);
    var catMgr = Components.classes["@mozilla.org/categorymanager;1"]
                 .getService(Components.interfaces.nsICategoryManager);
    catMgr.deleteCategoryEntry("command-line-handler", this.kCLHCategory, true);
  },

  canUnload: function (aCompMgr) { return true; }
};


function NSGetModule(aCompMgr, aFileSpec)
{
  return gSavePNGCommandLineHandlerModule;
}
