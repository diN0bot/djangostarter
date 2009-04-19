/* Copyright (c) 2005-2008 Pearl Crescent, LLC.  All Rights Reserved. */
/* vim: set sw=2 sts=2 ts=8 et syntax=javascript: */

const kMaxScrollbarSize = 40; // We assume no scrollbar is wider than this.

const kDefaultImageSize = "100%";
const kPNGFileExtension = ".png";
const kJPEGFileExtension = ".jpg";
const kJPEGFileExtension2 = ".jpeg";
const kPearlContentTypePNG = "image/png";
const kPearlContentTypeJPEG = "image/jpeg";
//@line 15 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

const kPageSaverPwdStoreRealm = "Pearl Crescent Page Saver";

const kPrefPrefix = "pagesaver.";
const kPrefImageSize = kPrefPrefix + "imagesize";
const kPrefPortion = kPrefPrefix + "captureportion";
const kPortionUsePref = -2;
const kPortionVisible = 0;
const kPortionEntire = 1;
//@line 27 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

const kPrefFlashArrangeToCapture = kPrefPrefix + "flash.arrangeToCapture";
const kPrefPlaySoundOnCapture = kPrefPrefix + "playsoundoncapture";

const kPrefContextPrefix = kPrefPrefix + "showcontextmenuitem.";
const kPrefShowContextItemVisible = kPrefContextPrefix + "savevisible";
const kPrefShowContextItemEntire = kPrefContextPrefix + "saveentire";
const kPrefShowContextItemFrame = kPrefContextPrefix + "saveframe";
//@line 38 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

const kPrefFileName = kPrefPrefix + "file.name";
const kPrefFileDoPrompt = kPrefPrefix + "file.prompt";     // default: true
const kPrefFileOverwrite = kPrefPrefix + "file.overwrite"; // default: false

//@line 49 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

const kPrefImageFormat = kPrefPrefix + "image.format";
const kPrefImageFormatOptionsPrefix = kPrefPrefix + "image.options.";

//@line 58 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

const kPrefImageDestination = kPrefPrefix + "destination";
const kDestinationUsePref = -2;
//@line 64 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"
const kDestinationFile = 0;
//@line 68 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

const kModifierKeyPrefSuffix = ".modifiers";
const kFriendlyKeyPrefSuffix = ".friendly";
const kPrefKey = kPrefPrefix + "key";
const kPrefPortionKey = kPrefPrefix + "key.portion";

/* hidden preferences */
const kPrefDelay = kPrefPrefix + "delay";
//@line 80 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"
const kPrefTBItemInstalled = kPrefPrefix + "toolbariteminstalled";
const kPrefLastVersion = kPrefPrefix + "lastVersion";
const kPrefFileExtension = kPrefPrefix + "file.extension";
const kPrefMaxCanvasDimension = kPrefPrefix + "canvas.maxDimension";
//@line 90 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

/* deprecated preferences */
const kOldPrefEntirePage = kPrefPrefix + "entirepage";
const kOldPrefHideContextMenuItems = kPrefPrefix + "hidecontextmenuitems";

/*
 * Result codes.  Keep these in sync. with the constants defined in
 * ../../pagesaver-toolkit/mozilla/idl/pearlICapturePageImage.idl
 */
const kPageSaverResultCodeSuccess = 0;
const kPageSaverResultCodeCancelled = 1;
const kPageSaverResultCodeNoInteractionAllowed = 2;
const kPageSaverResultCodeInvalidArg = 3;
const kPageSaverResultCodeNoCanvas = 4;
const kPageSaverResultCodeCanvasDrawingError = 5;
const kPageSaverResultCodeCanvasStreamError = 6;
const kPageSaverResultCodeInvalidFilePath = 7;
const kPageSaverResultCodeFileOutputError = 8;
const kPageSaverResultCodeUploadError = 9;
const kPageSaverResultCodeClipboardError = 10;
const kPageSaverResultCodeElementNotFound = 11;

var gPageSaverHorzScrollBarHeight = 0;

/************ Public functions (called from outside this file) ***************/
function PageSaverAlert(aMsg)
{
  try
  {
    var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                       .getService(Components.interfaces.nsIPromptService);
    ps.alert(window, GetLocalizedString("DIALOG_TITLE"), aMsg);
  }
  catch (e)
  {
    alert(aMsg);
  }
}

function PageSaverGetImageOptionsPrefName(aContentType)
{
  var name = kPrefImageFormatOptionsPrefix;
  if (aContentType && aContentType.length)
    name += aContentType;
  return name;
}

function PageSaverGetFileExtension(aContentType)
{
  var fileExt = nsPreferences.getLocalizedUnicharPref(kPrefFileExtension);
  if (fileExt)
    return fileExt;

  if (!aContentType || aContentType == kPearlContentTypePNG)
    return kPNGFileExtension;

  if (aContentType == kPearlContentTypeJPEG)
    return kJPEGFileExtension;

  var slashLoc = aContentType.indexOf('/');
  return '.'
         + ((slashLoc >= 0) ? aContentType.substr(slashLoc+1) : aContentType);
}

function PageSaverPlaySound()
{
  var doPlay = nsPreferences.getBoolPref(kPrefPlaySoundOnCapture, true);
  if (!doPlay)
    return;

  // Play "image captured" sound
  try
  {
    const kShutterSoundURI = "chrome://pagesaver/skin/cameraclick.wav";
    var soundURIObj = PageSaverStringToURIObj(kShutterSoundURI);
    var soundObj = Components.classes["@mozilla.org/sound;1"]
                             .createInstance(Components.interfaces.nsISound);
    soundObj.init();
//    soundObj.beep();
    soundObj.play(soundURIObj);
  } catch (e) {}
}

function PageSaverNotifyCompletion(aResultCode, aMsg, aNoInteraction)
{
  var notifyParam = "" + aResultCode + " (";
  notifyParam += (kPageSaverResultCodeSuccess == aResultCode)
                 ? "success)" : "failure)";
  if (aMsg)
    notifyParam += '-' + aMsg;

  try
  {
    var obsSvc = Components.classes["@mozilla.org/observer-service;1"]
                       .getService(Components.interfaces.nsIObserverService);
    obsSvc.notifyObservers(window, "PageSaver:CaptureComplete", notifyParam);
  } catch(e) {}

  if (kPageSaverResultCodeSuccess != aResultCode && !aNoInteraction)
    PageSaverAlert(aMsg ? aMsg : notifyParam);

  PageSaverCleanup();
}

//@line 309 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

function PageSaverStringToURIObj(aURIStr)
{
  try
  {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
    return ioService.newURI(aURIStr, null, null);
  } catch (e) {}

  return null;
}

// Return height of window client area.
function GetWindowHeight(aWindow, aEntirePage)
{
  /*
   * Use offsetHeight of document element unless it is too small (for example,
   * some pages have an offsetHeight 20 even though scrollMaxY is large).
   * Our fallback is to use window.innerHeight which will be too large if a
   * horizontal scrollbar is present.
   *
   * Avoid docElement.clientHeight because in standards compliance mode it
   * only includes the visible height.
//@line 351 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"
   */
  var height = -1;
  try
  {
    var hasHorzSB = (aWindow.scrollMaxX > 0);
    var sbMaxHeight = (hasHorzSB) ? kMaxScrollbarSize : 0;
    var altWinHeight = aWindow.innerHeight + aWindow.scrollMaxY - sbMaxHeight;

    var docElement = aWindow.document.documentElement;
    if (docElement && docElement.offsetHeight
        && docElement.offsetHeight > aWindow.scrollMaxY
        && altWinHeight <= docElement.offsetHeight)
    {
      // Ideal Calculation of window's height.
      height = docElement.offsetHeight;
      if (!aEntirePage)
        height -= aWindow.scrollMaxY;
    }

    if (height < 0)
    {
      // Alternate calculation (includes height of horz. scrollbar if unknown).
      if (hasHorzSB && 0 == gPageSaverHorzScrollBarHeight) try
      {
        // Add hidden element with height=100% and use to determine SB height.
        var tmpElem = aWindow.document.createElement("div");
        tmpElem.setAttribute("style", "visibility: hidden; z-index: -1;"
                             + " position: fixed; top: 0px; left: 0px;"
                             + " margin: 0px; padding: 0px; border: none;"
                             + " width: 100%; height: 100%");
        aWindow.document.body.appendChild(tmpElem);
        var h = aWindow.innerHeight - tmpElem.offsetHeight;
        if (h > 0 && h < kMaxScrollbarSize)
          gPageSaverHorzScrollBarHeight = h;
        aWindow.document.body.removeChild(tmpElem);
      } catch (e) {}

      height = aWindow.innerHeight; // Includes height of horz. SB if present.
      if (hasHorzSB && gPageSaverHorzScrollBarHeight > 0)
        height -= gPageSaverHorzScrollBarHeight;
      if (aEntirePage)
        height += aWindow.scrollMaxY;
    }
  } catch(e) {};

  if (height < 0)
    height = 0;

  return height;
}

// Return width of window client area.
function GetWindowWidth(aWindow, aEntirePage)
{
  var browserWidth = 0;
  try
  {
    browserWidth = aWindow.innerWidth; // our fallback
    var docElement = aWindow.document.documentElement;
    if (docElement && docElement.clientWidth)
      browserWidth = docElement.clientWidth; // usually more accurate

    if (aEntirePage)
      browserWidth += aWindow.scrollMaxX;
  } catch(e) {};

//  dump("GetWindowWidth(): returning width: " + browserWidth + "\n");
  return browserWidth;
}

function pageSaverGetMaxCanvasDimension()
{
  var maxDim = nsPreferences.getIntPref(kPrefMaxCanvasDimension, 0);
  if (maxDim <= 0)
  {
    var ua = navigator.userAgent;
    if (ua.indexOf("Macintosh") >= 0 || ua.indexOf("Windows") >= 0)
      maxDim = 32767; // Windows or Mac OS.
    else
      maxDim = 32766; // Linux and friends.
  }

  return maxDim;
}

// May throw, but if so this function displays an error first.
function GetInputStreamOfCanvasData(aImageCanvas, aImageFormat, aImageOptions,
                                    aNoInteraction)
{
  if (!PageSaverHaveToDataURL(aImageCanvas))
  {
    PageSaverNotifyCompletion(kPageSaverResultCodeCanvasStreamError,
                     GetLocalizedString("ERROR_UNABLETOSAVE"), aNoInteraction);
    throw new Components.Exception("canvas.toDataURL() is not available",
                                   Components.results.NS_ERROR_UNEXPECTED);
  }

  try
  {
    var s = aImageCanvas.toDataURL(aImageFormat, aImageOptions);
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
    var uriObj = ioService.newURI(s, null, null);
    var dataChannel = ioService.newChannelFromURI(uriObj);
    var binStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                    .createInstance(Components.interfaces.nsIBinaryInputStream);
    binStream.setInputStream(dataChannel.open());
    return binStream;
  }
  catch (e)
  {
    var errMsg = e;

    // Check for lack of image encoder for the requested image format:
    const kEncoderClassPrefix = "@mozilla.org/image/encoder;2?type=";
    if (!((kEncoderClassPrefix + aImageFormat) in Components.classes))
    {
      errMsg = GetFormattedLocalizedString("ERROR_UNABLETOSAVE_WITH_MESSAGE",
                                           [aImageFormat], 1);
    }
    PageSaverNotifyCompletion(kPageSaverResultCodeCanvasStreamError, errMsg,
                              aNoInteraction);
    throw e; // Pass it along.
  }
}

function SaveImage(aImageCanvas, aSaveLoc, aImageFormat, aImageOptions,
                   aNoSound, aNoInteraction)
{
  if (!aSaveLoc)
  {
    PageSaverNotifyCompletion(kPageSaverResultCodeInvalidArg,
                   GetLocalizedString("ERROR_UNABLETOSAVE"), aNoInteraction);
    return;
  }

  var binStream;
  try
  {
    binStream = GetInputStreamOfCanvasData(aImageCanvas, aImageFormat,
                                           aImageOptions, aNoInteraction);
  }
  catch (e)
  {
    return; // GetInputStreamOfCanvasData() reports errors and notifies.
  }

  try
  {
    const kFileStreamClass = "@mozilla.org/network/file-output-stream;1";
    var fileStream = Components.classes[kFileStreamClass]
                  .createInstance(Components.interfaces.nsIFileOutputStream);
    const kWriteOnly = 0x02; // see prio.h
    const kCreateFile = 0x08;
    const kTruncate = 0x20;
    var flags = kWriteOnly | kCreateFile | kTruncate;
    fileStream.init(aSaveLoc, flags, 0666, false);
    PearlCopyStreamToStream(binStream, fileStream);
    fileStream.close();
  }
  catch (e)
  {
    var resultCode;
    var msg;
    if (e.result == Components.results.NS_ERROR_FILE_NOT_FOUND)
    {
      resultCode = kPageSaverResultCodeInvalidFilePath;
      msg = GetLocalizedString("ERROR_BADPATH");
    }
    else
    {
      resultCode = kPageSaverResultCodeFileOutputError;
      msg = e.toString();
    }

    PageSaverNotifyCompletion(resultCode, msg, aNoInteraction);
    return;
  }

  if (!aNoSound)
    PageSaverPlaySound();

  PageSaverNotifyCompletion(kPageSaverResultCodeSuccess, null, aNoInteraction);
}

function PearlCopyStreamToStream(aBinInputStream, aOutputStream)
{
  const kMaxBlockSize = 65536;
  var remaining = aBinInputStream.available();
  while (remaining > 0)
  {
    var count = (remaining > kMaxBlockSize) ? kMaxBlockSize : remaining;
    var b = aBinInputStream.readBytes(count);
    aOutputStream.write(b, count);
    remaining -= count;
  }
}

//@line 611 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"


function GetTopBrowserWindow()
{
  var winMed = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator);
  var winList = winMed.getZOrderDOMWindowEnumerator("navigator:browser", true);
  if (!winList.hasMoreElements())
    return top.getBrowser().contentWindow; // fallback

  return winList.getNext().getBrowser().contentWindow;
}

/*
 * returns an object with two properties: imageFile (nsILocalFile) and
 *                                        imageFormat (a content type string).
 *         or null if the user canceled or an error occurred.
 */
function GetSaveLocation(aFileBaseName, aDefaultImageFormat,
                         aHaveImageFormatOptions)
{
  if (!aFileBaseName)
    return null;

  var fp = null;
  try {
    fp = Components.classes["@mozilla.org/filepicker;1"]
                   .createInstance(Components.interfaces.nsIFilePicker);
  } catch (e) {}
  if (!fp) return null;

  var promptString = GetLocalizedString("SAVEPROMPT");
  fp.init(window, promptString, Components.interfaces.nsIFilePicker.modeSave);
  var imageFormats = [];
  var filterName = GetLocalizedString("FILTERNAME_PNG");
  fp.appendFilter(filterName, '*' + kPNGFileExtension);
  imageFormats.push(kPearlContentTypePNG);
  var fileExt = kPNGFileExtension;
  
  if (aHaveImageFormatOptions) // Offer a choice of formats.
  {
    filterName = GetLocalizedString("FILTERNAME_JPEG");
    fp.appendFilter(filterName, '*' + kJPEGFileExtension);
    imageFormats.push(kPearlContentTypeJPEG);
    fileExt = PageSaverGetFileExtension(aDefaultImageFormat);
    if (aDefaultImageFormat == kPearlContentTypePNG)
      fp.filterIndex = 0;
    else if (aDefaultImageFormat == kPearlContentTypeJPEG)
      fp.filterIndex = 1;
    else
    {
      fp.appendFilter(aDefaultImageFormat, "*" + fileExt);
      imageFormats.push(aDefaultImageFormat);
      fp.filterIndex = 2;
    }
  }
  var suggestedFileName = aFileBaseName + fileExt;
  fp.defaultString = suggestedFileName;
  fp.defaultExtension = fileExt.substring(1);
  var dlogResult = fp.show();
  if (dlogResult == Components.interfaces.nsIFilePicker.returnCancel)
    return null;

  return { imageFile: fp.file, imageFormat: imageFormats[fp.filterIndex] };
}

function PageSaverFormatText(aFormat, aPageURL, aPageTitle, aElemID, aIsFile)
{
  function MD5Hash(aStr)
  {
    var rv = "";

    if (null != aStr) try
    {
      const knsICryptoHash = Components.interfaces.nsICryptoHash;
      var arrayOfStr = [];
      for (var j = 0; j < aStr.length; ++j)
        arrayOfStr.push(aStr.charCodeAt(j));

      var ch = Components.classes["@mozilla.org/security/hash;1"]
                         .createInstance(knsICryptoHash);
      ch.init(knsICryptoHash.MD5);
      ch.update(arrayOfStr, arrayOfStr.length);
      var md5 = ch.finish(false /* raw, binary result */);
      rv = StringToHex(md5);
    } catch (e) {}

    return rv;
  }

  function StringToHex(aStr)
  {
    const kHexDigits = "0123456789abcdef";
    var hexStr = "";
    if (aStr)
    {
      for (j = 0; j < aStr.length; ++j)
      {
        var c = aStr.charCodeAt(j);
        hexStr += (kHexDigits[(c >> 4) & 0x0F] + kHexDigits[c & 0x0F]);
      }
    }

    return hexStr;
  }

  var result = "";
  var url = "";
  if (aPageURL)
  {
    url = aPageURL;
    if (aIsFile)
    {
      url = url.replace(/^[a-z]*:[\/]*/, "");   // remove leading scheme://
      url = url.replace(/\.[a-zA-Z]*$/, "");    // remove file name extension
      url = url.replace(/\/$/, "");             // remove trailing /
    }
  }

  try
  {
    var today = new Date();
    var len = aFormat.length;
    var elemID = (aElemID != null) ? aElemID : "";
    for (var i = 0; i < len; i++)
    {
      if (aFormat[i] != '%' || i + 1 == len)
        result += aFormat[i];
      else if (aFormat[i+1] == '%')
      {
        result += '%';
        ++i;
      }
      else
      {
        switch(aFormat[i+1])
        {
          case 't':
            if (aPageTitle)
              result += aPageTitle;
            ++i;
            break;
          case 'u': result += url; ++i; break;
          case 'm': result += IntTo2Char(1 + today.getMonth()); ++i; break;
          case 'd': result += IntTo2Char(today.getDate()); ++i; break;
          case 'Y': result += today.getFullYear(); ++i; break;
          case 'H': result += IntTo2Char(today.getHours()); ++i; break;
          case 'M': result += IntTo2Char(today.getMinutes()); ++i; break;
          case 'S': result += IntTo2Char(today.getSeconds()); ++i; break;
          case 'i': result += elemID; ++i; break;
          case '5': result += MD5Hash(aPageURL); ++i; break;
          default:
            result += "%";
        }
      }
    }
  } catch(e) {}

  if (aIsFile)
    result = SanitizeFileName(result);

  return result;
}

/*
 * Replace forward slash, back slash, and colon with hyphen.
 * Remove disallowed characters.
 * Trim leading and trailing whitespace.
 */
function SanitizeFileName(aName)
{
  var fileName = null;
  if (aName && aName.length > 0)
  {
    fileName = aName.replace(/[\/\\:]/g, "-");
    fileName = fileName.replace(/[\*\?\"\<\>\|]+/g, "");
    fileName = fileName.replace(/^\s+|\s+$/g, "");
    fileName = fileName.substring(0, 216); // Windows limitation
  }

  if (!fileName || 0 == fileName.length)
    fileName = GetLocalizedString("SUGGESTEDFILEPREFIX");

  return fileName;
}

function IntTo2Char(aNumber)
{
  if (!aNumber)
    return "00";

  var s = String(aNumber);
  if (s.length < 2)
    s = '0' + s;

  return s;
}

const kPropBundleURI = "chrome://pagesaver/locale/extension.properties";
var gStringBundle = null;
function GetLocalizedString(aStringName)
{
  try
  {
    if (!gStringBundle)
    {
      gStringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService)
            .createBundle(kPropBundleURI);
    }

    return gStringBundle.GetStringFromName(aStringName);
  } catch(e) {}

  return aStringName;
}

function GetFormattedLocalizedString(aStringName, aArray, aLen)
{
  try
  {
    if (!gStringBundle)
    {
      gStringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService)
            .createBundle(kPropBundleURI);
    }

    return gStringBundle.formatStringFromName(aStringName, aArray, aLen);
  } catch(e) {}

  return aStringName;
}

// Returns the major version only, e.g, 2.
var gPageSaverAppVersion = 0;
function PageSaverGetAppVersion()
{
  if (0 == gPageSaverAppVersion)
  try
  {
    var v = Components.classes["@mozilla.org/xre/app-info;1"]
                     .getService(Components.interfaces.nsIXULAppInfo).version;
    gPageSaverAppVersion = parseInt(v);
  } catch (e) {}

  return gPageSaverAppVersion;
}

// It is OK (but less efficient) to pass null for aCanvasElem.
function PageSaverHaveToDataURL(aCanvasElem)
{
  var haveToDataURL = false;
  const kHTMLNS = "http://www.w3.org/1999/xhtml";
  if (!aCanvasElem)
    aCanvasElem = document.createElementNS(kHTMLNS, "canvas");
  if (aCanvasElem)
    haveToDataURL = ("toDataURL" in aCanvasElem);

  return haveToDataURL;
}

// Returns true if running Firefox 3 and later, not on a Mac.
function PageSaverIsFlashWModeOverrideHelpful()
{
  var ua = navigator.userAgent;
  return ((PageSaverGetAppVersion() >= 3) && (ua.indexOf("Macintosh") < 0));
}

//@line 895 "/cygdrive/c/Dev/src/releng/pagesaver-20090113/browserextensions/pagesaver/mozilla/content/util.js.in"

/************ Functions only called from within this file ********************/
