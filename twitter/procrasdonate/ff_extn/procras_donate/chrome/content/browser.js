var agingTabs = {
  trigger: -1,
  lastSelected: null,
  get prefs () {
    delete this.prefs;
    return this.prefs = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService)
                          .getBranch('browser.tabs.').QueryInterface(Ci.nsIPrefBranch2);
  },
  get sessionStore () {
    delete this.sessionStore;
    return this.sessionStore = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
  },
  init: function() {
    let (ss = document.styleSheets) {
      for (let i = ss.length - 1; i >= 0; i--) {
        switch (ss[i].href) {
          case 'chrome://aging-tabs/skin/browser-default.css':
            this.defaultStyleSheet = ss[i];
            break;
          case 'chrome://aging-tabs/skin/browser-highlight.css':
            this.highlightStyleSheet = ss[i];
        }
        if (this.defaultStyleSheet && this.highlightStyleSheet)
          break;
      }
    }
    let (oldval = -1) {
      try {
        oldval = this.prefs.getIntPref('agingAmount');
      } catch (e) {}
      if (oldval >= 0) {
        this.prefs.setIntPref('agingAmount2', oldval * 5);
        this.prefs.clearUserPref('agingAmount');
      }
    }
    this.getAmountPref();
    this.getDelayPref();
    this.getColorPref();
    this.getTextColorPref();
    this.getTargetColorPref();
    this.getHighlightActiveTabPref();
    this.getHighlightColorPref();
    this.getHighlightTextColorPref();
    this.prefs.addObserver('', this, false);

    getBrowser().tabContainer.addEventListener("SSTabRestoring", this, false);
    this.sessionStore.persistTabAttribute("agingTargetColor");
    this.sessionStore.persistTabAttribute("agingCurrentColor");

    window.setTimeout (function (obj) {
      obj.lastSelected = gBrowser.selectedTab;
      obj.getTriggerPref();
      obj.checkCompatMode();
    }, 500, this);
  },
  uninit: function () {
    this.prefs.removeObserver('', this);
    this.prefs = null;
    this.lastSelected = null;
    delete this.sessionStore;
    gBrowser.tabContainer.removeEventListener("SSTabRestoring", this, false);
  },
  checkCompatMode: function (force) {
    if (!force && ("compat" in this))
      return;
    var tab = gBrowser.selectedTab.previousSibling || gBrowser.selectedTab.nextSibling;
    if (!tab)
      return;
    this.compat = false;
    var styleBackup = tab.getAttribute("style");
    tab.removeAttribute("style");
    var tabStyle = getComputedStyle(tab, '');
    if (tabStyle.getPropertyValue('-moz-appearance') != 'none' ||
        tabStyle.getPropertyValue('border-top-style') == 'none') {
      this.highlightStyleSheet.disabled = true;
      this.defaultStyleSheet.cssRules[2].style.removeProperty('background-color');
      this.defaultStyleSheet.cssRules[3].style.removeProperty('background-color');

      let rgb = this.rgbBackground(tabStyle);
      this.defaultStyleSheet.cssRules[2].style.setProperty('outline-style', 'solid', '');
      this.defaultStyleSheet.cssRules[2].style.setProperty('outline-color', 'rgba('+rgb[0]+', '+rgb[1]+', '+rgb[2]+', .4)', '');

      let thickness = tab.boxObject.height * .6 + 'px';
      this.defaultStyleSheet.cssRules[2].style.setProperty('outline-width', thickness, '');
      this.defaultStyleSheet.cssRules[2].style.setProperty('outline-offset', '-' + thickness, '');

      this.compat = true;
    }
    if (styleBackup)
      tab.setAttribute("style", styleBackup);
  },
  parseRgb: function (rgbString) {
    var rgb = rgbString ? rgbString.match(/^rgba?\((\d+), (\d+), (\d+)/) : null;
    if (rgb)
      rgb.shift();
    return rgb;
  },
  rgbBackground: function (computedStyle) {
    return this.parseRgb(computedStyle.getPropertyValue(this.compat ? 'outline-color' : 'background-color')) || [255,255,255];
  },
  step: function () {
    var tabs = gBrowser.tabContainer.childNodes;
    var newSelected = this.lastSelected;
    for (let i = tabs.length - 1; i >= 0; i--) {
      let tab = tabs[i];
      if (tab.selected) {
        newSelected = tab;
        this.resetTab(newSelected);
        continue;
      }
      if (tab == this.lastSelected)
        continue;
      let targetColor = parseInt(tab.getAttribute("agingTargetColor")) || 0;
      if (targetColor == -1)
        continue;
      let rgb = this.parseRgb(tab.getAttribute("agingCurrentColor"));
      if (!rgb || this.targetColors.length == 0) {
        let tabStyle = getComputedStyle(tab, '');
        if (!rgb)
          rgb = this.rgbBackground(tabStyle);
        if (this.targetColors.length == 0) {
          let rgbText = this.parseRgb(tabStyle.getPropertyValue('color')) || [0,0,0];
          let diff = this.compat ? 50 : 150;
          this.targetColors.push([
            component < 127 ? Math.min(255, +component + diff) : Math.max(0, component - diff)
            for each (component in rgbText)
          ]);
        }
      }
      let (change = false) {
        for each (let j in [0,1,2]) {
          let diff = Math.abs(rgb[j] - this.targetColors[ targetColor ][j]);
          if (diff == 0)
            continue;
          let step = 1;
          if (diff > 80 || targetColor + 1 < this.targetColors.length)
            step = 7;
          else if (diff > 70)
            step = 5;
          else if (diff > 65)
            step = 3;
          else if (diff > 20)
            step = 2;
          step = Math.max(1, Math.round(step * this.amount));
          step = Math.min(step, diff);
          if (rgb[j] > this.targetColors[ targetColor ][j])
            step *= -1;
          rgb[j] = +rgb[j] + step;
          change = true;
        }
        if (change) {
          let color = 'rgb('+ rgb[0] +', '+ rgb[1] +', '+ rgb[2] +')';
          tab.setAttribute("agingCurrentColor", color);
          this.setColor(tab, color);
        }
        else if (targetColor + 1 < this.targetColors.length)
          targetColor++;
        else
          targetColor = -1;
        if (targetColor)
          tab.setAttribute("agingTargetColor", targetColor);
      }
    }
    this.lastSelected = newSelected;
  },
  setColor: function (obj, color, important) {
    obj.style.setProperty('background-color', color, important ? 'important' : '');

    var rgba = obj.style.backgroundColor.replace(/^rgb\((.*)\)$/, "rgba($1, .4)");
    if (rgba.substr(0, 5) == "rgba(")
      obj.style.setProperty('outline-color', rgba, important ? 'important' : '');

    if (this.compat)
      obj.style.removeProperty('background-color');
  },
  resetTab: function (tab) {
    tab.style.removeProperty('background-color');
    tab.style.removeProperty('outline-color');
    tab.removeAttribute("agingTargetColor");
    tab.removeAttribute("agingCurrentColor");
  },
  observe: function (subject, topic, data) {
    switch(data) {
      case 'agingTrigger':
      case 'agePerSeconds':
        this.getTriggerPref();
        break;
      case 'agingAmount2':
        this.getAmountPref();
        break;
      case 'agingDelay':
        this.getDelayPref();
        break;
      case 'agingTargetColor':
        this.getTargetColorPref();
        var max = this.targetColors.length - 1;
        var tabs = gBrowser.tabContainer.childNodes;
        for (let i = tabs.length - 1; i >= 0; i--) {
          let color = tabs[i].getAttribute("agingTargetColor");
          if (color == -1 || color > max)
            tabs[i].setAttribute("agingTargetColor", max);
        }
        break;
      case 'color':
        this.getColorPref();
        this.getTargetColorPref();
        break;
      case 'textColor':
        this.getTextColorPref();
        this.getTargetColorPref();
        break;
      case 'highlightActiveTab':
        this.getHighlightActiveTabPref();
        break;
      case 'highlightColor':
        this.getHighlightColorPref();
        break;
      case 'highlightTextColor':
        this.getHighlightTextColorPref();
        break;
    }
  },
  getTriggerPref: function () {
    gBrowser.tabContainer.removeEventListener('TabSelect', this, false);
    gURLBar.removeEventListener('ValueChange', this, true);
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = 0;
    }
    this.trigger = this.prefs.getIntPref('agingTrigger');
    switch (this.trigger) {
      case 0:
        gBrowser.tabContainer.addEventListener('TabSelect', this, false);
        break;
      case 1:
        gURLBar.addEventListener('ValueChange', this, true);
        break;
      case 2:
        gBrowser.tabContainer.addEventListener('TabSelect', this, false);
        let (seconds = this.prefs.getIntPref('agePerSeconds')) {
          if (seconds > 0)
            this.interval = window.setInterval(function (obj) { obj.step() }, seconds*1000, this);
        }
        break;
    }
  },
  getAmountPref: function () {
    this.amount = this.prefs.getIntPref('agingAmount2') / 20;
  },
  getDelayPref: function () {
    this.delay = this.prefs.getIntPref('agingDelay');
  },
  getTargetColorPref: function () {
    var colors = this.prefs.getCharPref('agingTargetColor').split(' ');
    this.targetColors = [];
    for (let i=0; i < colors.length; i++)
      if (/^#[\dA-F]{6}$/.test(colors[i]))
        this.targetColors.push([
          parseInt(colors[i].substring(1, 3), 16),
          parseInt(colors[i].substring(3, 5), 16),
          parseInt(colors[i].substring(5, 7), 16)]);
  },
  getColorPref: function () {
    var color = this.prefs.getCharPref('color') || '-moz-dialog';
    this.setColor(this.defaultStyleSheet.cssRules[2], color);
    this.setColor(this.defaultStyleSheet.cssRules[3], color, true);
    this.checkCompatMode(true);
  },
  getTextColorPref: function () {
    var color = this.prefs.getCharPref('textColor') || '-moz-dialogtext';
    this.defaultStyleSheet.cssRules[2].style.setProperty('color', color, '');
    this.defaultStyleSheet.cssRules[3].style.setProperty('color', color, 'important');
    this.defaultStyleSheet.cssRules[4].style.setProperty('border-color', color, '');
  },
  getHighlightActiveTabPref: function () {
    this.highlightStyleSheet.disabled = !this.prefs.getBoolPref('highlightActiveTab') || this.compat;
  },
  getHighlightColorPref: function () {
    var color = this.prefs.getCharPref('highlightColor') || 'highlight';
    this.highlightStyleSheet.cssRules[2].style.setProperty('background-color', color, 'important');
  },
  getHighlightTextColorPref: function () {
    var color = this.prefs.getCharPref('highlightTextColor') || 'highlighttext';
    this.highlightStyleSheet.cssRules[3].style.setProperty('color', color, 'important');
    this.highlightStyleSheet.cssRules[4].style.setProperty('border-color', color, '');
  },
  handleEvent: function (event) {
    switch (event.type) {
      case "TabSelect":
      case "ValueChange":
        if (this.timeout)
          window.clearTimeout(this.timeout);
        this.timeout = window.setTimeout(this.trigger == 2 ?
          function (obj) { obj.resetTab(gBrowser.selectedTab) } :
          function (obj) { obj.step() }, this.delay, this);
        this.checkCompatMode();
        break;
      case "SSTabRestoring":
        if (event.target.hasAttribute("agingCurrentColor") && !event.target.hasAttribute("selected")) {
          this.checkCompatMode();
          this.setColor(event.target, event.target.getAttribute("agingCurrentColor"));
        }
        break;
    } 
  }
};

window.addEventListener('load', function () {
  agingTabs.init();
}, false);
window.addEventListener('unload', function () {
  agingTabs.uninit();
}, false);