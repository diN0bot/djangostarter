function init() {
  for (let colors = ['color','textColor','highlightColor','highlightTextColor'], i=0; i < colors.length; i++) {
    let checkbox = document.getElementById('use_'+colors[i]);
    if (document.getElementById('pref_'+colors[i]).value == '')
      color2pref(colors[i]);
    else
      checkbox.checked = true;
    checkbox.setAttribute('oncommand', 'color2pref("'+colors[i]+'")');
  }
  for (let colors = ['targetColor'], i=0; i < colors.length; i++) {
    let checkbox = document.getElementById('use_'+colors[i]);
    init_colors (colors[i]);
    if (document.getElementById('pref_'+colors[i]).value == '')
      colors2pref (colors[i]);
    else
      checkbox.checked = true;
    checkbox.setAttribute('oncommand', 'colors2pref("'+colors[i]+'")');
  }
  let (pref_amount = document.getElementById("pref_amount")) {
    let val = Math.min(pref_amount.value * 5, 500);
    document.getElementById("amount").setAttribute("value", val);
    document.getElementById("amount-display").setAttribute("value", val + '%');
  }
  if (opener.opener.agingTabs.compat)
    document.getElementById("highlight-options").hidden = true;
}
window.addEventListener('load', init, false);

function color2pref(color) {
  var colorpicker = document.getElementById(color),
  checkbox = document.getElementById('use_'+color),
  pref = document.getElementById('pref_'+color);
  if (checkbox.checked) {
    colorpicker.style.removeProperty('visibility');
    pref.value = colorpicker.color;
  } else {
    colorpicker.style.setProperty('visibility', 'hidden', '');
    pref.value = '';
  }
}

function colors2pref(color) {
  var colorpickers = document.getElementById(color),
  checkbox = document.getElementById('use_'+color),
  pref = document.getElementById('pref_'+color),
  buttons = document.getElementById(color+'-buttons');
  if (checkbox.checked) {
    colorpickers.style.removeProperty('visibility');
    buttons.style.removeProperty('visibility');
    let color = [];
    for (let i=0; i < colorpickers.childNodes.length; i++) {
      colorpickers.childNodes[i].initialize();
      if (colorpickers.childNodes[i].color)
        color.push(colorpickers.childNodes[i].color);
    }
    pref.value = color.join(' ');
  } else {
    colorpickers.style.setProperty('visibility', 'hidden', '');
    buttons.style.setProperty('visibility', 'hidden', '');
    pref.value = '';
  }
}

function init_colors(color) {
  var colors = document.getElementById('pref_'+color).value.split(' ');
  for (let i=0; i < colors.length; i++)
    add_color(color, colors[i]);
}

function add_color(color, value) {
  var colorpickers = document.getElementById(color);
  if (colorpickers.childNodes.length >= 5)
    return;
  var cp = document.createElement('colorpicker');
  cp.setAttribute('type', 'button');
  cp.addEventListener('change', function () { colors2pref(color); }, false);
  colorpickers.appendChild(cp);
  if (value) {
    cp.color = value;
    cp.initialize();
  }
}

function remove_color(color) {
  var colorpickers = document.getElementById(color);
  if (colorpickers.childNodes.length == 1)
    return;
  colorpickers.removeChild(colorpickers.lastChild);
  colors2pref(color);
}

function triggerChange() {
  document.getElementById('perSeconds').disabled = document.getElementById('trigger').value != 2;
}

function alter_amount(add) {
  var scale = document.getElementById("amount");
  var pref = document.getElementById("pref_amount");
  if (add) {
    pref.value = Math.max(Math.min(pref.value + add, 100), 0);
    let snap = [0,1,2,3,4,5,6,8,10,12,15,20,25,30,35,40,50,60,70,80,90,100];
    if (snap.indexOf(pref.value) == -1) {
      for (let i = 0; i < snap.length; i++) {
        if (pref.value < snap[i]) {
          pref.value = add > 0 ? snap[i] : snap[i - 1];
          break;
        }
      }
    }
    scale.setAttribute("value", pref.value * 5);
  } else {
    pref.value = Math.round(scale.getAttribute("value") / 5);
  }
  document.getElementById("amount-display").setAttribute("value", pref.value *  5 + "%");
}
