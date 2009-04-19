/* Copyright (c) 2006 Pearl Crescent, LLC.  All Rights Reserved. */


const kKeysBundleURI = "chrome://global/locale/keys.properties";
const kPlatformKeysBundleURI =
                     "chrome://global-platform/locale/platformKeys.properties";
var gKeysStringBundle;
var gPlatformKeysStringBundle;
var gDOMVKToString = [];

const knsIDOMKeyEvent = Components.interfaces.nsIDOMKeyEvent;
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F1] = "VK_F1";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F2] = "VK_F2";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F3] = "VK_F3";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F4] = "VK_F4";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F5] = "VK_F5";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F6] = "VK_F6";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F7] = "VK_F7";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F8] = "VK_F8";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F9] = "VK_F9";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F10] = "VK_F10";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F11] = "VK_F11";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F12] = "VK_F12";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F13] = "VK_F13";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F14] = "VK_F14";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F15] = "VK_F15";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F16] = "VK_F16";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F17] = "VK_F17";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F18] = "VK_F18";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F19] = "VK_F19";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_F20] = "VK_F20";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_RETURN] = "VK_RETURN";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_ENTER] = "VK_ENTER";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_UP] = "VK_UP";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_DOWN] = "VK_DOWN";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_LEFT] = "VK_LEFT";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_RIGHT] = "VK_RIGHT";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_PAGE_UP] = "VK_PAGE_UP";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_PAGE_DOWN] = "VK_PAGE_DOWN";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_HOME] = "VK_HOME";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_END] = "VK_END";
// gDOMVKToString[knsIDOMKeyEvent.DOM_VK_PRINTSCREEN] = "VK_PRINTSCREEN";
gDOMVKToString[knsIDOMKeyEvent.DOM_VK_INSERT] = "VK_INSERT";

/************ Public functions (called from outside this file) ***************/

function KeyCodeToDisplayString(aVKCode)
{
  var displayString = null;

  try
  {
    if (!gPlatformKeysStringBundle)
    {
      var sbSvc = Components.classes["@mozilla.org/intl/stringbundle;1"]
                  .getService(Components.interfaces.nsIStringBundleService);
      gKeysStringBundle = sbSvc.createBundle(kKeysBundleURI);
      gPlatformKeysStringBundle = sbSvc.createBundle(kPlatformKeysBundleURI);
    }

    displayString = gPlatformKeysStringBundle.GetStringFromName(aVKCode);
  } catch (e) {};

  if (displayString == null)
  {
    try
    {
      displayString = gKeysStringBundle.GetStringFromName(aVKCode);
    } catch (e) {};
  }

  if (displayString == null)
    displayString = aVKCode;

  return displayString;
}

function DOMVKToString(aVKCode)
{
  return gDOMVKToString[aVKCode] ? gDOMVKToString[aVKCode] : null;
}

/************ Functions only called from within this file ********************/
