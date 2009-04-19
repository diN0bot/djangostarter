/* Copyright (c) 2005-2008 Pearl Crescent, LLC.  All Rights Reserved. */
/* vim: set sw=2 sts=2 ts=8 et syntax=javascript: */

//@line 10 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

window.addEventListener("load", SavePageInit, false);

var gPageSaverFirstTime = true;


function SavePageInit()
{
  var wintype;
  try {
    wintype = document.documentElement.getAttribute('windowtype');
  } catch(e) {}
  if (!wintype || wintype != "navigator:browser")
    return;   // page saver only works in browser windows

  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                 .getService(Components.interfaces.nsIPrefBranchInternal);

  // Upgrade old preferences to new, if necessary:
  if (prefs.prefHasUserValue(kOldPrefEntirePage))
  {
    if (!prefs.prefHasUserValue(kPrefPortion))
    {
      var entirePage = nsPreferences.getBoolPref(kOldPrefEntirePage, false);
      nsPreferences.setIntPref(kPrefPortion,
                               entirePage ? kPortionEntire : kPortionVisible);
    }

    try
    {
      prefs.clearUserPref(kOldPrefEntirePage);
    } catch (e) {}
  }

  if (prefs.prefHasUserValue(kOldPrefHideContextMenuItems))
  {
    var doShow = !nsPreferences.getBoolPref(kOldPrefHideContextMenuItems,
                                            false);
    nsPreferences.setBoolPref(kPrefShowContextItemVisible, doShow);
    nsPreferences.setBoolPref(kPrefShowContextItemEntire, doShow);
    nsPreferences.setBoolPref(kPrefShowContextItemFrame, doShow);
//@line 54 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
    try
    {
      prefs.clearUserPref(kOldPrefHideContextMenuItems);
    } catch (e) {}
  }

  // Arrange to be called as the browser context menu is shown.
  var menu = document.getElementById("contentAreaContextMenu");
  if (menu)
    menu.addEventListener("popupshowing", SavePageContextMenuShowing, false);

  prefs.addObserver(kPrefPrefix, gPageSaverPrefChangedObserver, false);
  pageSaverSetShortcutKeyFromPrefs("key_pagesaver_SaveImage", kPrefKey);
  pageSaverSetShortcutKeyFromPrefs("key_pagesaver_CapturePortion",
                                   kPrefPortionKey);

  gPageSaverPrefChangedObserver
                      .setUpDOMContentLoadedListener(window.pearlCaptureFlash);

  window.addEventListener("unload", SavePageUnload, false);

//@line 83 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

  setTimeout("SavePageDelayedInit();", 0);
}

function SavePageDelayedInit()
{
  // Install toolbar item if we have never done so for this profile.
  var TBItemWasInstalled = nsPreferences.getBoolPref(kPrefTBItemInstalled,
                                                     false);
  if (!TBItemWasInstalled)
    SavePageAddToolbarItem();

//@line 99 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  const kWelcomeURI = "http://pearlcrescent.com/products/pagesaver/welcome/";
  const kNewVersionURIPrefix = "http://pearlcrescent.com/products/pagesaver/whatsnew?v=";
//@line 102 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

  // Display "Welcome" or "What's New" page in a new tab if appropriate:
  var extVersion;
  try
  {
    var extMgr = Components.classes["@mozilla.org/extensions/manager;1"]
                        .getService(Components.interfaces.nsIExtensionManager);
    var extInfo = extMgr.getItemForID("{c151d79e-e61b-4a90-a887-5a46d38fba99}");
    extVersion = extInfo.version;
  } catch (e) {}

  var uriToLoad;
  var lastVersion = nsPreferences.copyUnicharPref(kPrefLastVersion);
  if (!lastVersion && TBItemWasInstalled)
    lastVersion = "1.4"; // or earlier, but close enough.
  if (!lastVersion)
    uriToLoad = kWelcomeURI;
  else if (extVersion && lastVersion != extVersion)
    uriToLoad = kNewVersionURIPrefix + extVersion;

  if (uriToLoad)
  {
    var tabBrowser = top.getBrowser();
    if (tabBrowser)
      tabBrowser.loadOneTab(uriToLoad, null, null, null, false, false);

    if (extVersion)
      nsPreferences.setUnicharPref(kPrefLastVersion, extVersion);
  }
}

function SavePageUnload()
{
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                 .getService(Components.interfaces.nsIPrefBranchInternal);
  prefs.removeObserver(kPrefPrefix, gPageSaverPrefChangedObserver);
}

function SavePageAddToolbarItem()
{
  // TODO: Do not add tb item if it is already on a different toolbar.
  const kToolBarID = "nav-bar";
  const kTBItemID = "tb-save-page-image";
  var tbElem = document.getElementById(kToolBarID);
  var tbItemElem = document.getElementById(kTBItemID);
  if (tbElem && !tbItemElem)
  {
    // TODO: prompt before adding toolbar item?
    // TODO: add before throbber if present.
    var newSet = tbElem.currentSet + "," + kTBItemID;
    tbElem.setAttribute("currentset", newSet);
    tbElem.currentSet = newSet;
    document.persist(kToolBarID, "currentset");
    nsPreferences.setBoolPref(kPrefTBItemInstalled, true);

    try {
      BrowserToolboxCustomizeDone(true); // Re-init toolbars, etc.
    } catch (e) {}
  }
}

function SavePageContextMenuShowing()
{
  var savePageMenuItem = document.getElementById("context-savepage");
  var showOurItems = savePageMenuItem && !savePageMenuItem.hidden;

  if (!showOurItems)
  {
    var framesMenu = document.getElementById("frame");
    showOurItems = framesMenu && !framesMenu.hidden;
  }

  gContextMenu.showItem("SaveEntirePageImage", showOurItems &&
                 nsPreferences.getBoolPref(kPrefShowContextItemEntire, false));
  gContextMenu.showItem("SaveVisiblePageImage", showOurItems &&
                 nsPreferences.getBoolPref(kPrefShowContextItemVisible, false));
//@line 182 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  var isInFrame = (window.content.document != document.popupNode.ownerDocument);
  gContextMenu.showItem("PageSaverSaveFrameImage", showOurItems && isInFrame &&
                nsPreferences.getBoolPref(kPrefShowContextItemFrame, false));
}

function SaveDefaultPageImage(aEvent)
{
  var capturePortion = kPortionUsePref;
  if (aEvent)
  {
    var modKeyCount = aEvent.shiftKey + aEvent.altKey +
                      aEvent.ctrlKey + aEvent.metaKey;
    if (modKeyCount == 1)
    {
      if (aEvent.shiftKey)
        capturePortion = kPortionEntire;
      else if (aEvent.altKey)
        capturePortion = kPortionVisible;
//@line 204 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
    }
  }

  PageSaverCaptureImage(null, capturePortion, kDestinationUsePref, null, null);
}

function SavePageImage(aCapturePortion)
{
  PageSaverCaptureImage(null, aCapturePortion, kDestinationUsePref, null, null);
}

function PageSaverCaptureFrame(aClickElem)
{
  var isInFrame = (window.content.document != aClickElem.ownerDocument);
  var win = (isInFrame) ? aClickElem.ownerDocument.defaultView : null;
  PageSaverCaptureImage(win, kPortionEntire, kDestinationUsePref, null, null);
}

function PageSaverCaptureSpecificFrame(aMenuItem)
{
  var topWin = GetTopBrowserWindow();
  if (aMenuItem && topWin)
  {
    var frameElem = pageSaverGetFrameFromValue(topWin,
                                               aMenuItem.getAttribute("value"));
    if (frameElem)
    {
      PageSaverCaptureImage(frameElem.contentWindow, kPortionEntire,
                            kDestinationUsePref, null, null);
    }
  }
}

function DelayedSavePageImage(aCapturePortion)
{
  var cmd = "PageSaverCaptureImage(null, " + aCapturePortion
            + ", " + kDestinationUsePref + ", null, null)";
  setTimeout(cmd, 0);
}


/*
 * PageSaverCaptureImage() is a stable interface.
 *
 * aWindow is the window whose contents should be captured.  If it is null,
 * the top-most window within this XUL context is used.
 *
 * aCapturePortion is an integer:
 *   -2 (kPortionUsePref)
 *    0 (kPortionVisible)
 *    1 (kPortionEntire)
//@line 258 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
 *
 * aDestination is an integer which may be:
 *   -2 (kDestinationUsePref) the default destination
//@line 264 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
 *    0 (kDestinationFile) a local file; specified in aDestObj.
//@line 268 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
 *
//@line 274 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
 * aDestObj (not used at this time).
//@line 276 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
 *
 * aOptions is a string that contains a comma-separated list of options:
 *    closeWhenDone          - close the window after capture is complete.
 *    exitWhenDone           - exit Firefox after capture is complete.
 *    noInteraction          - do not interact with the user, play sounds, etc.
//@line 292 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
 */
function PageSaverCaptureImage(aWindow, aCapturePortion, aDestination, aDestObj,
                               aOptions)
{
  if (!aWindow)
    aWindow = GetTopBrowserWindow();

  if (kPortionUsePref == aCapturePortion)
    aCapturePortion = nsPreferences.getIntPref(kPrefPortion, kPortionEntire);

  if (kDestinationUsePref == aDestination)
  {
    aDestination = nsPreferences.getIntPref(kPrefImageDestination,
                                            kDestinationFile);
  }

  var noInteraction = false;
  var actionWhenDone = 0; /* 1 -> close window, 2 -> exit application */
//@line 317 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  if (aOptions)
  {
    var optionsArray = aOptions.split(',');
    noInteraction = (optionsArray.indexOf("noInteraction") >= 0);
    if (optionsArray.indexOf("closeWhenDone") >= 0)
      actionWhenDone |= 1;
    if (optionsArray.indexOf("exitWhenDone") >= 0)
      actionWhenDone |= 2;
//@line 364 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  }

  // Set variables used inside PageSaverCleanup().
  window.pageSaverActionWhenDone = actionWhenDone;
  window.pageSaverCaptureWindow = aWindow;

  if (aCapturePortion != kPortionVisible && aCapturePortion != kPortionEntire)
//@line 374 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
      aCapturePortion = kPortionVisible;

//@line 410 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

//@line 438 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  var r = pageSaverGetPortionRect(aWindow, aCapturePortion, null);
  SavePageImageRect(aWindow, aDestination, aDestObj, r, null, null,
                    null, null, noInteraction);
//@line 442 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
}

//@line 461 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

/*
 * If it is not NULL, aDestObj is used as the destination.
 * If aImageFormat is non-null, use that content type instead of the default.
 * If aImageOptions is non-null, use those options instead of the default.
 * If aNoInteraction is true, no user interaction is done (for example, the
 *   save location is determined programmatically).
 */
function SavePageImageRect(aWindow, aDestination, aDestObj, aRect, aScale,
                           aElemID, aImageFormat, aImageOptions, aNoInteraction)
{
  if (!aRect || aRect.pageW <= 0 || aRect.pageH <= 0)
  {
    PageSaverNotifyCompletion(kPageSaverResultCodeInvalidArg,
                       GetLocalizedString("ERROR_EMPTY_AREA"), aNoInteraction);
    return;
  }

  var canvas = getImageCanvas();
  if (!canvas)
  {
    PageSaverNotifyCompletion(kPageSaverResultCodeNoCanvas,
                         GetLocalizedString("ERROR_NO_CANVAS"), aNoInteraction);
    return;
  }

  var haveImageFormatOptions = PageSaverHaveToDataURL(canvas);
  var fmt = nsPreferences.getLocalizedUnicharPref(kPrefFileName, "%t");
  var pageTitle;
  var pageURL;
  if (aWindow && aWindow.document)
  {
    pageTitle = aWindow.document.title;
    pageURL = aWindow.document.location.href;
  }
  var fileBaseName = PageSaverFormatText(fmt, pageURL, pageTitle, aElemID,
                                         true);

  var destObj = new Object();
  destObj.destination = aDestination;
  destObj.destInfo = null;
  destObj.imageOptions = aImageOptions;

  if (haveImageFormatOptions)
  {
    destObj.format = aImageFormat ? aImageFormat
                      : nsPreferences.getLocalizedUnicharPref(kPrefImageFormat,
                                                         kPearlContentTypePNG);
  }
  else
    destObj.format = kPearlContentTypePNG;
  var fileExt = PageSaverGetFileExtension(destObj.format);

//@line 531 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

//@line 563 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

//@line 571 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

//@line 587 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

  if (!destObj.destInfo &&
       (aNoInteraction || !nsPreferences.getBoolPref(kPrefFileDoPrompt, true)))
  {
    destObj.destInfo = pageSaverGetDefaultFileLocation(fileBaseName, fileExt);
    if (!destObj.destInfo)
    {
      PageSaverNotifyCompletion(kPageSaverResultCodeInvalidFilePath,
                         GetLocalizedString("ERROR_BADPATH"), aNoInteraction);
      return;
    }
    destObj.destination = kDestinationFile;
  }

  if (!destObj.destInfo)
  {
    // prompt for file:
    var obj = GetSaveLocation(fileBaseName, destObj.format,
                              haveImageFormatOptions);
    if (obj)
    {
      destObj.destInfo = obj.imageFile;
      destObj.format = obj.imageFormat;
    }
  }

  if (!destObj.destInfo)
  {
    PageSaverNotifyCompletion(kPageSaverResultCodeCancelled, null, true);
    return; // user cancelled.
  }

  if (!destObj.imageOptions) // If not yet set, use options from preferences.
  {
    var prefName = PageSaverGetImageOptionsPrefName(destObj.format);
    destObj.imageOptions = nsPreferences.getLocalizedUnicharPref(prefName, "");
  }
  window.pageSaverDest = destObj;

  canvas.style.display = "inline"; // temporarily show the canvas.
  try
  {
    refreshCanvasAndCapture(canvas, aWindow, aRect, aScale, true,
                            aNoInteraction, true);
  }
  catch (e)
  {
    var msg;
    if (e.result == Components.results.NS_ERROR_OUT_OF_MEMORY)
      msg = GetLocalizedString("ERROR_NOT_ENOUGH_MEMORY");
    else
      msg = GetFormattedLocalizedString("ERROR_UNABLETOSAVE_WITH_MESSAGE",
                                        [e.name], 1);
    PageSaverNotifyCompletion(kPageSaverResultCodeCanvasDrawingError, msg,
                              aNoInteraction);
    return;
  }
}

function pageSaverSaveImageAfterDelay(aNoInteraction)
{
  /*
   * Save image after a short delay (needed to allow for drawing).
   * TODO: find a better way to detect when drawing is done.
   */
  var delayInMilliseconds = nsPreferences.getIntPref(kPrefDelay, -1);
  if (delayInMilliseconds < 0)
  {
    // Calculate a good default delay (longer on MacOS).
    if (navigator.userAgent.indexOf("Macintosh") >= 0)
      delayInMilliseconds = 250;
    else
      delayInMilliseconds = gPageSaverFirstTime ? 100 : 60;
  }
  setTimeout("saveImageAndCleanup(" + aNoInteraction + ");", delayInMilliseconds);
  if (gPageSaverFirstTime)
    gPageSaverFirstTime = false;
}

// aFile should be an nsIFile. aBaseName is a string.
// Makes file unique unless kPrefFileOverwrite is set to true.
// Returns true if successful; false if unable to generate unique name or
//      location (aFile) does not exist.
function pageSaverAppendFileName(aFile, aBaseName, aFileExt)
{
  if (!aFile || !aFile.exists())
    return false;

  aFile.append(aBaseName + aFileExt);

  // Check if user has overwrite pref set (so we don't uniquify).
  if (!nsPreferences.getBoolPref(kPrefFileOverwrite, false))
  {
    for (var i = 1; i < 100 && aFile.exists(); i++)
      aFile.leafName = aBaseName + '(' + String(i) + ')' + aFileExt;

    return !aFile.exists();
  }

  return true;
}

// Returns an nsIFile or null.
function pageSaverGetDefaultFileLocation(aFileBaseName, aFileExt)
{
  try
  {
    // If dir exists and can overwrite or make filename unique, use saveLoc.
    var saveLoc = getDownloadDirFromPrefs();
    if (pageSaverAppendFileName(saveLoc, aFileBaseName, aFileExt))
      return saveLoc;
  } catch(e) {}

  return null;
}

function saveImageAndCleanup(aNoInteraction)
{
  var canvas = getImageCanvas();
  if (!canvas || !window.pageSaverDest || !window.pageSaverDest.destInfo
      || !window.pageSaverDest.format)
  {
    PageSaverNotifyCompletion(kPageSaverResultCodeNoCanvas,
                         GetLocalizedString("ERROR_NO_CANVAS"), aNoInteraction);
    return;
  }

  var noSound = aNoInteraction || (window.pageSaverActionWhenDone != 0);

//@line 725 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

  if (window.pageSaverDest.destination <= kDestinationFile)
  {
    SaveImage(canvas, window.pageSaverDest.destInfo,
              window.pageSaverDest.format,
              window.pageSaverDest.imageOptions, noSound, aNoInteraction);
  }
//@line 740 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
}

function PageSaverCleanup()
{
  window.pageSaverDest = null;

  var canvas = getImageCanvas();
  if (canvas)
  {
    // Hide canvas, reduce size and clear
    canvas.style.display = "none";
    setCanvasSize(canvas, 1, 1);
    var context = canvas.getContext("2d");
    if (context)
      context.clearRect(0, 0, 1, 1);

    var doClose = (0 != (window.pageSaverActionWhenDone & 1));
    var doExit = (0 != (window.pageSaverActionWhenDone & 2));

    var appStartupSvc;
    if (doExit) try
    {
      appStartupSvc = Components.classes['@mozilla.org/toolkit/app-startup;1']
                              .getService(Components.interfaces.nsIAppStartup);
    } catch(e) {}

    if (doClose && window.pageSaverCaptureWindow)
      window.pageSaverCaptureWindow.close();

    if (appStartupSvc) try
    {
      appStartupSvc.quit(appStartupSvc.eAttemptQuit);
    } catch(e) {}
  }
}

function SendPageSaverFeedback()
{
//@line 781 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  var uri = "http://pearlcrescent.com/products/pagesaver/feedback.html?FF-Basic/";
//@line 783 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  uri += "2.0.1";
  top.getBrowser().loadURI(uri);
}

function PageSaverToggleArrangeToCaptureFlash()
{
  var val = nsPreferences.getBoolPref(kPrefFlashArrangeToCapture, false);
  nsPreferences.setBoolPref(kPrefFlashArrangeToCapture, !val);
}

function OpenPageSaverOptions()
{
  window.openDialog("chrome://pagesaver/content/prefs.xul", "_blank",
                    "chrome,titlebar,toolbar,centerscreen,modal");
}

function PageSaverUpdateTBMenu(aMenuNode, aIDPrefix)
{
  if (!aIDPrefix)
    aIDPrefix = "";
  var frameMenu = document.getElementById(aIDPrefix + "save-frame-menu");
  if (frameMenu)
  {
    var hasFrames = false;
    var hasIFrames = false;

    var frameMenuPopup = frameMenu.firstChild;
    if (frameMenuPopup)
    {
      var next;
      for (var item = frameMenuPopup.firstChild; item; item = next)
      {
        next = item.nextSibling;
        frameMenuPopup.removeChild(item);
      }

      var topWin = GetTopBrowserWindow();
      hasFrames = pageSaverAddFrameMenuItems(frameMenuPopup, topWin, 'frame');
      hasIFrames = pageSaverAddFrameMenuItems(frameMenuPopup, topWin,
                                               'iframe');
    }

    if (hasFrames || hasIFrames)
      frameMenu.removeAttribute("disabled");
    else
      frameMenu.setAttribute("disabled", true);
  }

  var menuDoc = aMenuNode.ownerDocument;

//@line 900 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

  var id = aIDPrefix + "arrangeToCaptureFlash";
  var arrangeToCaptureFlashItem = menuDoc.getElementById(id);
  if (arrangeToCaptureFlashItem)
  {
    if (PageSaverIsFlashWModeOverrideHelpful())
    {
      var captureFlash = nsPreferences.getBoolPref(kPrefFlashArrangeToCapture,
                                                   false);
      if (captureFlash)
        arrangeToCaptureFlashItem.setAttribute("checked", true);
      else
        arrangeToCaptureFlashItem.removeAttribute("checked");
    }
    else
      arrangeToCaptureFlashItem.setAttribute("hidden", true);
  }
   
  return true;
}

// Returns true if any menu items were added.
function pageSaverAddFrameMenuItems(aMenuPopup, aWin, aElemName)
{
  const kXULNameSpace = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  var itemWasAdded = false;
  var frameElemList = aWin.document.getElementsByTagName(aElemName);
  if (frameElemList)
  {
    for (var i = 0; i < frameElemList.length; ++i)
    {
      var frameElem = frameElemList.item(i);
      if (!pageSaverIsFrameAcceptable(frameElem))
        continue;

      var label = frameElem.contentDocument.title;
      if (!label)
        label = frameElem.contentDocument.location.href;
      if (label)
      {
        var item = document.createElementNS(kXULNameSpace, "menuitem");
        item.setAttribute("label", label);
        item.setAttribute("value", aElemName + '-' + i);
        item.setAttribute("tooltiptext", label);
        item.setAttribute("oncommand",
               "PageSaverCaptureSpecificFrame(this); event.stopPropagation();");
        aMenuPopup.appendChild(item);
        itemWasAdded = true;
      }
    }
  }

  return itemWasAdded;
}

/*
 * Given a value associated with the "Save Image of Entire Frame" menu, returns
 * a frame element or null if not found.
 */
function pageSaverGetFrameFromValue(aWin, aValue)
{
  if (!aWin || !aValue)
    return null;

  var elemNameAndIndex = aValue.split('-');
  var elemName = elemNameAndIndex[0];
  var index = parseInt(elemNameAndIndex[1], 10);
  if (!elemName || isNaN(index) || index < 0)
    return null;

  var frameElemList = aWin.document.getElementsByTagName(elemName);
  if (!frameElemList || index >= frameElemList.length)
    return null;

  return frameElemList.item(index);
}

//@line 983 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

function pageSaverIsFrameAcceptable(aFrameElem)
{
  var doc = aFrameElem.contentDocument;

  if (!doc || !doc.body || !doc.body.firstChild)
    return false; // Ignore empty frames.

  var width = 0;
  var height = 0;
  try
  {
    width = doc.documentElement.clientWidth;
    height = doc.documentElement.clientHeight;
  } catch (e) {}

  if (width <= 0 || height <= 0)
    return false; // Ignore frames that have no width or height.

  var isHidden = false;
  try
  {
    var styleList = aFrameElem.ownerDocument.defaultView
                              .getComputedStyle(aFrameElem, "");
    isHidden = ("hidden" == styleList.getPropertyValue("visibility")
                || "none" == styleList.getPropertyValue("display"));
  } catch(e) {}

  return !isHidden; // Ignore hidden frames.
}

function setCanvasSize(aCanvas, aWidth, aHeight)
{
  aCanvas.style.width = aWidth + "px";
  aCanvas.style.height = aHeight + "px";
  aCanvas.style.maxWidth = aWidth + "px";
  aCanvas.style.maxHeight = aHeight + "px";
  aCanvas.width = aWidth;
  aCanvas.height = aHeight;
}

function pageSaverGetPortionRect(aBrowserWindow, aCapturePortion, aElemID)
{
  // Determine canvas width and height.
  var r = { startX: 0, startY: 0, pageW: 0, pageH: 0, statusCode: 0 };
//@line 1050 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  if (aCapturePortion == kPortionEntire)
  {
    r.startX = 0;
    r.startY = 0;
    r.pageW = GetWindowWidth(aBrowserWindow, true);
    r.pageH = GetWindowHeight(aBrowserWindow, true);
  }
  else if (aCapturePortion == kPortionVisible)
  {
    r.startX = aBrowserWindow.pageXOffset;
    r.startY = aBrowserWindow.pageYOffset;
    r.pageW = GetWindowWidth(aBrowserWindow, false);
    r.pageH = GetWindowHeight(aBrowserWindow, false);
  }
  return r;
}

// aSize must have pageW and pageH fields (which may both be modified).
function pageSaverCapSize(aSize, aExtraHeight)
{
  if (aSize)
  {
    if (!aExtraHeight)
      aExtraHeight = 0;

    var maxDim = pageSaverGetMaxCanvasDimension();
    if (aSize.pageW > maxDim)
      aSize.pageW = maxDim;
    var h = aSize.pageH + aExtraHeight;
    if (h > maxDim)
      h = maxDim;

    // Reduce height if necessary.  See:  gfxASurface::CheckSurfaceSize()
    // This code assumes JavaScript uses integers larger than 32 bits.
    const kMaxInt = Math.pow(2, 31);
    const kBytesPerPixel = 4;
    if (aSize.pageW * h * kBytesPerPixel > kMaxInt)
      h = Math.floor(kMaxInt / aSize.pageW / kBytesPerPixel);

    aSize.pageH = h - aExtraHeight;
  }
}

//@line 1109 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

// This function may throw an exception.
function refreshCanvasAndCapture(aCanvas, aBrowserWindow, aPortionRect, aScale,
                                 aWithZoom, aNoInteraction, aDoCapture)
{
  if (!aCanvas || !aBrowserWindow || !aPortionRect
      || aPortionRect.pageW == 0 || aPortionRect.pageH == 0)
  {
    throw new Components.Exception("no canvas or zero page height or width",
                                   Components.results.NS_ERROR_INVALID_ARG);
  }

//@line 1146 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  var extraHeight = 0;
//@line 1148 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

  var bgColor = "rgb(255,255,255)";
  if (!nsPreferences.getBoolPref("browser.display.use_system_colors", false))
  {
    bgColor = nsPreferences.getLocalizedUnicharPref(
                                  "browser.display.background_color", bgColor);
  }
  // TODO: else get system background color... but there is no JS API.

  // Determine zoom factor and set canvas size.
  var zoomFactor;
  if (aWithZoom)
    zoomFactor = getZoomFactor(aPortionRect.pageW, aPortionRect.pageH, aScale);
  else
    zoomFactor = 1.0;

  var canvasSize = new Object();
  canvasSize.pageW = Math.round(aPortionRect.pageW * zoomFactor);
  canvasSize.pageH = Math.round(aPortionRect.pageH * zoomFactor) + extraHeight; 

  // Cap portion and canvas dimensions (Firefox limitation).
  pageSaverCapSize(aPortionRect, extraHeight);
  pageSaverCapSize(canvasSize, 0);

  // TODO: If cairo cannot allocate enough memory for the canvas, it does not
  // report an error but instead uses a 1x1 pixel cairo surface internally.
  // It also leaves the canvas marked as invalid, which means an error will
  // eventually be reported by toDataURL().  Unfortunately, we have no way
  // to detect this situation.
  setCanvasSize(aCanvas, canvasSize.pageW, canvasSize.pageH);

  var context = aCanvas.getContext("2d");

//@line 1261 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

  // Draw the page image.
// dump("imageCanvas width: " + canvasSize.pageW + ", height: " + canvasSize.pageH + "\n");
// dump("imageCanvas zoomFactor: " + zoomFactor + "\n");
  context.clearRect(0, 0, canvasSize.pageW, canvasSize.pageH);
  context.save();
//@line 1270 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  context.scale(zoomFactor, zoomFactor);

//@line 1289 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"
  {
    context.drawWindow(aBrowserWindow, aPortionRect.startX, aPortionRect.startY,
                       aPortionRect.pageW, aPortionRect.pageH, bgColor);
  }

//@line 1304 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/browserOverlay.js.in"

  context.restore();
  if (aDoCapture)
    pageSaverSaveImageAfterDelay(aNoInteraction);
}

function getZoomFactor(aOrigWidth, aOrigHeight, aScale)
{
  if (aOrigWidth < 1 || aOrigHeight < 1)
    return 1.0;

  var imageSizePref = aScale ? aScale :
                        nsPreferences.getLocalizedUnicharPref(kPrefImageSize);
  var imageSizeNum = parseInt(imageSizePref, 10);
  if (isNaN(imageSizeNum) || imageSizeNum <= 0)
  {
    imageSizePref = kDefaultImageSize;
    imageSizeNum = parseInt(imageSizePref);
  }

  if ('%' == imageSizePref.charAt(imageSizePref.length - 1))
    return (imageSizeNum / 100);

  var horZoom  = imageSizeNum / aOrigWidth;
  var vertZoom = imageSizeNum / aOrigHeight;
  var zoomFactor = (vertZoom < horZoom) ? vertZoom : horZoom;
  return (zoomFactor > 1.0) ? 1.0 : zoomFactor;
}

function getImageCanvas()
{
  var canvas = document.getElementById('pagesaver-canvas-1');
  if (!canvas)
    canvas = document.getElementById('pagesaver-canvas-2');
  return canvas;
}

// Returns an nsILocalFile if successful and null if not.
function getDownloadDirFromPrefs()
{
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);
  var downloadDir;
  try {
    downloadDir = prefs.getComplexValue("browser.download.dir",
                                       Components.interfaces.nsILocalFile);
  } catch (e) {}

  if (!downloadDir) // Use Desktop as a fallback.
  {
    try {
      var fileLocSvc
                 = Components.classes["@mozilla.org/file/directory_service;1"]
                   .getService(Components.interfaces.nsIProperties);
      downloadDir = fileLocSvc.get("Desk", Components.interfaces.nsILocalFile);
    } catch (e) {}
  }

  return downloadDir;
}

function pageSaverSetShortcutKeyFromPrefs(aElemID, aPrefBaseName)
{
  var keyElem = document.getElementById(aElemID);
  if (keyElem)
  {
    var key = nsPreferences.getLocalizedUnicharPref(aPrefBaseName);
    if (key && key.length > 0)
    {
      if (key.length > 1)  // We have a key code, e.g., VK_F12.
      {
        keyElem.setAttribute("keycode", key);
        keyElem.removeAttribute("key");
      }
      else
      {
        keyElem.setAttribute("key", key);
        keyElem.removeAttribute("keycode");
      }

      var modPref = aPrefBaseName + kModifierKeyPrefSuffix;
      var keyMods = nsPreferences.getLocalizedUnicharPref(modPref);
      if (keyMods && keyMods.length > 0)
        keyElem.setAttribute("modifiers", keyMods);
      else
        keyElem.removeAttribute("modifiers");

      keyElem.setAttribute("disabled", "false");
    }
    else
      keyElem.setAttribute("disabled", "true");
  }
}

var gPageSaverPrefChangeIsPending = false;

var gPageSaverPrefChangedObserver = {
  observe: function(aSubject, aTopic, aPrefName)
  {
    if (aTopic != "nsPref:changed")
      return;

    // Reset shortcut key if prefs have changed
    if (0 == aPrefName.indexOf(kPrefKey) && !gPageSaverPrefChangeIsPending)
    {
      // Delayed reload of preferences
      gPageSaverPrefChangeIsPending = true;
      window.setTimeout(this.ReloadPreferences, 100);  // 0.1 secs
    }
    else if (aPrefName == kPrefFlashArrangeToCapture)
      gPageSaverPrefChangedObserver.setUpDOMContentLoadedListener(false);
  },

  ReloadPreferences: function()
  {
    gPageSaverPrefChangeIsPending = false;
    pageSaverSetShortcutKeyFromPrefs("key_pagesaver_SaveImage", kPrefKey);
    pageSaverSetShortcutKeyFromPrefs("key_pagesaver_CapturePortion",
                                     kPrefPortionKey);
  },
  
  // If aDoForceInstall is true, the listener is always installed.
  // If not, the preference is consulted.
  setUpDOMContentLoadedListener: function(aDoForceInstall)
  {
    // Arrange to be called before the onload handler for each page load.
    var appContent = document.getElementById("appcontent");
    if (appContent)
    {
      var forceWMode = aDoForceInstall ||
                  nsPreferences.getBoolPref(kPrefFlashArrangeToCapture, false);
      if (forceWMode)
      {
       appContent.addEventListener("DOMContentLoaded",
                                   this.OnDOMContentLoaded, true);
      }
      else
      {
       appContent.removeEventListener("DOMContentLoaded",
                                      this.OnDOMContentLoaded, true);
      }
    }
  },

  OnDOMContentLoaded: function(aEvent)
  {
    if (!aEvent || !aEvent.originalTarget
        || "#document" != aEvent.originalTarget.nodeName)
    {
      return;
    }

    var doc = aEvent.originalTarget;
    try
    {
      gPageSaverPrefChangedObserver.setWModeAttrOnEach(doc, "embed");
    } catch (e) {}
  },

  setWModeAttrOnEach: function(aDoc, aTagName)
  {
    if (!aDoc || !aTagName)
      return;

    var elemList = aDoc.getElementsByTagName(aTagName);
    if (elemList)
    {
      for (var i = elemList.length - 1; i >= 0; --i)
      {
        var elem = elemList.item(i);
        var wmode = elem.getAttribute("wmode");
        if (wmode)
          wmode = wmode.toLowerCase();
        if (!wmode || (wmode != "opaque" && wmode != "transparent"))
        {
          // It would be better to limit this to Flash objects.
          var elemCopy = elem.cloneNode(true);
          elemCopy.setAttribute("wmode", "opaque");
          elem.parentNode.replaceChild(elemCopy, elem);
        }
      }
    }
  }
} // gPageSaverPrefChangedObserver
